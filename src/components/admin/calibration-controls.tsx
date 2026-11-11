"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormAction } from "@/lib/client/hooks";
import { calibrateParticipant, recalculateCycleScores } from "@/app/actions/admin";

export type CalibrationTarget = {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  overallScore: string | null;
  proposedRating: string | null;
  finalRating: string | null;
  nineBoxPerformance: number | null;
  nineBoxPotential: number | null;
};

const PERFORMANCE_OPTIONS = [
  { value: "1", label: "1 · Needs improvement" },
  { value: "2", label: "2 · Solid performance" },
  { value: "3", label: "3 · Outstanding" },
];

const POTENTIAL_OPTIONS = [
  { value: "1", label: "1 · Steady" },
  { value: "2", label: "2 · Growth" },
  { value: "3", label: "3 · High potential" },
];

export function CalibrateDialog({
  participant,
  scaleMin = 1,
  scaleMax = 5,
}: {
  participant: CalibrationTarget;
  scaleMin?: number;
  scaleMax?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, submit, error, fieldErrors } = useFormAction(calibrateParticipant);

  const [finalRating, setFinalRating] = React.useState(
    participant.finalRating ?? participant.proposedRating ?? String(scaleMax),
  );
  const [performance, setPerformance] = React.useState(
    participant.nineBoxPerformance ? String(participant.nineBoxPerformance) : "0",
  );
  const [potential, setPotential] = React.useState(
    participant.nineBoxPotential ? String(participant.nineBoxPotential) : "0",
  );
  const [note, setNote] = React.useState("");

  const proposed = participant.proposedRating ? Number(participant.proposedRating) : null;
  const drift =
    proposed !== null && finalRating !== "" ? Number(finalRating) - proposed : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        participantId: participant.id,
        finalRating: Number(finalRating),
        nineBoxPerformance: performance === "0" ? null : Number(performance),
        nineBoxPotential: potential === "0" ? null : Number(potential),
        note: note || undefined,
      },
      {
        successMessage: `Calibrated ${participant.employeeName}`,
        onSuccess: () => {
          setOpen(false);
          setNote("");
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <SlidersHorizontal className="size-3.5" />
          {participant.finalRating ? "Adjust" : "Calibrate"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Calibrate ${participant.employeeName}`}
        description="Set the final rating and talent position. The change is recorded in the audit trail with your name against it."
        size="md"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-surface-0/60 p-3 text-center">
            <div>
              <p className="text-[0.5625rem] uppercase tracking-wider text-ink-4">Goals</p>
              <p className="tabular text-[0.9375rem] font-semibold text-ink-1">
                {participant.overallScore ? `${participant.overallScore}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.5625rem] uppercase tracking-wider text-ink-4">Proposed</p>
              <p className="tabular text-[0.9375rem] font-semibold text-ink-1">
                {participant.proposedRating ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[0.5625rem] uppercase tracking-wider text-ink-4">Drift</p>
              <p
                className={
                  drift === null
                    ? "tabular text-[0.9375rem] font-semibold text-ink-4"
                    : drift > 0
                      ? "tabular text-[0.9375rem] font-semibold text-mint-400"
                      : drift < 0
                        ? "tabular text-[0.9375rem] font-semibold text-rose-400"
                        : "tabular text-[0.9375rem] font-semibold text-ink-2"
                }
              >
                {drift === null
                  ? "—"
                  : `${drift > 0 ? "+" : ""}${drift.toFixed(1)}`}
              </p>
            </div>
          </div>

          <Field
            label="Final rating"
            htmlFor="final-rating"
            required
            hint={`Scale ${scaleMin}–${scaleMax}. Decimals allowed for a finer split.`}
            error={fieldErrors.finalRating}
          >
            <Input
              id="final-rating"
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={finalRating}
              onChange={(e) => setFinalRating(e.target.value)}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Performance">
              <Select value={performance} onValueChange={setPerformance}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Not set</SelectItem>
                  {PERFORMANCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Potential">
              <Select value={potential} onValueChange={setPotential}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Not set</SelectItem>
                  {POTENTIAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Calibration note"
            htmlFor="calibration-note"
            hint="Visible in the audit trail only — employees see the rating, not the deliberation."
          >
            <Textarea
              id="calibration-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this rating differs from the manager's proposal."
              maxLength={1000}
            />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Badge tone="neutral">
              {participant.departmentName ?? "No department"}
            </Badge>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save calibration
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecalculateCycleButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const { pending, submit, error } = useFormAction((input: { cycleId: string }) =>
    recalculateCycleScores(input.cycleId),
  );

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-[0.75rem] text-rose-400">{error}</span> : null}
      <Button
        size="sm"
        variant="outline"
        loading={pending}
        onClick={() =>
          submit(
            { cycleId },
            {
              successMessage: "Scores recalculated for the cohort",
              onSuccess: () => router.refresh(),
            },
          )
        }
      >
        <RefreshCw className="size-3.5" /> Recalculate scores
      </Button>
    </div>
  );
}
