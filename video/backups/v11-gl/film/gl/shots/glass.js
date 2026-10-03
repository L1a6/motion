/*
 * 3 · HERCOVA (12.6 – 19.7 s). Out of the crash zoom into her pin: the fluted-glass world (the 16-9 reference,
 * built for real — a wall of glass flutes refracting drifting violet, blue and lilac light behind it). The
 * words of the voice-over stand at different depths; each lands with an elastic stretch, then the camera
 * crashes through it (the letters break round the lens: zoom + warp) to the next. The period of "her." is her
 * orange pearl.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, spring, spline, hash } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo2 = T.vo.find((v) => v.id === 'vo2');
const wAt = (i) => vo2.at + (WORDS.vo2 ? WORDS.vo2[i][1] : i * 0.5);
const ELASTIC = spring(210, 9); // a loose spring: the stretch overshoots and settles, like AE's elastic
const PEARL = spring(300, 14);
const GAP = 12;

export function glass() {
  const shot = new Shot('glass', { fov: 32, background: '#0b0620', far: 160 });
  const S = shot.scene;
  studio(S, { env: 1.1, key: 1.4, rim: 1.6, hemi: 0.2, shadow: false });

  // the light behind the glass: soft drifting blobs in the brand's violet family and a clear blue
  const back = new THREE.Mesh(new THREE.PlaneGeometry(260, 150), new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float t; varying vec2 vUv;
      vec3 blob(vec3 col, vec2 p, vec2 c, float r, vec3 bc, float k) { vec2 d = (p - c) * vec2(1.7, 1.0); return mix(col, bc, k * exp(-dot(d, d) / (r * r))); }
      void main() {
        vec2 p = vUv;
        vec3 col = vec3(0.035, 0.012, 0.11);
        col = blob(col, p, vec2(0.30 + 0.10 * sin(t * 0.55), 0.50 + 0.08 * cos(t * 0.43)), 0.30, vec3(0.10, 0.22, 0.95), 0.95);
        col = blob(col, p, vec2(0.62 + 0.12 * cos(t * 0.37), 0.46 + 0.10 * sin(t * 0.61)), 0.27, vec3(0.78, 0.60, 1.00), 0.9);
        col = blob(col, p, vec2(0.78 + 0.08 * sin(t * 0.71 + 1.3), 0.60 + 0.07 * cos(t * 0.29)), 0.22, vec3(0.36, 0.06, 0.52), 0.85);
        col = blob(col, p, vec2(0.48 + 0.09 * sin(t * 0.33 + 2.1), 0.40 + 0.09 * sin(t * 0.47 + 0.4)), 0.14, vec3(0.03, 0.01, 0.12), 0.9);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  back.position.z = -5 * GAP - 22;
  S.add(back);

  // the fluted glass: one sheet of semicircular flutes, its normals doing the refraction
  const FP = 1.1; // flute pitch
  const wall = new THREE.PlaneGeometry(90, 60, 1600, 1);
  const pos = wall.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = (((x / FP) % 1) + 1) % 1 - 0.5; // −0.5 … 0.5 across a flute
    pos.setZ(i, Math.sqrt(Math.max(0, 0.25 - u * u)) * FP * 0.55);
  }
  wall.computeVertexNormals();
  const flutes = new THREE.Mesh(wall, MAT.glass({ roughness: 0.14, thickness: 1.6, ior: 1.5, iridescence: 0.2 }));
  flutes.position.z = -5 * GAP - 10;
  S.add(flutes);

  // the words, each on its own plane in depth
  // bright, clean faces: a little self-light so white reads white against the dark glass
  const white = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#ffffff', emissiveIntensity: 0.1 });
  const lilac = new THREE.MeshPhysicalMaterial({ color: '#e2d0ff', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#c9adff', emissiveIntensity: 0.1 });
  const specs = [
    { lines: ['HerCova'], at: wAt(0) - 0.1, size: 0.92, mat: white },
    { lines: ['walks with her'], at: wAt(1) - 0.1, size: 0.6, mat: white, pearl: true },
    { lines: ['Watching.'], at: wAt(4) - 0.1, size: 0.86, mat: lilac },
    { lines: ['Guiding.'], at: wAt(5) - 0.1, size: 0.86, mat: lilac },
    { lines: ['Catching warning', 'signs early.'], at: wAt(7) - 0.1, size: 0.6, mat: white },
  ];
  const words = specs.map((sp, k) => {
    const g = new THREE.Group();
    g.position.z = -k * GAP;
    S.add(g);
    const lines = sp.lines.map((txt, j) => {
      const w = type3d(txt, { weight: 800, size: sp.size, depth: sp.size * 0.22, bevel: sp.size * 0.025, tracking: -0.025, material: sp.mat, align: 'center', castShadow: false });
      w.group.position.y = (sp.lines.length - 1) * sp.size * 0.72 - j * sp.size * 1.45;
      g.add(w.group);
      return w;
    });
    let pearl = null;
    if (sp.pearl) {
      const w = lines[0];
      pearl = new THREE.Mesh(new THREE.SphereGeometry(sp.size * 0.14, 40, 30), MAT.orange(0.3));
      pearl.position.set(w.width / 2 + sp.size * 0.2, -sp.size * 0.36, 0);
      g.add(pearl);
      g.children.forEach((c) => (c.position.x -= sp.size * 0.15));
    }
    return { ...sp, g, lines, pearl, k };
  });

  // the camera: a beat in front of each word, then a crash through it to the next
  const keys = [{ t: T.dive[0], v: [0, 0, 1.2, 0, 0, -10, 46] }];
  words.forEach((w, k) => {
    const z = -k * GAP + 8.5;
    const next = words[k + 1];
    keys.push({ t: w.at + 0.15, v: [0, 0.05, z, 0, 0, z - 10, 32] });
    keys.push({ t: (next ? next.at : w.at + 1.4) - 0.35, v: [0.05 * (k % 2 ? -1 : 1), 0.05, z - 0.7, 0, 0, z - 10.7, 32], hold: true });
  });
  keys.push({ t: T.shots.glass[1], v: [0, 0, -5 * GAP + 2, 0, 0, -5 * GAP - 10, 36] });
  const CAM = spline(keys);

  shot.update = (t) => {
    back.material.uniforms.t.value = t;
    const c = CAM(t);
    shot.pose([c[0], c[1], c[2]], [c[3], c[4], c[5]], c[6]);
    shot.lens.focus = 8.6;
    shot.lens.aperture = 2.2;
    shot.lens.bloom = 0.16;
    // a little lens warp while the camera is between words, strongest at the fastest point of a crash
    const vz = Math.abs(CAM(t + 0.02)[2] - CAM(t - 0.02)[2]) / 0.04;
    shot.lens.warp = clamp(vz / 60) * 0.25;
    shot.lens.vignette = clamp(vz / 60) * 0.35;

    words.forEach((w) => {
      const on = t > w.at - 0.05;
      w.g.visible = on;
      if (!on) return;
      let i = 0;
      w.lines.forEach((ln) => ln.letters.forEach((l) => {
        const t0 = w.at + 0.028 * i++;
        const k = ELASTIC.at(t, t0);
        l.mesh.visible = t > t0;
        // the elastic stretch: squash wide as it lands, stretch tall on the rebound, settle
        const sy = Math.max(k, 0.001), sx = Math.max(clamp(k * 1.6) / Math.sqrt(Math.max(k, 0.35)), 0.001); // volume kept
        l.mesh.scale.set(sx, sy, Math.max(k, 0.001));
        l.mesh.position.set(l.home.x, l.home.y + (1 - k) * -0.6, l.home.z + (1 - clamp(k)) * 1.2);
        l.mesh.rotation.y = (1 - clamp(k)) * (hash(l.index, w.k) - 0.5) * 1.2;
      }));
      if (w.pearl) { const k = PEARL.at(t, w.at + 0.55); w.pearl.scale.setScalar(Math.max(k, 0.001)); }
    });
  };
  return shot;
}
