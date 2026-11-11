import "server-only";
import { z } from "zod";

/**
 * Environment validation.
 *
 * The process refuses to boot with an invalid configuration — fail fast is far
 * safer than silently degrading security in production.
 */

const bool = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return defaultValue;
      return v === "true" || v === "1";
    });

const int = (defaultValue: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? defaultValue : Number(v)))
    .pipe(z.number().int().min(min).max(max));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().min(1).default("Meridian"),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_URL: z.string().optional(),
  DATABASE_POOL_MAX: int(20, 1, 200),
  DATABASE_SSL: bool(false),
  RLS_ENFORCE: bool(false),

  REDIS_URL: z.string().optional(),
  REDIS_REQUIRED: bool(false),

  ENTRA_TENANT_ID: z.string().min(1),
  ENTRA_CLIENT_ID: z.string().min(1),
  ENTRA_CLIENT_SECRET: z.string().min(1),
  ALLOWED_EMAIL_DOMAINS: z.string().default("metricstream.com"),
  ENTRA_STRICT_TENANT: bool(true),

  FIELD_ENCRYPTION_KEY: z.string().min(16),
  APP_SECRET: z.string().min(16),
  SESSION_ABSOLUTE_HOURS: int(12, 1, 720),
  SESSION_IDLE_MINUTES: int(45, 5, 1440),
  COOKIE_SECURE: bool(false),
  TRUST_PROXY: bool(true),

  RATE_LIMIT_AUTH_PER_MIN: int(20, 1, 10_000),
  RATE_LIMIT_API_PER_MIN: int(300, 1, 100_000),

  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
  SEED_DEMO_DATA: bool(false),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  LOG_PRETTY: bool(false),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(
      `\n[Meridian] Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in the values.\n`,
    );
    throw new Error("Invalid environment configuration");
  }

  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    const problems: string[] = [];
    if (env.APP_SECRET.length < 32)
      problems.push("APP_SECRET must be at least 32 characters in production.");
    if (!env.COOKIE_SECURE)
      problems.push("COOKIE_SECURE must be 'true' in production (TLS required).");
    if (!env.APP_URL.startsWith("https://"))
      problems.push("APP_URL must use https:// in production.");
    if (env.FIELD_ENCRYPTION_KEY.length < 32)
      problems.push("FIELD_ENCRYPTION_KEY must be at least 32 characters.");
    if (problems.length) {
      // eslint-disable-next-line no-console
      console.error(
        `\n[Meridian] Refusing to start — insecure production config:\n` +
          problems.map((p) => `  • ${p}`).join("\n") +
          "\n",
      );
      throw new Error("Insecure production configuration");
    }
  }

  return env;
}

export const env: Env = load();

export const allowedEmailDomains = env.ALLOWED_EMAIL_DOMAINS.split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const isProd = env.NODE_ENV === "production";
export const appName = env.APP_NAME;
