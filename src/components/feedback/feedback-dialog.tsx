"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/primitives";
import { PersonPicker, type PersonOption } from "@/components/people/person-picker";
import { useFormAction } from "@/lib/client/hooks";
import { createFeedback } from "@/app/actions/feedback";

export function FeedbackDialog({
  people,
  competencies,
  defaultReceiver,
  trigger,
}: {
  people: PersonOption[];
  competencies: { id: string; name: string }[];
  defaultReceiver?: PersonOption;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, fieldErrors, submit, error } = useFormAction(createFeedback);

  const [receiver, setReceiver] = React.useState<PersonOption | null>(defaultReceiver ?? null);
  const [type, setType] = React.useState("PRAISE");
  const [visibility, setVisibility] = React.useState("MANAGER");
  const [competencyId, setCompetencyId] = React.useState("none");
  const [anonymous, setAnonymous] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiver) return;
    submit(
      {
        receiverId: receiver.id,
        type,
        visibility,
        message,
        competencyId: competencyId === "none" ? null : competencyId,
        isAnonymous: anonymous,
      },
      {
        successMessage: "Feedback shared",
        onSuccess: () => {
          setOpen(false);
          setMessage("");
          setAnonymous(false);
          if (!defaultReceiver) setReceiver(null);
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="md">
            <MessageSquareHeart className="size-4" /> Give feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title="Share feedback"
        description="Specific, timely feedback is the highest-leverage habit in a performance culture."
        size="lg"
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

          <Field label="Who is this for?" required error={fieldErrors.receiverId}>
            <PersonPicker
              value={receiver}
              onChange={setReceiver}
              suggestions={people}
              placeholder="Search a colleague"
              ariaLabel="Feedback recipient"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRAISE">Praise</SelectItem>
                  <SelectItem value="RECOGNITION">Recognition</SelectItem>
                  <SelectItem value="COACHING">Coaching</SelectItem>
                  <SelectItem value="CONSTRUCTIVE">Constructive</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Visibility" hint="Who else can see this note">
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Only the recipient</SelectItem>
                  <SelectItem value="MANAGER">Recipient and their manager</SelectItem>
                  <SelectItem value="TEAM">Recipient&apos;s team</SelectItem>
                  <SelectItem value="ORGANIZATION">Anyone in the organisation</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Message"
            htmlFor="feedback-message"
            required
            error={fieldErrors.message}
            hint="What did you observe, and what was the impact?"
          >
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="During the incident review, you kept the room focused on root cause instead of blame — the postmortem landed a day early."
              rows={5}
              minLength={10}
              maxLength={4000}
              required
            />
          </Field>

          <Field label="Link to a competency" hint="Optional — helps it surface in reviews">
            <Select value={competencyId} onValueChange={setCompetencyId}>
              <SelectTrigger>
                <SelectValue placeholder="No competency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No competency</SelectItem>
                {competencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-0/60 px-3 py-2.5">
            <span>
              <span className="block text-[0.8125rem] font-medium text-ink-1">
                Share anonymously
              </span>
              <span className="mt-0.5 block text-[0.6875rem] text-ink-3">
                Your name is hidden from the recipient, but retained in the audit trail.
              </span>
            </span>
            <Switch checked={anonymous} onCheckedChange={setAnonymous} aria-label="Anonymous" />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!receiver}>
              Share feedback
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
