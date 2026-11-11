import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — the first line of defence.
 *
 * Responsibilities (deliberately narrow, since the edge runtime has no DB):
 *  • Block unauthenticated access to the app shell before rendering.
 *  • Attach a correlation id to every request for log + audit stitching.
 *
 * Host and origin validation is NOT done here — the edge runtime cannot read
 * the full environment, so a host allow-list here would either break local dev
 * or silently no-op. Those checks live where they can be enforced properly:
 * `assertOrigin()` on mutating routes, `Secure`/`SameSite` session cookies, and
 * the HSTS + CSP header rules in `next.config.ts`.
 *
 * Deliberately does NOT bounce cookie-holders away from /login: the edge
 * runtime cannot validate a token against the database, and a stale or revoked
 * cookie would then ping-pong between /login (middleware → /dashboard) and the
 * app layout (no session → /login) forever. `/login` performs the redirect
 * itself, using a real session lookup.
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/favicon.ico",
  "/robots.txt",
  "/manifest.webmanifest",
  "/privacy",
];

const SESSION_COOKIE = "meridian.sid";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const requestId = crypto.randomUUID();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  const response = NextResponse.next({ request });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except static assets and image optimisation, which
     * never need an authorisation check.
     */
    "/((?!_next/static|_next/image|fonts|images|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
