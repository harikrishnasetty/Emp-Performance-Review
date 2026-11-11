import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarRange,
  ClipboardList,
  Layers,
  Route,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listCycles, listRatingScales, listTemplates } from "@/lib/services/reviews";
import { listDepartments } from "@/lib/services/people";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar } from "@/components/ui/progress";
import {
  CreateCycleDialog,
  CyclePhaseMenu,
  EnrolDialog,
} from "@/components/admin/cycle-admin";
import { cycleStatusMeta, formatDate, pct } from "@/lib/utils";

export const metadata = { title: "Review cycles" };

const TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Annual",
  MID_YEAR: "Mid-year",
  QUARTERLY: "Quarterly",
  PROBATION: "Probation",
  PROJECT: "Project",
  AD_HOC: "Ad hoc",
};

const LIFECYCLE = [
  { phase: "Draft", detail: "Design the cycle. Nothing is visible yet." },
  { phase: "Scheduled", detail: "Participants enrolled, timetable locked." },
  { phase: "Goal setting", detail: "Employees agree objectives with managers." },
  { phase: "Self review", detail: "Reflections captured before manager input." },
  { phase: "Manager review", detail: "Managers assess goals and competencies." },
  { phase: "Calibration", detail: "Ratings normalised across teams." },
  { phase: "Acknowledgement", detail: "Employees sign off on the outcome." },
  { phase: "Closed", detail: "Scores frozen, results published to analytics." },
];

export default async function AdminCyclesPage() {
  const user = await requireUser();
  if (!can(user, "cycle:manage")) redirect("/forbidden");

  const [cycles, templates, scales, departments] = await Promise.all([
    listCycles(),
    listTemplates(),
    listRatingScales(),
    listDepartments(),
  ]);

  const activeCycles = cycles.filter(
    (c) => c.status !== "CLOSED" && c.status !== "ARCHIVED",
  );
  const participantTotal = cycles.reduce((sum, c) => sum + c.participants, 0);
  const completedTotal = cycles.reduce((sum, c) => sum + c.completed, 0);
  const openTemplates = templates.filter((t) => t.status === "PUBLISHED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Review cycles"
        description="Design the rhythm of performance conversations — who takes part, what they are measured on, and when each phase opens."
        actions={
          <CreateCycleDialog
            templates={templates.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
            }))}
            scales={scales.map((s) => ({
              id: s.id,
              name: s.name,
              minValue: s.minValue,
              maxValue: s.maxValue,
            }))}
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Live cycles"
          value={activeCycles.length}
          hint={`${cycles.length} in total`}
          icon={<CalendarRange />}
          tone="brand"
        />
        <Stat
          label="Participants"
          value={participantTotal}
          hint="Across every cycle"
          icon={<Users />}
          tone="info"
        />
        <Stat
          label="Reviews complete"
          value={completedTotal}
          hint={
            participantTotal
              ? `${pct(completedTotal, participantTotal)}% of all participation`
              : "No participants yet"
          }
          icon={<ClipboardList />}
          tone={participantTotal && completedTotal === participantTotal ? "positive" : "warning"}
        />
        <Stat
          label="Active templates"
          value={openTemplates}
          hint={`${templates.length} templates in the library`}
          icon={<Layers />}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          {cycles.length === 0 ? (
            <EmptyState
              icon={<CalendarRange />}
              title="No review cycles yet"
              description="Create your first cycle, then enrol participants to generate their self and manager review tasks."
              className="py-16"
            />
          ) : (
            cycles.map((cycle) => {
              const meta = cycleStatusMeta[cycle.status] ?? cycleStatusMeta.DRAFT!;
              const progress = pct(cycle.completed, cycle.participants);
              const live = cycle.status !== "CLOSED" && cycle.status !== "ARCHIVED";
              return (
                <Card key={cycle.id} className="overflow-hidden">
                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-[0.9375rem] font-semibold text-ink-1">
                            {cycle.name}
                          </h2>
                          <Badge tone="neutral">{TYPE_LABELS[cycle.type] ?? cycle.type}</Badge>
                          {live ? <Badge tone="brand" dot>live</Badge> : null}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
                          <span>
                            {formatDate(cycle.periodStart)} → {formatDate(cycle.periodEnd)}
                          </span>
                          <span className="text-ink-4">·</span>
                          <span>{cycle.templateName ?? "No template"}</span>
                          {cycle.selfReviewDue ? (
                            <>
                              <span className="text-ink-4">·</span>
                              <span>Self due {formatDate(cycle.selfReviewDue)}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CyclePhaseMenu cycleId={cycle.id} status={cycle.status} />
                        <EnrolDialog
                          cycleId={cycle.id}
                          cycleName={cycle.name}
                          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                          enrolled={cycle.participants}
                        />
                        <LinkButton href={`/reviews?tab=cycles`} variant="ghost" size="sm">
                          Reviews <ArrowUpRight className="size-3.5" />
                        </LinkButton>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <MeterBar
                        value={progress}
                        tone={
                          progress === 100 ? "positive" : progress >= 50 ? "brand" : "warning"
                        }
                      />
                      <span className="w-32 shrink-0 text-right text-[0.6875rem] tabular text-ink-3">
                        {cycle.completed}/{cycle.participants} complete
                      </span>
                      <span className="shrink-0 text-[0.6875rem] tabular text-ink-4">
                        {progress}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-ink-4">
                      <Badge tone={meta.tone as "neutral"}>{meta.label}</Badge>
                      <span>·</span>
                      <span>
                        {cycle.participants === 0
                          ? "No participants enrolled"
                          : `${cycle.participants} participants`}
                      </span>
                      {cycle.managerReviewDue ? (
                        <>
                          <span>·</span>
                          <span>Manager due {formatDate(cycle.managerReviewDue)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Lifecycle</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  How a cycle moves from design to closed
                </p>
              </div>
              <Route className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5">
                {LIFECYCLE.map((step, index) => (
                  <li key={step.phase} className="flex gap-2.5">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-[0.625rem] tabular text-ink-3">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[0.75rem] font-medium text-ink-1">{step.phase}</p>
                      <p className="text-[0.6875rem] leading-relaxed text-ink-3">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Before you launch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                Publishing a template makes it selectable when a cycle opens. Draft templates are
                hidden from employees but safe to attach while you are still designing.
              </p>
              <Link
                href="/admin/templates"
                className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-300 hover:text-brand-200"
              >
                Manage templates <ArrowUpRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
