import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Search, ShieldCheck, Users, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getPeople, listDepartments, listDirectory } from "@/lib/services/people";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { EditPersonDialog, type AdminPerson } from "@/components/admin/person-admin";
import { NewPersonDialog } from "@/components/admin/new-person-dialog";
import type { PersonOption } from "@/components/people/person-picker";
import { cn } from "@/lib/utils";

export const metadata = { title: "Directory admin" };

const PAGE_SIZE = 24;

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; page?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "user:manage")) redirect("/forbidden");

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

  const managers = await getPeople(
    [...new Set(directory.rows.map((p) => p.managerId).filter(Boolean) as string[])],
  );

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
    return qs ? `/admin/people?${qs}` : "/admin/people";
  };

  const adminPeople: AdminPerson[] = directory.rows.map((person) => ({
    id: person.id,
    displayName: person.displayName,
    email: person.email,
    jobTitle: person.jobTitle,
    departmentId: person.departmentId,
    managerId: person.managerId,
    systemRole: person.systemRole,
    status: person.status,
    authProvider: person.authProvider,
    location: person.location,
  }));

  const suggestions = directory.rows
    .slice(0, 8)
    .map((person) => ({
      id: person.id,
      name: person.displayName,
      jobTitle: person.jobTitle,
      avatarUrl: person.avatarUrl,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Directory admin"
        description="Add people, then adjust roles, managers, departments, employment status and sign-in method. Every change is written to the audit trail and takes effect immediately."
        actions={
          <NewPersonDialog
            departments={departments.map((d) => ({ id: d.id, name: d.name }))}
            suggestions={suggestions}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="People"
          value={directory.total}
          hint={activeDepartment ? activeDepartment.name : "Across the org"}
          icon={<Users />}
          tone="brand"
        />
        <Stat
          label="Departments"
          value={departments.length}
          hint="Active structure"
          icon={<Building2 />}
          tone="info"
        />
        <Stat
          label="Admins"
          value={directory.rows.filter((p) => p.systemRole === "ADMIN").length}
          hint="In this view"
          icon={<ShieldCheck />}
          tone="warning"
        />
        <Stat
          label="Page"
          value={`${page} / ${totalPages}`}
          hint={query ? `Results for “${query}”` : "Sorted alphabetically"}
          icon={<Search />}
          tone="positive"
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
              <form action="/admin/people" className="space-y-2">
                {departmentId ? <input type="hidden" name="dept" value={departmentId} /> : null}
                <Input
                  name="q"
                  defaultValue={query}
                  placeholder="Name, email or role"
                  aria-label="Search the directory"
                />
                <button
                  type="submit"
                  className="h-8 w-full rounded-lg border border-line-strong px-3 text-[0.8125rem] text-ink-2 hover:bg-surface-3"
                >
                  Search
                </button>
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
          {directory.rows.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No one matches that"
              description="Try a shorter name, an email prefix, or a different department."
              action={
                <LinkButton href="/admin/people" variant="outline" size="sm">
                  Reset filters
                </LinkButton>
              }
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] text-left">
                    <thead>
                      <tr className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                        <th className="px-4 py-3 font-medium">Person</th>
                        <th className="px-4 py-3 font-medium">Sign-in</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">Department</th>
                        <th className="px-4 py-3 font-medium">Reports to</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {adminPeople.map((person) => {
                        const manager = person.managerId
                          ? managers.get(person.managerId)
                          : null;
                        const managerOption: PersonOption | null = manager
                          ? {
                              id: manager.id,
                              name: manager.displayName,
                              jobTitle: manager.jobTitle,
                              avatarUrl: manager.avatarUrl,
                            }
                          : null;
                        return (
                          <tr key={person.id} className="text-[0.8125rem]">
                            <td className="px-4 py-2.5">
                              <Link
                                href={`/people/${person.id}`}
                                className="flex items-center gap-2.5"
                              >
                                <Avatar
                                  name={person.displayName}
                                  size={30}
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-ink-1 hover:text-brand-200">
                                    {person.displayName}
                                  </span>
                                  <span className="block truncate text-[0.625rem] text-ink-4">
                                    {person.email}
                                  </span>
                                </span>
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                tone={
                                  person.authProvider === "LOCAL"
                                    ? "warning"
                                    : person.authProvider === "BOTH"
                                      ? "info"
                                      : "positive"
                                }
                              >
                                {person.authProvider === "BOTH"
                                  ? "sso + local"
                                  : person.authProvider.toLowerCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                tone={
                                  person.systemRole === "ADMIN"
                                    ? "danger"
                                    : person.systemRole === "HR"
                                      ? "info"
                                      : person.systemRole === "EXEC"
                                        ? "warning"
                                        : "neutral"
                                }
                              >
                                {person.systemRole.toLowerCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-ink-3">
                              {person.jobTitle ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-ink-3">
                              {person.departmentId
                                ? (departments.find((d) => d.id === person.departmentId)
                                    ?.name ?? "—")
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-ink-3">
                              {managerOption ? managerOption.name : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                tone={
                                  person.status === "ACTIVE"
                                    ? "positive"
                                    : person.status === "INACTIVE"
                                      ? "neutral"
                                      : "warning"
                                }
                              >
                                {person.status.replaceAll("_", " ").toLowerCase()}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <EditPersonDialog
                                person={person}
                                departments={departments.map((d) => ({
                                  id: d.id,
                                  name: d.name,
                                }))}
                                manager={managerOption}
                                suggestions={suggestions}
                                isSelf={person.id === user.id}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
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
