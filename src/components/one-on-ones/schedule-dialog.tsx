"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPicker, type PersonOption } from "@/components/people/person-picker";
import { useFormAction } from "@/lib/client/hooks";
import { createOneOnOne } from "@/app/actions/one-on-ones";

const AGENDA_STARTERS = [
  "Wins since we last spoke",
  "Blockers and where I need help",
  "Growth and development",
  "Feedback — up, down and across",
];

function defaultSlot(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function ScheduleDialog({
  reports,
  defaultPerson,
  trigger,
}: {
  reports: PersonOption[];
  defaultPerson?: PersonOption;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(createOneOnOne);

  const [person, setPerson] = React.useState<PersonOption | null>(defaultPerson ?? null);
  const [scheduledAt, setScheduledAt] = React.useState(defaultSlot);
  const [duration, setDuration] = React.useState("30");
  const [agenda, setAgenda] = React.useState<string[]>(["", ""]);

  const reset = () => {
    setPerson(defaultPerson ?? null);
    setScheduledAt(defaultSlot());
    setDuration("30");
    setAgenda(["", ""]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person) return;
    submit(
      {
        employeeId: person.id,
        scheduledAt,
        durationMinutes: Number(duration),
        agenda: agenda.map((a) => a.trim()).filter(Boolean),
      },
      {
        successMessage: "1:1 scheduled",
        onSuccess: () => {
          setOpen(false);
          reset();
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="md">
            <CalendarPlus className="size-4" /> Schedule 1:1
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title="Schedule a 1:1"
        description="A short, recurring conversation beats a long, occasional one."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <Field label="Who are you meeting?" required error={fieldErrors.employeeId}>
            <PersonPicker
              value={person}
              onChange={setPerson}
              suggestions={reports}
              placeholder="Search your team or the directory"
              ariaLabel="Person to meet with"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date & time" required error={fieldErrors.scheduledAt}>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </Field>
            <Field label="Duration">
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[0.8125rem] font-medium text-ink-2">Agenda</span>
              <span className="text-[0.6875rem] text-ink-4">
                {agenda.filter((a) => a.trim()).length}/20 items
              </span>
            </div>
            <div className="space-y-2">
              {agenda.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-center text-[0.6875rem] tabular text-ink-4">
                    {index + 1}
                  </span>
                  <Input
                    value={item}
                    onChange={(e) =>
                      setAgenda((list) =>
                        list.map((value, i) => (i === index ? e.target.value : value)),
                      )
                    }
                    placeholder={
                      index === 0 ? "What would make this conversation useful?" : "Add a topic"
                    }
                    maxLength={400}
                    aria-label={`Agenda item ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setAgenda((list) =>
                        list.length === 1 ? [""] : list.filter((_, i) => i !== index),
                      )
                    }
                    aria-label="Remove agenda item"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            {agenda.length < 20 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => setAgenda((list) => [...list, ""])}
              >
                <Plus /> Add topic
              </Button>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AGENDA_STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() =>
                    setAgenda((list) => {
                      if (list.includes(starter) || list.filter((a) => a.trim()).length >= 20) {
                        return list;
                      }
                      const next = [...list];
                      const empty = next.findIndex((a) => !a.trim());
                      if (empty >= 0) next[empty] = starter;
                      else next.push(starter);
                      return next;
                    })
                  }
                  className="rounded-full border border-line bg-surface-1 px-2.5 py-1 text-[0.6875rem] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-1"
                >
                  + {starter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!person}>
              Schedule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
