/*
 * The film's real 3D. One WebGL layer (#gl) that only ever holds objects; the type and UI stay in the DOM so they
 * render razor-sharp. Three shots live here:
 *
 *   open   the HerCova mark, extruded and bevelled, spins in out of the dark on a spring and slides aside for
 *          the line; the vertical whip carries it out of frame
 *   phone  a titanium phone tumbles in from deep space and lands in a low hero angle; its live screen is drawn
 *          into a texture (film/screen.js); the dynamic island morphs into a live activity and the camera dives
 *          through it into the dark world of scene 3
 *   mark   the mark again, over the fluted glass, beside the wordmark
 *
 * Fast moves are rendered with true motion blur: several sub-frame instants across a 180° shutter, averaged.
 * Deterministic: render(t) is a pure function of composition time; film/film.js calls it from the one clock.
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/HDRLoader.js';
import { SVGLoader } from 'three/addons/SVGLoader.js';
import { drawScreen, SCREEN_W, SCREEN_H } from './screen.js';

const T = window.HC_T;
const S = T.S;
const W = 1920, H = 1080;
// the final render (headless, navigator.webdriver) gets full quality; the interactive Studio preview gets a light
// path — 1× pixels and no sub-frame motion blur — so it can play on modest GPUs
const LIVE = navigator.webdriver !== true;
const PR = LIVE ? 1 : 1.5;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const EASE = {};
const ez = (n) => EASE[n] || (EASE[n] = gsap.parseEase(n));
const seg = (t, a, b, e = 'none') => ez(e)(clamp((t - a) / (b - a)));
// After Effects' bounce expression: a damped spring from 0 to 1 starting at t0
function spring(k, c) {
  const w0 = Math.sqrt(k), z = c / (2 * Math.sqrt(k));
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
  return (t, t0) => {
    if (t <= t0) return 0;
    const s = t - t0;
    return 1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + ((z * w0) / wd) * Math.sin(wd * s));
  };
}

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(PR);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const pmrem = new THREE.PMREMGenerator(renderer);
const hdr = new HDRLoader().loadAsync('assets/hdri/studio_small_09_2k.hdr').then((tex) => {
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  return env;
});

/* ------------------------------------------------------------------ motion blur: sub-frame accumulation */
const RW = W * PR, RH = H * PR;
const rtSample = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, samples: 4 });
const rtAccum = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType });
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const addMat = new THREE.MeshBasicMaterial({ map: rtSample.texture, transparent: true, toneMapped: false, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
const addQuad = new THREE.Mesh(quadGeo, addMat);
const addScene = new THREE.Scene();
addScene.add(addQuad);
const outMat = new THREE.MeshBasicMaterial({ map: rtAccum.texture, transparent: true, toneMapped: true, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
const outScene = new THREE.Scene();
outScene.add(new THREE.Mesh(quadGeo, outMat));
const FRAME = 1 / 30;
// draw scene at t; when the shot is moving fast, average `k` instants across a 180° shutter centred on t
function draw(scene, cam, pose, t, k) {
  if (LIVE) k = 1;
  if (k <= 1) {
    pose(t);
    renderer.setRenderTarget(null);
    renderer.render(scene, cam);
    return;
  }
  // the accumulation runs in linear light; tone mapping happens once, on the way out
  const tm = renderer.toneMapping;
  renderer.setRenderTarget(rtAccum);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  addMat.color.setScalar(1 / k);
  addMat.opacity = 1 / k;
  for (let i = 0; i < k; i++) {
    pose(t + FRAME * 0.5 * (i / (k - 1) - 0.5));
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(rtSample);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(rtAccum);
    renderer.render(addScene, quadCam);
  }
  renderer.toneMapping = tm;
  renderer.setRenderTarget(null);
  renderer.render(outScene, quadCam);
}

/* ------------------------------------------------------------------ the HerCova mark (shared geometry) */
function markMaterials() {
  return {
    purple: new THREE.MeshPhysicalMaterial({ color: '#7b2fa8', metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.5, sheenColor: new THREE.Color('#e0c4ff') }),
    orange: new THREE.MeshPhysicalMaterial({ color: '#ee7b1e', metalness: 0, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color('#ffd7b0') }),
  };
}
let markGeos = null;
const markLoad = new SVGLoader().loadAsync('assets/images/logo-mark.svg').then((data) => {
  const geos = [];
  for (const path of data.paths) {
    const col = new THREE.Color(path.color || '#7B2FA8');
    for (const shape of SVGLoader.createShapes(path)) {
      geos.push({ orange: col.r > col.b, geo: new THREE.ExtrudeGeometry(shape, { depth: 46, bevelEnabled: true, bevelThickness: 9, bevelSize: 5, bevelSegments: 6, curveSegments: 4 }) });
    }
  }
  const box = new THREE.Box3();
  geos.forEach((g) => { g.geo.computeBoundingBox(); box.union(g.geo.boundingBox); });
  const c = box.getCenter(new THREE.Vector3());
  geos.forEach((g) => g.geo.translate(-c.x, -c.y, -c.z));
  markGeos = geos;
});
function makeMark(height) {
  const m = markMaterials();
  const inner = new THREE.Group();
  markGeos.forEach((g) => inner.add(new THREE.Mesh(g.geo, g.orange ? m.orange : m.purple)));
  const s = height / 524;
  inner.scale.set(s, -s, s);
  const rig = new THREE.Group(); // the null the mark hangs from
  rig.add(inner);
  return rig;
}
function studio(scene, rimColor = '#c9a6f0', keyI = 2.0) {
  const key = new THREE.DirectionalLight('#ffffff', keyI);
  key.position.set(-3, 4, 6);
  const rim = new THREE.PointLight(rimColor, 60, 0, 2);
  rim.position.set(3, 2.5, -3);
  const rim2 = new THREE.PointLight('#8a5cd6', 40, 0, 2);
  rim2.position.set(-3.5, -2, -2.5);
  scene.add(key, rim, rim2);
  return { key, rim, rim2 };
}

/* ------------------------------------------------------------------ 1 · open: the mark in the dark */
const openScene = new THREE.Scene();
const camO = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
camO.position.set(0, 0, 12);
studio(openScene, '#d6b8ff', 3.4);
let openMark = null;
const openSpin = spring(64, 9);
const openDrop = spring(90, 13);
function openPose(t) {
  const sp = openSpin(t, 0.15);
  openMark.position.z = lerp(-16, 0, seg(t, 0.15, 1.35, 'expo.out'));
  openMark.rotation.y = lerp(-Math.PI * 1.35, 0, sp) + 0.05 * Math.sin((t - 1) * 1.4) * seg(t, 2, 2.6);
  openMark.rotation.x = lerp(0.6, 0, sp);
  // it arrives high, drops to the centre on a spring, then slides aside for the line
  const drop = openDrop(t, 0.85);
  const aside = seg(t, 1.45, 2.25, 'power3.inOut');
  openMark.position.x = lerp(0, -2.05, aside);
  const whip = seg(t, 2.7, 3.25, 'power3.in');
  openMark.position.y = lerp(1.05, 0, drop) + lerp(0, 7, whip);
}

/* ------------------------------------------------------------------ 2 · phone */
const phoneScene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(30, W / H, 0.01, 100);
const phoneLights = studio(phoneScene, '#d2b4ff');
const PW = 0.716, PH = 1.47, PD = 0.06, PRAD = 0.108;
function rrect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function planeUV(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x);
    uv[i * 2 + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
const phone = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.ExtrudeGeometry(rrect(PW - 0.02, PH - 0.02, PRAD - 0.01), { depth: PD, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 6, curveSegments: 24 }),
  new THREE.MeshPhysicalMaterial({ color: '#2a2830', metalness: 0.92, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
);
body.position.z = -PD / 2;
phone.add(body);
const glass = new THREE.Mesh(new THREE.ShapeGeometry(rrect(PW - 0.012, PH - 0.012, PRAD - 0.006), 24),
  new THREE.MeshPhysicalMaterial({ color: '#030304', metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }));
glass.position.z = PD / 2 + 0.0125;
phone.add(glass);
const screenCanvas = document.createElement('canvas');
screenCanvas.width = SCREEN_W;
screenCanvas.height = SCREEN_H;
const screenCtx = screenCanvas.getContext('2d');
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.anisotropy = 8;
if (LIVE) {
  // live preview: no mip chain for a 3-megapixel texture re-uploaded every frame (the render keeps full quality)
  screenTex.generateMipmaps = false;
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.anisotropy = 1;
}
let screenTick = -1;
const SW_ = PW - 0.05, SH_ = PH - 0.05;
const screen = new THREE.Mesh(planeUV(new THREE.ShapeGeometry(rrect(SW_, SH_, PRAD - 0.03), 24)), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.88) }));
screen.position.z = PD / 2 + 0.0135;
phone.add(screen);
// a soft reflection streak across the glass
const sheen = new THREE.Mesh(new THREE.ShapeGeometry(rrect(SW_, SH_, PRAD - 0.03), 24), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uPos: { value: 0 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec2 vP; uniform float uPos; void main(){ float d = vP.x * 0.8 + vP.y * 0.6 - uPos; float a = smoothstep(0.22, 0.0, abs(d)) * 0.10; gl_FragColor = vec4(vec3(1.0), a); }',
}));
sheen.position.z = PD / 2 + 0.0142;
phone.add(sheen);
const phoneRig = new THREE.Group(); // null object: the tumble lives here
phoneRig.add(phone);
phoneScene.add(phoneRig);
// the island, in the phone's local space (for the dive)
const ISLAND = new THREE.Vector3(0, SH_ / 2 - 0.042, PD / 2 + 0.014);
// the push-in target: the check-in card on her screen (the app section opens on the same card)
const CARDPT = new THREE.Vector3(0, 0.2, PD / 2 + 0.7);

const tumble = spring(42, 7.2);
const P = S.phone;
const REST = { x: -0.34, y: 0.42, z: 0.07 };
function phonePose(t) {
  const sp = tumble(t, P.in);
  const fly = seg(t, P.in, P.in + 1.5, 'expo.out');
  phoneRig.position.set(lerp(1.2, 0, fly), lerp(-3.6, 0, fly), lerp(-11, 0, fly));
  // the tumble decays into the hero angle; the push straightens it to face the lens
  const face = seg(t, P.dive - 1.0, P.dive + 0.5, 'power2.inOut');
  phoneRig.rotation.set(
    lerp(lerp(2.6, REST.x, sp), 0, face),
    lerp(lerp(-4.4, REST.y, sp), 0, face) + 0.08 * Math.sin((t - P.in) * 0.9) * (1 - face),
    lerp(lerp(1.3, REST.z, sp), 0, face),
  );
  // camera: low hero angle, a slow orbit, then the dive through the island
  const orbit = seg(t, P.in + 1.2, P.dive, 'sine.inOut');
  const dive = seg(t, P.dive - 0.25, S.ui[0] + 0.4, 'power2.inOut');
  phoneRig.updateMatrixWorld();
  const isl = CARDPT.clone().applyMatrix4(phone.matrixWorld);
  const card = new THREE.Vector3(0, 0.2, PD / 2).applyMatrix4(phone.matrixWorld);
  const from = new THREE.Vector3(lerp(0.15, -0.45, orbit), lerp(-0.42, -0.28, orbit), 3.5 - 0.25 * orbit);
  const look0 = new THREE.Vector3(0, 0.12, 0);
  const pos = from.clone().lerp(isl, dive);
  const look = look0.clone().lerp(card, seg(t, P.dive - 0.25, P.dive + 0.7, 'power2.inOut'));
  camP.position.copy(pos);
  camP.lookAt(look);
  camP.fov = 30;
  camP.updateProjectionMatrix();
  sheen.material.uniforms.uPos.value = lerp(-1.4, 1.4, seg(t, P.in + 0.6, P.in + 2.6, 'power2.inOut'));
  phoneLights.rim.intensity = 60;
}
function phoneSpeed(t) {
  // how many shutter samples the moment needs
  if (t < P.in + 1.3) return 8;
  if (t > P.dive + 0.5) return 6;
  return 1;
}

/* ------------------------------------------------------------------ 3 · the mark over the fluted glass */
const markScene = new THREE.Scene();
const camC = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
camC.position.set(0, 0, 12);
studio(markScene, '#d9bff7');
let fluteMark = null;
const markSpin = spring(70, 9.5);
const M = { in: -100, aside: -100, whip: -100 }; // the mark shot is retired
function markPose(t) {
  const sp = markSpin(t, M.in);
  fluteMark.position.z = lerp(-14, 0, seg(t, M.in, M.in + 1.0, 'expo.out'));
  fluteMark.rotation.y = lerp(-Math.PI * 1.15, 0, sp) + 0.06 * Math.sin((t - M.in) * 1.3) * seg(t, M.in + 1.4, M.in + 2.2);
  fluteMark.rotation.x = lerp(0.5, 0, sp);
  const aside = seg(t, M.aside, M.aside + 0.9, 'power3.inOut');
  fluteMark.position.x = lerp(0, -1.6, aside);
  const whip = seg(t, M.whip, M.whip + 0.57, 'power3.in');
  fluteMark.position.y = lerp(0.18 * aside, 6.5, whip) + 0.04 * Math.sin((t - M.in) * 1.1);
}

/* ------------------------------------------------------------------ 4 · the testimonial's world: a deep-lilac studio */
// 16-10 sits its glass card on a photograph; here the glass sits on real 3D — iridescent pearls, a ring and a
// pill drifting in a deep-lilac studio. The camera eases back exactly like 16-10's photograph (150 % → 100 %).
const testiScene = new THREE.Scene();
testiScene.background = new THREE.Color('#7553bb');
const camT = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
studio(testiScene, '#f0e4ff', 2.4);
const pearlMat = new THREE.MeshPhysicalMaterial({ color: '#f3ecfb', metalness: 0.05, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 520], sheen: 0.6, sheenColor: new THREE.Color('#d9bdf7') });
const lilacMat = new THREE.MeshPhysicalMaterial({ color: '#b993ee', metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color('#f3e8ff') });
const whiteMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 });
const TOBJ = [
  { m: new THREE.Mesh(new THREE.SphereGeometry(1.25, 96, 64), pearlMat), p: [2.5, 0.9, -1.2], s: 0.3 },
  { m: new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.32, 64, 160), lilacMat), p: [-0.35, -0.15, -0.9], s: 0.5 },
  { m: new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 48), pearlMat), p: [0.6, 1.7, 0.4], s: 0.7 },
  { m: new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 32), whiteMat), p: [-3.1, 1.4, 0.2], s: 0.9 },
  { m: new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 16, 48), lilacMat), p: [3.4, -1.6, 0.0], s: 0.6 },
  { m: new THREE.Mesh(new THREE.SphereGeometry(0.22, 48, 32), lilacMat), p: [-0.2, -2.1, 1.0], s: 1.1 },
];
TOBJ.forEach((o) => testiScene.add(o.m));
const testiBez = (p) => { // the reference's camera curve: cubic-bezier(.5, 0, 0, 1)
  let lo = 0, hi = 1, u = p;
  for (let i = 0; i < 30; i++) { u = (lo + hi) / 2; const x = 3 * 0.5 * u * (1 - u) ** 2 + u ** 3; if (x < p) lo = u; else hi = u; }
  return 3 * u * u * (1 - u) + u ** 3;
};
const TT0 = S.testi[0] - 0.1;
function testiPose(t) {
  const k = t - TT0;
  const back = testiBez(clamp(k / 1.49));
  camT.position.set(0.2 * Math.sin(k * 0.3), 0.1 * Math.cos(k * 0.25), lerp(6.3, 9.4, back));
  camT.lookAt(0, 0, 0);
  TOBJ.forEach((o, i) => {
    o.m.position.set(o.p[0] + Math.sin(k * o.s + i) * 0.18, o.p[1] + Math.cos(k * o.s * 0.8 + i * 1.7) * 0.22, o.p[2]);
    o.m.rotation.set(k * o.s * 0.4 + i, k * o.s * 0.6 + i * 0.5, 0.3 * i);
  });
}

/* ------------------------------------------------------------------ render */
const ON = (t, a, b) => t >= a && t < b;
function render(t) {
  renderer.setRenderTarget(null);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  // v13: the phone is the film's only WebGL shot (the logo lockups were cut at the user's request)
  if (ON(t, P.in - 0.05, S.ui[0] + 0.4)) {
    // live preview: refresh her screen 20× a second (its UI moves slowly); the render redraws every frame
    const tick = LIVE ? Math.floor(t * 20) : -2;
    if (tick !== screenTick || !LIVE) {
      screenTick = tick;
      drawScreen(screenCtx, t);
      screenTex.needsUpdate = true;
    }
    draw(phoneScene, camP, phonePose, t, phoneSpeed(t));
  }
  // the testimonial's 3D studio (under the glass card)
  // (retired: the testimonial now sits on Dr. Didi's photograph, as 16-10 sits on its photograph)
}

// index.html registered the render hold (window.__hf.buildReady.hcgl) synchronously; release it here
Promise.all([hdr, markLoad, document.fonts.load('700 40px "Open Sauce One"'), document.fonts.load('800 40px "Open Sauce One"'), document.fonts.load('500 40px "Open Sauce One"'), document.fonts.load('600 40px "Open Sauce One"')])
  .then(([env]) => {
    [openScene, phoneScene, markScene, testiScene].forEach((s) => { s.environment = env; s.environmentIntensity = 1.1; });
    openMark = makeMark(1.2);
    openScene.add(openMark);
    fluteMark = makeMark(1.6);
    markScene.add(fluteMark);
    // warm every shader so no frame pays for compilation
    [P.in + 0.2, P.in + 2.5, P.dive + 0.8].forEach(render);
    window.__gl = { render };
    if (window.__hcRenderNow) window.__hcRenderNow();
    window.__hcGlReady();
  })
  .catch((e) => console.error('[gl] load failed', e));
