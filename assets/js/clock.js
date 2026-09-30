/* TMF Team · the engraving clock, "Where the hours go" (docs/motion-phase2-direction.md §7).
   The 48-hour hand is the cutter of a rose engine: as it sweeps it engraves
   a guilloché band into the blackened steel behind it. Every track is
   periodic around the dial, so the band closes exactly at hour 48.
   The hand is a real slider. Scroll, drag, click and keys drive the same
   instrument, and while motion is on the page scroll stays the single
   source of truth (every control scrolls to its hour). */
(() => {
  const section = document.querySelector("[data-clock]");
  if (!section) return;
  const TMF = (window.TMF = window.TMF || {});
  const M = TMF.motion || {};
  const { gsap, ScrollTrigger: ST } = window;
  const on = Boolean(M.on);
  const NS = "http://www.w3.org/2000/svg";
  const TOTAL = 48;
  const TAU = Math.PI * 2;
  const VIEW = 250; // SVG viewBox is ±250 units
  const R = 186; // ring radius in SVG units, inside the plate's bevel

  const stage = section.querySelector("[data-sc-stage]");
  const clock = section.querySelector("[data-clock-dial]");
  const canvas = clock.querySelector("canvas");
  const svg = clock.querySelector("svg");
  const handle = clock.querySelector("[data-clock-handle]");
  const hourEl = clock.querySelector("[data-clock-hour]");
  const labelEl = clock.querySelector("[data-clock-label]");
  const hint = section.querySelector("[data-clock-hint]");
  const list = section.querySelector(".stages");
  const stages = [...section.querySelectorAll("[data-stage]")];
  const jumps = [...section.querySelectorAll("[data-clock-jump]")];

  /* Guilloché band: two families of K tracks, r = Rᵢ + B·cos(m·φ ± i·2π/K),
     in ring radii. Opposite phases interlace into the woven moiré. */
  const BAND = { K: 16, m: 24, B: 0.03, r0: 0.34, r1: 0.76 };
  const trackR = (i, family, phi) =>
    BAND.r0 + ((BAND.r1 - BAND.r0) * i) / (BAND.K - 1) + BAND.B * Math.cos(BAND.m * phi + ((family ? -1 : 1) * i * TAU) / BAND.K);

  /* Ring, ticks, numerals, window tracks and the hand (SVG) */
  const make = (tag, attrs, parent = svg) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent.appendChild(node);
    return node;
  };
  const pt = (hour, r) => {
    const a = (hour / TOTAL) * TAU;
    return [Math.sin(a) * r, -Math.cos(a) * r];
  };
  const arcD = (h1, h2, r) => {
    if (h2 - h1 < 0.01) return "";
    const end = Math.min(h2, h1 + TOTAL - 0.01);
    const [x1, y1] = pt(h1, r);
    const [x2, y2] = pt(end, r);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${end - h1 > TOTAL / 2 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const WINDOW_R = R * 1.07;
  make("circle", { class: "c-ring", r: R });
  for (let h = 0; h < TOTAL; h++) {
    const major = h % 6 === 0;
    const [x1, y1] = pt(h, R * (major ? 0.9 : 0.94));
    const [x2, y2] = pt(h, R * 0.985);
    make("line", { class: major ? "c-tick c-tick--major" : "c-tick", x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) });
  }
  for (const h of [0, 12, 24, 36]) {
    const [x, y] = pt(h, R * 0.845);
    make("text", { class: "c-num", x: x.toFixed(1), y: y.toFixed(1), "text-anchor": "middle", "dominant-baseline": "central" }).textContent = String(h);
  }
  make("path", { class: "c-track", d: arcD(3, 24, WINDOW_R) });
  make("path", { class: "c-track", d: arcD(24, 48, WINDOW_R) });
  const decisionArc = make("path", { class: "c-arc c-arc--decision" });
  const fundsArc = make("path", { class: "c-arc c-arc--funds" });
  // The hand starts outside the readout, so the hour stays legible under it
  const hand = make("g", {});
  make("line", { class: "c-hand", x1: 0, y1: (-R * 0.3).toFixed(1), x2: 0, y2: (-WINDOW_R).toFixed(1) }, hand);

  /* The engraving (canvas). The complete band is rendered once per size;
     each frame reveals the sector the cutter has passed. */
  const ctx = canvas.getContext("2d");
  let off = null;
  let size = 0;
  let dpr = 1;
  const render = () => {
    const w = clock.clientWidth;
    if (!w) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = Math.round(w * dpr);
    canvas.width = size;
    canvas.height = size;
    off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const c = off.getContext("2d");
    const unit = (size / (2 * VIEW)) * R;
    const mid = size / 2;
    const N = 1080;
    c.lineWidth = Math.max(0.8, dpr * 0.75);
    c.strokeStyle = "rgba(241, 242, 236, 0.3)";
    c.globalCompositeOperation = "lighter";
    for (let family = 0; family < 2; family++) {
      for (let i = 0; i < BAND.K; i++) {
        c.beginPath();
        for (let j = 0; j <= N; j++) {
          const phi = (j / N) * TAU;
          const r = trackR(i, family, phi) * unit;
          const x = mid + Math.sin(phi) * r;
          const y = mid - Math.cos(phi) * r;
          if (j) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.closePath();
        c.stroke();
      }
    }
    return true;
  };
  const draw = (h) => {
    if (!off && !render()) return;
    const mid = size / 2;
    const a = (Math.min(h, TOTAL) / TOTAL) * TAU;
    ctx.clearRect(0, 0, size, size);
    if (a < 0.0005) return;
    const wedge = (a0, a1) => {
      ctx.beginPath();
      ctx.moveTo(mid, mid);
      ctx.arc(mid, mid, mid, a0 - Math.PI / 2, a1 - Math.PI / 2);
      ctx.closePath();
      ctx.clip();
    };
    ctx.save();
    wedge(0, a);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
    if (h >= TOTAL) return;
    // The freshly cut sector stays brighter for a moment behind the cutter
    const hour = TAU / TOTAL;
    ctx.globalCompositeOperation = "lighter";
    let prev = 0;
    for (const [span, alpha] of [[0.6, 0.75], [1.5, 0.4], [3, 0.16]]) {
      ctx.save();
      wedge(Math.max(0, a - span * hour), Math.max(0, a - prev * hour));
      ctx.globalAlpha = alpha;
      ctx.drawImage(off, 0, 0);
      ctx.restore();
      prev = span;
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    // Cutter points: where the hand meets each track, riding the lobes
    const unit = (size / (2 * VIEW)) * R;
    ctx.fillStyle = "rgba(241, 242, 236, 0.9)";
    for (let family = 0; family < 2; family++) {
      for (let i = 0; i < BAND.K; i++) {
        const r = trackR(i, family, a) * unit;
        ctx.beginPath();
        ctx.arc(mid + Math.sin(a) * r, mid - Math.cos(a) * r, 1.3 * dpr, 0, TAU);
        ctx.fill();
      }
    }
  };

  /* Paint one frame of the instrument */
  const NAMES = ["see your options", "talk to a specialist", "get funded"];
  const stageAt = (h) => (h < 6 ? 0 : h < 26 ? 1 : 2);
  const labelAt = (h) => (h >= TOTAL ? "From apply to funds" : h >= 24 ? "Funding window" : h >= 3 ? "Decision window" : "See your options");
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  // Stacked stage cues: one leaves before the next arrives; the last one holds.
  const cue = (h, i) => (i === 0 ? 1 - ramp(h, 5, 6) : i === 1 ? ramp(h, 6, 7) * (1 - ramp(h, 25, 26)) : ramp(h, 26, 27));
  const CENTRE = [3, 16, 37];
  let pinned = false;
  let shown = -1;
  const paint = (h) => {
    draw(h);
    hand.setAttribute("transform", `rotate(${((h / TOTAL) * 360).toFixed(2)})`);
    decisionArc.setAttribute("d", h > 3 ? arcD(3, Math.min(h, 24), WINDOW_R) : "");
    fundsArc.setAttribute("d", h > 24 ? arcD(24, Math.min(h, TOTAL), WINDOW_R) : "");
    const [hx, hy] = pt(h, WINDOW_R);
    const k = clock.clientWidth / (2 * VIEW);
    handle.style.transform = `translate(${((hx + VIEW) * k).toFixed(1)}px, ${((hy + VIEW) * k).toFixed(1)}px)`;
    if (pinned) {
      stages.forEach((el, i) => {
        const o = cue(h, i);
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translateY(${((1 - o) * (h < CENTRE[i] ? 14 : -14)).toFixed(1)}px)`;
      });
    }
    const whole = Math.floor(h + 0.05);
    if (whole === shown) return;
    shown = whole;
    const s = stageAt(whole);
    hourEl.textContent = `${whole}h`;
    labelEl.textContent = labelAt(whole);
    handle.setAttribute("aria-valuenow", String(whole));
    handle.setAttribute("aria-valuetext", `Hour ${whole} of 48: ${NAMES[s]}`);
    stages.forEach((el, i) => el.classList.toggle("is-active", i === s));
    jumps.forEach((btn, i) => btn.setAttribute("aria-current", String(i === s)));
    const decision = Math.round((Math.min(Math.max(whole - 3, 0), 21) / 21) * 10);
    const funds = Math.round((Math.min(Math.max(whole - 24, 0), 24) / 24) * 10);
    stage.setAttribute("data-sc-verify-state", `h${whole}|d${decision}|f${funds}|s${s}`);
  };

  /* Hour state, eased toward its target unless a hand is on the control */
  let target = on ? 0 : TOTAL;
  let current = target;
  let running = false;
  // Time-based easing (τ ≈ 80ms), so the hand keeps pace with the page on slow frame rates too
  const tick = (time, deltaTime) => {
    const d = target - current;
    if (Math.abs(d) < 0.002) {
      current = target;
      paint(current);
      gsap.ticker.remove(tick);
      running = false;
      return;
    }
    current += d * (1 - Math.exp(-deltaTime / 80));
    paint(current);
  };
  const setTarget = (h, immediate = false) => {
    target = Math.min(TOTAL, Math.max(0, h));
    if (immediate || !on) {
      current = target;
      if (running) {
        gsap.ticker.remove(tick);
        running = false;
      }
      paint(current);
    } else if (!running) {
      running = true;
      gsap.ticker.add(tick);
    }
  };

  /* Scroll → hour. Holds at both ends and small detents at 3h and 24h are
     authored silence (BRIEF.md): the dial greets at rest, and the closed
     engraving is given a moment. */
  const SEGMENTS = [
    [0, 0.06, 0, 0],
    [0.06, 0.11, 0, 3],
    [0.11, 0.13, 3, 3],
    [0.13, 0.5, 3, 24],
    [0.5, 0.52, 24, 24],
    [0.52, 0.94, 24, 48],
    [0.94, 1, 48, 48],
  ];
  const hourAt = (p) => {
    for (const [p0, p1, h0, h1] of SEGMENTS) if (p <= p1) return h0 + ((h1 - h0) * (p - p0)) / (p1 - p0);
    return TOTAL;
  };
  const progressAt = (h) => {
    if (h <= 0) return 0.03;
    if (h >= TOTAL) return 0.97;
    for (const [p0, p1, h0, h1] of SEGMENTS) {
      if (h1 > h0 && h >= h0 && h <= h1) return p0 + ((h - h0) / (h1 - h0)) * (p1 - p0);
    }
    return 0.97;
  };

  let st = null;
  let drag = null;
  if (on) {
    const bind = (config) => {
      st = ST.create({
        ...config,
        onUpdate: (self) => {
          setTarget(hourAt(self.progress), Boolean(drag?.moved));
          stage.setAttribute("data-sc-verify-hold", String(pinned && (self.progress < 0.06 || self.progress > 0.94)));
        },
      });
      setTarget(hourAt(st.progress), true);
      return () => {
        st.kill();
        st = null;
      };
    };
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (min-height: 700px)", () => {
      pinned = true;
      const unbind = bind({ trigger: section, start: "top top", end: "bottom bottom" });
      return () => {
        unbind();
        pinned = false;
        stages.forEach((el) => {
          el.style.opacity = "";
          el.style.transform = "";
        });
      };
    });
    mm.add("(max-width: 1023px), (max-height: 699px)", () => bind({ trigger: list, start: "top 70%", end: "bottom 60%" }));
  } else {
    setTarget(TOTAL, true);
  }

  /* Controls → hour. With motion on, every control scrolls to its hour. */
  const toHour = (h, { immediate = false, duration = 0.8 } = {}) => {
    const hour = Math.min(TOTAL, Math.max(0, h));
    if (!st) return setTarget(hour, true);
    M.scrollTo(Math.round(st.start + progressAt(hour) * (st.end - st.start)), { immediate, duration });
    return undefined;
  };
  const local = (e) => {
    const box = clock.getBoundingClientRect();
    const k = (2 * VIEW) / box.width;
    return { x: (e.clientX - box.left) * k - VIEW, y: (e.clientY - box.top) * k - VIEW };
  };
  const hourFrom = ({ x, y }) => {
    const h = (Math.atan2(x, -y) / TAU) * TOTAL;
    return h < 0 ? h + TOTAL : h;
  };
  const onRing = ({ x, y }) => {
    const d = Math.hypot(x, y);
    return d > R * 0.3 && d < R * 1.25;
  };

  clock.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const p = local(e);
    const onHandle = e.target === handle;
    if (!onHandle && !onRing(p)) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, onHandle, last: current };
    if (onHandle || e.pointerType === "mouse") clock.setPointerCapture(e.pointerId);
    if (onHandle) e.preventDefault();
  });
  clock.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (!drag) {
      clock.classList.toggle("is-hover", e.target === handle || onRing(p));
      return;
    }
    if (e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      // A finger moving on the ring (not the handle) is scrolling the page
      if (e.pointerType !== "mouse" && !drag.onHandle) {
        drag = null;
        return;
      }
      drag.moved = true;
      clock.classList.add("is-dragging");
      TMF.holdHeader = true;
    }
    let h = hourFrom(p);
    if (h - drag.last > TOTAL / 2) h -= TOTAL;
    else if (drag.last - h > TOTAL / 2) h += TOTAL;
    h = Math.min(TOTAL, Math.max(0, h));
    drag.last = h;
    toHour(h, { immediate: true });
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { moved } = drag;
    drag = null;
    clock.classList.remove("is-dragging");
    TMF.holdHeader = false;
    if (clock.hasPointerCapture(e.pointerId)) clock.releasePointerCapture(e.pointerId);
    const p = local(e);
    if (moved || e.type !== "pointerup" || !onRing(p)) return;
    // Click or tap on the ring jumps there (the single-pointer alternative to dragging)
    let h = hourFrom(p);
    if (h > 47.5 && current < TOTAL / 2) h = 0;
    toHour(h);
  };
  clock.addEventListener("pointerup", release);
  clock.addEventListener("pointercancel", release);
  clock.addEventListener("pointerleave", () => {
    if (!drag) clock.classList.remove("is-hover");
  });

  let keyHour = null;
  let keyTime = 0;
  handle.addEventListener("keydown", (e) => {
    const steps = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 6, PageDown: -6 };
    const recent = performance.now() - keyTime < 700 && keyHour !== null;
    let h = null;
    if (e.key in steps) h = (recent ? keyHour : Math.floor(target + 0.05)) + steps[e.key];
    else if (e.key === "Home") h = 0;
    else if (e.key === "End") h = TOTAL;
    if (h === null) return;
    e.preventDefault();
    keyHour = Math.min(TOTAL, Math.max(0, h));
    keyTime = performance.now();
    TMF.holdHeader = true;
    toHour(keyHour, { duration: 0.35 });
  });
  handle.addEventListener("blur", () => {
    TMF.holdHeader = false;
    keyHour = null;
  });
  for (const btn of jumps) btn.addEventListener("click", () => toHour(Number(btn.dataset.clockJump)));

  if (hint) {
    hint.textContent = window.matchMedia("(pointer: fine)").matches ? "Drag the hand to set the hour." : "Tap the ring to set the hour.";
    hint.hidden = false;
  }

  let lastWidth = 0;
  new ResizeObserver(() => {
    if (clock.clientWidth === lastWidth) return;
    lastWidth = clock.clientWidth;
    off = null;
    paint(current);
  }).observe(clock);
  paint(current);
})();
