"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Loader2, Plus, Save, Smile, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useFormAction } from "@/lib/client/hooks";
import { addActionItem, toggleActionItem, updateOneOnOne } from "@/app/actions/one-on-ones";
import { cn, formatDate } from "@/lib/utils";

export type AgendaItem = { id: string; text: string; done: boolean };

export type MeetingActionItem = {
  id: string;
  description: string;
  status: string;
  dueDate: string | null;
  ownerId: string | null;
};

const MOODS = [
  { value: 1, label: "Heavy", tone: "text-rose-400" },
  { value: 2, label: "Tough", tone: "text-amber-400" },
  { value: 3, label: "Steady", tone: "text-ink-2" },
  { value: 4, label: "Good", tone: "text-aqua-400" },
  { value: 5, label: "Great", tone: "text-mint-400" },
];

export function MeetingWorkspace({
  meeting,
  actionItems,
  viewerId,
  counterpartId,
}: {
  meeting: {
    id: string;
    status: string;
    agenda: AgendaItem[];
    notes: string | null;
    mood: number | null;
  };
  actionItems: MeetingActionItem[];
  viewerId: string;
  counterpartId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [agenda, setAgenda] = React.useState<AgendaItem[]>(meeting.agenda ?? []);
  const [notes, setNotes] = React.useState(meeting.notes ?? "");
  const [savedNotes, setSavedNotes] = React.useState(meeting.notes ?? "");
  const [mood, setMood] = React.useState<number | null>(meeting.mood);
  const [saving, setSaving] = React.useState(false);

  const runUpdate = React.useCallback(
    (patch: Parameters<typeof updateOneOnOne>[0], onDone?: () => void) => {
      startTransition(async () => {
        const result = await updateOneOnOne(patch);
        if (result.ok) {
          onDone?.();
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    },
    [router],
  );

  const toggleAgenda = (item: AgendaItem) => {
    const next = agenda.map((a) => (a.id === item.id ? { ...a, done: !a.done } : a));
    setAgenda(next);
    runUpdate({ meetingId: meeting.id, agenda: next });
  };

  const saveNotes = () => {
    if (notes === savedNotes) return;
    setSaving(true);
    startTransition(async () => {
      const result = await updateOneOnOne({ meetingId: meeting.id, notes });
      setSaving(false);
      if (result.ok) {
        setSavedNotes(notes);
        toast.success("Notes saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Keyboard-first: ⌘/Ctrl + S saves without leaving the textarea.
  const saveRef = React.useRef(saveNotes);
  saveRef.current = saveNotes;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setMoodValue = (value: number) => {
    const next = mood === value ? null : value;
    setMood(next);
    runUpdate({ meetingId: meeting.id, mood: next });
  };

  const complete = () => {
    startTransition(async () => {
      const result = await updateOneOnOne({ meetingId: meeting.id, status: "COMPLETED" });
      if (result.ok) {
        toast.success("1:1 marked complete");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const doneCount = agenda.filter((a) => a.done).length;
  const dirty = notes !== savedNotes;

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink-1">Agenda</h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              {agenda.length === 0
                ? "Nothing on the agenda yet."
                : `${doneCount} of ${agenda.length} covered`}
            </p>
          </div>
          <Sparkles className="size-4 text-ink-3" />
        </div>

        {agenda.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-[0.8125rem] text-ink-3">
            Add topics when you schedule the meeting, or capture them in notes below.
          </p>
        ) : (
          <ul className="space-y-1">
            {agenda.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggleAgenda(item)}
                  disabled={pending}
                  className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
                >
                  <span
                    className={cn(
                      "mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      item.done
                        ? "border-mint-400 bg-mint-500/20 text-mint-400"
                        : "border-line-strong text-transparent group-hover:border-brand-400",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3" />
                  </span>
                  <span
                    className={cn(
                      "text-[0.8125rem] leading-relaxed",
                      item.done ? "text-ink-4 line-through" : "text-ink-2",
                    )}
                  >
                    {item.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink-1">
              Shared notes
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              Encrypted at rest. Visible only to the two of you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving || pending ? (
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-ink-4">
                <Loader2 className="size-3 animate-spin" /> Saving
              </span>
            ) : dirty ? (
              <Badge tone="warning">Unsaved</Badge>
            ) : savedNotes ? (
              <span className="flex items-center gap-1.5 text-[0.6875rem] text-mint-400">
                <CheckCheck className="size-3" /> Saved
              </span>
            ) : null}
            <Button size="sm" variant="secondary" onClick={saveNotes} disabled={!dirty || pending}>
              <Save className="size-3.5" /> Save
            </Button>
          </div>
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={10}
          maxLength={20000}
          placeholder={
            "What did we agree?\n\n• Context I should remember\n• Decisions and owners\n• What I committed to before next time"
          }
          className="min-h-52 font-[inherit] text-[0.8125rem]"
          aria-label="Meeting notes"
        />
        <p className="mt-1.5 text-[0.625rem] text-ink-4">
          {notes.length.toLocaleString()}/20,000 characters · ⌘S / Ctrl+S to save
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink-1">
                How did it feel?
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                A private signal for trends — never shown as a score.
              </p>
            </div>
            <Smile className="size-4 text-ink-3" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMoodValue(option.value)}
                disabled={pending}
                aria-pressed={mood === option.value}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.75rem] font-medium transition-colors disabled:opacity-60",
                  mood === option.value
                    ? "border-brand-500/50 bg-brand-500/15 text-brand-200"
                    : "border-line bg-surface-1 text-ink-3 hover:border-line-strong hover:text-ink-1",
                )}
              >
                <span className={cn("size-1.5 rounded-full bg-current", option.tone)} />
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel flex flex-col justify-between gap-3 p-5 sm:w-56">
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink-1">Wrap up</h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              {meeting.status === "COMPLETED"
                ? "This conversation is closed."
                : "Close the loop when you've covered everything."}
            </p>
          </div>
          {meeting.status === "COMPLETED" ? (
            <Badge tone="positive" dot>
              Completed
            </Badge>
          ) : (
            <Button variant="success" onClick={complete} loading={pending}>
              <CheckCheck className="size-4" /> Mark complete
            </Button>
          )}
        </section>
      </div>

      <ActionItems
        meetingId={meeting.id}
        items={actionItems}
        viewerId={viewerId}
        counterpartId={counterpartId}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

/* ───────────────────────── Action items ───────────────────────── */

function ActionItems({
  meetingId,
  items,
  viewerId,
  counterpartId,
  onChanged,
}: {
  meetingId: string;
  items: MeetingActionItem[];
  viewerId: string;
  counterpartId: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const { pending: adding, submit, error } = useFormAction(addActionItem);
  const [description, setDescription] = React.useState("");
  const [owner, setOwner] = React.useState<"me" | "them">("me");
  const [dueDate, setDueDate] = React.useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    submit(
      {
        meetingId,
        description: description.trim(),
        ownerId: owner === "me" ? viewerId : counterpartId,
        dueDate: dueDate || undefined,
      },
      {
        successMessage: "Action item added",
        onSuccess: () => {
          setDescription("");
          setDueDate("");
          router.refresh();
        },
      },
    );
  };

  const toggle = (item: MeetingActionItem) => {
    startTransition(async () => {
      const result = await toggleActionItem({ id: item.id, done: item.status !== "DONE" });
      if (result.ok) onChanged();
      else toast.error(result.error);
    });
  };

  const open = items.filter((i) => i.status !== "DONE").length;

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink-1">
            Action items
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">
            {items.length === 0
              ? "Commitments made in the meeting surface here and on your dashboard."
              : `${open} open · ${items.length - open} done`}
          </p>
        </div>
        <Badge tone={open > 0 ? "warning" : "positive"}>{open} open</Badge>
      </div>

      {items.length > 0 ? (
        <ul className="mb-4 space-y-1">
          {items.map((item) => {
            const done = item.status === "DONE";
            return (
              <li key={item.id}>
                <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-0/50 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    disabled={pending}
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      done
                        ? "border-mint-400 bg-mint-500/20 text-mint-400"
                        : "border-line-strong text-transparent hover:border-brand-400",
                    )}
                    aria-label={done ? "Reopen action item" : "Complete action item"}
                  >
                    <Check className="size-3" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[0.8125rem]",
                        done ? "text-ink-4 line-through" : "text-ink-2",
                      )}
                    >
                      {item.description}
                    </p>
                    {item.dueDate ? (
                      <p className="text-[0.625rem] text-ink-4">
                        Due {formatDate(item.dueDate, { day: "2-digit", month: "short" })}
                      </p>
                    ) : null}
                  </div>
                  {item.ownerId === viewerId ? (
                    <Badge tone="neutral">you</Badge>
                  ) : (
                    <Badge tone="neutral">them</Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.75rem] text-rose-300">
          {error}
        </p>
      ) : null}

      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_9rem_9.5rem_auto]">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a follow-up…"
          maxLength={400}
          aria-label="Action item description"
        />
        <Select value={owner} onValueChange={(v) => setOwner(v as "me" | "them")}>
          <SelectTrigger aria-label="Owner">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="me">Mine</SelectItem>
            <SelectItem value="them">Theirs</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
        />
        <Button type="submit" loading={adding} disabled={!description.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>
    </section>
  );
}
