import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="display text-[1.6rem] font-semibold leading-tight text-ink-1 sm:text-[1.85rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[0.875rem] leading-relaxed text-ink-3">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink-1">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[0.8125rem] text-ink-3">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3 [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink-1">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[0.8125rem] leading-relaxed text-ink-3">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  delta,
  hint,
  icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "brand" | "positive" | "warning" | "danger" | "info";
  className?: string;
}) {
  const toneMap = {
    brand: "text-brand-300 bg-brand-500/10 border-brand-500/25",
    positive: "text-mint-400 bg-mint-500/10 border-mint-500/25",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/25",
    danger: "text-rose-400 bg-rose-500/10 border-rose-500/25",
    info: "text-aqua-400 bg-aqua-500/10 border-aqua-500/25",
  };

  return (
    <div className={cn("panel panel-hover p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.75rem] font-medium uppercase tracking-wider text-ink-3">
          {label}
        </p>
        {icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border [&_svg]:size-4",
              toneMap[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="display text-[1.75rem] font-semibold leading-none tabular text-ink-1">
          {value}
        </span>
        {delta ? (
          <span className="text-[0.75rem] font-medium text-mint-400">{delta}</span>
        ) : null}
      </div>
      {hint ? <p className="mt-1.5 text-[0.75rem] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}
