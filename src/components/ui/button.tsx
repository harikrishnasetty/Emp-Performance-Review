"use client";

import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.65rem] text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 select-none outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 active:scale-[0.985] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-500 text-white shadow-[0_8px_24px_-12px_#6f4bffcc] hover:bg-brand-400",
        secondary:
          "bg-surface-3 text-ink-1 border border-line hover:bg-surface-4 hover:border-line-strong",
        ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink-1",
        outline:
          "border border-line-strong text-ink-1 hover:bg-surface-3 hover:border-brand-400/50",
        danger:
          "bg-rose-500/90 text-white hover:bg-rose-400 shadow-[0_8px_24px_-14px_#f43f5ecc]",
        success: "bg-mint-500/90 text-[#04120c] hover:bg-mint-400",
        link: "text-brand-300 underline-offset-4 hover:underline hover:text-brand-200",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem]",
        md: "h-9.5 px-4",
        lg: "h-11 px-5 text-[0.9375rem]",
        icon: "size-9",
        "icon-sm": "size-7.5 rounded-lg",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export { buttonVariants };

/**
 * Anchor styled as a button — keeps navigation as real links (right-click,
 * middle-click, and no JS required).
 */
export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}
