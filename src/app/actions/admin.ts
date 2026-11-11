"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  competencies,
  cycleParticipants,
  departments,
  reviewCycles,
  reviews,
  reviewTemplates,
  templateCompetencies,
  users,
} from "@/lib/db/schema";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";
import { hashPassword } from "@/lib/password";
import { updatePerson } from "@/lib/services/people";
import { recalibrateParticipant } from "@/lib/services/reviews";
import { revokeAllSessions } from "@/lib/auth/oidc";
import { slugify } from "@/lib/utils";

/* ───────────────────────────── Directory admin ─────────────────────────── */

const personSchema = z.object({
  userId: z.string().uuid(),
  jobTitle: z.string().max(160).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  systemRole: z.enum(["ADMIN", "HR", "EXEC", "USER"]).optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD", "INACTIVE"]).optional(),
  employeeCode: z.string().max(64).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
});

export async function adminUpdatePerson(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "admin.person.update",
    schema: personSchema,
    input,
    capability: "user:manage",
    limit: 60,
    handler: async (data, ctx) => {
      const [before] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
      if (!before) throw new ActionError("Person not found.");

      // Guard against an administrator removing their own last privilege.
      if (
        data.userId === ctx.user.id &&
        data.systemRole &&
        data.systemRole !== "ADMIN"
      ) {
        throw new ActionError("You cannot remove your own administrator role.", "forbidden");
      }

      try {
        await updatePerson(data.userId, {
          ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
          ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
          ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
          ...(data.systemRole ? { systemRole: data.systemRole } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.employeeCode !== undefined ? { employeeCode: data.employeeCode } : {}),
          ...(data.location !== undefined ? { location: data.location } : {}),
        });
      } catch (err) {
        throw new ActionError((err as Error).message);
      }

      // A role or status change must invalidate existing sessions so the new
      // permissions take effect immediately.
      if (
        (data.systemRole && data.systemRole !== before.systemRole) ||
        data.status === "INACTIVE"
      ) {
        await revokeAllSessions(data.userId, "privilege_change");
      }

      await auditAction(ctx, {
        action: "admin.person.updated",
        entityType: "user",
        entityId: data.userId,
        targetUserId: data.userId,
        summary: `Administrative update for ${before.email}`,
        metadata: {
          roleChanged: data.systemRole && data.systemRole !== before.systemRole,
          statusChanged: data.status && data.status !== before.status,
          managerChanged: data.managerId !== undefined && data.managerId !== before.managerId,
        },
      });

      revalidatePath("/admin/people");
      revalidatePath("/people");
      return null;
    },
  });
}

const createPersonSchema = z
  .object({
    email: z.string().email().max(320),
    displayName: z.string().min(2).max(160),
    jobTitle: z.string().max(160).nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
    systemRole: z.enum(["ADMIN", "HR", "EXEC", "USER"]).default("USER"),
    status: z
      .enum(["ACTIVE", "ON_LEAVE", "NOTICE_PERIOD", "INACTIVE"])
      .default("ACTIVE"),
    employeeCode: z.string().max(64).nullable().optional(),
    location: z.string().max(120).nullable().optional(),
    /** LOCAL = email + password (no Entra ID); SSO = Entra ID only. */
    authMode: z.enum(["LOCAL", "SSO"]).default("LOCAL"),
    password: z.string().min(12).max(256).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.authMode === "LOCAL" && !data.password) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "A password of at least 12 characters is required for local accounts.",
      });
    }
  });

/**
 * Creates a person directly, without waiting for an Entra ID first login.
 *
 * LOCAL accounts get a scrypt-hashed password and can sign in immediately via
 * the email/password form; SSO accounts become signable on the person's first
 * Microsoft login. Local access can later be disabled from the same screen.
 */
export async function adminCreatePerson(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "admin.person.create",
    schema: createPersonSchema,
    input,
    capability: "user:manage",
    limit: 20,
    handler: async (data, ctx) => {
      const email = data.email.trim().toLowerCase();
      const displayName = data.displayName.trim();

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (existing) {
        throw new ActionError("A person with that email already exists.", "conflict", {
          email: "Already in the directory",
        });
      }

      if (data.departmentId) {
        const [department] = await db
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.id, data.departmentId))
          .limit(1);
        if (!department) {
          throw new ActionError("Choose a valid department.", "validation", {
            departmentId: "Unknown department",
          });
        }
      }

      if (data.managerId) {
        const [manager] = await db
          .select({ id: users.id, deactivatedAt: users.deactivatedAt })
          .from(users)
          .where(eq(users.id, data.managerId))
          .limit(1);
        if (!manager || manager.deactivatedAt) {
          throw new ActionError("Choose an active manager.", "validation", {
            managerId: "Unknown or inactive manager",
          });
        }
      }

      const isLocal = data.authMode === "LOCAL";
      const now = new Date();

      const [created] = await db
        .insert(users)
        .values({
          email,
          displayName,
          jobTitle: data.jobTitle?.trim() || null,
          departmentId: data.departmentId ?? null,
          managerId: data.managerId ?? null,
          systemRole: data.systemRole,
          status: data.status,
          employeeCode: data.employeeCode?.trim() || null,
          location: data.location?.trim() || null,
          deactivatedAt: data.status === "INACTIVE" ? now : null,
          authProvider: isLocal ? "LOCAL" : "SSO",
          passwordHash: isLocal ? hashPassword(data.password!) : null,
          passwordChangedAt: isLocal ? now : null,
        })
        .returning({ id: users.id });

      await auditAction(ctx, {
        action: "admin.person.created",
        entityType: "user",
        entityId: created!.id,
        targetUserId: created!.id,
        summary: `Created ${isLocal ? "local (non-SSO)" : "SSO"} account for ${email}`,
        metadata: {
          authProvider: isLocal ? "LOCAL" : "SSO",
          systemRole: data.systemRole,
          status: data.status,
        },
      });

      revalidatePath("/admin/people");
      revalidatePath("/people");
      return { id: created!.id };
    },
  });
}

/* ────────────────────────────── Cycles admin ───────────────────────────── */

const cycleSchema = z.object({
  name: z.string().min(3).max(160),
  type: z.enum(["ANNUAL", "MID_YEAR", "QUARTERLY", "PROBATION", "PROJECT", "AD_HOC"]),
  periodStart: z.string().min(8),
  periodEnd: z.string().min(8),
  selfReviewDue: z.string().optional(),
  managerReviewDue: z.string().optional(),
  templateId: z.string().uuid().nullable().optional(),
  ratingScaleId: z.string().uuid().nullable().optional(),
  selfReviewEnabled: z.boolean().default(true),
  peerReviewEnabled: z.boolean().default(true),
  peerReviewCount: z.coerce.number().int().min(0).max(10).default(3),
  goalsWeight: z.coerce.number().min(0).max(100).default(50),
  competenciesWeight: z.coerce.number().min(0).max(100).default(50),
  departmentIds: z.array(z.string().uuid()).max(200).default([]),
});

export async function createCycle(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "admin.cycle.create",
    schema: cycleSchema,
    input,
    capability: "cycle:manage",
    limit: 20,
    handler: async (data, ctx) => {
      if (data.periodEnd < data.periodStart) {
        throw new ActionError("The period end must be after the start.", "validation", {
          periodEnd: "Must be after the start date",
        });
      }
      if (Math.abs(data.goalsWeight + data.competenciesWeight - 100) > 0.01) {
        throw new ActionError("Goals and competencies weights must add up to 100.", "validation", {
          competenciesWeight: "Weights must total 100",
        });
      }

      const base = slugify(data.name) || "cycle";
      const slug = `${base}-${Date.now().toString(36).slice(-4)}`;

      const [row] = await db
        .insert(reviewCycles)
        .values({
          name: data.name.trim(),
          slug,
          type: data.type,
          status: "DRAFT",
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          selfReviewDue: data.selfReviewDue || null,
          managerReviewDue: data.managerReviewDue || null,
          templateId: data.templateId || null,
          ratingScaleId: data.ratingScaleId || null,
          selfReviewEnabled: data.selfReviewEnabled,
          peerReviewEnabled: data.peerReviewEnabled,
          peerReviewCount: data.peerReviewCount,
          goalsWeight: String(data.goalsWeight),
          competenciesWeight: String(data.competenciesWeight),
          departmentIds: data.departmentIds,
          createdBy: ctx.user.id,
        })
        .returning({ id: reviewCycles.id });

      await auditAction(ctx, {
        action: "admin.cycle.created",
        entityType: "review_cycle",
        entityId: row!.id,
        summary: `Created cycle “${data.name}”`,
      });

      revalidatePath("/admin/cycles");
      return { id: row!.id };
    },
  });
}

export async function updateCycleStatus(
  cycleId: string,
  status:
    | "DRAFT"
    | "SCHEDULED"
    | "GOAL_SETTING"
    | "MID_YEAR_SELF"
    | "MID_YEAR_MANAGER"
    | "SELF_REVIEW"
    | "MANAGER_REVIEW"
    | "CALIBRATION"
    | "ACKNOWLEDGEMENT"
    | "CLOSED"
    | "ARCHIVED",
): Promise<ActionResult<null>> {
  return action({
    name: "admin.cycle.status",
    schema: z.object({
      cycleId: z.string().uuid(),
      status: z.enum([
        "DRAFT",
        "SCHEDULED",
        "GOAL_SETTING",
        "MID_YEAR_SELF",
        "MID_YEAR_MANAGER",
        "SELF_REVIEW",
        "MANAGER_REVIEW",
        "CALIBRATION",
        "ACKNOWLEDGEMENT",
        "CLOSED",
        "ARCHIVED",
      ]),
    }),
    input: { cycleId, status },
    capability: "cycle:manage",
    limit: 30,
    handler: async (data, ctx) => {
      await db
        .update(reviewCycles)
        .set({ status: data.status, updatedAt: new Date() })
        .where(eq(reviewCycles.id, data.cycleId));

      await auditAction(ctx, {
        action: "admin.cycle.status",
        entityType: "review_cycle",
        entityId: data.cycleId,
        summary: `Cycle status → ${data.status}`,
      });

      revalidatePath("/admin/cycles");
      revalidatePath("/reviews");
      return null;
    },
  });
}

/* ─────────────────────────────── Calibration ───────────────────────────── */

const calibrateSchema = z.object({
  participantId: z.string().uuid(),
  finalRating: z.coerce.number().min(1).max(10),
  nineBoxPerformance: z.coerce.number().int().min(1).max(3).nullable().optional(),
  nineBoxPotential: z.coerce.number().int().min(1).max(3).nullable().optional(),
  note: z.string().max(1000).optional(),
});

export async function calibrateParticipant(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "admin.calibrate",
    schema: calibrateSchema,
    input,
    capability: "calibration:manage",
    limit: 120,
    handler: async (data, ctx) => {
      const { db: database } = await import("@/lib/db");
      const { cycleParticipants } = await import("@/lib/db/schema");

      const [row] = await database
        .select()
        .from(cycleParticipants)
        .where(eq(cycleParticipants.id, data.participantId))
        .limit(1);
      if (!row) throw new ActionError("Participant not found.");

      await database
        .update(cycleParticipants)
        .set({
          finalRating: String(data.finalRating),
          nineBoxPerformance: data.nineBoxPerformance ?? null,
          nineBoxPotential: data.nineBoxPotential ?? null,
          calibratedAt: new Date(),
          calibratedBy: ctx.user.id,
        })
        .where(eq(cycleParticipants.id, data.participantId));

      await auditAction(ctx, {
        action: "admin.calibrated",
        entityType: "cycle_participant",
        entityId: data.participantId,
        targetUserId: row.employeeId,
        summary: `Final rating set to ${data.finalRating}`,
        metadata: {
          previous: row.finalRating,
          nineBox: [data.nineBoxPerformance, data.nineBoxPotential],
          note: data.note,
        },
      });

      revalidatePath("/admin/calibration");
      return null;
    },
  });
}

/* ────────────────────────────── Enrolment ──────────────────────────────── */

const enrolSchema = z.object({
  cycleId: z.string().uuid(),
  departmentIds: z.array(z.string().uuid()).max(200).default([]),
  includeOnLeave: z.boolean().default(true),
});

/**
 * Enrols everyone in scope and creates the review tasks they will need.
 * Idempotent: re-running only fills in what is missing.
 */
export async function enrolParticipants(input: unknown): Promise<
  ActionResult<{ enrolled: number; tasks: number }>
> {
  return action({
    name: "admin.cycle.enrol",
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
      if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED") {
        throw new ActionError("This cycle is closed — reopen it before enrolling people.");
      }

      const scope = data.departmentIds.length ? data.departmentIds : cycle.departmentIds;
      const conditions = [isNull(users.deactivatedAt), ne(users.status, "INACTIVE")];
      if (!data.includeOnLeave) conditions.push(ne(users.status, "ON_LEAVE"));
      if (scope.length) conditions.push(inArray(users.departmentId, scope));

      const people = await db
        .select({
          id: users.id,
          managerId: users.managerId,
          departmentId: users.departmentId,
        })
        .from(users)
        .where(and(...conditions));

      if (people.length === 0) {
        throw new ActionError("Nobody matches that scope. Check department filters.");
      }

      const inserted = await db
        .insert(cycleParticipants)
        .values(
          people.map((person) => ({
            cycleId: cycle.id,
            employeeId: person.id,
            managerId: person.managerId,
            departmentId: person.departmentId,
          })),
        )
        .onConflictDoNothing({
          target: [cycleParticipants.cycleId, cycleParticipants.employeeId],
        })
        .returning({
          id: cycleParticipants.id,
          employeeId: cycleParticipants.employeeId,
          managerId: cycleParticipants.managerId,
        });

      // Existing participants still need their tasks if a previous run stopped early.
      const participants = inserted.length
        ? inserted
        : await db
            .select({
              id: cycleParticipants.id,
              employeeId: cycleParticipants.employeeId,
              managerId: cycleParticipants.managerId,
            })
            .from(cycleParticipants)
            .where(eq(cycleParticipants.cycleId, cycle.id));

      const taskRows: (typeof reviews.$inferInsert)[] = [];
      for (const participant of participants) {
        if (cycle.selfReviewEnabled) {
          taskRows.push({
            cycleId: cycle.id,
            participantId: participant.id,
            reviewerId: participant.employeeId,
            reviewerType: "SELF",
            dueDate: cycle.selfReviewDue,
          });
        }
        if (participant.managerId && participant.managerId !== participant.employeeId) {
          taskRows.push({
            cycleId: cycle.id,
            participantId: participant.id,
            reviewerId: participant.managerId,
            reviewerType: "MANAGER",
            dueDate: cycle.managerReviewDue,
          });
        }
      }

      const tasks = taskRows.length
        ? await db
            .insert(reviews)
            .values(taskRows)
            .onConflictDoNothing({
              target: [reviews.participantId, reviews.reviewerType, reviews.reviewerId],
            })
            .returning({ id: reviews.id })
        : [];

      if (cycle.status === "DRAFT") {
        await db
          .update(reviewCycles)
          .set({ status: "SCHEDULED", updatedAt: new Date() })
          .where(eq(reviewCycles.id, cycle.id));
      }

      await auditAction(ctx, {
        action: "admin.cycle.enrolled",
        entityType: "review_cycle",
        entityId: cycle.id,
        summary: `Enrolled ${participants.length} participants`,
        metadata: {
          participants: participants.length,
          tasks: tasks.length,
          departments: scope,
        },
      });

      revalidatePath("/admin/cycles");
      revalidatePath("/reviews");
      return { enrolled: participants.length, tasks: tasks.length };
    },
  });
}

/** Recomputes scores for everyone in a cycle. Safe to re-run. */
export async function recalculateCycleScores(
  cycleId: string,
): Promise<ActionResult<{ count: number }>> {
  return action({
    name: "admin.cycle.recalculate",
    schema: z.object({ cycleId: z.string().uuid() }),
    input: { cycleId },
    capability: "cycle:manage",
    limit: 6,
    handler: async (data, ctx) => {
      const participants = await db
        .select({ id: cycleParticipants.id })
        .from(cycleParticipants)
        .where(eq(cycleParticipants.cycleId, data.cycleId));

      for (const participant of participants) {
        await recalibrateParticipant(participant.id);
      }

      await auditAction(ctx, {
        action: "admin.cycle.recalculated",
        entityType: "review_cycle",
        entityId: data.cycleId,
        summary: `Recalculated ${participants.length} participant scores`,
      });

      revalidatePath("/admin/calibration");
      revalidatePath("/analytics");
      return { count: participants.length };
    },
  });
}

/* ───────────────────────────── Templates ──────────────────────────────── */

const templateSchema = z.object({
  name: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  competencyIds: z.array(z.string().uuid()).min(1).max(40),
});

export async function createTemplate(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "admin.template.create",
    schema: templateSchema,
    input,
    capability: "template:manage",
    limit: 20,
    handler: async (data, ctx) => {
      const library = await db
        .select()
        .from(competencies)
        .where(inArray(competencies.id, data.competencyIds));
      if (library.length === 0) {
        throw new ActionError("Choose at least one competency from the library.");
      }

      const [template] = await db
        .insert(reviewTemplates)
        .values({
          name: data.name.trim(),
          description: data.description?.trim() || null,
          status: "DRAFT",
          createdBy: ctx.user.id,
        })
        .returning({ id: reviewTemplates.id });

      await db.insert(templateCompetencies).values(
        library.map((competency, index) => ({
          templateId: template!.id,
          competencyId: competency.id,
          name: competency.name,
          description: competency.description,
          category: competency.category,
          weight: "1.00",
          sortOrder: index,
        })),
      );

      await auditAction(ctx, {
        action: "admin.template.created",
        entityType: "review_template",
        entityId: template!.id,
        summary: `Created template "${data.name}" with ${library.length} competencies`,
      });

      revalidatePath("/admin/templates");
      return { id: template!.id };
    },
  });
}

export async function setTemplateStatus(
  templateId: string,
  status: "DRAFT" | "PUBLISHED" | "RETIRED",
): Promise<ActionResult<null>> {
  return action({
    name: "admin.template.status",
    schema: z.object({
      templateId: z.string().uuid(),
      status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
    }),
    input: { templateId, status },
    capability: "template:manage",
    limit: 40,
    handler: async (data, ctx) => {
      await db
        .update(reviewTemplates)
        .set({
          status: data.status,
          publishedAt: data.status === "PUBLISHED" ? new Date() : null,
        })
        .where(eq(reviewTemplates.id, data.templateId));

      await auditAction(ctx, {
        action: "admin.template.status",
        entityType: "review_template",
        entityId: data.templateId,
        summary: `Template status → ${data.status}`,
      });

      revalidatePath("/admin/templates");
      return null;
    },
  });
}
