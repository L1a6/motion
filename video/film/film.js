/*
 * HerCova — "Care that reaches her". The film's one paused timeline.
 *
 * The grammar is the Spotify spot's: one continuous dark world lit by big soft lilac lights that relocate with
 * every section; one subject at a time; small, sharp type; depth of field; motion blur only on the fast moves.
 * The four references sit inside it: the fluted glass (16-9.mp4), the word drum (List-16-9), the liquid-glass
 * testimonial (16-10, rebuilt to its keyframes) and the end sting (Scene).
 *
 * Technique map:
 *   whip pan ............ open → phone (vertical), type → fluted glass (horizontal), glass → drum (vertical)
 *   crash zoom .......... the dive through the dynamic island (3D); into the plate's light before the mark
 *   shape morph ......... the island → live activity (3D screen); the tab pill; text → dot → pill → dot → full stop
 *   match cut ........... island (black) → the dark app world; whip directions carried across every cut
 *   vignette comp + warp  every crash zoom: barrel warp (SVG displacement) + vignette, exposure lifted after
 *   expression timing ... spring() and cubic-bezier eases lifted from the references' graph curves; light drift
 *   liquid text morph ... the fluted-glass words melt through an alpha threshold (goo)
 *   glass-morphism ...... the testimonial (blurred-photo glass with a jelly bounce), the alert and claim cards
 *   elastic text ........ the drum's active word, ".com"
 *   trim paths .......... the arrow, the ticks, the claim check
 *   null objects ........ #uRig, #cLens, #oLens, #tPlate rigs; the 3D nulls in film/gl.js
 *   3D .................. the mark (twice) and the titanium phone (film/gl.js); the CSS-3D word drum
 */
window.__buildHercova = function () {
  'use strict';
  const T = window.HC_T;
  const S = T.S;
  const B = T.bar;
  const tl = gsap.timeline({ paused: true });
  const RIBDRAW = { p: 0 }; // how much of the neon ribbon has drawn itself (from the centre outward)
  const $ = (s) => document.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const NS = 'http://www.w3.org/2000/svg';
  // LIVE = the Studio preview in a normal browser; the render runs under webdriver and always gets full quality.
  // On modest GPUs the preview drops the heaviest SVG filters (warps, whip blurs) and softens the ribbon with a
  // GPU blur instead, so playback never stalls. Motion and timing are identical.
  const LIVE = navigator.webdriver !== true;
  if (LIVE) {
    ['#rb0', '#rb1'].forEach((id) => $(id).removeAttribute('filter'));
    $('#oRib').style.filter = 'blur(30px)';
  }

  // ---- curves from the graph editor
  function springEase(k, c) {
    const w0 = Math.sqrt(k), z = c / (2 * Math.sqrt(k));
    const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
    const D = Math.log(1000) / (z * w0);
    return (p) => {
      if (p >= 1) return 1;
      const s = p * D;
      return 1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + ((z * w0) / wd) * Math.sin(wd * s));
    };
  }
  // a Lottie/After Effects keyframe bezier (out tangent x1,y1; in tangent x2,y2) as an ease
  function bez(x1, y1, x2, y2) {
    const bx = (t) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
    const by = (t) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
    return (p) => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let lo = 0, hi = 1, t = p;
      for (let i = 0; i < 30; i++) {
        t = (lo + hi) / 2;
        if (bx(t) < p) lo = t; else hi = t;
      }
      return by(t);
    };
  }
  const bounce = springEase(150, 11);
  const settle = springEase(120, 16);
  const snap = springEase(260, 15);
  const SWIFT = bez(0.5, 0, 0, 1); // 16-10's main curve: a long, fast-out settle

  // ---- split helpers (build time)
  function chars(el, txt = el.textContent) {
    el.textContent = '';
    return Array.from(txt).map((c) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      el.appendChild(s);
      return s;
    });
  }
  function riseWords(els, t0, { stagger = 0.06, y = 34, blur = 10, dur = 0.8, ease = 'expo.out', x = 0 } = {}) {
    tl.fromTo(els, { opacity: 0, x, y, filter: `blur(${blur}px)` }, { opacity: 1, x: 0, y: 0, filter: 'blur(0px)', duration: dur, ease, stagger }, t0);
  }
  function drawPath(el, t0, dur, ease = 'power2.inOut') {
    const len = el.getTotalLength ? el.getTotalLength() : 1000;
    el.style.strokeDasharray = `${len}`;
    tl.fromTo(el, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease }, t0);
  }
  // whip pan: the strip moves as one with a directional shutter blur that peaks at mid-swing
  function whip(axis, t0, dur, outs, ins, dist) {
    const prop = axis === 'x' ? 'x' : 'y';
    const blurEl = axis === 'x' ? '#whipX' : '#whipY';
    const filt = axis === 'x' ? 'url(#fWhipX)' : 'url(#fWhipY)';
    const all = [...outs, ...ins];
    if (!LIVE) tl.set(all, { filter: filt }, t0);
    if (outs.length) tl.fromTo(outs, { [prop]: 0 }, { [prop]: -dist, duration: dur, ease: 'power4.inOut', immediateRender: false }, t0);
    if (ins.length) tl.fromTo(ins, { [prop]: dist }, { [prop]: 0, duration: dur, ease: 'power4.inOut' }, t0);
    const peak = axis === 'x' ? '120 0' : '0 120';
    tl.fromTo(blurEl, { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: peak }, duration: dur / 2, ease: 'power3.in', immediateRender: false }, t0);
    tl.fromTo(blurEl, { attr: { stdDeviation: peak } }, { attr: { stdDeviation: '0 0' }, duration: dur / 2, ease: 'power3.out', immediateRender: false }, t0 + dur / 2);
    if (!LIVE) tl.set(all, { filter: 'none' }, t0 + dur + 0.01);
  }
  function vignette(t0, t1, peak) {
    tl.fromTo('#vig', { opacity: 0 }, { opacity: peak, duration: t1 - t0, ease: 'power2.in', immediateRender: false }, t0);
    tl.fromTo('#vig', { opacity: peak }, { opacity: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, t1);
  }
  // the lights: each section relocates them (a slow, eased move), frame() adds a breathing drift
  const LIGHTS = ['#bl1', '#bl2', '#bl3'];
  const lightState = { '#bl1': { x: 1650, y: 1000, scale: 0.8, opacity: 0 }, '#bl2': { x: 1500, y: 300, scale: 0.8, opacity: 0 }, '#bl3': { x: 140, y: 40, scale: 0.9, opacity: 0 } };
  function light(t0, dur, cfg, ease = 'power2.inOut') {
    LIGHTS.forEach((id, i) => {
      if (!cfg[i]) return;
      const from = { ...lightState[id] };
      const to = { ...from, ...cfg[i] };
      tl.fromTo(id, from, { ...to, duration: dur, ease, immediateRender: t0 === 0 }, t0);
      lightState[id] = to;
    });
  }

  // ================================================================ 0 · the hook (0 → 10.6): animation.mp4's first ten seconds, in lilac
  // 0.0–2.8 · a white page: one word at a time, the line re-centring as it grows; the accent word slides in lilac
  tl.fromTo('#ow1', { opacity: 0, scale: 1.1, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: SWIFT }, 0.12);
  tl.fromTo('#ow1', { x: 0 }, { x: -14, duration: 1.18, ease: 'none' }, 0.12);
  tl.fromTo('#ow1', { x: -14, opacity: 1, filter: 'blur(0px)' }, { x: -80, opacity: 0, filter: 'blur(14px)', duration: 0.3, ease: 'power2.in', immediateRender: false }, 1.3);
  tl.fromTo('#ow2', { opacity: 0, y: 26, x: 103.75, filter: 'blur(10px)' }, { opacity: 1, y: 0, x: 103.75, filter: 'blur(0px)', duration: 0.5, ease: SWIFT }, 1.48);
  tl.fromTo('#ow2', { x: 103.75 }, { x: 0, duration: 0.6, ease: SWIFT, immediateRender: false }, 1.95);
  tl.fromTo('#ow3', { opacity: 0, x: 90, filter: 'blur(14px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.6, ease: SWIFT }, 1.95);
  tl.fromTo('#ow2', { opacity: 1, filter: 'blur(0px)', x: 0 }, { opacity: 0, filter: 'blur(12px)', x: -90, duration: 0.24, ease: 'power2.in', immediateRender: false }, 2.48);
  tl.fromTo('#ow3', { x: 0 }, { x: -64.4, duration: 0.45, ease: SWIFT, immediateRender: false }, 2.56);
  // 2.85 · no cut: the white page shrinks around "HerCova" into the card; the guides close in from the frame's edges
  // and the neon ribbon draws itself out into the dark
  const G = { l: 0, r: 1920, t: 0, b: 1080 };
  tl.fromTo('#oPaper', { clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: 'inset(410px 740px 410px 740px round 22px)', duration: 0.6, ease: 'expo.inOut' }, 2.85);
  tl.fromTo(G, { l: 0, r: 1920, t: 0, b: 1080 }, { l: 740, r: 1180, t: 410, b: 670, duration: 0.6, ease: 'expo.inOut' }, 2.85);
  tl.fromTo('#oGuides', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, 2.9);
  tl.fromTo('#oRib', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 3.05);
  tl.fromTo(RIBDRAW, { p: 0 }, { p: 1, duration: 0.7, ease: 'power2.out' }, 3.05);
  tl.fromTo('#ow3', { opacity: 1, filter: 'blur(0px)', scale: 1 }, { opacity: 0, filter: 'blur(8px)', scale: 0.92, duration: 0.28, ease: 'power2.in', immediateRender: false }, 3.32);
  tl.set('#oCardTint', { opacity: 0 }, 0);
  tl.fromTo('#oCard', { opacity: 0 }, { opacity: 1, duration: 0.01, ease: 'none' }, 3.44);
  tl.set('#oPaper', { opacity: 0 }, 3.46);
  tl.fromTo('#oCardTxt', { opacity: 0, y: 10, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: SWIFT }, 3.62);
  // 4.0 → 7.8 · the screen wall (animation.mp4, 3–9 s). Four dark screens on a 2×2 grid; the camera (a null on
  // #oWall) starts close on screen A, pans to screen B — A slides into the left of frame — then pulls back as C
  // and D rise from below into a curved 2×2 wall. Every screen keeps playing its own film the whole time.
  const CAM = (cx, cy, s) => ({ x: 750 - cx * s, y: 390 - cy * s, scale: s }); // put wall point (cx, cy) at frame centre
  const FA = CAM(372.5, 192.5, 1.7), FB = CAM(1127.5, 192.5, 1.7), FQ = CAM(750, 192.5, 1.22);
  if (!LIVE) tl.set('#oLens', { filter: 'url(#fWarpO)' }, 3.98);
  tl.fromTo('#oWall', { ...FA, transformOrigin: '0 0', opacity: 0 }, { ...FA, opacity: 1, duration: 0.06, ease: 'none' }, 4.0);
  // screen A opens out of the white card: it bulges toward the lens and widens (barrel warp grows)
  tl.fromTo('#qp1', { clipPath: 'inset(116px 243px 116px 243px round 13px)' }, { clipPath: 'inset(0px 0px 0px 0px round 18px)', duration: 0.5, ease: 'expo.inOut' }, 4.0);
  tl.fromTo('#oCard', { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.25, duration: 0.14, ease: 'power2.in', immediateRender: false }, 4.0);
  tl.fromTo(G, { l: 740, r: 1180, t: 410, b: 670 }, { l: 327, r: 1593, t: 213, b: 867, duration: 0.5, ease: 'expo.inOut', immediateRender: false }, 4.0);
  tl.fromTo('#warpO', { attr: { scale: 0 } }, { attr: { scale: 120 }, duration: 0.55, ease: 'power2.out' }, 4.0);
  vignette(4.0, 4.4, 0.55);
  tl.fromTo('#oLens', { scale: 1.1 }, { scale: 1.0, duration: 0.9, ease: SWIFT }, 4.0);
  // screen A's film: a dense lilac moodboard, tiles landing as blank cards and turning into her world, the
  // board drifting under the lens like a tracking shot
  tl.set(['#qp2', '#qp3', '#qp4'], { opacity: 0 }, 0);
  tl.fromTo('#oCollage', { scale: 0.56, x: -20, y: -18 }, { scale: 0.5, x: -40, y: -6, duration: 1.85, ease: 'none' }, 4.0);
  const TL = $$('#oCollage .tl');
  const ORDER = ['tl3', 'tl8', 'tl2', 'tl7', 'tl4', 'tl9', 'tl13', 'tl12', 'tl1', 'tl6', 'tl5', 'tl10', 'tl11', 'tl14'];
  TL.forEach((el) => {
    const t0 = 4.06 + ORDER.indexOf(el.id) * 0.035;
    tl.fromTo(el, { opacity: 0, scale: 0.82, filter: 'blur(6px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: SWIFT }, t0);
    tl.fromTo(el.querySelector('.cover'), { opacity: 1 }, { opacity: 0, duration: 0.22, ease: 'power2.out' }, t0 + 0.3);
  });
  // screen A is one calm frame: the photograph eases in and keeps drifting, the question rises line by line
  tl.fromTo('#oHeroImg', { scale: 1.16 }, { scale: 1.04, duration: 1.9, ease: 'power2.out' }, 4.0);
  tl.fromTo('#oHeroShade', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 4.1);
  tl.fromTo('#oHeroQ .w', { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: SWIFT, stagger: 0.05 }, 4.22);
  const ringP = $('#tl1 .ringp');
  ringP.style.strokeDasharray = '151';
  tl.fromTo(ringP, { strokeDashoffset: 151 }, { strokeDashoffset: 151 * 0.3, duration: 0.6, ease: SWIFT }, 4.4);
  drawPath($('#ecgP'), 4.4, 0.55, 'none');
  tl.fromTo('#tl10 .bars b', { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: bounce, stagger: 0.04 }, 4.42);
  drawPath($('#tl7Tick'), 4.48, 0.3, 'power3.out');
  tl.fromTo('#tl14 .chk i', { scale: 0 }, { scale: 1, duration: 0.4, ease: bounce, stagger: 0.08 }, 4.6);
  // the Nigeria map (tile and screen D): the outline, and pins that drop on the cities she lives in
  const NG = window.NIGERIA;
  const CITIES = [[438, 754], [59, 628], [401, 412], [487, 161], [102, 555], [402, 634], [872, 174]]; // Uyo, Lagos, Abuja, Kano, Ibadan, Enugu, Maiduguri
  $$('.ngaP').forEach((p) => p.setAttribute('d', NG.outline));
  $$('.pins').forEach((g) => {
    g.innerHTML = CITIES.map(([x, y]) => `<g transform="translate(${x} ${y})"><circle class="pr" r="30" fill="none" stroke="#7f5ac4" stroke-width="6" opacity="0"/><circle class="pd" r="22" fill="#7f5ac4" stroke="#fff" stroke-width="8"/></g>`).join('');
  });
  tl.fromTo('#tl3 .pd', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.4, ease: bounce, stagger: 0.05 }, 4.45);
  // 4.67 · the camera pans right: screen A slides into the left of frame, screen B arrives centre — its film is
  // the mark building itself (the swoosh draws and fills, the figure rises, her head drops in on a bounce)
  tl.fromTo('#qp2', { opacity: 0 }, { opacity: 1, duration: 0.05, ease: 'none' }, 4.66);
  if (!LIVE) tl.set('#oWall', { filter: 'url(#fWhipX)' }, 4.67);
  tl.fromTo('#oWall', { ...FA }, { ...FB, duration: 0.42, ease: 'power3.inOut', immediateRender: false }, 4.67);
  tl.fromTo('#whipX', { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: '80 0' }, duration: 0.21, ease: 'power3.in', immediateRender: false }, 4.67);
  tl.fromTo('#whipX', { attr: { stdDeviation: '80 0' } }, { attr: { stdDeviation: '0 0' }, duration: 0.21, ease: 'power3.out', immediateRender: false }, 4.88);
  tl.set('#oWall', { filter: 'none' }, 5.1);
  const PUR = window.HC_LOGO.P.purple, ORA = window.HC_LOGO.P.orange;
  $('#mkSw').setAttribute('d', PUR.slice(0, PUR.indexOf('Z') + 1));
  const oz = ORA.indexOf('Z') + 1;
  $('#mkBody').setAttribute('d', ORA.slice(0, oz));
  $('#mkHead').setAttribute('d', ORA.slice(oz));
  drawPath($('#mkSw'), 4.84, 0.4, 'power2.inOut');
  tl.fromTo('#mkSw', { attr: { 'fill-opacity': 0 } }, { attr: { 'fill-opacity': 1 }, duration: 0.2, ease: 'none' }, 5.08);
  tl.fromTo('#mkBody', { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.45, ease: settle }, 4.94);
  tl.fromTo('#mkHead', { opacity: 0, y: -140 }, { opacity: 1, y: 0, duration: 0.55, ease: bounce }, 5.02);
  tl.fromTo('#oWhiteIn', { scale: 1.18, rotation: -4 }, { scale: 1, rotation: 0, duration: 1.0, ease: SWIFT }, 4.7);
  // the film cuts: an iris closes it to dark; a crosshair spins in
  tl.fromTo('#oIris', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(80% at 50% 50%)', duration: 0.32, ease: 'power3.in' }, 5.28);
  tl.fromTo('#oPlus', { scale: 0, rotation: 90 }, { scale: 1, rotation: 0, duration: 0.45, ease: bounce }, 5.52);
  tl.fromTo('#oPlus', { rotation: 0 }, { rotation: 90, duration: 0.3, ease: 'power3.in', immediateRender: false }, 5.82);
  // 5.85 · the one screen becomes four: the camera pulls back, C and D rise from below, the wall bulges harder;
  // A and B cut to their next films (her check-in, her chat)
  tl.fromTo('#oWall', { ...FB }, { ...FQ, duration: 0.5, ease: 'expo.inOut', immediateRender: false }, 5.85);
  tl.fromTo(G, { l: 327, r: 1593, t: 213, b: 867 }, { l: 45, r: 1875, t: 305, b: 775, duration: 0.5, ease: 'expo.inOut', immediateRender: false }, 5.85);
  tl.fromTo('#gV', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 6.15);
  tl.fromTo('#warpO', { attr: { scale: 120 } }, { attr: { scale: 185 }, duration: 0.5, ease: 'power2.inOut', immediateRender: false }, 5.85);
  // hard cuts to each screen's next film as the camera pulls back (no crossfade)
  tl.set('#oCollageWin', { opacity: 0 }, 5.9);
  tl.set(['#oWhite', '#oIris'], { opacity: 0 }, 5.88);
  tl.fromTo('#oLens', { scale: 1 }, { scale: 1.05, duration: 1.9, ease: 'sine.inOut', immediateRender: false }, 5.9);
  //   screen A: a lilac bar sweeps in and becomes the search field; she types; chips pop; the week's bars rise
  tl.fromTo('#qSweep', { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.35, ease: SWIFT }, 6.05);
  tl.fromTo('#qSweep', { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'none', immediateRender: false }, 6.35);
  tl.fromTo('#qSearch', { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none' }, 6.3);
  const TYPED = 'Severe headache, blurry eyes';
  const typeEl = $('#qType');
  const TY = { n: 0 };
  tl.fromTo(TY, { n: 0 }, { n: TYPED.length, duration: 0.85, ease: 'none', onUpdate: () => { typeEl.textContent = TYPED.slice(0, Math.round(TY.n)); } }, 6.35);
  tl.fromTo('#qp1 .qchip', { opacity: 0, y: 20, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: bounce, stagger: 0.07 }, 6.5);
  tl.fromTo($$('#qp1 .qchip')[2], { backgroundColor: '#f4edf9', color: '#6a47ad' }, { backgroundColor: '#7f5ac4', color: '#ffffff', duration: 0.18, ease: 'none', immediateRender: false }, 7.2);
  tl.fromTo($$('#qp1 .qchip')[0], { backgroundColor: '#f4edf9', color: '#6a47ad' }, { backgroundColor: '#7f5ac4', color: '#ffffff', duration: 0.18, ease: 'none', immediateRender: false }, 7.32);
  tl.fromTo('#qBars b', { scaleY: 0 }, { scaleY: (i) => [0.45, 0.7, 0.55, 0.85, 0.6, 1, 0.75, 0.5, 0.9][i], duration: 0.6, ease: bounce, stagger: 0.05 }, 6.6);
  //   screen B: the chat thread scrolls as messages arrive
  $('#qTile').innerHTML = window.HC_LOGO.svg('mark');
  tl.fromTo(['#qTile', '#qTileN'], { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, ease: SWIFT, stagger: 0.06 }, 6.0);
  const BUBS = $$('#qChat > *');
  BUBS.forEach((b, i) => tl.fromTo(b, { opacity: 0, scale: 0.6, transformOrigin: b.classList.contains('me') ? '100% 100%' : '0% 100%' }, { opacity: 1, scale: 1, duration: 0.5, ease: bounce }, 6.1 + i * 0.28));
  tl.fromTo('#qChat', { y: 0 }, { y: -170, duration: 1.3, ease: 'power2.inOut' }, 6.7);
  //   screen C: the app tile turns in 3D while care orbits it
  $('#qApp').innerHTML = window.HC_LOGO.svg('mark');
  tl.fromTo('#qApp', { scale: 0, rotationY: -180, transformPerspective: 600 }, { scale: 1, rotationY: 0, duration: 0.8, ease: settle }, 6.15);
  tl.fromTo('.oi', { scale: 0 }, { scale: 1, duration: 0.5, ease: bounce, stagger: 0.08 }, 6.35);
  tl.fromTo('#qOrbT', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: SWIFT }, 6.7);
  //   screen D: the map draws, the pins drop city by city
  tl.fromTo('#qMap', { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: SWIFT }, 6.15);
  tl.fromTo('#qMap .pd', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: bounce, stagger: 0.11 }, 6.4);
  // 7.8 · the quad bursts toward the lens; 7.97 a white flash; the soft ribbon in the dark
  tl.fromTo('#oLens', { opacity: 1 }, { opacity: 0, duration: 0.22, ease: 'power3.in', immediateRender: false }, 7.8);
  tl.fromTo('#oWall', { ...FQ, filter: 'blur(0px)' }, { x: -450, y: 82, scale: 1.6, filter: 'blur(14px)', duration: 0.22, ease: 'power3.in', immediateRender: false }, 7.8);
  tl.set('#oRib', { opacity: 0 }, 8.0);
  tl.set('#oSoft', { opacity: 1 }, 7.97);
  tl.fromTo('#oSoftBg', { opacity: 0 }, { opacity: 1, duration: 0.05, ease: 'none' }, 7.97);
  tl.fromTo('#oSoftBg', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power2.out', immediateRender: false }, 8.06);
  // 8.3 · the line flips up word by word (3D), floats, then smears away
  const L2 = 'Imagine care that never misses a sign.'.split(' ');
  $('#oLine2').innerHTML = L2.map((w, i) => `<span class="w${i === L2.length - 1 ? ' ac' : ''}">${w}</span>`).join(' ');
  tl.fromTo('#oLine2 .w', { opacity: 0, y: 46, rotationX: -75, filter: 'blur(8px)', transformPerspective: 600, transformOrigin: '50% 100%' },
    { opacity: 1, y: 0, rotationX: 0, filter: 'blur(0px)', duration: 0.75, ease: SWIFT, stagger: 0.075 }, 8.3);
  tl.fromTo('#oLine2', { y: 0, scale: 1 }, { y: -10, scale: 1.03, duration: 1.4, ease: 'none' }, 8.3);
  if (!LIVE) tl.set('#oLine2', { filter: 'url(#fWhipX)' }, 9.72);
  tl.fromTo('#whipX', { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: '70 0' }, duration: 0.24, ease: 'power2.in', immediateRender: false }, 9.72);
  tl.fromTo('#oLine2', { x: 0, opacity: 1 }, { x: -160, opacity: 0, duration: 0.26, ease: 'power2.in', immediateRender: false }, 9.72);
  tl.set('#oLine2', { filter: 'none' }, 10.0);
  tl.set('#whipX', { attr: { stdDeviation: '0 0' } }, 10.0);
  // 10.0 · two glowing cards stack in; they fly up and out as the phone rises into the same motion
  tl.fromTo('#gc1', { opacity: 0, scale: 0.6, y: 40 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: bounce }, 10.0);
  tl.fromTo('#gc2', { opacity: 0, scale: 0.6, y: 80 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: bounce }, 10.15);
  if (!LIVE) tl.set(['#gc1', '#gc2'], { filter: 'url(#fWhipY)' }, 10.38);
  tl.fromTo(['#gc1', '#gc2'], { y: 0 }, { y: -1100, duration: 0.36, ease: 'power3.in', stagger: 0.04, immediateRender: false }, 10.38);
  tl.fromTo('#whipY', { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: '0 60' }, duration: 0.3, ease: 'power2.in', immediateRender: false }, 10.38);
  tl.set('#whipY', { attr: { stdDeviation: '0 0' } }, 10.8);
  tl.fromTo('#oSoft', { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.in', immediateRender: false }, 10.4);

  // ================================================================ 2 · the phone (10.6 → 16.525) — film/gl.js
  light(10.25, 1.2, [{ x: 960, y: 760, scale: 1.3, opacity: 0.78 }, { x: 1560, y: 260, scale: 0.9, opacity: 0.3 }, { x: 180, y: 80, scale: 1, opacity: 0.5 }]);
  // the dive through the island: the world darkens and closes around the lens
  vignette(S.phone.dive, S.ui[0], 0.9);
  light(S.phone.dive + 0.2, 1.1, [{ opacity: 0.12, scale: 1.6 }, { opacity: 0.05 }, { opacity: 0.12 }], 'power2.in');

  // ================================================================ 3 · her app, floating in the light (16.525 → 21.858)
  const U0 = S.ui[0];
  light(U0, 1.2, [{ x: 260, y: 880, scale: 1.1, opacity: 0.62 }, { x: 1560, y: 980, scale: 1.0, opacity: 0.4 }, { x: 1720, y: 110, scale: 1, opacity: 0.5 }], 'power2.out');
  tl.fromTo('#uRig', { scale: 1.28, filter: 'blur(18px)', opacity: 0 }, { scale: 1, filter: 'blur(0px)', opacity: 1, duration: 1.0, ease: 'expo.out' }, U0 - 0.05);
  tl.set('#uRig', { filter: 'none' }, U0 + 1.0);
  // the camera (a null over the whole app): close on the check-in, rack to the confirmation, pull back for the grid
  tl.fromTo('#uCam', { scale: 1.2, x: 216, y: 16 }, { scale: 1.2, x: 216, y: 16, duration: 0.01 }, U0 - 0.06);
  tl.fromTo('#uCard', { scale: 0.9 }, { scale: 1, duration: 1.0, ease: settle }, U0 - 0.05);
  tl.fromTo(['.tabs', '#uCard'], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08 }, U0);
  tl.fromTo('.uchip', { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.55, ease: bounce, stagger: 0.05 }, U0 + 0.25);
  // the tab pill: a liquid morph — the leading edge runs ahead, the trailing edge catches up on a spring
  const TABS = [[0, 112], [124, 150], [286, 118], [416, 116]];
  const selR = $('#uSelR');
  const tabEls = [0, 1, 2, 3].map((i) => $('#tb' + i));
  const OFF = 'rgba(255,255,255,0.78)';
  tabEls.forEach((e, i) => { e.style.color = i === 0 ? '#1d1d1f' : OFF; });
  let selAt = 0;
  function tabTo(i, t0) {
    const [ax, aw] = TABS[selAt], [bx, bw] = TABS[i];
    const span = { x: Math.min(ax, bx), w: Math.max(ax + aw, bx + bw) - Math.min(ax, bx) };
    tl.fromTo(selR, { attr: { x: ax, width: aw } }, { attr: { x: span.x, width: span.w }, duration: 0.2, ease: 'power2.in', immediateRender: false }, t0);
    tl.fromTo(selR, { attr: { x: span.x, width: span.w } }, { attr: { x: bx, width: bw }, duration: 0.6, ease: settle, immediateRender: false }, t0 + 0.2);
    tl.fromTo(tabEls[selAt], { color: '#1d1d1f' }, { color: OFF, duration: 0.25, ease: 'none', immediateRender: false }, t0 + 0.1);
    tl.fromTo(tabEls[i], { color: OFF }, { color: '#1d1d1f', duration: 0.25, ease: 'none', immediateRender: false }, t0 + 0.2);
    selAt = i;
  }
  tabTo(1, U0 + 0.55);
  // she taps two warning signs
  const taps = [[164, 159, U0 + 1.15], [436, 159, U0 + 1.6]];
  taps.forEach(([x, y, t0], i) => tl.fromTo('#uTap', { x, y, scale: 0.4, opacity: 0.95 }, { x, y, scale: 1.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: i === 0 }, t0));
  ['#uc1', '#uc2'].forEach((id, i) => {
    tl.fromTo(id, { scale: 0.93 }, { scale: 1, duration: 0.5, ease: bounce, immediateRender: false }, taps[i][2]);
    tl.fromTo(id + ' .on', { opacity: 0 }, { opacity: 1, duration: 0.14, ease: 'none' }, taps[i][2]);
    tl.fromTo(id, { color: '#6a47ad' }, { color: '#ffffff', duration: 0.14, ease: 'none', immediateRender: false }, taps[i][2]);
  });
  // sent: the camera racks across to the confirmation and her next visit
  const AL = U0 + 2.05;
  tl.fromTo('#uCam', { scale: 1.2, x: 216, y: 16 }, { scale: 1.2, x: -210, y: 41, duration: 1.05, ease: 'power3.inOut', immediateRender: false }, AL - 0.35);
  tl.fromTo('#uSent', { opacity: 0, x: -150, scale: 0.88, filter: 'blur(12px)' }, { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: settle }, AL);
  drawPath($('#uTick'), AL + 0.35, 0.4, 'power3.out');
  tl.fromTo('#uCard', { opacity: 1, filter: 'blur(0px)' }, { opacity: 0.55, filter: 'blur(3px)', duration: 0.6, ease: 'power2.out', immediateRender: false }, AL + 0.1);
  tabTo(2, AL + 0.6);
  tl.fromTo('#uNext', { opacity: 0, y: -50, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: settle }, AL + 0.75);
  // learn: the grid rises as the camera scrolls up through the app
  const GR = U0 + 3.35;
  tabTo(3, GR + 0.1);
  tl.fromTo('#uCam', { scale: 1.2, x: -210, y: 41 }, { scale: 1, x: 0, y: 0, duration: 1.3, ease: 'expo.inOut', immediateRender: false }, GR - 0.25);
  tl.fromTo('#uRig', { y: 0 }, { y: -340, duration: 1.6, ease: 'power3.inOut', immediateRender: false }, GR - 0.1);
  tl.fromTo(['#uGridHead', ...$$('.lc')], { opacity: 0, y: 150, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', stagger: 0.07 }, GR);
  tl.fromTo(['#uSent', '#uNext'], { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(4px)', opacity: 0.6, duration: 0.8, ease: 'power2.out', immediateRender: false }, GR + 0.3);
  // out — a shared-element transition, unhurried: the centre lesson card is chosen; the rest of the app parts and
  // defocuses around it, the card lifts toward us, its photograph dissolves into the lilac fluted glass inside the
  // card's own shape, and that glass opens out to fill the frame
  const XT = 21.0;
  const lcs = $$('.lc');
  const centre = lcs[2];
  tl.fromTo([lcs[0], lcs[1]], { x: 0, opacity: 1, filter: 'blur(0px)' }, { x: -160, opacity: 0, filter: 'blur(10px)', duration: 0.8, ease: 'power2.inOut', stagger: { each: 0.05, from: 'end' }, immediateRender: false }, XT);
  tl.fromTo([lcs[3], lcs[4]], { x: 0, opacity: 1, filter: 'blur(0px)' }, { x: 160, opacity: 0, filter: 'blur(10px)', duration: 0.8, ease: 'power2.inOut', stagger: 0.05, immediateRender: false }, XT);
  tl.fromTo(['#uGridHead', '.tabs', '#uSent', '#uNext', '#uCard'], { opacity: (i) => (i >= 2 ? 0.6 : 1) }, { opacity: 0, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, XT);
  tl.fromTo(centre, { scale: 1 }, { scale: 1.12, duration: 0.85, ease: settle, immediateRender: false }, XT);
  tl.fromTo(centre.querySelector('.lt2'), { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, XT + 0.05);
  // the glass appears inside the card (card 834,472 236x300 scaled 1.12 about its centre) as the photo dissolves
  const CARD = 'inset(454px 835.84px 290px 819.84px round 27px)';
  tl.set('#cCam', { clipPath: CARD }, XT + 0.2);
  tl.fromTo('#cCam', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.inOut', immediateRender: false }, XT + 0.22);
  tl.fromTo(centre, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.inOut', immediateRender: false }, XT + 0.22);
  // …and opens out to fill the frame
  tl.fromTo('#cCam', { clipPath: CARD }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 1.0, ease: SWIFT, immediateRender: false }, XT + 0.62);
  tl.fromTo('#cCam', { scale: 1.06 }, { scale: 1, duration: 1.3, ease: settle, immediateRender: false }, XT + 0.62);
  tl.set('#cCam', { clipPath: 'none' }, XT + 1.65);

  // ================================================================ 4 · kinetic type (13.958 → 19.292)
  const K0 = S.type[0];
  light(K0 - 0.4, 1.6, [{ x: 900, y: 640, scale: 1.15, opacity: 0.58 }, { x: 1420, y: 380, scale: 0.9, opacity: 0.34 }, { x: 260, y: 120, opacity: 0.4 }]);
  // depth for the type: a slow camera dolly through Z with a gentle tilt (never a flat card)
  tl.fromTo('#k1', { z: -260, rotationX: 14, transformPerspective: 1400 }, { z: 60, rotationX: -4, duration: 3.4, ease: 'sine.out' }, K0);
  tl.fromTo('#k2', { z: -200, rotationX: 12, rotationY: -6, transformPerspective: 1400 }, { z: 80, rotationX: -3, rotationY: 3, duration: 2.6, ease: 'sine.out' }, K0 + 3.1);
  // "Watching" arrives tracked wide and alone, then tightens as the rest of the line slides in beside it
  const k1 = $('#k1');
  k1.innerHTML = '<span id="k1a"></span><span id="k1b"> over every <span class="ac">pregnancy</span></span>';
  const k1a = chars($('#k1a'), 'Watching');
  const restW = 677.5;
  const mid = (k1a.length - 1) / 2;
  tl.fromTo(k1, { x: restW / 2 }, { x: restW / 2, duration: 0.01 }, K0);
  tl.fromTo(k1a, { x: (i) => (i - mid) * 30, opacity: 0, filter: 'blur(10px)' }, { x: (i) => (i - mid) * 30, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', stagger: 0.03 }, K0 + 0.1);
  tl.fromTo(k1a, { x: (i) => (i - mid) * 30 }, { x: 0, duration: 0.8, ease: 'expo.inOut', immediateRender: false }, K0 + 0.95);
  tl.fromTo(k1, { x: restW / 2 }, { x: 0, duration: 0.8, ease: 'expo.inOut', immediateRender: false }, K0 + 0.95);
  tl.fromTo('#k1b', { opacity: 0, x: 140, filter: 'blur(12px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, K0 + 1.55);
  // the line drifts away defocused as the next one focuses in
  const K2 = K0 + 2.95;
  tl.fromTo(k1, { opacity: 1, y: 0, filter: 'blur(0px)' }, { opacity: 0, y: -40, filter: 'blur(16px)', duration: 0.55, ease: 'power2.in', immediateRender: false }, K2);
  $('#k2').innerHTML = 'and catching the danger signs <span class="ac">early</span><span class="ac" id="kPer">.</span>';
  tl.fromTo('#k2', { opacity: 0, y: 40, filter: 'blur(16px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out' }, K2 + 0.25);
  // the full stop after "early." beats once, then grows into the deep-lilac world of her care team (shape morph →
  // match cut into the dashboard)
  const DM = S.dash[0] - 0.9;
  tl.set('#kM', { opacity: 1 }, DM);
  tl.set('#kPer', { opacity: 0 }, DM);
  tl.fromTo('#kM i', { scale: 1 }, { scale: 1.9, duration: 0.14, ease: 'power2.out' }, DM);
  tl.fromTo('#kM i', { scale: 1.9 }, { scale: 1, duration: 0.2, ease: 'power2.in', immediateRender: false }, DM + 0.14);
  tl.fromTo('#k2', { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(12px)', duration: 0.3, ease: 'power2.in', immediateRender: false }, DM + 0.3);
  tl.fromTo('#kM', { x: 0, y: 0 }, { x: -540.6, y: -24, duration: 0.6, ease: 'power3.inOut' }, DM + 0.3);
  tl.fromTo('#kM i', { scale: 1, backgroundColor: '#7f5ac4' }, { scale: 270, backgroundColor: '#7f5ac4', duration: 0.6, ease: 'expo.in', immediateRender: false }, DM + 0.34);

  // ================================================================ 5 · the fluted glass (19.292 → 29.958)
  const F0 = S.flute[0];
  // the barrel warp over live video is the heaviest effect in the film: the render (webdriver) always has it; the
  // live Studio preview skips it so playback never stalls on modest GPUs
  if (!LIVE) tl.set('#cLens', { filter: 'url(#fWarpC)' }, F0 - 0.6);
  tl.set('#cCam', { opacity: 0 }, 0);
  whip('x', S.type[0] - 0.6, 0.64, ['#cCam', '#s5'], ['#s4'], 1920);
  tl.fromTo('#cLens', { scale: 1.0 }, { scale: 1.16, duration: 5.93, ease: 'sine.inOut' }, F0);
  const morphs = ['#m1', '#m2', '#m3', '#m4'];
  const mt = [22.0, 23.3, 24.93, 26.35]; // each line as Lily says it (her phrases: 21.95, 23.42, 25.05, 26.47)
  // each line builds letter by letter — the letters flip up in 3D out of a blur, in a quick cascade — and leaves the
  // same way, flying up and away as the next line arrives; the "7" pops in deep lilac
  const MW = morphs.map((id) => chars($(id)));
  MW[0].forEach((c) => { if (c.textContent === '7') { c.style.color = '#6a47ad'; c.id = 'm7'; } });
  const charsIn = (i, t0) => {
    tl.set(morphs[i], { opacity: 1 }, t0);
    tl.fromTo(MW[i], { opacity: 0, y: 70, rotationX: -85, filter: 'blur(14px)', transformPerspective: 800, transformOrigin: '50% 100%' },
      { opacity: 1, y: 0, rotationX: 0, filter: 'blur(0px)', duration: 0.7, ease: SWIFT, stagger: 0.026 }, t0);
  };
  const charsOut = (i, t0) => {
    tl.fromTo(MW[i], { opacity: 1, y: 0, rotationX: 0, filter: 'blur(0px)' },
      { opacity: 0, y: -56, rotationX: 70, filter: 'blur(12px)', duration: 0.42, ease: 'power2.in', stagger: 0.012, immediateRender: false }, t0);
    tl.set(morphs[i], { opacity: 0 }, t0 + 0.75);
  };
  charsIn(0, mt[0]);
  tl.fromTo('#m7', { scale: 1.5 }, { scale: 1, duration: 0.7, ease: bounce, immediateRender: false }, mt[0] + 0.25);
  tl.fromTo('#cSrc', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' }, mt[0] + 0.5);
  for (let i = 1; i < morphs.length; i++) {
    const t0 = mt[i];
    charsOut(i - 1, t0);
    charsIn(i, t0 + 0.16);
    // each change pushes the lens: a warp pulse and a camera punch
    tl.fromTo('#warpC', { attr: { scale: 0 } }, { attr: { scale: 70 }, duration: 0.3, ease: 'power2.out', immediateRender: false }, t0);
    tl.fromTo('#warpC', { attr: { scale: 70 } }, { attr: { scale: 0 }, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, t0 + 0.3);
    tl.fromTo('#cMorph', { scale: 1.05 }, { scale: 1, duration: 0.9, ease: settle, immediateRender: false }, t0 + 0.12);
  }
  // crash zoom into the plate; it breaks into her care team's world: a live dashboard on deep lilac
  // the drawer slides over the list by design: mark both sides as intentional layering for the layout audit
  $$('#qRows *, #qDrawer *').forEach((e) => e.setAttribute('data-layout-allow-overlap', ''));
  const Q0 = S.dash[0];
  tl.fromTo('#qBg', { opacity: 0 }, { opacity: 1, duration: 0.01, ease: 'none' }, Q0 - 0.06);
  // one solid window and a camera that follows the story: it arrives with a gentle swing, pushes in on the danger
  // sign as it lands, pans with the cursor to the drawer, then breathes back out before diving into the list
  tl.fromTo('#qStage', { scale: 1.14, rotationY: -12, transformPerspective: 2400 }, { scale: 1, rotationY: 0, duration: 1.3, ease: settle }, Q0 - 0.05);
  tl.fromTo('#qWin', { opacity: 0, y: 90, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: settle }, Q0);
  tl.fromTo('#qWin', { x: 0, y: 0, scale: 1 }, { x: 90, y: 140, scale: 1.22, duration: 0.9, ease: 'power3.inOut', immediateRender: false }, Q0 + 1.0);
  tl.fromTo('#qWin', { x: 90, y: 140, scale: 1.22 }, { x: -330, y: 40, scale: 1.22, duration: 0.85, ease: 'power3.inOut', immediateRender: false }, Q0 + 2.1);
  tl.fromTo('#qWin', { x: -330, y: 40, scale: 1.22 }, { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'expo.inOut', immediateRender: false }, Q0 + 4.0);
  tl.fromTo('.qside', { opacity: 0, x: -340, rotationY: 50, transformPerspective: 1400 }, { opacity: 1, x: 0, rotationY: 0, duration: 0.8, ease: settle }, Q0 + 0.1);
  tl.fromTo('#qHead', { opacity: 0, y: -140, rotationX: -60, transformPerspective: 1400 }, { opacity: 1, y: 0, rotationX: 0, duration: 0.7, ease: settle }, Q0 + 0.18);
  tl.fromTo('#qFind', { opacity: 0, x: 220, y: -90, rotation: 10 }, { opacity: 1, x: 0, y: 0, rotation: 0, duration: 0.7, ease: settle }, Q0 + 0.24);
  tl.fromTo('.qs', { opacity: 0, x: (i) => (i % 2 ? 420 : -420), rotationY: (i) => (i % 2 ? -40 : 40), scale: 1.12, transformPerspective: 1400 },
    { opacity: 1, x: 0, rotationY: 0, scale: 1, duration: 0.7, ease: settle, stagger: 0.05 }, Q0 + 0.3);
  tl.fromTo('#qSheen', { xPercent: -120 }, { xPercent: 120, duration: 1.0, ease: 'power2.inOut' }, Q0 + 0.75);
  // a danger sign drops in at the top and pushes the list down
  tl.fromTo('.qs', { y: 0 }, { y: 96, duration: 0.6, ease: settle, immediateRender: false }, Q0 + 1.0);
  tl.fromTo('#qAlert', { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.7, ease: settle }, Q0 + 1.05);
  tl.fromTo('#qAlertBar', { scaleY: 0 }, { scaleY: 1, duration: 0.4, ease: SWIFT }, Q0 + 1.2);
  // the cursor: to the alert, click; the drawer opens
  const cur = (x, y) => ({ x: x - 3 - 240, y: y - 2 - 140 }); // window-local (the cursor rides with the window)
  const P0 = cur(1500, 900), PA = cur(828, 318), PC = cur(1450, 470), PR = cur(1450, 546);
  tl.fromTo('#qCur', { ...P0, opacity: 0 }, { ...P0, opacity: 1, duration: 0.2, ease: 'none' }, Q0 + 1.4);
  tl.fromTo('#qCur', { ...P0 }, { ...PA, duration: 0.6, ease: 'power3.inOut', immediateRender: false }, Q0 + 1.45);
  const click = (t0, x, y, first) => {
    tl.fromTo('#qCur', { scale: 0.82 }, { scale: 1, duration: 0.35, ease: bounce, immediateRender: false }, t0);
    tl.fromTo('#qRip', { x: x - 240, y: y - 140, scale: 0.3, opacity: 0.9 }, { x: x - 240, y: y - 140, scale: 1.7, opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, t0);
  };
  click(Q0 + 2.05, 828, 318, true);
  tl.fromTo('#qAlert', { scale: 1 }, { scale: 0.985, duration: 0.08, ease: 'power2.out', immediateRender: false }, Q0 + 2.05);
  tl.fromTo('#qAlert', { scale: 0.985 }, { scale: 1, duration: 0.4, ease: bounce, immediateRender: false }, Q0 + 2.13);
  // the drawer slides out from under the window's right edge (clipped to the window, so it never shows outside it)
  tl.fromTo('#qDrawer', { x: 480, clipPath: 'inset(0px 480px 0px -200px)' }, { x: 0, clipPath: 'inset(0px 0px 0px -200px)', duration: 0.65, ease: settle }, Q0 + 2.15);
  tl.set('#qDrawer', { clipPath: 'none' }, Q0 + 2.85);
  tl.fromTo('#qDrawer > *', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: SWIFT, stagger: 0.04 }, Q0 + 2.3);
  // call her: the button morphs into a live call with a running timer
  tl.fromTo('#qCur', { ...PA }, { ...PC, duration: 0.45, ease: 'power3.inOut', immediateRender: false }, Q0 + 2.75);
  click(Q0 + 3.2, 1450, 470);
  tl.fromTo('#qCallOn', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, Q0 + 3.22);
  const callT = $('#qCallT');
  const CT = { s: 0 };
  tl.fromTo(CT, { s: 0 }, { s: 2.2, duration: 2.2, ease: 'none', onUpdate: () => { callT.textContent = `Calling Amina · 0:0${Math.floor(CT.s)}`; } }, Q0 + 3.22);
  // refer: the second button turns into a confirmed referral
  tl.fromTo('#qCur', { ...PC }, { ...PR, duration: 0.4, ease: 'power3.inOut', immediateRender: false }, Q0 + 3.55);
  click(Q0 + 3.92, 1450, 546);
  tl.fromTo('#qReferOn', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, Q0 + 3.94);
  drawPath($('#qRefTick'), Q0 + 4.0, 0.35, 'power3.out');
  tl.fromTo('#qCur', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none', immediateRender: false }, Q0 + 4.6);
  // the pathway: detect → respond → refer → follow up, drawn and filled in order
  const trk = $('#qTrackSvg');
  const NX = [46.5, 139.5, 232.5, 325.5];
  trk.innerHTML = '<line x1="46.5" y1="20" x2="325.5" y2="20" stroke="#e9e3f1" stroke-width="4" stroke-linecap="round"/><line id="qTrkL" x1="46.5" y1="20" x2="325.5" y2="20" stroke="#7f5ac4" stroke-width="4" stroke-linecap="round"/>' +
    NX.map((x) => `<circle cx="${x}" cy="20" r="11" fill="#ffffff" stroke="#e9e3f1" stroke-width="3"/><circle class="qtn" cx="${x}" cy="20" r="11" fill="#7f5ac4"/>`).join('');
  const trkL = $('#qTrkL');
  trkL.style.strokeDasharray = '279';
  tl.fromTo(trkL, { strokeDashoffset: 279 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, Q0 + 3.95);
  tl.fromTo('.qtn', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: bounce, stagger: 0.24 }, Q0 + 3.95);
  tl.fromTo('#qFollow', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: SWIFT }, Q0 + 4.75);
  // whip (vertical) into the drum
  // the camera dives into the sidebar's list as it whips up — and the list rolls on as the word drum
  // out — the dashboard's own menu becomes the drum: everything else in the window dissolves away, the deep lilac
  // drains to the dark, and the sidebar list (Alerts, Women, Referrals…) grows, turns white and slides into the
  // drum's place — row for row (51 px rows × 2.94 = the drum's 150 px) — then hands over to the drum's words
  const MX = S.mark.whip - 0.7; // 36.538
  tl.fromTo(['#qPanel', '#qHead', '#qFind', '#qRows', '#qDrawer', '.qside h4', '#qCur'], { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)', duration: 0.45, ease: 'power2.inOut', immediateRender: false }, MX);
  tl.fromTo('.qside', { backgroundColor: 'rgba(250,249,252,1)', borderRightColor: 'rgba(238,236,242,1)' }, { backgroundColor: 'rgba(250,249,252,0)', borderRightColor: 'rgba(238,236,242,0)', duration: 0.45, ease: 'power2.inOut', immediateRender: false }, MX);
  tl.fromTo('#qBg', { opacity: 1 }, { opacity: 0, duration: 0.7, ease: 'power2.inOut', immediateRender: false }, MX + 0.05);
  tl.fromTo('.qnav i', { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'none', immediateRender: false }, MX + 0.1);
  tl.fromTo('.qnav .act', { backgroundColor: 'rgba(244,237,249,1)' }, { backgroundColor: 'rgba(244,237,249,0)', duration: 0.3, ease: 'none', immediateRender: false }, MX + 0.1);
  tl.fromTo('.qnav > div:not(.act)', { color: '#6e6e73' }, { color: '#8e8e93', duration: 0.4, ease: 'none', immediateRender: false }, MX + 0.15);
  tl.fromTo('.qnav .act', { color: '#6a47ad' }, { color: '#ffffff', duration: 0.4, ease: 'none', immediateRender: false }, MX + 0.15);
  tl.fromTo('.qnav', { x: 0, y: 0, scale: 1, rotation: 0, transformOrigin: '36px 21.5px' }, { x: 170, y: 236, scale: 2.94, rotation: -4, duration: 0.85, ease: 'power3.inOut', immediateRender: false }, MX + 0.1);
  tl.fromTo('.qnav > div', { filter: 'blur(0px)' }, { filter: (i) => `blur(${[0, 3, 6, 9, 12][i]}px)`, duration: 0.6, ease: 'power2.in', immediateRender: false }, MX + 0.35);
  tl.fromTo('.qnav', { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(10px)', duration: 0.4, ease: 'power2.in', immediateRender: false }, MX + 0.78);
  tl.fromTo('#s6', { opacity: 0, filter: 'blur(10px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out' }, MX + 0.72);
  tl.set('#s6', { filter: 'none' }, MX + 1.2);

  // ================================================================ 6 · the word drum (29.958 → 37.958)
  const D0 = S.drum[0];
  light(S.mark.whip, 1.0, [{ x: 330, y: 560, scale: 1.1, opacity: 0.36 }, { x: 1560, y: 980, scale: 0.9, opacity: 0.22 }, { x: 1660, y: 120, scale: 1, opacity: 0.5 }]);
  const ITEMS = ['Pregnancy monitoring', 'Danger-sign screening', 'Health education', 'Care-team alerts', 'Follow-up care'];
  const drumEl = $('#dDrum');
  // the selection lens: a curved slice of the same cylinder the words ride on, so it bends exactly as they do
  const lensEl = document.createElement('div');
  lensEl.id = 'dLens';
  drumEl.appendChild(lensEl);
  const LN = 9, LH = 164, LDA = 16, LDR = 150 / ((LDA * Math.PI) / 180);
  const lensStrips = [];
  for (let j = 0; j < LN; j++) {
    const st = document.createElement('div');
    st.className = 'dls';
    st.setAttribute('data-layout-allow-overlap', '');
    const sh = LH / LN, a = (((LN - 1) / 2 - j) * sh / LDR) * 180 / Math.PI;
    st.style.top = `${(-sh / 2 - 0.3).toFixed(2)}px`;
    st.style.height = `${(sh + 0.6).toFixed(2)}px`;
    st.style.transform = `translateZ(${-LDR}px) rotateX(${a.toFixed(3)}deg) translateZ(${LDR - 4}px)`;
    const al = 0.15 - 0.1 * (j / (LN - 1));
    st.style.background = `rgba(255,255,255,${al.toFixed(3)})`;
    if (j === 0) { st.style.borderRadius = '30px 30px 0 0'; st.style.boxShadow += ', inset 0 1.5px 0 rgba(255,255,255,0.4)'; }
    if (j === LN - 1) { st.style.borderRadius = '0 0 30px 30px'; st.style.boxShadow += ', inset 0 -1px 0 rgba(255,255,255,0.14)'; }
    lensEl.appendChild(st);
    lensStrips.push(st);
  }
  const dItems = ITEMS.map((txt) => {
    const d = document.createElement('div');
    d.className = 'di';
    d.setAttribute('data-layout-allow-overlap', ''); // the drum's faces overlap by design (a 3D wheel)
    drumEl.appendChild(d);
    const ch = chars(d, txt);
    ch.forEach((c) => c.setAttribute('data-layout-allow-overlap', ''));
    return { el: d, ch };
  });
  // the hypnotic background: faint concentric lilac rings that keep flowing outward (frame())
  const hyp = $('#dHyp');
  const rings = [];
  for (let i = 0; i < 44; i++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '1560');
    c.setAttribute('cy', '540');
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', 'rgba(201,166,240,0.10)');
    c.setAttribute('stroke-width', i % 4 === 0 ? '2.2' : '1.2');
    hyp.appendChild(c);
    rings.push(c);
  }
  const DRUM = { k: 0 };
  const L0 = D0 + 0.32, STEP = 1.175; // five words spread over the same span the six had
  tl.set(DRUM, { k: 0 }, D0 - 0.7);
  for (let i = 1; i < ITEMS.length; i++) tl.fromTo(DRUM, { k: i - 1 }, { k: i, duration: 0.72, ease: snap, immediateRender: false }, L0 + i * STEP - 0.36);
  dItems.forEach((it, i) => {
    const land = i === 0 ? L0 : L0 + i * STEP - 0.2;
    tl.fromTo(it.ch, { scaleY: 1.55, scaleX: 0.78, skewX: -14, y: -6 }, { scaleY: 1, scaleX: 1, skewX: 0, y: 0, duration: 1.0, ease: 'elastic.out(1.15, 0.3)', stagger: 0.014 }, land);
    tl.fromTo('#dArrow', { x: -26, scaleX: 1.25 }, { x: 0, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, 0.38)', immediateRender: i === 0 }, land);
  });
  drawPath($('#dArrow path'), D0 - 0.1, 0.55, 'power3.out');
  // the selection lens: a frosted band the words roll through, a soft lilac glow behind it that breathes on each landing
  tl.fromTo(lensStrips, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: { each: 0.03, from: 'center' } }, D0 - 0.1);
  tl.fromTo('#dLens', { scaleX: 0.7 }, { scaleX: 1, duration: 0.8, ease: settle }, D0 - 0.1);
  tl.fromTo('#dGlow', { opacity: 0 }, { opacity: 0.55, duration: 1.0, ease: 'power2.out' }, D0 - 0.1);
  [0, 1, 2, 3, 4].map((i) => (i ? L0 + i * STEP - 0.2 : L0)).forEach((t) => {
    tl.fromTo('#dGlow', { opacity: 0.55, scale: 1 }, { opacity: 0.85, scale: 1.06, duration: 0.14, ease: 'power2.out', immediateRender: false }, t - 0.02);
    tl.fromTo('#dGlow', { opacity: 0.85, scale: 1.06 }, { opacity: 0.55, scale: 1, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, t + 0.12);
  });
  tl.set('#dDrum', { rotationZ: -4, rotationY: -12 }, 0);
  // out: the drum rushes past the lens as the clinician's photograph comes up behind it
  const T0 = S.testi[0] - 0.1; // the 16-10 clock's zero
  tl.fromTo('#s6', { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(14px)', opacity: 0, duration: 0.55, ease: 'power2.in', immediateRender: false }, T0 - 0.42);

  // ================================================================ 7 · a clinician — 16-10, keyframe for keyframe
  // the photograph eases back from 150 % (camera ease-back), 1.49 s on the reference's curve
  tl.fromTo('#tBgWrap', { opacity: 0 }, { opacity: 1, duration: 0.32, ease: 'none' }, T0 - 0.32);
  tl.fromTo('#tBgWrap', { scale: 1.5 }, { scale: 1, duration: 1.49, ease: SWIFT }, T0);
  // the glass: a rounded rectangle of the photo, blurred, with a 13 % white tint; it shrinks from a big soft
  // blob into the card (1.49 s), its blur deepening, then jelly-bounces: 100 → 90.6 → 114.7 → 110 %
  // the drum's selection becomes frosted glass around the word, then swells into 16-10's glass blob
  tl.fromTo('#tGlass', { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, T0 - 0.8);
  tl.fromTo('#tGlass', { clipPath: 'inset(462px 140px 462px 280px round 32px)' }, { clipPath: 'inset(110px 370px 112px 365px round 104px)', duration: 0.5, ease: 'expo.inOut' }, T0 - 0.5);
  tl.fromTo('#tGlass', { clipPath: 'inset(110px 370px 112px 365px round 104px)' }, { clipPath: 'inset(336px 661px 336px 568px round 104px)', duration: 1.49, ease: SWIFT, immediateRender: false }, T0);
  tl.fromTo('#tGlass', { '--gb': '40px' }, { '--gb': '43px', duration: 0.37, ease: bez(0.62, 0, 0.86, 0.4) }, T0);
  tl.fromTo('#tGlass', { '--gb': '43px' }, { '--gb': '56px', duration: 0.37, ease: bez(0.21, 0.23, 0.28, 0.67), immediateRender: false }, T0 + 0.37);
  tl.fromTo('#tGlass', { '--gb': '56px' }, { '--gb': '60px', duration: 0.75, ease: bez(0.3, 0.82, 0.69, 1), immediateRender: false }, T0 + 0.74);
  tl.fromTo('#tGlass', { scale: 1 }, { scale: 0.9064, duration: 0.51, ease: bez(0.35, 0, 0.7, 1) }, T0 + 1.63);
  tl.fromTo('#tGlass', { scale: 0.9064 }, { scale: 1.1468, duration: 0.42, ease: bez(0.59, 0, 0.11, 1), immediateRender: false }, T0 + 2.14);
  tl.fromTo('#tGlass', { scale: 1.1468 }, { scale: 1.1, duration: 1.01, ease: bez(0.2, 0, 0.4, 1), immediateRender: false }, T0 + 2.56);
  // the content plate rides the same jelly a beat later: 80 → 69.3 → 105.4 → 100 %
  tl.fromTo('#tPlate', { scale: 0.8 }, { scale: 0.6928, duration: 0.45, ease: bez(0.35, 0, 0.671, 1) }, T0 + 1.73);
  tl.fromTo('#tPlate', { scale: 0.6928 }, { scale: 1.0536, duration: 0.61, ease: bez(0.513, 0, 0.187, 1), immediateRender: false }, T0 + 2.18);
  tl.fromTo('#tPlate', { scale: 1.0536 }, { scale: 1, duration: 0.88, ease: bez(0.229, 0, 0.4, 1), immediateRender: false }, T0 + 2.79);
  // the quote writes itself: one word every 0.06 s from 0.50 s, each rising 47 px through its line's mask
  const qLines = ['Every woman deserves care that notices', 'the warning signs early. HerCova does', 'exactly that, wherever she is.”'];
  const qWords = [];
  $('#tQuote').innerHTML = qLines.map((l) => `<span class="ln">${l.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ')}</span>`).join('');
  $$('#tQuote .w').forEach((w) => qWords.push(w));
  qWords.forEach((w, k) => {
    const t0 = T0 + 0.5 + 0.06 * k;
    tl.fromTo(w, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.61, ease: SWIFT }, t0);
  });
  tl.fromTo('#tQuoteMark', { opacity: 0 }, { opacity: 1, duration: 0.23, ease: 'none' }, T0 + 0.75);
  tl.fromTo('#tAva', { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.6, ease: SWIFT }, T0 + 1.42);
  $$('#tName .w').forEach((w, k) => tl.fromTo(w, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.61, ease: SWIFT }, T0 + 1.55 + 0.06 * k));
  // the heart: grey to 50 %, then filled white by a growing circle
  tl.fromTo('#tHeartGrey', { opacity: 0 }, { opacity: 1, duration: 0.51, ease: 'none' }, T0 + 1.26);
  tl.fromTo('#tFillMask', { clipPath: 'circle(0% at 50% 55%)' }, { clipPath: 'circle(75% at 50% 55%)', duration: 1.08, ease: SWIFT }, T0 + 2.13);
  // out: the testimonial defocuses into the dark (the Spotify blur-out)
  const X7 = S.close[0] - 0.4;
  tl.fromTo('#gl', { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(26px)', duration: 0.6, ease: 'power2.in', immediateRender: false }, S.close[0] - 0.4);
  // out — a shared element: Edidiong's last words, "wherever she is.", stay while the rest of the card, the glass and
  // the photograph dissolve into the dark; they glide into the closing line and become its last word, "anywhere."
  const XW = 53.433;
  tl.set('#xWho', { opacity: 1 }, XW);
  tl.set(qWords.slice(-3), { opacity: 0 }, XW);
  tl.fromTo(['#tQuoteMark', ...qWords.slice(0, -3), '#tAva', '#tName', '#tHeart'], { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)', duration: 0.45, ease: 'power2.in', stagger: 0.006, immediateRender: false }, XW + 0.02);
  tl.fromTo('#tGlass', { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power2.inOut', immediateRender: false }, XW + 0.1);
  tl.fromTo('#tBgWrap', { opacity: 1, filter: 'blur(0px)', scale: 1 }, { opacity: 0, filter: 'blur(18px)', scale: 1.04, duration: 0.85, ease: 'power2.inOut', immediateRender: false }, XW + 0.1);
  tl.fromTo('#xWho', { x: 0, y: 0, scale: 1, color: '#ffffff' }, { x: 395, y: 67.4, scale: 1.35, color: '#c9a6f0', duration: 1.0, ease: 'power3.inOut', immediateRender: false }, XW + 0.3);
  tl.fromTo('#xWho', { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(12px)', duration: 0.4, ease: 'power2.in', immediateRender: false }, XW + 1.2);

  // ================================================================ 8 · care that reaches her, anywhere (45.292 → 51.292)
  const C0 = S.close[0];
  light(X7 - 0.2, 1.4, [{ x: 760, y: 640, scale: 1.2, opacity: 0.6 }, { x: 1380, y: 420, scale: 0.9, opacity: 0.3 }, { x: 220, y: 100, opacity: 0.4 }]);
  const CLOSE = 'Care that reaches her, anywhere.';
  const CENTERS = [-477.2, -435.0, -405.3, -374.1, -346.4, -327.2, -297.6, -260.9, -231.2, -212.0, -192.8, -161.6, -123.4, -85.7, -48.0, -9.8, 27.8, 53.5, 79.7, 117.9, 149.1, 166.8, 181.0, 207.2, 243.9, 279.6, 323.2, 367.9, 406.1, 437.3, 468.5, 494.7];
  const k3 = $('#k3');
  const k3c = chars(k3, CLOSE);
  const SPLIT = 22; // "Care that reaches her," | " anywhere."
  k3c.slice(SPLIT).forEach((c) => c.classList.add('ac'));
  const first = k3c.slice(0, SPLIT), second = k3c.slice(SPLIT);
  // "Care that reaches her," builds leftward out of the arriving words; they melt into "anywhere."
  tl.fromTo(first, { opacity: 0, y: 26, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', stagger: { each: 0.018, from: 'end' } }, XW + 1.0);
  tl.fromTo(second, { opacity: 0, scale: 1.2, filter: 'blur(12px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.55, ease: 'power2.out', stagger: 0.02 }, XW + 1.25);
  // the whole line collapses into one lilac dot (text → shape morph), the way Spotify's line becomes its logo
  const COL = S.end[0] - 1.35;
  tl.fromTo(k3c, { x: 0, scaleX: 1, opacity: 1 }, { x: (i) => -CENTERS[i], scaleX: 0.2, opacity: 0, duration: 0.6, ease: 'power3.in', stagger: { each: 0.008, from: 'edges' }, immediateRender: false }, COL);
  tl.fromTo('#kDot i', { scale: 0 }, { scale: 1, duration: 0.7, ease: bounce }, COL + 0.5);
  light(COL + 0.3, 0.8, [{ x: 960, y: 560, scale: 0.9, opacity: 0.75 }, null, null]);

  // ================================================================ 9 · the end sting — Scene, in HerCova's colours (51.292 → 56.6)
  const H0 = S.end[0];
  const rect = $('#eR');
  // the light panel wipes in from the left under the dot (the reference's opening move)
  tl.fromTo('#eWipeIn', { xPercent: -100 }, { xPercent: 0, duration: 0.55, ease: 'expo.inOut' }, H0 - 0.6);
  // the dot becomes the pill
  tl.fromTo(rect, { attr: { x: 938, y: 518, width: 44, height: 44, rx: 22, fill: '#c9a6f0' } }, { attr: { x: 890, y: 510, width: 140, height: 60, rx: 30, fill: '#8f6bcf' }, duration: 0.6, ease: settle }, H0 - 0.2);
  const DOT = { x: 1225.5, y: 562, s: 30 };
  const START = 367;
  tl.fromTo(rect, { attr: { x: 890, y: 510, width: 140, height: 60, rx: 30 } }, { attr: { x: START - 15, y: DOT.y, width: DOT.s, height: DOT.s, rx: 15 }, duration: 0.6, ease: 'expo.inOut', immediateRender: false }, H0 + 0.62);
  // it stretches back into a pill and sweeps right, writing the address behind it
  const SW = { p: 0 };
  const nameL = 397, nameR = 397 + 814.5;
  const eName = $('#eName');
  const sweep = (p) => {
    const head = lerp(START - 15, DOT.x + DOT.s, p);
    const stretch = Math.sin(Math.PI * clamp(p)) * 150;
    const x = Math.max(START - 15, head - DOT.s - stretch);
    rect.setAttribute('x', x.toFixed(2));
    rect.setAttribute('width', (head - x).toFixed(2));
    const reveal = clamp((x + 4 - nameL) / (nameR - nameL));
    eName.style.clipPath = `inset(0% ${((1 - reveal) * 100).toFixed(2)}% 0% 0%)`;
  };
  const SW0 = H0 + 1.35;
  tl.fromTo(SW, { p: 0 }, { p: 1, duration: 0.8, ease: 'power3.inOut', onUpdate: () => sweep(SW.p) }, SW0);
  tl.fromTo(rect, { attr: { fill: '#8f6bcf' } }, { attr: { fill: '#ee7b1e' }, duration: 0.3, ease: 'none', immediateRender: false }, SW0 + 0.55);
  tl.fromTo(rect, { attr: { y: DOT.y + 4, height: DOT.s - 6, x: DOT.x - 3, width: DOT.s + 6 } }, { attr: { y: DOT.y, height: DOT.s, x: DOT.x, width: DOT.s }, duration: 0.55, ease: bounce, immediateRender: false }, SW0 + 0.8);
  tl.fromTo('#eName', { color: '#b9b6c0' }, { color: '#1d1d1f', duration: 0.5, ease: 'power2.out' }, SW0 + 0.75);
  const comCh = chars($('#eCom'));
  tl.fromTo(comCh, { opacity: 0, y: 46, scaleY: 1.5, scaleX: 0.8 }, { opacity: 1, y: 0, scaleY: 1, scaleX: 1, duration: 0.95, ease: 'elastic.out(1.1, 0.34)', stagger: 0.06 }, SW0 + 0.92);
  $('#eMark').innerHTML = window.HC_LOGO.svg('mark');
  tl.fromTo('#eMark', { opacity: 0, y: 40, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: bounce }, SW0 + 1.45);
  tl.fromTo('#eTag', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, SW0 + 1.75);
  // the dark wipe closes the film
  tl.fromTo('#eWipeOut', { xPercent: 100 }, { xPercent: 0, duration: 0.55, ease: 'expo.inOut' }, T.duration - 0.85);

  // ================================================================ the clock: 3D, expressions, grain
  const grain = $('#grain');
  const bws = ['#bw1', '#bw2', '#bw3'].map($);
  const KG = ['#kG1', '#kG2', '#kG4'].map($);
  const hash = (n) => {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  // the neon ribbon: a sum of two travelling sines, sampled across the frame (optionally on a slope)
  function ribbon(t, amp, yb, k1, k2, w1, w2, ph, slope) {
    let d = '';
    for (let i = 0; i <= 48; i++) {
      const x = -140 + i * 45;
      const y = yb + amp * Math.sin(k1 * x + w1 * t + ph) + amp * 0.45 * Math.sin(k2 * x - w2 * t + 1.7 + ph) + slope * (x - 960);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }
  const RB = ['#rb0', '#rb1', '#rb2'].map($);
  RB.forEach((r) => r.setAttribute('pathLength', '1'));
  const FR = $('#oFlashRib');
  const RS = $('#rs0');
  const GL = ['#gL', '#gR', '#gT', '#gB', '#gV', '#gH'].map($);
  const TLS = $$('#oCollage .tl');
  const ORB = $$('.oi');
  const PINR = $$('.pr');
  const caret = $('#qCaret');
  const DOTS = $$('#qp2 .qdots i');
  const RINGS = $$('.qring');
  const GCB = $$('.gcB');
  const QL = ['#qL1', '#qL2'].map($);
  const DA = 16, DR = 150 / ((DA * Math.PI) / 180);
  function frame(t) {
    if (window.__gl) window.__gl.render(t);
    // the lights breathe: slow Lissajous drift on top of each section's placement
    bws.forEach((b, i) => {
      const x = Math.sin(t * (0.23 + i * 0.06) + i * 2.1) * 280 + Math.sin(t * (0.61 + i * 0.1) + i) * 60;
      const y = Math.cos(t * (0.19 + i * 0.05) + i * 1.3) * 180 + Math.cos(t * (0.53 + i * 0.08) + i * 0.7) * 40;
      const s = 1 + Math.sin(t * 0.31 + i) * 0.12;
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
    });
    // the hook: the neon ribbon waves, the guides march, the moodboard floats, carets blink, the call rings
    if (t > 2.85 && t < 8.1) {
      const d = ribbon(t, 48, 560, 0.0045, 0.011, 1.8, 2.6, 0, 0);
      RB.forEach((r) => { r.setAttribute('d', d); r.style.strokeDasharray = `${RIBDRAW.p.toFixed(4)} 1`; r.style.strokeDashoffset = `${((RIBDRAW.p - 1) / 2).toFixed(4)}`; });
      if (t < 3.2) FR.setAttribute('d', ribbon(t, 70, 600, 0.004, 0.009, 2.4, 3.1, 1, 0));
    }
    if (t > 3.3 && t < 7.9) {
      GL[4].style.strokeDashoffset = GL[5].style.strokeDashoffset = (-t * 34).toFixed(1);
      const set = (el, x1, y1, x2, y2) => { el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); el.style.strokeDashoffset = (-t * 34).toFixed(1); };
      set(GL[0], G.l, -200, G.l, 1280); set(GL[1], G.r, -200, G.r, 1280); set(GL[2], -200, G.t, 2120, G.t); set(GL[3], -200, G.b, 2120, G.b);
    }
    if (t > 3.9 && t < 5.95) TLS.forEach((c) => { const col = Math.round((parseFloat(c.style.left) - 110) / 300); c.style.translate = `0px ${((col % 2 ? -1 : 1) * (t - 4) * 26).toFixed(1)}px`; }); // columns drift in opposing parallax
    if (t > 4.3 && t < 8) PINR.forEach((r, i) => { const q = ((t * 0.8 + i * 0.37) % 1); r.setAttribute('r', (24 + q * 60).toFixed(1)); r.setAttribute('opacity', (0.8 * (1 - q)).toFixed(3)); });
    if (t > 6.0 && t < 8) ORB.forEach((o, i) => { const a = t * 1.5 + (i * Math.PI) / 2; const z = Math.sin(a); o.style.translate = `${(Math.cos(a) * 150).toFixed(1)}px ${(z * 54).toFixed(1)}px`; o.style.zIndex = z > 0 ? '2' : '0'; o.style.opacity = (0.55 + 0.45 * (z + 1) / 2).toFixed(3); });
    if (t > 5.9 && t < 8) {
      const on = ((t * 1.6) % 1) < 0.55 ? '1' : '0';
      caret.style.opacity = on;
      DOTS.forEach((d, i) => { d.style.transform = `translateY(${(-Math.max(0, Math.sin(t * 9 - i * 0.9)) * 6).toFixed(1)}px)`; });
      RINGS.forEach((r, i) => { const p = ((t * 0.9 + i * 0.5) % 1); r.style.transform = `scale(${(1 + p * 0.9).toFixed(3)})`; r.style.opacity = t > 6.95 ? (0.8 * (1 - p)).toFixed(3) : '0'; });
    }
    if (t > 7.9 && t < 10.85) RS.setAttribute('d', ribbon(t, 120, 540 + Math.sin(t * 0.7) * 60, 0.0026, 0.006, 0.9, 1.3, 2, -0.34));
    if (t > 9.9 && t < 10.8) GCB.forEach((b) => { b.style.opacity = ((t * 1.8) % 1) < 0.55 ? '1' : '0'; });
    // the dashboard's lilac lights travel across the deep lilac
    if (t > S.dash[0] - 1 && t < S.dash[1] + 0.8) {
      QL[0].style.transform = `translate(${(300 + Math.sin(t * 0.5) * 420).toFixed(1)}px, ${(260 + Math.cos(t * 0.4) * 160).toFixed(1)}px)`;
      QL[1].style.transform = `translate(${(1600 + Math.cos(t * 0.45) * 360).toFixed(1)}px, ${(860 + Math.sin(t * 0.55) * 180).toFixed(1)}px)`;
    }
    // the promise's light: a pale lilac wash and two lilac glows on their own orbits, breathing — never still
    if (t > 27.13 && t < 33.43) {
      const u = t - 27.233;
      const G = [
        [960 + 540 * Math.sin(0.9 * u + 0.3), 540 + 280 * Math.cos(1.1 * u), 1.0 + 0.14 * Math.sin(1.7 * u), 0.8 + 0.2 * Math.sin(1.3 * u + 1)],
        [960 + 620 * Math.cos(0.7 * u + 1.2), 540 + 320 * Math.sin(0.95 * u + 0.5), 0.92 + 0.12 * Math.cos(1.3 * u), 0.85 + 0.15 * Math.cos(1.1 * u)],
        [960 + 320 * Math.cos(0.5 * u), 540 + 170 * Math.sin(0.6 * u + 1), 1.25 + 0.1 * Math.sin(0.8 * u), 1],
      ];
      KG.forEach((el, i) => {
        const [x, y, sc, op] = G[i];
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
        el.style.opacity = op.toFixed(3);
      });
    }
    // the drum and the hypnotic rings
    if (t > S.drum[0] - 0.8 && t < S.drum[1] + 0.2) {
      const k = DRUM.k;
      dItems.forEach((it, i) => {
        const d = k - i, ad = Math.abs(d);
        it.el.style.transform = `translateZ(${-DR}px) rotateX(${(d * DA).toFixed(3)}deg) translateZ(${DR}px)`;
        it.el.style.opacity = ad > 4 ? '0' : clamp(1 - Math.max(0, ad - 0.15) * 0.3).toFixed(3);
        it.el.style.filter = `blur(${Math.min(16, Math.max(0, ad - 0.12) * 7).toFixed(2)}px)`;
        it.el.style.color = ad < 0.5 ? '#ffffff' : '#8e8e93';
      });
      const off = ((t - S.drum[0]) * 26) % 34;
    }
    // grain: a fresh deterministic offset every film frame
    const g = Math.floor(t * 24);
    grain.style.transform = `translate(${(-hash(g) * 9).toFixed(1)}px, ${(-hash(g + 101) * 9).toFixed(1)}px)`;
    grain.style.backgroundPosition = `${Math.floor(hash(g + 7) * 256)}px ${Math.floor(hash(g + 13) * 256)}px`;
  }
  const clock = { t: 0 };
  tl.fromTo(clock, { t: 0 }, { t: T.duration, duration: T.duration, ease: 'none', onUpdate: () => frame(clock.t) }, 0);
  window.__hcRenderNow = () => frame(clock.t);
  return tl;
};
