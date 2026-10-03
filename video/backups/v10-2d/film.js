/*
 * HerCova — "The distance between her and care". The film's engine.
 *
 * RENDERED STATE (pure functions of composition time t, drawn once per frame by renderAll):
 *   the 3D opening (scene3d.js: heartbeat, her, the glass clock ring, the 7, the voxel map, the
 *   crash zoom; driven from here), backgrounds (SaaS grid, logo dots), the line of care + world
 *   camera, camera punches, ring pulses, grain, the logo's glide into its lockup.
 * TIMELINE TWEENS (one paused GSAP timeline): type, the timer chip, the portal UI, the console UI,
 *   the cursor, flash frames, the payoff, the end card.
 * Every time comes from timing.js; every word time from assets/audio/words.js.
 */
window.__buildHercova = function () {
  'use strict';

  const T = window.HERCOVA_TIMING;
  const WORDS = window.HERCOVA_WORDS || {};
  const root = document.querySelector('[data-composition-id="main"]');
  const W = +root.dataset.width;
  const H = +root.dataset.height;
  const CX = W / 2;
  const CY = H / 2;
  const DPR = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ------------------------------------------------------------------ math */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const EASES = {};
  const ease = (n) => EASES[n] || (EASES[n] = gsap.parseEase(n));
  const seg = (t, a, b, e = 'none') => ease(e)(clamp((t - a) / (b - a)));
  const bell = (t, a, b) => Math.sin(Math.PI * clamp((t - a) / (b - a)));
  const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
  const TAU = Math.PI * 2;
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function hash(i, j) {
    let n = (i * 374761393 + j * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function spring(k = 170, c = 18, m = 1) {
    const w0 = Math.sqrt(k / m);
    const z = c / (2 * Math.sqrt(k * m));
    const settle = Math.log(1000) / (z * w0);
    const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
    const f = (p) => {
      if (p >= 1) return 1;
      const t = p * settle;
      return z < 1 ? 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)) : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    };
    return { ease: f, duration: settle };
  }
  const POP = spring(300, 18);
  const SOFT = spring(140, 18);
  const SETTLE = spring(95, 15);
  function track(keys) {
    return (t) => {
      if (t <= keys[0].t) return { s: keys[0].s, x: keys[0].x, y: keys[0].y };
      for (let i = 1; i < keys.length; i++) {
        const k = keys[i];
        if (t <= k.t) {
          const p = keys[i - 1];
          const q = ease(k.e || 'power2.inOut')(clamp((t - p.t) / (k.t - p.t)));
          return { s: Math.exp(lerp(Math.log(p.s), Math.log(k.s), q)), x: lerp(p.x, k.x, q), y: lerp(p.y, k.y, q) };
        }
      }
      const l = keys[keys.length - 1];
      return { s: l.s, x: l.x, y: l.y };
    };
  }
  const camT = (c) => `translate(${(CX - c.s * c.x).toFixed(3)}px, ${(CY - c.s * c.y).toFixed(3)}px) scale(${c.s.toFixed(5)})`;
  const camTsvg = (c) => `translate(${(CX - c.s * c.x).toFixed(3)} ${(CY - c.s * c.y).toFixed(3)}) scale(${c.s.toFixed(5)})`;

  const line = (id) => T.vo.find((v) => v.id === id);
  function words(id) {
    const L = line(id);
    if (WORDS[id]) return WORDS[id].map((w) => ({ text: w[0], at: L.at + w[1], end: L.at + w[2] }));
    let t = L.at;
    return L.text.split(/\s+/).map((w) => { const o = { text: w, at: t, end: t + 0.3 }; t += 0.36; return o; });
  }
  const wAt = (id, i) => words(id)[i].at;
  const wFind = (id, re) => (words(id).find((w) => re.test(w.text)) || words(id)[0]).at;

  const tl = gsap.timeline({ paused: true });
  const S1 = T.s1, S2 = T.s2, S3 = T.s3, S4 = T.s4, S5 = T.s5, S6 = T.s6, S7 = T.s7, S8 = T.s8, S9 = T.s9;
  const redAt = wFind('vo3', /^danger/i);
  const claimAt = wFind('vo3', /^alerted/i);

  /* ======================================================================
     MICRO LAYER · camera punches (each paired with a sound) and flash frames
     ====================================================================== */
  const PUNCHES = [
    [wAt('vo1', 1), 0.035],             // "seven"
    [wFind('vo1', /^dies/i), -0.022],   // "dies": a small pull away
    [S6.yesTap + 0.05, 0.028],          // she reports the sign
    [redAt, 0.04],                      // "danger": the flag lands
    [claimAt, 0.028],                   // "alerted": claimed
    [S8.bloom[0] + 0.05, 0.03],         // she reaches care
    ...((window.HERCOVA_MUSIC || {}).drop ? [[window.HERCOVA_MUSIC.drop, 0.022]] : []), // the score's second drop (scripts/edit_music.py)
    [wFind('vo4', /^time/i), 0.018],    // "in time"
  ];
  const envP = (x) => (x < 0 ? 0 : x < 0.08 ? Math.sin((x / 0.08) * (Math.PI / 2)) : Math.exp(-(x - 0.08) / 0.38));
  const punch = (t) => PUNCHES.reduce((k, [at, amp]) => k * (1 + amp * envP(t - at)), 1);
  function shake(t) {
    const hits = [[S6.danger, 5], [redAt, 6]];
    let x = 0, y = 0;
    hits.forEach(([at, amp]) => { const d = t - at; if (d > 0 && d < 0.6) { const e = (1 - d / 0.6) ** 2; x += amp * e * Math.sin(d * 97); y += amp * 0.7 * e * Math.sin(d * 83 + 1.3); } });
    return { x, y };
  }
  const FLASHES = [[S1.iris[1] - 0.02, 0.16], [S2.dissolve, 0.22], [S8.bloom[0], 0.22], [S9.handoff, 0.28]];
  FLASHES.forEach(([at, a], i) => tl.fromTo('#flash', { opacity: 0 }, { keyframes: [{ opacity: a, duration: 0.05, ease: 'power1.out' }, { opacity: 0, duration: 0.32, ease: 'power2.in' }], immediateRender: i === 0 }, at));

  /* ring pulses — one or two thin circles expanding once: a quiet, precise accent */
  const burstSvg = $('#bursts');
  const PULSES = [];
  function burst(at, x, y, n = 2, spread = 1, color = '#a19eaa') {
    for (let i = 0; i < Math.min(3, Math.max(1, Math.round(n / 7))); i++) {
      PULSES.push({ at: at + i * 0.09, x, y, R: 70 * spread + i * 26, c: el('circle', { cx: x, cy: y, r: 0, fill: 'none', stroke: color, 'stroke-width': 2, opacity: 0 }, burstSvg) });
    }
  }
  function renderBursts(t) {
    PULSES.forEach((p) => {
      const d = t - p.at;
      if (d <= 0 || d > 0.9) { p.c.setAttribute('opacity', 0); return; }
      const e = ease('expo.out')(d / 0.9);
      p.c.setAttribute('r', (8 + p.R * e).toFixed(1));
      p.c.setAttribute('stroke-width', (2.2 - 1.4 * e).toFixed(2));
      p.c.setAttribute('opacity', (0.7 * (1 - d / 0.9)).toFixed(3));
    });
  }

  /* ======================================================================
     BACKGROUNDS · white and soft grey, a different stage for every scene
     ====================================================================== */
  // the dive lands inside her dot and her world of care floods the frame with the brand purple;
  // when she reaches care, a light lilac floods back out of her
  tl.fromTo('#stageIn', { attr: { r: 0 } }, { attr: { r: 1150 }, duration: 0.42, ease: 'power2.in' }, S4.dive[1] - 0.38);
  tl.fromTo('#stageOut', { attr: { r: 0 } }, { attr: { r: 1700 }, duration: 0.5, ease: 'power2.in' }, S8.flyHome[0] + 0.02);
  tl.set('#stageIn', { attr: { r: 0 } }, S8.bloom[0] + 0.6); // the light lilac stays: it is the ground for the payoff and the logo
  // the frame's labels turn white on the purple and back
  tl.fromTo(['#hudTL', '#hudTR', '#hudBL'], { color: 'rgba(22,20,26,0.45)' }, { color: 'rgba(255,255,255,0.62)', duration: 0.3, immediateRender: false }, S4.dive[1] - 0.12);
  tl.to(['#hudTL', '#hudTR', '#hudBL'], { color: 'rgba(22,20,26,0.45)', duration: 0.3 }, S8.flyHome[0] + 0.2);
  // the grid: a SaaS stage grid behind the product
  const gridCv = $('#bgGrid');
  gridCv.width = W * DPR; gridCv.height = H * DPR;
  const gctx2 = gridCv.getContext('2d');
  function drawGrid(t) {
    gctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    gctx2.clearRect(0, 0, W, H);
    // B · SaaS stage: a fine grid that travels with the camera (parallax)
    const bOn = seg(t, S5.handoff + 0.3, S5.handoff + 1.2) * (1 - seg(t, S8.flyHome[0], S8.flyHome[1]));
    if (bOn > 0.01) {
      const c = camB(t);
      const SP = 88 * (0.6 + 0.4 * c.s);
      const ox = (-(c.x * 0.35 * c.s) % SP + SP) % SP, oy = (-(c.y * 0.35 * c.s) % SP + SP) % SP;
      gctx2.strokeStyle = '#ffffff';
      gctx2.lineWidth = 1;
      for (let x = ox; x < W; x += SP) { const f = 1 - Math.abs(x - CX) / (W * 0.62); gctx2.globalAlpha = bOn * 0.07 * clamp(f); gctx2.beginPath(); gctx2.moveTo(x, 0); gctx2.lineTo(x, H); gctx2.stroke(); }
      for (let y = oy; y < H; y += SP) { const f = 1 - Math.abs(y - CY) / (H * 0.7); gctx2.globalAlpha = bOn * 0.07 * clamp(f); gctx2.beginPath(); gctx2.moveTo(0, y); gctx2.lineTo(W, y); gctx2.stroke(); }
      gctx2.fillStyle = '#ffffff';
      for (let x = ox; x < W; x += SP) for (let y = oy; y < H; y += SP) { gctx2.globalAlpha = bOn * 0.14 * clamp(1 - Math.hypot(x - CX, y - CY) / 900); gctx2.fillRect(x - 1.5, y - 1.5, 3, 3); }
    }
    gctx2.globalAlpha = 1;
  }

  /* ======================================================================
     1 · HER HEARTBEAT: the label
     ====================================================================== */
  // the heartbeat, her outline and her dot are 3D (scene3d.js); the label decodes over them
  const iris = S1.iris;
  const LAB = 'SOMEWHERE IN NIGERIA';
  const GLY = '#%&*+=<>/|01ABCDEFHKMNRSTXZ';
  const lab = $('#label1');
  let labLast = '';
  function renderLabel(t) {
    const p = seg(t, S1.label, S1.label + 0.8, 'power1.out');
    const f = Math.floor(t * 30);
    let s = '';
    for (let i = 0; i < LAB.length; i++) {
      const ch = LAB[i];
      if (ch === ' ' || i / LAB.length < p) s += ch;
      else if (t >= S1.label && i / LAB.length < p + 0.3) s += GLY[Math.floor(hash(i, f) * GLY.length)];
      else s += ' ';
    }
    if (s !== labLast) { lab.textContent = s; labLast = s; }
    lab.style.opacity = (1 - seg(t, iris[0] - 0.2, iris[0] + 0.2)).toFixed(3);
  }

  /* ======================================================================
     2 · HER · the photograph, the glass clock ring and the 7 are 3D (scene3d.js);
         the timer chip counts the ring's seven laps
     ====================================================================== */
  const RW = S2.ring;
  const timerT = $('#timerT');
  let timerLast = '';
  function renderTimer(t) {
    const q = seg(t, RW[0] + 0.15, RW[1], 'power3.inOut');
    const secs = Math.round(q * 7 * 60);
    const s = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    if (s !== timerLast) { timerT.textContent = s; timerLast = s; }
  }
  tl.fromTo('#timerChip', { opacity: 0, y: -10, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, RW[0]);
  tl.fromTo('#timerChip', { boxShadow: '0 0 0 0px rgba(22,20,26,0.25)' }, { keyframes: [{ boxShadow: '0 0 0 8px rgba(22,20,26,0.12)', duration: 0.12 }, { boxShadow: '0 0 0 14px rgba(22,20,26,0)', duration: 0.35 }], immediateRender: false }, RW[1]);
  tl.to('#timerChip', { opacity: 0, duration: 0.28, ease: 'power1.in' }, S2.dissolve);

  /* ======================================================================
     TYPE · "Every 7 minutes," behind her, then re-set beside the map
     ====================================================================== */
  const vo1 = words('vo1');
  const tEvery = $('#tEvery'), tMin = $('#tMinutes'), tSub = $('#tSub'), tSrc = $('#tSrc'), tSmall7 = $('#tSmall7');
  tMin.innerHTML = 'minutes,'.split('').map((c) => `<span class="ch">${c}</span>`).join('');
  tSub.innerHTML = vo1.slice(3).map((w, i) => `<span class="w" data-i="${i + 3}">${w.text}</span>`).join(' ');
  const POSE2 = { every: [420, 160], min: [182, 772], sub: [150, 952] };
  const POSE3 = { every: [150, 232, 0.846], min: [246, 356, 0.846], sub: [150, 508], seven: [150, 356, 0.846], src: [150, 588] };
  gsap.set(tEvery, { x: POSE2.every[0], y: POSE2.every[1] });
  gsap.set(tMin, { x: POSE2.min[0], y: POSE2.min[1] });
  gsap.set(tSub, { x: POSE2.sub[0], y: POSE2.sub[1] });
  gsap.set(tSmall7, { x: POSE3.seven[0], y: POSE3.seven[1], scale: POSE3.seven[2] });
  gsap.set(tSrc, { x: POSE3.src[0], y: POSE3.src[1] });
  tl.fromTo('#tEveryIn', { x: -760, opacity: 0, filter: 'blur(18px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, wAt('vo1', 0) - 0.12);
  $$('#tMinutes .ch').forEach((ch, i) => tl.fromTo(ch, { x: -640, opacity: 0, filter: 'blur(14px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, wAt('vo1', 2) - 0.16 + i * 0.016));
  $$('#tSub .w').forEach((w) => tl.fromTo(w, { y: 22, opacity: 0, filter: 'blur(7px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' }, vo1[+w.dataset.i].at - 0.06));
  const RS = [S2.dissolve, S2.dissolve + 0.72];
  tl.to(tEvery, { x: POSE3.every[0], y: POSE3.every[1], scale: POSE3.every[2], duration: RS[1] - RS[0], ease: 'power3.inOut' }, RS[0]);
  tl.to(tMin, { x: POSE3.min[0], y: POSE3.min[1], scale: POSE3.min[2], duration: RS[1] - RS[0], ease: 'power3.inOut' }, RS[0]);
  tl.to(tSub, { x: POSE3.sub[0], y: POSE3.sub[1], duration: RS[1] - RS[0], ease: 'power3.inOut' }, RS[0]);
  tl.fromTo(tSmall7, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, RS[1] - 0.22);
  tl.fromTo('#tSrcRule', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.inOut' }, 7.6);
  tl.fromTo(tSrc, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 7.66);
  tl.to([tEvery, tSmall7, tMin, tSub, tSrc], { x: '-=160', opacity: 0, filter: 'blur(14px)', duration: 0.42, ease: 'power3.in', stagger: 0.03 }, S3.typeOut);

  /* ======================================================================
     3–4 · ONE OF MANY, THE DIVE · the studio is scene3d.js; the purple floods from her pearl
     ====================================================================== */
  const qb = (a, c, b, u) => { const v = 1 - u; return v * v * a + 2 * v * u * c + u * u * b; };
  const glCv = $('#gl');
  const stageIn = $('#stageIn');
  let maskLast = '';
  function render3d(t) {
    const gl = window.__hc3d;
    if (!gl) return;
    const { her } = gl.render(t, punch(t), punch(t - 1 / 60));
    if (t > S4.dive[0]) { stageIn.setAttribute('cx', her[0].toFixed(1)); stageIn.setAttribute('cy', her[1].toFixed(1)); }
    // the 3D frame opens where the purple grows, so the flood rises out of her pearl
    const r = +stageIn.getAttribute('r');
    const m = r > 0.5 ? `radial-gradient(circle ${r.toFixed(1)}px at ${stageIn.getAttribute('cx')}px ${stageIn.getAttribute('cy')}px, transparent 99.5%, #000 100%)` : 'none';
    if (m !== maskLast) { glCv.style.maskImage = m; glCv.style.webkitMaskImage = m; maskLast = m; }
  }

  /* ======================================================================
     5–8 · THE LINE OF CARE, HER PORTAL, THE CONSOLE, AND HOME
     ====================================================================== */
  function catmull(P, per = 16) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const d = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
      const t0 = 0, t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let s = 0; s < per; s++) {
        const u = t1 + ((t2 - t1) * s) / per;
        const L = (a, b, ta, tb) => [((tb - u) / (tb - ta)) * a[0] + ((u - ta) / (tb - ta)) * b[0], ((tb - u) / (tb - ta)) * a[1] + ((u - ta) / (tb - ta)) * b[1]];
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        out.push(L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2));
      }
    }
    out.push(P[P.length - 1]);
    return out;
  }
  function resample(poly, n, step) {
    const acc = [0];
    for (let i = 1; i < poly.length; i++) acc.push(acc[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const total = acc[acc.length - 1];
    const count = step ? Math.floor(total / step) + 1 : n;
    const out = [];
    let j = 1;
    for (let i = 0; i < count; i++) {
      const L = step ? i * step : (total * i) / Math.max(1, count - 1);
      while (j < acc.length - 1 && acc[j] < L) j++;
      const f = (L - acc[j - 1]) / Math.max(1e-6, acc[j] - acc[j - 1]);
      out.push([lerp(poly[j - 1][0], poly[j][0], clamp(f)), lerp(poly[j - 1][1], poly[j][1], clamp(f))]);
    }
    return out;
  }
  const loop = [];
  for (let a = -10; a <= 270; a += 14) loop.push([Math.cos((a * Math.PI) / 180) * 138, Math.sin((a * Math.PI) / 180) * 138]);
  const ROUTE = [
    [1180, -660], [640, -560], [300, -330], [165, -140], ...loop,
    [120, -150], [300, -118], [520, -40], [690, -4], [800, 0], [1000, 0], [1200, 0],
    [1300, 0], [1372, -4], [1404, -64], [1428, 70], [1452, -30], [1470, 0], [1560, 18], [1700, 26], [1830, 6], [1910, 0], [2000, 0],
  ];
  const STEP = 3;
  const route = resample(catmull(ROUTE, 14), 0, STEP);
  const Lx = (x, from = 0) => { for (let i = Math.floor(from / STEP); i < route.length; i++) if (route[i][0] >= x) return i * STEP; return (route.length - 1) * STEP; };
  const L_LOOP = (() => { let b = 0, bd = 1e9; for (let i = 0; i < route.length * 0.3; i++) { const d = Math.hypot(route[i][0], route[i][1] + 138); if (d < bd) { bd = d; b = i; } } return b * STEP; })();
  const L_PHL = Lx(800, L_LOOP), L_PHR = Lx(1200, L_LOOP), L_CON = Lx(1910, L_PHR);
  const HEAD = [
    [S5.enter[0], 0, 'none'],
    [S5.enter[1], L_LOOP + 60, 'power2.out'],
    [S5.toPhone[1], L_PHL, 'sine.inOut'],
    [S6.surge[0] - 0.1, L_PHL, 'none'],
    [S6.surge[0], L_PHR, 'none'],
    [S6.surge[1], L_CON, 'power2.in'],
  ];
  function headL(t) {
    if (t <= HEAD[0][0]) return 0;
    for (let i = 1; i < HEAD.length; i++) { const [kt, kl, ke] = HEAD[i]; if (t <= kt) { const [pt, pl] = HEAD[i - 1]; return lerp(pl, kl, ease(ke)(clamp((t - pt) / (kt - pt)))); } }
    return L_CON;
  }
  const at = (L) => route[clamp(Math.round(L / STEP), 0, route.length - 1)];
  const HERO = { k: 1.1, head: [960, 560] };
  const S_HERO = (29.5 * HERO.k) / 30;
  const camB = track([
    { t: S5.handoff - 0.05, s: 1, x: 0, y: 0 },
    { t: S5.handoff + 0.05, s: 1, x: 0, y: 0, e: 'none' },
    { t: S5.toPhone[0], s: 1.05, x: 40, y: -10, e: 'sine.inOut' },
    { t: S5.toPhone[1], s: 1, x: 1000, y: 0, e: 'power2.inOut' },
    { t: S6.scroll, s: 1.045, x: 1004, y: -14, e: 'sine.inOut' },
    { t: S7.toConsole[0], s: 1.09, x: 1012, y: -34, e: 'sine.inOut' },
    { t: S7.toConsole[1], s: 1, x: 2500, y: 0, e: 'expo.inOut' },
    { t: 19.0, s: 1.03, x: 2505, y: 0, e: 'sine.inOut' },
    { t: claimAt + 0.05, s: 1.045, x: 2540, y: 6, e: 'sine.inOut' },
    { t: claimAt + 0.85, s: 0.99, x: 2712, y: 0, e: 'power3.inOut' },
    { t: S8.overview[0], s: 1.0, x: 2722, y: 0, e: 'sine.inOut' },
    { t: S8.overview[1], s: 0.42, x: 1250, y: 0, e: 'power3.inOut' },
    { t: S8.flyHome[0], s: 0.42, x: 1240, y: 0, e: 'none' },
    { t: S8.flyHome[1], s: S_HERO, x: (CX - HERO.head[0]) / S_HERO, y: (CY - HERO.head[1]) / S_HERO, e: 'power3.inOut' },
  ]);
  const LOGO_HEAD = [123, 228];
  const ARC_CTRL = [[163, 10], [215, 60], [228, 130], [222, 180], [216, 240], [170, 320], [168, 380], [166, 440], [195, 490], [222, 516]];
  const cub = (p0, p1, p2, p3, u) => { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; };
  const arcRaw = [];
  for (let s = 0; s < 3; s++) for (let u = 0; u <= 1.0001; u += 0.02) arcRaw.push(cub(ARC_CTRL[s * 3], ARC_CTRL[s * 3 + 1], ARC_CTRL[s * 3 + 2], ARC_CTRL[s * 3 + 3], u));
  const NM = 240;
  const ARC_K = HERO.k / S_HERO;
  const arcPts = resample(arcRaw.map(([x, y]) => [(x - LOGO_HEAD[0]) * ARC_K, (y - LOGO_HEAD[1]) * ARC_K]), NM);
  // the cradle: the logo's own arc, drawn huge beside mother and baby, before it shrinks into the logo
  const CRADLE = { k: 2.0, dx: 370 };
  const ringPts = arcPts.map(([x, y]) => [x * CRADLE.k + CRADLE.dx, y * CRADLE.k]);
  const camBEl = $('#camB');
  const stageB = $('#stageB');
  const lineEls = [$('#lineAura'), $('#lineGlow'), $('#lineCore')];
  tl.fromTo(lineEls[2], { stroke: '#ffffff' }, { stroke: '#7b2fa8', duration: 0.35, ease: 'power1.inOut' }, S8.flyHome[0] + 0.08);
  const stageOut = $('#stageOut');
  const headEl = $('#headB');
  const pulseEls = [$('#pulseGlow'), $('#pulseCore')];
  const sparks = [];
  const SOCKETS = [[800, 0, S5.toPhone[1] - 0.05], [1200, 0, S6.surge[0]], [1910, 0, S6.surge[1] - 0.05]].map(([x, y, t0]) => {
    const g = el('g', { transform: `translate(${x} ${y}) scale(0)` }, $('#sockets'));
    el('circle', { r: 18, fill: 'rgb(255 255 255 / 0.22)' }, g);
    el('circle', { r: 10, fill: '#ffffff', stroke: '#7b2fa8', 'stroke-width': 3 }, g);
    return { g, x, y, t0 };
  });
  const polyD = (P) => { if (P.length < 2) return ''; let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`; for (let i = 1; i < P.length; i++) d += `L${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)}`; return d; };
  const WRAP = [S8.flyHome[0], S8.bloom[1]];
  const RETRACT = [S6.phoneIn + 0.3, S6.phoneIn + 0.85];
  function linePts(t) {
    if (t < WRAP[0]) {
      const hL = headL(t);
      let tail = Math.max(0, hL - 1500) * seg(t, S5.toPhone[0], S5.toPhone[1], 'power2.inOut');
      // once it has plugged in, the line pulls itself into her phone, leaving the left half to the type
      tail = lerp(tail, Math.max(tail, L_PHL), seg(t, RETRACT[0], RETRACT[1], 'power3.inOut'));
      tail *= 1 - seg(t, S8.overview[0], S8.overview[0] + 0.6, 'power2.inOut');
      if (hL - tail < STEP * 2) return [];
      return route.slice(Math.round(tail / STEP), Math.max(1, Math.round(hL / STEP)) + 1);
    }
    const endL = lerp(L_CON, L_LOOP + 40, seg(t, WRAP[0], WRAP[0] + 0.55, 'power2.in'));
    const part = resample(route.slice(0, Math.round(endL / STEP) + 1), NM);
    const m1 = seg(t, WRAP[0] + 0.3, WRAP[1], 'power3.inOut');
    const m2 = seg(t, S8.close[0], S8.close[1], 'power3.inOut');
    return part.map((p, i) => { const a = [lerp(p[0], ringPts[i][0], m1), lerp(p[1], ringPts[i][1], m1)]; return [lerp(a[0], arcPts[i][0], m2), lerp(a[1], arcPts[i][1], m2)]; });
  }
  const whipNode = $('#whipNode');
  function renderB(t) {
    const c0 = camB(t);
    const sh = shake(t);
    const c = { s: c0.s * punch(t), x: c0.x - sh.x / c0.s, y: c0.y - sh.y / c0.s };
    camBEl.style.transform = camT(c);
    // the light returns from exactly where she is on screen
    stageOut.setAttribute('cx', (CX - c.s * c.x).toFixed(1));
    stageOut.setAttribute('cy', (CY - c.s * c.y).toFixed(1));
    let bx = 22 * bell(t, S7.toConsole[0], S7.toConsole[1]) + 8 * bell(t, S5.toPhone[0], S5.toPhone[1]);
    let by = bx * 0.06;
    const z = 6 * bell(t, S8.overview[0], S8.overview[1]) + 8 * bell(t, S8.flyHome[0], S8.flyHome[1]);
    bx += z; by += z;
    if (bx > 0.1) { whipNode.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`); stageB.style.filter = 'url(#whip)'; } else stageB.style.filter = 'none';
    const P = t >= S5.enter[0] ? linePts(t) : [];
    const d = polyD(P);
    lineEls.forEach((p) => p.setAttribute('d', d));
    const m1 = seg(t, WRAP[0] + 0.3, WRAP[1], 'power3.inOut');
    const m2 = seg(t, S8.close[0], S8.close[1], 'power3.inOut');
    lineEls[2].setAttribute('stroke-width', lerp(lerp(5, 12, m1), 26, m2 ** 1.4).toFixed(2));
    lineEls[1].setAttribute('stroke-width', lerp(lerp(11, 24, m1), 34, m2).toFixed(2));
    const L = headL(t);
    const vis = (t >= S5.enter[0] && t < S5.toPhone[1] + 0.05) || (t >= S6.surge[0] && t < S6.surge[1] + 0.05);
    const hp = at(L);
    headEl.setAttribute('transform', `translate(${hp[0].toFixed(1)} ${hp[1].toFixed(1)})`);
    headEl.setAttribute('opacity', vis ? 1 : 0);
    sparks.forEach((sp, i) => {
      const age = (i + 1) * 0.028, te = t - age;
      const on = vis && ((te >= S5.enter[0] && te < S5.toPhone[1]) || (te >= S6.surge[0] && te < S6.surge[1]));
      if (!on) { sp.setAttribute('opacity', 0); return; }
      const p = at(headL(te)), a = hash(i, 3) * TAU, v = 30 + 70 * hash(i, 5);
      sp.setAttribute('cx', (p[0] + Math.cos(a) * v * age).toFixed(1));
      sp.setAttribute('cy', (p[1] + Math.sin(a) * v * age + 40 * age * age).toFixed(1));
      sp.setAttribute('opacity', ((1 - age / 0.62) * 0.9).toFixed(3));
    });
    SOCKETS.forEach((s) => { const k = t < s.t0 ? 0 : POP.ease(clamp((t - s.t0) / POP.duration)); s.g.setAttribute('transform', `translate(${s.x} ${s.y}) scale(${(k * (1 + 0.08 * Math.sin(t * 5))).toFixed(3)})`); s.g.setAttribute('opacity', (1 - seg(t, WRAP[0], WRAP[0] + 0.4)).toFixed(3)); });
    const flare = bump(t, S8.pulse[1], 0.12);
    const beat = 1 + 0.14 * bump(t, S5.enter[1] - 0.25, 0.06) + 0.1 * bump(t, S5.enter[1] - 0.05, 0.06) + 0.4 * flare;
    $('#herB').setAttribute('transform', `scale(${(beat * (1 + 0.03 * Math.sin(t * 2.4))).toFixed(4)})`);
    $('#herFlashB').setAttribute('r', (30 * (1 + 3 * seg(t, S8.pulse[1], S8.pulse[1] + 0.8, 'expo.out'))).toFixed(2));
    $('#herFlashB').setAttribute('opacity', (t >= S8.pulse[1] ? 0.9 * (1 - seg(t, S8.pulse[1], S8.pulse[1] + 0.8)) : 0).toFixed(3));
    const pr = S8.pulse;
    if (t > pr[0] && t < pr[1] + 0.15) {
      const Lp = lerp(L_CON, 0, seg(t, pr[0], pr[1], 'power2.inOut'));
      const i0 = Math.round(Lp / STEP);
      const dd = polyD(route.slice(i0, Math.min(route.length, i0 + 80)));
      pulseEls.forEach((p) => { p.setAttribute('d', dd); p.setAttribute('opacity', (1 - seg(t, pr[1], pr[1] + 0.15)).toFixed(3)); });
    } else pulseEls.forEach((p) => p.setAttribute('opacity', 0));
  }
  const passAt = (L) => { const f = (t) => lerp(L_CON, 0, seg(t, S8.pulse[0], S8.pulse[1], 'power2.inOut')); let a = S8.pulse[0], b = S8.pulse[1]; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) > L) a = m; else b = m; } return (a + b) / 2; };
  const PHONE_PASS = passAt((L_PHL + L_PHR) / 2);

  /* ---------- her HerCova portal: the line draws the phone, then the phone fills in ---------- */
  const ph = S6;
  const rrect = (x, y, w, h, r, sx) => `M${sx} ${y + h / 2} L${x} ${y + h / 2} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + h / 2}`;
  const phOut = $('#phoneOutline');
  phOut.setAttribute('d', rrect(800, -410, 400, 820, 62, 800));
  const PHL = phOut.getTotalLength();
  phOut.style.strokeDasharray = `${PHL} ${PHL}`;
  tl.fromTo(phOut, { strokeDashoffset: PHL, opacity: 1 }, { strokeDashoffset: 0, duration: 0.62, ease: 'power2.inOut' }, S5.toPhone[1] - 0.12);
  tl.to(phOut, { opacity: 0, duration: 0.3 }, ph.phoneIn + 0.3);
  tl.fromTo('#phonePlate', { attr: { r: 0 } }, { attr: { r: 520 }, duration: 1.0, ease: 'expo.out' }, S5.toPhone[1] - 0.05);
  tl.fromTo('#phone', { clipPath: 'inset(0% 0% 100% 0% round 62px)', opacity: 1 }, { clipPath: 'inset(0% 0% 0% 0% round 62px)', duration: 0.5, ease: 'power3.inOut' }, ph.phoneIn - 0.05);
  tl.fromTo('#phone', { rotationX: 0, rotationY: 0 }, { rotationX: 5, rotationY: -7, duration: 1.4, ease: 'power2.out', transformPerspective: 1700 }, ph.phoneIn);
  tl.to('#phone', { rotationY: -2, rotationX: 2, duration: 3.6, ease: 'sine.inOut' }, ph.phoneIn + 1.4);
  ['#pHead', '#cWeek', '#cCheck'].forEach((s, i) => tl.fromTo(s, { y: 30, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' }, ph.phoneIn + 0.3 + i * 0.09));
  const wa = $('#weekArc');
  const WAL = 2 * Math.PI * 27;
  wa.style.strokeDasharray = `${WAL} ${WAL}`;
  tl.fromTo(wa, { strokeDashoffset: WAL }, { strokeDashoffset: WAL * (1 - 28 / 40), duration: 1.0, ease: 'power3.out' }, ph.phoneIn + 0.55);
  const weekNum = { v: 0 };
  const weekEl = $('#cWeek .weekBig');
  tl.fromTo(weekNum, { v: 0 }, { v: 28, duration: 0.9, ease: 'power3.out', onUpdate: () => { weekEl.textContent = `Week ${Math.round(weekNum.v)}`; } }, ph.phoneIn + 0.55);
  const touch = $('#touch'), touchRing = $('#touchRing');
  function tap(x, y, t0) {
    tl.fromTo(touch, { left: x, top: y, opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out', immediateRender: false }, t0 - 0.25);
    tl.to(touch, { scale: 0.78, duration: 0.09, ease: 'power2.in' }, t0);
    tl.to(touch, { scale: 1, opacity: 0, duration: 0.3, ease: 'power2.out' }, t0 + 0.1);
    tl.fromTo(touchRing, { left: x, top: y, scale: 0.6, opacity: 0.9 }, { scale: 2.1, opacity: 0, duration: 0.55, ease: 'expo.out', immediateRender: false }, t0 + 0.02);
  }
  tap(108, 361, ph.checkTap); // measured: centre of the No chip
  tl.to('#chipNo', { scale: 1.05, duration: 0.15, ease: 'power2.out' }, ph.checkTap - 0.22);
  tl.to('#chipNo', { scale: 1, backgroundColor: '#7b2fa8', color: '#ffffff', boxShadow: 'inset 0 0 0 0px #7b2fa8', duration: 0.2 }, ph.checkTap + 0.02);
  tl.to('#checkQ', { opacity: 0, y: -12, duration: 0.3, ease: 'power2.in' }, ph.checkTap + 0.28);
  tl.fromTo('#checkOk', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' }, ph.checkTap + 0.42);
  const tick = $('#okTick'); const TKL = tick.getTotalLength(); tick.style.strokeDasharray = `${TKL} ${TKL}`;
  tl.fromTo(tick, { strokeDashoffset: TKL }, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, ph.checkTap + 0.5);
  tl.fromTo('#cCheck', { height: 176 }, { height: 78, duration: 0.5, ease: 'power3.inOut' }, ph.checkTap + 0.32);
  // the check-in floats out of the screen as a card of its own
  const linkOk = $('#linkOk'), linkDanger = $('#linkDanger');
  linkOk.setAttribute('d', 'M1262 -166 C 1226 -166 1232 -109 1196 -109');
  linkDanger.setAttribute('d', 'M1196 -50 C 1232 -50 1214 -295 1250 -295');
  [linkOk, linkDanger].forEach((l) => { const L = l.getTotalLength(); l.dataset.len = L; });
  tl.fromTo('#floatOk', { opacity: 0, x: 760, rotationY: -40, filter: 'blur(10px)' }, { opacity: 1, x: 0, rotationY: 0, filter: 'blur(0px)', duration: 0.85, ease: 'expo.out', transformPerspective: 1200 }, ph.checkTap + 0.4);
  tl.fromTo(linkOk, { opacity: 0, strokeDashoffset: 0 }, { opacity: 1, strokeDashoffset: -48, duration: 1.2, ease: 'none' }, ph.checkTap + 0.6);
  tl.to(['#floatOk', linkOk], { opacity: 0, y: -40, duration: 0.45, ease: 'power2.in' }, ph.scroll - 0.1);
  tl.fromTo('#cGuide', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, ease: 'expo.out' }, ph.guide - 0.05);
  $$('#cGuide .guide').forEach((g, i) => tl.fromTo(g, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, ph.guide + 0.2 + i * 0.1));
  tl.fromTo('#pScroll', { y: 0 }, { y: -260, duration: 0.8, ease: 'power3.inOut' }, ph.scroll);
  tl.fromTo('#cCheck2', { opacity: 0.001 }, { opacity: 1, duration: 0.3 }, ph.scroll + 0.2);
  tl.fromTo(['#cVisit', '#cTip'], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.08 }, ph.scroll + 0.3);
  tl.fromTo('#tabbar', { y: 60 }, { y: 0, duration: 0.55, ease: 'expo.out' }, ph.phoneIn + 0.4);
  tap(268, 375, ph.yesTap); // measured: centre of the Yes chip after the scroll
  tl.to('#chipYes', { scale: 1.05, duration: 0.15, ease: 'power2.out' }, ph.yesTap - 0.22);
  tl.to('#chipYes', { scale: 1, backgroundColor: '#d6483f', color: '#ffffff', boxShadow: 'inset 0 0 0 0px #d6483f', duration: 0.2 }, ph.yesTap + 0.02);
  tl.to('#check2Q', { opacity: 0, scale: 0.97, duration: 0.25, ease: 'power2.in' }, ph.danger - 0.05);
  tl.fromTo('#cCheck2', { backgroundColor: '#ffffff' }, { backgroundColor: '#fbe9e7', duration: 0.35 }, ph.danger);
  tl.fromTo('#check2Danger', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' }, ph.danger + 0.08);
  tl.fromTo('#check2Danger .dIc', { scale: 0.5 }, { scale: 1, duration: POP.duration, ease: POP.ease }, ph.danger + 0.1);
  // the alert's progress: reported, then the care team alerted as the line leaves for the console
  tl.fromTo('#dBarFill', { scaleX: 0 }, { scaleX: 0.34, duration: 0.45, ease: 'power3.out' }, ph.danger + 0.25);
  tl.to('#dBarFill', { scaleX: 0.67, duration: 0.5, ease: 'power3.inOut' }, S6.surge[0]);
  tl.to('#dStep2', { color: '#b23a32', duration: 0.2 }, S6.surge[0] + 0.3);
  tl.fromTo('#cCheck2', { boxShadow: '0 0 0 0px rgba(214,72,63,0.45)' }, { keyframes: [{ boxShadow: '0 0 0 10px rgba(214,72,63,0.28)', duration: 0.3 }, { boxShadow: '0 0 0 18px rgba(214,72,63,0)', duration: 0.5 }] }, ph.danger + 0.12);
  tl.fromTo('#floatDanger', { opacity: 0, x: 820, rotationY: -40, filter: 'blur(10px)' }, { opacity: 1, x: 0, rotationY: 0, filter: 'blur(0px)', duration: 0.85, ease: 'expo.out', transformPerspective: 1200 }, ph.danger + 0.1);
  tl.fromTo(linkDanger, { opacity: 0, strokeDashoffset: 0 }, { opacity: 1, strokeDashoffset: -60, duration: 1.4, ease: 'none' }, ph.danger + 0.25);
  tl.fromTo('#floatDanger', { boxShadow: '0 30px 60px -34px rgba(178,58,50,0.5), inset 0 0 0 1.5px #efc7c2, 0 0 0 0px rgba(214,72,63,0.35)' }, { keyframes: [{ boxShadow: '0 30px 60px -34px rgba(178,58,50,0.5), inset 0 0 0 1.5px #efc7c2, 0 0 0 12px rgba(214,72,63,0.18)', duration: 0.35 }, { boxShadow: '0 30px 60px -34px rgba(178,58,50,0.5), inset 0 0 0 1.5px #efc7c2, 0 0 0 22px rgba(214,72,63,0)', duration: 0.5 }], immediateRender: false }, ph.danger + 0.5);
  tl.set('#dangerSub', { textContent: 'Your care team has been alerted' }, PHONE_PASS);
  tl.fromTo('#dangerSub', { opacity: 0.2 }, { opacity: 1, duration: 0.4 }, PHONE_PASS);
  tl.to(['#phone', '#console', '#drawer', '#floatDanger', '#linkDanger'], { opacity: 0, scale: 0.94, duration: 0.45, ease: 'power2.in', immediateRender: false }, S8.flyHome[0] + 0.15);
  tl.to(['#phonePlate', '#consolePlate'], { opacity: 0, duration: 0.45, ease: 'power2.in' }, S8.flyHome[0] + 0.15);

  /* ---------- the care-team console ---------- */
  const cs = S7;
  const coOut = $('#consoleOutline');
  coOut.setAttribute('d', rrect(1910, -360, 1180, 720, 26, 1910));
  const COL = coOut.getTotalLength();
  coOut.style.strokeDasharray = `${COL} ${COL}`;
  tl.fromTo(coOut, { strokeDashoffset: COL, opacity: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, S6.surge[1] - 0.05);
  tl.to(coOut, { opacity: 0, duration: 0.3 }, cs.consoleIn + 0.35);
  tl.fromTo('#consolePlate', { opacity: 0, scale: 0.9, svgOrigin: '2500 20' }, { opacity: 1, scale: 1, svgOrigin: '2500 20', duration: 0.9, ease: 'expo.out' }, S6.surge[1] + 0.1);
  tl.fromTo('#console', { clipPath: 'inset(0% 100% 0% 0% round 26px)', opacity: 1 }, { clipPath: 'inset(0% 0% 0% 0% round 26px)', duration: 0.55, ease: 'power3.inOut' }, cs.consoleIn - 0.05);
  $$('#cSide .nav, #cSide .cBrand').forEach((n, i) => tl.fromTo(n, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, cs.consoleIn + 0.12 + i * 0.05));
  tl.fromTo('#cHead', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, cs.consoleIn + 0.18);
  ['#tile0', '#tile1', '#tile2'].forEach((s, i) => tl.fromTo(s, { y: 26, scale: 0.9, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: SOFT.duration, ease: SOFT.ease }, cs.consoleIn + 0.26 + i * 0.07));
  tl.fromTo('#queue', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }, cs.consoleIn + 0.2);
  gsap.set(['#rowA', '#rowB', '#rowC'], { y: -84 });
  gsap.set('#rowA', { opacity: 0 });
  tl.fromTo(['#rowB', '#rowC'], { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.07 }, cs.consoleIn + 0.25);
  tl.fromTo(['#rowA', '#rowB', '#rowC'], { y: -84 }, { y: 0, duration: 0.55, ease: 'power3.out', immediateRender: false }, redAt);
  tl.fromTo('#rowA', { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, redAt + 0.05);
  tl.fromTo('#redGlow', { opacity: 0 }, { keyframes: [{ opacity: 1, duration: 0.25 }, { opacity: 0.35, duration: 1.2 }] }, redAt + 0.1);
  tl.fromTo('#pillA', { scale: 0.4 }, { scale: 1, duration: POP.duration, ease: POP.ease }, redAt + 0.2);
  tl.fromTo('#navBadge', { scale: 0 }, { scale: 1, duration: POP.duration, ease: POP.ease }, redAt + 0.2);
  tl.fromTo('#navBadge', { boxShadow: '0 0 0 0px rgba(214,72,63,0.5)' }, { keyframes: [{ boxShadow: '0 0 0 6px rgba(214,72,63,0.25)', duration: 0.3 }, { boxShadow: '0 0 0 10px rgba(214,72,63,0)', duration: 0.4 }], repeat: 1, immediateRender: false }, redAt + 0.5);
  tl.fromTo('#tile0', { boxShadow: 'inset 0 0 0 1.5px #ebe9ef' }, { keyframes: [{ boxShadow: 'inset 0 0 0 2.5px #d6483f', duration: 0.2 }, { boxShadow: 'inset 0 0 0 1.5px #ebe9ef', duration: 0.9 }], immediateRender: false }, redAt + 0.2);
  tl.fromTo('#toast', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, redAt + 0.15);
  tl.to('#toast', { x: 30, opacity: 0, duration: 0.35, ease: 'power2.in' }, redAt + 1.7);
  const odo = (id, seq) => { const e = document.getElementById(id); e.innerHTML = seq.map((n) => `<span>${n}</span>`).join(''); };
  odo('n0', [0, 1, 0]); odo('n1', [0, 1]); odo('n2', [0, 1]);
  tl.fromTo('#n0', { y: 0 }, { y: -44, duration: 0.45, ease: 'back.out(2)' }, redAt + 0.22);
  tl.to('#n0', { y: -88, duration: 0.45, ease: 'back.out(2)' }, claimAt + 0.1);
  tl.fromTo('#n1', { y: 0 }, { y: -44, duration: 0.45, ease: 'back.out(2)' }, claimAt + 0.14);
  tl.fromTo('#n2', { y: 0 }, { y: -44, duration: 0.45, ease: 'back.out(2)' }, cs.referral + 0.08);
  tl.fromTo('#tile2', { boxShadow: 'inset 0 0 0 1.5px #ebe9ef' }, { keyframes: [{ boxShadow: 'inset 0 0 0 2.5px #3f9142', duration: 0.2 }, { boxShadow: 'inset 0 0 0 1.5px #ebe9ef', duration: 0.9 }], immediateRender: false }, cs.referral + 0.1);
  // the cursor: hover, then claim on "alerted"
  const BTN = [1910 + 210 + 30 + (1180 - 210 - 60) - 18 - 43, -360 + 392];
  const cc = camB(claimAt);
  const btnScreen = [CX + cc.s * (BTN[0] - cc.x), CY + cc.s * (BTN[1] - cc.y)];
  tl.fromTo('#cursor', { x: 1760, y: 1030, opacity: 0 }, { x: 1600, y: 860, opacity: 1, duration: 0.35, ease: 'power2.out' }, cs.cursorIn);
  tl.to('#cursor', { x: btnScreen[0] - 6, y: btnScreen[1] - 4, duration: claimAt - cs.cursorIn - 0.5, ease: 'power3.inOut' }, cs.cursorIn + 0.35);
  tl.fromTo('#rowA', { backgroundColor: '#ffffff' }, { backgroundColor: '#f7f7f9', duration: 0.25, immediateRender: false }, claimAt - 0.55);
  tl.to('#btnClaim', { backgroundColor: '#6a2791', scale: 1.04, duration: 0.2 }, claimAt - 0.3);
  tl.to('#cursor', { scale: 0.86, duration: 0.08, ease: 'power2.in', transformOrigin: '10% 10%' }, claimAt - 0.02);
  tl.to('#cursor', { scale: 1, duration: 0.25, ease: 'back.out(3)' }, claimAt + 0.08);
  tl.fromTo('#clickRing', { left: btnScreen[0], top: btnScreen[1], scale: 0.5, opacity: 0.9 }, { scale: 1.9, opacity: 0, duration: 0.6, ease: 'expo.out', immediateRender: false }, claimAt);
  tl.to('#btnClaim', { scale: 0.93, duration: 0.08, ease: 'power2.in' }, claimAt - 0.02);
  tl.to('#btnClaim', { scale: 1, backgroundColor: '#f3f2f5', color: '#16141a', boxShadow: 'inset 0 0 0 1.5px #e4e2e8', duration: 0.35, ease: 'back.out(2)' }, claimAt + 0.06);
  tl.set('#btnClaim', { textContent: 'Claimed · Nurse Grace' }, claimAt + 0.06);
  tl.to('#pillA', { opacity: 0, scale: 0.8, duration: 0.3 }, claimAt + 0.2);
  tl.to('#redGlow', { opacity: 0, duration: 0.4 }, claimAt + 0.2);
  tl.fromTo('#refA', { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' }, cs.referral);
  // her profile slides in from the right edge of the frame as she is claimed
  tl.fromTo('#drawer', { opacity: 0, x: 700, filter: 'blur(12px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, claimAt + 0.12);
  $$('#drawer .dwHead, #drawer .dwStatus, #drawer .dwCap, #drawer .tlItem').forEach((e, i) => tl.fromTo(e, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, claimAt + 0.3 + i * 0.06));
  tl.set('#dwStatusT', { textContent: 'Referred to care' }, cs.referral + 0.05);
  tl.fromTo('#dwStatus', { backgroundColor: '#f3f2f5' }, { keyframes: [{ backgroundColor: '#e7f3e7', duration: 0.2 }, { backgroundColor: '#e7f3e7', duration: 1 }] }, cs.referral + 0.05);
  tl.fromTo('#tlRef', { scale: 1 }, { keyframes: [{ scale: 1.04, duration: 0.15 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' }], transformOrigin: '0% 50%', immediateRender: false }, cs.referral + 0.1);
  tl.to('#cursor', { x: '+=60', y: '+=90', opacity: 0, duration: 0.5, ease: 'power2.in' }, cs.referral + 0.1);
  burst(claimAt + 0.02, btnScreen[0], btnScreen[1], 14, 0.9);


  /* ---------- 8 · she reaches care: an artwork, not a photograph in a circle ----------
     Dots stream out of her orange dot and settle into a halftone of mother and newborn; the
     halftone resolves into the photograph — the film's first colour — and stays over it as texture; at the close
     the photograph returns to dots and they collapse back into her dot. */
  const BL = S8.bloom;
  const CL = S8.close;
  const MBP = window.HERCOVA_MB;
  const mbCv = $('#mbDots');
  mbCv.width = W * DPR; mbCv.height = H * DPR;
  const mbx = mbCv.getContext('2d');
  const ORIGIN = HERO.head;
  const mbPts = MBP.pts.map(([x, y, r, col], i) => {
    const dx = x - ORIGIN[0], dy = y - ORIGIN[1];
    const len = Math.hypot(dx, dy) || 1;
    const sw = (0.25 + 0.45 * hash(i, 61)) * len * (hash(i, 62) > 0.5 ? 1 : -1);
    return { x, y, r, rgb: hexRgb(col), cx: ORIGIN[0] + dx * 0.5 - (dy / len) * sw, cy: ORIGIN[1] + dy * 0.5 + (dx / len) * sw, d: 0.42 * clamp(len / 700) + 0.2 * hash(i, 63) };
  });
  const DOT_RGB = hexRgb('#16141a');
  const RES = [BL[1] - 0.1, BL[1] + 0.45];
  function renderS8(t) {
    mbx.setTransform(1, 0, 0, 1, 0, 0);
    mbx.clearRect(0, 0, mbCv.width, mbCv.height);
    mbx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const texture = lerp(1, 0.13, seg(t, RES[0], RES[1], 'power2.inOut'));
    const back = seg(t, CL[0] - 0.08, CL[0] + 0.2);
    for (const p of mbPts) {
      const u = ease('power3.out')(clamp((t - BL[0] - p.d) / 0.72));
      if (u <= 0) continue;
      const v = ease('power3.in')(clamp((t - CL[0] - 0.08 - (0.34 - p.d * 0.5)) / 0.4));
      let x = qb(ORIGIN[0], p.cx, p.x, u), y = qb(ORIGIN[1], p.cy, p.y, u);
      x = lerp(x, ORIGIN[0], v); y = lerp(y, ORIGIN[1], v);
      const r = p.r * (0.35 + 0.65 * u) * (1 - 0.85 * v);
      const k = clamp(u * 1.4);
      const a = Math.min(1, u * 1.5) * lerp(texture, 1, back) * (1 - v);
      if (a < 0.005 || r < 0.2) continue;
      mbx.globalAlpha = a;
      mbx.fillStyle = `rgb(${Math.round(lerp(DOT_RGB[0], p.rgb[0], k))},${Math.round(lerp(DOT_RGB[1], p.rgb[1], k))},${Math.round(lerp(DOT_RGB[2], p.rgb[2], k))})`;
      mbx.beginPath(); mbx.arc(x, y, r, 0, TAU); mbx.fill();
    }
    mbx.globalAlpha = 1;
  }
  tl.fromTo('#mbImg', { opacity: 0 }, { opacity: 1, duration: RES[1] - RES[0], ease: 'power2.inOut' }, RES[0]);
  tl.to('#mbImg', { opacity: 0, duration: 0.28, ease: 'power2.in' }, CL[0] - 0.08);
  tl.fromTo('#mbWrap', { scale: 1.05 }, { scale: 1, duration: CL[0] - BL[0], ease: 'power2.out', transformOrigin: `${ORIGIN[0]}px ${ORIGIN[1]}px` }, BL[0]);
  tl.to('#herB', { opacity: 0, duration: 0.25 }, RES[0]);
  tl.to('#herB', { opacity: 1, duration: 0.2 }, CL[0] + 0.3);
  const vo4 = words('vo4');
  tl.fromTo('#reachLine', { x: -420, filter: 'blur(10px)' }, { x: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' }, vo4[0].at - 0.12);
  $$('#reachLine .w').forEach((w, i) => tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out' }, vo4[i].at - 0.1));
  tl.fromTo('#inTime', { x: -680, filter: 'blur(18px)' }, { x: 0, filter: 'blur(0px)', duration: 0.85, ease: 'expo.out' }, vo4[4].at - 0.16);
  $$('#inTime .w').forEach((w, i) => tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power1.out' }, vo4[i + 4].at - 0.14));
  tl.to(['#reachLine', '#inTime'], { opacity: 0, filter: 'blur(12px)', x: -30, duration: 0.4, ease: 'power2.in', stagger: 0.04 }, S8.close[0] - 0.1);

  /* ======================================================================
     9 · THE PROMISE
     ====================================================================== */
  const markG = $('#markG');
  const lettersG = $('#lettersG');
  const LOCK = { k: 900 / 1279, tx: 510, ty: 250 };
  const HEROT = { k: HERO.k, tx: HERO.head[0] - LOGO_HEAD[0] * HERO.k, ty: HERO.head[1] - LOGO_HEAD[1] * HERO.k };
  lettersG.setAttribute('transform', `translate(${LOCK.tx} ${LOCK.ty}) scale(${LOCK.k})`);
  function renderLogo(t) {
    const q = seg(t, S9.lockup[0], S9.lockup[1], 'power3.inOut');
    markG.setAttribute('transform', `translate(${lerp(HEROT.tx, LOCK.tx, q).toFixed(2)} ${lerp(HEROT.ty, LOCK.ty, q).toFixed(2)}) scale(${lerp(HEROT.k, LOCK.k, q).toFixed(5)})`);
  }
  tl.fromTo(markG, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'power1.out' }, S9.handoff - 0.08);
  tl.fromTo('#svgB', { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'power1.in' }, S9.handoff);
  const sw = $('#swooshDraw'); const SWL = sw.getTotalLength(); sw.style.strokeDasharray = `${SWL} ${SWL}`;
  tl.fromTo(sw, { strokeDashoffset: SWL }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, S9.swoosh);
  tl.fromTo('#markHead', { scale: 1 }, { keyframes: [{ scale: 1.2, duration: 0.14, ease: 'power2.out' }, { scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.45)' }], svgOrigin: '123 228' }, S9.swoosh + 0.5);
  burst(S9.handoff + 0.05, HERO.head[0] + 40, HERO.head[1], 16, 2.4);
  const WORDMARK = 'M792 192C799.51 191.57 808.75 191.8 816 193C822.22 194.03 827.41 195.52 833 198C839.1 200.7 845.43 204.24 851 209C857.21 214.31 867.25 225.14 868 229C868.26 230.34 867.95 230.9 867 232C864.23 235.19 851 240 843 244C839.67 239.67 837.08 234.63 833 231C828.79 227.25 822.75 224.03 818 222C814.17 220.36 811.3 219.47 807 219C801.16 218.36 792.92 218.33 786 220C778.58 221.79 770.4 225.17 764 230C757.32 235.04 750.86 242.91 747 250C743.56 256.33 741.93 262.75 741 270C739.95 278.25 739.97 288.46 742 297C744.01 305.45 748.35 314.57 753 321C756.96 326.47 761.55 330.55 767 334C772.79 337.66 779.89 340.63 787 342C794.51 343.45 803.64 343.66 811 342C817.89 340.45 824.77 337.14 830 333C835 329.04 838 323 842 318C850.67 322 859.33 326 868 330C866 333.67 864.91 337.23 862 341C858.03 346.14 851.43 352.69 845 357C838.46 361.39 830.21 364.84 823 367C816.57 368.93 810.43 369.66 804 370C797.44 370.35 790.36 369.9 784 369C778.06 368.16 772.57 366.94 767 365C761.23 362.99 755.04 360.03 750 357C745.5 354.29 742.18 352.07 738 348C732.03 342.18 723.65 333.02 719 324C714.22 314.74 711.4 302.87 710 293C708.76 284.31 709.28 275.24 710 268C710.56 262.33 711.46 258.08 713 253C714.69 247.43 717.2 241.15 720 236C722.6 231.22 725.35 227.22 729 223C733.16 218.19 738.99 212.82 744 209C748.32 205.7 752.32 203.29 757 201C761.95 198.58 767.36 196.49 773 195C778.99 193.42 785.28 192.39 792 192ZM299 196C309 196 319 196 329 196C329 219 329 242 329 265C358.67 265 388.33 265 418 265C418 242 418 219 418 196C428.33 196 438.67 196 449 196C449 253 449 310 449 367C438.67 367 428.33 367 418 367C418.33 342 418.67 317 419 292C389 292 359 292 329 292C329 317 329 342 329 367C319 367 309 367 299 367C299 310 299 253 299 196ZM530 240C538.29 238.76 548.63 239.43 556 241C561.81 242.23 566.16 244.04 571 247C576.55 250.4 582.52 255.11 587 261C592.11 267.73 596.66 277.2 599 286C601.35 294.86 600.33 304.67 601 314C569 314 537 314 505 314C507.33 320.33 508.1 327.71 512 333C516.01 338.44 524 343.67 529 346C532.29 347.53 534.38 347.69 538 348C543.33 348.45 551.3 348.82 558 347C565.62 344.93 573.33 339 581 335C584.67 341 588.33 347 592 353C589 355.33 586.73 357.82 583 360C577.99 362.94 571.32 366.28 564 368C554.87 370.14 541.9 371.23 532 370C523.04 368.89 514.28 366.15 507 362C500.03 358.03 493.68 352.24 489 346C484.4 339.87 481.04 332.78 479 325C476.72 316.31 475.81 305.38 477 296C478.18 286.72 481.09 276.94 486 269C491.01 260.89 499.23 252.87 507 248C514.04 243.59 521.98 241.2 530 240ZM687 240C690.13 239.41 692.33 240 695 240C695 248.67 695 257.33 695 266C687.67 266.67 679.66 265.51 673 268C666.32 270.5 661 276.67 655 281C655 309.67 655 338.33 655 367C645.67 367 636.33 367 627 367C627 325.67 627 284.33 627 243C636.33 243 645.67 243 655 243C654.67 248.67 652.64 258.55 654 260C654.47 260.5 655.14 260.35 656 260C658.59 258.93 663.92 250.32 669 247C674.21 243.6 682.13 240.91 687 240ZM882.58 304.85A65.17 65.17 0 1 1 1012.92 304.85A65.17 65.17 0 1 1 882.58 304.85ZM1207 240C1213.69 239.29 1223.46 239.25 1230 240C1234.98 240.57 1238.57 241.28 1243 243C1248.2 245.01 1254.99 248.55 1259 252C1262.16 254.72 1264.14 257.12 1266 261C1268.56 266.34 1269.89 272.56 1271 282C1273.2 300.73 1271 338.67 1271 367C1261.67 367 1252.33 367 1243 367C1243 362.67 1243 358.33 1243 354C1240.33 356.67 1238.01 359.83 1235 362C1232.01 364.16 1228.56 365.68 1225 367C1221.25 368.39 1217.38 369.46 1213 370C1207.86 370.63 1201.59 370.96 1196 370C1190.25 369.01 1184.07 367.2 1179 364C1173.68 360.65 1168.18 355.25 1165 350C1162.07 345.16 1160.67 339.48 1160 334C1159.32 328.48 1159.7 322.18 1161 317C1162.19 312.25 1164.27 307.7 1167 304C1169.65 300.41 1173.08 297.44 1177 295C1181.3 292.33 1186.24 290.11 1192 289C1199.16 287.62 1209.47 287.59 1217 289C1223.62 290.24 1230.38 293.2 1235 296C1238.43 298.08 1240.33 300.67 1243 303C1243 295 1245.36 285.45 1243 279C1241.01 273.57 1235.87 268.62 1232 266C1229.11 264.05 1226.57 263.58 1223 263C1218.08 262.2 1210.73 261.96 1205 263C1199.41 264.01 1193.78 266.38 1189 269C1184.52 271.46 1181 275 1177 278C1173.67 272.67 1167.95 265.31 1167 262C1166.62 260.68 1166.47 260.12 1167 259C1168.15 256.56 1173.87 252.6 1178 250C1182.46 247.2 1187.99 244.68 1193 243C1197.66 241.44 1201.72 240.56 1207 240ZM1021 243C1030.67 243 1040.33 243 1050 243C1061.67 273.67 1073.33 304.33 1085 335C1097 304.67 1109 274.33 1121 244C1131 243.67 1141 243.33 1151 243C1134 284.33 1117 325.67 1100 367C1090 366.67 1080 366.33 1070 366C1053.67 325 1037.33 284 1021 243ZM534 262C529.26 262.58 524.63 263.97 521 266C517.79 267.79 515.3 270.25 513 273C510.59 275.88 508.33 279.46 507 283C505.69 286.47 505.67 290.33 505 294C528.33 294 551.67 294 575 294C574.33 290.33 574.62 286.76 573 283C570.91 278.15 566.02 271.39 562 268C558.88 265.37 555.95 264.05 552 263C546.99 261.67 539.46 261.33 534 262ZM941 264C936.43 264.85 931.79 266.41 928 269C924.09 271.68 920.53 276.02 918 280C915.63 283.72 914.04 287.39 913 292C911.71 297.72 911.12 305.59 912 312C912.85 318.24 915.06 324.99 918 330C920.6 334.44 924.18 338.31 928 341C931.57 343.52 935.68 345.14 940 346C944.64 346.93 950.18 346.99 955 346C959.85 345 965.22 342.73 969 340C972.36 337.58 974.78 334.67 977 331C979.64 326.62 981.96 320.73 983 315C984.12 308.8 984.12 301.2 983 295C981.96 289.27 979.64 283.38 977 279C974.78 275.33 972.29 272.44 969 270C965.41 267.34 960.61 265.01 956 264C951.29 262.96 945.74 263.12 941 264ZM1208 307C1203.76 307.63 1200 309.28 1197 311C1194.55 312.41 1192.6 313.79 1191 316C1189.12 318.59 1187.34 322.27 1187 326C1186.59 330.44 1187.47 336.99 1190 341C1192.5 344.97 1197.87 348.2 1202 350C1205.57 351.56 1209.04 351.91 1213 352C1217.61 352.11 1223.6 351.35 1228 350C1231.78 348.84 1235.29 347.26 1238 345C1240.56 342.86 1242.94 340.48 1244 337C1245.46 332.21 1243.33 324.33 1243 318C1237.67 314.67 1232.82 309.84 1227 308C1221.16 306.16 1213.4 306.19 1208 307Z';
  const COLS = [[295, 453], [473, 605], [623, 699], [706, 872], [880, 1016], [1017, 1155], [1156, 1275]];
  const ldefs = $('#logoSvg defs');
  const letterEls = COLS.map(([x0, x1], i) => {
    const cp = el('clipPath', { id: `lcl${i}`, clipPathUnits: 'userSpaceOnUse' }, ldefs);
    el('rect', { x: x0, y: 150, width: x1 - x0, height: 260 }, cp);
    const g = el('g', { 'clip-path': `url(#lcl${i})` }, lettersG);
    const inner = el('g', {}, g);
    el('path', { fill: '#7B2FA8', d: WORDMARK }, inner);
    return inner;
  });
  letterEls.forEach((g, i) => tl.fromTo(g, { y: 190, opacity: 0 }, { y: 0, opacity: 1, duration: SOFT.duration, ease: SOFT.ease }, S9.letters + i * 0.055));
  const vo5 = words('vo5');
  const TAG = ['Care', 'that', 'reaches', 'her', 'anywhere.'];
  $('#tagline').innerHTML = TAG.map((w, i) => `<span class="w${i === 4 ? ' accent' : ''}">${w}</span>`).join('');
  $$('#tagline .w').forEach((w, i) => tl.fromTo(w, { y: 40, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, (vo5[i] ? vo5[i].at : S9.letters + 0.5 + i * 0.1) - 0.08));
  tl.fromTo('#domain', { opacity: 0, letterSpacing: '0.5em' }, { opacity: 1, letterSpacing: '0.28em', duration: 0.9, ease: 'power3.out' }, S9.domain);
  // the line signs off under the tagline
  const sig = $('#sigLine'); const SGL = sig.getTotalLength(); sig.style.strokeDasharray = `${SGL} ${SGL}`;
  tl.fromTo(sig, { strokeDashoffset: SGL }, { strokeDashoffset: 0, duration: 0.8, ease: 'power3.inOut' }, S9.domain - 0.35);
  tl.fromTo('#sigDot', { opacity: 0, scale: 0, svgOrigin: '1220 770' }, { opacity: 1, scale: 1, svgOrigin: '1220 770', duration: POP.duration, ease: POP.ease }, S9.domain + 0.35);
  // the lilac disc returns behind the lockup: the same disc that held her and the map, now holding the name
  tl.set('#herDisc', { attr: { fill: '#e6d8f4' } }, S9.handoff + 0.3); // a deeper lilac, to read on the light lilac ground
  tl.fromTo('#herDisc', { attr: { cx: 1420, cy: 600, r: 0 }, opacity: 1 }, { attr: { r: 452 }, duration: 1.3, ease: 'expo.out', immediateRender: false }, S9.handoff + 0.35);
  tl.fromTo('#logoSvg', { scale: 1 }, { scale: 1.018, duration: T.duration - S9.lockup[1], ease: 'sine.inOut', transformOrigin: '50% 40%' }, S9.lockup[1]);

  /* ======================================================================
     FILM TEXTURE
     ====================================================================== */
  const grainCv = $('#grain');
  grainCv.width = 960; grainCv.height = 540;
  const gctx = grainCv.getContext('2d');
  const gimg = gctx.createImageData(960, 540);
  let grainLast = -1;
  function drawGrain(t) {
    const f = Math.floor(t * 24);
    if (f === grainLast) return;
    grainLast = f;
    let s = (f * 2654435761 + 12345) >>> 0 || 1;
    const d = gimg.data;
    for (let i = 0; i < d.length; i += 4) {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const v = s & 255;
      d[i] = 36; d[i + 1] = 34; d[i + 2] = 42;
      d[i + 3] = v > 150 ? (v - 150) * 1.4 : 0;
    }
    gctx.putImageData(gimg, 0, 0);
  }


  /* ======================================================================
     FRAME SYSTEM · wordmark, chapters, coordinates
     ====================================================================== */
  tl.fromTo(['#hudTL', '#hudBL'], { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.1 }, 0.4);
  const CHAPTERS = [[0.45, '01  SOMEWHERE'], [iris[0], '02  HER'], [S2.dissolve, '03  ONE OF MANY'], [S5.handoff, '04  THE LINE OF CARE'], [S5.toPhone[1], '05  HER PORTAL'], [S7.toConsole[1], '06  HER CARE TEAM'], [S8.overview[0], '07  IN TIME'], [S9.handoff, '08  HERCOVA']];
  const hudTR = $('#hudTR');
  let hudLast = '';
  function renderHud(t) {
    let ci = -1;
    for (let i = 0; i < CHAPTERS.length; i++) if (t >= CHAPTERS[i][0]) ci = i;
    let s = '';
    if (ci >= 0) {
      const [c0, label] = CHAPTERS[ci];
      const pr = clamp((t - c0) / 0.5);
      const f = Math.floor(t * 30);
      for (let i = 0; i < label.length; i++) { const ch = label[i]; s += ch === ' ' || i / label.length < pr ? ch : GLY[Math.floor(hash(i + ci * 50, f) * GLY.length)]; }
    }
    if (s !== hudLast) { hudTR.textContent = s; hudLast = s; }
  }

  /* "HerCova walks / with her." — each line streaks in from the left edge as one unit; words light up on her voice */
  const vo2w = words('vo2');
  tl.fromTo('#walk1', { x: -760, filter: 'blur(16px)' }, { x: 0, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, vo2w[0].at - 0.12);
  tl.fromTo('#walk2', { x: -760, filter: 'blur(16px)' }, { x: 0, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, vo2w[2].at - 0.12);
  $$('#walkType .w').forEach((w, i) => tl.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, vo2w[i].at - 0.1));
  tl.to(['#walk1', '#walk2'], { x: -180, opacity: 0, filter: 'blur(12px)', duration: 0.4, ease: 'power3.in', stagger: 0.04 }, 12.2);

  /* "Watching, / guiding, / catching the / warning signs / early." — one line per beat of her sentence, beside the portal */
  const PL = [['#pl1', /^watching/i], ['#pl2', /^guiding/i], ['#pl3', /^catching/i], ['#pl4', /^warning/i], ['#pl5', /^early/i]];
  PL.forEach(([id, re], i) => {
    const at = wFind('vo2', re) - 0.12;
    tl.fromTo(id, { x: -720, opacity: 0, filter: 'blur(16px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, at);
    if (i > 0) tl.to(PL[i - 1][0], { opacity: 0.3, duration: 0.35, ease: 'power2.out' }, at + 0.08);
  });
  // they live in the world, so the whip to the console carries them off; hidden once they are off-screen
  tl.to(PL.map(([id]) => id), { opacity: 0, duration: 0.05 }, S7.toConsole[1] - 0.1);

  /* the whole route, named, at the widest point of the pull-back */
  const co = camB(S8.overview[1]);
  const scr = (x, y) => [CX + co.s * (x - co.x), CY + co.s * (y - co.y)];
  [['#ovHer', 0, -70], ['#ovPhone', 1000, -470], ['#ovConsole', 2500, -420]].forEach(([id, x, y], i) => {
    const [sx, sy] = scr(x, y);
    gsap.set(id, { left: sx, top: sy, xPercent: -50, yPercent: -100 });
    tl.fromTo(id, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, S8.overview[1] - 0.4 + i * 0.07);
    tl.to(id, { opacity: 0, duration: 0.25 }, S8.flyHome[0] + 0.15);
  });

  /* ======================================================================
     THE DRIVER — one tween, one render pass per frame
     ====================================================================== */
  const rigs = [['#rig1', 0, 3.8], ['#rig2', 2.4, 6.9], ['#rigT', 3.1, 9.7], ['#rig8', 22.3, 25.8]].map(([s, a, b]) => [$(s), a, b]);
  function renderAll(t) {
    const k = punch(t);
    rigs.forEach(([e, a, b]) => { if (t > a && t < b) e.style.transform = `scale(${k.toFixed(4)})`; });
    if (t < 10.15) render3d(t);
    if (t < 3.8) renderLabel(t);
    if (t > 2.4 && t < 6.9) renderTimer(t);
    if (t > S5.handoff - 0.1 && t < S9.handoff + 0.3) renderB(t);
    if (t > S8.bloom[0] - 0.1 && t < S8.close[1] + 0.25) renderS8(t);
    if (t > S9.handoff - 0.2) renderLogo(t);
    renderHud(t);
    drawGrid(t);
    renderBursts(t);
    drawGrain(t);
  }
  const clock = { t: 0 };
  tl.fromTo(clock, { t: 0 }, { t: T.duration, duration: T.duration, ease: 'none', onUpdate: () => renderAll(clock.t) }, 0);
  renderB(S5.handoff);
  renderAll(0);
  window.__hcRenderNow = () => renderAll(clock.t); // scene3d.js loads after the build and redraws the current frame
  return tl;
};
