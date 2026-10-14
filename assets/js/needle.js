/* Cash injection hero: a real 3D syringe of money injecting into a safe
   (John, 14 Oct 2026). The first version scrubbed the film's frames; John:
   "it is also cut off ... the screen is wobbly ... I want more of a 3D
   object ... we need to show numbers".

   Built in three.js from simple solids so it stays light (no model file):
   a glass barrel full of gold coins and bills, a steel plunger and needle,
   and a safe whose screen counts the dollars that go in. It injects on a
   loop. Drag (mouse or finger) spins the whole thing, with inertia; left
   alone it settles back to a three-quarter view. Arrow keys spin it too.
   No WebGL or reduced motion: the still picture stays. */
(() => {
  const stage = document.querySelector("[data-needle]");
  if (!stage) return;
  // three.js r128 (UMD) from cdnjs, loaded only on this page and only here.
  const THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const go = () => window.THREE && boot(window.THREE);
  if (window.THREE) go();
  else {
    const tag = document.createElement("script");
    tag.src = THREE_SRC;
    tag.crossOrigin = "anonymous";
    tag.onload = go;
    document.head.append(tag);
  }

  function boot(THREE) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (_) {
    return; // no WebGL: the poster stays
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.querySelector(".needle__canvas").append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 10, 0.1, 100);

  /* Studio reflections: a dark room with three soft boxes, baked into an
     environment map so the steel reads as steel. */
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x15171a, side: THREE.BackSide })));
    const box = (w, h, x, y, z, c) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      room.add(m);
    };
    box(14, 4, 0, 12, 4, 0xffffff);
    box(6, 10, -14, 2, 6, 0xbfd6ff);
    box(6, 10, 14, 1, -4, 0xffe3b8);
    box(20, 2, 0, -6, 14, 0x555a60);
    scene.environment = pmrem.fromScene(room, 0.03).texture;
    pmrem.dispose();
  }

  const key = new THREE.DirectionalLight(0xfff1dc, 2.8);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2);
  rim.position.set(-6, 3, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  /* Materials */
  const steel = new THREE.MeshStandardMaterial({ color: 0xeef0f2, metalness: 1, roughness: 0.18, envMapIntensity: 1.5 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
  const brushed = new THREE.MeshStandardMaterial({ color: 0xc4c8cd, metalness: 1, roughness: 0.36, envMapIntensity: 1.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0, roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.12,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false,
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c25b, metalness: 1, roughness: 0.25, emissive: 0x6b4508, emissiveIntensity: 0.35 });
  const bill = new THREE.MeshStandardMaterial({ color: 0x4f6b47, metalness: 0, roughness: 0.75, emissive: 0x101a0d, emissiveIntensity: 0.3 });

  /* The object. Everything lies along X: plunger on the left, safe on the right. */
  const rig = new THREE.Group(); // turns
  scene.add(rig);
  const obj = new THREE.Group(); // holds the model, offset so rig turns about its centre
  rig.add(obj);
  const along = (geo) => geo.rotateZ(Math.PI / 2); // cylinders stand on Y; lay them on X

  const BARREL_L = -2.2;
  const BARREL_R = 1.0;
  const R = 0.56;
  const barrel = new THREE.Mesh(along(new THREE.CylinderGeometry(R, R, BARREL_R - BARREL_L, 48, 1, true)), glass);
  barrel.position.x = (BARREL_L + BARREL_R) / 2;
  obj.add(barrel);
  for (const x of [BARREL_L, BARREL_R]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.045, 12, 48), steel);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    obj.add(ring);
  }
  // Graduation marks on the glass
  for (let i = 0; i <= 12; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, i % 4 === 0 ? 0.22 : 0.12), darkSteel);
    tick.position.set(BARREL_L + 0.3 + i * 0.22, R + 0.002, 0);
    tick.rotation.x = Math.PI / 2;
    tick.position.y = Math.cos(0.35) * R;
    tick.position.z = Math.sin(0.35) * R;
    obj.add(tick);
  }
  // Nose cone, hub and needle
  const cone = new THREE.Mesh(along(new THREE.CylinderGeometry(0.12, R, 0.42, 48, 1, true)), glass);
  cone.position.x = BARREL_R + 0.21;
  cone.rotation.z += Math.PI; // narrow end towards the needle
  obj.add(cone);
  const hub = new THREE.Mesh(along(new THREE.CylinderGeometry(0.07, 0.13, 0.26, 24)), steel);
  hub.rotation.z += Math.PI;
  hub.position.x = BARREL_R + 0.55;
  obj.add(hub);
  const NEEDLE_L = BARREL_R + 0.68;
  const SAFE_L = 3.05;
  const needle = new THREE.Mesh(along(new THREE.CylinderGeometry(0.022, 0.022, SAFE_L - NEEDLE_L + 0.1, 16)), steel);
  needle.position.x = (NEEDLE_L + SAFE_L) / 2;
  obj.add(needle);
  // Finger flange (hexagonal) and a stand under the barrel
  const flange = new THREE.Mesh(along(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 6)), brushed);
  flange.position.x = BARREL_L - 0.06;
  obj.add(flange);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.5), brushed);
  stand.position.set(BARREL_L + 0.45, -0.705, 0);
  obj.add(stand);

  // Plunger: rubber stopper, rod and thumb press move together
  const plunger = new THREE.Group();
  const stopper = new THREE.Mesh(along(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.26, 48)), rubber);
  plunger.add(stopper);
  const rod = new THREE.Mesh(along(new THREE.CylinderGeometry(0.11, 0.11, 3.1, 24)), steel);
  rod.position.x = -1.6;
  plunger.add(rod);
  const thumb = new THREE.Mesh(along(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 6)), brushed);
  thumb.position.x = -3.15;
  plunger.add(thumb);
  obj.add(plunger);
  const STOP_FROM = BARREL_L + 0.25;
  const STOP_TO = BARREL_R - 0.16;

  /* The money: coins and bills packed in the barrel (instanced, cheap). */
  const COINS = 260;
  const BILLS = 70;
  const coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 20), gold, COINS);
  const billMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.004, 0.14), bill, BILLS);
  obj.add(coinMesh, billMesh);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const place = (n) =>
    Array.from({ length: n }, () => {
      const r = Math.sqrt(Math.random()) * (R - 0.12);
      const t = Math.random() * Math.PI * 2;
      return {
        p: new THREE.Vector3(rnd(STOP_FROM + 0.12, BARREL_R - 0.06), Math.cos(t) * r, Math.sin(t) * r),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3))),
      };
    });
  const coins = place(COINS);
  const bills = place(BILLS);
  const m4 = new THREE.Matrix4();
  const ONE = new THREE.Vector3(1, 1, 1);
  const ZERO = new THREE.Vector3(0, 0, 0);
  const pack = (mesh, items, front) => {
    items.forEach((it, i) => {
      m4.compose(it.p, it.q, it.p.x > front ? ONE : ZERO);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  // A warm glow inside the money
  const glow = new THREE.PointLight(0xffc469, 1.6, 3.2, 2);
  glow.position.set(0, 0, 0);
  obj.add(glow);

  // Coins flowing down the needle while it injects
  const FLOW = 14;
  const flow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8), gold, FLOW);
  obj.add(flow);

  /* The safe, with a screen that counts what goes in */
  const safe = new THREE.Group();
  safe.position.x = SAFE_L + 0.8;
  obj.add(safe);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.5), brushed);
  safe.add(body);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.35, 0.06), steel);
  door.position.z = 0.78;
  safe.add(door);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 40), darkSteel);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.12, 0, 0.84);
  safe.add(dial);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8), steel);
    spoke.rotation.z = (i * Math.PI) / 3;
    spoke.position.set(0.12, 0, 0.88);
    safe.add(spoke);
  }
  for (const y of [0.42, -0.42]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 16), steel);
    hinge.position.set(-0.64, y, 0.8);
    safe.add(hinge);
  }
  const port = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 20), steel);
  port.rotation.y = Math.PI / 2;
  port.position.set(-0.81, 0, 0);
  safe.add(port);
  // Screen on top
  const SCREEN_W = 1024;
  const SCREEN_H = 300;
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = SCREEN_W;
  screenCanvas.height = SCREEN_H;
  const sctx = screenCanvas.getContext("2d");
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.encoding = THREE.sRGBEncoding;
  screenTex.anisotropy = 4;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.36), brushed);
  housing.position.set(0, 1.22, 0.4);
  safe.add(housing);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.46), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(0, 1.22, 0.585);
  safe.add(screen);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12), darkSteel);
  post.position.set(0, 0.92, 0.4);
  safe.add(post);

  // A dark stone slab under it all
  const slab = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.3, 2.4), new THREE.MeshStandardMaterial({ color: 0x030304, metalness: 0, roughness: 0.95, envMapIntensity: 0.15 }));
  slab.position.set(0.55, -1.0, 0);
  obj.add(slab);
  // The slab's top is y = -0.85, where the safe's body (1.7 tall, centred) stands.

  const fmt = (n) => "$" + Math.round(n).toLocaleString("en-US");
  let shownAmount = -1;
  const drawScreen = (amount, live) => {
    const v = Math.round(amount / 25) * 25;
    if (v === shownAmount) return;
    shownAmount = v;
    const g = sctx;
    g.fillStyle = "#07090a";
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const grad = g.createLinearGradient(0, 0, 0, SCREEN_H);
    grad.addColorStop(0, "rgba(134,183,154,0.10)");
    grad.addColorStop(1, "rgba(134,183,154,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, SCREEN_W, SCREEN_H);
    g.font = "600 46px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    g.fillStyle = "#86b79a";
    g.textAlign = "left";
    g.fillText(live ? "● FUNDING" : "FUNDED", 52, 82);
    g.textAlign = "right";
    g.fillStyle = "rgba(169,176,170,0.8)";
    g.fillText("TMF", SCREEN_W - 52, 82);
    g.font = "700 150px ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
    g.textAlign = "center";
    g.shadowColor = "rgba(242,194,91,0.75)";
    g.shadowBlur = 28;
    g.fillStyle = "#f6d27a";
    g.fillText(fmt(v), SCREEN_W / 2, 238);
    g.shadowBlur = 0;
    screenTex.needsUpdate = true;
  };

  /* Framing: fit the whole object in view at any aspect, with a margin,
     so nothing is ever cut off. */
  const box3 = new THREE.Box3().setFromObject(obj);
  const center = box3.getCenter(new THREE.Vector3());
  obj.position.copy(center).negate();
  const sphere = box3.getBoundingSphere(new THREE.Sphere());
  sphere.center.set(0, 0, 0);
  const fit = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    // The model is long and thin: the sphere around it is mostly empty above
    // and below, so frame its length (which never exceeds the diameter as it
    // spins) and allow a smaller height.
    const r = sphere.radius * 0.96;
    const dist = Math.max((r * 0.62) / Math.tan(vFov / 2), r / Math.tan(hFov / 2));
    camera.position.set(0, dist * 0.22, dist);
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
  };

  /* Spin: drag turns it; inertia carries on; idle eases back to the view. */
  const HOME_Y = -0.32;
  const HOME_X = 0.16;
  let rotY = HOME_Y;
  let rotX = HOME_X;
  let velY = 0;
  let velX = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let idleFor = 0;
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = velX = 0;
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add("is-grabbing", "was-touched");
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = dx * 0.011;
    velX = dy * 0.006;
    rotY += velY;
    rotX = Math.max(-0.35, Math.min(0.6, rotX + velX));
    idleFor = 0;
  });
  const release = () => {
    dragging = false;
    stage.classList.remove("is-grabbing");
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") velY += 0.06;
    else if (e.key === "ArrowLeft") velY -= 0.06;
    else return;
    e.preventDefault();
    idleFor = 0;
    stage.classList.add("was-touched");
  });

  /* The injection loop: push (4.2s), hold on the total (1.6s), pull back (1.4s). */
  const AMOUNTS = [85000, 150000, 240000, 410000, 125000, 320000];
  let cycle = 0;
  let t = 0;
  const PUSH = 4.2;
  const HOLD = 1.6;
  const BACK = 1.4;
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const flowState = Array.from({ length: FLOW }, (_, i) => i / FLOW);

  let visible = true;
  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
  }).observe(stage);

  const frame = (dt) => {
    // rotation
    if (!dragging) {
      rotY += velY;
      rotX += velX;
      velY *= 0.95;
      velX *= 0.9;
      idleFor += dt;
      if (idleFor > 2.5 && Math.abs(velY) < 0.002) {
        // ease back to the nearest full turn of the home view
        const turns = Math.round((rotY - HOME_Y) / (Math.PI * 2));
        const target = HOME_Y + turns * Math.PI * 2 + Math.sin(idleFor * 0.35) * 0.12;
        rotY += (target - rotY) * 0.03;
        rotX += (HOME_X - rotX) * 0.03;
      }
    }
    rig.rotation.set(rotX, rotY, 0);

    // injection
    t += dt;
    const total = PUSH + HOLD + BACK;
    if (t > total) {
      t -= total;
      cycle = (cycle + 1) % AMOUNTS.length;
    }
    let k; // 0 = full barrel, 1 = empty
    let live = false;
    if (t < PUSH) {
      k = ease(t / PUSH);
      live = true;
    } else if (t < PUSH + HOLD) k = 1;
    else k = 1 - ease((t - PUSH - HOLD) / BACK);
    plunger.position.x = STOP_FROM + (STOP_TO - STOP_FROM) * k;
    const front = plunger.position.x + 0.13;
    pack(coinMesh, coins, front);
    pack(billMesh, bills, front);
    glow.position.x = (front + BARREL_R) / 2;
    glow.intensity = 1.6 * (1 - k) + 0.2;
    // The screen counts up while it injects, then holds the total until the next push.
    drawScreen(live ? AMOUNTS[cycle] * k : AMOUNTS[cycle], live);
    // the flow down the needle
    const n0 = NEEDLE_L - 0.1;
    const n1 = SAFE_L;
    flowState.forEach((f, i) => {
      flowState[i] = (f + dt * 1.6) % 1;
      const on = live && k > 0.02 && k < 0.98;
      m4.compose(new THREE.Vector3(n0 + (n1 - n0) * flowState[i], 0, 0), new THREE.Quaternion(), on ? ONE : ZERO);
      flow.setMatrixAt(i, m4);
    });
    flow.instanceMatrix.needsUpdate = true;
    dial.rotation.y = k * Math.PI * 2;

    renderer.render(scene, camera);
  };

  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  fit();
  drawScreen(0, false);

  if (reduced) {
    t = PUSH + 0.1; // a filled screen, plunger in
    frame(0);
    stage.classList.add("is-live");
    return;
  }
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) frame(dt);
    requestAnimationFrame(loop);
  };
  stage.classList.add("is-live");
  requestAnimationFrame(loop);
  }
})();
