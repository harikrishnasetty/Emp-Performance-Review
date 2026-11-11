import "server-only";
import { NextResponse } from "next/server";
import { constantTimeEqual, sha256Hex } from "./crypto";
import { getSession, type SessionContext } from "./auth/session";
import { rateLimit } from "./rate-limit";
import { env } from "./env";
import { logger } from "./logger";

/**
 * HTTP helpers for route handlers.
 *
 * Security contract for every mutating endpoint:
 *   1. Authenticated session (server-side, cookie → DB).
 *   2. CSRF double-submit token bound to the session.
 *   3. Per-identity rate limit.
 *   4. Origin allow-list as defence in depth.
 */

export type ApiError = { error: string; message: string; details?: unknown };

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

/**
 * Redirect to an app-relative path, staying on the origin the caller used.
 *
 * `APP_URL` is the canonical public URL and must stay the source of truth for
 * the OIDC `redirect_uri` (Entra compares it byte-for-byte), but it is not
 * always the origin actually in use: local dev runs on `http://` behind an
 * `https://` APP_URL, staging may use another port, and a proxy may present a
 * different host. A relative `Location` keeps the browser on the current
 * origin, which is correct in all of those cases and immune to Host-header
 * manipulation.
 */
export function redirectTo(path: string, status = 303): NextResponse {
  const location = path.startsWith("/") ? path : `/${path}`;
  return new NextResponse(null, {
    status,
    headers: { Location: location, "Cache-Control": "no-store" },
  });
}

export function fail(
  status: number,
  error: string,
  message: string,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json(
    { error, message, ...(details ? { details } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Defence-in-depth origin check for mutating endpoints.
 *
 * Accepts a request whose `Origin` matches either:
 *   - `APP_URL` — the canonical public URL, or
 *   - the origin the caller actually addressed (request `Host` + protocol).
 *
 * The second case matters because `APP_URL` is not always the scheme/host in
 * use: local dev runs on `http://` while `APP_URL` may be `https://`, and a
 * reverse proxy terminates TLS. A cross-site page always sends its own origin,
 * which can never equal the `Host` the browser addressed, so this does not
 * weaken the check.
 */
export function assertOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin navigations may omit it

  let sent: string;
  try {
    sent = new URL(origin).origin;
  } catch {
    return false;
  }

  try {
    if (sent === new URL(env.APP_URL).origin) return true;
  } catch {
    // A malformed APP_URL shouldn't take the whole guard down; fall through.
  }

  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    requestUrl.protocol.replace(":", "") ||
    "http";

  return sent === `${proto}://${host}`;
}

export async function assertCsrf(
  request: Request,
  session: SessionContext,
): Promise<boolean> {
  const header = request.headers.get("x-csrf-token");
  if (!header) return false;
  return constantTimeEqual(sha256Hex(header), session.csrfTokenHash);
}

export type Guarded =
  | { ok: true; session: SessionContext }
  | { ok: false; response: NextResponse };

/**
 * Standard guard for mutating API routes.
 */
export async function guardMutation(
  request: Request,
  options: { limit?: number; windowSeconds?: number } = {},
): Promise<Guarded> {
  if (!assertOrigin(request)) {
    return { ok: false, response: fail(403, "bad_origin", "Cross-origin request rejected.") };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, response: fail(401, "unauthenticated", "Sign in to continue.") };
  }

  if (!(await assertCsrf(request, session))) {
    logger.warn(
      { userId: session.user.id, path: new URL(request.url).pathname },
      "CSRF validation failed",
    );
    return { ok: false, response: fail(403, "csrf_failed", "Security token mismatch. Refresh the page.") };
  }

  const limit = options.limit ?? env.RATE_LIMIT_API_PER_MIN;
  const rl = await rateLimit(`api:${session.user.id}`, limit, options.windowSeconds ?? 60);
  if (!rl.ok) {
    return {
      ok: false,
      response: fail(429, "rate_limited", "Too many requests. Slow down and retry shortly."),
    };
  }

  return { ok: true, session };
}

export async function guardRead(): Promise<
  { ok: true; session: SessionContext } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: fail(401, "unauthenticated", "Sign in to continue.") };
  }
  return { ok: true, session };
}
