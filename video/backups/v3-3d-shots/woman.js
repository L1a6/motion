/*
 * 2 · A WOMAN (3.4 – 13.0 s). Out of the crash zoom, her pearl is on her heart and the camera pulls back from
 * it: a sharp full-bleed silhouette of a pregnant woman at a window. "a woman in Nigeria / dies in pregnancy or
 * childbirth." set in dark 3D type over the window light. Then the photograph breaks into 3D blocks — each
 * carries its own piece of the picture — that burst outward from her heart, tumble through the air and land
 * on a lilac studio floor as the porcelain pillars of Nigeria. Her pearl flies to her own pin; her heartbeat
 * pulses across the country; one pillar sinks. "About 200 women a day." Then a crash zoom into her pin.
 */
import * as THREE from 'three';
import { Shot, V3, TAU, clamp, lerp, seg, bump, spring, spline, hash, ease, loadTexture } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const NG = window.NIGERIA;
const WORDS = window.HERCOVA_WORDS || {};
const vo1 = T.vo.find((v) => v.id === 'vo1');
const wAt = (i) => vo1.at + (WORDS.vo1 ? WORDS.vo1[i][1] : i * 0.4);
const LAND = spring(150, 15);
const POP = spring(260, 16);

const U = 100, FOV = 30;
const D = 5.4 / Math.tan((FOV / 2) * (Math.PI / 180));
const wx = (px) => (px - 960) / U, wy = (py) => (540 - py) / U;
const FLOOR = -5.4;
const COLS = 48, ROWS = 27, TS = 0.4; // the photograph as 48 × 27 blocks of 0.4 (40 px)
const HEART = new V3(wx(975), wy(452), 0.25);

export function woman() {
  const shot = new Shot('woman', { fov: FOV, background: '#d9c6ee' });
  const S = shot.scene;
  const lights = studio(S, { env: 0.9, key: 2.2, rim: 0.9, hemi: 0.45, keyPos: [-10, 16, 14], shadowBox: 14 });
  lights.key.target.position.set(0, FLOOR, 3);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: '#2a0f40', opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  floor.receiveShadow = true;
  S.add(floor);

  /* ---------------------------------------------------------------- the photograph, as blocks */
  const photo = loadTexture('assets/stock/woman-silhouette-16x9.jpg');
  const tileMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  photo.then((tex) => { tileMat.map = tex; tileMat.needsUpdate = true; });
  tileMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTile = { value: new THREE.Vector2(1 / COLS, 1 / ROWS) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUvOff;\nattribute float aMix;\nvarying float vMix;\nuniform vec2 uTile;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aUvOff + uv * uTile;\n#endif\nvMix = aMix;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMix;')
      // while it is still a photograph the block shows its piece of the picture, unlit; it becomes porcelain
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 photoCol = diffuseColor.rgb;\ndiffuseColor.rgb = vec3(vMix);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += photoCol * (1.0 - vMix);')
      // no gloss on the picture itself: reflections grow as the block turns to porcelain
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= vMix;\nmaterial.specularColor *= vMix;\nmaterial.specularF90 *= vMix;');
  };
  tileMat.customProgramCacheKey = () => 'photo-tiles';
  const tileGeo = new THREE.BoxGeometry(1, 1, 1);
  const N = COLS * ROWS;
  const uvOff = new Float32Array(N * 2), mix = new Float32Array(N);
  const tiles = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    uvOff[i * 2] = c / COLS; uvOff[i * 2 + 1] = 1 - (r + 1) / ROWS;
    tiles.push({ i, c, r, S: new V3(wx((c + 0.5) * 40), wy((r + 0.5) * 40), 0) });
  }
  tileGeo.setAttribute('aUvOff', new THREE.InstancedBufferAttribute(uvOff, 2));
  const mixAttr = new THREE.InstancedBufferAttribute(mix, 1).setUsage(THREE.DynamicDrawUsage);
  tileGeo.setAttribute('aMix', mixAttr);
  const blocks = new THREE.InstancedMesh(tileGeo, tileMat, N);
  blocks.castShadow = true;
  blocks.receiveShadow = true;
  blocks.frustumCulled = false;
  S.add(blocks);

  /* ---------------------------------------------------------------- Nigeria, on the floor */
  const MS = 0.9; // world units per 100 map units
  const MAPC = new V3(3.5, FLOOR, 3.4);
  const mapAt = (nx, ny) => new V3(MAPC.x + ((nx - NG.w / 2) / U) * MS, FLOOR, MAPC.z + ((ny - NG.h / 2) / U) * MS);
  const dots = NG.dots.map(([x, y], i) => ({ i, x, y, P: mapAt(x, y), her: Math.abs(x - NG.her[0]) < 0.5 && Math.abs(y - NG.her[1]) < 0.5, lost: Math.abs(x - NG.lost[0]) < 0.5 && Math.abs(y - NG.lost[1]) < 0.5 }));
  const herDot = dots.find((d) => d.her);
  const byRow = (a, b) => (Math.floor(a.y / 30) - Math.floor(b.y / 30)) || (a.x - b.x);
  const dSorted = dots.filter((d) => !d.her).sort(byRow);
  const tSorted = [...tiles].sort((a, b) => (a.r - b.r) || (a.c - b.c));
  // pair each block with a place in the country, top of the picture to the north
  const step = tSorted.length / dSorted.length;
  const used = new Set();
  dSorted.forEach((d, k) => { const t = tSorted[Math.min(tSorted.length - 1, Math.floor(k * step))]; t.dot = d; used.add(t.i); });
  tiles.forEach((t) => {
    t.spare = !used.has(t.i);
    const dh = t.S.distanceTo(HEART);
    t.d0 = T.shatter + 0.06 * dh + 0.18 * hash(t.i, 7);
    t.dur = 1.15 + 0.4 * hash(t.i, 8);
    t.lift = new V3((hash(t.i, 3) - 0.5) * 3, 1.5 + 3.5 * hash(t.i, 4), 2 + 4 * hash(t.i, 5));
    t.axis = new V3(hash(t.i, 21) - 0.5, hash(t.i, 22) - 0.5, hash(t.i, 23) - 0.5).normalize();
    t.turns = TAU * (1 + Math.floor(hash(t.i, 12) * 2)) * (hash(t.i, 13) > 0.5 ? 1 : -1);
    if (t.dot) t.rise = T.tilt[0] + 0.25 + 0.06 * t.dot.P.distanceTo(herDot.P);
  });

  // her pin and her pearl
  const pearlMat = MAT.orange(0.25);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 36), pearlMat);
  pearl.castShadow = true;
  S.add(pearl);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), MAT.orange(0.15));
  pin.castShadow = true;
  S.add(pin);
  const lostRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: '#2a2730', transparent: true, depthWrite: false }));
  lostRing.rotation.x = -Math.PI / 2;
  S.add(lostRing);
  const lostDot = dots.find((d) => d.lost);
  const PULSES = [T.tilt[1] + 0.1, T.tilt[1] + 0.95, T.tilt[1] + 1.8];
  const swell = (d, t) => PULSES.reduce((s, p0) => { const a = t - p0; if (a < 0) return s; const ph = d - a * 6; return s + Math.exp(-ph * ph * 1.6) * Math.exp(-a * 0.6); }, 0);

  /* ---------------------------------------------------------------- words */
  const ink = MAT.ink();
  const say = (text, at, x, y, size, weight = 700) => {
    const w = type3d(text, { weight, size, depth: 0.08, bevel: 0.01, tracking: -0.015, material: ink });
    w.group.position.set(x, y, 0.35);
    w.at = at;
    S.add(w.group);
    return w;
  };
  const lines = [
    say('a woman in Nigeria', wAt(3) - 0.05, wx(1200), wy(365), 0.4, 800),
    say('dies in pregnancy', wAt(7) - 0.05, wx(1202), wy(452), 0.28, 500),
    say('or childbirth.', wAt(10) - 0.05, wx(1202), wy(505), 0.28, 500),
  ];
  // the numbers ride with the camera, like a caption in the room
  S.add(shot.camera);
  const stat = new THREE.Group();
  const noShadow = (w) => w.letters.forEach((l) => (l.mesh.castShadow = false));
  stat.position.set(-3.05, 0.88, -7.2);
  stat.scale.setScalar(0.6);
  shot.camera.add(stat);
  const purple = MAT.purple();
  const about = type3d('About', { weight: 700, size: 0.46, depth: 0.1, bevel: 0.012, material: ink });
  stat.add(about.group);
  const digits = [0, 1, 2].map((k) => {
    const set = '0123456789'.split('').map((d) => {
      const w = type3d(d, { weight: 800, size: 1.3, depth: 0.3, bevel: 0.03, material: purple });
      w.group.position.set(0.55 + k * 1.02, -1.35, 0);
      stat.add(w.group);
      return w;
    });
    return set;
  });
  const caption = type3d('women die in pregnancy or childbirth', { weight: 500, size: 0.22, depth: 0.05, bevel: 0.006, material: ink });
  caption.group.position.set(0, -2.35, 0);
  const caption2 = type3d('in Nigeria, every day.', { weight: 500, size: 0.22, depth: 0.05, bevel: 0.006, material: ink });
  caption2.group.position.set(0, -2.72, 0);
  const source = type3d('WHO and partners, 2025', { weight: 500, size: 0.13, depth: 0.03, bevel: 0.004, material: MAT.gloss('#8e8b96') });
  source.group.position.set(0, -3.15, 0);
  stat.add(caption.group, caption2.group, source.group);
  [about, caption, caption2, source, ...digits.flat()].forEach(noShadow);

  /* ---------------------------------------------------------------- the camera */
  const H = HEART;
  const CAM = spline([
    { t: 3.4, v: [H.x, H.y, 2.2, H.x, H.y, 0, 44] },
    { t: 4.05, v: [0.02, 0.02, 19.85, 0.02, 0.02, 0, 30] },
    { t: T.shatter, v: [0.1, 0.12, 19.2, 0.12, 0.1, 0, 30] },
    { t: T.shatter + 0.9, v: [0.4, 2.6, 21.0, 0.8, -2.4, 2, 30] },
    { t: T.tilt[1], v: [-0.6, 5.6, 17.2, 1.4, -5.4, 2.6, 30] },
    { t: T.dive[0], v: [-0.2, 6.0, 16.4, 1.6, -5.4, 2.8, 30] },
  ]);
  const FOC = spline([{ t: 3.4, v: [2.2, 2] }, { t: 4.05, v: [15.5, 0] }, { t: T.shatter + 0.4, v: [19, 2] }, { t: T.tilt[1], v: [19.5, 5] }]);

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _E = new V3(), _C = new V3();
  const IDQ = new THREE.Quaternion();
  const herTop = new V3();
  const _qe = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); // a block lying on the floor, face up
  const qb = (a, c, b, u, out) => out.set(0, 0, 0).addScaledVector(a, (1 - u) ** 2).addScaledVector(c, 2 * (1 - u) * u).addScaledVector(b, u * u);

  shot.update = (t) => {
    // pin first: the dive reads it
    const hr = LAND.at(t, T.tilt[0] + 0.1);
    const hh = 1.5 * hr;
    const pearlOn = t >= 3.4;
    const pu = ease('power3.inOut')(clamp((t - (T.shatter + 0.1)) / 1.5));
    _E.copy(herDot.P).setY(FLOOR + hh + 0.2);
    _C.addVectors(HEART, _E).multiplyScalar(0.5).add(new V3(0.5, 3, 3));
    qb(HEART, _C, _E, pu, pearl.position);
    const beat = PULSES.reduce((s, p0) => s + 0.25 * bump(t, p0, 0.07), 0) + 0.3 * bump(t, T.lost + 0.28, 0.08);
    pearl.scale.setScalar(pearlOn ? 1 + beat : 0.001);
    pearlMat.emissiveIntensity = 0.25 + 1.2 * beat;
    herTop.copy(pearl.position);
    pin.visible = hh > 0.01;
    pin.position.set(herDot.P.x, FLOOR + hh / 2, herDot.P.z);
    pin.scale.set(0.035, Math.max(hh, 0.001), 0.035);

    // camera: the pull-back from her heart, the crane over the map, then the crash zoom into her pin
    const c = CAM(t);
    const p = new V3(c[0], c[1], c[2]), l = new V3(c[3], c[4], c[5]);
    let fov = c[6];
    const e4 = seg(t, T.dive[0], T.dive[1] + 0.05, 'power4.in');
    if (e4 > 0) { p.lerp(herTop.clone().add(new V3(0, 0.45, 0.25)), e4); l.lerp(herTop, clamp(e4 * 1.6)); fov = lerp(fov, 50, e4); }
    shot.pose(p.toArray(), l.toArray(), fov);
    const f = FOC(t);
    shot.lens.focus = e4 > 0 ? lerp(f[0], 0.6, e4) : f[0];
    shot.lens.aperture = f[1];
    shot.lens.bloom = 0.1;

    // blocks: a photograph until their moment, then a tumbling flight to their place, then porcelain pillars
    for (const b of tiles) {
      const u = ease('power3.inOut')(clamp((t - b.d0) / b.dur));
      let white = clamp((u - 0.35) / 0.4);
      if (!b.dot) {
        // no place in the country: it flies up and away, shrinking
        qb(b.S, b.S.clone().add(b.lift), b.S.clone().add(b.lift.clone().multiplyScalar(2.2)), u, _p);
        const k = 1 - clamp(u * 1.25);
        _qa.setFromAxisAngle(b.axis, b.turns * u);
        _s.set(TS * k + 1e-4, TS * k + 1e-4, 0.1 * k + 1e-4);
        blocks.setMatrixAt(b.i, _m.compose(_p, _qa, _s));
        mix[b.i] = white;
        continue;
      }
      const d = b.dot;
      const rise = ease('back.out(1.7)')(clamp((t - b.rise) / 0.6));
      let h = lerp(0.12, 0.22 + 0.55 * swell(d.P.distanceTo(herDot.P), t) + 0.1 * hash(b.i, 31), rise * u);
      let foot = 0.16;
      if (d.lost) { const lo = seg(t, T.lost, T.lost + 0.7, 'power2.out'); h *= 1 - lo; foot *= 1 - lo; white *= 1 - seg(t, T.lost - 0.1, T.lost + 0.05); }
      _E.copy(d.P).setY(FLOOR + h / 2);
      _C.addVectors(b.S, _E).multiplyScalar(0.5).add(b.lift);
      qb(b.S, _C, _E, u, _p);
      _qa.setFromAxisAngle(b.axis, b.turns * u);
      _q.slerpQuaternions(IDQ, _qe, u).multiply(_qa);
      // a flat tile of the picture becomes an upright pillar: its local z is the pillar's height
      _s.set(lerp(TS, foot, u), lerp(TS, foot, u), lerp(0.1, h, u));
      blocks.setMatrixAt(b.i, _m.compose(_p, _q, _s));
      mix[b.i] = white;
    }
    blocks.instanceMatrix.needsUpdate = true;
    mixAttr.needsUpdate = true;

    // the lost one: a dark ring spreads across the floor from where her pillar stood
    const rip = clamp((t - T.lost) / 1.4);
    lostRing.visible = t > T.lost && rip < 1;
    lostRing.position.set(lostDot.P.x, FLOOR + 0.02, lostDot.P.z);
    lostRing.scale.setScalar(0.1 + 1.6 * ease('expo.out')(rip));
    lostRing.material.opacity = 0.65 * (1 - rip);

    // words over the window: each letter lifts into place; at the shatter they fall away
    lines.forEach((w) => {
      w.letters.forEach((l, i) => {
        const t0 = w.at + i * 0.018;
        const k = LAND.at(t, t0);
        const fall = seg(t, T.shatter - 0.15 + i * 0.01, T.shatter + 0.45 + i * 0.01, 'power2.in');
        l.mesh.visible = t > t0 && fall < 1;
        l.mesh.position.set(l.home.x, l.home.y + lerp(-0.25, 0, k) - fall * 2.5, l.home.z + lerp(0.6, 0, k) + fall * 1.5);
        l.mesh.rotation.x = lerp(-1.1, 0, k) + fall * 2;
        l.mesh.scale.setScalar(Math.max(k * (1 - fall), 0.001));
      });
    });
    // the count
    // the count changes on frame boundaries only, so the shutter never blends two numbers
    const cu = seg(Math.round(t * 30) / 30, T.count[0], T.count[1], 'expo.out');
    const n = Math.round(200 * cu);
    const statOn = t > T.count[0] - 0.4;
    stat.visible = statOn && t < T.dive[0] + 0.2;
    const sIn = LAND.at(t, T.count[0] - 0.35);
    stat.position.y = 0.88 + lerp(-0.25, 0, sIn);
    stat.scale.setScalar(Math.max(0.6 * sIn, 0.001));
    const str = String(n).padStart(3, ' ');
    digits.forEach((set, k) => set.forEach((w, dgt) => (w.group.visible = str[k] === String(dgt) && !(k === 0 && str[0] === ' '))));
    [caption, caption2, source].forEach((w, j) => {
      const k2 = LAND.at(t, T.count[0] + 0.25 + j * 0.12);
      w.group.visible = k2 > 0.001;
      w.group.position.y = [-2.35, -2.72, -3.15][j] + lerp(-0.2, 0, k2);
      w.group.scale.setScalar(Math.max(k2, 0.001));
    });
  };
  shot.herTop = herTop;
  return shot;
}
