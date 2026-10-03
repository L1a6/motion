/*
 * 4 · WHAT IT DOES (19.5 – 25.2 s). The List-16-9 reference in HerCova's own words (the site's feature names):
 * a drum of crisp white words turning in the night side of the world, tilted in space. Words rolling away blur and
 * fade with their distance from the front (the reference's blur effect); the arriving word lands with an elastic
 * stretch; the arrow, built from clean shapes, nudges each time.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, spring, ease } from '../engine.js';
import { world } from '../kit/world.js';
import { textLayer } from '../kit/text.js';
import { shape } from '../kit/glass.js';

const T = window.HC_T;
const ITEMS = ['Danger-sign screening', 'Pregnancy monitoring', 'Education & guidance', 'Healthcare alerts', 'Faster referral', 'Follow-up', 'Personalised support', 'Accessible care'];
const ELASTIC = spring(230, 10);
const STEP = 0.62;
const ARC = (20 * Math.PI) / 180;
const R = 4.8;

export function drum() {
  const [a, b] = T.shots.drum;
  const shot = new Shot('drum', { fov: 30, background: '#0d0326' });
  const W = world({ flutes: 13 });
  W.mesh.position.z = -10;
  shot.bg.add(W.mesh);

  const rig = new THREE.Group();
  rig.rotation.set(0.0, -0.32, 0.06);
  rig.position.set(-1.9, 0, 0);
  shot.scene.add(rig);
  const wheel = new THREE.Group();
  wheel.position.z = -R;
  rig.add(wheel);

  const steps = Math.floor((b - a - 0.6) / STEP);
  const stepAt = (k) => a + 0.45 + k * STEP;
  const slots = [];
  for (let i = -5; i <= steps + 5; i++) {
    const g = new THREE.Group();
    const alpha = -i * ARC;
    g.position.set(0, Math.sin(alpha) * R, Math.cos(alpha) * R);
    g.rotation.x = -alpha;
    const w = textLayer(ITEMS[((i % ITEMS.length) + ITEMS.length) % ITEMS.length], { size: 0.62, weight: 800 });
    g.add(w.mesh);
    wheel.add(g);
    slots.push({ i, g, w });
  }
  // the arrow: a shaft and a chevron, crisp at any size
  const arrowG = new THREE.Group();
  const shaft = shape({ w: 0.5, h: 0.075, r: 0.0375, maxW: 0.7, maxH: 0.2 });
  const up = shape({ w: 0.3, h: 0.075, r: 0.0375, maxW: 0.4, maxH: 0.2 });
  const dn = shape({ w: 0.3, h: 0.075, r: 0.0375, maxW: 0.4, maxH: 0.2 });
  up.mesh.position.set(0.15, 0.085, 0); up.mesh.rotation.z = -0.72;
  dn.mesh.position.set(0.15, -0.085, 0); dn.mesh.rotation.z = 0.72;
  arrowG.add(shaft.mesh, up.mesh, dn.mesh);
  arrowG.position.set(-0.75, 0.2, 0.02);
  rig.add(arrowG);

  const angleAt = (t) => { let n = 0; for (let k = 0; k < steps; k++) n += ease('back.out(1.5)')(clamp((t - stepAt(k)) / 0.42)); return n; };

  shot.update = (t) => {
    const k = seg(t, a, b, 'sine.inOut');
    shot.pose([lerp(0.4, -0.3, k), lerp(0.3, -0.1, k), lerp(11.8, 10.6, k)], [0.3, 0, -0.5], 30);
    shot.lens.focus = 10;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.03;
    W.drift(t, { dark: 0.62, phase: 3.1, speed: 0.8 });
    const n = angleAt(t);
    wheel.rotation.x = -n * ARC;
    const front = Math.round(n);
    const landed = front === 0 ? -1e9 : stepAt(front - 1);
    slots.forEach((sl) => {
      const off = sl.i - n; // 0 at the front
      sl.g.visible = Math.abs(off) <= 3.4;
      if (!sl.g.visible) return;
      const fade = clamp(1 - Math.abs(off) * 0.32);
      sl.w.all((l, j) => {
        const st = { alpha: 0.25 + 0.75 * fade ** 2, blur: Math.min(5, Math.abs(off) * 1.9) };
        if (sl.i === front && front > 0) {
          const e = ELASTIC.at(t, landed + 0.08 + j * 0.012);
          const sy = Math.max(0.6 + 0.4 * e, 0.001);
          st.sy = sy; st.sx = 1 / Math.sqrt(sy);
        }
        return st;
      });
    });
    const nudge = Array.from({ length: steps }, (_, k2) => Math.max(0, Math.sin(Math.PI * clamp((t - stepAt(k2) - 0.28) / 0.3)))).reduce((x, y) => x + y, 0);
    arrowG.position.x = -0.75 + 0.12 * nudge;
  };
  return shot;
}
