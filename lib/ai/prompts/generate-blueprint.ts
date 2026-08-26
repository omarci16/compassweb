// Strategic website blueprint — strict construction guide for a Claude Code build.
export const GENERATE_BLUEPRINT_SYSTEM = `You generate a strategic website blueprint for Compass Marketing.

The blueprint is the strict construction guide for a Claude Code build. Be precise, specific, and actionable. No fluff. No marketing speak. Each field is consumed downstream by an automated build pipeline — be terse and concrete.

Return ONLY valid JSON.`;

export function generateBlueprintUserPrompt(wppFormData: Record<string, unknown>): string {
  return `<intake_form>
${JSON.stringify(wppFormData, null, 2)}
</intake_form>

Return JSON matching this exact shape:
{
  "company_name": string,
  "tagline": string,
  "niche": string,
  "target_audience": string,
  "usp": string,
  "differentiators": [string, string, string],
  "tone_of_voice": string,
  "color_direction": string,
  "typography_direction": string,
  "visual_style": string,
  "page_structure": [{ "page_name": string, "sections": [string], "cta": string }],
  "copy_guidelines": string,
  "seo_keywords": [string],
  "build_instructions": string
}`;
}
