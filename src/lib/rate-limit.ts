import "server-only";
import Redis from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Distributed rate limiter.
 *
 * Uses Redis when configured (required for multi-replica deployments so that
 * the effective limit is global, not per pod). Falls back to an in-process
 * token bucket when Redis is unavailable — acceptable for dev, logged loudly.
 */

let redis: Redis | null = null;
let redisHealthy = false;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3_000,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  });
  redis.on("ready", () => {
    redisHealthy = true;
    logger.info("Redis connected");
  });
  redis.on("error", (err) => {
    if (redisHealthy) logger.warn({ err: err.message }, "Redis error");
    redisHealthy = false;
    if (env.REDIS_REQUIRED && env.NODE_ENV === "production") {
      logger.fatal("Redis is required but unreachable");
      process.exit(1);
    }
  });
}

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();

// Prevent unbounded growth in long-lived dev processes.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memory) if (v.resetAt < now) memory.delete(k);
}, 60_000).unref?.();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

/**
 * Fixed-window counter. Chosen over sliding-window for O(1) memory and a
 * single round trip, which matters during a 1000-user login burst.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;

  if (redis && redisHealthy) {
    try {
      const redisKey = `rl:${key}`;
      const results = await redis
        .multi()
        .incr(redisKey)
        .pttl(redisKey)
        .exec();

      const count = Number(results?.[0]?.[1] ?? 1);
      const pttl = Number(results?.[1]?.[1] ?? -1);

      if (pttl < 0) {
        await redis.pexpire(redisKey, windowSeconds * 1000);
      }

      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: pttl > 0 ? now + pttl : resetAt,
        limit,
      };
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "Rate limit via Redis failed");
    }
  }

  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt < now) {
    memory.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, limit };
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    limit,
  };
}

/** Cache helper used for IdP metadata and hot dashboard aggregates. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis || !redisHealthy) return null;
  try {
    const raw = await redis.get(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!redis || !redisHealthy) return;
  try {
    await redis.set(`cache:${key}`, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* cache failures must never break a request */
  }
}

export async function cacheDel(prefix: string): Promise<void> {
  if (!redis || !redisHealthy) return;
  try {
    const keys = await redis.keys(`cache:${prefix}*`);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* ignore */
  }
}
