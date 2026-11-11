import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Building2,
  Gauge,
  LayoutGrid,
  Target,
  TrendingDown,
  Trophy,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import {
  cycleTrend,
  departmentPerformance,
  goalCategoryMix,
  nineBoxGrid,
  orgSnapshot,
  reviewCompletionByCycle,
  talentList,
} from "@/lib/services/analytics";
import {
  cycleProgress,
  listCycles,
  ratingDistribution,
} from "@/lib/services/reviews";
import { DistributionBars, TrendChart } from "@/components/charts/charts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar } from "@/components/ui/progress";
import { cn, cycleStatusMeta, formatDate } from "@/lib/utils";

export const metadata = { title: "Analytics" };

const PERFORMANCE_LABELS = ["Needs improvement", "Solid", "Outstanding"];
const POTENTIAL_LABELS = ["High potential", "Growth", "Steady"];

const NINE_BOX_TONE = [
  ["bg-surface-2", "bg-brand-500/10", "bg-brand-500/20"],
  ["bg-brand-500/10", "bg-brand-500/18", "bg-brand-500/28"],
  ["bg-brand-500/18", "bg-brand-500/28", "bg-mint-500/25"],
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "analytics:org")) {
    if (can(user, "analytics:team")) redirect("/team");
    redirect("/forbidden");
  }

  const params = await searchParams;
  const [snapshot, departments, trend, mix, cycles, completion] = await Promise.all([
    orgSnapshot(),
    departmentPerformance(),
    cycleTrend(),
    goalCategoryMix(),
    listCycles(),
    reviewCompletionByCycle(),
  ]);

  const usableCycles = cycles.filter((c) => c.status !== "DRAFT");
  const selectedCycle =
    usableCycles.find((c) => c.id === params.cycle) ?? usableCycles[0] ?? cycles[0] ?? null;

  const cycleData = selectedCycle
    ? await Promise.all([
        nineBoxGrid(selectedCycle.id),
        ratingDistribution(selectedCycle.id),
        talentList(selectedCycle.id, 8),
        cycleProgress(selectedCycle.id),
      ])
    : null;

  const emptyGrid: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const grid = cycleData?.[0] ?? emptyGrid;
  const ratings = cycleData?.[1] ?? [];
  const talents = cycleData?.[2] ?? [];
  const progress = cycleData?.[3] ?? {
    total: 0,
    complete: 0,
    selfDone: 0,
    managerDone: 0,
    awaitingAck: 0,
  };

  const maxRating = Math.max(1, ...ratings.map((r) => r.count));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation intelligence"
        title="Analytics"
        description="Where performance is concentrating, where risk is building, and how the current cycle is tracking."
        actions={
          <LinkButton href="/team" variant="outline" size="md">
            <Users className="size-4" /> My team view
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Headcount"
          value={snapshot.headcount}
          hint={`${snapshot.active} active · ${snapshot.onLeave} on leave`}
          icon={<Users />}
          tone="brand"
        />
        <Stat
          label="Avg goal progress"
          value={`${snapshot.avgGoalProgress}%`}
          hint={`${snapshot.goalsTotal} live goals`}
          icon={<Target />}
          tone={snapshot.avgGoalProgress >= 60 ? "positive" : "warning"}
        />
        <Stat
          label="Goals at risk"
          value={snapshot.goalsAtRisk}
          hint={
            snapshot.goalsTotal
              ? `${Math.round((snapshot.goalsAtRisk / snapshot.goalsTotal) * 100)}% of the portfolio`
              : "No goals yet"
          }
          icon={<TrendingDown />}
          tone={snapshot.goalsAtRisk ? "danger" : "positive"}
        />
        <Stat
          label="Cycle completion"
          value={progress.total ? `${Math.round((progress.complete / progress.total) * 100)}%` : "—"}
          hint={
            progress.total
              ? `${progress.complete} of ${progress.total} participants`
              : "No active cycle"
          }
          icon={<Briefcase />}
          tone="info"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cycle trajectory</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Average overall score across recent cycles
              </p>
            </div>
            <BarChart3 className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent>
            <TrendChart
              data={trend.map((c) => ({
                label: c.name.replace(/\s+/g, " ").slice(0, 14),
                value: Math.round(c.avgScore),
              }))}
              height={190}
            />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[...trend.slice(-3)].reverse().map((c) => (
                <div key={c.cycleId} className="rounded-lg border border-line bg-surface-0/50 px-2 py-2">
                  <p className="truncate text-[0.625rem] text-ink-4">{c.name}</p>
                  <p className="tabular text-[0.875rem] font-semibold text-ink-1">
                    {c.avgScore ? `${c.avgScore}%` : "—"}
                  </p>
                  <p className="text-[0.5625rem] text-ink-4">
                    {c.complete}/{c.participants} complete
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Goal mix</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">By category across the org</p>
            </div>
            <Gauge className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent>
            {mix.length === 0 ? (
              <p className="py-6 text-[0.8125rem] text-ink-3">No goals recorded yet.</p>
            ) : (
              <DistributionBars
                data={mix.map((m) => ({
                  label: m.category.replaceAll("_", " ").toLowerCase(),
                  value: m.count,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Department performance</CardTitle>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              Average goal progress, headcount and risk by department
            </p>
          </div>
          <Building2 className="size-4 text-ink-3" />
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title="No departments configured"
              description="Add departments and assign people to see org-level breakdowns."
              className="py-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left">
                <thead>
                  <tr className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 font-medium">People</th>
                    <th className="pb-2 font-medium">Goals</th>
                    <th className="pb-2 font-medium">At risk</th>
                    <th className="pb-2 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {departments.map((dept) => (
                    <tr key={dept.id} className="text-[0.8125rem]">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/people?dept=${dept.id}`}
                          className="font-medium text-ink-1 hover:text-brand-200"
                        >
                          {dept.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 tabular text-ink-3">{dept.headcount}</td>
                      <td className="py-2.5 pr-3 tabular text-ink-3">{dept.goalCount}</td>
                      <td className="py-2.5 pr-3">
                        {dept.atRisk > 0 ? (
                          <Badge tone="warning">{dept.atRisk}</Badge>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <MeterBar
                            value={dept.avgProgress}
                            tone={dept.atRisk > 0 ? "warning" : dept.avgProgress >= 65 ? "positive" : "brand"}
                          />
                          <span className="w-9 shrink-0 text-right text-[0.75rem] tabular text-ink-2">
                            {dept.avgProgress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Nine-box grid</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                {selectedCycle
                  ? `${selectedCycle.name} · performance vs potential`
                  : "Select a cycle to populate"}
              </p>
            </div>
            <LayoutGrid className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[5.5rem_repeat(3,1fr)] gap-1 text-center">
              <div />
              {PERFORMANCE_LABELS.map((label) => (
                <div key={label} className="px-1 pb-1 text-[0.5625rem] leading-tight text-ink-4">
                  {label}
                </div>
              ))}
              {[2, 1, 0].map((potentialIndex) => (
                <FragmentRow
                  key={potentialIndex}
                  potentialIndex={potentialIndex}
                  row={grid[potentialIndex] ?? [0, 0, 0]}
                />
              ))}
            </div>
            {selectedCycle ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action="/analytics" className="flex items-center gap-2">
                  <select
                    name="cycle"
                    defaultValue={selectedCycle.id}
                    className="h-8 rounded-lg border border-line bg-surface-0 px-2 text-[0.75rem] text-ink-2"
                    aria-label="Review cycle"
                  >
                    {usableCycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="h-8 rounded-lg border border-line-strong px-2.5 text-[0.75rem] text-ink-2 hover:bg-surface-3"
                  >
                    Apply
                  </button>
                </form>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rating distribution</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                {selectedCycle ? "Proposed and final ratings combined" : "No cycle selected"}
              </p>
            </div>
            <Trophy className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent>
            {ratings.length === 0 ? (
              <p className="py-6 text-[0.8125rem] text-ink-3">
                Ratings appear once manager reviews are submitted.
              </p>
            ) : (
              <div className="space-y-2">
                {ratings.map((rating) => (
                  <div key={rating.rating} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-[0.75rem] tabular text-ink-3">
                      {rating.rating}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-aqua-400"
                        style={{ width: `${(rating.count / maxRating) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[0.75rem] tabular text-ink-2">
                      {rating.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="hairline my-3" />
            <div className="grid grid-cols-2 gap-2 text-[0.6875rem]">
              <Fact label="Participants" value={progress.total} />
              <Fact label="Self reviews" value={progress.selfDone} />
              <Fact label="Manager reviews" value={progress.managerDone} />
              <Fact label="Awaiting ack." value={progress.awaitingAck} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Top talent</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Highest overall scores in the selected cycle
              </p>
            </div>
            <Trophy className="size-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {talents.length === 0 ? (
              <p className="py-4 text-[0.8125rem] text-ink-3">
                No scored participants yet.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {talents.map((person, index) => (
                  <li key={person.employeeId}>
                    <Link
                      href={`/people/${person.employeeId}`}
                      className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="w-4 shrink-0 text-[0.6875rem] tabular text-ink-4">
                        {index + 1}
                      </span>
                      <Avatar name={person.name} src={person.avatarUrl} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] text-ink-1">{person.name}</p>
                        <p className="truncate text-[0.625rem] text-ink-4">
                          {person.jobTitle ?? "MetricStream"} · {person.departmentName ?? "—"}
                        </p>
                      </div>
                      {person.likelyRating ? (
                        <Badge tone="brand">{Number(person.likelyRating).toFixed(1)}</Badge>
                      ) : null}
                      <span className="tabular text-[0.75rem] font-medium text-ink-2">
                        {person.overallScore ?? "—"}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cycle completion</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">Review progress by cycle</p>
            </div>
            <Briefcase className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent className="space-y-3">
            {completion.length === 0 ? (
              <p className="py-4 text-[0.8125rem] text-ink-3">No cycles yet.</p>
            ) : (
              completion.map((cycle) => {
                const meta = cycleStatusMeta[cycle.status] ?? cycleStatusMeta.DRAFT!;
                const pct = cycle.total ? Math.round((cycle.complete / cycle.total) * 100) : 0;
                return (
                  <div key={cycle.cycleId}>
                    <div className="flex items-center justify-between gap-2 text-[0.75rem]">
                      <span className="min-w-0 truncate text-ink-2">{cycle.name}</span>
                      <Badge tone={meta.tone as "neutral"}>{meta.label}</Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <MeterBar value={pct} tone={pct === 100 ? "positive" : "brand"} />
                      <span className="w-14 shrink-0 text-right text-[0.625rem] tabular text-ink-4">
                        {cycle.complete}/{cycle.total}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[0.5625rem] text-ink-4">
                      Period ends {formatDate(cycle.periodEnd)}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FragmentRow({
  potentialIndex,
  row,
}: {
  potentialIndex: number;
  row: number[];
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-1.5 text-right text-[0.5625rem] leading-tight text-ink-4">
        {POTENTIAL_LABELS[2 - potentialIndex]}
      </div>
      {row.map((count, performanceIndex) => (
        <div
          key={performanceIndex}
          className={cn(
            "flex aspect-[1.6] items-center justify-center rounded-lg border border-line/60 text-[0.8125rem] font-semibold tabular",
            count > 0 ? "text-ink-1" : "text-ink-4",
            NINE_BOX_TONE[2 - potentialIndex]?.[performanceIndex],
          )}
        >
          {count || "·"}
        </div>
      ))}
    </>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface-0/50 px-2 py-1.5">
      <p className="text-[0.5625rem] uppercase tracking-wider text-ink-4">{label}</p>
      <p className="tabular text-[0.8125rem] font-semibold text-ink-1">{value}</p>
    </div>
  );
}
