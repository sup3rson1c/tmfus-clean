/* TMF Team · home hero: layered depth (docs/motion-phase2-direction.md §6).
   Planes, back to front: clean plate, rear atmosphere, contact shadow, the
   disc (with its 48-hour ring, chips and sheen), front atmosphere, stone
   slab, copy. Large screens: the stage sticks for 70svh while the planes
   separate at different rates, plus pointer depth on fine pointers.
   Phones: the scene flows under the copy with light parallax.
   Reduced motion: the resting composition with the hand at 13.5h. */
(() => {
  const hero = document.querySelector("[data-hero]");
  if (!hero) return;
  const TMF = window.TMF || {};
  const M = TMF.motion || {};
  const { gsap } = window;
  const on = Boolean(M.on);
  const NS = "http://www.w3.org/2000/svg";
  const TOTAL = 48;
  // Disc top face in the 2048px A1 frame: centre and radii in px. The ring sits 16% outside it.
  const FACE = { cx: 973, cy: 895, rx: 620, ry: 283, ring: 1.16 };

  const $ = (sel) => hero.querySelector(sel);
  const stage = $(".hero__stage");
  const planes = Object.fromEntries([...hero.querySelectorAll("[data-plane]")].map((p) => [p.dataset.plane, p]));
  const layer = (name) => planes[name].querySelector(".hero__layer");
  const frame = layer("disc");
  const svg = $("svg[data-dial]");
  const chips = [...hero.querySelectorAll("[data-chip-hour]")];
  const title = $("[data-hero-title]");
  const bits = [...hero.querySelectorAll("[data-hero-reveal]")];
  const exposure = $(".hero__exposure");
  const shaft = $(".hero__shaft");
  const shadow = $(".hero__shadow");
  const band = $(".hero__sheen-band");
  const slab = $(".hero__slab");
  const beatOne = $(".hero__beat--one");
  const beatTwo = $(".hero__beat--two");
  const next = $(".hero__next");
  const facts = [...hero.querySelectorAll(".hero__facts .fact")];

  /* The 48-hour ring, drawn in the frame's own pixels so it sits on the
     disc's face in perspective. Hour 0 is at the top, running clockwise. */
  const make = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };
  const RX = FACE.rx * FACE.ring;
  const RY = FACE.ry * FACE.ring;
  const at = (hour, u) => {
    const a = (hour / TOTAL) * Math.PI * 2;
    return [FACE.cx + Math.sin(a) * RX * u, FACE.cy - Math.cos(a) * RY * u];
  };
  const arcPath = (h1, h2, u) => {
    const [x1, y1] = at(h1, u);
    const [x2, y2] = at(h2, u);
    const large = h2 - h1 > TOTAL / 2 ? 1 : 0;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${(RX * u).toFixed(1)} ${(RY * u).toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  svg.classList.add("dial-svg");
  const ring = make("ellipse", { class: "d-ring", cx: FACE.cx, cy: FACE.cy, rx: RX, ry: RY });
  const etch = make("ellipse", { class: "d-etch", cx: FACE.cx, cy: FACE.cy, rx: RX * 0.885, ry: RY * 0.885 });
  const ticks = [];
  for (let h = 0; h < TOTAL; h++) {
    const major = h % 6 === 0;
    const [x1, y1] = at(h, major ? 0.9 : 0.94);
    const [x2, y2] = at(h, 0.985);
    ticks.push(make("line", { class: major ? "d-tick d-tick--major" : "d-tick", x1, y1, x2, y2 }));
  }
  const arcs = [
    make("path", { class: "d-arc d-arc--decision", d: arcPath(3, 23.4, 1.075) }),
    make("path", { class: "d-arc d-arc--funds", d: arcPath(24.6, 47.4, 1.075) }),
  ];
  const hand = make("line", { class: "d-hand" });
  make("ellipse", { class: "d-hub", cx: FACE.cx, cy: FACE.cy, rx: RX * 0.026, ry: RY * 0.026 });

  const state = { h: 0 };
  const setHand = () => {
    const [x2, y2] = at(state.h, 0.8);
    const [x1, y1] = at(state.h + TOTAL / 2, 0.12);
    hand.setAttribute("x1", x1.toFixed(1));
    hand.setAttribute("y1", y1.toFixed(1));
    hand.setAttribute("x2", x2.toFixed(1));
    hand.setAttribute("y2", y2.toFixed(1));
  };

  /* Chips ride on the ring; keep them inside the viewport */
  const place = () => {
    const width = frame.clientWidth;
    if (!width) return;
    const scale = width / 2048;
    const left = frame.getBoundingClientRect().left;
    const vw = document.documentElement.clientWidth;
    svg.style.setProperty("--u", (2048 / width).toFixed(3));
    for (const chip of chips) {
      const [px, py] = at(parseFloat(chip.dataset.chipHour), 1.075);
      let x = px * scale;
      const half = chip.offsetWidth / 2 + 10;
      if (left + x - half < 0) x += half - (left + x);
      if (left + x + half > vw) x -= left + x + half - vw;
      chip.style.setProperty("--x", `${x.toFixed(1)}px`);
      chip.style.setProperty("--y", `${(py * scale).toFixed(1)}px`);
    }
  };
  place();
  new ResizeObserver(place).observe(frame);
  document.fonts?.ready.then(place);

  /* Intro (≤ 1.6s): exposure lifts, the headline rises, the ring traces,
     the hand sweeps to 13.5h and the chips strike in order. */
  if (!on || M.late) {
    state.h = 13.5;
    setHand();
    [title, ...bits, ...chips].forEach((el) => (el.style.opacity = 1));
    exposure.style.opacity = 0;
    if (on) M.rise(title);
  } else {
    setHand();
    gsap.set(chips, { xPercent: -50, yPercent: -50 });
    const intro = () => {
      const tl = gsap.timeline();
      tl.to(exposure, { opacity: 0, duration: 1.2, ease: "power2.out" }, 0);
      M.rise(title, { delay: 0.15 });
      tl.fromTo(bits, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", stagger: 0.08 }, 0.3);
      tl.fromTo(ring, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.9, ease: "power2.inOut" }, 0.3);
      tl.from([etch, ...ticks], { opacity: 0, duration: 0.5, stagger: 0.006 }, 0.35);
      tl.to(state, { h: 13.5, duration: 1.1, ease: "power3.inOut", onUpdate: setHand }, 0.45);
      tl.fromTo(arcs, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.out", stagger: 0.25 }, 0.75);
      [0.5, 1.05, 1.3].forEach((t, i) => {
        if (chips[i]) tl.fromTo(chips[i], { opacity: 0, scale: 1.035 }, { opacity: 1, scale: 1, duration: 0.18, ease: "power2.out" }, t);
      });
    };
    // While the opening loader covers the page, wait for it to lift so the
    // entrance is actually seen (loader.js, or the head failsafe, fires this).
    if (document.documentElement.classList.contains("is-loading")) {
      window.addEventListener("tmf:loader-done", intro, { once: true });
    } else {
      intro();
    }
  }

  /* The slab's lit edge settles below the (lifted) first beat and above the
     second. Measured with or without motion, so the resting composition holds. */
  const wide = window.matchMedia("(min-width: 1024px) and (min-height: 760px)");
  const lift = on ? 0.08 : 0;
  const edge = () => {
    const vh = stage.clientHeight;
    const oneBottom = beatOne.offsetTop + beatOne.offsetHeight - lift * vh;
    // The second beat was removed from the hero, so the slab's edge now has
    // no upper neighbour to sit above; the stage floor takes its place.
    const ceiling = beatTwo ? beatTwo.offsetTop - 28 : vh - 28;
    return Math.round(Math.min(Math.max(0.6 * vh, oneBottom + 28), ceiling));
  };
  const layout = () => {
    slab.style.top = wide.matches ? `${edge()}px` : "";
  };
  layout();
  wide.addEventListener("change", layout);
  new ResizeObserver(layout).observe(stage);
  document.fonts?.ready.then(layout);

  if (!on) return;

  const mm = gsap.matchMedia();

  /* Large screens: sticky stage, planes separate over 70svh of scroll */
  mm.add("(min-width: 1024px) and (min-height: 760px)", () => {
    layout();
    let progress = 0;
    const tl = gsap.timeline({
      defaults: { ease: "none", duration: 1 },
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        invalidateOnRefresh: true,
        onRefreshInit: layout,
        onUpdate: (self) => {
          progress = self.progress;
          stage.setAttribute(
            "data-sc-verify-state",
            `lift:${Math.round(-gsap.getProperty(frame, "y"))}|slab:${Math.round(gsap.getProperty(slab, "y") / 8)}|beat:${next ? Number(gsap.getProperty(next, "opacity")).toFixed(1) : "-"}`,
          );
        },
      },
    });
    tl.fromTo(layer("plate"), { y: 0, scale: 1 }, { y: -18, scale: 1.05 }, 0)
      .fromTo(layer("rear"), { y: 0 }, { y: -40 }, 0)
      .fromTo(shaft, { opacity: 0.55 }, { opacity: 0.8 }, 0)
      .fromTo(shadow, { opacity: 0.7, scaleX: 1 }, { opacity: 0.3, scaleX: 1.12 }, 0)
      .fromTo(frame, { y: 0, scale: 1, transformOrigin: "50% 62%" }, { y: -56, scale: 1.04 }, 0)
      .fromTo(layer("front"), { y: 0 }, { y: -140 }, 0)
      .fromTo(slab, { y: () => stage.clientHeight - edge() + 24 }, { y: 0, duration: 0.6, ease: "power2.out" }, 0)
      .fromTo(beatOne, { y: 0 }, { y: () => -0.08 * stage.clientHeight }, 0)
      .fromTo(band, { xPercent: -18 }, { xPercent: 18 }, 0)
      ;
    // The second beat and its fact rail were removed from the hero; their
    // reveals are skipped rather than run against nothing.
    if (next) tl.fromTo(next, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }, 0.5);
    if (facts && facts.length) tl.fromTo(facts, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.2, stagger: 0.04, ease: "power2.out" }, 0.58);

    // Pointer depth: nearer planes move further. The disc stays anchored to the
    // plinth at rest and only gains its own depth as it lifts.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    const quick = (el, prop) => gsap.quickTo(el, prop, { duration: 0.9, ease: "power3.out" });
    const movers = [
      ["plate", () => 6],
      ["rear", () => 10],
      ["shadow", () => 6],
      ["disc", () => 6 + 8 * progress],
      ["front", () => 24],
    ].map(([name, amp]) => ({ amp, x: quick(planes[name], "x"), y: quick(planes[name], "y") }));
    const sheen = quick(band, "x");
    const move = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      for (const m of movers) {
        m.x(nx * 2 * m.amp());
        m.y(ny * 2 * m.amp());
      }
      sheen(nx * frame.clientWidth * 0.45);
    };
    const reset = () => {
      for (const m of movers) {
        m.x(0);
        m.y(0);
      }
      sheen(0);
    };
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
    };
  });

  /* Phones, tablets and short screens: in flow, travel under 40px */
  mm.add("(max-width: 1023px), (max-height: 759px)", () => {
    const out = { trigger: hero, start: "top top", end: "bottom top", scrub: true };
    gsap.fromTo(frame, { y: 0 }, { y: -28, ease: "none", scrollTrigger: out });
    gsap.fromTo(band, { xPercent: -18 }, { xPercent: 18, ease: "none", scrollTrigger: { ...out } });
    gsap.fromTo(slab, { y: 36 }, { y: 0, ease: "none", scrollTrigger: { trigger: slab, start: "top bottom", end: "top 55%", scrub: true } });
  });
})();
