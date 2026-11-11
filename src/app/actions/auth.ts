"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword, hashPassword } from "@/lib/crypto";
import { createSession, revokeAllSessions } from "@/lib/auth/oidc";
import { setSessionCookies } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { clientContext } from "@/lib/auth/oidc";
import { rateLimit } from "@/lib/rate-limit";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const localLoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
});

export async function localLogin(input: unknown): Promise<ActionResult<null>> {
  const parsed = localLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password.", code: "validation" };
  }
  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const rl = await rateLimit(`local-login:${email}`, 10, 60);
  if (!rl.ok) {
    return {
      ok: false,
      error: "Too many attempts. Try again in a minute.",
      code: "rate_limited",
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  // Generic failure message to avoid user enumeration.
  const fail = async (reason: string, userId?: string | null) => {
    if (user && !user.deactivatedAt && user.status !== "INACTIVE") {
      await db
        .update(users)
        .set({
          failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
          lockedUntil:
            user.failedLoginAttempts + 1 >= MAX_ATTEMPTS
              ? sql`now() + interval '${LOCK_MINUTES} minutes'`
              : users.lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
    return { ok: false as const, error: "Invalid email or password.", code: "validation" as const };
  };

  if (!user) return fail("no_user");
  if (user.deactivatedAt || user.status === "INACTIVE") return fail("inactive");
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      error: `Account locked. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
      code: "forbidden",
    };
  }
  if (!user.passwordHash) {
    return {
      ok: false,
      error: "This account uses single sign-on. Use the SSO button instead.",
      code: "validation",
    };
  }

  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) return fail("bad_password", user.id);

  // Success — reset counters.
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const { ip, userAgent } = await clientContext();
  const session = await createSession(user.id, ip, userAgent, "local");
  await setSessionCookies(session.token, session.csrfToken, session.absoluteExpiresAt);

  await audit({
    action: "auth.local.login",
    entityType: "session",
    entityId: user.id,
    targetUserId: user.id,
    summary: `Local sign-in for ${user.email}`,
    actor: { id: user.id, email: user.email, role: user.systemRole },
    ipAddress: ip,
    userAgent,
  });

  return { ok: true, data: null };
}

const setPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(12).max(256),
});

export async function adminSetPassword(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "admin.user.password",
    schema: setPasswordSchema,
    input,
    capability: "user:manage",
    limit: 20,
    handler: async (data, ctx) => {
      const [target] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
      if (!target) throw new ActionError("User not found.");

      await db
        .update(users)
        .set({
          passwordHash: hashPassword(data.password),
          passwordChangedAt: new Date(),
          // An account that already has an Entra identity keeps both paths.
          authProvider: target.entraObjectId ? "BOTH" : "LOCAL",
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.userId));

      // A password reset is usually a containment action — drop live sessions.
      await revokeAllSessions(data.userId, "password_reset");

      await auditAction(ctx, {
        action: "admin.user.password.set",
        entityType: "user",
        entityId: data.userId,
        targetUserId: data.userId,
        summary: `Local password set for ${target.email}`,
        metadata: { authProvider: target.entraObjectId ? "BOTH" : "LOCAL" },
      });

      revalidatePath("/admin/people");
      return null;
    },
  });
}

const disableLocalSchema = z.object({ userId: z.string().uuid() });

/**
 * Removes the local (non-SSO) credential from an account. The person keeps
 * their Entra ID sign-in; only the password is revoked.
 */
export async function adminDisableLocalAccess(
  input: unknown,
): Promise<ActionResult<null>> {
  return action({
    name: "admin.user.password.disable",
    schema: disableLocalSchema,
    input,
    capability: "user:manage",
    limit: 20,
    handler: async (data, ctx) => {
      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1);
      if (!target) throw new ActionError("User not found.");
      if (!target.passwordHash) {
        throw new ActionError("That account doesn't have a local password.");
      }
      if (!target.entraObjectId) {
        throw new ActionError(
          "This person has no SSO identity yet, so removing their local password would lock them out. They can move to SSO-only after their first Microsoft sign-in.",
          "validation",
        );
      }

      // Never let a local-only administrator lock themselves out.
      if (data.userId === ctx.user.id && !target.entraObjectId) {
        throw new ActionError(
          "You sign in with a local password and have no SSO identity — disabling local access would lock you out.",
          "forbidden",
        );
      }

      await db
        .update(users)
        .set({
          passwordHash: null,
          passwordChangedAt: null,
          authProvider: "SSO",
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, data.userId));

      await revokeAllSessions(data.userId, "local_access_revoked");

      await auditAction(ctx, {
        action: "admin.user.password.disabled",
        entityType: "user",
        entityId: data.userId,
        targetUserId: data.userId,
        summary: `Local (non-SSO) access disabled for ${target.email}`,
      });

      revalidatePath("/admin/people");
      return null;
    },
  });
}
