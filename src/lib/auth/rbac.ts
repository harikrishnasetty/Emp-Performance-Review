import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import type { SessionUser } from "./oidc";

/**
 * Authorisation model
 * ═══════════════════
 * Two complementary layers:
 *
 *  1. Capability checks (`can`) — coarse-grained, derived from the user's
 *     system role (ADMIN / HR / EXEC / USER) plus explicit grants.
 *  2. Relationship checks — fine-grained, evaluated per record: "is the actor
 *     the subject?", "is the actor this person's manager?", "is the actor an
 *     assigned peer reviewer?".
 *
 * Rules of engagement:
 *  • Never trust a client-supplied id for ownership — always re-read the row.
 *  • Default deny. Every branch must be an explicit grant.
 *  • EXEC is read-only across the org; HR manages process, not outcomes.
 */

export type Capability =
  | "org:read"
  | "org:manage"
  | "user:manage"
  | "role:manage"
  | "cycle:manage"
  | "cycle:read"
  | "template:manage"
  | "review:read:all"
  | "review:write:any"
  | "calibration:manage"
  | "analytics:org"
  | "analytics:team"
  | "audit:read"
  | "settings:manage"
  | "goal:read:all"
  | "goal:manage:any"
  | "feedback:read:any";

const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  ADMIN: [
    "org:read",
    "org:manage",
    "user:manage",
    "role:manage",
    "cycle:manage",
    "cycle:read",
    "template:manage",
    "review:read:all",
    "review:write:any",
    "calibration:manage",
    "analytics:org",
    "analytics:team",
    "audit:read",
    "settings:manage",
    "goal:read:all",
    "goal:manage:any",
    "feedback:read:any",
  ],
  HR: [
    "org:read",
    "cycle:manage",
    "cycle:read",
    "template:manage",
    "review:read:all",
    "calibration:manage",
    "analytics:org",
    "analytics:team",
    "audit:read",
    "goal:read:all",
  ],
  EXEC: [
    "org:read",
    "cycle:read",
    "review:read:all",
    "analytics:org",
    "analytics:team",
    "goal:read:all",
  ],
  USER: ["cycle:read", "analytics:team"],
};

export type Actor = Pick<
  SessionUser,
  "id" | "systemRole" | "extraPermissions" | "managerId"
>;

export function can(
  user: Actor | null | undefined,
  capability: Capability,
): boolean {
  if (!user) return false;
  if (user.extraPermissions?.includes(capability)) return true;
  return ROLE_CAPABILITIES[user.systemRole]?.includes(capability) ?? false;
}

export function isAdmin(user: Actor | null | undefined): boolean {
  return user?.systemRole === "ADMIN";
}

export function isHr(user: Actor | null | undefined): boolean {
  return user?.systemRole === "HR" || user?.systemRole === "ADMIN";
}

export function canViewOrgAnalytics(user: Actor | null | undefined): boolean {
  return can(user, "analytics:org");
}

/** True when `managerId` is a direct report of `actorId`. */
export async function isDirectReport(
  actorId: string,
  managerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.managerId, actorId), eq(users.id, managerId)))
    .limit(1);
  return !!row;
}

/**
 * Walks the reporting line upward. Depth-limited to protect against cycles.
 */
export async function managerChain(
  userId: string,
  maxDepth = 8,
): Promise<string[]> {
  const chain: string[] = [];
  let current: string | null = userId;
  for (let i = 0; i < maxDepth && current; i++) {
    const rows: { managerId: string | null }[] = await db
      .select({ managerId: users.managerId })
      .from(users)
      .where(eq(users.id, current))
      .limit(1);
    const next: string | null = rows[0]?.managerId ?? null;
    if (!next || chain.includes(next)) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

/** Recursive CTE: every person below `userId` in the org tree. */
export async function reportingSubtree(userId: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    with recursive subtree as (
      select id from users where manager_id = ${userId} and deactivated_at is null
      union
      select u.id from users u
      join subtree s on u.manager_id = s.id
      where u.deactivated_at is null
    )
    select id from subtree
  `);
  return rows.rows.map((r) => r.id);
}

/** Whether `actorId` can see the performance record owned by `subjectId`. */
export async function canSeePerformanceOf(
  actor: Actor,
  subjectId: string,
): Promise<boolean> {
  if (actor.id === subjectId) return true;
  if (can(actor, "review:read:all")) return true;
  const subtree = await reportingSubtree(actor.id);
  return subtree.includes(subjectId);
}
