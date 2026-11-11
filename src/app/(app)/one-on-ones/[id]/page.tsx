import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Lock, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getOneOnOne } from "@/lib/services/one-on-ones";
import { MeetingWorkspace, type AgendaItem } from "@/components/one-on-ones/meeting-workspace";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "1:1" };

export default async function OneOnOnePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const meeting = await getOneOnOne(id);
  if (!meeting) notFound();

  const isManager = meeting.managerId === user.id;
  if (!isManager && meeting.employeeId !== user.id) notFound();

  const counterpartId = isManager ? meeting.employeeId : meeting.managerId;
  const counterpartName = isManager ? meeting.employeeName : meeting.managerName;
  const counterpartAvatar = isManager ? meeting.employeeAvatar : null;
  const agenda = (Array.isArray(meeting.agenda) ? meeting.agenda : []) as AgendaItem[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/one-on-ones"
          className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-ink-1"
        >
          <ArrowLeft className="size-3.5" /> All 1:1s
        </Link>
        <div className="flex items-center gap-2">
          {meeting.status === "COMPLETED" ? (
            <Badge tone="positive" dot>
              Completed
            </Badge>
          ) : meeting.status === "CANCELLED" ? (
            <Badge tone="neutral" dot>
              Cancelled
            </Badge>
          ) : (
            <Badge tone="info" dot>
              Scheduled
            </Badge>
          )}
          <Badge tone="neutral">{meeting.durationMinutes} minutes</Badge>
        </div>
      </div>

      <div className="panel relative overflow-hidden p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-64 rounded-full bg-aqua-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar name={counterpartName} src={counterpartAvatar} size={54} ring />
            <div className="min-w-0">
              <p className="eyebrow mb-1">{isManager ? "You're hosting" : "With your manager"}</p>
              <h1 className="display text-[1.35rem] font-semibold leading-tight text-ink-1 sm:text-[1.55rem]">
                {counterpartName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {formatDateTime(meeting.scheduledAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {meeting.durationMinutes} min
                </span>
                <span className="text-ink-4">{relativeTime(meeting.scheduledAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/people/${counterpartId}`}
              className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-[0.75rem] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1"
            >
              View profile
            </Link>
            <Link
              href={`/feedback?tab=given`}
              className="rounded-lg border border-line bg-surface-1 px-3 py-1.5 text-[0.75rem] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink-1"
            >
              Share feedback
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
        <MeetingWorkspace
          meeting={{
            id: meeting.id,
            status: meeting.status,
            agenda,
            notes: meeting.notes,
            mood: meeting.mood,
          }}
          actionItems={meeting.actionItems.map((a) => ({
            id: a.id,
            description: a.description,
            status: a.status,
            dueDate: a.dueDate,
            ownerId: a.ownerId,
          }))}
          viewerId={user.id}
          counterpartId={counterpartId}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <Users className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Participant
                name={meeting.managerName}
                role="Manager"
                self={meeting.managerId === user.id}
              />
              <Participant
                name={meeting.employeeName}
                role="Team member"
                self={meeting.employeeId === user.id}
              />
              <div className="hairline" />
              <p className="text-[0.6875rem] leading-relaxed text-ink-4">
                Only the two participants can open these notes. HR cannot read them without a
                documented, audited request.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <Lock className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                <span className="font-medium text-ink-2">Encrypted at rest.</span> Notes are sealed
                with AES-256-GCM before they reach the database.
              </p>
              <p>
                <span className="font-medium text-ink-2">No ratings.</span> 1:1s are for coaching,
                not scoring. Anything that should count belongs in a review or a goal check-in.
              </p>
              <p>
                <span className="font-medium text-ink-2">Audited access.</span> Administrative
                reads are written to the tamper-evident audit trail.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Participant({ name, role, self }: { name: string; role: string; self: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-medium text-ink-1">
          {name}
          {self ? <span className="ml-1.5 text-[0.6875rem] text-ink-4">(you)</span> : null}
        </p>
        <p className="text-[0.625rem] text-ink-4">{role}</p>
      </div>
    </div>
  );
}
