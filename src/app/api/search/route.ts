import { NextResponse, type NextRequest } from "next/server";
import { and, ilike, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, reviewCycles, users } from "@/lib/db/schema";
import { guardRead } from "@/lib/http";
import { reportingSubtree } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=…
 * Federated quick search. Results are scoped to what the caller may see:
 * people across the directory (name/title only), goals owned by the caller's
 * reporting subtree (or their own), and published cycles.
 */
export async function GET(request: NextRequest) {
  const guard = await guardRead();
  if (!guard.ok) return guard.response;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const term = `%${q}%`;
  const viewer = guard.session.user;

  const subtree = await reportingSubtree(viewer.id);
  const goalScope = [...subtree, viewer.id];

  const [people, goalRows, cycles] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.displayName,
        title: users.jobTitle,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          isNull(users.deactivatedAt),
          sql`(${users.displayName} ilike ${term} or ${users.email} ilike ${term} or ${users.jobTitle} ilike ${term})`,
        ),
      )
      .limit(5),
    db
      .select({
        id: goals.id,
        title: goals.title,
        status: goals.status,
        progress: goals.progress,
      })
      .from(goals)
      .where(
        and(
          isNull(goals.archivedAt),
          ilike(goals.title, term),
          inArray(goals.ownerId, goalScope),
        ),
      )
      .limit(5),
    db
      .select({ id: reviewCycles.id, name: reviewCycles.name, status: reviewCycles.status })
      .from(reviewCycles)
      .where(
        and(
          ilike(reviewCycles.name, term),
          // Draft cycles are not announced yet and archived ones are noise.
          notInArray(reviewCycles.status, ["DRAFT", "ARCHIVED"]),
        ),
      )
      .limit(4),
  ]);

  const results = [
    ...people.map((p) => ({
      id: p.id,
      type: "person" as const,
      title: p.name,
      subtitle: p.title,
      href: `/people/${p.id}`,
      avatarUrl: p.avatarUrl,
    })),
    ...goalRows.map((g) => ({
      id: g.id,
      type: "goal" as const,
      title: g.title,
      subtitle: `${g.progress}% · ${g.status.replaceAll("_", " ").toLowerCase()}`,
      href: `/goals/${g.id}`,
    })),
    ...cycles.map((c) => ({
      id: c.id,
      type: "cycle" as const,
      title: c.name,
      subtitle: c.status.replaceAll("_", " ").toLowerCase(),
      href: `/reviews?cycle=${c.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
