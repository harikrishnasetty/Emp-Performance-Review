import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarPlus,
  Mail,
  MapPin,
  MessageSquareHeart,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can, canSeePerformanceOf, reportingSubtree } from "@/lib/auth/rbac";
import { getDirectReports, getPerson } from "@/lib/services/people";
import { listGoals, summariseGoals } from "@/lib/services/goals";
import { listFeedbackAbout } from "@/lib/services/feedback";
import { getPublishedReviewsFor, listCompetencies, reviewerTypeLabel } from "@/lib/services/reviews";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { ScheduleDialog } from "@/components/one-on-ones/schedule-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar, ProgressRing } from "@/components/ui/progress";
import {
  feedbackTypeMeta,
  formatDate,
  goalStatusMeta,
  relativeTime,
} from "@/lib/utils";

export const metadata = { title: "Profile" };

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const person = await getPerson(id);
  if (!person) notFound();

  const isSelf = person.id === user.id;
  const canSee = isSelf || (await canSeePerformanceOf(user, person.id));
  const viewerManagesSubject = person.managerId === user.id;

  const [manager, reports, goals, competencies] = await Promise.all([
    person.managerId ? getPerson(person.managerId) : Promise.resolve(null),
    getDirectReports(person.id),
    listGoals({ ownerIds: [person.id], limit: 8 }),
    listCompetencies(),
  ]);

  const goalVisible = (visibility: string) =>
    isSelf || can(user, "goal:read:all") || visibility === "ORGANIZATION" || canSee;
  const visibleGoals = goals.filter((g) => goalVisible(g.visibility)).slice(0, 6);
  const goalStats = summariseGoals(goals.map((g) => ({ status: g.status, progress: g.progress, weight: g.weight })));

  let sharedTeam = false;
  if (!canSee && !viewerManagesSubject && !isSelf) {
    const [mine, theirs] = await Promise.all([
      reportingSubtree(user.id),
      reportingSubtree(person.id),
    ]);
    sharedTeam = mine.includes(person.id) || theirs.includes(user.id);
  }

  const [feedbackItems, reviews] = await Promise.all([
    listFeedbackAbout(person.id, user.id, { viewerManagesSubject, sharedTeam }, 8),
    canSee ? getPublishedReviewsFor(person.id) : Promise.resolve([]),
  ]);

  const rated = reviews.filter((r) => r.overallRating !== null);
  const avgRating = rated.length
    ? (rated.reduce((sum, r) => sum + Number(r.overallRating ?? 0), 0) / rated.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-5">
      <Link
        href="/people"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-ink-1"
      >
        <ArrowLeft className="size-3.5" /> People directory
      </Link>

      <div className="panel relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-brand-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={person.displayName} src={person.avatarUrl} size={68} ring />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="display text-[1.4rem] font-semibold leading-tight text-ink-1 sm:text-[1.6rem]">
                  {person.displayName}
                </h1>
                {person.systemRole !== "USER" ? (
                  <Badge tone={person.systemRole === "ADMIN" ? "danger" : "info"}>
                    {person.systemRole.toLowerCase()}
                  </Badge>
                ) : null}
                {person.status !== "ACTIVE" ? (
                  <Badge tone="warning">{person.status.replaceAll("_", " ").toLowerCase()}</Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[0.875rem] text-ink-2">
                {person.jobTitle ?? "MetricStream"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] text-ink-3">
                {person.departmentName ? (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5" /> {person.departmentName}
                  </span>
                ) : null}
                {person.location ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {person.location}
                  </span>
                ) : null}
                <a
                  href={`mailto:${person.email}`}
                  className="flex items-center gap-1.5 hover:text-ink-1"
                >
                  <Mail className="size-3.5" /> {person.email}
                </a>
                {person.hireDate ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" /> Joined {formatDate(person.hireDate)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isSelf ? (
              <>
                <FeedbackDialog
                  people={[{ id: person.id, name: person.displayName, jobTitle: person.jobTitle, avatarUrl: person.avatarUrl }]}
                  competencies={competencies.map((c) => ({ id: c.id, name: c.name }))}
                  defaultReceiver={{
                    id: person.id,
                    name: person.displayName,
                    jobTitle: person.jobTitle,
                    avatarUrl: person.avatarUrl,
                  }}
                  trigger={
                    <Button size="md" variant="outline">
                      <MessageSquareHeart className="size-4" /> Feedback
                    </Button>
                  }
                />
                <ScheduleDialog
                  reports={[]}
                  defaultPerson={{
                    id: person.id,
                    name: person.displayName,
                    jobTitle: person.jobTitle,
                    avatarUrl: person.avatarUrl,
                  }}
                  trigger={
                    <Button size="md" variant="outline">
                      <CalendarPlus className="size-4" /> 1:1
                    </Button>
                  }
                />
              </>
            ) : null}
            {canSee ? (
              <LinkButton href={`/reviews`} variant="secondary" size="md">
                <ShieldCheck className="size-4" /> Reviews
              </LinkButton>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Goals"
          value={goalStats.total}
          hint={
            goalStats.total
              ? `${goalStats.onTrack} on track · ${goalStats.atRisk} at risk`
              : "No goals yet"
          }
          icon={<Target />}
          tone="brand"
        />
        <Stat
          label="Weighted progress"
          value={`${goalStats.weightedProgress}%`}
          hint={`Average ${goalStats.averageProgress}%`}
          icon={<TrendingUp />}
          tone="positive"
        />
        <Stat
          label="Feedback"
          value={feedbackItems.length}
          hint="Visible to you"
          icon={<MessageSquareHeart />}
          tone="info"
        />
        <Stat
          label="Reviews"
          value={reviews.length}
          hint={reviews.length ? `Average ${avgRating} / 5` : "None published"}
          icon={<Briefcase />}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Goals</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  {isSelf || canSee ? "Current objectives and progress" : "Shared objectives"}
                </p>
              </div>
              <Target className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              {visibleGoals.length === 0 ? (
                <EmptyState
                  icon={<Target />}
                  title="No goals to show"
                  description={
                    isSelf
                      ? "Goals you set will appear here with progress and check-ins."
                      : "This person hasn't shared goals publicly, or has none for this cycle."
                  }
                  className="py-8"
                />
              ) : (
                <ul className="space-y-2">
                  {visibleGoals.map((goal) => {
                    const meta = goalStatusMeta[goal.status] ?? goalStatusMeta.NOT_STARTED!;
                    return (
                      <li key={goal.id}>
                        <Link
                          href={`/goals/${goal.id}`}
                          className="block rounded-xl border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-1">
                              {goal.title}
                            </p>
                            <Badge tone={meta.tone as "neutral"} dot>
                              {meta.label}
                            </Badge>
                            <span className="tabular text-[0.6875rem] text-ink-3">
                              {goal.progress}%
                            </span>
                          </div>
                          <div className="mt-2">
                            <MeterBar
                              value={goal.progress}
                              tone={
                                meta.tone === "positive"
                                  ? "positive"
                                  : meta.tone === "warning"
                                    ? "warning"
                                    : meta.tone === "danger"
                                      ? "danger"
                                      : "brand"
                              }
                            />
                          </div>
                          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[0.625rem] text-ink-4">
                            <span>{goal.category.replaceAll("_", " ").toLowerCase()}</span>
                            {goal.dueDate ? <span>due {formatDate(goal.dueDate)}</span> : null}
                            {goal.cycleName ? <span>{goal.cycleName}</span> : null}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recognition & feedback</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  {isSelf ? "Everything colleagues have shared with you" : "Respecting visibility settings"}
                </p>
              </div>
              <MessageSquareHeart className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              {feedbackItems.length === 0 ? (
                <p className="py-4 text-[0.8125rem] text-ink-3">
                  No feedback visible to you yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {feedbackItems.map((item) => {
                    const meta = feedbackTypeMeta[item.type] ?? feedbackTypeMeta.PRAISE!;
                    return (
                      <li key={item.id} className="rounded-xl border border-line bg-surface-0/50 p-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={item.giverName} src={item.giverAvatar} size={24} />
                          <p className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-ink-1">
                            {item.giverId === user.id ? "You" : item.giverName}
                          </p>
                          <Badge tone={meta.tone as "neutral"}>{meta.label}</Badge>
                          <span className="text-[0.625rem] text-ink-4">
                            {relativeTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-2">
                          {item.message}
                        </p>
                        {item.competencyName ? (
                          <div className="mt-2">
                            <Badge tone="info">{item.competencyName}</Badge>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {canSee ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Published reviews</CardTitle>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                    Finalised reviews only — drafts stay private.
                  </p>
                </div>
                <Briefcase className="size-4 text-ink-3" />
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="py-4 text-[0.8125rem] text-ink-3">
                    No reviews have been published for {person.displayName.split(" ")[0]} yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reviews.map((review) => (
                      <li key={review.id}>
                        <Link
                          href={`/reviews/${review.id}`}
                          className="flex items-center gap-3 rounded-xl border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong"
                        >
                          <Avatar name={review.reviewerName} src={review.reviewerAvatar} size={28} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[0.8125rem] font-medium text-ink-1">
                              {reviewerTypeLabel(review.reviewerType)}
                            </p>
                            <p className="truncate text-[0.625rem] text-ink-4">
                              {review.reviewerName} · {review.cycleName}
                            </p>
                          </div>
                          {review.overallRating ? (
                            <span className="tabular text-[0.8125rem] font-semibold text-ink-1">
                              {review.overallRating}
                              <span className="text-[0.625rem] font-normal text-ink-4">/5</span>
                            </span>
                          ) : null}
                          <Badge tone={review.status === "ACKNOWLEDGED" || review.status === "LOCKED" ? "positive" : "info"}>
                            {review.status.toLowerCase()}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reporting line</CardTitle>
              <Users className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">Manager</p>
                {manager ? (
                  <Link
                    href={`/people/${manager.id}`}
                    className="mt-1 flex items-center gap-2.5 rounded-lg border border-line bg-surface-0/50 p-2 transition-colors hover:border-line-strong"
                  >
                    <Avatar name={manager.displayName} src={manager.avatarUrl} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8125rem] text-ink-1">
                        {manager.displayName}
                      </span>
                      <span className="block truncate text-[0.625rem] text-ink-4">
                        {manager.jobTitle ?? "MetricStream"}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <p className="mt-1 text-[0.8125rem] text-ink-3">No manager on record</p>
                )}
              </div>

              <div className="hairline" />

              <div>
                <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  Direct reports ({reports.length})
                </p>
                {reports.length === 0 ? (
                  <p className="mt-1 text-[0.8125rem] text-ink-3">Individual contributor</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {reports.map((report) => (
                      <li key={report.id}>
                        <Link
                          href={`/people/${report.id}`}
                          className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2"
                        >
                          <Avatar name={report.displayName} src={report.avatarUrl} size={24} />
                          <span className="min-w-0">
                            <span className="block truncate text-[0.75rem] text-ink-1">
                              {report.displayName}
                            </span>
                            <span className="block truncate text-[0.625rem] text-ink-4">
                              {report.jobTitle ?? "MetricStream"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <UserRound className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem]">
              <Row label="Department" value={person.departmentName ?? "—"} />
              <Row label="Location" value={person.location ?? "—"} />
              <Row label="Joined" value={formatDate(person.hireDate)} />
              <Row label="Role" value={person.systemRole.toLowerCase()} />
              <Row label="Status" value={person.status.replaceAll("_", " ").toLowerCase()} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 text-ink-3">
      <span>{label}</span>
      <span className="text-right font-medium capitalize text-ink-2">{value}</span>
    </p>
  );
}
