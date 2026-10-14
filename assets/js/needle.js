/* Cash injection hero: the syringe from the home film, made touchable
   (John, 14 Oct 2026: "the needle with the money from the video ... you can
   move your mouse, you can touch it, you can spin it").

   It is the film's drain beat (b11, the plunger pushing the money into the
   safe) as a frame strip on a canvas. Idle, it breathes: the plunger eases in
   and back. Drag sideways (mouse or finger) and you push the plunger
   yourself; let go and it keeps gliding, then settles back into the idle
   loop. A light pointer tilt gives it depth. Reduced motion keeps the poster
   frame and nothing moves. */
(() => {
  const stage = document.querySelector("[data-needle]");
  if (!stage) return;
  const canvas = stage.querySelector("canvas");
  const poster = stage.querySelector("img");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const COUNT = 87; // media/film/frames/m/b11 - the film's own 960x536 frames
  const SRC = (i) => `/media/film/frames/m/b11/${String(i + 1).padStart(4, "0")}.webp`;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const frames = new Array(COUNT);
  let loaded = 0;
  let pos = 30; // fractional frame index
  let vel = 0; // frames per tick, after a drag
  let dragging = false;
  let lastX = 0;
  let idleT = 0;
  let idleFrom = 0; // where the idle loop resumes from after a drag
  let resume = 0; // 0..1 blend back into the idle loop
  let shown = -1;
  let visible = true;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    shown = -1;
  };

  const draw = (i) => {
    const img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return false;
    const cw = canvas.width;
    const ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    return true;
  };

  // The nearest frame that has arrived, so a half-loaded strip still moves.
  const nearest = (i) => {
    for (let d = 0; d < COUNT; d++) {
      if (frames[i - d]?.naturalWidth) return i - d;
      if (frames[i + d]?.naturalWidth) return i + d;
    }
    return -1;
  };

  const render = () => {
    const i = nearest(Math.max(0, Math.min(COUNT - 1, Math.round(pos))));
    if (i < 0 || i === shown) return;
    if (draw(i)) {
      shown = i;
      if (!stage.classList.contains("is-live")) stage.classList.add("is-live");
    }
  };

  // Idle: a slow push in and an easier pull back, about 7 seconds a cycle.
  const idlePos = (t) => {
    const p = (Math.sin(t * 0.9 - Math.PI / 2) + 1) / 2; // 0..1..0
    return 4 + p * (COUNT - 9);
  };

  const tick = () => {
    if (visible) {
      if (dragging) {
        // pos is moved by the pointer handler
      } else if (Math.abs(vel) > 0.02) {
        pos += vel;
        vel *= 0.94; // glide after the throw
        if (pos < 0 || pos > COUNT - 1) {
          pos = Math.max(0, Math.min(COUNT - 1, pos));
          vel *= -0.35; // the plunger bumps the end of the barrel
        }
        idleFrom = pos;
        resume = 0;
      } else {
        idleT += 1 / 60;
        resume = Math.min(1, resume + 1 / 90);
        const k = resume * resume * (3 - 2 * resume);
        pos = idleFrom + (idlePos(idleT) - idleFrom) * k;
      }
      render();
    }
    requestAnimationFrame(tick);
  };

  /* Drag: sideways pushes the plunger. Vertical scroll on phones stays free. */
  const PX_PER_FRAME = () => Math.max(3, canvas.getBoundingClientRect().width / COUNT) * 0.9;
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    vel = 0;
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add("is-grabbing", "was-touched");
  });
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty("--tilt-x", `${(-ny * 7).toFixed(2)}deg`);
    stage.style.setProperty("--tilt-y", `${(nx * 9).toFixed(2)}deg`);
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    const step = dx / PX_PER_FRAME();
    pos = Math.max(0, Math.min(COUNT - 1, pos + step));
    vel = step * 0.6 + vel * 0.4;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-grabbing");
    idleFrom = pos;
    resume = 0;
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("pointerleave", () => {
    stage.style.setProperty("--tilt-x", "0deg");
    stage.style.setProperty("--tilt-y", "0deg");
  });
  // Keyboard: arrows push and pull too.
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") vel += 1.6;
    else if (e.key === "ArrowLeft") vel -= 1.6;
    else return;
    e.preventDefault();
    stage.classList.add("was-touched");
  });

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  }).observe(stage);
  window.addEventListener("resize", size);

  const start = () => {
    size();
    // Every frame, in an order that gives a rough strip fast: 1 in 8, then 1 in 4, then the rest.
    const order = [];
    for (const step of [8, 4, 2, 1]) for (let i = 0; i < COUNT; i += step) if (!order.includes(i)) order.push(i);
    for (const i of order) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        loaded += 1;
        if (loaded === 1) render();
      };
      img.src = SRC(i);
      frames[i] = img;
    }
    requestAnimationFrame(tick);
  };
  if (poster && !poster.complete) poster.addEventListener("load", start, { once: true });
  else start();
})();
