/*
 * 4 · WHAT IT DOES (19.5 – 25.2 s). The List-16-9 reference, in HerCova's words and in 3D: a drum of the
 * product's own feature names (from the site's content), tilted in space. It steps a word at a time with a
 * snappy overshoot; the arrow holds still; the word that arrives lands with an elastic stretch. The words
 * rolling away round the drum fall out of focus.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, spring, ease, hash } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const ITEMS = ['Danger-sign screening', 'Pregnancy monitoring', 'Education & guidance', 'Healthcare alerts', 'Faster referral', 'Follow-up', 'Personalised support', 'Accessible care'];
const ELASTIC = spring(230, 10);
const STEP = 0.62;              // seconds per word
const ARC = (21 * Math.PI) / 180; // drum angle between words
const R = 5.2;

export function drum() {
  const [a, b] = T.shots.drum;
  const shot = new Shot('drum', { fov: 30, background: '#f3edfa' });
  const S = shot.scene;
  const lights = studio(S, { env: 0.8, key: 2.2, rim: 0.8, hemi: 0.55, keyPos: [-6, 9, 12], shadowBox: 10 });

  const rig = new THREE.Group();
  rig.rotation.set(0.0, 0.34, -0.1);
  rig.position.set(-0.4, 0, 0);
  S.add(rig);
  const wheel = new THREE.Group();
  wheel.position.z = -R;
  rig.add(wheel);

  const ink = new THREE.MeshPhysicalMaterial({ color: '#16121c', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const active = new THREE.MeshPhysicalMaterial({ color: '#7b2fa8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, emissive: '#7b2fa8', emissiveIntensity: 0.15 });
  const steps = Math.floor((b - a - 0.6) / STEP);
  // one slot per word the drum will ever show: six above the first, six below the last
  const slots = [];
  for (let i = -6; i <= steps + 6; i++) {
    const text = ITEMS[((i % ITEMS.length) + ITEMS.length) % ITEMS.length];
    const g = new THREE.Group();
    const alpha = -i * ARC; // round the drum: later words wait below and roll up to the front
    g.position.set(0, Math.sin(alpha) * R, Math.cos(alpha) * R);
    g.rotation.x = -alpha;
    const w = type3d(text, { weight: 800, size: 0.44, depth: 0.14, bevel: 0.016, tracking: -0.02, material: ink });
    const wa = type3d(text, { weight: 800, size: 0.44, depth: 0.14, bevel: 0.016, tracking: -0.02, material: active });
    g.add(w.group, wa.group);
    wheel.add(g);
    slots.push({ i, g, w, wa });
  }
  // the arrow: fixed in space, pointing at the word on the front of the drum
  // (the brand face has no arrow glyph, so the arrow is drawn: a shaft and a head, extruded like the type)
  const ah = new THREE.Shape();
  ah.moveTo(-0.34, 0.045); ah.lineTo(0.12, 0.045); ah.lineTo(-0.02, 0.19); ah.lineTo(0.07, 0.19 + 0.0); ah.lineTo(0.3, 0);
  ah.lineTo(0.07, -0.19); ah.lineTo(-0.02, -0.19); ah.lineTo(0.12, -0.045); ah.lineTo(-0.34, -0.045); ah.closePath();
  const arrowGeo = new THREE.ExtrudeGeometry(ah, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.012, bevelSegments: 3 });
  arrowGeo.translate(0, 0, -0.07);
  const arrow = { group: new THREE.Mesh(arrowGeo, active) };
  arrow.group.position.set(-0.75, 0, 0);
  rig.add(arrow.group);

  const stepAt = (k) => a + 0.45 + k * STEP;
  const angleAt = (t) => {
    let n = 0;
    for (let k = 0; k < steps; k++) n += ease('back.out(1.4)')(clamp((t - stepAt(k)) / 0.42));
    return n;
  };

  shot.update = (t) => {
    // a slow drift of the whole rig, and the camera easing in
    const k = seg(t, a, b, 'sine.inOut');
    shot.pose([lerp(0.9, 0.2, k), lerp(0.35, -0.15, k), lerp(10.2, 9.0, k)], [0.9, 0, -0.4], 30);
    shot.lens.focus = shot.camera.position.distanceTo(new V3(0.9, 0, 0));
    shot.lens.aperture = 9;
    shot.lens.bloom = 0.12;
    const n = angleAt(t);
    wheel.rotation.x = -n * ARC;
    const front = Math.round(n); // the word on the front of the drum
    const landed = front === 0 ? -1e9 : stepAt(front - 1);
    slots.forEach((sl) => {
      sl.g.visible = Math.abs(sl.i - n) <= 3.6; // only the drum's face: nothing rolls round to the back
      const isActive = sl.i === front;
      sl.w.group.visible = !isActive;
      sl.wa.group.visible = isActive;
      if (!isActive) return;
      // the arriving word lands with an elastic stretch, letter by letter, keeping its volume
      sl.wa.letters.forEach((l, j) => {
        const e = ELASTIC.at(t, landed + 0.1 + j * 0.012);
        const sy = front === 0 ? 1 : Math.max(0.55 + 0.45 * e, 0.001);
        l.mesh.scale.set(1 / Math.sqrt(sy), sy, 1);
      });
    });
    // the arrow nudges forward each time a word lands
    const nudge = Array.from({ length: steps }, (_, k2) => Math.max(0, Math.sin(Math.PI * clamp((t - stepAt(k2) - 0.3) / 0.3)))).reduce((x, y) => x + y, 0);
    arrow.group.position.x = -0.75 + 0.12 * nudge;
  };
  return shot;
}
