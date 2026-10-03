/*
 * The film's 3D engine: one WebGL renderer, many shots, one finishing chain.
 *
 *  shot      a Three.js scene + its own camera + lens (focus, aperture) + update(t); one per scene
 *  render    each visible shot is rendered at 7 instants across a 180° shutter and averaged (true motion
 *            blur: fast things smear, tracked things stay sharp), then given depth of field
 *  composite two shots mix through a transition (cut, crash zoom, whip, iris, dissolve); then bloom on
 *            light, lens warp + vignette while the camera crashes, a highlight shoulder, and fine grain
 *
 * Deterministic: everything is a pure function of composition time t (film/core.js drives it from the one
 * GSAP clock). Offline quality under the renderer and the lab (navigator.webdriver); a light path in the
 * interactive preview so it can play.
 */
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/HDRLoader.js';

export const W = 1920, H = 1080;
export const DPR = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
export const OFFLINE = navigator.webdriver === true;
export const V3 = THREE.Vector3;

/* ------------------------------------------------------------------ math */
export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, p) => a + (b - a) * p;
const EASES = {};
export const ease = (n) => EASES[n] || (EASES[n] = gsap.parseEase(n));
export const seg = (t, a, b, e = 'none') => ease(e)(clamp((t - a) / (b - a)));
export const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
export function hash(i, j) {
  let n = (i * 374761393 + j * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
// a damped spring as an easing curve (After Effects' bounce expression, as a function of time)
export function spring(k = 170, c = 18, m = 1) {
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  const settle = Math.log(1000) / (z * w0);
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
  const f = (p) => {
    if (p >= 1) return 1;
    const s = p * settle;
    return z < 1 ? 1 - Math.exp(-z * w0 * s) * (Math.cos(wd * s) + ((z * w0) / wd) * Math.sin(wd * s)) : 1 - Math.exp(-w0 * s) * (1 + w0 * s);
  };
  return { ease: f, duration: settle, at: (t, t0) => (t < t0 ? 0 : f(clamp((t - t0) / settle))) };
}
// C1-continuous keyframes (cubic Hermite, Catmull-Rom tangents over uneven times, at rest at the ends and at
// keys marked hold): values glide through every key with no change of speed at a key
export function spline(keys) {
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

/* ------------------------------------------------------------------ renderer */
const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // the finishing pass applies its own filmic shoulder
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pmrem = new THREE.PMREMGenerator(renderer);

// asset readiness: the render waits for these (window.__hf.buildReady, registered in index.html)
const pending = [];
export const track = (p) => { pending.push(p); return p; };
export const allLoaded = () => Promise.all(pending);

export function loadEnv(url) {
  return track(new Promise((resolve, reject) => {
    new HDRLoader().load(url, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      resolve(env);
    }, undefined, reject);
  }));
}
export function loadTexture(url, { srgb = true, aniso = 8 } = {}) {
  return track(new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (tex) => {
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso;
      resolve(tex);
    }, undefined, reject);
  }));
}
// an image's pixels, for sampling (the photographs that break into tiles)
export function loadPixels(url, w) {
  return track(new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const h = Math.round((img.height / img.width) * w);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, w, h);
      resolve({ w, h, data: x.getImageData(0, 0, w, h).data });
    };
    img.onerror = reject;
    img.src = url;
  }));
}

/* ------------------------------------------------------------------ shots */
export class Shot {
  constructor(name, { fov = 30, near = 0.1, far = 400, background = '#000000' } = {}) {
    this.name = name;
    this.scene = new THREE.Scene();
    this.bg = new THREE.Scene(); // the backdrop: rendered first, and what the glass in the foreground sees through
    this.camera = new THREE.PerspectiveCamera(fov, W / H, near, far);
    this.background = new THREE.Color(background);
    this.lens = { focus: 10, aperture: 0, bloom: 0.6, warp: 0, vignette: 0 };
    this.samples = 7; // shutter samples when offline; a shot that never moves fast may lower this
  }
  update() {}
  // helper: place the camera from a pose { p:[x,y,z], l:[x,y,z], fov, roll }
  pose(p, l, fov, roll = 0) {
    const c = this.camera;
    c.position.set(p[0], p[1], p[2]);
    c.up.set(Math.sin(roll), Math.cos(roll), 0);
    c.lookAt(l[0], l[1], l[2]);
    if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
    c.updateMatrixWorld(true);
  }
}

/* ------------------------------------------------------------------ render targets and passes */
const RW = W * DPR, RH = H * DPR;
const half = { type: THREE.HalfFloatType };
// offline, the shutter samples are jittered by sub-pixel amounts and double as supersampling, so no MSAA
const rtMS = new THREE.WebGLRenderTarget(RW, RH, { ...half, samples: OFFLINE ? 0 : 4 });
rtMS.depthTexture = new THREE.DepthTexture(RW, RH);
rtMS.depthTexture.type = THREE.UnsignedIntType;
const rtAcc = new THREE.WebGLRenderTarget(RW, RH, { ...half, depthBuffer: false });
export const rtBG = new THREE.WebGLRenderTarget(RW, RH, { ...half, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
export const BACKDROP = { value: rtBG.texture, res: new THREE.Vector2(RW, RH) };
const rtShot = [0, 1].map(() => new THREE.WebGLRenderTarget(RW, RH, { ...half, depthBuffer: false }));
const rtMix = new THREE.WebGLRenderTarget(RW, RH, { ...half, depthBuffer: false });
// bloom mip chain
const BLOOM_LEVELS = 6;
const rtBloom = Array.from({ length: BLOOM_LEVELS }, (_, i) => new THREE.WebGLRenderTarget(Math.max(1, RW >> (i + 1)), Math.max(1, RH >> (i + 1)), { ...half, depthBuffer: false }));
const rtBloomUp = Array.from({ length: BLOOM_LEVELS }, (_, i) => new THREE.WebGLRenderTarget(Math.max(1, RW >> (i + 1)), Math.max(1, RH >> (i + 1)), { ...half, depthBuffer: false }));

const quadGeo = new THREE.PlaneGeometry(2, 2);
const orth = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
function pass(fragmentShader, uniforms, extra = {}) {
  const m = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false, ...extra });
  const s = new THREE.Scene();
  const q = new THREE.Mesh(quadGeo, m);
  q.frustumCulled = false;
  s.add(q);
  return { m, u: m.uniforms, run(target) { renderer.setRenderTarget(target); renderer.render(s, orth); } };
}

const copyP = pass(/* glsl */ `uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`, { tSrc: { value: null } });
const accP = pass(/* glsl */ `uniform sampler2D tSrc; uniform float weight; varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, 1.0); }`,
{ tSrc: { value: null }, weight: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });

// depth of field: a single-pass bokeh gather (Gustafsson), foreground not bled over by the background
const dofP = pass(/* glsl */ `
  uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel;
  uniform float near; uniform float far; uniform float focus; uniform float aperture; uniform float maxBlur;
  varying vec2 vUv;
  float linZ(float d) { return near * far / (far - d * (far - near)); }
  float blurSize(float z) { return clamp(abs(1.0 / focus - 1.0 / z) * aperture, 0.0, 1.0) * maxBlur; }
  void main() {
    vec3 col = texture2D(tColor, vUv).rgb;
    if (aperture <= 0.0) { gl_FragColor = vec4(col, 1.0); return; }
    float zc = linZ(texture2D(tDepth, vUv).r);
    float sc = blurSize(zc);
    vec3 acc = col; float tot = 1.0; float r = 0.7;
    for (int i = 0; i < 96; i++) {
      if (r > maxBlur) break;
      float a = float(i) * 2.39996323;
      vec2 tc = vUv + vec2(cos(a), sin(a)) * texel * r;
      vec3 s = texture2D(tColor, tc).rgb;
      float zs = linZ(texture2D(tDepth, tc).r);
      float ss = blurSize(zs);
      if (zs > zc) ss = clamp(ss, 0.0, sc * 2.0);
      float m = smoothstep(r - 0.5, r + 0.5, ss);
      acc += mix(acc / tot, s, m);
      tot += 1.0;
      r += RSTEP / r;
    }
    gl_FragColor = vec4(acc / tot, 1.0);
  }`.replace('RSTEP', (1.15 * Math.max(1, Math.round(DPR))).toFixed(2)),
{ tColor: { value: null }, tDepth: { value: rtMS.depthTexture }, texel: { value: new THREE.Vector2(1 / RW, 1 / RH) }, near: { value: 0.1 }, far: { value: 400 }, focus: { value: 10 }, aperture: { value: 0 }, maxBlur: { value: 12 * DPR } });

// transitions between two shots
const mixP = pass(/* glsl */ `
  uniform sampler2D tA; uniform sampler2D tB; uniform float p; uniform int kind; uniform vec2 center; uniform vec2 dir;
  uniform float aspect; varying vec2 vUv;
  vec3 blurDir(sampler2D t, vec2 uv, vec2 d) { vec3 c = vec3(0.0); for (int i = 0; i < 24; i++) { float f = float(i) / 23.0 - 0.5; c += texture2D(t, uv + d * f).rgb; } return c / 24.0; }
  vec3 blurZoom(sampler2D t, vec2 uv, vec2 c0, float k) { vec3 c = vec3(0.0); for (int i = 0; i < 24; i++) { float f = float(i) / 23.0; c += texture2D(t, c0 + (uv - c0) * (1.0 - k * f)).rgb; } return c / 24.0; }
  void main() {
    vec2 uv = vUv;
    if (kind == 0) { gl_FragColor = vec4(mix(texture2D(tA, uv).rgb, texture2D(tB, uv).rgb, p), 1.0); return; }
    if (kind == 1) { // crash zoom: A rushes into the lens, B arrives out of it
      float a = smoothstep(0.0, 0.5, p), b = 1.0 - smoothstep(0.5, 1.0, p);
      vec2 ua = center + (uv - center) / (1.0 + 2.2 * a * a);
      vec2 ub = center + (uv - center) * (1.0 - 0.45 * b * b);
      vec3 ca = blurZoom(tA, ua, center, 0.35 * a);
      vec3 cb = blurZoom(tB, ub, center, -0.3 * b);
      gl_FragColor = vec4(mix(ca, cb, smoothstep(0.42, 0.58, p)), 1.0); return;
    }
    if (kind == 2) { // whip pan: both frames slide along dir with a heavy directional smear
      float s = sin(3.14159265 * p);
      vec2 off = dir * p;
      vec3 ca = blurDir(tA, uv + off, dir * 0.9 * s);
      vec3 cb = blurDir(tB, uv + off - dir, dir * 0.9 * s);
      vec2 q = uv + off;
      float inB = dir.x != 0.0 ? (dir.x > 0.0 ? step(1.0, q.x) : 1.0 - step(0.0, q.x)) : (dir.y > 0.0 ? step(1.0, q.y) : 1.0 - step(0.0, q.y));
      gl_FragColor = vec4(mix(ca, cb, inB), 1.0); return;
    }
    if (kind == 3) { // iris: B opens from a point on screen
      float r = p * p * 1.6;
      float d = length((uv - center) * vec2(aspect, 1.0));
      float m = smoothstep(r, r - 0.004, d);
      gl_FragColor = vec4(mix(texture2D(tA, uv).rgb, texture2D(tB, uv).rgb, m), 1.0); return;
    }
    gl_FragColor = vec4(texture2D(tA, uv).rgb, 1.0);
  }`,
{ tA: { value: null }, tB: { value: null }, p: { value: 0 }, kind: { value: 0 }, center: { value: new THREE.Vector2(0.5, 0.5) }, dir: { value: new THREE.Vector2(1, 0) }, aspect: { value: W / H } });

// bloom: bright light spreads through a mip chain (13-tap down, tent up)
const downP = pass(/* glsl */ `
  uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold; varying vec2 vUv;
  vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * texel).rgb; }
  void main() {
    vec3 c = s(vec2(0.0)) * 0.125 + (s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0))) * 0.125
      + (s(vec2(-2.0, 0.0)) + s(vec2(2.0, 0.0)) + s(vec2(0.0, -2.0)) + s(vec2(0.0, 2.0))) * 0.0625
      + (s(vec2(-2.0, -2.0)) + s(vec2(2.0, -2.0)) + s(vec2(-2.0, 2.0)) + s(vec2(2.0, 2.0))) * 0.03125;
    if (threshold > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(threshold, threshold + 0.25, l); }
    gl_FragColor = vec4(c, 1.0);
  }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0 } });
const upP = pass(/* glsl */ `
  uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 texel; varying vec2 vUv;
  void main() {
    vec3 c = vec3(0.0);
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) c += texture2D(tLow, vUv + vec2(float(x), float(y)) * texel).rgb * ((x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0));
    gl_FragColor = vec4(c / 16.0 + texture2D(tHigh, vUv).rgb, 1.0);
  }`, { tLow: { value: null }, tHigh: { value: null }, texel: { value: new THREE.Vector2() } });

// finishing: bloom add, lens warp, vignette compensation, chromatic fringe on fast moves, shoulder, grain
const finP = pass(/* glsl */ `
  uniform sampler2D tSrc; uniform sampler2D tBloom; uniform float bloom; uniform float warp; uniform vec2 center;
  uniform float vig; uniform float fringe; uniform float frame; uniform float grain; varying vec2 vUv;
  float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx + frame * 17.0) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main() {
    vec2 d = vUv - center;
    float r2 = dot(d * vec2(1.7778, 1.0), d * vec2(1.7778, 1.0));
    vec2 uv = center + d * (1.0 - warp * r2);
    vec3 col;
    if (fringe > 0.0) {
      vec2 o = d * fringe * r2;
      col = vec3(texture2D(tSrc, uv + o).r, texture2D(tSrc, uv).g, texture2D(tSrc, uv - o).b);
    } else col = texture2D(tSrc, uv).rgb;
    col += texture2D(tBloom, uv).rgb * bloom;
    float e = smoothstep(0.2, 1.1, sqrt(r2) / 0.95);
    col = mix(col, col * vec3(0.78, 0.7, 0.86), vig * e);
    // a soft filmic shoulder: untouched below 0.8, highlights roll off instead of clipping
    vec3 x = max(col - 0.8, 0.0);
    col = min(col, 0.8) + 0.2 * (1.0 - exp(-x / 0.2));
    col += (h(vUv * vec2(1920.0, 1080.0)) - 0.5) * grain;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`,
{ tSrc: { value: null }, tBloom: { value: null }, bloom: { value: 0 }, warp: { value: 0 }, center: { value: new THREE.Vector2(0.5, 0.5) }, vig: { value: 0 }, fringe: { value: 0 }, frame: { value: 0 }, grain: { value: 0.012 } });

/* ------------------------------------------------------------------ profiling (window.__glProfile = []) */
const gl = renderer.getContext();
const _px = new Uint8Array(4);
// a one-pixel read-back waits for every command before it (finish() does not, in Chrome)
function sync() { const rt = renderer.getRenderTarget(); renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, _px); renderer.setRenderTarget(rt); }
function prof(label, fn) {
  const P = window.__glProfile;
  if (!P) return fn();
  sync();
  const a = performance.now();
  const r = fn();
  sync();
  P.push([label, Math.round(performance.now() - a)]);
  return r;
}
renderer.domElement.addEventListener('webglcontextlost', (e) => { console.error('[3d] WebGL context lost', window.__glLastStep || ''); });

/* ------------------------------------------------------------------ rendering a shot */
function drawShot(shot) {
  if (shot.bg.children.length) {
    renderer.setRenderTarget(rtBG);
    renderer.render(shot.bg, shot.camera);
    copyP.u.tSrc.value = rtBG.texture;
    copyP.run(rtMS);
    renderer.setRenderTarget(rtMS);
    renderer.clear(false, true, false);
    renderer.autoClear = false;
    renderer.render(shot.scene, shot.camera);
    renderer.autoClear = true;
  } else {
    renderer.setRenderTarget(rtMS);
    renderer.render(shot.scene, shot.camera);
  }
}
const SHUTTER = 0.5 / 30;
// sub-pixel offsets (Halton 2,3 around the pixel centre), one per shutter sample; the centre sample is unjittered
const JITTER = [[-0.25, 0.17], [0.25, -0.39], [-0.375, -0.06], [0.0, 0.0], [0.125, 0.28], [-0.125, -0.28], [0.375, 0.39]];
function renderShot(shot, t, slot) {
  const N = OFFLINE ? (shot.samplesAt ? shot.samplesAt(t) : shot.samples) : 1;
  renderer.setClearColor(shot.background, 1);
  if (N <= 1) {
    shot.update(t);
    prof(shot.name + ' scene', () => drawShot(shot));
    dofP.u.tColor.value = rtMS.texture;
  } else {
    renderer.setRenderTarget(rtAcc);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, false, false);
    renderer.setClearColor(shot.background, 1);
    // centre sample last: its depth feeds the depth of field, and the shot is left posed at t
    const order = [];
    for (let i = 0; i < N; i++) if (i !== (N - 1) / 2) order.push(i);
    order.push((N - 1) / 2);
    for (const i of order) {
      shot.update(t + (i / (N - 1) - 0.5) * SHUTTER);
      const [jx, jy] = N === 7 ? JITTER[i] : [((i * 0.618) % 1) - 0.5, ((i * 0.382 + 0.25) % 1) - 0.5];
      shot.camera.setViewOffset(RW, RH, jx, jy, RW, RH);
      window.__glLastStep = shot.name + ' sample ' + i;
      prof(shot.name + ' sample ' + i, () => drawShot(shot));
      accP.u.tSrc.value = rtMS.texture;
      accP.u.weight.value = 1 / N;
      renderer.autoClear = false;
      accP.run(rtAcc);
      renderer.autoClear = true;
      gl.flush(); // one sample per GPU submission: no batch runs long enough to trip the driver's watchdog
    }
    shot.camera.clearViewOffset();
    dofP.u.tColor.value = rtAcc.texture;
  }
  dofP.u.near.value = shot.camera.near;
  dofP.u.far.value = shot.camera.far;
  dofP.u.focus.value = shot.lens.focus;
  dofP.u.aperture.value = shot.lens.aperture;
  window.__glLastStep = shot.name + ' dof';
  prof(shot.name + ' dof', () => dofP.run(rtShot[slot]));
  gl.flush();
  return rtShot[slot].texture;
}

/* ------------------------------------------------------------------ the film's cut: shots and transitions */
const cut = { shots: [], transitions: [] };
export function addShot(shot, a, b) { cut.shots.push({ shot, a, b }); return shot; }
// kind: 'dissolve' | 'zoom' (crash zoom) | 'whip' | 'iris'; opts: center [x,y] in 0..1 (or a function of t), dir [x,y]
export function addTransition(from, to, t0, t1, kind, opts = {}) { cut.transitions.push({ from, to, t0, t1, kind, opts }); }
const KIND = { dissolve: 0, zoom: 1, whip: 2, iris: 3 };

export const frameInfo = {}; // shots report screen positions here (for the DOM layer)
export function render(t, dbg = window.__glDebug) {
  let tr = cut.transitions.find((x) => t >= x.t0 && t < x.t1);
  if (dbg && dbg.only) tr = null;
  let lens;
  if (tr) {
    const p = (t - tr.t0) / (tr.t1 - tr.t0);
    const pe = ease(tr.opts.ease || 'power2.inOut')(p);
    mixP.u.tA.value = renderShot(tr.from, t, 0);
    mixP.u.tB.value = renderShot(tr.to, t, 1);
    mixP.u.kind.value = KIND[tr.kind];
    mixP.u.p.value = pe;
    const c = typeof tr.opts.center === 'function' ? tr.opts.center(t) : tr.opts.center || [0.5, 0.5];
    mixP.u.center.value.set(c[0], c[1]);
    const d = tr.opts.dir || [1, 0];
    mixP.u.dir.value.set(d[0], d[1]);
    mixP.run(rtMix);
    lens = pe < 0.5 ? tr.from.lens : tr.to.lens;
    finP.u.tSrc.value = rtMix.texture;
    const kick = Math.sin(Math.PI * p);
    finP.u.warp.value = (tr.kind === 'zoom' ? 0.28 * kick : 0) + lens.warp;
    finP.u.vig.value = (tr.kind === 'zoom' ? 0.6 * kick : 0) + lens.vignette;
    finP.u.fringe.value = (tr.kind === 'zoom' || tr.kind === 'whip' ? 0.02 * kick : 0);
    finP.u.center.value.set(c[0], c[1]);
  } else {
    const s = (dbg && dbg.only && cut.shots.find((x) => x.shot.name === dbg.only)) || cut.shots.find((x) => t >= x.a && t < x.b) || cut.shots[cut.shots.length - 1];
    finP.u.tSrc.value = renderShot(s.shot, t, 0);
    lens = s.shot.lens;
    finP.u.warp.value = lens.warp;
    finP.u.vig.value = lens.vignette;
    finP.u.fringe.value = lens.fringe || 0;
    finP.u.center.value.set(lens.center ? lens.center[0] : 0.5, lens.center ? lens.center[1] : 0.5);
  }
  // bloom
  let src = finP.u.tSrc.value;
  for (let i = 0; i < BLOOM_LEVELS; i++) {
    downP.u.tSrc.value = i === 0 ? src : rtBloom[i - 1].texture;
    const pw = i === 0 ? RW : rtBloom[i - 1].width, ph = i === 0 ? RH : rtBloom[i - 1].height;
    downP.u.texel.value.set(1 / pw, 1 / ph);
    downP.u.threshold.value = i === 0 ? 0.82 : 0;
    downP.run(rtBloom[i]);
  }
  for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
    upP.u.tLow.value = i === BLOOM_LEVELS - 2 ? rtBloom[i + 1].texture : rtBloomUp[i + 1].texture;
    upP.u.tHigh.value = rtBloom[i].texture;
    upP.u.texel.value.set(1 / rtBloom[i + 1].width, 1 / rtBloom[i + 1].height);
    upP.run(rtBloomUp[i]);
  }
  finP.u.tBloom.value = rtBloomUp[0].texture;
  finP.u.bloom.value = lens.bloom;
  finP.u.frame.value = Math.round(t * 30);
  finP.run(null);
}

// project a world point of a shot to screen pixels
const _pv = new V3();
export function toScreen(shot, v) {
  _pv.copy(v).project(shot.camera);
  return [(_pv.x * 0.5 + 0.5) * W, (0.5 - _pv.y * 0.5) * H, _pv.z];
}
