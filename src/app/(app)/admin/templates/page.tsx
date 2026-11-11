import { redirect } from "next/navigation";
import { BookOpen, Layers, Sparkles, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listCompetencies, listTemplatesWithCompetencies } from "@/lib/services/reviews";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import {
  CreateTemplateDialog,
  TemplateStatusMenu,
} from "@/components/admin/template-admin";
import { cn, formatDate, templateStatusMeta } from "@/lib/utils";

export const metadata = { title: "Review templates" };

const CATEGORY_LABELS: Record<string, string> = {
  CORE: "Core",
  FUNCTIONAL: "Functional",
  LEADERSHIP: "Leadership",
  VALUES: "Values",
};

const CATEGORY_TONE: Record<string, "brand" | "info" | "warning" | "positive"> = {
  CORE: "brand",
  FUNCTIONAL: "info",
  LEADERSHIP: "warning",
  VALUES: "positive",
};

export default async function AdminTemplatesPage() {
  const user = await requireUser();
  if (!can(user, "template:manage")) redirect("/forbidden");

  const [templates, competencies] = await Promise.all([
    listTemplatesWithCompetencies(),
    listCompetencies(),
  ]);

  const published = templates.filter((t) => t.status === "PUBLISHED").length;
  const coverage = new Set(templates.flatMap((t) => t.competencies.map((c) => c.name))).size;

  const byCategory = competencies.reduce<Record<string, number>>((acc, competency) => {
    acc[competency.category] = (acc[competency.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Review templates"
        description="The competency frameworks that every review is scored against. Publish a template to make it selectable when a cycle opens."
        actions={
          <CreateTemplateDialog
            competencies={competencies.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              category: c.category,
            }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Templates"
          value={templates.length}
          hint={`${published} published`}
          icon={<Layers />}
          tone="brand"
        />
        <Stat
          label="Published"
          value={published}
          hint="Ready for new cycles"
          icon={<Sparkles />}
          tone="positive"
        />
        <Stat
          label="Competency library"
          value={competencies.length}
          hint="Active competencies"
          icon={<BookOpen />}
          tone="info"
        />
        <Stat
          label="Unique in use"
          value={coverage}
          hint="Across all templates"
          icon={<Star />}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_19rem]">
        <div className="space-y-3">
          {templates.length === 0 ? (
            <EmptyState
              icon={<Layers />}
              title="No templates yet"
              description="Create a template from the competency library so cycles have a consistent scoring framework."
              className="py-16"
            />
          ) : (
            templates.map((template) => {
              const meta = templateStatusMeta[template.status] ?? templateStatusMeta.DRAFT!;
              const categoryGroups = template.competencies.reduce<
                Record<string, typeof template.competencies>
              >((acc, line) => {
                (acc[line.category] ??= []).push(line);
                return acc;
              }, {});

              return (
                <Card key={template.id}>
                  <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-[0.9375rem] font-semibold text-ink-1">
                            {template.name}
                          </h2>
                          <Badge tone="neutral">v{template.version}</Badge>
                          <Badge tone={meta.tone} dot>
                            {meta.label}
                          </Badge>
                        </div>
                        {template.description ? (
                          <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-3">
                            {template.description}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[0.6875rem] text-ink-4">
                          {template.competencyCount} competencies · created{" "}
                          {formatDate(template.createdAt)}
                        </p>
                      </div>
                      <TemplateStatusMenu templateId={template.id} status={template.status} />
                    </div>

                    {template.competencies.length === 0 ? (
                      <p className="text-[0.75rem] text-ink-4">
                        No competency lines attached yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(categoryGroups).map(([category, lines]) => (
                          <div key={category} className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "w-20 shrink-0 text-[0.625rem] font-semibold uppercase tracking-wider",
                                category === "CORE"
                                  ? "text-brand-300"
                                  : category === "FUNCTIONAL"
                                    ? "text-aqua-400"
                                    : category === "LEADERSHIP"
                                      ? "text-amber-400"
                                      : "text-mint-400",
                              )}
                            >
                              {CATEGORY_LABELS[category] ?? category}
                            </span>
                            {lines
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((line) => (
                                <Badge
                                  key={line.id}
                                  tone={CATEGORY_TONE[category] ?? "neutral"}
                                  className="font-medium"
                                >
                                  {line.name}
                                </Badge>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Competency library</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Reusable building blocks
                </p>
              </div>
              <BookOpen className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(CATEGORY_LABELS).map((category) => {
                const count = byCategory[category] ?? 0;
                const total = competencies.length || 1;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between text-[0.75rem]">
                      <span className="text-ink-2">{CATEGORY_LABELS[category]}</span>
                      <span className="tabular text-ink-4">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-aqua-400"
                        style={{ width: `${Math.round((count / total) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {competencies.length === 0 ? (
                <p className="pt-1 text-[0.75rem] text-ink-4">
                  Nothing seeded yet — add competencies to unlock templates.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                <span className="font-medium text-ink-2">Draft</span> templates can be attached to
                a cycle but are hidden from employees until published.
              </p>
              <p>
                <span className="font-medium text-ink-2">Published</span> templates are available
                for new cycles and cannot be edited destructively — create a new version instead.
              </p>
              <p>
                <span className="font-medium text-ink-2">Retired</span> templates stay attached to
                historical cycles but disappear from new-cycle pickers.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
