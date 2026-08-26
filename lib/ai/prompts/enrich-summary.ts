// Summarises a crawled website into a short sales-qualification snapshot.
//
// Grounding matters here: this summary feeds the pain-audit and cold-outreach
// prompts, so it must describe ONLY what the crawl actually contains. An error
// page, cookie wall, or JS challenge crawled instead of the real site must not
// be summarised as if it were the company's website.

export const ENRICH_SUMMARY_SYSTEM = `You analyse a company's crawled website content to help a sales team qualify a lead.

RULES:
1. State ONLY what the crawl content actually evidences. Do not infer a company's "digital presence quality" from what is ABSENT — you are looking at page text, not the rendered design or analytics setup.
2. If the content looks like an error page, a cookie/consent wall, a bot challenge ("just a moment", "enable JavaScript", "access denied"), or is otherwise not the company's real site, output EXACTLY the token CRAWL_BLOCKED and nothing else.
3. Be concise and factual. No flattery.

Output: 3–5 sentences of plain English, OR the single token CRAWL_BLOCKED. No JSON, no markdown, no headings.`;

export interface EnrichPage {
  url: string;
  title?: string;
  text: string;
}

export interface EnrichContext {
  health_status?: string | null;
  verified_signals?: string[];
}

/** hu+en markers of a page that is NOT the real site (challenge / consent / error). */
export function looksLikeBlockedPage(text: string): boolean {
  return /just a moment|checking your browser|__cf_chl|cf-browser-verification|captcha|attention required|ddos-guard|access denied|403 forbidden|not found|enable javascript|please enable js|sütiket? (elfogad|beállít)|cookie (settings|consent|policy)|elfogadom a sütiket/i.test(
    text,
  );
}

export function enrichSummaryUserPrompt(
  pages: EnrichPage[],
  context?: EnrichContext,
): string {
  const pageBlocks = pages
    .slice(0, 5)
    .map(
      (p) =>
        `<page url="${p.url}">\n${p.title ? p.title + "\n" : ""}${p.text.slice(0, 3000)}\n</page>`,
    )
    .join("\n");

  const ctx = context
    ? `<measured_context>
Site status: ${context.health_status ?? "unknown"}
Verified signals: ${context.verified_signals?.length ? context.verified_signals.join(", ") : "none"}
</measured_context>
`
    : "";

  return `${ctx}<crawl>
${pageBlocks}
</crawl>

Cover, based only on the crawl content:
1. What this company does
2. Apparent budget signals (premium vs budget)
3. Opportunities visible in their current content`;
}
