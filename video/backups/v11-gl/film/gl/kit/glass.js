/*
 * Liquid glass and morphable shapes (resolution-free signed-distance quads).
 *
 *  glassCard  a frosted pane: it sees the shot's backdrop through itself, blurred (a coarser mip of the backdrop
 *             target), bent at its rounded edges like a lens, milky-tinted, with a bright rim, a soft sheen sweeping
 *             across, and its own soft drop shadow. What CSS backdrop-filter does, in 3D, with refraction.
 *  shape      a rounded rectangle that is also a pill and a dot: animate w, h and radius and it morphs between
 *             them, razor-sharp at any size (the pill → dot of the end sting, chips, buttons, the orange dot)
 */
import * as THREE from 'three';
import { BACKDROP } from '../engine.js';

const VERT = /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SDF = /* glsl */ `
  float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }`;

export function glassCard({ w = 6, h = 2.4, r = 0.4, blur = 4.5, tint = 0.14, rim = 0.5, refract = 0.022, shadow = 0.28 } = {}) {
  const g = new THREE.Group();
  // the shadow: a soft dark rounded rect a little below and behind
  const shU = { uSize: { value: new THREE.Vector2(w, h) }, uR: { value: r }, uSoft: { value: 0.55 }, uA: { value: shadow }, uPad: { value: 1.2 } };
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w + 2.4, h + 2.4), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: shU, vertexShader: VERT, transparent: true, depthWrite: false, toneMapped: false,
    fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o; uniform vec2 uSize; uniform float uR, uSoft, uA, uPad; ${SDF}
      void main() { vec2 p = (vUv - 0.5) * (uSize + 2.0 * uPad); float d = sdRound(p, uSize * 0.5, uR); o = vec4(0.06, 0.0, 0.16, uA * (1.0 - smoothstep(-uSoft, uSoft * 1.6, d))); }`,
  }));
  sh.position.set(0.08, -0.22, -0.02);
  sh.renderOrder = 1;
  g.add(sh);
  const u = {
    uBack: BACKDROP, uRes: { value: BACKDROP.res }, uSize: { value: new THREE.Vector2(w, h) }, uR: { value: r }, uBlur: { value: blur },
    uTint: { value: tint }, uRim: { value: rim }, uRefract: { value: refract }, uSheen: { value: -2 }, uOpacity: { value: 1 }, uTintCol: { value: new THREE.Color('#ffffff') },
  };
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: u, vertexShader: VERT, transparent: true, depthWrite: false, toneMapped: false,
    fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o;
      uniform sampler2D uBack; uniform vec2 uRes, uSize; uniform float uR, uBlur, uTint, uRim, uRefract, uSheen, uOpacity; uniform vec3 uTintCol; ${SDF}
      void main() {
        vec2 p = (vUv - 0.5) * uSize;
        float d = sdRound(p, uSize * 0.5, uR);
        float aa = fwidth(d);
        float inside = 1.0 - smoothstep(-aa, aa, d);
        if (inside < 0.002) discard;
        // the edge acts as a lens: within a bevel's width of the rim the backdrop is pushed outward
        vec2 e = vec2(0.01, 0.0);
        vec2 n = normalize(vec2(sdRound(p + e.xy, uSize * 0.5, uR) - sdRound(p - e.xy, uSize * 0.5, uR), sdRound(p + e.yx, uSize * 0.5, uR) - sdRound(p - e.yx, uSize * 0.5, uR)) + 1e-6);
        float bevel = 1.0 - smoothstep(0.0, 0.42, -d);
        vec2 suv = gl_FragCoord.xy / uRes - n * uRefract * bevel * bevel;
        vec3 c = textureLod(uBack, suv, uBlur + bevel * 1.5).rgb;
        c = mix(c, uTintCol, uTint) * (1.0 + 0.06);
        // rim: a bright inner hairline, brighter where the light falls (top left)
        float rimLine = 1.0 - smoothstep(0.0, 0.05, -d);
        float light = 0.55 + 0.45 * dot(-n, normalize(vec2(-0.6, 0.8)));
        c += rimLine * uRim * light;
        // sheen: a broad soft band of light sweeping across the pane
        float s = exp(-pow((p.x - uSheen) * 0.6 + p.y * 0.35, 2.0) * 1.2);
        c += s * 0.08;
        o = vec4(c, inside * uOpacity);
      }`,
  }));
  pane.renderOrder = 2;
  g.add(pane);
  return { group: g, pane, u, shadow: sh, shU, setSize(w2, h2, r2 = r) { u.uSize.value.set(w2, h2); u.uR.value = r2; shU.uSize.value.set(w2, h2); shU.uR.value = r2; pane.scale.set(w2 / w, h2 / h, 1); sh.scale.set((w2 + 2.4) / (w + 2.4), (h2 + 2.4) / (h + 2.4), 1); } };
}

export function shape({ w = 1, h = 1, r = 0.5, color = '#ffffff', color2 = null, glow = 0, maxW = 12, maxH = 6 } = {}) {
  const u = {
    uSize: { value: new THREE.Vector2(w, h) }, uR: { value: r }, uCol: { value: new THREE.Color(color) }, uCol2: { value: new THREE.Color(color2 || color) },
    uGlow: { value: glow }, uA: { value: 1 }, uBox: { value: new THREE.Vector2(maxW, maxH) },
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(maxW, maxH), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: u, vertexShader: VERT, transparent: true, depthWrite: false, toneMapped: false,
    fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; out vec4 o;
      uniform vec2 uSize, uBox; uniform float uR, uGlow, uA; uniform vec3 uCol, uCol2; ${SDF}
      void main() {
        vec2 p = (vUv - 0.5) * uBox;
        float r = min(uR, min(uSize.x, uSize.y) * 0.5);
        float d = sdRound(p, uSize * 0.5, r);
        float aa = fwidth(d);
        float a = 1.0 - smoothstep(-aa, aa, d);
        vec3 c = mix(uCol2, uCol, clamp(0.5 + p.y / max(uSize.y, 1e-3), 0.0, 1.0));
        float g = uGlow * exp(-max(d, 0.0) * 6.0) * (1.0 - a);
        if (a + g < 0.002) discard;
        o = vec4(c, (a + g) * uA);
      }`,
  }));
  m.renderOrder = 3;
  return { mesh: m, u, set({ w: w2, h: h2, r: r2, a } = {}) { if (w2 !== undefined) u.uSize.value.x = w2; if (h2 !== undefined) u.uSize.value.y = h2; if (r2 !== undefined) u.uR.value = r2; if (a !== undefined) u.uA.value = a; } };
}
