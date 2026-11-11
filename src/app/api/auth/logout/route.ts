import { NextResponse, type NextRequest } from "next/server";
import { getSession, clearSessionCookies } from "@/lib/auth/session";
import { revokeSession } from "@/lib/auth/oidc";
import { audit } from "@/lib/audit";
import { redirectTo, assertOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * Server-side session revocation — a client-side cookie delete alone is not
 * sufficient because a stolen token would remain valid.
 */
export async function POST(request: NextRequest) {
  if (!assertOrigin(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  }

  const session = await getSession();
  if (session) {
    await revokeSession(session.sessionId, "user_logout");
    await audit({
      action: "auth.logout",
      entityType: "session",
      entityId: session.user.id,
      targetUserId: session.user.id,
      summary: `${session.user.email} signed out`,
      actor: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.systemRole,
      },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    });
  }

  await clearSessionCookies();

  const accepts = request.headers.get("accept") ?? "";
  if (accepts.includes("text/html")) {
    return redirectTo("/login");
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return redirectTo("/login");
}
