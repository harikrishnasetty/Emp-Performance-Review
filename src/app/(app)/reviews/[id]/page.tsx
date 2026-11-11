import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Lock,
  MessageSquareQuote,
  ShieldCheck,
  Target,
  Undo2,
  UserRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import {
  getPublishedSelfReview,
  getReviewDetail,
  reviewerTypeLabel,
} from "@/lib/services/reviews";
import { listGoals, summariseGoals } from "@/lib/services/goals";
import { getPerson } from "@/lib/services/people";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewResponse } from "@/components/reviews/review-response";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeterBar } from "@/components/ui/progress";
import {
  cn,
  daysUntil,
  formatDate,
  formatDateTime,
  num,
  participantStatusMeta,
  relativeTime,
  reviewStatusMeta,
} from "@/lib/utils";

export const metadata = { title: "Review" };

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const review = await getReviewDetail(id);
  if (!review) notFound();

  const isReviewer = review.reviewerId === user.id;
  const isSubject = review.participant.employeeId === user.id;
  const canReadAll = can(user, "review:read:all");
  const published =
    review.status === "SUBMITTED" ||
    review.status === "ACKNOWLEDGED" ||
    review.status === "LOCKED";

  // Step 6 of the review process depends on the manager being able to read the
  // employee's submitted self assessment. Only published ones are exposed, so
  // a draft self review stays private to its author.
  const managesSubject =
    review.reviewerType === "SELF" && review.participant.managerId === user.id;

  const allowed =
    isReviewer || canReadAll || (isSubject && published) || (managesSubject && published);
  if (!allowed) notFound();

  const editable =
    isReviewer &&
    (review.status === "NOT_STARTED" ||
      review.status === "DRAFT" ||
      review.status === "RETURNED") &&
    review.cycle.status !== "CLOSED" &&
    review.cycle.status !== "ARCHIVED";

  const showSelfAssessment =
    review.reviewerType === "MANAGER" && (isReviewer || canReadAll);

  const [goals, subject, selfAssessment] = await Promise.all([
    listGoals({
      ownerIds: [review.participant.employeeId],
      cycleId: review.cycle.id,
      limit: 100,
    }),
    getPerson(review.participant.employeeId),
    showSelfAssessment ? getPublishedSelfReview(review.participant.id) : Promise.resolve(null),
  ]);

  const goalStats = summariseGoals(goals);
  const statusMeta = reviewStatusMeta[review.status] ?? reviewStatusMeta.NOT_STARTED!;
  const participantMeta =
    participantStatusMeta[review.participant.status] ?? participantStatusMeta.NOT_STARTED!;
  const due = daysUntil(review.dueDate);
  const initialRatings: Record<string, { ratingValue: number | null; comment: string | null }> =
    {};
  for (const item of review.items) {
    const existing = review.ratings.get(item.id);
    initialRatings[item.id] = {
      ratingValue: existing?.ratingValue ?? null,
      comment: existing?.comment ?? null,
    };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-ink-1"
        >
          <ArrowLeft className="size-3.5" /> Reviews
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusMeta.tone as "neutral"} dot>
            {statusMeta.label}
          </Badge>
          <Badge tone={participantMeta.tone as "neutral"}>{participantMeta.label}</Badge>
          {editable ? (
            <span className="text-[0.6875rem] text-ink-4">
              {review.dueDate
                ? due !== null && due < 0
                  ? `${Math.abs(due)} days overdue`
                  : `Due ${formatDate(review.dueDate, { day: "2-digit", month: "short" })}`
                : "No due date"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="panel relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-aqua-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar
            name={review.subjectName}
            src={review.subjectAvatar}
            size={64}
            ring
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1">
              {reviewerTypeLabel(review.reviewerType)} · {review.cycle.name}
            </p>
            <h1 className="display text-[1.45rem] font-semibold leading-tight text-ink-1">
              {isSubject
                ? isReviewer
                  ? "Your self assessment"
                  : `${review.reviewerName}'s review of you`
                : review.subjectName}
            </h1>
            <p className="mt-1 text-[0.8125rem] text-ink-3">
              {review.subjectJobTitle ?? "MetricStream"}
              {review.departmentName ? ` · ${review.departmentName}` : ""} ·{" "}
              {formatDate(review.cycle.periodStart)} – {formatDate(review.cycle.periodEnd)}
            </p>
          </div>
          <div className="flex items-center gap-5 sm:text-right">
            <div>
              <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                Overall rating
              </p>
              <p className="display text-[1.6rem] font-semibold tabular text-ink-1">
                {review.overallRating ? Number(review.overallRating).toFixed(1) : "—"}
              </p>
            </div>
            <div className="h-10 w-px bg-line" />
            <div>
              <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">Reviewer</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Avatar name={review.reviewerName} src={review.reviewerAvatar} size={20} />
                <span className="text-[0.75rem] text-ink-2">{review.reviewerName}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {review.status === "RETURNED" && review.returnReason ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
          <Undo2 className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <div>
            <p className="text-[0.8125rem] font-medium text-ink-1">
              This review was sent back for revision
            </p>
            <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-3">
              {review.returnReason}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardContent className="pt-5">
            {editable ? (
              <ReviewForm
                reviewId={review.id}
                reviewerType={review.reviewerType}
                items={review.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  description: item.description,
                  category: item.category,
                  weight: item.weight,
                  requiresComment: item.requiresComment,
                  managerOnly: item.managerOnly,
                  libraryDescription: item.libraryDescription,
                }))}
                levels={review.levels.map((level) => ({
                  value: level.value,
                  label: level.label,
                  description: level.description,
                  color: level.color,
                }))}
                initialSummary={review.summary}
                initialStrengths={review.strengths}
                initialDevelopment={review.development}
                initialOverallRating={review.overallRating}
                initialRatings={initialRatings}
                subjectName={review.subjectName}
              />
            ) : (
              <div className="space-y-6">
                <Narrative title="Overall summary" value={review.summary} />

                {review.items.length > 0 ? (
                  <section>
                    <h2 className="mb-2.5 text-[0.9375rem] font-semibold text-ink-1">
                      Competency ratings
                    </h2>
                    <div className="space-y-2">
                      {review.items.map((item) => {
                        const rating = review.ratings.get(item.id);
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-line bg-surface-0/50 p-3.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[0.8125rem] font-medium text-ink-1">
                                {item.name}
                              </p>
                              <Badge
                                tone={rating?.ratingValue ? "brand" : "neutral"}
                                className="tabular"
                              >
                                {rating?.ratingValue != null
                                  ? `${rating.ratingValue} / ${review.levels.length ? Math.max(...review.levels.map((l) => l.value)) : 5}`
                                  : "No rating"}
                              </Badge>
                            </div>
                            {rating?.comment ? (
                              <p className="mt-1.5 whitespace-pre-line text-[0.75rem] leading-relaxed text-ink-3">
                                {rating.comment}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Narrative title="Strengths" value={review.strengths} compact />
                  <Narrative title="Development areas" value={review.development} compact />
                </div>

                {review.acknowledgedAt ? (
                  <div className="rounded-xl border border-mint-500/25 bg-mint-500/[0.06] p-4">
                    <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-mint-400">
                      <CheckCircle2 className="size-3.5" /> Employee acknowledgement
                    </p>
                    {review.acknowledgementComment ? (
                      <p className="mt-1.5 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-2">
                        {review.acknowledgementComment}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-2">
                        Acknowledged without a comment.
                      </p>
                    )}
                    <p className="mt-2 text-[0.625rem] text-ink-4">
                      Acknowledged {relativeTime(review.acknowledgedAt)}
                    </p>
                  </div>
                ) : null}

                {!editable && isReviewer ? (
                  <p className="rounded-xl border border-line bg-surface-0/60 px-3.5 py-2.5 text-[0.75rem] text-ink-3">
                    {review.reviewerType === "SELF"
                      ? `Your self assessment was submitted ${relativeTime(review.submittedAt)}. Your manager can now read it.`
                      : `This review is ${review.status.toLowerCase().replaceAll("_", " ")} and can no longer be edited.`}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {showSelfAssessment ? (
            <Card>
              <CardHeader>
                <CardTitle>Employee self assessment</CardTitle>
                <MessageSquareQuote className="size-4 text-ink-3" />
              </CardHeader>
              <CardContent className="space-y-3">
                {selfAssessment ? (
                  <>
                    <p className="text-[0.8125rem] leading-relaxed text-ink-3">
                      {review.subjectName.split(" ")[0]} submitted their self assessment{" "}
                      {relativeTime(selfAssessment.submittedAt)}. Read it before you finalise this
                      review.
                    </p>
                    <LinkButton
                      href={`/reviews/${selfAssessment.id}`}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Read self assessment
                    </LinkButton>
                  </>
                ) : (
                  <p className="text-[0.8125rem] leading-relaxed text-ink-3">
                    Not submitted yet. You can write your review now, and their self assessment
                    will appear here once they send it.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {isSubject && review.status === "SUBMITTED" && review.reviewerType !== "SELF" ? (
            <Card>
              <CardHeader>
                <CardTitle>Your response</CardTitle>
                <MessageSquareQuote className="size-4 text-ink-3" />
              </CardHeader>
              <CardContent>
                <ReviewResponse reviewId={review.id} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Goal evidence</CardTitle>
              <LinkButton href={`/people/${review.participant.employeeId}`} variant="ghost" size="sm">
                Profile
              </LinkButton>
            </CardHeader>
            <CardContent className="space-y-3">
              {goals.length === 0 ? (
                <p className="py-3 text-[0.8125rem] text-ink-3">
                  No goals were linked to this cycle.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[0.75rem]">
                    <span className="text-ink-3">Weighted progress</span>
                    <span className="tabular font-semibold text-ink-1">
                      {goalStats.weightedProgress}%
                    </span>
                  </div>
                  <MeterBar value={goalStats.weightedProgress} />
                  <div className="space-y-1.5">
                    {goals.slice(0, 5).map((goal) => (
                      <Link
                        key={goal.id}
                        href={`/goals/${goal.id}`}
                        className="flex items-center gap-2 rounded-lg border border-line bg-surface-0/50 px-2.5 py-1.5 text-[0.75rem] text-ink-2 transition-colors hover:border-line-strong"
                      >
                        <Target className="size-3 shrink-0 text-ink-4" />
                        <span className="min-w-0 flex-1 truncate">{goal.title}</span>
                        <span className="shrink-0 tabular text-ink-3">{goal.progress}%</span>
                      </Link>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-ink-4">
                    Computed from {goalStats.total} goal{goalStats.total === 1 ? "" : "s"} ·
                    total weight {goalStats.totalWeight}%.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cycle scoring</CardTitle>
              <ShieldCheck className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem]">
              <Row
                label="Goals"
                value={
                  review.participant.goalsScore != null
                    ? `${num(review.participant.goalsScore)}%`
                    : "—"
                }
              />
              <Row
                label="Competencies"
                value={
                  review.participant.competenciesScore != null
                    ? `${num(review.participant.competenciesScore).toFixed(1)}`
                    : "—"
                }
              />
              <Row
                label="Overall score"
                value={
                  review.participant.overallScore != null
                    ? `${num(review.participant.overallScore)}%`
                    : "—"
                }
              />
              <Row
                label="Final rating"
                value={
                  review.participant.finalRating != null
                    ? num(review.participant.finalRating).toFixed(1)
                    : "Not calibrated"
                }
              />
              <div className="hairline" />
              <p className="text-[0.6875rem] text-ink-4">
                Weights: goals {num(review.cycle.goalsWeight).toFixed(0)}% · competencies{" "}
                {num(review.cycle.competenciesWeight).toFixed(0)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CalendarClock className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem]">
              <Row label="Cycle" value={review.cycle.name} />
              <Row label="Reviewer" value={`${review.reviewerName}`} />
              <Row label="Type" value={reviewerTypeLabel(review.reviewerType)} />
              <Row
                label="Submitted"
                value={review.submittedAt ? formatDateTime(review.submittedAt) : "Not yet"}
              />
              <Row
                label="Due"
                value={review.dueDate ? formatDate(review.dueDate) : "No due date"}
              />
              {review.acknowledgedAt ? (
                <Row label="Acknowledged" value={formatDateTime(review.acknowledgedAt)} />
              ) : null}
              <Row
                label="Locked"
                value={review.status === "LOCKED" ? "Yes" : "No"}
              />
              <div className="hairline" />
              <p className="flex items-center gap-1.5 text-[0.6875rem] text-ink-4">
                <Lock className="size-3" /> Narratives and comments are encrypted at rest.
              </p>
            </CardContent>
          </Card>

          {subject ? (
            <Card>
              <CardHeader>
                <CardTitle>Subject</CardTitle>
                <UserRound className="size-4 text-ink-3" />
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={subject.displayName} src={subject.avatarUrl} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-[0.8125rem] font-medium text-ink-1">
                      {subject.displayName}
                    </p>
                    <p className="truncate text-[0.6875rem] text-ink-3">
                      {subject.jobTitle ?? subject.email}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/people/${subject.id}`}
                  className={cn(
                    "inline-flex text-[0.6875rem] font-medium text-brand-300 hover:text-brand-200",
                  )}
                >
                  Open full profile →
                </Link>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Narrative({
  title,
  value,
  compact,
}: {
  title: string;
  value: string | null;
  compact?: boolean;
}) {
  if (!value) return null;
  return (
    <section>
      <h2 className="mb-1.5 text-[0.875rem] font-semibold text-ink-1">{title}</h2>
      <p
        className={cn(
          "whitespace-pre-line rounded-xl border border-line bg-surface-0/50 p-4 leading-relaxed text-ink-2",
          compact ? "text-[0.75rem]" : "text-[0.8125rem]",
        )}
      >
        {value}
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 text-ink-3">
      <span>{label}</span>
      <span className="text-right font-medium text-ink-2">{value}</span>
    </p>
  );
}
