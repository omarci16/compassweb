/* =========================================================
   Compass Solutions — interactions
   ========================================================= */

(() => {
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

  // FAQ accordion
  document.querySelectorAll('.faq__q').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.faq__item').classList.toggle('open');
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
