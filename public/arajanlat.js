/* =========================================================
   Compass Systems — Árajánlat-készítő
   Static, dependency-free quote builder.
   - Password gate (SHA-256, client-side)
   - Live editable quote (Presence / Growth / Operations)
   - Export: Print/PDF · Share link · Standalone HTML · Copy text
   ========================================================= */
(function () {
  'use strict';

  /* SHA-256 hash of the access password (never stored in plain text). */
  var PASS_HASH = '12fa7e06e43d1ce0c599eeee0de66e94d801879666173c6ccf5b72203bcaa85a';
  var STORE_KEY = 'compass_quote_draft_v1';
  var AUTH_KEY = 'compass_quote_auth_v1';

  /* Fixed contractor (Megbízott) details — Compass legal entity. */
  var COMPASS = {
    name: 'Compass Marketing Korlátolt Felelősségű Társaság',
    short: 'Compass Marketing Kft.',
    seat: '1141 Budapest, Kalocsai utca 7.',
    reg: '01-09-381625',
    tax: '29164107-1-42',
    rep: 'Bánki Richárd Márk ügyvezető',
    contact: 'Bánki Richárd',
    email: 'info@compassmarketing.hu',
    phone: '+36 30 973 7040',
    bank: 'Raiffeisen Bank Zrt.',
    account: '12011409-01759730-00100005'
  };

  /* ---------- Utilities ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString('hu-HU') + ' Ft';
  }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  async function sha256(str) {
    if (window.crypto && crypto.subtle && location.protocol !== 'file:') {
      try {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      } catch (e) { /* fall back below */ }
    }
    return sha256sync(str);
  }

  /* Pure-JS SHA-256 fallback (file:// / insecure contexts). */
  function sha256sync(ascii) {
    function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var maxWord = Math.pow(2, 32), i, j, result = '';
    var words = [], asciiBitLength = ascii.length * 8;
    var hash = sha256sync.h = sha256sync.h || [];
    var k = sha256sync.k = sha256sync.k || [];
    var primeCounter = k.length, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii = unescape(encodeURIComponent(ascii));
    asciiBitLength = ascii.length * 8;
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rr(6, e) ^ rr(11, e) ^ rr(25, e)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(7, w15) ^ rr(18, w15) ^ (w15 >>> 3)) + w[i - 7] + (rr(17, w2) ^ rr(19, w2) ^ (w2 >>> 10))) | 0);
        var temp2 = (rr(2, a) ^ rr(13, a) ^ rr(22, a)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function encodeState(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeState(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }

  /* ---------- Pillar seed data ---------- */
  var PILLARS = {
    presence: {
      n: '01', label: 'Presence', sub: 'A digitális alapod.',
      tiers: [
        { id: 'p-landing', name: 'Landing', price: 350000, period: 'once',
          desc: 'Egy kampányra vagy szolgáltatásra épített, magas konverziójú egyoldalas weboldal.',
          features: ['Modern prémium design', 'Mobiloptimalizálás', 'Kapcsolati űrlap', 'Alap SEO', 'Analytics', 'Email értesítések'] },
        { id: 'p-business', name: 'Business', price: 590000, period: 'once', popular: true,
          desc: 'Komolyabb céges weboldal hosszú távú online jelenléthez.',
          features: ['Több aloldal', 'Egyedi prémium design', 'SEO struktúra', 'Blog lehetőség', 'Admin kezelhetőség', 'Analytics', 'Bővíthető rendszer'] },
        { id: 'p-advanced', name: 'Egyedi / E-commerce', price: 1200000, period: 'once',
          desc: 'Komplex weboldal vagy webáruház — konzultáció utáni egyedi árazással.',
          features: ['Webáruház / egyedi funkciók', 'Fizetési integráció', 'Termékkezelés', 'Mély SEO', 'Dashboard / CRM', 'API integrációk'] }
      ],
      selected: 'p-business',
      goals: ['Modern, reszponzív weboldal, amely bizalmat épít', 'Jobb megjelenés a Google keresőben', 'Online kapcsolatfelvétel és érdeklődés-generálás', 'Konverzió-fókuszú, mérhető jelenlét'],
      reasons: [
        { t: 'Prémium megjelenés', d: 'Egyedi, modern design, amely bizalmat épít és kitűnik a versenytársak közül.' },
        { t: 'Mobiloptimalizálás', d: 'Minden eszközön gyors, reszponzív, tökéletesen működő weboldal.' },
        { t: 'Konverziós fókusz', d: 'Nem csak szép — ügyfeleket hoz. Átgondolt UX és call-to-action struktúra.' }
      ],
      addons: [
        { id: uid(), label: 'Extra aloldal', price: 75000, on: false },
        { id: uid(), label: 'Extra szolgáltatás oldal', price: 90000, on: false },
        { id: uid(), label: 'Blog rendszer', price: 90000, on: false },
        { id: uid(), label: '3 SEO blogcikk', price: 150000, on: false },
        { id: uid(), label: 'Haladó ajánlatkérő rendszer', price: 90000, on: false },
        { id: uid(), label: 'Email automatizáció', price: 120000, on: false },
        { id: uid(), label: 'Automatikus lead mentés', price: 130000, on: false },
        { id: uid(), label: 'Admin lead kezelő felület', price: 160000, on: false },
        { id: uid(), label: 'Többnyelvűség', price: 180000, on: false },
        { id: uid(), label: 'Brand irány / guideline', price: 80000, on: false }
      ],
      monthly: [
        { id: uid(), label: 'Háttérrendszer és üzemeltetés (hosting)', price: 39000, on: true, must: true },
        { id: uid(), label: 'Karbantartás és frissítések', price: 25000, on: false },
        { id: uid(), label: 'SEO alapcsomag', price: 79000, on: false },
        { id: uid(), label: 'Tartalom / blog kezelés', price: 59000, on: false },
        { id: uid(), label: 'Marketing / hirdetés kezelés', price: 149000, on: false }
      ],
      schedule: '40-60'
    },
    growth: {
      n: '02', label: 'Growth', sub: 'A marketingmotorod.',
      tiers: [
        { id: 'g-starter', name: 'Growth Starter', price: 149000, period: 'month',
          desc: 'Belépő növekedési csomag — az alaprendszerek beállítása és működtetése.',
          features: ['Tartalom automatizáció (alap)', 'CRM beállítás', 'Email nurture alap', '1 csatorna kezelése', 'Havi riport'] },
        { id: 'g-pro', name: 'Growth Pro', price: 290000, period: 'month', popular: true,
          desc: 'Aktív növekedési motor több csatornán, AI-támogatással.',
          features: ['Tartalom automatizáció (teljes)', 'Lead generálás', 'Paid media (Meta / Google)', 'Email & SMS nurture', 'AI chatbot', 'Havi stratégiai egyeztetés'] },
        { id: 'g-scale', name: 'Growth Scale', price: 490000, period: 'month',
          desc: 'Teljes körű, skálázódó marketingrendszer dedikált fókusszal.',
          features: ['Minden a Pro csomagból', 'Több csatornás kampányok', 'Haladó automatizációk', 'Heti optimalizálás', 'Dedikált kapcsolattartó', 'Egyedi riport dashboard'] }
      ],
      selected: 'g-pro',
      goals: ['Stabil, kiszámítható lead-áramlás', 'Kevesebb manuális marketingmunka', 'Mérhető megtérülés (ROI) a hirdetéseken', 'Automatizált követés minden érdeklődőnél'],
      reasons: [
        { t: 'Mérhető eredmény', d: 'Minden hónapban átlátható riport: leadek, költés, megtérülés.' },
        { t: 'AI-gyorsított', d: 'Az AI a rutinmunkát viszi, a stratégiát emberek tartják kézben.' },
        { t: 'Nincs hosszú szerződés', d: 'Havi alapon dolgozunk. Az eredmény tart meg, nem a szerződés.' }
      ],
      addons: [
        { id: uid(), label: 'Kampány setup (egyszeri)', price: 150000, on: true },
        { id: uid(), label: 'Landing oldal', price: 250000, on: false },
        { id: uid(), label: 'CRM migráció', price: 180000, on: false },
        { id: uid(), label: 'Hirdetési fiók audit', price: 90000, on: false },
        { id: uid(), label: 'Tartalom stratégia', price: 120000, on: false }
      ],
      monthly: [
        { id: uid(), label: 'Extra hirdetési csatorna', price: 79000, on: false },
        { id: uid(), label: 'Heti tartalomgyártás (bővített)', price: 99000, on: false },
        { id: uid(), label: 'AI chatbot felügyelet', price: 49000, on: false }
      ],
      schedule: 'retainer'
    },
    operations: {
      n: '03', label: 'Operations', sub: 'Az AI back-office-od.',
      tiers: [
        { id: 'o-pilot', name: 'Pilot automatizáció', price: 450000, period: 'once',
          desc: 'Egy jól körülhatárolt folyamat automatizálása — gyors, mérhető eredmény.',
          features: ['1 folyamat felmérése', 'Egyedi automatizáció építése', 'Integráció a meglévő eszközökkel', 'Betanítás', '30 nap support'] },
        { id: 'o-system', name: 'Egyedi rendszer', price: 1200000, period: 'once', popular: true,
          desc: 'Több lépéses, testreszabott AI-rendszer a back-office tehermentesítésére.',
          features: ['Folyamatok feltérképezése', 'Több munkafolyamat automatizálása', 'ERP / CRM integráció', 'Egyedi dashboard', 'AI asszisztens(ek)', 'Dokumentáció + betanítás'] },
        { id: 'o-employee', name: 'AI munkatárs', price: 900000, period: 'once',
          desc: 'A vállalkozás kontextusára tanított AI-asszisztens, amely sosem alszik.',
          features: ['Üzleti kontextusra tanítva', 'Email ↔ CRM ↔ számlázás integráció', 'Speed-to-lead (90 mp válasz)', 'WhatsApp / chat csatorna', 'Folyamatos finomhangolás'] }
      ],
      selected: 'o-system',
      goals: ['Heti több óra rutinmunka megspórolása', 'Gyorsabb válaszidő az érdeklődőknek', 'Kevesebb emberi hiba a folyamatokban', 'Skálázódás új munkatárs felvétele nélkül'],
      reasons: [
        { t: 'Mérhető óramegtakarítás', d: 'Minden modulhoz konkrét szám: hány órát ad vissza hetente.' },
        { t: 'Olcsóbb, mint egy felvétel', d: 'A Szocho-val terhelt bérköltség töredékéért — 0–24-ben.' },
        { t: 'A csapatod a fontosra fókuszál', d: 'A rutint a rendszer viszi, az embereké marad az érték.' }
      ],
      addons: [
        { id: uid(), label: 'Számlázz.hu integráció', price: 120000, on: false },
        { id: uid(), label: 'Billingo integráció', price: 120000, on: false },
        { id: uid(), label: 'Egyedi API integráció', price: 180000, on: false },
        { id: uid(), label: 'Speed-to-lead modul', price: 160000, on: false },
        { id: uid(), label: 'Dokumentum-feldolgozás (OCR)', price: 220000, on: false }
      ],
      monthly: [
        { id: uid(), label: 'Rendszer üzemeltetés és support', price: 49000, on: true, must: true },
        { id: uid(), label: 'Folyamatos optimalizálás', price: 79000, on: false },
        { id: uid(), label: 'AI modellköltség kezelés', price: 39000, on: false },
        { id: uid(), label: 'Bővített SLA support', price: 99000, on: false }
      ],
      schedule: '40-60'
    }
  };

  var PROCESS_DEFAULT = [
    { t: 'Egyeztetés & anyagok', d: 'Célok véglegesítése, tartalmak és képek megküldése. Minimum 2 munkanap átfutás.' },
    { t: 'Fejlesztés & visszajelzés', d: 'Elkészítés a bemutatott koncepció alapján. 1 módosítási kör belefoglalva.' },
    { t: 'Élesítés & üzemeltetés', d: 'Technikai beállítások, élesítés, majd folyamatos üzemeltetés és támogatás.' }
  ];

  var SCHEDULES = {
    '40-60': { label: '40% / 60%', desc: 'előleg + átadáskor', parts: [['40% előleg — most', 0.40], ['60% maradék — átadáskor', 0.60]] },
    '40-30-30': { label: '40 / 30 / 30', desc: 'három részletben', parts: [['40% előleg — most', 0.40], ['30% — 30 napon belül', 0.30], ['30% — átadáskor', 0.30]] },
    '50-50': { label: '50% / 50%', desc: 'fele-fele', parts: [['50% előleg — most', 0.50], ['50% — átadáskor', 0.50]] },
    '100': { label: '100%', desc: 'teljes összeg előre', parts: [['100% — a szerződéskötéskor', 1.00]] },
    'retainer': { label: 'Havi díjas', desc: 'nincs egyszeri projektdíj', parts: [] }
  };

  /* ---------- State ---------- */
  var state, openSections, view = false;

  function freshState() {
    var seed = deepCopy(PILLARS.presence);
    return {
      meta: {
        quoteNo: 'CMP-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900) + 100),
        clientName: '',
        date: today(),
        validUntil: plusDays(30),
        intro: 'Személyre szabott ajánlat — teljes körű digitális jelenléttel.',
        preparedBy: COMPASS.contact
      },
      pillar: 'presence',
      tiers: seed.tiers,
      tierId: seed.selected,
      goals: seed.goals.slice(),
      reasons: seed.reasons,
      addons: seed.addons,
      monthly: seed.monthly,
      process: deepCopy(PROCESS_DEFAULT),
      schedule: seed.schedule,
      vatNote: '+ ÁFA',
      client: { type: 'company', name: '', tax: '', address: '', contact: '', email: '', phone: '', place: 'Budapest' },
      includeContract: true,
      notes: ''
    };
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '.';
  }
  function plusDays(n) {
    var d = new Date(); d.setDate(d.getDate() + n);
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + '.';
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function setPillar(p) {
    var seed = deepCopy(PILLARS[p]);
    state.pillar = p;
    state.tiers = seed.tiers;
    state.tierId = seed.selected;
    state.goals = seed.goals.slice();
    state.reasons = seed.reasons;
    state.addons = seed.addons;
    state.monthly = seed.monthly;
    state.schedule = seed.schedule;
  }

  function selectedTier() {
    for (var i = 0; i < state.tiers.length; i++) if (state.tiers[i].id === state.tierId) return state.tiers[i];
    return state.tiers[0];
  }

  function totals() {
    var t = selectedTier();
    var oneBase = t && t.period === 'once' ? Number(t.price) || 0 : 0;
    var monBase = t && t.period === 'month' ? Number(t.price) || 0 : 0;
    var addonSum = 0, i;
    for (i = 0; i < state.addons.length; i++) if (state.addons[i].on) addonSum += Number(state.addons[i].price) || 0;
    var monSum = 0;
    for (i = 0; i < state.monthly.length; i++) if (state.monthly[i].on) monSum += Number(state.monthly[i].price) || 0;
    return {
      project: oneBase + addonSum,
      oneBase: oneBase,
      addonSum: addonSum,
      monthly: monBase + monSum,
      monBase: monBase,
      monSum: monSum
    };
  }

  function save() {
    if (view) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* =========================================================
     QUOTE DOCUMENT STYLES (single source — injected live and
     embedded into downloaded standalone files).
     ========================================================= */
  var DOC_CSS = [
    ".quote-doc{",
    "  --paper:#F7F4EF;--ink:#16140F;--muted:#6B6760;--faint:#9A968E;",
    "  --line:#E4DED4;--line2:#D8D1C4;--gold:#9A7B3A;--soft:#EFEAE1;",
    "  font-family:'Host Grotesk',system-ui,sans-serif;color:var(--ink);background:var(--paper);",
    "  max-width:820px;margin:0 auto;border-radius:14px;overflow:hidden;",
    "  box-shadow:0 40px 120px rgba(0,0,0,.45);line-height:1.55;",
    "}",
    ".quote-doc *{box-sizing:border-box;}",
    ".qd-pad{padding:clamp(26px,5vw,56px);}",
    ".qd-mono{font-family:'Space Mono',monospace;}",
    ".qd-ey{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);}",
    ".qd-muted{color:var(--muted);}",
    /* header */
    ".qd-head{background:#16140F;color:#F2EEE6;padding:clamp(26px,5vw,52px);}",
    ".qd-head__top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;}",
    ".qd-brand{font-size:20px;font-weight:500;letter-spacing:.04em;}",
    ".qd-brand small{display:block;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.18em;color:#A7A199;margin-top:4px;text-transform:uppercase;}",
    ".qd-head__meta{font-family:'Space Mono',monospace;font-size:11px;color:#BDB7AE;text-align:right;line-height:1.8;}",
    ".qd-head__meta b{color:#F2EEE6;font-weight:400;}",
    ".qd-title{font-size:clamp(30px,5vw,46px);font-weight:300;letter-spacing:-1px;line-height:1.05;margin:26px 0 8px;}",
    ".qd-title span{color:#C9A45A;}",
    ".qd-intro{color:#C7C1B8;font-size:15px;max-width:54ch;margin:0;}",
    /* snapshot */
    ".qd-snap{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border-top:1px solid var(--line);border-bottom:1px solid var(--line);}",
    ".qd-snap__cell{background:var(--paper);padding:18px clamp(16px,3vw,26px);}",
    ".qd-snap__k{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);}",
    ".qd-snap__v{font-size:19px;margin-top:6px;font-weight:400;}",
    /* sections */
    ".qd-sec{padding:clamp(26px,4vw,44px) clamp(26px,5vw,56px);border-bottom:1px solid var(--line);}",
    ".qd-sec__h{font-size:13px;font-family:'Space Mono',monospace;letter-spacing:.04em;color:var(--muted);margin:0 0 18px;display:flex;align-items:baseline;gap:10px;}",
    ".qd-sec__h b{color:var(--gold);}",
    ".qd-h2{font-size:22px;font-weight:400;letter-spacing:-.3px;margin:0 0 16px;}",
    /* goals */
    ".qd-goals{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;}",
    ".qd-goals li{position:relative;padding-left:26px;font-size:15px;}",
    ".qd-goals li::before{content:'✓';position:absolute;left:0;top:0;color:var(--gold);font-size:14px;}",
    /* tiers */
    ".qd-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}",
    ".qd-tier{border:1px solid var(--line2);border-radius:11px;padding:18px;background:#FBF9F5;position:relative;display:flex;flex-direction:column;}",
    ".qd-tier--sel{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold);background:#fff;}",
    ".qd-tier__tag{position:absolute;top:-9px;left:14px;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;background:var(--gold);color:#fff;padding:3px 8px;border-radius:5px;}",
    ".qd-tier__tag--pop{background:#16140F;}",
    ".qd-tier__name{font-size:16px;font-weight:500;margin:2px 0 4px;}",
    ".qd-tier__price{font-family:'Space Mono',monospace;font-size:18px;font-weight:700;}",
    ".qd-tier__per{font-family:'Space Mono',monospace;font-size:10px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;}",
    ".qd-tier__desc{font-size:12.5px;color:var(--muted);margin:8px 0 12px;line-height:1.5;}",
    ".qd-tier__f{list-style:none;margin:0;padding:0;font-size:12.5px;display:flex;flex-direction:column;gap:6px;}",
    ".qd-tier__f li{position:relative;padding-left:18px;}",
    ".qd-tier__f li::before{content:'✓';position:absolute;left:0;color:var(--gold);font-size:11px;}",
    /* line items */
    ".qd-li{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--line);font-size:14.5px;}",
    ".qd-li:last-child{border-bottom:0;}",
    ".qd-li__p{font-family:'Space Mono',monospace;white-space:nowrap;}",
    /* reasons */
    ".qd-reasons{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}",
    ".qd-reason{border:1px solid var(--line);border-radius:10px;padding:16px;background:#FBF9F5;}",
    ".qd-reason__t{font-size:14.5px;font-weight:500;margin:0 0 6px;}",
    ".qd-reason__d{font-size:12.5px;color:var(--muted);margin:0;line-height:1.5;}",
    /* summary */
    ".qd-sum{background:var(--soft);border:1px solid var(--line2);border-radius:12px;padding:22px clamp(18px,3vw,28px);}",
    ".qd-sum__row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;font-size:14.5px;}",
    ".qd-sum__row--total{border-top:1px solid var(--line2);margin-top:6px;padding-top:14px;font-size:18px;font-weight:500;}",
    ".qd-sum__row--total .qd-li__p{font-size:20px;font-weight:700;}",
    ".qd-sum__row .qd-li__p{font-family:'Space Mono',monospace;}",
    ".qd-split{margin-top:16px;border-top:1px dashed var(--line2);padding-top:14px;display:flex;flex-direction:column;gap:7px;}",
    ".qd-split__row{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);}",
    ".qd-split__row b{color:var(--ink);font-weight:500;}",
    /* process */
    ".qd-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;counter-reset:s;}",
    ".qd-step__n{font-family:'Space Mono',monospace;color:var(--gold);font-size:13px;}",
    ".qd-step__t{font-size:15px;font-weight:500;margin:6px 0 5px;}",
    ".qd-step__d{font-size:12.5px;color:var(--muted);margin:0;line-height:1.5;}",
    /* client data */
    ".qd-data{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;}",
    ".qd-data__k{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);}",
    ".qd-data__v{font-size:14.5px;margin-top:3px;border-bottom:1px solid var(--line);padding-bottom:8px;min-height:20px;}",
    /* contract */
    ".qd-contract{background:#FBF9F5;}",
    ".qd-contract h3{font-size:15px;font-weight:600;margin:22px 0 8px;letter-spacing:-.2px;}",
    ".qd-contract h3:first-child{margin-top:0;}",
    ".qd-contract p{font-size:12.5px;color:#2E2A22;margin:0 0 9px;line-height:1.6;}",
    ".qd-parties{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:20px;}",
    ".qd-party{border:1px solid var(--line);border-radius:9px;padding:14px;background:#fff;}",
    ".qd-party h4{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin:0 0 8px;}",
    ".qd-party div{font-size:12px;color:#2E2A22;line-height:1.7;}",
    ".qd-sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px;}",
    ".qd-sign__line{border-top:1px solid var(--ink);padding-top:8px;font-size:12px;text-align:center;color:var(--muted);}",
    /* foot */
    ".qd-foot{background:#16140F;color:#A7A199;padding:24px clamp(26px,5vw,56px);font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.04em;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;}",
    ".qd-foot b{color:#F2EEE6;font-weight:400;}",
    ".qd-note{font-size:12px;color:var(--muted);margin:14px 0 0;line-height:1.6;}",
    /* responsive */
    "@media(max-width:640px){",
    "  .qd-snap,.qd-tiers,.qd-reasons,.qd-steps,.qd-goals,.qd-data,.qd-parties,.qd-sign{grid-template-columns:1fr;}",
    "  .qd-head__meta{text-align:left;}",
    "}",
    /* print */
    "@media print{",
    "  .quote-doc{box-shadow:none;border-radius:0;max-width:none;}",
    "  .qd-sec,.qd-tier,.qd-reason,.qd-step,.qd-sum,.qd-party{break-inside:avoid;}",
    "  .qd-contract{break-before:page;}",
    "  .qd-foot{break-inside:avoid;}",
    "}"
  ].join('\n');

  /* =========================================================
     Contract (Megbízási Szerződés) — full legal text.
     ========================================================= */
  var CONTRACT = [
    { n: '1', t: 'A Szerződés Tárgya', p: [
      '1.1. A Megbízó megbízza a Megbízottat weboldal, digitális rendszer, online felület, marketingkommunikációs vagy kapcsolódó fejlesztési szolgáltatás elkészítésével a jelen szerződés mellékletét képező ajánlatban, specifikációban vagy elektronikus kommunikációban meghatározott tartalom szerint.',
      '1.2. A Megbízott kizárólag azon szolgáltatások teljesítésére köteles, amelyek a jóváhagyott ajánlatban vagy specifikációban tételesen szerepelnek.',
      '1.3. Minden olyan feladat, funkció, integráció, módosítás, fejlesztés, tartalom, grafikai elem vagy technikai megoldás, amely a jóváhagyott ajánlatban nem szerepel, külön megrendelésnek és külön díjazás alá eső többletmunkának minősül.',
      '1.4. A Megbízott jogosult a teljesítés során mesterséges intelligencia alapú rendszereket, automatizációs megoldásokat, külső fejlesztői szolgáltatásokat vagy alvállalkozókat igénybe venni.',
      '1.5. A Megbízott köteles a Megbízót minden olyan körülményről haladéktalanul értesíteni, amely a megbízás eredményességét gátolja vagy veszélyezteti. A saját székhelyén folytatott tevékenység rendjét és ütemét a Megbízott alakítja ki; ebben a Megbízó nem utasíthatja, érdekeiket azonban a Megbízott az ütemezésnél köteles figyelembe venni.',
      '1.6. A Megbízott a megbízás ellátása során köteles a hatályos jogszabályok rendelkezéseit maradéktalanul betartani.',
      '1.7. A Megbízott által a szerződéskötést megelőzően vagy azzal egyidejűleg átadott látványterv kizárólag tájékoztató jellegű, és a hangulat, színvilág, elrendezési koncepció szemléltetésére szolgál. A látványterv nem minősül kötelező érvényű tervdokumentációnak, és nem képezi a teljesítés mérőszabályát. A végleges weboldal a látványtervtől arányos mértékben eltérhet, különösen technikai, tartalom- vagy eszközfüggő okokból. A Megbízó a látványterv és a végeredmény közötti különbségre a teljesítés elfogadásának megtagadása vagy módosítási igény alapjaként nem hivatkozhat.',
      '1.8. A jelen szerződés, a mellékelt ajánlat és az esetlegesen átadott látványterv együttesen alkotják a Felek megállapodásának teljes tartalmát, és egységes dokumentumként kezelendők. Ellentmondás esetén a szerződés szövege az irányadó.'
    ] },
    { n: '2', t: 'A Szerződés Létrejötte és a Munka Megkezdése', p: [
      '2.1. A projekt kizárólag az alábbi feltételek együttes teljesülését követően indul: a jelen szerződés aláírása, az ajánlat elfogadása, az előlegszámla teljes kiegyenlítése.',
      '2.2. A Megbízott az előleg beérkezéséig nem köteles a munkát megkezdeni.'
    ] },
    { n: '3', t: 'Megbízási Díj és Fizetési Feltételek', p: [
      '3.1. A Megbízó a Megbízott részére a mellékelt ajánlatban meghatározott megbízási díjat köteles megfizetni az alábbi, a szerződéskötéskor választott fizetési ütemezés szerint. A fizetési ütemezés a szerződés elfogadásakor véglegesen rögzítésre kerül és utólag nem módosítható.',
      '3.1.A) opció – Azonnali kártyás fizetés (Stripe): A teljes megbízási díj 40%-a (előleg) a szerződés online elfogadásakor kártyás fizetéssel azonnal esedékes és fizetendő. A fennmaradó 60% az átadást megelőzően, a záró számla alapján esedékes.',
      '3.1.B) opció – Átutalás, két részletben: A teljes megbízási díj 40%-a (előleg) a szerződés elfogadásától számított 5 (öt) munkanapon belül átutalással esedékes. A fennmaradó 60% az átadást megelőzően, a záró számla kézhezvételétől számított 3 (három) munkanapon belül esedékes.',
      '3.1.C) opció – Átutalás, három részletben: A teljes megbízási díj 40%-a (előleg) a szerződés elfogadásától számított 5 (öt) munkanapon belül átutalással esedékes. További 30% az előleg megfizetésétől számított 30 (harminc) naptári napon belül esedékes. A fennmaradó 30% az átadást megelőzően, a záró számla kézhezvételétől számított 3 (három) munkanapon belül esedékes.',
      '3.1.D) Közös szabály minden opcióra: A munkakezdés feltétele az előleg maradéktalan beérkezése. A weboldal élesítése, a hozzáférések átadása és a végleges üzembe helyezés kizárólag az utolsó részlet maradéktalan megfizetését követően történik.',
      '3.2. A számlák fizetési határideje 3 (három) munkanap a számla kézhezvételétől számítva.',
      '3.2.1. Az átutalás adatai — Kedvezményezett: ' + COMPASS.name + '; Bankszámlaszám: ' + COMPASS.account + '; Bank: ' + COMPASS.bank + '. A közlemény rovatba a Megbízott által kiállított számla sorszámát kötelező feltüntetni.',
      '3.3. Fizetési késedelem esetén a Megbízó napi 20.000 Ft, azaz húszezer forint összegű késedelmi kötbér megfizetésére köteles minden megkezdett késedelmes nap után.',
      '3.4. A késedelmi kötbér megfizetése nem mentesíti a Megbízót a számla kiegyenlítésének kötelezettsége alól.',
      '3.5. A Megbízott jogosult a munkavégzést, publikálást, domain átirányítást, hozzáférések átadását vagy bármely kapcsolódó szolgáltatást a teljes díj kiegyenlítéséig felfüggeszteni.',
      '3.6. Amennyiben a Megbízott készre jelentése ellenére a Megbízó a teljesítési igazolást aláírva 3 (három) naptári napon belül nem küldi vissza, a teljesítési igazolás automatikusan elfogadottnak tekintendő, és a Megbízottat számlakiállításra jogosítja.',
      '3.7. Fizetési késedelem súlyos szerződésszegésnek minősül.',
      '3.8. Amennyiben a Megbízó a projekt folyamán fizetési kötelezettségének felszólítás ellenére 5 (öt) naptári napon belül nem tesz eleget, vagy az együttműködéshez szükséges kommunikációban 3 (három) egymást követő munkanapon át nem reagál a Megbízott írásbeli megkeresésére, a Megbízott jogosult a szerződéstől elállni. Elállás esetén a már megfizetett előleg a Megbízottat illeti meg és nem jár vissza.'
    ] },
    { n: '4', t: 'A Megbízó Együttműködési és Adatszolgáltatási Kötelezettsége', p: [
      '4.1. A Megbízó köteles a Megbízott által kért valamennyi tartalmat, hozzáférést, képet, videót, szöveget, logót, dokumentumot, jóváhagyást és egyéb szükséges anyagot a Megbízott írásbeli kérésétől számított 3 (három) naptári napon belül a Megbízott rendelkezésére bocsátani.',
      '4.2. A Megbízó tudomásul veszi, hogy a projekt teljesítési határideje kizárólag abban az esetben tartható, amennyiben a szükséges tartalmakat és hozzáféréseket határidőben biztosítja.',
      '4.3. Amennyiben a Megbízó az adat- vagy tartalomszolgáltatási kötelezettségének nem tesz eleget: a Megbízott teljesítési határideje automatikusan meghosszabbodik a késedelem időtartamával; a késedelem nem minősül a Megbízott szerződésszegésének; a Megbízott nem felel az átadás vagy projekt csúszásáért.',
      '4.4. A Megbízó a 3 (három) naptári napot meghaladó késedelem esetén napi 5.000 Ft, azaz ötezer forint összegű kötbér megfizetésére köteles minden megkezdett késedelmes nap után.',
      '4.5. A Megbízott jogosult a projekt munkálatait a szükséges anyagok vagy hozzáférések beérkezéséig felfüggeszteni.',
      '4.6. A Megbízott nem köteles a projektet prioritással újraütemezni abban az esetben, ha a Megbízó késedelme miatt a projektfolyamat megszakad vagy eltolódik.'
    ] },
    { n: '5', t: 'Módosítási Körök', p: [
      '5.1. A Megbízó a weboldal első átadását követően összesen 1 (egy) díjmentes módosítási kör igénybevételére jogosult.',
      '5.2. Módosítási körnek minősül különösen: a weboldal struktúrájának módosítása, design vagy layout módosítása, oldalfelépítés megváltoztatása, új szekciók vagy funkciók igénylése, meglévő elemek áttervezése, arculati koncepció módosítása.',
      '5.3. Nem minősül módosítási körnek: elgépelések javítása, kisebb szöveges pontosítások, nyelvtani javítások, olyan apró igazítások, amelyek a weboldal szerkezetét vagy design koncepcióját érdemben nem érintik.',
      '5.4. A Megbízó köteles a módosítási igényeket az első átadást követő 3 (három) naptári napon belül összesített írásos formában megküldeni. A Megbízott nem köteles részletekben vagy folyamatosan érkező módosítási igényeket kezelni.',
      '5.5. Amennyiben a Megbízó a módosítási igényeit határidőn belül nem küldi meg, a weboldal automatikusan elfogadottnak és véglegesen átadottnak minősül.',
      '5.6. Az 1 (egy) díjmentes módosítási körön túl minden további módosítás külön díjazás ellenében történik.'
    ] },
    { n: '6', t: 'Teljesítés és Átadás', p: [
      '6.1. A weboldal teljesítettnek és átadottnak minősül, amennyiben működőképes állapotban rendelkezésre áll, az ajánlatban szereplő funkciók és vállalások megvalósultak, és rendeltetésszerű használatra alkalmas.',
      '6.2. A Megbízó nem tagadhatja meg a teljesítés elfogadását olyan indokra hivatkozva, amely szubjektív ízlésbeli megítélésen alapul, az ajánlatban nem szereplő új igényre vonatkozik, vagy utólag felmerült többletigényt jelent.',
      '6.3. A Megbízott készre jelentését követően a Megbízó köteles 3 (három) naptári napon belül írásban nyilatkozni az átvételről vagy a konkrét hibákról. Amennyiben e határidőn belül nem küld írásos hibajelzést, a teljesítés automatikusan elfogadottnak minősül.',
      '6.4. A weboldal élesítése, domainre történő publikálása, hozzáférések átadása és végleges üzembe helyezése kizárólag a teljes megbízási díj maradéktalan megfizetését követően történik.',
      '6.5. Amennyiben a Megbízó a domain nevet nem biztosítja vagy annak használatát nem teszi lehetővé, a weboldal teszt- vagy ideiglenes környezetben történő átadása is szabályszerű teljesítésnek minősül. A domain hiányából eredő problémákért a Megbízott felelősséget nem vállal.'
    ] },
    { n: '7', t: 'Harmadik Fél Szolgáltatások', p: [
      '7.1. A Megbízott nem vállal felelősséget harmadik fél által biztosított rendszerek, szolgáltatások vagy szoftverek működéséért, hibájáért, korlátozásáért vagy elérhetőségéért, ideértve különösen: tárhelyszolgáltatók, domain szolgáltatók, Vercel, Supabase, OpenAI, Anthropic Claude, Resend, Google és Meta szolgáltatások, fizetési rendszerek, CMS és analitikai rendszerek, külső API-k és harmadik fél integrációk.',
      '7.2. A Megbízott nem felel az ezen rendszerek hibájából, API-változásából, szolgáltatás-módosításából vagy megszűnéséből eredő károkért.'
    ] },
    { n: '8', t: 'Üzemeltetés és Karbantartás', p: [
      '8.1. A weboldal átadását követően a Megbízott kizárólag külön üzemeltetési vagy karbantartási megállapodás alapján köteles támogatást, frissítést, hibajavítást vagy technikai segítségnyújtást biztosítani. Külön üzemeltetési szerződés hiányában a Megbízott az átadást követően nem köteles rendelkezésre állni.'
    ] },
    { n: '9', t: 'Szerzői Jog és Forráskód', p: [
      '9.1. A weboldalhoz kapcsolódó forráskód, design, fejlesztési struktúra, technikai megoldás, komponens és know-how a teljes díj kiegyenlítéséig a Megbízott tulajdonát képezi. A Megbízó kizárólag a teljes megbízási díj megfizetését követően jogosult a weboldal használatára.',
      '9.2. A Megbízott jogosult saját fejlesztési elemeit, komponenseit, sablonjait, technikai megoldásait és know-how-ját más projektekben is felhasználni.'
    ] },
    { n: '10', t: 'Felelősségkorlátozás', p: [
      '10.1. A Megbízott felelőssége kizárólag a Megbízó által ténylegesen megfizetett megbízási díj összegéig terjed.',
      '10.2. A Megbízott semmilyen esetben nem felel elmaradt haszonért, üzleti veszteségért, adatvesztésért, közvetett károkért, marketingeredményekért, keresőoptimalizálási eredményekért, bevételkiesésért, harmadik fél rendszereinek hibájáért, illetve AI rendszerek működéséből eredő problémákért.'
    ] },
    { n: '11', t: 'Tartalmi Felelősség', p: [
      '11.1. A Megbízó kizárólagosan felel az általa átadott képek, videók, szövegek, logók, dokumentumok és egyéb tartalmak jogtisztaságáért. A Megbízott nem köteles vizsgálni az átadott tartalmak szerzői jogi vagy adatvédelmi megfelelőségét.'
    ] },
    { n: '12', t: 'Titoktartás és Adatvédelem', p: [
      '12.1. Jelen szerződés szerint a Bizalmas Információ minden olyan technikai, kereskedelmi, pénzügyi, üzleti vagy stratégiai információ, know-how, elemzés, adat vagy dokumentum, amely a Fél üzleteire, ügyleteire vagy termékeire vonatkozik, és amelyet a másik Féllel megismertet vagy amely a másik Fél tudomására jut.',
      '12.2. A Felek vállalják, hogy a bizalmas információt kizárólag a jelen megállapodással összefüggésben használják fel, harmadik fél tudomására nem hozzák, és csak olyan személlyel közlik, akinek arra a teljesítéshez szüksége van, és aki a titoktartást szerződéses formában vállalta.',
      '12.3. A Felek kötelesek a bizalmas iratokat és dokumentációt zártan kezelni. A titoktartási kötelezettség kiterjed a Felek alkalmazottjaira, munkatársaira, teljesítési segédjeire és egyéb közreműködőire.',
      '12.4. A Megbízott a szerződés teljesítése során tudomására jutott személyes adatokat, illetőleg a Megbízótól kapott valamennyi iratot a megbízási jogviszony megszűnésekor köteles visszaszolgáltatni.',
      '12.5. A titoktartási kötelezettség megsértése esetén a vétkes Fél köteles a másik Félnek az ezzel okozott kárt megtéríteni. A titoktartási kötelezettség a szerződés megszűnését követően is korlátlan ideig fennmarad.'
    ] },
    { n: '13', t: 'Alvállalkozók', p: [
      '13.1. A Megbízott jogosult alvállalkozók vagy közreműködők igénybevételére. Az igénybe vett személyek magatartásáért a Megbízott felelősséggel tartozik, úgy, mintha azok tevékenységét saját maga látta volna el.',
      '13.2. A Megbízott köteles biztosítani, hogy az igénybe vett közreműködők a jelen szerződés titoktartási és adatvédelmi szabályait megismerjék és betartsák.'
    ] },
    { n: '14', t: 'A Szerződés Megszűnése', p: [
      '14.1. A Felek jogosultak a jelen szerződést súlyos szerződésszegés esetén írásban, azonnali hatállyal felmondani. A felmondást az azt közlő fél köteles indokolni.',
      '14.2. Súlyos szerződésszegésnek minősül különösen: fizetési késedelem, a titoktartási kötelezettség megsértése, valamint az együttműködési kötelezettség ismételt és szándékos megszegése.',
      '14.3. Felmondás esetén a Megbízott jogosult az addig elvégzett munkák arányos díjának megtartására. A már kifizetett, de fel nem használt előleg visszafizetése kizárólag abban az esetben kötelező, ha a szerződést a Megbízott súlyos szerződésszegése miatt mondták fel.'
    ] },
    { n: '15', t: 'Áremelési Záradék', p: [
      '15.1. Amennyiben a projekt a Megbízó hibájából, késedelméből vagy együttműködési kötelezettségének elmulasztásából eredően 30 (harminc) naptári napot meghaladóan elhúzódik, a Megbízott jogosult a még nem számlázott tételeket az eredeti ajánlathoz képest legfeljebb 20%-kal megemelni. Az áremelésről a Megbízott írásban értesíti a Megbízót.',
      '15.2. Az áremelési jog kizárólag abban az esetben nem gyakorolható, ha a késedelem kizárólag a Megbízott érdekkörében felmerült okból következett be.'
    ] },
    { n: '16', t: 'Portfólió és Referenciajog', p: [
      '16.1. A Megbízott jogosult az elkészített munkát saját portfóliójában, referencialistájában, weboldalán, közösségi média felületein és egyéb marketing anyagaiban bemutatni.',
      '16.2. Amennyiben a Megbízó a referenciamegjelenést kifejezetten nem kívánja, ezt a szerződés aláírásakor írásban jeleznie kell. Utólagos tiltás esetén a Megbízott 15 (tizenöt) naptári napon belül köteles a megjelenést eltávolítani.'
    ] },
    { n: '17', t: 'Tesztelési és Átvételi Kötelezettség', p: [
      '17.1. A Megbízó köteles az átadott rendszert az átadástól számított 3 (három) naptári napon belül ténylegesen tesztelni és az esetleges hibákat írásban, tételesen jelezni.',
      '17.2. Felületes megtekintés vagy a rendszer érdemi kipróbálása nélkül tett általános észrevétel nem minősül érvényes hibajelzésnek.',
      '17.3. Amennyiben a Megbízó a tesztelési kötelezettségének a 3 (három) napos határidőn belül nem tesz eleget, az átadás automatikusan elfogadottnak minősül, és a Megbízott a záró számla kiállítására jogosult.'
    ] },
    { n: '18', t: 'Adatkezelés és GDPR', p: [
      '18.1. Amennyiben a Megbízó a szerződés teljesítése során személyes adatokat bocsát a Megbízott rendelkezésére, a Megbízó szavatolja, hogy ezen adatok kezelésére az érintettek hozzájárulásával vagy egyéb jogalappal rendelkezik.',
      '18.2. A Megbízott az ilyen adatokat kizárólag a szerződés teljesítéséhez szükséges mértékben kezeli, harmadik félnek nem adja át. Az adatokat a szerződés megszűnésekor haladéktalanul törli vagy visszaszolgáltatja, kivéve, ha jogszabály hosszabb megőrzési kötelezettséget ír elő.',
      '18.3. A Megbízó az általa átadott személyes adatok jogszerű kezeléséért kizárólagosan felel.',
      '18.4. A Felek kötelesek a személyes adatok kezelése során az Európai Unió 2016/679 számú általános adatvédelmi rendeletének (GDPR), valamint a vonatkozó magyar adatvédelmi jogszabályok előírásait betartani.'
    ] },
    { n: '19', t: 'Vis Maior', p: [
      '19.1. Egyik fél sem felel a szerződéses kötelezettségeinek késedelmes vagy hibás teljesítéséért, amennyiben azt rajta kívül álló, előre nem látható és elháríthatatlan körülmény (vis maior) okozta. Vis maiornak minősül különösen: természeti katasztrófa, háború, terrorcselekmény, járvány, hatósági intézkedés, általános internetleállás, illetve a teljesítéshez szükséges külső platformok tartós működésképtelensége.',
      '19.2. A vis maiorra hivatkozó fél köteles azt a másik félnek haladéktalanul, de legkésőbb 3 (három) munkanapon belül írásban bejelenteni.',
      '19.3. Amennyiben a vis maior állapot 30 (harminc) naptári napot meghaladóan fennáll, bármely fél jogosult a szerződést írásban, azonnali hatállyal felmondani.'
    ] },
    { n: '20', t: 'Kommunikációs Csatorna', p: [
      '20.1. A Felek között a szerződéssel összefüggő valamennyi jognyilatkozat, értesítés, felszólítás, hibajelzés, jóváhagyás és egyéb írásbeli kommunikáció kizárólag e-mailen érvényes, a jelen szerződésben meghatározott kapcsolattartói e-mail-címekre küldve.',
      '20.2. Messenger, WhatsApp, Viber, SMS vagy egyéb azonnali üzenetküldő platformon keresztül érkező közlések joghatást nem váltanak ki és írásbeli értesítésnek nem minősülnek, kivéve, ha a Felek eseti jelleggel írásban másképpen állapodnak meg.',
      '20.3. Az e-mailben küldött közlés a kézbesítéstől számított 1 (egy) munkanapon belül kézhezvettnek minősül, kivéve, ha a küldő fél visszapattanási (bounce) értesítést kap.'
    ] },
    { n: '21', t: 'Átadási Dokumentáció', p: [
      '21.1. A projekt lezárásakor a Megbízott köteles átadni a Megbízónak — amennyiben azok a projekt részét képezik — a forráskódhoz való hozzáférést, a hozzáférési adatok és belépők listáját, a használt külső szolgáltatások listáját, valamint rövid kezelési útmutatót, ha az ajánlat ezt tartalmazza.',
      '21.2. Az átadási dokumentáció hiányosságaiért a Megbízott kizárólag akkor felel, ha az érintett elem az ajánlatban tételesen szerepelt.'
    ] },
    { n: '22', t: 'Kizárólagossági Tilalom', p: [
      '22.1. A jelen szerződés a Megbízottat nem kötelezi kizárólagos együttműködésre. A Megbízott jogosult párhuzamosan más megbízóktól is megbízást elfogadni.',
      '22.2. A Megbízó nem követelheti a Megbízottól, hogy versenyző vagy hasonló profilú ügyfelek számára ne végezzen munkát.'
    ] },
    { n: '23', t: 'Karbantartás és Üzemeltetési Támogatás', p: [
      '23.1. A jelen fejezet kizárólag abban az esetben alkalmazandó, amennyiben a mellékelt ajánlat karbantartási szolgáltatást tartalmaz.',
      '23.2. A Megbízott karbantartási szolgáltatást munkanapokon 10:00–16:00 óra között nyújt.',
      '23.3. A Megbízott az írásbeli hibajelzésekre a tőle elvárható legrövidebb időn belül reagál. Konkrét válaszidő vagy megoldási határidő nem garantált; a javítás az adott technikai feltételek és aktuális kapacitás függvényében történik.',
      '23.4. A karbantartási díj kizárólag a már átadott rendszer működőképességének fenntartását és hibajavítását foglalja magában. Új funkciók fejlesztése külön megrendelésnek minősül.',
      '23.5. A karbantartási szolgáltatás havi munkaidőkerete 3 (három) óra. A fel nem használt órák nem vihetők át. A havi kereten felüli munkavégzés díja 15.000 Ft + ÁFA/óra.',
      '23.6. A karbantartási szolgáltatás havi fix díjon alapul, amely minden hónap elején esedékes. A szerződés határozatlan időre szól és automatikusan megújul, kivéve, ha bármely fél azt legalább 30 (harminc) naptári nappal korábban írásban felmondja.',
      '23.7. A Megbízott nem felel azokért a hibákért, amelyeket a Megbízó vagy harmadik személy hibás tartalomfeltöltése, helytelen belépési adatok vagy gondatlan kezelés okozott.',
      '23.8. A Megbízó köteles a karbantartási tevékenységhez szükséges valamennyi hozzáférést biztosítani. A rendszer és az adatok rendszeres mentéséért a Megbízó felel.',
      '23.9. Munkaidőn kívüli beavatkozás esetén a Megbízott jogosult 15.000 Ft + ÁFA/óra sürgősségi pótdíjat felszámítani.',
      '23.10. A Megbízott nem vállal felelősséget a rendszer kiberbiztonságáért. A Megbízott az átadott rendszert az iparági sztenderdek szerint készíti el, azonban teljes körű kibervédelmet, behatolás-megelőzést vagy biztonsági auditot nem garantál.'
    ] },
    { n: '24', t: 'Ajánlat Érvényessége', p: [
      '24.1. A Megbízott által kiadott ajánlat az ajánlat keltétől számított 30 (harminc) naptári napig érvényes. Az elfogadási határidő lejárta után megkötött szerződés esetén a Megbízott fenntartja a jogot az árak és feltételek módosítására.',
      '24.2. Az ajánlat online elfogadásával a Megbízó visszavonhatatlanul elfogadja a jelen szerződést, az ajánlatot és a látványtervet. Az elfogadást követően az ajánlat tartalma, a választott fizetési opció és a szerződési feltételek egyoldalúan nem módosíthatók.'
    ] },
    { n: '25', t: 'Projekt Befagyasztási Záradék', p: [
      '25.1. Amennyiben a projekt a Megbízó oldalán felmerülő okból 60 (hatvan) naptári napot meghaladóan szünetel, a Megbízott jogosult a projektet lezártnak nyilvánítani. Ebben az esetben a már megfizetett előleg a Megbízottat illeti meg. A projekt későbbi folytatása kizárólag új ajánlat és új szerződés megkötésével lehetséges.'
    ] },
    { n: '26', t: 'Szellemi Tulajdon AI-Generált Tartalomra', p: [
      '26.1. A Megbízott a teljesítés során jogosult mesterséges intelligencia alapú eszközöket igénybe venni. Az ilyen eszközök által generált és integrált tartalmak a teljes díj megfizetését követően a Megbízót illetik meg, azzal, hogy a Megbízott nem garantál kizárólagos szerzői jogot az AI-generált elemekre, mivel azonos vagy hasonló tartalom más felhasználók számára is generálható.',
      '26.2. A Megbízó az AI-eszközök alkalmazásával kapcsolatos esetleges szerzői jogi, minőségi vagy egyéb kockázatot magára vállalja; ezzel kapcsolatban a Megbízottal szemben igényt nem érvényesíthet.'
    ] },
    { n: '27', t: 'Deviza és Árfolyamkockázat', p: [
      '27.1. Amennyiben a projekt teljesítéséhez szükséges külső szolgáltatások díja devizában kerül felszámításra, az árfolyamváltozásból eredő többletköltség a Megbízót terheli. A Megbízott nem felel a forint árfolyamának változásából eredő költségnövekedésért.'
    ] },
    { n: '28', t: 'Kapcsolattartó Változása', p: [
      '28.1. Amennyiben a Megbízó oldalán a kapcsolattartó személye megváltozik, a Megbízó köteles azt a változástól számított 3 (három) munkanapon belül írásban bejelenteni. Az értesítés elmulasztása esetén a Megbízott az eredeti kapcsolattartónak küldött kommunikációt joghatályosnak tekinti.'
    ] },
    { n: '29', t: 'Elektronikus Aláírás és Online Elfogadás', p: [
      '29.1. A jelen szerződés szkennelt formában, e-mailben megküldött aláírással, valamint minősített vagy fokozott biztonságú elektronikus aláírással is érvényesen megköthető.',
      '29.2. A jelen szerződés a Megbízott által üzemeltetett online felületen is érvényesen megköthető. Az online elfogadás a Ptk. 6:7. §-a alapján elektronikus úton tett jognyilatkozatnak minősül és teljes bizonyító erejű írásbeli szerződésként kezelendő.',
      '29.3. Az online elfogadásról a rendszer automatikusan visszaigazoló e-mailt küld, amelyhez a jelen szerződés PDF formátumban mellékelve van.',
      '29.4. A Megbízó köteles a szerződést kinyomtatni, aláírni, majd szkennelt formában az ' + COMPASS.email + ' e-mail-címre visszaküldeni az online elfogadástól számított 5 (öt) munkanapon belül. A munkakezdés feltétele az online elfogadás és az előleg beérkezése.'
    ] },
    { n: '30', t: 'Fizetési Felszólítás Folyamata', p: [
      '30.1. Fizetési késedelem esetén a Megbízott lépcsős eljárás szerint jár el.',
      '30.2. Az esedékesség lejártát követő 3 (három) munkanapon belül a Megbízott első írásbeli fizetési felszólítást küld, 3 (három) munkanapos póthatáridővel.',
      '30.3. Amennyiben a Megbízó a póthatáridőn belül sem teljesít, a Megbízott második felszólítást küld, és felfüggeszti a munkavégzést.',
      '30.4. Amennyiben a második felszólítást követő 3 (három) munkanapon belül sem történik fizetés, a Megbízott jogosult elállni, a követelést jogi úton érvényesíteni és az előleget megtartani.'
    ] },
    { n: '31', t: 'Követelés Átruházása', p: [
      '31.1. Amennyiben a Megbízó fizetési kötelezettségének ismételt felszólítás ellenére sem tesz eleget, a Megbízott jogosult a lejárt követelést harmadik félre átruházni vagy behajtás céljából megbízni. Az ezzel kapcsolatban felmerülő valamennyi költség a Megbízót terheli.'
    ] },
    { n: '32', t: 'Vegyes Rendelkezések', p: [
      '32.1. A jelen szerződés kizárólag írásban, mindkét fél közös megegyezésével módosítható.',
      '32.2. A Felek a vitás kérdéseket elsődlegesen egyeztetés útján rendezik. Eredménytelen egyeztetés esetén a hatáskörrel és illetékességgel rendelkező magyar bíróság eljárását kötik ki.',
      '32.3. A jelen szerződés magyar nyelven készült; jogvita esetén a magyar nyelvű verzió az irányadó.',
      '32.4. Amennyiben a jelen szerződés bármely rendelkezése érvénytelenné válik, ez nem érinti a többi rendelkezés érvényességét.',
      '32.6. A jelen szerződésben nem szabályozott kérdésekben a Polgári Törvénykönyv rendelkezései az irányadóak.',
      '32.7. A jelen szerződést a szerződő felek elolvasás és kölcsönös értelmezés után, mint akaratukkal mindenben megegyezőt jóváhagyólag írják alá.'
    ] }
  ];

  /* =========================================================
     RENDER — quote document
     ========================================================= */
  function clientTypeLabel(t) {
    return t === 'sole' ? 'Egyéni vállalkozó' : t === 'private' ? 'Magánszemély' : 'Cég';
  }

  function renderDoc() {
    var P = PILLARS[state.pillar];
    var t = selectedTier();
    var T = totals();
    var m = state.meta;
    var perLabel = t.period === 'month' ? 'Havidíj' : 'Egyszeri díj';
    var headPrice = t.period === 'month' ? fmt(T.monthly) + ' / hó' : fmt(T.project);

    var html = '';

    /* Header */
    html += '<div class="qd-head">';
    html += '<div class="qd-head__top">';
    html += '<div class="qd-brand">Compass<small>Systems · Árajánlat</small></div>';
    html += '<div class="qd-head__meta">';
    html += 'Ajánlat sz. <b>' + esc(m.quoteNo) + '</b><br>';
    html += 'Kelt: <b>' + esc(m.date) + '</b><br>';
    html += 'Érvényes: <b>' + esc(m.validUntil) + '</b>';
    html += '</div></div>';
    html += '<h1 class="qd-title">Árajánlat — <span>' + esc(m.clientName || 'Ügyfél neve') + '</span></h1>';
    html += '<p class="qd-intro">' + esc(m.intro) + '</p>';
    html += '</div>';

    /* Snapshot */
    html += '<div class="qd-snap">';
    html += snap('Csomag', P.label + ' · ' + t.name);
    html += snap(perLabel, headPrice + ' ' + esc(state.vatNote));
    html += snap('Érvényes', m.validUntil);
    html += '</div>';

    /* Goals */
    if (state.goals.length) {
      html += sec('Célok', '01', 'Mit szeretnénk elérni?',
        '<ul class="qd-goals">' + state.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>');
    }

    /* Tiers */
    var tiersHtml = '<div class="qd-tiers">';
    state.tiers.forEach(function (tr) {
      var seld = tr.id === state.tierId;
      tiersHtml += '<div class="qd-tier' + (seld ? ' qd-tier--sel' : '') + '">';
      if (seld) tiersHtml += '<span class="qd-tier__tag">Kiválasztva</span>';
      else if (tr.popular) tiersHtml += '<span class="qd-tier__tag qd-tier__tag--pop">Népszerű</span>';
      tiersHtml += '<div class="qd-tier__name">' + esc(tr.name) + '</div>';
      tiersHtml += '<div class="qd-tier__price">' + fmt(tr.price) + '</div>';
      tiersHtml += '<div class="qd-tier__per">' + (tr.period === 'month' ? '/ hó + ÁFA' : 'egyszeri + ÁFA') + '</div>';
      tiersHtml += '<div class="qd-tier__desc">' + esc(tr.desc) + '</div>';
      tiersHtml += '<ul class="qd-tier__f">' + (tr.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>';
      tiersHtml += '</div>';
    });
    tiersHtml += '</div>';
    html += sec('Csomag', '02', 'Választható csomagok', tiersHtml);

    /* Add-ons */
    var ons = state.addons.filter(function (a) { return a.on; });
    if (ons.length) {
      var aHtml = ons.map(function (a) {
        return '<div class="qd-li"><span>' + esc(a.label) + '</span><span class="qd-li__p">+ ' + fmt(a.price) + '</span></div>';
      }).join('');
      html += sec('Kiegészítők', '03', 'A projekthez választott extra funkciók', aHtml);
    }

    /* Reasons */
    if (state.reasons.length) {
      var rHtml = '<div class="qd-reasons">' + state.reasons.map(function (r) {
        return '<div class="qd-reason"><div class="qd-reason__t">' + esc(r.t) + '</div><p class="qd-reason__d">' + esc(r.d) + '</p></div>';
      }).join('') + '</div>';
      html += sec('Miért a Compass', '04', 'Amit ezzel az iránnyal nyersz', rHtml);
    }

    /* Project fee summary */
    if (T.project > 0) {
      var sHtml = '<div class="qd-sum">';
      sHtml += sumRow('Alap csomag — ' + t.name, fmt(T.oneBase));
      if (T.addonSum > 0) sHtml += sumRow('Kiegészítők', '+ ' + fmt(T.addonSum));
      sHtml += '<div class="qd-sum__row qd-sum__row--total"><span>Egyszeri projekt díj</span><span class="qd-li__p">' + fmt(T.project) + ' ' + esc(state.vatNote) + '</span></div>';
      var sch = SCHEDULES[state.schedule];
      if (sch && sch.parts.length) {
        sHtml += '<div class="qd-split">';
        sch.parts.forEach(function (pt) {
          sHtml += '<div class="qd-split__row"><span>' + esc(pt[0]) + '</span><b>' + fmt(T.project * pt[1]) + '</b></div>';
        });
        sHtml += '</div>';
      }
      sHtml += '</div>';
      html += sec('Összesítő', '05', 'Egyszeri projekt díj', sHtml);
    }

    /* Monthly */
    var monOns = state.monthly.filter(function (x) { return x.on; });
    if (monOns.length || T.monBase > 0) {
      var mHtml = '<div class="qd-sum">';
      if (T.monBase > 0) mHtml += sumRow(t.name + ' (havidíj)', fmt(T.monBase) + ' / hó');
      monOns.forEach(function (x) {
        mHtml += sumRow(x.label + (x.must ? ' · kötelező' : ''), fmt(x.price) + ' / hó');
      });
      mHtml += '<div class="qd-sum__row qd-sum__row--total"><span>Havi díj összesen</span><span class="qd-li__p">' + fmt(T.monthly) + ' / hó ' + esc(state.vatNote) + '</span></div>';
      mHtml += '</div>';
      mHtml += '<p class="qd-note">A havi szolgáltatások minden hónap elején kerülnek számlázásra. A szerződés határozatlan időre szól, bármikor felmondható 30 napos felmondási idővel.</p>';
      html += sec('Havi szolgáltatások', '06', 'A folyamatos működéshez', mHtml);
    }

    /* Process */
    if (state.process.length) {
      var pHtml = '<div class="qd-steps">' + state.process.map(function (s, i) {
        return '<div class="qd-step"><div class="qd-step__n">0' + (i + 1) + '</div><div class="qd-step__t">' + esc(s.t) + '</div><p class="qd-step__d">' + esc(s.d) + '</p></div>';
      }).join('') + '</div>';
      html += sec('Folyamat', '07', 'Hogyan dolgozunk', pHtml);
    }

    /* Client data */
    var c = state.client;
    if (c.name || c.tax || c.address || c.email) {
      var dHtml = '<div class="qd-data">';
      dHtml += dataPair('Megbízó típusa', clientTypeLabel(c.type));
      dHtml += dataPair(c.type === 'company' ? 'Cég neve' : 'Név', c.name);
      if (c.type !== 'private') dHtml += dataPair('Adószám', c.tax);
      dHtml += dataPair('Cím / székhely', c.address);
      dHtml += dataPair('Kapcsolattartó', c.contact);
      dHtml += dataPair('E-mail', c.email);
      dHtml += dataPair('Telefon', c.phone);
      dHtml += '</div>';
      html += sec('Megrendelő adatai', '08', 'A szerződéshez', dHtml);
    }

    /* Contract */
    if (state.includeContract) html += renderContract();

    /* Footer */
    html += '<div class="qd-foot">';
    html += '<span><b>' + esc(COMPASS.short) + '</b> · ' + esc(COMPASS.seat) + '</span>';
    html += '<span>' + esc(COMPASS.email) + ' · ' + esc(COMPASS.phone) + '</span>';
    html += '</div>';

    el('quoteDoc').innerHTML = html;

    function snap(k, v) { return '<div class="qd-snap__cell"><div class="qd-snap__k">' + esc(k) + '</div><div class="qd-snap__v">' + esc(v) + '</div></div>'; }
    function sec(eyebrow, num, h2, body) {
      return '<div class="qd-sec"><div class="qd-sec__h"><b>/ ' + num + '</b> ' + esc(eyebrow) + '</div><h2 class="qd-h2">' + esc(h2) + '</h2>' + body + '</div>';
    }
    function sumRow(label, val) { return '<div class="qd-sum__row"><span>' + esc(label) + '</span><span class="qd-li__p">' + esc(val) + '</span></div>'; }
    function dataPair(k, v) { return '<div><div class="qd-data__k">' + esc(k) + '</div><div class="qd-data__v">' + esc(v || '—') + '</div></div>'; }
  }

  function renderContract() {
    var c = state.client;
    var html = '<div class="qd-sec qd-contract">';
    html += '<div class="qd-sec__h"><b>/ 09</b> Szerződés</div><h2 class="qd-h2">Megbízási Szerződés</h2>';
    html += '<p class="qd-muted">amely létrejött egyrészről a Megbízó, másrészről a ' + esc(COMPASS.short) + ' között.</p>';

    html += '<div class="qd-parties">';
    html += '<div class="qd-party"><h4>Megbízó</h4><div>';
    html += (c.type === 'company' ? 'Cégnév: ' : 'Név: ') + esc(c.name || '………………') + '<br>';
    html += 'Székhely / cím: ' + esc(c.address || '………………') + '<br>';
    if (c.type !== 'private') html += 'Adószám: ' + esc(c.tax || '………………') + '<br>';
    html += 'Képviseli: ' + esc(c.contact || c.name || '………………') + '<br>';
    html += 'E-mail: ' + esc(c.email || '………………') + '<br>';
    html += 'Telefon: ' + esc(c.phone || '………………');
    html += '</div></div>';
    html += '<div class="qd-party"><h4>Megbízott</h4><div>';
    html += 'Cégnév: ' + esc(COMPASS.name) + '<br>';
    html += 'Székhely: ' + esc(COMPASS.seat) + '<br>';
    html += 'Cégjegyzékszám: ' + esc(COMPASS.reg) + '<br>';
    html += 'Adószám: ' + esc(COMPASS.tax) + '<br>';
    html += 'Képviseli: ' + esc(COMPASS.rep) + '<br>';
    html += 'E-mail: ' + esc(COMPASS.email) + '<br>';
    html += 'Telefon: ' + esc(COMPASS.phone);
    html += '</div></div></div>';

    CONTRACT.forEach(function (s) {
      html += '<h3>' + esc(s.n + '. ' + s.t) + '</h3>';
      s.p.forEach(function (par) { html += '<p>' + esc(par) + '</p>'; });
    });

    html += '<div class="qd-sign">';
    html += '<div class="qd-sign__line">Megbízó<br>' + esc(c.name || '………………') + '</div>';
    html += '<div class="qd-sign__line">Megbízott<br>' + esc(COMPASS.short) + ' · ' + esc(COMPASS.rep) + '</div>';
    html += '</div>';
    html += '<p class="qd-note">Kelt: ' + esc(c.place || 'Budapest') + ', ' + esc(state.meta.date) + '</p>';
    html += '</div>';
    return html;
  }

  /* =========================================================
     RENDER — editor
     ========================================================= */
  function acc(key, num, title, body) {
    var open = openSections.has(key);
    return '<div class="acc' + (open ? ' is-open' : '') + '" data-acc="' + key + '">' +
      '<button type="button" class="acc__head" data-toggle="' + key + '">' +
      '<span class="acc__num">' + num + '</span>' + esc(title) +
      '<span class="acc__chev">▾</span></button>' +
      '<div class="acc__body">' + body + '</div></div>';
  }
  function fieldHtml(label, path, val, type) {
    return '<label class="field"><span class="field__label">' + esc(label) + '</span>' +
      '<input class="field__input" type="' + (type || 'text') + '" data-bind="' + path + '" value="' + esc(val) + '"></label>';
  }
  function areaHtml(label, path, val) {
    return '<label class="field"><span class="field__label">' + esc(label) + '</span>' +
      '<textarea class="field__area" data-bind="' + path + '">' + esc(val) + '</textarea></label>';
  }

  function renderEditor() {
    var P = PILLARS[state.pillar], m = state.meta, c = state.client;
    var h = '';

    /* 01 Basics */
    h += acc('basics', '01', 'Alapadatok',
      fieldHtml('Ügyfél neve', 'meta.clientName', m.clientName) +
      areaHtml('Bevezető mondat', 'meta.intro', m.intro) +
      '<div class="row">' + fieldHtml('Ajánlat sorszáma', 'meta.quoteNo', m.quoteNo) + fieldHtml('Készítette', 'meta.preparedBy', m.preparedBy) + '</div>' +
      '<div class="row">' + fieldHtml('Kelt', 'meta.date', m.date) + fieldHtml('Érvényes eddig', 'meta.validUntil', m.validUntil) + '</div>');

    /* 02 Pillar & tiers */
    var pill = '<div class="pillars">';
    ['presence', 'growth', 'operations'].forEach(function (p) {
      pill += '<button type="button" class="pillar-tab' + (state.pillar === p ? ' is-active' : '') + '" data-pillar="' + p + '">' +
        '<span class="pillar-tab__n">' + PILLARS[p].n + '</span><span class="pillar-tab__name">' + PILLARS[p].label + '</span></button>';
    });
    pill += '</div><p class="hint">Pillér váltásakor a csomagok, célok, kiegészítők és havi tételek az adott pillér alapértékeire állnak. Az ügyféladatok megmaradnak.</p>';
    state.tiers.forEach(function (tr, i) {
      var seld = tr.id === state.tierId;
      pill += '<div class="tier-edit' + (seld ? ' is-selected' : '') + '">' +
        '<div class="tier-edit__top">' +
        '<label class="tier-edit__sel"><input type="radio" name="tiersel" data-select-tier="' + tr.id + '"' + (seld ? ' checked' : '') + '> Kiválasztva</label></div>' +
        '<div class="row"><label class="field"><span class="field__label">Csomag neve</span><input class="field__input" data-tier="' + i + '" data-key="name" value="' + esc(tr.name) + '"></label>' +
        '<label class="field"><span class="field__label">Ár</span><input class="field__input" type="number" data-tier="' + i + '" data-key="price" value="' + esc(tr.price) + '"></label></div>' +
        '<label class="field" style="margin-top:11px"><span class="field__label">Periódus</span><select class="field__select" data-tier="' + i + '" data-key="period">' +
        '<option value="once"' + (tr.period === 'once' ? ' selected' : '') + '>Egyszeri</option>' +
        '<option value="month"' + (tr.period === 'month' ? ' selected' : '') + '>Havi</option></select></label>' +
        '<label class="field" style="margin-top:11px"><span class="field__label">Rövid leírás</span><textarea class="field__area" data-tier="' + i + '" data-key="desc">' + esc(tr.desc) + '</textarea></label>' +
        '<label class="field" style="margin-top:11px"><span class="field__label">Funkciók (soronként egy)</span><textarea class="field__area" data-tier="' + i + '" data-key="features">' + esc((tr.features || []).join('\n')) + '</textarea></label>' +
        '</div>';
    });
    h += acc('pillar', '02', 'Pillér & csomagok', pill);

    /* 03 Goals */
    h += acc('goals', '03', 'Célok', listEditor(state.goals, 'goals', 'Új cél hozzáadása'));

    /* 04 Reasons */
    var rb = '<div class="list-edit">';
    state.reasons.forEach(function (r, i) {
      rb += '<div class="tier-edit"><div class="row"><label class="field"><span class="field__label">Cím</span><input class="field__input" data-reason="' + i + '" data-key="t" value="' + esc(r.t) + '"></label>' +
        '<button type="button" class="icon-btn" data-del="reasons" data-idx="' + i + '" style="align-self:end;margin-bottom:0">✕</button></div>' +
        '<label class="field" style="margin-top:11px"><span class="field__label">Leírás</span><textarea class="field__area" data-reason="' + i + '" data-key="d">' + esc(r.d) + '</textarea></label></div>';
    });
    rb += '</div><button type="button" class="add-btn" data-add="reasons">+ Új érv</button>';
    h += acc('reasons', '04', 'Miért a Compass', rb);

    /* 05 Add-ons */
    h += acc('addons', '05', 'Kiegészítők (egyszeri)', priceListEditor(state.addons, 'addons', 'Új kiegészítő'));

    /* 06 Monthly */
    h += acc('monthly', '06', 'Havi szolgáltatások', priceListEditor(state.monthly, 'monthly', 'Új havi tétel'));

    /* 07 Process */
    var pb = '<div class="list-edit">';
    state.process.forEach(function (s, i) {
      pb += '<div class="tier-edit"><div class="row"><label class="field"><span class="field__label">Lépés ' + (i + 1) + '</span><input class="field__input" data-proc="' + i + '" data-key="t" value="' + esc(s.t) + '"></label>' +
        '<button type="button" class="icon-btn" data-del="process" data-idx="' + i + '" style="align-self:end;margin-bottom:0">✕</button></div>' +
        '<label class="field" style="margin-top:11px"><span class="field__label">Leírás</span><textarea class="field__area" data-proc="' + i + '" data-key="d">' + esc(s.d) + '</textarea></label></div>';
    });
    pb += '</div><button type="button" class="add-btn" data-add="process">+ Új lépés</button>';
    h += acc('process', '07', 'Folyamat', pb);

    /* 08 Payment */
    var pay = '<div class="seg">';
    Object.keys(SCHEDULES).forEach(function (k) {
      pay += '<button type="button" class="seg__opt' + (state.schedule === k ? ' is-active' : '') + '" data-sched="' + k + '">' + SCHEDULES[k].label + '<small>' + SCHEDULES[k].desc + '</small></button>';
    });
    pay += '</div>' + fieldHtml('ÁFA megjegyzés', 'vatNote', state.vatNote);
    h += acc('payment', '08', 'Fizetési ütemezés', pay);

    /* 09 Client & contract */
    var cl = '<div class="seg">';
    [['company', 'Cég'], ['sole', 'Egyéni váll.'], ['private', 'Magánszemély']].forEach(function (o) {
      cl += '<button type="button" class="seg__opt' + (c.type === o[0] ? ' is-active' : '') + '" data-ctype="' + o[0] + '">' + o[1] + '</button>';
    });
    cl += '</div>';
    cl += fieldHtml(c.type === 'company' ? 'Cég neve' : 'Név', 'client.name', c.name);
    cl += '<div class="row">' + fieldHtml('Adószám', 'client.tax', c.tax) + fieldHtml('Telefon', 'client.phone', c.phone) + '</div>';
    cl += fieldHtml('Cím / székhely', 'client.address', c.address);
    cl += '<div class="row">' + fieldHtml('Kapcsolattartó', 'client.contact', c.contact) + fieldHtml('E-mail', 'client.email', c.email) + '</div>';
    cl += '<div class="row">' + fieldHtml('Kelt helye', 'client.place', c.place) + '</div>';
    cl += '<label class="gate__remember" style="margin-top:13px"><input type="checkbox" data-bind-bool="includeContract"' + (state.includeContract ? ' checked' : '') + '> Megbízási Szerződés csatolása az ajánlathoz</label>';
    h += acc('client', '09', 'Megrendelő & szerződés', cl);

    el('editor').innerHTML = h;
  }

  function listEditor(arr, key, addLabel) {
    var h = '<div class="list-edit">';
    arr.forEach(function (v, i) {
      h += '<div class="list-row"><input class="field__input" data-litem="' + key + '" data-idx="' + i + '" value="' + esc(v) + '">' +
        '<button type="button" class="icon-btn" data-del="' + key + '" data-idx="' + i + '">✕</button></div>';
    });
    h += '</div><button type="button" class="add-btn" data-add="' + key + '">+ ' + esc(addLabel) + '</button>';
    return h;
  }
  function priceListEditor(arr, key, addLabel) {
    var h = '<div class="list-edit">';
    arr.forEach(function (it, i) {
      h += '<div class="list-row">' +
        '<input type="checkbox" class="list-row__toggle" data-toggleitem="' + key + '" data-idx="' + i + '"' + (it.on ? ' checked' : '') + '>' +
        '<input class="field__input" data-pitem="' + key + '" data-idx="' + i + '" data-key="label" value="' + esc(it.label) + '">' +
        '<input class="field__input list-row__price" type="number" data-pitem="' + key + '" data-idx="' + i + '" data-key="price" value="' + esc(it.price) + '">' +
        '<button type="button" class="icon-btn" data-del="' + key + '" data-idx="' + i + '">✕</button></div>';
    });
    h += '</div><button type="button" class="add-btn" data-add="' + key + '">+ ' + esc(addLabel) + '</button>';
    return h;
  }

  /* ---------- editor events ---------- */
  function setPath(path, val) {
    var parts = path.split('.'), o = state;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }

  function bindEditor() {
    var ed = el('editor');

    ed.addEventListener('input', function (e) {
      var t = e.target, d = t.dataset;
      if (d.bind) { setPath(d.bind, t.value); refreshDoc(); return; }
      if (d.litem) { state[d.litem][+d.idx] = t.value; refreshDoc(); return; }
      if (d.tier != null) {
        var tr = state.tiers[+d.tier];
        if (d.key === 'features') tr.features = t.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        else if (d.key === 'price') tr.price = +t.value || 0;
        else tr[d.key] = t.value;
        refreshDoc(); return;
      }
      if (d.pitem) {
        var it = state[d.pitem][+d.idx];
        it[d.key] = d.key === 'price' ? (+t.value || 0) : t.value;
        refreshDoc(); return;
      }
      if (d.reason != null) { state.reasons[+d.reason][d.key] = t.value; refreshDoc(); return; }
      if (d.proc != null) { state.process[+d.proc][d.key] = t.value; refreshDoc(); return; }
    });

    ed.addEventListener('change', function (e) {
      var t = e.target, d = t.dataset;
      if (d.bindBool) { state[d.bindBool] = t.checked; refreshDoc(); return; }
      if (d.toggleitem) { state[d.toggleitem][+d.idx].on = t.checked; refreshDoc(); return; }
      if (d.tier != null && d.key === 'period') { state.tiers[+d.tier].period = t.value; refreshDoc(); return; }
      if (d.selectTier) { state.tierId = d.selectTier; renderEditor(); refreshDoc(); return; }
    });

    ed.addEventListener('click', function (e) {
      var t = e.target.closest('[data-toggle],[data-pillar],[data-add],[data-del],[data-sched],[data-ctype]');
      if (!t) return;
      var d = t.dataset;
      if (d.toggle) {
        if (openSections.has(d.toggle)) openSections.delete(d.toggle); else openSections.add(d.toggle);
        t.closest('.acc').classList.toggle('is-open');
        return;
      }
      if (d.pillar) { if (d.pillar !== state.pillar) { setPillar(d.pillar); renderEditor(); refreshDoc(); } return; }
      if (d.sched) { state.schedule = d.sched; renderEditor(); refreshDoc(); return; }
      if (d.ctype) { state.client.type = d.ctype; renderEditor(); refreshDoc(); return; }
      if (d.add) { addItem(d.add); renderEditor(); refreshDoc(); return; }
      if (d.del) { state[d.del].splice(+d.idx, 1); renderEditor(); refreshDoc(); return; }
    });
  }

  function addItem(key) {
    if (key === 'goals') state.goals.push('Új cél');
    else if (key === 'reasons') state.reasons.push({ t: 'Új érv', d: 'Rövid magyarázat.' });
    else if (key === 'process') state.process.push({ t: 'Új lépés', d: 'Leírás.' });
    else if (key === 'addons') state.addons.push({ id: uid(), label: 'Új kiegészítő', price: 50000, on: true });
    else if (key === 'monthly') state.monthly.push({ id: uid(), label: 'Új havi tétel', price: 29000, on: true });
  }

  function refreshDoc() { renderDoc(); save(); }

  /* =========================================================
     Export actions
     ========================================================= */
  function buildStandalone() {
    var inner = el('quoteDoc').outerHTML;
    return '<!DOCTYPE html><html lang="hu"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Árajánlat — ' + esc(state.meta.clientName || 'Compass') + '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">' +
      '<style>body{margin:0;background:#0c0c0c;padding:24px;}@media print{body{background:#fff;padding:0;}}\n' + DOC_CSS + '</style></head><body>' +
      inner + '</body></html>';
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type || 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function slug() {
    return 'compass-arajanlat-' + (state.meta.clientName || 'ugyfel').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + state.meta.date.replace(/\./g, '');
  }

  function plainText() {
    var t = selectedTier(), T = totals(), L = [];
    L.push('COMPASS SYSTEMS — ÁRAJÁNLAT');
    L.push('Ajánlat sz.: ' + state.meta.quoteNo);
    L.push('Ügyfél: ' + (state.meta.clientName || '—'));
    L.push('Kelt: ' + state.meta.date + '  ·  Érvényes: ' + state.meta.validUntil);
    L.push('Csomag: ' + PILLARS[state.pillar].label + ' · ' + t.name);
    L.push('');
    if (state.goals.length) { L.push('CÉLOK:'); state.goals.forEach(function (g) { L.push(' - ' + g); }); L.push(''); }
    var ons = state.addons.filter(function (a) { return a.on; });
    if (ons.length) { L.push('KIEGÉSZÍTŐK:'); ons.forEach(function (a) { L.push(' - ' + a.label + ': + ' + fmt(a.price)); }); L.push(''); }
    if (T.project > 0) L.push('EGYSZERI PROJEKT DÍJ: ' + fmt(T.project) + ' ' + state.vatNote);
    if (T.monthly > 0) L.push('HAVI DÍJ: ' + fmt(T.monthly) + ' / hó ' + state.vatNote);
    L.push('');
    L.push(COMPASS.short + ' · ' + COMPASS.email + ' · ' + COMPASS.phone);
    return L.join('\n');
  }

  function toast(msg) {
    var t = el('toast');
    t.textContent = msg; t.classList.add('is-show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('is-show'); }, 2600);
  }

  function doAction(act) {
    if (act === 'print') { window.print(); return; }
    if (act === 'download') { download(slug() + '.html', buildStandalone()); toast('Önálló HTML letöltve.'); return; }
    if (act === 'copy') {
      var url = location.origin + location.pathname + '#view=' + encodeState(stripState());
      navigator.clipboard.writeText(plainText() + '\n\nMegtekintés: ' + url).then(function () { toast('Szöveg a vágólapra másolva.'); },
        function () { toast('Másolás nem sikerült.'); });
      return;
    }
    if (act === 'share') {
      var link = location.origin + location.pathname + '#view=' + encodeState(stripState());
      navigator.clipboard.writeText(link).then(function () { toast('Megosztható link a vágólapra másolva.'); },
        function () { prompt('Másold ki a linket:', link); });
      return;
    }
    if (act === 'new') {
      if (confirm('Új, üres ajánlat? A jelenlegi piszkozat felülíródik.')) {
        state = freshState(); renderEditor(); refreshDoc(); toast('Új ajánlat létrehozva.');
      }
      return;
    }
    if (act === 'preview') { el('app').classList.toggle('is-show-preview'); return; }
    if (act === 'lock') {
      sessionStorage.removeItem(AUTH_KEY); localStorage.removeItem(AUTH_KEY);
      location.hash = ''; location.reload();
      return;
    }
  }

  function stripState() {
    var s = deepCopy(state);
    return s; // already serializable, no UI fields kept in state
  }

  function bindBar() {
    el('barActions').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      doAction(b.dataset.act);
    });
  }

  /* =========================================================
     View mode (shared link) — read-only
     ========================================================= */
  function enterViewMode(data) {
    view = true;
    state = data;
    // normalize missing fields against fresh defaults
    var f = freshState();
    state.meta = Object.assign({}, f.meta, state.meta || {});
    state.client = Object.assign({}, f.client, state.client || {});
    document.title = 'Árajánlat — ' + (state.meta.clientName || 'Compass Systems');
    el('gate').hidden = true;
    var app = el('app'); app.hidden = false; app.classList.add('is-view');
    el('modeTag').textContent = 'AJÁNLAT';
    // trim toolbar to viewer-safe actions
    el('barActions').innerHTML =
      '<button class="qb-act" data-act="copy">⧉ Szöveg</button>' +
      '<button class="qb-act" data-act="download">⬇ HTML</button>' +
      '<button class="qb-act qb-act--primary" data-act="print">⎙ PDF / Nyomtatás</button>';
    renderDoc();
  }

  /* =========================================================
     Gate + boot
     ========================================================= */
  function unlock() {
    el('gate').hidden = true;
    var app = el('app'); app.hidden = false;
    // load draft or fresh (validate critical shape)
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
    var valid = draft && draft.tiers && draft.client && draft.addons && draft.monthly && draft.goals && draft.reasons && draft.process;
    state = valid ? draft : freshState();
    var f = freshState();
    state.meta = Object.assign({}, f.meta, state.meta || {});
    state.client = Object.assign({}, f.client, state.client || {});
    openSections = new Set(['basics', 'pillar']);
    renderEditor(); renderDoc(); bindEditor();
  }

  function bindGate() {
    el('gate').hidden = false;
    el('gateForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var pass = el('gatePass').value;
      var hash = await sha256(pass);
      if (hash === PASS_HASH) {
        if (el('gateRemember').checked) localStorage.setItem(AUTH_KEY, '1');
        else sessionStorage.setItem(AUTH_KEY, '1');
        unlock();
      } else {
        el('gateError').hidden = false;
        el('gatePass').value = '';
        el('gatePass').focus();
      }
    });
  }

  function boot() {
    // inject document styles
    var st = document.createElement('style'); st.textContent = DOC_CSS; document.head.appendChild(st);
    bindBar();

    // shared view link?
    var hash = location.hash || '';
    if (hash.indexOf('#view=') === 0) {
      try { enterViewMode(decodeState(hash.slice(6))); return; }
      catch (e) { /* fall through to gate */ }
    }

    // already authorized?
    if (localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY)) { unlock(); }
    else { bindGate(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
