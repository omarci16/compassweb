/* =========================================================
   Compass Systems — public Supabase data layer
   ---------------------------------------------------------
   Tiny dependency-free PostgREST wrapper for the PUBLIC site:
     • CompassDB.submitInquiry(payload)  → contact brief
     • CompassDB.listPosts({lang,category,limit})
     • CompassDB.getPost(slug)
   The admin (admin.js) uses the full Supabase SDK instead.
   Anon key only permits: INSERT inquiries + SELECT published posts
   (enforced by Row Level Security — see SUPABASE_SETUP.md).
   ========================================================= */
window.CompassDB = (function () {
  var C = window.COMPASS_SUPABASE || {};
  var ready = !!C.ready;
  var base = ready ? C.url.replace(/\/$/, '') + '/rest/v1' : '';

  function headers(extra) {
    var h = {
      'apikey': C.anonKey,
      'Authorization': 'Bearer ' + C.anonKey,
      'Content-Type': 'application/json'
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function req(path, opts) {
    if (!ready) return Promise.reject(new Error('Supabase not configured'));
    return fetch(base + path, opts).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); });
      var ct = r.headers.get('content-type') || '';
      return ct.indexOf('application/json') > -1 ? r.json() : null;
    });
  }

  return {
    ready: ready,

    /* Insert a contact-brief inquiry. */
    submitInquiry: function (payload) {
      return req('/inquiries', {
        method: 'POST',
        headers: headers({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify(payload)
      });
    },

    /* Published posts, newest first. */
    listPosts: function (o) {
      o = o || {};
      var q = ['status=eq.published', 'select=*', 'order=published_at.desc.nullslast'];
      if (o.lang) q.push('lang=eq.' + encodeURIComponent(o.lang));
      if (o.category && o.category !== 'all') q.push('category=eq.' + encodeURIComponent(o.category));
      if (o.limit) q.push('limit=' + o.limit);
      return req('/posts?' + q.join('&'), { method: 'GET', headers: headers() });
    },

    /* Single published post by slug. */
    getPost: function (slug) {
      var q = 'slug=eq.' + encodeURIComponent(slug) + '&status=eq.published&select=*&limit=1';
      return req('/posts?' + q, { method: 'GET', headers: headers() })
        .then(function (rows) { return rows && rows[0] ? rows[0] : null; });
    }
  };
})();
