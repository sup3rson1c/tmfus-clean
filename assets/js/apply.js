/* TMF Team — four-step application (front-end only).
   Drafts autosave to sessionStorage (never files or consents). Social
   Security number and signature belong to the e-sign platform hand-off. */
(() => {
  const form = document.querySelector("[data-apply]");
  if (!form || !window.TMF?.forms) return;
  const { forms } = window.TMF;
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

  const STATES = "AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming"
    .split("|")
    .map((s) => [s.slice(0, 2), s.slice(3)]);
  const INDUSTRIES = ["Construction", "Healthcare", "Restaurant", "Retail", "Trucking", "Wholesale", "Auto services", "Beauty", "Professional services", "Manufacturing", "Real estate", "Technology", "Staffing", "Cleaning", "Landscaping", "Entertainment", "Education", "Fitness", "E-commerce", "Other"];
  const FROM_CALC = { restaurant: "Restaurant", retail: "Retail", construction: "Construction", trucking: "Trucking", healthcare: "Healthcare", wholesale: "Wholesale", salon: "Beauty", other: "Other" };
  const STEP_NAMES = ["Business", "Owner", "Co-owner", "Statements and consent"];
  const DRAFT = "tmf-apply-draft";

  form.querySelectorAll("[data-states]").forEach((sel) =>
    sel.insertAdjacentHTML("beforeend", STATES.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")),
  );
  form.querySelectorAll("[data-industries]").forEach((sel) =>
    sel.insertAdjacentHTML("beforeend", INDUSTRIES.map((t) => `<option>${t}</option>`).join("")),
  );

  const steps = [...form.querySelectorAll("[data-step]")];
  const stepper = [...form.querySelectorAll(".stepper__item")];
  const back = form.querySelector("[data-apply-back]");
  const next = form.querySelector("[data-apply-next]");
  const summary = form.querySelector("[data-error-summary]");
  const card = document.getElementById("apply-card");
  let step = 1;

  /* Draft save / restore */
  const save = () => {
    try {
      const data = {};
      new FormData(form).forEach((v, k) => {
        if (typeof v === "string" && !k.startsWith("consent")) data[k] = v;
      });
      sessionStorage.setItem(DRAFT, JSON.stringify(data));
    } catch {
      /* storage unavailable: the form still works, it just won't remember */
    }
  };
  const restore = () => {
    try {
      const data = JSON.parse(sessionStorage.getItem(DRAFT) || "null");
      const params = new URLSearchParams(location.search);
      if (params.get("product")) form.elements.product.value = params.get("product");
      if (data) {
        for (const [k, v] of Object.entries(data)) {
          const el = form.elements[k];
          if (el && el.type !== "file") el.value = v;
        }
      }
      const estimate = JSON.parse(sessionStorage.getItem("tmf-estimate") || "null");
      if (estimate) {
        if (!form.elements.industry.value && FROM_CALC[estimate.industry]) form.elements.industry.value = FROM_CALC[estimate.industry];
        const note = document.querySelector("[data-estimate-note]");
        const fmt = (n) => `$${Number(n).toLocaleString("en-US")}`;
        document.querySelector("[data-estimate-range]").textContent = `${fmt(estimate.low)} – ${fmt(estimate.high)}`;
        note.hidden = false;
      }
    } catch {
      /* ignore malformed storage */
    }
  };
  restore();
  const coWrap = form.querySelector("[data-coowner]");
  const syncCoOwner = () => (coWrap.hidden = form.elements.coOwner.value !== "yes");
  syncCoOwner();

  forms.watch(form);
  form.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches("[data-money]")) {
      const n = Number(el.value.replace(/[^\d]/g, ""));
      el.value = n ? n.toLocaleString("en-US") : "";
    }
    if (el.name === "coOwner") {
      syncCoOwner();
      forms.check(form.querySelector("#co-no"));
    }
    save();
  });

  /* Steps */
  const goTo = (n) => {
    const dir = n > step ? 1 : -1;
    step = n;
    steps.forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
    stepper.forEach((li, i) => {
      li.classList.toggle("is-done", i < n - 1);
      if (i === n - 1) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    back.hidden = n === 1;
    next.textContent = n === 4 ? "Continue to secure signing" : "Continue";
    summary.hidden = true;
    form.querySelector("[data-apply-progress]").textContent = `Step ${n} of 4: ${STEP_NAMES[n - 1]}`;
    const current = steps[n - 1];
    if (motionOK && window.gsap) window.gsap.fromTo(current, { opacity: 0, x: 24 * dir }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" });
    const top = card.getBoundingClientRect().top;
    if (top < 0) {
      if (window.TMF.lenis) window.TMF.lenis.scrollTo(card, { offset: -96, immediate: !motionOK });
      else card.scrollIntoView({ block: "start", behavior: motionOK ? "smooth" : "auto" });
    }
    current.querySelector("input:not([type=hidden]), select")?.focus({ preventScroll: true });
  };
  back.addEventListener("click", () => goTo(step - 1));

  /* Statement uploads */
  const fileInput = form.querySelector("#statements");
  const chooseBtn = form.querySelector("#statements-btn");
  const drop = form.querySelector("[data-dropzone]");
  const list = form.querySelector("[data-file-list]");
  const fileErr = form.querySelector("#statements-err");
  const MAX = 10 * 1024 * 1024;
  let files = [];

  const sizeLabel = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const renderFiles = () => {
    list.replaceChildren(
      ...files.map((f, i) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "file-list__name";
        name.textContent = f.name;
        const size = document.createElement("span");
        size.className = "file-list__size";
        size.textContent = sizeLabel(f.size);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "file-list__remove";
        remove.dataset.index = i;
        remove.setAttribute("aria-label", `Remove ${f.name}`);
        remove.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>';
        li.append(name, size, remove);
        return li;
      }),
    );
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    fileInput.files = dt.files;
  };
  const addFiles = (incoming) => {
    let problem = "";
    for (const f of incoming) {
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) problem = `${f.name} isn't a PDF, JPG or PNG file.`;
      else if (f.size > MAX) problem = `${f.name} is larger than 10 MB. Split it or export a smaller PDF.`;
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) files.push(f);
    }
    renderFiles();
    if (problem) {
      fileErr.textContent = problem;
      fileErr.hidden = false;
    } else {
      forms.check(fileInput);
    }
  };
  chooseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => addFiles([...fileInput.files]));
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".file-list__remove");
    if (!btn) return;
    files.splice(Number(btn.dataset.index), 1);
    renderFiles();
    chooseBtn.focus();
  });
  ["dragenter", "dragover"].forEach((type) =>
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add("is-over");
    }),
  );
  ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, () => drop.classList.remove("is-over")));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    addFiles([...e.dataTransfer.files]);
  });

  /* Submit: validate the current step, advance, then hand off */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const invalid = forms.validate(steps[step - 1]);
    if (invalid.length) {
      chooseBtn.toggleAttribute("aria-invalid", invalid.includes(fileInput));
      return forms.summarize(summary, invalid);
    }
    summary.hidden = true;
    if (step < 4) return goTo(step + 1);

    forms.loading(next, true, "Preparing secure signing");
    // Front-end only: the live build hands off to the e-sign platform here.
    await new Promise((r) => setTimeout(r, 1200));
    forms.loading(next, false);
    form.hidden = true;
    const done = document.getElementById("apply-success");
    const reference = `TMF-${String(Math.floor(100000 + Math.random() * 900000))}`;
    const referenceEl = done.querySelector("[data-reference]");
    done.hidden = false;
    // The reference number rolls into place like a numbering machine
    if (window.TMF.motion?.roll) window.TMF.motion.roll(referenceEl, reference, { delay: 0.2 });
    else referenceEl.textContent = reference;
    done.focus();
    try {
      sessionStorage.removeItem(DRAFT);
    } catch {
      /* nothing to clear */
    }
  });
})();
