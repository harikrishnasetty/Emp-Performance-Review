"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "lucide-react";
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
import { checkInGoal } from "@/app/actions/goals";

export function CheckInDialog({
  goalId,
  currentValue,
  metricType,
  startValue,
  targetValue,
  unit,
  status,
  confidence,
}: {
  goalId: string;
  currentValue: string;
  metricType: string;
  startValue: string;
  targetValue: string;
  unit: string | null;
  status: string;
  confidence: string;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(checkInGoal);

  const [value, setValue] = React.useState(currentValue);
  const [nextStatus, setNextStatus] = React.useState(status);
  const [nextConfidence, setNextConfidence] = React.useState(confidence);
  const [note, setNote] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        goalId,
        currentValue: Number(value),
        status: nextStatus,
        confidence: nextConfidence,
        note: note || undefined,
      },
      {
        successMessage: "Check-in logged",
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
        <Button size="md">
          <Gauge className="size-4" /> Log check-in
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Log a progress check-in"
        description="Check-ins build the history your review is scored against."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-surface-0/60 px-3 py-2.5 text-[0.75rem] text-ink-3">
            <p className="mb-1 flex items-center justify-between">
              <span>Target</span>
              <span className="tabular text-ink-1">
                {startValue} → {targetValue} {unit ?? ""}
              </span>
            </p>
            <p className="text-[0.6875rem] text-ink-4">
              Metric: {metricType.toLowerCase()} · progress recalculates automatically.
            </p>
          </div>

          <Field
            label="Current value"
            htmlFor="current-value"
            required
            error={fieldErrors.currentValue}
          >
            <Input
              id="current-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Not started</SelectItem>
                  <SelectItem value="ON_TRACK">On track</SelectItem>
                  <SelectItem value="AT_RISK">At risk</SelectItem>
                  <SelectItem value="OFF_TRACK">Off track</SelectItem>
                  <SelectItem value="ACHIEVED">Achieved</SelectItem>
                  <SelectItem value="MISSED">Missed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Confidence">
              <Select value={nextConfidence} onValueChange={setNextConfidence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ON_TRACK">On track</SelectItem>
                  <SelectItem value="NEEDS_ATTENTION">Needs attention</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="What changed?"
            htmlFor="note"
            hint="Encrypted at rest. Visible to you and your manager."
          >
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shipped the ingest pipeline; latency down 32% this sprint."
              rows={3}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save check-in
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
