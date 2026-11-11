import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Flag,
  Gauge,
  Layers,
  Lock,
  Mail,
  Target,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can, canSeePerformanceOf } from "@/lib/auth/rbac";
import {
  computeProgress,
  getChildGoals,
  getGoal,
  getGoalTasks,
  getGoalUpdates,
  summariseGoals,
} from "@/lib/services/goals";
import { CheckInDialog } from "@/components/goals/checkin-dialog";
import { EditGoalDialog } from "@/components/goals/edit-goal-dialog";
import {
  GoalApprovalActions,
  SubmitGoalsButton,
} from "@/components/goals/goal-approval";
import { TaskList } from "@/components/goals/task-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/layout";
import { MeterBar, ProgressRing } from "@/components/ui/progress";
import {
  daysUntil,
  formatDate,
  formatDateTime,
  goalStatusMeta,
  num,
  priorityMeta,
  relativeTime,
} from "@/lib/utils";

export const metadata = { title: "Goal" };

const CONFIDENCE_LABEL: Record<string, { label: string; tone: string }> = {
  ON_TRACK: { label: "Confident", tone: "positive" },
  NEEDS_ATTENTION: { label: "Needs attention", tone: "warning" },
  BLOCKED: { label: "Blocked", tone: "danger" },
};

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const record = await getGoal(id);
  if (!record) notFound();

  const { goal } = record;
  const isOwner = goal.ownerId === user.id;

  const allowed =
    isOwner ||
    can(user, "goal:read:all") ||
    (goal.visibility === "ORGANIZATION" && !goal.archivedAt) ||
    (await canSeePerformanceOf(user, goal.ownerId));

  if (!allowed) notFound();

  const [updates, tasks, children] = await Promise.all([
    getGoalUpdates(goal.id),
    getGoalTasks(goal.id),
    getChildGoals(goal.id),
  ]);

  const parent = goal.parentGoalId ? await getGoal(goal.parentGoalId) : null;
  const isManager = !isOwner && (await canSeePerformanceOf(user, goal.ownerId));
  const isDirectManager = !isOwner && record.ownerManagerId === user.id;
  const canCheckIn = (isOwner || isManager) && !goal.archivedAt && goal.approvalStatus === "APPROVED";
  const canEditTasks = isOwner || can(user, "goal:manage:any");
  const meta = goalStatusMeta[goal.status] ?? goalStatusMeta.NOT_STARTED!;
  const priority = priorityMeta[goal.priority] ?? priorityMeta.MEDIUM!;
  const confidence = CONFIDENCE_LABEL[goal.confidence] ?? CONFIDENCE_LABEL.ON_TRACK!;
  const due = daysUntil(goal.dueDate);

  const projected = computeProgress({
    metricType: goal.metricType,
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    status: goal.status,
  });

  const childStats = summariseGoals(
    children.map((c) => ({ status: c.status, progress: c.progress, weight: c.weight })),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/goals"
          className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-ink-1"
        >
          <ArrowLeft className="size-3.5" /> All goals
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {goal.archivedAt ? (
            <Badge tone="neutral" dot>
              Archived
            </Badge>
          ) : (
            <Badge tone={meta.tone as "neutral"} dot>
              {meta.label}
            </Badge>
          )}
          <Badge tone={confidence.tone as "neutral"}>{confidence.label}</Badge>
          {goal.approvalStatus === "DRAFT" ? (
            <Badge tone="neutral" dot>
              Not sent for approval
            </Badge>
          ) : goal.approvalStatus === "SUBMITTED" ? (
            <Badge tone="info" dot>
              Awaiting approval
            </Badge>
          ) : goal.approvalStatus === "RETURNED" ? (
            <Badge tone="danger" dot>
              Sent back
            </Badge>
          ) : (
            <Badge tone="positive" dot>
              Approved
            </Badge>
          )}
          {isOwner &&
          !goal.archivedAt &&
          (goal.approvalStatus === "DRAFT" || goal.approvalStatus === "RETURNED") ? (
            <EditGoalDialog
              goal={{
                id: goal.id,
                title: goal.title,
                description: goal.description,
                weight: goal.weight,
                priority: goal.priority,
                visibility: goal.visibility,
                dueDate: goal.dueDate,
              }}
            />
          ) : null}
          {isOwner &&
          !goal.archivedAt &&
          (goal.approvalStatus === "DRAFT" || goal.approvalStatus === "RETURNED") ? (
            <SubmitGoalsButton
              goalIds={[goal.id]}
              count={1}
              label={goal.approvalStatus === "RETURNED" ? "Resubmit for approval" : "Send for approval"}
              size="md"
              variant="primary"
            />
          ) : null}
          {isDirectManager && goal.approvalStatus === "SUBMITTED" ? (
            <GoalApprovalActions goalId={goal.id} />
          ) : null}
          {canCheckIn ? (
            <CheckInDialog
              goalId={goal.id}
              currentValue={goal.currentValue}
              metricType={goal.metricType}
              startValue={goal.startValue}
              targetValue={goal.targetValue}
              unit={goal.unit}
              status={goal.status}
              confidence={goal.confidence}
            />
          ) : null}
        </div>
      </div>

      <div className="panel relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-brand-500/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <ProgressRing
            value={goal.progress}
            size={132}
            label={`${goal.progress}%`}
            sublabel="progress"
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
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1.5">
              {goal.category.replaceAll("_", " ")} · {goal.metricType.toLowerCase()}
            </p>
            <h1 className="display text-[1.5rem] font-semibold leading-tight text-ink-1 sm:text-[1.75rem]">
              {goal.title}
            </h1>
            {goal.description ? (
              <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-ink-3">
                {goal.description}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Fact
                icon={<Target />}
                label="Metric"
                value={`${goal.currentValue} of ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""}`}
                hint={`Started at ${goal.startValue}${goal.unit ? ` ${goal.unit}` : ""}`}
              />
              <Fact
                icon={<CalendarDays />}
                label="Timeline"
                value={
                  goal.dueDate
                    ? due !== null && due < 0
                      ? `${Math.abs(due)} days overdue`
                      : `Due ${formatDate(goal.dueDate, { day: "2-digit", month: "short" })}`
                    : "No due date"
                }
                hint={
                  goal.startDate ? `Started ${formatDate(goal.startDate)}` : "Not started yet"
                }
                tone={due !== null && due < 0 ? "text-rose-400" : undefined}
              />
              <Fact
                icon={<Gauge />}
                label="Weight"
                value={`${num(goal.weight).toFixed(0)}%`}
                hint={`${priority.label} priority`}
              />
            </div>
          </div>
        </div>
      </div>

      {goal.approvalStatus === "RETURNED" && goal.approvalComment ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-3">
          <Flag className="mt-0.5 size-4 shrink-0 text-rose-400" />
          <div>
            <p className="text-[0.8125rem] font-medium text-ink-1">
              Your manager sent this goal back
            </p>
            <p className="mt-0.5 whitespace-pre-line text-[0.75rem] leading-relaxed text-ink-3">
              {goal.approvalComment}
            </p>
            <p className="mt-1.5 text-[0.6875rem] text-ink-4">
              Update the goal, then resubmit it for approval.
            </p>
          </div>
        </div>
      ) : null}

      {goal.approvalStatus === "SUBMITTED" ? (
        <p className="rounded-xl border border-line bg-surface-0/60 px-4 py-3 text-[0.75rem] leading-relaxed text-ink-3">
          {isOwner
            ? "This goal is waiting for your manager to approve it. Check-ins open as soon as it is approved."
            : `This goal is waiting for ${record.ownerName.split(" ")[0]}'s manager to approve it. Check-ins open once it is approved.`}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Check-in history</CardTitle>
              <span className="text-[0.6875rem] text-ink-4">
                {updates.length ? `${updates.length} entries` : "Encrypted at rest"}
              </span>
            </CardHeader>
            <CardContent>
              {updates.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp />}
                  title="No check-ins yet"
                  description="Check in weekly — the history feeds directly into your review score."
                  action={
                    canCheckIn ? (
                      <span className="text-[0.75rem] text-ink-3">
                        Use “Log check-in” above to start.
                      </span>
                    ) : undefined
                  }
                />
              ) : (
                <ol className="relative space-y-4 border-l border-line pl-4">
                  {updates.map((u) => (
                    <li key={u.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[1.32rem] top-1.5 size-2 rounded-full border border-surface-0 bg-brand-400"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar name={u.authorName} src={u.authorAvatar} size={22} />
                        <span className="text-[0.75rem] font-medium text-ink-1">
                          {u.authorName}
                        </span>
                        <span className="text-[0.6875rem] text-ink-4">
                          {relativeTime(u.createdAt)}
                        </span>
                        <Badge tone="brand" className="ml-auto tabular">
                          {u.progress}%
                        </Badge>
                      </div>
                      {u.note ? (
                        <p className="mt-1.5 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-2">
                          {u.note}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[0.6875rem] text-ink-4">
                        <span>status: {u.status.replaceAll("_", " ").toLowerCase()}</span>
                        <span>
                          confidence: {u.confidence.replaceAll("_", " ").toLowerCase()}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Tasks</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Break the result into the work that gets you there.
                </p>
              </div>
              <Badge tone="neutral">
                {tasks.filter((t) => t.status === "DONE").length}/{tasks.length}
              </Badge>
            </CardHeader>
            <CardContent>
              {canEditTasks ? (
                <TaskList goalId={goal.id} tasks={tasks} />
              ) : tasks.length === 0 ? (
                <p className="py-4 text-[0.8125rem] text-ink-3">
                  The goal owner hasn&apos;t added tasks yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 rounded-lg border border-line bg-surface-0/50 px-2.5 py-2 text-[0.8125rem] text-ink-2"
                    >
                      <CheckCircle2
                        className={
                          task.status === "DONE"
                            ? "size-4 shrink-0 text-mint-400"
                            : "size-4 shrink-0 text-ink-4"
                        }
                      />
                      <span className={task.status === "DONE" ? "line-through text-ink-4" : ""}>
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {children.length > 0 ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Aligned goals</CardTitle>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                    {childStats.total} linked goal{childStats.total === 1 ? "" : "s"} ·{" "}
                    {childStats.weightedProgress}% weighted progress
                  </p>
                </div>
                <Layers className="size-4 text-ink-3" />
              </CardHeader>
              <CardContent className="space-y-2">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/goals/${child.id}`}
                    className="block rounded-lg border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[0.8125rem] font-medium text-ink-1">
                        {child.title}
                      </p>
                      <span className="shrink-0 text-[0.6875rem] tabular text-ink-3">
                        {child.progress}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <MeterBar value={child.progress} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
              <Link
                href={`/people/${goal.ownerId}`}
                className="text-[0.6875rem] font-medium text-brand-300 hover:text-brand-200"
              >
                Profile
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={record.ownerName} src={record.ownerAvatar} size={42} ring />
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] font-semibold text-ink-1">
                    {record.ownerName}
                  </p>
                  <p className="truncate text-[0.75rem] text-ink-3">
                    {record.ownerJobTitle ?? "MetricStream"}
                  </p>
                </div>
              </div>
              <div className="hairline" />
              <p className="flex items-center gap-2 text-[0.75rem] text-ink-3">
                <Mail className="size-3.5" /> {record.ownerEmail}
              </p>
              {record.cycleName ? (
                <p className="flex items-center gap-2 text-[0.75rem] text-ink-3">
                  <CalendarDays className="size-3.5" /> {record.cycleName}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>At a glance</CardTitle>
              <Flag className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem]">
              <Row label="Status" value={meta.label} />
              <Row label="Approval" value={approvalLabel(goal.approvalStatus)} />
              {goal.approvalDecidedAt && goal.approvalStatus === "APPROVED" ? (
                <Row label="Approved" value={formatDate(goal.approvalDecidedAt)} />
              ) : null}
              <Row label="Priority" value={priority.label} />
              <Row label="Visibility" value={visibilityLabel(goal.visibility)} />
              <Row label="Confidence" value={confidence.label} />
              <Row label="Category" value={goal.category.replaceAll("_", " ").toLowerCase()} />
              <Row label="Created" value={formatDate(goal.createdAt)} />
              <Row label="Updated" value={formatDateTime(goal.updatedAt)} />
              {parent ? (
                <>
                  <div className="hairline" />
                  <p className="text-[0.6875rem] uppercase tracking-wider text-ink-4">
                    Parent goal
                  </p>
                  <Link
                    href={`/goals/${parent.goal.id}`}
                    className="block rounded-lg border border-line bg-surface-0/50 p-2.5 text-[0.8125rem] text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1"
                  >
                    {parent.goal.title}
                  </Link>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How this is scored</CardTitle>
              <Lock className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-[0.75rem]">
                <span className="text-ink-3">Goal progress</span>
                <span className="tabular font-medium text-ink-1">{projected}%</span>
              </div>
              <MeterBar value={projected} />
              <p className="text-[0.6875rem] leading-relaxed text-ink-4">
                Your cycle score weights each goal by its weight ({num(goal.weight).toFixed(0)}%
                here). Achieved goals count as 100% regardless of the metric.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-0/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[0.625rem] uppercase tracking-wider text-ink-4">
        <span className="[&_svg]:size-3">{icon}</span> {label}
      </p>
      <p className={`mt-1 text-[0.8125rem] font-semibold text-ink-1 ${tone ?? ""}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[0.625rem] text-ink-4">{hint}</p> : null}
    </div>
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

function approvalLabel(value: string): string {
  return (
    {
      DRAFT: "Draft — not sent",
      SUBMITTED: "Awaiting manager approval",
      APPROVED: "Approved",
      RETURNED: "Sent back for revision",
    } as Record<string, string>
  )[value] ?? value;
}

function visibilityLabel(value: string): string {
  return (
    {
      PRIVATE: "Only me",
      MANAGER: "Me and manager",
      TEAM: "My team",
      ORGANIZATION: "Organisation",
    } as Record<string, string>
  )[value] ?? value;
}
