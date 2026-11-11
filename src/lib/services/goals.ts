import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { goalUpdates, goals, reviewCycles, tasks, users } from "../db/schema";
import { decryptField } from "../crypto";
import { clamp, num } from "../utils";

const parentGoal = alias(goals, "parent_goal");

export type GoalListItem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  approvalStatus: string;
  approvalComment: string | null;
  approvalSubmittedAt: Date | null;
  approvalDecidedAt: Date | null;
  confidence: string;
  visibility: string;
  priority: string;
  metricType: string;
  unit: string | null;
  weight: string;
  progress: number;
  startValue: string;
  targetValue: string;
  currentValue: string;
  startDate: string | null;
  dueDate: string | null;
  updatedAt: Date;
  cycleId: string | null;
  cycleName: string | null;
  parentGoalId: string | null;
  parentTitle: string | null;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  taskCount: number;
  tasksDone: number;
  lastCheckInAt: Date | null;
};

export async function listGoals(params: {
  ownerIds: string[];
  cycleId?: string | null;
  status?: string[];
  limit?: number;
}): Promise<GoalListItem[]> {
  if (params.ownerIds.length === 0) return [];

  const conditions = [
    inArray(goals.ownerId, params.ownerIds),
    isNull(goals.archivedAt),
  ];
  if (params.cycleId) conditions.push(eq(goals.cycleId, params.cycleId));
  if (params.status?.length) {
    conditions.push(
      inArray(goals.status, params.status as (typeof goals.status.enumValues)[number][]),
    );
  }

  const rows = await db
    .select({
      id: goals.id,
      title: goals.title,
      description: goals.description,
      category: goals.category,
      status: goals.status,
      approvalStatus: goals.approvalStatus,
      approvalComment: goals.approvalComment,
      approvalSubmittedAt: goals.approvalSubmittedAt,
      approvalDecidedAt: goals.approvalDecidedAt,
      confidence: goals.confidence,
      visibility: goals.visibility,
      priority: goals.priority,
      metricType: goals.metricType,
      unit: goals.unit,
      weight: goals.weight,
      progress: goals.progress,
      startValue: goals.startValue,
      targetValue: goals.targetValue,
      currentValue: goals.currentValue,
      startDate: goals.startDate,
      dueDate: goals.dueDate,
      updatedAt: goals.updatedAt,
      cycleId: goals.cycleId,
      cycleName: reviewCycles.name,
      parentGoalId: goals.parentGoalId,
      parentTitle: parentGoal.title,
      ownerId: goals.ownerId,
      ownerName: users.displayName,
      ownerAvatar: users.avatarUrl,
      taskCount: sql<number>`(select count(*)::int from tasks t where t.goal_id = ${goals.id})`,
      tasksDone: sql<number>`(select count(*)::int from tasks t where t.goal_id = ${goals.id} and t.status = 'DONE')`,
      lastCheckInAt: sql<Date | null>`(select max(gu.created_at) from goal_updates gu where gu.goal_id = ${goals.id})`,
    })
    .from(goals)
    .innerJoin(users, eq(users.id, goals.ownerId))
    .leftJoin(reviewCycles, eq(reviewCycles.id, goals.cycleId))
    .leftJoin(parentGoal, eq(parentGoal.id, goals.parentGoalId))
    .where(and(...conditions))
    .orderBy(desc(goals.weight), asc(goals.sortOrder), desc(goals.updatedAt))
    .limit(params.limit ?? 200);

  return rows as GoalListItem[];
}

export async function getGoal(id: string) {
  const [goal] = await db
    .select({
      goal: goals,
      ownerName: users.displayName,
      ownerAvatar: users.avatarUrl,
      ownerEmail: users.email,
      ownerJobTitle: users.jobTitle,
      ownerManagerId: users.managerId,
      cycleName: reviewCycles.name,
    })
    .from(goals)
    .innerJoin(users, eq(users.id, goals.ownerId))
    .leftJoin(reviewCycles, eq(reviewCycles.id, goals.cycleId))
    .where(eq(goals.id, id))
    .limit(1);
  return goal ?? null;
}

/**
 * Goals a manager still has to approve, for the 10-step process hand-off in
 * step 2. Scoped to direct reports: a skip-level manager should not approve on
 * behalf of the line manager.
 */
export async function listGoalsAwaitingApproval(managerId: string) {
  return db
    .select({
      id: goals.id,
      title: goals.title,
      description: goals.description,
      weight: goals.weight,
      category: goals.category,
      cycleName: reviewCycles.name,
      approvalSubmittedAt: goals.approvalSubmittedAt,
      ownerId: goals.ownerId,
      ownerName: users.displayName,
      ownerAvatar: users.avatarUrl,
      ownerJobTitle: users.jobTitle,
    })
    .from(goals)
    .innerJoin(users, eq(users.id, goals.ownerId))
    .leftJoin(reviewCycles, eq(reviewCycles.id, goals.cycleId))
    .where(
      and(
        eq(users.managerId, managerId),
        eq(goals.approvalStatus, "SUBMITTED"),
        isNull(goals.archivedAt),
      ),
    )
    .orderBy(asc(goals.approvalSubmittedAt), asc(goals.title));
}

/**
 * Latest check-in note per goal, split into the employee's own comment and
 * everyone else's (their manager) — the two "Mid-Year comments" columns on
 * the performance review form.
 */
export async function getLatestGoalComments(
  goalIds: string[],
  employeeId: string,
): Promise<
  Map<
    string,
    {
      employee: string | null;
      employeeAt: Date | null;
      manager: string | null;
      managerAt: Date | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      employee: string | null;
      employeeAt: Date | null;
      manager: string | null;
      managerAt: Date | null;
    }
  >();
  if (goalIds.length === 0) return map;

  const rows = await db
    .select({
      goalId: goalUpdates.goalId,
      authorId: goalUpdates.authorId,
      note: goalUpdates.noteEnc,
      createdAt: goalUpdates.createdAt,
    })
    .from(goalUpdates)
    .where(inArray(goalUpdates.goalId, goalIds))
    .orderBy(desc(goalUpdates.createdAt))
    .limit(600);

  for (const row of rows) {
    const entry = map.get(row.goalId) ?? {
      employee: null,
      employeeAt: null,
      manager: null,
      managerAt: null,
    };
    const note = decryptField(row.note);
    if (note) {
      if (row.authorId === employeeId && !entry.employee) {
        entry.employee = note;
        entry.employeeAt = row.createdAt;
      } else if (row.authorId !== employeeId && !entry.manager) {
        entry.manager = note;
        entry.managerAt = row.createdAt;
      }
    }
    map.set(row.goalId, entry);
  }
  return map;
}

export async function getGoalUpdates(goalId: string) {
  const rows = await db
    .select({
      id: goalUpdates.id,
      progress: goalUpdates.progress,
      confidence: goalUpdates.confidence,
      status: goalUpdates.status,
      note: goalUpdates.noteEnc,
      createdAt: goalUpdates.createdAt,
      authorId: goalUpdates.authorId,
      authorName: users.displayName,
      authorAvatar: users.avatarUrl,
    })
    .from(goalUpdates)
    .innerJoin(users, eq(users.id, goalUpdates.authorId))
    .where(eq(goalUpdates.goalId, goalId))
    .orderBy(desc(goalUpdates.createdAt))
    .limit(30);

  return rows.map((row) => ({ ...row, note: decryptField(row.note) }));
}

export async function getGoalTasks(goalId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.goalId, goalId))
    .orderBy(asc(tasks.sortOrder), asc(tasks.dueDate));
}

export async function getChildGoals(parentId: string) {
  return db
    .select({
      id: goals.id,
      title: goals.title,
      progress: goals.progress,
      status: goals.status,
      ownerId: goals.ownerId,
      ownerName: users.displayName,
      weight: goals.weight,
    })
    .from(goals)
    .innerJoin(users, eq(users.id, goals.ownerId))
    .where(eq(goals.parentGoalId, parentId))
    .orderBy(desc(goals.weight));
}

export type GoalStats = {
  total: number;
  onTrack: number;
  atRisk: number;
  offTrack: number;
  achieved: number;
  averageProgress: number;
  weightedProgress: number;
  totalWeight: number;
};

export function summariseGoals(rows: { status: string; progress: number; weight: string }[]): GoalStats {
  const total = rows.length;
  let onTrack = 0;
  let atRisk = 0;
  let offTrack = 0;
  let achieved = 0;
  let progressSum = 0;
  let weightedSum = 0;
  let totalWeight = 0;

  for (const g of rows) {
    if (g.status === "ON_TRACK" || g.status === "NOT_STARTED" || g.status === "DRAFT") onTrack++;
    else if (g.status === "AT_RISK") atRisk++;
    else if (g.status === "OFF_TRACK" || g.status === "MISSED") offTrack++;
    else if (g.status === "ACHIEVED") achieved++;

    progressSum += g.progress;
    const w = num(g.weight);
    weightedSum += g.progress * w;
    totalWeight += w;
  }

  return {
    total,
    onTrack,
    atRisk,
    offTrack,
    achieved,
    averageProgress: total ? Math.round(progressSum / total) : 0,
    weightedProgress: totalWeight ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0,
    totalWeight,
  };
}

/** Metric-aware progress: supports descending targets (e.g. reduce defects). */
export function computeProgress(input: {
  metricType: string;
  startValue: string | number;
  targetValue: string | number;
  currentValue: string | number;
  status?: string;
}): number {
  if (input.status === "ACHIEVED") return 100;
  if (input.status === "CANCELLED" || input.status === "DRAFT") return 0;
  const start = num(input.startValue);
  const target = num(input.targetValue);
  const current = num(input.currentValue);
  const span = target - start;
  if (input.metricType === "BOOLEAN" || input.metricType === "MILESTONE") {
    return current >= target ? 100 : start === target ? 0 : current >= start ? 50 : 0;
  }
  if (span === 0) return current >= target ? 100 : 0;
  return Math.round(clamp(((current - start) / span) * 100, 0, 100));
}

/** Weighted goal score for a cycle, used in review scoring. */
export async function goalScoreFor(
  ownerId: string,
  cycleId: string,
): Promise<{ score: number; goalCount: number; weight: number }> {
  const rows = await db
    .select({ progress: goals.progress, weight: goals.weight })
    .from(goals)
    .where(
      and(
        eq(goals.ownerId, ownerId),
        eq(goals.cycleId, cycleId),
        isNull(goals.archivedAt),
      ),
    );

  const totalWeight = rows.reduce((s, r) => s + num(r.weight), 0);
  if (!totalWeight) return { score: 0, goalCount: rows.length, weight: 0 };
  const weighted = rows.reduce((s, r) => s + r.progress * num(r.weight), 0);
  return {
    score: Math.round((weighted / totalWeight) * 10) / 10,
    goalCount: rows.length,
    weight: totalWeight,
  };
}

export async function upcomingGoalDeadlines(ownerId: string, days = 14) {
  const until = new Date();
  until.setDate(until.getDate() + days);
  return db
    .select({
      id: goals.id,
      title: goals.title,
      dueDate: goals.dueDate,
      progress: goals.progress,
      status: goals.status,
    })
    .from(goals)
    .where(
      and(
        eq(goals.ownerId, ownerId),
        isNull(goals.archivedAt),
        gte(goals.dueDate, sql`current_date`),
        lte(goals.dueDate, until.toISOString().slice(0, 10)),
        sql`${goals.status} not in ('ACHIEVED','CANCELLED','MISSED')`,
      ),
    )
    .orderBy(asc(goals.dueDate))
    .limit(6);
}
