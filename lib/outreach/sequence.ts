// Cold follow-up sequence rules (Scraping 2.1, Phase F). A first cold email that
// gets no reply is worth 2 gentle nudges — most replies come from touch 2–3.
// Each follow-up is AI-drafted into the approval queue (NEVER auto-sent) and the
// whole sequence STOPS the moment the lead replies, unsubscribes, or bounces.
//
// Pure + deterministic, unit-tested directly. The Inngest cron applies these.

export const MAX_TOUCHES = 3;
// Days to wait before drafting touch N+1: touch1→2 after 3 days, touch2→3 after 4.
const FOLLOWUP_GAPS_DAYS = [3, 4];

export type SequenceStopReason = "unsubscribed" | "bounced" | "replied" | "converted";

/** Gap (days) to wait before drafting the follow-up after `touchCount` touches. */
export function followupGapDays(touchCount: number): number {
  const idx = touchCount - 1;
  return FOLLOWUP_GAPS_DAYS[idx] ?? FOLLOWUP_GAPS_DAYS[FOLLOWUP_GAPS_DAYS.length - 1];
}

export interface NextTouchPlan {
  touchNumber: number;
  /** ISO time the NEXT touch after this one should be considered, or null if done. */
  nextTouchAt: string | null;
  /** True once this is the final touch (sequence winds down after it). */
  isFinal: boolean;
}

/**
 * Plan the next follow-up given how many touches have already been drafted.
 * Returns null when the sequence has reached MAX_TOUCHES (nothing more to send).
 */
export function planNextTouch(touchCount: number, now: Date = new Date()): NextTouchPlan | null {
  if (touchCount >= MAX_TOUCHES) return null;
  const touchNumber = touchCount + 1;
  const isFinal = touchNumber >= MAX_TOUCHES;
  const nextTouchAt = isFinal
    ? null
    : new Date(now.getTime() + followupGapDays(touchNumber) * 86_400_000).toISOString();
  return { touchNumber, nextTouchAt, isFinal };
}

export interface StopSignals {
  suppressed: boolean; // unsubscribed / bounced / complained (on suppression list)
  bounced: boolean; // a send bounced
  replied: boolean; // an inbound email exists from this lead
  leadClosed: boolean; // lead moved to won/lost/etc — someone is handling it
}

/** Which terminal reason (if any) should stop the sequence now. */
export function stopReason(signals: StopSignals): SequenceStopReason | null {
  if (signals.bounced) return "bounced";
  if (signals.suppressed) return "unsubscribed";
  if (signals.replied) return "replied";
  if (signals.leadClosed) return "converted";
  return null;
}

/** Map a stop reason to the re_engagement_sequences.status value to persist. */
export function stopStatusFor(reason: SequenceStopReason): string {
  switch (reason) {
    case "unsubscribed":
    case "bounced":
      return "unsubscribed";
    case "replied":
    case "converted":
      return "converted";
  }
}
