/* TMF Team · section moments (docs/motion-phase2-direction.md §8–10).
   Each surface gets one behaviour of its own: statement paper that feeds in
   and prints, ledger rules and trade marks that are traced, a diagram drawn
   by scroll, a vault that settles and locks, figures that strike or roll,
   and a close that settles and holds. Runs last on every page. */
(() => {
  const root = document.documentElement;
  const TMF = window.TMF || {};
  const M = TMF.motion || {};
  const { gsap, ScrollTrigger: ST, DrawSVGPlugin } = window;
  const on = Boolean(M.on);
  const canTrace = on && Boolean(DrawSVGPlugin);
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const once = (trigger, start = "top 80%") => ({ trigger, start, once: true });
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

  // Every section is an act for the scroll-craft harness; pinned ones already say so.
  $$("main > section:not([data-sc-act])").forEach((s) => (s.dataset.scAct = "flow"));

  /* Final CTA: the visitor's own estimate waits beside the buttons */
  const estimateLine = () => {
    const slot = $("[data-cta-estimate]");
    if (!slot) return;
    let est = null;
    try {
      est = JSON.parse(sessionStorage.getItem("tmf-estimate") || "null");
    } catch {
      /* storage unavailable */
    }
    if (!est || est.over || !est.low || !est.high) {
      slot.hidden = true;
      return;
    }
    const edit = document.getElementById("estimate") ? "#estimate" : "/funding-estimator#estimate";
    slot.innerHTML = `<span>Your illustrative estimate: <strong>${money(est.low)}–${money(est.high)}</strong></span><span aria-hidden="true">·</span><a href="${edit}">Edit</a>`;
    slot.hidden = false;
  };
  estimateLine();
  document.addEventListener("tmf:estimate", estimateLine);

  /* Final CTA: a hairline of light on the A9 horizon (55.2% down the image) */
  $$(".cta").forEach((cta) => {
    const media = $(".cta__media", cta);
    const line = $(".cta__horizon", cta);
    if (!media || !line) return;
    const place = () => {
      const w = media.clientWidth;
      const h = media.clientHeight;
      const scale = Math.max(w / 2400, h / 1029);
      const top = (h - 1029 * scale) * 0.58 + (636 / 1152) * 1029 * scale;
      line.style.setProperty("--horizon-y", `${top.toFixed(1)}px`);
    };
    place();
    new ResizeObserver(place).observe(media);
    if (on) gsap.fromTo(line, { "--trace": 0 }, { "--trace": 1, duration: 1.6, ease: "power3.inOut", scrollTrigger: once(cta, "top 65%") });
  });

  /* The model diagram's commission line: Funder back up to TMF Team */
  $$(".model__diagram").forEach((fig) => {
    const nodes = $$(".flow__node", fig);
    const path = $(".flow__return path", fig);
    if (!path || nodes.length < 3) return;
    const route = () => {
      const box = fig.getBoundingClientRect();
      const dot = (node) => {
        const r = node.getBoundingClientRect();
        return { x: r.left - box.left + 5.5, y: r.top - box.top + 25.5 };
      };
      const from = dot(nodes[2]);
      const to = dot(nodes[1]);
      const x = from.x - 24;
      path.setAttribute(
        "d",
        `M${from.x - 9} ${from.y}H${x + 6}Q${x} ${from.y} ${x} ${from.y - 6}V${to.y + 6}Q${x} ${to.y} ${x + 6} ${to.y}H${to.x - 10}` +
          `M${to.x - 14} ${to.y - 4}L${to.x - 10} ${to.y}L${to.x - 14} ${to.y + 4}`,
      );
    };
    route();
    new ResizeObserver(route).observe(fig);
    if (!on) return;
    const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: fig, start: "top 78%", end: "bottom 60%", scrub: 0.6 } });
    tl.fromTo(nodes[0], { "--dot": 0.3, "--dot-o": 0 }, { "--dot": 1, "--dot-o": 1, duration: 0.08 }, 0)
      .fromTo(nodes[0], { "--line": 0 }, { "--line": 1, duration: 0.3 }, 0.08)
      .fromTo(nodes[1], { "--dot": 0.3, "--dot-o": 0 }, { "--dot": 1, "--dot-o": 1, duration: 0.08 }, 0.38)
      .fromTo(nodes[1], { "--line": 0 }, { "--line": 1, duration: 0.3 }, 0.46)
      .fromTo(nodes[2], { "--dot": 0.3, "--dot-o": 0 }, { "--dot": 1, "--dot-o": 1, duration: 0.08 }, 0.76);
    if (canTrace) tl.fromTo(path, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.3 }, 0.84);
  });

  /* Real figures roll once: "14 years" and the SBA 50 / 40 / 10 */
  $$("[data-roll-figure], .fact dd").forEach((dd) => {
    if (!/^\d+ years$/.test(dd.textContent.trim())) return;
    if (on) ST.create({ ...once(dd, "top 88%"), onEnter: () => M.roll(dd, dd.textContent.trim()) });
  });
  const split = $(".split-bar");
  if (split && on) {
    const segs = $$(".split-bar__seg", split);
    const fills = segs.map((s) => $(".split-bar__fill", s));
    const pcts = segs.map((s) => $(".split-bar__pct", s));
    gsap.set(fills, { scaleX: 0, transformOrigin: "0% 50%" });
    gsap.set(pcts, { opacity: 0 });
    ST.create({
      ...once(split, "top 78%"),
      onEnter: () =>
        segs.forEach((_, i) => {
          gsap.to(fills[i], { scaleX: 1, duration: 0.9, ease: "power3.out", delay: i * 0.35 });
          gsap.set(pcts[i], { opacity: 1, delay: i * 0.35 });
          M.roll(pcts[i], pcts[i].textContent.trim(), { delay: i * 0.35 });
        }),
    });
  }

  /* Home equity: a 60-minute dial follows the stage in view */
  const minuteDial = $("[data-minute-dial]");
  if (minuteDial) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = $("svg", minuteDial);
    const make = (tag, attrs) => {
      const node = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.appendChild(node);
      return node;
    };
    const pt = (m, r) => [Math.sin((m / 60) * Math.PI * 2) * r, -Math.cos((m / 60) * Math.PI * 2) * r];
    make("circle", { class: "m-ring", r: 50 });
    for (let m = 0; m < 60; m += 1) {
      const major = m % 5 === 0;
      const [x1, y1] = pt(m, major ? 42 : 45);
      const [x2, y2] = pt(m, 48);
      make("line", { class: major ? "m-tick m-tick--major" : "m-tick", x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) });
    }
    const fill = make("path", { class: "m-fill" });
    const hand = make("line", { class: "m-hand", x1: 0, y1: 6, x2: 0, y2: -38 });
    make("circle", { class: "m-hub", r: 2.4 });
    const state = { m: 60 };
    const set = () => {
      const m = Math.min(state.m, 59.99);
      const [x, y] = pt(m, 55);
      fill.setAttribute("d", m > 0.2 ? `M0 -55A55 55 0 ${m > 30 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}` : "");
      hand.setAttribute("transform", `rotate(${(state.m * 6).toFixed(2)})`);
    };
    set();
    const stages = $$(".stage", minuteDial.closest("section"));
    if (on && stages.length) {
      const minutes = [5, 30, 55];
      const activate = (i) => {
        stages.forEach((s, j) => s.classList.toggle("is-active", j === i));
        gsap.to(state, { m: minutes[i], duration: 0.9, ease: "power3.inOut", overwrite: true, onUpdate: set });
      };
      state.m = 0;
      set();
      activate(0);
      // The last stage reached stays current after it has scrolled past
      stages.forEach((s, i) => ST.create({ trigger: s, start: "top 62%", end: "bottom 62%", onEnter: () => activate(i), onEnterBack: () => activate(i) }));
    }
  }

  if (!on) {
    root.classList.add("motion-live", "sc-ready");
    return;
  }

  /* Inner page heroes: H1 lines rise, the image card settles and drifts,
     the fact rail strikes in order */
  const pageHero = $(".page-hero");
  if (pageHero) {
    const h1 = $("h1", pageHero);
    const media = $(".page-hero__media", pageHero);
    const img = media && $("img", media);
    M.rise(h1, { delay: 0.1 });
    if (!M.late) {
      gsap.from($$(".page-hero__copy > :not(h1)", pageHero), { opacity: 0, y: 14, duration: 0.8, ease: "expo.out", stagger: 0.07, delay: 0.3 });
      if (media) gsap.fromTo(media, { scale: 1.06 }, { scale: 1, duration: 1.4, ease: "expo.out" });
      M.strike($$(".fact dd", pageHero), { delay: 0.75, stagger: 0.09 });
    }
    if (img) {
      gsap.set(img, { scale: 1.12 });
      gsap.fromTo(img, { yPercent: -3 }, { yPercent: 4, ease: "none", scrollTrigger: { trigger: pageHero, start: "top top", end: "bottom top", scrub: true } });
      if (finePointer) {
        const qx = gsap.quickTo(img, "x", { duration: 0.9, ease: "power3.out" });
        const qy = gsap.quickTo(img, "y", { duration: 0.9, ease: "power3.out" });
        media.addEventListener("pointermove", (e) => {
          const r = media.getBoundingClientRect();
          qx(((e.clientX - r.left) / r.width - 0.5) * 16);
          qy(((e.clientY - r.top) / r.height - 0.5) * 16);
        });
        media.addEventListener("pointerleave", () => {
          qx(0);
          qy(0);
        });
      }
    }
  }

  /* Statement paper feeds up over the dark ground, corners easing flat */
  $$("[data-feed]").forEach((sheet) => {
    const feed = () => `${Math.max(0, Math.min(120, (parseFloat(getComputedStyle(sheet).paddingTop) || 96) - 24))}px`;
    gsap.fromTo(
      sheet,
      { "--feed": feed, "--feed-r": "32px" },
      { "--feed": "0px", "--feed-r": "0px", ease: "none", scrollTrigger: { trigger: sheet, start: "top bottom", end: "top 55%", scrub: true, invalidateOnRefresh: true } },
    );
    const terms = $(".terms", sheet);
    if (terms) gsap.from(terms.children, { opacity: 0, y: 10, duration: 0.5, ease: "expo.out", stagger: 0.08, scrollTrigger: once(terms) });
  });

  /* Four ways to fund: the double rule traces, the columns print, rows arrive */
  const paths = $(".paths");
  if (paths) {
    const head = $(".statement-head", paths);
    const cols = $(".statement__cols", paths);
    const list = $(".statement__rows", paths);
    const rows = $$("li", list);
    gsap.fromTo(head, { "--rule": 0 }, { "--rule": 1, duration: 0.9, ease: "power2.inOut", scrollTrigger: once(head, "top 88%") });
    gsap.from(head.children, { opacity: 0, duration: 0.5, stagger: 0.12, scrollTrigger: once(head, "top 88%") });
    if (cols) gsap.from(cols.children, { opacity: 0, y: 6, duration: 0.4, stagger: 0.04, scrollTrigger: once(cols, "top 90%") });
    const tl = gsap.timeline({ scrollTrigger: once(list, "top 82%") });
    tl.from(rows, { opacity: 0, y: 12, duration: 0.5, ease: "expo.out", stagger: 0.06 }, 0).fromTo(
      rows,
      { "--rule": 0 },
      { "--rule": 1, duration: 0.6, ease: "power2.inOut", stagger: 0.06 },
      0.1,
    );
  }

  /* Who we fund: ledger rules draw outward from the top-left, marks are engraved in turn */
  const grid = $(".industries__grid");
  if (grid) {
    const cells = $$(".industry", grid);
    const columns = window.matchMedia("(min-width: 900px)").matches ? 4 : 2;
    const tl = gsap.timeline({ scrollTrigger: once(grid, "top 78%") });
    cells.forEach((cell, i) => {
      const order = (i % columns) + Math.floor(i / columns);
      tl.fromTo(cell, { "--rule-x": 0, "--rule-y": 0 }, { "--rule-x": 1, "--rule-y": 1, duration: 0.7, ease: "power2.inOut" }, order * 0.08);
      if (canTrace) tl.fromTo($$("svg path, svg circle", cell), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "none" }, 0.15 + i * 0.06);
      tl.from($$(".industry__name, .industry__use", cell), { opacity: 0, y: 14, duration: 0.6, ease: "expo.out", stagger: 0.05 }, 0.25 + i * 0.06);
    });
  }

  /* Handled like a vault: the bed settles slowly, each protection locks */
  const vault = $(".security");
  if (vault) {
    const bed = $(".security__media", vault);
    gsap.fromTo(bed, { scale: 1.08 }, { scale: 1, ease: "none", scrollTrigger: { trigger: vault, start: "top bottom", end: "top 25%", scrub: true } });
    gsap.fromTo($("img", bed), { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: vault, start: "top bottom", end: "bottom top", scrub: true } });
    $$(".security__item", vault).forEach((item) => {
      const icon = $("svg", item);
      const tl = gsap.timeline({ scrollTrigger: once(item, "top 70%") });
      tl.from($$(":scope > :not(svg)", item), { opacity: 0, y: 14, duration: 0.7, ease: "expo.out", stagger: 0.06 }, 0);
      tl.fromTo(icon, { opacity: 0, scale: 1.035 }, { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" }, 0.2);
      const shackle = $(".lock__shackle", item);
      if (shackle) tl.fromTo(shackle, { y: -3 }, { y: 0, duration: 0.18, ease: "power2.in" }, 0.5);
      const check = $(".shield__check", item);
      if (check && canTrace) tl.fromTo(check, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.45, ease: "none" }, 0.4);
      const needle = $(".gauge__needle", item);
      if (needle) tl.fromTo(needle, { rotation: -70, svgOrigin: "12 16" }, { rotation: 0, svgOrigin: "12 16", duration: 0.8, ease: "power3.out" }, 0.35);
    });
  }

  /* Cash injection: each day's revenue grows, its remittance follows a beat later */
  const chart = $(".flex-chart");
  if (chart) {
    const revenue = $$(".bar-rev", chart);
    const remit = $$(".bar-rem", chart);
    const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: chart, start: "top 85%", end: "bottom 55%", scrub: 0.5 } });
    revenue.forEach((bar, i) => {
      tl.fromTo(bar, { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.5 }, i * 0.35);
      if (remit[i]) tl.fromTo(remit[i], { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.5 }, i * 0.35 + 0.25);
    });
  }
  const days = $$(".day");
  if (days.length) {
    const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: days[0].parentElement, start: "top 75%", end: "bottom 60%", scrub: 0.5 } });
    days.forEach((day, i) => {
      tl.fromTo(day, { "--dot": 0.3 }, { "--dot": 1, duration: 0.12, ease: "power2.out" }, i).fromTo(day, { "--line": 0 }, { "--line": 1, duration: 0.88 }, i + 0.12);
    });
  }

  /* Checklists tick in order; the HELOC score track fills and its marks strike */
  $$(".checklist").forEach((list) => {
    const marks = $$("svg", list);
    const lines = marks.map((svg) => $("path, polyline", svg)).filter(Boolean);
    const stroked = lines.length && getComputedStyle(lines[0]).fill === "none";
    if (canTrace && stroked) gsap.fromTo(lines, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.35, ease: "none", stagger: 0.08, scrollTrigger: once(list) });
    else M.strike(marks, { stagger: 0.08, scroll: once(list) });
  });
  /* Rates and terms: a loupe band reads down the fine print as it ticks in */
  const print = $("[data-fineprint]");
  if (on && print) {
    const loupe = $(".fineprint__loupe", print);
    const terms = $(".fineprint__list", print);
    if (loupe && terms) {
      const tl = gsap.timeline({ scrollTrigger: once(terms) });
      tl.fromTo(loupe, { y: 0, opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, 0)
        .to(loupe, { y: () => terms.offsetTop + terms.offsetHeight - 52, duration: 0.9, ease: "power1.inOut" }, 0)
        .to(loupe, { opacity: 0, duration: 0.26, ease: "none" }, 0.64);
    }
  }

  const scale = $(".scale");
  if (scale) {
    const marks = $$(".scale__mark", scale);
    gsap.set(marks, { xPercent: -50 });
    const tl = gsap.timeline({ scrollTrigger: once(scale) });
    tl.fromTo($(".scale__track", scale), { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: 1.1, ease: "power3.inOut" }, 0);
    marks.forEach((mark, i) => tl.fromTo(mark, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.3 + i * 0.18));
  }

  /* About: principle marks are traced as the cards arrive */
  $$(".principles").forEach((group) => {
    const tl = gsap.timeline({ scrollTrigger: once(group) });
    tl.from($$(".principle", group), { opacity: 0, y: 16, duration: 0.8, ease: "expo.out", stagger: 0.08 }, 0);
    if (canTrace) tl.fromTo($$("svg path, svg circle", group), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "none", stagger: 0.05 }, 0.2);
  });

  /* Footer: the outlined wordmark rises into place once */
  const word = $(".site-footer__wordmark");
  if (word) gsap.fromTo(word, { yPercent: 70 }, { yPercent: 16, duration: 1.4, ease: "expo.out", scrollTrigger: once(word, "top bottom") });

  root.classList.add("motion-live", "sc-ready");
})();
