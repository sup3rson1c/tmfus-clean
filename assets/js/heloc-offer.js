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
  var STATES = ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN ' +
    'MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY').split(' ');
  var sel = form.querySelector('[name="state"]');
  STATES.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s;
    o.textContent = s;
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

  var STEPS = ['We received your details', 'Checking your state', 'Valuing your home',
    'Sending your request to the lender', 'Waiting for the lender' + Q + 's answer'];
  var started = 0;

  function show(html) {
    form.hidden = true;
    out.hidden = false;
    out.innerHTML = html;
  }

  function waiting(ahead) {
    var secs = (Date.now() - started) / 1000;
    var at = ahead ? 0 : Math.min(STEPS.length - 1, 1 + Math.floor(secs / 35));
    var list = STEPS.map(function (s, i) {
      return '<li class="' + (i < at ? 'is-done' : i === at ? 'is-now' : '') + '">' + s + '</li>';
    }).join('');
    show('<h3 class="h3">Checking your offer&hellip;</h3>' +
      '<p class="muted">' + (ahead ? 'You are number ' + (ahead + 1) + ' in line. ' : '') +
      'This usually takes 2 to 5 minutes. Keep this page open; your answer appears right here.</p>' +
      '<ol class="heloc-steps" role="list">' + list + '</ol>');
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
    waiting(0);
    poll(saved);
  }
})();
