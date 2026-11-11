import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { competencies, feedback, feedbackRequests, users } from "../db/schema";
import { decryptField } from "../crypto";

const giver = alias(users, "giver");
const receiver = alias(users, "receiver");
const provider = alias(users, "provider");

export type FeedbackItem = {
  id: string;
  type: string;
  visibility: string;
  message: string;
  isAnonymous: boolean;
  createdAt: Date;
  acknowledgedAt: Date | null;
  competencyName: string | null;
  giverId: string;
  giverName: string;
  giverAvatar: string | null;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string | null;
};

/**
 * Visibility rules:
 *  • giver always sees their own feedback
 *  • receiver always sees feedback addressed to them
 *  • MANAGER visibility → only the receiver's manager
 *  • TEAM / ORGANIZATION → anyone in the org tree of the receiver
 *  • PRIVATE → giver only
 */
export async function listFeedbackFor(
  viewerId: string,
  scope: "received" | "given" | "wall",
  teamIds: string[] = [],
  limit = 40,
): Promise<FeedbackItem[]> {
  let condition;
  if (scope === "received") {
    condition = and(eq(feedback.receiverId, viewerId), isNull(feedback.archivedAt));
  } else if (scope === "given") {
    condition = and(eq(feedback.giverId, viewerId), isNull(feedback.archivedAt));
  } else {
    condition = and(
      isNull(feedback.archivedAt),
      or(
        eq(feedback.visibility, "ORGANIZATION"),
        and(eq(feedback.visibility, "TEAM"), inArray(feedback.receiverId, teamIds.length ? teamIds : [viewerId])),
      ),
    );
  }

  const rows = await db
    .select({
      id: feedback.id,
      type: feedback.type,
      visibility: feedback.visibility,
      messageEnc: feedback.messageEnc,
      isAnonymous: feedback.isAnonymous,
      createdAt: feedback.createdAt,
      acknowledgedAt: feedback.acknowledgedAt,
      competencyName: competencies.name,
      giverId: giver.id,
      giverName: giver.displayName,
      giverAvatar: giver.avatarUrl,
      receiverId: receiver.id,
      receiverName: receiver.displayName,
      receiverAvatar: receiver.avatarUrl,
    })
    .from(feedback)
    .innerJoin(giver, eq(giver.id, feedback.giverId))
    .innerJoin(receiver, eq(receiver.id, feedback.receiverId))
    .leftJoin(competencies, eq(competencies.id, feedback.competencyId))
    .where(condition)
    .orderBy(desc(feedback.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    message: decryptField(r.messageEnc) ?? "",
    // Honour anonymity for everyone except the giver themselves.
    giverName: r.isAnonymous && r.giverId !== viewerId ? "Anonymous" : r.giverName,
    giverAvatar: r.isAnonymous && r.giverId !== viewerId ? null : r.giverAvatar,
    giverId: r.isAnonymous && r.giverId !== viewerId ? "anonymous" : r.giverId,
  }));
}

/**
 * Feedback *about* one person, filtered by what the viewer is allowed to read.
 * Used on profile pages; the same visibility rules as the main feed apply.
 */
export async function listFeedbackAbout(
  subjectId: string,
  viewerId: string,
  opts: { viewerManagesSubject: boolean; sharedTeam: boolean },
  limit = 20,
): Promise<FeedbackItem[]> {
  const visibility =
    subjectId === viewerId
      ? undefined // the subject can read everything written about them
      : or(
          eq(feedback.visibility, "ORGANIZATION"),
          eq(feedback.giverId, viewerId),
          opts.viewerManagesSubject ? eq(feedback.visibility, "MANAGER") : undefined,
          opts.sharedTeam ? eq(feedback.visibility, "TEAM") : undefined,
        );

  const rows = await db
    .select({
      id: feedback.id,
      type: feedback.type,
      visibility: feedback.visibility,
      messageEnc: feedback.messageEnc,
      isAnonymous: feedback.isAnonymous,
      createdAt: feedback.createdAt,
      acknowledgedAt: feedback.acknowledgedAt,
      competencyName: competencies.name,
      giverId: giver.id,
      giverName: giver.displayName,
      giverAvatar: giver.avatarUrl,
      receiverId: receiver.id,
      receiverName: receiver.displayName,
      receiverAvatar: receiver.avatarUrl,
    })
    .from(feedback)
    .innerJoin(giver, eq(giver.id, feedback.giverId))
    .innerJoin(receiver, eq(receiver.id, feedback.receiverId))
    .leftJoin(competencies, eq(competencies.id, feedback.competencyId))
    .where(
      and(
        eq(feedback.receiverId, subjectId),
        isNull(feedback.archivedAt),
        ...(visibility ? [visibility] : []),
      ),
    )
    .orderBy(desc(feedback.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    message: decryptField(r.messageEnc) ?? "",
    giverName: r.isAnonymous && r.giverId !== viewerId ? "Anonymous" : r.giverName,
    giverAvatar: r.isAnonymous && r.giverId !== viewerId ? null : r.giverAvatar,
    giverId: r.isAnonymous && r.giverId !== viewerId ? "anonymous" : r.giverId,
  }));
}

export async function feedbackStats(userIds: string[]) {  if (userIds.length === 0) return { received: 0, praise: 0, constructive: 0 };
  const [row] = await db
    .select({
      received: sql<number>`count(*)::int`,
      praise: sql<number>`count(*) filter (where ${feedback.type} in ('PRAISE','RECOGNITION'))::int`,
      constructive: sql<number>`count(*) filter (where ${feedback.type} = 'CONSTRUCTIVE')::int`,
    })
    .from(feedback)
    .where(and(inArray(feedback.receiverId, userIds), isNull(feedback.archivedAt)));
  return row ?? { received: 0, praise: 0, constructive: 0 };
}

export async function getFeedbackRequests(userId: string) {
  return db
    .select({
      id: feedbackRequests.id,
      message: feedbackRequests.message,
      status: feedbackRequests.status,
      dueDate: feedbackRequests.dueDate,
      createdAt: feedbackRequests.createdAt,
      requesterId: feedbackRequests.requesterId,
      requesterName: giver.displayName,
      requesterAvatar: giver.avatarUrl,
      providerId: feedbackRequests.providerId,
      providerName: provider.displayName,
      providerAvatar: provider.avatarUrl,
    })
    .from(feedbackRequests)
    .innerJoin(giver, eq(giver.id, feedbackRequests.requesterId))
    .innerJoin(provider, eq(provider.id, feedbackRequests.providerId))
    .where(
      or(
        eq(feedbackRequests.providerId, userId),
        eq(feedbackRequests.requesterId, userId),
      ),
    )
    .orderBy(desc(feedbackRequests.createdAt))
    .limit(40);
}
