/*
 * 7 · IN TIME (36.5 – 41.2 s). "And she reaches care, in time." A crash zoom OUT: the camera starts on the baby in
 * her arms and flies back to reveal a full-bleed portrait of a mother holding her child, toned into the film's own
 * light (deep indigo shadows, lilac-white highlights, through the reeded glass at the edges). The words build in the
 * light corner; "in time" lands big with an echo; her orange dot drops in as the full stop.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, spring, bump, loadTexture } from '../engine.js';
import { textLayer, blurIn } from '../kit/text.js';
import { shape } from '../kit/glass.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo4 = T.vo.find((v) => v.id === 'vo4');
const w4 = (i) => vo4.at + (WORDS.vo4 ? WORDS.vo4[i][1] : i * 0.4);
const ELASTIC = spring(220, 10);
const DROP = spring(260, 11);

export function time() {
  const [a, b] = T.shots.time;
  const shot = new Shot('time', { fov: 30, background: '#1b0b4a' });
  const D = 5.4 / Math.tan((15 * Math.PI) / 180);
  // the photograph, toned: its light mapped onto the brand's night → violet → lilac-white
  const u = { map: { value: null }, uK: { value: 1 } };
  loadTexture('assets/stock/mother-baby-16x9.jpg').then((tex) => { u.map.value = tex; });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: u, toneMapped: false,
    vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D map; uniform float uK;
      void main() {
        vec3 c = texture(map, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 night = vec3(0.05, 0.01, 0.17), violet = vec3(0.42, 0.2, 0.68), lilac = vec3(0.93, 0.89, 1.0);
        vec3 tone = l < 0.5 ? mix(night, violet, l * 2.0) : mix(violet, lilac, (l - 0.5) * 2.0);
        o = vec4(mix(c, tone, 0.82 * uK), 1.0);
      }`,
  }));
  shot.bg.add(photo);
  const BABY = new V3(1.54, 0.26, 0);

  const line1 = textLayer('And she reaches care,', { size: 0.42, weight: 700, color: '#ffffff' });
  line1.mesh.position.set(-8.6, 3.45, 0.4);
  const big = textLayer('in time', { size: 1.5, weight: 800, color: '#ffffff' });
  big.mesh.position.set(-8.65, 1.9, 0.4);
  const echoes = [0.06, 0.12, 0.18].map((lag, i) => { const e = textLayer('in time', { size: 1.5, weight: 800, color: '#cdb6ff' }); e.mesh.position.set(-8.65, 1.9, 0.3 - i * 0.05); e.lag = lag; return e; });
  const dot = shape({ w: 0.26, h: 0.26, r: 0.13, color: '#ff9440', color2: '#ee7b1e', glow: 0.5, maxW: 1, maxH: 1 });
  shot.scene.add(line1.mesh, big.mesh, ...echoes.map((e) => e.mesh), dot.mesh);
  const bigAt = w4(4) - 0.1;
  const wordStarts = [0, 1, 2, 3].map((i) => w4(i) - 0.06);

  shot.update = (t) => {
    // the crash zoom out: from the baby to the whole picture, fast, then a slow settle
    const k = seg(t, a, a + 0.75, 'expo.out');
    const drift = seg(t, a + 0.75, b, 'sine.inOut');
    const p = new V3().lerpVectors(new V3(BABY.x, BABY.y, 2.5), new V3(0.1, 0, D - 0.3), k);
    p.z -= 0.6 * drift;
    const l = new V3().lerpVectors(BABY, new V3(0.1, 0, 0), k);
    shot.pose(p.toArray(), l.toArray(), 30);
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.03;
    // the first line, word by word on the voice
    let wi = 0;
    line1.all((le, j) => {
      const prev = line1.letters[j - 1];
      if (j > 0 && prev && prev.space && !le.space) wi++;
      if (le.space) return { alpha: 0 };
      return blurIn(clamp((t - wordStarts[Math.min(wi, 3)] - j * 0.01) / 0.4), { rise: 0.2, blur: 4 });
    });
    // "in time": an elastic landing with echoes trailing
    big.all((le, j) => {
      const e = ELASTIC.at(t, bigAt + j * 0.03);
      const sy = Math.max(e, 0.001);
      return { sy, sx: Math.max(Math.min(1, e * 1.5) / Math.sqrt(Math.max(e, 0.4)), 0.001), y: (1 - Math.min(e, 1)) * -0.5, alpha: clamp(e * 2) };
    });
    echoes.forEach((e, i) => e.all((le, j) => {
      const s = ELASTIC.at(t - e.lag, bigAt + j * 0.03);
      const fade = 1 - seg(t, bigAt + 0.3 + e.lag, bigAt + 0.65 + e.lag);
      return { sy: Math.max(s * (1 + 0.12 * (i + 1)), 0.001), sx: Math.max(s, 0.001), alpha: (0.45 * fade * clamp(s * 2)) / (i + 1), blur: 1 + i };
    }));
    // her dot: the full stop
    const d = DROP.at(t, bigAt + 0.42);
    dot.mesh.visible = d > 0.001;
    dot.mesh.position.set(big.mesh.position.x + big.width + 0.2, big.mesh.position.y + 0.14 + lerp(2.2, 0, Math.min(1, d)), 0.45);
    const s = 0.26 * Math.min(1, d * 1.4) * (1 + 0.25 * bump(t, bigAt + 1.1, 0.08));
    dot.set({ w: s, h: s, r: s / 2 });
  };
  return shot;
}
