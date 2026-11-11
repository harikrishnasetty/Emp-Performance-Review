// `@next/env` is CJS without statically-analyzable named exports, so import
// the whole module and destructure rather than `import { loadEnvConfig }`.
import nextEnv from "@next/env";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// Standalone script (run via `tsx`, not the Next.js CLI) — load .env.local /
// .env the same way `next dev` / `next build` would, so DATABASE_URL etc.
// don't have to be exported manually every time.
nextEnv.loadEnvConfig(process.cwd());

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://meridian:meridian@localhost:5432/meridian";

async function main() {
  const reset = process.argv.includes("--reset");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  if (reset) {
    // eslint-disable-next-line no-console
    console.log("[migrate] resetting public schema");
    // Drop the app schema *and* drizzle's journal. Leaving the journal behind
    // makes the migrator believe every migration is already applied, so a
    // reset would leave the database empty.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await pool.query("CREATE SCHEMA public");
  }

  // eslint-disable-next-line no-console
  console.log("[migrate] applying migrations from ./drizzle");
  await migrate(db, { migrationsFolder: "./drizzle" });

  await pool.end();
  // eslint-disable-next-line no-console
  console.log("[migrate] done");
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[migrate] failed", error);
  process.exit(1);
});
