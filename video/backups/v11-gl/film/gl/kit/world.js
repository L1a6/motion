/*
 * The film's world: the 16-9 reference, built as a shader. A huge soft circular field (cobalt core → white-lilac
 * ring → orchid → violet → deep indigo) sweeps across the frame, a dark violet blob drifts through it, and the
 * whole thing is seen through reeded (fluted) glass: each flute magnifies and shifts the light behind it, with a
 * hairline highlight at every seam. Fine grain on top. Every value animates; every scene tunes its own mood.
 *
 *   const w = world({ flutes: 8 });  shot.bg.add(w.mesh);  …  w.set({ t, cx, cy, r, dark, flute, zoom });
 */
import * as THREE from 'three';

const VERT = /* glsl */ `out vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
  precision highp float;
  in vec2 vUv; out vec4 outColor;
  uniform float uT, uAspect, uFlutes, uFlute, uZoom, uGrain, uFrame, uMix, uWarm, uLight;
  uniform vec2 uC, uB;          // field centre, dark blob centre (frame units, 0..1)
  uniform float uR, uBR, uDark; // field radius, blob radius, how far the palette leans to night
  uniform vec3 uTint;           // a scene's colour lean (multiplied in)

  // the reference's ramp, sampled from its own pixels: core → ring → orchid → violet → night
  vec3 ramp(float d) {
    vec3 c0 = vec3(0.063, 0.212, 0.627);   // #1036a0 cobalt
    vec3 c1 = vec3(0.545, 0.573, 0.851);   // #8b92d9 periwinkle
    vec3 c2 = vec3(0.820, 0.757, 0.969);   // #d1c1f7 white-lilac
    vec3 c3 = vec3(0.780, 0.439, 0.992);   // #c770fd orchid
    vec3 c4 = vec3(0.463, 0.220, 0.698);   // #7638b2 violet
    vec3 c5 = vec3(0.137, 0.012, 0.392);   // #230364 night
    d = clamp(d, 0.0, 1.0);
    if (d < 0.38) return mix(c0, c1, smoothstep(0.0, 0.38, d));
    if (d < 0.56) return mix(c1, c2, smoothstep(0.38, 0.56, d));
    if (d < 0.66) return mix(c2, c3, smoothstep(0.56, 0.66, d));
    if (d < 0.80) return mix(c3, c4, smoothstep(0.66, 0.80, d));
    return mix(c4, c5, smoothstep(0.80, 1.0, d));
  }
  vec3 field(vec2 p) {
    vec2 q = (p - uC) * vec2(uAspect, 1.0);
    float d = length(q) / uR;
    vec3 col = ramp(d);
    vec2 b = (p - uB) * vec2(uAspect, 1.0);
    float k = exp(-dot(b, b) / (uBR * uBR));
    col = mix(col, vec3(0.105, 0.0, 0.34), k * 0.92);
    // night: the whole field sinks toward deep indigo-violet; day: it lifts toward the reference's white-lilac
    col = mix(col, vec3(0.045, 0.006, 0.16), uDark * 0.86);
    col = mix(col, vec3(0.93, 0.89, 1.0), uLight * 0.78);
    return col * uTint;
  }
  // grain: a sin-free hash (no precision patterns on large coordinates), reseeded every frame
  float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx + uFrame * 17.0) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  void main() {
    // camera zoom into the world (about the centre)
    vec2 p = (vUv - 0.5) / uZoom + 0.5;
    // reeded glass: inside each flute the light is magnified and shifted toward its centre
    float n = uFlutes;
    float fx = p.x * n;
    float fi = floor(fx);
    float fu = fract(fx) - 0.5;                  // -0.5 … 0.5 across a flute
    float bend = fu * (1.0 - 0.55 * uFlute) + 0.18 * uFlute * fu * abs(fu) * 2.0;
    vec2 pr = vec2((fi + 0.5 + bend) / n, p.y);
    vec3 col = mix(field(p), field(pr), uFlute);
    // a hairline of light at each seam, and a whisper of shade inside the curve
    float seam = smoothstep(0.5 - 0.012, 0.5, abs(fu));
    col += seam * 0.07 * uFlute;
    col *= 1.0 - 0.05 * uFlute * (fu * fu * 4.0);
    col += (h(vUv * vec2(1920.0, 1080.0)) - 0.5) * uGrain;
    outColor = vec4(col, 1.0);
  }`;

export function world({ flutes = 8, w = 19.2 * 1.6, h = 10.8 * 1.6 } = {}) {
  const u = {
    uT: { value: 0 }, uAspect: { value: w / h }, uFlutes: { value: flutes }, uFlute: { value: 1 }, uZoom: { value: 1 },
    uGrain: { value: 0.035 }, uFrame: { value: 0 }, uMix: { value: 1 }, uWarm: { value: 0 }, uLight: { value: 0 },
    uC: { value: new THREE.Vector2(0.2, 0.5) }, uB: { value: new THREE.Vector2(0.85, 0.65) }, uR: { value: 0.9 }, uBR: { value: 0.22 }, uDark: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: u, vertexShader: VERT, fragmentShader: FRAG, toneMapped: false, depthWrite: false }));
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return {
    mesh, u,
    // the default drift: the field breathes across the frame the way the reference does
    drift(t, { speed = 1, dark = 0, light = 0, phase = 0 } = {}) {
      const s = t * 0.22 * speed + phase;
      u.uC.value.set(0.12 + 0.3 * Math.sin(s) + 0.1 * Math.sin(s * 1.7), 0.5 + 0.12 * Math.cos(s * 0.8));
      u.uB.value.set(0.82 - 0.25 * Math.sin(s * 0.9 + 1.2), 0.38 + 0.2 * Math.sin(s * 0.6 + 0.4));
      u.uR.value = 0.78 + 0.1 * Math.sin(s * 0.7);
      u.uBR.value = 0.2 + 0.05 * Math.sin(s * 1.3);
      u.uDark.value = dark;
      u.uLight.value = light;
      u.uFrame.value = Math.round(t * 30);
    },
  };
}
