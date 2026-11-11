import { Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <PageHeader
        eyebrow="Legal"
        title="Privacy policy"
        description="How Meridian collects, uses and protects employee performance data."
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>What we collect</CardTitle>
          </div>
          <Shield className="size-4 text-ink-3" />
        </CardHeader>
        <CardContent className="space-y-3 text-[0.8125rem] leading-relaxed text-ink-3">
          <p>
            Meridian stores the information your organisation already holds about you — name,
            email, job title, department, reporting line, hire date and location — plus the
            performance data you and your managers create: goals, reviews, feedback, 1:1 notes
            and calibration outcomes.
          </p>
          <p>
            Sensitive free-text fields (such as review comments and 1:1 notes) are encrypted at
            rest with AES-256-GCM using a key held by your organisation, not by us.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it is used</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[0.8125rem] leading-relaxed text-ink-3">
          <p>
            Data is used solely to run the performance review process your organisation has
            configured: goal tracking, review cycles, calibration, analytics and reporting.
            Meridian does not sell, share or monetise personal data.
          </p>
          <p>
            Access is strictly role-based. Employees see their own record and their direct
            reports; managers see their reporting subtree; HR and administrators see the full
            organisation. Every privileged read and write is recorded in an append-only audit
            trail.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention and deletion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[0.8125rem] leading-relaxed text-ink-3">
          <p>
            Records are retained for as long as your organisation requires them for legal,
            regulatory or operational reasons. Deactivation soft-deletes a person's account and
            removes them from directories while preserving historical review records.
          </p>
          <p>
            Audit entries are append-only and are never edited or removed, even when a person is
            deactivated, so the integrity of the review process is always provable.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[0.8125rem] leading-relaxed text-ink-3">
          <p>
            Authentication is delegated to your organisation's identity provider via OpenID
            Connect with PKCE. Sessions are server-side, cookie-bound and rotated. All traffic is
            expected to run behind TLS. The application ships with a strict Content Security
            Policy, HSTS and host-header validation.
          </p>
          <p>
            If you believe your data has been handled incorrectly, contact your HR business
            partner or your organisation's data protection officer.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
