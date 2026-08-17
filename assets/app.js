/* ============================================================
   TMF Team — interactions, animations, calculators
   Vanilla JS, no build step. Loaded with `defer` on every page.
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const usd = (n, dp = 0) =>
    '$' + Number(Math.max(0, Math.round(n * 10 ** dp) / 10 ** dp))
      .toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

  /* ---------------------------------------------------------
     1. Header: sticky state, scroll progress, mobile nav
     --------------------------------------------------------- */
  function initHeader() {
    const header = $('.site-header');
    const bar = $('.scroll-progress');
    const toggle = $('.nav-toggle');
    const nav = $('.nav');

    const onScroll = () => {
      const y = window.scrollY;
      if (header) header.classList.toggle('scrolled', y > 12);
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  /* ---------------------------------------------------------
     2. Scroll reveal + staggering
     --------------------------------------------------------- */
  function initReveal() {
    const items = $$('[data-reveal]');
    if (!items.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    // auto-stagger siblings that share a parent
    const seen = new Map();
    items.forEach((el) => {
      if (el.style.getPropertyValue('--rd')) return;
      const p = el.parentElement;
      const i = seen.get(p) || 0;
      seen.set(p, i + 1);
      el.style.setProperty('--rd', Math.min(i * 90, 540) + 'ms');
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------
     3. Hero shards (floating glass panels) + parallax
     --------------------------------------------------------- */
  function initShards() {
    const host = $('.shards');
    if (!host || reduced) return;

    const specs = [
      { l: 4,  t: 16, w: 130, h: 220, rot: -14, dx: 20,  dy: -30, dur: 28 },
      { l: 17, t: 54, w: 90,  h: 150, rot: 22,  dx: -18, dy: 26,  dur: 34 },
      { l: 30, t: 8,  w: 210, h: 160, rot: 8,   dx: 24,  dy: 18,  dur: 31 },
      { l: 46, t: 62, w: 260, h: 190, rot: -6,  dx: -22, dy: -24, dur: 37 },
      { l: 63, t: 20, w: 180, h: 240, rot: 15,  dx: 18,  dy: 28,  dur: 29 },
      { l: 77, t: 58, w: 220, h: 150, rot: -20, dx: -26, dy: -18, dur: 33 },
      { l: 88, t: 12, w: 150, h: 210, rot: 11,  dx: 16,  dy: 24,  dur: 26 }
    ];

    specs.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'shard';
      el.style.cssText =
        `left:${s.l}%;top:${s.t}%;width:${s.w}px;height:${s.h}px;` +
        `--rot:${s.rot}deg;--dx:${s.dx}px;--dy:${s.dy}px;--dur:${s.dur}s;` +
        `--delay:${(i * 1.6).toFixed(1)}s;--spin:${(s.rot > 0 ? -6 : 6)}deg;` +
        `border-radius:6px;opacity:${(0.5 + (i % 3) * 0.16).toFixed(2)};`;
      host.appendChild(el);
    });

    // depth is handled by the parallax engine below (see [data-parallax])
  }

  /* ---------------------------------------------------------
     3b. Parallax engine
     One rAF loop drives every [data-parallax] element.

       data-parallax="0.18"     speed; negative moves against the scroll
       data-parallax-max="90"   optional clamp in px

     Elements are only computed while they intersect the viewport.
     Fully disabled for prefers-reduced-motion and on narrow screens,
     where the moving layers cost more than they add.
     --------------------------------------------------------- */
  const parallax = (() => {
    const items = [];
    let ticking = false;
    let active = false;

    const mqSmall = window.matchMedia('(max-width: 680px)');
    const mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const measure = (it) => {
      const prev = it.el.style.transform;
      it.el.style.transform = 'none';           // measure at rest
      const r = it.el.getBoundingClientRect();
      it.top = r.top + window.scrollY;
      it.h = r.height;
      it.el.style.transform = prev;
    };

    const render = () => {
      ticking = false;
      if (!active) return;
      const vh = window.innerHeight;
      const mid = window.scrollY + vh / 2;
      for (const it of items) {
        if (!it.visible) continue;
        // -1 at the moment it enters, +1 as it leaves
        const p = ((mid - (it.top + it.h / 2)) / (vh + it.h)) * 2;
        // travel is viewport-relative so the effect reads the same on any screen
        let shift = p * it.speed * vh * 0.5;
        if (it.max) shift = Math.max(-it.max, Math.min(it.max, shift));
        it.el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
      }
    };

    const request = () => {
      if (ticking || !active) return;
      ticking = true;
      requestAnimationFrame(render);
    };

    const reset = () => {
      for (const it of items) it.el.style.transform = '';
    };

    const remeasure = () => {
      items.forEach(measure);
      request();
    };

    // Only elements in view get math done on them.
    const io =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                const it = items.find((i) => i.el === e.target);
                if (it) it.visible = e.isIntersecting;
              }
              request();
            },
            { rootMargin: '20% 0px' }
          )
        : null;

    const evaluate = () => {
      const on = !mqMotion.matches && !mqSmall.matches && items.length > 0;
      if (on === active) return;
      active = on;
      if (active) {
        remeasure();
      } else {
        reset();
      }
    };

    function init() {
      $$('[data-parallax]').forEach((el) => {
        const speed = parseFloat(el.getAttribute('data-parallax'));
        if (!speed) return;
        const max = parseFloat(el.getAttribute('data-parallax-max')) || 0;
        const it = { el, speed, max, top: 0, h: 0, visible: !io };
        el.style.willChange = 'transform';
        items.push(it);
        if (io) io.observe(el);
      });
      if (!items.length) return;

      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', debounce(remeasure, 150), { passive: true });
      window.addEventListener('load', remeasure);

      const onPref = () => evaluate();
      if (mqMotion.addEventListener) {
        mqMotion.addEventListener('change', onPref);
        mqSmall.addEventListener('change', onPref);
      }
      evaluate();
    }

    return { init, remeasure };
  })();

  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* ---------------------------------------------------------
     4. Count-up on stat values
     --------------------------------------------------------- */
  function initCountUp() {
    const nodes = $$('[data-count]');
    if (!nodes.length || !('IntersectionObserver' in window)) return;

    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      if (reduced) { el.textContent = String(target); return; }
      const dur = 1100;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    nodes.forEach((n) => io.observe(n));
  }

  /* ---------------------------------------------------------
     5. Product card cursor glow
     --------------------------------------------------------- */
  function initCardGlow() {
    $$('.product-card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* ---------------------------------------------------------
     6. Active-on-scroll for feature list + stages
     --------------------------------------------------------- */
  function initActiveOnScroll() {
    const groups = [$$('.feature-item'), $$('.stage')];
    groups.forEach((items) => {
      if (!items.length || !('IntersectionObserver' in window)) return;
      const io = new IntersectionObserver(
        (es) => {
          es.forEach((e) => e.target.classList.toggle('is-active', e.isIntersecting && e.intersectionRatio > 0.55));
        },
        { threshold: [0, 0.55, 1], rootMargin: '-18% 0px -18% 0px' }
      );
      items.forEach((i) => io.observe(i));
    });
  }

  /* ---------------------------------------------------------
     7. Accordion
     --------------------------------------------------------- */
  function initAccordion() {
    $$('.acc-item').forEach((item) => {
      const btn = $('.acc-trigger', item);
      const panel = $('.acc-panel', item);
      if (!btn || !panel) return;

      const setOpen = (open) => {
        item.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
        panel.style.height = open ? panel.scrollHeight + 'px' : '0px';
      };

      if (item.classList.contains('open')) requestAnimationFrame(() => setOpen(true));

      btn.addEventListener('click', () => {
        const willOpen = !item.classList.contains('open');
        const acc = item.closest('.accordion');
        if (acc && willOpen) {
          $$('.acc-item.open', acc).forEach((o) => {
            o.classList.remove('open');
            $('.acc-trigger', o).setAttribute('aria-expanded', 'false');
            $('.acc-panel', o).style.height = '0px';
          });
        }
        setOpen(willOpen);
      });

      window.addEventListener('resize', () => {
        if (item.classList.contains('open')) panel.style.height = panel.scrollHeight + 'px';
      });
    });
  }

  /* ---------------------------------------------------------
     8. Custom selects
     --------------------------------------------------------- */
  function initSelects() {
    $$('.select').forEach((sel) => {
      const trigger = $('.select-trigger', sel);
      const menu = $('.select-menu', sel);
      const label = $('.val', trigger);
      if (!trigger || !menu) return;

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = sel.classList.contains('open');
        $$('.select.open').forEach((o) => o.classList.remove('open'));
        sel.classList.toggle('open', !open);
      });

      menu.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        $$('button', menu).forEach((b) => b.classList.remove('sel'));
        btn.classList.add('sel');
        label.textContent = btn.textContent;
        label.classList.remove('placeholder');
        sel.dataset.value = btn.dataset.value;
        sel.classList.remove('open');
        sel.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: btn.dataset.value } }));
      });
    });

    document.addEventListener('click', () => $$('.select.open').forEach((o) => o.classList.remove('open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') $$('.select.open').forEach((o) => o.classList.remove('open'));
    });
  }

  /* ---------------------------------------------------------
     9. Chip pickers
     --------------------------------------------------------- */
  function initChips() {
    $$('.chips').forEach((group) => {
      group.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        $$('.chip', group).forEach((c) => c.classList.remove('sel'));
        chip.classList.add('sel');
        group.dataset.value = chip.dataset.value;
        group.dispatchEvent(new CustomEvent('change', { bubbles: true }));
      });
    });
  }

  /* ---------------------------------------------------------
     10. Money inputs (thousands separators, digits only)
     --------------------------------------------------------- */
  function initMoneyInputs() {
    $$('[data-money]').forEach((input) => {
      const format = () => {
        const digits = input.value.replace(/[^\d]/g, '');
        input.value = digits ? Number(digits).toLocaleString('en-US') : '';
      };
      format();
      input.addEventListener('input', () => {
        const end = input.value.length - input.selectionStart;
        format();
        const pos = Math.max(0, input.value.length - end);
        input.setSelectionRange(pos, pos);
        input.dispatchEvent(new CustomEvent('money', { bubbles: true }));
      });
    });
  }
  const moneyVal = (el) => Number(String(el.value).replace(/[^\d.]/g, '')) || 0;

  /* =========================================================
     PRODUCT CATALOGUE + MATCHING ENGINE
     Shared by the hero calculator and the funding estimator.
     Thresholds live here so they are easy to tune in one place.
     ========================================================= */
  const PRODUCTS = [
    {
      id: 'mca',
      name: 'Merchant Cash Advance',
      range: '$5K – $500K',
      blurb: 'Fast capital with flexible daily or weekly remittances based on your revenue.',
      term: '3 – 18 months',
      speed: '1 – 3 days',
      href: 'mca.html',
      match: (p) => p.revenue >= 10000 && p.credit >= 500 && p.positions <= 3
    },
    {
      id: 'loc',
      name: 'Line of Credit',
      range: '$10K – $250K',
      blurb: 'Revolving credit line you draw from as needed. Only pay for what you use.',
      term: 'Revolving',
      speed: '3 – 7 days',
      href: 'funding-estimator.html',
      match: (p) => p.revenue >= 15000 && p.credit >= 600 && p.positions <= 1 && p.tib >= 1
    },
    {
      id: 'equipment',
      name: 'Equipment Financing',
      range: '$10K – $5M',
      blurb: 'Finance machinery, technology, vehicles, or other essential business equipment.',
      term: '1 – 7 years',
      speed: '3 – 10 days',
      href: 'funding-estimator.html',
      match: (p) => p.revenue >= 20000 && p.credit >= 620
    },
    {
      id: 'heloc',
      name: 'HELOC',
      range: '$25K – $500K',
      blurb: 'Leverage your home equity for business capital with competitive rates.',
      term: '10 – 30 years',
      speed: '2 – 4 weeks',
      href: 'heloc-calculator.html',
      match: (p) => p.credit >= 660
    },
    {
      id: 'term',
      name: 'Long-Term Business Loan',
      range: '$50K – $5M',
      blurb: 'Predictable monthly payments for sustained growth, expansion, or refinancing.',
      term: '1 – 10 years',
      speed: '1 – 2 weeks',
      href: 'long-term-loans.html',
      match: (p) => p.revenue >= 25000 && p.credit >= 650 && p.positions === 0 && p.tib >= 2
    }
  ];

  // profile defaults keep the panel populated before anything is chosen
  function matchProducts(profile) {
    const p = {
      revenue: profile.revenue || 0,
      credit: profile.credit == null ? 700 : profile.credit,
      positions: profile.positions == null ? 0 : profile.positions,
      tib: profile.tib == null ? 3 : profile.tib
    };
    return PRODUCTS.filter((prod) => prod.match(p));
  }

  // indicative advance size: 0.8×–1.5× monthly revenue, scaled by credit & positions
  function estimateAdvance(profile) {
    const rev = profile.revenue || 0;
    if (!rev) return null;
    let lowMult = 0.8, highMult = 1.5;
    const c = profile.credit == null ? 700 : profile.credit;
    if (c < 600) { lowMult = 0.5; highMult = 1.0; }
    else if (c < 660) { lowMult = 0.65; highMult = 1.2; }
    else if (c >= 740) { lowMult = 1.0; highMult = 1.8; }
    const pos = profile.positions || 0;
    const posFactor = [1, 0.8, 0.6, 0.45][Math.min(pos, 3)];
    return {
      low: Math.min(rev * lowMult * posFactor, 500000),
      high: Math.min(rev * highMult * posFactor, 500000)
    };
  }

  function renderMatches(host, profile) {
    if (!host) return;
    const list = matchProducts(profile);
    if (!list.length) {
      host.innerHTML =
        '<p style="color:var(--muted-fg);margin:0">No product fits that profile yet. ' +
        'Speak with an advisor — compensating factors are often enough.</p>';
      return;
    }
    host.innerHTML = list
      .map(
        (p) => `
      <div class="match-card" data-reveal>
        <div class="match-top">
          <h4>${p.name}</h4>
          <span class="match-range">${p.range}</span>
        </div>
        <p>${p.blurb}</p>
        <div class="match-meta"><span>${p.term}</span><span>${p.speed}</span></div>
        <div class="match-links">
          <a href="${p.href}">Learn more &rarr;</a>
          <a href="funding-estimator.html">Apply &rarr;</a>
        </div>
      </div>`
      )
      .join('');
    $$('[data-reveal]', host).forEach((el) => el.classList.add('in'));
  }

  /* ---------------------------------------------------------
     11. Multi-step funding calculator
     --------------------------------------------------------- */
  function initFundingCalc() {
    const root = $('[data-calc="funding"]');
    if (!root) return;

    const panes = $$('.step-pane', root);
    const bars = $$('.steps-bar i', root);
    const stepLabel = $('[data-step-label]', root);
    const titleEl = $('[data-step-title]', root);
    const matchesHost = document.querySelector('[data-matches]');
    const errEl = $('.err', root);

    const titles = [
      'How much can you get? Find out <b>instantly</b>',
      'Tell us about your business.',
      'Where should we send your answer?'
    ];

    let step = 0;

    const profile = () => ({
      revenue: moneyVal($('[data-field="revenue"]', root)),
      credit: root.querySelector('[data-field="credit"]').dataset.value
        ? Number(root.querySelector('[data-field="credit"]').dataset.value)
        : null,
      positions: root.querySelector('[data-field="positions"]').dataset.value
        ? Number(root.querySelector('[data-field="positions"]').dataset.value)
        : null,
      tib: root.querySelector('[data-field="tib"]')?.dataset.value
        ? Number(root.querySelector('[data-field="tib"]').dataset.value)
        : null
    });

    const paint = () => {
      panes.forEach((p, i) => p.classList.toggle('active', i === step));
      bars.forEach((b, i) => b.classList.toggle('done', i <= step));
      if (stepLabel) stepLabel.textContent = `STEP ${step + 1} / 3`;
      if (titleEl) titleEl.innerHTML = titles[step];
      if (errEl) errEl.textContent = '';
    };

    const sync = () => renderMatches(matchesHost, profile());

    root.addEventListener('change', sync);
    root.addEventListener('money', sync);
    sync();
    paint();

    const validate = () => {
      if (step === 0) {
        if (!moneyVal($('[data-field="revenue"]', root))) return 'Enter your monthly revenue.';
        if (!root.querySelector('[data-field="credit"]').dataset.value) return 'Select a credit score range.';
        if (!root.querySelector('[data-field="positions"]').dataset.value) return 'Select your MCA positions.';
      }
      if (step === 1) {
        for (const key of ['first', 'last', 'business']) {
          const el = root.querySelector(`[data-field="${key}"]`);
          if (el && !el.value.trim()) return 'Please complete the required fields.';
        }
        if (!root.querySelector('[data-field="tib"]').dataset.value) return 'Select time in business.';
      }
      if (step === 2) {
        const phone = root.querySelector('[data-field="phone"]').value.replace(/\D/g, '');
        const email = root.querySelector('[data-field="email"]').value.trim();
        if (phone.length < 10) return 'Enter a valid 10-digit US phone number.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email address.';
      }
      return null;
    };

    root.addEventListener('click', (e) => {
      const next = e.target.closest('[data-next]');
      const back = e.target.closest('[data-back]');
      const submit = e.target.closest('[data-submit]');

      if (next) {
        const msg = validate();
        if (msg) { if (errEl) errEl.textContent = msg; return; }
        step = Math.min(step + 1, panes.length - 1);
        paint();
      }
      if (back) { step = Math.max(step - 1, 0); paint(); }
      if (submit) {
        const msg = validate();
        if (msg) { if (errEl) errEl.textContent = msg; return; }
        showAnswer(root, profile());
      }
    });

    // phone formatting
    const phone = root.querySelector('[data-field="phone"]');
    if (phone) {
      phone.addEventListener('input', () => {
        const d = phone.value.replace(/\D/g, '').slice(0, 10);
        phone.value = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
                    : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}`
                    : d.length ? `(${d}` : '';
      });
    }
  }

  function showAnswer(root, profile) {
    const est = estimateAdvance(profile);
    const list = matchProducts(profile);
    const card = root.closest('.panel') || root;
    card.innerHTML = `
      <div class="calc-head">
        <span class="calc-kicker eyebrow">Your result</span>
        <span class="calc-step">COMPLETE</span>
      </div>
      <h3 class="calc-title">You look like a fit for <b>${list.length} product${list.length === 1 ? '' : 's'}</b>.</h3>
      <div class="result-list" style="margin-top:26px">
        ${est ? `<div class="result-row hi"><span class="k">Indicative range</span><span class="v">${usd(est.low)} – ${usd(est.high)}</span></div>` : ''}
        <div class="result-row"><span class="k">Products matched</span><span class="v">${list.length}</span></div>
        <div class="result-row"><span class="k">Typical decision</span><span class="v">3–24h</span></div>
      </div>
      <p style="color:var(--muted-fg);margin:22px 0 0">
        A funding specialist will reach out within 24 hours with a pre-qualified offer.
        Figures are indicative only and subject to underwriting.
      </p>
      <div style="margin-top:26px"><a class="btn btn-primary btn-block" href="contact.html">Talk to an advisor <span class="icon">&rarr;</span></a></div>
    `;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }

  /* ---------------------------------------------------------
     12. HELOC calculator (live)
     --------------------------------------------------------- */
  const HELOC_RATES = { 780: 8.15, 740: 8.45, 700: 8.95, 660: 9.75, 620: 10.9, 0: 12.25 };
  const rateFor = (score) => {
    const keys = Object.keys(HELOC_RATES).map(Number).sort((a, b) => b - a);
    for (const k of keys) if (score >= k) return HELOC_RATES[k];
    return HELOC_RATES[0];
  };

  function initHeloc() {
    const root = $('[data-calc="heloc"]');
    if (!root) return;

    const out = $('[data-heloc-out]');
    const homeEl = root.querySelector('[data-field="home"]');
    const mortEl = root.querySelector('[data-field="mortgage"]');
    const ltvEl = root.querySelector('[data-field="ltv"]');
    const incomeEl = root.querySelector('[data-field="income"]');
    const debtEl = root.querySelector('[data-field="debt"]');
    const creditSel = root.querySelector('[data-field="credit"]');

    const ltvLabel = $('[data-ltv-label]', root);
    const labels = {
      home: $('[data-label="home"]', root),
      mortgage: $('[data-label="mortgage"]', root),
      income: $('[data-label="income"]', root),
      debt: $('[data-label="debt"]', root)
    };

    const paintSlider = () => {
      const v = Number(ltvEl.value);
      const pct = ((v - Number(ltvEl.min)) / (Number(ltvEl.max) - Number(ltvEl.min))) * 100;
      ltvEl.style.background =
        `linear-gradient(90deg, #55c98d 0%, #4aa5e8 ${pct}%, rgba(255,255,255,0.14) ${pct}%)`;
      if (ltvLabel) ltvLabel.textContent = v + '%';
    };

    const compute = () => {
      const home = moneyVal(homeEl);
      const mortgage = moneyVal(mortEl);
      const ltv = Number(ltvEl.value) / 100;
      const income = moneyVal(incomeEl);
      const debt = moneyVal(debtEl);
      const score = Number(creditSel.dataset.value || 720);

      if (labels.home) labels.home.textContent = home ? usd(home) : '—';
      if (labels.mortgage) labels.mortgage.textContent = usd(mortgage);
      if (labels.income) labels.income.textContent = usd(income);
      if (labels.debt) labels.debt.textContent = usd(debt);
      paintSlider();

      if (!home) {
        out.innerHTML = '<p style="color:var(--muted-fg);margin:0">Enter your home value to see estimates.</p>';
        return;
      }

      const rate = rateFor(score);
      const monthlyRate = rate / 100 / 12;

      // 1. equity-constrained line
      const equityLine = Math.max(0, home * ltv - mortgage);
      const totalEquity = Math.max(0, home - mortgage);

      // 2. income-constrained line (43% back-end DTI, interest-only draw payment)
      const maxTotalDebt = income * 0.43;
      const roomForPayment = Math.max(0, maxTotalDebt - debt);
      const incomeLine = monthlyRate > 0 ? roomForPayment / monthlyRate : 0;

      const line = Math.max(0, Math.min(equityLine, incomeLine));
      const payment = line * monthlyRate;
      const dti = income > 0 ? ((debt + payment) / income) * 100 : 0;
      const limiter = incomeLine < equityLine ? 'Income / DTI' : 'Home equity';

      out.innerHTML = `
        <div class="result-list">
          <div class="result-row hi">
            <span class="k">Estimated credit line</span>
            <span class="v">${usd(line)}</span>
          </div>
          <div class="result-row">
            <span class="k">Interest-only payment (draw period)</span>
            <span class="v">${usd(payment, 0)}/mo</span>
          </div>
          <div class="result-row">
            <span class="k">Estimated rate</span>
            <span class="v">${rate.toFixed(2)}%</span>
          </div>
          <div class="result-row">
            <span class="k">Total equity in home</span>
            <span class="v">${usd(totalEquity)}</span>
          </div>
          <div class="result-row">
            <span class="k">Equity available at ${Math.round(ltv * 100)}% LTV</span>
            <span class="v">${usd(equityLine)}</span>
          </div>
          <div class="result-row">
            <span class="k">Projected DTI</span>
            <span class="v" style="color:${dti > 43 ? '#ff8b8b' : 'inherit'}">${dti.toFixed(1)}%</span>
          </div>
          <div class="result-row">
            <span class="k">Limiting factor</span>
            <span class="v" style="font-size:1rem">${limiter}</span>
          </div>
        </div>
        ${line === 0 ? '<p style="color:#ffb27a;margin:20px 0 0;font-size:.92rem">At these inputs there is no headroom for a line. Reducing existing monthly debt or increasing the LTV allowance would change this.</p>' : ''}
      `;
    };

    [homeEl, mortEl, incomeEl, debtEl].forEach((el) => el && el.addEventListener('input', compute));
    if (ltvEl) ltvEl.addEventListener('input', compute);
    if (creditSel) creditSel.addEventListener('change', compute);
    compute();
  }

  /* ---------------------------------------------------------
     13. Term-loan payment estimator
     --------------------------------------------------------- */
  function initTermLoan() {
    const root = $('[data-calc="term"]');
    if (!root) return;

    const amountEl = root.querySelector('[data-field="amount"]');
    const yearsEl = root.querySelector('[data-field="years"]');
    const rateEl = root.querySelector('[data-field="rate"]');
    const out = $('[data-term-out]');
    const yearsLabel = $('[data-years-label]', root);
    const rateLabel = $('[data-rate-label]', root);
    const amountLabel = $('[data-label="amount"]', root);

    const paint = (el, label, suffix) => {
      const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100;
      el.style.background = `linear-gradient(90deg, #55c98d 0%, #4aa5e8 ${pct}%, rgba(255,255,255,0.14) ${pct}%)`;
      if (label) label.textContent = el.value + suffix;
    };

    const compute = () => {
      const P = moneyVal(amountEl);
      const years = Number(yearsEl.value);
      const rate = Number(rateEl.value);
      paint(yearsEl, yearsLabel, years === 1 ? ' year' : ' years');
      paint(rateEl, rateLabel, '%');
      if (amountLabel) amountLabel.textContent = usd(P);

      const n = years * 12;
      const i = rate / 100 / 12;
      const pmt = i > 0 ? (P * i) / (1 - Math.pow(1 + i, -n)) : P / n;
      const total = pmt * n;

      out.innerHTML = P
        ? `<div class="result-list">
             <div class="result-row hi"><span class="k">Estimated monthly payment</span><span class="v">${usd(pmt)}</span></div>
             <div class="result-row"><span class="k">Total repaid</span><span class="v">${usd(total)}</span></div>
             <div class="result-row"><span class="k">Total interest</span><span class="v">${usd(total - P)}</span></div>
             <div class="result-row"><span class="k">Payments</span><span class="v">${n}</span></div>
           </div>`
        : '<p style="color:var(--muted-fg);margin:0">Enter a loan amount to see a payment estimate.</p>';
    };

    [amountEl, yearsEl, rateEl].forEach((el) => el && el.addEventListener('input', compute));
    compute();
  }

  /* ---------------------------------------------------------
     14. Contact form (front-end only)
     --------------------------------------------------------- */
  function initContactForm() {
    const form = $('[data-contact-form]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = $('.err', form);
      const email = form.querySelector('[data-field="email"]').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        if (err) err.textContent = 'Enter a valid email address.';
        return;
      }
      form.innerHTML =
        '<div style="text-align:center;padding:26px 0">' +
        '<h3 class="h3">Message ready to send.</h3>' +
        '<p style="color:var(--muted-fg);margin:14px 0 0">This rebuild is front-end only — ' +
        'connect this form to your CRM or mail endpoint to deliver it.</p></div>';
    });
  }

  /* ---------------------------------------------------------
     15. Hero v2 — headline reveal, ticker, cursor spotlight
     --------------------------------------------------------- */
  function initHeadline() {
    const h = $('[data-headline]');
    if (!h) return;
    requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('in')));
  }

  function initTicker() {
    const t = $('[data-ticker]');
    if (!t) return;
    const items = $$('b', t);
    if (items.length < 2) { items[0] && items[0].classList.add('on'); return; }

    // size the rail to the widest line so nothing gets clipped mid-rotation
    const sizeRail = () => {
      t.style.width = 'auto';
      let w = 0;
      items.forEach((b) => {
        const clone = b.cloneNode(true);
        clone.style.cssText =
          'position:absolute;inset:auto;left:0;top:0;width:max-content;' +
          'visibility:hidden;white-space:nowrap;opacity:0;transform:none';
        t.appendChild(clone);
        w = Math.max(w, clone.getBoundingClientRect().width);
        clone.remove();
      });
      const cap = Math.min(w, window.innerWidth - 90);
      t.style.width = Math.ceil(cap) + 'px';
    };
    sizeRail();
    window.addEventListener('resize', sizeRail);
    document.fonts && document.fonts.ready.then(sizeRail);

    let i = 0;
    items[0].classList.add('on');
    if (reduced) return;

    setInterval(() => {
      const cur = items[i];
      i = (i + 1) % items.length;
      const next = items[i];
      cur.classList.remove('on');
      cur.classList.add('off');
      next.classList.remove('off');
      // force reflow so the entry transition runs from below
      void next.offsetWidth;
      next.classList.add('on');
      setTimeout(() => cur.classList.remove('off'), 700);
    }, 4200);
  }

  function initSpotlight() {
    const hero = $('[data-spotlight]');
    if (!hero || reduced) return;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--sx', ((e.clientX - r.left) / r.width) * 100 + '%');
      hero.style.setProperty('--sy', ((e.clientY - r.top) / r.height) * 100 + '%');
    });
  }

  /* ---------------------------------------------------------
     boot
     --------------------------------------------------------- */
  function boot() {
    initHeader();
    initHeadline();
    initTicker();
    initSpotlight();
    initShards();
    parallax.init();
    initReveal();
    initCountUp();
    initCardGlow();
    initActiveOnScroll();
    initAccordion();
    initSelects();
    initChips();
    initMoneyInputs();
    initFundingCalc();
    initHeloc();
    initTermLoan();
    initContactForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
