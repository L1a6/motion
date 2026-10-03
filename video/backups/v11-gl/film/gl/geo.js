// Shared geometry: a tube you can trim (After Effects' trim paths) and re-shape per frame, polyline resampling.
import * as THREE from 'three';
import { TAU, clamp } from './engine.js';

const V3 = THREE.Vector3;

export function makeTube(n, radial, material) {
  const pos = new Float32Array(n * radial * 3), nor = new Float32Array(n * radial * 3);
  const idx = [];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const na = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pa);
  geo.setAttribute('normal', na);
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const t = new V3(), nn = new V3(), bb = new V3(), dir = new V3(), up = new V3();
  function update(P, radius) {
    for (let i = 0; i < n; i++) {
      t.subVectors(P[Math.min(i + 1, n - 1)], P[Math.max(i - 1, 0)]);
      if (t.lengthSq() < 1e-12) t.set(1, 0, 0);
      t.normalize();
      if (i === 0) { up.set(0, 0, 1); if (Math.abs(t.dot(up)) > 0.9) up.set(0, 1, 0); nn.crossVectors(t, up).normalize(); }
      else { nn.addScaledVector(t, -nn.dot(t)); if (nn.lengthSq() < 1e-10) nn.set(0, 1, 0); nn.normalize(); }
      bb.crossVectors(t, nn);
      const r = typeof radius === 'function' ? radius(i) : radius;
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU;
        dir.copy(nn).multiplyScalar(Math.cos(a)).addScaledVector(bb, Math.sin(a));
        const k = (i * radial + j) * 3;
        pos[k] = P[i].x + dir.x * r; pos[k + 1] = P[i].y + dir.y * r; pos[k + 2] = P[i].z + dir.z * r;
        nor[k] = dir.x; nor[k + 1] = dir.y; nor[k + 2] = dir.z;
      }
    }
    pa.needsUpdate = true; na.needsUpdate = true;
  }
  function trim(a, b) {
    const s0 = Math.floor(clamp(a) * (n - 1)), s1 = Math.ceil(clamp(b) * (n - 1));
    geo.setDrawRange(s0 * radial * 6, Math.max(0, s1 - s0) * radial * 6);
  }
  return { mesh, update, trim, n };
}

export function resample(P, n, closed = false) {
  const pts = closed ? [...P, P[0]] : P;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const L = cum[cum.length - 1];
  const out = [];
  let j = 1;
  const count = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    const s = (i / count) * L;
    while (j < cum.length - 1 && cum[j] < s) j++;
    const f = (s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
    out.push(new V3().lerpVectors(pts[j - 1], pts[j], clamp(f)));
  }
  return out;
}

export const circle = (r, n, a0 = -Math.PI / 2) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU; return new V3(Math.cos(a) * r, Math.sin(a) * r, 0); });
