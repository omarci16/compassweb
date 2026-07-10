import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const CLAUDE_MODEL = "claude-sonnet-5";

/**
 * Calls Claude with a system prompt + user message and returns text content.
 * Throws on API error so callers can surface the failure.
 *
 * Notes for claude-sonnet-5 (see the claude-api skill):
 *   - `temperature`/`top_p`/`top_k` are rejected (400) — steer via prompt only.
 *   - Adaptive thinking is ON by default. We disable it: every call here has a
 *     small max_tokens budget (400–1400) and thinking tokens would eat into it,
 *     truncating the short Hungarian paragraphs / JSON we ask for.
 */
export async function callClaude(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getAnthropic();
  // `thinking` isn't in this SDK version's types (0.27.x); it's a valid request
  // field that the API honours, so we attach it on an untyped params object.
  const params: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 1000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    thinking: { type: "disabled" },
  };
  const res = (await anthropic.messages.create(
    params as unknown as Parameters<typeof anthropic.messages.create>[0],
  )) as Anthropic.Message;

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!text.trim()) throw new Error("Claude returned empty response");
  return text;
}

/** Parses a JSON object out of Claude's response, tolerant of leading prose. */
export function extractJson<T>(text: string): T {
  const trimmed = text.trim();
  // Try direct parse first
  try {
    return JSON.parse(trimmed) as T;
  } catch {}
  // Find first { ... last }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in Claude response: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as T;
}

/**
 * Extract JSON from Claude's response AND validate it against a zod schema.
 * Throws on malformed / incomplete JSON (e.g. an output truncated at max_tokens)
 * so callers get a clear failure instead of a silently-wrong object.
 */
export function extractJsonWithSchema<T>(text: string, schema: ZodType<T>): T {
  return schema.parse(extractJson<unknown>(text));
}
