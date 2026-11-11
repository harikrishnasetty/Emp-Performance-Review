import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env, isProd } from "../env";
import {
  resolveSession,
  type SessionContext,
  type SessionUser,
} from "./oidc";
import { can, type Capability } from "./rbac";

export type { SessionContext, SessionUser };

export const SESSION_COOKIE = "meridian.sid";
export const CSRF_COOKIE = "meridian.csrf";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE || isProd,
  path: "/",
};

export async function setSessionCookies(
  token: string,
  csrfToken: string,
  absoluteExpiresAt: Date,
): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    ...baseCookie,
    expires: absoluteExpiresAt,
  });
  // The CSRF cookie is intentionally readable by JS so the client can echo it
  // back in a custom header (double-submit pattern).
  jar.set(CSRF_COOKIE, csrfToken, {
    ...baseCookie,
    httpOnly: false,
    expires: absoluteExpiresAt,
  });
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

/**
 * Per-request memoised session lookup. React `cache` dedupes across server
 * components in a single render pass, so a page with 12 components performs
 * exactly one session query.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveSession(token);
});

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireCapability(
  capability: Capability,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, capability)) redirect("/forbidden");
  return user;
}

/** For API routes: returns null instead of redirecting. */
export async function getApiSession(): Promise<SessionContext | null> {
  return getSession();
}
