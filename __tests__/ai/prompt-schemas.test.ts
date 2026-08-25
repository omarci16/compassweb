import { describe, expect, it } from "vitest";
import { ColdOutreachSchema, ColdOutreachJsonSchema } from "@/lib/ai/prompts/cold-outreach";
import { DraftProposalSchema, DraftProposalJsonSchema } from "@/lib/ai/prompts/draft-proposal";
import { DraftFollowupSchema, DraftFollowupJsonSchema } from "@/lib/ai/prompts/draft-followup";

// OpenAI Structured Outputs strict mode needs a hand-written JSON Schema
// (zod-to-json-schema output doesn't reliably satisfy strict-mode constraints).
// The hand-written schema and the zod schema must never drift apart, since the
// zod schema is what actually validates the parsed response at runtime.
function assertParity(zodSchema: { shape: Record<string, unknown> }, jsonSchema: {
  properties: Record<string, unknown>;
  required: readonly string[];
  additionalProperties: boolean;
}) {
  const zodKeys = Object.keys(zodSchema.shape).sort();
  const jsonSchemaKeys = Object.keys(jsonSchema.properties).sort();
  expect(jsonSchemaKeys).toEqual(zodKeys);
  expect([...jsonSchema.required].sort()).toEqual(zodKeys);
  expect(jsonSchema.additionalProperties).toBe(false);
}

describe("ColdOutreachJsonSchema / ColdOutreachSchema parity", () => {
  it("keys, required, and additionalProperties all line up", () => {
    assertParity(ColdOutreachSchema, ColdOutreachJsonSchema);
  });
});

describe("DraftProposalJsonSchema / DraftProposalSchema parity", () => {
  it("keys, required, and additionalProperties all line up", () => {
    assertParity(DraftProposalSchema, DraftProposalJsonSchema);
  });
});

describe("DraftFollowupJsonSchema / DraftFollowupSchema parity", () => {
  it("keys, required, and additionalProperties all line up", () => {
    assertParity(DraftFollowupSchema, DraftFollowupJsonSchema);
  });
});
