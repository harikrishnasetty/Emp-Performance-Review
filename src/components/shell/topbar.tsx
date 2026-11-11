"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Check,
  ChevronDown,
  Command,
  LogOut,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { relativeTime, cn } from "@/lib/utils";
import { csrfToken } from "@/lib/client/hooks";

export type TopbarUser = {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  systemRole: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
  type: string;
};

export function Topbar({
  user,
  notifications,
  unread,
  onOpenSearch,
}: {
  user: TopbarUser;
  notifications: NotificationItem[];
  unread: number;
  onOpenSearch: () => void;
}) {
  const router = useRouter();
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("meridian.theme", next);
    setTheme(next);
  };

  const logout = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        // Never pretend the user signed out — the server-side session would
        // still be live, so a stolen cookie would keep working.
        throw new Error(`Sign-out failed (${res.status})`);
      }
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const markRead = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
    });
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface-0/75 px-4 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={onOpenSearch}
        className="group flex h-9 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface-1 px-3 text-[0.8125rem] text-ink-4 transition-colors hover:border-line-strong hover:text-ink-2 sm:max-w-md"
        aria-label="Search Meridian"
      >
        <Search className="size-3.5" />
        <span className="truncate">Search people, goals, reviews…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3 sm:flex">
          <Command className="size-2.5" />K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex size-8.5 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-1"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative flex size-8.5 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink-1"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell className="size-4" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-brand-500 text-[0.5625rem] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <p className="text-[0.8125rem] font-semibold text-ink-1">Notifications</p>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markRead}
                  className="text-[0.6875rem] font-medium text-brand-300 hover:text-brand-200"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-[0.8125rem] text-ink-3">
                  You&apos;re all caught up.
                </p>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.href ?? "/dashboard"}
                    className={cn(
                      "flex gap-2.5 border-b border-line px-3 py-2.5 transition-colors last:border-0 hover:bg-surface-3",
                      !n.readAt && "bg-brand-500/[0.06]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        n.readAt ? "bg-transparent" : "bg-brand-400",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium leading-snug text-ink-1">
                        {n.title}
                      </p>
                      {n.body ? (
                        <p className="mt-0.5 line-clamp-2 text-[0.75rem] text-ink-3">{n.body}</p>
                      ) : null}
                      <p className="mt-1 text-[0.6875rem] text-ink-4">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-line" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors hover:bg-surface-3"
              aria-label="Account menu"
            >
              <Avatar name={user.displayName} src={user.avatarUrl} size={28} />
              <span className="hidden max-w-32 truncate text-[0.8125rem] font-medium text-ink-1 sm:block">
                {user.displayName.split(" ")[0]}
              </span>
              <ChevronDown className="hidden size-3.5 text-ink-4 sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Avatar name={user.displayName} src={user.avatarUrl} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-semibold text-ink-1">
                  {user.displayName}
                </p>
                <p className="truncate text-[0.6875rem] text-ink-3">{user.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{user.jobTitle ?? "MetricStream"}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/people/${user.id}`}>
                <UserIcon /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Preferences
              </Link>
            </DropdownMenuItem>
            {user.systemRole !== "USER" ? (
              <DropdownMenuItem asChild>
                <Link href="/admin/audit">
                  <Shield /> Admin console
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <div className="px-2.5 py-1.5">
              <p className="text-[0.625rem] uppercase tracking-wider text-ink-4">Role</p>
              <p className="mt-0.5 text-[0.75rem] font-medium text-ink-2">
                {roleLabel(user.systemRole)}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={logout} disabled={busy}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function roleLabel(role: string): string {
  return (
    {
      ADMIN: "System administrator",
      HR: "People partner",
      EXEC: "Executive (read-only)",
      USER: "Employee",
    } as Record<string, string>
  )[role] ?? role;
}

export function NotificationCheck() {
  return <Check className="size-3" />;
}
