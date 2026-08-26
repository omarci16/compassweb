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

export interface CrawlOptions {
  maxCrawlPages?: number;
  /** e.g. "playwright:adaptive" (default) or "playwright:firefox" for verification. */
  crawlerType?: string;
  saveHtml?: boolean;
}

/**
 * Trigger a website content crawl. Returns the run object — the caller
 * polls run status (see waitForCrawl) or awaits via the Apify webhook.
 */
export async function crawlWebsite(websiteUrl: string, opts: CrawlOptions = {}) {
  const apify = getApifyClient();
  const run = await apify.actor(APIFY_ACTORS.WEBSITE_CRAWLER).start({
    startUrls: [{ url: websiteUrl }],
    maxCrawlPages: opts.maxCrawlPages ?? 5,
    crawlerType: opts.crawlerType ?? "playwright:adaptive",
    saveMarkdown: true,
    saveHtml: opts.saveHtml ?? false,
  });
  return run;
}

/** Block until the Apify run reaches a terminal state (SUCCEEDED/FAILED/ABORTED). */
export async function waitForCrawl(runId: string, waitSecs = 120) {
  const apify = getApifyClient();
  return apify.run(runId).waitForFinish({ waitSecs });
}

/** Read the current run status without blocking (SUCCEEDED / FAILED / ...). */
export async function getRunStatus(runId: string): Promise<string | undefined> {
  const apify = getApifyClient();
  const run = await apify.run(runId).get();
  return run?.status;
}

/** Read ALL dataset items, paginating so large runs don't silently truncate. */
export async function getCrawlResults(runId: string) {
  const apify = getApifyClient();
  const ds = apify.run(runId).dataset();
  const all: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { items } = await ds.listItems({ offset, limit });
    all.push(...(items as Record<string, unknown>[]));
    if (items.length < limit) break;
    offset += items.length;
  }
  return all;
}
