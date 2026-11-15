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
  /* Only the states our lender lets us send (Figure's exempt list, read
     15 Nov 2026; tmf-os clicker/figure_states.py is the master copy, keep
     the two the same). New York included. */
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
    [16, 'Valuing your home'], [38, 'Sending your request to the lender'],
    [62, 'Waiting for the lender' + Q + 's answer']];
  var TIPS = [
    'This is a soft credit check. It does not affect your credit score.',
    'Your home is valued automatically. No appraisal appointment, nobody visits.',
    'Lines run from $25K up to $750K, with 10 to 30 year terms.',
    'Nothing is final until you choose an offer and say yes.',
    'Home equity usually prices below unsecured business credit.',
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
      : 'This usually takes 2 to 5 minutes. Your offer appears right here.';
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

  function offers(r) {
    var list = r.offers || [];
    var rows = list.map(function (o) {
      var amt = o.max ? usd(o.min) + ' &ndash; ' + usd(o.max) : usd(o.monthly) + '/mo';
      return '<tr><td>' + esc(o.years) + '-year ' + esc(o.type || 'fixed') + '</td><td>' +
        Number(o.rate).toFixed(2) + '%</td><td>' + amt + '</td></tr>';
    }).join('');
    var head = (list[0] && list[0].max) ? 'Amount' : 'Payment';
    show('<p class="eyebrow">You pre-qualify</p>' +
      '<p class="heloc-amount">Up to ' + usd(r.cash_max) + '</p>' +
      '<p class="lede">Rates from <strong>' + Number(r.best_rate).toFixed(2) + '%</strong> (' +
      esc(r.best_years) + '-year fixed).</p>' +
      (rows ? '<table class="heloc-terms"><thead><tr><th>Term</th><th>Rate</th><th>' + head +
        '</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      '<p class="muted">A TMF specialist will call you shortly to go over these offers and the next step. ' +
      'Nothing is final until you choose an offer.</p>' +
      '<p class="small muted">This is a pre-qualification, not a commitment to lend. Final terms depend on the ' +
      'lender' + Q + 's review and verification. Borrowing against your home puts your home at risk.</p>');
  }

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
    var bad = null;
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      var ok = el.type === 'checkbox' ? el.checked : el.value.trim() !== '';
      el.classList.toggle('invalid', !ok);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = el;
    });
    if (bad) {
      errEl.textContent = bad.type === 'checkbox'
        ? 'Please tick the box so we can check your offer.'
        : 'Please fill in every box marked *.';
      bad.focus();
      return;
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
