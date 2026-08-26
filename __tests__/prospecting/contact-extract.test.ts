import { describe, expect, it } from "vitest";
import {
  bestEmail,
  extractContacts,
  extractEmails,
  extractPhones,
  extractSocials,
  hasSocialChannel,
  isRejectedEmail,
  mergeContacts,
  normalizeHuPhone,
  rankEmail,
} from "@/lib/prospecting/contact-extract";

/** Wrap fragments in a minimal page so tests read like real markup. */
const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`;

const SITE = "https://fogaszat-kovacs.hu";

describe("isRejectedEmail", () => {
  it("drops automated and infrastructure boxes", () => {
    expect(isRejectedEmail("noreply@fogaszat-kovacs.hu")).toBe(true);
    expect(isRejectedEmail("no-reply@x.hu")).toBe(true);
    expect(isRejectedEmail("postmaster@x.hu")).toBe(true);
    expect(isRejectedEmail("webmaster@x.hu")).toBe(true);
  });

  it("drops asset filenames that merely contain @", () => {
    expect(isRejectedEmail("logo@2x.png")).toBe(true);
    expect(isRejectedEmail("icon@3x.webp")).toBe(true);
  });

  it("drops placeholders and platform boilerplate", () => {
    expect(isRejectedEmail("your@email.com")).toBe(true);
    expect(isRejectedEmail("name@example.com")).toBe(true);
    expect(isRejectedEmail("hello@wixpress.com")).toBe(true);
    expect(isRejectedEmail("a1b2c3d4e5f6a7b8c9d0@sentry.io")).toBe(true);
  });

  it("keeps genuine business addresses", () => {
    expect(isRejectedEmail("info@fogaszat-kovacs.hu")).toBe(false);
    expect(isRejectedEmail("kovacs.peter@fogaszat-kovacs.hu")).toBe(false);
    expect(isRejectedEmail("rendelo@gmail.com")).toBe(false);
  });
});

describe("rankEmail", () => {
  it("ranks own-domain personal above own-domain role", () => {
    const personal = rankEmail("kovacs.peter@fogaszat-kovacs.hu", SITE, false);
    const role = rankEmail("info@fogaszat-kovacs.hu", SITE, false);
    expect(personal.rank).toBeGreaterThan(role.rank);
    expect(personal.kind).toBe("personal");
    expect(role.kind).toBe("role");
  });

  it("ranks any own-domain address above freemail", () => {
    const own = rankEmail("info@fogaszat-kovacs.hu", SITE, false);
    const free = rankEmail("kovacs.peter@gmail.com", SITE, false);
    expect(own.rank).toBeGreaterThan(free.rank);
    expect(own.own_domain).toBe(true);
    expect(free.own_domain).toBe(false);
    expect(free.kind).toBe("freemail");
  });

  it("treats subdomains as the same business", () => {
    expect(rankEmail("info@shop.fogaszat-kovacs.hu", SITE, false).own_domain).toBe(true);
    expect(rankEmail("info@masikceg.hu", SITE, false).own_domain).toBe(false);
  });

  it("gives mailto-linked addresses a bump over loose text", () => {
    const linked = rankEmail("info@fogaszat-kovacs.hu", SITE, true);
    const loose = rankEmail("info@fogaszat-kovacs.hu", SITE, false);
    expect(linked.rank).toBeGreaterThan(loose.rank);
  });
});

describe("extractEmails", () => {
  it("picks the owner's address over the role box and ignores junk", () => {
    const html = page(`
      <img src="/img/logo@2x.png">
      <script>Sentry.init({dsn:"https://abc123def456abc123def456@o1.ingest.sentry.io/42"});</script>
      <a href="mailto:info@fogaszat-kovacs.hu">Írjon nekünk</a>
      <p>Dr. Kovács: kovacs.peter@fogaszat-kovacs.hu</p>
      <a href="mailto:noreply@fogaszat-kovacs.hu">nope</a>
    `);
    const emails = extractEmails(html, "fogaszat-kovacs.hu");
    const addrs = emails.map((e) => e.email);

    expect(addrs[0]).toBe("kovacs.peter@fogaszat-kovacs.hu");
    expect(addrs).toContain("info@fogaszat-kovacs.hu");
    expect(addrs).not.toContain("noreply@fogaszat-kovacs.hu");
    expect(addrs.some((a) => a.includes("sentry"))).toBe(false);
    expect(addrs.some((a) => a.includes("2x.png"))).toBe(false);
  });

  it("undoes simple textual obfuscation, including the Hungarian 'kukac'", () => {
    const html = page(`<p>iroda [kukac] ugyvedimuhely.hu</p><p>info (at) ugyvedimuhely.hu</p>`);
    const addrs = extractEmails(html, "ugyvedimuhely.hu").map((e) => e.email);
    expect(addrs).toContain("iroda@ugyvedimuhely.hu");
    expect(addrs).toContain("info@ugyvedimuhely.hu");
  });

  it("keeps freemail when the site has nothing better", () => {
    const html = page(`<p>Kapcsolat: pizzeria.napfeny@gmail.com</p>`);
    const emails = extractEmails(html, "napfenypizzeria.hu");
    expect(emails).toHaveLength(1);
    expect(emails[0].kind).toBe("freemail");
    expect(emails[0].own_domain).toBe(false);
  });

  it("returns nothing for a page with no addresses", () => {
    expect(extractEmails(page("<p>Nyitva 9-17</p>"), "x.hu")).toEqual([]);
  });

  it("deduplicates the same address found twice", () => {
    const html = page(`
      <a href="mailto:info@bisztro.hu">info@bisztro.hu</a>
      <footer>info@bisztro.hu</footer>
    `);
    const emails = extractEmails(html, "bisztro.hu");
    expect(emails).toHaveLength(1);
    expect(emails[0].from_mailto).toBe(true);
  });
});

describe("normalizeHuPhone", () => {
  it("normalizes the common Hungarian input formats", () => {
    expect(normalizeHuPhone("+36 30 123 4567")).toBe("+36 30 123 4567");
    expect(normalizeHuPhone("06-30-123-4567")).toBe("+36 30 123 4567");
    expect(normalizeHuPhone("0036301234567")).toBe("+36 30 123 4567");
    expect(normalizeHuPhone("(06 1) 234 5678")).toBe("+36 1 234 5678");
  });

  it("rejects numbers that cannot be HU subscriber numbers", () => {
    expect(normalizeHuPhone("12345678901")).toBeNull(); // adószám-shaped
    expect(normalizeHuPhone("2024-01-15")).toBeNull();
    expect(normalizeHuPhone("+36 30 111")).toBeNull(); // too short
    expect(normalizeHuPhone("+36 111 111 111")).toBeNull(); // repdigit
    expect(normalizeHuPhone("+1 555 123 4567")).toBeNull(); // not HU
  });
});

describe("extractPhones", () => {
  it("prefers tel: hrefs and dedupes against body text", () => {
    const html = page(`
      <a href="tel:+36301234567">Hívjon</a>
      <p>Telefon: 06 30 123 4567</p>
      <p>Adószám: 12345678-2-42</p>
      <p>Központ: (06 1) 234 5678</p>
    `);
    expect(extractPhones(html)).toEqual(["+36 30 123 4567", "+36 1 234 5678"]);
  });

  it("returns nothing when the page has no phone number", () => {
    expect(extractPhones(page("<p>Csak email</p>"))).toEqual([]);
  });
});

describe("extractSocials", () => {
  it("captures business profiles and strips tracking params", () => {
    const html = page(`
      <a href="https://www.facebook.com/fogaszatkovacs?ref=page_internal">FB</a>
      <a href="https://instagram.com/fogaszat.kovacs/">IG</a>
      <a href="https://www.linkedin.com/company/kovacs-dental">LI</a>
    `);
    const s = extractSocials(html);
    expect(s.facebook).toBe("https://www.facebook.com/fogaszatkovacs");
    expect(s.instagram).toBe("https://instagram.com/fogaszat.kovacs");
    expect(s.linkedin).toBe("https://www.linkedin.com/company/kovacs-dental");
    expect(s.tiktok).toBeUndefined();
  });

  it("ignores share widgets and platform pages", () => {
    const html = page(`
      <a href="https://www.facebook.com/sharer/sharer.php?u=https://x.hu">Megosztás</a>
      <a href="https://www.facebook.com/">Facebook</a>
      <a href="https://twitter.com/intent/tweet">Tweet</a>
    `);
    expect(extractSocials(html).facebook).toBeUndefined();
  });
});

describe("extractContacts + merge", () => {
  it("extracts every channel from one page", () => {
    const html = page(`
      <a href="mailto:info@panzio.hu">info@panzio.hu</a>
      <a href="tel:+3612345678">Telefon</a>
      <a href="https://instagram.com/panzio.balaton">IG</a>
    `);
    const c = extractContacts(html, SITE.replace("fogaszat-kovacs.hu", "panzio.hu"));
    expect(bestEmail(c)).toBe("info@panzio.hu");
    expect(c.phones).toEqual(["+36 1 234 5678"]);
    expect(hasSocialChannel(c.socials)).toBe(true);
  });

  it("is safe on empty or missing HTML", () => {
    const c = extractContacts(null, SITE);
    expect(c.emails).toEqual([]);
    expect(c.phones).toEqual([]);
    expect(bestEmail(c)).toBeNull();
    expect(hasSocialChannel(c.socials)).toBe(false);
    expect(extractContacts("", null).emails).toEqual([]);
  });

  it("merges rendered over static, keeping the best rank per address", () => {
    const staticC = extractContacts(page(`<p>info@etterem.hu</p>`), "https://etterem.hu");
    const renderedC = extractContacts(
      page(`<a href="mailto:info@etterem.hu">x</a><a href="https://instagram.com/etterem">IG</a>`),
      "https://etterem.hu",
    );
    const merged = mergeContacts(renderedC, staticC);

    expect(merged.emails).toHaveLength(1);
    expect(merged.emails[0].from_mailto).toBe(true); // stronger signal won
    expect(merged.socials.instagram).toBe("https://instagram.com/etterem");
  });

  it("merge tolerates nulls on either side", () => {
    const c = extractContacts(page(`<p>info@x.hu</p>`), "https://x.hu");
    expect(mergeContacts(null, c).emails).toHaveLength(1);
    expect(mergeContacts(c, null).emails).toHaveLength(1);
    expect(mergeContacts(null, null).emails).toEqual([]);
  });
});
