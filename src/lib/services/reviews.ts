import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  competencies,
  cycleParticipants,
  departments,
  ratingScaleLevels,
  ratingScales,
  reviewCycles,
  reviewRatings,
  reviewTemplates,
  reviews,
  templateCompetencies,
  users,
} from "../db/schema";
import { decryptField } from "../crypto";
import { num } from "../utils";
import { goalScoreFor } from "./goals";

const managerAlias = alias(users, "mgr");
const reviewerAlias = alias(users, "reviewer");

/* ─────────────────────────────── Cycles ───────────────────────────────── */

export async function listCycles(): Promise<
  {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    periodStart: string;
    periodEnd: string;
    selfReviewDue: string | null;
    managerReviewDue: string | null;
    participants: number;
    completed: number;
    templateName: string | null;
  }[]
> {
  return db
    .select({
      id: reviewCycles.id,
      name: reviewCycles.name,
      slug: reviewCycles.slug,
      type: reviewCycles.type,
      status: reviewCycles.status,
      periodStart: reviewCycles.periodStart,
      periodEnd: reviewCycles.periodEnd,
      selfReviewDue: reviewCycles.selfReviewDue,
      managerReviewDue: reviewCycles.managerReviewDue,
      participants: sql<number>`(select count(*)::int from cycle_participants cp where cp.cycle_id = ${reviewCycles.id})`,
      completed: sql<number>`(select count(*)::int from cycle_participants cp where cp.cycle_id = ${reviewCycles.id} and cp.status = 'COMPLETE')`,
      templateName: reviewTemplates.name,
    })
    .from(reviewCycles)
    .leftJoin(reviewTemplates, eq(reviewTemplates.id, reviewCycles.templateId))
    .orderBy(desc(reviewCycles.periodStart));
}

export async function getActiveCycle() {
  const [row] = await db
    .select()
    .from(reviewCycles)
    .where(
      and(
        ne(reviewCycles.status, "DRAFT"),
        ne(reviewCycles.status, "ARCHIVED"),
        ne(reviewCycles.status, "CLOSED"),
      ),
    )
    .orderBy(desc(reviewCycles.periodStart))
    .limit(1);
  return row ?? null;
}

export async function getCycle(id: string) {
  const [row] = await db
    .select({
      cycle: reviewCycles,
      templateName: reviewTemplates.name,
      scaleName: ratingScales.name,
      scaleMin: ratingScales.minValue,
      scaleMax: ratingScales.maxValue,
      distributionGuide: ratingScales.distributionGuide,
    })
    .from(reviewCycles)
    .leftJoin(reviewTemplates, eq(reviewTemplates.id, reviewCycles.templateId))
    .leftJoin(ratingScales, eq(ratingScales.id, reviewCycles.ratingScaleId))
    .where(eq(reviewCycles.id, id))
    .limit(1);
  return row ?? null;
}

export async function getRatingLevels(scaleId: string | null) {
  if (!scaleId) return [];
  return db
    .select()
    .from(ratingScaleLevels)
    .where(eq(ratingScaleLevels.scaleId, scaleId))
    .orderBy(asc(ratingScaleLevels.value));
}

export async function getTemplateCompetencies(templateId: string | null) {
  if (!templateId) return [];
  return db
    .select({
      id: templateCompetencies.id,
      name: templateCompetencies.name,
      description: templateCompetencies.description,
      category: templateCompetencies.category,
      weight: templateCompetencies.weight,
      sortOrder: templateCompetencies.sortOrder,
      requiresComment: templateCompetencies.requiresComment,
      managerOnly: templateCompetencies.appliesToManagerOnly,
      competencyId: templateCompetencies.competencyId,
      libraryDescription: competencies.description,
    })
    .from(templateCompetencies)
    .leftJoin(competencies, eq(competencies.id, templateCompetencies.competencyId))
    .where(eq(templateCompetencies.templateId, templateId))
    .orderBy(asc(templateCompetencies.sortOrder));
}

/* ────────────────────────────── Participants ──────────────────────────── */

export async function listParticipants(cycleId: string, filters?: {
  departmentId?: string;
  status?: string;
  managerId?: string;
  limit?: number;
}) {
  const conditions = [eq(cycleParticipants.cycleId, cycleId)];
  if (filters?.departmentId) conditions.push(eq(cycleParticipants.departmentId, filters.departmentId));
  if (filters?.status) {
    conditions.push(
      eq(cycleParticipants.status, filters.status as (typeof cycleParticipants.status.enumValues)[number]),
    );
  }
  if (filters?.managerId) conditions.push(eq(cycleParticipants.managerId, filters.managerId));

  return db
    .select({
      id: cycleParticipants.id,
      employeeId: cycleParticipants.employeeId,
      employeeName: users.displayName,
      employeeEmail: users.email,
      employeeAvatar: users.avatarUrl,
      jobTitle: users.jobTitle,
      departmentName: departments.name,
      departmentId: cycleParticipants.departmentId,
      managerId: cycleParticipants.managerId,
      managerName: managerAlias.displayName,
      status: cycleParticipants.status,
      goalsScore: cycleParticipants.goalsScore,
      competenciesScore: cycleParticipants.competenciesScore,
      overallScore: cycleParticipants.overallScore,
      proposedRating: cycleParticipants.proposedRating,
      finalRating: cycleParticipants.finalRating,
      nineBoxPerformance: cycleParticipants.nineBoxPerformance,
      nineBoxPotential: cycleParticipants.nineBoxPotential,
      completedAt: cycleParticipants.completedAt,
    })
    .from(cycleParticipants)
    .innerJoin(users, eq(users.id, cycleParticipants.employeeId))
    .leftJoin(departments, eq(departments.id, cycleParticipants.departmentId))
    .leftJoin(managerAlias, eq(managerAlias.id, cycleParticipants.managerId))
    .where(and(...conditions))
    .orderBy(asc(users.displayName))
    .limit(filters?.limit ?? 500);
}

export async function getParticipant(cycleId: string, employeeId: string) {
  const [row] = await db
    .select()
    .from(cycleParticipants)
    .where(
      and(eq(cycleParticipants.cycleId, cycleId), eq(cycleParticipants.employeeId, employeeId)),
    )
    .limit(1);
  return row ?? null;
}

export async function getParticipantById(id: string) {
  const [row] = await db.select().from(cycleParticipants).where(eq(cycleParticipants.id, id)).limit(1);
  return row ?? null;
}

/* ──────────────────────────────── Reviews ─────────────────────────────── */

export type ReviewTask = {
  id: string;
  status: string;
  reviewerType: string;
  dueDate: string | null;
  cycleId: string;
  cycleName: string;
  cycleStatus: string;
  participantId: string;
  subjectId: string;
  subjectName: string;
  subjectAvatar: string | null;
  subjectJobTitle: string | null;
  departmentName: string | null;
  submittedAt: Date | null;
};

/** Everything the signed-in user is expected to write. */
export async function getMyReviewTasks(userId: string): Promise<ReviewTask[]> {
  return db
    .select({
      id: reviews.id,
      status: reviews.status,
      reviewerType: reviews.reviewerType,
      dueDate: reviews.dueDate,
      cycleId: reviewCycles.id,
      cycleName: reviewCycles.name,
      cycleStatus: reviewCycles.status,
      participantId: cycleParticipants.id,
      subjectId: cycleParticipants.employeeId,
      subjectName: users.displayName,
      subjectAvatar: users.avatarUrl,
      subjectJobTitle: users.jobTitle,
      departmentName: departments.name,
      submittedAt: reviews.submittedAt,
    })
    .from(reviews)
    .innerJoin(reviewCycles, eq(reviewCycles.id, reviews.cycleId))
    .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
    .innerJoin(users, eq(users.id, cycleParticipants.employeeId))
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(
      and(
        eq(reviews.reviewerId, userId),
        ne(reviews.status, "LOCKED"),
        ne(reviewCycles.status, "ARCHIVED"),
      ),
    )
    .orderBy(asc(reviews.status), asc(reviews.dueDate));
}

/**
 * Reviews written about the signed-in user that are visible to them.
 *
 * The employee's own self assessment is excluded: it lives in their queue as work
 * they author, never as a review they read and acknowledge.
 */
export async function getReviewsAboutMe(userId: string) {
  return db
    .select({
      id: reviews.id,
      reviewerType: reviews.reviewerType,
      status: reviews.status,
      cycleId: reviewCycles.id,
      cycleName: reviewCycles.name,
      cycleStatus: reviewCycles.status,
      overallRating: reviews.overallRating,
      submittedAt: reviews.submittedAt,
      acknowledgedAt: reviews.acknowledgedAt,
      reviewerName: users.displayName,
      reviewerAvatar: users.avatarUrl,
    })
    .from(reviews)
    .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
    .innerJoin(reviewCycles, eq(reviewCycles.id, reviews.cycleId))
    .innerJoin(users, eq(users.id, reviews.reviewerId))
    .where(
      and(
        eq(cycleParticipants.employeeId, userId),
        inArray(reviews.status, ["SUBMITTED", "ACKNOWLEDGED", "LOCKED"]),
        ne(reviews.reviewerType, "SELF"),
      ),
    )
    .orderBy(desc(reviews.submittedAt));
}

export type ReviewDetail = Awaited<ReturnType<typeof getReviewDetail>>;

export async function getReviewDetail(reviewId: string) {
  const [row] = await db
    .select({
      id: reviews.id,
      status: reviews.status,
      reviewerType: reviews.reviewerType,
      reviewerId: reviews.reviewerId,
      summaryEnc: reviews.summaryEnc,
      strengthsEnc: reviews.strengthsEnc,
      developmentEnc: reviews.developmentEnc,
      overallRating: reviews.overallRating,
      acknowledgementCommentEnc: reviews.acknowledgementCommentEnc,
      submittedAt: reviews.submittedAt,
      acknowledgedAt: reviews.acknowledgedAt,
      dueDate: reviews.dueDate,
      returnReason: reviews.returnReason,
      cycle: {
        id: reviewCycles.id,
        name: reviewCycles.name,
        status: reviewCycles.status,
        periodStart: reviewCycles.periodStart,
        periodEnd: reviewCycles.periodEnd,
        selfReviewEnabled: reviewCycles.selfReviewEnabled,
        peerReviewEnabled: reviewCycles.peerReviewEnabled,
        goalsWeight: reviewCycles.goalsWeight,
        competenciesWeight: reviewCycles.competenciesWeight,
        templateId: reviewCycles.templateId,
        ratingScaleId: reviewCycles.ratingScaleId,
      },
      participant: {
        id: cycleParticipants.id,
        employeeId: cycleParticipants.employeeId,
        managerId: cycleParticipants.managerId,
        status: cycleParticipants.status,
        goalsScore: cycleParticipants.goalsScore,
        competenciesScore: cycleParticipants.competenciesScore,
        overallScore: cycleParticipants.overallScore,
        finalRating: cycleParticipants.finalRating,
      },
      subjectName: users.displayName,
      subjectEmail: users.email,
      subjectAvatar: users.avatarUrl,
      subjectJobTitle: users.jobTitle,
      departmentName: departments.name,
      reviewerName: reviewerAlias.displayName,
      reviewerAvatar: reviewerAlias.avatarUrl,
    })
    .from(reviews)
    .innerJoin(reviewCycles, eq(reviewCycles.id, reviews.cycleId))
    .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
    .innerJoin(users, eq(users.id, cycleParticipants.employeeId))
    .innerJoin(reviewerAlias, eq(reviewerAlias.id, reviews.reviewerId))
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!row) return null;

  const [ratings, items, levels] = await Promise.all([
    db.select().from(reviewRatings).where(eq(reviewRatings.reviewId, reviewId)),
    getTemplateCompetencies(row.cycle.templateId),
    getRatingLevels(row.cycle.ratingScaleId),
  ]);

  return {
    ...row,
    summary: decryptField(row.summaryEnc),
    strengths: decryptField(row.strengthsEnc),
    development: decryptField(row.developmentEnc),
    acknowledgementComment: decryptField(row.acknowledgementCommentEnc),
    items,
    levels,
    ratings: new Map(
      ratings.map((r) => [
        r.templateCompetencyId,
        {
          ratingValue: r.ratingValue,
          comment: decryptField(r.commentEnc),
        },
      ]),
    ),
  };
}

/** Reviews about a person that are safe to show on their profile. */
export async function getPublishedReviewsFor(subjectId: string, limit = 8) {
  return db
    .select({
      id: reviews.id,
      reviewerType: reviews.reviewerType,
      status: reviews.status,
      overallRating: reviews.overallRating,
      submittedAt: reviews.submittedAt,
      cycleId: reviewCycles.id,
      cycleName: reviewCycles.name,
      reviewerId: users.id,
      reviewerName: users.displayName,
      reviewerAvatar: users.avatarUrl,
    })
    .from(reviews)
    .innerJoin(cycleParticipants, eq(cycleParticipants.id, reviews.participantId))
    .innerJoin(reviewCycles, eq(reviewCycles.id, reviews.cycleId))
    .innerJoin(users, eq(users.id, reviews.reviewerId))
    .where(
      and(
        eq(cycleParticipants.employeeId, subjectId),
        inArray(reviews.status, ["SUBMITTED", "ACKNOWLEDGED", "LOCKED"]),
        ne(reviews.reviewerType, "SELF"),
      ),
    )
    .orderBy(desc(reviews.submittedAt))
    .limit(limit);
}

export async function getReviewsForParticipant(participantId: string) {
  return db
    .select({
      id: reviews.id,
      reviewerType: reviews.reviewerType,
      status: reviews.status,
      overallRating: reviews.overallRating,
      submittedAt: reviews.submittedAt,
      reviewerName: users.displayName,
      reviewerAvatar: users.avatarUrl,
      reviewerId: users.id,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.reviewerId))
    .where(eq(reviews.participantId, participantId))
    .orderBy(asc(reviews.reviewerType));
}

/**
 * The published self assessment for a participant, used by the manager review
 * page (step 6) to link across to what the employee wrote. Only submitted
 * assessments are exposed — a draft self review stays private to its author.
 */
export async function getPublishedSelfReview(participantId: string) {
  const [row] = await db
    .select({
      id: reviews.id,
      status: reviews.status,
      submittedAt: reviews.submittedAt,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.participantId, participantId),
        eq(reviews.reviewerType, "SELF"),
        inArray(reviews.status, ["SUBMITTED", "ACKNOWLEDGED", "LOCKED"]),
      ),
    )
    .orderBy(desc(reviews.submittedAt))
    .limit(1);
  return row ?? null;
}

/* ─────────────────────────────── Scoring ──────────────────────────────── */

export async function computeParticipantScores(participantId: string): Promise<{
  goalsScore: number;
  competenciesScore: number | null;
  overallScore: number | null;
  suggestedRating: number | null;
}> {
  const participant = await getParticipantById(participantId);
  if (!participant) {
    return { goalsScore: 0, competenciesScore: null, overallScore: null, suggestedRating: null };
  }

  const cycle = await db
    .select()
    .from(reviewCycles)
    .where(eq(reviewCycles.id, participant.cycleId))
    .limit(1)
    .then((r) => r[0]);

  const goals = await goalScoreFor(participant.employeeId, participant.cycleId);

  // Manager ratings are authoritative; fall back to self when no manager review.
  // Only published reviews count — draft ratings must never leak into scores.
  const managerReview = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.participantId, participantId),
        eq(reviews.reviewerType, "MANAGER"),
        inArray(reviews.status, ["SUBMITTED", "ACKNOWLEDGED", "LOCKED"]),
      ),
    )
    .orderBy(desc(reviews.submittedAt))
    .limit(1)
    .then((r) => r[0]);

  let competenciesScore: number | null = null;
  if (managerReview) {
    const [agg] = await db
      .select({
        weighted: sql<string>`coalesce(sum(${reviewRatings.ratingValue} * ${templateCompetencies.weight}), 0)`,
        weight: sql<string>`coalesce(sum(case when ${reviewRatings.ratingValue} is null then 0 else ${templateCompetencies.weight} end), 0)`,
      })
      .from(reviewRatings)
      .innerJoin(
        templateCompetencies,
        eq(templateCompetencies.id, reviewRatings.templateCompetencyId),
      )
      .where(eq(reviewRatings.reviewId, managerReview.id));

    const weight = num(agg?.weight);
    if (weight > 0) competenciesScore = num(agg?.weighted) / weight;
  }

  const scaleMax = cycle
    ? await db
        .select({ max: ratingScales.maxValue })
        .from(ratingScales)
        .where(eq(ratingScales.id, cycle.ratingScaleId!))
        .limit(1)
        .then((r) => r[0]?.max ?? 5)
    : 5;

  const goalsWeight = num(cycle?.goalsWeight ?? 50);
  const compWeight = num(cycle?.competenciesWeight ?? 50);

  const goalsPct = goals.score;
  const compPct =
    competenciesScore === null ? null : (competenciesScore / scaleMax) * 100;

  let overallScore: number | null = null;
  if (compPct !== null) {
    overallScore =
      Math.round(
        ((goalsPct * goalsWeight + compPct * compWeight) / (goalsWeight + compWeight)) * 10,
      ) / 10;
  } else if (goals.goalCount > 0) {
    overallScore = Math.round(goalsPct * 10) / 10;
  }

  return {
    goalsScore: goalsPct,
    competenciesScore,
    overallScore,
    suggestedRating:
      overallScore === null ? null : Math.round((overallScore / 100) * scaleMax * 10) / 10,
  };
}

/**
 * Cycle-wide progress counters for headers and admin dashboards.
 *
 * Counters are derived from review rows rather than participant status so that
 * participants who never got a manager review (top of the hierarchy) are not
 * counted as permanently outstanding.
 */
export async function cycleProgress(cycleId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      complete: sql<number>`count(*) filter (where status = 'COMPLETE')::int`,
      selfDone: sql<number>`count(*) filter (where exists (
        select 1 from reviews r
        where r.participant_id = cycle_participants.id
          and r.reviewer_type = 'SELF'
          and r.status in ('SUBMITTED','ACKNOWLEDGED','LOCKED')
      ))::int`,
      managerDone: sql<number>`count(*) filter (where not exists (
        select 1 from reviews r
        where r.participant_id = cycle_participants.id
          and r.reviewer_type = 'MANAGER'
          and r.status not in ('SUBMITTED','ACKNOWLEDGED','LOCKED')
      ))::int`,
      awaitingAck: sql<number>`count(*) filter (where exists (
        select 1 from reviews r
        where r.participant_id = cycle_participants.id
          and r.reviewer_type = 'MANAGER'
          and r.status = 'SUBMITTED'
      ))::int`,
    })
    .from(cycleParticipants)
    .where(eq(cycleParticipants.cycleId, cycleId));
  return (
    row ?? { total: 0, complete: 0, selfDone: 0, managerDone: 0, awaitingAck: 0 }
  );
}

/** Distribution of final/proposed ratings for calibration views. */
export async function ratingDistribution(cycleId: string) {
  return db
    .select({
      rating: sql<string>`coalesce(${cycleParticipants.finalRating}, ${cycleParticipants.proposedRating})`,
      count: sql<number>`count(*)::int`,
    })
    .from(cycleParticipants)
    .where(
      and(
        eq(cycleParticipants.cycleId, cycleId),
        sql`coalesce(${cycleParticipants.finalRating}, ${cycleParticipants.proposedRating}) is not null`,
      ),
    )
    .groupBy(sql`coalesce(${cycleParticipants.finalRating}, ${cycleParticipants.proposedRating})`)
    .orderBy(sql`coalesce(${cycleParticipants.finalRating}, ${cycleParticipants.proposedRating})`);
}

export async function recalibrateParticipant(participantId: string) {
  const scores = await computeParticipantScores(participantId);
  await db
    .update(cycleParticipants)
    .set({
      goalsScore: String(scores.goalsScore),
      competenciesScore:
        scores.competenciesScore === null ? null : String(scores.competenciesScore),
      overallScore:
        scores.overallScore === null ? null : String(scores.overallScore),
      proposedRating:
        scores.suggestedRating === null ? null : String(scores.suggestedRating),
    })
    .where(eq(cycleParticipants.id, participantId));
  return scores;
}

export async function listTemplates() {
  return db
    .select({
      id: reviewTemplates.id,
      name: reviewTemplates.name,
      description: reviewTemplates.description,
      status: reviewTemplates.status,
      version: reviewTemplates.version,
      competencyCount: sql<number>`(select count(*)::int from template_competencies tc where tc.template_id = ${reviewTemplates.id})`,
      createdAt: reviewTemplates.createdAt,
    })
    .from(reviewTemplates)
    .orderBy(desc(reviewTemplates.createdAt));
}

export async function listCompetencies() {
  return db.select().from(competencies).where(eq(competencies.isActive, true)).orderBy(asc(competencies.name));
}

/** Templates with their competency lines, assembled in two queries (no N+1). */
export async function listTemplatesWithCompetencies() {
  const [templates, lines] = await Promise.all([
    listTemplates(),
    db
      .select({
        id: templateCompetencies.id,
        templateId: templateCompetencies.templateId,
        name: templateCompetencies.name,
        category: templateCompetencies.category,
        weight: templateCompetencies.weight,
        sortOrder: templateCompetencies.sortOrder,
      })
      .from(templateCompetencies)
      .orderBy(asc(templateCompetencies.sortOrder)),
  ]);

  const byTemplate = new Map<string, typeof lines>();
  for (const line of lines) {
    const list = byTemplate.get(line.templateId);
    if (list) list.push(line);
    else byTemplate.set(line.templateId, [line]);
  }

  return templates.map((template) => ({
    ...template,
    competencies: byTemplate.get(template.id) ?? [],
  }));
}

export async function listRatingScales() {
  return db.select().from(ratingScales).orderBy(asc(ratingScales.minValue));
}

export function reviewerTypeLabel(type: string): string {
  return (
    {
      SELF: "Self assessment",
      MANAGER: "Manager review",
      PEER: "Peer feedback",
      SKIP_LEVEL: "Skip-level review",
      HR: "HR review",
    } as Record<string, string>
  )[type] ?? type;
}
