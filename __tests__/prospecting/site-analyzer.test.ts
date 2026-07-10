import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeSite,
  detectBotBlock,
  detectJsShell,
  detectTechStack,
  derivePainSignals,
} from "@/lib/prospecting/site-analyzer";
import type { SignalEvidence } from "@/lib/types/app.types";

// ---------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------

type Spec = { status: number; body: string; headers?: Record<string, string> };

function res(spec: Spec) {
  return {
    status: spec.status,
    url: "",
    headers: new Headers(spec.headers ?? {}),
    body: null,
    text: async () => spec.body,
  };
}

/** Route by URL; a value of `"THROW"` simulates a connection/TLS failure. */
function stubFetch(map: Record<string, Spec | "THROW">) {
  vi.stubGlobal("fetch", async (url: string) => {
    const entry = map[url];
    if (!entry || entry === "THROW") {
      throw new TypeError("fetch failed");
    }
    return res(entry) as unknown as Response;
  });
}

const bigPage = (extra = "") =>
  `<!DOCTYPE html><html lang="hu"><head>
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <meta property="og:title" content="Ingatlan">
   <script type="application/ld+json">{"@type":"RealEstateAgent"}</script>
   <script>gtag('js', new Date());</script>
   ${extra}
   </head><body>` +
  "<p>Valódi ingatlaniroda tartalom. </p>".repeat(400) +
  `<form action="/contact"></form></body></html>`;

const EVIDENCE: SignalEvidence = {
  requested_url: "https://x",
  final_url: "https://x",
  checked_at: "2026-07-10T00:00:00.000Z",
  method: "static_probe",
};

afterEach(() => vi.unstubAllGlobals());

// ---------------------------------------------------------------------
// The windingatlan.hu incident
// ---------------------------------------------------------------------

describe("analyzeSite — dual-scheme resolution (the windingatlan bug)", () => {
  it("uses the https site even when Google Maps listed http:// and http serves a stub", async () => {
    stubFetch({
      "https://windingatlan.hu": { status: 200, body: bigPage() },
      "http://windingatlan.hu": { status: 200, body: "Coming soon.." },
    });

    const r = await analyzeSite("http://windingatlan.hu");

    expect(r.health_status).toBe("healthy");
    expect(r.tech_stack?.has_https).toBe(true);
    expect(r.health_details.https_ok).toBe(true);
    const codes = r.pain_signals.map((s) => s.code);
    expect(codes).not.toContain("no_https");
    expect(codes).not.toContain("tiny_page");
    expect(codes).not.toContain("no_mobile_viewport");
  });

  it("fires a VERIFIED no_https only when https genuinely fails and http serves the site", async () => {
    stubFetch({
      "https://oldsite.hu": "THROW",
      "http://oldsite.hu": { status: 200, body: bigPage() },
    });

    const r = await analyzeSite("oldsite.hu");

    expect(r.tech_stack?.has_https).toBe(false);
    const noHttps = r.pain_signals.find((s) => s.code === "no_https");
    expect(noHttps).toBeDefined();
    expect(noHttps?.confidence).toBe("verified");
  });
});

// ---------------------------------------------------------------------
// "We couldn't look" must never be a buy signal
// ---------------------------------------------------------------------

describe("analyzeSite — unreachable / blocked never invent signals", () => {
  it("both schemes failing → unreachable with ZERO pain signals", async () => {
    stubFetch({ "https://dead.hu": "THROW", "http://dead.hu": "THROW" });

    const r = await analyzeSite("dead.hu");

    expect(r.health_status).toBe("unreachable");
    expect(r.pain_signals).toHaveLength(0);
    expect(r.tech_stack).toBeNull();
    expect(r.health_details.retried).toBe(true);
  });

  it("a 403 bot wall → blocked with ZERO pain signals (not 'broken')", async () => {
    stubFetch({
      "https://protected.hu": { status: 403, body: "Just a moment...", headers: { server: "cloudflare" } },
    });

    const r = await analyzeSite("protected.hu");

    expect(r.health_status).toBe("blocked");
    expect(r.pain_signals).toHaveLength(0);
  });

  it("a genuine 404 → broken with a VERIFIED site_broken signal", async () => {
    stubFetch({ "https://gone.hu": { status: 404, body: "Not found" } });

    const r = await analyzeSite("gone.hu");

    expect(r.health_status).toBe("broken");
    const broken = r.pain_signals.find((s) => s.code === "site_broken");
    expect(broken?.confidence).toBe("verified");
  });
});

// ---------------------------------------------------------------------
// JS shell vs genuine placeholder
// ---------------------------------------------------------------------

describe("analyzeSite — JS shell vs tiny placeholder", () => {
  it("a small Next.js shell → js_shell, NOT tiny_page", async () => {
    stubFetch({
      "https://spa.hu": { status: 200, body: `<div id="root"></div><script>window.__NEXT_DATA__={}</script>` },
    });

    const r = await analyzeSite("spa.hu");

    expect(r.health_status).toBe("js_shell");
    expect(r.pain_signals.map((s) => s.code)).not.toContain("tiny_page");
  });

  it("a genuinely tiny static page → tiny with a heuristic tiny_page signal", async () => {
    stubFetch({
      "https://stub.hu": { status: 200, body: "<html><body>Hamarosan</body></html>" },
    });

    const r = await analyzeSite("stub.hu");

    expect(r.health_status).toBe("tiny");
    const tiny = r.pain_signals.find((s) => s.code === "tiny_page");
    expect(tiny?.confidence).toBe("heuristic");
  });
});

// ---------------------------------------------------------------------
// Pure classifiers
// ---------------------------------------------------------------------

describe("detectBotBlock", () => {
  it("treats 403/429/503 as blocked", () => {
    expect(detectBotBlock(403, new Headers(), "")).toBe(true);
    expect(detectBotBlock(429, new Headers(), "")).toBe(true);
    expect(detectBotBlock(503, new Headers(), "")).toBe(true);
  });
  it("treats a 200 challenge body as blocked", () => {
    expect(detectBotBlock(200, new Headers(), "Just a moment... checking your browser")).toBe(true);
  });
  it("does not flag a normal 200 page", () => {
    expect(detectBotBlock(200, new Headers({ server: "nginx" }), "<html>real content</html>")).toBe(false);
  });
});

describe("detectJsShell", () => {
  it("flags a small framework shell", () => {
    expect(detectJsShell(`<div id="app"></div>`)).toBe(true);
    expect(detectJsShell(`<script>window.__NEXT_DATA__={}</script>`)).toBe(true);
  });
  it("does not flag a large ordinary page", () => {
    expect(detectJsShell("<p>real</p>".repeat(2000))).toBe(false);
  });
});

describe("derivePainSignals", () => {
  it("stamps confidence + evidence on every emitted signal", () => {
    const tech = detectTechStack("<html><body>x</body></html>", new Headers(), false);
    const signals = derivePainSignals(
      { health: "healthy", tech, bodyBytes: 6000, staleByDate: false, responseMs: 100 },
      EVIDENCE,
    );
    expect(signals.length).toBeGreaterThan(0);
    for (const s of signals) {
      expect(s.confidence).toBeDefined();
      expect(s.evidence).toEqual(EVIDENCE);
    }
    // no_https is verified because has_https was measured false
    expect(signals.find((s) => s.code === "no_https")?.confidence).toBe("verified");
  });

  it("emits only the measured no_https for a js_shell (no false content pains)", () => {
    const tech = detectTechStack(`<div id="root"></div>`, new Headers(), false);
    const signals = derivePainSignals(
      { health: "js_shell", tech, bodyBytes: 200, staleByDate: false, responseMs: 100 },
      EVIDENCE,
    );
    expect(signals.map((s) => s.code)).toEqual(["no_https"]);
  });
});
