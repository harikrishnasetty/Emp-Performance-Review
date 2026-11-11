"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  ChevronDown,
  Plus,
  RefreshCw,
  UserPlus,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Field, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/primitives";
import { useFormAction } from "@/lib/client/hooks";
import {
  createCycle,
  enrolParticipants,
  recalculateCycleScores,
  updateCycleStatus,
} from "@/app/actions/admin";
import { cn, cycleStatusMeta } from "@/lib/utils";

type Department = { id: string; name: string };
type Template = { id: string; name: string; status: string };
type Scale = { id: string; name: string; minValue: number; maxValue: number };

/* ───────────────────────────── Create cycle ────────────────────────────── */

const CYCLE_TYPES = [
  { value: "ANNUAL", label: "Annual" },
  { value: "MID_YEAR", label: "Mid-year" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "PROBATION", label: "Probation" },
  { value: "PROJECT", label: "Project" },
  { value: "AD_HOC", label: "Ad hoc" },
] as const;

export function CreateCycleDialog({
  templates,
  scales,
  departments,
}: {
  templates: Template[];
  scales: Scale[];
  departments: Department[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(createCycle);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = React.useState({
    name: "",
    type: "ANNUAL",
    periodStart: today,
    periodEnd: today,
    selfReviewDue: "",
    managerReviewDue: "",
    templateId: templates.find((t) => t.status === "PUBLISHED")?.id ?? "none",
    ratingScaleId: scales[0]?.id ?? "none",
    selfReviewEnabled: true,
    peerReviewEnabled: true,
    peerReviewCount: "3",
    goalsWeight: "50",
    competenciesWeight: "50",
  });
  const [departmentIds, setDepartmentIds] = React.useState<string[]>([]);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDepartment = (id: string) =>
    setDepartmentIds((ids) =>
      ids.includes(id) ? ids.filter((d) => d !== id) : [...ids, id],
    );

  const onGoalsWeight = (value: string) => {
    const goal = Number(value);
    setForm((f) => ({
      ...f,
      goalsWeight: value,
      competenciesWeight: Number.isFinite(goal)
        ? String(Math.max(0, Math.min(100, 100 - goal)))
        : f.competenciesWeight,
    }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        ...form,
        peerReviewCount: Number(form.peerReviewCount),
        goalsWeight: Number(form.goalsWeight),
        competenciesWeight: Number(form.competenciesWeight),
        templateId: form.templateId === "none" ? null : form.templateId,
        ratingScaleId: form.ratingScaleId === "none" ? null : form.ratingScaleId,
        departmentIds,
      },
      {
        successMessage: "Cycle created as a draft",
        onSuccess: () => {
          setOpen(false);
          setForm((f) => ({ ...f, name: "" }));
          setDepartmentIds([]);
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="md">
          <Plus className="size-4" /> New cycle
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Design a review cycle"
        description="A cycle defines the window, the template and who takes part. It starts as a draft — nothing is visible to employees until you enrol them."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <Field label="Cycle name" htmlFor="cycle-name" required error={fieldErrors.name}>
            <Input
              id="cycle-name"
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="FY26 Annual Performance Review"
              maxLength={160}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select value={form.type} onValueChange={set("type")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Period start" required error={fieldErrors.periodStart}>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(e) => set("periodStart")(e.target.value)}
                required
              />
            </Field>
            <Field label="Period end" required error={fieldErrors.periodEnd}>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(e) => set("periodEnd")(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Self review due">
              <Input
                type="date"
                value={form.selfReviewDue}
                onChange={(e) => set("selfReviewDue")(e.target.value)}
              />
            </Field>
            <Field label="Manager review due">
              <Input
                type="date"
                value={form.managerReviewDue}
                onChange={(e) => set("managerReviewDue")(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Review template" hint="Competencies employees are scored against">
              <Select value={form.templateId} onValueChange={set("templateId")}>
                <SelectTrigger>
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.status !== "PUBLISHED" ? " (draft)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rating scale">
              <Select value={form.ratingScaleId} onValueChange={set("ratingScaleId")}>
                <SelectTrigger>
                  <SelectValue placeholder="Default scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default scale</SelectItem>
                  {scales.map((scale) => (
                    <SelectItem key={scale.id} value={scale.id}>
                      {scale.name} ({scale.minValue}–{scale.maxValue})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Goals weighting"
              hint="Share of the overall score driven by goal attainment"
              error={fieldErrors.goalsWeight}
            >
              <Input
                type="number"
                min={0}
                max={100}
                value={form.goalsWeight}
                onChange={(e) => onGoalsWeight(e.target.value)}
              />
            </Field>
            <Field
              label="Competencies weighting"
              hint="Automatically balances to 100"
              error={fieldErrors.competenciesWeight}
            >
              <Input
                type="number"
                min={0}
                max={100}
                value={form.competenciesWeight}
                onChange={(e) => set("competenciesWeight")(e.target.value)}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-line bg-surface-0/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.8125rem] font-medium text-ink-1">Self reviews</p>
                <p className="text-[0.6875rem] text-ink-3">
                  Employees write a self assessment before their manager
                </p>
              </div>
              <Switch
                checked={form.selfReviewEnabled}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, selfReviewEnabled: checked }))
                }
                aria-label="Enable self reviews"
              />
            </div>
            <div className="hairline my-3" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.8125rem] font-medium text-ink-1">Peer feedback</p>
                <p className="text-[0.6875rem] text-ink-3">
                  Collect input from colleagues before calibration
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  aria-label="Peer reviewers per person"
                  value={form.peerReviewCount}
                  onChange={(e) => set("peerReviewCount")(e.target.value)}
                  className="h-8 w-16 text-center"
                  disabled={!form.peerReviewEnabled}
                />
                <Switch
                  checked={form.peerReviewEnabled}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, peerReviewEnabled: checked }))
                  }
                  aria-label="Enable peer feedback"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">
              Scope{" "}
              <span className="font-normal text-ink-4">
                — leave empty for the whole organisation
              </span>
            </p>
            {departments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-[0.75rem] text-ink-3">
                No departments configured yet. Everyone will be in scope.
              </p>
            ) : (
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-line bg-surface-0/60 p-2 sm:grid-cols-2">
                {departments.map((dept) => {
                  const checked = departmentIds.includes(dept.id);
                  return (
                    <label
                      key={dept.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors",
                        checked ? "bg-brand-500/12 text-ink-1" : "text-ink-3 hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDepartment(dept.id)}
                        className="size-3.5 accent-brand-500"
                      />
                      <span className="min-w-0 truncate">{dept.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create draft
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Enrolment ─────────────────────────────── */

export function EnrolDialog({
  cycleId,
  cycleName,
  departments,
  enrolled,
}: {
  cycleId: string;
  cycleName: string;
  departments: Department[];
  enrolled: number;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, submit, error } = useFormAction(enrolParticipants);
  const [departmentIds, setDepartmentIds] = React.useState<string[]>([]);
  const [includeOnLeave, setIncludeOnLeave] = React.useState(true);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      { cycleId, departmentIds, includeOnLeave },
      {
        successMessage: "Participants enrolled",
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="size-3.5" /> Enrol
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Enrol participants — ${cycleName}`}
        description="Enrolment adds everyone in scope and creates their self and manager review tasks. It is safe to run more than once."
        size="md"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-surface-0/60 px-3 py-2 text-[0.75rem] text-ink-3">
            {enrolled > 0
              ? `${enrolled} people are already enrolled. Re-running fills in anyone new and any missing review tasks.`
              : "Nobody is enrolled yet. This run will create the full cohort."}
          </div>

          <div>
            <p className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">
              Department scope{" "}
              <span className="font-normal text-ink-4">— empty means everyone</span>
            </p>
            {departments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-[0.75rem] text-ink-3">
                No departments configured. Everyone active will be enrolled.
              </p>
            ) : (
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-xl border border-line bg-surface-0/60 p-2 sm:grid-cols-2">
                {departments.map((dept) => {
                  const checked = departmentIds.includes(dept.id);
                  return (
                    <label
                      key={dept.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[0.8125rem] transition-colors",
                        checked ? "bg-brand-500/12 text-ink-1" : "text-ink-3 hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDepartmentIds((ids) =>
                            ids.includes(dept.id)
                              ? ids.filter((d) => d !== dept.id)
                              : [...ids, dept.id],
                          )
                        }
                        className="size-3.5 accent-brand-500"
                      />
                      <span className="min-w-0 truncate">{dept.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-0/60 px-3 py-2">
            <div>
              <p className="text-[0.8125rem] font-medium text-ink-1">Include people on leave</p>
              <p className="text-[0.6875rem] text-ink-3">
                They can complete their reviews when they return
              </p>
            </div>
            <Switch
              checked={includeOnLeave}
              onCheckedChange={setIncludeOnLeave}
              aria-label="Include people on leave"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Enrol participants
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Phase controls ───────────────────────────── */

const STATUS_ORDER = [
  "DRAFT",
  "SCHEDULED",
  "GOAL_SETTING",
  "SELF_REVIEW",
  "MANAGER_REVIEW",
  "CALIBRATION",
  "ACKNOWLEDGEMENT",
  "CLOSED",
  "ARCHIVED",
] as const;

type CycleStatus = (typeof STATUS_ORDER)[number];

export function CyclePhaseMenu({
  cycleId,
  status,
  align = "end",
}: {
  cycleId: string;
  status: string;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const { pending, submit } = useFormAction(
    (input: { cycleId: string; status: CycleStatus }) =>
      updateCycleStatus(input.cycleId, input.status),
  );
  const { pending: recalculating, submit: submitRecalc } = useFormAction(
    (input: { cycleId: string }) => recalculateCycleScores(input.cycleId),
  );

  const currentIndex = STATUS_ORDER.indexOf(status as CycleStatus);
  const meta = cycleStatusMeta[status] ?? cycleStatusMeta.DRAFT!;

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" loading={pending} className="gap-1.5">
            <span className="flex items-center gap-1.5">
              <Badge tone={meta.tone as "neutral"} dot>
                {meta.label}
              </Badge>
              <ChevronDown className="size-3.5 text-ink-3" />
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align}>
          <DropdownMenuLabel>Move cycle to</DropdownMenuLabel>
          {STATUS_ORDER.map((next, index) => (
            <DropdownMenuItem
              key={next}
              disabled={next === status}
              onSelect={() =>
                submit(
                  { cycleId, status: next },
                  {
                    successMessage: `Cycle moved to ${cycleStatusMeta[next]?.label ?? next}`,
                    onSuccess: () => router.refresh(),
                  },
                )
              }
            >
              <CalendarRange />
              <span className="flex-1">{cycleStatusMeta[next]?.label ?? next}</span>
              {index < currentIndex ? (
                <span className="text-[0.625rem] text-ink-4">back</span>
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              submitRecalc(
                { cycleId },
                {
                  successMessage: "Scores recalculated",
                  onSuccess: () => router.refresh(),
                },
              )
            }
            disabled={recalculating}
          >
            <RefreshCw />
            Recalculate scores
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ─────────────────────── Quick recalculate button ─────────────────────── */

export function RecalculateButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const { pending, submit } = useFormAction((input: { cycleId: string }) =>
    recalculateCycleScores(input.cycleId),
  );
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        submit(
          { cycleId },
          { successMessage: "Scores recalculated", onSuccess: () => router.refresh() },
        )
      }
    >
      <Wand2 className="size-3.5" /> Recalculate
    </Button>
  );
}
