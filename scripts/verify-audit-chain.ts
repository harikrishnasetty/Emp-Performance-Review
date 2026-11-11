// `@next/env` is CJS without statically-analyzable named exports, so import
// the whole module and destructure rather than `import { loadEnvConfig }`.
import nextEnv from "@next/env";
import { Pool } from "pg";
import { createHash } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd());

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://meridian:meridian@localhost:5432/meridian";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const { rows } = await pool.query<{
    id: number;
    occurred_at: Date;
    actor_id: string | null;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    target_user_id: string | null;
    summary: string | null;
    metadata: Record<string, unknown> | null;
    prev_hash: string;
    hash: string;
  }>("SELECT id, occurred_at, actor_id, actor_email, actor_role, action, entity_type, entity_id, target_user_id, summary, metadata, prev_hash, hash FROM audit_events ORDER BY id ASC");

  const GENESIS = "0".repeat(64);
  let prev = GENESIS;
  let broken = 0;

  for (const row of rows) {
    if (row.prev_hash !== prev) {
      console.error(`[verify] row ${row.id}: prev_hash mismatch (expected ${prev}, got ${row.prev_hash})`);
      broken++;
    }

    const record = {
      occurredAt: new Date(row.occurred_at).toISOString(),
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      targetUserId: row.target_user_id,
      summary: row.summary,
      metadata: row.metadata,
    };

    const recomputed = sha256Hex(prev + canonicalJson(record));
    if (recomputed !== row.hash) {
      console.error(`[verify] row ${row.id}: hash mismatch (expected ${row.hash}, got ${recomputed})`);
      broken++;
    }
    prev = row.hash;
  }

  await pool.end();

  if (broken > 0) {
    console.error(`[verify] FAILED — ${broken} integrity violation(s) across ${rows.length} event(s).`);
    process.exit(1);
  }
  console.log(`[verify] OK — ${rows.length} event(s) verified, chain intact.`);
}

main().catch((error) => {
  console.error("[verify] failed", error);
  process.exit(1);
});
