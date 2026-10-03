/*
 * Type as After Effects layers: crisp flat letters in the brand face, drawn once into an atlas, each letter its
 * own instanced quad with its own transform, opacity, blur and colour. That is what lets a word blur in letter by
 * letter, slide up, stretch elastically, echo, or morph into the next word — and still sit in 3D space where the
 * camera can move, zoom and warp through it.
 *
 *   const t = textLayer('Every 7 minutes', { size: 0.9, weight: 800 });  scene.add(t.mesh);
 *   t.letters[i] = { x, y, … }  →  per frame: t.set(i, { x, y, z, sx, sy, rot, alpha, blur, color }); t.commit();
 */
import * as THREE from 'three';
import { track } from '../engine.js';

const FONT = '"Open Sauce One", sans-serif';
const fontsReady = track(Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 64px "Open Sauce One"`))));
const PX = 200; // atlas pixels per em: crisp up to ~3× on screen

const VERT = /* glsl */ `
  in vec4 aRect; in float aAlpha; in float aBlur; in vec3 aColor;
  out vec2 vUv; out float vAlpha; out float vBlur; out vec3 vColor;
  void main() {
    vUv = aRect.xy + uv * aRect.zw;
    vAlpha = aAlpha; vBlur = aBlur; vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  in vec2 vUv; in float vAlpha; in float vBlur; in vec3 vColor;
  out vec4 outColor;
  void main() {
    float a = textureLod(uAtlas, vUv, vBlur).a * vAlpha;
    if (a < 0.003) discard;
    outColor = vec4(vColor, a);
  }`;

export function textLayer(str, { size = 1, weight = 800, tracking = -0.02, color = '#ffffff', align = 'left', lineHeight = 1.15 } = {}) {
  const lines = str.split('\n');
  const chars = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `${weight} ${PX}px ${FONT}`;
  const pad = Math.round(PX * 0.4); // room for the blur to spread inside each cell
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  const N = str.replace(/\n/g, '').length;
  const geo = new THREE.PlaneGeometry(1, 1);
  const rect = new Float32Array(N * 4), alphaA = new Float32Array(N).fill(1), blurA = new Float32Array(N), colA = new Float32Array(N * 3);
  const A = (arr, n) => new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  const aRect = A(rect, 4), aAlpha = A(alphaA, 1), aBlur = A(blurA, 1), aColor = A(colA, 3);
  geo.setAttribute('aRect', aRect); geo.setAttribute('aAlpha', aAlpha); geo.setAttribute('aBlur', aBlur); geo.setAttribute('aColor', aColor);
  const mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { uAtlas: { value: tex } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(N, 1));
  mesh.frustumCulled = false;
  mesh.renderOrder = 5; // type draws over glass (2) and shapes (3)
  const k = size / PX; // world units per atlas pixel (size = em in world units)
  const letters = [];
  const base = new THREE.Color(color);
  const layer = { mesh, letters, width: 0, size, k, ready: null };

  layer.ready = fontsReady.then(() => {
    ctx.font = font;
    ctx.letterSpacing = `${tracking * PX}px`;
    // lay out each line with the font's own advances and kerning (pairs measured), and cut each glyph a cell
    const cells = [];
    const lineW = [];
    let cellX = 0;
    lines.forEach((ln, li) => {
      let x = 0;
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i], next = ln[i + 1];
        const m = ctx.measureText(ch);
        const adv = next ? ctx.measureText(ch + next).width - ctx.measureText(next).width : m.width;
        const gw = Math.max(2, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 2);
        cells.push({ ch, line: li, x, left: m.actualBoundingBoxLeft, gw, cellX });
        cellX += gw + pad * 2;
        x += adv;
      }
      lineW[li] = x;
    });
    canvas.width = Math.min(16384, Math.max(4, cellX));
    canvas.height = Math.ceil(PX * 1.25 + pad * 2);
    const W = canvas.width, H = canvas.height;
    const baseY = pad + PX * 0.95; // the baseline inside every cell, from the top
    ctx.font = font;
    ctx.letterSpacing = '0px';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    cells.forEach((c) => { if (c.ch !== ' ') ctx.fillText(c.ch, c.cellX + pad + c.left, baseY); });
    tex.needsUpdate = true;
    layer.width = Math.max(...lineW) * k;
    cells.forEach((c, i) => {
      const ox = align === 'center' ? -lineW[c.line] / 2 : align === 'right' ? -lineW[c.line] : 0;
      const cw = c.gw + pad * 2;
      rect.set([c.cellX / W, 0, cw / W, 1], i * 4);
      letters.push({
        i, ch: c.ch, line: c.line, space: c.ch === ' ',
        hx: (ox + c.x - c.left - pad + cw / 2) * k,            // the cell's centre, from the layer origin
        hy: (baseY - H / 2) * k - c.line * size * lineHeight,   // … placed so the glyph sits on its baseline
        w: cw * k, h: H * k,
        adv: c.x * k, // the pen position (for effects that sweep across the line)
      });
    });
    aRect.needsUpdate = true;
    letters.forEach((l) => layer.set(l.i, {}));
    layer.commit();
  });

  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  // set one letter: x/y/z offsets from home, sx/sy scale, rot (z) / rx / ry, alpha, blur (mip levels), color
  layer.set = (i, { x = 0, y = 0, z = 0, sx = 1, sy = 1, rot = 0, rx = 0, ry = 0, alpha = 1, blur = 0, color = null } = {}) => {
    const l = letters[i];
    if (!l) return;
    _p.set(l.hx + x, l.hy + y, z);
    _q.setFromEuler(_e.set(rx, ry, rot));
    _s.set(l.w * sx, l.h * sy, 1);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    alphaA[i] = l.space ? 0 : alpha;
    blurA[i] = Math.max(0, blur);
    const cc = color ? _c.set(color) : base;
    colA[i * 3] = cc.r; colA[i * 3 + 1] = cc.g; colA[i * 3 + 2] = cc.b;
  };
  layer.commit = () => { mesh.instanceMatrix.needsUpdate = true; aAlpha.needsUpdate = true; aBlur.needsUpdate = true; aColor.needsUpdate = true; };
  layer.all = (fn) => { letters.forEach((l, j) => layer.set(l.i, fn(l, j) || {})); layer.commit(); };
  return layer;
}

/* ---------------------------------------------------------------- the moves (Jitter / After Effects text presets) */
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
// blur-in: each letter rises a little out of a blur and fades up, staggered
export function blurIn(p, { rise = 0.25, blur = 4, scale = 0.92 } = {}) {
  const e = 1 - (1 - clamp01(p)) ** 3;
  return { y: (1 - e) * -rise, alpha: e, blur: (1 - e) * blur, sx: scale + (1 - scale) * e, sy: scale + (1 - scale) * e };
}
// blur-out: the reverse, drifting up
export function blurOut(p, { rise = 0.25, blur = 4 } = {}) {
  const e = clamp01(p) ** 2;
  return { y: e * rise, alpha: 1 - e, blur: e * blur };
}
