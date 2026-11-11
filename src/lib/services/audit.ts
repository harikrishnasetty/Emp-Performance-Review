import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db";
import { auditEvents, users } from "../db/schema";

export type AuditRow = {
  id: number;
  occurredAt: Date;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  targetUserId: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  hash: string;
  prevHash: string;
};

/**
 * Read-side of the append-only audit trail.
 *
 * Writes are hash-chained in `lib/audit.ts`; integrity is verified offline by
 * `scripts/verify-audit-chain.ts` (or a nightly job). This service only reads.
 */
export async function listAuditEvents(params: {
  query?: string;
  action?: string;
  actorId?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AuditRow[]; total: number }> {
  const conditions = [];
  if (params.query) {
    const term = `%${params.query}%`;
    conditions.push(
      or(
        ilike(auditEvents.action, term),
        ilike(auditEvents.entityType, term),
        ilike(auditEvents.summary, term),
        ilike(auditEvents.actorEmail, term),
        ilike(auditEvents.entityId, term),
      )!,
    );
  }
  if (params.action) conditions.push(eq(auditEvents.action, params.action));
  if (params.actorId) conditions.push(eq(auditEvents.actorId, params.actorId));
  if (params.entityType) conditions.push(eq(auditEvents.entityType, params.entityType));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, count] = await Promise.all([
    db
      .select({
        id: auditEvents.id,
        occurredAt: auditEvents.occurredAt,
        actorId: auditEvents.actorId,
        actorEmail: auditEvents.actorEmail,
        actorName: users.displayName,
        actorRole: auditEvents.actorRole,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        targetUserId: auditEvents.targetUserId,
        summary: auditEvents.summary,
        metadata: auditEvents.metadata,
        ipAddress: auditEvents.ipAddress,
        hash: auditEvents.hash,
        prevHash: auditEvents.prevHash,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(where)
      .orderBy(desc(auditEvents.id))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(where),
  ]);

  return { rows, total: count[0]?.count ?? 0 };
}

export async function auditActionFacets() {
  return db
    .select({
      action: auditEvents.action,
      count: sql<number>`count(*)::int`,
    })
    .from(auditEvents)
    .groupBy(auditEvents.action)
    .orderBy(desc(sql`count(*)`))
    .limit(24);
}

export async function auditTrailSummary() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      firstAt: sql<Date | null>`min(${auditEvents.occurredAt})`,
      lastAt: sql<Date | null>`max(${auditEvents.occurredAt})`,
      lastHash: sql<string | null>`(select hash from audit_events order by id desc limit 1)`,
    })
    .from(auditEvents);
  return row ?? { total: 0, firstAt: null, lastAt: null, lastHash: null };
}
