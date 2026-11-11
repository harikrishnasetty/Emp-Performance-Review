"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  cycleParticipants,
  reviewCycles,
  reviewRatings,
  reviewTemplates,
  reviews,
  templateCompetencies,
  users,
} from "@/lib/db/schema";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";
import { encryptField } from "@/lib/crypto";
import { recalibrateParticipant } from "@/lib/services/reviews";
import { notify, notifyMany } from "@/lib/services/notifications";
import { can } from "@/lib/auth/rbac";

async function loadReviewForActor(reviewId: string, actorId: string) {
  const [row] = await db
    .select({
      review: reviews,
      participant: cycleParticipants,
      cycle: reviewCycles,
    })
    .from(reviews)
    .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
    .innerJoin(reviewCycles, eq(reviewCycles.id, reviews.cycleId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!row) throw new ActionError("That review could not be found.");
  if (row.review.reviewerId !== actorId) {
    throw new ActionError("You are not the assigned reviewer for this review.", "forbidden");
  }
  if (row.review.status === "LOCKED") {
    throw new ActionError("This review has been locked and can no longer be edited.");
  }
  if (row.cycle.status === "ARCHIVED" || row.cycle.status === "CLOSED") {
    throw new ActionError("The review cycle is closed.");
  }
  return row;
}

const ratingInput = z.object({
  templateCompetencyId: z.string().uuid(),
  ratingValue: z.number().int().min(1).max(10).nullable(),
  comment: z.string().max(4000).nullable().optional(),
});

const saveReviewSchema = z.object({
  reviewId: z.string().uuid(),
  summary: z.string().max(6000).optional(),
  strengths: z.string().max(6000).optional(),
  development: z.string().max(6000).optional(),
  overallRating: z.number().min(1).max(10).nullable().optional(),
  ratings: z.array(ratingInput).max(60),
});

export async function saveReview(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "review.save",
    schema: saveReviewSchema,
    input,
    limit: 240,
    handler: async (data, ctx) => {
      const { review, cycle } = await loadReviewForActor(data.reviewId, ctx.user.id);

      // Verify every competency belongs to this cycle's template.
      if (data.ratings.length && cycle.templateId) {
        const valid = await db
          .select({ id: templateCompetencies.id })
          .from(templateCompetencies)
          .where(
            and(
              eq(templateCompetencies.templateId, cycle.templateId),
              inArray(
                templateCompetencies.id,
                data.ratings.map((r) => r.templateCompetencyId),
              ),
            ),
          );
        const idSet = new Set(valid.map((v) => v.id));
        const foreign = data.ratings.find((r) => !idSet.has(r.templateCompetencyId));
        if (foreign) {
          throw new ActionError(
            "One or more competency ratings do not belong to this review template.",
            "validation",
          );
        }
      }

      await db
        .update(reviews)
        .set({
          summaryEnc: encryptField(data.summary ?? null),
          strengthsEnc: encryptField(data.strengths ?? null),
          developmentEnc: encryptField(data.development ?? null),
          overallRating:
            data.overallRating === null || data.overallRating === undefined
              ? null
              : String(data.overallRating),
          status: "DRAFT",
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, data.reviewId));

      for (const r of data.ratings) {
        await db
          .insert(reviewRatings)
          .values({
            reviewId: data.reviewId,
            templateCompetencyId: r.templateCompetencyId,
            ratingValue: r.ratingValue,
            commentEnc: encryptField(r.comment ?? null),
          })
          .onConflictDoUpdate({
            target: [reviewRatings.reviewId, reviewRatings.templateCompetencyId],
            set: {
              ratingValue: r.ratingValue,
              commentEnc: encryptField(r.comment ?? null),
              updatedAt: new Date(),
            },
          });
      }

      await db
        .update(cycleParticipants)
        .set({ status: "IN_PROGRESS" })
        .where(
          and(
            eq(cycleParticipants.id, review.participantId),
            eq(cycleParticipants.status, "NOT_STARTED"),
          ),
        );

      revalidatePath(`/reviews/${data.reviewId}`);
      revalidatePath("/reviews");
      return null;
    },
  });
}

export async function submitReview(reviewId: string): Promise<ActionResult<null>> {
  return action({
    name: "review.submit",
    schema: z.string().uuid(),
    input: reviewId,
    limit: 30,
    handler: async (id, ctx) => {
      const { review, participant } = await loadReviewForActor(id, ctx.user.id);

      const ratings = await db
        .select({ value: reviewRatings.ratingValue })
        .from(reviewRatings)
        .where(eq(reviewRatings.reviewId, id));

      if (review.reviewerType !== "SELF" && ratings.every((r) => r.value === null)) {
        throw new ActionError(
          "Add at least one competency rating before submitting.",
          "validation",
        );
      }

      const now = new Date();
      await db
        .update(reviews)
        .set({ status: "SUBMITTED", submittedAt: now, updatedAt: now })
        .where(eq(reviews.id, id));

      // Advance the participant state machine.
      if (review.reviewerType === "SELF") {
        // Participants without a line manager have no manager review to wait
        // for, so their self assessment is the last thing they owe. Without
        // this they would stay SELF_COMPLETE forever and cycle progress could
        // never reach 100%.
        const [managerReview] = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(
            and(
              eq(reviews.participantId, review.participantId),
              eq(reviews.reviewerType, "MANAGER"),
            ),
          )
          .limit(1);

        await db
          .update(cycleParticipants)
          .set(
            managerReview
              ? { status: "SELF_COMPLETE" }
              : { status: "COMPLETE", completedAt: now },
          )
          .where(eq(cycleParticipants.id, review.participantId));

        // Step 6 hand-off: the manager's review should be informed by what the
        // employee wrote. Give them a direct link the moment it is submitted.
        if (participant.managerId) {
          await notify({
            userId: participant.managerId,
            type: "review.self_submitted",
            title: `${ctx.user.displayName} submitted their self assessment`,
            body: "Read it before writing your review.",
            href: `/reviews/${id}`,
            actorId: ctx.user.id,
            entityType: "review",
            entityId: id,
          });
        }
      } else if (review.reviewerType === "MANAGER" || review.reviewerType === "SKIP_LEVEL") {
        const scores = await recalibrateParticipant(review.participantId);
        await db
          .update(cycleParticipants)
          .set({
            status: "AWAITING_ACKNOWLEDGEMENT",
            proposedRating:
              scores.suggestedRating === null ? null : String(scores.suggestedRating),
          })
          .where(eq(cycleParticipants.id, review.participantId));

        await notify({
          userId: participant.employeeId,
          type: "review.ready",
          title: "Your performance review is ready",
          body: "Open Meridian to read and acknowledge your review.",
          href: `/reviews/${id}`,
          actorId: ctx.user.id,
          entityType: "review",
          entityId: id,
        });
      }

      await auditAction(ctx, {
        action: "review.submitted",
        entityType: "review",
        entityId: id,
        targetUserId: participant.employeeId,
        summary: `${review.reviewerType} review submitted`,
      });

      revalidatePath("/reviews");
      revalidatePath(`/reviews/${id}`);
      revalidatePath("/dashboard");
      revalidatePath("/team");
      return null;
    },
  });
}

const acknowledgeSchema = z.object({
  reviewId: z.string().uuid(),
  comment: z.string().max(4000).optional(),
});

export async function acknowledgeReview(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "review.acknowledge",
    schema: acknowledgeSchema,
    input,
    limit: 20,
    handler: async (data, ctx) => {
      const [row] = await db
        .select({ review: reviews, participant: cycleParticipants })
        .from(reviews)
        .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
        .where(eq(reviews.id, data.reviewId))
        .limit(1);

      if (!row) throw new ActionError("Review not found.");
      if (row.review.reviewerType === "SELF") {
        throw new ActionError("A self assessment is never acknowledged by its author.", "forbidden");
      }
      if (row.participant.employeeId !== ctx.user.id) {
        throw new ActionError("Only the employee can acknowledge their own review.", "forbidden");
      }
      if (row.review.status !== "SUBMITTED") {
        throw new ActionError("This review is not awaiting acknowledgement.");
      }

      const now = new Date();
      await db
        .update(reviews)
        .set({
          status: "ACKNOWLEDGED",
          acknowledgedAt: now,
          acknowledgementCommentEnc: encryptField(data.comment ?? null),
          updatedAt: now,
        })
        .where(eq(reviews.id, data.reviewId));

      await db
        .update(cycleParticipants)
        .set({ status: "COMPLETE", completedAt: now })
        .where(eq(cycleParticipants.id, row.participant.id));

      await notify({
        userId: row.review.reviewerId,
        type: "review.acknowledged",
        title: "Review acknowledged",
        body: "Your team member has acknowledged their review.",
        href: `/reviews/${data.reviewId}`,
        actorId: ctx.user.id,
      });

      await auditAction(ctx, {
        action: "review.acknowledged",
        entityType: "review",
        entityId: data.reviewId,
        targetUserId: ctx.user.id,
        summary: "Employee acknowledged their review",
      });

      revalidatePath("/reviews");
      revalidatePath(`/reviews/${data.reviewId}`);
      return null;
    },
  });
}

const returnSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.string().min(5, "Give a short reason so the reviewer knows what to change.").max(1000),
});

export async function returnReview(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "review.return",
    schema: returnSchema,
    input,
    limit: 20,
    handler: async (data, ctx) => {
      const [row] = await db
        .select({ review: reviews, participant: cycleParticipants })
        .from(reviews)
        .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
        .where(eq(reviews.id, data.reviewId))
        .limit(1);

      if (!row) throw new ActionError("Review not found.");
      if (row.review.reviewerType === "SELF") {
        throw new ActionError("A self assessment cannot be sent back.", "forbidden");
      }

      const isSubject = row.participant.employeeId === ctx.user.id;
      if (!isSubject && !can(ctx.user, "review:write:any")) {
        throw new ActionError("You cannot return this review.", "forbidden");
      }
      if (row.review.status !== "SUBMITTED") {
        throw new ActionError("Only submitted reviews can be returned.");
      }

      await db
        .update(reviews)
        .set({
          status: "RETURNED",
          returnedAt: new Date(),
          returnReason: data.reason,
          updatedAt: new Date(),
        })
        .where(eq(reviews.id, data.reviewId));

      await notify({
        userId: row.review.reviewerId,
        type: "review.returned",
        title: "Review returned for revision",
        body: data.reason.slice(0, 180),
        href: `/reviews/${data.reviewId}`,
        actorId: ctx.user.id,
      });

      await auditAction(ctx, {
        action: "review.returned",
        entityType: "review",
        entityId: data.reviewId,
        targetUserId: row.review.reviewerId,
        summary: `Review returned: ${data.reason.slice(0, 120)}`,
      });

      revalidatePath("/reviews");
      revalidatePath(`/reviews/${data.reviewId}`);
      return null;
    },
  });
}

/* ─────────────────────────── Cycle administration ──────────────────────── */

const enrolSchema = z.object({
  cycleId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1).max(5000),
});

export async function enrolParticipants(input: unknown): Promise<ActionResult<{ created: number }>> {
  return action({
    name: "cycle.enrol",
    schema: enrolSchema,
    input,
    capability: "cycle:manage",
    limit: 10,
    handler: async (data, ctx) => {
      const [cycle] = await db
        .select()
        .from(reviewCycles)
        .where(eq(reviewCycles.id, data.cycleId))
        .limit(1);
      if (!cycle) throw new ActionError("Cycle not found.");

      const people = await db
        .select({
          id: users.id,
          managerId: users.managerId,
          departmentId: users.departmentId,
        })
        .from(users)
        .where(inArray(users.id, data.employeeIds));

      let created = 0;
      for (const person of people) {
        const [participant] = await db
          .insert(cycleParticipants)
          .values({
            cycleId: data.cycleId,
            employeeId: person.id,
            managerId: person.managerId,
            departmentId: person.departmentId,
            status: "IN_PROGRESS",
          })
          .onConflictDoNothing()
          .returning({ id: cycleParticipants.id });

        if (!participant) continue;
        created++;

        await db.insert(reviews).values({
          cycleId: data.cycleId,
          participantId: participant.id,
          reviewerId: person.id,
          reviewerType: "SELF",
          dueDate: cycle.selfReviewDue,
        });

        if (person.managerId) {
          await db.insert(reviews).values({
            cycleId: data.cycleId,
            participantId: participant.id,
            reviewerId: person.managerId,
            reviewerType: "MANAGER",
            dueDate: cycle.managerReviewDue,
          });
        }
      }

      await notifyMany(
        people.filter((p) => p.managerId).map((p) => p.managerId!),
        {
          type: "cycle.enrolled",
          title: `${cycle.name} has started`,
          body: "Your team is enrolled — reviews are now open.",
          href: `/reviews?cycle=${cycle.id}`,
          actorId: ctx.user.id,
        },
      );

      await auditAction(ctx, {
        action: "cycle.enrolled",
        entityType: "review_cycle",
        entityId: data.cycleId,
        summary: `Enrolled ${created} participants`,
      });

      revalidatePath("/admin/cycles");
      revalidatePath("/reviews");
      return { created };
    },
  });
}

export async function lockCycle(cycleId: string): Promise<ActionResult<null>> {
  return action({
    name: "cycle.lock",
    schema: z.string().uuid(),
    input: cycleId,
    capability: "cycle:manage",
    limit: 5,
    handler: async (id, ctx) => {
      await db
        .update(reviews)
        .set({ status: "LOCKED", updatedAt: new Date() })
        .where(eq(reviews.cycleId, id));
      await db
        .update(reviewCycles)
        .set({ status: "CLOSED", closedAt: new Date(), updatedAt: new Date() })
        .where(eq(reviewCycles.id, id));

      await auditAction(ctx, {
        action: "cycle.closed",
        entityType: "review_cycle",
        entityId: id,
        summary: "Cycle closed and reviews locked",
      });

      revalidatePath("/admin/cycles");
      revalidatePath("/reviews");
      return null;
    },
  });
}

export async function publishCycle(cycleId: string): Promise<ActionResult<null>> {
  return action({
    name: "cycle.publish",
    schema: z.string().uuid(),
    input: cycleId,
    capability: "cycle:manage",
    limit: 5,
    handler: async (id, ctx) => {
      const [cycle] = await db
        .select()
        .from(reviewCycles)
        .where(eq(reviewCycles.id, id))
        .limit(1);
      if (!cycle) throw new ActionError("Cycle not found.");

      if (!cycle.templateId) {
        throw new ActionError("Attach a published template before opening the cycle.");
      }
      const [template] = await db
        .select({ status: reviewTemplates.status })
        .from(reviewTemplates)
        .where(eq(reviewTemplates.id, cycle.templateId))
        .limit(1);
      if (template?.status !== "PUBLISHED") {
        throw new ActionError("The attached template must be published first.");
      }

      await db
        .update(reviewCycles)
        .set({ status: "SELF_REVIEW", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(reviewCycles.id, id));

      await auditAction(ctx, {
        action: "cycle.published",
        entityType: "review_cycle",
        entityId: id,
        summary: `${cycle.name} opened for self reviews`,
      });

      revalidatePath("/admin/cycles");
      revalidatePath("/reviews");
      return null;
    },
  });
}
