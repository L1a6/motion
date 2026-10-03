/*
 * 3 · HERCOVA (12.6 – 19.7 s). The 16-9 reference, full screen and alive: the fluted-glass gradient, the camera
 * pushing slowly into it. The voice's words morph into one another in the middle of the frame — letters the two
 * words share glide to their new places (a magic move), the rest blur out and in — and every morph lands with a
 * zoom punch and a lens warp. Her orange dot drops in as the full stop of "walks with her".
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, bump, spring, ease } from '../engine.js';
import { world } from '../kit/world.js';
import { textLayer, blurIn, blurOut } from '../kit/text.js';
import { shape } from '../kit/glass.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo2 = T.vo.find((v) => v.id === 'vo2');
const wAt = (i) => vo2.at + (WORDS.vo2 ? WORDS.vo2[i][1] : i * 0.5);
const DROP = spring(260, 12);

// which letters of a carry over into b: an in-order match (longest common subsequence), by character
function carry(a, b) {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i].toLowerCase() === b[j].toLowerCase() && a[i] !== ' ' ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = new Map();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i].toLowerCase() === b[j].toLowerCase() && a[i] !== ' ') { pairs.set(i, j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return pairs;
}

export function morph() {
  const [a, b] = T.shots.glass;
  const shot = new Shot('glass', { fov: 30, background: '#1b0b4a' });
  const W = world({ flutes: 13 });
  W.mesh.position.z = -6;
  shot.bg.add(W.mesh);

  const SIZE = 1.05;
  const seq = [
    { text: 'HerCova', at: wAt(0) - 0.12 },
    { text: 'walks with her', at: wAt(1) - 0.12, dot: true },
    { text: 'Watching.', at: wAt(4) - 0.12 },
    { text: 'Guiding.', at: wAt(5) - 0.12 },
    { text: 'Catching warning\nsigns early.', at: wAt(7) - 0.12 },
  ];
  const layers = seq.map((s) => {
    const l = textLayer(s.text, { size: s.text.includes('\n') ? SIZE * 0.82 : SIZE, weight: 800, align: 'center', lineHeight: 1.08 });
    l.mesh.position.set(0, s.text.includes('\n') ? 0.35 : -0.38, 0);
    shot.scene.add(l.mesh);
    return { ...s, l };
  });
  // a letter glides into the next word only when it travels a short way: long flights read as chaos, not a morph
  const maps = layers.slice(0, -1).map(() => new Map());
  Promise.all(layers.map((w) => w.l.ready)).then(() => layers.slice(0, -1).forEach((w, i) => {
    const nx = layers[i + 1];
    carry(w.text.replace(/\n/g, ''), nx.text.replace(/\n/g, '')).forEach((j, k) => {
      const A = w.l.letters[k], B = nx.l.letters[j];
      const dx = (B.hx + nx.l.mesh.position.x) - (A.hx + w.l.mesh.position.x);
      const dy = (B.hy + nx.l.mesh.position.y) - (A.hy + w.l.mesh.position.y);
      if (Math.hypot(dx, dy) < 1.4 && Math.abs(nx.l.size / w.l.size - 1) < 0.3) maps[i].set(k, j);
    });
  }));
  const dot = shape({ w: 0.24, h: 0.24, r: 0.12, color: '#ff9440', color2: '#ee7b1e', glow: 0.5, maxW: 1, maxH: 1 });
  shot.scene.add(dot.mesh);
  const MORPH = 0.5;

  shot.update = (t) => {
    // the camera pushes slowly into the glass; each morph lands with a punch
    const k = seg(t, a, b, 'sine.inOut');
    const punch = layers.reduce((s, w, i) => s + (i ? bump(t, w.at + 0.18, 0.12) : 0), 0);
    shot.pose([lerp(0.4, -0.3, k), lerp(0.15, -0.05, k), lerp(12.5, 10.2, k) - 0.35 * punch], [0, -0.1, 0], 30);
    shot.lens.focus = 11;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.03;
    shot.lens.warp = 0.08 + 0.22 * punch;
    shot.lens.vignette = 0.15 + 0.25 * punch;
    W.drift(t, { dark: 0, speed: 1.4, phase: 2.2 });
    W.u.uZoom.value = lerp(1.0, 1.25, k) + 0.05 * punch;

    layers.forEach((w, i) => {
      const prev = layers[i - 1], next = layers[i + 1];
      const pIn = clamp((t - w.at) / MORPH);       // this word arriving
      const pOut = next ? clamp((t - next.at) / MORPH) : 0; // this word leaving into the next
      const inMap = prev ? maps[i - 1] : null;     // prev letter → this letter
      const outMap = next ? maps[i] : null;        // this letter → next letter
      const carriedIn = new Set(inMap ? [...inMap.values()] : []);
      let li = 0;
      w.l.all((l) => {
        const idx = li++;
        if (t < w.at - 0.001 && !(i === 0)) return { alpha: 0 };
        if (i === 0 && t < w.at) return { alpha: 0 };
        // arriving: a carried letter is drawn by the previous word until the morph completes
        if (carriedIn.has(idx) && pIn < 1) return { alpha: 0 };
        let st = carriedIn.has(idx) ? { alpha: 1 } : blurIn(clamp((t - w.at - (i ? 0.16 : 0) - idx * 0.014) / 0.38), { rise: 0.26, blur: 4, scale: 0.9 });
        // leaving
        if (next && t >= next.at) {
          if (outMap.has(idx)) {
            // glide to where this letter lives in the next word
            const j = outMap.get(idx);
            const dst = next.l.letters[j];
            const e = ease('power3.inOut')(pOut);
            if (pOut >= 1) return { alpha: 0 };
            const dx = (dst.hx + next.l.mesh.position.x) - (l.hx + w.l.mesh.position.x);
            const dy = (dst.hy + next.l.mesh.position.y) - (l.hy + w.l.mesh.position.y);
            const sc = next.l.size / w.l.size;
            return { x: dx * e, y: dy * e + Math.sin(Math.PI * e) * 0.18, sx: lerp(1, sc, e), sy: lerp(1, sc, e), blur: Math.sin(Math.PI * e) * 1.2, alpha: 1 };
          }
          st = { ...st, ...blurOut(clamp((t - next.at - idx * 0.005) / 0.18), { rise: 0.22, blur: 4 }) };
        }
        return st;
      });
    });
    // her dot: the full stop of "walks with her", dropping in, then leaving with the word
    const w1 = layers[1];
    const last = w1.l.letters[w1.l.letters.length - 1];
    const dIn = DROP.at(t, w1.at + 0.55);
    const dOut = seg(t, layers[2].at, layers[2].at + 0.3, 'power2.in');
    dot.mesh.visible = dIn > 0.001 && dOut < 1 && !!last;
    if (last) dot.mesh.position.set(last.hx + last.w * 0.22 + 0.14, w1.l.mesh.position.y + 0.12 + lerp(1.4, 0, Math.min(1, dIn)), 0.02);
    dot.set({ w: 0.24 * Math.min(1, dIn * 1.4) * (1 - dOut), h: 0.24 * Math.min(1, dIn * 1.4) * (1 - dOut), r: 0.12 });
  };
  return shot;
}
