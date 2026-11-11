import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  cycleParticipants,
  departments,
  feedback,
  goals,
  reviewCycles,
  users,
} from "../db/schema";
import { num } from "../utils";

/* ─────────────────────────── Individual view ──────────────────────────── */

export async function personalSnapshot(userId: string) {
  const [goalRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      onTrack: sql<number>`count(*) filter (where status in ('ON_TRACK','NOT_STARTED','DRAFT'))::int`,
      atRisk: sql<number>`count(*) filter (where status = 'AT_RISK')::int`,
      offTrack: sql<number>`count(*) filter (where status in ('OFF_TRACK','MISSED'))::int`,
      achieved: sql<number>`count(*) filter (where status = 'ACHIEVED')::int`,
      avgProgress: sql<number>`coalesce(round(avg(progress))::int, 0)`,
      weighted: sql<number>`coalesce(round(sum(progress * weight) / nullif(sum(weight),0))::int, 0)`,
    })
    .from(goals)
    .where(and(eq(goals.ownerId, userId), isNull(goals.archivedAt)));

  const [fbRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(eq(feedback.receiverId, userId), isNull(feedback.archivedAt)));

  return {
    goals: goalRow ?? {
      total: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      achieved: 0,
      avgProgress: 0,
      weighted: 0,
    },
    feedbackReceived: fbRow?.total ?? 0,
  };
}

export async function progressTrend(userId: string, months = 6) {
  const rows = await db.execute<{ bucket: string; avg_progress: number }>(sql`
    select to_char(date_trunc('month', gu.created_at), 'Mon YY') as bucket,
           round(avg(gu.progress))::int as avg_progress
    from goal_updates gu
    join goals g on g.id = gu.goal_id
    where g.owner_id = ${userId}
      and gu.created_at > now() - (${months} || ' months')::interval
    group by date_trunc('month', gu.created_at)
    order by date_trunc('month', gu.created_at)
  `);
  return rows.rows.map((r) => ({ label: r.bucket, value: Number(r.avg_progress) }));
}

/* ────────────────────────────── Team view ─────────────────────────────── */

export async function teamSnapshot(teamIds: string[]) {
  if (teamIds.length === 0) {
    return { headcount: 0, avgProgress: 0, atRisk: 0, feedback: 0 };
  }

  const [goalRow] = await db
    .select({
      avgProgress: sql<number>`coalesce(round(avg(progress))::int, 0)`,
      atRisk: sql<number>`count(*) filter (where status in ('AT_RISK','OFF_TRACK'))::int`,
    })
    .from(goals)
    .where(and(inArray(goals.ownerId, teamIds), isNull(goals.archivedAt)));

  const [fbRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(feedback)
    .where(and(inArray(feedback.receiverId, teamIds), isNull(feedback.archivedAt)));

  return {
    headcount: teamIds.length,
    avgProgress: goalRow?.avgProgress ?? 0,
    atRisk: goalRow?.atRisk ?? 0,
    feedback: fbRow?.total ?? 0,
  };
}

export async function teamGoalBreakdown(teamIds: string[]) {
  if (teamIds.length === 0) return [];
  return db
    .select({
      id: users.id,
      name: users.displayName,
      avatarUrl: users.avatarUrl,
      jobTitle: users.jobTitle,
      goalCount: sql<number>`(select count(*)::int from goals g where g.owner_id = ${users.id} and g.archived_at is null)`,
      avgProgress: sql<number>`(select coalesce(round(avg(g.progress))::int,0) from goals g where g.owner_id = ${users.id} and g.archived_at is null)`,
      atRisk: sql<number>`(select count(*)::int from goals g where g.owner_id = ${users.id} and g.status in ('AT_RISK','OFF_TRACK') and g.archived_at is null)`,
    })
    .from(users)
    .where(inArray(users.id, teamIds))
    .orderBy(desc(sql`(select coalesce(round(avg(g.progress))::int,0) from goals g where g.owner_id = ${users.id} and g.archived_at is null)`))
    .limit(12);
}

/* ─────────────────────────────── Org view ─────────────────────────────── */

export async function orgSnapshot() {
  const [people] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status = 'ACTIVE')::int`,
      onLeave: sql<number>`count(*) filter (where status = 'ON_LEAVE')::int`,
    })
    .from(users)
    .where(isNull(users.deactivatedAt));

  const [goalRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      atRisk: sql<number>`count(*) filter (where status in ('AT_RISK','OFF_TRACK'))::int`,
      avgProgress: sql<number>`coalesce(round(avg(progress))::int, 0)`,
    })
    .from(goals)
    .where(isNull(goals.archivedAt));

  return {
    headcount: people?.total ?? 0,
    active: people?.active ?? 0,
    onLeave: people?.onLeave ?? 0,
    goalsTotal: goalRow?.total ?? 0,
    goalsAtRisk: goalRow?.atRisk ?? 0,
    avgGoalProgress: goalRow?.avgProgress ?? 0,
  };
}

export async function departmentPerformance() {
  // `goals` is joined twice in spirit (once per user, aggregated) — an explicit
  // alias keeps the raw SQL fragments unambiguous. Without it, Drizzle emitted
  // `from "goals"` while the select list referenced `g.*`, which Postgres
  // rejects with "missing FROM-clause entry for table g".
  const g = alias(goals, "g");

  return db
    .select({
      id: departments.id,
      name: departments.name,
      headcount: sql<number>`count(distinct ${users.id})::int`,
      avgProgress: sql<number>`coalesce(round(avg(${g.progress}))::int, 0)`,
      atRisk: sql<number>`count(${g.id}) filter (where ${g.status} in ('AT_RISK','OFF_TRACK'))::int`,
      goalCount: sql<number>`count(${g.id})::int`,
    })
    .from(departments)
    .leftJoin(users, and(eq(users.departmentId, departments.id), isNull(users.deactivatedAt)))
    .leftJoin(g, and(eq(g.ownerId, users.id), isNull(g.archivedAt)))
    .groupBy(departments.id, departments.name)
    .orderBy(desc(sql`coalesce(round(avg(${g.progress}))::int, 0)`));
}

export async function cycleTrend() {
  const rows = await db
    .select({
      cycleId: reviewCycles.id,
      name: reviewCycles.name,
      periodEnd: reviewCycles.periodEnd,
      participants: sql<number>`count(${cycleParticipants.id})::int`,
      avgScore: sql<number>`coalesce(round(avg(${cycleParticipants.overallScore})::numeric, 1), 0)`,
      avgRating: sql<number>`coalesce(round(avg(coalesce(${cycleParticipants.finalRating}, ${cycleParticipants.proposedRating}))::numeric, 2), 0)`,
      complete: sql<number>`count(*) filter (where ${cycleParticipants.status} = 'COMPLETE')::int`,
    })
    .from(reviewCycles)
    .leftJoin(cycleParticipants, eq(cycleParticipants.cycleId, reviewCycles.id))
    .groupBy(reviewCycles.id, reviewCycles.name, reviewCycles.periodEnd)
    .orderBy(desc(reviewCycles.periodEnd))
    .limit(8);

  return rows
    .map((r) => ({
      ...r,
      avgScore: num(r.avgScore),
      avgRating: num(r.avgRating),
    }))
    .reverse();
}

export async function nineBoxGrid(cycleId: string) {
  const rows = await db
    .select({
      performance: cycleParticipants.nineBoxPerformance,
      potential: cycleParticipants.nineBoxPotential,
      count: sql<number>`count(*)::int`,
    })
    .from(cycleParticipants)
    .where(
      and(
        eq(cycleParticipants.cycleId, cycleId),
        sql`${cycleParticipants.nineBoxPerformance} is not null`,
      ),
    )
    .groupBy(cycleParticipants.nineBoxPerformance, cycleParticipants.nineBoxPotential);

  const grid: number[][] = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (const r of rows) {
    const p = Math.min(3, Math.max(1, r.performance ?? 1)) - 1;
    const pot = Math.min(3, Math.max(1, r.potential ?? 1)) - 1;
    grid[pot]![p]! += r.count;
  }
  return grid;
}

export async function talentList(cycleId: string, limit = 10) {
  return db
    .select({
      employeeId: cycleParticipants.employeeId,
      name: users.displayName,
      avatarUrl: users.avatarUrl,
      jobTitle: users.jobTitle,
      departmentName: departments.name,
      overallScore: cycleParticipants.overallScore,
      likelyRating: sql<string | null>`coalesce(${cycleParticipants.finalRating}, ${cycleParticipants.proposedRating})`,
      performance: cycleParticipants.nineBoxPerformance,
      potential: cycleParticipants.nineBoxPotential,
    })
    .from(cycleParticipants)
    .innerJoin(users, eq(users.id, cycleParticipants.employeeId))
    .leftJoin(departments, eq(departments.id, cycleParticipants.departmentId))
    .where(eq(cycleParticipants.cycleId, cycleId))
    .orderBy(desc(cycleParticipants.overallScore))
    .limit(limit);
}

export async function goalCategoryMix(ownerIds?: string[]) {
  const conditions = [isNull(goals.archivedAt)];
  if (ownerIds?.length) conditions.push(inArray(goals.ownerId, ownerIds));

  const rows = await db
    .select({
      category: goals.category,
      count: sql<number>`count(*)::int`,
      avgProgress: sql<number>`coalesce(round(avg(progress))::int,0)`,
    })
    .from(goals)
    .where(and(...conditions))
    .groupBy(goals.category);

  return rows.map((r) => ({ ...r, avgProgress: num(r.avgProgress) }));
}

export async function reviewCompletionByCycle() {
  return db
    .select({
      cycleId: reviewCycles.id,
      name: reviewCycles.name,
      status: reviewCycles.status,
      periodEnd: reviewCycles.periodEnd,
      total: sql<number>`(select count(*)::int from cycle_participants cp where cp.cycle_id = ${reviewCycles.id})`,
      complete: sql<number>`(select count(*)::int from cycle_participants cp where cp.cycle_id = ${reviewCycles.id} and cp.status = 'COMPLETE')`,
    })
    .from(reviewCycles)
    .orderBy(desc(reviewCycles.periodEnd))
    .limit(6);
}

export async function activityFeedFor(teamIds: string[], limit = 12) {
  if (teamIds.length === 0) return [];
  const rows = await db.execute<{
    kind: string;
    title: string;
    actor: string;
    meta: string | null;
    at: string;
  }>(sql`
    select 'goal_update' as kind,
           g.title as title,
           u.display_name as actor,
           concat(gu.progress, '% · ', replace(gu.confidence::text, '_', ' ')) as meta,
           gu.created_at::text as at
    from goal_updates gu
    join goals g on g.id = gu.goal_id
    join users u on u.id = gu.author_id
    where g.owner_id in (${sql.join(
      teamIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    union all
    select 'feedback' as kind,
           concat(f.type::text, ' for ') as title,
           u.display_name as actor,
           '1:1 feedback shared' as meta,
           f.created_at::text as at
    from feedback f
    join users u on u.id = f.giver_id
    where f.receiver_id in (${sql.join(
      teamIds.map((id) => sql`${id}`),
      sql`, `,
    )})
    order by at desc
    limit ${limit}
  `);
  return rows.rows;
}
