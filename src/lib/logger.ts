import "server-only";
import pino from "pino";
import { env, isProd } from "./env";

/**
 * Structured JSON logging. Never log secrets, tokens or review content —
 * only identifiers and non-sensitive metadata.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "meridian", env: env.NODE_ENV },
  redact: {
    paths: [
      "password",
      "token",
      "sessionToken",
      "*.password",
      "*.token",
      "*.secret",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
  ...(env.LOG_PRETTY && !isProd
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l" },
        },
      }
    : {}),
});

/** Simple request id helper for correlating logs and audit records. */
export function requestId(): string {
  return crypto.randomUUID();
}
