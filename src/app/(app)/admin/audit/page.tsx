import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Clock,
  Filter,
  Fingerprint,
  Hash,
  Search,
  Shield,
  User,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import {
  auditActionFacets,
  auditTrailSummary,
  listAuditEvents,
  type AuditRow,
} from "@/lib/services/audit";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "Audit trail" };

const PAGE_SIZE = 40;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    actor?: string;
    entity?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  if (!can(user, "audit:read")) redirect("/forbidden");

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const actionFilter = params.action ?? "";
  const actorId = params.actor ?? "";
  const entityType = params.entity ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const [events, facets, summary] = await Promise.all([
    listAuditEvents({
      query: query || undefined,
      action: actionFilter || undefined,
      actorId: actorId || undefined,
      entityType: entityType || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    auditActionFacets(),
    auditTrailSummary(),
  ]);

  const totalPages = Math.max(1, Math.ceil(events.total / PAGE_SIZE));

  const buildHref = (patch: {
    q?: string;
    action?: string;
    actor?: string;
    entity?: string;
    page?: number;
  }) => {
    const next = new URLSearchParams();
    const q = patch.q ?? query;
    const action = patch.action ?? actionFilter;
    const actor = patch.actor ?? actorId;
    const entity = patch.entity ?? entityType;
    const p = patch.page ?? page;
    if (q) next.set("q", q);
    if (action) next.set("action", action);
    if (actor) next.set("actor", actor);
    if (entity) next.set("entity", entity);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  const activeFilters = [
    query ? { label: `Search “${query}”`, clear: buildHref({ q: "", page: 1 }) } : null,
    actionFilter
      ? { label: actionFilter, clear: buildHref({ action: "", page: 1 }) }
      : null,
    entityType
      ? { label: `Entity ${entityType}`, clear: buildHref({ entity: "", page: 1 }) }
      : null,
  ].filter(Boolean) as { label: string; clear: string }[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="An append-only, hash-chained record of every privileged action. Each entry links to the one before it — any gap or tampering breaks the chain."
        actions={
          <LinkButton href="/admin/audit" variant="outline" size="sm">
            <RefreshIcon />
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Total events"
          value={summary.total}
          hint={
            summary.firstAt
              ? `Since ${formatDateTime(summary.firstAt)}`
              : "Nothing recorded yet"
          }
          icon={<Activity />}
          tone="brand"
        />
        <Stat
          label="Last event"
          value={summary.lastAt ? relativeTime(summary.lastAt) : "—"}
          hint={summary.lastAt ? formatDateTime(summary.lastAt) : "No activity"}
          icon={<Clock />}
          tone="info"
        />
        <Stat
          label="Facets"
          value={facets.length}
          hint="Distinct actions in view"
          icon={<Filter />}
          tone="positive"
        />
        <Stat
          label="Filtered"
          value={events.total}
          hint={
            activeFilters.length
              ? `${activeFilters.length} filter${activeFilters.length === 1 ? "" : "s"} applied`
              : "Showing everything"
          }
          icon={<Search />}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <form action="/admin/audit" className="flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1">
                  <label className="mb-1 block text-[0.625rem] font-semibold uppercase tracking-wider text-ink-4">
                    Search
                  </label>
                  <Input
                    name="q"
                    defaultValue={query}
                    placeholder="Action, summary, actor email, entity id…"
                    aria-label="Search the audit trail"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.625rem] font-semibold uppercase tracking-wider text-ink-4">
                    Action
                  </label>
                  <select
                    name="action"
                    defaultValue={actionFilter}
                    className="h-9.5 rounded-[0.6rem] border border-line bg-surface-0 px-3 text-sm text-ink-2"
                    aria-label="Filter by action"
                  >
                    <option value="">All actions</option>
                    {facets.map((facet) => (
                      <option key={facet.action} value={facet.action}>
                        {facet.action}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[0.625rem] font-semibold uppercase tracking-wider text-ink-4">
                    Entity
                  </label>
                  <select
                    name="entity"
                    defaultValue={entityType}
                    className="h-9.5 rounded-[0.6rem] border border-line bg-surface-0 px-3 text-sm text-ink-2"
                    aria-label="Filter by entity type"
                  >
                    <option value="">All entities</option>
                    {[
                      ...new Set(events.rows.map((row) => row.entityType)),
                    ].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <input type="hidden" name="page" value="1" />
                <button
                  type="submit"
                  className="h-9.5 rounded-[0.6rem] border border-line-strong px-4 text-sm text-ink-2 hover:bg-surface-3"
                >
                  Apply
                </button>
              </form>

              {activeFilters.length ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {activeFilters.map((filter) => (
                    <Link
                      key={filter.label}
                      href={filter.clear}
                      className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-[0.6875rem] text-ink-2 hover:bg-surface-3"
                    >
                      {filter.label}
                      <XIcon />
                    </Link>
                  ))}
                  <Link
                    href="/admin/audit"
                    className="text-[0.6875rem] font-medium text-ink-4 hover:text-ink-1"
                  >
                    Clear all
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {events.rows.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Shield />}
                    title="No events match"
                    description="Loosen the filters or wait for the next privileged action to be recorded."
                    className="py-10"
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[62rem] text-left">
                    <thead>
                      <tr className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                        <th className="px-4 py-3 font-medium">When</th>
                        <th className="px-4 py-3 font-medium">Actor</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                        <th className="px-4 py-3 font-medium">Entity</th>
                        <th className="px-4 py-3 font-medium">Summary</th>
                        <th className="px-4 py-3 font-medium">Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {events.rows.map((row) => (
                        <AuditRowView key={row.id} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-[0.75rem] text-ink-4">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, events.total)} of {events.total}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <LinkButton href={buildHref({ page: page - 1 })} variant="outline" size="sm">
                    Previous
                  </LinkButton>
                ) : null}
                {page < totalPages ? (
                  <LinkButton href={buildHref({ page: page + 1 })} variant="outline" size="sm">
                    Next
                  </LinkButton>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Top actions</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">Last 24, by frequency</p>
              </div>
              <Activity className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-1.5">
              {facets.length === 0 ? (
                <p className="text-[0.75rem] text-ink-4">Nothing recorded yet.</p>
              ) : (
                facets.map((facet) => (
                  <Link
                    key={facet.action}
                    href={buildHref({ action: facet.action, page: 1 })}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[0.75rem] transition-colors",
                      actionFilter === facet.action
                        ? "bg-brand-500/12 text-brand-200"
                        : "text-ink-3 hover:bg-surface-2 hover:text-ink-1",
                    )}
                  >
                    <span className="min-w-0 truncate font-mono text-[0.6875rem]">
                      {facet.action}
                    </span>
                    <Badge tone="neutral">{facet.count}</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Chain head</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">Latest hash in the trail</p>
              </div>
              <Fingerprint className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              <p className="break-all font-mono text-[0.6875rem] leading-relaxed text-ink-2">
                {summary.lastHash ?? "—"}
              </p>
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-4">
                Verify integrity offline with{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.625rem] text-brand-300">
                  scripts/verify-audit-chain.ts
                </code>
                . Any tampering breaks the chain and the script exits non-zero.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Reading the trail</CardTitle>
              </div>
              <Shield className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                <span className="font-medium text-ink-2">Append-only.</span> Entries are never
                updated or deleted. Reversal is a new entry.
              </p>
              <p>
                <span className="font-medium text-ink-2">Hash chained.</span> Every entry stores a
                SHA-256 of its canonical payload plus the previous hash.
              </p>
              <p>
                <span className="font-medium text-ink-2">Privileged.</span> Only HR and admins can
                read the trail; employees never see it.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AuditRowView({ row }: { row: AuditRow }) {
  return (
    <tr className="align-top text-[0.8125rem]">
      <td className="px-4 py-2.5">
        <p className="tabular text-ink-2">{formatDateTime(row.occurredAt)}</p>
        <p className="text-[0.625rem] text-ink-4">{relativeTime(row.occurredAt)}</p>
      </td>
      <td className="px-4 py-2.5">
        {row.actorId ? (
          <Link href={`/people/${row.actorId}`} className="flex items-center gap-2">
            <Avatar name={row.actorName ?? row.actorEmail ?? "Unknown"} size={24} />
            <span className="min-w-0">
              <span className="block truncate text-ink-1 hover:text-brand-200">
                {row.actorName ?? row.actorEmail ?? "Unknown"}
              </span>
              <span className="block truncate text-[0.625rem] text-ink-4">
                {row.actorRole ?? "—"}
              </span>
            </span>
          </Link>
        ) : (
          <span className="text-ink-4">System</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Badge tone="brand" className="font-mono text-[0.625rem]">
          {row.action}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-ink-3">
        <p className="text-[0.75rem]">{row.entityType}</p>
        {row.entityId ? (
          <p className="font-mono text-[0.625rem] text-ink-4">
            {row.entityId.slice(0, 12)}
          </p>
        ) : null}
        {row.targetUserId ? (
          <Link
            href={`/people/${row.targetUserId}`}
            className="text-[0.625rem] text-brand-300 hover:text-brand-200"
          >
            target →
          </Link>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        <p className="text-ink-2">{row.summary ?? "—"}</p>
        {row.metadata ? (
          <p className="mt-0.5 line-clamp-1 font-mono text-[0.625rem] text-ink-4">
            {JSON.stringify(row.metadata)}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        <span className="font-mono text-[0.625rem] text-ink-4" title={row.hash}>
          {row.hash.slice(0, 10)}…
        </span>
      </td>
    </tr>
  );
}

function RefreshIcon() {
  return <Activity className="size-4" />;
}

function XIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 3l6 6M9 3l-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
