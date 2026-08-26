import { describe, expect, it } from "vitest";
import { normalizeWebsiteHost } from "@/lib/prospecting/normalize";

describe("normalizeWebsiteHost", () => {
  it("strips protocol, www, path, and lowercases", () => {
    expect(normalizeWebsiteHost("https://WWW.Example.hu/path?x=1")).toBe("example.hu");
    expect(normalizeWebsiteHost("http://example.hu")).toBe("example.hu");
    expect(normalizeWebsiteHost("example.hu/")).toBe("example.hu");
  });

  it("treats http/https and www/no-www as the same host", () => {
    const a = normalizeWebsiteHost("http://www.kovacsdental.hu");
    const b = normalizeWebsiteHost("https://kovacsdental.hu/rolunk");
    expect(a).toBe(b);
    expect(a).toBe("kovacsdental.hu");
  });

  it("returns null for empty / non-website values", () => {
    expect(normalizeWebsiteHost(null)).toBeNull();
    expect(normalizeWebsiteHost(undefined)).toBeNull();
    expect(normalizeWebsiteHost("")).toBeNull();
    expect(normalizeWebsiteHost("   ")).toBeNull();
    expect(normalizeWebsiteHost("tel:+3612345678")).toBeNull();
    expect(normalizeWebsiteHost("mailto:info@example.hu")).toBeNull();
  });

  it("keeps distinct hosts distinct", () => {
    expect(normalizeWebsiteHost("https://a.hu")).not.toBe(
      normalizeWebsiteHost("https://b.hu"),
    );
  });
});
