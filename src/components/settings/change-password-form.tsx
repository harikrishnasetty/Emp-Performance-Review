"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useFormAction } from "@/lib/client/hooks";
import { changeOwnPassword } from "@/app/actions/settings";

/**
 * Self-service password change for local (non-SSO) accounts. Hidden for
 * pure-SSO users, who have no password to rotate.
 */
export function ChangePasswordForm() {
  const { pending, submit, error, fieldErrors } = useFormAction(changeOwnPassword);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setConfirmError("The two new passwords don't match.");
      return;
    }
    setConfirmError(null);
    submit(
      { currentPassword, newPassword },
      {
        successMessage: "Password updated",
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-line bg-surface-0/60 p-3">
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-1">
        <KeyRound className="size-3.5 text-ink-3" /> Change local password
      </p>
      <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-ink-3">
        Use at least 12 characters. Other sessions are signed out; this one stays
        active.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.75rem] text-rose-300"
        >
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-2 space-y-2">
        <Field
          label="Current password"
          htmlFor="settings-current-password"
          error={fieldErrors.currentPassword}
        >
          <Input
            id="settings-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="New password" htmlFor="settings-new-password" error={fieldErrors.newPassword}>
            <Input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={12}
              maxLength={256}
              placeholder="Min. 12 characters"
              required
            />
          </Field>
          <Field label="Confirm new password" htmlFor="settings-confirm-password" error={confirmError ?? undefined}>
            <Input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={12}
              maxLength={256}
              required
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            loading={pending}
            disabled={newPassword.length < 12 || !currentPassword}
          >
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}
