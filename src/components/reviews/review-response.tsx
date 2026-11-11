"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Handshake, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/lib/client/hooks";
import { acknowledgeReview, returnReview } from "@/app/actions/reviews";

export function ReviewResponse({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const ack = useFormAction(acknowledgeReview);
  const ret = useFormAction(returnReview);
  const [comment, setComment] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [mode, setMode] = React.useState<"ack" | "return" | null>(null);

  const acknowledge = () => {
    ack.submit(
      { reviewId, comment: comment.trim() || undefined },
      {
        successMessage: "Review acknowledged",
        onSuccess: () => router.refresh(),
      },
    );
  };

  const sendBack = () => {
    if (reason.trim().length < 5) {
      setMode("return");
      return;
    }
    ret.submit(
      { reviewId, reason: reason.trim() },
      {
        successMessage: "Sent back to your manager",
        onSuccess: () => {
          setReason("");
          router.refresh();
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface-0/50 p-3">
        <p className="text-[0.8125rem] font-medium text-ink-1">
          This review is ready for you.
        </p>
        <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-3">
          Acknowledge it to complete the cycle, or add a comment and send it back if
          something needs to change.
        </p>
      </div>

      <Field label="Your comment" htmlFor="ack-comment" hint="Optional — stored with the review.">
        <Textarea
          id="ack-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Thanks — I'd like to discuss the development plan in our next 1:1."
          rows={3}
          maxLength={4000}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setMode((m) => (m === "return" ? null : "return"))}
          aria-expanded={mode === "return"}
        >
          <Undo2 className="size-3.5" /> Something to change?
        </Button>
        <Button type="button" onClick={acknowledge} loading={ack.pending} disabled={ret.pending}>
          <Handshake className="size-4" /> Acknowledge review
        </Button>
      </div>

      {mode === "return" ? (
        <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
          <Field
            label="What should change?"
            htmlFor="return-reason"
            required
            hint="Minimum 5 characters. Your manager gets a notification."
          >
            <Textarea
              id="return-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="The goals score looks inconsistent with the check-in history — can we review it together?"
              rows={3}
              maxLength={1000}
            />
          </Field>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={sendBack}
            loading={ret.pending}
            disabled={ack.pending}
          >
            Send back for revision
          </Button>
        </div>
      ) : null}
    </div>
  );
}
