import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5">
      <div className="aurora-field" aria-hidden />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-400">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="display text-2xl font-semibold text-ink-1">
          You don&apos;t have access to this area
        </h1>
        <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-3">
          Your role doesn&apos;t include this permission. If you believe this is a
          mistake, ask your manager or People Operations to review your access.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-9.5 items-center rounded-[0.65rem] bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-400"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
