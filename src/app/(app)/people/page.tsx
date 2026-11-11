import Link from "next/link";
import { Building2, MapPin, Search, Users, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listDepartments, listDirectory } from "@/lib/services/people";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

export const metadata = { title: "People" };

const PAGE_SIZE = 48;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const departmentId = params.dept ?? "";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const [departments, directory] = await Promise.all([
    listDepartments(),
    listDirectory({
      query: query || undefined,
      departmentId: departmentId || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const activeDepartment = departments.find((d) => d.id === departmentId);
  const totalPages = Math.max(1, Math.ceil(directory.total / PAGE_SIZE));

  const buildHref = (patch: { q?: string; dept?: string; page?: number }) => {
    const next = new URLSearchParams();
    const q = patch.q ?? query;
    const dept = patch.dept ?? departmentId;
    const p = patch.page ?? page;
    if (q) next.set("q", q);
    if (dept) next.set("dept", dept);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/people?${qs}` : "/people";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="People directory"
        description="Find a colleague, understand the shape of the org, and see how work connects."
        actions={
          <LinkButton href="/team" variant="outline" size="md">
            <Users className="size-4" /> My team
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="People"
          value={directory.total}
          hint={query ? "Matching your search" : "Active directory"}
          icon={<Users />}
          tone="brand"
        />
        <Stat
          label="Departments"
          value={departments.length}
          hint={activeDepartment ? activeDepartment.name : "Across the org"}
          icon={<Building2 />}
          tone="info"
        />
        <Stat
          label="Viewing"
          value={activeDepartment ? activeDepartment.name : "Everyone"}
          hint={activeDepartment ? "Filtered department" : "No filter applied"}
          icon={<MapPin />}
          tone="positive"
        />
        <Stat
          label="Page"
          value={`${page} / ${totalPages}`}
          hint={query ? `Results for “${query}”` : "Sorted alphabetically"}
          icon={<Search />}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Find someone</CardTitle>
              <Search className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              <form action="/people" className="space-y-2">
                {departmentId ? <input type="hidden" name="dept" value={departmentId} /> : null}
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="Name, email or role"
                  aria-label="Search the directory"
                />
                <Button type="submit" size="sm" className="w-full">
                  Search
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Departments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link
                href={buildHref({ dept: "", page: 1 })}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors",
                  !departmentId
                    ? "bg-brand-500/12 text-brand-200"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink-1",
                )}
              >
                <span>Everyone</span>
                <Badge tone="neutral">{directory.total}</Badge>
              </Link>
              {departments.map((dept) => (
                <Link
                  key={dept.id}
                  href={buildHref({ dept: dept.id, page: 1 })}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] transition-colors",
                    departmentId === dept.id
                      ? "bg-brand-500/12 text-brand-200"
                      : "text-ink-3 hover:bg-surface-2 hover:text-ink-1",
                  )}
                >
                  <span className="min-w-0 truncate">{dept.name}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.8125rem] text-ink-3">
              {query ? (
                <>
                  {directory.total} result{directory.total === 1 ? "" : "s"} for{" "}
                  <span className="font-medium text-ink-1">“{query}”</span>
                </>
              ) : (
                <>
                  {directory.total} people
                  {activeDepartment ? ` in ${activeDepartment.name}` : ""}
                </>
              )}
            </p>
            {query || departmentId ? (
              <Link
                href="/people"
                className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-3 hover:text-ink-1"
              >
                <X className="size-3.5" /> Clear filters
              </Link>
            ) : null}
          </div>

          {directory.rows.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No one matches that"
              description="Try a shorter name, an email prefix, or a different department."
              action={
                <LinkButton href="/people" variant="outline" size="sm">
                  Reset filters
                </LinkButton>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {directory.rows.map((person) => (
                <Link
                  key={person.id}
                  href={`/people/${person.id}`}
                  className="panel panel-hover group flex flex-col gap-3 p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={person.displayName} src={person.avatarUrl} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.875rem] font-semibold text-ink-1 group-hover:text-brand-200">
                        {person.displayName}
                      </p>
                      <p className="truncate text-[0.75rem] text-ink-3">
                        {person.jobTitle ?? "MetricStream"}
                      </p>
                    </div>
                    {person.systemRole !== "USER" ? (
                      <Badge tone={person.systemRole === "ADMIN" ? "danger" : "info"}>
                        {person.systemRole.toLowerCase()}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-ink-4">
                    {person.departmentName ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3" /> {person.departmentName}
                      </span>
                    ) : null}
                    {person.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {person.location}
                      </span>
                    ) : null}
                  </div>
                  {person.status !== "ACTIVE" ? (
                    <Badge tone={person.status === "INACTIVE" ? "neutral" : "warning"}>
                      {person.status.replaceAll("_", " ").toLowerCase()}
                    </Badge>
                  ) : null}
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-[0.75rem] text-ink-4">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, directory.total)} of {directory.total}
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
      </div>
    </div>
  );
}
