import { describe, expect, it } from "vitest";
import {
  effectiveDailyCap,
  pickInbox,
  parseInboxesFromEnv,
  remainingCapacity,
  randomSpacingSeconds,
} from "@/lib/outreach/inbox-rotation";
import type { SendingInbox } from "@/lib/types/app.types";

const inbox = (over: Partial<SendingInbox> = {}): SendingInbox => ({
  id: "i1",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  address: "a@out.hu",
  from_name: null,
  daily_cap: 30,
  warmup_started_at: null,
  active: true,
  ...over,
});

const NOW = new Date("2026-02-01T10:00:00Z");

describe("effectiveDailyCap", () => {
  it("no warmup → full daily cap", () => {
    expect(effectiveDailyCap(inbox({ daily_cap: 40 }), NOW)).toBe(40);
  });

  it("ramps 5/day → +5/week, capped at daily_cap", () => {
    const start = new Date("2026-02-01T00:00:00Z").toISOString();
    // week 0
    expect(effectiveDailyCap(inbox({ warmup_started_at: start, daily_cap: 30 }), new Date("2026-02-02T00:00:00Z"))).toBe(5);
    // week 1 → 10
    expect(effectiveDailyCap(inbox({ warmup_started_at: start, daily_cap: 30 }), new Date("2026-02-09T00:00:00Z"))).toBe(10);
    // week 6 → 5 + 30 = 35, capped to 30
    expect(effectiveDailyCap(inbox({ warmup_started_at: start, daily_cap: 30 }), new Date("2026-03-20T00:00:00Z"))).toBe(30);
  });

  it("inactive inbox has zero cap", () => {
    expect(effectiveDailyCap(inbox({ active: false }), NOW)).toBe(0);
  });
});

describe("remainingCapacity", () => {
  it("subtracts today's sends, floored at 0", () => {
    expect(remainingCapacity(inbox({ daily_cap: 10 }), 3, NOW)).toBe(7);
    expect(remainingCapacity(inbox({ daily_cap: 10 }), 15, NOW)).toBe(0);
  });
});

describe("pickInbox", () => {
  const a = inbox({ id: "a", address: "a@out.hu", daily_cap: 10 });
  const b = inbox({ id: "b", address: "b@out.hu", daily_cap: 10 });

  it("picks the inbox with the most remaining capacity", () => {
    const chosen = pickInbox([a, b], { "a@out.hu": 8, "b@out.hu": 2 }, NOW);
    expect(chosen?.address).toBe("b@out.hu");
  });

  it("returns null when everything is at cap", () => {
    expect(pickInbox([a, b], { "a@out.hu": 10, "b@out.hu": 10 }, NOW)).toBeNull();
  });

  it("skips inactive inboxes", () => {
    const dead = inbox({ id: "c", address: "c@out.hu", active: false, daily_cap: 100 });
    expect(pickInbox([dead], {}, NOW)).toBeNull();
  });
});

describe("parseInboxesFromEnv", () => {
  it("parses address[:from_name] entries and skips junk", () => {
    const list = parseInboxesFromEnv("hi@out.hu:Compass, szia@mail.hu , not-an-email", 25);
    expect(list).toHaveLength(2);
    expect(list[0].address).toBe("hi@out.hu");
    expect(list[0].from_name).toBe("Compass");
    expect(list[0].daily_cap).toBe(25);
    expect(list[1].address).toBe("szia@mail.hu");
  });

  it("empty env → empty list", () => {
    expect(parseInboxesFromEnv(undefined)).toEqual([]);
    expect(parseInboxesFromEnv("")).toEqual([]);
  });
});

describe("randomSpacingSeconds", () => {
  it("stays within 3–7 minutes", () => {
    expect(randomSpacingSeconds(() => 0)).toBe(180);
    expect(randomSpacingSeconds(() => 0.999)).toBe(419);
  });
});
