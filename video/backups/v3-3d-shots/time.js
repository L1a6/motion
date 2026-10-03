/*
 * 7 · IN TIME (36.5 – 41.2 s). "And she reaches care, in time." A crash zoom OUT: the camera starts on the
 * baby in her arms and flies back to reveal a sharp full-bleed portrait of a mother holding her child. The
 * words build in 3D on the light wall beside them; "in time." lands big with an echo trail, and her orange
 * pearl drops in as its full stop.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, spring, bump, loadTexture } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo4 = T.vo.find((v) => v.id === 'vo4');
const w4 = (i) => vo4.at + (WORDS.vo4 ? WORDS.vo4[i][1] : i * 0.4);
const LAND = spring(150, 15);
const DROP = spring(260, 11);

export function time() {
  const [a, b] = T.shots.time;
  const shot = new Shot('time', { fov: 30, background: '#9a9a9a' });
  const S = shot.scene;
  studio(S, { env: 1.0, key: 2.0, rim: 1.2, hemi: 0.4, keyPos: [-6, 6, 14], shadow: false });
  const D = 5.4 / Math.tan((15 * Math.PI) / 180);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  loadTexture('assets/stock/mother-baby-16x9.jpg').then((tex) => { photo.material.map = tex; photo.material.needsUpdate = true; });
  S.add(photo);
  const BABY = new V3(1.54, 0.26, 0); // the baby's face in the picture

  const ink = MAT.ink();
  const line1 = [
    { w: 'And', i: 0 }, { w: 'she', i: 1 }, { w: 'reaches', i: 2 }, { w: 'care,', i: 3 },
  ];
  const g1 = new THREE.Group();
  g1.position.set(-8.7, 3.55, 0.5);
  S.add(g1);
  let x = 0;
  const built1 = line1.map((it) => {
    const t3 = type3d(it.w, { weight: 700, size: 0.29, depth: 0.07, bevel: 0.009, tracking: -0.015, material: ink });
    t3.group.position.x = x;
    x += t3.width + 0.15;
    g1.add(t3.group);
    return { ...it, t3, at: w4(it.i) - 0.06 };
  });
  const big = type3d('in time', { weight: 800, size: 0.98, depth: 0.24, bevel: 0.028, tracking: -0.03, material: ink });
  big.group.position.set(-8.6, 2.05, 0.6);
  S.add(big.group);
  const echoes = [0.07, 0.14, 0.21].map((lag, i) => {
    const e = type3d('in time', { weight: 800, size: 0.98, depth: 0.24, bevel: 0.028, tracking: -0.03, material: MAT.light('#c9b3ee', 0.9 - i * 0.25), castShadow: false });
    e.group.position.copy(big.group.position);
    S.add(e.group);
    return { e, lag };
  });
  const bigAt = w4(4) - 0.08;
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 48, 36), MAT.orange(0.35));
  S.add(pearl);
  const pearlHome = new V3(-8.6 + big.width + 0.26, 2.05 - 0.49 + 0.16, 0.8);

  shot.update = (t) => {
    // the crash zoom out: from the baby to the whole picture, fast, then a slow settle
    const k = seg(t, a, a + 0.75, 'expo.out');
    const drift = seg(t, a + 0.75, b, 'sine.inOut');
    const p = new V3().lerpVectors(new V3(BABY.x, BABY.y, 2.5), new V3(0.1, 0, D - 0.3), k);
    p.z -= 0.6 * drift;
    const l = new V3().lerpVectors(BABY, new V3(0.1, 0, 0), k);
    shot.pose(p.toArray(), l.toArray(), 30);
    shot.lens.focus = p.z - 0.6;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.1;
    built1.forEach((w) => w.t3.letters.forEach((le, i) => {
      const kk = LAND.at(t, w.at + i * 0.02);
      le.mesh.visible = kk > 0.001;
      le.mesh.scale.setScalar(Math.max(kk, 0.001));
      le.mesh.position.y = le.home.y + lerp(-0.25, 0, kk);
    }));
    big.letters.forEach((le, i) => {
      const kk = LAND.at(t, bigAt + i * 0.035);
      le.mesh.visible = kk > 0.001;
      le.mesh.scale.setScalar(Math.max(kk, 0.001));
      le.mesh.position.set(le.home.x, le.home.y + lerp(-0.5, 0, kk), le.home.z + lerp(1.2, 0, kk));
    });
    echoes.forEach(({ e, lag }) => e.letters.forEach((le, i) => {
      const kk = LAND.at(t - lag, bigAt + i * 0.035);
      const fade = 1 - seg(t, bigAt + 0.35 + lag, bigAt + 0.7 + lag);
      le.mesh.visible = kk > 0.001 && fade > 0.01;
      le.mesh.scale.setScalar(Math.max(kk * fade, 0.001));
      le.mesh.position.set(le.home.x, le.home.y + lerp(-0.5, 0, kk), le.home.z + lerp(1.2, 0, kk) - lag * 4);
    }));
    // her pearl drops in as the full stop, and beats once
    const d = DROP.at(t, bigAt + 0.42);
    pearl.visible = d > 0.001;
    pearl.position.set(pearlHome.x, pearlHome.y + lerp(2.4, 0, Math.min(1, d)), pearlHome.z);
    pearl.scale.setScalar(Math.max(Math.min(1, d * 1.4), 0.001) * (1 + 0.2 * bump(t, bigAt + 1.1, 0.08)));
  };
  return shot;
}
