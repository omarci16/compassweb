// Inbox rotation + warmup — the deliverability governor. A cold domain that
// blasts hundreds of emails on day one gets flagged; we ramp each inbox slowly
// and spread sends across several. Pure + deterministic, so it's unit-tested.

import type { SendingInbox } from "@/lib/types/app.types";

const WARMUP_START_PER_DAY = 5; // day-one cap
const WARMUP_STEP_PER_WEEK = 5; // +5/day each week
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * The effective daily cap for an inbox right now, honoring its warmup ramp.
 * No warmup_started_at → send straight at daily_cap. Otherwise ramp from 5/day,
 * +5/day each completed week, never exceeding daily_cap.
 */
export function effectiveDailyCap(inbox: SendingInbox, now: Date = new Date()): number {
  if (!inbox.active) return 0;
  if (!inbox.warmup_started_at) return inbox.daily_cap;
  const started = new Date(inbox.warmup_started_at).getTime();
  const weeks = Math.max(0, Math.floor((now.getTime() - started) / MS_PER_WEEK));
  const ramped = WARMUP_START_PER_DAY + WARMUP_STEP_PER_WEEK * weeks;
  return Math.max(0, Math.min(inbox.daily_cap, ramped));
}

/** Remaining capacity for an inbox given how many it has already sent today. */
export function remainingCapacity(
  inbox: SendingInbox,
  sentToday: number,
  now: Date = new Date(),
): number {
  return Math.max(0, effectiveDailyCap(inbox, now) - sentToday);
}

/**
 * Pick the inbox to send the next email from: the active, under-cap inbox with
 * the MOST remaining capacity (ties broken by address for determinism). This
 * naturally load-balances across inboxes. Returns null when all are at cap.
 */
export function pickInbox(
  inboxes: SendingInbox[],
  sentTodayByAddress: Record<string, number>,
  now: Date = new Date(),
): SendingInbox | null {
  const candidates = inboxes
    .filter((i) => i.active)
    .map((i) => ({
      inbox: i,
      remaining: remainingCapacity(i, sentTodayByAddress[i.address] ?? 0, now),
    }))
    .filter((c) => c.remaining > 0)
    .sort(
      (a, b) =>
        b.remaining - a.remaining || a.inbox.address.localeCompare(b.inbox.address),
    );
  return candidates[0]?.inbox ?? null;
}

/**
 * Parse SENDING_INBOXES env as a fallback when the sending_inboxes table is
 * empty. Format: comma-separated `address[:from_name]`, e.g.
 *   "hi@out.compass.hu:Compass, szia@mail.compass.hu"
 * Warmup defaults on (started now-ish handled by caller) and daily_cap uses
 * SENDING_DAILY_CAP or 30.
 */
export function parseInboxesFromEnv(
  raw: string | undefined,
  dailyCap = 30,
): SendingInbox[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, idx) => {
      const [address, fromName] = entry.split(":").map((x) => x.trim());
      return {
        id: `env-${idx}`,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
        address,
        from_name: fromName || null,
        daily_cap: dailyCap,
        warmup_started_at: null,
        active: true,
      };
    })
    .filter((i) => i.address.includes("@"));
}

/** Randomized 3–7 minute spacing (seconds) between sends. */
export function randomSpacingSeconds(rng: () => number = Math.random): number {
  return 180 + Math.floor(rng() * 240);
}
