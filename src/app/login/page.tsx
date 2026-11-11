import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { LocalLoginForm } from "@/components/auth/local-login-form";
import { getSession } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/oidc";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_COPY: Record<string, string> = {
  domain_not_allowed:
    "That account is outside the MetricStream directory. Sign in with your @metricstream.com email.",
  wrong_tenant:
    "That identity belongs to a different organisation. Use your MetricStream work account.",
  session_expired: "Your sign-in attempt expired. Please start again.",
  sso_unavailable:
    "We couldn't reach the identity provider. Try again in a moment, or contact IT.",
  sso_failed: "Sign-in could not be completed. Please try again.",
  account_inactive:
    "Your account has been deactivated. Contact People Operations to restore access.",
  rate_limited: "Too many attempts from this network. Wait a minute and retry.",
};

const HIGHLIGHTS = [
  {
    icon: Target,
    title: "Goals that connect",
    body: "Objectives cascade from company OKRs down to individual commitments, with live progress and weekly check-ins.",
  },
  {
    icon: CalendarClock,
    title: "Review cycles on rails",
    body: "Self, manager, peer and skip-level reviews run on one timeline with automatic reminders and calibration.",
  },
  {
    icon: BarChart3,
    title: "Decisions backed by data",
    body: "Nine-box talent mapping, rating distributions and department benchmarks — without spreadsheet archaeology.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error ? ERROR_COPY[params.error] : null;
  // `next` is attacker-controllable, so it is sanitised once, server-side, and
  // then shared by both the SSO button and the local password form.
  const next = params.next ? safeReturnTo(params.next) : "";

  // Only a session that resolves against the database may skip the form. The
  // cookie alone is not proof — that is what the edge middleware used to do,
  // and a stale cookie caused a redirect loop with the app layout.
  if (!error) {
    const session = await getSession();
    if (session) redirect(next || "/dashboard");
  }

  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div className="aurora-field" aria-hidden />
      <div className="grid-veil" aria-hidden />

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-[1400px] grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
        {/* ── Brand side ─────────────────────────────────────────────── */}
        <section className="hidden flex-col justify-between px-10 py-10 lg:flex xl:px-16">
          <BrandMark />

          <div className="max-w-xl py-12">
            <p className="eyebrow mb-5">Performance intelligence</p>
            <h1 className="display text-[2.9rem] font-semibold leading-[1.05] tracking-tight xl:text-[3.4rem]">
              <span className="text-gradient">Clarity</span>
              <br />
              for every
              <br />
              career conversation.
            </h1>
            <p className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-ink-2">
              Meridian brings goals, continuous feedback and calibrated review
              cycles into one system of record — built and run in-house at
              MetricStream.
            </p>

            <div className="mt-10 space-y-5">
              {HIGHLIGHTS.map((h) => (
                <div key={h.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-brand-300">
                    <h.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-[0.875rem] font-semibold text-ink-1">
                      {h.title}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-3">
                      {h.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.6875rem] uppercase tracking-wider text-ink-4">
            <span className="inline-flex items-center gap-1.5">
              <Fingerprint className="size-3.5" /> Entra ID SSO
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" /> TLS 1.3
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Tamper-evident audit
            </span>
          </div>
        </section>

        {/* ── Sign-in side ───────────────────────────────────────────── */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[26rem]">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <BrandMark />
            </div>

            <div className="panel p-7 shadow-glow">
              <div className="mb-6">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[0.6875rem] font-medium text-ink-3">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint-400 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-mint-400" />
                  </span>
                  Single sign-on enabled
                </div>
                <h2 className="display text-[1.5rem] font-semibold tracking-tight text-ink-1">
                  Welcome to {env.APP_NAME}
                </h2>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">
                  Sign in with your MetricStream Microsoft account — or use the
                  local email and password issued by your administrator.
                </p>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-[0.8125rem] leading-relaxed text-rose-300"
                >
                  {error}
                </div>
              ) : null}

              {/*
                A plain anchor, not next/link: `/api/auth/login` creates OIDC
                state on every GET, so it must never be prefetched. A <Link>
                made the router fetch it in the background (and the resulting
                cross-origin redirect tripped the CSP connect-src rule).
              */}
              <a
                href={href}
                rel="nofollow"
                className="group flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#f4f6fb] text-[0.875rem] font-semibold text-[#0b1220] transition-all hover:bg-white active:scale-[0.99]"
              >
                <MicrosoftMark />
                Continue with Microsoft
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>

              <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-0/60 px-3 py-2.5">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-300" />
                <p className="text-[0.75rem] leading-relaxed text-ink-3">
                  New starters are provisioned automatically on first SSO
                  sign-in, and administrators can add local accounts directly
                  from the directory admin screen.
                </p>
              </div>

              <div className="hairline my-5" />

              <div className="mb-3 flex items-center gap-2">
                <div className="hairline flex-1" />
                <span className="text-[0.625rem] uppercase tracking-wider text-ink-4">
                  or
                </span>
                <div className="hairline flex-1" />
              </div>

              <LocalLoginForm next={next || "/dashboard"} />

              <div className="hairline my-5" />

              <dl className="grid grid-cols-2 gap-3 text-[0.6875rem]">
                <div>
                  <dt className="uppercase tracking-wider text-ink-4">Provider</dt>
                  <dd className="mt-0.5 font-medium text-ink-2">Microsoft Entra ID</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wider text-ink-4">Session</dt>
                  <dd className="mt-0.5 font-medium text-ink-2">
                    {env.SESSION_IDLE_MINUTES}m idle · {env.SESSION_ABSOLUTE_HOURS}h max
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 flex items-center justify-between text-[0.6875rem] text-ink-4">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" /> For MetricStream employees
              </span>
              <span>v1.0</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="mk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8468ff" />
            <stop offset="55%" stopColor="#6f4bff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#mk)" opacity="0.16" />
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="9"
          fill="none"
          stroke="url(#mk)"
          strokeWidth="1.2"
          opacity="0.7"
        />
        <path
          d="M9 22V10.6l7 7.2 7-7.2V22"
          fill="none"
          stroke="url(#mk)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="leading-none">
        <p className="display text-[1.0625rem] font-semibold tracking-tight text-ink-1">
          {env.APP_NAME}
        </p>
        <p className="mt-0.5 text-[0.625rem] uppercase tracking-[0.18em] text-ink-4">
          MetricStream
        </p>
      </div>
    </div>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}
