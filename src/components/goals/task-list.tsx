"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/lib/client/hooks";
import { createTask, setTaskStatus } from "@/app/actions/goals";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/lib/db/schema";

const STATUS_CYCLE: Record<string, "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE"> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  BLOCKED: "IN_PROGRESS",
  DONE: "TODO",
  CANCELLED: "TODO",
};

export function TaskList({ goalId, tasks }: { goalId: string; tasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const create = useFormAction(createTask);
  const update = useFormAction(
    async (input: { taskId: string; status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" }) =>
      setTaskStatus(input.taskId, input.status),
  );

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.submit(
      { goalId, title: title.trim(), priority: "MEDIUM" },
      {
        successMessage: "Task added",
        onSuccess: () => {
          setTitle("");
          router.refresh();
        },
      },
    );
  };

  const toggle = (task: Task) => {
    const next = STATUS_CYCLE[task.status] ?? "DONE";
    update.submit(
      { taskId: task.id, status: next },
      { onSuccess: () => router.refresh() },
    );
  };

  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <p className="py-4 text-[0.8125rem] text-ink-3">
          Break the goal into concrete tasks so progress is easy to report.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => {
            const done = task.status === "DONE";
            return (
              <li
                key={task.id}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-0/50 px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => toggle(task)}
                  className="shrink-0 text-ink-4 transition-colors hover:text-brand-300"
                  aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                >
                  {task.status === "IN_PROGRESS" ? (
                    <Loader2 className="size-4 animate-spin text-amber-400" />
                  ) : done ? (
                    <CheckCircle2 className="size-4 text-mint-400" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[0.8125rem]",
                    done ? "text-ink-4 line-through" : "text-ink-2",
                  )}
                >
                  {task.title}
                </span>
                {task.dueDate ? (
                  <span className="shrink-0 text-[0.625rem] text-ink-4">
                    {formatDate(task.dueDate, { day: "2-digit", month: "short" })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={add} className="flex gap-2 pt-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          maxLength={240}
          className="h-8.5 text-[0.8125rem]"
          aria-label="New task title"
        />
        <Button type="submit" size="sm" variant="secondary" loading={create.pending}>
          <Plus className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
