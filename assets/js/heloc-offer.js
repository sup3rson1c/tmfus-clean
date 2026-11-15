/* Instant HELOC offer: /heloc-calculator (14 Nov 2026).

   The form posts to TMF OS (data-endpoint). TMF OS queues the request, its
   robot asks the lender, and this page polls for the answer every few
   seconds. The answer only ever carries the amount, the rate and the terms;
   the lender's own links and page never reach the browser.

   The token is kept in sessionStorage so a reload keeps waiting for the same
   answer instead of sending the form again. */
(function () {
  'use strict';
  var form = document.querySelector('[data-heloc-offer]');
  if (!form) return;
  var card = form.parentNode;
  var out = card.querySelector('[data-result]');
  var errEl = form.querySelector('[data-err]');
  var btn = form.querySelector('[data-submit]');
  var URL_ = form.getAttribute('data-endpoint');
  var KEY = 'tmf-heloc-token';
  /* Only the states our lending partner takes (read 15 Nov 2026; the TMF OS
     state list is the master copy, keep the two the same).
     New York included. */
  var STATES = [['AL', 'Alabama'], ['AK', 'Alaska'], ['AR', 'Arkansas'], ['CO', 'Colorado'],
    ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'],
    ['GA', 'Georgia'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KY', 'Kentucky'],
    ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'],
    ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'],
    ['NH', 'New Hampshire'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'],
    ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
    ['SC', 'South Carolina'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['WA', 'Washington'],
    ['WI', 'Wisconsin'], ['WY', 'Wyoming']];
  var sel = form.querySelector('[name="state"]');
  STATES.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s[0];
    o.textContent = s[1];
    sel.appendChild(o);
  });

  /* Three short steps (16 Nov 2026, John: the one long form "looks
     boring"). Continue checks only the boxes on its own step; the bar and
     the dots show how far along the visitor is. */
  var STEP_ERR = {
    email: 'Please enter a valid email address.',
    phone: 'Please enter a 10-digit mobile number.',
    zip: 'Please enter a 5-digit ZIP code.'
  };
  var stepAt = 1;
  var steps = form.querySelectorAll('[data-hx-step]');
  Array.prototype.forEach.call(steps, function (st) {
    if (!st.querySelector('[data-err]')) {
      var e = document.createElement('p');
      e.className = 'err';
      e.setAttribute('role', 'alert');
      e.setAttribute('data-hx-err', '');
      st.insertBefore(e, st.querySelector('.hx-nav, .hx-next'));
    }
  });
  function stepErr(st) { return st.querySelector('[data-err], [data-hx-err]'); }
  function checkStep(st) {
    var bad = null, msg = '';
    Array.prototype.forEach.call(st.querySelectorAll('[required]'), function (el) {
      var val = el.value.trim();
      var ok = el.type === 'checkbox' ? el.checked : val !== '';
      if (ok && el.name === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
      if (ok && el.name === 'phone') ok = val.replace(/\D/g, '').length >= 10;
      if (ok && el.name === 'zip') ok = /^\d{5}$/.test(val);
      el.classList.toggle('invalid', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) {
        bad = el;
        msg = el.type === 'checkbox' ? 'Please tick the box so we can check your offer.'
          : (val && STEP_ERR[el.name]) || 'Please fill in every box marked *.';
      }
    });
    stepErr(st).textContent = msg;
    if (bad) bad.focus();
    return !bad;
  }
  function goStep(n) {
    stepAt = n;
    Array.prototype.forEach.call(steps, function (st) {
      var k = Number(st.getAttribute('data-hx-step'));
      st.hidden = k !== n;
      if (k === n) {
        st.classList.remove('is-in');
        void st.offsetWidth;
        st.classList.add('is-in');
      }
    });
    Array.prototype.forEach.call(form.querySelectorAll('[data-hx-dot]'), function (d) {
      var k = Number(d.getAttribute('data-hx-dot'));
      d.className = k < n ? 'is-done' : k === n ? 'is-now' : '';
    });
    var bar = form.querySelector('[data-hx-bar]');
    if (bar) bar.style.width = (n / steps.length * 100) + '%';
    var top = form.getBoundingClientRect().top;
    if (top < 0) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    var first = steps[n - 1] && steps[n - 1].querySelector('input, select');
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
  }
  form.addEventListener('click', function (e) {
    var t = e.target.closest('[data-hx-next], [data-hx-back]');
    if (!t) return;
    if (t.hasAttribute('data-hx-back')) { goStep(Math.max(1, stepAt - 1)); return; }
    if (checkStep(steps[stepAt - 1])) goStep(Math.min(steps.length, stepAt + 1));
  });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && stepAt < steps.length && e.target.tagName === 'INPUT') {
      e.preventDefault();
      if (checkStep(steps[stepAt - 1])) goStep(stepAt + 1);
    }
  });
  if (steps.length) goStep(1);

  var Q = '’';
  var usd = function (n) { return '$' + Math.round(Number(n)).toLocaleString('en-US'); };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; };
  var store = {
    get: function () { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } },
    set: function (v) { try { sessionStorage.setItem(KEY, v); } catch (e) { /* private mode */ } },
    clear: function () { try { sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  };

  /* The waiting screen (16 Nov 2026, John: "I don't want people to leave
     the website instantly after filling it"). Built once and then only
     updated, so its animations run smoothly instead of restarting on every
     poll. The ring fills on a curve that slows down (it never claims 100%
     until the answer is here), the steps tick over, a "good to know" line
     changes every few seconds, the tab title counts the minutes, and the
     browser asks before the page is closed. */
  var STEPS = [[0, 'We received your details'], [6, 'Checking your state'],
    [16, 'AI is valuing your property'], [38, 'AI is checking the numbers'],
    [62, 'Waiting for the lender' + Q + 's answer']];
  var TIPS = [
    'This is a soft credit check. It does not affect your credit score.',
    'AI values your property. No appraisal appointment, nobody visits.',
    'Lines run from $25K up to $750K, with 10 to 30 year terms.',
    'Nothing is final until you choose an offer and say yes.',
    'Property equity usually prices below unsecured business credit.',
    'A TMF specialist calls you to walk through every option.'
  ];
  var RING = 2 * Math.PI * 52;
  var started = 0;
  var ahead = 0;
  var tick = null;
  var tipAt = 0;
  var baseTitle = document.title;

  function show(html) {
    form.hidden = true;
    out.hidden = false;
    out.innerHTML = html;
  }

  function guard(e) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  function pct() {
    var secs = (Date.now() - started) / 1000;
    return 95 * (1 - Math.exp(-secs / 110));
  }

  function clock() {
    var s = Math.max(0, Math.floor((Date.now() - started) / 1000));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function buildWaiting() {
    show('<div class="hw">' +
      '<div class="hw-visual" aria-hidden="true">' +
        '<svg viewBox="0 0 120 120" class="hw-ring">' +
          '<circle class="hw-track" cx="60" cy="60" r="52"/>' +
          '<circle class="hw-fill" cx="60" cy="60" r="52" stroke-dasharray="' + RING.toFixed(1) +
            '" stroke-dashoffset="' + RING.toFixed(1) + '"/>' +
        '</svg>' +
        '<svg viewBox="0 0 48 48" class="hw-house">' +
          '<path class="hw-roof" d="M6 23 24 8l18 15"/>' +
          '<path class="hw-walls" d="M11 20v19h26V20"/>' +
          '<rect class="hw-glow" x="20" y="26" width="8" height="13" rx="1"/>' +
        '</svg>' +
        '<span class="hw-orbit"><i></i></span>' +
        '<span class="hw-pct" data-hw-pct>0%</span>' +
      '</div>' +
      '<h3 class="h3 hw-title" data-hw-title>Checking your offer&hellip;</h3>' +
      '<p class="muted hw-sub" data-hw-sub></p>' +
      '<ol class="heloc-steps" role="list" data-hw-steps>' +
        STEPS.map(function (s) { return '<li>' + s[1] + '</li>'; }).join('') +
      '</ol>' +
      '<div class="hw-tip"><span class="hw-tip__label">Good to know</span>' +
        '<p data-hw-tip>' + TIPS[0] + '</p></div>' +
      '<p class="small muted hw-clock">Time so far <b data-hw-clock>0:00</b>. Please keep this page open.</p>' +
    '</div>');
    window.addEventListener('beforeunload', guard);
    tick = setInterval(update, 500);
    update();
  }

  function update() {
    var p = ahead ? Math.min(pct(), 5) : pct();
    var fill = out.querySelector('.hw-fill');
    if (!fill) return;
    fill.style.strokeDashoffset = (RING * (1 - p / 100)).toFixed(1);
    out.querySelector('[data-hw-pct]').textContent = Math.floor(p) + '%';
    var at = 0;
    STEPS.forEach(function (s, i) { if (p >= s[0]) at = i; });
    Array.prototype.forEach.call(out.querySelectorAll('[data-hw-steps] li'), function (li, i) {
      li.className = i < at ? 'is-done' : i === at ? 'is-now' : '';
    });
    out.querySelector('[data-hw-title]').textContent =
      ahead ? 'You' + Q + 're next in line' : STEPS[at][1] + '\u2026';
    out.querySelector('[data-hw-sub]').textContent = ahead
      ? 'You are number ' + (ahead + 1) + ' in line. It starts in a minute or two.'
      : 'This usually takes about 3 minutes. Your offer appears right here.';
    out.querySelector('[data-hw-clock]').textContent = clock();
    var t = Math.floor((Date.now() - started) / 7000) % TIPS.length;
    if (t !== tipAt) {
      tipAt = t;
      var tip = out.querySelector('[data-hw-tip]');
      tip.classList.add('is-out');
      setTimeout(function () { tip.textContent = TIPS[t]; tip.classList.remove('is-out'); }, 350);
    }
    document.title = '(' + clock() + ') Checking your offer\u2026';
  }

  function waiting(n) {
    ahead = n || 0;
    if (!out.querySelector('.hw')) buildWaiting();
    else update();
  }

  /* The answer is in: fill the ring, then show it. */
  function finish(render) {
    window.removeEventListener('beforeunload', guard);
    if (tick) clearInterval(tick);
    tick = null;
    var fill = out.querySelector('.hw-fill');
    if (fill) {
      fill.style.strokeDashoffset = '0';
      out.querySelector('[data-hw-pct]').textContent = '100%';
      out.querySelector('[data-hw-title]').textContent = 'Your answer is ready';
      Array.prototype.forEach.call(out.querySelectorAll('[data-hw-steps] li'), function (li) {
        li.className = 'is-done';
      });
      setTimeout(render, 900);
    } else {
      render();
    }
    document.title = 'Your HELOC answer is ready \u00b7 TMF Team';
    setTimeout(function () { document.title = baseTitle; }, 15000);
  }

  /* The answer (16 Nov 2026, John: the plain table "looks bland and
     boring", make it alive and add the lender's amount slider). The amount
     counts up, a slider picks how much to draw, and each term card shows
     the monthly payment for that amount. Payments scale from the lender's
     own monthly figure for the full line (it already includes their fees);
     a term with no monthly figure is worked out from its rate. */
  function payFor(o, amt, max) {
    if (o.monthly && max) return o.monthly * amt / max;
    var r = Number(o.rate) / 100 / 12, n = Number(o.years) * 12;
    if (!r || !n) return 0;
    return amt * r / (1 - Math.pow(1 + r, -n));
  }

  function countUp(el, to) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !window.requestAnimationFrame) { el.textContent = usd(to); el.classList.add('is-landed'); return; }
    var t0 = null, dur = 1400;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur);
      el.textContent = usd(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
      else el.classList.add('is-landed');
    }
    requestAnimationFrame(step);
  }

  function offers(r) {
    var max = Math.round(Number(r.cash_max) || 0);
    var list = (r.offers || []).filter(function (o) { return o && o.rate; })
      .sort(function (a, b) { return b.years - a.years; });
    var floor = Math.ceil(Math.max(15000, Number(r.cash_min) || 0) / 1000) * 1000;
    if (floor >= max) floor = max;
    var bestRate = Math.min.apply(null, list.map(function (o) { return Number(o.rate); }));
    var pick = 0;
    list.forEach(function (o, i) { if (o.years === r.best_years) pick = i; });
    var check = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7"/></svg>';

    show('<div class="ho">' +
      '<div class="ho-hero">' +
        '<span class="ho-badge">' + check + 'You pre-qualify</span>' +
        '<p class="ho-kicker">Your line can go up to</p>' +
        '<p class="heloc-amount ho-max" data-ho-count>$0</p>' +
        (list.length ? '<p class="ho-sub">Rates from <b>' + bestRate.toFixed(2) + '%</b> fixed &middot; ' +
          list.length + ' terms to choose from &middot; soft check only</p>' : '') +
      '</div>' +
      (floor < max ?
      '<div class="ho-pick">' +
        '<div class="ho-pick__top"><label for="ho-amt">How much do you want?</label>' +
          '<output class="ho-amt" for="ho-amt" data-ho-amt>' + usd(max) + '</output></div>' +
        '<input type="range" id="ho-amt" class="ho-range" min="' + floor + '" max="' + max +
          '" step="1" value="' + max + '" data-ho-range>' +
        '<div class="ho-range__ends"><span>' + usd(floor) + '</span><span>' + usd(max) + '</span></div>' +
      '</div>' : '') +
      (list.length ?
      '<p class="ho-label">Pick your term</p>' +
      '<div class="ho-terms" role="radiogroup" aria-label="Term">' +
        list.map(function (o, i) {
          var best = i === pick; // one tag only: several terms can share the lowest rate
          return '<button type="button" class="ho-term' + (best ? ' is-best' : '') +
            '" role="radio" data-ho-term="' + i + '">' +
            (best ? '<span class="ho-term__tag">Best rate</span>' : '') +
            '<span class="ho-term__yrs">' + esc(o.years) + ' years</span>' +
            '<span class="ho-term__pay"><b data-ho-pay></b><small>/mo</small></span>' +
            '<span class="ho-term__rate">' + Number(o.rate).toFixed(2) + '% ' + esc(o.type || 'fixed') + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="ho-sum" data-ho-sum aria-live="polite"></p>' : '') +
      '<a class="btn btn--primary btn--lg btn--block ho-cta" href="/contact">Talk to a specialist about this offer</a>' +
      '<p class="muted ho-next">A TMF specialist will call you shortly to go over these offers and the next step. ' +
        'Nothing is final until you choose an offer.</p>' +
      '<p class="small muted">This is a pre-qualification, not a commitment to lend. Payments are estimates for the ' +
        'amount you pick. Final terms depend on the lender' + Q + 's review and verification. Borrowing against your ' +
        'property puts it at risk.</p>' +
    '</div>');

    countUp(out.querySelector('[data-ho-count]'), max);
    var range = out.querySelector('[data-ho-range]');
    var cards = out.querySelectorAll('[data-ho-term]');
    var amt = max;

    function paint() {
      if (range) {
        var p = (amt - floor) / Math.max(1, max - floor) * 100;
        range.style.setProperty('--p', p.toFixed(2) + '%');
        out.querySelector('[data-ho-amt]').textContent = usd(amt);
      }
      Array.prototype.forEach.call(cards, function (c, i) {
        var on = i === pick;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
        c.tabIndex = on ? 0 : -1;
        c.querySelector('[data-ho-pay]').textContent = usd(payFor(list[i], amt, max));
      });
      var o = list[pick], sum = out.querySelector('[data-ho-sum]');
      if (o && sum) {
        sum.innerHTML = '<b>' + usd(amt) + '</b> over <b>' + esc(o.years) + ' years</b> at ' +
          Number(o.rate).toFixed(2) + '% ' + esc(o.type || 'fixed') + ' is about <b class="ho-sum__pay">' +
          usd(payFor(o, amt, max)) + ' a month</b>.';
      }
    }
    if (range) {
      range.addEventListener('input', function () {
        var v = Number(range.value);
        amt = v >= max - 250 ? max : Math.round(v / 500) * 500;
        if (amt < floor) amt = floor;
        paint();
      });
    }
    out.addEventListener('click', function (e) {
      var c = e.target.closest('[data-ho-term]');
      if (!c) return;
      pick = Number(c.getAttribute('data-ho-term'));
      paint();
      c.classList.remove('is-pop');
      void c.offsetWidth;
      c.classList.add('is-pop');
    });
    out.addEventListener('keydown', function (e) {
      if (!e.target.closest('[data-ho-term]') || !cards.length) return;
      var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
        : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      pick = (pick + d + cards.length) % cards.length;
      paint();
      cards[pick].focus();
    });
    paint();
  }
  // Local preview only: lets a test page draw an answer without a live run.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__helocOffers = offers;

  function done(title, text) {
    show('<h3 class="h3">' + title + '</h3><p class="muted">' + text + '</p>' +
      '<a class="btn btn--ghost btn--lg btn--block" href="/contact">Talk to a specialist now</a>');
  }

  function poll(token) {
    fetch(URL_ + '/' + encodeURIComponent(token), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r.state === 'waiting' || r.state === 'working') {
          waiting(r.state === 'waiting' ? r.ahead : 0);
          setTimeout(function () { poll(token); }, 4000);
          return;
        }
        store.clear();
        finish(function () {
          if (r.state === 'offers') {
            offers(r);
          } else if (r.state === 'no_offer') {
            done('No home-equity offer this time.',
              'The lender couldn' + Q + 't make a home-equity offer on these details today. That doesn' + Q +
              't close the door: a TMF specialist will call you about the other ways we can fund your business.');
          } else {
            done('Thanks, we' + Q + 're on it.',
              'We have your details, and a specialist is finishing this one by hand. Expect a call shortly, ' +
              'usually within the hour during business hours.');
          }
          out.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
      })
      .catch(function () {
        waiting(0);
        setTimeout(function () { poll(token); }, 8000);
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // Every step again, in order; jump back to the first one with a gap.
    for (var k = 0; k < steps.length; k++) {
      if (!checkStep(steps[k])) {
        if (k + 1 !== stepAt) { goStep(k + 1); checkStep(steps[k]); }
        return;
      }
    }
    errEl.textContent = '';
    var v = function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? el.value.trim() : '';
    };
    var body = {
      first_name: v('first_name'), last_name: v('last_name'), email: v('email'),
      phone: v('phone'), dob: v('dob'), business: v('business'),
      street: v('street'), city: v('city'), state: v('state'), zip: v('zip'),
      monthly_revenue: v('monthly_revenue').replace(/[^0-9.]/g, ''),
      home_value: v('home_value').replace(/[^0-9.]/g, ''),
      consent: form.querySelector('[name="consent"]').checked,
      consent_text: (form.querySelector('[data-consent-text]').textContent || '').replace(/\s+/g, ' ').trim(),
      company_website: v('company_website')
    };
    btn.disabled = true;
    var label = btn.innerHTML;
    btn.textContent = 'Sending…';
    var failed = false;
    fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) { failed = true; throw new Error(r.error || 'Something went wrong. Please try again.'); }
        store.set(r.token);
        started = Date.now();
        try { sessionStorage.setItem(KEY + '-at', String(started)); } catch (e2) { /* private mode */ }
        waiting(0);
        poll(r.token);
      })
      .catch(function (err) {
        errEl.textContent = failed ? err.message
          : 'We could not reach our system just now. Please try again in a moment, or call us.';
        btn.disabled = false;
        btn.innerHTML = label;
      });
  });

  var saved = store.get();
  if (saved) {
    started = Date.now();
    try { started = Number(sessionStorage.getItem(KEY + '-at')) || started; } catch (e) { /* private mode */ }
    waiting(0);
    poll(saved);
  }
})();
