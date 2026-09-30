/* TMF Team — shared behaviour: header, menus, accordions, reveals,
   smooth scrolling and front-end form validation. */
(() => {
  const root = document.documentElement;
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const TMF = (window.TMF = window.TMF || {});
  TMF.motionOK = motionOK;

  /* Header: solid once scrolled; hides on the way down, returns on the way up */
  const header = document.querySelector("[data-header]");
  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 24);
    // The 48-hour clock holds the header still while its hand is being dragged.
    const busy = header.classList.contains("is-open") || header.contains(document.activeElement) || TMF.holdHeader;
    if (!busy && y > 520 && y > lastY + 6) header.classList.add("is-hidden");
    else if (y < lastY - 6 || y <= 520) header.classList.remove("is-hidden");
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  header.addEventListener("focusin", () => header.classList.remove("is-hidden"));
  onScroll();

  /* Solutions disclosure menu */
  const menuItem = header.querySelector("[data-menu]");
  if (menuItem) {
    const btn = menuItem.querySelector("[data-menu-button]");
    const panel = menuItem.querySelector("[data-menu-panel]");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let closeTimer = 0;
    let hoverOpenedAt = 0;
    const setOpen = (open) => {
      clearTimeout(closeTimer);
      btn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    };
    btn.addEventListener("click", () => {
      // A mouse that just opened the menu by hovering should not immediately close it.
      if (Date.now() - hoverOpenedAt < 600) return setOpen(true);
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    menuItem.addEventListener("pointerenter", (e) => {
      if (!finePointer.matches || e.pointerType !== "mouse" || !panel.hidden) return;
      hoverOpenedAt = Date.now();
      setOpen(true);
    });
    menuItem.addEventListener("pointerleave", (e) => {
      if (!finePointer.matches || e.pointerType !== "mouse") return;
      // Forgiving enough to survive a pause on the way to a link.
      closeTimer = setTimeout(() => setOpen(false), 320);
    });
    menuItem.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) {
        setOpen(false);
        btn.focus();
      }
    });
    menuItem.addEventListener("focusout", (e) => {
      if (!menuItem.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener("click", (e) => {
      if (!menuItem.contains(e.target)) setOpen(false);
    });
    if (panel.querySelector('[aria-current="page"]')) btn.dataset.active = "";
  }

  /* Mobile menu sheet */
  const toggle = header.querySelector("[data-mobile-toggle]");
  const sheet = header.querySelector("[data-mobile-menu]");
  if (toggle && sheet) {
    const setSheet = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      sheet.hidden = !open;
      header.classList.toggle("is-open", open);
      root.classList.toggle("menu-open", open);
      TMF.lenis?.[open ? "stop" : "start"]();
      if (open) sheet.querySelector("a, button")?.focus();
    };
    toggle.addEventListener("click", () => setSheet(sheet.hidden));
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("a")) setSheet(false);
    });
    document.addEventListener("keydown", (e) => {
      if (sheet.hidden) return;
      if (e.key === "Escape") {
        setSheet(false);
        toggle.focus();
      } else if (e.key === "Tab") {
        const items = [toggle, ...sheet.querySelectorAll("a, button")];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", (m) => {
      if (m.matches && !sheet.hidden) setSheet(false);
    });
  }

  /* Accordions */
  document.querySelectorAll("[data-accordion]").forEach((acc) => {
    acc.addEventListener("click", (e) => {
      const trigger = e.target.closest(".accordion__trigger");
      if (!trigger) return;
      const open = trigger.getAttribute("aria-expanded") !== "true";
      trigger.setAttribute("aria-expanded", String(open));
      document.getElementById(trigger.getAttribute("aria-controls")).hidden = !open;
    });
  });

  /* Front-end form validation, shared by the contact form and Apply */
  const labelFor = (input) => {
    const label = input.id && document.querySelector(`label[for="${input.id}"]`);
    return (label ? label.firstChild.textContent : input.name).trim().toLowerCase();
  };
  const messageFor = (input) => {
    const value = input.type === "checkbox" ? input.checked : input.value.trim();
    if (input.required && !value) {
      if (input.dataset.required) return input.dataset.required;
      return input.tagName === "SELECT" ? `Choose ${labelFor(input)}.` : `Enter ${labelFor(input)}.`;
    }
    if (!value || input.type === "checkbox") return "";
    if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      return window.TMFEngine?.EMAIL_ERROR || "Not a valid email address.";
    }
    if (input.dataset.pattern && !new RegExp(input.dataset.pattern).test(value)) {
      return input.dataset.invalid || `Check ${labelFor(input)}.`;
    }
    return "";
  };
  const errorEl = (input) => {
    const ids = (input.getAttribute("aria-describedby") || "").split(" ");
    return document.getElementById(ids.find((id) => id.endsWith("-err")) || "");
  };
  TMF.forms = {
    check(input) {
      const msg = messageFor(input);
      const err = errorEl(input);
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
      if (err) {
        err.textContent = msg;
        err.hidden = !msg;
      }
      return !msg;
    },
    fields(scope) {
      return [...scope.querySelectorAll("input, select, textarea")].filter(
        (el) => !el.disabled && el.type !== "hidden" && !el.closest("[hidden]"),
      );
    },
    validate(scope) {
      return TMF.forms.fields(scope).filter((el) => !TMF.forms.check(el));
    },
    summarize(summary, invalid) {
      if (!summary) return invalid[0]?.focus();
      const list = invalid
        .map((el) => `<li><a href="${el.dataset.focus || `#${el.id}`}">${errorEl(el)?.textContent || "Check this field."}</a></li>`)
        .join("");
      summary.innerHTML = `<h2>There ${invalid.length === 1 ? "is 1 problem" : `are ${invalid.length} problems`} to fix</h2><ul role="list">${list}</ul>`;
      summary.hidden = false;
      summary.focus();
    },
    watch(form) {
      form.addEventListener(
        "blur",
        (e) => {
          const el = e.target;
          if (el.matches?.("input, select, textarea") && (el.value || el.hasAttribute("aria-invalid"))) {
            TMF.forms.check(el);
          }
        },
        true,
      );
      form.addEventListener("input", (e) => {
        if (e.target.getAttribute?.("aria-invalid") === "true") TMF.forms.check(e.target);
      });
      form.addEventListener("click", (e) => {
        const link = e.target.closest("[data-error-summary] a");
        if (!link) return;
        e.preventDefault();
        document.querySelector(link.getAttribute("href"))?.focus();
      });
    },
    loading(button, on, text = "Sending") {
      if (on) {
        button.dataset.label = button.innerHTML;
        button.innerHTML = `<span class="btn__spinner" aria-hidden="true"></span>${text}…`;
        button.setAttribute("aria-disabled", "true");
        button.disabled = true;
      } else {
        button.innerHTML = button.dataset.label;
        button.removeAttribute("aria-disabled");
        button.disabled = false;
      }
    },
  };

  /* Simple front-end forms (contact): validate, fake a send, show success */
  document.querySelectorAll("[data-demo-form]").forEach((form) => {
    TMF.forms.watch(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const summary = form.querySelector("[data-error-summary]");
      const invalid = TMF.forms.validate(form);
      if (invalid.length) return TMF.forms.summarize(summary, invalid);
      if (summary) summary.hidden = true;
      const button = form.querySelector('[type="submit"]');
      TMF.forms.loading(button, true);
      // Front-end only for now: no backend is connected yet.
      await new Promise((r) => setTimeout(r, 900));
      TMF.forms.loading(button, false);
      form.hidden = true;
      const done = document.getElementById(form.dataset.success);
      if (done) {
        done.hidden = false;
        done.focus();
      }
    });
  });

  /* Real lead forms (contact). Same validation look as above, then the live
     site's lead capture through the engine: api/lead.php plus the leads
     sheet. The success panel appears only when api/lead.php confirms it
     stored the message. If it did not, the visitor is told plainly; a form
     must never claim a message was sent when nothing was transmitted. */
  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    TMF.forms.watch(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const engine = window.TMFEngine;
      const summary = form.querySelector("[data-error-summary]");
      const invalid = TMF.forms.validate(form);
      // The live site's stricter email rule and its exact wording.
      const email = form.elements.email;
      if (engine && email && email.value.trim() && !engine.isEmail(email.value)) {
        email.setAttribute("aria-invalid", "true");
        const err = document.getElementById(`${email.id}-err`);
        if (err) {
          err.textContent = engine.EMAIL_ERROR;
          err.hidden = false;
        }
        if (!invalid.includes(email)) invalid.push(email);
      }
      if (invalid.length) return TMF.forms.summarize(summary, invalid);
      if (summary) summary.hidden = true;

      const data = {};
      new FormData(form).forEach((v, k) => {
        const s = String(v).trim();
        if (s) data[k] = s;
      });
      const button = form.querySelector('[type="submit"]');
      TMF.forms.loading(button, true);
      let ok = false;
      try {
        await engine.sendLead(form.dataset.leadForm, data);
        ok = true;
      } catch {
        ok = false;
      }
      TMF.forms.loading(button, false);
      if (!ok) {
        if (summary) {
          summary.innerHTML = "<h2>Your message was not sent</h2><p>Something went wrong on our side. Please try again in a minute — we don't want your enquiry to go missing.</p>";
          summary.hidden = false;
          summary.focus();
        }
        return;
      }
      form.hidden = true;
      const done = document.getElementById(form.dataset.success);
      if (done) {
        done.hidden = false;
        done.focus();
      }
    });
  });

  /* Motion (smooth scroll, reveals and scenes) lives in motion.js,
     hero.js, clock.js and moments.js. */

  /* The hero scroll cue is an invitation; once the page has moved it has done
     its job, so a single class retires it. Passive listener, removed after it
     fires once - this must never be a cost on every scroll frame. */
  (() => {
    const mark = () => document.documentElement.classList.add("has-scrolled");
    if (window.scrollY > 24) return mark();
    window.addEventListener(
      "scroll",
      () => {
        if (window.scrollY > 24) mark();
      },
      { once: true, passive: true }
    );
  })();

})();
