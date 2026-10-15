/* Cash injection hero: the syringe from the home film, and YOU inject it
   (John, 14 Oct 2026, third pass).

   v1 scrubbed the film frames but cropped them and tilted with the mouse
   ("cut off", "wobbly"). v2 was a three.js model ("very low quality"). John
   wants the film's look, with only the syringe moving, moved by the visitor:
   push the plunger and the money goes into the safe.

   So: the film's final beat (b11, the camera locked, the plunger driving the
   money through the needle into the safe) drawn whole on a canvas (contain,
   never cropped), and the frame is chosen by the plunger. Drag anywhere on
   the picture: right pushes in, left pulls back. Nothing else moves; there
   is no tilt. The safe's screen counts what has gone in, following the
   film's measured drain curve, mapped onto the screen's glass with the same
   homography the film uses (see film.js "Funded counter").

   Before anyone touches it, the plunger gives a small nudge every few
   seconds, so it reads as something to push. Fully injected, the screen
   holds the total; left alone for a while, the plunger eases back so the
   next visitor can do it again. Reduced motion: a still frame, half
   injected, with its number. */
(() => {
  const stage = document.querySelector("[data-needle]");
  if (!stage) return;
  const canvas = stage.querySelector("canvas");
  const ctx = canvas?.getContext("2d");
  const counter = stage.querySelector("[data-needle-counter]");
  const counterValue = stage.querySelector("[data-needle-counter-value]");
  if (!ctx) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Sharp frames on desktop, the half-size set on phones.
  const big = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1) > 1400;
  const SET = big
    ? { count: 173, dir: "/media/film/frames/d/b11/", w: 1920, h: 1072 }
    : { count: 87, dir: "/media/film/frames/m/b11/", w: 960, h: 536 };
  const src = (i) => `${SET.dir}${String(i + 1).padStart(4, "0")}.webp`;

  /* The screen's glass, as fractions of the frame (film.js QUAD). */
  const QUAD = [
    [1454 / 1920, 170 / 1072],
    [1779 / 1920, 148 / 1072],
    [1777 / 1920, 285 / 1072],
    [1457 / 1920, 298 / 1072],
  ];
  const PLANE = { w: 1000, h: 420 };
  const TARGET = 250000;
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  let drain = null; // measured drain curve, 0..1 per desktop frame

  const frames = new Array(SET.count);
  let p = 0; // plunger position, 0 = full barrel, 1 = all injected
  let target = 0;
  let shown = -1;
  let touched = false;
  let lastTouch = 0;
  let dragging = false;
  let dragX = 0;
  let dragP = 0;
  let visible = true;

  const size = () => {
    // Layout size, not getBoundingClientRect: the page's entrance animation
    // scales the hero picture for a moment, and a scaled measurement put the
    // counter beside the screen instead of on it.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(stage.offsetWidth * dpr);
    canvas.height = Math.round(stage.offsetHeight * dpr);
    shown = -1;
  };

  // Where the frame lands on the canvas: whole, centred (contain).
  const placement = () => {
    const s = Math.min(canvas.width / SET.w, canvas.height / SET.h);
    const w = SET.w * s;
    const h = SET.h * s;
    return { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, w, h };
  };

  const nearest = (i) => {
    for (let d = 0; d < SET.count; d++) {
      if (frames[i - d]?.naturalWidth) return i - d;
      if (frames[i + d]?.naturalWidth) return i + d;
    }
    return -1;
  };

  /* Counter on the safe's screen ------------------------------------- */
  const squareToQuad = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) => {
    const sx = x0 - x1 + x2 - x3;
    const sy = y0 - y1 + y2 - y3;
    const dx1 = x1 - x2;
    const dx2 = x3 - x2;
    const dy1 = y1 - y2;
    const dy2 = y3 - y2;
    const den = dx1 * dy2 - dx2 * dy1;
    const g = (sx * dy2 - dx2 * sy) / den;
    const h = (dx1 * sy - sx * dy1) / den;
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  };
  const placeCounter = () => {
    if (!counter) return;
    const dpr = canvas.width / (stage.offsetWidth || 1) || 1;
    const { x, y, w, h } = placement();
    const quad = QUAD.map(([u, v]) => [(x + u * w) / dpr, (y + v * h) / dpr]);
    const [a, b, c, d, e, f, g, hh] = squareToQuad(quad);
    const W = PLANE.w;
    const H = PLANE.h;
    counter.style.transform = `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${hh / H},0,0,1,0,${c},${f},0,1)`;
  };
  let lastValue = "";
  const updateCounter = (pos) => {
    if (!counter || !counterValue) return;
    const drained = drain?.length ? drain[Math.round(pos * (drain.length - 1))] : pos;
    counter.style.opacity = String(Math.min(1, pos / 0.04));
    const v = money(TARGET * drained);
    if (v !== lastValue) {
      counterValue.textContent = v;
      lastValue = v;
    }
    stage.classList.toggle("is-funded", pos > 0.985);
  };

  const draw = () => {
    const want = Math.round(p * (SET.count - 1));
    const i = nearest(want);
    if (i < 0) return;
    if (i !== shown) {
      const { x, y, w, h } = placement();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[i], x, y, w, h);
      shown = i;
      stage.classList.add("is-live");
    }
    updateCounter(i / (SET.count - 1));
  };

  /* Pushing the plunger ---------------------------------------------- */
  const travel = () => stage.offsetWidth * 0.42; // px for a full push
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragX = e.clientX;
    dragP = target;
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add("is-grabbing", "was-touched");
    touched = true;
    lastTouch = performance.now();
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    target = Math.max(0, Math.min(1, dragP + (e.clientX - dragX) / travel()));
    lastTouch = performance.now();
  });
  const release = () => {
    dragging = false;
    stage.classList.remove("is-grabbing");
    lastTouch = performance.now();
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") target = Math.min(1, target + 0.08);
    else if (e.key === "ArrowLeft") target = Math.max(0, target - 0.08);
    else return;
    e.preventDefault();
    touched = true;
    lastTouch = performance.now();
    stage.classList.add("was-touched");
  });

  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
  }).observe(stage);
  new ResizeObserver(() => {
    size();
    placeCounter();
    draw();
  }).observe(stage);

  /* The loop: the plunger follows the hand with a little weight. */
  let t0 = performance.now();
  const tick = (now) => {
    if (visible) {
      const idle = now - lastTouch;
      if (!touched) {
        // An invitation: a short push and back every 4 seconds.
        const c = ((now - t0) / 1000) % 4;
        target = c < 1.4 ? Math.sin((c / 1.4) * Math.PI) * 0.1 : 0;
      } else if (!dragging && idle > 7000) {
        // Left alone: ease back to a full barrel for the next visitor.
        target = Math.max(0, target - 0.004);
        if (target === 0) {
          touched = false;
          t0 = now;
          stage.classList.remove("was-touched");
        }
      }
      p += (target - p) * (dragging ? 0.35 : 0.12);
      if (Math.abs(target - p) < 0.0005) p = target;
      draw();
    }
    requestAnimationFrame(tick);
  };

  /* Loading: the first frame at once, then a rough strip, then the rest. */
  const start = () => {
    size();
    placeCounter();
    const order = [];
    const seen = new Set();
    for (const step of [16, 8, 4, 2, 1]) {
      for (let i = 0; i < SET.count; i += step) {
        if (!seen.has(i)) {
          seen.add(i);
          order.push(i);
        }
      }
    }
    for (const i of order) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (shown < 0) draw();
      };
      img.src = src(i);
      frames[i] = img;
    }
    fetch("/media/film/frames/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        drain = m.beats?.[m.beats.length - 1]?.drain || null;
      })
      .catch(() => {});
    if (reduced) {
      p = target = 0.55;
      frames[Math.round(0.55 * (SET.count - 1))].addEventListener(
        "load",
        () => {
          shown = -1;
          draw();
        },
        { once: true },
      );
      return;
    }
    requestAnimationFrame(tick);
  };
  start();
})();
