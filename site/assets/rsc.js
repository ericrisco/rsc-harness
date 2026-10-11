(() => {
  const ES = (document.documentElement.lang || '').startsWith('es');
  const tr = (en, es) => (ES ? es : en);
  const CATALOG = (() => { try { return JSON.parse(document.getElementById('rsc-catalog').textContent); } catch { return []; } })();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduce;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  if (hasGsap) { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.config({ ignoreMobileResize: true }); }
  // Mobile browsers fire resize when the address bar shows or hides; only a width change is a real resize.
  const onWidthResize = (fn) => { let w = innerWidth; addEventListener('resize', () => { if (innerWidth !== w || fine) { w = innerWidth; fn(); } }); };

  /* ================= scroll: native, so wheel, trackpad and iframes behave ================= */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); } }));

  /* ================= copy ================= */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', () => {
    const label = b.textContent; const ok = () => { b.textContent = tr('Copied', 'Copiado'); b.classList.add('done'); setTimeout(() => { b.textContent = label; b.classList.remove('done'); }, 1600); };
    const sel = () => { const host = b.closest('.in-alt, .agent-prompt, .cmd-hero'); const el = host && host.querySelector(host.matches('.in-alt') ? 'code' : 'p, code'); if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    try { navigator.clipboard.writeText(b.dataset.copy).then(ok, sel); } catch { sel(); }
  }));

  /* ================= live star count ================= */
  (() => {
    const el = document.getElementById('starN'); if (!el) return;
    fetch('https://api.github.com/repos/ericrisco/rsc-harness').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j && typeof j.stargazers_count === 'number') { el.textContent = j.stargazers_count.toLocaleString(tr('en-US', 'es-ES')); el.hidden = false; }
    }).catch(() => {});
  })();

  /* ================= cursor + magnetic ================= */
  let px = innerWidth / 2, py = innerHeight / 2, nx = 0, ny = 0;
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; nx = (px / innerWidth) * 2 - 1; ny = (py / innerHeight) * 2 - 1; });
  if (fine && !reduce) {
    document.documentElement.classList.add('has-cursor');
    const cur = $('#cur'), ring = $('#curRing'); let rx = px, ry = py;
    (function loop() { rx += (px - rx) * 0.18; ry += (py - ry) * 0.18; cur.style.transform = `translate(${px}px,${py}px) translate(-50%,-50%)`; ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
    document.addEventListener('pointerover', (e) => ring.classList.toggle('big', !!e.target.closest('a, button, input, .cell')));
    $$('.mag, .copy').forEach((el) => {
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ================= header ================= */
  let lastY = 0;
  const bar = $('#bar');
  function onScrollUI(y) { bar.classList.toggle('solid', y > 30); bar.classList.toggle('hide', y > lastY && y > 400); lastY = y; }
  addEventListener('scroll', () => onScrollUI(scrollY), { passive: true });

  /* ================= WebGL field ================= */
  const canvas = $('#field');
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false });
  const SHAPES = 7;
  const field = { morph: 0, target: 0, vel: 0, anchors: [], ok: false };
  const ANCH = [[0, -0.3, 0], [-2.2, 0.55, 0], [2.2, 0.55, 0], [-2.2, -1.15, 0], [2.2, -1.15, 0]];
  let camRot = [0, 0];
  if (gl) {
    const small = innerWidth < 760;
    const N = small ? 7000 : 15000;
    const R = () => Math.random();
    const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const sphere = (r) => { const t = R() * Math.PI * 2, p = Math.acos(2 * R() - 1); return [r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p)]; };
    const shapes = Array.from({ length: SHAPES }, () => new Float32Array(N * 3));
    const rnd = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      rnd.set([R(), R(), R(), R()], i * 4);
      // 0 chaos: loose documents everywhere
      shapes[0].set([(R() * 2 - 1) * 5, (R() * 2 - 1) * 2.9, (R() * 2 - 1) * 2.5], i * 3);
      // 1 amnesia: everything drifts away and down
      const a = R() * Math.PI * 2, rr = 3 + R() * 4;
      shapes[1].set([Math.cos(a) * rr, -1.5 - R() * 3.5, Math.sin(a) * rr - 1], i * 3);
      // 2 model + four pieces
      const k = i % 10;
      if (k < 4) { const s = sphere(0.78 + gauss() * 0.04); shapes[2].set([s[0] + ANCH[0][0], s[1] + ANCH[0][1], s[2] + ANCH[0][2]], i * 3); }
      else { const c = ANCH[1 + (k % 4)]; const s = sphere(0.36 + R() * 0.1); shapes[2].set([c[0] + s[0], c[1] + s[1], c[2] + s[2]], i * 3); }
      // 3 lattice: an ordered plane (documented structure)
      const gx = (i % 150) / 149, gz = Math.floor(i / 150) / Math.ceil(N / 150);
      shapes[3].set([(gx * 2 - 1) * 5.2, -1.15, (gz * 2 - 1) * 3.2 - 0.4], i * 3);
      // 4 three lanes
      const lane = i % 3;
      shapes[4].set([(lane - 1) * 2.1 + gauss() * 0.16, 0, gauss() * 0.3], i * 3);
      // 5 catalog sphere
      shapes[5].set(sphere(2.05), i * 3);
      // 6 closed ring: the harness
      const th = R() * Math.PI * 2, ph = R() * Math.PI * 2, tr = 0.16 + gauss() * 0.03;
      shapes[6].set([(2.1 + tr * Math.cos(ph)) * Math.cos(th), tr * Math.sin(ph), (2.1 + tr * Math.cos(ph)) * Math.sin(th)], i * 3);
    }
    const vs = `#version 300 es
      precision highp float;
      in vec3 a0; in vec3 a1; in vec3 a2; in vec3 a3; in vec3 a4; in vec3 a5; in vec3 a6; in vec4 aR;
      uniform float uM, uT, uAspect, uF, uCam, uPix, uFit, uVel;
      uniform vec2 uRot, uMouse;
      out vec3 vCol; out float vA;
      float seg(float m, float k, float r) { return smoothstep(0.0, 1.0, clamp((m - k) * 1.35 - r * 0.35, 0.0, 1.0)); }
      void main() {
        float m = uM;
        vec3 s4 = vec3(a4.x, fract(aR.y - uT * 0.05 * (0.6 + aR.z)) * 5.6 - 2.8, a4.z);
        vec3 s3 = a3 + vec3(0.0, sin(a3.x * 1.3 + uT * 0.9) * 0.18 + cos(a3.z * 1.7 + uT * 0.7) * 0.14, 0.0);
        vec3 p = a0;
        p = mix(p, a1, seg(m, 0.0, aR.x));
        p = mix(p, a2, seg(m, 1.0, aR.x));
        p = mix(p, s3, seg(m, 2.0, aR.x));
        p = mix(p, s4, seg(m, 3.0, aR.x));
        p = mix(p, a5, seg(m, 4.0, aR.x));
        p = mix(p, a6, seg(m, 5.0, aR.x));
        float drift = 0.05 + 0.25 * (1.0 - clamp(m, 0.0, 1.0));
        p += drift * vec3(sin(uT * (0.3 + aR.y) + aR.z * 6.28), cos(uT * (0.25 + aR.x) + aR.w * 6.28), sin(uT * 0.2 + aR.x * 6.28));
        p.y += uVel * (aR.w - 0.5) * 0.6;
        p *= uFit;
        float cy = cos(uRot.x), sy = sin(uRot.x), cx = cos(uRot.y), sx = sin(uRot.y);
        p.xz = mat2(cy, -sy, sy, cy) * p.xz;
        p.yz = mat2(cx, -sx, sx, cx) * p.yz;
        float vz = p.z - uCam;
        gl_Position = vec4(p.x * uF / uAspect, p.y * uF, 0.0, -vz);
        float near = clamp(1.0 - (-vz - 3.0) / 7.0, 0.2, 1.0);
        gl_PointSize = uPix * (1.8 + aR.z * 2.6) * (uF * 3.6 / -vz);
        // color by shape
        float w[7];
        for (int i = 0; i < 7; i++) w[i] = max(0.0, 1.0 - abs(m - float(i)));
        float id = float(gl_VertexID);
        float ln = mod(id, 3.0);
        float lit = w[0] * step(aR.w, 0.05)
                  + w[2] * step(3.5, mod(id, 10.0)) * 0.95
                  + w[3] * smoothstep(0.12, 0.28, s3.y - a3.y)
                  + w[4] * (1.0 - step(0.5, abs(ln - 1.0)))
                  + w[5] * step(aR.w, 0.026)
                  + w[6] * 0.9;
        vec3 grey = vec3(0.56, 0.6, 0.66);
        vec3 green = vec3(0.24, 0.88, 0.53);
        vec3 amber = vec3(0.95, 0.75, 0.38);
        vCol = mix(grey, green, clamp(lit, 0.0, 1.0));
        float am = w[4] * step(1.5, ln);
        vCol = mix(vCol, amber, am);
        lit = max(lit, am);
        float core = w[2] * (1.0 - step(3.5, mod(id, 10.0)));
        vCol = mix(vCol, vec3(0.93, 0.96, 0.99), core);
        lit = max(lit, core * 0.85);
        vA = (0.42 + 0.58 * clamp(lit, 0.0, 1.0)) * near * (1.0 - 0.55 * w[1]);
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec3 vCol; in float vA; out vec4 o;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.05, d); a = a * (0.55 + 0.45 * a); o = vec4(vCol, a * vA); }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    const prog = gl.createProgram();
    if (v && f) { gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); }
    if (v && f && gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      field.ok = true;
      gl.useProgram(prog);
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const attr = (name, data, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const loc = gl.getAttribLocation(prog, name); if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); } };
      shapes.forEach((d, i) => attr('a' + i, d, 3)); attr('aR', rnd, 4);
      const U = {}; ['uM', 'uT', 'uAspect', 'uF', 'uCam', 'uPix', 'uFit', 'uVel', 'uRot', 'uMouse'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      const F = 1 / Math.tan((45 * Math.PI / 180) / 2), CAM = 6.2;
      let W = 0, H = 0, dpr = 1;
      const resize = () => { dpr = Math.min(1.75, devicePixelRatio || 1); W = innerWidth; H = fine ? innerHeight : Math.max(innerHeight, screen.height || 0); canvas.width = W * dpr; canvas.height = H * dpr; gl.viewport(0, 0, canvas.width, canvas.height); };
      resize(); onWidthResize(resize);
      const sections = $$('[data-shape]');
      function targetMorph() {
        const mid = innerHeight * 0.5;
        for (let i = 0; i < sections.length; i++) {
          const el = sections[i]; const box = (el.parentElement && el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el).getBoundingClientRect();
          if (box.top <= mid && box.bottom > mid) {
            const a = +el.dataset.shape; const next = sections[i + 1] ? +sections[i + 1].dataset.shape : a;
            const t = clamp((mid - box.top) / box.height, 0, 1);
            return a + (next - a) * clamp((t - 0.62) / 0.38, 0, 1);
          }
        }
        return sections.length && sections[0].getBoundingClientRect().top > mid ? 0 : SHAPES - 1;
      }
      field.project = (p) => {
        const fit = Math.min(1, (W / H) * 0.62); let x = p[0] * fit, y = p[1] * fit, z = p[2] * fit;
        const cy = Math.cos(camRot[0]), sy = Math.sin(camRot[0]); [x, z] = [cy * x - sy * z, sy * x + cy * z];
        const cx = Math.cos(camRot[1]), sx = Math.sin(camRot[1]); [y, z] = [cx * y - sx * z, sx * y + cx * z];
        const vz = z - CAM; return [((x * F / (W / H)) / -vz + 1) / 2 * W, (1 - (y * F) / -vz) / 2 * H];
      };
      let t0 = performance.now(), mxs = 0, mys = 0, lastScroll = scrollY;
      function frame(now) {
        const t = (now - t0) / 1000;
        field.target = targetMorph();
        field.morph += (field.target - field.morph) * (reduce ? 1 : 0.06);
        const v = scrollY - lastScroll; lastScroll = scrollY; field.vel += (clamp(v / 40, -1, 1) - field.vel) * 0.1;
        mxs += (nx - mxs) * 0.04; mys += (ny - mys) * 0.04;
        const calm = clamp(1 - Math.abs(field.morph - 2) * 1.2, 0, 1); // hold still while labels track
        camRot = [ (reduce ? 0 : t * 0.045) * (1 - calm) + mxs * 0.28 * (1 - calm * 0.8), 0.12 + mys * 0.14 * (1 - calm * 0.8) + (field.morph > 2.5 && field.morph < 3.6 ? 0.25 : 0) ];
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(U.uM, field.morph); gl.uniform1f(U.uT, reduce ? 0 : t); gl.uniform1f(U.uAspect, W / H); gl.uniform1f(U.uF, F); gl.uniform1f(U.uCam, CAM);
        gl.uniform1f(U.uPix, dpr); gl.uniform1f(U.uFit, Math.min(1, (W / H) * 0.62)); gl.uniform1f(U.uVel, field.vel); gl.uniform2f(U.uRot, camRot[0], camRot[1]); gl.uniform2f(U.uMouse, mxs, mys);
        gl.drawArrays(gl.POINTS, 0, N);
        trackTags();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  }

  /* labels that follow the 3D clusters */
  const tags = $$('.tag3d');
  const idea = $('#idea');
  function trackTags() {
    if (!idea || !field.ok || innerWidth <= 760) return;
    const r = idea.getBoundingClientRect();
    const vis = clamp(1 - Math.abs(field.morph - 2) * 1.6, 0, 1);
    tags.forEach((el) => {
      const i = +el.dataset.anchor; const [sx, sy] = field.project(ANCH[i]);
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = sx - w / 2, y = sy - h / 2;
      if (i === 1 || i === 3) x = sx - w - 46 * Math.min(1, innerWidth / 1400); if (i === 2 || i === 4) x = sx + 46 * Math.min(1, innerWidth / 1400);
      x = clamp(x, 16, document.documentElement.clientWidth - w - 20);
      el.style.transform = `translate(${x}px, ${y - r.top}px)`;
      el.style.opacity = vis;
    });
  }
  if (!field.ok && idea) { tags.forEach((el) => { el.style.position = 'static'; el.style.transform = 'none'; }); idea.style.height = 'auto'; idea.style.padding = '120px 0'; $('.idea-head').style.position = 'static'; $('.idea-foot').style.position = 'static'; $('.tags-static').style.cssText = 'display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:30px'; }

  /* ================= interactive plan ================= */
  const PLANS = {
    [tr('software · small', 'software · pequeño')]: { sel: 'orient · ftd · connect-tool · nextjs …', def: tr('sdd   until CI or a 2nd dev', 'sdd   hasta CI o un 2º dev'), exc: tr('video · payments   no evidence', 'vídeo · pagos   sin evidencia'), n: 7 },
    [tr('software · growing', 'software · creciendo')]: { sel: 'sdd chain · refuters · code guards …', def: tr('nothing deferred', 'nada pospuesto'), exc: tr('content skills   no evidence', 'skills de contenido   sin evidencia'), n: 19 },
    [tr('operations', 'operaciones')]: { sel: 'harness · connect-tool · invoicing …', def: tr('reporting   until you ask', 'informes   hasta que lo pidas'), exc: tr('sdd · code guards   no code', 'sdd · guardas de código   sin código'), n: 9 },
    [tr('research', 'investigación')]: { sel: 'research-ops · knowledge-ops …', def: tr('decision-records   on demand', 'decision-records   bajo demanda'), exc: tr('code guards   no code', 'guardas de código   sin código'), n: 8 },
    [tr('content', 'contenido')]: { sel: 'content-engine · brand-voice …', def: tr('youtube-api   until a channel', 'youtube-api   hasta tener canal'), exc: tr('sdd · code guards   no code', 'sdd · guardas de código   sin código'), n: 9 },
  };
  const steps = $$('#inSteps li');
  function setStep(k) { steps.forEach((el, i) => { el.classList.toggle('on', i === k); el.classList.toggle('done', i < k); }); }
  const kinds = $('#kinds'), term = $('#term'); let run = 0, current = tr('software · small', 'software · pequeño');
  Object.keys(PLANS).forEach((k) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.setAttribute('aria-pressed', String(k === current)); b.addEventListener('click', () => { current = k; $$('button', kinds).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); typePlan(true); }); kinds.appendChild(b); });
  const lines = (k) => { const p = PLANS[k]; return [
    ['$ ', 't-acc', 'rsc onboard', 't-ink'],
    [tr('? How should I talk to you? ', '? ¿Cómo te hablo? '), 't-dim', tr('› technical', '› técnico'), 't-acc'],
    [tr('? What are you building?     ', '? ¿Qué estás construyendo? '), 't-dim', '› ' + k, 't-acc'],
    [tr('  reading the project root … ', '  leyendo la raíz del proyecto … '), 't-dim', tr('done', 'hecho'), 't-ink'],
    ['', '', 'PLAN ' + (k.length * 2654435761 % 0xfffff).toString(16) + '…', 't-ink'],
    [tr('  ✔ selected  ', '  ✔ seleccionado  '), 't-acc', p.sel, 't-ink'],
    [tr('  ◐ deferred  ', '  ◐ pospuesto  '), 't-amb', p.def, 't-dim'],
    [tr('  ✕ excluded  ', '  ✕ excluido  '), 't-ros', p.exc, 't-dim'],
    [tr('? Accept this exact plan? ', '? ¿Aceptas este plan exacto? '), 't-dim', tr('› yes', '› sí'), 't-acc'],
    ['', '', tr(`installed ${p.n} of 271`, `instaladas ${p.n} de 271`), 't-acc'],
    ['', '', tr(`the other ${271 - p.n} stay out of your context`, `las otras ${271 - p.n} no ocupan tu contexto`), 't-dim'],
  ]; };
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  async function typePlan(fast) {
    const id = ++run; const L = lines(current);
    if (reduce) { setStep(3); term.innerHTML = L.map(([a, ca, b, cb]) => `<span class="${ca}">${esc(a)}</span><span class="${cb}">${esc(b)}</span>`).join('\n'); return; }
    term.innerHTML = ''; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const [li, [a, ca, b, cb]] of L.entries()) {
      if (id !== run) return;
      setStep(li < 4 ? 0 : li < 8 ? 1 : 2);
      const line = document.createElement('div'); const sa = document.createElement('span'); sa.className = ca; sa.textContent = a; const sb = document.createElement('span'); sb.className = cb; const caret = document.createElement('span'); caret.className = 'caret';
      line.append(sa, sb, caret); term.appendChild(line);
      await wait(fast ? 60 : (a.startsWith('?') ? 340 : 140));
      for (const ch of b) { if (id !== run) return; sb.textContent += ch; await wait(fast ? 6 : 20); }
      caret.remove(); await wait(fast ? 40 : (a.includes('…') ? 480 : 150));
    }
    const c = document.createElement('span'); c.className = 'caret'; term.appendChild(c);
    setStep(3);
    if (!fast) setTimeout(() => { if (id === run && planVisible) typePlan(false); }, 6000);
  }
  let planVisible = false, planStarted = false;
  new IntersectionObserver((es) => { planVisible = es[0].isIntersecting; if (planVisible && !planStarted) { planStarted = true; typePlan(false); } }, { threshold: 0.35 }).observe(term);

  /* ================= tokens ================= */
  const FILES = ['src/app.ts','src/db.ts','lib/auth.ts','lib/utils.ts','api/users.ts','api/orders.ts','api/export.ts','models/user.ts','models/order.ts','services/csv.ts','services/report.ts','hooks/useFilters.ts','components/Table.tsx','components/Filter.tsx','pages/report.tsx','tests/report.test.ts','config/env.ts','scripts/seed.ts','lib/format.ts','lib/dates.ts','api/report.ts','services/filters.ts','utils/download.ts','legacy/export_old.ts'];
  const filesA = $('#filesA'), filesB = $('#filesB');
  FILES.forEach((f) => { const d = document.createElement('div'); d.className = 'file'; d.textContent = f; filesA.appendChild(d); });
  ['wiki/index.md', 'wiki/report.md', ...FILES.slice(0, 22)].forEach((f, i) => { const d = document.createElement('div'); d.className = 'file' + (i < 2 ? ' doc' : ''); d.textContent = f; filesB.appendChild(d); });
  const pathA = [0, 2, 1, 6, 9, 10, 4, 5, 20, 7, 21, 11, 13, 12, 14, 23, 18, 19, 22, 15, 3, 9, 20, 21], pathB = [0, 1, 11];
  const cA = $$('.file', filesA), cB = $$('.file', filesB); const MAXA = 41800, MAXB = 6200;
  function setTokens(p) {
    const nA = Math.round(pathA.length * p), q = Math.min(1, p * 2.2), nB = Math.round(pathB.length * q);
    cA.forEach((c) => c.classList.remove('hit')); pathA.slice(0, nA).forEach((i) => cA[i].classList.add('hit'));
    cB.forEach((c) => c.classList.remove('find')); pathB.slice(0, nB).forEach((i) => cB[i].classList.add('find'));
    const a = Math.round(MAXA * p), b = Math.round(MAXB * q);
    $('#mA').textContent = a.toLocaleString(tr('en-US', 'es-ES')); $('#mB').textContent = b.toLocaleString(tr('en-US', 'es-ES'));
    $('#bA').style.width = (a / MAXA * 100) + '%'; $('#bB').style.width = (b / MAXA * 100) + '%';
  }

  /* ================= lanes ================= */
  const REQS = [[tr('why is login slow in production?', '¿por qué va lento el login en producción?'), 'answer'], [tr('add CSV export with the report filters', 'añade exportar a CSV con los filtros del informe'), 'ftd'], [tr('roles or resources for permissions? schema, API and UI', '¿permisos por roles o por recursos? esquema, API e interfaz'), 'sdd'], [tr('fix the typo on the save button', 'corrige la errata del botón guardar'), 'ftd'], [tr('compare Postgres and SQLite for this', 'compara Postgres y SQLite para esto'), 'answer'], [tr('multi-tenant billing with invoices', 'facturación multicliente con facturas'), 'sdd'], [tr('rename the users table everywhere', 'renombra la tabla users en todas partes'), 'ftd'], [tr('audit this diff for bugs', 'audita este diff en busca de bugs'), 'answer']];
  const laneEls = { answer: $('[data-lane="answer"]'), ftd: $('[data-lane="ftd"]'), sdd: $('[data-lane="sdd"]') };
  const reqEls = REQS.map(([t, l]) => { const d = document.createElement('div'); d.className = 'req'; d.textContent = t; laneEls[l].appendChild(d); return d; });
  Object.entries(laneEls).forEach(([k, el]) => { const f = document.createElement('div'); f.className = 'lane-foot'; f.textContent = { answer: tr('Nothing is written.', 'No se escribe nada.'), ftd: tr('Checked off against proof.', 'Se marca con prueba.'), sdd: tr('Publishing always asks.', 'Publicar siempre pregunta.') }[k]; el.appendChild(f); });

  /* ================= marquee ================= */
  const AS = ['Claude Code', 'Codex', 'Cursor', 'GitHub Copilot', 'Gemini CLI', 'OpenCode', 'DeepSeek Harness', 'Windsurf', 'Cline', 'Roo', 'Zed', 'Continue', 'Amp', 'Antigravity', 'Jules', 'Junie', 'Kiro', 'Aider'];
  const row = (l) => [...l, ...l].map((n) => `<span>${n}</span>`).join('');
  $('#mq1').innerHTML = row(AS); $('#mq2').innerHTML = row([...AS].reverse());

  /* ================= catalog ================= */
  const wall = $('#wall'), tip = $('#tip'), dom = $('#domains'), q = $('#q');
  const BASE = ['orient', 'suggest', 'unslop', 'ftd', 'connect-tool', 'harness', 'init'];
  const TIP0 = tr('Hover a square to see the skill. Each one fires on its own when a task needs it.', 'Pasa por un cuadrado para ver la skill. Cada una se activa sola cuando una tarea la necesita.');
  const cells = [];
  CATALOG.forEach((d, di) => d.ids.forEach((id) => {
    const c = document.createElement('div'); c.className = 'cell' + (BASE.includes(id) ? ' on' : ''); c.setAttribute('role', 'listitem'); c.dataset.id = id; c.dataset.d = di; c.title = id; c.setAttribute('aria-label', `${id}, ${d.t}`);
    c.addEventListener('mouseenter', () => { tip.innerHTML = `<b>${id}</b> · ${d.t}${BASE.includes(id) ? tr(' · <span class="t-acc">installed with every harness</span>', ' · <span class="t-acc">viene en todos los arneses</span>') : ''}`; });
    wall.appendChild(c); cells.push(c);
  }));
  CATALOG.forEach((d, di) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = `${d.t} · ${d.ids.length}`; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') === 'true'; q.value = '';
      $$('button', dom).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      cells.forEach((c) => c.classList.toggle('dim', !on && c.dataset.d !== String(di)));
      if (!on) { b.setAttribute('aria-pressed', 'true'); tip.innerHTML = `<b>${d.t}</b> · ${d.ids.join(' · ')}`; } else tip.textContent = TIP0;
    });
    dom.appendChild(b);
  });
  q.addEventListener('input', () => {
    const s = q.value.trim().toLowerCase(); $$('button', dom).forEach((x) => x.setAttribute('aria-pressed', 'false'));
    const hits = cells.filter((c) => s && c.dataset.id.includes(s));
    cells.forEach((c) => c.classList.toggle('dim', !!s && !c.dataset.id.includes(s)));
    tip.innerHTML = !s ? TIP0 : hits.length ? `<b>${hits.length}</b> ${tr('match', 'coinciden')}: ${hits.slice(0, 12).map((c) => c.dataset.id).join(' · ')}${hits.length > 12 ? ' …' : ''}` : tr('No skill with that name. <span class="t-acc">connect-tool</span> researches any tool you name.', 'Ninguna skill con ese nombre. <span class="t-acc">connect-tool</span> investiga cualquier herramienta que nombres.');
  });

  /* ================= team packets ================= */
  (() => {
    const up = $('#upPath'), down = $('#downPath'), p1 = $('#pk1'), p2 = $('#pk2'); const L1 = up.getTotalLength(), L2 = down.getTotalLength(); const t0 = performance.now();
    (function loop(now) { const t = ((now - t0) / 2600) % 1; const a = Math.min(1, t * 2), b = Math.max(0, t * 2 - 1); const q1 = up.getPointAtLength(L1 * a), q2 = down.getPointAtLength(L2 * b);
      p1.setAttribute('cx', q1.x); p1.setAttribute('cy', q1.y); p1.setAttribute('opacity', t < 0.5 ? 1 : 0.2); p2.setAttribute('cx', q2.x); p2.setAttribute('cy', q2.y); p2.setAttribute('opacity', t >= 0.5 ? 1 : 0.2);
      if (!reduce) requestAnimationFrame(loop); })(t0);
  })();


  /* ================= brain: 3D knowledge graph ================= */
  (() => {
    const cv = $('#brain'); if (!cv) return; const c2 = cv.getContext('2d');
    const CL = [
      { name: 'harness', col: '#3ddc84', pages: ['user-profile.md', 'decisions.md', 'index.md', 'log.md', 'gaps.md'] },
      { name: 'sdd', col: '#6fe3a6', pages: ['constitution.md', 'specs/permissions.md', 'plans/permissions.md', 'specs/billing.md', 'verifications/billing.md'] },
      { name: 'ftd', col: '#9be7c0', pages: ['ftd/csv-export.md', 'ftd/login-speed.md', 'ftd/rename-users.md'] },
      { name: 'stack', col: '#98a1ad', pages: ['stack/postgres.md', 'stack/nextjs.md', 'stack/deploy.md'] },
      { name: 'tools', col: '#f0c060', pages: ['tools/holded.md', 'tools/hubspot.md', 'tools/stripe.md'] },
      { name: 'product', col: '#c9d1db', pages: ['product/pricing.md', 'product/roadmap.md', 'product/users.md'] },
      { name: 'raw', col: '#5b6470', pages: ['raw/meeting-10-09.md', 'raw/interview-ana.md', 'raw/invoice-batch.md'] },
    ];
    const nodes = [], links = [];
    const R = Math.random, g = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const hub = { x: 0, y: 0, z: 0, r: 7, label: 'index.md', col: '#3ddc84', hub: true, c: -1 }; nodes.push(hub);
    const centers = CL.map((cl, i) => { const t = (i / CL.length) * Math.PI * 2, p = Math.acos(2 * ((i + 0.5) / CL.length) - 1); return [Math.sin(p) * Math.cos(t) * 1.05, Math.cos(p) * 0.9, Math.sin(p) * Math.sin(t) * 1.05]; });
    const add = (n) => { nodes.push(n); return n; };
    const link = (a, b) => { links.push([a, b, R()]); a.deg = (a.deg || 0) + 1; b.deg = (b.deg || 0) + 1; };
    CL.forEach((cl, ci) => {
      const [cx, cy, cz] = centers[ci];
      const h = add({ x: cx, y: cy, z: cz, r: 5, label: cl.name + '/', col: cl.col, hub: true, c: ci }); link(hub, h); cl.h = h; cl.members = [h];
      const count = 46 + Math.floor(R() * 22);
      for (let k = 0; k < count; k++) {
        const named = cl.pages[k];
        const n = add({ x: cx + g() * 0.22, y: cy + g() * 0.22, z: cz + g() * 0.22, r: named ? 3 : 1.6 + R() * 1.2, label: named || (cl.name + '/note-' + (k + 1) + '.md'), col: cl.col, c: ci });
        link(k % 3 === 0 ? h : cl.members[Math.floor(R() * cl.members.length)], n); cl.members.push(n);
        if (R() < 0.12) { const other = CL[Math.floor(R() * CL.length)]; if (other.members) link(n, other.members[Math.floor(R() * other.members.length)]); }
      }
    });
    $('#bLegend').innerHTML = CL.map((cl) => `<span><i style="background:${cl.col}"></i>${cl.name}</span>`).join('');
    let W = 0, H = 0, dpr = 1;
    const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); onWidthResize(size);
    let ry = 0.4, rx = -0.25, vry = reduce ? 0 : 0.0022, drag = null, hover = null, mx = -1, my = -1;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ry, rx }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; if (drag) { ry = drag.ry + (e.clientX - drag.x) * 0.006; rx = clamp(drag.rx + (e.clientY - drag.y) * 0.004, -1.2, 1.2); } });
    cv.addEventListener('pointerup', () => { drag = null; }); cv.addEventListener('pointerleave', () => { mx = -1; hover = null; $('#bTip').style.opacity = 0; });
    const feed = $('#bFeed'); const INBOX = ['inbox/call-notes-client.pdf', 'inbox/pricing-v3.xlsx', 'inbox/standup-10-11.txt', 'inbox/contract-draft.docx', 'inbox/api-errors.log', 'inbox/roadmap-q4.md', 'inbox/support-tickets.csv', 'inbox/design-review.png'];
    const flying = []; let inboxI = 0;
    function spawn() {
      if (nodes.length > 560) return;
      const cl = CL[Math.floor(R() * (CL.length - 1))]; const target = cl.members[Math.floor(R() * cl.members.length)];
      const a = R() * Math.PI * 2; const name = INBOX[inboxI++ % INBOX.length];
      flying.push({ x: Math.cos(a) * 2.6, y: (R() - 0.5) * 1.6, z: Math.sin(a) * 2.6, t: 0, target, cl, name });
    }
    function arrive(f) {
      const n = add({ x: f.target.x + g() * 0.12, y: f.target.y + g() * 0.12, z: f.target.z + g() * 0.12, r: 2.4, label: f.cl.name + '/' + f.name.replace('inbox/', '').replace(/\.\w+$/, '.md'), col: f.cl.col, c: CL.indexOf(f.cl), born: performance.now() });
      link(f.target, n); f.cl.members.push(n);
      const line = document.createElement('div'); line.className = 'new'; line.textContent = `${f.name}  →  wiki/${n.label}`; feed.prepend(line);
      setTimeout(() => line.classList.remove('new'), 1400); while (feed.children.length > 4) feed.lastChild.remove();
    }
    // driven by the chat: a message becomes a page, a later session recalls pages
    const pulse = (n) => { n.born = performance.now(); };
    window.__brain = {
      screenOf(label) { const n = nodes.find((x) => x.label === label); if (!n) return null; const r = cv.getBoundingClientRect(); const p = proj(n); return [r.left + p[0], r.top + p[1]]; },
      learn(label, clusterName) {
        const cl = CL.find((c) => c.name === clusterName) || CL[0];
        let n = nodes.find((x) => x.label === label);
        if (!n) { n = add({ x: cl.h.x + g() * 0.15, y: cl.h.y + g() * 0.15, z: cl.h.z + g() * 0.15, r: 3, label, col: cl.col, c: CL.indexOf(cl) }); link(cl.h, n); cl.members.push(n); }
        pulse(n); n.r = Math.max(n.r, 3.4);
        for (let k = 0; k < 3; k++) { const m = add({ x: n.x + g() * 0.08, y: n.y + g() * 0.08, z: n.z + g() * 0.08, r: 1.6, label: label.replace('.md', '') + '#' + (k + 1), col: cl.col, c: n.c, born: performance.now() }); link(n, m); }
        const line = document.createElement('div'); line.className = 'new'; line.textContent = `chat  →  wiki/${label}`; feed.prepend(line); setTimeout(() => line.classList.remove('new'), 1400); while (feed.children.length > 4) feed.lastChild.remove();
      },
      recall(labels) { labels.forEach((l) => { const n = nodes.find((x) => x.label === l); if (n) { n.ring = performance.now(); pulse(n); } }); },
    };
    let visible = false; new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.05 }).observe(cv);
    let lastSpawn = 0;
    function proj(p) { const cy = Math.cos(ry), sy = Math.sin(ry), cxx = Math.cos(rx), sxx = Math.sin(rx); let x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy; let y = p.y * cxx - z * sxx; z = p.y * sxx + z * cxx; const d = 3.4, s = Math.min(W, H) * 0.31 * d / (d - z); return [W / 2 + x * s, H / 2 + y * s, z, s / (Math.min(W, H) * 0.31)]; }
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !W) return;
      if (!drag) ry += vry;
      if (!reduce && now - lastSpawn > 2600) { spawn(); lastSpawn = now; }
      c2.clearRect(0, 0, W, H);
      const P = new Map(); nodes.forEach((n) => P.set(n, proj(n)));
      // links
      c2.lineWidth = 1;
      for (const [a, b, ph] of links) {
        const A = P.get(a), B = P.get(b); const depth = (A[2] + B[2]) / 2;
        const alpha = 0.06 + 0.22 * clamp((depth + 1.4) / 2.8, 0, 1);
        c2.strokeStyle = `rgba(61,220,132,${alpha.toFixed(3)})`;
        c2.beginPath(); c2.moveTo(A[0], A[1]); c2.lineTo(B[0], B[1]); c2.stroke();
        if (!reduce && (a.hub || b.hub)) { const t = (now / 2400 + ph) % 1; c2.fillStyle = 'rgba(61,220,132,0.75)'; c2.fillRect(A[0] + (B[0] - A[0]) * t - 1, A[1] + (B[1] - A[1]) * t - 1, 2, 2); }
      }
      // nodes, back to front
      const order = nodes.slice().sort((a, b) => P.get(a)[2] - P.get(b)[2]);
      hover = null; let best = 14;
      for (const n of order) {
        const [x, y, z, k] = P.get(n); const fresh = n.born ? clamp(1 - (now - n.born) / 1600, 0, 1) : 0;
        const r = (n.r + Math.min(3, (n.deg || 0) * 0.15)) * k * (1 + fresh * 1.5);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !(r > 0)) continue;
        const a = 0.35 + 0.65 * clamp((z + 1.4) / 2.8, 0, 1);
        if (n.hub || fresh) { const gr = c2.createRadialGradient(x, y, 0, x, y, r * 4); gr.addColorStop(0, n.col + '55'); gr.addColorStop(1, n.col + '00'); c2.fillStyle = gr; c2.beginPath(); c2.arc(x, y, r * 4, 0, 6.283); c2.fill(); }
        c2.globalAlpha = a; c2.fillStyle = n.col; c2.beginPath(); c2.arc(x, y, Math.max(0.8, r), 0, 6.283); c2.fill(); c2.globalAlpha = 1;
        if (n.ring && now - n.ring < 2600) { const q = (now - n.ring) / 2600; c2.strokeStyle = `rgba(61,220,132,${(1 - q).toFixed(2)})`; c2.lineWidth = 1.5; c2.beginPath(); c2.arc(x, y, r + 6 + q * 22, 0, 6.283); c2.stroke(); c2.lineWidth = 1; }
        if (mx >= 0) { const dd = Math.hypot(mx - x, my - y); if (dd < best) { best = dd; hover = { n, x, y }; } }
        if (n.hub && k > 0.85) { c2.font = '11px ui-monospace, SF Mono, Menlo, monospace'; c2.fillStyle = 'rgba(240,244,248,' + (a * 0.9).toFixed(2) + ')'; c2.fillText(n.label, x + r + 6, y + 4); }
      }
      // inbox documents flying in
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]; f.t += 0.012; const e = 1 - Math.pow(1 - Math.min(1, f.t), 3);
        const p = { x: f.x + (f.target.x - f.x) * e, y: f.y + (f.target.y - f.y) * e, z: f.z + (f.target.z - f.z) * e };
        const [x, y] = proj(p); c2.fillStyle = '#f0c060'; c2.fillRect(x - 3, y - 4, 6, 8); c2.strokeStyle = 'rgba(240,192,96,0.35)'; c2.beginPath(); const [x0, y0] = proj({ x: f.x, y: f.y, z: f.z }); c2.moveTo(x0, y0); c2.lineTo(x, y); c2.stroke();
        if (f.t >= 1) { arrive(f); flying.splice(i, 1); }
      }
      const tip = $('#bTip');
      if (hover) { tip.textContent = hover.n.label; tip.style.left = hover.x + 'px'; tip.style.top = hover.y + 'px'; tip.style.opacity = 1; } else tip.style.opacity = 0;
      $('#bPages').textContent = nodes.length; $('#bLinks').textContent = links.length;
    }
    requestAnimationFrame(frame);
  })();



  /* ================= what you get: four live demos ================= */
  (() => {
    const grid = $('.pl-grid'); if (!grid) return;
    $$('.pl').forEach((c) => c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));
    const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
    const line = (box, html, max = 5) => { const l = document.createElement('div'); l.className = 'pl-line'; l.innerHTML = html; box.appendChild(l); while (box.children.length > max) box.firstChild.remove(); };
    const MEM = [['decisions.md', tr('Postgres 16, never MySQL', 'Postgres 16, nunca MySQL')], ['decisions.md', tr('billing is off limits', 'facturación no se toca')], ['ftd/csv-export.md', tr('step 3 of 5, proof attached', 'paso 3 de 5, con prueba')], ['stack/api.md', tr('errors return problem+json', 'los errores devuelven problem+json')], ['product/goal.md', tr('first 100 paying users', 'primeros 100 clientes de pago')]];
    const HANDS = [['holded', 'GET /invoices', tr('200 · read only', '200 · solo lectura')], ['hubspot', 'GET /contacts', tr('200 · 1,284 rows', '200 · 1.284 filas')], ['sage 50', 'ODBC export', tr('ok · nightly', 'ok · cada noche')], ['stripe', 'POST /refunds', tr('refused · read only', 'rechazado · solo lectura')]];
    const TRADE = ['nextjs', 'postgresdb', 'ftd', 'connect-tool', 'orient', 'stripe', 'fastapi', 'flutter', 'video', 'seo', 'sdd', 'go'];
    const PICK = new Set(['nextjs', 'postgresdb', 'ftd', 'connect-tool', 'orient']);
    const REF = [['npm test', tr('128 passed', '128 pasan'), 'ok'], [tr('task 3 done?', '¿tarea 3 hecha?'), tr('proof attached', 'con prueba'), 'ok'], [tr('lane', 'carril'), tr('FTD · one document', 'FTD · un documento'), 'ok'], [tr('reply', 'respuesta'), tr('in your language', 'en tu idioma'), 'ok'], [tr('push to main?', '¿push a main?'), tr('asks you first', 'te pregunta antes'), 'amb']];
    async function run() {
      const mem = $('#plMem'), hands = $('#plHands'), trade = $('#plTrade'), ref = $('#plRef');
      trade.innerHTML = '<div class="pl-chips">' + TRADE.map((t) => `<span class="pl-chip" data-t="${t}">${t}</span>`).join('') + '</div><div class="pl-line" style="margin-top:12px"><span class="k">' + tr('installed', 'instaladas') + '</span><b id="plN">0</b><span class="k">' + tr('of 271', 'de 271') + '</span></div><div class="pl-meter"><i id="plM"></i></div>';
      let k = 0;
      for (;;) {
        const m = MEM[k % MEM.length]; line(mem, `<span class="ok">+</span><span>wiki/${m[0]}</span><span class="k">${m[1]}</span>`, 4);
        await wait(700);
        const h = HANDS[k % HANDS.length]; line(hands, `<span class="k">${h[0]}</span><span>${h[1]}</span><span class="${/refused|rechazado/.test(h[2]) ? 'amb' : 'ok'}">${h[2]}</span>`, 4);
        await wait(700);
        const chips = $$('.pl-chip', trade); const on = k % 2 === 0;
        chips.forEach((c, i) => setTimeout(() => c.classList.toggle('on', on && PICK.has(c.dataset.t)), reduce ? 0 : i * 70));
        $('#plN').textContent = on ? PICK.size : 0; $('#plM').style.width = on ? (PICK.size / 271 * 100 * 12) + '%' : '0%';
        await wait(700);
        const r = REF[k % REF.length]; line(ref, `<span class="${r[2]}">${r[2] === 'ok' ? '✓' : '?'}</span><span>${r[0]}</span><span class="k">${r[1]}</span>`, 4);
        await wait(1400); k++;
        while (!vis) await wait(500);
      }
    }
    let vis = false, started = false;
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis && !started) { started = true; run(); } }, { threshold: 0.2 }).observe(grid);
  })();

  /* install + pillars entrance */
  if (motion) {
    gsap.from('.in-prompt', { y: 60, opacity: 0, scale: 0.97, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.in-prompt', start: 'top 85%' } });
    gsap.from('.in-steps li, .in-term', { y: 40, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', clearProps: 'opacity,transform', scrollTrigger: { trigger: '.in-next', start: 'top 80%' } });
    gsap.from('.pl', { y: 70, opacity: 0, duration: 1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.pl-grid', start: 'top 82%' } });
  }

  /* ================= memory hero: the chat feeds the brain ================= */
  (() => {
    const box = $('#bhMsgs'), typing = $('#bhTyping'), sessionEl = $('#bhSession');
    if (!box) return;
    const SCRIPT = [
      { you: tr('We use Postgres 16. Never MySQL.', 'Usamos Postgres 16. Nunca MySQL.'), ai: tr('Noted. I will read it before touching the database.', 'Anotado. Lo leeré antes de tocar la base de datos.'), save: ['stack/postgres.md', 'stack'] },
      { you: tr('The billing module is off limits.', 'El módulo de facturación no se toca.'), ai: tr('Recorded as a decision. Nobody touches billing without asking.', 'Guardado como decisión. Nadie toca facturación sin preguntar.'), save: ['decisions.md', 'harness'] },
      { you: tr('Connect our Holded, read only.', 'Conecta nuestro Holded, solo lectura.'), ai: tr('Connected with a read-only key. The test proves writes are refused.', 'Conectado con una clave de solo lectura. El test demuestra que rechaza escrituras.'), save: ['tools/holded.md', 'tools'] },
      { you: tr('Add CSV export with the report filters.', 'Añade exportar a CSV con los filtros del informe.'), ai: tr('On it. One feature document, proof for every task.', 'Voy. Un documento de feature y una prueba por tarea.'), save: ['ftd/csv-export.md', 'ftd'] },
      { brk: tr('next morning · new session', 'a la mañana siguiente · sesión nueva') },
      { you: tr('Morning. Where were we?', 'Buenos días. ¿Por dónde íbamos?'), ai: tr('Postgres 16, billing is off limits, Holded is connected read-only. The CSV export is half done: next, verify it with real filters.', 'Postgres 16, facturación no se toca y Holded está conectado en solo lectura. El CSV está a medias: lo siguiente es verificarlo con filtros reales.'), recall: ['stack/postgres.md', 'decisions.md', 'tools/holded.md', 'ftd/csv-export.md'] },
    ];
    const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
    const bubble = (who, text) => { const b = document.createElement('div'); b.className = 'bm ' + who; b.innerHTML = `<span class="who">${who === 'you' ? tr('you', 'tú') : tr('agent', 'agente')}</span>`; const t = document.createElement('span'); t.textContent = text; b.appendChild(t); box.appendChild(b); while (box.children.length > 7) box.firstChild.remove(); return b; };
    function fly(fromEl, label, cluster) {
      return new Promise((res) => {
        const brain = window.__brain; const wr = $('#brainWrap').getBoundingClientRect();
        const brainOnScreen = innerWidth > 960 && wr.top < innerHeight && wr.bottom > 0;
        if (!brain || reduce || !brainOnScreen) { brain && brain.learn(label, cluster); return res(); }
        const fr = fromEl.getBoundingClientRect(); const sx = fr.left + fr.width / 2, sy = fr.top + fr.height / 2;
        const dot = document.createElement('div'); dot.className = 'bh-fly'; document.body.appendChild(dot);
        const t0 = performance.now(), dur = 1100;
        const wrap = $('#brainWrap').getBoundingClientRect(); const fallback = [wrap.left + wrap.width / 2, wrap.top + wrap.height / 2];
        (function step(now) {
          const p = Math.min(1, (now - t0) / dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          const target = brain.screenOf(label) || fallback;
          const x = sx + (target[0] - sx) * e, y = sy + (target[1] - sy) * e - Math.sin(p * Math.PI) * 90;
          dot.style.transform = `translate(${x - 4.5}px, ${y - 4.5}px) scale(${1 + Math.sin(p * Math.PI) * 0.6})`;
          if (p < 1) requestAnimationFrame(step); else { dot.remove(); brain.learn(label, cluster); res(); }
        })(t0);
      });
    }
    let visible = true; new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.1 }).observe(box);
    async function play() {
      for (;;) {
        sessionEl.textContent = tr('session 1', 'sesión 1');
        for (const step of SCRIPT) {
          while (!visible) await wait(400);
          if (step.brk) { await wait(700); const b = document.createElement('div'); b.className = 'bm-break'; b.textContent = step.brk; box.appendChild(b); sessionEl.textContent = tr('session 2', 'sesión 2'); await wait(1100); continue; }
          for (const ch of step.you) { typing.textContent += ch; await wait(28); }
          await wait(350); typing.textContent = ''; bubble('you', step.you); await wait(650);
          const a = bubble('ai', step.ai);
          if (step.save) { const chip = document.createElement('span'); chip.className = 'saved'; chip.textContent = tr('✓ saved → ', '✓ guardado → ') + step.save[0]; a.appendChild(document.createElement('br')); a.appendChild(chip); await wait(250); await fly(chip, step.save[0], step.save[1]); }
          if (step.recall) { a.appendChild(document.createElement('br')); step.recall.forEach((l) => { const c = document.createElement('span'); c.className = 'recall'; c.textContent = tr('read ', 'leído ') + l; a.appendChild(c); }); window.__brain && window.__brain.recall(step.recall); }
          await wait(1500);
        }
        await wait(4200);
        box.innerHTML = '';
      }
    }
    setTimeout(play, reduce ? 0 : 900);
  })();

  /* ================= connect: pick a tool, watch it get wired ================= */
  (() => {
    const TOOLS = [
      { n: 'HubSpot', k: 'crm', id: 'HUBSPOT', docs: 'developers.hubspot.com', route: tr('official MCP server · read scopes only', 'servidor MCP oficial · solo permisos de lectura'), proof: [tr('✔ read · contacts listed', '✔ lectura · contactos listados'), tr('✔ token carries no write scope', '✔ el token no tiene permiso de escritura')] },
      { n: 'Salesforce', k: 'crm', id: 'SALESFORCE', docs: 'developer.salesforce.com', route: tr('REST API · connected app, read-only profile', 'API REST · app conectada, perfil de solo lectura'), proof: [tr('✔ read · accounts listed', '✔ lectura · cuentas listadas'), tr('✔ profile refuses edits', '✔ el perfil rechaza ediciones')] },
      { n: 'Pipedrive', k: 'crm', id: 'PIPEDRIVE', docs: 'developers.pipedrive.com', route: tr('REST API · token of a read-only user', 'API REST · token de un usuario de solo lectura'), proof: [tr('✔ read · deals listed', '✔ lectura · oportunidades listadas'), tr('✔ write refused · 403', '✔ escritura rechazada · 403')] },
      { n: 'Holded', k: 'erp', id: 'HOLDED', docs: 'developers.holded.com', route: tr('REST API · key with read modules', 'API REST · clave con módulos de lectura'), proof: [tr('✔ read · invoices listed', '✔ lectura · facturas listadas'), tr('✔ key has no write modules', '✔ la clave no tiene módulos de escritura')] },
      { n: 'Odoo', k: 'erp', id: 'ODOO', docs: 'odoo.com/documentation', route: tr('external API · user with read access rights', 'API externa · usuario con permisos de lectura'), proof: [tr('✔ read · sale orders listed', '✔ lectura · pedidos listados'), tr('✔ write refused · access error', '✔ escritura rechazada · error de acceso')] },
      { n: 'Business Central', k: 'erp', id: 'BUSINESS_CENTRAL', docs: 'learn.microsoft.com', route: tr('API · read-only permission set', 'API · permisos de solo lectura'), proof: [tr('✔ read · customers listed', '✔ lectura · clientes listados'), tr('✔ write refused · permission', '✔ escritura rechazada · permisos')] },
      { n: 'Sage 50', k: tr('desktop erp', 'erp de escritorio'), id: 'SAGE_50', docs: tr('the vendor install guide', 'la guía de instalación del fabricante'), route: tr('read-only copy of its database · nightly', 'copia de solo lectura de su base de datos · cada noche'), proof: [tr('✔ read · from the nightly copy', '✔ lectura · desde la copia nocturna'), tr('✔ write refused · permission denied', '✔ escritura rechazada · permiso denegado')] },
      { n: 'A3ERP', k: tr('desktop erp', 'erp de escritorio'), id: 'A3ERP', docs: tr('the vendor install guide', 'la guía de instalación del fabricante'), route: tr('read-only copy of its SQL Server database', 'copia de solo lectura de su base de datos SQL Server'), proof: [tr('✔ read · from the nightly copy', '✔ lectura · desde la copia nocturna'), tr('✔ write refused · Msg 229', '✔ escritura rechazada · Msg 229')] },
      { n: 'Notion', k: 'docs', id: 'NOTION', docs: 'developers.notion.com', route: tr('official MCP server · shared pages only', 'servidor MCP oficial · solo páginas compartidas'), proof: [tr('✔ read · pages listed', '✔ lectura · páginas listadas'), tr('✔ integration is read-only', '✔ la integración es de solo lectura')] },
      { n: 'WhatsApp', k: tr('messaging', 'mensajería'), id: 'WHATSAPP', docs: 'developers.facebook.com', route: tr('Cloud API · test number first', 'Cloud API · primero un número de prueba'), proof: [tr('✔ read · messages received', '✔ lectura · mensajes recibidos'), tr('✔ sending stays off until you ask', '✔ el envío sigue apagado hasta que lo pidas')] },
      { n: 'Excel / M365', k: tr('office', 'ofimática'), id: 'MICROSOFT_GRAPH', docs: 'learn.microsoft.com/graph', route: 'Microsoft Graph · Sites.Selected', proof: [tr('✔ read · one site only', '✔ lectura · un solo sitio'), tr('✔ no tenant-wide access', '✔ sin acceso a todo el tenant')] },
    ];
    const box = $('#cxTools'), steps = $$('#cxFlow .cx-step'), wire = $('#cxPath'), dot = $('#cxDot'), cx = $('#cx');
    let run = 0, active = null;
    const val = (k) => $(`#cxFlow [data-k="${k}"]`);
    const btns = TOOLS.map((t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tool glass'; b.setAttribute('aria-pressed', 'false'); b.innerHTML = `<span>${t.k}</span><b>${t.n}</b>`; b.addEventListener('click', () => connect(t, b)); box.appendChild(b); return b; });
    function drawWire(b) {
      if (innerWidth <= 960) { wire.setAttribute('d', ''); return null; }
      const R0 = cx.getBoundingClientRect(), a = b.getBoundingClientRect(), s0 = steps[0].getBoundingClientRect();
      const x1 = a.right - R0.left, y1 = a.top + a.height / 2 - R0.top, x2 = s0.left - R0.left, y2 = s0.top + s0.height / 2 - R0.top;
      const mid = (x1 + x2) / 2; const d = `M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      wire.setAttribute('d', d); const L = wire.getTotalLength(); wire.style.strokeDasharray = L; wire.style.strokeDashoffset = L;
      return L;
    }
    async function connect(t, b) {
      const id = ++run; active = b;
      btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      steps.forEach((s) => s.classList.remove('on'));
      ['docs', 'route', 'folder', 'proof'].forEach((k) => { val(k).innerHTML = '&nbsp;'; });
      const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
      const L = drawWire(b);
      if (L && !reduce) {
        const t0 = performance.now(); const dur = 650;
        await new Promise((res) => { (function step(now) { if (id !== run) return res(); const p = Math.min(1, (now - t0) / dur); const e = 1 - Math.pow(1 - p, 3); wire.style.strokeDashoffset = L * (1 - e); const pt = wire.getPointAtLength(L * e); dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y); dot.setAttribute('opacity', 1); p < 1 ? requestAnimationFrame(step) : res(); })(t0); });
        dot.setAttribute('opacity', 0);
      } else if (L) wire.style.strokeDashoffset = 0;
      const fill = [['docs', `<span class="t-acc">${tr('reading', 'leyendo')}</span> ${t.docs} <span class="t-dim">· ${tr('checked today', 'revisado hoy')}</span>`], ['route', t.route], ['folder', `01-TOOLS/${t.id}/`], ['proof', `<span class="t-acc">${t.proof[0]}</span><br><span class="t-acc">${t.proof[1]}</span>`]];
      for (let i = 0; i < 4; i++) { if (id !== run) return; steps[i].classList.add('on'); val(fill[i][0]).innerHTML = fill[i][1]; await wait(520); }
      b.classList.add('linked');
    }
    addEventListener('resize', () => { if (active) { const L = drawWire(active); if (L) wire.style.strokeDashoffset = 0; } });
    let auto = false;
    new IntersectionObserver((es) => { if (es[0].isIntersecting && !auto) { auto = true; setTimeout(() => connect(TOOLS[3], btns[3]), 500); } }, { threshold: 0.35 }).observe(cx);
  })();

  if (!motion) { setTokens(1); return; }

  /* ================= choreography ================= */
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // masked headings
  $$('h2.mask').forEach((h) => {
    const inner = $$('.ln > span', h);
    gsap.set(inner, { yPercent: 110 });
    ScrollTrigger.create({ trigger: h, start: 'top 88%', once: true, onEnter: () => gsap.to(inner, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }) });
  });

  const mm = gsap.matchMedia();
  // tokens
  ScrollTrigger.create({ trigger: '.versus', start: 'top 78%', end: 'bottom 35%', scrub: true, onUpdate: (s) => setTokens(s.progress) });
  gsap.from('.gain', { y: 30, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: '.gains', start: 'top 88%', toggleActions: 'play none none none' } });
  // day
  mm.add('(min-width: 721px)', () => {
    const track = $('#dayTrack'); const dist = () => Math.max(0, track.scrollWidth - innerWidth + 60);
    gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '#day', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true, onUpdate: (s) => { $('#dayRail').style.width = (s.progress * 100) + '%'; } } });
    $$('.day-card .big').forEach((b) => gsap.fromTo(b, { x: 60 }, { x: -60, ease: 'none', scrollTrigger: { trigger: '#day', start: 'top top', end: () => '+=' + dist(), scrub: true } }));
  });
  // lanes
  mm.add('(min-width: 861px)', () => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: '#lanes', start: 'top top', end: '+=140%', pin: true, scrub: 0.6 } });
    reqEls.forEach((el, i) => tl.from(el, { y: -180, opacity: 0, rotate: i % 2 ? 5 : -5, duration: 0.5, ease: 'back.out(1.4)' }, i * 0.26));
  });
  mm.add('(max-width: 860px)', () => { reqEls.forEach((el) => gsap.from(el, { x: -24, opacity: 0, duration: 0.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } })); });
  // reveals
  $$('.defaults li, .trust article, .sync').forEach((el) => gsap.from(el, { y: 36, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' } }));
  // marquee skew with scroll velocity
  if (fine) ScrollTrigger.create({ trigger: document.body, start: 0, end: 'max', onUpdate: (s) => { const v = clamp(s.getVelocity() / -180, -10, 10); $('#mqSkew').style.setProperty('--skew', v.toFixed(2) + 'deg'); } });
  // catalog
  ScrollTrigger.create({ trigger: '#wall', start: 'top 82%', once: true, onEnter: () => {
    const order = cells.map((c, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((i, k) => setTimeout(() => { cells[i].classList.add('flash'); setTimeout(() => cells[i].classList.remove('flash'), 420); }, k * 5));
    const el = $('#wallN'); const o = { v: 271 }; el.textContent = '271';
    gsap.to(o, { v: 7, duration: 2.4, delay: 0.5, ease: 'power3.inOut', onUpdate() { el.textContent = Math.round(o.v); } });
  } });
  // final
  gsap.from('.final .cmd-hero, .final .links', { y: 30, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: '.final', start: 'top 75%', toggleActions: 'play none none none' } });

  addEventListener('load', () => ScrollTrigger.refresh());
})();
