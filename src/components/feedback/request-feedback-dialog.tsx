"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { PersonPicker, type PersonOption } from "@/components/people/person-picker";
import { useFormAction } from "@/lib/client/hooks";
import { requestFeedback } from "@/app/actions/feedback";

export function RequestFeedbackDialog({
  people,
  trigger,
}: {
  people: PersonOption[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(requestFeedback);

  const [providers, setProviders] = React.useState<PersonOption[]>([]);
  const [message, setMessage] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  const add = (person: PersonOption | null) => {
    if (!person) return;
    setProviders((prev) =>
      prev.some((p) => p.id === person.id) || prev.length >= 10 ? prev : [...prev, person],
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (providers.length === 0) return;
    submit(
      {
        providerIds: providers.map((p) => p.id),
        message: message || undefined,
        dueDate: dueDate || undefined,
      },
      {
        successMessage: "Feedback requested",
        onSuccess: () => {
          setOpen(false);
          setProviders([]);
          setMessage("");
          setDueDate("");
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="md">
            <UserPlus className="size-4" /> Request feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title="Request feedback"
        description="Ask up to 10 colleagues for input. They'll get a notification with your note."
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300"
            >
              {error}
            </p>
          ) : null}

          <Field
            label="Colleagues"
            required
            error={fieldErrors.providerIds}
            hint={`${providers.length} of 10 selected`}
          >
            <PersonPicker
              value={null}
              onChange={add}
              suggestions={people}
              excludeIds={providers.map((p) => p.id)}
              placeholder="Add a colleague"
              ariaLabel="Add a colleague"
            />
            {providers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {providers.map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-1 pr-1.5"
                  >
                    <Avatar name={p.name} src={p.avatarUrl} size={18} />
                    <span className="text-[0.6875rem] text-ink-2">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => setProviders((prev) => prev.filter((x) => x.id !== p.id))}
                      className="rounded-full p-0.5 text-ink-4 hover:text-rose-400"
                      aria-label={`Remove ${p.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </Field>

          <Field
            label="What should they focus on?"
            htmlFor="request-message"
            hint="Optional — context makes feedback far more useful."
          >
            <Textarea
              id="request-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How did I handle the migration cutover? Specifically, what could I have done better in the first 48 hours?"
              rows={3}
              maxLength={1000}
            />
          </Field>

          <Field label="Respond by" hint="Optional deadline">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={providers.length === 0}>
              <Plus className="size-4" /> Send request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
