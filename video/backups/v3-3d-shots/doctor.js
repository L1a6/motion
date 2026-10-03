/*
 * 6 · A CLINICIAN (31.0 – 36.7 s). The 16-10 reference in 3D: a sharp full-bleed portrait of a clinician,
 * the camera easing back from close; a slab of frosted glass (it really blurs the photograph behind it)
 * shrinks from full frame onto her coat with a spring, and the words arrive one at a time, out of a blur.
 *
 * The words are HerCova's own ("detecting a warning sign is only useful if something happens next", from
 * the site), attributed to HerCova. When a clinician's real words and consent exist, they replace QUOTE/BY.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { Shot, V3, W, H, DPR, clamp, lerp, seg, spring, loadTexture } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { screen, rr, text, dot, C, FONT } from '../ui.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const QUOTE = ['“Detecting a warning sign', 'is only useful if something', 'happens next.”'];
const BY = { name: 'HerCova', role: 'Our belief' };
const SETTLE = spring(120, 16);

export function doctor() {
  const [a, b] = T.shots.doctor;
  const shot = new Shot('doctor', { fov: 30, background: '#b9bac4' });
  const S = shot.scene;
  studio(S, { env: 1.0, key: 1.6, rim: 1.2, hemi: 0.4, shadow: false });
  const D = 5.4 / Math.tan((15 * Math.PI) / 180);

  const photo = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  loadTexture('assets/stock/doctor-16x9.jpg').then((tex) => { photo.material.map = tex; photo.material.needsUpdate = true; });
  S.add(photo);

  // frosted glass: the slab shows the softened photograph where its view ray meets the picture, bent a
  // little by the slab's own curvature, with a cool tint, a bright rim and a sweep of light across it
  const blurTex = { value: null };
  loadTexture('assets/stock/doctor-16x9-blur.jpg').then((tex) => { blurTex.value = tex; });
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { tBlur: blurTex, uSweep: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tBlur; uniform float uSweep; varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 v = normalize(vW - cameraPosition);
        vec3 r = refract(v, normalize(vN), 0.72);
        float k = -vW.z / r.z;                     // where the bent ray meets the photograph (z = 0)
        vec2 p = vW.xy + r.xy * k;
        vec2 uv = p / vec2(19.2, 10.8) + 0.5;
        vec3 c = texture2D(tBlur, uv).rgb;
        c = mix(c, vec3(1.0), 0.2);                 // milky
        float fres = pow(1.0 - abs(dot(-v, normalize(vN))), 3.0);
        c += fres * 0.55;
        float s = exp(-pow((vW.x - uSweep) * 0.9 + vW.y * 0.4, 2.0) * 1.6) * 0.18;
        gl_FragColor = vec4(c + s, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const CW = 8.8, CH = 3.3;
  const cardG = new THREE.Group();
  S.add(cardG);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(CW, CH, 0.18, 8, 0.36), glassMat);
  cardG.add(slab);
  const scr = screen(1760, 660);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshBasicMaterial({ map: scr.tex, transparent: true, toneMapped: false }));
  plate.position.z = 0.092;
  cardG.add(plate);

  // the brand in the corners, as in the reference: wordmark top left, address top right
  S.add(shot.camera);
  const mark = type3d('HerCova', { weight: 800, size: 0.26, depth: 0.05, bevel: 0.006, material: new THREE.MeshPhysicalMaterial({ color: '#7b2fa8', roughness: 0.25, clearcoat: 1 }), castShadow: false });
  mark.group.position.set(-5.25, 2.2, -10);
  const url = type3d('hercovahealth.com', { weight: 700, size: 0.16, depth: 0.03, bevel: 0.004, material: MAT.ink(), align: 'right', castShadow: false });
  url.group.position.set(5.25, 2.23, -10);
  shot.camera.add(mark.group, url.group);

  const words = QUOTE.join(' ').split(' ');
  const wordAt = (i) => a + 1.15 + i * 0.13;
  const byAt = wordAt(words.length) + 0.25;
  const draw = (ctx, s) => {
    ctx.clearRect(0, 0, 1760, 660);
    let i = 0;
    QUOTE.forEach((line, li) => {
      let x = 100;
      line.split(' ').forEach((w) => {
        const p = s.words[i++];
        ctx.save();
        ctx.font = `700 70px ${FONT}`;
        const ww = ctx.measureText(w + ' ').width;
        if (p > 0) {
          ctx.filter = p < 1 ? `blur(${((1 - p) * 10).toFixed(1)}px)` : 'none';
          text(ctx, w, x, 150 + li * 92 + (1 - p) * 14, 70, 700, '#ffffff', { alpha: p });
        }
        ctx.restore();
        x += ww;
      });
    });
    if (s.by > 0) {
      ctx.save();
      ctx.globalAlpha = s.by;
      dot(ctx, 140, 540, 44, C.lilac);
      text(ctx, 'H', 140, 562, 50, 800, C.purple, { align: 'center' });
      text(ctx, BY.name, 206, 528, 42, 800, '#ffffff');
      text(ctx, BY.role, 206, 578, 34, 500, 'rgba(255,255,255,0.8)');
      // a heart, as in the reference
      ctx.fillStyle = '#ffffff';
      ctx.translate(1640, 548);
      ctx.scale(s.heart, s.heart);
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-30, -8, -18, -30, 0, -16); ctx.bezierCurveTo(18, -30, 30, -8, 0, 14); ctx.fill();
      ctx.restore();
    }
  };

  shot.update = (t) => {
    const k = seg(t, a, a + 1.6, 'expo.out');
    const drift = seg(t, a + 1.6, b, 'sine.inOut');
    shot.pose([lerp(0.9, 0.15, k) - 0.2 * drift, lerp(1.2, 0.1, k), lerp(11.5, D - 0.25, k) - 0.5 * drift], [lerp(0.9, 0.1, k) - 0.15 * drift, lerp(1.25, 0.05, k), 0], 30);
    shot.lens.focus = shot.camera.position.z - 1.2;
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.08;
    // the card: from filling the frame to its place on her coat
    const c = SETTLE.at(t, a + 0.1);
    cardG.position.set(lerp(0, -3.6, c), lerp(0.2, -2.35, c), lerp(9, 1.4, c));
    cardG.scale.setScalar(Math.max(lerp(1.35, 1, c), 0.001));
    cardG.rotation.set(lerp(0.08, -0.04, c), lerp(-0.1, 0.08, c), 0);
    glassMat.uniforms.uSweep.value = lerp(-8, 8, seg(t, a + 0.9, a + 2.4, 'power2.inOut'));
    const wp = words.map((_, i) => Math.round(seg(t, wordAt(i), wordAt(i) + 0.35, 'power2.out') * 20) / 20);
    const by = Math.round(seg(t, byAt, byAt + 0.4) * 20) / 20;
    const heart = Math.round(spring(300, 12).at(t, byAt + 0.35) * 20) / 20;
    scr.draw({ words: wp, by, heart }, draw);
    [mark, url].forEach((w, i) => { const kk = seg(t, a + 0.4 + i * 0.1, a + 0.9 + i * 0.1, 'power2.out'); w.group.visible = kk > 0.01; w.group.scale.setScalar(Math.max(kk, 0.001)); });
  };
  return shot;
}
