import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 * Used only for generating SQL migrations at development time — the runtime
 * never needs it. Migrations are applied by `scripts/migrate.ts` so that the
 * production image does not ship drizzle-kit.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://meridian:meridian@localhost:5432/meridian",
  },
  strict: true,
  verbose: true,
  casing: "snake_case",
});
