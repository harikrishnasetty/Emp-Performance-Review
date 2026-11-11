import "server-only";
import { z } from "zod";
import { ZodError } from "zod";
import { requireUser } from "./auth/session";
import { audit } from "./audit";
import { clientContext } from "./auth/oidc";
import { can, type Capability } from "./auth/rbac";
import { logger } from "./logger";
import { rateLimit } from "./rate-limit";
import { env } from "./env";

/**
 * Server Action envelope.
 *
 * Every mutation in the product goes through `action()` so that authorisation,
 * validation, rate limiting, audit logging and error shaping are impossible to
 * forget. Client code always receives a discriminated union, never a stack
 * trace.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      code?: "unauthorised" | "forbidden" | "validation" | "conflict" | "rate_limited";
    };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  error: string,
  code: ActionResult<never> extends never ? never : NonNullable<Extract<ActionResult, { ok: false }>["code"]> = "validation",
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, error, code, ...(fieldErrors ? { fieldErrors } : {}) };
}

function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export type ActionContext = {
  user: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
  ip: string | null;
  userAgent: string | null;
};

export async function action<TInput, TOutput>(config: {
  name: string;
  schema: z.ZodType<TInput>;
  input: unknown;
  capability?: Capability;
  limit?: number;
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>;
}): Promise<ActionResult<TOutput>> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return actionFail("Your session expired. Please sign in again.", "unauthorised");
  }

  if (config.capability && !can(user, config.capability)) {
    return actionFail("You do not have permission to perform this action.", "forbidden");
  }

  const parsed = config.schema.safeParse(config.input);
  if (!parsed.success) {
    return actionFail("Please correct the highlighted fields.", "validation", zodFieldErrors(parsed.error));
  }

  const rl = await rateLimit(
    `action:${user.id}:${config.name}`,
    config.limit ?? 120,
    60,
  );
  if (!rl.ok) {
    return actionFail("You're doing that too often. Try again in a minute.", "rate_limited");
  }

  const { ip, userAgent } = await clientContext();

  try {
    const data = await config.handler(parsed.data, { user, ip, userAgent });
    return { ok: true, data };
  } catch (err) {
    if (err instanceof ActionError) {
      return actionFail(err.message, err.code, err.fieldErrors);
    }
    logger.error(
      { err: (err as Error).message, action: config.name, userId: user.id },
      "Server action failed",
    );
    return actionFail(
      "Something went wrong on our side. The error has been logged.",
      "validation",
    );
  }
}

/** Throw inside a handler for a user-facing, non-logged failure. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly code: NonNullable<Extract<ActionResult, { ok: false }>["code"]> = "validation",
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** Convenience: audit a successful mutation with ambient request context. */
export async function auditAction(
  ctx: ActionContext,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    targetUserId?: string | null;
    summary?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await audit({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    targetUserId: input.targetUserId ?? null,
    summary: input.summary ?? null,
    metadata: input.metadata ?? null,
    actor: {
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.user.systemRole,
    },
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export { env };
