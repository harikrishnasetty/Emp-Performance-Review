"use client";

import * as React from "react";
import Link from "next/link";
import { Sidebar, type NavGroup } from "./sidebar";
import { Topbar, type NotificationItem, type TopbarUser } from "./topbar";
import { CommandPalette } from "./command-palette";

export function AppShell({
  user,
  navGroups,
  notifications,
  unread,
  brand,
  footer,
  children,
}: {
  user: TopbarUser;
  navGroups: NavGroup[];
  notifications: NotificationItem[];
  unread: number;
  brand: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative flex min-h-dvh">
      <div className="aurora-field opacity-60" aria-hidden />
      <div className="grid-veil" aria-hidden />

      <Sidebar groups={navGroups} brand={brand} footer={footer} />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          notifications={notifications}
          unread={unread}
          onOpenSearch={() => setPaletteOpen(true)}
        />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[0.6875rem] text-ink-4">
            <p>
              {new Date().getFullYear()} MetricStream · Meridian is an internal system of
              record. Activity is audited.
            </p>
            <nav className="flex gap-4">
              <Link href="/settings" className="hover:text-ink-2">
                Preferences
              </Link>
              <Link href="/privacy" className="hover:text-ink-2">
                Data &amp; privacy
              </Link>
            </nav>
          </div>
        </footer>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

export function BrandBlock({ name, showSub = true }: { name: string; showSub?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5" aria-label={`${name} home`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="mk-shell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8468ff" />
            <stop offset="55%" stopColor="#6f4bff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#mk-shell)" opacity="0.16" />
        <rect x="1" y="1" width="30" height="30" rx="9" fill="none" stroke="url(#mk-shell)" strokeWidth="1.2" opacity="0.7" />
        <path
          d="M9 22V10.6l7 7.2 7-7.2V22"
          fill="none"
          stroke="url(#mk-shell)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0 leading-none">
        <p className="display truncate text-[1rem] font-semibold tracking-tight text-ink-1">
          {name}
        </p>
        {showSub ? (
          <p className="mt-0.5 text-[0.5625rem] uppercase tracking-[0.18em] text-ink-4">
            MetricStream
          </p>
        ) : null}
      </div>
    </Link>
  );
}
