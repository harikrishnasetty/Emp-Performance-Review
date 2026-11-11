import "server-only";
import { desc, sql } from "drizzle-orm";
import { db } from "./db";
import { auditEvents } from "./db/schema";
import { sha256Hex } from "./crypto";
import { logger } from "./logger";

/**
 * Tamper-evident audit trail.
 *
 * Every event is hashed together with the previous event's hash, forming an
 * append-only chain. `scripts/verify-audit-chain.ts` can re-walk the chain and
 * prove that no historical record was modified or deleted. Inserts are
 * serialised with a Postgres advisory lock so concurrent writers cannot fork
 * the chain.
 */

const GENESIS = "0".repeat(64);
const CHAIN_LOCK_ID = 918_273_645;

export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  targetUserId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  actor?: {
    id: string | null;
    email: string | null;
    role: string | null;
  } | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${CHAIN_LOCK_ID})`);

      const [last] = await tx
        .select({ hash: auditEvents.hash })
        .from(auditEvents)
        .orderBy(desc(auditEvents.id))
        .limit(1);

      const prevHash = last?.hash ?? GENESIS;
      const occurredAt = new Date();

      const record = {
        occurredAt: occurredAt.toISOString(),
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        targetUserId: input.targetUserId ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata ?? null,
      };

      // Deterministic serialisation so the hash can be independently verified.
      const hash = sha256Hex(
        prevHash + canonicalJson(record),
      );

      await tx.insert(auditEvents).values({
        occurredAt,
        actorId: record.actorId,
        actorEmail: record.actorEmail,
        actorRole: record.actorRole,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        targetUserId: record.targetUserId,
        summary: record.summary,
        metadata: record.metadata,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
        prevHash,
        hash,
      });
    });
  } catch (err) {
    // An audit failure must be visible but must not take down the user action;
    // the error surfaces in logs and the alerting pipeline.
    logger.error(
      { err: (err as Error).message, action: input.action },
      "Audit write failed",
    );
  }
}

/** Stable key ordering for hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}
