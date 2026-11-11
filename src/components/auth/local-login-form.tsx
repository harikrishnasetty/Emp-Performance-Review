"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useFormAction } from "@/lib/client/hooks";
import { localLogin } from "@/app/actions/auth";

/**
 * `next` is resolved and sanitised by the server page (`safeReturnTo`) and
 * passed down as a prop. Reading it here with `useSearchParams` would force the
 * prerendered login route into a client-side-render bailout, which left this
 * form stranded in a hidden streamed node.
 */
export function LocalLoginForm({ next = "/dashboard" }: { next?: string }) {
  const router = useRouter();
  const { pending, submit, error, fieldErrors } = useFormAction(localLogin);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      { email, password },
      {
        successMessage: "Signed in",
        onSuccess: () => {
          router.replace(next);
          router.refresh();
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[0.75rem] text-rose-300"
        >
          {error}
        </p>
      ) : null}
      <Field label="Email" htmlFor="local-email" error={fieldErrors.email}>
        <Input
          id="local-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@metricstream.com"
          required
        />
      </Field>
      <Field label="Password" htmlFor="local-password" error={fieldErrors.password}>
        <Input
          id="local-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" loading={pending} className="w-full">
        <LogIn className="size-4" /> Sign in with password
      </Button>
      <p className="text-[0.6875rem] leading-relaxed text-ink-4">
        <KeyRound className="mr-1 inline size-3" />
        Use the email and password issued by your administrator. SSO accounts
        should use the Microsoft button above.
      </p>
    </form>
  );
}
