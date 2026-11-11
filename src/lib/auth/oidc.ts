import "server-only";
import { headers } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as client from "openid-client";
import { env, allowedEmailDomains } from "../env";
import { db } from "../db";
import { authStates, loginAttempts, sessions, users } from "../db/schema";
import { randomToken, sha256Hex } from "../crypto";
import { logger } from "../logger";
import { audit } from "../audit";

/**
 * Azure Entra ID (OIDC) integration.
 *
 * Flow: Authorization Code + PKCE (S256), state + nonce, confidential client.
 * Everything is validated by `openid-client`: signature (JWKS), issuer,
 * audience, expiry and nonce. We add tenant pinning and email-domain
 * allow-listing on top.
 */

const REDIRECT_PATH = "/api/auth/callback/entra";
const STATE_TTL_SECONDS = 10 * 60;
const SCOPES = "openid profile email offline_access";

export function redirectUri(): string {
  return new URL(REDIRECT_PATH, env.APP_URL).toString();
}

let cachedConfig: client.Configuration | null = null;
let cachedAt = 0;
const CONFIG_TTL_MS = 60 * 60 * 1000; // re-discover hourly to pick up key rollover

export async function oidcConfig(): Promise<client.Configuration> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CONFIG_TTL_MS) return cachedConfig;

  const issuer = new URL(
    `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`,
  );

  cachedConfig = await client.discovery(
    issuer,
    env.ENTRA_CLIENT_ID,
    undefined,
    // The client secret is supplied as a post body rather than HTTP Basic.
    client.ClientSecretPost(env.ENTRA_CLIENT_SECRET),
  );
  cachedAt = now;
  return cachedConfig;
}

export type AuthStart = { url: string };

export async function beginAuthorization(
  returnTo: string | null,
  ipAddress: string | null,
): Promise<AuthStart> {
  const config = await oidcConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
    prompt: "select_account",
  });

  await db.insert(authStates).values({
    state,
    nonce,
    codeVerifier,
    returnTo: safeReturnTo(returnTo),
    ipAddress,
    expiresAt: new Date(Date.now() + STATE_TTL_SECONDS * 1000),
  });

  // Opportunistic GC — cheap, keeps the table tiny.
  await db
    .delete(authStates)
    .where(sql`${authStates.expiresAt} < now()`);

  return { url: url.toString() };
}

export type OidcProfile = {
  subject: string;
  tenantId: string | null;
  email: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  avatarUrl: string | null;
};

export type CompleteResult =
  | { ok: true; profile: OidcProfile; returnTo: string }
  | { ok: false; error: string };

export async function completeAuthorization(
  callbackUrl: URL,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<CompleteResult> {
  const state = callbackUrl.searchParams.get("state");
  if (!state) return { ok: false, error: "missing_state" };

  const [record] = await db
    .select()
    .from(authStates)
    .where(and(eq(authStates.state, state), sql`${authStates.expiresAt} > now()`))
    .limit(1);

  if (!record) return { ok: false, error: "invalid_state" };

  // Single-use — consume immediately, even if the rest fails.
  await db.delete(authStates).where(eq(authStates.id, record.id));

  if (record.ipAddress && ipAddress && record.ipAddress !== ipAddress) {
    logger.warn("OIDC callback IP mismatch — possible session fixation");
    return { ok: false, error: "ip_mismatch" };
  }

  const config = await oidcConfig();

  let tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers;
  try {
    tokens = await client.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: record.codeVerifier,
      expectedState: state,
      expectedNonce: record.nonce,
      idTokenExpected: true,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "OIDC token exchange failed");
    await recordAttempt(null, ipAddress, "failure", "token_exchange", userAgent);
    return { ok: false, error: "token_exchange_failed" };
  }

  const claims = tokens.claims();
  if (!claims) return { ok: false, error: "missing_claims" };

  // ── Identity hardening ────────────────────────────────────────────────
  const iss = String(claims.iss ?? "");
  if (env.ENTRA_STRICT_TENANT && !iss.includes(`/${env.ENTRA_TENANT_ID}/`)) {
    await recordAttempt(null, ipAddress, "failure", "wrong_tenant", userAgent);
    return { ok: false, error: "wrong_tenant" };
  }

  const email = String(
    claims.email ?? claims.preferred_username ?? claims.upn ?? "",
  )
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    await recordAttempt(null, ipAddress, "failure", "no_email", userAgent);
    return { ok: false, error: "no_email_claim" };
  }

  const domain = email.split("@")[1] ?? "";
  if (allowedEmailDomains.length > 0 && !allowedEmailDomains.includes(domain)) {
    await recordAttempt(email, ipAddress, "failure", "domain_not_allowed", userAgent);
    return { ok: false, error: "domain_not_allowed" };
  }

  const profile: OidcProfile = {
    subject: String(claims.sub),
    tenantId: claims.tid ? String(claims.tid) : null,
    email,
    displayName:
      String(claims.name ?? "").trim() ||
      [claims.given_name, claims.surname].filter(Boolean).join(" ") ||
      email.split("@")[0]!,
    givenName: claims.given_name ? String(claims.given_name) : null,
    surname: claims.surname ? String(claims.surname) : null,
    jobTitle: claims.jobTitle ? String(claims.jobTitle) : null,
    department: claims.department ? String(claims.department) : null,
    location: claims.officeLocation ? String(claims.officeLocation) : null,
    avatarUrl: null,
  };

  return {
    ok: true,
    profile,
    returnTo: safeReturnTo(record.returnTo),
  };
}

export async function recordAttempt(
  email: string | null,
  ipAddress: string | null,
  outcome: "success" | "failure",
  reason: string | null,
  userAgent: string | null,
): Promise<void> {
  try {
    await db.insert(loginAttempts).values({
      email,
      ipAddress,
      outcome,
      reason,
      userAgent: userAgent?.slice(0, 500) ?? null,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Failed to record login attempt");
  }
}

/* ────────────────────────────── Sessions ───────────────────────────────── */

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  systemRole: "ADMIN" | "HR" | "EXEC" | "USER";
  extraPermissions: string[];
  avatarUrl: string | null;
  status: string;
};

export type SessionContext = {
  sessionId: string;
  csrfTokenHash: string;
  user: SessionUser;
};

/**
 * Create a server-side session. The raw token lives only in the browser
 * cookie; the database stores its SHA-256 digest, so a database leak cannot
 * be replayed.
 */
export async function createSession(
  userId: string,
  ipAddress: string | null,
  userAgent: string | null,
  authMethod: "entra-oidc" | "local" = "entra-oidc",
): Promise<{ token: string; csrfToken: string; absoluteExpiresAt: Date }> {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const now = new Date();
  const absoluteExpiresAt = new Date(
    now.getTime() + env.SESSION_ABSOLUTE_HOURS * 3600 * 1000,
  );
  const idleExpiresAt = new Date(
    now.getTime() + env.SESSION_IDLE_MINUTES * 60 * 1000,
  );

  await db.insert(sessions).values({
    userId,
    tokenHash: sha256Hex(token),
    csrfHash: sha256Hex(csrfToken),
    authMethod,
    ipAddress,
    userAgent: userAgent?.slice(0, 500) ?? null,
    absoluteExpiresAt,
    idleExpiresAt,
  });

  await db
    .update(users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(users.id, userId));

  return { token, csrfToken, absoluteExpiresAt };
}

export async function resolveSession(
  token: string | undefined,
): Promise<SessionContext | null> {
  if (!token) return null;

  const tokenHash = sha256Hex(token);
  const rows = await db
    .select({
      sessionId: sessions.id,
      csrfHash: sessions.csrfHash,
      idleExpiresAt: sessions.idleExpiresAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
      revokedAt: sessions.revokedAt,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      jobTitle: users.jobTitle,
      departmentId: users.departmentId,
      managerId: users.managerId,
      systemRole: users.systemRole,
      extraPermissions: users.extraPermissions,
      avatarUrl: users.avatarUrl,
      status: users.status,
      deactivatedAt: users.deactivatedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;

  const now = Date.now();
  if (
    row.idleExpiresAt.getTime() < now ||
    row.absoluteExpiresAt.getTime() < now
  ) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: "expired" })
      .where(eq(sessions.id, row.sessionId));
    return null;
  }
  if (row.deactivatedAt || row.status === "INACTIVE") return null;

  // Slide the idle window at most once a minute to avoid a write per request.
  if (now - row.idleExpiresAt.getTime() < -60_000) {
    await db
      .update(sessions)
      .set({
        lastSeenAt: new Date(),
        idleExpiresAt: new Date(
          now + env.SESSION_IDLE_MINUTES * 60 * 1000,
        ),
      })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    csrfTokenHash: row.csrfHash,
    user: {
      id: row.userId,
      email: row.email,
      displayName: row.displayName,
      jobTitle: row.jobTitle,
      departmentId: row.departmentId,
      managerId: row.managerId,
      systemRole: row.systemRole,
      extraPermissions: row.extraPermissions ?? [],
      avatarUrl: row.avatarUrl,
      status: row.status,
    },
  };
}

export async function revokeSession(
  sessionId: string,
  reason: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(eq(sessions.id, sessionId));
}

export async function revokeAllSessions(
  userId: string,
  reason: string,
  exceptSessionId?: string,
): Promise<void> {
  const where = exceptSessionId
    ? and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        sql`${sessions.id} <> ${exceptSessionId}`,
      )
    : and(eq(sessions.userId, userId), isNull(sessions.revokedAt));
  await db.update(sessions).set({ revokedAt: new Date(), revokedReason: reason }).where(where);
}

/** Only allow local, single-slash paths as post-login redirects. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\")) return "/dashboard";
  return value;
}

/** Best-effort client IP, honouring `X-Forwarded-For` when behind nginx. */
export async function clientContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = env.TRUST_PROXY
    ? (forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null)
    : (h.get("x-real-ip") ?? null);
  return { ip, userAgent: h.get("user-agent") };
}

/**
 * Provision-or-update the local user record from the IdP profile.
 * This is JIT provisioning — no manual user creation required.
 */
export async function upsertUserFromProfile(profile: OidcProfile) {
  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${profile.email}`)
    .limit(1);

  const bootstrapAdmin =
    env.BOOTSTRAP_ADMIN_EMAIL &&
    profile.email === env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        entraObjectId: profile.subject,
        tenantId: profile.tenantId,
        displayName: profile.displayName,
        givenName: profile.givenName ?? existing.givenName,
        surname: profile.surname ?? existing.surname,
        jobTitle: profile.jobTitle ?? existing.jobTitle,
        location: profile.location ?? existing.location,
        avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
        // First Entra ID login for an admin-created local account: keep the
        // password working and record that both sign-in paths are enabled.
        authProvider: existing.passwordHash ? "BOTH" : existing.authProvider,
        // Promote the very first bootstrap admin only if they have no role yet.
        systemRole:
          bootstrapAdmin && existing.systemRole === "USER"
            ? "ADMIN"
            : existing.systemRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated!;
  }

  // Resolve manager by matching the Entra `manager` claim is not available
  // without Graph; instead the HR import / admin console sets reporting lines.
  const [created] = await db
    .insert(users)
    .values({
      entraObjectId: profile.subject,
      tenantId: profile.tenantId,
      email: profile.email,
      displayName: profile.displayName,
      givenName: profile.givenName,
      surname: profile.surname,
      jobTitle: profile.jobTitle,
      location: profile.location,
      avatarUrl: profile.avatarUrl,
      systemRole: bootstrapAdmin ? "ADMIN" : "USER",
    })
    .returning();

  await audit({
    action: "user.provisioned",
    entityType: "user",
    entityId: created!.id,
    targetUserId: created!.id,
    summary: `JIT provisioned ${profile.email} from Entra ID`,
  });

  return created!;
}
