"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/cycles", label: "Cycles" },
  { href: "/admin/goal-dashboard", label: "Goal dashboard" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/calibration", label: "Calibration" },
  { href: "/admin/people", label: "Directory" },
  { href: "/admin/audit", label: "Audit trail" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Administration sections"
      className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-1 p-1"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
              active
                ? "bg-surface-3 text-ink-1 shadow-[inset_0_1px_0_#ffffff0d]"
                : "text-ink-3 hover:bg-surface-2 hover:text-ink-1",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
