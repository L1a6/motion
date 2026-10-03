/*
 * 1 · PULSE (0 – 3.9 s). Black. Her orange pearl ignites and beats with her heart; each beat sends a ring of
 * light out across the dark. A glass clock ring draws itself round her (trim path), its ticks spring in, a
 * comet laps it. "Every 7 minutes," arrives letter by letter in 3D with an echo trail.
 * The camera starts in macro on the pearl (shallow focus) and pulls back to reveal the clock.
 */
import * as THREE from 'three';
import { Shot, V3, TAU, clamp, lerp, seg, bump, spring, spline } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { makeTube, circle } from '../geo.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo1 = T.vo.find((v) => v.id === 'vo1');
const wAt = (i) => vo1.at + (WORDS.vo1 ? WORDS.vo1[i][1] : i * 0.4);
const beats = T.heartbeat.beats.map((b) => T.heartbeat.at + b);
const POP = spring(260, 14);
const LAND = spring(150, 15);

export function pulse() {
  const shot = new Shot('pulse', { fov: 32, background: '#050309' });
  const S = shot.scene;
  studio(S, { env: 0.9, key: 1.6, rim: 1.4, hemi: 0.15, shadow: false });

  // a faint violet haze far behind, so the dark has depth
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.ShaderMaterial({
    depthWrite: false, toneMapped: false,
    uniforms: { c: { value: new THREE.Color('#2b1a52') }, k: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 c; uniform float k; varying vec2 vUv; void main() { float d = length((vUv - 0.5) * vec2(1.8, 1.0)); gl_FragColor = vec4(c * k * exp(-d * d * 9.0), 1.0); }',
  }));
  haze.position.z = -30;
  S.add(haze);

  // her pearl
  const pearlMat = MAT.orange(0.08);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 64, 48), pearlMat);
  S.add(pearl);
  // the heartbeat's light: a ring per beat, spreading across the dark
  const ripMat = MAT.light('#b99cf2', 1.1);
  const ripples = beats.filter((b) => b < T.ring[1]).map((b) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.004, 8, 160), ripMat.clone());
    m.material.transparent = true;
    S.add(m);
    return { m, at: b };
  });

  // the clock: a glass ring with a line of light inside it, 60 porcelain ticks, a comet with a tail
  const R = 1.55;
  const ring = new THREE.Group();
  ring.rotation.x = -0.32;
  S.add(ring);
  const RN = 360;
  const circ = circle(R, RN);
  const glass = makeTube(RN, 20, MAT.glass({ thickness: 0.3, attenuationColor: '#e7dcff', attenuationDistance: 1.2 }));
  glass.update(circ, 0.075);
  ring.add(glass.mesh);
  const core = makeTube(RN, 8, MAT.light('#cdb6ff', 1.25));
  core.update(circ, 0.009);
  ring.add(core.mesh);
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.porcelain(), 60);
  ring.add(ticks);
  const comet = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 24), MAT.light('#ffffff', 3));
  ring.add(comet);
  const TN = 90;
  const tail = makeTube(TN, 10, MAT.light('#c9a8ff', 2.2));
  ring.add(tail.mesh);
  const tailPts = Array.from({ length: TN }, () => new V3());

  // "Every 7 minutes," — 3D type with an echo trail
  const typeMat = MAT.gloss('#f4eefc');
  const sevenMat = MAT.light('#c7a6ff', 1.15);
  const words = [
    { text: 'Every', at: wAt(0) - 0.08 },
    { text: '7', at: wAt(1) - 0.08, mat: sevenMat },
    { text: 'minutes,', at: wAt(2) - 0.08 },
  ];
  const line = new THREE.Group();
  line.position.set(0, -2.22, 0.4);
  S.add(line);
  let x = 0;
  const built = words.map((w) => {
    const t = type3d(w.text, { weight: 700, size: 0.34, depth: 0.12, bevel: 0.012, tracking: -0.01, material: w.mat || typeMat });
    t.group.position.x = x;
    x += t.width + 0.2;
    line.add(t.group);
    // echoes: three fainter copies that trail the letters in on their way
    const echoes = [0.06, 0.12, 0.18].map((lag, i) => {
      const e = type3d(w.text, { weight: 700, size: 0.34, depth: 0.12, bevel: 0.012, tracking: -0.01, material: MAT.light('#b99cf2', 0.55 - i * 0.15), castShadow: false });
      e.group.position.copy(t.group.position);
      line.add(e.group);
      return { e, lag };
    });
    return { ...w, t, echoes };
  });
  const lineW = x - 0.2;
  line.position.x = -lineW / 2;

  const CAM = spline([
    { t: 0.0, v: [0.35, 0.12, 1.25, 0, 0, 0, 34] },
    { t: 1.2, v: [0.25, 0.2, 2.6, 0, -0.1, 0, 33] },
    { t: 2.3, v: [-0.4, 0.45, 7.3, 0, -0.55, 0, 32] },
    { t: 3.4, v: [-0.55, 0.5, 7.7, 0, -0.58, 0, 32] },
    { t: 3.9, v: [0, 0.1, 2.0, 0, 0, 0, 40] },
  ]);
  const FOC = spline([
    { t: 0, v: [1.2, 22] }, { t: 1.2, v: [2.5, 14] }, { t: 2.3, v: [7.4, 3] }, { t: 3.4, v: [7.8, 2.5] }, { t: 3.9, v: [2, 2] },
  ]);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3();
  const Z = new V3(0, 0, 1);

  shot.update = (t) => {
    const c = CAM(t);
    shot.pose([c[0], c[1], c[2]], [c[3], c[4], c[5]], c[6]);
    const f = FOC(t);
    shot.lens.focus = f[0];
    shot.lens.aperture = f[1];
    shot.lens.bloom = 0.55;

    haze.material.uniforms.k.value = 0.55 * seg(t, 0.2, 2.2, 'sine.inOut');
    // the pearl ignites, then beats
    const ig = POP.at(t, T.ignite);
    const beat = beats.reduce((s, b) => s + 0.22 * bump(t, b + 0.05, 0.07), 0);
    pearl.scale.setScalar(Math.max(ig * (1 + beat), 0.001));
    pearlMat.emissiveIntensity = 0.08 + 1.1 * beat + 0.9 * bump(t, T.ignite + 0.1, 0.12);
    ripples.forEach((r) => {
      const a = (t - r.at) / 1.4;
      r.m.visible = a > 0 && a < 1;
      if (!r.m.visible) return;
      r.m.scale.setScalar(0.35 + 4.2 * (1 - (1 - a) ** 3));
      r.m.material.opacity = 0.55 * (1 - a) ** 2;
      r.m.quaternion.copy(shot.camera.quaternion);
    });

    // the ring draws itself; ticks spring in behind the pen; the comet laps
    const rp = seg(t, T.ring[0], T.ring[1], 'power3.inOut');
    glass.trim(0, rp);
    core.trim(0, rp);
    glass.mesh.visible = core.mesh.visible = rp > 0.001;
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + (i / 60) * TAU;
      const g = LAND.at(t, T.ring[0] + (i / 60) * (T.ring[1] - T.ring[0]) * 0.9 + 0.05);
      const major = i % 5 === 0;
      const len = major ? 0.2 : 0.1;
      _p.set(Math.cos(a) * (R + 0.2 + len / 2), Math.sin(a) * (R + 0.2 + len / 2), 0);
      _q.setFromAxisAngle(Z, a);
      _s.set(len * g + 1e-4, (major ? 0.035 : 0.022) * g + 1e-4, 0.03 * g + 1e-4);
      ticks.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    ticks.instanceMatrix.needsUpdate = true;
    const lapT = clamp((t - T.ring[1] + 0.2) / (3.4 - T.ring[1] + 0.2));
    const q = 1 - (1 - lapT) ** 2.2;
    const ang = -Math.PI / 2 + q * 2.5 * TAU;
    const on = seg(t, T.ring[1] - 0.2, T.ring[1] + 0.1);
    comet.visible = tail.mesh.visible = on > 0.01;
    comet.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0);
    comet.scale.setScalar(Math.max(on, 0.001));
    const arc = 0.35 + 1.4 * (1 - lapT);
    for (let i = 0; i < TN; i++) { const a = ang - (i / (TN - 1)) * arc; tailPts[i].set(Math.cos(a) * R, Math.sin(a) * R, 0); }
    tail.update(tailPts, (i) => 0.03 * on * (1 - i / (TN - 1)) ** 1.6 + 1e-4);

    // type: each letter rises into place on a spring; its echoes trail behind in depth
    built.forEach((w) => {
      w.t.letters.forEach((l, i) => {
        const t0 = w.at + i * 0.035;
        const k = LAND.at(t, t0);
        l.mesh.visible = t > t0;
        l.mesh.position.set(l.home.x, l.home.y + lerp(-0.35, 0, k), l.home.z + lerp(0.8, 0, k));
        l.mesh.rotation.x = lerp(-0.9, 0, k);
        l.mesh.scale.setScalar(Math.max(k, 0.001));
      });
      w.echoes.forEach(({ e, lag }) => {
        e.letters.forEach((l, i) => {
          const t0 = w.at + i * 0.035 + lag;
          const k = LAND.at(t - lag, w.at + i * 0.035);
          const vis = t > t0 - lag && t < w.at + 0.55 + i * 0.035 + lag;
          l.mesh.visible = vis;
          l.mesh.position.set(l.home.x, l.home.y + lerp(-0.35, 0, k), l.home.z + lerp(0.8, 0, k) - lag * 3.2);
          l.mesh.rotation.x = lerp(-0.9, 0, k);
          l.mesh.scale.setScalar(Math.max(k * (1 - seg(t, w.at + 0.3 + lag, w.at + 0.55 + lag)), 0.001));
        });
      });
    });
    // everything but the pearl gives way as we crash through the ring
    const out = seg(t, 3.45, 3.85, 'power2.in');
    line.visible = out < 1;
    line.position.y = -2.22 - out * 1.5;
  };
  shot.pearlWorld = () => pearl.getWorldPosition(new V3());
  return shot;
}
