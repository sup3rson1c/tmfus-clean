/* TMF Team · opening loader.

   The dial mark strokes itself on over the vault ground, then lifts away into
   the hero.

   Safety first, because a loader is the one component that can make a working
   site unusable:
     - It ships hidden and is only shown by this script, so no JavaScript means
       no overlay rather than a permanent dark screen.
     - A hard ceiling dismisses it whether or not anything finished loading. A
       stalled font or image must never hold the page hostage.
     - It shows only once per session. Seeing a loader on every navigation is
       an irritation, not a brand moment.
     - Reduced motion and returning visitors skip it outright.
     - The page beneath is fully rendered the whole time, so dismissing it is
       just removing a cover, never a swap-in.

   Whether it shows is decided by the inline script in the head (partials/
   head.html), before first paint. Deciding it here, in a deferred script that
   waits on GSAP from the CDN, let the page flash first and cut the cover's
   time on screen to a blink. The mark draws itself in CSS for the same
   reason; this script only decides when the cover lifts.

   Scroll is locked only while it is up, and always released in one place. */
(() => {
  const el = document.querySelector("[data-loader]");
  if (!el) return;

  const root = document.documentElement;
  const SEEN = "tmf-loader-seen";
  const CEILING = 4000; // hard dismissal, whatever else is happening
  // The cover lifts once the mark has finished drawing AND the page has
  // loaded, then holds this long so the finished mark registers. Tied to the
  // real end of the drawing rather than a clock: a fixed time from navigation
  // start lifted it mid-word whenever first paint came late.
  const HOLD = 300;

  // Head script said no: reduced motion, or already seen this session.
  if (!root.classList.contains("is-loading")) {
    el.remove();
    return;
  }

  // Take over from the head script's class, so the fade-out still has an
  // element to fade once .is-loading comes off.
  el.hidden = false;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {
      /* not fatal */
    }
    root.classList.remove("is-loading");
    el.classList.add("is-out");
    // The hero holds its entrance until now, so it plays as the cover lifts
    // instead of finishing unseen underneath it.
    window.dispatchEvent(new Event("tmf:loader-done"));
    // Remove rather than leave a transparent overlay sitting over the page,
    // which would swallow every click.
    const strip = () => el.remove();
    el.addEventListener("transitionend", strip, { once: true });
    setTimeout(strip, 900); // in case the transition never fires
  };

  // The ceiling is set before anything else, so every path out is covered
  // even if the animation below throws.
  const ceiling = setTimeout(finish, Math.max(0, CEILING - performance.now()));

  // The wordmark is the last thing to animate in (02-loader.css). The timeout
  // covers a browser that never reports animationend.
  const word = el.querySelector(".loader__word");
  const drawn = new Promise((resolve) => {
    if (word) word.addEventListener("animationend", resolve, { once: true });
    setTimeout(resolve, 2600);
  });
  const loaded = new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  });
  Promise.all([drawn, loaded]).then(() => {
    setTimeout(() => {
      clearTimeout(ceiling);
      finish();
    }, HOLD);
  });

  // Anyone who scrolls or presses a key has decided they are done waiting.
  const impatient = () => {
    clearTimeout(ceiling);
    finish();
  };
  window.addEventListener("wheel", impatient, { once: true, passive: true });
  window.addEventListener("keydown", impatient, { once: true });
  window.addEventListener("touchstart", impatient, { once: true, passive: true });
})();
