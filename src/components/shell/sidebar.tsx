"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/primitives";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export function Sidebar({
  groups,
  brand,
  footer,
}: {
  groups: NavGroup[];
  brand: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  React.useEffect(() => {
    const stored = localStorage.getItem("meridian.rail");
    if (stored === "collapsed") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      localStorage.setItem("meridian.rail", c ? "expanded" : "collapsed");
      return !c;
    });
  };

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const nav = (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="mb-1.5 px-2.5 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-ink-4">
              {group.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-line" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item);
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-brand-500/12 text-ink-1"
                      : "text-ink-3 hover:bg-surface-3 hover:text-ink-1",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand-400"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "shrink-0 [&_svg]:size-[1.0625rem]",
                      active ? "text-brand-300" : "text-ink-3 group-hover:text-ink-2",
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed ? (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-500 px-1 text-[0.625rem] font-bold text-white">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                    </>
                  ) : item.badge ? (
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand-400" />
                  ) : null}
                </Link>
              );

              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-5 left-5 z-40 flex size-11 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface-1 animate-rise">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              {brand}
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink-1"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            {nav}
            <div className="border-t border-line p-3">{footer}</div>
          </div>
        </div>
      ) : null}

      {/* Desktop rail */}
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface-0/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.25rem]" : "w-[15.5rem]",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-line px-4",
            collapsed && "justify-center px-0",
          )}
        >
          {brand}
        </div>

        {nav}

        <div className="border-t border-line p-3">
          {collapsed ? null : footer}
          <button
            type="button"
            onClick={toggleCollapse}
            className={cn(
              "mt-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.6875rem] font-medium text-ink-4 transition-colors hover:bg-surface-3 hover:text-ink-2",
              collapsed && "justify-center px-0",
            )}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            <ChevronLeft
              className={cn("size-3.5 transition-transform", collapsed && "rotate-180")}
            />
            {!collapsed ? "Collapse" : null}
          </button>
        </div>
      </aside>
    </>
  );
}

export function NavBadge({ count }: { count: number }) {
  if (!count) return null;
  return <Badge tone="brand">{count}</Badge>;
}
