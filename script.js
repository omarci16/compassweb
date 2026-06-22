/* =========================================================
   Compass Systems — interactions
   ========================================================= */

(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sticky nav: background on scroll + hide-on-down / show-on-up
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      const y = window.scrollY;

      // Frosted background once past the top
      nav.classList.toggle('scrolled', y > 12);

      // Hide/show — only engage after scrolling 100px; never hide when mobile menu is open
      const isMobileNav = window.matchMedia('(max-width: 900px)').matches;
      if (y > 100 && !isMobileNav && !document.body.classList.contains('menu-open')) {
        if (y > lastY + 8) {
          nav.classList.add('nav--hidden');
        } else if (y < lastY - 4) {
          nav.classList.remove('nav--hidden');
        }
      } else {
        nav.classList.remove('nav--hidden');
      }

      lastY = y;
      ticking = false;
    };

    document.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();
  }

  // Reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          const delay = parseInt(e.target.dataset.delay || (i * 50), 10);
          setTimeout(() => e.target.classList.add('in'), delay);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  // Stat counters
  const stats = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && stats.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseFloat(el.dataset.count);
          const decimals = parseInt(el.dataset.decimals || 0, 10);
          const duration = 1600;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = target * eased;
            el.textContent = val.toFixed(decimals);
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    stats.forEach(s => io.observe(s));
  }

  // Journey timeline progress animation
  const journeys = document.querySelectorAll('.journey');
  if ('IntersectionObserver' in window && journeys.length) {
    const jo = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const steps = e.target.querySelectorAll('.journey__step');
          steps.forEach((s, i) => setTimeout(() => s.classList.add('active'), 220 + i * 420));
          jo.unobserve(e.target);
        }
      });
    }, { threshold: 0.35 });
    journeys.forEach(j => jo.observe(j));
  } else {
    journeys.forEach(j => j.querySelectorAll('.journey__step').forEach(s => s.classList.add('active')));
  }

  // FAQ accordion — spring-eased, measured-height animation
  document.querySelectorAll('.faq__q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq__item');
      const answer = item.querySelector('.faq__a');
      const isOpen = item.classList.contains('open');

      if (isOpen) {
        // Collapse: pin at current rendered height, then animate to 0
        answer.style.height = answer.scrollHeight + 'px';
        answer.getBoundingClientRect(); // force reflow
        answer.style.height = '0';
        item.classList.remove('open');
      } else {
        // Expand: measure target height, animate from 0 to it
        item.classList.add('open');
        const targetH = answer.scrollHeight;
        answer.style.height = '0';
        answer.getBoundingClientRect(); // force reflow
        answer.style.height = targetH + 'px';
        // Release to 'auto' once done so the panel reflows on resize
        answer.addEventListener('transitionend', function release(e) {
          if (e.propertyName === 'height' && item.classList.contains('open')) {
            answer.style.height = 'auto';
          }
          answer.removeEventListener('transitionend', release);
        });
      }
    });
  });

  // Filter buttons (work page) — visual only
  document.querySelectorAll('[data-filter-group]').forEach(group => {
    const filters = group.querySelectorAll('.filter');
    filters.forEach(f => {
      f.addEventListener('click', () => {
        filters.forEach(x => x.classList.remove('active'));
        f.classList.add('active');
        const tag = f.dataset.filter;
        const targetGroup = document.querySelector(`[data-filter-target="${group.dataset.filterGroup}"]`);
        if (!targetGroup) return;
        targetGroup.querySelectorAll('[data-tags]').forEach(card => {
          const tags = card.dataset.tags.split(' ');
          card.style.display = (tag === 'all' || tags.includes(tag)) ? '' : 'none';
        });
      });
    });
  });

  // Brief stepper
  const brief = document.getElementById('brief');
  if (brief) {
    const steps = brief.querySelectorAll('.brief__step');
    const dots = brief.querySelectorAll('.brief__dot');
    let current = 0;
    const show = (i) => {
      steps.forEach((s, idx) => s.classList.toggle('active', idx === i));
      dots.forEach((d, idx) => d.classList.toggle('active', idx <= i));
      current = i;
    };
    brief.addEventListener('click', (e) => {
      const next = e.target.closest('[data-brief-next]');
      const prev = e.target.closest('[data-brief-prev]');
      const opt = e.target.closest('.brief__option');
      if (next) {
        if (current < steps.length - 1) show(current + 1);
      }
      if (prev) {
        if (current > 0) show(current - 1);
      }
      if (opt) {
        const multi = opt.closest('[data-multi]');
        if (multi) {
          opt.classList.toggle('selected');
        } else {
          opt.parentElement.querySelectorAll('.brief__option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
        }
      }
    });
    show(0);

    // ----- Submit: collect the structured answers and send to Supabase -----
    const EN = (document.documentElement.lang || 'hu').toLowerCase().indexOf('en') === 0;
    const submitBtn = steps[steps.length - 1].querySelector('.btn--primary');
    const picked = (step) => Array.from(step.querySelectorAll('.brief__option.selected')).map(o => o.textContent.trim());

    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const last = steps[steps.length - 1];
        const val = (sel) => { const f = last.querySelector(sel); return f ? f.value.trim() : ''; };
        const payload = {
          name: val('input[type="text"]'),
          company: (last.querySelectorAll('input[type="text"]')[1] || {}).value || '',
          email: val('input[type="email"]'),
          phone: val('input[type="tel"]'),
          message: val('textarea'),
          bottleneck: picked(steps[0]),
          response_speed: (picked(steps[1])[0] || ''),
          tools: picked(steps[2]),
          budget: (picked(steps[3])[0] || ''),
          lang: EN ? 'en' : 'hu',
          source: 'contact-brief'
        };
        payload.company = (payload.company || '').trim();

        if (!payload.email || !/.+@.+\..+/.test(payload.email)) {
          alert(EN ? 'Please enter a valid email so we can reply.' : 'Adj meg egy érvényes e-mail-címet, hogy válaszolni tudjunk.');
          return;
        }

        const done = (ok) => {
          const T = EN
            ? { h: 'Thank you — your brief is in.', p: 'We reply within 1 business day with a real plan and a real price.', b: '← Back to home' }
            : { h: 'Köszönjük — megkaptuk a briefet.', p: 'Egy munkanapon belül jelentkezünk valódi tervvel és valódi árral.', b: '← Vissza a főoldalra' };
          brief.innerHTML =
            '<div style="text-align:center;padding:48px 24px;">' +
            '<div style="width:54px;height:54px;border-radius:50%;border:1px solid var(--color-accent);display:grid;place-items:center;margin:0 auto 22px;font-size:24px;color:var(--color-accent);">✓</div>' +
            '<h2 style="font-weight:500;margin:0 0 10px;">' + T.h + '</h2>' +
            '<p class="text-secondary" style="max-width:420px;margin:0 auto;">' + T.p + '</p>' +
            '<a href="index.html" class="btn btn--secondary" style="margin-top:28px;">' + T.b + '</a></div>';
          window.scrollTo({ top: brief.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
        };

        const mailtoFallback = () => {
          const lines = [
            'Brief — Compass Systems', '',
            'Név: ' + payload.name, 'Cég: ' + payload.company,
            'E-mail: ' + payload.email, 'Telefon: ' + payload.phone, '',
            'Szűk keresztmetszet: ' + payload.bottleneck.join(', '),
            'Válaszidő: ' + payload.response_speed,
            'Eszközök: ' + payload.tools.join(', '),
            'Keret: ' + payload.budget, '', 'Üzenet:', payload.message
          ];
          window.location.href = 'mailto:info@compassmarketing.hu?subject=' +
            encodeURIComponent('Brief — ' + (payload.name || payload.email)) +
            '&body=' + encodeURIComponent(lines.join('\n'));
        };

        const label = submitBtn.innerHTML;
        submitBtn.style.pointerEvents = 'none';
        submitBtn.innerHTML = EN ? 'Sending…' : 'Küldés…';

        /* Always save to localStorage so the admin can see it (same-device / local mode). */
        const saveLocal = () => {
          try {
            const KEY = 'compass_admin_inquiries_v1';
            const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
            arr.unshift(Object.assign({
              id: Math.random().toString(36).slice(2,11) + '-' + Date.now(),
              created_at: new Date().toISOString(),
              status: 'new'
            }, payload));
            localStorage.setItem(KEY, JSON.stringify(arr));
          } catch(e) {}
        };

        if (window.CompassDB && window.CompassDB.ready) {
          window.CompassDB.submitInquiry(payload)
            .then(() => { saveLocal(); done(true); })
            .catch(() => { submitBtn.style.pointerEvents = ''; submitBtn.innerHTML = label; saveLocal(); mailtoFallback(); });
        } else {
          saveLocal();
          mailtoFallback();
          submitBtn.style.pointerEvents = ''; submitBtn.innerHTML = label;
        }
      });
    }
  }

  // Pinned mobile logo — a direct body child with its own position:fixed so it
  // is never affected by nav containment, overflow, or iOS stacking-context bugs.
  {
    const navLogo = document.querySelector('.nav .logo');
    if (navLogo) {
      const pin = document.createElement('a');
      pin.className = 'mobile-logo-pin';
      pin.href = navLogo.getAttribute('href') || 'index.html';
      pin.setAttribute('aria-label', 'Compass Systems');
      const img = document.createElement('img');
      img.src = 'assets/logo.png';
      img.alt = 'Compass Systems';
      pin.appendChild(img);
      document.body.insertBefore(pin, document.body.firstChild);
    }
  }

  // Mobile menu — JS-built overlay so we don't have to touch every HTML page.
  // Reuses the existing .nav__links, .lang-switch, and primary .btn from the nav
  // so HU/EN copy stays in sync automatically.
  const navEl = document.querySelector('.nav');
  // Inject the hamburger toggle if a page is missing it (most interior pages do).
  let navToggle = navEl && navEl.querySelector('.nav__toggle');
  if (navEl && !navToggle) {
    const ctaContainer = navEl.querySelector('.nav__cta');
    if (ctaContainer) {
      navToggle = document.createElement('button');
      navToggle.className = 'nav__toggle';
      navToggle.type = 'button';
      ctaContainer.appendChild(navToggle);
    }
  }
  if (navEl && navToggle) {
    // Upgrade the toggle: dual icons (hamburger + close) that crossfade on .is-open
    const isHU = (document.documentElement.lang || 'hu').toLowerCase().startsWith('hu');
    const labelOpen = isHU ? 'Menü megnyitása' : 'Open menu';
    const labelClose = isHU ? 'Menü bezárása' : 'Close menu';
    navToggle.setAttribute('aria-label', labelOpen);
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.innerHTML = `
      <svg data-icon="hamburger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true"><path d="M5 8h14M5 16h14"/></svg>
      <svg data-icon="close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M7 17L17 7"/></svg>
    `;

    // Build the mobile menu overlay once and append to <body>.
    const sourceLinks = Array.from(navEl.querySelectorAll('.nav__links a'));
    const primaryCta = navEl.querySelector('.nav__cta .btn--primary');

    const menu = document.createElement('div');
    menu.className = 'mobile-menu';
    menu.setAttribute('aria-hidden', 'true');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', isHU ? 'Mobil menü' : 'Mobile menu');

    const linksHTML = sourceLinks
      .map((a, i) => {
        const num = String(i + 1).padStart(2, '0');
        const href = a.getAttribute('href') || '#';
        const label = a.textContent.trim();
        const isActive = a.classList.contains('active') ? ' is-active' : '';
        return `
          <li class="mobile-menu__item${isActive}" style="--i:${i}">
            <a href="${href}">
              <span class="mobile-menu__num">/ ${num}</span>
              <span class="mobile-menu__label">${label}</span>
            </a>
          </li>`;
      })
      .join('');

    const ctaHTML = primaryCta
      ? `<div class="mobile-menu__cta"><a href="${primaryCta.getAttribute(
          'href'
        ) || '#'}" class="btn btn--primary">${primaryCta.innerHTML}</a></div>`
      : '';

    menu.innerHTML = `
      <div class="mobile-menu__panel">
        <ul class="mobile-menu__links" role="list">
          ${linksHTML}
        </ul>
        ${ctaHTML ? `<div class="mobile-menu__footer">${ctaHTML}</div>` : ''}
      </div>
    `;

    document.body.appendChild(menu);

    const open = () => {
      document.body.classList.add('menu-open');
      navToggle.classList.add('is-open');
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', labelClose);
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
    };
    const close = () => {
      document.body.classList.remove('menu-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', labelOpen);
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
    };

    navToggle.addEventListener('click', () => {
      if (document.body.classList.contains('menu-open')) close();
      else open();
    });

    // Close when any link inside the menu is activated
    menu.addEventListener('click', e => {
      if (e.target.closest('a')) close();
    });

    // Close on ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) close();
    });

    // Auto-close if the viewport grows past the mobile breakpoint
    const mq = window.matchMedia('(min-width: 901px)');
    const onMq = e => {
      if (e.matches && document.body.classList.contains('menu-open')) close();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  // Hero word rotator — animate a single dynamic word in the headline.
  // Container width transitions between word widths so the line never jumps.
  const initRotator = (rot) => {
    const words = Array.from(rot.querySelectorAll('.word-rotator__word'));
    if (words.length < 2) return;
    const interval = parseInt(rot.dataset.interval || '2800', 10);

    let activeIndex = words.findIndex(w => w.classList.contains('is-active'));
    if (activeIndex < 0) activeIndex = 0;
    words.forEach((w, i) => w.classList.toggle('is-active', i === activeIndex));

    let widths = [];
    const measure = () => {
      widths = words.map(w => {
        const prevCss = w.style.cssText;
        w.style.position = 'absolute';
        w.style.opacity = '0';
        w.style.display = 'inline-block';
        w.style.transform = 'none';
        w.style.filter = 'none';
        const width = Math.ceil(w.getBoundingClientRect().width);
        w.style.cssText = prevCss;
        return width;
      });
      rot.style.width = widths[activeIndex] + 'px';
    };

    const start = () => {
      measure();
      rot.classList.add('is-ready');

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
      let timer = null;

      const tick = () => {
        const current = words[activeIndex];
        const nextIndex = (activeIndex + 1) % words.length;
        const next = words[nextIndex];

        current.classList.remove('is-active');
        current.classList.add('is-leaving');
        next.classList.add('is-active');
        activeIndex = nextIndex;
        rot.style.width = widths[nextIndex] + 'px';

        setTimeout(() => current.classList.remove('is-leaving'), 720);
      };

      const startCycle = () => {
        if (timer || reduced.matches) return;
        timer = setInterval(tick, interval);
      };
      const stopCycle = () => {
        if (timer) { clearInterval(timer); timer = null; }
      };

      startCycle();

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopCycle();
        else startCycle();
      });

      let resizeRaf;
      window.addEventListener('resize', () => {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(measure);
      }, { passive: true });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start);
    } else {
      start();
    }
  };
  document.querySelectorAll('[data-rotator]').forEach(initRotator);

  // Problem pinned scroll — the section pins ("takes over" the screen) while the
  // three cards fly in from the right, one after another, and land as a row of
  // three; then the pin releases and the solutions below rise. Driven by the
  // real scroll position via a rAF loop that only runs while the section is
  // near the viewport. Desktop + motion-OK only — mobile and
  // reduced-motion keep the static stacked layout (the .is-pin-active class,
  // which all the pin CSS keys off, is added only here).
  const pinDesktop = window.matchMedia('(min-width: 961px)');

  // Stacked reveal — the hero + dashboard freeze as one backdrop (sticky, pinned
  // so the dashboard is the frozen frame) and the problem section rises over them
  // like a sheet, the frozen hero gently receding via the --cover property
  // (0 → 1 as the sheet covers the viewport). Desktop + motion only.
  document.querySelectorAll('.hero-reveal').forEach((wrap) => {
    const stack = wrap.querySelector('.hero-stack');
    const sheet = wrap.querySelector('.problem-pin');
    if (!stack || !sheet) return;

    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    let active = false;
    let raf = 0;

    // Bottom-pin the (taller-than-viewport) stack: stick with its bottom at the
    // viewport bottom, so the dashboard is the frame that freezes.
    const layout = () => {
      const overflow = stack.offsetHeight - window.innerHeight;
      stack.style.top = overflow > 0 ? -overflow + 'px' : '0px';
    };

    const apply = () => {
      const vh = window.innerHeight;
      const top = sheet.getBoundingClientRect().top; // vh → 0 as the sheet covers
      wrap.style.setProperty('--cover', clamp01((vh - top) / vh).toFixed(4));
    };

    const tick = () => {
      apply();
      raf = active ? requestAnimationFrame(tick) : 0;
    };

    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && pinDesktop.matches && !prefersReducedMotion) {
        if (!active) { active = true; raf = requestAnimationFrame(tick); }
      } else {
        active = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }
    }, { rootMargin: '10% 0px 10% 0px' });

    const setup = () => {
      if (pinDesktop.matches && !prefersReducedMotion) {
        wrap.classList.add('is-stacking');
        layout();
        apply();
        io.observe(wrap);
      } else {
        io.disconnect();
        active = false;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        wrap.classList.remove('is-stacking');
        stack.style.top = '';
        wrap.style.removeProperty('--cover');
      }
    };

    setup();
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (wrap.classList.contains('is-stacking')) layout(); }, 150);
    }, { passive: true });
    if (pinDesktop.addEventListener) pinDesktop.addEventListener('change', setup);
    else if (pinDesktop.addListener) pinDesktop.addListener(setup);
  });
})();
