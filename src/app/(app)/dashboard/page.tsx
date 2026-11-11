import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  MessageSquareHeart,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  listGoals,
  summariseGoals,
  upcomingGoalDeadlines,
} from "@/lib/services/goals";
import { cycleProgress, getActiveCycle } from "@/lib/services/reviews";
import {
  personalSnapshot,
  progressTrend,
  teamSnapshot,
} from "@/lib/services/analytics";
import { getMyReviewTasks } from "@/lib/services/reviews";
import { listFeedbackFor } from "@/lib/services/feedback";
import { listOneOnOnes, openActionItemsFor } from "@/lib/services/one-on-ones";
import { getTeamIds } from "@/lib/services/people";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeterBar, ProgressRing } from "@/components/ui/progress";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { TrendChart } from "@/components/charts/charts";
import {
  cn,
  daysUntil,
  formatDate,
  goalStatusMeta,
  participantStatusMeta,
  relativeTime,
} from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();

  const teamIds = await getTeamIds(user.id);

  const [
    goals,
    snapshot,
    trend,
    tasks,
    cycle,
    feedbackItems,
    meetings,
    actions,
    deadlines,
    team,
  ] = await Promise.all([
    listGoals({ ownerIds: [user.id], limit: 6 }),
    personalSnapshot(user.id),
    progressTrend(user.id),
    getMyReviewTasks(user.id),
    getActiveCycle(),
    listFeedbackFor(user.id, "received", [user.id], 4),
    listOneOnOnes(user.id),
    openActionItemsFor(user.id),
    upcomingGoalDeadlines(user.id, 21),
    teamIds.length ? teamSnapshot(teamIds) : Promise.resolve(null),
  ]);

  const goalStats = summariseGoals(goals);
  const progress = await (cycle ? cycleProgress(cycle.id) : Promise.resolve(null));

  const pendingTasks = tasks.filter(
    (t) => t.status !== "SUBMITTED" && t.status !== "ACKNOWLEDGED",
  );

  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
        title={
          <>
            {greeting()}, {firstName}.
          </>
        }
        description="Here's where your goals, review cycle and team stand today."
        actions={
          <>
            <LinkButton href="/feedback" variant="secondary" size="md" className="hidden sm:inline-flex">
              <MessageSquareHeart className="size-4" /> Give feedback
            </LinkButton>
            <LinkButton href="/goals" size="md">
              View all goals
            </LinkButton>
          </>
        }
      />

      {/* ── Snapshot ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Weighted goal progress"
          value={`${snapshot.goals.weighted}%`}
          hint={`${snapshot.goals.total} active goal${snapshot.goals.total === 1 ? "" : "s"}`}
          icon={<Target />}
          tone="brand"
        />
        <Stat
          label="Reviews to complete"
          value={pendingTasks.length}
          hint={
            pendingTasks.length
              ? `Next due ${relativeTime(pendingTasks[0]?.dueDate ?? null)}`
              : "Nothing outstanding"
          }
          icon={<ClipboardCheck />}
          tone={pendingTasks.length ? "warning" : "positive"}
        />
        <Stat
          label="Feedback received"
          value={snapshot.feedbackReceived}
          hint="Across all visibility levels"
          icon={<MessageSquareHeart />}
          tone="info"
        />
        <Stat
          label={
            team
              ? "Team headcount"
              : "Goals on track"
          }
          value={team ? team.headcount : snapshot.goals.onTrack}
          hint={
            team
              ? `${team.atRisk} at risk · ${team.avgProgress}% avg progress`
              : `${snapshot.goals.atRisk} at risk`
          }
          icon={team ? <UsersRound /> : <CheckCircle2 />}
          tone={team && team.atRisk > 0 ? "warning" : "positive"}
        />
      </div>

      {/* ── Goals + cycle ────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>My goals</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                {goalStats.total} goal{goalStats.total === 1 ? "" : "s"} ·{" "}
                {goalStats.achieved} achieved · {goalStats.atRisk + goalStats.offTrack} need
                attention
              </p>
            </div>
            <LinkButton href="/goals" variant="ghost" size="sm">
              View all <ArrowUpRight className="size-3.5" />
            </LinkButton>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={snapshot.goals.weighted}
                  size={92}
                  label={`${snapshot.goals.weighted}%`}
                  sublabel="weighted"
                />
                <div className="space-y-1 text-[0.75rem]">
                  <p className="flex items-center gap-1.5 text-ink-2">
                    <span className="size-1.5 rounded-full bg-mint-400" />
                    {goalStats.onTrack} on track
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-2">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    {goalStats.atRisk} at risk
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-2">
                    <span className="size-1.5 rounded-full bg-rose-400" />
                    {goalStats.offTrack} off track
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[0.6875rem] uppercase tracking-wider text-ink-4">
                  Progress trend
                </p>
                <TrendChart data={trend} height={110} />
              </div>
            </div>

            <div className="space-y-2">
              {goals.length === 0 ? (
                <EmptyState
                  icon={<Target />}
                  title="No goals yet"
                  description="Set your first objective to start tracking progress against this quarter."
                  action={
                    <LinkButton href="/goals" size="sm">
                      Create a goal
                    </LinkButton>
                  }
                />
              ) : (
                goals.slice(0, 4).map((g) => {
                  const meta = goalStatusMeta[g.status] ?? goalStatusMeta.NOT_STARTED!;
                  const due = daysUntil(g.dueDate);
                  return (
                    <Link
                      key={g.id}
                      href={`/goals/${g.id}`}
                      className="block rounded-xl border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong hover:bg-surface-2/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[0.8125rem] font-medium text-ink-1">
                            {g.title}
                          </p>
                          <p className="mt-0.5 text-[0.6875rem] text-ink-3">
                            {g.category.replaceAll("_", " ").toLowerCase()} · weight{" "}
                            {Number(g.weight).toFixed(0)}%
                            {g.dueDate ? ` · due ${formatDate(g.dueDate)}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {due !== null && due <= 7 && due >= 0 ? (
                            <Badge tone="warning" dot>
                              {due === 0 ? "Due today" : `${due}d left`}
                            </Badge>
                          ) : null}
                          <Badge tone={meta.tone as "neutral"}>{meta.label}</Badge>
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2.5">
                        <MeterBar
                          value={g.progress}
                          tone={meta.tone === "positive" ? "positive" : meta.tone === "danger" ? "danger" : meta.tone === "warning" ? "warning" : "brand"}
                        />
                        <span className="w-9 shrink-0 text-right text-[0.6875rem] font-semibold tabular text-ink-2">
                          {g.progress}%
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Review cycle</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  {cycle ? cycle.name : "No active cycle"}
                </p>
              </div>
              {cycle ? (
                <Badge tone="brand" dot>
                  {cycle.status.replaceAll("_", " ").toLowerCase()}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3.5">
              {cycle && progress ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-line bg-surface-0/60 px-3 py-2.5">
                    <div>
                      <p className="text-[0.6875rem] uppercase tracking-wider text-ink-4">
                        Cycle completion
                      </p>
                      <p className="mt-0.5 text-[0.875rem] font-semibold text-ink-1">
                        {progress.complete} of {progress.total} people
                      </p>
                    </div>
                    <ProgressRing
                      value={progress.total ? (progress.complete / progress.total) * 100 : 0}
                      size={52}
                      stroke={5}
                      tone="info"
                    />
                  </div>

                  <TimelineRow
                    label="Self reviews"
                    done={progress.selfDone}
                    total={progress.total}
                  />
                  <TimelineRow
                    label="Manager reviews"
                    done={progress.managerDone}
                    total={progress.total}
                  />
                  <TimelineRow
                    label="Acknowledgements"
                    done={progress.complete}
                    total={progress.total}
                  />

                  <div className="hairline" />

                  <div className="space-y-1.5 text-[0.75rem]">
                    {cycle.selfReviewDue ? (
                      <p className="flex items-center justify-between text-ink-3">
                        <span>Self review due</span>
                        <span className="text-ink-2">{formatDate(cycle.selfReviewDue)}</span>
                      </p>
                    ) : null}
                    {cycle.managerReviewDue ? (
                      <p className="flex items-center justify-between text-ink-3">
                        <span>Manager review due</span>
                        <span className="text-ink-2">{formatDate(cycle.managerReviewDue)}</span>
                      </p>
                    ) : null}
                  </div>

                  <LinkButton href="/reviews" variant="outline" size="sm" className="w-full">
                    Open my reviews
                  </LinkButton>
                </>
              ) : (
                <EmptyState
                  icon={<CalendarClock />}
                  title="No cycle running"
                  description="People Operations will publish the next cycle. You'll be notified here."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Needs your attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingTasks.slice(0, 3).map((t) => (
                <Link
                  key={t.id}
                  href={`/reviews/${t.id}`}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-0/50 p-2.5 transition-colors hover:border-line-strong"
                >
                  <Avatar name={t.subjectName} src={t.subjectAvatar} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.75rem] font-medium text-ink-1">
                      {t.reviewerType === "SELF" ? "Your self review" : `${t.subjectName}`}
                    </p>
                    <p className="truncate text-[0.625rem] text-ink-3">
                      {t.cycleName} · {t.reviewerType.toLowerCase()}
                    </p>
                  </div>
                  <Badge tone={t.status === "DRAFT" ? "warning" : "neutral"} dot>
                    {t.status === "NOT_STARTED" ? "Start" : t.status.toLowerCase()}
                  </Badge>
                </Link>
              ))}

              {actions.length > 0 ? (
                <div className="mt-1 space-y-2 border-t border-line pt-2.5">
                  <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                    Action items
                  </p>
                  {actions.slice(0, 3).map((a) => (
                    <label
                      key={a.id}
                      className="flex items-start gap-2 text-[0.75rem] text-ink-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-3.5 rounded border-line-strong bg-surface-2 accent-[#6f4bff]"
                        aria-label={a.description}
                      />
                      <span className="min-w-0 flex-1 truncate">{a.description}</span>
                      {a.dueDate ? (
                        <span className="shrink-0 text-[0.625rem] text-ink-4">
                          {formatDate(a.dueDate, { day: "2-digit", month: "short" })}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : null}

              {pendingTasks.length === 0 && actions.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-mint-500/20 bg-mint-500/[0.06] p-3">
                  <CheckCircle2 className="size-4 shrink-0 text-mint-400" />
                  <p className="text-[0.75rem] text-ink-2">
                    You&apos;re all caught up. Nice work.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Bottom row ───────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent feedback</CardTitle>
            <LinkButton href="/feedback" variant="ghost" size="sm">
              All <ArrowUpRight className="size-3.5" />
            </LinkButton>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbackItems.length === 0 ? (
              <p className="py-6 text-center text-[0.8125rem] text-ink-3">
                No feedback yet. Ask a colleague for input on a recent project.
              </p>
            ) : (
              feedbackItems.slice(0, 3).map((f) => (
                <div key={f.id} className="rounded-xl border border-line bg-surface-0/50 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={f.giverName} src={f.giverAvatar} size={22} />
                    <p className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-ink-1">
                      {f.giverName}
                    </p>
                    <Badge tone={f.type === "CONSTRUCTIVE" ? "warning" : "positive"}>
                      {f.type.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[0.75rem] leading-relaxed text-ink-2">
                    {f.message}
                  </p>
                  <p className="mt-1.5 text-[0.625rem] text-ink-4">
                    {relativeTime(f.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming 1:1s</CardTitle>
            <LinkButton href="/one-on-ones" variant="ghost" size="sm">
              All <ArrowUpRight className="size-3.5" />
            </LinkButton>
          </CardHeader>
          <CardContent className="space-y-2">
            {meetings.length === 0 ? (
              <p className="py-6 text-center text-[0.8125rem] text-ink-3">
                Nothing scheduled. Book time with your manager or a report.
              </p>
            ) : (
              meetings.slice(0, 3).map((m) => {
                const other = m.managerId === user.id ? m.employeeName : m.managerName;
                const otherId = m.managerId === user.id ? m.employeeId : m.managerId;
                return (
                  <Link
                    key={m.id}
                    href={`/one-on-ones/${m.id}`}
                    className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-0/50 p-2.5 transition-colors hover:border-line-strong"
                  >
                    <Avatar name={other} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.75rem] font-medium text-ink-1">{other}</p>
                      <p className="truncate text-[0.625rem] text-ink-3">
                        {formatDate(m.scheduledAt, {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {m.durationMinutes}m
                      </p>
                    </div>
                    {m.openActions > 0 ? (
                      <Badge tone="warning">{m.openActions} open</Badge>
                    ) : null}
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deadlines ahead</CardTitle>
            <Flame className="size-4 text-amber-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            {deadlines.length === 0 ? (
              <p className="py-6 text-center text-[0.8125rem] text-ink-3">
                No goals due in the next three weeks.
              </p>
            ) : (
              deadlines.map((d) => {
                const days = daysUntil(d.dueDate);
                return (
                  <Link
                    key={d.id}
                    href={`/goals/${d.id}`}
                    className="block rounded-lg border border-line bg-surface-0/50 p-2.5 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-[0.75rem] font-medium text-ink-1">
                        {d.title}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 text-[0.625rem] font-semibold",
                          days !== null && days <= 3
                            ? "text-rose-400"
                            : days !== null && days <= 7
                              ? "text-amber-400"
                              : "text-ink-4",
                        )}
                      >
                        {days !== null ? `${days}d` : ""}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <MeterBar value={d.progress} />
                    </div>
                  </Link>
                );
              })
            )}
            <div className="flex items-center gap-1.5 border-t border-line pt-2.5 text-[0.625rem] text-ink-4">
              <CalendarDays className="size-3" /> Timelines update from your check-ins.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[0.75rem]">
        <span className="text-ink-3">{label}</span>
        <span className="tabular text-ink-2">
          {done}/{total}
        </span>
      </div>
      <MeterBar value={pct} tone={pct === 100 ? "positive" : pct > 0 ? "warning" : "brand"} />
    </div>
  );
}

export { participantStatusMeta };
