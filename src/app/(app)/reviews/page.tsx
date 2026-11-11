import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  Info,
  Send,
  Undo2,
  UsersRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  cycleProgress,
  getActiveCycle,
  getMyReviewTasks,
  getReviewsAboutMe,
  listCycles,
  reviewerTypeLabel,
} from "@/lib/services/reviews";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { MeterBar, ProgressRing } from "@/components/ui/progress";
import {
  cn,
  cycleStatusMeta,
  daysUntil,
  formatDate,
  relativeTime,
  reviewStatusMeta,
} from "@/lib/utils";

export const metadata = { title: "Reviews" };

const TABS = [
  { key: "queue", label: "My queue" },
  { key: "about", label: "About me" },
  { key: "cycles", label: "Cycles" },
];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "queue";

  const [tasks, aboutMe, cycle, cycles] = await Promise.all([
    getMyReviewTasks(user.id),
    getReviewsAboutMe(user.id),
    getActiveCycle(),
    listCycles(),
  ]);

  const progress = cycle ? await cycleProgress(cycle.id) : null;
  const pending = tasks.filter(
    (t) => t.status !== "SUBMITTED" && t.status !== "ACKNOWLEDGED" && t.status !== "LOCKED",
  );
  const submitted = tasks.filter(
    (t) => t.status === "SUBMITTED" || t.status === "ACKNOWLEDGED" || t.status === "LOCKED",
  );
  const toAcknowledge = aboutMe.filter((r) => r.status === "SUBMITTED");
  const managerPending = pending.filter((t) => t.reviewerType === "MANAGER").length;
  const selfPending = pending.filter((t) => t.reviewerType === "SELF").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Performance reviews"
        title="Review workspace"
        description="Everything you owe, everything written about you, and where the cycle stands."
        actions={
          cycle ? (
            <Badge tone="brand" dot>
              {cycle.name} · {cycleStatusMeta[cycle.status]?.label ?? cycle.status}
            </Badge>
          ) : (
            <Badge tone="neutral">No active cycle</Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="To write"
          value={pending.length}
          hint={pending.length ? "Drafts and not started" : "Nothing outstanding"}
          icon={<ClipboardCheck />}
          tone={pending.length ? "warning" : "positive"}
        />
        <Stat
          label="Self assessments"
          value={selfPending}
          hint="Your reflection on the cycle"
          icon={<Send />}
          tone={selfPending ? "info" : "positive"}
        />
        <Stat
          label="Manager reviews"
          value={managerPending}
          hint="Reviews you owe your team"
          icon={<UsersRound />}
          tone={managerPending ? "warning" : "positive"}
        />
        <Stat
          label="Awaiting your acknowledgement"
          value={toAcknowledge.length}
          hint="Submitted and ready to read"
          icon={<Inbox />}
          tone={toAcknowledge.length ? "brand" : "positive"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "queue" ? "/reviews" : `/reviews?tab=${t.key}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[0.75rem] font-medium transition-colors",
              tab === t.key
                ? "border-brand-500/40 bg-brand-500/12 text-brand-200"
                : "border-line bg-surface-1 text-ink-3 hover:border-line-strong hover:text-ink-1",
            )}
          >
            {t.label}
            {t.key === "about" && toAcknowledge.length ? (
              <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 text-[0.625rem] font-bold text-white">
                {toAcknowledge.length}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {tab === "queue" ? (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Needs your attention</CardTitle>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                    Drafts are private until you submit them.
                  </p>
                </div>
                <Badge tone={pending.length ? "warning" : "positive"} dot>
                  {pending.length} open
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {pending.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle2 />}
                    title="Your queue is clear"
                    description="When a review is assigned — your own or someone you manage — it appears here."
                  />
                ) : (
                  pending.map((task) => <ReviewRow key={task.id} task={task} />)
                )}
              </CardContent>
            </Card>

            {submitted.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Submitted</CardTitle>
                  <span className="text-[0.6875rem] text-ink-4">
                    {submitted.length} completed
                  </span>
                </CardHeader>
                <CardContent className="space-y-2">
                  {submitted.map((task) => (
                    <ReviewRow key={task.id} task={task} />
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            {cycle && progress ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Cycle progress</CardTitle>
                    <p className="mt-0.5 text-[0.8125rem] text-ink-3">{cycle.name}</p>
                  </div>
                  <ProgressRing
                    value={progress.total ? (progress.complete / progress.total) * 100 : 0}
                    size={54}
                    stroke={5}
                    tone="info"
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <ProgressLine label="Self reviews" done={progress.selfDone} total={progress.total} />
                  <ProgressLine
                    label="Manager reviews"
                    done={progress.managerDone}
                    total={progress.total}
                  />
                  <ProgressLine label="Complete" done={progress.complete} total={progress.total} />
                  <div className="hairline" />
                  <div className="space-y-1.5 text-[0.75rem] text-ink-3">
                    {cycle.selfReviewDue ? (
                      <p className="flex justify-between">
                        <span>Self review due</span>
                        <span className="text-ink-2">{formatDate(cycle.selfReviewDue)}</span>
                      </p>
                    ) : null}
                    {cycle.managerReviewDue ? (
                      <p className="flex justify-between">
                        <span>Manager review due</span>
                        <span className="text-ink-2">{formatDate(cycle.managerReviewDue)}</span>
                      </p>
                    ) : null}
                    <p className="flex justify-between">
                      <span>Period</span>
                      <span className="text-ink-2">
                        {formatDate(cycle.periodStart, { month: "short", year: "numeric" })} –{" "}
                        {formatDate(cycle.periodEnd, { month: "short", year: "numeric" })}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No active cycle</CardTitle>
                  <CalendarClock className="size-4 text-ink-3" />
                </CardHeader>
                <CardContent>
                  <p className="py-4 text-[0.8125rem] leading-relaxed text-ink-3">
                    People Operations hasn&apos;t opened a cycle yet. Keep your goals and
                    check-ins current — they feed the next review automatically.
                  </p>
                  <LinkButton href="/goals" variant="outline" size="sm" className="w-full">
                    Review my goals
                  </LinkButton>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>How scoring works</CardTitle>
                <Info className="size-4 text-ink-3" />
              </CardHeader>
              <CardContent className="space-y-2.5 text-[0.75rem] leading-relaxed text-ink-3">
                <p>
                  <span className="font-medium text-ink-2">Goals</span> — weighted goal progress
                  from your check-ins, normalised to 100%.
                </p>
                <p>
                  <span className="font-medium text-ink-2">Competencies</span> — weighted average
                  of your manager&apos;s ratings against the cycle template.
                </p>
                <p>
                  <span className="font-medium text-ink-2">Calibration</span> — People partners
                  review the distribution before ratings are finalised.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "about" ? (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Written about you</CardTitle>
                <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                  Only submitted and acknowledged reviews are visible here.
                </p>
              </div>
              <Badge tone="neutral">{aboutMe.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {aboutMe.length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title="Nothing published yet"
                  description="When your manager submits a review, it appears here for you to read and acknowledge."
                />
              ) : (
                aboutMe.map((review) => {
                  const meta = reviewStatusMeta[review.status] ?? reviewStatusMeta.SUBMITTED!;
                  return (
                    <Link
                      key={review.id}
                      href={`/reviews/${review.id}`}
                      className="block rounded-xl border border-line bg-surface-0/50 p-3.5 transition-colors hover:border-line-strong"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar
                          name={review.reviewerName}
                          src={review.reviewerAvatar}
                          size={28}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-ink-1">
                            {reviewerTypeLabel(review.reviewerType)} · {review.reviewerName}
                          </p>
                          <p className="truncate text-[0.6875rem] text-ink-3">
                            {review.cycleName} · submitted {relativeTime(review.submittedAt)}
                          </p>
                        </div>
                        {review.overallRating ? (
                          <Badge tone="brand" className="tabular">
                            {Number(review.overallRating).toFixed(1)}
                          </Badge>
                        ) : null}
                        <Badge tone={meta.tone as "neutral"} dot>
                          {meta.label}
                        </Badge>
                        <ArrowUpRight className="size-3.5 text-ink-4" />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reading your review</CardTitle>
              <CheckCircle2 className="size-4 text-mint-400" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[0.75rem] leading-relaxed text-ink-3">
              <p>
                Your manager writes against the same competency framework used across the
                company. Comments are encrypted at rest.
              </p>
              <p>
                Acknowledging confirms you&apos;ve read it — it isn&apos;t agreement. If
                something needs correcting, send it back with a short reason.
              </p>
              <p className="rounded-lg border border-line bg-surface-0/60 px-2.5 py-2 text-[0.6875rem]">
                Self assessments stay private to you and your manager. Peer feedback is never
                attributed without consent.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "cycles" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Review cycles</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                The last {cycles.length} cycle{cycles.length === 1 ? "" : "s"} and their
                completion.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {cycles.length === 0 ? (
              <EmptyState
                icon={<CalendarClock />}
                title="No cycles yet"
                description="Cycles are created by People Operations. You'll be notified when one opens."
              />
            ) : (
              cycles.map((c) => {
                const meta = cycleStatusMeta[c.status] ?? cycleStatusMeta.DRAFT!;
                const percentage = c.participants
                  ? Math.round((c.completed / c.participants) * 100)
                  : 0;
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-line bg-surface-0/50 p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink-1">
                        {c.name}
                      </p>
                      <Badge tone={meta.tone as "neutral"} dot>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[0.6875rem] text-ink-3">
                      {formatDate(c.periodStart)} – {formatDate(c.periodEnd)} ·{" "}
                      {c.templateName ?? "No template"}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2.5">
                      <MeterBar value={percentage} tone={percentage === 100 ? "positive" : "brand"} />
                      <span className="w-20 shrink-0 text-right text-[0.6875rem] tabular text-ink-3">
                        {c.completed}/{c.participants} done
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ReviewRow({
  task,
}: {
  task: Awaited<ReturnType<typeof getMyReviewTasks>>[number];
}) {
  const meta = reviewStatusMeta[task.status] ?? reviewStatusMeta.NOT_STARTED!;
  const due = daysUntil(task.dueDate);
  const overdue = due !== null && due < 0;
  const isSelf = task.reviewerType === "SELF";

  return (
    <Link
      href={`/reviews/${task.id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface-0/50 p-3 transition-colors hover:border-line-strong"
    >
      <Avatar
        name={task.subjectName}
        src={task.subjectAvatar}
        size={34}
        ring={task.status === "NOT_STARTED"}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-medium text-ink-1">
          {isSelf ? "Your self assessment" : task.subjectName}
        </p>
        <p className="truncate text-[0.6875rem] text-ink-3">
          {reviewerTypeLabel(task.reviewerType)} · {task.cycleName}
          {task.departmentName ? ` · ${task.departmentName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={meta.tone as "neutral"} dot>
          {meta.label}
        </Badge>
        {task.dueDate ? (
          <span
            className={cn(
              "text-[0.625rem]",
              overdue ? "text-rose-400" : due !== null && due <= 5 ? "text-amber-400" : "text-ink-4",
            )}
          >
            {overdue
              ? `${Math.abs(due!)}d overdue`
              : `due ${formatDate(task.dueDate, { day: "2-digit", month: "short" })}`}
          </span>
        ) : null}
      </div>
      {task.status === "RETURNED" ? (
        <Undo2 className="size-4 shrink-0 text-rose-400" />
      ) : (
        <ArrowUpRight className="size-4 shrink-0 text-ink-4" />
      )}
    </Link>
  );
}

function ProgressLine({
  label,
  done,
  total,
}: {
  label: string;
  done: number;
  total: number;
}) {
  const percentage = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[0.75rem]">
        <span className="text-ink-3">{label}</span>
        <span className="tabular text-ink-2">
          {done}/{total}
        </span>
      </div>
      <MeterBar value={percentage} tone={percentage === 100 ? "positive" : "brand"} />
    </div>
  );
}
