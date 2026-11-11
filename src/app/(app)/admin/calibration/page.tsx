import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  LayoutGrid,
  Scale,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import {
  getCycle,
  listCycles,
  listParticipants,
  ratingDistribution,
} from "@/lib/services/reviews";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar } from "@/components/ui/progress";
import {
  CalibrateDialog,
  RecalculateCycleButton,
} from "@/components/admin/calibration-controls";
import { cn, cycleStatusMeta, formatDate, num, pct } from "@/lib/utils";

export const metadata = { title: "Calibration" };

const PERFORMANCE_LABELS = ["Needs improvement", "Solid", "Outstanding"];
const POTENTIAL_LABELS = ["High potential", "Growth", "Steady"];

const NINE_BOX_TONE = [
  ["bg-surface-2", "bg-brand-500/10", "bg-brand-500/20"],
  ["bg-brand-500/10", "bg-brand-500/18", "bg-brand-500/28"],
  ["bg-brand-500/18", "bg-brand-500/28", "bg-mint-500/25"],
];

type View = "all" | "pending" | "calibrated";

export default async function AdminCalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string; view?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "calibration:manage")) redirect("/forbidden");

  const params = await searchParams;
  const view: View =
    params.view === "pending" || params.view === "calibrated" ? params.view : "all";

  const cycles = await listCycles();
  const usable = cycles.filter((c) => c.status !== "DRAFT");
  const selected = usable.find((c) => c.id === params.cycle) ?? usable[0] ?? cycles[0] ?? null;

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Calibration"
          description="Normalise ratings across teams before they are shared with employees."
        />
        <EmptyState
          icon={<Scale />}
          title="No cycles to calibrate"
          description="Create and launch a review cycle first — calibration works on enrolled participants."
          className="py-16"
        />
      </div>
    );
  }

  const [detail, participants, ratings] = await Promise.all([
    getCycle(selected.id),
    listParticipants(selected.id, { limit: 500 }),
    ratingDistribution(selected.id),
  ]);

  const calibrated = participants.filter((p) => p.finalRating !== null);
  const pending = participants.filter((p) => p.finalRating === null);
  const scored = participants.filter((p) => p.overallScore !== null);
  const avgFinal =
    calibrated.length > 0
      ? calibrated.reduce((sum, p) => sum + num(p.finalRating), 0) / calibrated.length
      : null;
  const avgProposed =
    participants.filter((p) => p.proposedRating !== null).length > 0
      ? participants.reduce((sum, p) => sum + num(p.proposedRating), 0) /
        participants.filter((p) => p.proposedRating !== null).length
      : null;

  const rows =
    view === "pending" ? pending : view === "calibrated" ? calibrated : participants;

  const grid: number[][] = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (const participant of calibrated) {
    if (participant.nineBoxPerformance === null) continue;
    const performance = Math.min(3, Math.max(1, participant.nineBoxPerformance)) - 1;
    const potential = Math.min(3, Math.max(1, participant.nineBoxPotential ?? 1)) - 1;
    grid[potential]![performance]! += 1;
  }

  const scaleMin = detail?.scaleMin ?? 1;
  const scaleMax = detail?.scaleMax ?? 5;
  const meta = cycleStatusMeta[selected.status] ?? cycleStatusMeta.DRAFT!;

  const buildHref = (patch: { cycle?: string; view?: View }) => {
    const next = new URLSearchParams();
    const cycle = patch.cycle ?? selected.id;
    const nextView = patch.view ?? view;
    if (cycle) next.set("cycle", cycle);
    if (nextView !== "all") next.set("view", nextView);
    return `/admin/calibration?${next.toString()}`;
  };

  const maxRating = Math.max(1, ...ratings.map((r) => r.count));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Calibration"
        description="Compare proposals side by side, correct for manager bias, and lock in final ratings before the acknowledgement phase."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form action="/admin/calibration" className="flex items-center gap-2">
              <select
                name="cycle"
                defaultValue={selected.id}
                className="h-9 rounded-lg border border-line bg-surface-0 px-2 text-[0.8125rem] text-ink-2"
                aria-label="Review cycle"
              >
                {(usable.length ? usable : cycles).map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
              {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
              <button
                type="submit"
                className="h-9 rounded-lg border border-line-strong px-3 text-[0.8125rem] text-ink-2 hover:bg-surface-3"
              >
                Load
              </button>
            </form>
            <RecalculateCycleButton cycleId={selected.id} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone as "neutral"} dot>
          {meta.label}
        </Badge>
        <span className="text-[0.75rem] text-ink-4">
          {formatDate(selected.periodStart)} → {formatDate(selected.periodEnd)}
          {detail?.templateName ? ` · ${detail.templateName}` : ""}
          {detail?.scaleName ? ` · ${detail.scaleName}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Participants"
          value={participants.length}
          hint={`${scored.length} with a computed score`}
          icon={<Users />}
          tone="brand"
        />
        <Stat
          label="Calibrated"
          value={calibrated.length}
          hint={`${pct(calibrated.length, participants.length)}% of the cohort`}
          icon={<CheckCircle2 />}
          tone={pending.length === 0 && participants.length > 0 ? "positive" : "warning"}
        />
        <Stat
          label="Average final"
          value={avgFinal === null ? "—" : avgFinal.toFixed(2)}
          hint={
            avgProposed === null
              ? "No proposed ratings yet"
              : `Proposed avg ${avgProposed.toFixed(2)}`
          }
          icon={<Scale />}
          tone="info"
        />
        <Stat
          label="Awaiting"
          value={pending.length}
          hint="Reviews not yet calibrated"
          icon={<SlidersHorizontal />}
          tone={pending.length ? "danger" : "positive"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Nine-box distribution</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Calibrated participants by performance and potential
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
                <React.Fragment key={potentialIndex}>
                  <div className="flex items-center justify-end pr-1.5 text-right text-[0.5625rem] leading-tight text-ink-4">
                    {POTENTIAL_LABELS[2 - potentialIndex]}
                  </div>
                  {grid[potentialIndex]!.map((count, performanceIndex) => (
                    <div
                      key={performanceIndex}
                      className={cn(
                        "flex aspect-[1.7] items-center justify-center rounded-lg border border-line/60 text-[0.875rem] font-semibold tabular",
                        count > 0 ? "text-ink-1" : "text-ink-4",
                        NINE_BOX_TONE[2 - potentialIndex]?.[performanceIndex],
                      )}
                    >
                      {count || "·"}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-4">
              Uncalibrated participants are not plotted until a talent position is chosen.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Rating spread</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Proposed and final ratings for this cycle
              </p>
            </div>
            <BarChart3 className="size-4 text-ink-3" />
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
            <div className="flex items-center justify-between text-[0.75rem]">
              <span className="text-ink-3">Calibration completion</span>
              <span className="tabular text-ink-1">
                {calibrated.length}/{participants.length}
              </span>
            </div>
            <div className="mt-1.5">
              <MeterBar
                value={pct(calibrated.length, participants.length)}
                tone={calibrated.length === participants.length ? "positive" : "brand"}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Cohort</CardTitle>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              {rows.length} {rows.length === 1 ? "person" : "people"}
              {view === "pending"
                ? " awaiting calibration"
                : view === "calibrated"
                  ? " already calibrated"
                  : " in this cycle"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "pending", "calibrated"] as View[]).map((tab) => (
              <Link
                key={tab}
                href={buildHref({ view: tab })}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[0.75rem] font-medium capitalize transition-colors",
                  view === tab
                    ? "bg-surface-3 text-ink-1"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink-1",
                )}
              >
                {tab}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Scale />}
              title={view === "pending" ? "Everyone is calibrated" : "Nothing here yet"}
              description={
                view === "pending"
                  ? "Every participant in this cycle has a final rating."
                  : "Participant scores appear once reviews are submitted and recalculated."
              }
              className="py-10"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left">
                <thead>
                  <tr className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                    <th className="pb-2 font-medium">Person</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Goals</th>
                    <th className="pb-2 text-right font-medium">Competencies</th>
                    <th className="pb-2 text-right font-medium">Overall</th>
                    <th className="pb-2 text-right font-medium">Proposed</th>
                    <th className="pb-2 text-right font-medium">Final</th>
                    <th className="pb-2 font-medium">Nine-box</th>
                    <th className="pb-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((participant) => (
                    <tr key={participant.id} className="text-[0.8125rem]">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/people/${participant.employeeId}`}
                          className="flex items-center gap-2.5"
                        >
                          <Avatar
                            name={participant.employeeName}
                            src={participant.employeeAvatar}
                            size={28}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink-1 hover:text-brand-200">
                              {participant.employeeName}
                            </span>
                            <span className="block truncate text-[0.625rem] text-ink-4">
                              {participant.jobTitle ?? "—"}
                              {participant.departmentName
                                ? ` · ${participant.departmentName}`
                                : ""}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          tone={
                            participant.finalRating
                              ? "positive"
                              : participant.status === "COMPLETE"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {participant.finalRating
                            ? "Calibrated"
                            : participant.status.replaceAll("_", " ").toLowerCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular text-ink-3">
                        {participant.goalsScore ? `${num(participant.goalsScore).toFixed(0)}%` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular text-ink-3">
                        {/*
                          `competenciesScore` is a raw 1–maxScale average (see
                          the schema), so it is normalised here before being
                          shown next to the percentage columns.
                        */}
                        {participant.competenciesScore
                          ? `${Math.round((num(participant.competenciesScore) / scaleMax) * 100)}%`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular font-medium text-ink-1">
                        {participant.overallScore
                          ? `${num(participant.overallScore).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular text-ink-2">
                        {participant.proposedRating ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {participant.finalRating ? (
                          <span className="tabular font-semibold text-brand-200">
                            {num(participant.finalRating).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {participant.nineBoxPerformance ? (
                          <span className="text-[0.6875rem] text-ink-3">
                            P{participant.nineBoxPerformance} · T
                            {participant.nineBoxPotential ?? "—"}
                          </span>
                        ) : (
                          <span className="text-[0.6875rem] text-ink-4">Not set</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <CalibrateDialog
                          participant={{
                            id: participant.id,
                            employeeId: participant.employeeId,
                            employeeName: participant.employeeName,
                            departmentName: participant.departmentName,
                            overallScore: participant.overallScore,
                            proposedRating: participant.proposedRating,
                            finalRating: participant.finalRating,
                            nineBoxPerformance: participant.nineBoxPerformance,
                            nineBoxPotential: participant.nineBoxPotential,
                          }}
                          scaleMin={scaleMin}
                          scaleMax={scaleMax}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
