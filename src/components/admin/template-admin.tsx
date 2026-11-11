"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, ChevronDown, FilePlus2, Rocket, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/lib/client/hooks";
import { createTemplate, setTemplateStatus } from "@/app/actions/admin";
import { cn, templateStatusMeta } from "@/lib/utils";

export type CompetencyOption = {
  id: string;
  name: string;
  description: string | null;
  category: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  CORE: "Core",
  FUNCTIONAL: "Functional",
  LEADERSHIP: "Leadership",
  VALUES: "Values",
};

/* ───────────────────────────── Create template ────────────────────────── */

export function CreateTemplateDialog({
  competencies,
}: {
  competencies: CompetencyOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, submit, error, fieldErrors } = useFormAction(createTemplate);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, CompetencyOption[]>();
    for (const competency of competencies) {
      const list = map.get(competency.category);
      if (list) list.push(competency);
      else map.set(competency.category, [competency]);
    }
    return [...map.entries()];
  }, [competencies]);

  const toggle = (id: string) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      { name, description: description || undefined, competencyIds: selected },
      {
        successMessage: "Template created as a draft",
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
          setSelected([]);
          router.refresh();
        },
      },
    );
  };

  const allSelected = competencies.length > 0 && selected.length === competencies.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="md">
          <FilePlus2 className="size-4" /> New template
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Build a competency template"
        description="Templates define what every review scores. Start from the competency library, then publish when it is ready."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <Field label="Template name" htmlFor="template-name" required error={fieldErrors.name}>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Engineering Individual Contributor — FY26"
              maxLength={160}
              required
            />
          </Field>

          <Field label="Description" htmlFor="template-description">
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who this template is designed for and what it emphasises."
              rows={2}
              maxLength={2000}
            />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[0.8125rem] font-medium text-ink-2">
                Competencies <span className="text-rose-400">*</span>
              </p>
              <button
                type="button"
                onClick={() =>
                  setSelected(allSelected ? [] : competencies.map((c) => c.id))
                }
                className="text-[0.75rem] font-medium text-brand-300 hover:text-brand-200"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>

            {competencies.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong px-3 py-4 text-[0.8125rem] text-ink-3">
                The competency library is empty. Add competencies during seeding before building a
                template.
              </p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-line bg-surface-0/60 p-3">
                {grouped.map(([category, items]) => (
                  <div key={category}>
                    <p className="mb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-4">
                      {CATEGORY_LABELS[category] ?? category}
                    </p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {items.map((competency) => {
                        const checked = selected.includes(competency.id);
                        return (
                          <button
                            key={competency.id}
                            type="button"
                            onClick={() => toggle(competency.id)}
                            aria-pressed={checked}
                            className={cn(
                              "flex items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
                              checked
                                ? "border-brand-500/40 bg-brand-500/10"
                                : "border-transparent hover:bg-surface-2",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                                checked
                                  ? "border-brand-400 bg-brand-500 text-white"
                                  : "border-line-strong",
                              )}
                              aria-hidden
                            >
                              {checked ? <Check className="size-3" /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[0.8125rem] text-ink-1">
                                {competency.name}
                              </span>
                              {competency.description ? (
                                <span className="mt-0.5 block line-clamp-2 text-[0.625rem] leading-snug text-ink-4">
                                  {competency.description}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[0.75rem] text-ink-3">
              {selected.length} selected · weights are split equally and can be tuned later.
            </p>
            {fieldErrors.competencyIds ? (
              <p role="alert" className="mt-1 text-[0.75rem] font-medium text-rose-400">
                {fieldErrors.competencyIds}
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={selected.length === 0}>
              Create draft
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────── Status controls ────────────────────────── */

export function TemplateStatusMenu({
  templateId,
  status,
}: {
  templateId: string;
  status: string;
}) {
  const router = useRouter();
  const { pending, submit } = useFormAction(
    (input: { templateId: string; status: "DRAFT" | "PUBLISHED" | "RETIRED" }) =>
      setTemplateStatus(input.templateId, input.status),
  );
  const meta = templateStatusMeta[status] ?? templateStatusMeta.DRAFT!;

  const move = (next: "DRAFT" | "PUBLISHED" | "RETIRED") =>
    submit(
      { templateId, status: next },
      {
        successMessage:
          next === "PUBLISHED"
            ? "Template published"
            : next === "RETIRED"
              ? "Template retired"
              : "Template moved back to draft",
        onSuccess: () => router.refresh(),
      },
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" loading={pending} className="gap-1.5">
          <span className="flex items-center gap-1.5">
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
            <ChevronDown className="size-3.5 text-ink-3" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Template status</DropdownMenuLabel>
        <DropdownMenuItem disabled={status === "DRAFT"} onSelect={() => move("DRAFT")}>
          <Undo2 /> Move to draft
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={status === "PUBLISHED"}
          onSelect={() => move("PUBLISHED")}
        >
          <Rocket /> Publish
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          disabled={status === "RETIRED"}
          onSelect={() => move("RETIRED")}
        >
          <Archive /> Retire
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
