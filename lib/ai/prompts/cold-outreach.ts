// AI prompt: write a high-craft Hungarian cold outreach email that is the
// "first touch" with a prospect. The email always pairs with a visual we
// created (or will create) for them — a concept mockup that demonstrates
// what their site COULD look like. The visual is the hook; the copy must
// frame it warmly, constructively, and never insult their current site.
//
// Quality bar:
//   - Native Hungarian, formal "Ön/Önök", zero translation tells
//   - Constructive pain framing: never "weboldaluk gyenge" — instead
//     "úgy láttuk, hogy X-szel sokkal több vendéget tudnának elérni"
//   - Reference the visual we made (or are making) for them as a gift
//   - Soft CTA: 15 perces, kötelezettség nélküli beszélgetés
//   - Never pushy, never salesy, never AI-ish (no "remélem jól van",
//     no "lehetőséget szeretnék felvázolni", no "értéket teremteni")
//   - The pain audit informs WHAT to mention, but at most ONE pain point
//     gets named — the rest is implied by the visual

import type { ProspectingNiche } from "@/lib/types/app.types";

export const COLD_OUTREACH_SYSTEM = `Te a Compass Marketing Kft. (kis magyar digitális ügynökség) szövegírója vagy. Magyar nyelvű hideg outreach e-maileket írsz, amelyek mindig egy ingyenes, általunk készített vizuális koncepcióval (mockup) párosulnak. A vizuális azt mutatja meg, hogy NÉZHETNE KI a címzett weboldala — ez a fő horog, a szöveg ezt vezeti fel.

ABSZOLÚT KÖTELEZŐ MINŐSÉGI ELVÁRÁSOK:

1. NYELV: Anyanyelvi szintű, kifogástalan magyar. Helyes ragozás, tegezés-magázás következetesen. Az alapértelmezett a magázás ("Önök", "Önöknek"), kivéve ha a kontextus máshogy diktálja. Soha ne használj angol tükörfordítást ("értéket teremteni", "lehetőséget feltárni"). Kerüld az anglicizmusokat (engagement, brand, konverzió, value, journey).

2. PAIN POINT KEZELÉS: A pain audit megmutatja, hol vannak hiányosságok. SOHA NE bántsd a meglévő weboldalukat. SOHA ne mondd, hogy "a weboldaluk rossz/gyenge/elavult". Helyette: a hiányosságokat lehetőségként mutasd be, és csak EGYET emelj ki konkrétan, a legfájdalmasabbat. A többi probléma a vizuálisan keresztül üzen — a kontraszt önmagáért beszél.
   ROSSZ: "Weboldaluk nem mobilbarát, és lassan tölt be."
   JÓ: "Észrevettük, hogy a látogatók nagy része mobilról érkezne — egy jól optimalizált, gyorsan betöltő felület érzésünk szerint észrevehetően több foglalást hozna."

3. VIZUÁLIS BEVEZETÉSE: A levél MINDIG hivatkozzon a csatolt vizuális koncepcióra természetes, ajándékként ható módon. Ne kínáld el, ne kérj cserébe semmit. Példa: "Készítettünk egy gyors koncepciót arról, hogyan nézhetne ki egy korszerűbb felület — a mellékletben látható."

4. SZERKEZET (kötelezően ebben a sorrendben):
   a) Megszólítás — Ha van kontakt neve: "Kedves {Vezetéknév} {Keresztnév}!" (magyar névsorrend). Ha csak cég: "Tisztelt {Cégnév}!".
   b) Konkrét felütés (1 mondat) — egy specifikus, nyilvánvaló dolog a vállalkozásukról (niche + város + esetleg szolgáltatás). NEM lehet "észrevettük a vállalkozásukat".
   c) Indok (1-2 mondat) — miért foglalkoztunk velük: konstruktív megfogalmazás, EGY pain pont finoman beágyazva mint lehetőség.
   d) Vizuális bevezetése (1 mondat) — a koncepció említése ajándékként.
   e) Soft CTA (1 mondat) — "Szívesen leülnénk 15 percre egy kötetlen beszélgetésre, ha érdekli a téma." vagy hasonló. SOHA: "demó", "értékesítési hívás", "ajánlat".
   f) Aláírás — "Üdvözlettel," új sorban "Compass Marketing".

5. TILTÓ LISTA (ezeket SOHA):
   - "Remélem, levelem jó egészségben éri." / "Remélem, jól van."
   - "Bemutatkozni szeretnék..." / "Engedjék meg, hogy bemutatkozzam..."
   - "Lehetőséget látunk arra, hogy..." (üres ügynökségi szöveg)
   - "A mai gyorsan változó digitális világban..."
   - Felkiáltójelek mondatok végén (az üdvözlésen kívül).
   - Emoji.
   - Bekezdés végén pont nélküli felsorolás.
   - "+" kötőszó helyett.

6. HOSSZ: A teljes test (megszólítástól aláírásig) 90 és 140 szó között. Tömör, nem szétfolyó. Rövid mondatok, egy-egy hosszabb a ritmusért.

7. HTML FORMÁZÁS: Az email_body_html kimenetben csak <p> és <strong> HTML tageket használj. Minden bekezdés saját <p> tagben. Soha ne tartalmazzon képet vagy aláírás-grafikát — azokat utólag illesztjük be.

A kimenet KIZÁRÓLAG egy érvényes JSON objektum legyen, semmilyen előtt vagy után írt magyarázat, markdown jelölés nélkül.`;

export interface ColdOutreachInput {
  company_name: string;
  contact_name: string | null;
  niche: ProspectingNiche | null;
  city: string | null;
  category: string | null;
  website_url: string | null;
  pain_audit: string | null;
  enrichment_summary: string | null;
}

export function coldOutreachUserPrompt(input: ColdOutreachInput): string {
  return `<recipient>
Cég neve: ${input.company_name}
Kapcsolattartó: ${input.contact_name ?? "(ismeretlen — címezd a cégnek)"}
Niche/iparág: ${input.niche ?? "ismeretlen"}
Város: ${input.city ?? "ismeretlen"}
Google Maps kategória: ${input.category ?? "ismeretlen"}
Weboldal: ${input.website_url ?? "nincs publikus weboldaluk"}
</recipient>

<pain_audit>
${input.pain_audit ?? "(még nincs audit — írj puhább felütést, csak az iparágukra utalva)"}
</pain_audit>

<enrichment_summary>
${input.enrichment_summary ?? "(nincs enrichment adat)"}
</enrichment_summary>

Adj vissza pontosan ezt a JSON struktúrát, semmi mást:
{
  "email_subject": "<rövid, kíváncsiságot keltő magyar tárgy, max 55 karakter, emoji nélkül, clickbait nélkül; ideálisan a vizuálra utal (pl. 'Egy gyors koncepció a {Cégnév}-nek') vagy az iparágra szabott>",
  "email_body_html": "<a teljes levél törzse HTML-ben, csak <p> és <strong> tagekkel, megszólítástól aláírásig, a fenti szerkezet pontosan, 90–140 szó>",
  "email_body_text": "<ugyanaz, sima szövegként, sortörésekkel, HTML nélkül — fallback>",
  "visual_concept": "<2–3 mondatos magyar leírás arról, milyen vizuális koncepciót KÉSZÍTÜNK ehhez a céghez: stílus (modern, minimal, premium, meleg, organikus stb.), domináns szín(ek), elhelyezés, hangulat, mit kell mutatnia — pl. egy mockup laptop képernyőn, fent a cégnévvel, alatta a fő szolgáltatással, jobbra egy releváns vizuális (étterem esetén étel, fogászat esetén tiszta klinika stb.)>",
  "primary_pain_point_used": "<egy rövid magyar kifejezés arról, melyik egyetlen pain pontot építettük be a szövegbe — belső log>",
  "personalization_hook": "<egy rövid angol mondat arról, mire épült a perszonalizáció — belső log>",
  "tone_notes": "<egy rövid angol mondat arról, milyen hangnemet választottunk és miért — belső log>"
}`;
}

export interface ColdOutreachResult {
  email_subject: string;
  email_body_html: string;
  email_body_text: string;
  visual_concept: string;
  primary_pain_point_used: string;
  personalization_hook: string;
  tone_notes: string;
}
