import Link from "next/link";
import { KeyRound, Lock, ShieldCheck, User, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getPerson } from "@/lib/services/people";
import { countDirectReports } from "@/lib/services/people";
import { getMyReviewTasks } from "@/lib/services/reviews";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { SignOutAllButton } from "@/components/settings/signout-all-button";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Preferences" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [person, reports, tasks] = await Promise.all([
    getPerson(user.id),
    countDirectReports(user.id),
    getMyReviewTasks(user.id),
  ]);

  const pendingReviews = tasks.filter(
    (t) => t.status !== "SUBMITTED" && t.status !== "ACKNOWLEDGED",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Preferences"
        description="Your identity, security posture and data controls. Most profile fields are managed by your organisation's directory."
      />

      <div className="grid grid-cols-2 gap-3 stagger xl:grid-cols-4">
        <Stat
          label="Role"
          value={user.systemRole}
          hint="System-wide permission level"
          icon={<ShieldCheck />}
          tone="brand"
        />
        <Stat
          label="Direct reports"
          value={reports}
          hint={reports ? "People who report to you" : "Individual contributor"}
          icon={<Users />}
          tone="info"
        />
        <Stat
          label="Open reviews"
          value={pendingReviews}
          hint="Tasks waiting on you"
          icon={<User />}
          tone={pendingReviews ? "warning" : "positive"}
        />
        <Stat
          label="Sessions"
          value="Active"
          hint="Server-side, hash-rotated tokens"
          icon={<KeyRound />}
          tone="positive"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profile</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                Read from your organisation's directory
              </p>
            </div>
            <User className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} src={user.avatarUrl} size={48} />
              <div className="min-w-0">
                <p className="truncate text-[0.9375rem] font-semibold text-ink-1">
                  {user.displayName}
                </p>
                <p className="truncate text-[0.75rem] text-ink-3">{user.email}</p>
                {user.jobTitle ? (
                  <p className="truncate text-[0.75rem] text-ink-4">{user.jobTitle}</p>
                ) : null}
              </div>
            </div>
            <div className="hairline" />
            <dl className="grid grid-cols-1 gap-y-2 text-[0.8125rem] sm:grid-cols-2">
              <div>
                <dt className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  Department
                </dt>
                <dd className="text-ink-2">{person?.departmentName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  Manager
                </dt>
                <dd className="text-ink-2">{person?.managerId ? "Assigned" : "—"}</dd>
              </div>
              <div>
                <dt className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  Location
                </dt>
                <dd className="text-ink-2">{person?.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  Status
                </dt>
                <dd className="text-ink-2">{person?.status ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  Joined
                </dt>
                <dd className="text-ink-2">{person?.hireDate ? formatDate(person.hireDate) : "—"}</dd>
              </div>
            </dl>
            <p className="text-[0.6875rem] text-ink-4">
              Need a correction? Ask your HR business partner — profile edits are audited and
              restricted to the directory admin.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Security</CardTitle>
              <p className="mt-0.5 text-[0.8125rem] text-ink-3">
                How you sign in and how sessions are protected
              </p>
            </div>
            <Lock className="size-4 text-ink-3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-line bg-surface-0/60 p-3">
              <div className="flex items-start gap-3">
                <Badge
                  tone={
                    person?.authProvider === "SSO"
                      ? "positive"
                      : person?.authProvider === "BOTH"
                        ? "info"
                        : "warning"
                  }
                  dot
                >
                  {person?.authProvider === "BOTH"
                    ? "SSO + Local"
                    : person?.authProvider === "LOCAL"
                      ? "Local"
                      : "SSO"}
                </Badge>
                <div>
                  <p className="text-[0.8125rem] font-medium text-ink-1">
                    {person?.authProvider === "BOTH"
                      ? "Local password + Azure Entra ID"
                      : person?.authProvider === "LOCAL"
                        ? "Local email and password"
                        : "Azure Entra ID (OIDC)"}
                  </p>
                  <p className="text-[0.6875rem] leading-relaxed text-ink-3">
                    {person?.authProvider === "SSO"
                      ? "Sign-in uses Authorization Code + PKCE, with tenant pinning and an email-domain allow-list. Sessions are server-side, cookie-bound and rotated."
                      : "This account can sign in with the email and password issued by your administrator. Passwords are hashed with scrypt and never stored in plaintext."}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface-0/60 p-3 space-y-2">
              <p className="text-[0.8125rem] font-medium text-ink-1">Session hygiene</p>
              <ul className="space-y-1 text-[0.75rem] leading-relaxed text-ink-3">
                <li>· Idle sessions expire after the configured timeout.</li>
                <li>· Absolute session lifetime is enforced server-side.</li>
                <li>· CSRF tokens are double-submitted and rotated on renewal.</li>
                <li>· Role changes and deactivation revoke every active session.</li>
              </ul>
            </div>
            {person?.authProvider !== "SSO" ? <ChangePasswordForm /> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.8125rem] font-medium text-ink-1">Sign out everywhere</p>
                <p className="text-[0.6875rem] text-ink-3">
                  Revokes every active session on every device, including this one.
                </p>
              </div>
              <SignOutAllButton />
            </div>
            <div className="hairline" />
            <Link
              href="/privacy"
              className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-300 hover:text-brand-200"
            >
              Read the privacy policy
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Notifications</CardTitle>
            <p className="mt-0.5 text-[0.8125rem] text-ink-3">
              How Meridian reaches you
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-[0.8125rem] leading-relaxed text-ink-3">
            In-app notifications are always on. Email digests follow your organisation's policy
            and can be tuned by your HR business partner. There are no third-party trackers or
            marketing emails.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
