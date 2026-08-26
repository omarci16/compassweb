/* =========================================================
   Compass Systems — dynamic blog list
   Replaces the static demo cards with real posts.

   Priority:
   1. Supabase (if supabase-config.js is filled in)
   2. localStorage (if admin has created posts on this device)
   3. Static demo content (fallback — nothing is replaced)
   ========================================================= */
(function () {
  var EN   = (document.documentElement.lang || 'hu').toLowerCase().indexOf('en') === 0;
  var lang = EN ? 'en' : 'hu';
  var POSTS_KEY = 'compass_admin_posts_v1';

  var CATS = EN
    ? { websites: 'Websites', marketing: 'Marketing', operations: 'Operations', seo: 'SEO & GEO' }
    : { websites: 'Weboldalak', marketing: 'Marketing', operations: 'Operations', seo: 'SEO & GEO' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDate(d) {
    if (!d) return '';
    var x = new Date(d);
    if (EN) return x.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    var M = ['január','február','március','április','május','június','július',
             'augusztus','szeptember','október','november','december'];
    return x.getFullYear() + '. ' + M[x.getMonth()] + ' ' + x.getDate() + '.';
  }
  function minLabel(n) { return EN ? (n + ' min read') : (n + ' perc'); }
  function href(p) { return 'blog-post.html?slug=' + encodeURIComponent(p.slug); }

  function cover(p, cls) {
    if (p.cover_url) {
      return '<div class="image-placeholder ' + cls + '" style="display:block;position:relative;overflow:hidden">' +
        '<img src="' + esc(p.cover_url) + '" alt="' + esc(p.title) + '" loading="lazy" ' +
        'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>';
    }
    return '<div class="image-placeholder ' + cls + '">' +
      '<div class="image-placeholder__rings" aria-hidden="true"></div>' +
      '<div class="image-placeholder__inner"><span class="image-placeholder__label">' + esc(p.title) + '</span></div></div>';
  }

  function renderPosts(posts) {
    if (!posts || !posts.length) return;

    var featured = null;
    for (var i = 0; i < posts.length; i++) { if (posts[i].featured) { featured = posts[i]; break; } }
    if (!featured) featured = posts[0];
    var rest = posts.filter(function (p) { return p.id !== featured.id; });

    /* Featured card */
    var feat = document.querySelector('.blog-feature');
    if (feat) {
      var fEl = document.createElement('a');
      fEl.className = 'blog-feature reveal in';
      fEl.href = href(featured);
      fEl.innerHTML =
        '<div class="blog-feature__media">' + cover(featured, 'image-placeholder--blog-feature') + '</div>' +
        '<div class="blog-feature__body">' +
          '<div class="blog-feature__meta">' +
            '<span class="badge badge--accent">' + (EN ? 'Featured' : 'Kiemelt') + '</span>' +
            '<span class="badge">' + esc(CATS[featured.category] || featured.category || '') + '</span>' +
          '</div>' +
          '<h3>' + esc(featured.title) + '</h3>' +
          '<p>' + esc(featured.excerpt || '') + '</p>' +
          '<div class="blog-feature__footer">' +
            '<span>' + fmtDate(featured.published_at || featured.created_at) + '</span>' +
            '<span class="text-tertiary mono" style="font-size:11px;letter-spacing:.08em">· ' + minLabel(featured.read_minutes || 4) + '</span>' +
            '<span class="blog-card__link">' + (EN ? 'Read article' : 'Cikk megnyitása') + ' <span>→</span></span>' +
          '</div>' +
        '</div>';
      feat.parentNode.replaceChild(fEl, feat);
    }

    /* Grid */
    var grid = document.querySelector('.blog-preview__grid');
    if (grid) {
      if (!rest.length) { grid.innerHTML = ''; grid.style.display = 'none'; }
      else {
        grid.style.display = '';
        grid.innerHTML = rest.map(function (p) {
          return '<a class="blog-card reveal in" data-tags="' + esc(p.category || '') + '" href="' + href(p) + '">' +
            cover(p, 'image-placeholder--blog-card') +
            '<div class="blog-card__body">' +
              '<span class="blog-card__kicker">' + esc(CATS[p.category] || p.category || '') + '</span>' +
              '<h4>' + esc(p.title) + '</h4>' +
              '<p>' + esc(p.excerpt || '') + '</p>' +
              '<div class="blog-card__footer">' +
                '<span class="blog-card__date">' + fmtDate(p.published_at || p.created_at) + '</span>' +
                '<span class="text-tertiary mono" style="font-size:11px;letter-spacing:.06em">· ' + minLabel(p.read_minutes || 4) + '</span>' +
              '</div>' +
            '</div></a>';
        }).join('');
      }
    }
  }

  /* 1. Supabase */
  var CDB = window.CompassDB;
  if (CDB && CDB.ready) {
    CDB.listPosts({ lang: lang })
      .then(renderPosts)
      .catch(function (e) { console.warn('blog/supabase:', e && e.message); });
    return;
  }

  /* 2. localStorage */
  try {
    var all = JSON.parse(localStorage.getItem(POSTS_KEY) || '[]');
    var pub = all
      .filter(function (p) { return p.status === 'published' && (p.lang || 'hu') === lang; })
      .sort(function (a, b) { return new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at); });
    if (pub.length) { renderPosts(pub); }
  } catch (e) { /* keep static demo content */ }
})();
