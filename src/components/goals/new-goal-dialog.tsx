"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createGoal } from "@/app/actions/goals";

export function NewGoalDialog({
  cycles,
}: {
  cycles: { id: string; name: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(createGoal);

  const [form, setForm] = React.useState({
    title: "",
    description: "",
    category: "BUSINESS",
    metricType: "PERCENT",
    startValue: "0",
    targetValue: "100",
    unit: "",
    weight: "20",
    priority: "MEDIUM",
    visibility: "MANAGER",
    startDate: "",
    dueDate: "",
    cycleId: cycles[0]?.id ?? "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        ...form,
        startValue: Number(form.startValue),
        targetValue: Number(form.targetValue),
        weight: Number(form.weight),
        cycleId: form.cycleId === "none" ? null : form.cycleId || null,
      },
      {
        successMessage: "Goal created",
        onSuccess: () => {
          setOpen(false);
          setForm((f) => ({ ...f, title: "", description: "" }));
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="md">
          <Plus className="size-4" /> New goal
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Create a goal"
        description="Well-scoped goals have a measurable target and a realistic due date."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <Field label="Goal title" htmlFor="title" required error={fieldErrors.title}>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Reduce incident MTTR to under 45 minutes"
              maxLength={240}
              required
            />
          </Field>

          <Field label="Why it matters" htmlFor="description" error={fieldErrors.description}>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Describe the outcome and how success will be measured."
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUSINESS">Business</SelectItem>
                  <SelectItem value="OKR">OKR</SelectItem>
                  <SelectItem value="DEVELOPMENT">Development</SelectItem>
                  <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                  <SelectItem value="PEOPLE">People</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority">
              <Select value={form.priority} onValueChange={set("priority")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Metric">
              <Select value={form.metricType} onValueChange={set("metricType")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                  <SelectItem value="NUMERIC">Numeric</SelectItem>
                  <SelectItem value="CURRENCY">Currency</SelectItem>
                  <SelectItem value="BOOLEAN">Yes / No</SelectItem>
                  <SelectItem value="MILESTONE">Milestone</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start value" error={fieldErrors.startValue}>
              <Input
                type="number"
                step="any"
                value={form.startValue}
                onChange={(e) => set("startValue")(e.target.value)}
              />
            </Field>
            <Field label="Target value" error={fieldErrors.targetValue}>
              <Input
                type="number"
                step="any"
                value={form.targetValue}
                onChange={(e) => set("targetValue")(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unit" hint="e.g. %, tickets, days">
              <Input
                value={form.unit}
                onChange={(e) => set("unit")(e.target.value)}
                maxLength={24}
              />
            </Field>
            <Field label="Weight" hint="Share of total goal score">
              <Input
                type="number"
                min={1}
                max={100}
                value={form.weight}
                onChange={(e) => set("weight")(e.target.value)}
              />
            </Field>
            <Field label="Cycle">
              <Select value={form.cycleId} onValueChange={set("cycleId")}>
                <SelectTrigger>
                  <SelectValue placeholder="No cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No cycle</SelectItem>
                  {cycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Start date">
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate")(e.target.value)}
              />
            </Field>
            <Field label="Due date" error={fieldErrors.dueDate}>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate")(e.target.value)}
              />
            </Field>
            <Field label="Visibility">
              <Select value={form.visibility} onValueChange={set("visibility")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Only me</SelectItem>
                  <SelectItem value="MANAGER">Me and my manager</SelectItem>
                  <SelectItem value="TEAM">My team</SelectItem>
                  <SelectItem value="ORGANIZATION">Everyone</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create goal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
