import { NextResponse, type NextRequest } from "next/server";
import { guardMutation } from "@/lib/http";
import { markAllRead } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await guardMutation(request, { limit: 30 });
  if (!guard.ok) return guard.response;
  await markAllRead(guard.session.user.id);
  return NextResponse.json({ ok: true });
}
