/*
 * 8 · THE END (41.0 – 48.0 s).
 *  mark   the HerCova mark in 3D (the purple arc rises into being, bottom to top; the orange figure springs
 *         in), the wordmark beside it, "Care that reaches her, anywhere." word by word with the voice
 *  sting  the Scene.json reference: a dark wipe, a light wipe, a pill slides in and shrinks into a dot; the
 *         dot turns orange and sweeps right, writing "hercovahealth" behind it, lands as the full stop, and
 *         "com" follows. A last dark wipe.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/SVGLoader.js';
import { Shot, V3, renderer, clamp, lerp, seg, spring, ease, bump, track } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo5 = T.vo.find((v) => v.id === 'vo5');
const vo6 = T.vo.find((v) => v.id === 'vo6');
const w5 = (i) => vo5.at + (WORDS.vo5 ? WORDS.vo5[i][1] : i * 0.4);
const w6 = (i) => vo6.at + (WORDS.vo6 ? WORDS.vo6[i][1] : i * 0.4);
const LAND = spring(150, 15);
const POP = spring(260, 13);

export function end() {
  const [a, b] = T.shots.end;
  const shot = new Shot('end', { fov: 30, background: '#f4f0fa' });
  const S = shot.scene;
  const lights = studio(S, { env: 1.0, key: 2.2, rim: 1.2, hemi: 0.5, keyPos: [-5, 7, 12], shadowBox: 8 });
  renderer.localClippingEnabled = true;
  /* ---------------------------------------------------------------- the mark */
  const markG = new THREE.Group();
  S.add(markG);
  const clip = new THREE.Plane(new V3(0, -1, 0), 0); // reveals the arc from the bottom up
  const arcMat = new THREE.MeshPhysicalMaterial({ color: '#7b2fa8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, clippingPlanes: [clip] });
  const figMat = MAT.orange(0.12);
  track(fetch('assets/images/logo-mark.svg').then((r) => r.text()).then((src) => {
    const data = new SVGLoader().parse(src);
    const k = 3.0 / 524;
    data.paths.forEach((p) => {
      const isArc = (p.color && p.color.getHexString() === '7b2fa8');
      const shapes = SVGLoader.createShapes(p);
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 26, bevelEnabled: true, bevelThickness: 5, bevelSize: 3.5, bevelSegments: 5, curveSegments: 10 });
      geo.translate(-125.5, -262, -13);
      const m = new THREE.Mesh(geo, isArc ? arcMat : figMat);
      m.scale.set(k, -k, k);
      m.castShadow = true;
      m.userData.arc = isArc;
      markG.add(m);
    });
  }));
  markG.position.set(-3.2, 0.35, 0);
  const wordmark = type3d('HerCova', { weight: 800, size: 1.05, depth: 0.26, bevel: 0.03, tracking: -0.035, material: new THREE.MeshPhysicalMaterial({ color: '#7b2fa8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }) });
  wordmark.group.position.set(-2.05, 0.05, 0);
  S.add(wordmark.group);
  const tag = [['Care', 0], ['that', 1], ['reaches', 2], ['her,', 3], ['anywhere.', 4]];
  const tagG = new THREE.Group();
  tagG.position.set(-2.95, -1.45, 0.2);
  S.add(tagG);
  let x = 0;
  const tags = tag.map(([w, i]) => {
    const t3 = type3d(w, { weight: 700, size: 0.3, depth: 0.07, bevel: 0.01, tracking: -0.01, material: MAT.ink() });
    t3.group.position.x = x;
    x += t3.width + 0.14;
    tagG.add(t3.group);
    return { t3, at: w5(i) - 0.05 };
  });

  /* ---------------------------------------------------------------- the sting */
  S.add(shot.camera);
  const panel = (color) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, toneMapped: false })); m.renderOrder = 10; m.material.depthTest = false; shot.camera.add(m); return m; };
  const dark = panel('#1b1233'), light = panel('#f4f0fa'), darkOut = panel('#1b1233');
  const stingG = new THREE.Group();
  S.add(stingG);
  const inkMat = MAT.ink();
  const p1 = type3d('hercovahealth', { weight: 800, size: 0.64, depth: 0.16, bevel: 0.018, tracking: -0.02, material: inkMat });
  const p2 = type3d('com', { weight: 800, size: 0.64, depth: 0.16, bevel: 0.018, tracking: -0.02, material: inkMat });
  const DOT_W = 0.5;
  const total = p1.width + DOT_W + p2.width;
  p1.group.position.x = -total / 2;
  p2.group.position.x = -total / 2 + p1.width + DOT_W;
  stingG.add(p1.group, p2.group);
  const dotX = -total / 2 + p1.width + DOT_W / 2;
  const pillMat = new THREE.MeshPhysicalMaterial({ color: '#9b94ad', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const pill = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 16, 48), pillMat);
  pill.rotation.z = Math.PI / 2;
  stingG.add(pill);
  const ORANGE = new THREE.Color('#ee7b1e'), GREY = new THREE.Color('#9b94ad');

  const tDark = w6(0) - 0.4, tLight = tDark + 0.3, tPill = tLight + 0.2, tSweep = w6(3) - 0.02, tDot = w6(5), tCom = w6(6) - 0.12, tOut = b - 0.45;
  const sweepEnd = tSweep + 0.85;

  // the wipes and the sweep move fast: more shutter samples there, so their edges smear smoothly
  shot.samplesAt = (t) => ([tDark, tLight, tOut].some((w) => t > w - 0.05 && t < w + 0.4) || (t > tPill && t < sweepEnd + 0.1) ? 17 : 7);
  shot.update = (t) => {
    const k = seg(t, a, a + 1.4, 'expo.out');
    shot.pose([lerp(1.5, 0.1, k), lerp(0.8, 0.3, k), lerp(9.5, 11.5, k)], [lerp(-0.6, 0.1, k), lerp(0.2, 0, k), 0], 30);
    shot.lens.focus = 11.2;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.1;
    // the mark: the arc rises into being, the figure springs in, the lockup settles
    const rise = seg(t, a + 0.1, a + 0.9, 'power3.inOut');
    clip.constant = lerp(-1.6, 1.8, rise) + markG.position.y;
    const fig = POP.at(t, a + 0.65);
    markG.children.forEach((m) => { if (!m.userData.arc) m.scale.set((3 / 524) * Math.max(fig, 0.001), (-3 / 524) * Math.max(fig, 0.001), (3 / 524) * Math.max(fig, 0.001)); });
    markG.rotation.y = lerp(-0.6, 0, seg(t, a, a + 1.4, 'expo.out'));
    wordmark.letters.forEach((l, i) => {
      const kk = LAND.at(t, a + 0.75 + i * 0.04);
      l.mesh.visible = kk > 0.001;
      l.mesh.scale.setScalar(Math.max(kk, 0.001));
      l.mesh.position.set(l.home.x - (1 - Math.min(kk, 1)) * 0.4, l.home.y, l.home.z);
    });
    tags.forEach((w) => w.t3.letters.forEach((l, i) => {
      const kk = LAND.at(t, w.at + i * 0.018);
      l.mesh.visible = kk > 0.001;
      l.mesh.scale.setScalar(Math.max(kk, 0.001));
      l.mesh.position.y = l.home.y + lerp(-0.2, 0, kk);
    }));
    // wipes: panels in front of the lens, sliding across
    const fw = 2 * 2.0 * Math.tan((15 * Math.PI) / 180) * (16 / 9) + 0.2, fh = 2 * 2.0 * Math.tan((15 * Math.PI) / 180) + 0.1;
    const wipe = (m, t0, fromRight, hold) => {
      const u = ease('power3.inOut')(clamp((t - t0) / 0.32));
      m.visible = t > t0 && (hold === undefined || t < hold);
      m.scale.set(fw, fh, 1);
      m.position.set((fromRight ? 1 : -1) * fw * (1 - u), 0, -2.0);
    };
    wipe(dark, tDark, true, tLight + 0.32);
    wipe(light, tLight, false);
    wipe(darkOut, tOut, true);
    // the stage behind the light panel: the mark gone, the sting laid out
    const stingOn = t > tLight + 0.3;
    markG.visible = wordmark.group.visible = tagG.visible = !stingOn;
    stingG.visible = stingOn;
    light.visible = light.visible && !stingOn;
    // the pill: slides in from the right and shrinks into a dot where the text will begin
    const pIn = ease('power3.out')(clamp((t - tPill) / 0.55));
    const shrink = ease('power3.inOut')(clamp((t - tPill - 0.3) / 0.45));
    const sweep = ease('power2.inOut')(clamp((t - tSweep) / (sweepEnd - tSweep)));
    const startX = -total / 2 - 0.1;
    let px = lerp(3.5, startX, pIn);
    px = lerp(px, dotX, sweep);
    const len = lerp(1.8, 0.0, shrink); // capsule body length → a sphere
    const r = lerp(0.42, 0.17, shrink);
    // a capsule of body length `len` and radius r (its geometry is radius 0.5, 2 long along local y); at
    // len 0 it is a sphere, sitting on the baseline like a full stop
    const land = 1 + 0.25 * bump(t, tDot, 0.07);
    pill.position.set(px, r * land, 0);
    pill.scale.set(2 * r * land, ((len + 2 * r) / 2) * land, 2 * r * land);
    pill.visible = t > tPill;
    pillMat.color.lerpColors(GREY, ORANGE, seg(t, tSweep - 0.2, tSweep + 0.1));
    pillMat.emissive.copy(ORANGE).multiplyScalar(0.15 * seg(t, tSweep, tSweep + 0.2));
    // letters appear as the dot passes them
    p1.letters.forEach((l) => {
      const lx = p1.group.position.x + l.home.x;
      const seen = sweep > 0 && px > lx;
      const kk = seen ? seg(t, tSweep + ((lx - startX) / (dotX - startX)) * (sweepEnd - tSweep) - 0.02, tSweep + ((lx - startX) / (dotX - startX)) * (sweepEnd - tSweep) + 0.25, 'power3.out') : 0;
      l.mesh.visible = kk > 0.001;
      l.mesh.scale.setScalar(Math.max(kk, 0.001));
      l.mesh.position.y = l.home.y + lerp(-0.25, 0, kk);
    });
    p2.letters.forEach((l, i) => {
      const kk = LAND.at(t, tCom + i * 0.05);
      l.mesh.visible = kk > 0.001;
      l.mesh.scale.setScalar(Math.max(kk, 0.001));
      l.mesh.position.x = l.home.x + lerp(-0.3, 0, Math.min(kk, 1));
    });
  };
  return shot;
}
