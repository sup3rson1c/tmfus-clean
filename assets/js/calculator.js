/* TMF Team — funding calculator (cash injection estimator).

   The look is the new design's: a stepped form beside a "certificate" that
   fills in as you answer. Every rule behind it is the live site's, called
   through window.TMFEngine (engine.js, generated from the live app.js):

     - the projection formula and ±15% range   → TMFEngine.estimateAdvance
     - which products fit                       → TMFEngine.matchProducts
     - lead capture (own store + Google Sheet)  → TMFEngine.sendLead
     - the email rule and its exact wording     → TMFEngine.isEmail / EMAIL_ERROR

   Nothing here re-implements a business rule. If a number is wrong, fix it in
   the live app.js and re-run tools/vendor-engine.py.

   Flow, as on the live site: the numbers first, then who you are, and the
   range is shown only once contact details are in. The products that fit
   update live from step 1, so the visitor sees value before being asked. */
(() => {
  // Values are the ones the live calculator reports, so the engine reads them unchanged.
  const CREDIT = [["500", "500–549"], ["550", "550–599"], ["600", "600–649"], ["650", "650–699"], ["700", "700–749"], ["750", "750+"]];
  const INDUSTRY = [["restaurant", "Restaurant"], ["retail", "Retail"], ["construction", "Construction"], ["trucking", "Trucking"], ["healthcare", "Healthcare"], ["wholesale", "Wholesale"], ["salon", "Salon / spa"], ["other", "Other"]];
  const TIME = [["0", "Under 6 months"], ["0.5", "6–12 months"], ["1", "1–2 years"], ["2", "2–5 years"], ["5", "5+ years"]];
  const POSITIONS = [["0", "None"], ["1", "1 position"], ["2", "2 positions"], ["3", "3 or more"]];
  const STEPS = ["Revenue & credit", "Your business", "What you owe", "Your answer"];
  const LAST = STEPS.length;

  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const digits = (v) => Number(String(v ?? "").replace(/[^\d]/g, "")) || 0;
  const labelOf = (list, v) => (list.find(([k]) => k === v) || [null, "Not set"])[1];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const E = () => window.TMFEngine;

  const choices = (name, list, cols, legend, help = "") => `
    <fieldset class="field choices" id="calc-${name}" aria-describedby="calc-${name}-err${help ? ` calc-${name}-help` : ""}">
      <legend class="label">${legend}</legend>
      <div class="choice-grid choice-grid--${cols}">
        ${list.map(([v, t]) => `<label class="choice"><input type="radio" name="${name}" value="${v}"><span>${t}</span></label>`).join("")}
      </div>
      ${help ? `<p class="help" id="calc-${name}-help">${help}</p>` : ""}
      <p class="error" id="calc-${name}-err" hidden></p>
    </fieldset>`;

  const moneyField = (name, labelText, help) => `
    <div class="field">
      <label class="label" for="calc-${name}">${labelText}</label>
      <div class="input-affix">
        <span class="input-affix__pre" aria-hidden="true">$</span>
        <input class="input input--money" id="calc-${name}" name="${name}" inputmode="numeric" autocomplete="off" placeholder="0" aria-describedby="calc-${name}-help calc-${name}-err">
      </div>
      <p class="help" id="calc-${name}-help">${help}</p>
      <p class="error" id="calc-${name}-err" hidden></p>
    </div>`;

  const textField = (name, labelText, { type = "text", auto = "", mode = "", req = true, help = "", full = false } = {}) => `
    <div class="field${full ? " field--full" : ""}">
      <label class="label" for="calc-${name}">${labelText}${req ? '<span class="req" aria-hidden="true">*</span>' : ' <span class="muted">(optional)</span>'}</label>
      <input class="input" id="calc-${name}" name="${name}" type="${type}"${auto ? ` autocomplete="${auto}"` : ""}${mode ? ` inputmode="${mode}"` : ""} aria-describedby="${help ? `calc-${name}-help ` : ""}calc-${name}-err">
      ${help ? `<p class="help" id="calc-${name}-help">${help}</p>` : ""}
      <p class="error" id="calc-${name}-err" hidden></p>
    </div>`;

  /* Certificate mark: a small guilloché band. Once there is a result it is
     re-cut from the answers: lobes from revenue, tracks from time in business. */
  const band = ({ K = 4, m = 18 } = {}) => {
    const N = 240;
    let paths = "";
    for (let family = 0; family < 2; family++) {
      for (let i = 0; i < K; i++) {
        const base = 46 + (24 * i) / Math.max(K - 1, 1);
        const phase = ((family ? -1 : 1) * i * Math.PI * 2) / K;
        let d = "";
        for (let j = 0; j <= N; j++) {
          const phi = (j / N) * Math.PI * 2;
          const r = base + 3.2 * Math.cos(m * phi + phase);
          d += `${j ? "L" : "M"}${(Math.sin(phi) * r).toFixed(1)} ${(-Math.cos(phi) * r).toFixed(1)}`;
        }
        paths += `<path d="${d}"/>`;
      }
    }
    return `${paths}<circle r="76"/>`;
  };
  const seed = (a) => {
    const years = { 0: 0, 0.5: 1, 1: 2, 2: 3, 5: 4 }[a.tib] ?? 2;
    const scale = Math.min(Math.max(Math.log10(Math.max(a.revenue, 1)) - 3, 0), 3);
    return { K: 2 + years, m: 12 + Math.round(scale * 4) };
  };
  const rosette = () =>
    `<svg class="certificate__mark" viewBox="-80 -80 160 160" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width=".6">${band()}</g></svg>`;

  function template() {
    return `
    <div class="calc">
      <form class="card calc__form" novalidate>
        <ol class="stepper" role="list">
          ${STEPS.map((s, i) => `<li class="stepper__item"${i === 0 ? ' aria-current="step"' : ""}><span class="stepper__num">0${i + 1}</span><span class="stepper__label">${s}</span></li>`).join("")}
        </ol>
        <p class="sr-only" aria-live="polite" data-calc-progress>Step 1 of ${LAST}: ${STEPS[0]}</p>

        <fieldset class="calc__step" data-step="1">
          <legend class="h3 calc__legend">Revenue and credit</legend>
          ${moneyField("revenue", "Average monthly revenue", "Total deposits into your business bank account in a typical month.")}
          ${choices("credit", CREDIT, 3, "Credit score", "Your best estimate is fine. This never touches your credit file.")}
        </fieldset>

        <fieldset class="calc__step" data-step="2" hidden>
          <legend class="h3 calc__legend">Your business</legend>
          ${choices("industry", INDUSTRY, 4, "Industry")}
          ${choices("tib", TIME, 5, "Time in business")}
        </fieldset>

        <fieldset class="calc__step" data-step="3" hidden>
          <legend class="h3 calc__legend">What you still owe</legend>
          ${choices("positions", POSITIONS, 4, "Existing cash advance (MCA) positions")}
          <div data-balance hidden>
            ${moneyField("balance", "Total outstanding balance on those positions", "The combined payoff amount still owed. This is deducted from your available funding.")}
          </div>
        </fieldset>

        <fieldset class="calc__step" data-step="4" hidden>
          <legend class="h3 calc__legend">Where should we send your answer?</legend>
          <div class="form-grid">
            ${textField("first", "First name", { auto: "given-name" })}
            ${textField("last", "Last name", { auto: "family-name" })}
            ${textField("business", "Business name", { auto: "organization", full: true })}
            ${textField("email", "Email address", { type: "email", auto: "email", mode: "email" })}
            ${textField("phone", "Phone number", { type: "tel", auto: "tel", mode: "tel", req: false, help: "Optional, but it is the fastest way for a specialist to reach you." })}
          </div>
          <label class="check calc__sms"><input type="checkbox" name="sms"><span class="check__text"><strong>Yes, you can text me about my application.</strong> Faster updates straight to your phone. Reply STOP anytime to opt out.</span></label>
          <p class="small muted calc__consent">By continuing you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>, and you agree that TMF Team and its funding partners may contact you about this enquiry by phone, email and text, and may share your details with funding partners so they can make you an offer. Not a condition of funding.</p>
          <p class="error" data-calc-send-err hidden></p>
        </fieldset>

        <div class="calc__nav">
          <button class="btn btn--ghost" type="button" data-calc-back hidden>Back</button>
          <button class="btn btn--primary" type="submit" data-calc-next>Continue</button>
        </div>
      </form>

      <aside class="calc__result" aria-labelledby="calc-result-title">
        <div class="certificate" data-state="idle">
          ${rosette()}
          <div class="certificate__head">
            <h3 class="certificate__title" id="calc-result-title" tabindex="-1">Your projection</h3>
            <span class="tag" data-result-tag>Step 1 of ${LAST}</span>
          </div>
          <div class="certificate__figure" data-result-figure>
            <p class="certificate__range certificate__range--empty" aria-hidden="true">$ ___,___</p>
            <p class="certificate__sub">Answer a few short questions to see an indicative range and the products that fit.</p>
          </div>
          <dl class="certificate__inputs">
            <div><dt>Monthly revenue</dt><dd data-sum="revenue">Not set</dd></div>
            <div><dt>Credit score</dt><dd data-sum="credit">Not set</dd></div>
            <div><dt>Industry</dt><dd data-sum="industry">Not set</dd></div>
            <div><dt>Time in business</dt><dd data-sum="tib">Not set</dd></div>
            <div><dt>Open positions</dt><dd data-sum="positions">Not set</dd></div>
          </dl>
          <div data-result-extra hidden></div>
          <div data-result-products hidden></div>
          <div data-result-actions hidden></div>
          <p class="sr-only" role="status" data-calc-status></p>
        </div>
      </aside>
    </div>`;
  }

  function init(host) {
    host.innerHTML = template();
    const form = host.querySelector("form");
    const steps = [...form.querySelectorAll("[data-step]")];
    const stepper = [...form.querySelectorAll(".stepper__item")];
    const back = form.querySelector("[data-calc-back]");
    const next = form.querySelector("[data-calc-next]");
    const balanceWrap = form.querySelector("[data-balance]");
    const sendErr = form.querySelector("[data-calc-send-err]");
    const cert = host.querySelector(".certificate");
    const tag = host.querySelector("[data-result-tag]");
    const figure = host.querySelector("[data-result-figure]");
    const extra = host.querySelector("[data-result-extra]");
    const products = host.querySelector("[data-result-products]");
    const actions = host.querySelector("[data-result-actions]");
    const status = host.querySelector("[data-calc-status]");
    let step = 1;
    let completed = false;
    let sentFor = ""; // the contact details a lead was last sent for

    // Carry over who they are if they told us elsewhere on the site. Never overwrites.
    try {
      const v = E()?.readVisitor?.() || {};
      [["first", v.first || v.firstName], ["last", v.last || v.lastName], ["business", v.business], ["email", v.email], ["phone", v.phone]].forEach(([k, val]) => {
        const el = form.elements[k];
        if (el && !el.value && val) el.value = val;
      });
    } catch {
      /* no memory available */
    }

    const read = () => {
      const f = new FormData(form);
      const num = (k) => (f.get(k) == null ? null : Number(f.get(k)));
      const positions = num("positions");
      return {
        revenue: digits(f.get("revenue")),
        credit: num("credit"),
        industry: f.get("industry") || null,
        tib: num("tib"),
        positions,
        balance: positions > 0 ? digits(f.get("balance")) : 0,
        first: String(f.get("first") || "").trim(),
        last: String(f.get("last") || "").trim(),
        business: String(f.get("business") || "").trim(),
        email: String(f.get("email") || "").trim(),
        phone: String(f.get("phone") || "").trim(),
        sms: f.get("sms") ? "yes" : "no",
      };
    };
    // The engine's profile shape, exactly as the live calculator builds it.
    const profile = (a) => ({ revenue: a.revenue, credit: a.credit, positions: a.positions, tib: a.tib, balance: a.balance, industry: a.industry });

    // Messages are the live site's wording.
    const errorsFor = (n, a) => {
      const e = [];
      if (n === 1) {
        if (!a.revenue) e.push(["revenue", "Enter your monthly revenue."]);
        if (a.credit == null) e.push(["credit", "Select a credit score range."]);
      } else if (n === 2) {
        if (!a.industry) e.push(["industry", "Choose the industry closest to your business."]);
        if (a.tib == null) e.push(["tib", "Select time in business."]);
      } else if (n === 3) {
        if (a.positions == null) e.push(["positions", "Select your MCA positions."]);
        else if (a.positions > 0 && !a.balance) e.push(["balance", "Enter the outstanding balance on your existing positions."]);
      } else if (n === 4) {
        ["first", "last", "business"].forEach((k) => {
          if (!a[k]) e.push([k, "Please complete the required fields."]);
        });
        if (!E()?.isEmail(a.email)) e.push(["email", E()?.EMAIL_ERROR || "Not a valid email address."]);
        const d = a.phone.replace(/\D/g, "");
        if (d.length > 0 && d.length < 10) e.push(["phone", "That phone number looks incomplete — leave it blank or enter 10 digits."]);
      }
      return e;
    };

    const clearError = (key) => {
      const target = form.querySelector(`#calc-${key}`);
      const err = form.querySelector(`#calc-${key}-err`);
      target?.removeAttribute("aria-invalid");
      if (err) {
        err.hidden = true;
        err.textContent = "";
      }
    };

    const showErrors = (errors) => {
      errors.forEach(([key, msg]) => {
        form.querySelector(`#calc-${key}`).setAttribute("aria-invalid", "true");
        const err = form.querySelector(`#calc-${key}-err`);
        err.textContent = msg;
        err.hidden = false;
      });
      const first = form.querySelector(`#calc-${errors[0][0]}`);
      (first.matches("input") ? first : first.querySelector("input")).focus();
    };

    const summarize = (a) => {
      const set = (k, v) => (host.querySelector(`[data-sum="${k}"]`).textContent = v);
      set("revenue", a.revenue ? `${money(a.revenue)}/mo` : "Not set");
      set("credit", labelOf(CREDIT, a.credit == null ? null : String(a.credit)));
      set("industry", labelOf(INDUSTRY, a.industry));
      set("tib", labelOf(TIME, a.tib == null ? null : String(a.tib)));
      set("positions", a.positions == null ? "Not set" : a.positions === 0 ? "None" : `${labelOf(POSITIONS, String(a.positions))}${a.balance ? ` · ${money(a.balance)} owed` : ""}`);
    };

    /* The products that fit, live from the first answer, as the live site
       showed them beside its calculator. Straight from the engine's catalogue. */
    const renderProducts = (a) => {
      if (!E() || !a.revenue) {
        products.hidden = true;
        return;
      }
      const list = E().matchProducts(profile(a));
      products.innerHTML = list.length
        ? `<p class="certificate__label">Products you may qualify for</p><ul class="matches" role="list">${list
            .map((p) => `<li><a class="matches__name" href="${esc(p.href)}">${esc(p.name)}</a><span class="tag tag--good">${esc(p.range)}</span><span class="matches__note">${esc(p.term)} · funded in ${esc(p.speed)}</span></li>`)
            .join("")}</ul>`
        : `<p class="certificate__label">Products you may qualify for</p><p class="certificate__sub">No product fits that profile yet. Speak with an advisor — compensating factors are often enough.</p>`;
      products.hidden = false;
    };

    const goTo = (n, focus = true) => {
      const dir = n > step ? 1 : -1;
      step = n;
      steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
      stepper.forEach((li, i) => {
        li.classList.toggle("is-done", i < n - 1);
        if (i === n - 1) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
      back.hidden = n === 1;
      next.textContent = n === LAST ? (completed ? "Update my answer" : "Get my answer") : "Continue";
      form.querySelector("[data-calc-progress]").textContent = `Step ${n} of ${LAST}: ${STEPS[n - 1]}`;
      if (!completed) {
        tag.textContent = n === LAST ? "Ready" : `Step ${n} of ${LAST}`;
        if (n === LAST) {
          cert.dataset.state = "ready";
          figure.innerHTML = `<p class="certificate__label">Your projection is ready</p><p class="certificate__range certificate__range--empty" aria-hidden="true">$ ___,___</p><p class="certificate__sub">Tell us where to send it and it appears here straight away. A funding specialist follows up within 24 hours.</p>`;
        }
      }
      const current = steps[n - 1];
      if (motionOK && window.gsap) window.gsap.fromTo(current, { opacity: 0, x: 24 * dir }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" });
      if (focus) current.querySelector("input")?.focus({ preventScroll: true });
    };

    const motion = () => window.TMF?.motion;

    // Keep the answers where the chat widget looks for them (live key: tmf_calc).
    const saveCalc = (a, extraFields) => {
      try {
        const p = profile(a);
        Object.keys(p).forEach((k) => (p[k] === null || p[k] === "" ? delete p[k] : 0));
        const prev = JSON.parse(sessionStorage.getItem("tmf_calc") || "{}");
        sessionStorage.setItem("tmf_calc", JSON.stringify(Object.assign({}, prev, p, extraFields || {}, { at: new Date().toISOString() })));
      } catch {
        /* storage unavailable */
      }
    };

    /* The lead, with the same keys the live calculator's collectFields()
       produced, so the leads sheet and api/lead.php see no difference. */
    const leadFrom = (a, est, matched) => {
      const lead = {
        revenue: form.elements.revenue.value,
        credit: String(a.credit),
        positions: String(a.positions),
        first: a.first,
        last: a.last,
        business: a.business,
        industry: a.industry,
        tib: String(a.tib),
        email: a.email,
        sms: a.sms,
      };
      if (a.positions > 0 && form.elements.balance.value) lead.balance = form.elements.balance.value;
      if (a.phone) lead.phone = a.phone;
      try {
        lead.estimate = JSON.stringify(est);
      } catch {
        /* ignore */
      }
      lead.matched = matched.map((x) => x.name || x.id).join(", ");
      return lead;
    };

    const renderResult = (a, announce = true) => {
      const eng = E();
      const est = eng.estimateAdvance(profile(a));
      const over = !!est && est.viable === false;
      const wasResult = cert.dataset.state === "result" || cert.dataset.state === "over";
      completed = true;
      cert.dataset.state = over ? "over" : "result";
      tag.textContent = "Projection";
      tag.className = "tag";

      if (over) {
        figure.innerHTML = `<p class="certificate__label">Projected range</p><p class="certificate__range certificate__range--text">Over leveraged</p><p class="certificate__sub">Based on what you owe against what you bring in, you are over leveraged for a new advance right now. A specialist can look at consolidation or a payoff structure — it is worth the conversation.</p>`;
      } else {
        if (!wasResult || !figure.querySelector("[data-low]")) {
          figure.innerHTML = `<p class="certificate__label">Projected range</p><p class="certificate__range"><span data-low></span><span class="certificate__dash">–</span><span data-high></span></p><p class="certificate__sub">A funding specialist will reach out within 24 hours to go through your options.</p>`;
        }
        const low = figure.querySelector("[data-low]");
        const high = figure.querySelector("[data-high]");
        if (motion()?.roll && announce) {
          motion().roll(low, money(est.low));
          motion().roll(high, money(est.high), { delay: 0.12 });
        } else {
          low.textContent = money(est.low);
          high.textContent = money(est.high);
        }
      }

      extra.innerHTML = `<dl class="certificate__inputs certificate__inputs--result">
          ${est && est.deduction > 0 ? `<div><dt>Less existing positions</dt><dd>− ${money(est.deduction)}</dd></div>` : ""}
          <div><dt>Typical decision</dt><dd>3–24h</dd></div>
        </dl>
        <p class="certificate__disclaimer"><strong>This is a projection, not an offer.</strong> The figures above are an estimate based on the details you entered. They are not a quote, not a commitment to lend, and not the exact amount you will be offered. Real terms depend on underwriting, your bank statements and the funder — and can land above or below this range.</p>`;
      extra.hidden = false;

      renderProducts(a);

      const mark = host.querySelector(".certificate__mark g");
      const cut = JSON.stringify(seed(a));
      if (mark && mark.dataset.cut !== cut) {
        mark.dataset.cut = cut;
        mark.innerHTML = band(seed(a));
        if (announce) motion()?.trace?.(mark.querySelectorAll("path"), { duration: 0.7 });
      }
      if (announce && !wasResult) motion()?.strike?.(products.querySelectorAll(".matches li"), { delay: 0.2, stagger: 0.04 });

      /* The ways forward, as the live result screen offers them. The HELOC
         option is shown from 650 up only: >= not >, because the "650 – 699"
         band reports 650. Numbers are generated, so below 650 the visitor
         sees 1 and 2, not a gap where 3 was. */
      const range = est && !over ? `${eng.usd(est.low)} – ${eng.usd(est.high)}` : "";
      const greeting = eng.attrEscape(`You have just run the cash injection calculator${range ? ` and it projected ${range}.` : "."}`);
      const chatBlurb = document.documentElement.getAttribute("data-chat-mode") === "message"
        ? "Opens the chat here on this page. Leave a message and an advisor comes back to you."
        : "Opens the chat here on this page. Ask anything; an advisor can join it.";
      /* No chat button if the chat is switched off: it would open onto
         nothing. The widget sets data-chat-mode only once chat.php says yes. */
      const chatOn = document.documentElement.hasAttribute("data-chat-mode");
      let n = 0;
      const opt = (inner, attrs, primary) =>
        `<${attrs.href ? "a" : "button"} class="decision-opt${primary ? " is-primary" : ""}" ${attrs.href ? `href="${attrs.href}"` : `type="button" data-open-chat="${attrs.chat}"`}><span class="decision-n">${++n}</span><span class="decision-txt">${inner}</span><span class="decision-arrow" aria-hidden="true">→</span></${attrs.href ? "a" : "button"}>`;
      actions.innerHTML = `<p class="certificate__label">Where would you like to go from here?</p><div class="decision">
          ${opt("<b>Apply now</b><span>Do you like the numbers? Start the application — about ten minutes.</span>", { href: "/apply" }, true)}
          ${chatOn ? opt(`<b>I am not sure yet — talk with us</b><span>${chatBlurb}</span>`, { chat: greeting }) : opt("<b>I am not sure yet — talk with us</b><span>Send a message and an advisor comes back to you within one business day.</span>", { href: "/contact" })}
          ${a.credit >= 650 ? opt("<b>Own your home?</b><span>Use your home equity — up to $750K, with an offer inside the hour.</span>", { href: "/heloc-calculator" }) : ""}
        </div>
        <button class="link-arrow certificate__edit" type="button" data-calc-edit>Edit my answers</button>`;
      actions.hidden = false;

      try {
        sessionStorage.setItem("tmf-estimate", JSON.stringify({ low: est ? est.low : 0, high: est ? est.high : 0, over }));
        document.dispatchEvent(new CustomEvent("tmf:estimate"));
      } catch {
        /* storage unavailable: Apply simply won't show it */
      }
      if (announce) {
        status.textContent = over
          ? "Over leveraged for a new advance right now. A specialist can talk you through consolidation."
          : `Projected range ${money(est.low)} to ${money(est.high)}.`;
      }
      return est;
    };

    /* Events */
    form.addEventListener("input", (e) => {
      const el = e.target;
      if (el.classList.contains("input--money")) {
        const n = digits(el.value);
        el.value = n ? n.toLocaleString("en-US") : "";
      }
      if (el.name === "phone") {
        const d = el.value.replace(/\D/g, "").slice(0, 10);
        el.value = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d.length ? `(${d}` : "";
      }
      if (el.name) clearError(el.name);
      if (el.name === "positions") {
        balanceWrap.hidden = el.value === "0";
        if (el.value === "0") form.elements.balance.value = "";
        clearError("balance");
      }
      const a = read();
      summarize(a);
      if (completed && [1, 2, 3].every((s) => !errorsFor(s, a).length)) renderResult(a, false);
      else renderProducts(a);
    });

    form.addEventListener("focusout", (e) => {
      if (e.target.name !== "email") return;
      const v = e.target.value.trim();
      if (v && !E()?.isEmail(v)) showErrors([["email", E().EMAIL_ERROR]]);
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const a = read();
      const errors = errorsFor(step, a);
      if (errors.length) return showErrors(errors);
      saveCalc(a);
      if (step < LAST) return goTo(step + 1);

      if (!E()) {
        sendErr.textContent = "The calculator did not load properly. Please refresh the page, or use the contact page.";
        sendErr.hidden = false;
        return;
      }
      sendErr.hidden = true;
      const est = renderResult(a);
      const matched = E().matchProducts(profile(a));
      const lead = leadFrom(a, est, matched);
      saveCalc(a, { contact: lead, estimate: lead.estimate || "", matched: lead.matched || "" });

      /* One lead per set of contact details. Editing the numbers afterwards
         re-draws the answer but does not re-send the same person. */
      const who = `${a.email}|${a.phone}|${a.first}|${a.last}|${a.business}`;
      if (who !== sentFor) {
        sentFor = who;
        E().sendLead("funding-calculator", lead).catch(() => {});
      }
      next.textContent = "Update my answer";
      if (window.matchMedia("(max-width: 1023px)").matches) {
        const opts = { offset: -88 };
        if (window.TMF?.lenis) window.TMF.lenis.scrollTo(cert, opts);
        else cert.scrollIntoView({ behavior: motionOK ? "smooth" : "auto", block: "start" });
      }
    });

    back.addEventListener("click", () => goTo(step - 1));
    actions.addEventListener("click", (e) => {
      if (e.target.closest("[data-calc-edit]")) goTo(1);
    });
  }

  const start = () => document.querySelectorAll("[data-calculator]").forEach(init);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
