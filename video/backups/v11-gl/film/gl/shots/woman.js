/*
 * 2 · A WOMAN (3.4 – 13.0 s). Out of the 7: her silhouette, held in a rounded glass frame floating in the world;
 * the frame grows to full bleed (shape morph). A frosted card slides over the window light: "a woman in Nigeria /
 * dies in pregnancy or childbirth." Then the photograph breaks into blocks — each carries its piece of the picture
 * — that tumble out into the violet world and land as the glossy pillars of Nigeria. Her orange pearl flies to
 * her own pin; her heartbeat swells across the country; one pillar goes dark and sinks. A glass card counts, on
 * an odometer: about 200 women a day. A crash zoom into her pin.
 */
import * as THREE from 'three';
import { Shot, V3, TAU, clamp, lerp, seg, bump, spring, spline, hash, ease, loadTexture } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { world } from '../kit/world.js';
import { textLayer, blurIn } from '../kit/text.js';
import { glassCard, shape } from '../kit/glass.js';

const T = window.HC_T;
const NG = window.NIGERIA;
const WORDS = window.HERCOVA_WORDS || {};
const vo1 = T.vo.find((v) => v.id === 'vo1');
const wAt = (i) => vo1.at + (WORDS.vo1 ? WORDS.vo1[i][1] : i * 0.4);
const LAND = spring(150, 15);
const SLIDE = spring(130, 17);

const FOV = 30, D = 5.4 / Math.tan((FOV / 2) * (Math.PI / 180));
const wx = (px) => (px - 960) / 100, wy = (py) => (540 - py) / 100;
const COLS = 48, ROWS = 27, TS = 0.4;
const HEART = new V3(wx(975), wy(452), 0.25);

export function woman() {
  const [a] = T.shots.woman;
  const shot = new Shot('woman', { fov: FOV, background: '#14052f' });
  const W = world({ flutes: 13, w: 64, h: 36 });
  W.mesh.position.z = -16;
  shot.bg.add(W.mesh);
  studio(shot.scene, { env: 0.7, key: 1.5, rim: 1.2, hemi: 0.25, keyPos: [-8, 14, 12], shadow: false });

  /* ---------------------------------------------------------------- the photograph, in its frame */
  const photoTex = loadTexture('assets/stock/woman-silhouette-16x9.jpg');
  const frameU = { map: { value: null }, uSize: { value: new THREE.Vector2(8, 4.5) }, uR: { value: 0.6 }, uFull: { value: new THREE.Vector2(19.2, 10.8) }, uEdge: { value: 1 } };
  photoTex.then((tex) => { frameU.map.value = tex; });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: frameU, toneMapped: false, transparent: true, depthWrite: false,
    vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D map; uniform vec2 uSize, uFull; uniform float uR, uEdge;
      float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 p = (vUv - 0.5) * uFull;
        float d = sdRound(p, uSize * 0.5, uR);
        float aa = fwidth(d);
        float a = 1.0 - smoothstep(-aa, aa, d);
        if (a < 0.002) discard;
        vec3 c = texture(map, vUv).rgb;
        c += (1.0 - smoothstep(0.0, 0.045, -d)) * 0.4 * uEdge; // a hairline of light on the frame's edge
        o = vec4(c, a);
      }`,
  }));
  photo.renderOrder = 1;
  shot.bg.add(photo);

  /* ---------------------------------------------------------------- the blocks */
  const tileMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  photoTex.then((tex) => { tileMat.map = tex; tileMat.needsUpdate = true; });
  tileMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTile = { value: new THREE.Vector2(1 / COLS, 1 / ROWS) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUvOff;\nattribute float aMix;\nvarying float vMix;\nuniform vec2 uTile;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = aUvOff + uv * uTile;\n#endif\nvMix = aMix;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMix;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 photoCol = diffuseColor.rgb;\ndiffuseColor.rgb = vec3(vMix);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += photoCol * (1.0 - vMix);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= vMix;\nmaterial.specularColor *= vMix;\nmaterial.specularF90 *= vMix;');
  };
  tileMat.customProgramCacheKey = () => 'photo-tiles-v4';
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
  blocks.frustumCulled = false;
  shot.scene.add(blocks);

  /* ---------------------------------------------------------------- Nigeria, floating in the world, tilted back */
  const MS = 0.82;
  const mapG = new THREE.Group();
  mapG.position.set(3.0, -1.3, 2.0);
  mapG.rotation.x = -1.05;
  shot.scene.add(mapG);
  const local = (nx, ny) => new V3(((nx - NG.w / 2) / 100) * MS, -((ny - NG.h / 2) / 100) * MS, 0);
  const dots = NG.dots.map(([x, y], i) => ({ i, x, y, L: local(x, y), her: Math.abs(x - NG.her[0]) < 0.5 && Math.abs(y - NG.her[1]) < 0.5, lost: Math.abs(x - NG.lost[0]) < 0.5 && Math.abs(y - NG.lost[1]) < 0.5 }));
  const herDot = dots.find((d) => d.her), lostDot = dots.find((d) => d.lost);
  const byRow = (p, q) => (Math.floor(p.y / 30) - Math.floor(q.y / 30)) || (p.x - q.x);
  const dSorted = dots.filter((d) => !d.her).sort(byRow);
  const tSorted = [...tiles].sort((p, q) => (p.r - q.r) || (p.c - q.c));
  const step = tSorted.length / dSorted.length;
  dSorted.forEach((d, k) => { tSorted[Math.min(tSorted.length - 1, Math.floor(k * step))].dot = d; });
  tiles.forEach((t) => {
    const dh = t.S.distanceTo(HEART);
    t.d0 = T.shatter + 0.055 * dh + 0.2 * hash(t.i, 7);
    t.dur = 1.15 + 0.45 * hash(t.i, 8);
    t.lift = new V3((hash(t.i, 3) - 0.5) * 3.5, 1.5 + 3.5 * hash(t.i, 4), 2.5 + 4.5 * hash(t.i, 5));
    t.axis = new V3(hash(t.i, 21) - 0.5, hash(t.i, 22) - 0.5, hash(t.i, 23) - 0.5).normalize();
    t.turns = TAU * (1 + Math.floor(hash(t.i, 12) * 2)) * (hash(t.i, 13) > 0.5 ? 1 : -1);
    if (t.dot) t.rise = T.tilt[0] + 0.25 + 0.07 * t.dot.L.distanceTo(herDot.L);
  });
  const pearlMat = MAT.orange(0.35);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 48, 36), pearlMat);
  shot.scene.add(pearl);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24), MAT.orange(0.2));
  pin.rotation.x = Math.PI / 2;
  mapG.add(pin);
  const lostRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 8, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }));
  mapG.add(lostRing);
  const PULSES = [T.tilt[1] + 0.1, T.tilt[1] + 0.95, T.tilt[1] + 1.8];
  const swell = (d, t) => PULSES.reduce((s, p0) => { const q = t - p0; if (q < 0) return s; const ph = d - q * 6; return s + Math.exp(-ph * ph * 1.6) * Math.exp(-q * 0.6); }, 0);

  /* ---------------------------------------------------------------- her words, on frosted glass over the window */
  const card = glassCard({ w: 6.2, h: 2.1, r: 0.42, blur: 5, tint: 0.55, rim: 0.45, refract: 0.02, shadow: 0.22 });
  card.group.position.set(5.0, 2.55, 0.6);
  shot.scene.add(card.group);
  const l1 = textLayer('a woman in Nigeria', { size: 0.5, weight: 800, color: '#16141a' });
  const l2 = textLayer('dies in pregnancy or childbirth.', { size: 0.34, weight: 500, color: '#3d3b42' });
  l1.mesh.position.set(-2.75, 0.18, 0.02);
  l2.mesh.position.set(-2.75, -0.5, 0.02);
  card.group.add(l1.mesh, l2.mesh);

  /* ---------------------------------------------------------------- the count: a glass card riding with the camera */
  shot.scene.add(shot.camera);
  const stat = glassCard({ w: 4.6, h: 3.6, r: 0.4, blur: 5.5, tint: 0.16, rim: 0.5, refract: 0.02, shadow: 0.3 });
  stat.group.position.set(-4.05, 0.35, -15);
  shot.camera.add(stat.group);
  const about = textLayer('About', { size: 0.34, weight: 700, color: '#ffffff' });
  about.mesh.position.set(-1.9, 1.05, 0.02);
  // the odometer: each column is 0–9 and a trailing 0, rolled so the value's row sits in the window
  const ODO = 1.25;
  const digitCols = [0, 1, 2].map((k) => {
    const col = textLayer('0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0', { size: ODO, weight: 800, color: '#ffffff', lineHeight: 1.0 });
    col.mesh.position.set(-1.95 + k * 0.82, -0.15, 0.02);
    return col;
  });
  const cap1 = textLayer('women die in pregnancy or', { size: 0.2, weight: 500, color: '#f1eaff' });
  const cap2 = textLayer('childbirth in Nigeria, every day.', { size: 0.2, weight: 500, color: '#f1eaff' });
  cap1.mesh.position.set(-1.9, -0.72, 0.02);
  cap2.mesh.position.set(-1.9, -0.98, 0.02);
  const srcPill = shape({ w: 2.3, h: 0.34, r: 0.17, color: '#ffffff', maxW: 3, maxH: 0.6 });
  srcPill.mesh.position.set(-0.75, -1.42, 0.02);
  const src = textLayer('WHO and partners, 2025', { size: 0.15, weight: 700, color: '#ffffff', align: 'center' });
  src.mesh.position.set(-0.75, -1.47, 0.03);
  stat.group.add(about.mesh, ...digitCols.map((c) => c.mesh), cap1.mesh, cap2.mesh, srcPill.mesh, src.mesh);
  const roll = (col, v, show, fade) => col.all((l) => {
    const row = l.line - v;
    return { y: v * ODO, alpha: clamp(1 - Math.abs(row) * 1.7) * show * fade, blur: Math.min(4, Math.abs(row) * 3) };
  });

  /* ---------------------------------------------------------------- the camera */
  const CAM = spline([
    { t: a, v: [0.3, 0.2, 5.5, 0.3, 0.2, 0, 44] },
    { t: a + 0.75, v: [0.1, 0.1, 25.0, 0.1, 0.1, 0, 30] },
    { t: a + 1.6, v: [0.0, 0.0, D - 0.15, 0.0, 0.0, 0, 30] },
    { t: T.shatter, v: [0.1, 0.1, D - 0.8, 0.12, 0.08, 0, 30] },
    { t: T.shatter + 0.9, v: [0.6, 1.2, 21.5, 1.0, -0.6, 1.5, 30] },
    { t: T.tilt[1], v: [-0.4, 3.4, 17.6, 1.6, -1.4, 1.8, 30] },
    { t: T.dive[0], v: [-0.1, 3.7, 16.8, 1.8, -1.4, 1.9, 30] },
  ]);
  const IDQ = new THREE.Quaternion();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qg = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _E = new V3(), _C = new V3(), _N = new V3();
  const herTop = new V3();
  const qb = (p0, c, p1, u, out) => out.set(0, 0, 0).addScaledVector(p0, (1 - u) ** 2).addScaledVector(c, 2 * (1 - u) * u).addScaledVector(p1, u * u);

  shot.update = (t) => {
    W.drift(t, { dark: 0.22, phase: 1.3 });
    mapG.updateMatrixWorld(true);
    _qg.copy(mapG.quaternion);
    _N.set(0, 0, 1).applyQuaternion(_qg); // the map's up
    // her pin, then her pearl (the dive reads it)
    const hh = 1.4 * LAND.at(t, T.tilt[0] + 0.1);
    pin.visible = hh > 0.01;
    pin.position.copy(herDot.L).setZ(hh / 2);
    pin.scale.set(0.03, Math.max(hh, 0.001), 0.03);
    const pu = ease('power3.inOut')(clamp((t - (T.shatter + 0.1)) / 1.5));
    _E.copy(herDot.L).setZ(hh + 0.17);
    mapG.localToWorld(_E);
    _C.addVectors(HEART, _E).multiplyScalar(0.5).add(new V3(0.5, 3, 3));
    qb(HEART, _C, _E, pu, pearl.position);
    const beat = PULSES.reduce((s, p0) => s + 0.25 * bump(t, p0, 0.07), 0) + 0.3 * bump(t, T.lost + 0.28, 0.08);
    pearl.visible = t > T.shatter - 0.05;
    pearl.scale.setScalar(1 + beat);
    pearlMat.emissiveIntensity = 0.35 + 1.2 * beat;
    herTop.copy(pearl.position);

    // camera, with the crash into her pin at the end
    const c = CAM(t);
    const p = new V3(c[0], c[1], c[2]), l = new V3(c[3], c[4], c[5]);
    let fov = c[6];
    const e4 = seg(t, T.dive[0], T.dive[1] + 0.05, 'power4.in');
    if (e4 > 0) { p.lerp(herTop.clone().addScaledVector(_N, 0.45), e4); l.lerp(herTop, clamp(e4 * 1.6)); fov = lerp(fov, 50, e4); }
    shot.pose(p.toArray(), l.toArray(), fov);
    shot.lens.focus = 18;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.07;

    // the frame: a card in the world, then full bleed; gone the moment the blocks take over
    const grow = seg(t, a + 0.55, a + 1.45, 'expo.inOut');
    frameU.uSize.value.set(lerp(8.2, 19.3, grow), lerp(5.6, 10.9, grow));
    frameU.uR.value = lerp(0.7, 0.0, grow);
    frameU.uEdge.value = 1 - grow;
    photo.visible = t < T.shatter;

    // blocks: hidden until the shatter (the photograph is exactly them), then a tumbling flight, then pillars
    blocks.visible = t >= T.shatter - 0.001;
    for (const b of tiles) {
      const u = ease('power3.inOut')(clamp((t - b.d0) / b.dur));
      let white = clamp((u - 0.35) / 0.4);
      if (!b.dot) {
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
      let h = lerp(0.12, 0.26 + 0.55 * swell(d.L.distanceTo(herDot.L), t) + 0.1 * hash(b.i, 31), rise * u);
      let foot = 0.15;
      if (d.lost) { const lo = seg(t, T.lost, T.lost + 0.7, 'power2.out'); h *= 1 - lo; foot *= 1 - lo; white *= 1 - seg(t, T.lost - 0.1, T.lost + 0.05); }
      _E.copy(d.L).setZ(h / 2);
      mapG.localToWorld(_E);
      _C.addVectors(b.S, _E).multiplyScalar(0.5).add(b.lift);
      qb(b.S, _C, _E, u, _p);
      _qa.setFromAxisAngle(b.axis, b.turns * u);
      _q.slerpQuaternions(IDQ, _qg, u).multiply(_qa);
      _s.set(lerp(TS, foot, u), lerp(TS, foot, u), lerp(0.1, h, u));
      blocks.setMatrixAt(b.i, _m.compose(_p, _q, _s));
      mix[b.i] = white;
    }
    blocks.instanceMatrix.needsUpdate = true;
    mixAttr.needsUpdate = true;
    const rip = clamp((t - T.lost) / 1.4);
    lostRing.visible = t > T.lost && rip < 1;
    lostRing.position.copy(lostDot.L).setZ(0.02);
    lostRing.scale.setScalar(0.08 + 1.4 * ease('expo.out')(rip));
    lostRing.material.opacity = 0.7 * (1 - rip);

    // her words: the card slides in, the words blur in on the voice; it lifts away at the shatter
    const ci = SLIDE.at(t, wAt(3) - 0.35);
    const co = seg(t, T.shatter - 0.25, T.shatter + 0.15, 'power2.in');
    card.group.visible = ci > 0.001 && co < 1;
    card.group.position.set(5.0 + (1 - Math.min(ci, 1)) * 2.5, 2.55 + co * 1.5, 0.6 + co * 2);
    card.u.uOpacity.value = clamp(ci * 2) * (1 - co);
    card.u.uSheen.value = lerp(-5, 5, seg(t, wAt(3), wAt(3) + 1.2, 'power2.inOut'));
    l1.all((le, j) => { const b0 = blurIn(clamp((t - wAt(3) + 0.05 - j * 0.02) / 0.45)); return { ...b0, alpha: b0.alpha * (1 - co) }; });
    l2.all((le, j) => { const b0 = blurIn(clamp((t - wAt(7) + 0.05 - j * 0.012) / 0.45)); return { ...b0, alpha: b0.alpha * (1 - co) }; });

    // the count card
    const si = SLIDE.at(t, T.count[0] - 0.45);
    const so = seg(t, T.dive[0] - 0.1, T.dive[0] + 0.2, 'power2.in');
    stat.group.visible = si > 0.001 && so < 1;
    stat.group.position.x = -4.05 - (1 - Math.min(si, 1)) * 3;
    stat.u.uOpacity.value = clamp(si * 2) * (1 - so);
    stat.u.uSheen.value = lerp(-4, 4, seg(t, T.count[0], T.count[0] + 1.4, 'power2.inOut'));
    // the count rolls on frame boundaries only (the shutter never blends two numbers)
    const n = 200 * seg(Math.round(t * 30) / 30, T.count[0], T.count[1] + 0.2, 'expo.out');
    // a true odometer: a digit only advances while the one to its right rolls from 9 to 0
    const ones = n % 10, carry1 = clamp(ones - 9);
    const tensI = Math.floor(n / 10) % 10, carry2 = tensI === 9 ? carry1 : 0;
    roll(digitCols[0], Math.floor(n / 100) + carry2, clamp((n - 90) / 10), 1 - so);
    roll(digitCols[1], tensI + carry1, clamp((n - 6) / 4), 1 - so);
    roll(digitCols[2], ones, 1, 1 - so);
    const fadeIn = (lay, at) => lay.all((le, j) => { const b0 = blurIn(clamp((t - at - j * 0.01) / 0.4)); return { ...b0, alpha: b0.alpha * (1 - so) }; });
    fadeIn(about, T.count[0] - 0.2);
    fadeIn(cap1, T.count[0] + 0.3);
    fadeIn(cap2, T.count[0] + 0.4);
    fadeIn(src, T.count[0] + 0.6);
    srcPill.u.uA.value = 0.18 * clamp((t - T.count[0] - 0.55) / 0.3) * (1 - so);
  };
  shot.herTop = herTop;
  return shot;
}
