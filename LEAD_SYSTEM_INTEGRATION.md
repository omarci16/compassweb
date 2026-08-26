# Lead Scoring Rendszer — Integrációs Dokumentáció

> Ez a dokumentum teljes körűen leírja az új lead gyűjtő és rangsoroló rendszert, annak belső felépítését, dashboard struktúráját, és pontosan meghatározza, hogy hogyan csatlakozik a meglévő Compass Marketing ERP rendszerhez. Beadható Claude-nak vagy más AI-nak, hogy bármely részét megépítse.

---

## 1. Rendszer áttekintés — Mi mit csinál

### Az új rendszer (Lead System — LS)
Leadeket gyűjt több forrásból, rangsorolja őket AI-alapú score-ral, és a minősített leadeket automatikusan átadja a Compass ERP-nek, ami elvégzi a teljes értékesítési és projektvezetési folyamatot.

### A meglévő rendszer (Compass ERP)
Ajánlatokat kezel, szerződéseket köt, projekteket vezet, automatikus emaileket küld, fizetéseket kezel, határidőket figyel.

### A két rendszer viszonya

```
[ Lead System ]  →→→  [ Compass ERP ]
  Leadgyűjtés             Ajánlatkezelés
  Scoring                 Szerződéskötés
  Rangsorolás             Projektvezetés
  Értesítés               Számlázás
  Nurtúrozás              Átadás
         ↑
    CSATLAKOZÁSI PONT
    Minősített lead átadása webhook-on keresztül
```

---

## 2. Teljes folyamat — lépésről lépésre

### 2.1 Lead belép a rendszerbe

**Forrás lehet:**
- Weboldal kapcsolati űrlap (compassmarketing.hu CTA form)
- Weboldal látványterv-kérő form (homepage CTA)
- Külső landing page form
- Manuálisan felvett lead az admin felületen
- Affiliate ajánlás (reflink-kel érkezik)
- Telefonos lead manuálisan rögzítve

**Kötelező adatok beérkezéskor:**
- Teljes név
- Email cím

**Opcionális, de scoring szempontból értékes:**
- Telefonszám ← ha megadja: +15 pont
- Cég neve ← ha megadja: +10 pont
- Jelenlegi weboldal URL-je ← ha van: +8 pont (ellenőrizhető)
- Ha nincs weboldal: más jelzés, +5 pont (szükségletalapú)
- Projekt leírás / üzenet ← ha ír részleteset: +12 pont
- Forrás (melyik formból jött) ← bizonyos formok értékesebbek

---

### 2.2 Lead automatikus kiértékelése (AI Scoring)

Minden beérkező lead azonnal kap egy **0–100 pontos AI score-t**:

| Komponens | Max pont | Hogyan számítódik |
|-----------|---------|-------------------|
| Adatteljességi score | 30 | Kötelező + opcionális mezők kitöltöttsége |
| Projekt leírás mélysége | 20 | Szószám, specifikusság, szándék |
| Weboldaluk elemzése | 15 | Ha van URL: PageSpeed, korszerűség, milyen CMS |
| Forrás minőség | 15 | Melyik form, melyik kampány, affiliate-e |
| Vállalati jelzők | 10 | Cég neve, domain email vs gmail/freemail |
| Időbeli jelzők | 10 | Munkaidőben érkezett-e, mennyire gyors a kitöltés |

**Score kategóriák:**

| Kategória | Pontszám | Szín | Automatikus akció |
|-----------|---------|------|-------------------|
| 🔥 Hot Lead | 75–100 | Piros | Azonnali értesítés + 2 órán belüli manuális review szükséges |
| ✅ Qualified | 50–74 | Zöld | Napi összesítőbe kerül, 24 órán belüli review |
| 🟡 Warm | 30–49 | Sárga | Automatikus nurture szekvencia indul |
| ❄️ Cold | 0–29 | Szürke | Várólistára kerül, heti összesítőbe |

---

### 2.3 Lead nurtúrozás (Warm és Cold leadeknek)

Ha a lead nem kerül azonnal kézbe, automatikus email szekvencia indul:

| Nap | Email tartalom |
|-----|---------------|
| 0 (azonnal) | Köszönő + "hamarosan foglalkozunk veled" email |
| 3 | Értékes tartalom küldése (blog cikk, esettanulmány) |
| 7 | "Mire számíthatsz tőlünk" email + weboldal link |
| 14 | Esetleges újrakérdezés: "Változott-e az igényed?" |
| 30 | Végleges "Ha szükséged lenne ránk" email + leiratkozás lehetőség |

**Hot és Qualified leadek** nem kapnak nurture szekvenciát — ők manuális review után egyből az ERP-be kerülnek.

---

### 2.4 Manuális review (Lead döntési pont)

Az admin a Lead System dashboardján látja a beérkező leadeket és dönthet:

| Döntés | Mi történik |
|--------|------------|
| ✅ Minősít (Qualify) | Lead átkerül a Compass ERP-be → automatikus ajánlatküldés indul |
| 📞 Konzultációt kér | Admin felveszi a kapcsolatot, később manuálisan minősíti |
| ⏸ Várakoztatja | Lead marad a rendszerben, nincs akció |
| ❌ Elutasít (Disqualify) | Lead archiválódik, nurture leáll |

---

### 2.5 Átadás a Compass ERP-nek (Csatlakozási pont)

Amikor az admin **Qualify** döntést hoz, a Lead System webhook-on keresztül elküldi a lead adatait a Compass ERP-nek.

**Ez a meglévő webhook:**
```
POST https://[compass-erp-domain]/api/lead
Header: X-Webhook-Secret: [ERP_WEBHOOK_SECRET]
Content-Type: application/json
```

**Küldött payload:**
```json
{
  "name": "Kovács János",
  "email": "kovacs.janos@ceged.hu",
  "phone": "+36 30 123 4567",
  "website_url": "https://regi-weboldaluk.hu",
  "no_website": false,
  "company_name": "Kovács és Társa Kft.",
  "notes": "source: lead_system_qualified | score: 82 | business: étterem, online foglalást szeretnének | priority: hot"
}
```

**Fontos feltételek az átadáshoz:**
- `name` kötelező
- `email` kötelező
- `phone` kötelező ← ha nincs meg, az admin felveszi konzultáción!
- Ha nincs `phone`, a Compass ERP nem fogadja el (az `ERP_FORWARD_TOPICS` ellenőrzés előtt is megszűrődik)

---

### 2.6 Compass ERP veszi át és kezeli a folyamatot

Az ERP fogadja a webhook-ot, és:

1. **Supabase `submit-lead` function** fut le → lead rekord rögzítve
2. **Admin értesítés** (email az `info@compassmarketing.hu`-ra)
3. **Admin ajánlatot készít** az ERP ajánlat moduljában (token-alapú)
4. **`/api/email/send-quote`** → ajánlat emailt küld az ügyfélnek (`/ajanlat/{token}`)
5. **Ügyfél megnyitja** az ajánlatot → `viewed` event logolva
6. **Ügyfél konzultációt kérhet** → `consultation` email adminnak
7. **Admin jóváhagyja** (`/api/admin/approve`) → fizetési email küldése (Stripe link vagy átutalás)
8. **Ügyfél fizet** → projekt létrejön az ERP projekt modulban
9. **Teljes projekt lifecycle** a Compass ERP-ben: fázisok, határidők, anyagok, átadás

---

## 3. Lead System — Dashboard struktúra

### 3.1 Sidebar navigáció

```
COMPASS — Lead System

━━━ OVERVIEW ━━━━━━━━━━━━
  ⊞  Vezérlőpult
  📊 Analytics

━━━ LEADEK ━━━━━━━━━━━━━
  📥 Összes lead           [badge: össz szám]
  🔥 Hot leadek            [badge: hot count, piros]
  ✅ Qualified             [badge: qualified count]
  🟡 Warming               [badge: warm count]
  ❄️  Cold / Archív

━━━ MŰVELETEK ━━━━━━━━━━━
  📤 Átadott leadek        (Compass ERP-be küldöttek)
  📞 Konzultációk          (folyamatban lévők)
  📧 Email kampányok       (nurture szekvenciák)

━━━ FORRÁSOK ━━━━━━━━━━━━
  🌐 Weboldalak            (melyik formból jön mi)
  🔗 Affiliate partnerek
  📢 Kampányok

━━━ BEÁLLÍTÁSOK ━━━━━━━━━
  ⚙️  Scoring szabályok
  📝 Email sablonok
  🔗 ERP kapcsolat         (webhook config)
  👥 Felhasználók
```

---

### 3.2 Vezérlőpult (főoldal) layout

```
┌────────────────────────────────────────────────────────┐
│  TopBar: "Lead Dashboard" │ keresés │ + Új lead │ 🔔   │
├──────────────────────────────────────────────────────-─┤
│                                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ Mai  │  │Heti  │  │ Hot  │  │Konv. │  │Átadott│   │
│  │leadek│  │leadek│  │leadek│  │arány │  │ERP-nek│   │
│  │  12  │  │  47  │  │  5   │  │ 68% │  │  38  │   │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘   │
│                                                         │
│  ┌─────────────────────────────┐  ┌──────────────────┐ │
│  │ Lead pipeline               │  │ Figyelmeztetések │ │
│  │ Hot ████████ 5              │  │ 🔥 Kovács János  │ │
│  │ Qual █████ 12               │  │    2 órája vár   │ │
│  │ Warm ████ 18                │  │ 🔥 Balogh Éva    │ │
│  │ Cold ██ 34                  │  │    3 órája vár   │ │
│  └─────────────────────────────┘  │ ──────────────── │ │
│                                   │ Közelgő teendők  │ │
│  ┌─────────────────────────────┐  │ 📞 Nagy Péter    │ │
│  │ Legújabb leadek             │  │    konzultáció   │ │
│  │ (táblázat — lásd 3.3)      │  │    ma 14:00      │ │
│  └─────────────────────────────┘  └──────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

### 3.3 Lead lista táblázat

**Oszlopok:**

| Oszlop | Tartalom | Szín/típus |
|--------|---------|-----------|
| Score | 0–100 szám + színes sáv | Piros/Zöld/Sárga/Szürke |
| Kategória | Hot / Qualified / Warm / Cold | Színes badge |
| Neve | Teljes név | Bold |
| Email | email cím | |
| Forrás | melyik formból jött | Pill badge |
| Beérkezett | mikor (relatív: "2 órája") | |
| Státusz | Új / Review alatt / Átadva / Elutasítva | Státusz badge |
| Felelős | Ki kezeli | Avatar |
| → | Detail panel nyitó | |

**Szűrők:**
- Kategória (Hot / Qualified / Warm / Cold)
- Státusz (Új / Review / Átadva / Elutasítva)
- Forrás (weboldal / affiliate / manuális / kampány)
- Dátum intervallum
- Felelős személy

---

### 3.4 Lead detail panel

Kattintásra nyílik, a sor alatt (ugyanúgy mint az ERP projekt detail panelben):

```
┌─────────────────────────────────────────────────────────────────┐
│  Lead: Kovács János — info@ceged.hu                             │
│  Beérkezett: 2026-05-21 10:23 │ Forrás: homepage_cta           │
│  [Minősít] [Konzultáció] [Elutasít] [Várakoztat]               │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│ Lead adatai  │ AI Score     │ Nurture      │ Tevékenységnapló   │
│              │ részletezés  │ állapot      │                    │
│ Név          │ 82/100 🔥    │ Email 1: ✓   │ 10:23 Beérkezett  │
│ Email        │              │ Email 2: —   │ 10:23 Score: 82   │
│ Tel          │ Adatteljess. │ Email 3: —   │ 10:25 Admin értes.│
│ Cég          │ █████ 28/30  │              │                    │
│ Weboldal     │ Leírás       │ Következő:   │                    │
│ Leírás       │ ████ 16/20   │ Email 2      │                    │
│              │ Weboldal     │ +3 nap       │                    │
│ Megjegyzés   │ ███ 12/15    │              │                    │
│ hozzáadása   │ Forrás       │ [Leállít]    │                    │
│              │ ████ 13/15   │              │                    │
│              │ Egyéb        │              │                    │
│              │ ████ 13/20   │              │                    │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

---

### 3.5 Scoring szabályok oldal (Settings → Scoring)

Admin konfigurálható szabályok:

```
Scoring Szabályok

Adatteljességi score (max 30 pont)
  ├─ Telefonszám megadva: [15] pont
  ├─ Cégnév megadva: [10] pont
  └─ Részletes leírás (50+ szó): [5] pont

Projekt leírás (max 20 pont)
  ├─ 10–50 szó: [8] pont
  ├─ 50–200 szó: [15] pont
  └─ 200+ szó: [20] pont

Weboldal elemzés (max 15 pont)
  ├─ Van URL és elérhető: [5] pont
  ├─ PageSpeed < 60: [+5] pont (szükségletalapú)
  ├─ Elavult design (5+ év): [+5] pont (szükségletalapú)
  └─ Nincs weboldal (has_no_website): [5] pont

Forrás minőség (max 15 pont)
  ├─ homepage_cta: [15] pont
  ├─ Affiliate referral: [13] pont
  ├─ Kampány landing: [10] pont
  └─ Ismeretlen forrás: [5] pont

Vállalati jelzők (max 10 pont)
  ├─ Vállalati email domain (nem @gmail/@yahoo): [7] pont
  └─ Cég neve tartalmaz "Kft."/"Zrt."/"BT.": [3] pont

Időbeli jelzők (max 10 pont)
  ├─ Munkaidőben érkezett (9–18 óra): [5] pont
  ├─ Hétköznap érkezett: [3] pont
  └─ Gyors kitöltés (2+ perc töltés): [2] pont
```

---

### 3.6 ERP kapcsolat oldal (Settings → ERP kapcsolat)

```
Compass ERP Webhook Konfiguráció

Endpoint URL:        [https://compassmarketing.hu/api/lead        ]
Webhook Secret:      [••••••••••••••••••••••••••••••••            ]
Teszt kapcsolat:     [🟢 Utoljára sikeres: 2026-05-21 09:45       ]

Átadási feltételek:
  ✅ Kötelező: name, email, phone
  ✅ Topic: "website_project"
  ✅ Timeout: 5 másodperc

Visszaesési logika:
  Ha a webhook sikertelen → [Újrapróbál: 3x, 5 perc késéssel]
  Ha mindhárom sikertelen  → [Admin értesítés + lead "Kézi átadás szükséges" státuszba]

Utolsó 10 webhook esemény:
  [log lista: timestamp, lead neve, státusz kód, latencia]

[Teszt webhook küldése]
```

---

## 4. Weboldalak — Mit kell a formoknak gyűjteni

### 4.1 Minimum szükséges adatok (minden formon)

```
name     — Teljes név (kötelező)
email    — Email cím (kötelező, validálva)
```

### 4.2 Scoring szempontból optimális adatok

```
phone          — Telefonszám (+15 pont, ha megvan)
company_name   — Cégnév (+10 pont)
website_url    — Jelenlegi weboldal (+8 pont)
has_no_website — Checkbox: "nincs weboldalom" (+5 pont)
description    — Rövid leírás mit szeretne (+20 pont ha részletes)
```

### 4.3 Rejtett mezők (automatikusan kitöltve, nem látja az ügyfél)

```
topic       — "website_project" vagy "free_mockup_request"
source_form — pl. "homepage_cta", "landing_page_fogaszat", "blog_cta"
utm_source  — Google/Meta kampányból jövőknél
utm_medium  — cpc / organic / email
utm_campaign— kampánynév
ref         — affiliate referral kód (ha van)
```

### 4.4 API hívás a weboldal formokból

```javascript
// Minden weboldal form ezt hívja:
const response = await fetch('/api/lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name,
    email,
    phone,            // ha gyűjtik
    company_name,     // ha gyűjtik
    website_url,      // ha gyűjtik
    has_no_website,   // ha checkbox be van pipálva
    business_description,  // ha gyűjtik
    topic: 'website_project',
    source_form: 'FORM_AZONOSITO',
  }),
});
```

### 4.5 Meglévő Compass formok és source_form azonosítóik

| Form helye | source_form értéke | Scoring súly |
|-----------|--------------------|-------------|
| Homepage CTA (látványterv) | `homepage_cta` | 15/15 pont |
| Termékek aloldal form | `products_page` | 13/15 pont |
| Blog oldal oldalsáv | `blog_sidebar` | 10/15 pont |
| Ajánlat kérő oldal | `arajanlat_page` | 15/15 pont |
| Popup (landing popup) | `landing_popup` | 12/15 pont |
| Affiliate reflink | `affiliate_ref` | 13/15 pont |

---

## 5. Csatlakozási pontok — Technikai részletek

### 5.1 LS → ERP: Lead átadás webhook

**Irány:** Lead System küld → Compass ERP fogad

**Endpoint (meglévő, már működik):**
```
POST https://compassmarketing.hu/api/lead
```

**Header:**
```
Content-Type: application/json
X-Webhook-Secret: [ERP_WEBHOOK_SECRET env változó]
```

**Payload (amit a LS küld):**
```json
{
  "name": "Kovács János",
  "email": "kovacs.janos@ceged.hu",
  "phone": "+36301234567",
  "website_url": "https://kovacs-ceged.hu",
  "no_website": false,
  "company_name": "Kovács és Társa Kft.",
  "notes": "source: lead_system | score: 82 | category: hot | business: Étterem, online foglalást és weboldalt szeretnének"
}
```

**Az ERP mit csinál ezzel (automatikusan):**
1. Supabase `submit-lead` Edge Function hívja az ERP-t
2. Lead rekord rögzítve a `leads` táblában
3. Admin értesítő email küldve (`info@compassmarketing.hu`)
4. Affiliate link ellenőrzés (ha affiliate-ből jött, kapcsolódik)

**Az `ERP_FORWARD_TOPICS` feltétel:**
- Csak `website_project` és `free_mockup_request` topic-ok esetén továbbít az ERP
- A Lead System mindig `website_project` topic-ot ad meg a payload-ban

**A `forwardToErp` function feltételei (mind kell):**
```typescript
ERP_WEBHOOK_URL   // konfigurálva legyen
ERP_WEBHOOK_SECRET // konfigurálva legyen
payload.topic     // 'website_project' vagy 'free_mockup_request'
payload.name      // nem üres
payload.email     // nem üres
payload.phone     // nem üres ← HA EZ HIÁNYZIK, NEM MEGY ÁT!
```

**Fontos:** Ha nincs telefonszám, a webhook nem kerül átküldésre az ERP-nek. A Lead System adminnak jeleznie kell ezt.

---

### 5.2 ERP → LS: Visszajelzés (opcionális, bővítési lehetőség)

Az ERP jelenleg nem küld visszajelzést a LS-nek. Bővítési lehetőség:

```
POST [lead-system-url]/api/erp-callback
{
  "original_email": "kovacs.janos@ceged.hu",
  "event": "lead_accepted" | "quote_sent" | "quote_approved" | "project_started",
  "timestamp": "2026-05-21T10:30:00Z"
}
```

Ez lehetővé tenné, hogy a LS nyomon kövesse, mi lett a lead-ből az ERP-ben.

---

### 5.3 Affiliate rendszer kapcsolódás

A Lead System affiliate kódot is átpasszolhat az ERP-nek. A meglévő `linkAffiliateIfExists` function a `affiliate_referrals` táblában keresi az egyező emailt és kapcsolja a lead_id-hoz.

**Ha affiliate-ből jön a lead:**
1. A form URL-ben `?ref=AFFILIATE_KOD` paraméter van
2. A LS eltárolja ezt a leadhez
3. Az átadáskor a `notes` mezőbe beleírja: `"ref: AFFILIATE_KOD"`
4. Az ERP `linkAffiliateIfExists` function keresi a `referred_email` alapján

---

## 6. Compass ERP belső folyamat (lead érkezés után)

### 6.1 Lead → Ajánlat → Projekt átmenet

```
Lead beérkezik az ERP-be
    ↓
Admin kap értesítő emailt
    ↓
Admin megnézi a Leads szekciót az ERP adminban
    ↓
Admin ajánlatot készít manuálisan (ERP ajánlat modul)
    ↓ (automatikus)
/api/email/send-quote → QuoteMockupReadyEmail küldve az ügyfélnek
Ajánlat URL: compassmarketing.hu/ajanlat/{token}
    ↓
Ügyfél megnyitja az ajánlatot (viewed event logolva)
    ↓
Ügyfél elfogadja VAGY konzultációt kér
    ↓ (ha elfogadja)
Admin jóváhagyja: /api/admin/approve
    → admin_approved = true
    → approval_email_sent = true
    → AjanlatJovahagyva email küldve
    → Stripe checkout session generálva (ha Stripe fizetés)
    ↓
Ügyfél fizet előleget (40%)
    ↓
/api/stripe/webhook → payment_status frissítve
/api/email/payment-success → visszaigazoló email
    ↓
Projekt létrejön az ERP projekt modulban
```

---

### 6.2 Projekt fázisok az ERP-ben (ami a LS leadből indul)

Teljes projekt életciklus a `TIMELINE_STEPS` alapján:

```
1. Szerződés         — szerződés aláírva
2. Előleg fizetve    — 40% beérkezett
3. Anyagbekérés      — anyagbekérő email elküldve, 3 napos határidő
4. Fejlesztés        — aktív fejlesztési fázis
5. Első átadás       — teszt link küldve az ügyfélnek
6. Tesztelés         — ügyfél 3 napja van jelezni módosítást
7. Záró fizetés      — 60% beérkezett
8. Élesítés          — domain + SSL beállítás
9. Átadás            — dokumentáció + hozzáférések átadva
10. Lezárás          — projekt archiválva
```

**Szerződéses határidők (automatikus szabályok az ERP-ben):**

| Határidő típus | Napok | Auto akció |
|---------------|-------|-----------|
| Anyagbekérés | 3 nap | Warning email, majd státuszváltás |
| Módosítási igény beküldése | 3 nap | Warning, majd auto-elfogadás |
| Elfogadási határidő | 3 nap | Auto-elfogadás trigger |
| Fizetési határidő | 7 nap | Fizetési felszólítás |
| Befagyasztási threshold | 60 nap | Befagyasztás + áremelési figyelmeztetés |

---

## 7. Projekt státuszok az ERP-ben

### 7.1 Projekt fázis (project_phase)

| Fázis kulcs | UI label | Szín |
|------------|---------|------|
| `anyagbekérés_kiküldve` | Anyagra vár | `#f59e0b` amber |
| `ügyfél_anyagaira_vár` | Anyagra vár | `#f59e0b` amber |
| `fejlesztés_alatt` | Fejlesztés alatt | `#3b82f6` kék |
| `belső_ellenőrzés` | Belső ellenőrzés | `#8b5cf6` lila |
| `első_átadás` | Első átadás | `#06b6d4` cián |
| `ügyfél_tesztel` | Ügyfél teszteli | `#0ea5e9` sky |
| `módosítási_kör` | Módosítási kör | `#d97706` amber sötét |
| `készre_jelentve` | Készre jelentve | `#059669` zöld |
| `záró_fizetésre_vár` | Záró fizetés várva | `#dc2626` piros |
| `élesítésre_vár` | Élesítésre vár | `#7c3aed` violet |
| `átadva` | Átadva | `#10b981` zöld |
| `karbantartás_aktív` | Karbantartás aktív | `#14b8a6` teal |
| `lezárva` | Lezárva | `#6b7280` szürke |

### 7.2 Fizetési státusz (payment_status)

| Kulcs | Label | Szín |
|-------|-------|------|
| `előleg_várva` | Előleg várva | `#f59e0b` |
| `előleg_fizetve` | Előleg fizetve | `#3b82f6` |
| `köztes_részlet_esedékes` | Köztes részlet esedékes | `#d97706` |
| `záró_fizetés_várva` | Záró fizetés várva | `#dc2626` |
| `fizetés_felfüggesztve` | Fizetés felfüggesztve | `#6b7280` |
| `teljesítve` | Teljesítve | `#059669` |

### 7.3 Jogi státusz (legal_status)

| Kulcs | Label | Szín |
|-------|-------|------|
| `rendben` | Rendben | `#059669` |
| `ügyfél_késik` | Ügyfél késik | `#f59e0b` |
| `fizetési_késedelem` | Fizetési késedelem | `#dc2626` |
| `munka_felfüggesztve` | Felfüggesztve | `#dc2626` |
| `befagyasztva` | Befagyasztva | `#6b7280` |
| `jogi_behajtási_státusz` | Jogi / behajtás | `#991b1b` |

---

## 8. Szerződéses vonatkozások

### 8.1 Mit tartalmaz a Compass szerződés (ERP szempontból kritikus részek)

**Anyagbekérési záradék:**
> Az Ügyfél vállalja, hogy az anyagbekérő levél kézhezvételétől számított **3 munkanapon belül** megküldi a szükséges anyagokat (szövegek, képek, logó, hozzáférések). Késedelem esetén az átadási határidő arányosan tolódik, a Vállalkozó jogosult pótdíjat felszámítani.

**Módosítási kör záradék:**
> Az első átadás után az Ügyfél **3 munkanapon belül** jelzi módosítási igényeit. Ha ezen határidőn belül nem érkezik visszajelzés, a rendszer automatikusan "Készre jelentve" státuszba lép. Módosítási körök száma: [N db, csomagtól függő].

**Elfogadási záradék:**
> Ha az Ügyfél a módosítási határidőn belül nem jelez vissza, a projekt automatikusan elfogadottnak minősül és a záró számla esedékessé válik.

**Fizetési ütemezés (amit az ERP payment_milestones-ban kezel):**
> - Előleg (40%): szerződéskötéskor
> - Köztes részlet (30%): [opcionális, projekt típustól függő]
> - Záró fizetés (60% vagy 30%): készre jelentés után, élesítés előtt

**Befagyasztási záradék:**
> Ha a projekt 30 napot meghaladóan szünetel ügyféloldali okok miatt, a Vállalkozó jogosult a projektet befagyasztani. 60 nap után a projekt újraindítási díj ellenében folytatható.

**Domain és tárhely:**
> Az Ügyfél felelős a domain regisztrációért és fenntartásért. A Vállalkozó segítséget nyújt a beállításokban, de a domain/tárhely az Ügyfél nevén van.

---

### 8.2 Fizetési módok (ERP-ben konfigurálható)

| Mód | ERP mezőnév | Hogyan kezeli az ERP |
|-----|-------------|---------------------|
| Banki átutalás | `payment_method: 'transfer'` | Átutalási adatok email-ben, manuális rögzítés |
| Stripe online | `payment_method: 'stripe'` | Checkout session generálva, webhook auto-jelzi |

**Stripe webhook endpoint:** `/api/stripe/webhook`
**Stripe esemény:** `checkout.session.completed` → `payment_status` frissítése

---

### 8.3 Projekt típusok és fizetési struktúra

| Projekt típus | ERP `type` értéke | Átlagos érték | Fizetési struktúra |
|--------------|------------------|--------------|-------------------|
| Landing oldal | `landing` | 350.000 Ft+ | 40% / 60% |
| Weboldal | `weboldal` | 590.000 Ft+ | 40% / 60% |
| Rendszer | `rendszer` | 1.200.000 Ft+ | 40% / 30% / 30% |
| AI Rendszer | `ai_rendszer` | Egyedi | 40% / 30% / 30% |

---

## 9. Email automatizációk (teljes lista)

### 9.1 Lead System emailek (a LS küldi)

| Esemény | Sablon neve | Mikor megy |
|---------|------------|-----------|
| Lead beérkezés | `LeadConfirmationEmail` | Azonnal (ügyfélnek) |
| Lead beérkezés admin | `NewLeadAdminEmail` | Azonnal (adminnak) |
| Nurture 1 | `NurtureEmail1` | 0. nap (Hot/Qualified kap) |
| Nurture 2 | `NurtureEmail2` | 3. nap |
| Nurture 3 | `NurtureEmail3` | 7. nap |
| Nurture 4 | `NurtureEmail4` | 14. nap |
| Nurture 5 | `NurtureEmail5` | 30. nap (final) |

### 9.2 Compass ERP emailek (az ERP küldi)

| Esemény | API endpoint | Sablon | Mikor |
|---------|-------------|--------|-------|
| Ajánlat elküldve | `/api/email/send-quote` | `QuoteMockupReadyEmail` | Admin indítja |
| Ajánlat megtekintve | (log only) | — | Ügyfél megnyitja |
| Konzultáció kérés | `/api/email/consultation` | `ConsultationRequestReceivedEmail` + `ConsultationRequestedAdminEmail` | Ügyfél kéri |
| Ajánlat jóváhagyva | `/api/admin/approve` | `AjanlatJovahagyva` | Admin jóváhagyja |
| Fizetés visszaigazolás | `/api/email/payment-success` | `PaymentSuccessEmail` | Stripe webhook |
| Anyagbekérő | `/api/email/pending-review` | `MaterialRequestEmail` | Admin indítja |
| Módosítás értesítő | `/api/email/modification` | `ModificationEmail` | Admin indítja |
| Emlékeztető | `/api/admin/send-reminder` | `ReminderEmail` | Cron / admin |

---

## 10. Cron automatizációk az ERP-ben

| Cron job | Ütemezés | Mit csinál |
|----------|---------|-----------|
| `/api/cron/check-deadlines` | Naponta 06:00 | Lejárt határidők ellenőrzése, figyelmeztetések küldése |
| Reminder candidates | Naponta | Emlékeztetőre váró projektek összegyűjtése |

**Deadline auto-akciók (`auto_action_type`):**
- `warning_email` — figyelmeztető email küldése
- `status_escalation` — státusz automatikus emelése (pl. ügyfél_késik)
- `freeze` — projekt befagyasztása
- `price_increase` — áremelési figyelmeztetés
- `legal_notice` — jogi értesítés indítása

---

## 11. Adatbázis struktúra (Supabase)

### 11.1 Kulcs táblák az ERP-ben

**`leads` tábla** (amit a Lead System feltölt):
```sql
id              UUID
name            TEXT
email           TEXT
phone           TEXT
company_name    TEXT
website_url     TEXT
has_no_website  BOOLEAN
business_description TEXT
topic           TEXT
source_form     TEXT
created_at      TIMESTAMP
```

**`quotes` tábla** (ajánlatok):
```sql
id              UUID
token           TEXT (unique, URL-ben használt)
client_name     TEXT
client_email    TEXT
title           TEXT
pricing         JSONB { name, price }
payment_method  TEXT ('stripe' | 'transfer')
admin_approved  BOOLEAN
approval_email_sent BOOLEAN
pending_review  BOOLEAN
created_at      TIMESTAMP
```

**`projects` tábla**:
```sql
id              UUID
client_name     TEXT
client_email    TEXT
quote_id        UUID (kapcsolat)
type            TEXT (weboldal|landing|rendszer|ai_rendszer)
project_phase   TEXT
payment_status  TEXT
legal_status    TEXT
operational_status TEXT
total_value     INTEGER
created_at      TIMESTAMP
```

**`project_deadlines` tábla**:
```sql
id              UUID
project_id      UUID
deadline_type   TEXT
label           TEXT
due_at          TIMESTAMP
status          TEXT (active|completed|overdue|cancelled)
auto_action_type TEXT
```

**`affiliate_referrals` tábla**:
```sql
id              UUID
referred_email  TEXT
lead_id         UUID (link a lead-hez)
status          TEXT (pending|lead_received|converted)
referral_code   TEXT
```

### 11.2 Kulcs táblák a Lead Systemben (önálló DB)

```sql
-- leads
id              UUID
name            TEXT
email           TEXT
phone           TEXT
company_name    TEXT
website_url     TEXT
has_no_website  BOOLEAN
description     TEXT
source_form     TEXT
utm_source      TEXT
utm_medium      TEXT
utm_campaign    TEXT
ref_code        TEXT
score           INTEGER (0-100)
score_breakdown JSONB (részletezett pontszám)
category        TEXT (hot|qualified|warm|cold)
status          TEXT (new|in_review|qualified|disqualified|transferred)
transferred_at  TIMESTAMP (mikor ment át az ERP-be)
created_at      TIMESTAMP

-- nurture_sequences
id              UUID
lead_id         UUID
email_number    INTEGER (1-5)
scheduled_at    TIMESTAMP
sent_at         TIMESTAMP
opened_at       TIMESTAMP

-- lead_activities
id              UUID
lead_id         UUID
event_type      TEXT (created|scored|email_sent|admin_action|transferred)
description     TEXT
created_at      TIMESTAMP

-- sources
id              UUID
source_form     TEXT
display_name    TEXT
scoring_weight  INTEGER
active          BOOLEAN
```

---

## 12. Env változók (mindkét rendszer)

### 12.1 Compass ERP-ben szükséges (meglévő)

```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase projekt URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role (admin műveletek)
RESEND_API_KEY=                   # Email küldés (Resend)
STRIPE_SECRET_KEY=                # Stripe fizetés
STRIPE_WEBHOOK_SECRET=            # Stripe webhook validáció
ERP_WEBHOOK_URL=                  # ← A LEAD SYSTEM URL-JE (vagy maga az ERP)
ERP_WEBHOOK_SECRET=               # ← Shared secret a webhook validációhoz
NEXT_PUBLIC_BASE_URL=             # https://compassmarketing.hu
```

### 12.2 Lead Systemben szükséges (új)

```bash
# Saját DB
DATABASE_URL=                     # Lead System DB

# Compass ERP webhook (hova küldjük a minősített leadeket)
COMPASS_ERP_WEBHOOK_URL=https://compassmarketing.hu/api/lead
COMPASS_ERP_WEBHOOK_SECRET=       # Ugyanaz mint az ERP ERP_WEBHOOK_SECRET-je

# Email küldés (nurture szekvenciákhoz)
RESEND_API_KEY=                   # Ugyanaz vagy külön Resend account

# AI scoring (ha külső API-t használ)
OPENAI_API_KEY=                   # Ha ChatGPT-vel scorez
# VAGY
ANTHROPIC_API_KEY=                # Ha Claude-dal scorez

# Weboldal elemző (ha URL-t elemez)
PAGESPEED_API_KEY=                # Google PageSpeed Insights API
```

---

## 13. Összefoglaló folyamatábra

```
                    LEAD SYSTEM
┌─────────────────────────────────────────────────┐
│                                                  │
│  FORRÁS              SCORING          DÖNTÉS     │
│  ┌──────┐           ┌──────┐         ┌──────┐   │
│  │Web   │           │ AI   │   Hot   │Qualify│   │
│  │form  │──────────▶│Score │──────▶  │       │   │
│  └──────┘           │0-100 │         └──┬───┘   │
│  ┌──────┐           │      │   Warm  │  │        │
│  │Affil.│──────────▶│      │──────▶  │Nurture│  │
│  └──────┘           │      │         └──────┘   │
│  ┌──────┐           │      │   Cold  │  │        │
│  │Manuál│──────────▶│      │──────▶  │Archív │  │
│  └──────┘           └──────┘         └──────┘   │
│                                          │       │
└──────────────────────────────────────────┼───────┘
                                           │
                               POST /api/lead
                           (name+email+phone required)
                                           │
                    COMPASS ERP            ▼
┌─────────────────────────────────────────────────┐
│                                                  │
│  LEAD          AJÁNLAT         PROJEKT           │
│  ┌──────┐     ┌──────┐        ┌──────┐          │
│  │Leads │────▶│Admin │───────▶│Fázis │          │
│  │tábla │     │készít│        │motor │          │
│  └──────┘     │ajánl.│        └──────┘          │
│               └──┬───┘           │               │
│                  │               │               │
│  Email auto.     │               │               │
│  ┌──────────────▶│               │               │
│  │ send-quote    │               │               │
│  │ approve       │               │               │
│  │ payment-ok    │               │               │
│  │ reminders     │               │               │
│  └───────────────────────────────┘               │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 14. Implementációs prioritás sorrend

Ha valaki ezt a dokumentumot felhasználva építi meg a Lead Systemet, ez az ajánlott sorrend:

### Fázis 1 — Alap működés (MVP)
1. Lead befogadó API endpoint
2. Lead táblázat DB schema
3. Alap admin UI (lead lista + detail panel)
4. Manuális Qualify gomb → ERP webhook küldés
5. Email értesítő adminnak + ügyfélnek

### Fázis 2 — Scoring
6. AI Scoring logika (kezdetben szabály-alapú, nem AI)
7. Score megjelenítés az UI-ban
8. Kategória szűrők (Hot/Qualified/Warm/Cold)
9. Scoring szabályok config UI

### Fázis 3 — Automatizáció
10. Nurture email szekvencia engine
11. Cron job: határidő figyelés, nurture időzítés
12. ERP visszajelzés fogadása (ha megvalósul)

### Fázis 4 — Analytics
13. Konverziós funnel analytics
14. Forrás teljesítmény riportok
15. Affiliate tracking dashboard

---

## 15. Gyors referencia — Kulcs URL-ek és endpoint-ok

| Funkció | URL / endpoint |
|---------|---------------|
| ERP lead befogadó | `POST https://compassmarketing.hu/api/lead` |
| ERP ajánlat email küldés | `POST /api/email/send-quote` |
| ERP admin jóváhagyás | `POST /api/admin/approve` |
| ERP Stripe webhook | `POST /api/stripe/webhook` |
| ERP cron deadlines | `GET /api/cron/check-deadlines` |
| Ügyfél ajánlat oldal | `GET /ajanlat/{token}` |
| ERP admin | `GET /admin` |
| ERP projektek | `GET /admin/projektek` |
