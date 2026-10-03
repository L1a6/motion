/*
 * HerCova — the opening in 3D (0 – 10 s). A lit lilac studio, rendered with Three.js.
 *
 *  1 heartbeat   her heartbeat races in as a glossy purple tube; the dot floor ripples on every beat;
 *                the tube draws her outline (shape morph) and an orange pearl lands on her heart
 *  2 her         her photograph fills the outline from her heart; a 3D "7" flies forward out of the
 *                depth (an echo reveal) on "seven"; a glass clock ring orbits her, a comet on it
 *  3 one of many the photograph breaks into tiles that tumble out and land as the pillars of Nigeria,
 *                while the glass ring morphs into the country's outline; her heartbeat pulses across
 *                the map; one pillar sinks
 *  4 dive        a crash zoom into her orange pin (true zoom blur, lens warp); the purple floods from it
 *
 * Deterministic: every value is a pure function of composition time t. film.js drives it from the
 * one GSAP clock (window.__hc3d.render(t, punch)); the scene never runs its own loop.
 *
 * Rendering (offline quality under the renderer and the lab; a light path in the interactive preview):
 *  - motion blur by accumulation: the scene is rendered at 7 instants across a 180° shutter and
 *    averaged, so fast things smear and tracked things stay sharp, as a real camera would see them
 *  - depth of field from the depth buffer (single-pass bokeh gather)
 *  - lens warp + a faint plum vignette only while the camera crashes forward
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/SVGLoader.js';

const T = window.HERCOVA_TIMING;
const WORDS = window.HERCOVA_WORDS || {};
const NG = window.NIGERIA;
const G7 = window.GLYPH7;
const PARTS = window.HERCOVA_PARTICLES;
const SIL = window.HERCOVA_SILHOUETTE;
const W = 1920, H = 1080;
const DPR = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
const OFFLINE = navigator.webdriver === true; // the renderer (and the lab) drive a headless browser
const V3 = THREE.Vector3;
const DEBUG = !!window.__HC3D_DEBUG;

/* ------------------------------------------------------------------ math (mirrors film.js) */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const EASES = {};
const ease = (n) => EASES[n] || (EASES[n] = gsap.parseEase(n));
const seg = (t, a, b, e = 'none') => ease(e)(clamp((t - a) / (b - a)));
const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
function hash(i, j) {
  let n = (i * 374761393 + j * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function spring(k = 170, c = 18, m = 1) {
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  const settle = Math.log(1000) / (z * w0);
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
  const f = (p) => {
    if (p >= 1) return 1;
    const s = p * settle;
    return z < 1 ? 1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + ((z * w0) / wd) * Math.sin(wd * s)) : 1 - Math.exp(-w0 * s) * (1 + w0 * s);
  };
  return { ease: f, duration: settle };
}
const POP = spring(300, 18);
const LAND = spring(120, 13); // a soft landing with one visible overshoot
const springAt = (sp, t, t0) => (t < t0 ? 0 : sp.ease(clamp((t - t0) / sp.duration)));
// C1-continuous keyframes (cubic Hermite, Catmull-Rom tangents over uneven times, at rest at the ends):
// the camera never changes speed abruptly
function spline(keys) {
  const n = keys.length;
  const tan = keys.map((k, i) => {
    if (i === 0 || i === n - 1 || k.hold) return k.v.map(() => 0);
    const a = keys[i - 1], b = keys[i + 1];
    return k.v.map((_, j) => (b.v[j] - a.v[j]) / (b.t - a.t));
  });
  return (t) => {
    if (t <= keys[0].t) return keys[0].v;
    if (t >= keys[n - 1].t) return keys[n - 1].v;
    let i = 0;
    while (keys[i + 1].t < t) i++;
    const k0 = keys[i], k1 = keys[i + 1], dt = k1.t - k0.t, s = (t - k0.t) / dt, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return k0.v.map((v0, j) => h00 * v0 + h10 * dt * tan[i][j] + h01 * k1.v[j] + h11 * dt * tan[i + 1][j]);
  };
}

/* ------------------------------------------------------------------ timing */
const S1 = T.s1, S2 = T.s2, S3 = T.s3, S4 = T.s4;
const beats = T.heartbeat.beats.map((b) => T.heartbeat.at + b);
const vo1 = T.vo.find((v) => v.id === 'vo1');
const wAt = (i) => vo1.at + (WORDS.vo1 ? WORDS.vo1[i][1] : i * 0.36);
const iris = S1.iris;
const OP = { reach: 0.95, close: beats[2], retract: [beats[2] + 0.04, beats[2] + 0.5], out: [iris[0] + 0.25, iris[1]] };
const DISS = S2.dissolve;
const sevenAt = wAt(1);
const RS = [DISS, DISS + 0.72];

/* ------------------------------------------------------------------ space
 * One world unit = 100 px on the z = 0 plane, seen from the frontal camera (fov 30, on +z): anything
 * laid out in screen pixels (her photograph, the particles baked from it) lands where the design put it. */
const U = 100;
const FOV = 30;
const D = (H / 2 / U) / Math.tan(((FOV / 2) * Math.PI) / 180);
const wx = (px) => (px - W / 2) / U;
const wy = (py) => (H / 2 - py) / U;
const FLOOR = -5.4;

/* ------------------------------------------------------------------ renderer */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // the post pass soft-clips highlights; the lilac ground stays exact
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const GROUND = new THREE.Color('#f3ebfa');
renderer.setClearColor(GROUND, 1);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.85;

scene.add(new THREE.HemisphereLight(0xffffff, 0xe7d9f4, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(-9, 17, 15);
key.target.position.set(2, FLOOR, -3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -21, right: 21, top: 17, bottom: -17, near: 1, far: 70 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.025;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xf6ecff, 1.4); // edge light from behind: it draws the tubes' silhouettes
rim.position.set(10, 7, -14);
scene.add(rim);

const NEAR = 0.1, FAR = 220;
const camera = new THREE.PerspectiveCamera(FOV, W / H, NEAR, FAR);

/* ------------------------------------------------------------------ materials */
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const MAT = {
  line: phys({ color: '#7b2fa8', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, emissive: '#7b2fa8', emissiveIntensity: 0.1, transparent: true }),
  pen: phys({ color: '#ffffff', roughness: 0.15, clearcoat: 1, emissive: '#ffffff', emissiveIntensity: 0.35 }),
  porcelain: phys({ color: '#ffffff', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.15 }),
  purple: phys({ color: '#7b2fa8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#7b2fa8', emissiveIntensity: 0.3 }),
  orange: phys({ color: '#ee7b1e', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, emissive: '#ee7b1e', emissiveIntensity: 0.25 }),
  glass: phys({ color: '#ffffff', transmission: 1, thickness: 0.4, roughness: 0.04, ior: 1.42, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.5, iridescenceIOR: 1.25, attenuationColor: '#e6d6f6', attenuationDistance: 1.8, specularIntensity: 1 }),
  slab: phys({ color: '#e6d8f4', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.2, transparent: true }),
  seven: phys({ color: '#7b2fa8', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true }),
  mark: new THREE.MeshBasicMaterial({ color: '#7b2fa8', transparent: true, depthWrite: false }),
};

/* ------------------------------------------------------------------ a tube you can trim and re-shape per frame */
function makeTube(n, radial, material) {
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
  mesh.castShadow = true;
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
// even arc-length resampling of a polyline (Vector3[]) to n points
function resample(P, n, closed = false) {
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
const sphere = (r, mat, seg = 40) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat); m.castShadow = true; return m; };

/* ======================================================================
   THE STUDIO · a shadow-catching floor and a dot grid that ripples on her heartbeat
   ====================================================================== */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ color: '#3d1152', opacity: 0.12 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR;
floor.receiveShadow = true;
scene.add(floor);

const E = SIL.E;
const X0 = -40;
const penX = (t) => lerp(X0, E[0], clamp(t / OP.reach));
const XC = penX(beats[0]);
const zOf = (x) => -7.5 * (1 - clamp((x - X0) / (E[0] - X0))) ** 2; // her line runs in from deep and arrives on her plane
const RIPS = [
  // [x, z, t, amp]: under the spike, under the pen, then her heart, then the 7 landing
  [wx(XC), zOf(XC), beats[0], 1], [wx(penX(beats[1])), 0, beats[1], 0.7], [wx(1420), 0, beats[2], 1],
  [wx(1420), 0, beats[3], 0.55], [wx(1420), 0, beats[4], 0.5], [wx(1040), -2.5, sevenAt + 0.3, 0.8],
];
const gridPts = [];
for (let x = -40; x <= 40; x += 0.8) for (let z = -60; z <= 14; z += 0.8) gridPts.push(x, FLOOR + 0.004, z);
const gridGeo = new THREE.BufferGeometry();
gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
const gridMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: { uTime: { value: 0 }, uRip: { value: RIPS.map((r) => new THREE.Vector4(...r)) }, uDpr: { value: DPR }, uColor: { value: new THREE.Color('#7b2fa8') }, uOpacity: { value: 1 } },
  vertexShader: /* glsl */ `
    uniform float uTime; uniform vec4 uRip[${RIPS.length}]; uniform float uDpr;
    varying float vA; varying float vGlow;
    void main() {
      vec3 p = position; float g = 0.0;
      for (int k = 0; k < ${RIPS.length}; k++) {
        vec4 r = uRip[k]; float age = uTime - r.z;
        if (age > 0.0 && age < 4.0) { float d = distance(p.xz, r.xy); float ph = d - age * 9.0; g += r.w * exp(-ph * ph * 0.7) * exp(-age * 0.8); }
      }
      p.y += g * 0.38;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float dist = -mv.z;
      gl_PointSize = uDpr * (3.2 + 3.6 * g) * 20.0 / dist;
      vA = clamp(1.0 - (dist - 14.0) / 40.0, 0.0, 1.0) * clamp((dist - 0.8) / 3.0, 0.0, 1.0);
      vGlow = clamp(g, 0.0, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uOpacity; varying float vA; varying float vGlow;
    void main() {
      float r = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.3, r) * vA * uOpacity * (0.3 + 0.7 * vGlow);
      if (a < 0.01) discard;
      gl_FragColor = vec4(uColor, a);
    }`,
});
const grid = new THREE.Points(gridGeo, gridMat);
grid.frustumCulled = false;
scene.add(grid);

/* ======================================================================
   1 · HER HEARTBEAT · a trim path in depth that becomes her outline
   ====================================================================== */
function ecg(d) {
  if (d < -150 || d > 200) return 0;
  if (d < -100) return 16 * Math.sin((Math.PI * (d + 150)) / 50);
  if (d < -40) return 0;
  if (d < -28) return (-16 * (d + 40)) / 12;
  if (d < 0) return lerp(-16, 210, (d + 28) / 28);
  if (d < 16) return lerp(210, -64, d / 16);
  if (d < 34) return lerp(-64, 0, (d - 16) / 18);
  if (d < 90) return 0;
  return 34 * Math.sin((Math.PI * (d - 90)) / 110);
}
const ecgAt = (x, v = new V3()) => v.set(wx(x), wy(E[1] - ecg(x - XC)), zOf(x));
const ecgRaw = [];
for (let x = X0; x <= E[0]; x += 1) ecgRaw.push(ecgAt(x));
const ecgCum = [0];
for (let i = 1; i < ecgRaw.length; i++) ecgCum.push(ecgCum[i - 1] + ecgRaw[i].distanceTo(ecgRaw[i - 1]));
const ecgFrac = (x) => { const i = clamp(Math.round(x - X0), 0, ecgRaw.length - 1); return ecgCum[i] / ecgCum[ecgCum.length - 1]; };
const ECG = resample(ecgRaw, 1400);
const ecgTube = makeTube(ECG.length, 14, MAT.line);
ecgTube.update(ECG, 0.055);
scene.add(ecgTube.mesh);

const silPts = (P) => resample(P.map(([x, y]) => new V3(wx(x), wy(y), 0)), Math.round(P.length * 1.5));
const SA = silPts(SIL.a), SB = silPts(SIL.b);
const silA = makeTube(SA.length, 14, MAT.line), silB = makeTube(SB.length, 14, MAT.line);
silA.update(SA, 0.046); silB.update(SB, 0.046);
scene.add(silA.mesh, silB.mesh);
const LA = SIL.a.length, LB = SIL.b.length;

const pen0 = sphere(0.11, MAT.pen), penA = sphere(0.09, MAT.pen), penB = sphere(0.09, MAT.pen), tail = sphere(0.055, MAT.line, 24);
scene.add(pen0, penA, penB, tail);
// her dot: an orange pearl on a porcelain puck, on her heart
const heart = new THREE.Group();
const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 64), MAT.porcelain);
puck.rotation.x = Math.PI / 2;
puck.castShadow = true;
const pearl = sphere(0.155, MAT.orange);
pearl.position.z = 0.1;
heart.add(puck, pearl);
heart.position.set(wx(SIL.heart[0]), wy(SIL.heart[1]), 0.06);
scene.add(heart);

function renderS1(t) {
  const on = t < iris[1] + 0.05;
  [ecgTube.mesh, silA.mesh, silB.mesh, pen0, penA, penB, tail].forEach((m) => (m.visible = on));
  const out = 1 - seg(t, OP.out[0], OP.out[1], 'power1.in');
  MAT.line.opacity = out;
  MAT.line.transparent = out < 1;
  if (on) {
    const hx = penX(t);
    const tx = lerp(X0, E[0], seg(t, OP.retract[0], OP.retract[1], 'power2.in'));
    const live = t > 0.01 && tx < E[0] - 2;
    ecgTube.mesh.visible = live;
    ecgTube.trim(ecgFrac(tx), ecgFrac(hx));
    pen0.visible = t > 0.02 && t < OP.reach + 0.03;
    ecgAt(hx, pen0.position);
    tail.visible = live && tx > X0 + 1;
    ecgAt(tx, tail.position);
    const p = seg(t, OP.reach, OP.close, 'power1.inOut');
    const fa = p, fb = Math.min(1, (p * LA) / LB);
    silA.mesh.visible = silB.mesh.visible = t > OP.reach;
    silA.trim(0, fa); silB.trim(0, fb);
    penA.visible = t > OP.reach && t < OP.close + 0.06;
    penB.visible = t > OP.reach && fb < 1;
    penA.position.copy(SA[Math.round(fa * (SA.length - 1))]);
    penB.position.copy(SB[Math.round(fb * (SB.length - 1))]);
  }
  const k = springAt(POP, t, OP.close);
  const beat = 1 + 0.2 * bump(t, beats[3], 0.05);
  const hs = k * beat * (1 - seg(t, iris[0] + 0.2, iris[0] + 0.45, 'power2.in'));
  heart.visible = hs > 0.001;
  heart.scale.setScalar(Math.max(hs, 0.001));
}

/* ======================================================================
   2 · HER · the photograph, the 7, the glass clock ring
   ====================================================================== */
const PHOTO = { x: 1040, y: 60, w: 800, h: 1000 };
const photoTex = new THREE.TextureLoader().load('assets/images/graded/hero-subject.png', () => window.__hcRenderNow && window.__hcRenderNow());
photoTex.colorSpace = THREE.SRGBColorSpace;
photoTex.anisotropy = 8;
const photoMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: photoTex }, heart: { value: new THREE.Vector2(SIL.heart[0] - PHOTO.x, SIL.heart[1] - PHOTO.y) }, radius: { value: 0 }, crumble: { value: 0 }, size: { value: new THREE.Vector2(PHOTO.w, PHOTO.h) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D map; uniform vec2 heart; uniform float radius; uniform float crumble; uniform vec2 size; varying vec2 vUv;
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(map, vUv);
      vec2 px = vec2(vUv.x * size.x, (1.0 - vUv.y) * size.y);
      float a = c.a * smoothstep(radius, radius - 4.0, distance(px, heart));
      // it breaks into the same 16 px tiles that fly out as voxels
      if (crumble > 0.0 && h21(floor(px / 16.0)) < crumble * 1.15 - 0.075) a = 0.0;
      if (a < 0.5) discard;
      gl_FragColor = vec4(c.rgb, 1.0);
      #include <colorspace_fragment>
    }`,
});
const photo = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO.w / U, PHOTO.h / U), photoMat);
photo.position.set(wx(PHOTO.x + PHOTO.w / 2), wy(PHOTO.y + PHOTO.h / 2), 0);
photo.castShadow = true;
photo.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: photoTex, alphaTest: 0.5 });
scene.add(photo);

// the 7: the film's own glyph, extruded and bevelled; it flies forward out of the depth and lands
const g7shapes = SVGLoader.createShapes(new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${G7.d}"/></svg>`).paths[0]);
const g7geo = new THREE.ExtrudeGeometry(g7shapes, { depth: 120, bevelEnabled: true, bevelThickness: 16, bevelSize: 11, bevelSegments: 6, curveSegments: 8 });
g7geo.translate(-319, 381.5, -60);
const Z7 = -2.5;
const K7 = (D - Z7) / D;
const S7 = (0.934 * K7) / U; // font units → px (the old SVG's fit) → world at its depth
const BASE7 = new V3(wx(1040.6) * K7, wy(548.7) * K7, Z7);
function makeSeven(mat) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(g7geo, mat);
  m.scale.set(S7, -S7, S7);
  m.castShadow = true;
  g.add(m);
  scene.add(g);
  return { g, m };
}
const seven = makeSeven(MAT.seven);
const echoes = [0.05, 0.1, 0.15].map((lag, i) => {
  const mat = MAT.seven.clone();
  mat.depthWrite = false;
  const e = makeSeven(mat);
  e.m.castShadow = false;
  e.lag = lag;
  e.alpha = [0.35, 0.2, 0.1][i];
  return e;
});
const T7 = sevenAt - 0.22;
const ray = new THREE.Raycaster();
const plane7 = new THREE.Plane(new V3(0, 0, 1), -Z7);
const small7 = new V3();
function sevenPose(t, o) {
  const k = springAt(LAND, t, T7);
  o.visible = t > T7;
  o.pos.copy(BASE7).add(new V3(lerp(-1.2, 0, k), lerp(1.6, 0, k), lerp(-26, 0, k)));
  o.ry = lerp(-1.1, -0.3, k) + 0.12 * seg(t, T7 + 0.9, RS[0], 'sine.inOut');
  o.rx = lerp(0.35, 0.04, k);
  o.rz = lerp(0.25, 0, k);
  o.s = 1;
  // "Every 7 minutes," re-sets beside the map: the 7 flies into its slot in the line
  const f = seg(t, RS[0] - 0.02, RS[1] - 0.1, 'power3.inOut');
  if (f > 0) {
    ray.setFromCamera(new THREE.Vector2((185 / W) * 2 - 1, -((416 / H) * 2 - 1)), camera);
    ray.ray.intersectPlane(plane7, small7);
    o.pos.lerp(small7, f);
    o.ry = lerp(o.ry, 0, f); o.rx = lerp(o.rx, 0, f); o.rz = lerp(o.rz, 0, f);
    o.s = lerp(1, (80 / 713) * (camera.position.distanceTo(small7) / (D - Z7)), f);
  }
  o.alpha = 1 - seg(t, RS[1] - 0.2, RS[1]);
  return o;
}
const P7 = { pos: new V3() }, P7e = { pos: new V3() };
function applySeven(s, o, alpha) {
  s.g.visible = o.visible && alpha > 0.004;
  s.g.position.copy(o.pos);
  s.g.rotation.set(o.rx, o.ry, o.rz);
  s.g.scale.setScalar(o.s);
  s.m.material.opacity = alpha;
  s.m.material.transparent = alpha < 1;
}
function renderSeven(t) {
  sevenPose(t, P7);
  applySeven(seven, P7, P7.alpha);
  echoes.forEach((e) => {
    sevenPose(t - e.lag, P7e);
    const fade = 1 - seg(t, T7 + 0.3, T7 + 0.65);
    applySeven(e, P7e, e.alpha * fade * P7.alpha);
  });
}

// the clock: a glass ring around her (its front passes in front of her, its back behind) with a comet
const RING = { c: new V3(wx(1490), wy(770), 0), r: 4.3 };
const ringGroup = new THREE.Group();
ringGroup.position.copy(RING.c);
ringGroup.rotation.set(-Math.PI / 2 + 0.1, 0, -0.12, 'ZXY');
scene.add(ringGroup);
const RN = 480;
const ringLocal = [];
for (let i = 0; i < RN; i++) { const a = -Math.PI / 2 + (i / RN) * TAU; ringLocal.push(new V3(Math.cos(a) * RING.r, Math.sin(a) * RING.r, 0)); }
const ringTube = makeTube(RN, 18, MAT.glass);
ringTube.mesh.castShadow = false;
scene.add(ringTube.mesh);
const ticks = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.2), phys({ color: '#ffffff', roughness: 0.25, clearcoat: 0.9 }), 60);
ticks.castShadow = true;
for (let i = 0; i < 60; i++) ticks.setColorAt(i, new THREE.Color('#ffffff'));
ringGroup.add(ticks);
const comet = sphere(0.17, MAT.purple);
ringGroup.add(comet);
const TRAIL = 70;
const trail = makeTube(TRAIL, 12, MAT.purple);
trail.mesh.castShadow = false;
ringGroup.add(trail.mesh);
const trailPts = Array.from({ length: TRAIL }, () => new V3());
const TICK_OFF = new THREE.Color('#ffffff'), TICK_ON = new THREE.Color('#7b2fa8');
const RW = S2.ring;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _c = new THREE.Color();
const ZAXIS = new V3(0, 0, 1);

/* ======================================================================
   3 · ONE OF MANY · tiles become Nigeria; the ring becomes its outline
   ====================================================================== */
const MK = 0.7, MX = 1070, MY = 313;
const mapPt = (x, y) => [MX + x * MK, MY + y * MK];
const MC = [MX + (NG.w * MK) / 2, MY + (NG.h * MK) / 2];
const toLocal = (px, py, z = 0) => new V3((px - MC[0]) / U, (MC[1] - py) / U, z);
const mapGroup = new THREE.Group();
mapGroup.position.set(wx(MC[0]), wy(MC[1]), 0);
scene.add(mapGroup);
const SLAB_T = 0.1;
const slabShapes = SVGLoader.createShapes(new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${NG.outline}"/></svg>`).paths[0]);
const slabGeo = new THREE.ExtrudeGeometry(slabShapes, { depth: (SLAB_T * U) / MK, bevelEnabled: true, bevelThickness: 2.5, bevelSize: 2.5, bevelSegments: 3, curveSegments: 4 });
slabGeo.translate(-NG.w / 2, -NG.h / 2, 0);
const slab = new THREE.Mesh(slabGeo, MAT.slab);
slab.scale.set(MK / U, -MK / U, MK / U);
slab.receiveShadow = true;
slab.castShadow = true;
mapGroup.add(slab);

// the outline, resampled to the ring's count and started where the ring starts, same winding
const outl = [];
NG.outline.replace(/(-?[\d.]+)[ ,](-?[\d.]+)/g, (_, x, y) => { const [px, py] = mapPt(+x, +y); outl.push(toLocal(px, py, SLAB_T + 0.03)); });
let outLocal = resample(outl, RN, true);
{
  let area = 0;
  for (let i = 0; i < RN; i++) { const a = outLocal[i], b = outLocal[(i + 1) % RN]; area += a.x * b.y - b.x * a.y; }
  if (area < 0) outLocal.reverse();
  const cx = outLocal.reduce((s, p) => s + p.x, 0) / RN, cy = outLocal.reduce((s, p) => s + p.y, 0) / RN;
  let best = 0, bd = -Infinity;
  outLocal.forEach((p, i) => { const d = -(p.y - cy) - Math.abs(p.x - cx) * 0.2; if (d > bd) { bd = d; best = i; } });
  outLocal = [...outLocal.slice(best), ...outLocal.slice(0, best)];
}
const ringWorld = ringLocal.map(() => new V3());
const morphPts = ringLocal.map(() => new V3());

// the tiles: the film's particle ↔ map-dot pairing, now voxels
const mdots = NG.dots.map(([x, y], i) => {
  const [sx, sy] = mapPt(x, y);
  return { x: sx, y: sy, i, her: Math.abs(x - NG.her[0]) < 0.5 && Math.abs(y - NG.her[1]) < 0.5, lost: Math.abs(x - NG.lost[0]) < 0.5 && Math.abs(y - NG.lost[1]) < 0.5 };
});
const pts = PARTS.pts.map(([x, y, r, col], i) => ({ x, y, r, col, i }));
const rowKey = (p) => Math.floor(p.y / 34) * 5000 + p.x;
const pSorted = [...pts].sort((a, b) => rowKey(a) - rowKey(b));
const mSorted = [...mdots].sort((a, b) => rowKey(a) - rowKey(b));
const herP = pts[PARTS.her];
const herM = mdots.find((m) => m.her);
const pairs = [];
const usedM = new Set([herM.i]);
let mi = 0, spare = 0;
for (const p of pSorted) {
  if (p === herP) continue;
  while (mi < mSorted.length && usedM.has(mSorted[mi].i)) mi++;
  if (mi < mSorted.length) { usedM.add(mSorted[mi].i); pairs.push({ p, m: mSorted[mi] }); }
  else pairs.push({ p, m: mSorted[Math.floor(hash(spare++, 41) * mSorted.length)], spare: true });
}
mdots.filter((m) => !usedM.has(m.i)).forEach((m) => pairs.push({ p: null, m, extra: true }));
const herL = toLocal(herM.x, herM.y);
const FLY = S3.fly;
const FOOT = 0.1, TILE = 0.15, BASE_H = 0.16;
const WHITE = new THREE.Color('#ffffff'), LILAC = new THREE.Color('#d9c3ee'), INK = new THREE.Color('#2a2730');
const vox = pairs.map(({ p, m, spare: sp, extra }, k) => {
  const L = toLocal(m.x, m.y);
  const q = new V3(hash(k, 21) - 0.5, hash(k, 22) - 0.5, hash(k, 23) - 0.5).normalize();
  return {
    S: p ? new V3(wx(p.x), wy(p.y), 0.03) : null,
    L, dist: L.distanceTo(herL), lost: m.lost && !sp, spare: !!sp, extra: !!extra,
    side: (hash(k, 3) - 0.5) * 2 * (0.6 + 1.6 * hash(k, 4)), lift: 1.4 + 3.2 * hash(k, 9),
    d0: FLY[0] + 0.05 + 0.85 * hash(k, 7), dur: 0.9 + 0.35 * hash(k, 8),
    axis: q, turns: TAU * (hash(k, 12) > 0.45 ? 1 : 2) * (hash(k, 13) > 0.5 ? 1 : -1),
    rise: 7.9 + 0.08 * L.distanceTo(herL),
    pop: DISS - 0.04 + 0.22 * hash(k, 15),
    c0: p ? new THREE.Color(p.col) : WHITE.clone(),
  };
});
const voxGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
const voxels = new THREE.InstancedMesh(voxGeo, phys({ color: '#ffffff', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 }), vox.length);
voxels.castShadow = true;
voxels.receiveShadow = true;
voxels.frustumCulled = false;
vox.forEach((v, k) => voxels.setColorAt(k, v.c0)); // colours exist before the first compile, so it compiles once
scene.add(voxels);
const herPillar = new THREE.Mesh(voxGeo, MAT.orange);
herPillar.castShadow = true;
mapGroup.add(herPillar);
const herDot = sphere(0.12, MAT.orange);
scene.add(herDot);
const lostRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 10, 96), MAT.mark.clone());
mapGroup.add(lostRing);
const lostL = toLocal(...mapPt(NG.lost[0], NG.lost[1]));
const tilt = (t) => -1.02 * seg(t, 7.45, 8.85, 'power3.inOut');
// her heartbeat, spreading across the country from her pin: a travelling swell through the pillars
const PULSES = [8.25, 9.05, 9.85];
const swell = (d, t) => PULSES.reduce((s, p0) => { const a = t - p0; if (a < 0) return s; const ph = d - a * 5.5; return s + Math.exp(-ph * ph * 2.2) * Math.exp(-a * 0.55); }, 0);
const qb = (a, c, b, u, out) => out.set(0, 0, 0).addScaledVector(a, (1 - u) ** 2).addScaledVector(c, 2 * (1 - u) * u).addScaledVector(b, u * u);
const IDQ = new THREE.Quaternion();
const _E = new V3(), _C = new V3(), _mid = new V3(), _perp = new V3(), _qa = new THREE.Quaternion(), _qg = new THREE.Quaternion();
const herTop = new V3();
const mapN = new V3();

function renderMap(t) {
  mapGroup.rotation.set(tilt(t), 0, 0);
  mapGroup.updateMatrixWorld(true);
  _qg.copy(mapGroup.quaternion);
  mapN.set(0, 0, 1).applyQuaternion(_qg);
  const on = t > DISS - 0.1;
  voxels.visible = slab.visible = herPillar.visible = herDot.visible = on;
  if (!on) { herTop.set(0, 0, 0); return; }
  const sl = seg(t, 7.1, 8.1, 'power3.out');
  slab.visible = sl > 0.002;
  slab.scale.z = (MK / U) * Math.max(0.02, sl);
  MAT.slab.opacity = sl;
  MAT.slab.transparent = sl < 1;
  const slabTop = SLAB_T * Math.max(0.02, sl);
  const lostOut = seg(t, S3.lost, S3.lost + 0.7, 'power2.out');
  for (let k = 0; k < vox.length; k++) {
    const v = vox[k];
    const u = v.extra ? 1 : ease('power3.inOut')(clamp((t - v.d0) / v.dur));
    const rise = ease('back.out(1.8)')(clamp((t - v.rise) / 0.55));
    const sw = swell(v.dist, t);
    let h = lerp(FOOT, BASE_H + 0.3 * sw, rise * u);
    let foot = FOOT;
    if (v.lost) { h *= 1 - lostOut; foot *= 1 - lostOut; }
    _E.copy(v.L).setZ(slabTop + h / 2);
    mapGroup.localToWorld(_E);
    if (v.extra) _p.copy(_E);
    else {
      _mid.addVectors(v.S, _E).multiplyScalar(0.5);
      _perp.subVectors(_E, v.S); _perp.set(-_perp.y, _perp.x, 0).normalize();
      _C.copy(_mid).addScaledVector(_perp, v.side).add(new V3(0, 0, v.lift));
      qb(v.S, _C, _E, u, _p);
    }
    const pop = v.extra ? ease('back.out(2)')(clamp((t - v.rise + 0.15) / 0.4)) : ease('back.out(2.2)')(clamp((t - v.pop) / 0.22));
    const s = pop * (v.spare ? 1 - clamp((u - 0.55) / 0.35) : 1);
    const fx = lerp(TILE, foot, u) * s;
    _s.set(fx, fx, lerp(0.05, h, u) * s);
    _qa.setFromAxisAngle(v.axis, v.turns * u);
    _q.slerpQuaternions(IDQ, _qg, u).multiply(_qa);
    if (_s.x < 1e-4) _s.setScalar(1e-4);
    _m.compose(_p, _q, _s);
    voxels.setMatrixAt(k, _m);
    _c.lerpColors(v.c0, WHITE, clamp(u * 1.4 - 0.2)).lerp(LILAC, clamp(sw * 1.4) * rise);
    if (v.lost) _c.lerp(INK, seg(t, S3.lost - 0.05, S3.lost + 0.1));
    voxels.setColorAt(k, _c);
  }
  voxels.instanceMatrix.needsUpdate = true;
  voxels.instanceColor.needsUpdate = true;
  // her: an orange pearl that flies from her heart to her place, and rises on her own pin
  const hr = springAt(LAND, t, 7.8);
  const hh = 1.2 * hr;
  herPillar.visible = hh > 0.01;
  herPillar.position.copy(herL).setZ(slabTop + hh / 2);
  herPillar.scale.set(FOOT * 0.6, FOOT * 0.6, Math.max(hh, 0.001));
  const hu = ease('power3.inOut')(clamp((t - (FLY[0] + 0.35)) / 1.35));
  const hs = (t >= DISS ? 1 : 0) * (1 + 0.3 * PULSES.reduce((s, p0) => s + bump(t, p0, 0.06), 0) + 0.35 * bump(t, S3.lost + 0.28, 0.08));
  const rad = 0.12 * lerp(1.4, 1, hu) * hs;
  _E.copy(herL).setZ(slabTop + hh + rad * 0.9);
  mapGroup.localToWorld(_E);
  const hS = new V3(wx(herP.x), wy(herP.y), 0.2);
  _C.addVectors(hS, _E).multiplyScalar(0.5).add(new V3(0.4, 1.4, 2.4));
  qb(hS, _C, _E, hu, herDot.position);
  herDot.scale.setScalar(Math.max(hs * lerp(1.4, 1, hu), 0.001));
  herTop.copy(herDot.position);
  // one of them is lost: the pillar sinks, a ring spreads on the slab
  const rip = clamp((t - S3.lost) / 1.3);
  lostRing.visible = t > S3.lost && rip < 1;
  lostRing.position.copy(lostL).setZ(slabTop + 0.01);
  lostRing.scale.setScalar(0.06 + 0.7 * ease('expo.out')(rip));
  lostRing.material.opacity = 0.7 * (1 - rip);
}

function renderRing(t) {
  const out = seg(t, DISS - 0.05, DISS + 0.35, 'power2.in');
  const morph = seg(t, DISS + 0.02, 7.55, 'power3.inOut');
  const rp = seg(t, RW[0], RW[0] + 0.7, 'power2.out');
  const vis = t > RW[0] && t < S4.dive[1];
  ringTube.mesh.visible = vis;
  ticks.visible = comet.visible = trail.mesh.visible = vis && out < 1;
  if (!vis) return;
  ringGroup.updateMatrixWorld(true);
  for (let i = 0; i < RN; i++) {
    ringWorld[i].copy(ringLocal[i]).applyMatrix4(ringGroup.matrixWorld);
    if (morph > 0) { _E.copy(outLocal[i]).applyMatrix4(mapGroup.matrixWorld); morphPts[i].lerpVectors(ringWorld[i], _E, morph); }
    else morphPts[i].copy(ringWorld[i]);
  }
  // the morph lifts off the plane on the way, so the ring swings through space rather than sliding
  if (morph > 0 && morph < 1) { const lift = Math.sin(Math.PI * morph) * 1.2; morphPts.forEach((p) => (p.z += lift)); }
  const fade = 1 - seg(t, S4.dive[0] + 0.2, S4.dive[0] + 0.6);
  ringTube.update(morphPts, lerp(0.12, 0.04, morph) * Math.max(fade, 0.001));
  ringTube.trim(0, morph > 0 ? 1 : rp);
  // ticks grow in around the ring and light as the comet passes; they fall away as it morphs
  const q = seg(t, RW[0] + 0.15, RW[1], 'power3.inOut');
  const lap = (((q * 7 * 60) % 60) + 60) % 60;
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI / 2 + (i / 60) * TAU;
    const g = ease('back.out(2)')(clamp(rp * 60 - i)) * (1 - out);
    const major = i % 5 === 0;
    const len = major ? 0.36 : 0.2;
    _p.set(Math.cos(a) * (RING.r + 0.2 + len / 2), Math.sin(a) * (RING.r + 0.2 + len / 2), 0);
    _q.setFromAxisAngle(ZAXIS, a);
    _s.set(len * g + 1e-4, (major ? 0.06 : 0.04) * g + 1e-4, (major ? 0.08 : 0.06) * g + 1e-4);
    ticks.setMatrixAt(i, _m.compose(_p, _q, _s));
    const lit = t > RW[0] && t < RW[1] + 0.4 ? Math.max(0, 1 - ((lap - i + 60) % 60) / 9) : 0;
    ticks.setColorAt(i, _c.lerpColors(TICK_OFF, TICK_ON, lit));
  }
  ticks.instanceMatrix.needsUpdate = true;
  ticks.instanceColor.needsUpdate = true;
  // the comet: an orb with a tapering tail, its length set by its speed
  const cOn = seg(t, RW[0] + 0.1, RW[0] + 0.35) * (1 - out);
  const ang = -Math.PI / 2 + q * 7 * TAU;
  const qa = seg(t - 1 / 60, RW[0] + 0.15, RW[1], 'power3.inOut');
  const spd = Math.abs(q - qa) * 7 * TAU * 60;
  const arc = clamp(0.15 + spd * 0.045, 0.15, 1.5);
  comet.position.set(Math.cos(ang) * RING.r, Math.sin(ang) * RING.r, 0);
  comet.scale.setScalar(Math.max(cOn, 0.001));
  for (let i = 0; i < TRAIL; i++) { const a = ang - (i / (TRAIL - 1)) * arc; trailPts[i].set(Math.cos(a) * RING.r, Math.sin(a) * RING.r, 0); }
  trail.update(trailPts, (i) => 0.13 * cOn * (1 - i / (TRAIL - 1)) ** 1.4 + 1e-4);
}

function renderPhoto(t) {
  const r = 720 * seg(t, iris[0] - 0.05, iris[0] + 0.75, 'expo.inOut');
  const crumble = seg(t, DISS - 0.04, DISS + 0.3, 'power1.in');
  photo.visible = r > 0.5 && crumble < 1;
  photoMat.uniforms.radius.value = r;
  photoMat.uniforms.crumble.value = crumble;
}

/* ======================================================================
   THE CAMERA · one continuous move: a tracking shot on her heartbeat, a crane back to her, a slow
   push, a crane up over the map, and a crash zoom into her pin
   ====================================================================== */
const CAM = spline([
  { t: 0.0, v: [-12.4, 1.3, 6.2, -8.6, -0.5, -4.8, 34] },
  { t: 0.47, v: [-8.4, 1.1, 7.4, -4.3, 0.3, -2.3, 34] },
  { t: 0.95, v: [-4.9, 1.2, 10.0, 0.6, -0.3, -0.6, 33] },
  { t: 1.7, v: [-2.4, 0.9, 15.2, 2.5, -0.4, 0, 31] },
  { t: 2.62, v: [-0.2, 0.3, 19.5, 0.4, -0.1, 0, 30] },
  { t: 4.4, v: [-0.35, 0.36, 19.0, 0.5, -0.1, 0, 30] },
  { t: 6.25, v: [-0.6, 0.45, 18.3, 0.65, -0.12, 0, 30] },
  { t: 7.3, v: [0.1, 2.0, 17.6, 2.6, -0.6, 0, 30] },
  { t: 8.5, v: [0.9, 3.8, 16.4, 3.7, -1.1, 0, 30] },
  { t: 9.2, v: [1.25, 4.0, 15.8, 3.8, -1.12, 0, 30] },
]);
function pose(t, o) {
  const c = CAM(t);
  o.p.set(c[0], c[1], c[2]);
  o.l.set(c[3], c[4], c[5]);
  o.fov = c[6];
  o.roll = 0.035 * (1 - seg(t, 0.6, 2.6, 'sine.inOut')) * Math.sin(t * 2.3 + 0.4);
  // the crash zoom: accelerate down her pin's axis into the pearl (it starts from rest: no speed jump)
  const e4 = seg(t, S4.dive[0], S4.dive[1] + 0.05, 'power4.in');
  if (e4 > 0) {
    const target = herTop.clone().addScaledVector(mapN, 0.32).add(new V3(0, 0, 0.1));
    o.p.lerp(target, e4);
    o.l.lerp(herTop, clamp(e4 * 1.6));
    o.fov = lerp(o.fov, 48, e4);
  }
  return o;
}
function place(o, punch) {
  camera.position.copy(o.p);
  camera.up.set(Math.sin(o.roll), Math.cos(o.roll), 0);
  camera.lookAt(o.l);
  camera.fov = o.fov / punch;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
// where the lens is focused (distance), and how wide open it is
const FOCUS = spline([
  { t: 0.0, v: [7.2, 16] }, { t: 0.95, v: [9.5, 14] }, { t: 2.62, v: [19.5, 7] }, { t: 6.25, v: [18.3, 6] },
  { t: 8.5, v: [17.2, 8] }, { t: 9.2, v: [16.6, 9] },
]);

/* ======================================================================
   POST · accumulation motion blur, depth of field, lens warp on the crash zoom, highlight shoulder
   ====================================================================== */
const RW_ = W * DPR, RH_ = H * DPR;
const rtS = new THREE.WebGLRenderTarget(RW_, RH_, { type: THREE.HalfFloatType, samples: 4 });
rtS.depthTexture = new THREE.DepthTexture(RW_, RH_);
rtS.depthTexture.type = THREE.UnsignedIntType;
const rtAcc = new THREE.WebGLRenderTarget(RW_, RH_, { type: THREE.HalfFloatType, depthBuffer: false });
const quadGeo = new THREE.PlaneGeometry(2, 2);
const fsVert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const accMat = new THREE.ShaderMaterial({
  uniforms: { tSrc: { value: rtS.texture }, weight: { value: 1 } },
  vertexShader: fsVert,
  fragmentShader: /* glsl */ `uniform sampler2D tSrc; uniform float weight; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, 1.0); }`,
  blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
});
const accScene = new THREE.Scene();
const accQuad = new THREE.Mesh(quadGeo, accMat);
accQuad.frustumCulled = false;
accScene.add(accQuad);
const postMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: rtS.texture }, tDepth: { value: rtS.depthTexture }, texel: { value: new THREE.Vector2(1 / RW_, 1 / RH_) },
    near: { value: NEAR }, far: { value: FAR }, focus: { value: 10 }, focusScale: { value: 10 }, maxBlur: { value: 11 * DPR }, dof: { value: OFFLINE ? 1 : 0 },
    warp: { value: 0 }, center: { value: new THREE.Vector2(0.5, 0.5) }, vig: { value: 0 },
  },
  vertexShader: fsVert,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel;
    uniform float near; uniform float far; uniform float focus; uniform float focusScale; uniform float maxBlur; uniform float dof;
    uniform float warp; uniform vec2 center; uniform float vig;
    varying vec2 vUv;
    float linZ(float d) { return near * far / (far - d * (far - near)); }
    float blurSize(float z) { return clamp(abs(1.0 / focus - 1.0 / z) * focusScale, 0.0, 1.0) * maxBlur; }
    void main() {
      // lens warp: the frame bulges toward the lens as the camera crashes forward
      vec2 d = vUv - center;
      vec2 uv = center + d * (1.0 - warp * dot(d * vec2(1.7778, 1.0), d * vec2(1.7778, 1.0)));
      vec3 col = texture2D(tColor, uv).rgb;
      if (dof > 0.5) {
        float zc = linZ(texture2D(tDepth, uv).r);
        float sc = blurSize(zc);
        vec3 acc = col; float tot = 1.0;
        float r = 0.8;
        for (int i = 0; i < 72; i++) {
          if (r > maxBlur) break;
          float a = float(i) * 2.39996323;
          vec2 tc = uv + vec2(cos(a), sin(a)) * texel * r;
          vec3 sc3 = texture2D(tColor, tc).rgb;
          float zs = linZ(texture2D(tDepth, tc).r);
          float ss = blurSize(zs);
          if (zs > zc) ss = clamp(ss, 0.0, sc * 2.0);
          float m = smoothstep(r - 0.5, r + 0.5, ss);
          acc += mix(acc / tot, sc3, m);
          tot += 1.0;
          r += ${(1.1 * Math.max(1, Math.round(DPR))).toFixed(2)} / r;
        }
        col = acc / tot;
      }
      // a faint plum vignette, only while crashing in
      float e = smoothstep(0.35, 1.05, length(d * vec2(1.7778, 1.0)) / 0.9);
      col = mix(col, col * vec3(0.8, 0.72, 0.86), vig * e);
      float m = max(col.r, max(col.g, col.b));
      if (m > 0.97) col *= (0.97 + 0.03 * (1.0 - exp(-(m - 0.97) * 6.0))) / m;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});
const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(quadGeo, postMat);
postQuad.frustumCulled = false;
postScene.add(postQuad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

/* ======================================================================
   RENDER · one frame at time t
   ====================================================================== */
const O = { p: new V3(), l: new V3() };
function update(t, punch) {
  gridMat.uniforms.uTime.value = t;
  renderMap(t); // first: the camera's dive and the ring's morph both read the map
  pose(t, O);
  place(O, punch);
  renderS1(t);
  renderPhoto(t);
  renderSeven(t);
  renderRing(t);
}
const SHUTTER = 0.5 / 30; // 180° at 30 fps
const NS = OFFLINE ? 7 : 1;
const ORDER = [0, 6, 1, 5, 2, 4, 3]; // the centre sample renders last: its depth (and the camera) is the frame's
const herScreen = [W / 2, H / 2];
const _a = new V3();
const BLACK = new THREE.Color(0, 0, 0);
function render(t, punchAt = () => 1) {
  const pf = typeof punchAt === 'function' ? punchAt : () => punchAt;
  if (NS > 1) {
    renderer.setRenderTarget(rtAcc);
    renderer.setClearColor(BLACK, 1);
    renderer.clear(true, false, false);
    renderer.setClearColor(GROUND, 1);
    for (const i of ORDER) {
      const ti = t + (i / (NS - 1) - 0.5) * SHUTTER;
      update(ti, pf(ti));
      renderer.setRenderTarget(rtS);
      renderer.render(scene, camera);
      accMat.uniforms.weight.value = 1 / NS;
      renderer.setRenderTarget(rtAcc);
      renderer.autoClear = false;
      renderer.render(accScene, postCam);
      renderer.autoClear = true;
    }
    postMat.uniforms.tColor.value = rtAcc.texture;
  } else {
    update(t, pf(t));
    renderer.setRenderTarget(rtS);
    renderer.render(scene, camera);
    postMat.uniforms.tColor.value = rtS.texture;
  }
  const f = FOCUS(t);
  postMat.uniforms.focus.value = f[0];
  postMat.uniforms.focusScale.value = f[1];
  const cz = seg(t, S4.dive[0] + 0.25, S4.dive[1], 'power2.in');
  postMat.uniforms.warp.value = 0.22 * cz;
  postMat.uniforms.vig.value = 0.55 * cz;
  _a.copy(herTop).project(camera);
  herScreen[0] = (_a.x * 0.5 + 0.5) * W;
  herScreen[1] = (0.5 - _a.y * 0.5) * H;
  postMat.uniforms.center.value.set(_a.x * 0.5 + 0.5, _a.y * 0.5 + 0.5);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  return { her: herScreen };
}

// warm every shader once before the first real frame, so no seek pays for compilation
const tc = performance.now();
[0.6, 3.2, 4.6, 6.6, 7.8, 9.6].forEach((t) => render(t));
if (DEBUG) console.log('[3d] warm-up', Math.round(performance.now() - tc), 'ms, programs', renderer.info.programs.length, 'samples', NS);
window.__hc3d = { render };
if (window.__hcRenderNow) window.__hcRenderNow();
if (window.__hc3dReady) window.__hc3dReady();
