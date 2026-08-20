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

  /* For text that is going into an HTML attribute in a template literal.
     Nothing here comes from a stranger today, but a result string that
     later picks up a user-entered value must not be able to close the
     attribute and start a tag. */
  const attrEscape = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* =========================================================
     LEAD CAPTURE

     Google Apps Script Web App that appends each submission to the
     leads spreadsheet. Verified live on 17 Aug 2026.

     To repoint it, replace the URL below and bump the ?v= on the asset
     links in every HTML file. If this is ever set back to an empty
     string, nothing transmits and the forms say so instead of faking
     success — see SETUP-LEAD-CAPTURE.md.
     ========================================================= */
  const LEAD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbze3tD_fvvy7of5o4BQwoY2TcEQ3zBADhJ2hERxTwYEvbgb0En_67rSBRMz1IKMP-YBGQ/exec';

  /* Harvests every [data-field] under `root`, so new fields are picked up
     automatically without touching this function. */
  function collectFields(root) {
    const out = {};
    $$('[data-field]', root).forEach((el) => {
      const key = el.getAttribute('data-field');
      if (!key) return;
      let val;
      if (el.dataset.value !== undefined && el.dataset.value !== '') val = el.dataset.value;
      else if (el.type === 'checkbox') val = el.checked ? 'yes' : 'no';
      else val = (el.value !== undefined ? el.value : el.textContent || '').trim();
      if (val !== '' && val != null) out[key] = val;
    });
    return out;
  }

  /* Our own copy, on our own server. Unlike the Sheet this one answers,
     so we can actually tell whether a submission was stored. */
  const LEAD_STORE_ENDPOINT = '/api/lead.php';

  function sendLead(kind, data) {
    const payload = JSON.stringify({
      kind: kind,
      page: location.pathname,
      submittedAt: new Date().toISOString(),
      referrer: document.referrer || '',
      // Campaign tags first, so a real form field always wins a name clash.
      data: Object.assign({}, attributionForLead(), data)
    });

    // Remember what we can, so the applicant does not retype it later.
    // Not from the opt-out form: writing someone's email onto their device
    // at the exact moment they ask us to stop is the wrong instinct.
    if (kind !== 'do-not-sell-request') {
      try { rememberVisitor(data); } catch (_) {}
    }

    // Our own store first. This is the copy that matters, and it is the
    // only one whose success we can actually observe.
    const mine = fetch(LEAD_STORE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('lead store returned ' + r.status))));

    if (!LEAD_ENDPOINT) return mine;

    // The Google Sheet as well. text/plain avoids the CORS preflight that
    // Apps Script will not answer; no-cors means the response is opaque,
    // so a failure here is invisible by design. That is exactly why the
    // store above exists — never treat this one as confirmation.
    const sheet = fetch(LEAD_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload
    }).catch(() => {});

    return Promise.all([mine, sheet]).then((r) => r[0]);
  }

  /* =========================================================
     VISITOR MEMORY

     Someone who runs a calculator and then applies should not type
     their name and email twice. What they enter anywhere on the site
     is kept in this browser and used to pre-fill the application.

     It stays on their own device — this is localStorage, not a
     server-side profile, and it is not a tracking cookie. Nothing
     sensitive is eligible: SENSITIVE_KEY_PARTS below is checked on
     the way in, so an SSN can never land here even if some future
     form starts collecting one.
     ========================================================= */
  /* The calculators use short industry codes; the application uses full
     labels. Without this the industry silently fails to carry across.
     If you add an option to either list, add the pairing here too. */
  const INDUSTRY_LABEL = {
    restaurant:   'Restaurant / Food service',
    retail:       'Retail',
    construction: 'Construction',
    trucking:     'Trucking / Transportation',
    healthcare:   'Healthcare / Medical',
    wholesale:    'Wholesale / Distribution',
    salon:        'Beauty / Salon / Spa',
    other:        'Other'
  };

  const VISITOR_KEY = 'tmf_visitor_v1';
  const VISITOR_FIELDS = [
    'first', 'last', 'business', 'email', 'phone', 'industry',
    'city', 'state', 'zip', 'revenue', 'credit', 'tib',
    'firstName', 'lastName'
  ];

  function readVisitor() {
    try { return JSON.parse(localStorage.getItem(VISITOR_KEY)) || {}; } catch (_) { return {}; }
  }

  function rememberVisitor(patch) {
    if (!patch) return;
    const store = readVisitor();
    let changed = false;
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (typeof v !== 'string' || v === '') return;
      if (VISITOR_FIELDS.indexOf(k) === -1) return;
      if (isSensitiveKey(k)) return;
      if (store[k] === v) return;
      store[k] = v.slice(0, 200);
      changed = true;
    });
    if (!changed) return;
    store.updated = new Date().toISOString();
    try { localStorage.setItem(VISITOR_KEY, JSON.stringify(store)); } catch (_) {}
  }

  /* Capture as they type, not only on submit — someone who fills in the
     calculator and leaves without pressing the button has still told us
     who they are, and should not have to say it again. */
  function initVisitorCapture() {
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (!el || !el.getAttribute) return;
      const key = el.getAttribute('data-field') || el.getAttribute('data-fg');
      if (!key || typeof el.value !== 'string') return;
      // Same reason: nothing typed into the opt-out form is remembered.
      if (el.closest && el.closest('[data-no-remember]')) return;
      const patch = {};
      patch[key] = el.value;
      try { rememberVisitor(patch); } catch (_) {}
    }, true);
  }

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
    // Master intensity dial. Every [data-parallax] speed is multiplied by this,
    // so the whole effect can be tuned from one number. 1 = the original,
    // subtle setting. Raise for more movement, lower for less.
    //
    // Can be overridden live for tuning:
    //   ?px=2.5    set the strength for this page view
    //   ?tune=1    show a slider to find the value you want
    let STRENGTH = 1.45;

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
        // -1 at the moment it enters, +1 as it leaves
        const p = ((mid - (it.top + it.h / 2)) / (vh + it.h)) * 2;
        // travel is viewport-relative so the effect reads the same on any screen
        let shift = p * it.speed * vh * 0.5 * STRENGTH;
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

    /* No IntersectionObserver gating here on purpose. It was an optimisation
       for culling off-screen work, but with a dozen elements the maths is
       free, and it added a silent failure mode: if the observer never
       delivered a callback, every layer stayed marked invisible and nothing
       ever moved. Simpler is more reliable. */

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
        const it = { el, speed, max, top: 0, h: 0 };
        el.style.willChange = 'transform';
        items.push(it);
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
      initTuner();
    }

    /* Tuning aid. Inert unless ?px= or ?tune=1 is in the URL, so it costs
       normal visitors nothing. Delete this function once the value is settled. */
    function initTuner() {
      const q = new URLSearchParams(location.search);

      const px = parseFloat(q.get('px'));
      if (!isNaN(px)) { STRENGTH = Math.max(0, Math.min(6, px)); request(); }

      if (q.get('tune') !== '1') return;

      const box = document.createElement('div');
      box.style.cssText =
        'position:fixed;left:18px;bottom:18px;z-index:9999;display:flex;align-items:center;' +
        'gap:12px;padding:12px 16px;border-radius:12px;font:500 13px/1 system-ui,sans-serif;' +
        'color:#fafafa;background:rgba(12,13,16,.94);border:1px solid rgba(255,255,255,.16);' +
        'backdrop-filter:blur(10px);box-shadow:0 8px 30px -8px rgba(0,0,0,.8)';
      box.innerHTML =
        '<span style="opacity:.65">Parallax</span>' +
        '<input type="range" min="0" max="4" step="0.05" value="' + STRENGTH + '" style="width:190px">' +
        '<b style="min-width:34px;text-align:right;font-variant-numeric:tabular-nums">' +
        STRENGTH.toFixed(2) + '</b>';

      const slider = box.querySelector('input');
      const label = box.querySelector('b');
      slider.addEventListener('input', () => {
        STRENGTH = parseFloat(slider.value);
        label.textContent = STRENGTH.toFixed(2);
        remeasure();
      });
      document.body.appendChild(box);
    }

    return { init, remeasure };
  })();

  /* ---------------------------------------------------------
     3c. Momentum scrolling
     Wheel input is captured and eased toward a target position, so the
     page keeps gliding for a moment after the wheel stops. The native
     scrollbar, keyboard scrolling and touch are all left alone — this
     only changes how wheel input is applied.

     Tunable live:  ?ease=0.05  floatier      ?ease=0.18  snappier
                    ?nomo=1     turn it off
     --------------------------------------------------------- */
  function initMomentum() {
    const q = new URLSearchParams(location.search);
    if (q.get('nomo') === '1') return;

    const isTouch = window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
    if (reduced || isTouch || window.innerWidth <= 680) return;

    // How much of the remaining distance is covered each frame.
    // Lower = longer glide. 0.09 gives roughly a third of a second of drift.
    let EASE = 0.09;
    const fromUrl = parseFloat(q.get('ease'));
    if (!isNaN(fromUrl)) EASE = Math.max(0.02, Math.min(0.5, fromUrl));

    const docEl = document.documentElement;
    const maxScroll = () => Math.max(0, docEl.scrollHeight - window.innerHeight);
    const clamp = (v) => Math.max(0, Math.min(maxScroll(), v));

    let target = window.scrollY;
    let current = target;
    let running = false;

    // Our easing replaces CSS smooth scrolling, which would fight it.
    docEl.style.scrollBehavior = 'auto';

    function loop() {
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        current = target;
        window.scrollTo(0, current);
        running = false;
        return;
      }
      current += diff * EASE;
      window.scrollTo(0, current);
      requestAnimationFrame(loop);
    }

    function start() {
      if (!running) { running = true; requestAnimationFrame(loop); }
    }

    window.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey || e.metaKey) return;                 // pinch/zoom
        const el = e.target instanceof Element ? e.target : null;
        if (el && el.closest('.select-menu')) return;        // inner scrollers keep native behaviour
        e.preventDefault();
        // deltaMode 1 = lines, 2 = pages
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
        target = clamp(target + e.deltaY * unit);
        start();
      },
      { passive: false }
    );

    // Scrollbar drags, keyboard, find-in-page: adopt whatever the browser did.
    window.addEventListener('scroll', () => {
      if (!running) { target = current = window.scrollY; }
    }, { passive: true });

    window.addEventListener('resize', () => { target = clamp(target); }, { passive: true });

    // In-page anchors ride the same easing instead of jumping.
    document.addEventListener('click', (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href*="#"]') : null;
      if (!a) return;
      let url;
      try { url = new URL(a.href, location.href); } catch (_) { return; }
      if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
      const dest = document.getElementById(url.hash.slice(1));
      if (!dest) return;
      e.preventDefault();
      const headerH = parseFloat(getComputedStyle(docEl).getPropertyValue('--header-h')) || 0;
      target = clamp(dest.getBoundingClientRect().top + window.scrollY - headerH - 8);
      start();
    });
  }

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
      range: '$5K – $2M',
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
      range: '$25K – $750K',
      blurb: 'Leverage your home equity for business capital with competitive rates.',
      term: '10 – 30 years',
      speed: '2 – 4 weeks',
      href: 'heloc-calculator.html',
      match: (p) => p.credit >= 660
    },
    {
      id: 'sba',
      name: 'SBA Loan (7a / 504)',
      range: 'Up to $5.5M',
      blurb: 'Government-backed, the lowest rates available — if the timeline allows for it.',
      term: '10 – 25 years',
      speed: '30 – 90 days',
      href: 'sba-loans.html',
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
  /* ---------------------------------------------------------
     Industry multipliers

     Supplied by John on 18 Aug 2026 — TMF's real figures, no longer
     placeholders. Any industry he did not name sits at 1.00 on his
     instruction. Edit this table only — nothing else needs to change.
     --------------------------------------------------------- */
  const INDUSTRY_MULT = {
    restaurant:   1.20,
    healthcare:   1.20,
    retail:       1.10,
    construction: 0.80,
    trucking:     0.75,
    wholesale:    1.00,
    salon:        1.00,
    other:        1.00
  };
  const DEFAULT_INDUSTRY_MULT = 1.00;

  /* How much of the outstanding balance comes off the offer.
     1.0 = the full balance. */
  const BALANCE_DEDUCTION_RATE = 1.0;

  /* Half-width of the quoted range, as a fraction of the projection.
     0.15 means the range is projection -15% to +15%, so high is always
     about 1.35x low. Previously low and high came from two separate
     multipliers (0.8 and 1.5) and the balance was subtracted from both,
     which kept the spread absolute while the midpoint fell — a merchant
     with a large balance could see something like $4K – $92K, a 23x range
     that reads as a broken calculator. Deriving the band from the final
     number instead keeps it sane at every size. */
  const RANGE_SPREAD = 0.15;

  /* One multiplier per credit band. These are the midpoints of the old
     low/high pairs, so overall levels are unchanged — only the width is. */
  const CREDIT_MULT = [
    { min: 740, mult: 1.40 },
    { min: 660, mult: 1.15 },
    { min: 600, mult: 0.925 },
    { min: 0,   mult: 0.75 }
  ];

  /* Projection =  monthly revenue
                   x industry multiplier
                   x credit multiplier
                   - outstanding balance x BALANCE_DEDUCTION_RATE
     then widened to a +/- RANGE_SPREAD band. Capped at 500k, floored at 0. */
  function estimateAdvance(profile) {
    const rev = profile.revenue || 0;
    if (!rev) return null;

    const c = profile.credit == null ? 700 : profile.credit;
    const creditMult = (CREDIT_MULT.find((b) => c >= b.min) || CREDIT_MULT[CREDIT_MULT.length - 1]).mult;

    const ind = profile.industry && INDUSTRY_MULT[profile.industry] != null
      ? INDUSTRY_MULT[profile.industry]
      : DEFAULT_INDUSTRY_MULT;

    const balance = profile.balance || 0;
    const deduction = balance * BALANCE_DEDUCTION_RATE;

    let base = Math.min(rev * ind * creditMult, 500000) - deduction;
    base = Math.max(0, base);

    const low = Math.max(0, base * (1 - RANGE_SPREAD));
    const high = Math.min(base * (1 + RANGE_SPREAD), 500000);

    return {
      low: low,
      high: high,
      base: base,
      deduction: deduction,
      industryMult: ind,
      creditMult: creditMult,
      viable: high > 0
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
        : null,
      balance: moneyVal($('[data-field="balance"]', root)),
      industry: root.querySelector('[data-field="industry"]')?.dataset.value || null
    });

    /* The balance question only makes sense once positions > 0. Show it
       then, and clear it when they go back to "None" so a stale figure
       can never quietly reduce someone's offer. */
    const balanceField = $('[data-balance-field]', root);
    const balanceInput = $('[data-field="balance"]', root);
    const positionsSel = root.querySelector('[data-field="positions"]');

    const syncBalance = () => {
      if (!balanceField || !positionsSel) return;
      const n = Number(positionsSel.dataset.value || 0);
      const show = n > 0;
      balanceField.hidden = !show;
      if (!show && balanceInput) balanceInput.value = '';
    };

    const paint = () => {
      panes.forEach((p, i) => p.classList.toggle('active', i === step));
      bars.forEach((b, i) => b.classList.toggle('done', i <= step));
      if (stepLabel) stepLabel.textContent = `STEP ${step + 1} / 3`;
      if (titleEl) titleEl.innerHTML = titles[step];
      if (errEl) errEl.textContent = '';
    };

    const sync = () => {
      syncBalance();
      renderMatches(matchesHost, profile());
    };

    root.addEventListener('change', sync);
    root.addEventListener('money', sync);
    // The custom selects set dataset.value on click rather than firing change
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-field="positions"] .select-menu')) {
        setTimeout(sync, 0);
      }
    });
    sync();
    paint();

    const validate = () => {
      if (step === 0) {
        if (!moneyVal($('[data-field="revenue"]', root))) return 'Enter your monthly revenue.';
        if (!root.querySelector('[data-field="credit"]').dataset.value) return 'Select a credit score range.';
        if (!root.querySelector('[data-field="positions"]').dataset.value) return 'Select your MCA positions.';
        if (Number(root.querySelector('[data-field="positions"]').dataset.value || 0) > 0
            && !moneyVal($('[data-field="balance"]', root))) {
          return 'Enter the outstanding balance on your existing positions.';
        }
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
        // Phone is optional. Only complain if they started typing one.
        if (phone.length > 0 && phone.length < 10) {
          return 'That phone number looks incomplete — leave it blank or enter 10 digits.';
        }
        if (!isEmail(email)) return EMAIL_ERROR;
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
        const p = profile();

        // Fire the lead off before repainting — showAnswer() replaces the
        // panel's markup, which would take the input values with it.
        const lead = collectFields(root);
        try { lead.estimate = JSON.stringify(estimateAdvance(p)); } catch (_) {}
        try { lead.matched = matchProducts(p).map((x) => x.name || x.id).join(', '); } catch (_) {}
        sendLead('funding-calculator', lead).catch(() => {});

        showAnswer(root, p);
      }
    });

    // Same immediate feedback on step 3 as the application gives.
    root.addEventListener('focusout', (e) => {
      const el = e.target;
      if (!el || !el.getAttribute || el.getAttribute('data-field') !== 'email') return;
      const val = (el.value || '').trim();
      if (val && !isEmail(val)) {
        if (errEl) errEl.textContent = EMAIL_ERROR;
      } else if (errEl && errEl.textContent === EMAIL_ERROR) {
        errEl.textContent = '';
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
    const card = root.closest('.panel') || root;

    /* The opening line the advisor's chat shows if they pick option 2. It
       carries the result across, so the merchant does not have to explain
       what they just did. Escaped: it is going into an HTML attribute. */
    const range = est && est.viable !== false ? usd(est.low) + ' – ' + usd(est.high) : '';
    const chatGreeting = attrEscape(
      'You have just run the cash injection calculator' +
      (range ? ' and it projected ' + range + '.' : '.') +
      ' Ask me anything about that number, what it would cost, or what we need from you — ' +
      'and I can bring a funding advisor into this conversation whenever you want one.'
    );

    card.innerHTML = `
      <div class="calc-head">
        <span class="calc-kicker eyebrow">Your result</span>
        <span class="calc-step">COMPLETE</span>
      </div>
      <h3 class="calc-title">Here is your <b>indicative projection</b>.</h3>
      <div class="result-list" style="margin-top:26px">
        ${est
          ? `<div class="result-row hi"><span class="k">Projected range</span><span class="v">${
              est.viable === false ? 'Over leveraged' : usd(est.low) + ' – ' + usd(est.high)
            }</span></div>`
          : ''}
        ${est && est.deduction > 0
          ? `<div class="result-row"><span class="k">Less existing positions</span><span class="v">− ${usd(est.deduction)}</span></div>`
          : ''}
        <div class="result-row"><span class="k">Typical decision</span><span class="v">3–24h</span></div>
      </div>
      <p style="color:var(--muted-fg);margin:22px 0 0">
        ${est && est.viable === false
          ? 'Based on what you owe against what you bring in, you are over leveraged ' +
            'for a new advance right now. A specialist can look at consolidation or ' +
            'a payoff structure — it is worth the conversation.'
          : 'A funding specialist will reach out within 24 hours to go through your options.'}
      </p>

      <p class="calc-disclaimer">
        <b>This is a projection, not an offer.</b> The figures above are an
        estimate based on the details you entered. They are not a quote, not a
        commitment to lend, and not the exact amount you will be offered. Real
        terms depend on underwriting, your bank statements and the funder — and
        can land above or below this range.
      </p>

      <div class="decision">
        <span class="mono-label">Where would you like to go from here?</span>

        <a class="decision-opt is-primary" href="/apply">
          <span class="decision-n">1</span>
          <span class="decision-txt">
            <b>Apply now</b>
            <span>Do you like the numbers? Start the application — about ten minutes.</span>
          </span>
          <span class="icon">&rarr;</span>
        </a>

        <button class="decision-opt" type="button" data-open-chat="${chatGreeting}">
          <span class="decision-n">2</span>
          <span class="decision-txt">
            <b>I am not sure yet — talk with us</b>
            <span>Opens the chat here on this page. Ask anything; an advisor can join it.</span>
          </span>
          <span class="icon">&rarr;</span>
        </button>

        <a class="decision-opt" href="/heloc-calculator">
          <span class="decision-n">3</span>
          <span class="decision-txt">
            <b>Looking for more?</b>
            <span>Try our HELOC calculator — up to $750K against the equity in your home.</span>
          </span>
          <span class="icon">&rarr;</span>
        </a>
      </div>
    `;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }

  /* ---------------------------------------------------------
     12. HELOC calculator (live)
     --------------------------------------------------------- */
  /* Highest line we will quote, regardless of equity or income headroom. */
  const HELOC_MAX = 750000;

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

      // 3. product ceiling — no HELOC we place goes above this
      const line = Math.max(0, Math.min(equityLine, incomeLine, HELOC_MAX));
      const payment = line * monthlyRate;
      const dti = income > 0 ? ((debt + payment) / income) * 100 : 0;
      const limiter = (equityLine > HELOC_MAX && incomeLine > HELOC_MAX)
        ? 'Product maximum'
        : (incomeLine < equityLine ? 'Income / DTI' : 'Home equity');

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
      if (!isEmail(email)) {
        if (err) err.textContent = EMAIL_ERROR;
        return;
      }
      const panel = (title, body) =>
        '<div style="text-align:center;padding:26px 0">' +
        '<h3 class="h3">' + title + '</h3>' +
        '<p style="color:var(--muted-fg);margin:14px 0 0">' + body + '</p></div>';

      const data = collectFields(form);
      sendLead('contact', data).then(
        () => {
          form.innerHTML = panel(
            'Message sent.',
            'Thanks — we\'ll come back to you within one business day.'
          );
        },
        () => {
          // Never claim delivery we cannot stand behind.
          form.innerHTML = panel(
            'This form isn\'t live yet.',
            'Your message was not sent. Please reach us directly in the meantime — ' +
            'we don\'t want your enquiry to go missing.'
          );
        }
      );
    });
  }

  /* ---------------------------------------------------------
     14a. Do Not Sell or Share — the opt-out form on /privacy

     Two things happen, in this order and on purpose. The browser-level
     half is done first and unconditionally, because it is free, instant
     and entirely within our control. The request to stop it everywhere
     else has to reach the server, and if it does not, the visitor is
     told to email rather than shown a receipt for nothing.
     --------------------------------------------------------- */
  function initOptOut() {
    const form = $('[data-optout-form]');
    if (!form) return;
    const err = $('[data-err]', form);
    const done = $('[data-optout-done]');
    const btn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = (form.querySelector('[data-field="email"]').value || '').trim();
      if (!isEmail(email)) { if (err) err.textContent = EMAIL_ERROR; return; }
      if (err) err.textContent = '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      saveConsent({ analytics: false, marketing: false });

      sendLead('do-not-sell-request', collectFields(form)).then(
        () => {
          form.hidden = true;
          if (done) done.hidden = false;
        },
        () => {
          if (btn) { btn.disabled = false; btn.textContent = 'Send my request'; }
          if (err) {
            err.textContent = 'That did not send. Please email privacy@tmfus.com instead — ' +
              'we will action it by hand. Your cookie settings on this browser have been ' +
              'switched off either way.';
          }
        }
      );
    });
  }

  /* ---------------------------------------------------------
     14b. Figure HELOC — real offers
     Posts to /api/figure-heloc.php, which holds the affiliate key and
     talks to Figure. The key is never present in this file: Figure sends
     it in the request body, so a browser call would publish it.
     --------------------------------------------------------- */
  function initFigureOffers() {
    const panel = $('[data-figure]');
    if (!panel) return;

    const errEl = $('[data-fg-err]', panel);
    const outEl = $('[data-fg-out]', panel);
    const btn = $('[data-fg-submit]', panel);
    const privacy = $('[data-fg-consent="privacy"]', panel);
    const marketing = $('[data-fg-consent="marketing"]', panel);
    if (!btn) return;

    const val = (k) => {
      const el = panel.querySelector('[data-fg="' + k + '"]');
      return el ? el.value.trim() : '';
    };

    // Pull the property and income figures the visitor already entered above.
    const calc = $('[data-calc="heloc"]');
    const fromCalc = (field) => {
      if (!calc) return null;
      const el = calc.querySelector('[data-field="' + field + '"]');
      if (!el) return null;
      if (el.dataset && el.dataset.value) return Number(el.dataset.value);
      const n = Number(String(el.value || '').replace(/[^0-9.]/g, ''));
      return isFinite(n) ? n : null;
    };

    const validate = () => {
      if (!val('firstName') || !val('lastName')) return 'Enter your first and last name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) return 'Enter a valid email address.';
      if (!val('street1')) return 'Enter the property address.';
      if (!val('city')) return 'Enter the city.';
      if (!/^[A-Za-z]{2}$/.test(val('state'))) return 'Enter the two-letter state code.';
      if (!/^\d{5}(-\d{4})?$/.test(val('zip'))) return 'Enter a valid ZIP code.';
      if (!privacy || !privacy.checked) return 'Please agree to the privacy policy to request offers.';
      return null;
    };

    const money = (n) =>
      n == null ? '—' : usd(Number(n));
    const pct = (n) =>
      n == null ? '—' : Number(n).toFixed(2) + '%';

    const render = (res) => {
      const offers = (res.offers || []).filter((o) => o && o.interestRate != null);

      if (!offers.length) {
        outEl.innerHTML =
          '<p class="fg-note" style="margin-top:24px">Figure did not return an offer for these ' +
          'details. That often means the property or credit profile falls outside their ' +
          'current criteria — it does not affect your other options. ' +
          '<a href="contact.html" style="color:var(--accent)">Talk to our team</a> and we\'ll ' +
          'look at alternatives.</p>';
        return;
      }

      const cards = offers.map((o) => {
        const rows = [
          ['Line amount', money(o.loanAmount)],
          ['Monthly payment', money(o.monthlyPayment)],
          ['Term', o.term ? o.term + ' months' : '—'],
          ['Origination fee', o.originationFee != null ? Number(o.originationFee).toFixed(2) + '%' : '—']
        ];
        return (
          '<div class="fg-offer">' +
            '<div class="fg-offer-top">' +
              '<div class="fg-rate">' + pct(o.interestRate) +
                '<small>' + (o.rateType ? String(o.rateType).toLowerCase() + ' rate' : 'rate') + '</small>' +
              '</div>' +
              '<div class="fg-amount">' + pct(o.apr) + ' APR</div>' +
            '</div>' +
            '<div class="fg-grid">' +
              rows.map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') +
            '</div>' +
          '</div>'
        );
      }).join('');

      const cta = res.personalizedUrl
        ? '<a class="btn btn-primary btn-block" style="margin-top:22px" target="_blank" rel="noopener" href="' +
          res.personalizedUrl + '">Continue with Figure <span class="icon">&#8599;</span></a>'
        : '';

      const disclosure = res.disclosure
        ? '<p class="fg-note">' + res.disclosure + '</p>'
        : '<p class="fg-note">Offers are provided by Figure and are estimates based on the ' +
          'details supplied. They are not a commitment to lend and remain subject to ' +
          'underwriting.</p>';

      outEl.innerHTML =
        '<h3 class="h3" style="margin-top:30px">Your offers from Figure</h3>' +
        '<div class="fg-offers">' + cards + '</div>' + cta + disclosure;
    };

    btn.addEventListener('click', () => {
      const msg = validate();
      if (errEl) errEl.textContent = msg || '';
      if (msg) return;

      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = 'Checking with Figure…';
      outEl.innerHTML = '<p class="fg-busy">Requesting live offers…</p>';

      const body = {
        firstName: val('firstName'),
        lastName: val('lastName'),
        email: val('email'),
        phone: val('phone'),
        address: {
          street1: val('street1'),
          city: val('city'),
          state: val('state').toUpperCase(),
          zip: val('zip')
        },
        loanPurpose: val('loanPurpose') || 'OTHER',
        employmentStatus: val('employmentStatus'),
        propertyValue: fromCalc('home'),
        currentMortgageBalances: fromCalc('mortgage'),
        householdIncome: fromCalc('income'),
        monthlyExpenses: fromCalc('debt'),
        fico: fromCalc('credit'),
        // Consent is passed through exactly as ticked — never assumed.
        privacyPolicyOptIn: !!(privacy && privacy.checked),
        remarketingAllowed: !!(marketing && marketing.checked)
      };

      fetch('/api/figure-heloc.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then((r) => r.json().then((j) => ({ ok: r.ok, j: j })))
        .then(({ ok, j }) => {
          if (!ok || !j.ok) throw new Error(j && j.error ? j.error : 'Request failed.');
          render(j);
          // High-intent lead — record it alongside the others.
          sendLead('figure-heloc', Object.assign({}, body, {
            street1: body.address.street1, city: body.address.city,
            state: body.address.state, zip: body.address.zip,
            offerCount: (j.offers || []).length,
            topRate: (j.offers && j.offers[0]) ? j.offers[0].interestRate : '',
            personalizedUrl: j.personalizedUrl || ''
          })).catch(() => {});
        })
        .catch((e) => {
          outEl.innerHTML = '';
          if (errEl) {
            errEl.textContent = e.message ||
              'We could not reach Figure just now. Please try again shortly.';
          }
        })
        .then(() => {
          btn.disabled = false;
          btn.innerHTML = label;
        });
    });
  }


  /* ---------------------------------------------------------
     14c. Branded application — apply.html

     A four-step application in the site's own theme. TMF collects the
     whole thing — all 29 fields, the signature included. There is no
     handoff to a third party and no second form for the applicant.

     HOW THE SENSITIVE FIELDS TRAVEL
     SSN, date of birth and the signature POST to api/application.php as
     part of the form body, over HTTPS. They are never put in a query
     string, never sent to the leads spreadsheet, and never written to
     the server in plain text — application.php seals the whole record
     with an RSA public key on arrival. See api/application.php.

     RULES THAT MUST NOT BE WEAKENED
     - Nothing tagged [data-sensitive] may ever enter a URL or the lead
       summary. The summary builder below strips them by name.
     - If the POST fails, the applicant is told. Never show the success
       pane for an application the server did not confirm it stored.
     --------------------------------------------------------- */

  const APPLICATION_ENDPOINT = 'api/application.php';
  const MAX_FILE_MB = 10;
  const MAX_FILES = 12;

  /* ---------------------------------------------------------
     Bank statements — John's rule, 18 Aug 2026.

     Statements are REQUIRED. An application cannot be submitted
     without them. John set the requirement to four months for every
     state on 18 Aug 2026.

     TO CHANGE ONE STATE: put its two-letter code in the exceptions
     list with the number of months it needs. Nothing else has to
     change — the dropzone text, the hint and the error message all
     read from here.
     --------------------------------------------------------- */
  const STATEMENTS_MIN = 4;
  const STATEMENTS_MIN_BY_STATE = {
    // 'FL': 3,
  };
  const statementsRequiredFor = (state) =>
    STATEMENTS_MIN_BY_STATE[String(state || '').toUpperCase()] || STATEMENTS_MIN;

  /* Substrings that mark a field as sensitive. Used to keep those values
     out of the Google Sheets lead summary. Never remove an entry. */
  const SENSITIVE_KEY_PARTS = ['ssn', 'dob', 'birth', 'social', 'sig', 'signature'];
  const isSensitiveKey = (k) => SENSITIVE_KEY_PARTS.some((p) => k.toLowerCase().indexOf(p) !== -1);

  const MASKS = {
    ein:   (v) => { const d = v.replace(/\D/g, '').slice(0, 9); return d.length > 2 ? d.slice(0, 2) + '-' + d.slice(2) : d; },
    ssn:   (v) => { const d = v.replace(/\D/g, '').slice(0, 9);
                    return d.length > 5 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5)
                         : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d; },
    zip:   (v) => { const d = v.replace(/\D/g, '').slice(0, 9); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; },
    pct:   (v) => { const d = v.replace(/\D/g, '').slice(0, 3); return d === '' ? '' : String(Math.min(100, Number(d))); },
    phone: (v) => { const d = v.replace(/\D/g, '').slice(0, 10);
                    return d.length > 6 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6)
                         : d.length > 3 ? '(' + d.slice(0, 3) + ') ' + d.slice(3)
                         : d.length > 0 ? '(' + d : ''; },
    date:  (v) => { const d = v.replace(/\D/g, '').slice(0, 8);
                    return d.length > 4 ? d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4)
                         : d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; }
  };

  /* One wording for a bad email address, used by the application, both
     calculators and the contact form. John asked for this exact sentence;
     if it changes, change it here and it changes everywhere.

     The pattern is stricter than the old one on the things people actually
     mistype: a domain cannot contain "..", cannot start or end a label with
     a hyphen, and must end in a real letters-only suffix. "jane@gmail" and
     "jane@gmail..com" are now caught rather than accepted. */
  const EMAIL_ERROR = 'Not a valid email address.';
  const EMAIL_RE =
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
  const isEmail = (v) => EMAIL_RE.test(String(v == null ? '' : v).trim());
  const isFullDate = (v) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return false;
    const mo = +m[1], da = +m[2], yr = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31 || yr < 1900) return false;
    const d = new Date(yr, mo - 1, da);
    return d.getMonth() === mo - 1 && d.getDate() === da && d <= new Date();
  };

  function initApplication() {
    const form = $('[data-application]');
    if (!form) return;

    const panes = $$('[data-pane]', form);
    const bars = $$('.steps-bar i', form);
    const stepLabel = $('[data-step-label]', form);
    let step = 1;
    const TOTAL = 4;
    const files = [];

    /* The identity fields are always collected now. Left visible in the
       markup rather than un-hidden here, so that a JS error cannot end up
       silently dropping required fields from the form. */

    /* ---- carry over what they already told us ----
       Only fills fields that are still empty, so it can never overwrite
       something the applicant typed on this page. Sensitive fields are
       not eligible — nothing here was ever stored. */
    (function prefillFromVisitor() {
      const v = readVisitor();
      if (!v || !Object.keys(v).length) return;

      const name = [v.first || v.firstName || '', v.last || v.lastName || ''].join(' ').trim();
      const map = {
        business_legal_name: v.business,
        owner_name: name,
        email: v.email,
        phone: v.phone,
        industry: INDUSTRY_LABEL[String(v.industry || '').toLowerCase()] || '',
        business_city: v.city,
        business_state: v.state,
        business_zip: v.zip
      };

      let filled = 0;
      Object.keys(map).forEach((field) => {
        const val = map[field];
        if (!val) return;
        const el = $('[data-field="' + field + '"]', form);
        if (!el || el.value) return;                 // never overwrite
        if (el.tagName === 'SELECT' &&
            !Array.prototype.some.call(el.options, (o) => o.value === val)) return;
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled++;
      });

      const note = $('[data-prefill-note]', form);
      if (note && filled) {
        note.textContent = 'We have filled in ' + filled + ' answer' + (filled === 1 ? '' : 's') +
          ' from what you told us earlier. Please check them before continuing.';
        note.removeAttribute('hidden');
      }
    })();

    /* ---- input masks ---- */
    $$('[data-mask]', form).forEach((input) => {
      const fn = MASKS[input.dataset.mask];
      if (!fn) return;
      input.addEventListener('input', () => {
        const atEnd = input.selectionStart === input.value.length;
        input.value = fn(input.value);
        if (atEnd) input.setSelectionRange(input.value.length, input.value.length);
      });
    });

    /* ---- clear the invalid state as soon as the visitor fixes it ---- */
    form.addEventListener('input', (e) => {
      if (e.target.classList) e.target.classList.remove('invalid');
    });
    form.addEventListener('change', (e) => {
      if (e.target.classList) e.target.classList.remove('invalid');
    });

    /* Say so the moment they leave the email box, rather than making them
       press Continue to find out. An empty box is left alone — that is the
       required-field check's job, and complaining about a field someone has
       only tabbed through is noise. */
    form.addEventListener('focusout', (e) => {
      const el = e.target;
      if (!el || !el.getAttribute || el.getAttribute('data-field') !== 'email') return;
      const val = (el.value || '').trim();
      const pane = el.closest('[data-pane]');
      const err = pane ? $('[data-err]', pane) : null;
      if (val && !isEmail(val)) {
        el.classList.add('invalid');
        if (err) err.textContent = EMAIL_ERROR;
      } else if (err && err.textContent === EMAIL_ERROR) {
        err.textContent = '';
      }
    });

    /* ---- co-owner toggle ---- */
    const coFields = $('[data-coowner-fields]', form);
    let hasCoOwner = false;
    $$('[data-coowner-toggle] .chip', form).forEach((chip) => {
      chip.addEventListener('click', () => {
        $$('[data-coowner-toggle] .chip', form).forEach((c) => c.classList.remove('sel'));
        chip.classList.add('sel');
        hasCoOwner = chip.dataset.co === 'yes';
        if (coFields) coFields.hidden = !hasCoOwner;
      });
    });

    /* ---- signature pad ---- */
    let sigDrawn = false;
    const pad = $('[data-sig-pad]', form);
    if (pad) {
      const wrap = pad.closest('.sig-wrap');
      const ctx = pad.getContext('2d');
      let drawing = false;

      const size = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = pad.clientWidth || 400;
        pad.width = w * dpr;
        pad.height = 150 * dpr;
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#fafafa';
      };
      size();
      window.addEventListener('resize', () => { size(); sigDrawn = false; if (wrap) wrap.classList.remove('signed'); });

      const pt = (e) => {
        const r = pad.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      pad.addEventListener('pointerdown', (e) => {
        drawing = true;
        pad.setPointerCapture(e.pointerId);
        const p = pt(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        sigDrawn = true;
        if (wrap) wrap.classList.add('signed');
      });
      pad.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = pt(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
        pad.addEventListener(ev, () => { drawing = false; }));

      const clear = $('[data-sig-clear]', form);
      if (clear) clear.addEventListener('click', () => {
        ctx.clearRect(0, 0, pad.width, pad.height);
        sigDrawn = false;
        if (wrap) wrap.classList.remove('signed');
      });
    }

    /* ---- bank statements ---- */
    const zone = $('[data-dropzone]', form);
    const picker = $('[data-files]', form);
    const list = $('[data-file-list]', form);

    const renderFiles = () => {
      if (!list) return;
      list.innerHTML = '';
      files.forEach((f, i) => {
        const li = document.createElement('li');
        const tooBig = f.size > MAX_FILE_MB * 1024 * 1024;
        if (tooBig) li.className = 'bad';
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = f.name;
        const sz = document.createElement('span');
        sz.className = 'sz';
        sz.textContent = tooBig ? 'Too large' : (f.size / 1024 / 1024).toFixed(1) + ' MB';
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + f.name);
        rm.textContent = '×';
        rm.addEventListener('click', () => { files.splice(i, 1); renderFiles(); });
        li.append(nm, sz, rm);
        list.appendChild(li);
      });
    };

    const addFiles = (incoming) => {
      Array.from(incoming).forEach((f) => {
        if (files.length >= MAX_FILES) return;
        if (files.some((x) => x.name === f.name && x.size === f.size)) return;
        files.push(f);
      });
      renderFiles();
    };

    if (zone && picker) {
      zone.addEventListener('click', () => picker.click());
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); }
      });
      picker.addEventListener('change', () => { addFiles(picker.files); picker.value = ''; });
      ['dragenter', 'dragover'].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) =>
        zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
      zone.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }

    /* ---- validation ---- */
    function validate(n) {
      const pane = panes.find((p) => p.dataset.pane === String(n));
      if (!pane) return true;
      const err = $('[data-err]', pane);
      const fail = (el, msg) => {
        if (el) { el.classList.add('invalid'); el.focus({ preventScroll: false }); }
        if (err) err.textContent = msg;
        return false;
      };
      if (err) err.textContent = '';

      // Co-owner fields are only required once the visitor asks for them.
      const scope = $$('[data-field]', pane).filter((el) => {
        if (el.disabled) return false;
        const co = el.closest('[data-coowner-fields]');
        return !co || hasCoOwner;
      });

      for (const el of scope) {
        const key = el.getAttribute('data-field');
        const val = (el.value || '').trim();
        const optional = key === 'amount_requested';
        const label = (el.closest('.field') && $('.field-label', el.closest('.field')));
        const name = label ? label.textContent.replace(' *', '').trim() : 'this field';

        if (!optional && el.type !== 'checkbox' && !val) return fail(el, 'Please fill in ' + name.toLowerCase() + '.');
        if (key === 'email' && !isEmail(val)) return fail(el, EMAIL_ERROR);
        if (key === 'phone' && val.replace(/\D/g, '').length !== 10) return fail(el, 'Please enter a 10-digit phone number.');
        if (key === 'ein' && val.replace(/\D/g, '').length !== 9) return fail(el, 'An EIN is nine digits.');
        if (el.dataset.mask === 'ssn' && val.replace(/\D/g, '').length !== 9) return fail(el, 'A Social Security number is nine digits.');
        if (el.dataset.mask === 'zip' && val.replace(/\D/g, '').length < 5) return fail(el, 'Please enter a five-digit zip code.');
        if (el.dataset.mask === 'date' && !isFullDate(val)) return fail(el, 'Please enter a real date as MM/DD/YYYY.');
      }

      // Ownership is checked across the WHOLE form, not just this pane —
      // the owner's share lives on step 2 and the co-owner's on step 3, so a
      // per-pane sum would happily accept 100% + 50%.
      const pcts = $$('[data-mask="pct"]', form).filter((el) => {
        if (el.disabled) return false;
        const co = el.closest('[data-coowner-fields]');
        return !co || hasCoOwner;
      });
      const mine = scope.find((el) => el.dataset.mask === 'pct');
      if (mine) {
        const total = pcts.reduce((sum, el) => sum + (Number(el.value) || 0), 0);
        if (total > 100) return fail(mine, 'Ownership adds up to ' + total + '% across all owners. It cannot exceed 100%.');
        if (Number(mine.value) === 0) return fail(mine, 'Ownership percentage cannot be zero.');
      }

      for (const box of $$('[data-required-check]', pane)) {
        if (!box.checked) {
          if (err) err.textContent = 'Both boxes have to be ticked before we can submit this.';
          box.focus();
          return false;
        }
      }

      if (n === 4) {
        const bad = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
        if (bad) { if (err) err.textContent = '"' + bad.name + '" is over ' + MAX_FILE_MB + ' MB. Remove it and an advisor will send a secure upload link.'; return false; }

        const need = statementsRequiredFor(businessState());
        if (files.length < need) {
          if (err) {
            err.textContent = files.length === 0
              ? 'Please attach your last ' + need + ' months of business bank statements — we cannot review an application without them.'
              : 'That is ' + files.length + ' of the ' + need + ' months we need. Please add ' + (need - files.length) + ' more.';
          }
          return false;
        }

        if (!sigDrawn) { if (err) err.textContent = 'Please sign in the box above.'; return false; }
      }
      return true;
    }

    /* ---- how many months this applicant's state needs ---- */
    function businessState() {
      const el = $('[data-field="business_state"]', form);
      return el ? el.value : '';
    }

    /* Keep the dropzone honest about what is actually required, so the
       applicant is not surprised by the error after uploading three. */
    function syncStatementsCopy() {
      const need = statementsRequiredFor(businessState());
      const headline = $('[data-statements-headline]', form);
      const hint = $('[data-statements-hint]', form);
      if (headline) headline.textContent = 'Add your last ' + need + ' months';
      if (hint) {
        hint.textContent = need > STATEMENTS_MIN
          ? 'Required — ' + businessState() + ' needs ' + need + ' months. One file per month, or a single PDF covering all of them.'
          : 'Required — we cannot review an application without them. One file per month, or a single PDF covering all of them.';
      }
    }

    /* ---- step navigation ---- */
    function show(n) {
      panes.forEach((p) => p.classList.toggle('active', p.dataset.pane === String(n)));
      bars.forEach((b, i) => b.classList.toggle('done', n === 'done' || i < n));
      if (n === 4) syncStatementsCopy();
      if (stepLabel) stepLabel.textContent = n === 'done' ? 'Complete' : 'Step ' + n + ' of ' + TOTAL;
      const top = form.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    }

    $$('[data-next]', form).forEach((btn) => btn.addEventListener('click', () => {
      if (!validate(step)) return;
      step = Math.min(TOTAL, step + 1);
      show(step);
    }));
    $$('[data-back]', form).forEach((btn) => btn.addEventListener('click', () => {
      step = Math.max(1, step - 1);
      show(step);
    }));

    /* ---- signature as a PNG ----
       The pad draws in white on the dark theme. Exported straight out
       that gives a white-on-transparent PNG, which is invisible in any
       viewer with a light background — i.e. every one John will use. So
       the strokes are recoloured black and flattened onto white first.
       Same-origin canvas, so getImageData does not taint anything. */
    function signatureDataUrl() {
      if (!pad || !sigDrawn) return '';
      try {
        const strokes = document.createElement('canvas');
        strokes.width = pad.width;
        strokes.height = pad.height;
        const sctx = strokes.getContext('2d');
        sctx.drawImage(pad, 0, 0);

        const img = sctx.getImageData(0, 0, strokes.width, strokes.height);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; }
        sctx.putImageData(img, 0, 0);

        const out = document.createElement('canvas');
        out.width = pad.width;
        out.height = pad.height;
        const octx = out.getContext('2d');
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(strokes, 0, 0);
        return out.toDataURL('image/png');
      } catch (_) {
        return '';
      }
    }

    /* ---- submit ----
       Everything goes to our own endpoint. The success pane is shown only
       after the server confirms it sealed and stored the application; if
       that confirmation does not arrive the applicant is told plainly
       rather than shown a receipt for something that may not exist. */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(4)) return;

      const btn = $('[data-submit]', form);
      const err = $('[data-err]', $('[data-pane="4"]', form));
      const label = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
      if (err) err.textContent = '';

      const data = collectFields(form);
      if (!hasCoOwner) {
        Object.keys(data).forEach((k) => { if (k.indexOf('co_owner_') === 0) delete data[k]; });
      }
      data.co_owner = hasCoOwner ? 'yes' : 'no';
      data.statements_attached = String(files.length);
      data.owner_signature = signatureDataUrl();
      data.signed_at = new Date().toISOString();

      // Which wording the applicant actually agreed to. Stored with the
      // signature so a later change to the text cannot be mistaken for
      // what this person signed.
      const consentBox = $('[data-consent-text-id]', form);
      data.consent_text_id = consentBox ? (consentBox.getAttribute('data-consent-text-id') || '') : '';

      const fd = new FormData();
      fd.append('application', JSON.stringify(data));
      files.forEach((f) => fd.append('statements[]', f, f.name));

      let result = null;
      try {
        const res = await fetch(APPLICATION_ENDPOINT, { method: 'POST', body: fd });
        result = await res.json().catch(() => null);
        if (!res.ok || !result || !result.ok) {
          throw new Error((result && result.error) || 'The server did not confirm your application.');
        }
      } catch (ex) {
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
        if (err) {
          err.textContent = ex.message +
            ' Please call us rather than pressing submit again, so you do not end up applying twice.';
        }
        return;
      }

      const refEl = $('[data-reference]', form);
      if (refEl) refEl.textContent = result.reference || '—';

      // The leads sheet gets the ordinary fields only. Anything sensitive
      // exists solely inside the encrypted envelope on the server.
      const summary = {};
      Object.keys(data).forEach((k) => { if (!isSensitiveKey(k)) summary[k] = data[k]; });
      summary.reference = result.reference || '';
      try { await sendLead('application', summary); } catch (_) {}

      if (btn) { btn.disabled = false; btn.innerHTML = label; }
      step = 'done';
      show('done');
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

  /* =========================================================
     COOKIES AND CONSENT

     Built in JS rather than markup for the same reason the chat widget
     is: it has to appear on every page, and nine copies of the same
     banner is nine places to forget to change.

     THE RULE THIS ENFORCES
     Nothing that tracks anybody loads until the visitor has said yes.
     "Necessary" is the only category that runs without being asked, and
     it is genuinely necessary — the consent record itself, the chat
     session id, and the answers someone typed into a calculator.

     WHERE THE CHOICE LIVES
     A first-party cookie, so it survives across pages and visits, plus
     localStorage as a fallback for browsers that refuse the cookie.

     GLOBAL PRIVACY CONTROL
     If the browser sends a GPC signal, California law treats that as an
     instruction not to sell or share. It is honoured without asking:
     analytics and advertising are recorded as off and the banner is not
     shown. The visitor can still turn them on by hand from the Cookie
     settings link in the footer.

     TO ADD A TAG LATER
     Put the id in TAGS below. Nothing else needs changing — the loader
     only ever runs from applyConsent(), which only runs after a yes.
     ========================================================= */
  const CONSENT_COOKIE  = 'tmf_consent';
  const CONSENT_VERSION = 1;
  const CONSENT_DAYS    = 365;
  const ATTR_COOKIE     = 'tmf_attr';
  const ATTR_DAYS       = 390;          // browsers cap script-set cookies near 400

  /* Empty on purpose. A measurement id here is fetched ONLY after the
     visitor accepts the matching category — never on page load. */
  const TAGS = { ga4: '', metaPixel: '' };

  /* The click ids and campaign tags worth keeping. Everything here is
     campaign metadata, not personal data — no name, email or phone ever
     goes into a cookie. */
  const ATTR_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid'
  ];

  /* ---- cookie plumbing ---- */
  function readCookie(name) {
    const parts = ('; ' + document.cookie).split('; ' + name + '=');
    if (parts.length !== 2) return '';
    try { return decodeURIComponent(parts.pop().split(';').shift()); } catch (_) { return ''; }
  }

  function writeCookie(name, value, days) {
    const exp = new Date(Date.now() + days * 86400000).toUTCString();
    // Secure only over https, or the cookie is silently dropped on a local
    // php -S run and every consent test looks broken for the wrong reason.
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; Expires=' + exp + '; Path=/; SameSite=Lax' + secure;
  }

  function eraseCookie(name) {
    document.cookie = name + '=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax';
  }

  const gpcOn = () => navigator.globalPrivacyControl === true ||
                      navigator.globalPrivacyControl === 'true';

  /* ---- the record of what they chose ---- */
  function readConsent() {
    let raw = readCookie(CONSENT_COOKIE);
    if (!raw) { try { raw = localStorage.getItem(CONSENT_COOKIE) || ''; } catch (_) {} }
    if (!raw) return null;
    try {
      const c = JSON.parse(raw);
      if (!c || c.v !== CONSENT_VERSION) return null;   // wording changed, ask again
      return c;
    } catch (_) { return null; }
  }

  function saveConsent(prefs) {
    const record = {
      v: CONSENT_VERSION,
      analytics: !!prefs.analytics,
      marketing: !!prefs.marketing,
      gpc: gpcOn(),
      at: new Date().toISOString()
    };
    const raw = JSON.stringify(record);
    writeCookie(CONSENT_COOKIE, raw, CONSENT_DAYS);
    try { localStorage.setItem(CONSENT_COOKIE, raw); } catch (_) {}
    applyConsent(record);
    document.dispatchEvent(new CustomEvent('tmf:consent', { detail: record }));
    return record;
  }

  const consentAllows = (category) => {
    const c = readConsent();
    return !!(c && c[category]);
  };
  // Readable from the console and from any page script added later.
  window.tmfConsentAllows = consentAllows;

  /* ---- what consent actually switches on ---- */
  let tagsLoaded = false;

  function applyConsent(c) {
    if (c.analytics) {
      captureAttribution(true);
      if (TAGS.ga4 && !tagsLoaded) loadGa4(TAGS.ga4);
    } else {
      // Withdrawn means gone, not merely unused.
      eraseCookie(ATTR_COOKIE);
    }
    if (c.marketing && TAGS.metaPixel && !tagsLoaded) loadMetaPixel(TAGS.metaPixel);
    if ((c.analytics && TAGS.ga4) || (c.marketing && TAGS.metaPixel)) tagsLoaded = true;
  }

  function loadGa4(id) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('consent', 'default', {
      ad_storage:         consentAllows('marketing') ? 'granted' : 'denied',
      ad_user_data:       consentAllows('marketing') ? 'granted' : 'denied',
      ad_personalization: consentAllows('marketing') ? 'granted' : 'denied',
      analytics_storage:  'granted'
    });
    window.gtag('config', id, { anonymize_ip: true });
  }

  function loadMetaPixel(id) {
    (function (f, b, e, v) {
      if (f.fbq) return;
      const n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      const t = b.createElement(e);
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js'));
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  /* =========================================================
     WHERE THE VISITOR CAME FROM

     First touch is the campaign that found them and is usually worth
     more than the last one; last touch is the campaign that brought
     them back to convert. Both are kept. Neither is personal data —
     these are campaign tags, and the durable cookie only exists once
     analytics has been accepted.
     ========================================================= */
  function currentTouch() {
    const q = new URLSearchParams(location.search);
    const t = {};
    ATTR_PARAMS.forEach((k) => {
      const v = q.get(k);
      if (v) t[k] = v.slice(0, 120);
    });
    const ref = document.referrer || '';
    if (ref && ref.indexOf(location.host) === -1) {
      t.referrer = ref.slice(0, 200);
      try { t.referrer_domain = new URL(ref).hostname; } catch (_) {}
    }
    if (Object.keys(t).length) {
      t.landing_page = (location.pathname + location.search).slice(0, 200);
      t.seen = new Date().toISOString();
    }
    return t;
  }

  function captureAttribution(store) {
    const touch = currentTouch();

    // Last touch is per-visit and stays in the tab, not in a cookie.
    if (Object.keys(touch).length) {
      try { sessionStorage.setItem('tmf_last_touch', JSON.stringify(touch)); } catch (_) {}
    }

    if (!store || !Object.keys(touch).length) return;
    if (readCookie(ATTR_COOKIE)) return;        // first touch is written once
    writeCookie(ATTR_COOKIE, JSON.stringify(touch), ATTR_DAYS);
  }

  /* Flattened onto the submission the visitor is sending anyway, so an
     advisor opening a lead can see which campaign produced it. */
  function attributionForLead() {
    const out = {};
    const add = (obj, prefix) => {
      if (!obj) return;
      Object.keys(obj).forEach((k) => {
        const v = obj[k];
        if (typeof v === 'string' && v) out[prefix + k] = v.slice(0, 200);
      });
    };

    let last = null;
    try { last = JSON.parse(sessionStorage.getItem('tmf_last_touch') || 'null'); } catch (_) {}
    add(last || currentTouch(), '');

    if (consentAllows('analytics')) {
      let first = null;
      try { first = JSON.parse(readCookie(ATTR_COOKIE) || 'null'); } catch (_) {}
      if (first) add(first, 'first_');
    }
    return out;
  }

  /* ---- the banner ---- */
  function initConsent() {
    if ($('[data-cookie-bar]')) return;

    const existing = readConsent();

    // A GPC browser has already answered. Record it, honour it, say nothing.
    if (!existing && gpcOn()) {
      saveConsent({ analytics: false, marketing: false });
    } else if (existing) {
      applyConsent(existing);
    }

    const bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.setAttribute('data-cookie-bar', '');
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie choices');
    bar.innerHTML =
      '<div class="cookie-copy">' +
        '<b>Cookies on tmfus.com</b>' +
        '<p>Some are needed to make the site work — your chat session, the answers you type ' +
          'into a calculator, and this choice itself. The rest tell us which pages and ads bring ' +
          'business owners here, and let us show you our own ads elsewhere. You decide. ' +
          '<a href="/privacy#cookies">Cookie policy</a></p>' +
      '</div>' +
      '<div class="cookie-opts" data-cookie-opts hidden>' +
        '<label class="cookie-opt"><input type="checkbox" checked disabled>' +
          '<span><b>Necessary</b>Always on. The site does not work without these.</span></label>' +
        '<label class="cookie-opt"><input type="checkbox" data-cookie-cat="analytics">' +
          '<span><b>Analytics</b>Which pages get read, and which campaigns bring people here.</span></label>' +
        '<label class="cookie-opt"><input type="checkbox" data-cookie-cat="marketing">' +
          '<span><b>Advertising</b>Lets us and our advertising partners show you our ads on other sites.</span></label>' +
      '</div>' +
      '<div class="cookie-btns">' +
        '<button class="btn btn-primary btn-sm" type="button" data-cookie="all">Accept all</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-cookie="essential">Reject non-essential</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-cookie="choose">Choose</button>' +
        '<button class="btn btn-primary btn-sm" type="button" data-cookie="save" hidden>Save my choices</button>' +
      '</div>';

    document.body.appendChild(bar);

    const opts = $('[data-cookie-opts]', bar);
    const saveBtn = bar.querySelector('[data-cookie="save"]');
    const chooseBtn = bar.querySelector('[data-cookie="choose"]');

    const openBar = () => {
      const c = readConsent();
      $$('[data-cookie-cat]', bar).forEach((box) => {
        box.checked = !!(c && c[box.getAttribute('data-cookie-cat')]);
      });
      bar.classList.add('open');
    };
    const closeBar = () => bar.classList.remove('open');

    const showOptions = (on) => {
      opts.hidden = !on;
      saveBtn.hidden = !on;
      chooseBtn.hidden = on;
    };

    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      const what = btn.getAttribute('data-cookie');

      if (what === 'choose')    { showOptions(true); return; }
      if (what === 'all')       { saveConsent({ analytics: true,  marketing: true  }); closeBar(); return; }
      if (what === 'essential') { saveConsent({ analytics: false, marketing: false }); closeBar(); return; }
      if (what === 'save') {
        const picked = {};
        $$('[data-cookie-cat]', bar).forEach((box) => {
          picked[box.getAttribute('data-cookie-cat')] = box.checked;
        });
        saveConsent(picked);
        closeBar();
      }
    });

    // "Cookie settings" in the footer, and the same link inside the policy.
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (!trigger) return;
      e.preventDefault();
      showOptions(true);
      openBar();
    });

    // Never asked before, and no GPC signal answering for them.
    if (!readConsent()) {
      showOptions(false);
      setTimeout(openBar, 700);
    }

    // Last touch is recorded either way; only the durable first-touch
    // cookie waits for consent.
    captureAttribution(consentAllows('analytics'));
  }

  /* ---------------------------------------------------------
     16. Live chat widget

     Built here rather than in markup so it exists on all nine pages
     without editing nine files.

     The widget knows nothing about the agent — no URL, no key, no
     model name. It posts to api/chat.php and that is the whole of
     its knowledge. Anything in this file is readable by every
     visitor, so anything secret must never appear in it.

     Messages are rendered with textContent, never innerHTML. The
     text comes from a language model and from whatever a stranger
     typed; treating either as markup is how you get an XSS hole in
     your own site.
     --------------------------------------------------------- */
  const CHAT_ENDPOINT = '/api/chat.php';
  const CHAT_SESSION_KEY = 'tmf_chat_session';
  const CHAT_POLL_MS = 4000;

  function initChat() {
    if ($('[data-chat-panel]')) return;           // never twice

    let session = null;
    let seen = 0;
    let open = false;
    let human = false;
    let waiting = false;
    let poller = null;
    let sending = false;

    try { session = sessionStorage.getItem(CHAT_SESSION_KEY) || null; } catch (_) {}

    /* ---- markup ---- */
    const launch = document.createElement('button');
    launch.className = 'chat-launch';
    launch.type = 'button';
    launch.setAttribute('aria-label', 'Open chat');
    launch.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.1' +
      'A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/></svg><span>Questions?</span>';

    const panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.setAttribute('data-chat-panel', '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with TMF Team');
    panel.innerHTML =
      '<div class="chat-head">' +
        '<div><b>TMF Team</b><span data-chat-status><i class="dot"></i>Assistant &mdash; an advisor can join</span></div>' +
        '<button class="chat-close" type="button" aria-label="Close chat">&times;</button>' +
      '</div>' +
      '<div class="chat-log" data-chat-log aria-live="polite"></div>' +
      '<div class="chat-foot">' +
        '<div class="chat-row">' +
          '<textarea class="chat-input" data-chat-input rows="1" placeholder="Ask a question…" aria-label="Your message"></textarea>' +
          '<button class="chat-send" type="button" data-chat-send>Send</button>' +
        '</div>' +
        '<div class="chat-actions">' +
          '<button class="chat-chip" type="button" data-chat-human>Talk to a person</button>' +
          '<button class="chat-chip" type="button" data-chat-apply>Start an application</button>' +
        '</div>' +
        '<div class="chat-capture" data-chat-capture hidden>' +
          '<input data-chat-name placeholder="Your name" autocomplete="name">' +
          '<input data-chat-phone placeholder="Best number to reach you" inputmode="tel" autocomplete="tel">' +
          '<button class="chat-send" type="button" data-chat-save>Send my details</button>' +
        '</div>' +
        '<p class="chat-legal">Answers here are general information, not an offer of funding. ' +
          'Please do not type your Social Security number in chat.</p>' +
      '</div>';

    document.body.appendChild(launch);
    document.body.appendChild(panel);

    const log = $('[data-chat-log]', panel);
    const input = $('[data-chat-input]', panel);
    const sendBtn = $('[data-chat-send]', panel);
    const status = $('[data-chat-status]', panel);
    const capture = $('[data-chat-capture]', panel);

    /* ---- rendering ---- */
    function bubble(role, text) {
      const el = document.createElement('div');
      el.className = 'chat-msg ' + (
        role === 'visitor' ? 'me' :
        role === 'operator' ? 'operator' :
        role === 'system' ? 'note' : 'them'
      );
      el.textContent = text;                       // never innerHTML
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    function note(text) {
      const el = document.createElement('div');
      el.className = 'chat-msg note';
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
    }

    let typingEl = null;
    function typing(on) {
      if (on && !typingEl) {
        typingEl = document.createElement('div');
        typingEl.className = 'chat-typing';
        typingEl.textContent = 'Typing…';
        log.appendChild(typingEl);
        log.scrollTop = log.scrollHeight;
      } else if (!on && typingEl) {
        typingEl.remove();
        typingEl = null;
      }
    }

    function post(body) {
      return fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.ok) throw new Error(j && j.error ? j.error : 'chat unavailable');
          return j;
        });
      });
    }

    function setStatus() {
      if (human) {
        status.innerHTML = '<i class="dot"></i>An advisor has joined';
      } else if (waiting) {
        status.innerHTML = '<i class="dot"></i>Getting an advisor for you';
      } else {
        status.innerHTML = '<i class="dot"></i>Assistant &mdash; an advisor can join';
      }
    }

    /* ---- session ---- */
    function ensureSession() {
      if (session) return Promise.resolve(session);
      return post({ action: 'start', page: location.pathname }).then(function (j) {
        session = j.session;
        try { sessionStorage.setItem(CHAT_SESSION_KEY, session); } catch (_) {}
        return session;
      });
    }

    /* ---- polling for anything the advisor sends ---- */
    function pump() {
      if (!session) return Promise.resolve();
      return post({ action: 'poll', session: session, since: seen })
        .then(function (j) {
          const wasHuman = human;
          human = !!j.human;
          waiting = !!j.waiting;
          if (human && !wasHuman) note('An advisor has joined the conversation.');
          setStatus();
          (j.messages || []).forEach(function (m) {
            if (m.role === 'visitor') return;      // already on screen
            bubble(m.role, m.text);
          });
          seen = j.total;
        })
        .catch(function () { /* a dropped poll is not worth telling anyone about */ });
    }

    function startPolling() {
      if (poller) return;
      poller = setInterval(pump, CHAT_POLL_MS);
    }
    function stopPolling() {
      if (!poller) return;
      clearInterval(poller);
      poller = null;
    }

    /* ---- actions ---- */
    function send() {
      const text = input.value.trim();
      if (!text || sending) return;
      sending = true;
      sendBtn.disabled = true;
      bubble('visitor', text);
      seen++;
      input.value = '';
      input.style.height = 'auto';
      typing(true);

      ensureSession()
        .then(function () { return post({ action: 'send', session: session, message: text }); })
        .then(function (j) {
          typing(false);
          human = !!j.human;
          setStatus();
          (j.messages || []).forEach(function (m) { bubble(m.role, m.text); seen++; });
          if (human) note('An advisor is reading this.');
        })
        .catch(function (e) {
          typing(false);
          note('That did not send — ' + (e.message || 'please try again') + '.');
        })
        .then(function () { sending = false; sendBtn.disabled = false; input.focus(); });
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(110, input.scrollHeight) + 'px';
    });

    $('[data-chat-human]', panel).addEventListener('click', function () {
      ensureSession()
        .then(function () { return post({ action: 'human', session: session }); })
        .then(function () {
          waiting = true;
          setStatus();
          note('We have let an advisor know. Leave your name and number and we will reach you even if you close this.');
          capture.removeAttribute('hidden');
          // Pre-fill from anything they have already told us elsewhere.
          const v = readVisitor();
          const nameEl = $('[data-chat-name]', panel);
          const phoneEl = $('[data-chat-phone]', panel);
          if (nameEl && !nameEl.value) {
            nameEl.value = [v.first || v.firstName || '', v.last || v.lastName || ''].join(' ').trim();
          }
          if (phoneEl && !phoneEl.value) phoneEl.value = v.phone || '';
        })
        .catch(function () { note('Could not reach us just now. Please use the contact page.'); });
    });

    $('[data-chat-apply]', panel).addEventListener('click', function () {
      location.href = 'apply.html';
    });

    $('[data-chat-save]', panel).addEventListener('click', function () {
      const name = $('[data-chat-name]', panel).value.trim();
      const phone = $('[data-chat-phone]', panel).value.trim();
      if (!name && !phone) return;
      rememberVisitor({ first: name.split(' ')[0] || '', phone: phone });
      ensureSession()
        .then(function () { return post({ action: 'details', session: session, name: name, phone: phone }); })
        .then(function () {
          capture.setAttribute('hidden', '');
          note('Thank you — an advisor will come back to you on that number.');
        })
        .catch(function () { note('That did not save. Please use the contact page.'); });
    });

    /* ---- open / close ----
       `greeting` lets whatever opened the chat set the first line, so a
       merchant who arrives from the calculator result does not have to
       explain what they just did. Ignored once a conversation exists. */
    function openChat(greeting) {
      open = true;
      panel.classList.add('open');
      launch.hidden = true;
      startPolling();
      ensureSession()
        .then(function () {
          if (!log.children.length) {
            bubble('assistant',
              (typeof greeting === 'string' && greeting) ? greeting :
              'Hello — I can answer questions about funding, what we need from you, and how long it takes. ' +
              'What are you trying to do?');
          }
          return pump();
        })
        .catch(function () {
          note('Chat is not available right now. The contact page will reach us.');
        });
      setTimeout(function () { input.focus(); }, 220);
    }

    function closeChat() {
      open = false;
      panel.classList.remove('open');
      launch.hidden = false;
      // Keep polling if a person is involved, so a reply is not missed.
      if (!human && !waiting) stopPolling();
    }

    launch.addEventListener('click', function () { openChat(); });
    $('.chat-close', panel).addEventListener('click', closeChat);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) closeChat();
    });

    /* Anything anywhere on the page can open the chat by carrying
       data-open-chat, and the attribute's value becomes the opening line.
       Delegated on document on purpose: the calculator result replaces its
       own markup after the estimate, so a listener bound to the button
       itself would not survive. */
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest && e.target.closest('[data-open-chat]');
      if (!trigger) return;
      e.preventDefault();
      if (open) { input.focus(); return; }
      openChat(trigger.getAttribute('data-open-chat') || '');
    });

    // A conversation already under way should resume itself, so an advisor's
    // reply is not lost because the visitor changed page.
    if (session) {
      pump().then(function () {
        if (human || waiting || seen > 0) { startPolling(); }
      });
    }
  }

  /* ---------------------------------------------------------
     boot
     --------------------------------------------------------- */
  function boot() {
    initConsent();                 // first: nothing may track before this runs
    initHeader();
    initHeadline();
    initTicker();
    initSpotlight();
    initShards();
    parallax.init();
    initMomentum();
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
    initOptOut();
    initFigureOffers();
    initVisitorCapture();
    initApplication();
    initChat();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
