import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — readiness probe for nginx / orchestrators.
 * Returns 200 only when the database answers within the timeout.
 */
export async function GET() {
  const started = Date.now();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 2_500),
      ),
    ]);
    return NextResponse.json(
      {
        status: "ok",
        service: "meridian",
        uptime: Math.round(process.uptime()),
        dbLatencyMs: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", service: "meridian" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
