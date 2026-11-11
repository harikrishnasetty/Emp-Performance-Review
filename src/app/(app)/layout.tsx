import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Gauge,
  MessageSquareHeart,
  Settings,
  Shield,
  SlidersHorizontal,
  Target,
  Users,
  UsersRound,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { countDirectReports } from "@/lib/services/people";
import { listNotifications, unreadCount } from "@/lib/services/notifications";
import { getMyReviewTasks } from "@/lib/services/reviews";
import { AppShell, BrandBlock } from "@/components/shell/app-shell";
import type { NavGroup } from "@/components/shell/sidebar";
import { env } from "@/lib/env";
import { Avatar } from "@/components/ui/avatar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [notes, unread, tasks, reports] = await Promise.all([
    listNotifications(user.id),
    unreadCount(user.id),
    getMyReviewTasks(user.id),
    countDirectReports(user.id),
  ]);

  const pendingReviews = tasks.filter(
    (t) => t.status !== "SUBMITTED" && t.status !== "ACKNOWLEDGED",
  ).length;

  const isManager = reports > 0 || can(user, "analytics:org");
  const isAdminish = can(user, "cycle:manage");

  const groups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Dashboard", icon: <Gauge />, exact: true },
        { href: "/goals", label: "Goals", icon: <Target /> },
        {
          href: "/reviews",
          label: "Reviews",
          icon: <ClipboardCheck />,
          badge: pendingReviews,
        },
        { href: "/feedback", label: "Feedback", icon: <MessageSquareHeart /> },
        { href: "/one-on-ones", label: "1:1s", icon: <CalendarDays /> },
      ],
    },
    ...(isManager
      ? [
          {
            label: "Leadership",
            items: [
              { href: "/team", label: "My team", icon: <UsersRound /> },
              { href: "/analytics", label: "Analytics", icon: <BarChart3 /> },
            ],
          },
        ]
      : []),
    {
      label: "Organisation",
      items: [
        { href: "/people", label: "People", icon: <Users /> },
        { href: "/settings", label: "Preferences", icon: <Settings /> },
      ],
    },
    ...(isAdminish
      ? [
          {
            label: "Administration",
            items: [
              { href: "/admin/cycles", label: "Review cycles", icon: <SlidersHorizontal /> },
              { href: "/admin/templates", label: "Templates", icon: <ClipboardCheck /> },
              { href: "/admin/calibration", label: "Calibration", icon: <BarChart3 /> },
              { href: "/admin/people", label: "Directory admin", icon: <Users /> },
              { href: "/admin/audit", label: "Audit trail", icon: <Shield /> },
            ],
          },
        ]
      : []),
  ];

  return (
    <AppShell
      user={{
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        jobTitle: user.jobTitle,
        avatarUrl: user.avatarUrl,
        systemRole: user.systemRole,
      }}
      navGroups={groups}
      notifications={notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.href,
        readAt: n.readAt,
        createdAt: n.createdAt,
        type: n.type,
      }))}
      unread={unread}
      brand={<BrandBlock name={env.APP_NAME} />}
      footer={
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-1 px-2.5 py-2">
          <Avatar name={user.displayName} src={user.avatarUrl} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] font-semibold text-ink-1">
              {user.displayName}
            </p>
            <p className="truncate text-[0.625rem] text-ink-3">
              {user.jobTitle ?? user.email}
            </p>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
