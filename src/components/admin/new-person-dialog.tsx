"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
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
import { adminCreatePerson } from "@/app/actions/admin";

type AuthMode = "LOCAL" | "SSO";

export function NewPersonDialog({
  departments,
  suggestions,
}: {
  departments: { id: string; name: string }[];
  suggestions: PersonOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { pending, submit, error, fieldErrors } = useFormAction(adminCreatePerson);

  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("none");
  const [manager, setManager] = React.useState<PersonOption | null>(null);
  const [systemRole, setSystemRole] = React.useState("USER");
  const [status, setStatus] = React.useState("ACTIVE");
  const [employeeCode, setEmployeeCode] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [authMode, setAuthMode] = React.useState<AuthMode>("LOCAL");
  const [password, setPassword] = React.useState("");

  const reset = () => {
    setEmail("");
    setDisplayName("");
    setJobTitle("");
    setDepartmentId("none");
    setManager(null);
    setSystemRole("USER");
    setStatus("ACTIVE");
    setEmployeeCode("");
    setLocation("");
    setAuthMode("LOCAL");
    setPassword("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        email: email.trim(),
        displayName: displayName.trim(),
        jobTitle: jobTitle.trim() || null,
        departmentId: departmentId === "none" ? null : departmentId,
        managerId: manager?.id ?? null,
        systemRole: systemRole as "ADMIN" | "HR" | "EXEC" | "USER",
        status: status as "ACTIVE" | "ON_LEAVE" | "NOTICE_PERIOD" | "INACTIVE",
        employeeCode: employeeCode.trim() || null,
        location: location.trim() || null,
        authMode,
        ...(authMode === "LOCAL" ? { password } : {}),
      },
      {
        successMessage: `${displayName.trim() || email.trim()} added`,
        onSuccess: () => {
          setOpen(false);
          reset();
          router.refresh();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <UserPlus /> Add person
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add a person"
        description="Create a directory entry now, without waiting for a first SSO login. Local accounts can sign in immediately with a password."
        size="md"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.8125rem] text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="new-person-name" error={fieldErrors.displayName}>
              <Input
                id="new-person-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={160}
                placeholder="Ravi Kumar"
                required
              />
            </Field>
            <Field label="Work email" htmlFor="new-person-email" error={fieldErrors.email}>
              <Input
                id="new-person-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={320}
                placeholder="ravi.kumar@metricstream.com"
                autoComplete="off"
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sign-in method" hint="Local users don't need Entra ID.">
              <Select
                value={authMode}
                onValueChange={(value) => setAuthMode(value as AuthMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCAL">Local email &amp; password</SelectItem>
                  <SelectItem value="SSO">Microsoft Entra ID (SSO)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {authMode === "LOCAL" ? (
              <Field
                label="Initial password"
                htmlFor="new-person-password"
                hint="At least 12 characters. Share it over a secure channel; they can change it after signing in."
                error={fieldErrors.password}
              >
                <Input
                  id="new-person-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  maxLength={256}
                  autoComplete="new-password"
                  placeholder="Min. 12 characters"
                  required
                />
              </Field>
            ) : (
              <div className="flex items-end">
                <p className="w-full rounded-xl border border-line bg-surface-0/60 px-3 py-2 text-[0.6875rem] leading-relaxed text-ink-3">
                  The person can sign in with Microsoft as soon as their account
                  exists. Their directory fields are refreshed from Entra ID on
                  each login.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" htmlFor="new-person-title" error={fieldErrors.jobTitle}>
              <Input
                id="new-person-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={160}
                placeholder="Senior Software Engineer"
              />
            </Field>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <Field
            label="Reports to"
            hint="Sets who reviews this person and what they can see."
            error={fieldErrors.managerId}
          >
            <PersonPicker
              value={manager}
              onChange={setManager}
              excludeIds={[]}
              suggestions={suggestions}
              placeholder="Search for a manager"
              ariaLabel="Choose a manager"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" htmlFor="new-person-location" error={fieldErrors.location}>
              <Input
                id="new-person-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                placeholder="Bengaluru"
              />
            </Field>
            <Field
              label="Employee code"
              htmlFor="new-person-code"
              error={fieldErrors.employeeCode}
            >
              <Input
                id="new-person-code"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                maxLength={64}
                placeholder="MS-0421"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              <UserPlus /> Add person
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
