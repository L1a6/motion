/*
 * 1 · PULSE (0 – 3.9 s). The film opens inside its world: the fluted glass, in near-night, comes alive with her
 * heartbeat — every beat brightens the light behind the glass and sends a liquid-glass lens rippling out of her
 * orange dot, and the dot itself stretches into a pill and snaps back. "Every 7 minutes," blurs in letter by
 * letter; the 7 lands with an elastic bounce and an echo; then the camera crashes through the 7.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, bump, spring, spline } from '../engine.js';
import { world } from '../kit/world.js';
import { textLayer, blurIn } from '../kit/text.js';
import { glassCard, shape } from '../kit/glass.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo1 = T.vo.find((v) => v.id === 'vo1');
const wAt = (i) => vo1.at + (WORDS.vo1 ? WORDS.vo1[i][1] : i * 0.4);
const beats = T.heartbeat.beats.map((b) => T.heartbeat.at + b);
const POP = spring(320, 15);
const ELASTIC = spring(220, 9);

export function pulse() {
  const shot = new Shot('pulse', { fov: 30, background: '#12052e' });
  const W = world({ flutes: 13 });
  W.mesh.position.z = -8;
  shot.bg.add(W.mesh);

  // her dot, and the glass lenses each heartbeat sends out of it
  const dot = shape({ w: 0.34, h: 0.34, r: 0.17, color: '#ff9440', color2: '#ee7b1e', glow: 0.45, maxW: 3, maxH: 1.5 });
  dot.mesh.position.set(0, 0.95, 0.2);
  shot.scene.add(dot.mesh);
  const lenses = beats.slice(0, 4).map((b) => {
    const g = glassCard({ w: 1, h: 1, r: 0.5, blur: 2.5, tint: 0.05, rim: 0.6, refract: 0.05, shadow: 0 });
    g.group.position.set(0, 0.95, 0.05);
    shot.scene.add(g.group);
    return { g, at: b };
  });

  // "Every 7 minutes," in three layers, so the 7 can move on its own
  const SZ = 1.0;
  const every = textLayer('Every', { size: SZ, weight: 800, align: 'left' });
  const seven = textLayer('7', { size: SZ, weight: 800, align: 'center' });
  const minutes = textLayer('minutes,', { size: SZ, weight: 800, align: 'left' });
  const echoes = [0.06, 0.12, 0.18].map(() => textLayer('7', { size: SZ, weight: 800, align: 'center', color: '#cdb6ff' }));
  const LINE_Y = -0.85, GAP = 0.32;
  // centre the phrase on its measured widths once the face has loaded
  Promise.all([every.ready, seven.ready, minutes.ready]).then(() => {
    const sp = SZ * 0.24;
    const total = every.width + sp + seven.width + sp + minutes.width;
    every.mesh.position.set(-total / 2, LINE_Y, 0);
    seven.mesh.position.set(-total / 2 + every.width + sp + seven.width / 2, LINE_Y, 0.02);
    minutes.mesh.position.set(-total / 2 + every.width + sp + seven.width + sp, LINE_Y, 0);
    echoes.forEach((e) => { e.mesh.position.copy(seven.mesh.position); e.mesh.position.z = -0.05; });
  });
  [every, minutes, seven, ...echoes].forEach((l) => shot.scene.add(l.mesh));

  const CAM = spline([
    { t: 0, v: [0.0, 0.25, 12.6, 0, 0.1, 0, 30] },
    { t: 3.3, v: [-0.15, 0.1, 10.8, 0, 0.0, 0, 30] },
    { t: 3.9, v: [0, LINE_Y + 0.55, 0.9, 0, LINE_Y + 0.5, -2, 52] }, // through the 7
  ]);

  shot.update = (t) => {
    const c = CAM(t);
    const into = seg(t, 3.3, 3.9, 'power2.in') * seven.mesh.position.x; // crash into the 7 wherever it sits
    shot.pose([c[0] + into, c[1], c[2]], [c[3] + into, c[4], c[5]], c[6]);
    shot.lens.focus = 11;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.04;
    // the world: night lifting, breathing brighter on every beat
    const beat = beats.reduce((s, b) => s + bump(t, b + 0.06, 0.12), 0);
    W.drift(t, { dark: clamp(lerp(1, 0.18, seg(t, 0.2, 3.0, 'sine.inOut')) - 0.22 * beat) });
    W.u.uZoom.value = 1 + 0.04 * beat;
    // her dot: appears, then on each beat stretches into a pill and snaps back
    const k = POP.at(t, T.ignite);
    const stretch = beats.reduce((s, b) => s + bump(t, b + 0.03, 0.09), 0);
    dot.set({ w: 0.34 * k + 0.55 * stretch, h: 0.34 * k * (1 - 0.15 * stretch), r: 0.17 * k, a: k > 0.001 ? 1 : 0 });
    dot.u.uGlow.value = 0.45 + 0.9 * stretch;
    lenses.forEach(({ g, at }) => {
      const a = (t - at) / 1.1;
      g.group.visible = a > 0 && a < 1;
      if (!g.group.visible) return;
      const e = 1 - (1 - a) ** 3;
      const s = 0.4 + 3.4 * e;
      g.setSize(s, s, s / 2);
      g.u.uOpacity.value = (1 - a) ** 1.5;
      g.u.uRefract.value = 0.06 * (1 - a);
    });
    // words, on the voice
    const word = (layer, at) => layer.all((l, j) => ({ ...blurIn(clamp((t - at - j * 0.03) / 0.45), { rise: 0.35, blur: 5 }) }));
    word(every, wAt(0) - 0.12);
    word(minutes, wAt(2) - 0.12);
    const s7 = ELASTIC.at(t, wAt(1) - 0.1);
    seven.all(() => ({ sy: Math.max(s7, 0.001), sx: Math.max(Math.min(1, s7 * 1.4) / Math.sqrt(Math.max(s7, 0.4)), 0.001), y: (1 - Math.min(s7, 1)) * -0.4, alpha: clamp(s7 * 2) }));
    echoes.forEach((e, i) => {
      const lag = (i + 1) * 0.06;
      const s = ELASTIC.at(t - lag, wAt(1) - 0.1);
      const fade = 1 - seg(t, wAt(1) + 0.25 + lag, wAt(1) + 0.6 + lag);
      e.all(() => ({ sy: Math.max(s * (1 + 0.15 * (i + 1)), 0.001), sx: Math.max(s, 0.001), alpha: (0.5 * fade * clamp(s * 2)) / (i + 1), blur: 1 + i }));
    });
  };
  shot.pearlWorld = () => new V3(seven.mesh.position.x, LINE_Y + 0.5, 0);
  return shot;
}
