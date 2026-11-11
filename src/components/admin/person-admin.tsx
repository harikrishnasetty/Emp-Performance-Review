"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilLine, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonPicker, type PersonOption } from "@/components/people/person-picker";
import { useFormAction } from "@/lib/client/hooks";
import { adminUpdatePerson } from "@/app/actions/admin";
import { adminSetPassword, adminDisableLocalAccess } from "@/app/actions/auth";

export type AdminPerson = {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  systemRole: string;
  status: string;
  authProvider: string;
  location: string | null;
};

export function EditPersonDialog({
  person,
  departments,
  manager,
  suggestions,
  isSelf,
}: {
  person: AdminPerson;
  departments: { id: string; name: string }[];
  manager: PersonOption | null;
  suggestions: PersonOption[];
  isSelf: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, submit, error, fieldErrors } = useFormAction(adminUpdatePerson);

  const [jobTitle, setJobTitle] = React.useState(person.jobTitle ?? "");
  const [departmentId, setDepartmentId] = React.useState(person.departmentId ?? "none");
  const [selectedManager, setSelectedManager] = React.useState<PersonOption | null>(manager);
  const [systemRole, setSystemRole] = React.useState(person.systemRole);
  const [status, setStatus] = React.useState(person.status);
  const [employeeCode, setEmployeeCode] = React.useState("");
  const [location, setLocation] = React.useState(person.location ?? "");
  const [localPassword, setLocalPassword] = React.useState("");
  const {
    pending: settingPassword,
    submit: submitPassword,
    error: passwordError,
  } = useFormAction(adminSetPassword);
  const {
    pending: disablingLocal,
    submit: submitDisableLocal,
    error: disableLocalError,
  } = useFormAction(adminDisableLocalAccess);

  const handleSetPassword = () => {
    if (!localPassword) return;
    submitPassword(
      { userId: person.id, password: localPassword },
      {
        successMessage: `Local password set for ${person.displayName}`,
        onSuccess: () => {
          setLocalPassword("");
          router.refresh();
        },
      },
    );
  };

  const handleDisableLocal = () => {
    submitDisableLocal(
      { userId: person.id },
      {
        successMessage: `Local access removed for ${person.displayName}`,
        onSuccess: () => router.refresh(),
      },
    );
  };

  const roleChanged = systemRole !== person.systemRole;
  const willBeDeactivated = status === "INACTIVE" && person.status !== "INACTIVE";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        userId: person.id,
        jobTitle: jobTitle.trim() || null,
        departmentId: departmentId === "none" ? null : departmentId,
        managerId: selectedManager?.id ?? null,
        systemRole: systemRole as "ADMIN" | "HR" | "EXEC" | "USER",
        status: status as "ACTIVE" | "ON_LEAVE" | "NOTICE_PERIOD" | "INACTIVE",
        employeeCode: employeeCode.trim() || null,
        location: location.trim() || null,
      },
      {
        successMessage: `Updated ${person.displayName}`,
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <PencilLine className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Edit ${person.displayName}`}
        description="Administrative changes are audited. Role changes and deactivation immediately revoke the person's active sessions."
        size="md"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-surface-0/60 px-3 py-2">
            <p className="text-[0.8125rem] font-medium text-ink-1">{person.displayName}</p>
            <p className="text-[0.6875rem] text-ink-3">{person.email}</p>
          </div>

          <Field label="Job title" htmlFor="admin-job-title" error={fieldErrors.jobTitle}>
            <Input
              id="admin-job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              maxLength={160}
              placeholder="Senior Software Engineer"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="No department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="System role">
              <Select value={systemRole} onValueChange={setSystemRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Employee</SelectItem>
                  <SelectItem value="EXEC">Executive (read-only)</SelectItem>
                  <SelectItem value="HR">HR business partner</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Reports to"
            hint="Changing the manager changes who reviews this person and what they can see."
          >
            <PersonPicker
              value={selectedManager}
              onChange={setSelectedManager}
              excludeIds={[person.id]}
              suggestions={suggestions}
              placeholder="Search for a manager"
              ariaLabel="Choose a manager"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employment status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ON_LEAVE">On leave</SelectItem>
                  <SelectItem value="NOTICE_PERIOD">Notice period</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location" htmlFor="admin-location">
              <Input
                id="admin-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                placeholder="Bengaluru"
              />
            </Field>
          </div>

          <Field label="Employee code" htmlFor="admin-employee-code">
            <Input
              id="admin-employee-code"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              maxLength={64}
              placeholder="MS-0421"
            />
          </Field>

          {roleChanged || willBeDeactivated ? (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[0.75rem] leading-relaxed text-amber-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                {roleChanged
                  ? "The role change takes effect immediately and signs the person out of every active session. "
                  : ""}
                {willBeDeactivated
                  ? "Deactivating removes them from directories and prevents sign-in. "
                  : ""}
                {isSelf && roleChanged
                  ? "You cannot remove your own administrator role."
                  : ""}
              </span>
            </div>
          ) : null}

          {passwordError || disableLocalError ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {passwordError ?? disableLocalError}
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-surface-0/60 p-3">
            <p className="text-[0.8125rem] font-medium text-ink-1">
              Local (non-SSO) access
            </p>
            <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-3">
              {person.authProvider === "SSO"
                ? "This user signs in via SSO only. Set a password to let them sign in without Entra ID."
                : person.authProvider === "BOTH"
                  ? "Both sign-in methods are enabled. Setting a new password rotates the local credential immediately."
                  : "Local password enabled. Setting a new password rotates the credential immediately."}
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                type="password"
                autoComplete="new-password"
                value={localPassword}
                onChange={(e) => setLocalPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSetPassword();
                  }
                }}
                placeholder="Min. 12 characters"
                minLength={12}
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={settingPassword}
                disabled={localPassword.length < 12}
                onClick={handleSetPassword}
              >
                {person.authProvider === "SSO" ? "Set password" : "Rotate password"}
              </Button>
            </div>
            {person.authProvider === "BOTH" ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-1/60 px-2.5 py-2">
                <p className="text-[0.6875rem] leading-relaxed text-ink-3">
                  Removing local access keeps SSO working and signs the person
                  out everywhere.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  loading={disablingLocal}
                  onClick={handleDisableLocal}
                >
                  Disable local
                </Button>
              </div>
            ) : person.authProvider === "LOCAL" ? (
              <p className="mt-2 rounded-lg border border-line bg-surface-1/60 px-2.5 py-2 text-[0.6875rem] leading-relaxed text-ink-3">
                Local password is this person&apos;s only sign-in method. It can
                be removed once they have signed in with Microsoft at least
                once.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
