"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { oneOnOneActionItems, oneOnOnes } from "@/lib/db/schema";
import { action, auditAction, ActionError, type ActionResult } from "@/lib/actions";
import { encryptField } from "@/lib/crypto";
import { notify } from "@/lib/services/notifications";

const createSchema = z.object({
  employeeId: z.string().uuid(),
  scheduledAt: z.string().min(10),
  durationMinutes: z.coerce.number().int().min(15).max(180).default(30),
  agenda: z.array(z.string().max(400)).max(20).default([]),
});

export async function createOneOnOne(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "oneonone.create",
    schema: createSchema,
    input,
    limit: 30,
    handler: async (data, ctx) => {
      if (data.employeeId === ctx.user.id) {
        throw new ActionError("Pick the person you're meeting with.");
      }

      const scheduled = new Date(data.scheduledAt);
      if (Number.isNaN(scheduled.getTime())) {
        throw new ActionError("Enter a valid date and time.", "validation", {
          scheduledAt: "Invalid date",
        });
      }

      const [row] = await db
        .insert(oneOnOnes)
        .values({
          managerId: ctx.user.id,
          employeeId: data.employeeId,
          scheduledAt: scheduled,
          durationMinutes: data.durationMinutes,
          agenda: data.agenda
            .filter((t) => t.trim())
            .map((text, i) => ({ id: String(i), text: text.trim(), done: false })),
        })
        .returning({ id: oneOnOnes.id });

      await notify({
        userId: data.employeeId,
        type: "oneonone.scheduled",
        title: `${ctx.user.displayName} scheduled a 1:1`,
        body: scheduled.toLocaleString("en-GB"),
        href: `/one-on-ones/${row!.id}`,
        actorId: ctx.user.id,
      });

      await auditAction(ctx, {
        action: "oneonone.created",
        entityType: "one_on_one",
        entityId: row!.id,
        targetUserId: data.employeeId,
        summary: "1:1 scheduled",
      });

      revalidatePath("/one-on-ones");
      return { id: row!.id };
    },
  });
}

const updateSchema = z.object({
  meetingId: z.string().uuid(),
  notes: z.string().max(20000).optional(),
  mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  agenda: z
    .array(z.object({ id: z.string(), text: z.string().max(400), done: z.boolean() }))
    .max(40)
    .optional(),
});

export async function updateOneOnOne(input: unknown): Promise<ActionResult<null>> {
  return action({
    name: "oneonone.update",
    schema: updateSchema,
    input,
    limit: 120,
    handler: async (data, ctx) => {
      const [row] = await db
        .select()
        .from(oneOnOnes)
        .where(eq(oneOnOnes.id, data.meetingId))
        .limit(1);
      if (!row) throw new ActionError("That 1:1 no longer exists.");
      if (row.managerId !== ctx.user.id && row.employeeId !== ctx.user.id) {
        throw new ActionError("You aren't part of this 1:1.", "forbidden");
      }

      await db
        .update(oneOnOnes)
        .set({
          ...(data.notes !== undefined ? { notesEnc: encryptField(data.notes) } : {}),
          ...(data.mood !== undefined ? { mood: data.mood } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.agenda ? { agenda: data.agenda } : {}),
          updatedAt: new Date(),
        })
        .where(eq(oneOnOnes.id, data.meetingId));

      const other = row.managerId === ctx.user.id ? row.employeeId : row.managerId;
      if (data.status === "COMPLETED") {
        await notify({
          userId: other,
          type: "oneonone.completed",
          title: "1:1 notes are ready",
          body: "Notes and action items from your recent conversation are available.",
          href: `/one-on-ones/${data.meetingId}`,
          actorId: ctx.user.id,
        });
      }

      revalidatePath(`/one-on-ones/${data.meetingId}`);
      revalidatePath("/one-on-ones");
      return null;
    },
  });
}

const actionItemSchema = z.object({
  meetingId: z.string().uuid(),
  description: z.string().min(2).max(400),
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: z.string().optional(),
});

export async function addActionItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  return action({
    name: "oneonone.action.add",
    schema: actionItemSchema,
    input,
    limit: 120,
    handler: async (data, ctx) => {
      const [meeting] = await db
        .select()
        .from(oneOnOnes)
        .where(eq(oneOnOnes.id, data.meetingId))
        .limit(1);
      if (!meeting) throw new ActionError("Meeting not found.");
      if (meeting.managerId !== ctx.user.id && meeting.employeeId !== ctx.user.id) {
        throw new ActionError("You aren't part of this 1:1.", "forbidden");
      }

      const [row] = await db
        .insert(oneOnOneActionItems)
        .values({
          meetingId: data.meetingId,
          description: data.description.trim(),
          ownerId: data.ownerId || meeting.employeeId,
          dueDate: data.dueDate || null,
        })
        .returning({ id: oneOnOneActionItems.id });

      revalidatePath(`/one-on-ones/${data.meetingId}`);
      return { id: row!.id };
    },
  });
}

export async function toggleActionItem(input: {
  id: string;
  done: boolean;
}): Promise<ActionResult<null>> {
  return action({
    name: "oneonone.action.toggle",
    schema: z.object({ id: z.string().uuid(), done: z.boolean() }),
    input,
    limit: 240,
    handler: async (data, ctx) => {
      const [item] = await db
        .select({ item: oneOnOneActionItems, meeting: oneOnOnes })
        .from(oneOnOneActionItems)
        .innerJoin(oneOnOnes, eq(oneOnOnes.id, oneOnOneActionItems.meetingId))
        .where(eq(oneOnOneActionItems.id, data.id))
        .limit(1);

      if (!item) throw new ActionError("Action item not found.");
      if (
        item.meeting.managerId !== ctx.user.id &&
        item.meeting.employeeId !== ctx.user.id
      ) {
        throw new ActionError("You aren't part of this 1:1.", "forbidden");
      }

      await db
        .update(oneOnOneActionItems)
        .set({
          status: data.done ? "DONE" : "TODO",
        })
        .where(eq(oneOnOneActionItems.id, data.id));

      revalidatePath(`/one-on-ones/${item.meeting.id}`);
      return null;
    },
  });
}
