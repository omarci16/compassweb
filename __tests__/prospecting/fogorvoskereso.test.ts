import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseClinicCards,
  parseClinicDetail,
  toLeadCandidate,
} from "@/lib/prospecting/sources/fogorvoskereso";

// Fixtures are trimmed captures of the live markup (2026-08-10), so a site
// redesign shows up here as a failing test rather than as silent empty scrapes.
const fixture = (name: string) =>
  readFileSync(join(__dirname, "../fixtures", name), "utf8");

const CARDS = fixture("fogorvoskereso-cards.html");
const DETAIL = fixture("fogorvoskereso-detail.html");

describe("parseClinicCards", () => {
  it("reads the real card markup", () => {
    const clinics = parseClinicCards(CARDS);
    expect(clinics.length).toBeGreaterThan(0);

    const c = clinics[0];
    expect(c.external_id).toMatch(/^\d+$/);
    expect(c.name.length).toBeGreaterThan(0);
    expect(c.detail_url).toMatch(/^https:\/\/fogorvoskereso\.hu\/rendelok\//);
  });

  it("captures city and coordinates when present", () => {
    const withCity = parseClinicCards(CARDS).find((c) => c.city);
    expect(withCity?.city).toBeTruthy();
    const withGeo = parseClinicCards(CARDS).find((c) => c.lat !== null);
    if (withGeo) {
      expect(withGeo.lat).toBeGreaterThan(45);
      expect(withGeo.lng).toBeGreaterThan(15);
    }
  });

  it("skips sponsored banner cards, which carry no data-id", () => {
    const banner = `
      <div class="col-xxl-4 clinic-list-item featured clinic-banner-item">
        <a href="https://advertiser.hu"><img src="/banner.jpg"></a>
      </div>`;
    expect(parseClinicCards(banner)).toEqual([]);
  });

  it("skips the 'register your practice' CTA", () => {
    const cta = `
      <div class="clinic-list-item" data-id="9" data-name="Reg">
        <a href="https://fogorvoskereso.hu/rendelok/regisztracio">Regisztráció</a>
      </div>`;
    expect(parseClinicCards(cta)).toEqual([]);
  });

  it("deduplicates a clinic repeated in one payload", () => {
    const dup = CARDS + CARDS;
    expect(parseClinicCards(dup).length).toBe(parseClinicCards(CARDS).length);
  });

  it("returns nothing for empty or junk input", () => {
    expect(parseClinicCards("")).toEqual([]);
    expect(parseClinicCards("<div>nothing here</div>")).toEqual([]);
  });
});

describe("parseClinicDetail", () => {
  it("takes the website from div.view-website, not the first external link", () => {
    const d = parseClinicDetail(DETAIL);
    expect(d.website_url).toBe("https://5dent.com/hu/");
    // the payment provider's PDF also appears on the page and must not win
    expect(d.website_url).not.toContain("simplepartner");
  });

  it("reads a plausible Hungarian phone and ignores malformed tel: hrefs", () => {
    expect(parseClinicDetail(DETAIL).phone).toBe("+36 96 571 290");

    const junk = `<a href="tel: Hermann Kétszer voltam az 5 Dentben és nagyon jó volt">x</a>`;
    expect(parseClinicDetail(junk).phone).toBeNull();
  });

  it("never returns the directory's own domain as the practice website", () => {
    const selfLink = `<div class="view-website"><a href="https://fogorvoskereso.hu/rendelok/1">x</a></div>`;
    expect(parseClinicDetail(selfLink).website_url).toBeNull();
  });

  it("is safe on a detail page with no website block", () => {
    expect(parseClinicDetail("<html><body>nothing</body></html>")).toEqual({
      website_url: null,
      phone: null,
    });
  });
});

describe("toLeadCandidate", () => {
  const clinic = {
    external_id: "4095",
    name: "5Dent Dental Clinic",
    city: "Mosonmagyaróvár",
    detail_url: "https://fogorvoskereso.hu/rendelok/4095-5dent-dental-clinic",
    lat: 47.8786143,
    lng: 17.2717476,
  };

  it("namespaces the dedup key so provenance is unmistakable and re-runs are idempotent", () => {
    const c = toLeadCandidate(clinic, { website_url: "https://5dent.com", phone: null }, "dental");
    expect(c.gmaps_place_id).toBe("fogorvoskereso:4095");
    expect(c.gmaps_url).toBe(clinic.detail_url);
  });

  it("maps onto the same shape the Google Maps path emits", () => {
    const c = toLeadCandidate(
      clinic,
      { website_url: "https://5dent.com", phone: "+36 96 571 290" },
      "dental",
    );
    expect(c.company_name).toBe("5Dent Dental Clinic");
    expect(c.niche).toBe("dental");
    expect(c.gmaps_city).toBe("Mosonmagyaróvár");
    expect(c.website_url).toBe("https://5dent.com");
    expect(c.gmaps_phone).toBe("+36 96 571 290");
    // Email is harvested later from the practice's own site (Phase I).
    expect(c.email).toBeNull();
    expect(c.social_links).toEqual({});
  });

  it("carries a practice with no listed website through as a needs_site candidate", () => {
    const c = toLeadCandidate(clinic, { website_url: null, phone: null }, "dental");
    expect(c.website_url).toBeNull();
  });
});
