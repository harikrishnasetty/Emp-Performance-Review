import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HeartHandshake,
  Inbox,
  Lightbulb,
  MessageSquareHeart,
  Send,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  feedbackStats,
  getFeedbackRequests,
  listFeedbackFor,
} from "@/lib/services/feedback";
import { getDirectReports, getPerson, getTeamIds } from "@/lib/services/people";
import { listCompetencies } from "@/lib/services/reviews";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { RequestFeedbackDialog } from "@/components/feedback/request-feedback-dialog";
import { AcknowledgeFeedbackButton } from "@/components/feedback/acknowledge-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import {
  cn,
  feedbackTypeMeta,
  formatDate,
  relativeTime,
} from "@/lib/utils";
import type { PersonOption } from "@/components/people/person-picker";

export const metadata = { title: "Feedback" };

const TABS = [
  { key: "received", label: "Received", icon: <ArrowDownLeft /> },
  { key: "given", label: "Given", icon: <ArrowUpRight /> },
  { key: "wall", label: "Recognition wall", icon: <Sparkles /> },
];

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "received";

  const [teamIds, reports, manager, competencies, requests] = await Promise.all([
    getTeamIds(user.id),
    getDirectReports(user.id),
    user.managerId ? getPerson(user.managerId) : Promise.resolve(null),
    listCompetencies(),
    getFeedbackRequests(user.id),
  ]);

  const [items, stats] = await Promise.all([
    listFeedbackFor(user.id, tab as "received" | "given" | "wall", teamIds, 40),
    feedbackStats([user.id]),
  ]);

  const suggestions: PersonOption[] = [
    ...reports.map(toOption),
    ...(manager ? [toOption(manager)] : []),
  ];
  const pendingRequests = requests.filter(
    (r) => r.providerId === user.id && r.status === "PENDING",
  );
  const sentRequests = requests.filter((r) => r.requesterId === user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Continuous feedback"
        title="Feedback & recognition"
        description="Capture what happened while it's fresh. Great feedback is specific, behavioural and kind."
        actions={
          <>
            <RequestFeedbackDialog people={suggestions} />
            <FeedbackDialog
              people={suggestions}
              competencies={competencies.map((c) => ({ id: c.id, name: c.name }))}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Feedback received"
          value={stats.received}
          hint="All time"
          icon={<Inbox />}
          tone="brand"
        />
        <Stat
          label="Praise & recognition"
          value={stats.praise}
          hint={stats.received ? `${Math.round((stats.praise / stats.received) * 100)}% of total` : "No feedback yet"}
          icon={<Sparkles />}
          tone="positive"
        />
        <Stat
          label="Constructive"
          value={stats.constructive}
          hint="Growth-oriented notes"
          icon={<Lightbulb />}
          tone="warning"
        />
        <Stat
          label="Requests waiting on you"
          value={pendingRequests.length}
          hint={pendingRequests.length ? "Colleagues asked for input" : "Nothing pending"}
          icon={<HeartHandshake />}
          tone={pendingRequests.length ? "warning" : "positive"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "received" ? "/feedback" : `/feedback?tab=${t.key}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[0.75rem] font-medium transition-colors [&_svg]:size-3.5",
              tab === t.key
                ? "border-brand-500/40 bg-brand-500/12 text-brand-200"
                : "border-line bg-surface-1 text-ink-3 hover:border-line-strong hover:text-ink-1",
            )}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-3">
          {items.length === 0 ? (
            <EmptyState
              icon={<MessageSquareHeart />}
              title={
                tab === "given"
                  ? "You haven't shared feedback yet"
                  : tab === "wall"
                    ? "The wall is quiet"
                    : "No feedback yet"
              }
              description={
                tab === "given"
                  ? "A two-line note after a meeting is worth more than a perfect paragraph next quarter."
                  : "Ask a colleague for feedback, or recognise someone publicly — it shows up here."
              }
              action={
                tab === "given" ? (
                  <FeedbackDialog
                    people={suggestions}
                    competencies={competencies.map((c) => ({ id: c.id, name: c.name }))}
                    trigger={<Button size="sm">Share feedback</Button>}
                  />
                ) : (
                  <RequestFeedbackDialog
                    people={suggestions}
                    trigger={<Button size="sm" variant="outline">Request feedback</Button>}
                  />
                )
              }
            />
          ) : (
            items.map((item) => {
              const typeMeta = feedbackTypeMeta[item.type] ?? feedbackTypeMeta.PRAISE!;
              const receivedByMe = item.receiverId === user.id;
              return (
                <article
                  key={item.id}
                  className="panel p-4 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={item.giverName}
                      src={item.giverAvatar}
                      size={36}
                      ring={!item.acknowledgedAt && receivedByMe}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[0.8125rem] font-semibold text-ink-1">
                          {item.giverId === user.id ? "You" : item.giverName}
                        </p>
                        <span className="text-[0.6875rem] text-ink-4">→</span>
                        <Link
                          href={`/people/${item.receiverId}`}
                          className="text-[0.8125rem] font-medium text-ink-2 hover:text-ink-1"
                        >
                          {item.receiverId === user.id ? "you" : item.receiverName}
                        </Link>
                        <Badge tone={typeMeta.tone as "neutral"}>{typeMeta.label}</Badge>
                        <Badge tone="neutral">
                          {visibilityLabel(item.visibility)}
                        </Badge>
                        {item.isAnonymous ? <Badge tone="neutral">anonymous</Badge> : null}
                        <span className="ml-auto shrink-0 text-[0.625rem] text-ink-4">
                          {relativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-2">
                        {item.message}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {item.competencyName ? (
                          <Badge tone="info">{item.competencyName}</Badge>
                        ) : null}
                        {receivedByMe && !item.acknowledgedAt ? (
                          <AcknowledgeFeedbackButton feedbackId={item.id} />
                        ) : null}
                        {item.acknowledgedAt ? (
                          <span className="text-[0.625rem] text-mint-400">
                            Acknowledged {relativeTime(item.acknowledgedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Feedback requests</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  {pendingRequests.length} waiting on you
                </p>
              </div>
              <Send className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingRequests.length === 0 ? (
                <p className="py-3 text-[0.8125rem] text-ink-3">
                  No open requests. You can ask up to 10 colleagues for input.
                </p>
              ) : (
                pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-line bg-surface-0/50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={request.requesterName}
                        src={request.requesterAvatar}
                        size={24}
                      />
                      <p className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-ink-1">
                        {request.requesterName}
                      </p>
                      {request.dueDate ? (
                        <span className="text-[0.625rem] text-ink-4">
                          {formatDate(request.dueDate, { day: "2-digit", month: "short" })}
                        </span>
                      ) : null}
                    </div>
                    {request.message ? (
                      <p className="mt-1.5 line-clamp-3 text-[0.75rem] leading-relaxed text-ink-3">
                        {request.message}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <FeedbackDialog
                        people={suggestions}
                        competencies={competencies.map((c) => ({
                          id: c.id,
                          name: c.name,
                        }))}
                        defaultReceiver={{
                          id: request.requesterId,
                          name: request.requesterName,
                          jobTitle: null,
                          avatarUrl: request.requesterAvatar,
                        }}
                        trigger={
                          <Button size="sm" variant="secondary">
                            Respond
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ))
              )}

              {sentRequests.length > 0 ? (
                <>
                  <div className="hairline my-1" />
                  <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                    You asked
                  </p>
                  {sentRequests.slice(0, 4).map((r) => (
                    <p
                      key={r.id}
                      className="flex items-center justify-between gap-2 text-[0.75rem] text-ink-3"
                    >
                      <span className="min-w-0 truncate">{r.providerName}</span>
                      <Badge tone={r.status === "PENDING" ? "warning" : "positive"}>
                        {r.status.toLowerCase()}
                      </Badge>
                    </p>
                  ))}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Make it land</CardTitle>
              <Lightbulb className="size-4 text-amber-400" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                <span className="font-medium text-ink-2">Situation → behaviour → impact.</span>{" "}
                Name the moment, what the person did, and why it mattered.
              </p>
              <p>
                <span className="font-medium text-ink-2">Be timely.</span> Feedback within a
                week is coaching; feedback at review time is a surprise.
              </p>
              <p>
                <span className="font-medium text-ink-2">Ask first.</span> For constructive
                notes, check whether now is a good moment.
              </p>
              <div className="rounded-lg border border-brand-500/20 bg-brand-500/[0.06] px-2.5 py-2 text-[0.6875rem] text-ink-2">
                Anonymous feedback still records the author in the audit trail to prevent
                abuse.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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

function visibilityLabel(value: string): string {
  return (
    {
      PRIVATE: "private",
      MANAGER: "manager visible",
      TEAM: "team visible",
      ORGANIZATION: "public",
    } as Record<string, string>
  )[value] ?? value.toLowerCase();
}
