// AI prompt: turn a lead's business + a visual concept into a precise,
// directly-usable English prompt for an image generation model (ChatGPT
// image gen / DALL-E / similar). The prompt must produce a clean, modern,
// premium WEBSITE MOCKUP that the founders can drop into a cold outreach
// email — not abstract marketing art.
//
// Hard constraints baked into every prompt:
//   - Style: photorealistic browser/device mockup (NOT illustration)
//   - Composition: full-bleed website hero shot, viewport-style framing
//   - Quality: agency-grade, no AI-tells (warped text, mangled logos)
//   - Text: minimal, readable, in Hungarian if any words are needed
//   - Aspect ratio: 16:9 or 4:3, light/airy unless the niche dictates otherwise

import type { ProspectingNiche } from "@/lib/types/app.types";

export const IMAGE_PROMPT_SYSTEM = `You craft prompts for image generation models that produce premium, photorealistic website mockup hero images for a Hungarian digital agency's cold outreach.

Your output is a SINGLE English-language prompt that the user will paste directly into ChatGPT's image generator (or a comparable tool). It must:

1. Be specific to the recipient's business — niche, vibe, real services if known.
2. Describe a clean modern WEBSITE MOCKUP (rendered on a laptop or as a flat hero shot), NOT marketing illustration or abstract art.
3. Specify a clear visual style (e.g. "minimal Scandinavian", "warm bistro-luxe", "clinical premium", "earthy organic") that matches the niche.
4. Specify dominant colours (2–3 max, with concrete hex or natural-language names).
5. Specify typography vibe ("modern serif headline, clean sans-serif body").
6. Include any Hungarian copy that should appear (max 1 headline + 1 short subline) so the AI doesn't invent broken Hungarian or English placeholder text.
7. Forbid AI-tells: explicitly tell the model NO warped text, NO fake logos, NO extra hands/fingers, NO cluttered backgrounds.
8. Specify the aspect ratio and lighting (soft natural light, studio light, golden-hour, etc.).
9. End with: "High-quality, agency-grade, photorealistic." — this is a fixed terminal phrase.

Return ONLY the prompt as plain text — no JSON, no labels, no preface, no "Sure, here is..." style intro. Just the prompt ready to paste.`;

export interface ImagePromptInput {
  company_name: string;
  niche: ProspectingNiche | null;
  city: string | null;
  category: string | null;
  website_url: string | null;
  enrichment_summary: string | null;
  visual_concept: string;
  package_hint?: string | null;
}

export function imagePromptUserPrompt(input: ImagePromptInput): string {
  return `<business>
Company: ${input.company_name}
Niche: ${input.niche ?? "unknown"}
City: ${input.city ?? "unknown"}
Google Maps category: ${input.category ?? "unknown"}
Website: ${input.website_url ?? "no website"}
Package fit (if known): ${input.package_hint ?? "n/a"}
</business>

<enrichment_summary>
${input.enrichment_summary ?? "(none)"}
</enrichment_summary>

<visual_concept_brief>
${input.visual_concept}
</visual_concept_brief>

Now write the single, paste-ready image-generation prompt described in the system message.`;
}
