// Renders a resolved Voice Profile into a prompt fragment appended AFTER a
// prompt file's immutable structural/grounding rules. Kept as a clearly
// labeled "additional guidance" block so the model treats it as tone
// steering, never as license to break a structural rule (HTML restriction,
// JSON contract, anti-hallucination grounding, etc).

import type { EmailVoiceProfile } from "@/lib/types/app.types";

const VOICE_BLOCK_HEADER =
  "KIEGÉSZÍTŐ HANGNEM-ÚTMUTATÓ (nem írja felül a fenti kötelező szabályokat):";

export function buildVoiceBlock(profile: EmailVoiceProfile): string {
  const lines: string[] = [VOICE_BLOCK_HEADER];

  if (profile.voice_description) {
    lines.push(`- Hangnem: ${profile.voice_description}`);
  }

  const traits = Object.entries(profile.tone_traits ?? {}).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );
  if (traits.length > 0) {
    lines.push(`- Tónus jellemzők: ${traits.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  if (profile.word_count_min != null && profile.word_count_max != null) {
    lines.push(`- Hossz: ${profile.word_count_min}–${profile.word_count_max} szó.`);
  }

  if (profile.banned_phrases.length > 0) {
    lines.push(`- Ezeket SOHA ne használd: ${profile.banned_phrases.join(" / ")}`);
  }

  if (profile.required_elements.length > 0) {
    lines.push(`- Ezeket mindig tartalmazza: ${profile.required_elements.join(" / ")}`);
  }

  if (profile.few_shot_examples.length > 0) {
    lines.push("- Példák a kívánt hangnemre (a stílust kövesd, ne másold szó szerint):");
    for (const ex of profile.few_shot_examples) {
      lines.push(
        `  · Tárgy: ${ex.subject}\n    Törzs: ${ex.body_html}` +
          (ex.note ? `\n    Megjegyzés: ${ex.note}` : ""),
      );
    }
  }

  if (profile.signature_block) {
    lines.push(`- Aláírás pontosan ez legyen: "${profile.signature_block.replace(/\n/g, " / ")}"`);
  }

  return lines.join("\n");
}
