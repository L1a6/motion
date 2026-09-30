/*
 * HerCova — "The distance between her and care". The film's engine.
 *
 * RENDERED STATE (pure functions of composition time t, drawn once per frame by renderAll):
 *   backgrounds (rippling dot grid, SaaS grid), heartbeat ripples, the 3D clock ring, the
 *   particle hand-off, the map + dive camera, the line of care + world camera, camera punches,
 *   shape bursts, dust, grain, the logo's glide into its lockup.
 * TIMELINE TWEENS (one paused GSAP timeline): type, the photograph's iris and pop-out, the
 *   portal UI, the console UI, the cursor, flash frames, the payoff, the end card.
 * Every time comes from timing.js; every word time from assets/audio/words.js.
 */
window.__buildHercova = function () {
  'use strict';

  const T = window.HERCOVA_TIMING;
  const WORDS = window.HERCOVA_WORDS || {};
  const NG = window.NIGERIA;
  const G7 = window.GLYPH7;
  const PARTS = window.HERCOVA_PARTICLES;
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
  const FLASHES = [[S1.iris[1] - 0.02, 0.3], [S2.dissolve, 0.22], [S4.dive[1] - 0.03, 0.55], [S8.bloom[0], 0.45], [S9.handoff, 0.28]];
  FLASHES.forEach(([at, a], i) => tl.fromTo('#flash', { opacity: 0 }, { keyframes: [{ opacity: a, duration: 0.05, ease: 'power1.out' }, { opacity: 0, duration: 0.32, ease: 'power2.in' }], immediateRender: i === 0 }, at));

  /* ring pulses — one or two thin circles expanding once: a quiet, precise accent */
  const burstSvg = $('#bursts');
  const PULSES = [];
  function burst(at, x, y, n = 2, spread = 1, color = '#7b2fa8') {
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
     BACKGROUNDS · white and lilac, a different stage for every scene
     ====================================================================== */
  // her world: a flat lilac disc that grows out of her dot, holds her, then holds the map
  const DISC = { her: [1450, 612, 470], map: [1420, 600, 452] };
  tl.fromTo('#herDisc', { attr: { cx: 960, cy: 540, r: 30 } }, { attr: { cx: DISC.her[0], cy: DISC.her[1], r: DISC.her[2] }, duration: S1.iris[1] - S1.iris[0] + 0.15, ease: 'expo.inOut' }, S1.iris[0]);
  tl.to('#herDisc', { attr: { cx: DISC.map[0], cy: DISC.map[1], r: DISC.map[2] }, duration: 0.9, ease: 'power3.inOut' }, S2.dissolve + 0.05);
  [['#discRing1', 46], ['#discRing2', 104]].forEach(([id, off], i) => {
    tl.fromTo(id, { attr: { cx: DISC.her[0], cy: DISC.her[1], r: DISC.her[2] - 30 }, opacity: 0 }, { attr: { r: DISC.her[2] + off }, opacity: 1, duration: 0.9, ease: 'expo.out' }, S1.iris[1] - 0.1 + i * 0.08);
    tl.to(id, { attr: { cx: DISC.map[0], cy: DISC.map[1], r: DISC.map[2] + off }, duration: 0.9, ease: 'power3.inOut' }, S2.dissolve + 0.05);
    tl.fromTo(id, { rotation: 0, svgOrigin: `${DISC.map[0]} ${DISC.map[1]}` }, { rotation: i ? -40 : 30, svgOrigin: `${DISC.map[0]} ${DISC.map[1]}`, duration: 6, ease: 'none' }, S1.iris[1]);
  });
  // the website's corner light, recut as a flat quarter disc
  tl.fromTo('#corner', { attr: { r: 0 } }, { attr: { r: 430 }, duration: 0.9, ease: 'expo.out' }, S1.iris[1]);
  tl.to('#corner', { attr: { r: 0 }, duration: 0.6, ease: 'power3.in' }, S2.dissolve + 0.1);
  // the dive: her world rushes past the lens
  tl.to(['#herDisc', '#discRing1', '#discRing2'], { opacity: 0, duration: 0.45, ease: 'power2.in' }, S4.dive[0] + 0.1);

  // cartographic lines behind the map
  const geo = $('#bgGeo');
  const geoLines = [];
  for (let i = 0; i < 12; i++) { const y = 250 + i * 64; geoLines.push(el('path', { d: `M880 ${y} Q 1420 ${y - 22 + (i - 6) * 2} 1960 ${y}`, fill: 'none', stroke: 'rgb(123 47 168 / 0.13)', 'stroke-width': 1.2 }, geo)); }
  for (let i = 0; i < 13; i++) { const x = 900 + i * 80; geoLines.push(el('path', { d: `M${x} 220 Q ${x + (i - 6) * 6} 600 ${x} 1000`, fill: 'none', stroke: 'rgb(123 47 168 / 0.1)', 'stroke-width': 1.2 }, geo)); }
  geoLines.forEach((p, i) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L}`; tl.fromTo(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, S3.fly[0] + 0.1 + (i % 13) * 0.04); });
  tl.fromTo(geo, { opacity: 1 }, { opacity: 0, duration: 0.5, immediateRender: false }, S4.dive[0]);
  tl.set(geo, { opacity: 1 }, 0);

  // concentric rings behind the logo
  const ringsBg = $('#bgRings');
  const bgRing = [0, 1, 2, 3, 4, 5].map((i) => el('circle', { cx: 960, cy: 434, r: 260 + i * 130, fill: 'none', stroke: `rgb(123 47 168 / ${(0.16 - i * 0.022).toFixed(3)})`, 'stroke-width': 1.3, 'stroke-dasharray': i % 2 ? '2 10' : 'none', opacity: 0 }, ringsBg));
  bgRing.forEach((c, i) => tl.fromTo(c, { attr: { r: 120 + i * 90 }, opacity: 0 }, { attr: { r: 260 + i * 130 }, opacity: 1, duration: 1.4, ease: 'expo.out' }, S9.handoff + 0.1 + i * 0.07));

  // the grid: a dot field that ripples with her heartbeat, later a SaaS stage grid
  const gridCv = $('#bgGrid');
  gridCv.width = W * DPR; gridCv.height = H * DPR;
  const gctx2 = gridCv.getContext('2d');
  const beats = T.heartbeat.beats.map((b) => T.heartbeat.at + b);
  function drawGrid(t) {
    gctx2.setTransform(DPR, 0, 0, DPR, 0, 0);
    gctx2.clearRect(0, 0, W, H);
    // A · heartbeat dot field
    const aOn = seg(t, 0.05, 0.8) * (1 - seg(t, S1.iris[0], S1.iris[1]));
    if (aOn > 0.01) {
      const SP = 38;
      gctx2.fillStyle = '#7b2fa8';
      for (let y = SP / 2; y < H; y += SP) for (let x = SP / 2; x < W; x += SP) {
        const dx = x - 960, dy = y - 540, dist = Math.hypot(dx, dy) || 1;
        let push = 0, lift = 0;
        beats.forEach((b) => { if (t > b) { const R = (t - b) * 520; const w = Math.exp(-(((dist - R) / 46) ** 2)) * Math.exp(-(t - b) * 1.1); push += 14 * w; lift += w; } });
        const px = x + (dx / dist) * push, py = y + (dy / dist) * push;
        const fall = clamp(1 - dist / 1100);
        gctx2.globalAlpha = aOn * (0.07 + 0.1 * fall + 0.35 * clamp(lift));
        gctx2.beginPath(); gctx2.arc(px, py, 1.6 + 1.8 * clamp(lift), 0, TAU); gctx2.fill();
      }
    }
    // B · SaaS stage: a fine grid that travels with the camera (parallax)
    const bOn = seg(t, S5.handoff + 0.3, S5.handoff + 1.2) * (1 - seg(t, S8.flyHome[0], S8.flyHome[1]));
    if (bOn > 0.01) {
      const c = camB(t);
      const SP = 88 * (0.6 + 0.4 * c.s);
      const ox = (-(c.x * 0.35 * c.s) % SP + SP) % SP, oy = (-(c.y * 0.35 * c.s) % SP + SP) % SP;
      gctx2.strokeStyle = '#7b2fa8';
      gctx2.lineWidth = 1;
      for (let x = ox; x < W; x += SP) { const f = 1 - Math.abs(x - CX) / (W * 0.62); gctx2.globalAlpha = bOn * 0.06 * clamp(f); gctx2.beginPath(); gctx2.moveTo(x, 0); gctx2.lineTo(x, H); gctx2.stroke(); }
      for (let y = oy; y < H; y += SP) { const f = 1 - Math.abs(y - CY) / (H * 0.7); gctx2.globalAlpha = bOn * 0.06 * clamp(f); gctx2.beginPath(); gctx2.moveTo(0, y); gctx2.lineTo(W, y); gctx2.stroke(); }
      gctx2.fillStyle = '#7b2fa8';
      for (let x = ox; x < W; x += SP) for (let y = oy; y < H; y += SP) { gctx2.globalAlpha = bOn * 0.14 * clamp(1 - Math.hypot(x - CX, y - CY) / 900); gctx2.fillRect(x - 1.5, y - 1.5, 3, 3); }
    }
    // C · logo: a faint dot field settles in
    const cOn = seg(t, S9.handoff + 0.3, S9.handoff + 1.5);
    if (cOn > 0.01) {
      const SP = 42;
      gctx2.fillStyle = '#7b2fa8';
      for (let y = SP / 2; y < H; y += SP) for (let x = SP / 2; x < W; x += SP) {
        const d = Math.hypot(x - 960, y - 434);
        gctx2.globalAlpha = cOn * 0.1 * clamp((d - 380) / 300) * clamp(1 - d / 1300);
        gctx2.beginPath(); gctx2.arc(x, y, 1.5, 0, TAU); gctx2.fill();
      }
    }
    gctx2.globalAlpha = 1;
  }

  /* ======================================================================
     1 · HEARTBEAT
     ====================================================================== */
  const dot1 = $('#dot1');
  const ripples = beats.map(() => el('circle', { cx: 960, cy: 540, r: 30, fill: 'none', stroke: '#7b2fa8', 'stroke-width': 2, opacity: 0 }, $('#ripples1')));
  const iris = S1.iris;
  function renderS1(t) {
    const ig = t < beats[0] ? 0 : POP.ease(clamp((t - beats[0]) / POP.duration));
    let k = ig * (1 + 0.03 * Math.sin(t * 2.4));
    beats.forEach((b, i) => { if (i) k *= 1 + 0.2 * bump(t, b, 0.05); });
    const open = seg(t, iris[0], iris[0] + 0.3, 'power2.in');
    k *= 1 + open * 1.6;
    dot1.setAttribute('transform', `translate(960 540) scale(${k.toFixed(4)})`);
    dot1.setAttribute('opacity', (1 - open).toFixed(3));
    ripples.forEach((c, i) => {
      const p = clamp((t - beats[i]) / 1.5);
      c.setAttribute('r', (30 + 330 * ease('expo.out')(p)).toFixed(2));
      c.setAttribute('stroke-width', (2.4 - 1.8 * p).toFixed(2));
      c.setAttribute('opacity', t >= beats[i] ? (0.5 * (1 - p)).toFixed(3) : 0);
    });
  }
  const clock1 = $('#clock1');
  [[200, 60, 1.3, 0.45], [312, 0, 1.2, 0.32], [436, 120, 1, 0.22]].forEach(([r, n, w, al], k) => {
    const g = el('g', { opacity: 0 }, clock1);
    el('circle', { cx: 960, cy: 540, r, fill: 'none', stroke: '#7b2fa8', 'stroke-width': w, opacity: al, 'stroke-dasharray': k === 1 ? '2 12' : 'none' }, g);
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU, r2 = r + (i % 5 === 0 ? 14 : 7);
      el('line', { x1: 960 + Math.cos(an) * r, y1: 540 + Math.sin(an) * r, x2: 960 + Math.cos(an) * r2, y2: 540 + Math.sin(an) * r2, stroke: '#7b2fa8', 'stroke-width': i % 5 === 0 ? 1.6 : 1, opacity: Math.min(1, al * 1.5) }, g);
    }
    tl.fromTo(g, { opacity: 0, scale: 0.86, rotation: 0, svgOrigin: '960 540' }, { opacity: 1, scale: 1, rotation: k % 2 ? -8 : 10, svgOrigin: '960 540', duration: 1.3, ease: 'expo.out' }, beats[0] + 0.1 + k * 0.18);
    tl.to(g, { rotation: k % 2 ? -26 : 32, svgOrigin: '960 540', duration: 2.0, ease: 'none' }, beats[0] + 1.4 + k * 0.18);
    tl.to(g, { opacity: 0, scale: 1.3, svgOrigin: '960 540', duration: 0.5, ease: 'power2.in' }, iris[0]);
  });
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
     2 · HER
     ====================================================================== */
  const HEART = [1490, 710];
  // the portal: her dot opens as a circle and she is inside it — then the circle lets go of her
  tl.fromTo('#photoSubject', { x: 960 - HEART[0], y: 540 - HEART[1], scale: 0.9 }, { x: 0, y: 0, scale: 1, duration: iris[1] - iris[0] + 0.1, ease: 'power3.inOut', transformOrigin: `${HEART[0] - 1040}px ${HEART[1] - 60}px` }, iris[0]);
  tl.fromTo('#subjectClip', { clipPath: 'circle(30px at 960px 540px)' }, { clipPath: `circle(${DISC.her[2]}px at ${DISC.her[0]}px ${DISC.her[1]}px)`, duration: iris[1] - iris[0] + 0.15, ease: 'expo.inOut' }, iris[0]);
  tl.to('#subjectClip', { clipPath: `circle(1400px at ${DISC.her[0]}px ${DISC.her[1]}px)`, duration: 0.9, ease: 'expo.out' }, S2.popOut);
  const pushDur = S2.dissolve - iris[1] + 0.3;
  tl.to('#photoSubject', { scale: 1.06, duration: pushDur, ease: 'none', transformOrigin: `${HEART[0] - 1040}px ${HEART[1] - 60}px` }, iris[1] + 0.1);

  ['#big7fill', '#big7stroke'].forEach((s) => $(s).setAttribute('d', G7.d));
  const s7 = $('#big7stroke');
  const S7L = s7.getTotalLength();
  s7.style.strokeDasharray = `${S7L} ${S7L}`;
  const sevenAt = wAt('vo1', 1);
  tl.fromTo(s7, { strokeDashoffset: S7L }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, sevenAt - 0.12);
  tl.fromTo('#big7fill', { opacity: 0 }, { opacity: 0.92, duration: 0.35, ease: 'power2.out' }, sevenAt + 0.3);
  tl.fromTo(s7, { opacity: 1 }, { opacity: 0, duration: 0.3 }, sevenAt + 0.55);
  tl.fromTo('#big7', { scale: 0.88, y: 30 }, { scale: 1, y: 0, duration: SOFT.duration, ease: SOFT.ease, transformOrigin: '50% 100%' }, sevenAt - 0.12);

  const RING = { cx: 1490, cy: 770, rx: 430, ry: 92, rot: (-7 * Math.PI) / 180 };
  const ringPt = (a, grow = 1) => {
    const x = Math.cos(a) * RING.rx * grow, y = Math.sin(a) * RING.ry * grow;
    return [RING.cx + x * Math.cos(RING.rot) - y * Math.sin(RING.rot), RING.cy + x * Math.sin(RING.rot) + y * Math.cos(RING.rot)];
  };
  const ringBack = $('#ringBack'), ringFront = $('#ringFront');
  const ellipseD = (a0, a1) => { let d = ''; for (let i = 0; i <= 60; i++) { const [x, y] = ringPt(lerp(a0, a1, i / 60)); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } return d; };
  const arcBack = el('path', { d: ellipseD(Math.PI, TAU), fill: 'none', stroke: 'rgb(123 47 168 / 0.35)', 'stroke-width': 1.6 }, ringBack);
  const arcFront = el('path', { d: ellipseD(0, Math.PI), fill: 'none', stroke: 'rgb(123 47 168 / 0.6)', 'stroke-width': 2 }, ringFront);
  [arcBack, arcFront].forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = L; p.dataset.len = L; });
  const ticksR = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const [x1, y1] = ringPt(a, 1.0), [x2, y2] = ringPt(a, i % 5 === 0 ? 1.075 : 1.045);
    const front = Math.sin(a) > 0;
    ticksR.push(el('line', { x1, y1, x2, y2, stroke: front ? '#7b2fa8' : 'rgb(123 47 168 / 0.6)', 'stroke-width': i % 5 === 0 ? 2.6 : 1.6, 'stroke-linecap': 'round', opacity: 0 }, front ? ringFront : ringBack));
  }
  const cometB = [], cometF = [];
  for (let i = 0; i < 16; i++) {
    cometB.push(el('circle', { r: i ? 5.2 - i * 0.26 : 7, fill: i ? '#b98bd6' : '#7b2fa8', opacity: 0 }, ringBack));
    cometF.push(el('circle', { r: i ? 5.2 - i * 0.26 : 7, fill: i ? '#b98bd6' : '#7b2fa8', opacity: 0 }, ringFront));
  }
  const RW = S2.ring;
  const timerT = $('#timerT');
  let timerLast = '';
  function renderS2(t) {
    const out = 1 - seg(t, S2.dissolve, S2.dissolve + 0.3);
    const rp = seg(t, RW[0], RW[0] + 0.7, 'power2.out');
    [arcBack, arcFront].forEach((p) => { p.style.strokeDashoffset = (+p.dataset.len * (1 - rp)).toFixed(1); p.setAttribute('opacity', out.toFixed(3)); });
    const q = seg(t, RW[0] + 0.15, RW[1], 'power3.inOut');
    const qa = seg(t - 1 / 60, RW[0] + 0.15, RW[1], 'power3.inOut');
    const ang = -Math.PI / 2 + q * 7 * TAU;
    const spd = Math.abs(q - qa) * 7 * TAU * 60;
    const lap = ((q * 7 * 60) % 60 + 60) % 60;
    ticksR.forEach((tk, i) => {
      const a = clamp(rp * 60 - i);
      const lit = t > RW[0] && t < RW[1] + 0.4 ? Math.max(0, 1 - ((lap - ((i + 45) % 60) + 60) % 60) / 9) : 0;
      tk.setAttribute('opacity', (a * (0.4 + 0.6 * lit) * out).toFixed(3));
    });
    const cOn = seg(t, RW[0] + 0.1, RW[0] + 0.35) * out;
    for (let i = 0; i < 16; i++) {
      const a = ang - i * clamp(0.02 + spd * 0.0024, 0.02, 0.1);
      const [x, y] = ringPt(a, 1.02);
      const front = Math.sin(a) > 0;
      const alpha = cOn * (i ? 0.75 * (1 - i / 16) : 1);
      [[cometB[i], !front], [cometF[i], front]].forEach(([c, show]) => { c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('opacity', show ? alpha.toFixed(3) : 0); });
    }
    const secs = Math.round(q * 7 * 60);
    const s = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    if (s !== timerLast) { timerT.textContent = s; timerLast = s; }
  }
  tl.fromTo('#timerChip', { opacity: 0, y: -10, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, RW[0]);
  tl.fromTo('#timerChip', { boxShadow: '0 0 0 0px rgba(123,47,168,0.4)' }, { keyframes: [{ boxShadow: '0 0 0 8px rgba(123,47,168,0.25)', duration: 0.12 }, { boxShadow: '0 0 0 14px rgba(123,47,168,0)', duration: 0.35 }], immediateRender: false }, RW[1]);
  tl.to(['#subjectClip', '#timerChip', '#ringBack', '#ringFront'], { opacity: 0, duration: 0.28, ease: 'power1.in' }, S2.dissolve);

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
  tl.to('#big7', { x: 150 - 780 - 18, y: 356 - 170 - 50, scale: 0.13, duration: RS[1] - RS[0] - 0.1, ease: 'power3.inOut', transformOrigin: '0% 0%', immediateRender: false }, RS[0] - 0.02);
  tl.to('#big7', { opacity: 0, duration: 0.2 }, RS[1] - 0.2);
  tl.fromTo(tSmall7, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, RS[1] - 0.22);
  tl.fromTo('#tSrcRule', { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.inOut' }, 7.6);
  tl.fromTo(tSrc, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 7.66);
  tl.to([tEvery, tSmall7, tMin, tSub, tSrc], { x: '-=160', opacity: 0, filter: 'blur(14px)', duration: 0.42, ease: 'power3.in', stagger: 0.03 }, S3.typeOut);

  /* ======================================================================
     3 · ONE OF MANY
     ====================================================================== */
  const MK = 0.7, MX = 1070, MY = 313;
  const mapPt = (x, y) => [MX + x * MK, MY + y * MK];
  const DOT_R = 6.77 * MK;
  const herMap = mapPt(NG.her[0], NG.her[1]);
  const lostMap = mapPt(NG.lost[0], NG.lost[1]);
  const mdots = NG.dots.map(([x, y], i) => { const [sx, sy] = mapPt(x, y); return { x: sx, y: sy, i, her: Math.abs(x - NG.her[0]) < 0.5 && Math.abs(y - NG.her[1]) < 0.5, lost: Math.abs(x - NG.lost[0]) < 0.5 && Math.abs(y - NG.lost[1]) < 0.5 }; });
  const pts = PARTS.pts.map(([x, y, r, col], i) => ({ x, y, r, rgb: hexRgb(col), i }));
  const rowKey = (p) => Math.floor(p.y / 34) * 5000 + p.x;
  const pSorted = [...pts].sort((a, b) => rowKey(a) - rowKey(b));
  const mSorted = [...mdots].sort((a, b) => rowKey(a) - rowKey(b));
  const herP = pts[PARTS.her];
  const herM = mdots.find((m) => m.her);
  const pairs = [];
  const usedM = new Set([herM.i]);
  let mi = 0;
  let spare = 0;
  for (const p of pSorted) {
    if (p === herP) continue;
    while (mi < mSorted.length && usedM.has(mSorted[mi].i)) mi++;
    if (mi < mSorted.length) { usedM.add(mSorted[mi].i); pairs.push({ p, m: mSorted[mi] }); }
    else { pairs.push({ p, m: mSorted[Math.floor(hash(spare++, 41) * mSorted.length)], spare: true }); }
  }
  const extraM = mdots.filter((m) => !usedM.has(m.i));
  const END_RGB = hexRgb('#8e57b8');
  const FLY = S3.fly;
  const flight = pairs.map(({ p, m, spare: sp }, k) => {
    const dx = m.x - p.x, dy = m.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const sw = (hash(k, 3) - 0.5) * 2 * (60 + 160 * hash(k, 4));
    return { p, m, cx: (p.x + m.x) / 2 - (dy / len) * sw + (hash(k, 5) - 0.5) * 40, cy: (p.y + m.y) / 2 + (dx / len) * sw + (hash(k, 6) - 0.5) * 40, d0: FLY[0] + 0.05 + 0.85 * hash(k, 7), dur: 0.9 + 0.35 * hash(k, 8), lost: m.lost && !sp, spare: !!sp };
  });
  const partsCv = $('#parts');
  partsCv.width = W * DPR; partsCv.height = H * DPR;
  const pctx = partsCv.getContext('2d');
  const cam3 = track([
    { t: 0, s: 1, x: CX, y: CY },
    { t: S4.dive[0], s: 1.02, x: CX + 6, y: CY - 3, e: 'sine.inOut' },
    { t: S4.dive[1], s: 30 / DOT_R, x: herMap[0], y: herMap[1], e: 'power3.inOut' },
  ]);
  const cam3El = $('#cam3');
  const outline3 = $('#outline3');
  outline3.setAttribute('d', NG.outline);
  outline3.setAttribute('transform', `translate(${MX} ${MY}) scale(${MK})`);
  outline3.setAttribute('stroke-width', (1.4 / MK).toFixed(2));
  const OUTL = outline3.getTotalLength();
  outline3.style.strokeDasharray = `${OUTL} ${OUTL}`;
  $('#lostRing').setAttribute('cx', lostMap[0]); $('#lostRing').setAttribute('cy', lostMap[1]);
  $('#lostRipple').setAttribute('cx', lostMap[0]); $('#lostRipple').setAttribute('cy', lostMap[1]);
  const her3 = $('#her3');
  const qb = (a, c, b, u) => { const v = 1 - u; return v * v * a + 2 * v * u * c + u * u * b; };
  function renderS3(t) {
    const c0 = cam3(t);
    const c = { s: c0.s * punch(t), x: c0.x, y: c0.y };
    cam3El.setAttribute('transform', camTsvg(c));
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, partsCv.width, partsCv.height);
    pctx.setTransform(DPR * c.s, 0, 0, DPR * c.s, DPR * (CX - c.s * c.x), DPR * (CY - c.s * c.y));
    const fadeIn = seg(t, S2.dissolve - 0.06, S2.dissolve + 0.12);
    const dive = seg(t, S4.dive[0], S4.dive[0] + 0.55, 'power2.in');
    const lostOut = seg(t, S3.lost, S3.lost + 0.7, 'power2.out');
    for (let k = 0; k < flight.length; k++) {
      const f = flight[k];
      const u = ease('power3.inOut')(clamp((t - f.d0) / f.dur));
      const ub = ease('power3.inOut')(clamp((t - 0.022 - f.d0) / f.dur));
      const x = qb(f.p.x, f.cx, f.m.x, u), y = qb(f.p.y, f.cy, f.m.y, u);
      const r = lerp(f.p.r, DOT_R, u);
      const col = [0, 1, 2].map((j) => Math.round(lerp(f.p.rgb[j], END_RGB[j], clamp(u * 1.3))));
      let a = fadeIn * lerp(1, 0.55 * (0.75 + 0.25 * Math.sin(t * 2 + k)), clamp(u * 1.2)) * (1 - dive);
      if (f.lost) a *= 1 - lostOut;
      if (f.spare) a *= 1 - clamp((u - 0.55) / 0.35);
      if (a < 0.004) continue;
      pctx.globalAlpha = a;
      pctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      const vx = x - qb(f.p.x, f.cx, f.m.x, ub), vy = y - qb(f.p.y, f.cy, f.m.y, ub);
      if (Math.hypot(vx, vy) > r * 0.8) {
        pctx.strokeStyle = pctx.fillStyle; pctx.lineWidth = r * 2; pctx.lineCap = 'round';
        pctx.beginPath(); pctx.moveTo(x - vx * 1.6, y - vy * 1.6); pctx.lineTo(x, y); pctx.stroke();
      } else { pctx.beginPath(); pctx.arc(x, y, r, 0, TAU); pctx.fill(); }
    }
    const ex = seg(t, FLY[1] - 0.5, FLY[1] + 0.3) * (1 - dive);
    if (ex > 0) { pctx.globalAlpha = ex * 0.5; pctx.fillStyle = 'rgb(142,87,184)'; for (const m of extraM) { pctx.beginPath(); pctx.arc(m.x, m.y, DOT_R, 0, TAU); pctx.fill(); } }
    pctx.globalAlpha = 1;
    partsCv.style.filter = dive > 0.02 ? `blur(${(dive * 6).toFixed(2)}px)` : 'none';
    const hu = ease('power3.inOut')(clamp((t - (FLY[0] + 0.35)) / 1.35));
    const hx = qb(herP.x, (herP.x + herM.x) / 2 + 40, herM.x, hu), hy = qb(herP.y, (herP.y + herM.y) / 2 - 120, herM.y, hu);
    const hk = (t >= S2.dissolve ? 1 : 0) * (1 + 0.25 * bump(t, S3.lost + 0.28, 0.08) + 0.05 * Math.sin(t * 2.4));
    her3.setAttribute('transform', `translate(${hx.toFixed(1)} ${hy.toFixed(1)}) scale(${(hk * lerp(1.5, 1, hu)).toFixed(3)})`);
    const wide = 1 - seg(t, S4.dive[0], S4.dive[0] + 0.4, 'power2.in');
    outline3.style.strokeDashoffset = (OUTL * (1 - seg(t, S3.outline[0], S3.outline[1], 'power2.inOut'))).toFixed(1);
    outline3.setAttribute('opacity', wide.toFixed(3));
    $('#lostRing').setAttribute('opacity', (lostOut * 0.85 * wide).toFixed(3));
    const rip = clamp((t - S3.lost) / 1.3);
    $('#lostRipple').setAttribute('r', (DOT_R * (1 + 6 * ease('expo.out')(rip))).toFixed(2));
    $('#lostRipple').setAttribute('opacity', (t >= S3.lost ? 0.6 * (1 - rip) * wide : 0).toFixed(3));
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
  const headEl = $('#headB');
  const pulseEls = [$('#pulseGlow'), $('#pulseCore')];
  const sparks = Array.from({ length: 22 }, (_, i) => el('circle', { r: 2 + (i % 3), fill: i % 4 === 0 ? '#7b2fa8' : '#b98bd6', opacity: 0 }, $('#sparks')));
  const SOCKETS = [[800, 0, S5.toPhone[1] - 0.05], [1200, 0, S6.surge[0]], [1910, 0, S6.surge[1] - 0.05]].map(([x, y, t0]) => {
    const g = el('g', { transform: `translate(${x} ${y}) scale(0)` }, $('#sockets'));
    el('circle', { r: 18, fill: 'rgb(185 139 214 / 0.35)' }, g);
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
  tl.fromTo('#tile0', { boxShadow: 'inset 0 0 0 1.5px #efe6f6' }, { keyframes: [{ boxShadow: 'inset 0 0 0 2.5px #d6483f', duration: 0.2 }, { boxShadow: 'inset 0 0 0 1.5px #efe6f6', duration: 0.9 }], immediateRender: false }, redAt + 0.2);
  tl.fromTo('#toast', { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, redAt + 0.15);
  tl.to('#toast', { x: 30, opacity: 0, duration: 0.35, ease: 'power2.in' }, redAt + 1.7);
  const odo = (id, seq) => { const e = document.getElementById(id); e.innerHTML = seq.map((n) => `<span>${n}</span>`).join(''); };
  odo('n0', [0, 1, 0]); odo('n1', [0, 1]); odo('n2', [0, 1]);
  tl.fromTo('#n0', { y: 0 }, { y: -44, duration: 0.45, ease: 'back.out(2)' }, redAt + 0.22);
  tl.to('#n0', { y: -88, duration: 0.45, ease: 'back.out(2)' }, claimAt + 0.1);
  tl.fromTo('#n1', { y: 0 }, { y: -44, duration: 0.45, ease: 'back.out(2)' }, claimAt + 0.14);
  tl.fromTo('#n2', { y: 0 }, { y: -44, duration: 0.45, ease: 'back.out(2)' }, cs.referral + 0.08);
  tl.fromTo('#tile2', { boxShadow: 'inset 0 0 0 1.5px #efe6f6' }, { keyframes: [{ boxShadow: 'inset 0 0 0 2.5px #3f9142', duration: 0.2 }, { boxShadow: 'inset 0 0 0 1.5px #efe6f6', duration: 0.9 }], immediateRender: false }, cs.referral + 0.1);
  // the cursor: hover, then claim on "alerted"
  const BTN = [1910 + 210 + 30 + (1180 - 210 - 60) - 18 - 43, -360 + 392];
  const cc = camB(claimAt);
  const btnScreen = [CX + cc.s * (BTN[0] - cc.x), CY + cc.s * (BTN[1] - cc.y)];
  tl.fromTo('#cursor', { x: 1760, y: 1030, opacity: 0 }, { x: 1600, y: 860, opacity: 1, duration: 0.35, ease: 'power2.out' }, cs.cursorIn);
  tl.to('#cursor', { x: btnScreen[0] - 6, y: btnScreen[1] - 4, duration: claimAt - cs.cursorIn - 0.5, ease: 'power3.inOut' }, cs.cursorIn + 0.35);
  tl.fromTo('#rowA', { backgroundColor: '#ffffff' }, { backgroundColor: '#fbf7fd', duration: 0.25, immediateRender: false }, claimAt - 0.55);
  tl.to('#btnClaim', { backgroundColor: '#6a2791', scale: 1.04, duration: 0.2 }, claimAt - 0.3);
  tl.to('#cursor', { scale: 0.86, duration: 0.08, ease: 'power2.in', transformOrigin: '10% 10%' }, claimAt - 0.02);
  tl.to('#cursor', { scale: 1, duration: 0.25, ease: 'back.out(3)' }, claimAt + 0.08);
  tl.fromTo('#clickRing', { left: btnScreen[0], top: btnScreen[1], scale: 0.5, opacity: 0.9 }, { scale: 1.9, opacity: 0, duration: 0.6, ease: 'expo.out', immediateRender: false }, claimAt);
  tl.to('#btnClaim', { scale: 0.93, duration: 0.08, ease: 'power2.in' }, claimAt - 0.02);
  tl.to('#btnClaim', { scale: 1, backgroundColor: '#f4edf9', color: '#52276e', boxShadow: 'inset 0 0 0 1.5px #e4d4f0', duration: 0.35, ease: 'back.out(2)' }, claimAt + 0.06);
  tl.set('#btnClaim', { textContent: 'Claimed · Nurse Grace' }, claimAt + 0.06);
  tl.to('#pillA', { opacity: 0, scale: 0.8, duration: 0.3 }, claimAt + 0.2);
  tl.to('#redGlow', { opacity: 0, duration: 0.4 }, claimAt + 0.2);
  tl.fromTo('#refA', { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' }, cs.referral);
  // her profile slides in from the right edge of the frame as she is claimed
  tl.fromTo('#drawer', { opacity: 0, x: 700, filter: 'blur(12px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, claimAt + 0.12);
  $$('#drawer .dwHead, #drawer .dwStatus, #drawer .dwCap, #drawer .tlItem').forEach((e, i) => tl.fromTo(e, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, claimAt + 0.3 + i * 0.06));
  tl.set('#dwStatusT', { textContent: 'Referred to care' }, cs.referral + 0.05);
  tl.fromTo('#dwStatus', { backgroundColor: '#f4edf9' }, { keyframes: [{ backgroundColor: '#e7f3e7', duration: 0.2 }, { backgroundColor: '#e7f3e7', duration: 1 }] }, cs.referral + 0.05);
  tl.fromTo('#tlRef', { scale: 1 }, { keyframes: [{ scale: 1.04, duration: 0.15 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' }], transformOrigin: '0% 50%', immediateRender: false }, cs.referral + 0.1);
  tl.to('#cursor', { x: '+=60', y: '+=90', opacity: 0, duration: 0.5, ease: 'power2.in' }, cs.referral + 0.1);
  burst(claimAt + 0.02, btnScreen[0], btnScreen[1], 14, 0.9);

  const streaks = Array.from({ length: 9 }, (_, i) => {
    const d = document.createElement('div');
    d.className = 'streak';
    d.style.top = `${Math.round(120 + hash(i, 11) * 840)}px`;
    d.style.width = `${Math.round(260 + hash(i, 12) * 520)}px`;
    d.style.opacity = '0';
    $('#streaks').appendChild(d);
    return d;
  });
  function renderStreaks(t) {
    const [a, b] = S7.toConsole;
    const env = bell(t, a - 0.04, b + 0.04);
    streaks.forEach((s, i) => {
      const x = lerp(W + 200, -900, clamp((t - a + 0.04 + hash(i, 13) * 0.08) / (b - a + 0.08)));
      s.style.transform = `translateX(${x.toFixed(1)}px)`;
      s.style.opacity = (env * (0.35 + 0.55 * hash(i, 14))).toFixed(3);
    });
  }

  /* ---------- 8 · she reaches care: an artwork, not a photograph in a circle ----------
     Dots stream out of her orange dot and settle into a halftone of mother and baby; the
     halftone resolves into the graded photograph and stays over it as texture; at the close
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
  const DOT_RGB = hexRgb('#7b2fa8');
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
  const WORDMARK = 'M792 192L816 193L833 198L851 209L868 229L867 232L843 244L833 231L818 222L807 219L786 220L776 223L764 230L759 236L757 236L757 238L752 242L749 249L747 250L741 270L742 297L745 307L753 321L767 334L787 342L811 342L830 333L840 323L842 318L868 330L868 333L865 335L862 341L845 357L823 367L804 370L784 369L767 365L750 357L740 348L738 348L726 335L721 325L719 324L713 309L710 293L710 268L713 253L720 236L729 223L744 209L757 201L773 195ZM299 196L329 196L329 265L418 265L418 196L449 196L449 367L418 367L419 292L329 292L329 367L299 367ZM530 240L556 241L571 247L587 261L592 271L594 272L599 286L601 314L505 314L508 326L512 333L520 341L529 346L538 348L558 347L569 343L577 336L581 335L589 348L592 350L592 353L583 360L564 368L553 370L532 370L507 362L489 346L482 334L479 325L477 314L477 296L480 282L486 269L491 264L491 262L507 248ZM687 240L695 240L695 266L680 266L673 268L662 274L655 281L655 367L627 367L627 243L655 243L654 260L656 260L656 258L669 247ZM937 240L959 240L982 248L988 252L1001 266L1010 287L1012 302L1011 318L1007 332L1002 342L985 360L964 369L938 370L922 366L912 361L897 347L893 341L885 320L884 296L886 285L892 270L900 261L900 259L909 251L924 243ZM1207 240L1230 240L1243 243L1259 252L1266 261L1271 282L1271 367L1243 367L1243 354L1235 362L1225 367L1213 370L1196 370L1179 364L1165 350L1160 334L1161 317L1167 304L1177 295L1192 289L1217 289L1235 296L1243 303L1243 279L1240 273L1232 266L1223 263L1205 263L1189 269L1179 278L1177 278L1169 263L1167 262L1167 259L1178 250L1193 243ZM1021 243L1050 243L1085 335L1087 334L1091 324L1092 318L1100 301L1121 244L1151 243L1100 367L1070 366ZM534 262L521 266L513 273L507 283L505 294L575 294L573 283L562 268L552 263ZM941 264L928 269L918 280L913 292L912 312L918 330L928 341L940 346L955 346L969 340L977 331L983 315L983 295L977 279L969 270L956 264ZM1208 307L1197 311L1191 316L1187 326L1187 332L1190 341L1196 347L1202 350L1213 352L1228 350L1238 345L1244 337L1243 318L1236 312L1227 308Z';
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
  const sheenClip = el('clipPath', { id: 'sheenClip', clipPathUnits: 'userSpaceOnUse' }, ldefs);
  el('path', { d: WORDMARK }, sheenClip);
  const sheen = el('rect', { x: 0, y: 150, width: 220, height: 260, fill: 'url(#sheenGrad)', transform: 'skewX(-18)' }, el('g', { 'clip-path': 'url(#sheenClip)' }, lettersG));
  tl.fromTo(sheen, { attr: { x: 160 } }, { attr: { x: 1440 }, duration: 1.1, ease: 'power2.inOut' }, S9.sheen);
  const vo5 = words('vo5');
  const TAG = ['Care', 'that', 'reaches', 'her', 'anywhere.'];
  $('#tagline').innerHTML = TAG.map((w, i) => `<span class="w${i === 4 ? ' accent' : ''}">${w}</span>`).join('');
  $$('#tagline .w').forEach((w, i) => tl.fromTo(w, { y: 40, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out' }, (vo5[i] ? vo5[i].at : S9.letters + 0.5 + i * 0.1) - 0.08));
  tl.fromTo('#domain', { opacity: 0, letterSpacing: '0.5em' }, { opacity: 1, letterSpacing: '0.28em', duration: 0.9, ease: 'power3.out' }, S9.domain);
  // the line signs off under the tagline; a faint Nigeria sits at the edge of the frame
  const sig = $('#sigLine'); const SGL = sig.getTotalLength(); sig.style.strokeDasharray = `${SGL} ${SGL}`;
  tl.fromTo(sig, { strokeDashoffset: SGL }, { strokeDashoffset: 0, duration: 0.8, ease: 'power3.inOut' }, S9.domain - 0.35);
  tl.fromTo('#sigDot', { opacity: 0, scale: 0, svgOrigin: '1220 770' }, { opacity: 1, scale: 1, svgOrigin: '1220 770', duration: POP.duration, ease: POP.ease }, S9.domain + 0.35);
  const endCv = $('#endMap');
  endCv.width = W * DPR; endCv.height = H * DPR;
  const ectx = endCv.getContext('2d');
  ectx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ectx.fillStyle = '#7b2fa8';
  NG.dots.forEach(([x, y]) => { ectx.globalAlpha = 0.12; ectx.beginPath(); ectx.arc(1500 + x * 0.7, 250 + y * 0.7, 3.1, 0, TAU); ectx.fill(); });
  ectx.globalAlpha = 1; ectx.fillStyle = '#ee7b1e';
  ectx.beginPath(); ectx.arc(1500 + NG.her[0] * 0.7, 250 + NG.her[1] * 0.7, 4.6, 0, TAU); ectx.fill();
  tl.fromTo(endCv, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 1.4, ease: 'power3.out' }, S9.handoff + 0.8);
  tl.fromTo('#logoSvg', { scale: 1 }, { scale: 1.018, duration: T.duration - S9.lockup[1], ease: 'sine.inOut', transformOrigin: '50% 40%' }, S9.lockup[1]);

  /* ======================================================================
     FILM TEXTURE
     ====================================================================== */
  const dustCv = $('#dust');
  dustCv.width = W * DPR; dustCv.height = H * DPR;
  const dctx = dustCv.getContext('2d');
  const DUST = Array.from({ length: 150 }, (_, i) => ({ x: hash(i, 21) * W * 1.3 - W * 0.15, y: hash(i, 22) * H * 1.3 - H * 0.15, d: 0.2 + 0.8 * hash(i, 23), ph: hash(i, 24) * TAU, vx: 4 + 10 * hash(i, 25), vy: -3 - 6 * hash(i, 26) }));
  function drawDust(t) {
    dctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    dctx.clearRect(0, 0, W, H);
    const b = camB(clamp(t, S5.handoff - 0.05, S8.flyHome[1]));
    const fade = seg(t, 0.1, 1.2);
    for (const p of DUST) {
      const fB = 1 + (b.s - 1) * 0.35 * p.d;
      let x = p.x + p.vx * t - b.x * 0.2 * p.d, y = p.y + p.vy * t - b.y * 0.2 * p.d;
      const sx = W * 1.3, sy = H * 1.3;
      x = ((((x + W * 0.15) % sx) + sx) % sx) - W * 0.15;
      y = ((((y + H * 0.15) % sy) + sy) % sy) - H * 0.15;
      x = CX + (x - CX) * fB; y = CY + (y - CY) * fB;
      const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + p.d) + p.ph);
      const big = p.d > 0.9;
      if (big) {
        const r = 14 + 10 * p.d;
        const g = dctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(201,162,236,0.22)'); g.addColorStop(1, 'rgba(201,162,236,0)');
        dctx.globalAlpha = tw * fade;
        dctx.fillStyle = g;
        dctx.beginPath(); dctx.arc(x, y, r, 0, TAU); dctx.fill();
        continue;
      }
      dctx.globalAlpha = (0.1 + 0.28 * p.d) * tw * fade;
      dctx.fillStyle = '#8e57b8';
      dctx.beginPath(); dctx.arc(x, y, 0.7 + 1.6 * p.d * p.d, 0, TAU); dctx.fill();
    }
    dctx.globalAlpha = 1;
  }
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
      d[i] = 70; d[i + 1] = 40; d[i + 2] = 90;
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
    if (t < 3.8) { renderS1(t); renderLabel(t); }
    if (t > 2.4 && t < 6.9) renderS2(t);
    if (t > 6.0 && t < 10.3) renderS3(t);
    if (t > S5.handoff - 0.1 && t < S9.handoff + 0.3) renderB(t);
    if (t > 16.2 && t < 17.3) renderStreaks(t);
    if (t > S8.bloom[0] - 0.1 && t < S8.close[1] + 0.25) renderS8(t);
    if (t > S9.handoff - 0.2) renderLogo(t);
    renderHud(t);
    drawGrid(t);
    renderBursts(t);
    drawDust(t);
    drawGrain(t);
  }
  const clock = { t: 0 };
  tl.fromTo(clock, { t: 0 }, { t: T.duration, duration: T.duration, ease: 'none', onUpdate: () => renderAll(clock.t) }, 0);
  renderB(S5.handoff);
  renderAll(0);
  return tl;
};
