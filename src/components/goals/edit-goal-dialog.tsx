"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
import { updateGoal } from "@/app/actions/goals";

/**
 * Editing a goal is only possible before it is sent for approval, or after a
 * manager sends it back. The server enforces the same rule; this dialog is the
 * affordance that makes the "sent back → fix → resubmit" loop usable.
 */
export function EditGoalDialog({
  goal,
}: {
  goal: {
    id: string;
    title: string;
    description: string | null;
    weight: string;
    priority: string;
    visibility: string;
    dueDate: string | null;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(updateGoal);

  const [form, setForm] = React.useState({
    title: goal.title,
    description: goal.description ?? "",
    weight: String(Number(goal.weight)),
    priority: goal.priority,
    visibility: goal.visibility,
    dueDate: goal.dueDate ?? "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onOpenChange = (next: boolean) => {
    if (next) {
      setForm({
        title: goal.title,
        description: goal.description ?? "",
        weight: String(Number(goal.weight)),
        priority: goal.priority,
        visibility: goal.visibility,
        dueDate: goal.dueDate ?? "",
      });
    }
    setOpen(next);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit(
      {
        goalId: goal.id,
        title: form.title,
        description: form.description.trim() || null,
        weight: Number(form.weight),
        priority: form.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        visibility: form.visibility as "PRIVATE" | "MANAGER" | "TEAM" | "ORGANIZATION",
        dueDate: form.dueDate || null,
      },
      {
        successMessage: "Goal updated",
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="md" variant="outline">
          <Pencil className="size-4" /> Edit goal
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Edit goal"
        description="Sharpen the target before you send it back to your manager."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <Field label="Goal title" htmlFor="edit-title" required error={fieldErrors.title}>
            <Input
              id="edit-title"
              value={form.title}
              onChange={(event) => set("title")(event.target.value)}
              maxLength={240}
              required
            />
          </Field>

          <Field label="Why it matters" htmlFor="edit-description" error={fieldErrors.description}>
            <Textarea
              id="edit-description"
              value={form.description}
              onChange={(event) => set("description")(event.target.value)}
              rows={3}
              maxLength={4000}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Weight" htmlFor="edit-weight" error={fieldErrors.weight}>
              <Input
                id="edit-weight"
                type="number"
                min={1}
                max={100}
                step="1"
                value={form.weight}
                onChange={(event) => set("weight")(event.target.value)}
                required
              />
            </Field>

            <Field label="Due date" htmlFor="edit-due-date" error={fieldErrors.dueDate}>
              <Input
                id="edit-due-date"
                type="date"
                value={form.dueDate}
                onChange={(event) => set("dueDate")(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
