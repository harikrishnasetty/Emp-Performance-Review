import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { env, isProd } from "../env";
import { logger } from "../logger";
import * as schema from "./schema";

/**
 * PostgreSQL connection pool.
 *
 * In production the pool points at PgBouncer (transaction mode) so that
 * dozens of app replicas can share a modest number of server connections.
 * 1000 concurrent logins cost ~1000 short-lived transactions — well within a
 * pool of 20 per replica across 4 replicas.
 */

const config: PoolConfig = {
  connectionString: env.DATABASE_POOL_URL ?? env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: false,
  application_name: "meridian",
  ...(env.DATABASE_SSL ? { ssl: { rejectUnauthorized: true } } : {}),
};

declare global {
  // eslint-disable-next-line no-var
  var __meridianPool: Pool | undefined;
}

/**
 * Next.js dev mode hot-reloads modules; reuse the pool to avoid exhausting
 * Postgres connections during development.
 */
export const pool: Pool =
  globalThis.__meridianPool ??
  new Pool(config);

if (!isProd) globalThis.__meridianPool = pool;

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected PostgreSQL pool error");
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = typeof db;
export { schema };

/**
 * Graceful shutdown — used by the container entrypoint on SIGTERM.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
