import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://meridian:meridian@postgres:5432/meridian";

const reset = process.argv.includes("--reset");

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

if (reset) {
  console.log("[migrate] resetting public schema");
  // Drop the app schema *and* drizzle's journal. Leaving the journal behind
  // makes the migrator believe every migration is already applied, so a reset
  // would leave the database empty.
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
  await pool.query("CREATE SCHEMA public");
}

console.log("[migrate] applying migrations from ./drizzle");
await migrate(db, { migrationsFolder: "./drizzle" });

await pool.end();
console.log("[migrate] done");
