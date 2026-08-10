import { describe, expect, it } from "vitest";
import {
  contactabilityStats,
  isContactable,
  leadReachChannel,
  type ContactableLead,
} from "@/lib/prospecting/contactability";

const lead = (over: Partial<ContactableLead> = {}): ContactableLead => ({
  email: null,
  email_status: null,
  phone: null,
  social_links: null,
  contact_source: null,
  ...over,
});

describe("leadReachChannel", () => {
  it("prefers a usable email", () => {
    expect(
      leadReachChannel(
        lead({
          email: "info@x.hu",
          email_status: "valid",
          social_links: { instagram: "https://instagram.com/x" },
          phone: "+36 1 234 5678",
        }),
      ),
    ).toBe("email");
  });

  it("treats an invalid address as no channel — it is a guaranteed bounce", () => {
    expect(leadReachChannel(lead({ email: "x@dead.hu", email_status: "invalid" }))).toBe("none");
  });

  it("falls back to a social DM, then phone", () => {
    expect(
      leadReachChannel(
        lead({
          email: "x@dead.hu",
          email_status: "invalid",
          social_links: { facebook: "https://facebook.com/x" },
        }),
      ),
    ).toBe("social");
    expect(leadReachChannel(lead({ phone: "+36 1 234 5678" }))).toBe("phone");
  });

  it("risky and unknown emails still count as a channel", () => {
    expect(leadReachChannel(lead({ email: "info@x.hu", email_status: "risky" }))).toBe("email");
    expect(leadReachChannel(lead({ email: "info@x.hu", email_status: null }))).toBe("email");
  });

  it("returns none when nothing is reachable, and tolerates junk social_links", () => {
    expect(leadReachChannel(lead())).toBe("none");
    expect(leadReachChannel(lead({ social_links: "not-an-object" }))).toBe("none");
    expect(leadReachChannel(lead({ social_links: {} }))).toBe("none");
    expect(isContactable(lead())).toBe(false);
  });

  it("ignores a social entry that is not a DM channel", () => {
    expect(leadReachChannel(lead({ social_links: { tiktok: "https://tiktok.com/@x" } }))).toBe("none");
  });
});

describe("contactabilityStats", () => {
  it("counts each channel once and computes the rate", () => {
    const stats = contactabilityStats([
      lead({ email: "a@x.hu", email_status: "valid" }),
      lead({ email: "b@x.hu", email_status: "risky", contact_source: "website" }),
      lead({ social_links: { instagram: "https://instagram.com/x" } }),
      lead({ phone: "+36 1 234 5678" }),
      lead(),
    ]);

    expect(stats.total).toBe(5);
    expect(stats.by_email).toBe(2);
    expect(stats.by_social).toBe(1);
    expect(stats.by_phone).toBe(1);
    expect(stats.unreachable).toBe(1);
    expect(stats.reachable).toBe(4);
    expect(stats.rate).toBe(80);
    expect(stats.harvested_emails).toBe(1);
  });

  it("does not credit harvesting when the address came from Maps", () => {
    const stats = contactabilityStats([
      lead({ email: "a@x.hu", email_status: "valid", contact_source: "gmaps" }),
    ]);
    expect(stats.harvested_emails).toBe(0);
  });

  it("is safe on an empty list (no divide-by-zero)", () => {
    const stats = contactabilityStats([]);
    expect(stats.total).toBe(0);
    expect(stats.rate).toBe(0);
    expect(stats.reachable).toBe(0);
  });
});
