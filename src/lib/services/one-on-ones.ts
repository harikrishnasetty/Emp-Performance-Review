import "server-only";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import { oneOnOneActionItems, oneOnOnes, users } from "../db/schema";
import { decryptField } from "../crypto";

const manager = alias(users, "manager");
const employee = alias(users, "employee");

export type OneOnOneRow = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  agenda: { id: string; text: string; done: boolean }[];
  notes: string | null;
  mood: number | null;
  managerId: string;
  managerName: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string | null;
  actionItems: number;
  openActions: number;
};

export async function listOneOnOnes(userId: string, includePast = false): Promise<OneOnOneRow[]> {
  const conditions = [
    or(eq(oneOnOnes.managerId, userId), eq(oneOnOnes.employeeId, userId))!,
  ];
  if (!includePast) conditions.push(gte(oneOnOnes.scheduledAt, sql`now() - interval '1 day'`));

  const rows = await db
    .select({
      id: oneOnOnes.id,
      scheduledAt: oneOnOnes.scheduledAt,
      durationMinutes: oneOnOnes.durationMinutes,
      status: oneOnOnes.status,
      agenda: oneOnOnes.agenda,
      notesEnc: oneOnOnes.notesEnc,
      mood: oneOnOnes.mood,
      managerId: manager.id,
      managerName: manager.displayName,
      employeeId: employee.id,
      employeeName: employee.displayName,
      employeeAvatar: employee.avatarUrl,
      actionItems: sql<number>`(select count(*)::int from one_on_one_action_items a where a.meeting_id = ${oneOnOnes.id})`,
      openActions: sql<number>`(select count(*)::int from one_on_one_action_items a where a.meeting_id = ${oneOnOnes.id} and a.status <> 'DONE')`,
    })
    .from(oneOnOnes)
    .innerJoin(manager, eq(manager.id, oneOnOnes.managerId))
    .innerJoin(employee, eq(employee.id, oneOnOnes.employeeId))
    .where(and(...conditions))
    .orderBy(includePast ? desc(oneOnOnes.scheduledAt) : asc(oneOnOnes.scheduledAt))
    .limit(50);

  return rows.map((r) => ({
    ...r,
    notes: decryptField(r.notesEnc),
  }));
}

export async function getOneOnOne(id: string) {
  const [row] = await db
    .select({
      meeting: oneOnOnes,
      managerName: manager.displayName,
      employeeName: employee.displayName,
      employeeAvatar: employee.avatarUrl,
    })
    .from(oneOnOnes)
    .innerJoin(manager, eq(manager.id, oneOnOnes.managerId))
    .innerJoin(employee, eq(employee.id, oneOnOnes.employeeId))
    .where(eq(oneOnOnes.id, id))
    .limit(1);
  if (!row) return null;
  const actions = await db
    .select()
    .from(oneOnOneActionItems)
    .where(eq(oneOnOneActionItems.meetingId, id))
    .orderBy(asc(oneOnOneActionItems.createdAt));
  return {
    ...row.meeting,
    notes: decryptField(row.meeting.notesEnc),
    managerName: row.managerName,
    employeeName: row.employeeName,
    employeeAvatar: row.employeeAvatar,
    actionItems: actions,
  };
}

export async function openActionItemsFor(userId: string) {
  return db
    .select({
      id: oneOnOneActionItems.id,
      description: oneOnOneActionItems.description,
      dueDate: oneOnOneActionItems.dueDate,
      status: oneOnOneActionItems.status,
      meetingId: oneOnOneActionItems.meetingId,
      employeeName: employee.displayName,
    })
    .from(oneOnOneActionItems)
    .innerJoin(oneOnOnes, eq(oneOnOnes.id, oneOnOneActionItems.meetingId))
    .innerJoin(employee, eq(employee.id, oneOnOnes.employeeId))
    .where(
      and(
        eq(oneOnOneActionItems.ownerId, userId),
        inArray(oneOnOneActionItems.status, ["TODO", "IN_PROGRESS", "BLOCKED"]),
      ),
    )
    .orderBy(asc(oneOnOneActionItems.dueDate))
    .limit(10);
}
