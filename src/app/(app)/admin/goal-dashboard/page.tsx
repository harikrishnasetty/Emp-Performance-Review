import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Target, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getActiveCycle } from "@/lib/services/reviews";
import { getCycleGoalProgress } from "@/lib/services/goals";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { ProgressRing } from "@/components/ui/progress";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Goal dashboard · HR" };

export default async function GoalDashboardPage() {
  const user = await requireUser();
  if (!can(user, "cycle:manage")) {
    return notFound();
  }

  const cycle = await getActiveCycle();
  if (!cycle) {
    return (
      <div className="space-y-5">
        <PageHeader title="Goal dashboard" description="No active review cycle found." />
        <EmptyState
          icon={<Target />}
          title="No active review cycle"
          description="Create and enrol a review cycle first — the goal dashboard shows per-user progress once a cycle is running."
        />
      </div>
    );
  }

  const progress = await getCycleGoalProgress(cycle.id);

  const totals = progress.reduce(
    (acc, p) => ({
      participants: acc.participants + 1,
      goalsSet: acc.goalsSet + p.goalsSet,
      goalsSubmitted: acc.goalsSubmitted + p.goalsSubmitted,
      goalsApproved: acc.goalsApproved + p.goalsApproved,
      goalsPending: acc.goalsPending + p.goalsPending,
    }),
    {
      participants: 0,
      goalsSet: 0,
      goalsSubmitted: 0,
      goalsApproved: 0,
      goalsPending: 0,
    },
  );

  const goalsReady =
    totals.goalsSet > 0
      ? Math.round((totals.goalsApproved / totals.goalsSet) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goal dashboard"
        description={`Per-user goal progress for ${cycle.name} — ${formatDate(cycle.periodStart)} to ${formatDate(cycle.periodEnd)}`}
        actions={
          <Link
            href={`/goals/cycle/${cycle.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-[0.75rem] font-medium transition-colors hover:bg-surface-2 hover:text-ink-1"
          >
            <UserRound className="size-3.5" /> Open cycle form
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-5">
        <Stat
          label="Participants"
          value={totals.participants}
          icon={<UserRound />}
          tone="brand"
        />
        <Stat
          label="Goals set"
          value={totals.goalsSet}
          icon={<Target />}
          tone="info"
        />
        <Stat
          label="Submitted"
          value={totals.goalsSubmitted}
          icon={<Clock />}
          tone="warning"
        />
        <Stat
          label="Approved"
          value={totals.goalsApproved}
          icon={<CheckCircle2 />}
          tone="positive"
        />
        <Stat
          label="Approval rate"
          value={`${goalsReady}%`}
          hint={`${totals.goalsPending} pending manager review`}
          icon={<Target />}
          tone="brand"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Goal progress by user</CardTitle>
          <p className="mt-0.5 text-[0.75rem] text-ink-3">
            Each row shows one enrolled employee's goals for this cycle: set,
            sent to manager, approved, and still pending.
          </p>
        </CardHeader>
        <CardContent>
          {progress.length === 0 ? (
            <EmptyState
              icon={<UserRound />}
              title="No enrolled participants"
              description="HR enrols participants on the cycles page — the dashboard populates once people are enrolled."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.75rem]">
                <thead>
                  <tr className="border-b border-line text-ink-4">
                    <th className="pb-3 font-medium text-ink-1">Employee</th>
                    <th className="pb-3 font-medium text-ink-1">Manager</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Goals set</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Draft</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Submitted</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Approved</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Pending</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Progress</th>
                    <th className="pb-3 font-medium text-ink-1 text-right">Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {progress.map((p) => {
                    const ready =
                      p.goalsSet > 0
                        ? Math.round((p.goalsApproved / p.goalsSet) * 100)
                        : 0;
                    return (
                      <tr key={p.participantId} className="group hover:bg-surface-1/50">
                        <td className="py-3 text-ink-1">
                          <div className="flex items-center gap-2">
                            <Avatar name={p.employeeName} size={24} />
                            <span>{p.employeeName}</span>
                          </div>
                        </td>
                        <td className="py-3 text-ink-3">{p.managerName ?? "—"}</td>
                        <td className="py-3 text-right tabular text-ink-1">{p.goalsSet}</td>
                        <td className="py-3 text-right tabular text-ink-3">
                          {p.goalsDraft}
                        </td>
                        <td className="py-3 text-right tabular text-amber-400">
                          {p.goalsSubmitted}
                        </td>
                        <td className="py-3 text-right tabular text-mint-400">
                          {p.goalsApproved}
                        </td>
                        <td className="py-3 text-right tabular text-ink-2">
                          {p.goalsPending}
                        </td>
                        <td className="py-3 text-right">
                          <ProgressRing
                            value={ready}
                            size={28}
                            label={`${ready}%`}
                            stroke={2}
                          />
                        </td>
                        <td className="py-3 text-right tabular text-ink-1">
                          {p.totalWeight}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
