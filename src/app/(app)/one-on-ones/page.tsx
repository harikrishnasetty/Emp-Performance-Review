import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  MessageSquareQuote,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  listOneOnOnes,
  openActionItemsFor,
  type OneOnOneRow,
} from "@/lib/services/one-on-ones";
import { getDirectReports, getPerson } from "@/lib/services/people";
import { getActiveCycle } from "@/lib/services/reviews";
import { ScheduleDialog } from "@/components/one-on-ones/schedule-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar } from "@/components/ui/progress";
import type { PersonOption } from "@/components/people/person-picker";
import { cn, formatDate, formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "1:1s" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "History" },
];

export default async function OneOnOnesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "upcoming";

  const [reports, manager, upcoming, history, openActions, cycle] = await Promise.all([
    getDirectReports(user.id),
    user.managerId ? getPerson(user.managerId) : Promise.resolve(null),
    listOneOnOnes(user.id, false),
    tab === "past" ? listOneOnOnes(user.id, true) : Promise.resolve([]),
    openActionItemsFor(user.id),
    getActiveCycle(),
  ]);

  const suggestions: PersonOption[] = [...reports.map(toOption), ...(manager ? [toOption(manager)] : [])];

  const now = Date.now();
  const thisWeek = upcoming.filter((m) => {
    const at = new Date(m.scheduledAt).getTime();
    return at >= now && at <= now + 7 * 86_400_000;
  }).length;
  const completed = history.filter((m) => m.status === "COMPLETED").length;

  const rows = tab === "past" ? history : upcoming;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conversations that compound"
        title="One-on-ones"
        description="A shared agenda, honest notes and a short list of commitments — the operating rhythm behind good performance."
        actions={<ScheduleDialog reports={suggestions} />}
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Scheduled"
          value={upcoming.length}
          hint={thisWeek ? `${thisWeek} in the next 7 days` : "Nothing this week"}
          icon={<CalendarDays />}
          tone="brand"
        />
        <Stat
          label="Open commitments"
          value={openActions.length}
          hint={openActions.length ? "Follow-ups assigned to you" : "All clear"}
          icon={<ListChecks />}
          tone={openActions.length ? "warning" : "positive"}
        />
        <Stat
          label="Completed"
          value={completed}
          hint={history.length ? `${history.length} conversations on record` : "No history yet"}
          icon={<CalendarCheck />}
          tone="positive"
        />
        <Stat
          label="Active cycle"
          value={cycle ? cycle.name.replace(/q[1-4]|20\d\d/gi, "").trim() || "Live" : "—"}
          hint={cycle ? `Status: ${cycle.status.replaceAll("_", " ").toLowerCase()}` : "No open cycle"}
          icon={<CalendarClock />}
          tone="info"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "upcoming" ? "/one-on-ones" : `/one-on-ones?tab=${t.key}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[0.75rem] font-medium transition-colors",
              tab === t.key
                ? "border-brand-500/40 bg-brand-500/12 text-brand-200"
                : "border-line bg-surface-1 text-ink-3 hover:border-line-strong hover:text-ink-1",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={<CalendarDays />}
              title={tab === "past" ? "No past conversations" : "Nothing scheduled"}
              description={
                tab === "past"
                  ? "Once you complete a 1:1 it moves here with its notes and commitments."
                  : "Pick a person, a time and three topics. Thirty minutes is enough to start."
              }
              action={
                tab === "upcoming" ? (
                  <ScheduleDialog
                    reports={suggestions}
                    trigger={<Button size="sm">Schedule your first 1:1</Button>}
                  />
                ) : undefined
              }
            />
          ) : (
            rows.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} userId={user.id} />)
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Your commitments</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Open follow-ups from past conversations
                </p>
              </div>
              <ListChecks className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2">
              {openActions.length === 0 ? (
                <p className="py-3 text-[0.8125rem] text-ink-3">
                  Nothing outstanding. That&apos;s a good sign.
                </p>
              ) : (
                openActions.map((item) => (
                  <Link
                    key={item.id}
                    href={`/one-on-ones/${item.meetingId}`}
                    className="block rounded-xl border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong"
                  >
                    <p className="text-[0.8125rem] leading-snug text-ink-2">{item.description}</p>
                    <p className="mt-1 flex items-center gap-2 text-[0.625rem] text-ink-4">
                      <span>{item.employeeName}</span>
                      {item.dueDate ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>due {formatDate(item.dueDate, { day: "2-digit", month: "short" })}</span>
                        </>
                      ) : null}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>A good 1:1</CardTitle>
              <MessageSquareQuote className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                <span className="font-medium text-ink-2">They talk more than you.</span> Aim for
                70/30 — your job is questions, not updates.
              </p>
              <p>
                <span className="font-medium text-ink-2">Agenda lives here.</span> Both people add
                topics before the meeting so nothing important gets squeezed out.
              </p>
              <p>
                <span className="font-medium text-ink-2">End with one commitment.</span> A single
                action item finished beats five promised.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MeetingCard({ meeting, userId }: { meeting: OneOnOneRow; userId: string }) {
  const viewerIsManager = meeting.managerId === userId;
  const otherName = viewerIsManager ? meeting.employeeName : meeting.managerName;
  const otherAvatar = viewerIsManager ? meeting.employeeAvatar : null;
  const agendaTotal = meeting.agenda?.length ?? 0;
  const agendaDone = meeting.agenda?.filter((a) => a.done).length ?? 0;
  const status =
    meeting.status === "COMPLETED"
      ? { label: "Completed", tone: "positive" as const }
      : meeting.status === "CANCELLED"
        ? { label: "Cancelled", tone: "neutral" as const }
        : { label: "Scheduled", tone: "info" as const };

  return (
    <Link
      href={`/one-on-ones/${meeting.id}`}
      className="panel panel-hover block p-4 transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar name={otherName} src={otherAvatar} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.875rem] font-semibold text-ink-1">{otherName}</p>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {meeting.openActions > 0 ? (
              <Badge tone="warning">{meeting.openActions} open</Badge>
            ) : meeting.actionItems > 0 ? (
              <Badge tone="neutral">all done</Badge>
            ) : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3" />
              {formatDateTime(meeting.scheduledAt)}
            </span>
            <span>{meeting.durationMinutes} min</span>
            <span>{viewerIsManager ? "you host" : "you're invited"}</span>
            <span className="text-ink-4">{relativeTime(meeting.scheduledAt)}</span>
          </p>
          {agendaTotal > 0 ? (
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-[0.625rem] text-ink-4">
                <span>
                  Agenda {agendaDone}/{agendaTotal}
                </span>
                <span className="flex items-center gap-1">
                  {agendaDone === agendaTotal ? (
                    <>
                      <CheckCircle2 className="size-3 text-mint-400" /> ready
                    </>
                  ) : (
                    `${agendaTotal - agendaDone} to cover`
                  )}
                </span>
              </div>
              <MeterBar value={agendaTotal ? (agendaDone / agendaTotal) * 100 : 0} />
            </div>
          ) : null}
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-ink-4" />
      </div>
    </Link>
  );
}

function toOption(person: {
  id: string;
  displayName: string;
  jobTitle: string | null;
  avatarUrl: string | null;
}): PersonOption {
  return {
    id: person.id,
    name: person.displayName,
    jobTitle: person.jobTitle,
    avatarUrl: person.avatarUrl,
  };
}
