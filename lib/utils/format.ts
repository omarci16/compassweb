import { differenceInDays, differenceInHours, differenceInMinutes, format } from "date-fns";

export function formatHuf(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("HUF", "Ft")
    .trim();
}

export function formatHufCompact(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M Ft`;
  if (amount >= 1_000) return `${Math.round(amount / 1000)}k Ft`;
  return `${amount} Ft`;
}

export function formatDateHu(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy. MM. dd.");
}

export function formatDateTimeHu(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy. MM. dd. HH:mm");
}

/** Hungarian relative time: "2 perce", "3 órája", "5 napja", "2 hete" */
export function formatRelativeHu(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const mins = differenceInMinutes(now, d);
  if (mins < 1) return "most";
  if (mins < 60) return `${mins} perce`;
  const hours = differenceInHours(now, d);
  if (hours < 24) return `${hours} órája`;
  const days = differenceInDays(now, d);
  if (days < 7) return `${days} napja`;
  if (days < 30) return `${Math.floor(days / 7)} hete`;
  if (days < 365) return `${Math.floor(days / 30)} hónapja`;
  return `${Math.floor(days / 365)} éve`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value)}%`;
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
