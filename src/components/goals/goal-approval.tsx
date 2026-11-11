"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/lib/client/hooks";
import {
  approveGoal,
  returnGoal,
  submitGoalsForApproval,
} from "@/app/actions/goals";

/**
 * Step 1 of the review process: send draft goals to the manager for sign-off.
 * The action is idempotent-ish — it picks up everything still in DRAFT or
 * RETURNED, so the button can live on both the list and the detail page.
 */
export function SubmitGoalsButton({
  goalIds,
  count,
  label,
  size = "md",
  variant = "secondary",
  blocked,
  blockedHint,
}: {
  goalIds?: string[];
  count: number;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** When set, the button is disabled — used for the "weights must total 100%" gate. */
  blocked?: boolean;
  blockedHint?: string;
}) {
  const router = useRouter();
  const { pending, submit } = useFormAction(submitGoalsForApproval);

  if (blocked) {
    return (
      <Button
        size={size}
        variant={variant}
        disabled
        title={blockedHint ?? "The weights for your cycle goals must add up to 100%."}
      >
        <Send className="size-4" />
        {blockedHint ?? "Weights must total 100%"}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      loading={pending}
      onClick={() =>
        submit(
          { goalIds },
          {
            onSuccess: (data) => {
              if (data.autoApproved > 0 && data.submitted === 0) {
                // No manager on record: the action approves the goals itself.
                toast.success(
                  `${data.autoApproved} goal${data.autoApproved === 1 ? "" : "s"} approved — you have no manager on record.`,
                );
              } else {
                toast.success(
                  `${data.submitted} goal${data.submitted === 1 ? "" : "s"} sent to your manager.`,
                );
              }
              router.refresh();
            },
          },
        )
      }
    >
      <Send className="size-4" />
      {label ?? `Send ${count} goal${count === 1 ? "" : "s"} for approval`}
    </Button>
  );
}

/** Step 2: the manager approves goals or sends them back with a reason. */
export function GoalApprovalActions({ goalId }: { goalId: string }) {
  const router = useRouter();
  const approve = useFormAction(approveGoal);
  const returnForRevision = useFormAction(returnGoal);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const onReturn = (event: React.FormEvent) => {
    event.preventDefault();
    returnForRevision.submit(
      { goalId, reason },
      {
        successMessage: "Goal sent back for revision",
        onSuccess: () => {
          setOpen(false);
          setReason("");
          router.refresh();
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        loading={approve.pending}
        disabled={returnForRevision.pending}
        onClick={() =>
          approve.submit(
            { goalId },
            {
              successMessage: "Goal approved",
              onSuccess: () => router.refresh(),
            },
          )
        }
      >
        <Check className="size-4" /> Approve
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={approve.pending}>
            <Undo2 className="size-4" /> Send back
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Send this goal back"
          description="Tell the owner what needs to change before they resubmit."
        >
          <form onSubmit={onReturn} className="space-y-4">
            {returnForRevision.error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
                {returnForRevision.error}
              </p>
            ) : null}

            <Field
              label="What needs to change?"
              htmlFor="return-reason"
              required
              error={returnForRevision.fieldErrors.reason}
            >
              <Textarea
                id="return-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Make the target measurable — for example “cut p95 latency from 480 ms to 320 ms”."
                rows={3}
                maxLength={1000}
                required
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={returnForRevision.pending}>
                Send back
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
