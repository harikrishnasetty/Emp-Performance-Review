import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  MessageSquareHeart,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { countDirectReports, getDirectReports, getOrgTree, getTeamIds, type OrgNode } from "@/lib/services/people";
import { teamGoalBreakdown, teamSnapshot, activityFeedFor } from "@/lib/services/analytics";
import { listOneOnOnes } from "@/lib/services/one-on-ones";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar } from "@/components/ui/progress";
import { formatDateTime, relativeTime } from "@/lib/utils";

export const metadata = { title: "My team" };

export default async function TeamPage() {
  const user = await requireUser();
  const reports = await countDirectReports(user.id);
  if (reports === 0 && !can(user, "analytics:org")) redirect("/forbidden");

  const teamIds = await getTeamIds(user.id);
  const [snapshot, breakdown, feed, tree, directReports, upcoming] = await Promise.all([
    teamSnapshot(teamIds),
    teamGoalBreakdown(teamIds),
    activityFeedFor(teamIds, 10),
    getOrgTree(user.id, 4),
    getDirectReports(user.id),
    listOneOnOnes(user.id, false),
  ]);

  const nextOneOnOnes = upcoming.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leadership"
        title="My team"
        description="The health of your org at a glance — progress, risk, conversations and recognition."
        actions={
          <>
            <LinkButton href="/analytics" variant="outline" size="md">
              <TrendingUp className="size-4" /> Org analytics
            </LinkButton>
            <LinkButton href="/one-on-ones" variant="secondary" size="md">
              <CalendarDays className="size-4" /> 1:1s
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Team size"
          value={snapshot.headcount}
          hint={`${directReports.length} direct report${directReports.length === 1 ? "" : "s"}`}
          icon={<UsersRound />}
          tone="brand"
        />
        <Stat
          label="Avg goal progress"
          value={`${snapshot.avgProgress}%`}
          hint="Weighted across the team"
          icon={<Target />}
          tone={snapshot.avgProgress >= 60 ? "positive" : "warning"}
        />
        <Stat
          label="At risk"
          value={snapshot.atRisk}
          hint={snapshot.atRisk ? "Needs a conversation this week" : "Nothing flagged"}
          icon={<TrendingDown />}
          tone={snapshot.atRisk ? "danger" : "positive"}
        />
        <Stat
          label="Feedback shared"
          value={snapshot.feedback}
          hint="Recognition received by the team"
          icon={<MessageSquareHeart />}
          tone="info"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Goal health by person</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Sorted by weighted progress. Lower scores first when you need to intervene.
                </p>
              </div>
              <Target className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              {breakdown.length === 0 ? (
                <EmptyState
                  icon={<Target />}
                  title="No goals in your tree yet"
                  description="Once people set goals they'll appear here with progress and risk flags."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-2">
                  {breakdown.map((member) => (
                    <li key={member.id}>
                      <Link
                        href={`/people/${member.id}`}
                        className="flex items-center gap-3 rounded-xl border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong"
                      >
                        <Avatar name={member.name} src={member.avatarUrl} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[0.8125rem] font-medium text-ink-1">
                              {member.name}
                            </p>
                            {member.atRisk > 0 ? (
                              <Badge tone="warning">{member.atRisk} at risk</Badge>
                            ) : member.goalCount === 0 ? (
                              <Badge tone="neutral">no goals</Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-[0.625rem] text-ink-4">
                            {member.jobTitle ?? "MetricStream"} · {member.goalCount} goal
                            {member.goalCount === 1 ? "" : "s"}
                          </p>
                          <div className="mt-1.5">
                            <MeterBar
                              value={member.avgProgress}
                              tone={
                                member.atRisk > 0
                                  ? "warning"
                                  : member.avgProgress >= 70
                                    ? "positive"
                                    : "brand"
                              }
                            />
                          </div>
                        </div>
                        <span className="tabular shrink-0 text-[0.8125rem] font-semibold text-ink-2">
                          {member.avgProgress}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Reporting structure</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Four levels below you. Click through to any profile.
                </p>
              </div>
              <Users className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              {tree && tree.reports.length > 0 ? (
                <ul className="space-y-1">
                  {tree.reports.map((node) => (
                    <OrgBranch key={node.id} node={node} depth={0} />
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-[0.8125rem] text-ink-3">No reports on record.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Next 1:1s</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">Your conversation cadence</p>
              </div>
              <CalendarDays className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-2">
              {nextOneOnOnes.length === 0 ? (
                <p className="py-3 text-[0.8125rem] text-ink-3">
                  Nothing scheduled.{" "}
                  <Link href="/one-on-ones" className="text-brand-300 hover:text-brand-200">
                    Book time
                  </Link>
                  .
                </p>
              ) : (
                nextOneOnOnes.map((meeting) => {
                  const other =
                    meeting.managerId === user.id ? meeting.employeeName : meeting.managerName;
                  return (
                    <Link
                      key={meeting.id}
                      href={`/one-on-ones/${meeting.id}`}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-0/50 p-2.5 transition-colors hover:border-line-strong"
                    >
                      <Avatar
                        name={other}
                        src={meeting.managerId === user.id ? meeting.employeeAvatar : null}
                        size={26}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.75rem] font-medium text-ink-1">{other}</p>
                        <p className="truncate text-[0.625rem] text-ink-4">
                          {formatDateTime(meeting.scheduledAt)}
                        </p>
                      </div>
                      <span className="text-[0.625rem] text-ink-4">
                        {relativeTime(meeting.scheduledAt)}
                      </span>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">Check-ins and recognition</p>
              </div>
              <Activity className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent>
              {feed.length === 0 ? (
                <p className="py-3 text-[0.8125rem] text-ink-3">Nothing yet this week.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-3.5">
                  {feed.map((item, index) => (
                    <li key={`${item.kind}-${index}`} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[1.13rem] top-1.5 size-1.5 rounded-full bg-brand-400"
                      />
                      <p className="text-[0.75rem] leading-snug text-ink-2">
                        <span className="font-medium text-ink-1">{item.actor}</span>{" "}
                        {item.kind === "goal_update" ? "checked in on" : "shared feedback"}{" "}
                        <span className="text-ink-3">{item.title}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[0.625rem] text-ink-4">
                        {item.meta ? <span>{item.meta}</span> : null}
                        <span>{relativeTime(item.at)}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Direct reports</CardTitle>
              <ArrowUpRight className="size-4 text-ink-3" />
            </CardHeader>
            <CardContent className="space-y-1.5">
              {directReports.length === 0 ? (
                <p className="text-[0.8125rem] text-ink-3">You have no direct reports.</p>
              ) : (
                directReports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/people/${report.id}`}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <Avatar name={report.displayName} src={report.avatarUrl} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.75rem] text-ink-1">{report.displayName}</p>
                      <p className="truncate text-[0.625rem] text-ink-4">
                        {report.jobTitle ?? "MetricStream"}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OrgBranch({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <li>
      <Link
        href={`/people/${node.id}`}
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2"
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        {depth > 0 ? (
          <ChevronRight className="size-3 shrink-0 text-ink-4" aria-hidden />
        ) : null}
        <Avatar name={node.displayName} src={node.avatarUrl} size={depth === 0 ? 26 : 22} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.75rem] text-ink-1">{node.displayName}</span>
          <span className="block truncate text-[0.625rem] text-ink-4">
            {node.jobTitle ?? node.departmentName ?? "MetricStream"}
            {node.reports.length > 0 ? ` · ${node.reports.length} reports` : ""}
          </span>
        </span>
      </Link>
      {node.reports.length > 0 ? (
        <ul className="space-y-0.5">
          {node.reports.map((child) => (
            <OrgBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
