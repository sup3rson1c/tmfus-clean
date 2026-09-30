/* TMF Team · the funding film (docs/film-phase2-direction.md).
   A full-bleed canvas frame sequence between the hero and the estimate
   section. Scroll position is the playhead: the pinned stage holds while the
   page scrolls, and each scroll tick draws one frame. No wheel or touch
   handler — pinning is not hijacking, so the scrollbar, Page Down, Space and
   find-in-page all keep working.

   Scroll feel: scrub is near-instant, NOT the 1s default. Lenis already eases
   the scroll itself; adding GSAP's easing on top stacks two lags on one
   gesture and the film stops tracking your hand. Lenis smooths, GSAP follows.

   Frames, not video: a <video> scrubbed by currentTime measures ~100ms per
   seek even fully buffered, and caching WebCodecs output costs ~589MB a beat
   at this resolution. Compressed frames let the browser's image cache do the
   memory management, which is the only thing that scales to nine beats.

   Loading is windowed by beat: only the beat in view and its neighbours are
   held, so a nine-beat film never has nine beats' frames resident at once.

   The static storyboard in the markup is what ships visible. This script only
   swaps in the canvas once it has frames, so reduced motion, a slow
   connection, a missing manifest and a dead canvas all land on the same
   readable fallback rather than an empty section. */
(() => {
  const section = document.querySelector("[data-film]");
  if (!section) return;

  // ?filmdebug=1 prints why the film did or did not start, on the page, so a
  // report does not depend on someone opening devtools. Every early return
  // below goes through bail() so the panel always says something.
  const debugOn = new URLSearchParams(location.search).has("filmdebug");
  const diag = {};
  const bail = (why) => {
    diag.result = why;
    if (!debugOn) return;
    const box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;z-index:99999;top:10px;left:10px;max-width:560px;margin:0;" +
      "padding:14px 16px;background:rgba(10,12,11,.94);color:#f1f2ec;" +
      "font:12px/1.6 ui-monospace,Consolas,monospace;border:1px solid #7fd4a8;" +
      "border-radius:6px;white-space:pre-wrap;pointer-events:none";
    box.textContent =
      "FILM DIAGNOSTIC\n" + Object.entries(diag).map(([k, v]) => k + ": " + v).join("\n");
    const put = () => document.body.appendChild(box);
    if (document.body) put();
    else addEventListener("DOMContentLoaded", put);
  };

  const TMF = window.TMF || {};
  const M = TMF.motion || {};
  const { gsap, ScrollTrigger: ST } = window;
  diag.userAgent = navigator.userAgent.slice(0, 60);
  diag.gsap = !!gsap;
  diag.scrollTrigger = !!ST;
  diag["TMF.motion.on"] = M.on;

  // ?motion=force overrides the OS reduced-motion setting for review, so the
  // scrubbed film can be checked without changing a system preference. It
  // sticks, because needing the query string on every navigation makes it
  // useless in practice; ?motion=auto clears it again. Opt-in only: nothing
  // reads this unless the person put it in the URL themselves.
  const qs = new URLSearchParams(location.search).get("motion");
  let forced = qs === "force";
  try {
    if (qs === "force") localStorage.setItem("tmf-motion", "force");
    if (qs === "auto") localStorage.removeItem("tmf-motion");
    forced = forced || localStorage.getItem("tmf-motion") === "force";
  } catch {
    // Private mode or blocked storage: the query string still works per-load.
  }
  const osReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduced = osReduced && !forced;
  diag.osReducedMotion = osReduced;
  diag.queryString = location.search || "(none)";
  diag.forced = forced;

  // Reduced motion gets the film as a video it starts itself, not a grid of
  // stills. The preference means "do not impose motion on me" — it does not
  // mean the work should be withheld. Nothing loads or moves until the button
  // is pressed, so the setting is still honoured.
  if (reduced) {
    player();
    bail("reduced motion -> play button");
    return;
  }

  // motion.js sets TMF.motion.on to false under reduced motion, so honour it
  // normally but ignore it when the film is being forced for review. GSAP
  // still registers ScrollTrigger in that case; only Lenis is skipped, which
  // costs the scroll smoothing but not the scrub itself.
  const on = Boolean(gsap && ST) && (Boolean(M.on) || forced);
  if (!on) {
    bail("gsap/ScrollTrigger missing or motion disabled -> storyboard");
    return;
  }

  // Data saver and slow radio: keep the storyboard, spend nothing.
  const net = navigator.connection;
  if (net && (net.saveData || /^(slow-)?2g$|^3g$/.test(net.effectiveType || ""))) {
    diag.saveData = net.saveData;
    diag.effectiveType = net.effectiveType;
    bail("data saver / slow connection -> storyboard");
    return;
  }

  const stage = section.querySelector("[data-film-stage]");
  const canvas = section.querySelector("[data-film-canvas]");
  const poster = section.querySelector("[data-film-poster]");
  const bar = section.querySelector("[data-film-bar]");
  const caption = section.querySelector("[data-film-caption]");
  const counter = section.querySelector("[data-film-counter]");
  const counterValue = section.querySelector("[data-film-counter-value]");
  if (!stage || !canvas) {
    diag.stage = !!stage;
    diag.canvas = !!canvas;
    bail("STALE HTML - stage/canvas markup missing -> storyboard");
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    bail("no 2d canvas context -> storyboard");
    return;
  }

  /* Reduced motion: a film you press play on ------------------------------ */

  function player() {
    const box = section.querySelector("[data-film-stage]");
    const line = section.querySelector("[data-film-caption]");
    const host = section.querySelector("[data-film-player]");
    const button = section.querySelector("[data-film-play]");
    const names = JSON.parse(section.dataset.filmClips || "[]");
    const lines = JSON.parse(section.dataset.filmSteps || "[]");
    if (!box || !host || !button || !names.length) return;

    section.classList.add("film--player");
    host.hidden = false;

    const src = (n) => "/media/film/clips/" + n + ".mp4";
    const make = () => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "none"; // nothing downloads until play is pressed
      v.className = "film__video";
      box.insertBefore(v, host);
      return v;
    };
    // Two elements, so the next clip is decoded and holding its first frame
    // before the current one ends and there is no black gap at the join.
    let a = make();
    let b = make();
    let i = 0;

    const run = () => {
      if (line) {
        const st = lines.filter((x) => i + 1 >= x.beat).pop();
        line.textContent = st ? st.text : "";
        line.dataset.pos = st ? st.pos || "bottom-left" : "bottom-left";
        line.style.opacity = "1";
      }
      a.classList.add("is-on");
      b.classList.remove("is-on");
      a.play().catch(() => {});
      if (i + 1 < names.length) {
        b.src = src(names[i + 1]);
        b.load();
      }
    };

    const next = () => {
      if (i + 1 >= names.length) {
        section.classList.remove("film--playing");
        button.hidden = false;
        button.lastElementChild.textContent = "Watch it again";
        return;
      }
      i += 1;
      [a, b] = [b, a];
      run();
    };
    a.addEventListener("ended", next);
    b.addEventListener("ended", next);

    button.addEventListener("click", () => {
      button.hidden = true;
      section.classList.add("film--playing");
      i = 0;
      a.preload = "auto";
      a.src = src(names[0]);
      a.addEventListener("loadeddata", run, { once: true });
      a.load();
    });
  }

  // Frames are 16:9. On a landscape-ish viewport they can fill the stage, but
  // covering a stage that is much squarer than the frame throws the sides
  // away, and this film's composition runs the full width: the syringe enters
  // from the left, the safe and its lit screen sit hard right. At 1163x1022 -
  // an ordinary laptop window - covering hid a third of the width and cut the
  // funded total down to "$24".
  //
  // So the test is not a breakpoint and not a fixed crop budget: cover only
  // while the safe's screen, which is the payoff of the whole film, stays
  // comfortably inside the crop. Stated that way it stays correct if the
  // framing ever moves, because QUAD moves with it. Everything else letterboxes
  // — the whole composition survives as a cinema band, and the bars are the
  // same --vault the section already sits on.
  const QUAD_PAD = 0.02; // of the frame, kept clear around the screen
  let quadSpan = null; // QUAD is declared further down; read it on first use
  const covers = (cw, ch, fw, fh) => {
    if (!quadSpan) {
      const us = QUAD.map(([u]) => u);
      const vs = QUAD.map(([, v]) => v);
      quadSpan = { x: [Math.min(...us), Math.max(...us)], y: [Math.min(...vs), Math.max(...vs)] };
    }
    const scale = Math.max(cw / fw, ch / fh);
    const fits = ([lo, hi], shown) => {
      const edge = (1 - shown) / 2; // trimmed off each side
      return lo >= edge + QUAD_PAD && hi <= 1 - edge - QUAD_PAD;
    };
    return fits(quadSpan.x, cw / (fw * scale)) && fits(quadSpan.y, ch / (fh * scale));
  };
  // Every frame in the film is the same shape, so the poster and a stage with
  // no frame decoded yet can be judged on this.
  const ASPECT = { width: 1920, height: 1072 };
  const WIDE = window.matchMedia("(min-width: 768px)");
  let cover = WIDE.matches;
  const ground = getComputedStyle(document.documentElement).getPropertyValue("--vault").trim() || "#0a0c0b";

  const MANIFEST = "/media/film/frames/manifest.json";
  const WINDOW = 1; // beats either side of the current one to keep resident

  /** @type {{beat:number,count:number,pattern:string,start:number,frames:Array,state:string}[]} */
  let beats = [];
  let total = 0;
  let current = -1;
  let frameSize = null;
  let trigger = null;
  // Draw the film at a scroll progress. Assigned once the trigger exists; also
  // called when a beat finishes loading, so frames that arrive after the
  // playhead has passed them still get on screen (see loadBeat).
  let render = () => {};
  let steps = [];
  let mobileSet = false; // true when the half-rate mobile frame sets are in use

  /* Drawing ------------------------------------------------------------ */

  const paint = (index) => {
    const beat = beats.find((b) => index >= b.start && index < b.start + b.count);
    const frame = beat?.frames[index - beat.start];
    if (!frame || index === current) return;
    current = index;
    /* Every frame in the film shares one size, so remembering it here means
       the counter can always be placed - even when the caller jumps straight
       to a scroll position whose own frame has not decoded yet. Without this
       the overlay skipped placement and rendered at its unstyled default
       size, spilling out past the bezel. */
    frameSize = { width: frame.width, height: frame.height };

    const cw = canvas.width;
    const ch = canvas.height;
    cover = covers(cw, ch, frame.width, frame.height);
    const fit = cover ? Math.max : Math.min;
    const scale = fit(cw / frame.width, ch / frame.height);
    const w = frame.width * scale;
    const h = frame.height * scale;

    if (!cover) {
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.drawImage(frame, (cw - w) / 2, (ch - h) / 2, w, h);
  };

  // Nearest frame that is actually decoded, so scrubbing ahead of the
  // download still moves instead of freezing.
  const nearest = (want) => {
    const has = (i) => {
      const b = beats.find((x) => i >= x.start && i < x.start + x.count);
      return b?.frames[i - b.start] ? i : -1;
    };
    if (has(want) >= 0) return want;
    for (let step = 1; step < total; step += 1) {
      if (has(want - step) >= 0) return want - step;
      if (has(want + step) >= 0) return want + step;
    }
    return -1;
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const f = frameSize || ASPECT;
    cover = covers(canvas.width, canvas.height, f.width, f.height);
    // The poster has to be fitted the same way, or the picture jumps size at
    // the handover from poster to canvas.
    if (poster) poster.style.objectFit = cover ? "cover" : "contain";
    const redraw = current;
    current = -1;
    if (redraw >= 0) paint(redraw);
  };

  /* Windowed loading --------------------------------------------------- */

  // Sequential within a beat: dozens of parallel requests stall the connection
  // and starve whatever else the page is still fetching.
  const loadBeat = async (beat) => {
    if (beat.state !== "idle") return;
    beat.state = "loading";
    section.classList.add("film--loading");

    for (let i = 0; i < beat.count; i += 1) {
      if (beat.state === "dropped") return;
      const url = beat.pattern.replace("%d", String(i + 1).padStart(4, "0"));
      try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await img.decode();
        beat.frames[i] = img;
      } catch {
        // One missing frame is survivable — nearest() covers it. Two in a row
        // means the set is broken, so stop spending on it.
        if (i > 0 && !beat.frames[i - 1]) break;
      }
      if (bar) {
        const done = beats.reduce((n, b) => n + b.frames.filter(Boolean).length, 0);
        bar.style.width = `${Math.round((done / total) * 100)}%`;
      }
      if (!trigger && beat.frames.filter(Boolean).length > 2) activate();
    }

    beat.state = "ready";
    // Frames that arrived after the playhead had already passed them. Without
    // this the film can come to rest one frame short of the end - and since
    // the counter reads the painted frame, it stops just short of the funded
    // figure and stays there until the next scroll.
    if (trigger) render(trigger.progress);
    if (!beats.some((b) => b.state === "loading")) section.classList.remove("film--loading");
  };

  // Release beats outside the window so nine beats never sit in memory at
  // once. Dropping the Image references lets the browser reclaim the decode.
  //
  // The beat in view loads first and its neighbours only once it is done, so
  // on a thin connection the frames you are looking at are not sharing the
  // pipe with the ones you are not. The total fetched is the same.
  let lastCentre = 1;
  const retire = (centre) => {
    lastCentre = centre;
    beats.forEach((b) => {
      const near = Math.abs(b.beat - centre) <= WINDOW;
      if (!near && b.state !== "idle") {
        b.state = "dropped";
        b.frames = new Array(b.count);
      }
      if (near && b.state === "dropped") b.state = "idle";
    });
    const main = beats.find((b) => b.beat === centre);
    if (main && main.state !== "ready") {
      // Once it is ready, come back for the neighbours. render() does this on
      // the next scroll anyway; this covers a reader who has stopped scrolling.
      if (main.state === "idle") loadBeat(main).then(() => main.state === "ready" && retire(lastCentre));
      return;
    }
    beats.forEach((b) => {
      if (b.state === "idle" && Math.abs(b.beat - centre) <= WINDOW) loadBeat(b);
    });
  };

  /* Captions ----------------------------------------------------------- */

  let shown = -1;
  /* Four steps, not nine lines. Each names a big move and holds across
     several shots, and each carries its own corner: a caption pinned to one
     spot for the whole film ends up sitting on a face in one beat and on the
     brightest part of the picture in the next. The corner is chosen per step
     against what that stretch of footage actually looks like. */
  const stepFor = (beatNo) => {
    let hit = null;
    for (const st of steps) if (beatNo >= st.beat) hit = st;
    return hit;
  };
  const say = (beatNo) => {
    if (!caption) return;
    const step = stepFor(beatNo);
    const key = step ? step.beat : -1;
    if (key === shown) return;
    shown = key;
    const text = step ? step.text : "";
    caption.dataset.pos = step ? step.pos || "bottom-left" : "bottom-left";
    gsap.to(caption, {
      opacity: 0,
      y: 6,
      duration: 0.22,
      ease: "power2.in",
      onComplete: () => {
        caption.textContent = text;
        gsap.to(caption, { opacity: text ? 1 : 0, y: 0, duration: 0.34, ease: "power2.out" });
      },
    });
  };

  /* Funded counter ------------------------------------------------------
     Shown on the blank screen on top of the safe in the final beat.

     It has to read as the screen showing the number, not as a label parked
     on top of it. The screen is seen in slight perspective, so an upright
     box cannot sit inside it: the element is a fixed-size plane mapped onto
     the glass's four measured corners with a homography (matrix3d). It adds
     light rather than painting a panel (mix-blend-mode: screen in CSS), so
     the footage's own dark glass and reflections stay visible through it.

     The corners are fixed in the FRAME (the camera is locked for the whole
     beat), and the frame is drawn with the same cover/contain maths as
     paint(), so they are re-derived from where the frame landed on the
     canvas. Anything anchored to the stage drifts as the viewport changes.

     The value follows the measured drain curve (tools/film-drain.py writes
     it into the manifest), so the number climbs exactly as the money leaves
     the barrel, and it can only ever rise. */

  // The screen's glass as fractions of the frame, measured on the final beat
  // (frames/d/b11, 1920x1072): top-left, top-right, bottom-right, bottom-left.
  // Re-measure if the final beat is regenerated.
  const QUAD = [
    [1454 / 1920, 170 / 1072],
    [1779 / 1920, 148 / 1072],
    [1777 / 1920, 285 / 1072],
    [1457 / 1920, 298 / 1072],
  ];
  const PLANE = { w: 1000, h: 420 }; // the element's own size; matches 10-film.css
  const TARGET = 999999; // the funded total on the safe screen (Jonathan, 2026-09-29)
  const POWER_ON = 0.06; // share of the beat over which the screen lights up

  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

  // Homography taking the unit square to quad p0..p3 (Heckbert's method).
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

  const placeCounter = (frame) => {
    const f = frame || frameSize;
    if (!counter || !f) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const dpr = cw / canvas.getBoundingClientRect().width || 1;
    const fit = cover ? Math.max : Math.min;
    const scale = fit(cw / f.width, ch / f.height);
    const w = f.width * scale;
    const h = f.height * scale;
    const x0 = (cw - w) / 2;
    const y0 = (ch - h) / 2;
    // Corners in stage CSS pixels.
    const quad = QUAD.map(([u, v]) => [(x0 + u * w) / dpr, (y0 + v * h) / dpr]);
    const [a, b, c, d, e, f2, g, hh] = squareToQuad(quad);
    const W = PLANE.w;
    const H = PLANE.h;
    counter.style.transform =
      `matrix3d(${a / W},${d / W},0,${g / W},${b / H},${e / H},0,${hh / H},0,0,1,0,${c},${f2},0,1)`;
  };

  const updateCounter = (beat, frameIndex, frame) => {
    if (!counter || !counterValue) return;
    if (beat !== beats[beats.length - 1]) {
      counter.style.opacity = "0";
      return;
    }
    const pos = beat.count > 1 ? frameIndex / (beat.count - 1) : 1;
    // Drain curve is measured per desktop frame; sample it by position so
    // the half-length mobile sequence reads the same curve.
    const curve = beat.drain;
    const drained = curve?.length ? curve[Math.round(pos * (curve.length - 1))] : pos;
    counter.style.opacity = String(Math.min(1, pos / POWER_ON));
    counterValue.textContent = money(TARGET * drained);
    placeCounter(frame);
  };

  /* Wiring ------------------------------------------------------------- */

  /* ScrollTrigger refreshes its triggers in the order they were created, and
     this pin is created late — only once the section is near and the manifest
     and first frames have loaded. Everything below the film on the page was
     therefore measured BEFORE the pin spacer existed, so every start/end below
     came out ~10,400px too high: the clock in "Where the hours go" sat inside
     the film's range, its hand never moved, and its jump buttons, ring taps
     and drags scrolled into the middle of the video. refreshPriority on the
     pin plus a sort() puts it first in line, so the rest measure the real
     page. sort() is the part that applies the priority — refresh() alone does
     not reorder. */
  const refresh = () => {
    ST.sort();
    ST.refresh();
  };

  const activate = () => {
    if (trigger) {
      refresh();
      return;
    }

    section.classList.add("film--ready");
    size();
    paint(nearest(0));
    section.classList.add("film--live");
    // Name the first step up front. onUpdate only fires once the scroll moves,
    // so without this the film opens with an empty caption.
    say(1);

    diag.beats = beats.length;
    diag.frames = total;
    bail("RUNNING - scrubbed film is active");

    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    const tablet = WIDE.matches;
    // Roughly half a viewport per beat. The first pass used a full viewport
    // each and took 27 wheel notches to get through three beats, which read
    // as a tunnel rather than a film.
    // Roughly double the first pass. At 55vh a beat the film outran the eye;
    // this is about a screen of scrolling per shot, which with the new scroll
    // easing reads as unhurried rather than as a tunnel.
    render = (progress) => {
      const want = Math.min(total - 1, Math.round(progress * (total - 1)));
      const have = nearest(want);
      if (have >= 0) paint(have);

      const beat = beats.find((b) => want >= b.start && want < b.start + b.count) || beats[0];
      say(beat.beat);
      retire(beat.beat);

      /* The counter reads off the PICTURE, not off the scrollbar. While the
         last beat is still loading, nearest() holds an earlier frame on the
         canvas; counting from `want` there runs the funded total up to the
         full figure over a syringe that is still half full - which is exactly
         what "the money drains before it is squished" looks like. The caption
         still follows the scroll, because a caption names the step you have
         scrolled into, not the frame that got there first. */
      const painted = have >= 0 ? have : want;
      const at = beats.find((b) => painted >= b.start && painted < b.start + b.count) || beat;
      updateCounter(at, painted - at.start, at.frames[painted - at.start]);
    };

    const perBeat = desktop ? 105 : tablet ? 95 : 78;
    // Paced per frame, not per beat: beats are no longer all 75 frames (the
    // stamp is trimmed, the drain runs 120), and a per-beat length would
    // rush the long ones. 75 desktop frames is one beat's worth of scroll.
    const frames = beats.reduce((n, b) => n + b.count * (mobileSet ? 2 : 1), 0);
    const end = `+=${(perBeat * frames) / 75}%`;

    trigger = ST.create({
      trigger: section,
      start: "top top",
      end,
      pin: stage,
      pinSpacing: true,
      scrub: 0.15, // near-instant; Lenis provides the smoothing
      invalidateOnRefresh: true,
      // Refreshed before everything else, because this pin sets the page
      // height that every trigger below it measures against (see refresh()).
      refreshPriority: 1,
      onUpdate: (self) => render(self.progress),
    });

    refresh();
  };

  const start = async () => {
    let manifest;
    try {
      // NOT force-cache. This URL legitimately 404s before the frames have
      // been generated, and force-cache will keep replaying that cached 404
      // forever — it skips revalidation, so even a hard reload will not clear
      // it, and the film silently never starts. Normal caching revalidates.
      const res = await fetch(MANIFEST);
      if (!res.ok) throw new Error("HTTP " + res.status);
      manifest = await res.json();
    } catch (err) {
      diag.manifestError = String(err && err.message ? err.message : err);
      bail("manifest could not be loaded -> storyboard");
      return;
    }
    if (!Array.isArray(manifest.beats) || !manifest.beats.length) {
      bail("manifest has no beats -> storyboard");
      return;
    }

    steps = JSON.parse(section.dataset.filmSteps || "[]");

    const mobile = !WIDE.matches;
    mobileSet = mobile;
    let at = 0;
    beats = manifest.beats
      .map((b) => {
        const set = mobile && b.mobile?.count ? b.mobile : b.desktop;
        if (!set?.count || !set.pattern) return null;
        const entry = { beat: b.beat, count: set.count, pattern: set.pattern, start: at, frames: new Array(set.count), state: "idle", drain: b.drain };
        at += set.count;
        return entry;
      })
      .filter(Boolean);

    total = at;
    if (!total) {
      bail("manifest listed no usable frames -> storyboard");
      return;
    }
    retire(1);
  };

  /* When to start fetching frames (issue #4, page speed).
     The film sits directly under a full-height hero, so "a viewport and a
     half out" was true the moment the page opened: every first visit pulled
     two beats of frames (~9 MB desktop, ~2 MB phone) whether or not anyone
     scrolled, and because those Image() requests began before window.load
     they also held the opening loader up. Now nothing is fetched until
       1. the page has finished loading (the hero and loader go first), and
       2. the visitor has scrolled at all - or arrived already scrolled, via
          a restored position or an anchor - and
       3. the section is within a viewport and a half, as before.
     The pin only starts once the section's top reaches the top of the
     screen, a full viewport of scrolling after the first tick, which is
     the head start the first frames need. Until they arrive the storyboard
     stands in, exactly as it always has on a slow connection. */
  const begin = () => {
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        watcher.disconnect();
        start();
      },
      { rootMargin: "150% 0px" }
    );
    watcher.observe(section);
  };
  const whenScrolled = () => {
    if (window.scrollY > 0) {
      begin();
      return;
    }
    window.addEventListener("scroll", begin, { once: true, passive: true });
  };
  if (document.readyState === "complete") whenScrolled();
  else window.addEventListener("load", whenScrolled, { once: true });

  // Track the stage's own box, not the window's. A window resize event is not
  // fired for every layout change that matters — resizing a preview pane, a
  // devtools dock, a collapsing sidebar — and when one is missed the canvas
  // keeps its old backing size and gets stretched, which looks like badly
  // blurred video rather than a bug.
  let pending = 0;
  const remeasure = () => {
    size();
    clearTimeout(pending);
    pending = setTimeout(() => trigger && refresh(), 120);
  };
  if (window.ResizeObserver) {
    new ResizeObserver(remeasure).observe(stage);
  }
  window.addEventListener("resize", remeasure);
  if (poster && !poster.complete) poster.addEventListener("load", () => refresh(), { once: true });
  if (document.fonts) document.fonts.ready.then(() => refresh());
})();
