/*
 * 8 · THE END (41.0 – 48.0 s), on the light side of the world (the reeded glass glowing white-lilac).
 *  mark   the HerCova mark in 3D — the purple arc rises into being bottom to top, the orange figure springs in —
 *         the wordmark beside it, "Care that reaches her, anywhere." word by word with the voice
 *  sting  the Scene.json reference: a deep-violet wipe, a light wipe, a pill slides in and shrinks into a dot; the
 *         dot turns orange and sweeps right, writing "hercovahealth" behind it, lands as the full stop, "com"
 *         follows. A last deep-violet wipe.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/SVGLoader.js';
import { Shot, V3, renderer, clamp, lerp, seg, spring, ease, bump, track } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { world } from '../kit/world.js';
import { textLayer, blurIn } from '../kit/text.js';
import { shape } from '../kit/glass.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo5 = T.vo.find((v) => v.id === 'vo5');
const vo6 = T.vo.find((v) => v.id === 'vo6');
const w5 = (i) => vo5.at + (WORDS.vo5 ? WORDS.vo5[i][1] : i * 0.4);
const w6 = (i) => vo6.at + (WORDS.vo6 ? WORDS.vo6[i][1] : i * 0.4);
const POP = spring(260, 13);
const ORANGE = new THREE.Color('#ee7b1e'), GREY = new THREE.Color('#a59fb6');

export function end() {
  const [a, b] = T.shots.end;
  const shot = new Shot('end', { fov: 30, background: '#efe8fa' });
  const S = shot.scene;
  const Wl = world({ flutes: 13 });
  Wl.mesh.position.z = -8;
  shot.bg.add(Wl.mesh);
  studio(S, { env: 1.0, key: 2.0, rim: 1.2, hemi: 0.5, keyPos: [-5, 7, 12], shadow: false });
  renderer.localClippingEnabled = true;

  /* ---------------------------------------------------------------- the mark */
  const markG = new THREE.Group();
  S.add(markG);
  const clip = new THREE.Plane(new V3(0, -1, 0), 0); // reveals the arc from the bottom up
  const arcMat = new THREE.MeshPhysicalMaterial({ color: '#7b2fa8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, clippingPlanes: [clip] });
  const figMat = MAT.orange(0.12);
  const K = 2.6 / 524;
  track(fetch('assets/images/logo-mark.svg').then((r) => r.text()).then((src) => {
    new SVGLoader().parse(src).paths.forEach((p) => {
      const isArc = p.color && p.color.getHexString() === '7b2fa8';
      const geo = new THREE.ExtrudeGeometry(SVGLoader.createShapes(p), { depth: 26, bevelEnabled: true, bevelThickness: 5, bevelSize: 3.5, bevelSegments: 5, curveSegments: 10 });
      geo.translate(-125.5, -262, -13);
      const m = new THREE.Mesh(geo, isArc ? arcMat : figMat);
      m.scale.set(K, -K, K);
      m.userData.arc = isArc;
      markG.add(m);
    });
  }));
  markG.position.set(-3.0, 0.4, 0);
  const wordmark = textLayer('HerCova', { size: 1.55, weight: 800, color: '#7b2fa8', tracking: -0.035 });
  wordmark.mesh.position.set(-2.0, 0.05, 0);
  const tagline = textLayer('Care that reaches her, anywhere.', { size: 0.42, weight: 700, color: '#2a2433' });
  tagline.mesh.position.set(-2.85, -1.3, 0);
  S.add(wordmark.mesh, tagline.mesh);
  const tagStarts = [0, 1, 2, 3, 4].map((i) => w5(i) - 0.05);

  /* ---------------------------------------------------------------- the sting */
  S.add(shot.camera);
  const panel = (color) => { const s2 = shape({ w: 1, h: 1, r: 0, color, maxW: 1, maxH: 1 }); s2.mesh.renderOrder = 20; s2.mesh.material.depthTest = false; shot.camera.add(s2.mesh); return s2; };
  const dark = panel('#1d0b45'), light = panel('#f1eafb'), darkOut = panel('#1d0b45');
  const stingG = new THREE.Group();
  S.add(stingG);
  const p1 = textLayer('hercovahealth', { size: 1.0, weight: 800, color: '#1d1726', tracking: -0.02 });
  const p2 = textLayer('com', { size: 1.0, weight: 800, color: '#1d1726', tracking: -0.02 });
  stingG.add(p1.mesh, p2.mesh);
  const pill = shape({ w: 1.6, h: 0.62, r: 0.31, color: '#b8b1c9', color2: '#a59fb6', maxW: 4, maxH: 1.2 });
  stingG.add(pill.mesh);
  let total = 0, DOT_W = 0.42;
  Promise.all([p1.ready, p2.ready]).then(() => {
    total = p1.width + DOT_W + p2.width;
    p1.mesh.position.x = -total / 2;
    p2.mesh.position.x = -total / 2 + p1.width + DOT_W;
  });

  const tDark = w6(0) - 0.4, tLight = tDark + 0.3, tPill = tLight + 0.2, tSweep = w6(3) - 0.02, tDot = w6(5), tCom = w6(6) - 0.12, tOut = b - 0.45;
  const sweepEnd = tSweep + 0.85;
  shot.samplesAt = (t) => ([tDark, tLight, tOut].some((w) => t > w - 0.05 && t < w + 0.4) || (t > tPill && t < sweepEnd + 0.1) ? 17 : 7);

  shot.update = (t) => {
    const k = seg(t, a, a + 1.4, 'expo.out');
    shot.pose([lerp(1.5, 0.1, k), lerp(0.8, 0.2, k), lerp(9.5, 11.5, k)], [lerp(-0.6, 0.1, k), lerp(0.2, 0, k), 0], 30);
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.03;
    Wl.drift(t, { light: 0.75, phase: 0.6, speed: 0.7 });
    // the mark: the arc rises into being, the figure springs in, the lockup settles
    clip.constant = lerp(-1.4, 1.6, seg(t, a + 0.1, a + 0.9, 'power3.inOut')) + markG.position.y;
    const fig = POP.at(t, a + 0.65);
    markG.children.forEach((m) => { if (!m.userData.arc) { const f = Math.max(fig, 0.001); m.scale.set(K * f, -K * f, K * f); } });
    markG.rotation.y = lerp(-0.6, 0, k);
    wordmark.all((l, j) => blurIn(clamp((t - a - 0.75 - j * 0.04) / 0.45), { rise: 0.3, blur: 5, scale: 0.9 }));
    let wi = 0;
    tagline.all((l, j) => {
      const prev = tagline.letters[j - 1];
      if (j > 0 && prev && prev.space && !l.space) wi++;
      if (l.space) return { alpha: 0 };
      return blurIn(clamp((t - tagStarts[Math.min(wi, 4)] - j * 0.008) / 0.4), { rise: 0.15, blur: 4 });
    });
    // wipes: panels just in front of the lens, sliding across
    const fw = 2 * 2.0 * Math.tan((15 * Math.PI) / 180) * (16 / 9) + 0.2, fh = 2 * 2.0 * Math.tan((15 * Math.PI) / 180) + 0.1;
    const wipe = (pn, t0, fromRight, hold) => {
      const u = ease('power3.inOut')(clamp((t - t0) / 0.32));
      pn.mesh.visible = t > t0 && (hold === undefined || t < hold);
      pn.mesh.scale.set(fw, fh, 1);
      pn.mesh.position.set((fromRight ? 1 : -1) * fw * (1 - u), 0, -2.0);
    };
    wipe(dark, tDark, true, tLight + 0.32);
    wipe(light, tLight, false);
    wipe(darkOut, tOut, true);
    const stingOn = t > tLight + 0.3;
    markG.visible = !stingOn;
    wordmark.mesh.visible = tagline.mesh.visible = !stingOn;
    stingG.visible = stingOn;
    light.mesh.visible = light.mesh.visible && !stingOn;
    // the pill slides in, shrinks into a dot where the address begins, turns orange and writes it as it sweeps
    const startX = -total / 2 - 0.2, dotX = -total / 2 + p1.width + DOT_W / 2;
    const pIn = ease('power3.out')(clamp((t - tPill) / 0.55));
    const shrink = ease('power3.inOut')(clamp((t - tPill - 0.3) / 0.45));
    const sweep = ease('power2.inOut')(clamp((t - tSweep) / (sweepEnd - tSweep)));
    const px = lerp(lerp(4.0, startX, pIn), dotX, sweep);
    const land = 1 + 0.25 * bump(t, tDot, 0.07);
    const h = lerp(0.62, 0.26, shrink) * land, w = lerp(1.6, 0.26, shrink) * land;
    pill.mesh.visible = t > tPill;
    pill.mesh.position.set(px, h / 2, 0.02);
    pill.set({ w, h, r: h / 2 });
    const oc = seg(t, tSweep - 0.2, tSweep + 0.1);
    pill.u.uCol.value.lerpColors(GREY, ORANGE, oc);
    pill.u.uCol2.value.lerpColors(GREY, ORANGE, oc);
    pill.u.uGlow.value = 0.4 * oc;
    // letters appear as the dot passes them
    p1.all((l) => {
      const lx = p1.mesh.position.x + l.hx;
      const at = tSweep + clamp((lx - startX) / Math.max(dotX - startX, 1e-3)) * (sweepEnd - tSweep);
      return blurIn(clamp((t - at + 0.02) / 0.28), { rise: 0.2, blur: 3, scale: 0.9 });
    });
    p2.all((l, j) => blurIn(clamp((t - tCom - j * 0.05) / 0.35), { rise: 0.2, blur: 3, scale: 0.9 }));
  };
  return shot;
}
