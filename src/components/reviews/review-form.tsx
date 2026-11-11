"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { saveReview, submitReview } from "@/app/actions/reviews";

export type ReviewCompetency = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  weight: string;
  requiresComment: boolean;
  managerOnly: boolean;
  libraryDescription: string | null;
};

export type ReviewLevel = {
  value: number;
  label: string;
  description: string | null;
  color: string;
};

type RatingState = Record<string, { rating: number | null; comment: string }>;

export function ReviewForm({
  reviewId,
  reviewerType,
  items,
  levels,
  initialSummary,
  initialStrengths,
  initialDevelopment,
  initialOverallRating,
  initialRatings,
  subjectName,
  disabled = false,
}: {
  reviewId: string;
  reviewerType: string;
  items: ReviewCompetency[];
  levels: ReviewLevel[];
  initialSummary: string | null;
  initialStrengths: string | null;
  initialDevelopment: string | null;
  initialOverallRating: string | null;
  initialRatings: Record<string, { ratingValue: number | null; comment: string | null }>;
  subjectName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [mode, setMode] = React.useState<"draft" | "submit" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [summary, setSummary] = React.useState(initialSummary ?? "");
  const [strengths, setStrengths] = React.useState(initialStrengths ?? "");
  const [development, setDevelopment] = React.useState(initialDevelopment ?? "");
  const [overall, setOverall] = React.useState(
    initialOverallRating ? String(Math.round(Number(initialOverallRating))) : "none",
  );
  const [ratings, setRatings] = React.useState<RatingState>(() => {
    const out: RatingState = {};
    for (const item of items) {
      const existing = initialRatings[item.id];
      out[item.id] = {
        rating: existing?.ratingValue ?? null,
        comment: existing?.comment ?? "",
      };
    }
    return out;
  });

  const setRating = (id: string, value: number | null) =>
    setRatings((prev) => ({ ...prev, [id]: { ...prev[id]!, rating: value } }));

  const setComment = (id: string, value: string) =>
    setRatings((prev) => ({ ...prev, [id]: { ...prev[id]!, comment: value } }));

  const isSelf = reviewerType === "SELF";
  const scaleMax = levels.length ? Math.max(...levels.map((l) => l.value)) : 5;
  const scale = levels.length
    ? levels
    : Array.from({ length: scaleMax }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
        description: null,
        color: "#6f4bff",
      }));

  const payload = () => ({
    reviewId,
    summary: summary.trim() || undefined,
    strengths: strengths.trim() || undefined,
    development: development.trim() || undefined,
    overallRating: overall === "none" ? null : Number(overall),
    ratings: items.map((item) => ({
      templateCompetencyId: item.id,
      ratingValue: ratings[item.id]?.rating ?? null,
      comment: ratings[item.id]?.comment.trim() || null,
    })),
  });

  const handle = (nextMode: "draft" | "submit") => {
    setError(null);

    if (nextMode === "submit") {
      if (!isSelf && items.length > 0 && items.every((i) => ratings[i.id]?.rating == null)) {
        toast.error("Add at least one competency rating before submitting.");
        return;
      }
      const missing = items.find(
        (i) => i.requiresComment && !ratings[i.id]?.comment.trim(),
      );
      if (missing) {
        toast.error(`Add a comment for “${missing.name}”.`);
        return;
      }
    }

    setMode(nextMode);
    startTransition(async () => {
      try {
        const saved = await saveReview(payload());
        if (!saved.ok) {
          setError(saved.error);
          toast.error(saved.error);
          return;
        }

        if (nextMode === "submit") {
          const submitted = await submitReview(reviewId);
          if (!submitted.ok) {
            setError(submitted.error);
            toast.error(submitted.error);
            return;
          }
          toast.success("Review submitted");
          router.push("/reviews");
          router.refresh();
          return;
        }

        toast.success("Draft saved");
        router.refresh();
      } catch {
        const message = "Network error — your changes were not saved.";
        setError(message);
        toast.error(message);
      } finally {
        setMode(null);
      }
    });
  };

  if (disabled) {
    return (
      <div className="space-y-5">
        <ReadBlock title="Overall summary" value={initialSummary} />
        <ReadBlock title="Strengths" value={initialStrengths} />
        <ReadBlock title="Development areas" value={initialDevelopment} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[0.8125rem] text-rose-300"
        >
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-ink-1">Competencies</h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              {isSelf
                ? "Reflect on how you demonstrated each behaviour this cycle."
                : `Rate ${subjectName.split(" ")[0]} against each behaviour. Comments are encrypted at rest.`}
            </p>
          </div>
          <Badge tone="neutral">
            {items.filter((i) => ratings[i.id]?.rating != null).length}/{items.length} rated
          </Badge>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[0.8125rem] text-ink-3">
            This template has no competencies. You can still write a narrative review.
          </p>
        ) : null}

        <div className="space-y-3">
          {items.map((item, index) => {
            const current = ratings[item.id]!;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-line bg-surface-0/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink-1">
                      <span className="flex size-5 items-center justify-center rounded-md bg-surface-3 text-[0.625rem] tabular text-ink-3">
                        {index + 1}
                      </span>
                      {item.name}
                    </p>
                    <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-3">
                      {item.description ?? item.libraryDescription ?? "No description provided."}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="neutral">{item.category.toLowerCase()}</Badge>
                    <Badge tone="brand">weight {Number(item.weight).toFixed(0)}</Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {scale.map((level) => {
                    const active = current.rating === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setRating(item.id, active ? null : level.value)}
                        aria-pressed={active}
                        title={level.description ?? level.label}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-medium transition-all",
                          active
                            ? "border-brand-400/60 bg-brand-500/15 text-ink-1 shadow-[0_0_0_1px_rgba(111,75,255,0.3)]"
                            : "border-line bg-surface-1 text-ink-3 hover:border-line-strong hover:text-ink-1",
                        )}
                      >
                        {level.value} · {level.label}
                      </button>
                    );
                  })}
                  {current.rating != null ? (
                    <button
                      type="button"
                      onClick={() => setRating(item.id, null)}
                      className="rounded-lg px-2 py-1.5 text-[0.6875rem] text-ink-4 hover:text-ink-2"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="mt-3">
                  <Textarea
                    value={current.comment}
                    onChange={(e) => setComment(item.id, e.target.value)}
                    placeholder={
                      item.requiresComment
                        ? "Comment required — give a concrete example."
                        : "Optional: add a specific example or observation."
                    }
                    rows={2}
                    maxLength={4000}
                    aria-label={`Comment for ${item.name}`}
                  />
                  {item.requiresComment ? (
                    <p className="mt-1 text-[0.6875rem] text-amber-400">
                      A comment is required for this competency.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[0.9375rem] font-semibold text-ink-1">
            {isSelf ? "Your reflection" : "Narrative"}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">
            Write in specifics — outcomes, behaviours and what you&apos;d do differently.
          </p>
        </div>

        <Field label={isSelf ? "How did the cycle go?" : "Overall summary"} htmlFor="summary">
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={
              isSelf
                ? "The work I'm proudest of this cycle was…"
                : "Overall, this has been a strong cycle. Key outcomes include…"
            }
            rows={4}
            maxLength={6000}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Strengths" htmlFor="strengths">
            <Textarea
              id="strengths"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="What stood out — with examples."
              rows={4}
              maxLength={6000}
            />
          </Field>
          <Field label="Development areas" htmlFor="development">
            <Textarea
              id="development"
              value={development}
              onChange={(e) => setDevelopment(e.target.value)}
              placeholder="Where growth would unlock the next level."
              rows={4}
              maxLength={6000}
            />
          </Field>
        </div>

        <div className="max-w-xs">
          <Field
            label="Overall rating"
            hint={`Scale ${scale[0]?.value ?? 1}–${scaleMax}`}
          >
            <Select value={overall} onValueChange={setOverall}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No overall rating</SelectItem>
                {scale
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((level) => (
                    <SelectItem key={level.value} value={String(level.value)}>
                      {level.value} · {level.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface-1/95 px-4 py-3 shadow-xl backdrop-blur">
        <p className="flex items-center gap-1.5 text-[0.6875rem] text-ink-4">
          <Sparkles className="size-3.5 text-brand-300" />
          Drafts save encrypted. Submitting locks your narrative for the cycle.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handle("draft")}
            loading={pending && mode === "draft"}
            disabled={pending}
          >
            <CheckCircle2 className="size-4" /> Save draft
          </Button>
          <Button
            type="button"
            onClick={() => handle("submit")}
            loading={pending && mode === "submit"}
            disabled={pending}
          >
            <Send className="size-4" /> Submit review
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReadBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section>
      <h2 className="mb-1.5 text-[0.875rem] font-semibold text-ink-1">{title}</h2>
      <p className="whitespace-pre-line rounded-xl border border-line bg-surface-0/50 p-4 text-[0.8125rem] leading-relaxed text-ink-2">
        {value}
      </p>
    </section>
  );
}
