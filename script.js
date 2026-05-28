/* =========================================================
   Compass Systems — interactions
   ========================================================= */

(() => {
  // Smooth scroll (Lenis) — weighted glide with a touch of momentum, the way
  // high-end editorial sites feel. Lenis drives the *real* native scroll
  // position, so the sticky nav, IntersectionObserver reveals and stat counters
  // below keep working untouched. Bails for reduced-motion and if the lib is
  // missing, leaving the CSS native scroll as the graceful fallback.
  let lenis = null;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.Lenis && !prefersReducedMotion) {
    lenis = new Lenis({
      lerp: 0.09,            // weight: position eases toward target each frame
      wheelMultiplier: 1,
      smoothWheel: true,     // touch left native — mobile momentum already feels right
    });

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // In-page anchor links glide instead of snapping; bare "#" placeholders and
    // links to missing targets fall through to default behaviour.
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80 });
    });
  }

  // Sticky nav background on scroll
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 12) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
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
      <svg data-icon="hamburger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
      <svg data-icon="close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 6l12 12M6 18L18 6"/></svg>
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
      if (lenis) lenis.stop();
    };
    const close = () => {
      document.body.classList.remove('menu-open');
      navToggle.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', labelOpen);
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      if (lenis) lenis.start();
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
})();
