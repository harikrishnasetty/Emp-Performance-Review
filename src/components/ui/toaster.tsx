"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{
        style: {
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-line-strong)",
          color: "var(--color-ink-1)",
          borderRadius: "0.75rem",
          fontSize: "0.8125rem",
        },
      }}
    />
  );
}
