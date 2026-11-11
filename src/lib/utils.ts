import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
}

export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const ms = new Date(date).setHours(23, 59, 59, 999) - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Shared display metadata for status enums.
 *
 * These live in this framework-neutral module (and not next to the components
 * that render them) because a server component that imports a plain value from
 * a `"use client"` module receives a client-reference stub instead of the
 * object — every lookup then returns `undefined` at runtime.
 */
export type StatusTone = "neutral" | "brand" | "positive" | "warning" | "danger" | "info";

export type StatusMeta = { label: string; tone: StatusTone };

export const goalStatusMeta: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  ON_TRACK: { label: "On track", tone: "positive" },
  AT_RISK: { label: "At risk", tone: "warning" },
  OFF_TRACK: { label: "Off track", tone: "danger" },
  ACHIEVED: { label: "Achieved", tone: "positive" },
  MISSED: { label: "Missed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const reviewStatusMeta: Record<string, StatusMeta> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  DRAFT: { label: "Draft", tone: "warning" },
  SUBMITTED: { label: "Submitted", tone: "info" },
  RETURNED: { label: "Returned", tone: "danger" },
  ACKNOWLEDGED: { label: "Acknowledged", tone: "positive" },
  LOCKED: { label: "Locked", tone: "neutral" },
};

export const participantStatusMeta: Record<string, StatusMeta> = {
  NOT_STARTED: { label: "Not started", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "warning" },
  SELF_COMPLETE: { label: "Self review done", tone: "info" },
  MANAGER_COMPLETE: { label: "Manager review done", tone: "info" },
  AWAITING_ACKNOWLEDGEMENT: { label: "Awaiting acknowledgement", tone: "warning" },
  COMPLETE: { label: "Complete", tone: "positive" },
  EXCLUDED: { label: "Excluded", tone: "neutral" },
};

export const cycleStatusMeta: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SCHEDULED: { label: "Scheduled", tone: "info" },
  GOAL_SETTING: { label: "Goal setting", tone: "info" },
  MID_YEAR_SELF: { label: "Mid-year (self)", tone: "info" },
  MID_YEAR_MANAGER: { label: "Mid-year (manager)", tone: "warning" },
  SELF_REVIEW: { label: "Self review", tone: "warning" },
  MANAGER_REVIEW: { label: "Manager review", tone: "warning" },
  CALIBRATION: { label: "Calibration", tone: "warning" },
  ACKNOWLEDGEMENT: { label: "Acknowledgement", tone: "warning" },
  CLOSED: { label: "Closed", tone: "positive" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

/**
 * Review-template status labels.
 *
 * Deliberately lives here rather than next to the admin UI: `template-admin.tsx`
 * is a client module, and a server component that imports a plain value from a
 * client module gets a client-reference stub instead of the object, so every
 * lookup returns `undefined`. Shared display metadata belongs in this
 * framework-neutral module.
 */
export const templateStatusMeta: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "positive" },
  RETIRED: { label: "Retired", tone: "brand" },
};

export const feedbackTypeMeta: Record<string, StatusMeta> = {
  PRAISE: { label: "Praise", tone: "positive" },
  CONSTRUCTIVE: { label: "Constructive", tone: "warning" },
  COACHING: { label: "Coaching", tone: "info" },
  RECOGNITION: { label: "Recognition", tone: "positive" },
};

export const priorityMeta: Record<string, StatusMeta> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "info" },
  HIGH: { label: "High", tone: "warning" },
  CRITICAL: { label: "Critical", tone: "danger" },
};
