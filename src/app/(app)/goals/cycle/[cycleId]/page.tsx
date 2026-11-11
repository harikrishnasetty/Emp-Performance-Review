import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  PenLine,
  Scale,
  Target,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCycle, getParticipant, getRatingLevels } from "@/lib/services/reviews";
import {
  getLatestGoalComments,
  listGoals,
  summariseGoals,
  type GoalListItem,
} from "@/lib/services/goals";
import { getHrContact, getPerson } from "@/lib/services/people";
import { NewGoalDialog } from "@/components/goals/new-goal-dialog";
import { SubmitGoalsButton } from "@/components/goals/goal-approval";
import { CycleGoalWeightEditor } from "@/components/goals/cycle-goal-weight";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/layout";
import { MeterBar, ProgressRing } from "@/components/ui/progress";
import { cn, formatDate, goalStatusMeta } from "@/lib/utils";

export const metadata = { title: "Cycle goals" };

/**
 * The review-cycle goals form — the app equivalent of the Annual Performance
 * Review PDF: every goal for the cycle on one page, each showing its
 * "% of total score", with the rule that the weights must add up to 100
 * enforced before the set can be sent for approval (step 1 of the process).
 */
export default async function CycleGoalsPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const user = await requireUser();

  const cycleRow = await getCycle(cycleId);
  if (!cycleRow) notFound();
  const { cycle } = cycleRow;

  const [goals, person, manager, hrContact, levels, participant] = await Promise.all([
    listGoals({ ownerIds: [user.id], cycleId: cycle.id, limit: 100 }),
    getPerson(user.id),
    user.managerId ? getPerson(user.managerId) : Promise.resolve(null),
    getHrContact(),
    getRatingLevels(cycle.ratingScaleId),
    getParticipant(cycle.id, user.id),
  ]);

  const comments = await getLatestGoalComments(
    goals.map((g) => g.id),
    user.id,
  );
  const stats = summariseGoals(goals);

  const weightsOk = Math.abs(stats.totalWeight - 100) < 0.01;
  // HR kickoff gate mirrors the server rule: goals are fillable only once HR
  // has enrolled you and the cycle is in its Goal setting phase.
  const goalSettingOpen = cycle.status === "GOAL_SETTING";
  const enrolled = Boolean(participant);
  const canFillGoals = goalSettingOpen && enrolled;
  const fillBlockedReason = !goalSettingOpen
    ? `Goal setting for this cycle is not open (current phase: ${cycle.status.replaceAll("_", " ").toLowerCase()}). The form is read-only until HR opens the goal setting phase.`
    : !enrolled
      ? "You are not enrolled in this cycle yet — HR enrols everyone when the review cycle starts, and goal filling opens then."
      : null;
  const pendingApproval = goals.filter(
    (g) => g.approvalStatus === "DRAFT" || g.approvalStatus === "RETURNED",
  );
  const approvalCounts = goals.reduce<Record<string, number>>((acc, g) => {
    acc[g.approvalStatus] = (acc[g.approvalStatus] ?? 0) + 1;
    return acc;
  }, {});

  const displayName = person?.displayName ?? user.displayName;
  const [firstName, ...lastNameParts] = displayName.split(" ");
  const lastName = lastNameParts.join(" ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={cycle ? `/goals?cycle=${cycle.id}` : "/goals"}
          className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-ink-1"
        >
          <ArrowLeft className="size-3.5" /> Goals
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{cycle.status.replaceAll("_", " ")}</Badge>
          {participant ? (
            <Badge tone="info">
              Participant · {participant.status.replaceAll("_", " ")}
            </Badge>
          ) : (
            <Badge tone="warning">Not enrolled in this cycle</Badge>
          )}
        </div>
      </div>

      {/* ── Form title ─────────────────────────────────────────────── */}
      <div className="panel p-5 sm:p-6">
        <h1 className="display text-[1.45rem] font-semibold leading-tight text-ink-1">
          {/* Avoid "...Performance Review Performance Review Form" when the
              cycle name already says "Performance Review". */}
          {cycle.name.toLowerCase().includes("performance review")
            ? `${cycle.name} Form for ${displayName}`
            : `${cycle.name} Performance Review Form for ${displayName}`}
        </h1>
        <p className="mt-1.5 text-[0.8125rem] text-ink-3">
          {person?.jobTitle ?? user.jobTitle ?? ""}
          {person?.departmentName ? ` · ${person.departmentName}` : ""} ·{" "}
          {formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)}
        </p>
      </div>

      {/* ── Introduction ───────────────────────────────────────────── */}
      <section className="panel overflow-hidden">
        <SectionHeader>Introduction</SectionHeader>
        <div className="p-5">
          <p className="text-[0.8125rem] leading-relaxed text-ink-3">
            Our performance management process is designed to yield positive
            behavioral change leading to improved business performance. Through
            goal setting, continuous stakeholder feedback, self-assessment, and
            periodic manager review, we can open our blind spots, stretch our
            capabilities, and grow the organisation and ourselves.
          </p>
        </div>
      </section>

      {/* ── User information ───────────────────────────────────────── */}
      <section className="panel overflow-hidden">
        <SectionHeader>User Information</SectionHeader>
        <div className="grid gap-x-10 gap-y-3 p-5 sm:grid-cols-2">
          <InfoRow label="First Name" value={firstName ?? displayName} />
          <InfoRow label="Last Name" value={lastName || "—"} />
          <InfoRow label="Username" value={person?.email ?? user.email} />
          <InfoRow label="Location" value={person?.location ?? "—"} />
          <InfoRow
            label="Hire Date"
            value={person?.hireDate ? formatDate(person.hireDate) : "—"}
          />
          <InfoRow label="Human Resource" value={hrContact ?? "People Operations"} />
          <InfoRow label="Manager" value={manager?.displayName ?? "No manager on record"} />
          <InfoRow label="Department" value={person?.departmentName ?? "—"} />
        </div>
      </section>

      {/* ── Goals ──────────────────────────────────────────────────── */}
      <section className="panel overflow-hidden">
        <SectionHeader>Goals</SectionHeader>
        <div className="space-y-5 p-5">
          <div className="space-y-1.5">
            <p className="text-[0.8125rem] text-ink-3">
              This section is for evaluating accomplishments of goals.
            </p>
            <p
              className={cn(
                "text-[0.8125rem] font-semibold",
                weightsOk ? "text-mint-400" : "text-amber-400",
              )}
            >
              The weights for the goals in this section must add up to 100.
            </p>
            {fillBlockedReason ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[0.8125rem] leading-relaxed text-amber-300">
                {fillBlockedReason}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-0/50 px-4 py-3">
            <Scale className="size-4 shrink-0 text-ink-3" />
            <div className="min-w-40 flex-1">
              <MeterBar
                value={Math.min(100, stats.totalWeight)}
                tone={weightsOk ? "positive" : "warning"}
              />
            </div>
            <Badge tone={weightsOk ? "positive" : "warning"} dot className="tabular">
              {stats.totalWeight}% total weight
            </Badge>
            <span className="text-[0.75rem] text-ink-3">
              {weightsOk
                ? "Weights are balanced — ready to send for approval."
                : `Adjust the weights so they total 100% (${stats.totalWeight > 100 ? `${stats.totalWeight - 100}% over` : `${100 - stats.totalWeight}% to go`}).`}
            </span>
          </div>

          {levels.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[0.75rem] font-medium uppercase tracking-wider text-ink-4">
                Performance levels
              </p>
              {[...levels].reverse().map((level) => (
                <p
                  key={level.id}
                  className="text-[0.8125rem] leading-relaxed text-ink-3"
                >
                  <span className="font-semibold text-ink-1">{level.label}</span>
                  {level.description ? ` : ${level.description}` : ""}
                </p>
              ))}
            </div>
          ) : null}

          {goals.length === 0 ? (
            <EmptyState
              icon={<Target />}
              title="No goals for this cycle yet"
              description="Add every goal for the review cycle on this page, then split 100% across them before sending the set for approval."
              action={
                canFillGoals ? (
                  <NewGoalDialog cycles={[{ id: cycle.id, name: cycle.name }]} />
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <GoalBlock
                  key={goal.id}
                  goal={goal}
                  comments={comments.get(goal.id)}
                  canFill={canFillGoals}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-ink-3">
              <Target className="size-3.5" />
              {goals.length} goal{goals.length === 1 ? "" : "s"} ·{" "}
              {approvalCounts.APPROVED ?? 0} approved ·{" "}
              {approvalCounts.SUBMITTED ?? 0} awaiting approval ·{" "}
              {(approvalCounts.DRAFT ?? 0) + (approvalCounts.RETURNED ?? 0)} in draft
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canFillGoals ? (
                <NewGoalDialog cycles={[{ id: cycle.id, name: cycle.name }]} />
              ) : null}
              {pendingApproval.length > 0 ? (
                <SubmitGoalsButton
                  goalIds={pendingApproval.map((g) => g.id)}
                  count={pendingApproval.length}
                  blocked={!weightsOk}
                  blockedHint={
                    weightsOk
                      ? undefined
                      : `Weights total ${stats.totalWeight}% — must be 100%`
                  }
                />
              ) : goals.length > 0 ? (
                <Badge tone="positive">
                  <CheckCircle2 className="size-3" /> Sent for approval
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── Summary ────────────────────────────────────────────────── */}
      <section className="panel overflow-hidden">
        <SectionHeader>Summary</SectionHeader>
        <div className="flex flex-wrap items-center gap-6 p-5">
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
        </div>
      </section>

      {/* ── Signature ──────────────────────────────────────────────── */}
      <section className="panel overflow-hidden">
        <SectionHeader>Signature</SectionHeader>
        <div className="p-5">
          {participant?.employeeSignatureAt ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-400" />
              <div>
                <p className="text-[0.8125rem] font-medium text-ink-1">
                  Employee: {displayName}{" "}
                  <span className="tabular text-ink-3">
                    {formatDate(participant.employeeSignatureAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-[0.75rem] text-ink-3">
                  Signed after the performance communication meeting.
                </p>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[0.8125rem] text-ink-3">
              <PenLine className="size-4 text-ink-4" />
              Not signed yet — the signature is captured in step 9, after the
              performance communication meeting.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Pieces ────────────────────────────────────────────────────────── */

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-b border-line bg-surface-1 px-5 py-3 text-[0.875rem] font-semibold text-ink-1">
      {children}
    </h2>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline gap-3 text-[0.8125rem]">
      <span className="w-36 shrink-0 text-ink-4">{label}</span>
      <span className="min-w-0 break-words font-medium text-ink-1">{value}</span>
    </p>
  );
}

function metricText(goal: GoalListItem): string {
  if (goal.description) return goal.description;
  const unit = goal.unit ? ` ${goal.unit}` : "";
  if (goal.metricType === "BOOLEAN" || goal.metricType === "MILESTONE") {
    return `${goal.currentValue} of ${goal.targetValue} complete`;
  }
  return `${goal.currentValue} → ${goal.targetValue}${unit}`;
}

function GoalBlock({
  goal,
  comments,
  canFill,
}: {
  goal: GoalListItem;
  comments?: {
    employee: string | null;
    manager: string | null;
  };
  /** False when the HR-started cycle isn't in Goal setting or the viewer isn't enrolled. */
  canFill: boolean;
}) {
  const meta = goalStatusMeta[goal.status] ?? goalStatusMeta.NOT_STARTED!;
  const locked =
    goal.approvalStatus === "SUBMITTED" || goal.approvalStatus === "APPROVED";

  return (
    <article className="rounded-xl border border-line bg-surface-0/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">
            {goal.category.replaceAll("_", " ").toLowerCase()}
          </p>
          <h3 className="text-[1.05rem] font-semibold leading-snug text-ink-1">
            <Link
              href={`/goals/${goal.id}`}
              className="transition-colors hover:text-brand-300"
            >
              {goal.title}
            </Link>
          </h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CycleGoalWeightEditor
            goalId={goal.id}
            initialWeight={Number(goal.weight)}
            locked={locked || !canFill}
          />
          <Badge tone={meta.tone as "neutral"} dot>
            {meta.label}
          </Badge>
        </div>
      </div>

      <p className="mt-2 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-3">
        {metricText(goal)}
      </p>

      <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <DetailRow label="Goal Name" value={goal.title} />
        <DetailRow label="Metric" value={metricText(goal)} />
        <DetailRow
          label="Start Date"
          value={goal.startDate ? formatDate(goal.startDate) : "—"}
        />
        <DetailRow
          label="Due Date"
          value={goal.dueDate ? formatDate(goal.dueDate) : "—"}
        />
        <DetailRow label="% Complete" value={`${goal.progress}%`} />
        <DetailRow label="Status" value={meta.label} />
      </div>

      <div className="mt-3">
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

      <div className="mt-4 grid gap-4 border-t border-line pt-3 sm:grid-cols-2">
        <CommentColumn
          title="Mid-Year comments by Employee"
          body={comments?.employee}
        />
        <CommentColumn
          title="Mid-Year comments by Manager"
          body={comments?.manager}
        />
      </div>

      {goal.approvalComment ? (
        <p className="mt-3 rounded-lg border border-line bg-surface-1 px-3 py-2 text-[0.75rem] leading-relaxed text-ink-3">
          <span className="font-medium text-ink-2">Manager: </span>
          {goal.approvalComment}
        </p>
      ) : null}
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline gap-3 text-[0.8125rem]">
      <span className="w-24 shrink-0 text-ink-4">{label}</span>
      <span className="min-w-0 break-words text-ink-1">{value}</span>
    </p>
  );
}

function CommentColumn({ title, body }: { title: string; body?: string | null }) {
  return (
    <div>
      <p className="text-[0.75rem] font-medium leading-snug text-ink-4">{title}</p>
      {body ? (
        <p className="mt-1.5 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-2">
          {body}
        </p>
      ) : (
        <p className="mt-1.5 text-[0.8125rem] italic text-ink-4">No comments yet.</p>
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
      <p
        className={cn(
          "display mt-0.5 text-[1.35rem] font-semibold tabular text-ink-1",
          tone,
        )}
      >
        {value}
      </p>
    </div>
  );
}
