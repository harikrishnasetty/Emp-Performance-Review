"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { feedback, feedbackRequests } from "@/lib/db/schema";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";
import { encryptField } from "@/lib/crypto";
import { notify } from "@/lib/services/notifications";

const createFeedbackSchema = z.object({
  receiverId: z.string().uuid(),
  type: z.enum(["PRAISE", "CONSTRUCTIVE", "COACHING", "RECOGNITION"]),
  visibility: z.enum(["PRIVATE", "MANAGER", "TEAM", "ORGANIZATION"]).default("MANAGER"),
  message: z.string().min(10, "Share at least a couple of sentences.").max(4000),
  competencyId: z.string().uuid().nullable().optional(),
  isAnonymous: z.boolean().default(false),
});

export async function createFeedback(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "feedback.create",
    schema: createFeedbackSchema,
    input,
    limit: 60,
    handler: async (data, ctx) => {
      if (data.receiverId === ctx.user.id) {
        throw new ActionError("You can't give feedback to yourself.");
      }

      const visibility = data.visibility;

      const [row] = await db
        .insert(feedback)
        .values({
          giverId: ctx.user.id,
          receiverId: data.receiverId,
          type: data.type,
          visibility,
          messageEnc: encryptField(data.message.trim())!,
          competencyId: data.competencyId || null,
          isAnonymous: data.isAnonymous,
        })
        .returning({ id: feedback.id });

      await notify({
        userId: data.receiverId,
        type: "feedback.received",
        title: data.isAnonymous
          ? "You received new feedback"
          : `${ctx.user.displayName} shared feedback with you`,
        body: data.message.slice(0, 140),
        href: "/feedback",
        actorId: data.isAnonymous ? undefined : ctx.user.id,
        entityType: "feedback",
        entityId: row!.id,
      });

      await auditAction(ctx, {
        action: "feedback.created",
        entityType: "feedback",
        entityId: row!.id,
        targetUserId: data.receiverId,
        summary: `${data.type} feedback shared`,
        metadata: { anonymous: data.isAnonymous, visibility },
      });

      revalidatePath("/feedback");
      revalidatePath("/dashboard");
      return { id: row!.id };
    },
  });
}

const requestSchema = z.object({
  providerIds: z.array(z.string().uuid()).min(1).max(10),
  message: z.string().max(1000).optional(),
  dueDate: z.string().optional(),
});

export async function requestFeedback(input: unknown): Promise<ActionResult<{ created: number }>> {
  return action({
    name: "feedback.request",
    schema: requestSchema,
    input,
    limit: 20,
    handler: async (data, ctx) => {
      const rows = data.providerIds
        .filter((id) => id !== ctx.user.id)
        .map((providerId) => ({
          requesterId: ctx.user.id,
          providerId,
          message: data.message?.trim() || null,
          dueDate: data.dueDate || null,
        }));

      if (rows.length === 0) throw new ActionError("Pick at least one colleague.");

      await db.insert(feedbackRequests).values(rows);

      await Promise.all(
        rows.map((r) =>
          notify({
            userId: r.providerId,
            type: "feedback.requested",
            title: `${ctx.user.displayName} asked for your feedback`,
            body: r.message ?? "Share what you've observed working with them.",
            href: "/feedback?tab=requests",
            actorId: ctx.user.id,
          }),
        ),
      );

      await auditAction(ctx, {
        action: "feedback.requested",
        entityType: "feedback_request",
        summary: `Requested feedback from ${rows.length} colleague(s)`,
      });

      revalidatePath("/feedback");
      return { created: rows.length };
    },
  });
}

export async function acknowledgeFeedback(feedbackId: string): Promise<ActionResult<null>> {
  return action({
    name: "feedback.acknowledge",
    schema: z.string().uuid(),
    input: feedbackId,
    limit: 60,
    handler: async (id, ctx) => {
      const [row] = await db.select().from(feedback).where(eq(feedback.id, id)).limit(1);
      if (!row) throw new ActionError("Feedback not found.");
      if (row.receiverId !== ctx.user.id) {
        throw new ActionError("Only the recipient can acknowledge feedback.", "forbidden");
      }
      await db
        .update(feedback)
        .set({ acknowledgedAt: new Date() })
        .where(and(eq(feedback.id, id), eq(feedback.receiverId, ctx.user.id)));
      revalidatePath("/feedback");
      return null;
    },
  });
}
