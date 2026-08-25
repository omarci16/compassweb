import OpenAI from "openai";
import type { ZodType } from "zod";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

// Non-dated family alias (mirrors CLAUDE_MODEL's "claude-sonnet-5" convention) so
// OpenAI's own routing picks up in-family improvements without a code change.
// Newer point releases (gpt-5.2/5.4/5.5) exist in the installed SDK's model union —
// re-check pricing/availability at the OpenAI dashboard before bumping this.
export const OPENAI_MODEL = "gpt-5.1";

/**
 * Calls OpenAI (Responses API) with a system prompt + user message and returns
 * text content. Throws on API error / empty response so callers can surface it.
 */
export async function callOpenAI(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const openai = getOpenAI();
  const res = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: opts.system,
    input: opts.user,
    max_output_tokens: opts.maxTokens ?? 1000,
  });

  const text = res.output_text;
  if (!text || !text.trim()) throw new Error("OpenAI returned empty response");
  return text;
}

/**
 * Calls OpenAI with a hand-written strict JSON Schema (Structured Outputs), then
 * re-validates against the equivalent zod schema as a defense-in-depth check —
 * strict mode makes malformed JSON unlikely, not impossible.
 */
export async function callOpenAIStructured<T>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodType<T>;
}): Promise<T> {
  const openai = getOpenAI();
  const res = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: opts.system,
    input: opts.user,
    max_output_tokens: opts.maxTokens ?? 1000,
    text: {
      format: {
        type: "json_schema",
        name: opts.schemaName,
        schema: opts.jsonSchema,
        strict: true,
      },
    },
  });

  const text = res.output_text;
  if (!text || !text.trim()) throw new Error("OpenAI returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI structured output was not valid JSON: ${text.slice(0, 200)}`);
  }
  return opts.zodSchema.parse(parsed);
}
