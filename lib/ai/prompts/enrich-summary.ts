// Summarises raw Apify website crawl into a 3–5 sentence sales-qualification snapshot.
export const ENRICH_SUMMARY_SYSTEM = `You analyse a company's scraped website data to help a sales team qualify a lead.

Be concise and factual. Note the most relevant signals for selling web development. No fluff, no flattery, no diplomatic hedging.

Output: 3–5 sentences of plain English text. No JSON, no markdown, no headings.`;

export function enrichSummaryUserPrompt(apifyResult: unknown): string {
  const truncated = JSON.stringify(apifyResult).slice(0, 18_000);
  return `<crawl_result>
${truncated}
</crawl_result>

Cover:
1. What this company does
2. Current digital presence quality (be honest and specific)
3. Apparent budget signals (premium vs budget)
4. Key pain points or opportunities visible from their current site`;
}
