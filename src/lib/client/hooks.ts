"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions";

/**
 * Thin wrapper around a server action that manages pending state, error
 * surfacing and optimistic toasts. Every form in the product uses it so
 * behaviour is consistent.
 */
export function useFormAction<TInput, TOutput>(
  action: (input: TInput) => Promise<ActionResult<TOutput>>,
) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const reset = React.useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const submit = React.useCallback(
    (
      input: TInput,
      options: {
        onSuccess?: (data: TOutput) => void;
        successMessage?: string;
        onError?: (message: string) => void;
      } = {},
    ) => {
      reset();
      startTransition(async () => {
        try {
          const result = await action(input);
          if (result.ok) {
            if (options.successMessage) toast.success(options.successMessage);
            options.onSuccess?.(result.data);
          } else {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
            toast.error(result.error);
            options.onError?.(result.error);
          }
        } catch {
          const message = "Network error — check your connection and try again.";
          setError(message);
          toast.error(message);
        }
      });
    },
    [action, reset],
  );

  return { pending, error, fieldErrors, submit, reset, setError };
}

/** Reads the double-submit CSRF cookie for fetch-based mutations. */
export function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)meridian\.csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : "";
}
