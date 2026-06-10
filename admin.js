/* =========================================================
   Compass Systems — Admin panel
   Auth · Dashboard · Inquiries · Blog CRUD · Settings

   TWO MODES:
   LOCAL  — no backend; SHA-256 password gate (same password as
            Árajánlat-készítő); data lives in localStorage.
   REMOTE — Supabase Auth + Postgres; activated by filling in
            supabase-config.js. Zero code changes required.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- shorthands ---------- */
  function el(id) { return document.getElementById(id); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- constants ---------- */
  /* SHA-256 hash of the admin password — same as Árajánlat-készítő so
     one password unlocks both internal tools.                         */
  var PASS_HASH = '12fa7e06e43d1ce0c599eeee0de66e94d801879666173c6ccf5b72203bcaa85a';
  var AUTH_KEY   = 'compass_admin_auth_v1';
  var POSTS_KEY  = 'compass_admin_posts_v1';
  var INQ_KEY    = 'compass_admin_inquiries_v1';

  var CATS = {
    websites:   'Weboldalak',
    marketing:  'Marketing',
    operations: 'Operations',
    seo:        'SEO & GEO'
  };
  var STATUS_LABEL = { new: 'Új', read: 'Olvasott', replied: 'Megválaszolt', archived: 'Archivált' };

  /* ---------- SHA-256 (same implementation as árajánlat.js) ---------- */
  async function sha256(str) {
    if (window.crypto && crypto.subtle && location.protocol !== 'file:') {
      try {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
      } catch (e) { /* fall through */ }
    }
    return sha256sync(str);
  }
  function sha256sync(str) {
    var K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var bytes = [];
    for (var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff);
    var msgLen = bytes.length;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var bits = msgLen * 8;
    bytes.push(0, 0, 0, 0, (bits >>> 24) & 0xff, (bits >>> 16) & 0xff, (bits >>> 8) & 0xff, bits & 0xff);
    for (var bi = 0; bi < bytes.length; bi += 64) {
      var W = [];
      for (var j = 0; j < 16; j++) W[j] = (bytes[bi+j*4]<<24)|(bytes[bi+j*4+1]<<16)|(bytes[bi+j*4+2]<<8)|bytes[bi+j*4+3];
      for (var j2 = 16; j2 < 64; j2++) {
        var s0 = rotr(7, W[j2-15]) ^ rotr(18, W[j2-15]) ^ (W[j2-15] >>> 3);
        var s1 = rotr(17, W[j2-2])  ^ rotr(19, W[j2-2])  ^ (W[j2-2]  >>> 10);
        W[j2] = (W[j2-16] + s0 + W[j2-7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var j3 = 0; j3 < 64; j3++) {
        var S1    = rotr(6, e)  ^ rotr(11, e) ^ rotr(25, e);
        var ch    = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[j3] + W[j3]) | 0;
        var S0    = rotr(2, a)  ^ rotr(13, a) ^ rotr(22, a);
        var maj   = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H[0]=(H[0]+a)|0; H[1]=(H[1]+b)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
      H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
    }
    return H.map(function (n) { return (n >>> 0).toString(16).padStart(8, '0'); }).join('');
  }

  /* ---------- uid ---------- */
  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ---------- date helpers ---------- */
  var MONTHS = ['január','február','március','április','május','június',
                'július','augusztus','szeptember','október','november','december'];
  function fmtDate(d) {
    if (!d) return '—';
    var x = new Date(d);
    return x.getFullYear() + '. ' + MONTHS[x.getMonth()] + ' ' + x.getDate() + '.';
  }
  function timeAgo(d) {
    if (!d) return '';
    var s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'most';
    if (s < 3600) return Math.floor(s / 60) + ' perce';
    if (s < 86400) return Math.floor(s / 3600) + ' órája';
    if (s < 604800) return Math.floor(s / 86400) + ' napja';
    return fmtDate(d);
  }
  function slugify(s) {
    var map = { á:'a',é:'e',í:'i',ó:'o',ö:'o',ő:'o',ú:'u',ü:'u',ű:'u' };
    return String(s || '').toLowerCase()
      .replace(/[áéíóöőúüű]/g, function (c) { return map[c] || c; })
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  function readMinutes(html) {
    var words = String(html || '').replace(/<[^>]+>/g,' ').replace(/\s+/,' ').trim().split(' ').length;
    return Math.max(1, Math.round(words / 200));
  }

  /* ---------- toast ---------- */
  var toastT;
  function toast(msg, kind) {
    var t = el('toast');
    t.textContent = msg;
    t.className = 'ad-toast is-show' + (kind ? ' ad-toast--' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = 'ad-toast'; }, 3400);
  }

  /* =========================================================
     Database abstraction
     Each method returns a Promise. Swap LOCAL ↔ SUPABASE by
     calling makeLocalDB() or makeSupabaseDB(sb) and assigning
     the result to the module-level `DB` variable.
     ========================================================= */
  var DB;

  /* ----- Local (localStorage) ----- */
  function makeLocalDB() {
    function load(k)     { try { return JSON.parse(localStorage.getItem(k)) || []; } catch(e) { return []; } }
    function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { toast('A localStorage tele van.', 'err'); } }
    function sortByDate(arr) {
      return arr.slice().sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return {
      isLocal: true,
      getPosts:     function () { return Promise.resolve(sortByDate(load(POSTS_KEY))); },
      upsertPost:   function (row) {
        if (!row.id) row.id = uid();
        row.updated_at = new Date().toISOString();
        if (!row.created_at) row.created_at = row.updated_at;
        var arr = load(POSTS_KEY);
        var i = arr.findIndex ? arr.findIndex(function (x) { return x.id === row.id; }) : -1;
        if (i > -1) arr[i] = row; else arr.unshift(row);
        store(POSTS_KEY, arr);
        return Promise.resolve(row);
      },
      deletePost:   function (id) {
        store(POSTS_KEY, load(POSTS_KEY).filter(function (x) { return x.id !== id; }));
        return Promise.resolve();
      },
      getInquiries: function () { return Promise.resolve(sortByDate(load(INQ_KEY))); },
      updateInquiry:function (id, patch) {
        var arr = load(INQ_KEY);
        var i = arr.findIndex ? arr.findIndex(function (x) { return x.id === id; }) : -1;
        if (i > -1) { Object.assign(arr[i], patch); store(INQ_KEY, arr); }
        return Promise.resolve();
      },
      deleteInquiry:function (id) {
        store(INQ_KEY, load(INQ_KEY).filter(function (x) { return x.id !== id; }));
        return Promise.resolve();
      },
      /* Compress image to JPEG dataURL; cap at ~200 KB for localStorage */
      uploadCover:  function (file) {
        return new Promise(function (resolve) {
          var img = new Image();
          var objUrl = URL.createObjectURL(file);
          img.onload = function () {
            URL.revokeObjectURL(objUrl);
            var maxW = 1200;
            var scale = Math.min(1, maxW / img.width);
            var canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            var url = canvas.toDataURL('image/jpeg', 0.80);
            var kb = Math.round(url.length * 0.75 / 1024);
            if (kb > 400) { resolve({ url: null, error: 'Kép tömörítés után ' + kb + ' KB — túl nagy. Max 400 KB. Próbálj kisebb képet.' }); return; }
            resolve({ url: url, error: null });
          };
          img.onerror = function () { URL.revokeObjectURL(objUrl); resolve({ url: null, error: 'Képolvasási hiba.' }); };
          img.src = objUrl;
        });
      }
    };
  }

  /* ----- Supabase ----- */
  function makeSupabaseDB(sb) {
    var C = window.COMPASS_SUPABASE || {};
    return {
      isLocal: false,
      getPosts: function () {
        return sb.from('posts').select('*').order('created_at', { ascending: false })
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      upsertPost: function (row) {
        var q = row.id
          ? sb.from('posts').update(row).eq('id', row.id).select().single()
          : sb.from('posts').insert(row).select().single();
        return q.then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      deletePost: function (id) {
        return sb.from('posts').delete().eq('id', id)
          .then(function (r) { if (r.error) throw r.error; });
      },
      getInquiries: function () {
        return sb.from('inquiries').select('*').order('created_at', { ascending: false })
          .then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      updateInquiry: function (id, patch) {
        return sb.from('inquiries').update(patch).eq('id', id)
          .then(function (r) { if (r.error) throw r.error; });
      },
      deleteInquiry: function (id) {
        return sb.from('inquiries').delete().eq('id', id)
          .then(function (r) { if (r.error) throw r.error; });
      },
      uploadCover: function (file) {
        var ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
        var path = 'cover-' + Date.now() + '.' + ext;
        return sb.storage.from(C.bucket).upload(path, file, { upsert: true, contentType: file.type })
          .then(function (r) {
            if (r.error) return { url: null, error: r.error.message };
            return { url: sb.storage.from(C.bucket).getPublicUrl(path).data.publicUrl, error: null };
          });
      }
    };
  }

  /* =========================================================
     State
     ========================================================= */
  var sb        = null;   // Supabase client (remote mode only)
  var user      = null;   // { email } — synthesised in local mode
  var posts     = [];
  var inquiries = [];
  var view      = 'dashboard';
  var inqFilter = 'all';
  var inqSearch = '';
  var editing   = null;
  var C = window.COMPASS_SUPABASE || {};

  /* =========================================================
     Boot
     ========================================================= */
  function boot() {
    el('setup').hidden = true;

    if (!C.ready) {
      /* ---- LOCAL MODE ---- */
      DB = makeLocalDB();
      if (localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY)) {
        user = { email: 'helyi mód', isLocal: true };
        mountApp();
      } else {
        showLocalGate();
      }
    } else {
      /* ---- SUPABASE MODE ---- */
      if (!window.supabase) { el('setup').hidden = false; return; }
      sb = window.supabase.createClient(C.url, C.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      DB = makeSupabaseDB(sb);
      sb.auth.getSession().then(function (res) {
        var session = res && res.data && res.data.session;
        if (session && session.user) { user = session.user; mountApp(); }
        else { showSupabaseGate(); }
      });
    }
  }

  /* =========================================================
     Auth gates
     ========================================================= */

  /* Local: show password-only gate (same UX as árajánlat) */
  function showLocalGate() {
    var g = el('gate');
    g.hidden = false;
    /* adapt the gate to password-only */
    el('gateEmail').closest('.field').hidden = true;
    el('gateEmail').removeAttribute('required'); /* hidden required fields block silent form submit */
    el('gateEmail').disabled = true;
    el('gateSubmit').textContent = 'Belépés →';
    var form = el('gateForm');
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var pass = el('gatePass').value;
      var btn = el('gateSubmit');
      btn.disabled = true; btn.textContent = 'Ellenőrzés…';
      el('gateError').hidden = true;
      var hash = await sha256(pass);
      if (hash === PASS_HASH) {
        localStorage.setItem(AUTH_KEY, '1');
        user = { email: 'helyi mód', isLocal: true };
        g.hidden = true;
        mountApp();
      } else {
        btn.disabled = false; btn.textContent = 'Belépés →';
        el('gateError').textContent = 'Hibás jelszó. Próbáld újra.';
        el('gateError').hidden = false;
        el('gatePass').value = ''; el('gatePass').focus();
      }
    });
    el('gatePass').focus();
  }

  /* Supabase: email + password */
  function showSupabaseGate() {
    var g = el('gate');
    g.hidden = false;
    var form = el('gateForm');
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = el('gateEmail').value.trim();
      var pass  = el('gatePass').value;
      var btn   = el('gateSubmit');
      btn.disabled = true; btn.textContent = 'Belépés…';
      el('gateError').hidden = true;
      sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
        btn.disabled = false; btn.textContent = 'Belépés →';
        if (res.error) {
          el('gateError').textContent = 'Hibás e-mail vagy jelszó.';
          el('gateError').hidden = false;
          el('gatePass').value = ''; el('gatePass').focus();
          return;
        }
        user = res.data.user;
        el('gate').hidden = true;
        mountApp();
      });
    });
    el('gateEmail').focus();
  }

  function signOut() {
    if (DB && DB.isLocal) {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
      location.reload();
    } else {
      sb.auth.signOut().then(function () { location.reload(); });
    }
  }

  /* =========================================================
     App shell
     ========================================================= */
  function mountApp() {
    el('app').hidden = false;
    el('userEmail').textContent = user.email || '';
    el('userAvatar').textContent = (user.email || 'L').charAt(0).toUpperCase();

    /* local-mode badge in sidebar */
    if (DB.isLocal) {
      var tag = document.createElement('span');
      tag.className = 'qb-bar__tag mono';
      tag.style.cssText = 'margin-left:auto;margin-top:auto;display:block;text-align:center;margin-bottom:8px;';
      tag.textContent = 'HELYI MÓD';
      el('side').querySelector('.ad-side__foot').insertBefore(tag, el('side').querySelector('.ad-side__foot').firstChild);
    }

    $all('.ad-nav__item').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view); closeSide(); });
    });
    el('signOut').addEventListener('click', signOut);
    el('menuBtn').addEventListener('click', openSide);
    el('sideClose').addEventListener('click', closeSide);
    el('scrim').addEventListener('click', closeSide);

    loadAll();
  }

  function openSide()  { el('app').classList.add('is-side-open');    el('scrim').hidden = false; }
  function closeSide() { el('app').classList.remove('is-side-open'); el('scrim').hidden = true;  }

  function loadAll() {
    setView('dashboard');
    Promise.all([DB.getPosts(), DB.getInquiries()])
      .then(function (r) {
        posts     = r[0] || [];
        inquiries = r[1] || [];
        updateBadges();
        render();
      })
      .catch(function (e) {
        toast('Betöltési hiba: ' + (e && e.message || e), 'err');
      });
  }

  function updateBadges() {
    var unread = inquiries.filter(function (i) { return i.status === 'new'; }).length;
    var b = el('navInqBadge');
    if (unread) { b.hidden = false; b.textContent = unread; } else { b.hidden = true; }
  }

  /* =========================================================
     View router
     ========================================================= */
  var TITLES = {
    dashboard: ['Áttekintés',   '/ ÁTTEKINTÉS'],
    inquiries: ['Megkeresések', '/ MEGKERESÉSEK'],
    blog:      ['Blog',         '/ BLOG'],
    editor:    ['Bejegyzés szerkesztése', '/ BLOG — SZERKESZTŐ'],
    settings:  ['Beállítások',  '/ BEÁLLÍTÁSOK']
  };

  function setView(name) {
    view = name;
    var navName = name === 'editor' ? 'blog' : name;
    $all('.ad-nav__item').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === navName); });
    el('topTitle').textContent    = TITLES[name][0];
    el('topEyebrow').textContent  = TITLES[name][1];
    el('topActions').innerHTML    = '';
    render();
    el('view').scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function render() {
    if (view === 'dashboard') return renderDashboard();
    if (view === 'inquiries') return renderInquiries();
    if (view === 'blog')      return renderBlog();
    if (view === 'editor')    return renderEditor();
    if (view === 'settings')  return renderSettings();
  }

  /* =========================================================
     Dashboard
     ========================================================= */
  function renderDashboard() {
    var v = el('view');
    var newCount  = inquiries.filter(function (i) { return i.status === 'new'; }).length;
    var weekAgo   = Date.now() - 7 * 864e5;
    var weekCount = inquiries.filter(function (i) { return new Date(i.created_at).getTime() > weekAgo; }).length;
    var published = posts.filter(function (p) { return p.status === 'published'; }).length;
    var drafts    = posts.length - published;

    var html = '<div class="stat-grid">';
    html += stat('Összes megkeresés', inquiries.length, newCount ? '<b>' + newCount + ' új</b> olvasatlan' : 'Minden elolvasva');
    html += stat('Az elmúlt 7 napban', weekCount, 'beérkezett megkeresés');
    html += stat('Megjelent cikk', published, drafts + ' piszkozat');
    html += stat('Összes bejegyzés', posts.length, 'a blogban');
    html += '</div>';

    html += '<div class="dash-cols">';
    html += '<div class="panel"><div class="panel__head"><h3>Legutóbbi megkeresések</h3><a href="#" data-go="inquiries">Mind →</a></div><div class="panel__body">';
    if (!inquiries.length) {
      html += '<div style="padding:28px 22px;color:var(--color-text-tertiary);font-size:14px;">Még nincs megkeresés.' +
        (DB.isLocal ? ' Töltsd ki a <a href="contact.html" target="_blank" style="color:var(--color-accent)">kapcsolati oldalt</a> teszteléshez.' : '') + '</div>';
    } else {
      inquiries.slice(0, 5).forEach(function (i) {
        html += '<div class="mini-row" data-inq="' + i.id + '">' +
          '<span class="mini-row__dot ' + (i.status === 'new' ? 'is-new' : '') + '"></span>' +
          '<div class="mini-row__main"><div class="mini-row__title">' + esc(i.name || 'Névtelen') +
          (i.company ? ' · ' + esc(i.company) : '') + '</div>' +
          '<div class="mini-row__meta">' + esc(i.budget || (i.bottleneck && i.bottleneck[0]) || i.email || '') + '</div></div>' +
          '<span class="mini-row__time">' + timeAgo(i.created_at) + '</span></div>';
      });
    }
    html += '</div></div>';

    html += '<div class="panel"><div class="panel__head"><h3>Legutóbbi bejegyzések</h3><a href="#" data-go="blog">Mind →</a></div><div class="panel__body">';
    if (!posts.length) {
      html += '<div style="padding:28px 22px;color:var(--color-text-tertiary);font-size:14px;">Nincs bejegyzés. ' +
        '<a href="#" data-new style="color:var(--color-accent)">Írj egyet →</a></div>';
    } else {
      posts.slice(0, 5).forEach(function (p) {
        html += '<div class="mini-row" data-edit="' + p.id + '">' +
          '<span class="mini-row__dot"></span>' +
          '<div class="mini-row__main"><div class="mini-row__title">' + esc(p.title || '(cím nélkül)') + '</div>' +
          '<div class="mini-row__meta">' + (p.status === 'published' ? 'Megjelent' : 'Piszkozat') +
          (p.category ? ' · ' + esc(CATS[p.category] || p.category) : '') + '</div></div>' +
          '<span class="mini-row__time">' + timeAgo(p.updated_at || p.created_at) + '</span></div>';
      });
    }
    html += '</div></div></div>';
    v.innerHTML = html;

    el('topActions').innerHTML = '<button class="ad-act ad-act--primary" data-new>＋ Új bejegyzés</button>';
    el('topActions').querySelector('[data-new]').addEventListener('click', newPost);

    $all('[data-go]', v).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); setView(a.dataset.go); }); });
    $all('[data-inq]', v).forEach(function (r) { r.addEventListener('click', function () { setView('inquiries'); setTimeout(function () { openInquiry(r.dataset.inq); }, 30); }); });
    $all('[data-edit]', v).forEach(function (r) { r.addEventListener('click', function () { openEditor(byId(posts, r.dataset.edit)); }); });
    var nb = v.querySelector('[data-new]'); if (nb) nb.addEventListener('click', function (e) { e.preventDefault(); newPost(); });
  }

  function stat(label, num, sub) {
    return '<div class="stat"><div class="stat__label">' + esc(label) + '</div>' +
      '<div class="stat__num">' + num + '</div><div class="stat__sub">' + sub + '</div></div>';
  }

  /* =========================================================
     Inquiries
     ========================================================= */
  function renderInquiries() {
    var v = el('view');
    var counts = { all: inquiries.length, new: 0, read: 0, replied: 0, archived: 0 };
    inquiries.forEach(function (i) { counts[i.status] = (counts[i.status] || 0) + 1; });

    var html = '<div class="toolbar"><div class="tabs">';
    [['all','Mind'],['new','Új'],['read','Olvasott'],['replied','Megválaszolt'],['archived','Archivált']].forEach(function (t) {
      html += '<button class="tab ' + (inqFilter === t[0] ? 'is-active' : '') + '" data-tab="' + t[0] + '">' +
        t[1] + ' <span class="tab__count">' + (counts[t[0]] || 0) + '</span></button>';
    });
    html += '</div><div class="search"><input type="text" id="inqSearch" placeholder="Keresés név, cég, e-mail…" value="' + esc(inqSearch) + '"></div></div>';

    var list = inquiries.filter(function (i) {
      if (inqFilter !== 'all' && i.status !== inqFilter) return false;
      if (inqSearch) {
        var hay = (i.name + ' ' + i.company + ' ' + i.email + ' ' + i.message + ' ' + (i.budget || '')).toLowerCase();
        if (hay.indexOf(inqSearch.toLowerCase()) === -1) return false;
      }
      return true;
    });

    if (!list.length) {
      html += '<div class="empty"><div class="empty__ico">✦</div><h3>Nincs megjeleníthető megkeresés</h3>' +
        '<p>' + (DB.isLocal
          ? 'Helyi módban: töltsd ki a <a href="contact.html" target="_blank" style="color:var(--color-accent)">Brief-oldalt</a> — az adatok ide kerülnek.'
          : 'Amikor valaki kitölti a Brief-et a weboldalon, itt jelenik meg.') + '</p></div>';
    } else {
      html += '<div class="inq-list">';
      list.forEach(function (i) {
        html += '<div class="inq-row ' + (i.status === 'new' ? 'is-new' : '') + '" data-inq="' + i.id + '">' +
          '<span class="inq-row__dot"></span>' +
          '<div><div class="inq-row__name">' + esc(i.name || 'Névtelen') + '</div>' +
          '<div class="inq-row__sub">' + esc(i.company || i.email || '') + '</div></div>' +
          '<div class="inq-row__excerpt">' + esc(summary(i)) + '</div>' +
          '<div class="inq-row__time">' + timeAgo(i.created_at) +
          (i.status !== 'new' ? '<br><span class="pill pill--' + i.status + '" style="margin-top:6px;display:inline-block">' +
            esc(STATUS_LABEL[i.status] || i.status) + '</span>' : '') + '</div></div>';
      });
      html += '</div>';
    }
    v.innerHTML = html;

    $all('[data-tab]', v).forEach(function (b) { b.addEventListener('click', function () { inqFilter = b.dataset.tab; renderInquiries(); }); });
    var s = el('inqSearch');
    if (s) s.addEventListener('input', function () {
      inqSearch = s.value;
      var pos = s.selectionStart;
      renderInquiries();
      var ns = el('inqSearch'); if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch(e) {} }
    });
    $all('[data-inq]', v).forEach(function (r) { r.addEventListener('click', function () { openInquiry(r.dataset.inq); }); });
  }

  function summary(i) {
    if (i.message) return i.message;
    var parts = [];
    if (i.bottleneck && i.bottleneck.length) parts.push(i.bottleneck.join(', '));
    if (i.budget) parts.push(i.budget);
    return parts.join(' · ') || '—';
  }

  function openInquiry(id) {
    var i = byId(inquiries, id);
    if (!i) return;
    if (i.status === 'new') {
      i.status = 'read';
      DB.updateInquiry(i.id, { status: 'read' });
      updateBadges();
    }

    var d = document.createElement('div');
    d.className = 'drawer';
    function row(k, val) { if (!val || (Array.isArray(val) && !val.length)) return ''; return '<div class="kv__row"><div class="kv__k">' + esc(k) + '</div><div class="kv__v">' + val + '</div></div>'; }
    function chips(arr) { if (!arr || !arr.length) return ''; return '<div class="chips">' + arr.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') + '</div>'; }

    var rows = '';
    rows += row('Beérkezett', esc(fmtDate(i.created_at)) + ' · ' + timeAgo(i.created_at));
    rows += row('Állapot', '<span class="pill pill--' + i.status + '">' + esc(STATUS_LABEL[i.status] || i.status) + '</span>');
    rows += row('Cég', esc(i.company));
    rows += row('Telefon', i.phone ? '<a href="tel:' + esc(i.phone) + '" style="color:var(--color-accent)">' + esc(i.phone) + '</a>' : '');
    rows += row('Szűk keresztmetszet', chips(i.bottleneck));
    rows += row('Válaszidő', esc(i.response_speed));
    rows += row('Eszközök', chips(i.tools));
    rows += row('Keret', esc(i.budget));
    rows += row('Üzenet', i.message ? esc(i.message).replace(/\n/g, '<br>') : '');
    rows += row('Nyelv / forrás', esc((i.lang || 'hu').toUpperCase() + ' · ' + (i.source || 'contact-brief')));

    d.innerHTML =
      '<div class="drawer__scrim"></div>' +
      '<div class="drawer__panel">' +
        '<button class="drawer__close" aria-label="Bezárás">✕</button>' +
        '<h2>' + esc(i.name || 'Névtelen érdeklődő') + '</h2>' +
        '<div class="drawer__meta">' + (i.email ? '<a href="mailto:' + esc(i.email) + '">' + esc(i.email) + '</a>' : 'Nincs e-mail') + '</div>' +
        '<div class="drawer__actions">' +
          (i.email ? '<a class="ad-act ad-act--primary" href="' + mailtoReply(i) + '">✉ Válasz</a>' : '') +
          '<button class="ad-act" data-st="replied">✓ Megválaszolt</button>' +
          '<button class="ad-act" data-st="archived">⌂ Archiválás</button>' +
          '<button class="ad-act ad-act--danger" data-del>🗑 Törlés</button>' +
        '</div>' +
        '<div class="kv">' + rows + '</div>' +
      '</div>';
    document.body.appendChild(d);

    function close() {
      d.remove();
      if (view === 'inquiries' || view === 'dashboard') render();
    }
    $('.drawer__scrim', d).addEventListener('click', close);
    $('.drawer__close', d).addEventListener('click', close);
    document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } });
    $all('[data-st]', d).forEach(function (b) {
      b.addEventListener('click', function () {
        i.status = b.dataset.st;
        DB.updateInquiry(i.id, { status: b.dataset.st });
        updateBadges();
        toast('Állapot frissítve.', 'ok');
        close();
      });
    });
    $('[data-del]', d).addEventListener('click', function () {
      if (!confirm('Biztosan törlöd? Ez nem vonható vissza.')) return;
      DB.deleteInquiry(i.id).then(function () {
        inquiries = inquiries.filter(function (x) { return x.id !== i.id; });
        updateBadges(); close(); toast('Megkeresés törölve.');
      }).catch(function (e) { toast('Törlés sikertelen: ' + (e && e.message || e), 'err'); });
    });
  }

  function mailtoReply(i) {
    return 'mailto:' + encodeURIComponent(i.email) +
      '?subject=' + encodeURIComponent('Re: Megkeresés — Compass Systems') +
      '&body=' + encodeURIComponent('Kedves ' + (i.name || '') + ',\n\nKöszönjük a megkeresést.\n\n');
  }

  /* =========================================================
     Blog — list
     ========================================================= */
  function renderBlog() {
    var v = el('view');
    el('topActions').innerHTML = '<button class="ad-act ad-act--primary" data-new>＋ Új bejegyzés</button>';
    el('topActions').querySelector('[data-new]').addEventListener('click', newPost);

    if (!posts.length) {
      v.innerHTML = '<div class="empty"><div class="empty__ico">✎</div><h3>Még nincs bejegyzés</h3>' +
        '<p>Írd meg az első cikket. Megjelenés után automatikusan megjelenik a nyilvános blogon.</p>' +
        '<button class="ad-act ad-act--primary" data-new style="margin-top:18px">＋ Új bejegyzés</button></div>';
      v.querySelector('[data-new]').addEventListener('click', newPost);
      return;
    }

    var html = '<div class="post-grid">';
    posts.forEach(function (p) {
      html += '<div class="post-card" data-edit="' + p.id + '">' +
        '<div class="post-card__cover ' + (p.cover_url ? '' : 'post-card__cover--empty') + '">' +
          (p.cover_url ? '<img src="' + esc(p.cover_url) + '" alt="" loading="lazy">' : 'Nincs borítókép') +
          '<span class="post-card__status"><span class="pill pill--' + (p.status === 'published' ? 'published' : 'draft') + '">' +
          (p.status === 'published' ? 'Megjelent' : 'Piszkozat') + '</span></span>' +
        '</div>' +
        '<div class="post-card__body">' +
          '<span class="post-card__kicker">' + esc(CATS[p.category] || p.category || 'Általános') + ' · ' + esc((p.lang || 'hu').toUpperCase()) + '</span>' +
          '<div class="post-card__title">' + esc(p.title || '(cím nélkül)') + '</div>' +
          '<div class="post-card__foot"><span>' + (p.status === 'published' ? fmtDate(p.published_at || p.created_at) : 'szerk.: ' + timeAgo(p.updated_at)) + '</span>' +
          '<span>' + (p.read_minutes || readMinutes(p.body)) + ' perc</span></div>' +
        '</div></div>';
    });
    html += '</div>';
    v.innerHTML = html;
    $all('[data-edit]', v).forEach(function (c) { c.addEventListener('click', function () { openEditor(byId(posts, c.dataset.edit)); }); });
  }

  function newPost() { openEditor(null); }

  /* =========================================================
     Blog — editor
     ========================================================= */
  function openEditor(post) {
    editing = post ? JSON.parse(JSON.stringify(post)) : {
      id: null, title: '', slug: '', excerpt: '', body: '', cover_url: '',
      category: 'operations', tags: [], status: 'draft', lang: 'hu',
      featured: false, author: 'Compass Systems'
    };
    setView('editor');
  }

  function renderEditor() {
    var p = editing;
    var v = el('view');

    el('topActions').innerHTML =
      '<button class="ad-act" data-back>← Vissza</button>' +
      (p.id ? '<button class="ad-act ad-act--danger" data-del>Törlés</button>' : '') +
      '<button class="ad-act" data-save="draft">Piszkozat mentése</button>' +
      '<button class="ad-act ad-act--primary" data-save="published">' + (p.status === 'published' ? 'Frissítés' : 'Megjelentetés') + '</button>';

    var html = '<div class="editor"><div class="editor__form">';
    html += '<input class="title-input" id="eTitle" placeholder="A bejegyzés címe…" value="' + esc(p.title) + '">';
    html += '<div class="slug-line"><span>/blog-post.html?slug=</span><input id="eSlug" value="' + esc(p.slug) + '" placeholder="url-barat-cim"></div>';

    /* cover */
    html += '<div class="field"><span class="field__label">Borítókép' + (DB.isLocal ? ' <span style="color:var(--color-text-tertiary);font-weight:normal">(helyi: max ~400 KB)</span>' : '') + '</span>' +
      '<div class="dropzone" id="eDrop">' +
        (p.cover_url ? '<img id="eCoverImg" src="' + esc(p.cover_url) + '" alt="">' : '') +
        '<div class="dropzone__hint" id="eDropHint"' + (p.cover_url ? ' hidden' : '') + '><b>Húzd ide</b> a képet vagy kattints — JPG/PNG/WebP</div>' +
        '<div class="dropzone__overlay"><span>Csere / feltöltés</span></div>' +
        '<div class="dropzone__progress" id="eProg"></div>' +
      '</div>' +
      '<input type="file" id="eCoverFile" accept="image/*" hidden></div>';

    /* meta */
    html += '<div class="editor__row">' +
      '<label class="field"><span class="field__label">Kategória</span><select class="field__select" id="eCat">' +
        Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (p.category === k ? ' selected' : '') + '>' + CATS[k] + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span class="field__label">Nyelv</span><select class="field__select" id="eLang">' +
        '<option value="hu"' + (p.lang === 'hu' ? ' selected' : '') + '>Magyar (blog.html)</option>' +
        '<option value="en"' + (p.lang === 'en' ? ' selected' : '') + '>English (blog-en.html)</option>' +
      '</select></label></div>';

    html += '<label class="field"><span class="field__label">Bevezető / kivonat</span>' +
      '<textarea class="field__area" id="eExcerpt" placeholder="1–2 mondat.">' + esc(p.excerpt) + '</textarea></label>';

    html += '<div class="field"><span class="field__label">Címkék</span><div class="taginput" id="eTags"><input type="text" id="eTagInput" placeholder="Címke + Enter"></div></div>';
    html += '<label class="toggle"><input type="checkbox" id="eFeatured"' + (p.featured ? ' checked' : '') + '> Kiemelt cikk (a blog tetején jelenik meg)</label>';

    /* body */
    html += '<div class="field"><span class="field__label">Tartalom</span><div class="rte"><div class="rte__bar" id="eBar">' +
      rteBtn('h2','H2','Cím 2') + rteBtn('h3','H3','Cím 3') + rteBtn('p','¶','Bekezdés') +
      '<span class="rte__sep"></span>' +
      rteBtn('bold','<b>B</b>','Félkövér') + rteBtn('italic','<i>I</i>','Dőlt') +
      '<span class="rte__sep"></span>' +
      rteBtn('ul','• —','Felsorolás') + rteBtn('ol','1.','Számozott') + rteBtn('quote','❝','Idézet') +
      '<span class="rte__sep"></span>' +
      rteBtn('link','🔗','Hivatkozás') + rteBtn('image','🖼','Kép URL') + rteBtn('clear','⌫','Formázás törlése') +
    '</div>' +
    '<div class="rte__area" id="eBody" contenteditable="true" data-placeholder="Kezdj el írni…">' + (p.body || '') + '</div></div></div>';

    html += '</div>'; /* /form */

    /* preview */
    html += '<div class="editor__preview"><span class="preview-label">/ Élő előnézet</span>' +
      '<div class="preview-card">' +
        '<div class="preview-card__cover" id="pvCover">' + (p.cover_url ? '<img src="' + esc(p.cover_url) + '">' : '') + '</div>' +
        '<div class="preview-card__body">' +
          '<span class="preview-card__kicker" id="pvKicker"></span>' +
          '<h1 class="preview-card__title" id="pvTitle"></h1>' +
          '<p class="preview-card__excerpt" id="pvExcerpt"></p>' +
          '<div class="preview-card__content" id="pvContent"></div>' +
        '</div></div></div>';

    html += '</div>'; /* /editor */
    v.innerHTML = html;

    bindEditor();
    renderTags();
    syncPreview();
  }

  function rteBtn(cmd, label, title) {
    return '<button class="rte__btn" data-cmd="' + cmd + '" title="' + title + '" type="button">' + label + '</button>';
  }

  function bindEditor() {
    el('topActions').querySelector('[data-back]').addEventListener('click', function () { setView('blog'); });
    var delBtn = el('topActions').querySelector('[data-del]');
    if (delBtn) delBtn.addEventListener('click', deletePost);
    $all('[data-save]', el('topActions')).forEach(function (b) { b.addEventListener('click', function () { savePost(b.dataset.save); }); });

    el('eTitle').addEventListener('input', function () {
      editing.title = el('eTitle').value;
      if (!editing.id && !el('eSlug').dataset.touched) { el('eSlug').value = slugify(editing.title); editing.slug = el('eSlug').value; }
      syncPreview();
    });
    el('eSlug').addEventListener('input', function () { el('eSlug').dataset.touched = '1'; editing.slug = slugify(el('eSlug').value); el('eSlug').value = editing.slug; });
    el('eExcerpt').addEventListener('input', function () { editing.excerpt = el('eExcerpt').value; syncPreview(); });
    el('eCat').addEventListener('change', function () { editing.category = el('eCat').value; syncPreview(); });
    el('eLang').addEventListener('change', function () { editing.lang = el('eLang').value; });
    el('eFeatured').addEventListener('change', function () { editing.featured = el('eFeatured').checked; });

    var body = el('eBody');
    body.addEventListener('input', function () { editing.body = body.innerHTML; syncPreview(); });
    el('eBar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmd]'); if (!b) return;
      e.preventDefault(); body.focus();
      rteExec(b.dataset.cmd);
      editing.body = body.innerHTML; syncPreview();
    });

    el('eTagInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        var val = el('eTagInput').value.trim().replace(/,$/,'');
        if (val && editing.tags.indexOf(val) === -1) { editing.tags.push(val); el('eTagInput').value = ''; renderTags(); }
      } else if (e.key === 'Backspace' && !el('eTagInput').value && editing.tags.length) {
        editing.tags.pop(); renderTags();
      }
    });

    /* cover drop/pick */
    var drop = el('eDrop'), fileInput = el('eCoverFile');
    drop.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { if (fileInput.files[0]) handleCover(fileInput.files[0]); });
    ['dragenter','dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-drag'); }); });
    ['dragleave','drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-drag'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) handleCover(f); });
  }

  function rteExec(cmd) {
    if (cmd === 'h2')    document.execCommand('formatBlock', false, 'h2');
    else if (cmd === 'h3')    document.execCommand('formatBlock', false, 'h3');
    else if (cmd === 'p')     document.execCommand('formatBlock', false, 'p');
    else if (cmd === 'bold')  document.execCommand('bold');
    else if (cmd === 'italic')document.execCommand('italic');
    else if (cmd === 'ul')    document.execCommand('insertUnorderedList');
    else if (cmd === 'ol')    document.execCommand('insertOrderedList');
    else if (cmd === 'quote') document.execCommand('formatBlock', false, 'blockquote');
    else if (cmd === 'clear') document.execCommand('removeFormat');
    else if (cmd === 'link')  { var url = prompt('Hivatkozás URL-je:', 'https://'); if (url) document.execCommand('createLink', false, url); }
    else if (cmd === 'image') { var iurl = prompt('Kép URL-je:', 'https://'); if (iurl) document.execCommand('insertImage', false, iurl); }
  }

  function renderTags() {
    var box = el('eTags');
    $all('.chip', box).forEach(function (c) { c.remove(); });
    var input = el('eTagInput');
    editing.tags.forEach(function (t, idx) {
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = esc(t) + ' <button type="button" aria-label="Eltávolítás">✕</button>';
      chip.querySelector('button').addEventListener('click', function () { editing.tags.splice(idx, 1); renderTags(); });
      box.insertBefore(chip, input);
    });
  }

  function handleCover(file) {
    if (!/^image\//.test(file.type)) { toast('Csak képfájl tölthető fel.', 'err'); return; }
    var prog = el('eProg'); prog.style.width = '30%';
    DB.uploadCover(file).then(function (res) {
      prog.style.width = '0';
      if (res.error) { toast(res.error, 'err'); return; }
      editing.cover_url = res.url;
      var drop = el('eDrop');
      var img  = el('eCoverImg');
      if (!img) { img = document.createElement('img'); img.id = 'eCoverImg'; drop.insertBefore(img, drop.firstChild); }
      img.src = editing.cover_url;
      var hint = el('eDropHint'); if (hint) hint.hidden = true;
      syncPreview();
      toast('Borítókép betöltve.', 'ok');
    });
  }

  function syncPreview() {
    el('pvKicker').textContent  = (CATS[editing.category] || '') + ' · ' + (editing.lang || 'hu').toUpperCase();
    el('pvTitle').textContent   = editing.title || 'A bejegyzés címe';
    el('pvExcerpt').textContent = editing.excerpt || '';
    el('pvContent').innerHTML   = editing.body || '<p style="color:var(--color-text-tertiary)">A tartalom itt jelenik meg…</p>';
    var cov = el('pvCover');
    cov.innerHTML = editing.cover_url ? '<img src="' + esc(editing.cover_url) + '">' : '';
  }

  function savePost(status) {
    var p = editing;
    p.title    = el('eTitle').value.trim();
    p.slug     = slugify(el('eSlug').value || p.title);
    p.excerpt  = el('eExcerpt').value.trim();
    p.body     = el('eBody').innerHTML;
    p.category = el('eCat').value;
    p.lang     = el('eLang').value;
    p.featured = el('eFeatured').checked;

    if (!p.title) { toast('Adj címet a bejegyzésnek.', 'err'); el('eTitle').focus(); return; }
    if (!p.slug)  { toast('Az URL-barát cím (slug) nem lehet üres.', 'err'); return; }

    /* check slug uniqueness (only for new posts or if slug changed) */
    var slugConflict = posts.some(function (x) { return x.slug === p.slug && x.id !== p.id; });
    if (slugConflict) { toast('Ez az URL-cím (slug) már foglalt — válassz másikat.', 'err'); return; }

    var row = {
      id:           p.id || null,
      title:        p.title,
      slug:         p.slug,
      excerpt:      p.excerpt,
      body:         p.body,
      cover_url:    p.cover_url || null,
      category:     p.category,
      tags:         p.tags || [],
      lang:         p.lang,
      featured:     p.featured,
      status:       status,
      author:       p.author || 'Compass Systems',
      read_minutes: readMinutes(p.body),
      published_at: (status === 'published' && !p.published_at) ? new Date().toISOString() : (p.published_at || null)
    };

    $all('[data-save]', el('topActions')).forEach(function (b) { b.disabled = true; });

    DB.upsertPost(row).then(function (saved) {
      $all('[data-save]', el('topActions')).forEach(function (b) { b.disabled = false; });
      var idx = posts.findIndex ? posts.findIndex(function (x) { return x.id === saved.id; }) : -1;
      if (idx > -1) posts[idx] = saved; else posts.unshift(saved);
      editing = JSON.parse(JSON.stringify(saved));
      toast(status === 'published' ? 'Megjelent — élesben a blogon.' : 'Piszkozat mentve.', 'ok');
      setView('blog');
    }).catch(function (e) {
      $all('[data-save]', el('topActions')).forEach(function (b) { b.disabled = false; });
      toast('Mentés sikertelen: ' + (e && e.message || e), 'err');
    });
  }

  function deletePost() {
    if (!editing || !editing.id) return;
    if (!confirm('Biztosan törlöd ezt a bejegyzést? Ez nem vonható vissza.')) return;
    DB.deletePost(editing.id).then(function () {
      posts = posts.filter(function (x) { return x.id !== editing.id; });
      toast('Bejegyzés törölve.'); setView('blog');
    }).catch(function (e) { toast('Törlés sikertelen: ' + (e && e.message || e), 'err'); });
  }

  /* =========================================================
     Settings
     ========================================================= */
  function renderSettings() {
    var v = el('view');
    el('topActions').innerHTML = '';
    var html = '<div class="settings card card--pad-lg">';

    if (DB.isLocal) {
      html += '<div class="setting-row"><div class="setting-row__label">Mód<small>localStorage — adatok ebben a böngészőben tárolódnak</small></div>' +
        '<div class="setting-row__val mono">HELYI MÓD</div></div>';
      html += '<div class="setting-row"><div class="setting-row__label">Supabase csatlakoztatása<small>Töltsd ki a supabase-config.js fájlt a SUPABASE_SETUP.md szerint</small></div>' +
        '<a class="ad-act" href="SUPABASE_SETUP.md" target="_blank">Útmutató ↗</a></div>';
      html += '<div class="setting-row"><div class="setting-row__label">Adatok exportálása<small>Mentsd le a localStorage-adatokat JSON-ként</small></div>' +
        '<button class="ad-act" id="exportBtn">⬇ Exportálás</button></div>';
      html += '<div class="setting-row"><div class="setting-row__label">Adatok importálása<small>Tölts be korábban exportált JSON-t</small></div>' +
        '<label class="ad-act" style="cursor:pointer">⬆ Importálás<input type="file" accept=".json" id="importFile" hidden></label></div>';
    } else {
      html += '<div class="setting-row"><div class="setting-row__label">Mód</div><div class="setting-row__val"><span class="status-dot">Supabase aktív</span></div></div>';
      html += '<div class="setting-row"><div class="setting-row__label">Felhasználó</div><div class="setting-row__val mono">' + esc(user.email) + '</div></div>';
      html += '<div class="setting-row"><div class="setting-row__label">Projekt URL</div><div class="setting-row__val mono">' + esc((C.url || '').replace('https://','')) + '</div></div>';
      html += '<div class="setting-row"><div class="setting-row__label">Új felhasználó</div><a class="ad-act" href="https://app.supabase.com" target="_blank" rel="noopener">Supabase ↗</a></div>';
    }

    html += '</div>';
    html += '<div class="settings" style="margin-top:16px"><button class="ad-act ad-act--ghost" id="setSignOut">Kijelentkezés</button></div>';

    v.innerHTML = html;
    el('setSignOut').addEventListener('click', signOut);

    if (DB.isLocal) {
      el('exportBtn').addEventListener('click', function () {
        var data = {
          exported: new Date().toISOString(),
          posts:     JSON.parse(localStorage.getItem(POSTS_KEY) || '[]'),
          inquiries: JSON.parse(localStorage.getItem(INQ_KEY)   || '[]')
        };
        var a = document.createElement('a');
        a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data, null, 2));
        a.download = 'compass-admin-export-' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        toast('Export letöltve.', 'ok');
      });

      el('importFile').addEventListener('change', function () {
        var f = this.files[0]; if (!f) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var data = JSON.parse(e.target.result);
            if (!confirm('Felülírja a meglévő adatokat? Ez nem vonható vissza.')) return;
            if (data.posts)     localStorage.setItem(POSTS_KEY, JSON.stringify(data.posts));
            if (data.inquiries) localStorage.setItem(INQ_KEY,   JSON.stringify(data.inquiries));
            toast('Import kész — újratöltés…', 'ok');
            setTimeout(function () { location.reload(); }, 1200);
          } catch(err) { toast('Érvénytelen JSON fájl.', 'err'); }
        };
        reader.readAsText(f);
      });
    }
  }

  /* ---------- util ---------- */
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  /* ---------- go ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
