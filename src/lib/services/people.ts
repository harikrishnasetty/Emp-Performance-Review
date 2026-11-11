import "server-only";
import { and, asc, eq, ilike, inArray, isNull, or, sql, ne } from "drizzle-orm";
import { db } from "../db";
import { departments, users } from "../db/schema";
import { reportingSubtree } from "../auth/rbac";

export type PersonRow = {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  managerId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  systemRole: string;
  status: string;
  authProvider: string;
  location: string | null;
  hireDate: string | null;
};

const personColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  jobTitle: users.jobTitle,
  avatarUrl: users.avatarUrl,
  managerId: users.managerId,
  departmentId: users.departmentId,
  departmentName: departments.name,
  systemRole: users.systemRole,
  status: users.status,
  authProvider: users.authProvider,
  location: users.location,
  hireDate: users.hireDate,
};

export async function getPerson(id: string): Promise<PersonRow | null> {
  const [row] = await db
    .select(personColumns)
    .from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

/** The People Ops / HR contact shown in the review form's user information block. */
export async function getHrContact(): Promise<string | null> {
  const [row] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(
      and(
        eq(users.systemRole, "HR"),
        isNull(users.deactivatedAt),
        ne(users.status, "INACTIVE"),
      ),
    )
    .orderBy(asc(users.displayName))
    .limit(1);
  return row?.displayName ?? null;
}

export async function getPeople(ids: string[]): Promise<Map<string, PersonRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select(personColumns)
    .from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getDirectReports(managerId: string): Promise<PersonRow[]> {
  return db
    .select(personColumns)
    .from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(
      and(
        eq(users.managerId, managerId),
        isNull(users.deactivatedAt),
        ne(users.status, "INACTIVE"),
      ),
    )
    .orderBy(asc(users.displayName));
}

export async function getTeamIds(managerId: string): Promise<string[]> {
  return reportingSubtree(managerId);
}

export async function searchPeople(
  query: string,
  excludeIds: string[] = [],
  limit = 20,
): Promise<PersonRow[]> {
  const term = `%${query.trim()}%`;
  const conditions = [
    isNull(users.deactivatedAt),
    or(
      ilike(users.displayName, term),
      ilike(users.email, term),
      ilike(users.jobTitle, term),
    ),
  ];
  if (excludeIds.length) conditions.push(sql`${users.id} <> all(${excludeIds})`);

  return db
    .select(personColumns)
    .from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(and(...conditions))
    .orderBy(asc(users.displayName))
    .limit(limit);
}

export async function listDirectory(params: {
  departmentId?: string;
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: PersonRow[]; total: number }> {
  const conditions = [isNull(users.deactivatedAt)];
  if (params.departmentId) conditions.push(eq(users.departmentId, params.departmentId));
  if (params.query) {
    const term = `%${params.query}%`;
    conditions.push(
      or(ilike(users.displayName, term), ilike(users.email, term), ilike(users.jobTitle, term))!,
    );
  }

  const where = and(...conditions);

  const [rows, count] = await Promise.all([
    db
      .select(personColumns)
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(where)
      .orderBy(asc(users.displayName))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(where),
  ]);

  return { rows, total: count[0]?.count ?? 0 };
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.name));
}

export type OrgNode = PersonRow & { reports: OrgNode[] };

/**
 * Builds the reporting tree below `rootId`. Single query + in-memory assembly
 * keeps this O(n) and avoids N+1 round trips on 5000-person orgs.
 */
export async function getOrgTree(rootId: string, maxDepth = 6): Promise<OrgNode | null> {
  const root = await getPerson(rootId);
  if (!root) return null;

  const rows = await db.execute<{
    id: string;
    manager_id: string | null;
    depth: number;
  }>(sql`
    with recursive tree as (
      select u.id, u.manager_id, 1 as depth
      from users u
      where u.manager_id = ${rootId} and u.deactivated_at is null
      union all
      select u.id, u.manager_id, t.depth + 1
      from users u
      join tree t on u.manager_id = t.id
      where u.deactivated_at is null and t.depth < ${maxDepth}
    )
    select id, manager_id, depth from tree
  `);

  const people = await getPeople(rows.rows.map((r) => r.id));
  const byManager = new Map<string, OrgNode[]>();

  const nodeMap = new Map<string, OrgNode>();
  for (const [id, person] of people) {
    nodeMap.set(id, { ...person, reports: [] });
  }
  for (const r of rows.rows) {
    const node = nodeMap.get(r.id);
    if (!node) continue;
    const parent = r.manager_id === rootId ? null : r.manager_id;
    if (!parent) {
      const list = byManager.get(rootId) ?? [];
      list.push(node);
      byManager.set(rootId, list);
    } else {
      const list = byManager.get(parent) ?? [];
      list.push(node);
      byManager.set(parent, list);
    }
  }
  for (const [manager, reports] of byManager) {
    const parent = nodeMap.get(manager);
    if (parent) parent.reports = reports.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return { ...root, reports: byManager.get(rootId) ?? [] };
}

export async function countDirectReports(managerId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.managerId, managerId), isNull(users.deactivatedAt)));
  return row?.count ?? 0;
}

export async function getDepartmentHeadcount(): Promise<
  { id: string; name: string; headcount: number }[]
> {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      headcount: sql<number>`count(${users.id})::int`,
    })
    .from(departments)
    .leftJoin(users, and(eq(users.departmentId, departments.id), isNull(users.deactivatedAt)))
    .groupBy(departments.id, departments.name)
    .orderBy(asc(departments.name));
}

export async function updatePerson(
  id: string,
  patch: {
    jobTitle?: string | null;
    departmentId?: string | null;
    managerId?: string | null;
    systemRole?: "ADMIN" | "HR" | "EXEC" | "USER";
    status?: "ACTIVE" | "ON_LEAVE" | "NOTICE_PERIOD" | "INACTIVE";
    employeeCode?: string | null;
    location?: string | null;
  },
): Promise<PersonRow | null> {
  if (patch.managerId === id) {
    throw new Error("A person cannot report to themselves.");
  }
  // Reject cycles in the reporting line.
  if (patch.managerId) {
    const [cycle] = (
      await db.execute<{ cycle: boolean }>(sql`
        with recursive up as (
          select id, manager_id from users where id = ${patch.managerId}
          union
          select u.id, u.manager_id from users u join up on u.id = up.manager_id
        )
        select exists(select 1 from up where id = ${id}) as cycle
      `)
    ).rows;

    if (cycle?.cycle) throw new Error("That reporting line would create a cycle.");
  }

  await db
    .update(users)
    .set({
      ...patch,
      // Keep the soft-delete marker consistent with employment status so
      // directory/search/analytics queries that filter on deactivated_at
      // behave correctly in both directions.
      ...(patch.status === "INACTIVE"
        ? { deactivatedAt: new Date() }
        : patch.status === "ACTIVE"
          ? { deactivatedAt: null }
          : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));

  return getPerson(id);
}
