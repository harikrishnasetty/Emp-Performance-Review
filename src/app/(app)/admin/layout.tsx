import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { AdminTabs } from "@/components/admin/admin-tabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const allowed =
    can(user, "cycle:manage") ||
    can(user, "template:manage") ||
    can(user, "calibration:manage") ||
    can(user, "user:manage") ||
    can(user, "audit:read");

  if (!allowed) redirect("/forbidden");

  return (
    <div className="space-y-5">
      <AdminTabs />
      {children}
    </div>
  );
}
