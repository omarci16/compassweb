import { describe, expect, it } from "vitest";
import {
  MAX_TOUCHES,
  followupGapDays,
  planNextTouch,
  stopReason,
  stopStatusFor,
} from "@/lib/outreach/sequence";

const NOW = new Date("2026-03-01T09:00:00Z");

describe("planNextTouch", () => {
  it("touch 1 done → plans touch 2, schedules touch 3", () => {
    const p = planNextTouch(1, NOW);
    expect(p).not.toBeNull();
    expect(p!.touchNumber).toBe(2);
    expect(p!.isFinal).toBe(false);
    expect(p!.nextTouchAt).not.toBeNull();
  });

  it("touch 2 done → plans the final touch 3 with no further schedule", () => {
    const p = planNextTouch(2, NOW);
    expect(p!.touchNumber).toBe(3);
    expect(p!.isFinal).toBe(true);
    expect(p!.nextTouchAt).toBeNull();
  });

  it("returns null once MAX_TOUCHES reached", () => {
    expect(planNextTouch(MAX_TOUCHES, NOW)).toBeNull();
    expect(planNextTouch(MAX_TOUCHES + 1, NOW)).toBeNull();
  });

  it("uses the configured gap for scheduling", () => {
    const p = planNextTouch(1, NOW)!;
    const days = (new Date(p.nextTouchAt!).getTime() - NOW.getTime()) / 86_400_000;
    expect(days).toBe(followupGapDays(2));
  });
});

describe("stopReason precedence", () => {
  const none = { suppressed: false, bounced: false, replied: false, leadClosed: false };

  it("no signals → keep going", () => {
    expect(stopReason(none)).toBeNull();
  });
  it("bounce beats everything", () => {
    expect(stopReason({ ...none, bounced: true, replied: true })).toBe("bounced");
  });
  it("unsubscribe (suppressed) before reply", () => {
    expect(stopReason({ ...none, suppressed: true, replied: true })).toBe("unsubscribed");
  });
  it("reply and conversion", () => {
    expect(stopReason({ ...none, replied: true })).toBe("replied");
    expect(stopReason({ ...none, leadClosed: true })).toBe("converted");
  });
});

describe("stopStatusFor", () => {
  it("maps reasons to persisted statuses", () => {
    expect(stopStatusFor("unsubscribed")).toBe("unsubscribed");
    expect(stopStatusFor("bounced")).toBe("unsubscribed");
    expect(stopStatusFor("replied")).toBe("converted");
    expect(stopStatusFor("converted")).toBe("converted");
  });
});
