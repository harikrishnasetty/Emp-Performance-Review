import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  FileText,
  Flag,
  Layers,
  Send,
  Target,
  UsersRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  listGoals,
  listGoalsAwaitingApproval,
  summariseGoals,
} from "@/lib/services/goals";
import { listCycles } from "@/lib/services/reviews";
import { countDirectReports } from "@/lib/services/people";
import { NewGoalDialog } from "@/components/goals/new-goal-dialog";
import {
  GoalApprovalActions,
  SubmitGoalsButton,
} from "@/components/goals/goal-approval";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { MeterBar, ProgressRing } from "@/components/ui/progress";
import {
  cn,
  daysUntil,
  formatDate,
  goalStatusMeta,
  num,
  priorityMeta,
  relativeTime,
} from "@/lib/utils";

export const metadata = { title: "Goals" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "In flight" },
  { key: "risk", label: "Needs attention" },
  { key: "achieved", label: "Achieved" },
];

const STATUS_GROUPS: Record<string, string[]> = {
  active: ["NOT_STARTED", "ON_TRACK", "DRAFT"],
  risk: ["AT_RISK", "OFF_TRACK", "MISSED"],
  achieved: ["ACHIEVED"],
};

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; cycle?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = FILTERS.some((f) => f.key === params.filter) ? params.filter! : "all";

  const [allGoals, cycles, reportCount, awaitingApproval] = await Promise.all([
    listGoals({ ownerIds: [user.id], limit: 200 }),
    listCycles(),
    countDirectReports(user.id),
    listGoalsAwaitingApproval(user.id),
  ]);

  const pendingApproval = allGoals.filter(
    (g) => g.approvalStatus === "DRAFT" || g.approvalStatus === "RETURNED",
  );

  const upcomingCycles = cycles.filter(
    (c) => !["CLOSED", "ARCHIVED"].includes(c.status),
  );

  const cycleFilter = params.cycle && params.cycle !== "all" ? params.cycle : null;
  const goals = allGoals.filter((g) => {
    if (cycleFilter && g.cycleId !== cycleFilter) return false;
    const statuses = STATUS_GROUPS[filter];
    if (statuses && !statuses.includes(g.status)) return false;
    return true;
  });

  const stats = summariseGoals(goals);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Goal management"
        title="Objectives & key results"
        description="Set measurable goals, check in often, and keep your review evidence current."
        actions={
          <>
            {reportCount > 0 ? (
              <LinkButton href="/team" variant="ghost" size="md">
                <UsersRound className="size-4" /> Team goals
              </LinkButton>
            ) : null}
            <NewGoalDialog cycles={upcomingCycles.map((c) => ({ id: c.id, name: c.name }))} />
          </>
        }
      />

      {pendingApproval.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-300">
                <Send className="size-4" />
              </span>
              <div>
                <p className="text-[0.875rem] font-medium text-ink-1">
                  {pendingApproval.length} goal{pendingApproval.length === 1 ? "" : "s"} not yet
                  approved
                </p>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-3">
                  Send them to your manager for sign-off. Check-ins open once a goal is approved.
                </p>
              </div>
            </div>
            <SubmitGoalsButton count={pendingApproval.length} />
          </CardContent>
        </Card>
      ) : null}

      {awaitingApproval.length > 0 ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Goals awaiting your approval</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Step 2 of the cycle — review the target and send it back if it needs work.
              </p>
            </div>
            <Badge tone="info" dot>
              {awaitingApproval.length} waiting
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {awaitingApproval.map((goal) => (
              <div
                key={goal.id}
                className="rounded-xl border border-line bg-surface-0/50 p-3.5"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={goal.ownerName} src={goal.ownerAvatar} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] font-medium text-ink-1">{goal.title}</p>
                    <p className="mt-0.5 text-[0.6875rem] text-ink-3">
                      {goal.ownerName}
                      {goal.cycleName ? ` · ${goal.cycleName}` : ""} · sent{" "}
                      {relativeTime(goal.approvalSubmittedAt)}
                    </p>
                  </div>
                  <Badge tone="neutral" className="tabular">
                    weight {num(goal.weight).toFixed(0)}%
                  </Badge>
                </div>
                {goal.description ? (
                  <p className="mt-2 line-clamp-2 text-[0.75rem] leading-relaxed text-ink-3">
                    {goal.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <Link
                    href={`/goals/${goal.id}`}
                    className="text-[0.6875rem] font-medium text-brand-300 hover:text-brand-200"
                  >
                    Review details →
                  </Link>
                  <GoalApprovalActions goalId={goal.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-6 pt-5">
            <ProgressRing
              value={stats.weightedProgress}
              size={104}
              label={`${stats.weightedProgress}%`}
              sublabel="weighted"
            />
            <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Metric label="Goals" value={stats.total} />
              <Metric label="On track" value={stats.onTrack} tone="text-mint-400" />
              <Metric label="At risk" value={stats.atRisk} tone="text-amber-400" />
              <Metric label="Achieved" value={stats.achieved} tone="text-brand-300" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <p className="text-[0.75rem] font-medium uppercase tracking-wider text-ink-3">
                Total goal weight
              </p>
              <Badge tone={stats.totalWeight === 100 ? "positive" : "warning"} dot>
                {stats.totalWeight}%
              </Badge>
            </div>
            <MeterBar
              value={Math.min(100, stats.totalWeight)}
              tone={stats.totalWeight === 100 ? "positive" : "warning"}
            />
            <p className="text-[0.75rem] leading-relaxed text-ink-3">
              {stats.totalWeight === 100
                ? "Weights are balanced. Your goal score will use the full 100%."
                : stats.totalWeight > 100
                  ? "Weights exceed 100%. Scores are normalised, but trimming a few points keeps the plan clear."
                  : `Weights total ${stats.totalWeight}%. Scores are normalised against this figure.`}
            </p>
            <div className="hairline" />
            <p className="flex items-center gap-1.5 text-[0.75rem] text-ink-3">
              <CalendarClock className="size-3.5" />
              {stats.averageProgress}% average progress across active goals
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const search = new URLSearchParams();
          if (f.key !== "all") search.set("filter", f.key);
          if (cycleFilter) search.set("cycle", cycleFilter);
          return (
            <Link
              key={f.key}
              href={search.toString() ? `/goals?${search}` : "/goals"}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition-colors",
                active
                  ? "border-brand-500/40 bg-brand-500/12 text-brand-200"
                  : "border-line bg-surface-1 text-ink-3 hover:border-line-strong hover:text-ink-1",
              )}
            >
              {f.label}
            </Link>
          );
        })}

        {upcomingCycles.length > 0 ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[0.6875rem] uppercase tracking-wider text-ink-4">
              Cycle
            </span>
            <Link
              href={filter !== "all" ? `/goals?filter=${filter}` : "/goals"}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors",
                !cycleFilter
                  ? "border-brand-500/40 bg-brand-500/12 text-brand-200"
                  : "border-line bg-surface-1 text-ink-3 hover:text-ink-1",
              )}
            >
              All
            </Link>
            {upcomingCycles.map((c) => (
              <Link
                key={c.id}
                href={`/goals?${new URLSearchParams({
                  ...(filter !== "all" ? { filter } : {}),
                  cycle: c.id,
                })}`}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors",
                  cycleFilter === c.id
                    ? "border-brand-500/40 bg-brand-500/12 text-brand-200"
                    : "border-line bg-surface-1 text-ink-3 hover:text-ink-1",
                )}
              >
                {c.name}
              </Link>
            ))}
            {cycleFilter ? (
              <Link
                href={`/goals/cycle/${cycleFilter}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/12 px-3 py-1.5 text-[0.75rem] font-medium text-brand-200 transition-colors hover:bg-brand-500/20"
              >
                <FileText className="size-3.5" /> Review cycle form
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target />}
          title={allGoals.length === 0 ? "No goals yet" : "Nothing matches this filter"}
          description={
            allGoals.length === 0
              ? "Start with two or three outcomes that matter this quarter. You can add key results as tasks."
              : "Try a different filter or cycle — your other goals are still here."
          }
          action={
            allGoals.length === 0 ? (
              <NewGoalDialog
                cycles={upcomingCycles.map((c) => ({ id: c.id, name: c.name }))}
              />
            ) : (
              <LinkButton href="/goals" variant="outline" size="sm">
                Clear filters
              </LinkButton>
            )
          }
        />
      ) : (
        <div className="grid gap-3 stagger lg:grid-cols-2">
          {goals.map((goal) => {
            const meta = goalStatusMeta[goal.status] ?? goalStatusMeta.NOT_STARTED!;
            const priority = priorityMeta[goal.priority] ?? priorityMeta.MEDIUM!;
            const due = daysUntil(goal.dueDate);
            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="group panel panel-hover flex flex-col p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={meta.tone as "neutral"} dot>
                        {meta.label}
                      </Badge>
                      <Badge tone={priority.tone as "neutral"}>{priority.label}</Badge>
                      {goal.parentGoalId ? (
                        <Badge tone="brand">
                          <Layers className="size-2.5" /> Key result
                        </Badge>
                      ) : null}
                      {goal.approvalStatus === "DRAFT" ? (
                        <Badge tone="neutral">Not sent</Badge>
                      ) : goal.approvalStatus === "SUBMITTED" ? (
                        <Badge tone="info">Awaiting approval</Badge>
                      ) : goal.approvalStatus === "RETURNED" ? (
                        <Badge tone="danger">Sent back</Badge>
                      ) : null}
                    </div>
                    <h2 className="text-[0.9375rem] font-semibold leading-snug text-ink-1 group-hover:text-white">
                      {goal.title}
                    </h2>
                    {goal.description ? (
                      <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-3">
                        {goal.description}
                      </p>
                    ) : null}
                  </div>
                  <ProgressRing
                    value={goal.progress}
                    size={62}
                    stroke={6}
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

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6875rem] text-ink-3">
                  <span className="flex items-center gap-1">
                    <Flag className="size-3" />
                    {goal.category.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span>weight {num(goal.weight).toFixed(0)}%</span>
                  <span>
                    {goal.currentValue} → {goal.targetValue}
                    {goal.unit ? ` ${goal.unit}` : ""}
                  </span>
                  {goal.cycleName ? <span className="truncate">{goal.cycleName}</span> : null}
                  {goal.dueDate ? (
                    <span
                      className={cn(
                        "ml-auto font-medium",
                        due !== null && due < 0
                          ? "text-rose-400"
                          : due !== null && due <= 7
                            ? "text-amber-400"
                            : "text-ink-3",
                      )}
                    >
                      {due !== null && due < 0
                        ? `${Math.abs(due)}d overdue`
                        : due === 0
                          ? "Due today"
                          : `Due ${formatDate(goal.dueDate)}`}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
                  <Avatar name={goal.ownerName} src={goal.ownerAvatar} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-ink-3">
                    {goal.ownerName}
                  </span>
                  <span className="text-[0.6875rem] text-ink-3">
                    {goal.tasksDone}/{goal.taskCount} tasks
                  </span>
                  <ArrowUpRight className="size-3.5 text-ink-4 transition-colors group-hover:text-brand-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] uppercase tracking-wider text-ink-4">{label}</p>
      <p className={cn("display mt-0.5 text-[1.35rem] font-semibold tabular text-ink-1", tone)}>
        {value}
      </p>
    </div>
  );
}
