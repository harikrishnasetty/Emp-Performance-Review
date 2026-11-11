import { cn, clamp } from "@/lib/utils";

/**
 * Animated progress ring. Renders identically on the server and client, then
 * animates via CSS transition once mounted — no layout shift.
 */
export function ProgressRing({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  tone = "brand",
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: "brand" | "positive" | "warning" | "danger" | "info";
  className?: string;
}) {
  const safe = clamp(value, 0, 100);
  const display = Math.round(safe);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  const gradients: Record<string, [string, string]> = {
    brand: ["#8468ff", "#22d3ee"],
    positive: ["#4ade9b", "#22d3ee"],
    warning: ["#fbbf24", "#fb7185"],
    danger: ["#fb7185", "#f43f5e"],
    info: ["#22d3ee", "#8468ff"],
  };
  const [from, to] = gradients[tone] ?? gradients.brand!;
  const gid = `ring-${tone}`;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Progress"}: ${display}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-semibold tabular tracking-tight text-ink-1"
          style={{ fontSize: size * 0.24 }}
        >
          {label ?? `${display}%`}
        </span>
        {sublabel ? (
          <span
            className="mt-0.5 text-ink-3"
            style={{ fontSize: Math.max(9, size * 0.1) }}
          >
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function MeterBar({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: "brand" | "positive" | "warning" | "danger" | "info";
  className?: string;
}) {
  const colors: Record<string, string> = {
    brand: "bg-gradient-to-r from-brand-400 to-aqua-400",
    positive: "bg-gradient-to-r from-mint-400 to-aqua-400",
    warning: "bg-gradient-to-r from-amber-400 to-rose-400",
    danger: "bg-gradient-to-r from-rose-400 to-rose-500",
    info: "bg-gradient-to-r from-aqua-400 to-brand-400",
  };
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={clamp(value, 0, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", colors[tone])}
        style={{ width: `${clamp(value, 0, 100)}%` }}
      />
    </div>
  );
}
