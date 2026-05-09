import { ApifyClient } from "apify-client";

let client: ApifyClient | null = null;

export function getApifyClient(): ApifyClient {
  if (!client) {
    if (!process.env.APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not set");
    }
    client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
  }
  return client;
}

export const APIFY_ACTORS = {
  WEBSITE_CRAWLER: "apify/website-content-crawler",
} as const;

/**
 * Trigger a website content crawl. Returns the run object — the caller
 * polls or awaits via the Apify webhook.
 */
export async function crawlWebsite(websiteUrl: string) {
  const apify = getApifyClient();
  const run = await apify.actor(APIFY_ACTORS.WEBSITE_CRAWLER).start({
    startUrls: [{ url: websiteUrl }],
    maxCrawlPages: 5,
    crawlerType: "playwright:adaptive",
    saveMarkdown: true,
    saveHtml: false,
  });
  return run;
}

export async function getCrawlResults(runId: string) {
  const apify = getApifyClient();
  const { items } = await apify.run(runId).dataset().listItems();
  return items;
}
