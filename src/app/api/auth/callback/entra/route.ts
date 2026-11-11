import { NextResponse, type NextRequest } from "next/server";
import {
  clientContext,
  completeAuthorization,
  createSession,
  recordAttempt,
  upsertUserFromProfile,
} from "@/lib/auth/oidc";
import { setSessionCookies } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { redirectTo } from "@/lib/http";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const FAILURE_REDIRECTS: Record<string, string> = {
  domain_not_allowed: "domain_not_allowed",
  wrong_tenant: "wrong_tenant",
  invalid_state: "session_expired",
  ip_mismatch: "session_expired",
  missing_state: "session_expired",
  token_exchange_failed: "sso_unavailable",
  no_email_claim: "sso_unavailable",
  missing_claims: "sso_unavailable",
};

/**
 * GET /api/auth/callback/entra
 * Validates the IdP response, provisions the user, and mints a server session.
 */
export async function GET(request: NextRequest) {
  const { ip, userAgent } = await clientContext();

  const result = await completeAuthorization(request.nextUrl, ip, userAgent);

  if (!result.ok) {
    await recordAttempt(null, ip, "failure", result.error, userAgent);
    logger.warn({ reason: result.error, ip }, "SSO callback rejected");
    const code = FAILURE_REDIRECTS[result.error] ?? "sso_failed";
    return redirectTo(`/login?error=${code}`);
  }

  try {
    const user = await upsertUserFromProfile(result.profile);

    if (user.status === "INACTIVE" || user.deactivatedAt) {
      await recordAttempt(result.profile.email, ip, "failure", "account_inactive", userAgent);
      return redirectTo("/login?error=account_inactive");
    }

    const { token, csrfToken, absoluteExpiresAt } = await createSession(
      user.id,
      ip,
      userAgent,
    );

    await setSessionCookies(token, csrfToken, absoluteExpiresAt);

    await recordAttempt(result.profile.email, ip, "success", null, userAgent);
    await audit({
      action: "auth.login",
      entityType: "session",
      entityId: user.id,
      targetUserId: user.id,
      summary: `${user.email} signed in via Entra ID`,
      actor: { id: user.id, email: user.email, role: user.systemRole },
      ipAddress: ip,
      userAgent,
    });

    return redirectTo(result.returnTo);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Post-SSO provisioning failed");
    await recordAttempt(result.profile.email, ip, "failure", "provisioning_failed", userAgent);
    return redirectTo("/login?error=sso_failed");
  }
}
