"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { goalUpdates, goals, reviewCycles, cycleParticipants, tasks, users } from "@/lib/db/schema";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";
import { can } from "@/lib/auth/rbac";
import { encryptField } from "@/lib/crypto";
import { computeProgress } from "@/lib/services/goals";
import { notify } from "@/lib/services/notifications";

const goalStatus = z.enum([
  "DRAFT",
  "NOT_STARTED",
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ACHIEVED",
  "MISSED",
  "CANCELLED",
]);

const visibility = z.enum(["PRIVATE", "MANAGER", "TEAM", "ORGANIZATION"]);

const createGoalSchema = z.object({
  title: z.string().min(3, "Give the goal a clear title.").max(240),
  description: z.string().max(4000).optional(),
  category: z.enum(["BUSINESS", "OKR", "DEVELOPMENT", "COMPLIANCE", "PEOPLE"]),
  metricType: z.enum(["PERCENT", "NUMERIC", "CURRENCY", "BOOLEAN", "MILESTONE"]),
  startValue: z.coerce.number().default(0),
  targetValue: z.coerce.number(),
  unit: z.string().max(24).optional(),
  weight: z.coerce.number().min(1).max(100).default(10),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  visibility: visibility.default("MANAGER"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  cycleId: z.string().uuid().optional().nullable(),
  parentGoalId: z.string().uuid().optional().nullable(),
});

export async function createGoal(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "goal.create",
    schema: createGoalSchema,
    input,
    limit: 40,
    handler: async (data, ctx) => {
      if (data.dueDate && data.startDate && data.dueDate < data.startDate) {
        throw new ActionError("The due date must be after the start date.", "validation", {
          dueDate: "Due date must be after the start date.",
        });
      }

      const progress =
        data.metricType === "BOOLEAN" || data.metricType === "MILESTONE" ? 0 : 0;

      // The weights of an employee's goals for a review cycle must add up to
      // 100% — "The weights for the goals in this section must add up to 100"
      // on the review form. The running total is scoped to this owner + cycle
      // and is checked again when the goals are sent for approval.
      let totalExistingWeight = 0;
      if (data.cycleId) {
        // HR kickoff gate: the cycle must be in Goal setting and the creator
        // must be enrolled before any goal can be added to it.
        await assertGoalSettingOpen(data.cycleId, ctx.user.id);

        const existing = await db
          .select({ weight: goals.weight })
          .from(goals)
          .where(
            and(
              eq(goals.cycleId, data.cycleId),
              eq(goals.ownerId, ctx.user.id),
              isNull(goals.archivedAt),
            ),
          );
        totalExistingWeight = existing.reduce(
          (sum, g) => sum + Number(g.weight ?? 0),
          0,
        );
      }

      // New goal weight from input
      const newGoalWeight = Number(data.weight);

      // Check if adding this goal would exceed 100% total
      const newTotalWeight = totalExistingWeight + newGoalWeight;

      if (newTotalWeight > 100) {
        throw new ActionError(
          `The weights for the goals in this review cycle must add up to 100%. Current total: ${totalExistingWeight}%, adding this goal would be ${newTotalWeight}%.`,
          "validation",
          { weight: `Would exceed 100% by ${newTotalWeight - 100}%` },
        );
      }

      // Goals start as drafts until the owner sends them to their manager.
      // Someone without a manager has nobody to approve them, so they are
      // approved immediately rather than stranded in the approval queue.
      const [owner] = await db
        .select({ managerId: users.managerId })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const [row] = await db
        .insert(goals)
        .values({
          ownerId: ctx.user.id,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          category: data.category,
          metricType: data.metricType,
          status: "NOT_STARTED",
          approvalStatus: owner?.managerId ? "DRAFT" : "APPROVED",
          approvalDecidedAt: owner?.managerId ? null : new Date(),
          visibility: data.visibility,
          priority: data.priority,
          startValue: String(data.startValue),
          targetValue: String(data.targetValue),
          currentValue: String(data.startValue),
          unit: data.unit?.trim() || null,
          weight: String(data.weight),
          progress,
          startDate: data.startDate || null,
          dueDate: data.dueDate || null,
          cycleId: data.cycleId || null,
          parentGoalId: data.parentGoalId || null,
          createdBy: ctx.user.id,
        })
        .returning({ id: goals.id });

      await auditAction(ctx, {
        action: "goal.created",
        entityType: "goal",
        entityId: row!.id,
        targetUserId: ctx.user.id,
        summary: `Created goal “${data.title}”`,
        metadata: {
          weight: data.weight,
          category: data.category,
          cycleId: data.cycleId,
          approvalStatus: owner?.managerId ? "DRAFT" : "APPROVED",
        },
      });

      revalidatePath("/goals");
      revalidatePath("/dashboard");
      return { id: row!.id };
    },
  });
}

export async function submitGoalsForCycle(input: unknown): Promise<ActionResult<{ totalWeight: number; success: boolean }>> {
  return action({
    name: "goal.submit-cycle",
    schema: z.object({ cycleId: z.string().uuid() }),
    input,
    limit: 10,
    handler: async (data, ctx) => {
      const { cycleId } = data;

      // Calculate total weight of all of this employee's goals in the cycle
      const goalsInCycle = await db
        .select({ weight: goals.weight })
        .from(goals)
        .where(
          and(
            eq(goals.cycleId, cycleId),
            eq(goals.ownerId, ctx.user.id),
            isNull(goals.archivedAt),
          ),
        );

      const totalWeight = goalsInCycle.reduce(
        (sum, g) => sum + Number(g.weight ?? 0),
        0,
      );

      // Only allow submission if total weight = 100%
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new ActionError(
          `Cannot submit goals for the review cycle — the weights must add up to 100%, but they currently total ${totalWeight}%.`,
          "validation",
          { totalWeight: String(totalWeight) },
        );
      }

      // Update all of this employee's goals in the cycle to SUBMITTED
      await db
        .update(goals)
        .set({ approvalStatus: "SUBMITTED", approvalSubmittedAt: new Date() })
        .where(
          and(
            eq(goals.cycleId, cycleId),
            eq(goals.ownerId, ctx.user.id),
            isNull(goals.archivedAt),
            inArray(goals.approvalStatus, ["DRAFT", "RETURNED"]),
          ),
        );

      await auditAction(ctx, {
        action: "goal.submitted",
        entityType: "review_cycle",
        entityId: cycleId,
        summary: `Submitted ${goalsInCycle.length} goal${goalsInCycle.length === 1 ? "" : "s"} for the review cycle (weights total 100%)`,
        metadata: { totalWeight, goalCount: goalsInCycle.length },
      });

      revalidatePath("/goals");
      revalidatePath("/dashboard");
      return { totalWeight, success: true };
    },
  });
}

const checkInSchema = z.object({
  goalId: z.string().uuid(),
  currentValue: z.coerce.number(),
  confidence: z.enum(["ON_TRACK", "NEEDS_ATTENTION", "BLOCKED"]),
  status: goalStatus,
  note: z.string().max(2000).optional(),
});

export async function checkInGoal(input: unknown): Promise<ActionResult<{ progress: number }>> {
  return action({
    name: "goal.checkin",
    schema: checkInSchema,
    input,
    limit: 120,
    handler: async (data, ctx) => {
      const [goal] = await db
        .select({
          id: goals.id,
          ownerId: goals.ownerId,
          archivedAt: goals.archivedAt,
          cycleId: goals.cycleId,
          approvalStatus: goals.approvalStatus,
          metricType: goals.metricType,
          startValue: goals.startValue,
          targetValue: goals.targetValue,
          cycleName: reviewCycles.name,
          cycleStatus: reviewCycles.status,
        })
        .from(goals)
        .leftJoin(reviewCycles, eq(reviewCycles.id, goals.cycleId))
        .where(eq(goals.id, data.goalId))
        .limit(1);
      if (!goal || goal.archivedAt) throw new ActionError("That goal no longer exists.");

      // Phase-gated check-ins: HR opens mid-year/final assessment windows one
      // at a time. Comments are only accepted inside the right window, and
      // only by the right person (employee in self windows, manager in manager windows).
      if (goal.cycleStatus) {
        const isOwner = goal.ownerId === ctx.user.id;
        const isManager = await isInReportingLine(ctx.user.id, goal.ownerId);
        const allowed =
          (goal.cycleStatus === "MID_YEAR_SELF" || goal.cycleStatus === "SELF_REVIEW") &&
            isOwner ||
          (goal.cycleStatus === "MID_YEAR_MANAGER" || goal.cycleStatus === "MANAGER_REVIEW") &&
            isManager;
        if (!allowed) {
          const who =
            goal.cycleStatus === "MID_YEAR_SELF" || goal.cycleStatus === "SELF_REVIEW"
              ? "you"
              : "your manager";
          throw new ActionError(
            `Mid-year / annual comments for “${goal.cycleName}” are not open yet — HR will open the ${who} assessment window when the cycle reaches that phase.`,
            "conflict",
          );
        }
      }

      if (goal.approvalStatus !== "APPROVED") {
        throw new ActionError(
          goal.approvalStatus === "SUBMITTED"
            ? "This goal is waiting for manager approval — check-ins open once it is approved."
            : "Send this goal to your manager for approval before checking in.",
          "conflict",
        );
      }

      const isOwner = goal.ownerId === ctx.user.id;
      const isManager = await isInReportingLine(ctx.user.id, goal.ownerId);
      if (
        !isOwner &&
        !isManager &&
        ctx.user.systemRole !== "ADMIN" &&
        ctx.user.systemRole !== "HR"
      ) {
        throw new ActionError("You can only update your own goals or those of your team.", "forbidden");
      }

      const progress = computeProgress({
        metricType: goal.metricType,
        startValue: goal.startValue,
        targetValue: goal.targetValue,
        currentValue: data.currentValue,
        status: data.status,
      });

      await db
        .update(goals)
        .set({
          currentValue: String(data.currentValue),
          progress,
          confidence: data.confidence,
          status: data.status,
          completedAt: data.status === "ACHIEVED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(goals.id, data.goalId));

      await db.insert(goalUpdates).values({
        goalId: data.goalId,
        authorId: ctx.user.id,
        progress,
        confidence: data.confidence,
        status: data.status,
        noteEnc: encryptField(data.note ?? null),
      });

      await auditAction(ctx, {
        action: "goal.checkin",
        entityType: "goal",
        entityId: data.goalId,
        targetUserId: goal.ownerId,
        summary: `Check-in recorded at ${progress}%`,
        metadata: { progress, confidence: data.confidence },
      });

      revalidatePath("/goals");
      revalidatePath(`/goals/${data.goalId}`);
      revalidatePath("/dashboard");
      return { progress };
    },
  });
}

async function isInReportingLine(actorId: string, subjectId: string): Promise<boolean> {
  const { reportingSubtree } = await import("@/lib/auth/rbac");
  const subtree = await reportingSubtree(actorId);
  return subtree.includes(subjectId);
}

/**
 * Cycle goals follow the HR-started lifecycle: HR creates and enrols the
 * cycle, opens the Goal setting phase, and only then does everyone get
 * access to fill their goals. Enforced server-side for every create/edit
 * of a goal that belongs to a review cycle.
 */
async function assertGoalSettingOpen(cycleId: string, employeeId: string) {
  const [cycle] = await db
    .select({ name: reviewCycles.name, status: reviewCycles.status })
    .from(reviewCycles)
    .where(eq(reviewCycles.id, cycleId))
    .limit(1);
  if (!cycle) throw new ActionError("That review cycle no longer exists.");
  if (cycle.status !== "GOAL_SETTING") {
    throw new ActionError(
      `Goal setting for “${cycle.name}” is not open — your HR partner starts the cycle and opens each phase in turn.`,
      "conflict",
    );
  }

  const [participant] = await db
    .select({ id: cycleParticipants.id })
    .from(cycleParticipants)
    .where(
      and(
        eq(cycleParticipants.cycleId, cycleId),
        eq(cycleParticipants.employeeId, employeeId),
      ),
    )
    .limit(1);
  if (!participant) {
    throw new ActionError(
      `You are not enrolled in “${cycle.name}” yet — once HR enrols everyone, the cycle form is where you fill your goals.`,
      "forbidden",
    );
  }
}

const updateGoalSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().min(3).max(240).optional(),
  description: z.string().max(4000).nullable().optional(),
  weight: z.coerce.number().min(1).max(100).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  visibility: visibility.optional(),
  dueDate: z.string().nullable().optional(),
});

export async function updateGoal(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "goal.update",
    schema: updateGoalSchema,
    input,
    limit: 60,
    handler: async (data, ctx) => {
      const [goal] = await db.select().from(goals).where(eq(goals.id, data.goalId)).limit(1);
      if (!goal) throw new ActionError("Goal not found.");
      if (goal.ownerId !== ctx.user.id && ctx.user.systemRole !== "ADMIN") {
        throw new ActionError("Only the goal owner can edit this goal.", "forbidden");
      }
      if (
        !can(ctx.user, "goal:manage:any") &&
        (goal.approvalStatus === "SUBMITTED" || goal.approvalStatus === "APPROVED")
      ) {
        throw new ActionError(
          "This goal is locked once it has been sent for approval. Ask your manager to return it if something must change.",
          "conflict",
        );
      }

      // Cycle goals may only change while the HR-started cycle is in its
      // Goal setting phase (and the owner is enrolled in it).
      if (goal.cycleId) {
        await assertGoalSettingOpen(goal.cycleId, goal.ownerId);
      }

      // Changing a weight must keep the cycle total within 100%.
      if (data.weight !== undefined && goal.cycleId) {
        const others = await db
          .select({ weight: goals.weight })
          .from(goals)
          .where(
            and(
              eq(goals.ownerId, goal.ownerId),
              eq(goals.cycleId, goal.cycleId),
              isNull(goals.archivedAt),
              ne(goals.id, goal.id),
            ),
          );
        const othersTotal = others.reduce((sum, g) => sum + Number(g.weight ?? 0), 0);
        const newTotal = othersTotal + data.weight;
        if (newTotal > 100 + 0.01) {
          throw new ActionError(
            `The weights for the goals in this review cycle must add up to 100% — this change would take the total to ${newTotal}%.`,
            "validation",
            { weight: `Total would become ${newTotal}%` },
          );
        }
      }

      await db
        .update(goals)
        .set({
          ...(data.title ? { title: data.title.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.weight !== undefined ? { weight: String(data.weight) } : {}),
          ...(data.priority ? { priority: data.priority } : {}),
          ...(data.visibility ? { visibility: data.visibility } : {}),
          ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(goals.id, data.goalId));

      await auditAction(ctx, {
        action: "goal.updated",
        entityType: "goal",
        entityId: data.goalId,
        targetUserId: goal.ownerId,
        summary: "Goal details updated",
      });

      revalidatePath("/goals");
      revalidatePath(`/goals/${data.goalId}`);
      return null;
    },
  });
}

const submitGoalsSchema = z.object({
  goalIds: z.array(z.string().uuid()).max(200).optional(),
});

export async function submitGoalsForApproval(
  input: unknown,
): Promise<ActionResult<{ submitted: number; autoApproved: number }>> {
  return action({
    name: "goal.submit",
    schema: submitGoalsSchema,
    input,
    limit: 20,
    handler: async (data, ctx) => {
      const conditions = [
        eq(goals.ownerId, ctx.user.id),
        isNull(goals.archivedAt),
        inArray(goals.approvalStatus, ["DRAFT", "RETURNED"]),
      ];
      if (data.goalIds?.length) conditions.push(inArray(goals.id, data.goalIds));

      const rows = await db
        .select({
          id: goals.id,
          title: goals.title,
          cycleId: goals.cycleId,
          cycleName: reviewCycles.name,
          cycleStatus: reviewCycles.status,
        })
        .from(goals)
        .leftJoin(reviewCycles, eq(reviewCycles.id, goals.cycleId))
        .where(and(...conditions));

      if (rows.length === 0) {
        throw new ActionError("There are no draft goals waiting to be sent for approval.");
      }

      // Goal submissions are only accepted while HR has opened the Goal setting
      // phase of the cycle — once HR moves on, the cycle is locked from new goals.
      const cycleIds = [
        ...new Set(rows.map((r) => r.cycleId).filter((id): id is string => Boolean(id))),
      ];
      for (const cycleId of cycleIds) {
        const status = rows.find((r) => r.cycleId === cycleId)?.cycleStatus ?? null;
        if (status !== "GOAL_SETTING") {
          throw new ActionError(
            `Goal setting for this cycle is closed (phase: ${status?.replaceAll("_", " ").toLowerCase() ?? "unknown"}) — goals can only be sent for approval while HR has the cycle open for goal setting.`,
            "conflict",
          );
        }
      }

      // Step 1 gate: for every review cycle involved, the weights of ALL of
      // this employee's goals must add up to exactly 100% before the set can
      // be sent for approval — the review form rule, enforced server-side.
      for (const cycleId of cycleIds) {
        const cycleGoals = await db
          .select({ weight: goals.weight })
          .from(goals)
          .where(
            and(
              eq(goals.ownerId, ctx.user.id),
              eq(goals.cycleId, cycleId),
              isNull(goals.archivedAt),
            ),
          );
        const total = cycleGoals.reduce((sum, g) => sum + Number(g.weight ?? 0), 0);
        if (Math.abs(total - 100) > 0.01) {
          const cycleName = rows.find((r) => r.cycleId === cycleId)?.cycleName;
          throw new ActionError(
            `The weights for your goals in ${cycleName ? `“${cycleName}”` : "this review cycle"} must add up to 100% before they can be sent for approval — they currently total ${total}%.`,
            "validation",
            { totalWeight: String(total) },
          );
        }
      }

      const [owner] = await db
        .select({ managerId: users.managerId })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const ids = rows.map((r) => r.id);
      const now = new Date();

      if (!owner?.managerId) {
        await db
          .update(goals)
          .set({
            approvalStatus: "APPROVED",
            approvalSubmittedAt: now,
            approvalDecidedAt: now,
            approvalComment: null,
            updatedAt: now,
          })
          .where(inArray(goals.id, ids));

        await auditAction(ctx, {
          action: "goal.approved",
          entityType: "goal",
          entityId: ids[0],
          targetUserId: ctx.user.id,
          summary: `${rows.length} goal${rows.length === 1 ? "" : "s"} auto-approved (no manager)`,
          metadata: { goalIds: ids, automatic: true },
        });

        revalidatePath("/goals");
        revalidatePath("/dashboard");
        return { submitted: 0, autoApproved: rows.length };
      }

      await db
        .update(goals)
        .set({
          approvalStatus: "SUBMITTED",
          approvalSubmittedAt: now,
          approvalDecidedAt: null,
          approvedBy: null,
          approvalComment: null,
          updatedAt: now,
        })
        .where(inArray(goals.id, ids));

      await notify({
        userId: owner.managerId,
        type: "goal.approval_requested",
        title: `${ctx.user.displayName} sent goals for approval`,
        body: `${rows.length} goal${rows.length === 1 ? "" : "s"} wait${rows.length === 1 ? "s" : ""} for your review.`,
        href: "/goals",
        actorId: ctx.user.id,
        entityType: "user",
        entityId: ctx.user.id,
      });

      await auditAction(ctx, {
        action: "goal.submitted",
        entityType: "goal",
        entityId: ids[0],
        targetUserId: owner.managerId,
        summary: `${rows.length} goal${rows.length === 1 ? "" : "s"} sent for approval`,
        metadata: { goalIds: ids },
      });

      revalidatePath("/goals");
      revalidatePath("/dashboard");
      return { submitted: rows.length, autoApproved: 0 };
    },
  });
}

const approveGoalSchema = z.object({
  goalId: z.string().uuid(),
  comment: z.string().max(1000).optional(),
});

export async function approveGoal(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "goal.approve",
    schema: approveGoalSchema,
    input,
    limit: 60,
    handler: async (data, ctx) => {
      const [goal] = await db
        .select({
          id: goals.id,
          ownerId: goals.ownerId,
          archivedAt: goals.archivedAt,
          approvalStatus: goals.approvalStatus,
          title: goals.title,
          cycleId: goals.cycleId,
          cycleName: reviewCycles.name,
          cycleStatus: reviewCycles.status,
        })
        .from(goals)
        .leftJoin(reviewCycles, eq(reviewCycles.id, goals.cycleId))
        .where(eq(goals.id, data.goalId))
        .limit(1);
      if (!goal || goal.archivedAt) throw new ActionError("That goal no longer exists.");

      // Manager approvals are only accepted in the right phase: goal approval
      // during Goal setting, mid-year comments during Mid-year (manager),
      // final comments during Manager review.
      const managerWindows = ["GOAL_SETTING", "MID_YEAR_MANAGER", "MANAGER_REVIEW"];
      if (goal.cycleStatus && !managerWindows.includes(goal.cycleStatus)) {
        throw new ActionError(
          `Manager review for “${goal.cycleName}” is not open — HR has not opened a manager review window for this cycle yet.`,
          "conflict",
        );
      }

      const [owner] = await db
        .select({ managerId: users.managerId })
        .from(users)
        .where(eq(users.id, goal.ownerId))
        .limit(1);

      const isDirectManager = owner?.managerId === ctx.user.id;
      if (!isDirectManager && !can(ctx.user, "goal:manage:any")) {
        throw new ActionError("Only the goal owner's manager can approve it.", "forbidden");
      }
      if (goal.approvalStatus !== "SUBMITTED") {
        throw new ActionError("Only goals that have been sent for approval can be approved.", "conflict");
      }

      const now = new Date();
      await db
        .update(goals)
        .set({
          approvalStatus: "APPROVED",
          approvalDecidedAt: now,
          approvedBy: ctx.user.id,
          approvalComment: data.comment?.trim() || null,
          updatedAt: now,
        })
        .where(eq(goals.id, goal.id));

      await notify({
        userId: goal.ownerId,
        type: "goal.approved",
        title: "Goals approved",
        body: `“${goal.title}” was approved${data.comment?.trim() ? ` — ${data.comment.trim().slice(0, 140)}` : "."}`,
        href: `/goals/${goal.id}`,
        actorId: ctx.user.id,
        entityType: "goal",
        entityId: goal.id,
      });

      await auditAction(ctx, {
        action: "goal.approved",
        entityType: "goal",
        entityId: goal.id,
        targetUserId: goal.ownerId,
        summary: `Approved goal “${goal.title}”`,
      });

      revalidatePath("/goals");
      revalidatePath(`/goals/${goal.id}`);
      revalidatePath("/dashboard");
      return null;
    },
  });
}

const returnGoalSchema = z.object({
  goalId: z.string().uuid(),
  reason: z.string().min(5, "Give a short reason so the owner knows what to change.").max(1000),
});

export async function returnGoal(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "goal.return",
    schema: returnGoalSchema,
    input,
    limit: 60,
    handler: async (data, ctx) => {
      const [goal] = await db.select().from(goals).where(eq(goals.id, data.goalId)).limit(1);
      if (!goal || goal.archivedAt) throw new ActionError("That goal no longer exists.");

      const [owner] = await db
        .select({ managerId: users.managerId })
        .from(users)
        .where(eq(users.id, goal.ownerId))
        .limit(1);

      const isDirectManager = owner?.managerId === ctx.user.id;
      if (!isDirectManager && !can(ctx.user, "goal:manage:any")) {
        throw new ActionError("Only the goal owner's manager can return it.", "forbidden");
      }
      if (goal.approvalStatus !== "SUBMITTED") {
        throw new ActionError("Only goals that have been sent for approval can be returned.", "conflict");
      }

      const now = new Date();
      await db
        .update(goals)
        .set({
          approvalStatus: "RETURNED",
          approvalDecidedAt: now,
          approvalComment: data.reason.trim(),
          updatedAt: now,
        })
        .where(eq(goals.id, goal.id));

      await notify({
        userId: goal.ownerId,
        type: "goal.returned",
        title: "Goals sent back for revision",
        body: data.reason.trim().slice(0, 180),
        href: `/goals/${goal.id}`,
        actorId: ctx.user.id,
        entityType: "goal",
        entityId: goal.id,
      });

      await auditAction(ctx, {
        action: "goal.returned",
        entityType: "goal",
        entityId: goal.id,
        targetUserId: goal.ownerId,
        summary: `Returned goal “${goal.title}”: ${data.reason.trim().slice(0, 120)}`,
      });

      revalidatePath("/goals");
      revalidatePath(`/goals/${goal.id}`);
      return null;
    },
  });
}

export async function archiveGoal(goalId: string): Promise<ActionResult<null>> {
  return action({
    name: "goal.archive",
    schema: z.string().uuid(),
    input: goalId,
    limit: 30,
    handler: async (id, ctx) => {
      const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
      if (!goal) throw new ActionError("Goal not found.");
      if (goal.ownerId !== ctx.user.id && ctx.user.systemRole !== "ADMIN") {
        throw new ActionError("Only the goal owner or an administrator can archive it.", "forbidden");
      }
      await db
        .update(goals)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(goals.id, id));

      await auditAction(ctx, {
        action: "goal.archived",
        entityType: "goal",
        entityId: id,
        targetUserId: goal.ownerId,
        summary: `Archived goal “${goal.title}”`,
      });

      revalidatePath("/goals");
      revalidatePath(`/goals/${goal.id}`);
      return null;
    },
  });
}

const taskSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(240),
  dueDate: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

export async function createTask(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "task.create",
    schema: taskSchema,
    input,
    limit: 120,
    handler: async (data, ctx) => {
      const [row] = await db
        .insert(tasks)
        .values({
          goalId: data.goalId || null,
          title: data.title.trim(),
          assigneeId: ctx.user.id,
          createdBy: ctx.user.id,
          priority: data.priority,
          dueDate: data.dueDate || null,
        })
        .returning({ id: tasks.id });

      await auditAction(ctx, {
        action: "task.created",
        entityType: "task",
        entityId: row!.id,
        summary: `Added task “${data.title}”`,
      });

      revalidatePath("/goals");
      if (data.goalId) revalidatePath(`/goals/${data.goalId}`);
      return { id: row!.id };
    },
  });
}

export async function setTaskStatus(
  taskId: string,
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED",
): Promise<ActionResult<null>> {
  return action({
    name: "task.status",
    schema: z.object({ taskId: z.string().uuid(), status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]) }),
    input: { taskId, status },
    limit: 240,
    handler: async (data, ctx) => {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, data.taskId)).limit(1);
      if (!task) throw new ActionError("Task not found.");
      if (task.assigneeId !== ctx.user.id && task.createdBy !== ctx.user.id && ctx.user.systemRole !== "ADMIN") {
        throw new ActionError("You can only update tasks assigned to you.");
      }
      await db
        .update(tasks)
        .set({
          status: data.status,
          completedAt: data.status === "DONE" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, data.taskId));

      revalidatePath("/goals");
      if (task.goalId) revalidatePath(`/goals/${task.goalId}`);
      return null;
    },
  });
}

function taskStatusSchema() {
  return z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]);
}

export async function listMyOpenTasks(): Promise<ActionResult<unknown>> {
  return action({
    name: "task.list",
    schema: z.object({}).optional(),
    input: {},
    limit: 240,
    handler: async (_d, ctx) => {
      const rows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.assigneeId, ctx.user.id), isNull(tasks.completedAt)))
        .limit(50);
      return rows;
    },
  });
}