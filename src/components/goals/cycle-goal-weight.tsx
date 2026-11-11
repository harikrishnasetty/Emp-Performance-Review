"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useFormAction } from "@/lib/client/hooks";
import { updateGoal } from "@/app/actions/goals";

/**
 * Inline weight editor for the review-cycle goals form — the "% of total score"
 * column from the performance review PDF. Edits run through `updateGoal`,
 * which rejects any change that would push the cycle total past 100%.
 */
export function CycleGoalWeightEditor({
  goalId,
  initialWeight,
  locked,
}: {
  goalId: string;
  initialWeight: number;
  /** Goals already sent for approval are read-only. */
  locked: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(String(initialWeight));
  const { pending, submit } = useFormAction(updateGoal);
  const dirty = Number(value) !== initialWeight;

  const save = () => {
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight < 1 || weight > 100) {
      setValue(String(initialWeight));
      return;
    }
    if (weight === initialWeight) return;
    submit(
      { goalId, weight },
      {
        successMessage: `Weight set to ${weight}%`,
        onSuccess: () => router.refresh(),
        onError: () => setValue(String(initialWeight)),
      },
    );
  };

  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-3">
        <Lock className="size-3 text-ink-4" />
        <span className="tabular font-medium text-ink-2">{initialWeight}%</span> of total score
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={100}
        step={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
        disabled={pending}
        aria-label="Goal weight (% of total score)"
        className="h-8 w-16 rounded-lg border border-line bg-surface-1 px-2 text-right text-[0.8125rem] tabular text-ink-1 outline-none transition-colors focus:border-brand-500/50"
      />
      <span className="text-[0.75rem] text-ink-3">% of total score</span>
      {dirty && !pending ? (
        <span className="text-[0.6875rem] text-amber-400">press Enter</span>
      ) : null}
    </span>
  );
}
