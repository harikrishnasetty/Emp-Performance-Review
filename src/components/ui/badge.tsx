import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line-strong bg-surface-3 text-ink-2",
        brand: "border-brand-500/35 bg-brand-500/12 text-brand-200",
        positive: "border-mint-500/30 bg-mint-500/12 text-mint-400",
        warning: "border-amber-500/30 bg-amber-500/12 text-amber-400",
        danger: "border-rose-500/30 bg-rose-500/12 text-rose-400",
        info: "border-aqua-500/30 bg-aqua-500/12 text-aqua-400",
      },
      dot: { true: "pl-2", false: "" },
    },
    defaultVariants: { tone: "neutral", dot: false },
  },
);

const dotColor: Record<string, string> = {
  neutral: "bg-ink-3",
  brand: "bg-brand-400",
  positive: "bg-mint-400",
  warning: "bg-amber-400",
  danger: "bg-rose-400",
  info: "bg-aqua-400",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, dot }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", dotColor[tone ?? "neutral"])}
        />
      ) : null}
      {children}
    </span>
  );
}
