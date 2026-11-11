import { NextResponse, type NextRequest } from "next/server";
import { beginAuthorization } from "@/lib/auth/oidc";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { safeReturnTo } from "@/lib/auth/oidc";
import { redirectTo } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/login
 * Starts the OIDC Authorization Code + PKCE dance.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = await rateLimit(`auth:start:${ip}`, env.RATE_LIMIT_AUTH_PER_MIN, 60);
  if (!rl.ok) {
    return redirectTo("/login?error=rate_limited");
  }

  const next = safeReturnTo(request.nextUrl.searchParams.get("next"));

  try {
    const { url } = await beginAuthorization(next, ip);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth] failed to start OIDC flow:", (err as Error).message);
    return redirectTo("/login?error=sso_unavailable");
  }
}
