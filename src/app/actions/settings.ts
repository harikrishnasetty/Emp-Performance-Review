"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/auth/session";
import { revokeAllSessions } from "@/lib/auth/oidc";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";

export async function signOutEverywhere(): Promise<ActionResult<null>> {
  return action({
    name: "settings.signout-all",
    schema: z.object({}),
    input: {},
    limit: 5,
    handler: async (_data, ctx) => {
      await revokeAllSessions(ctx.user.id, "user_initiated");
      await auditAction(ctx, {
        action: "settings.signout-all",
        entityType: "session",
        entityId: ctx.user.id,
        summary: "User signed out of every device",
      });
      return null;
    },
  });
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12).max(256),
  })
  .superRefine((data, ctx) => {
    if (data.currentPassword === data.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Choose a password different from your current one.",
      });
    }
  });

/**
 * Self-service password change for local (non-SSO) accounts. Current session
 * stays valid; every other session is revoked so a stolen cookie dies with the
 * old password.
 */
export async function changeOwnPassword(
  input: unknown,
): Promise<ActionResult<null>> {
  return action({
    name: "settings.password.change",
    schema: changePasswordSchema,
    input,
    limit: 8,
    handler: async (data, ctx) => {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          entraObjectId: users.entraObjectId,
        })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!row) throw new ActionError("Account not found.", "forbidden");
      if (!row.passwordHash) {
        throw new ActionError(
          "Your account signs in with Microsoft SSO and has no local password to change.",
          "validation",
        );
      }

      if (!verifyPassword(data.currentPassword, row.passwordHash)) {
        throw new ActionError("Your current password is incorrect.", "validation", {
          currentPassword: "Incorrect password",
        });
      }

      await db
        .update(users)
        .set({
          passwordHash: hashPassword(data.newPassword),
          passwordChangedAt: new Date(),
          // Keep SSO accounts marked BOTH; local-only accounts stay LOCAL.
          authProvider: row.entraObjectId ? "BOTH" : "LOCAL",
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, row.id));

      const session = await getSession();
      await revokeAllSessions(row.id, "password_changed", session?.sessionId);

      await auditAction(ctx, {
        action: "auth.local.password.changed",
        entityType: "user",
        entityId: row.id,
        targetUserId: row.id,
        summary: "Local password changed by the account owner",
      });

      return null;
    },
  });
}
