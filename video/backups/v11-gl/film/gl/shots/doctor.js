/*
 * 6 · A CLINICIAN (31.0 – 36.7 s). The 16-10 reference: a sharp full-bleed portrait of a clinician, the camera
 * easing back from close; a frosted-glass card (it blurs the photograph behind it, and bends it at its rounded
 * edge) shrinks from full frame onto her coat with a spring; the words arrive one at a time out of a blur; the
 * attribution and a heart follow. Brand top left, address top right.
 *
 * The words are HerCova's own ("detecting a warning sign is only useful if something happens next", from the
 * site), attributed to HerCova. When a clinician's real words and consent exist, they replace QUOTE / BY.
 */
import * as THREE from 'three';
import { Shot, V3, clamp, lerp, seg, spring, loadTexture } from '../engine.js';
import { textLayer, blurIn } from '../kit/text.js';
import { glassCard, shape } from '../kit/glass.js';

const T = window.HC_T;
const QUOTE = '“Detecting a warning sign is\nonly useful if something\nhappens next.”';
const BY = { name: 'HerCova', role: 'Our belief' };
const SETTLE = spring(120, 16);
const HEART = spring(320, 12);

export function doctor() {
  const [a, b] = T.shots.doctor;
  const shot = new Shot('doctor', { fov: 30, background: '#b9bac4' });
  const D = 5.4 / Math.tan((15 * Math.PI) / 180);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  loadTexture('assets/stock/doctor-16x9.jpg').then((tex) => { photo.material.map = tex; photo.material.needsUpdate = true; });
  shot.bg.add(photo);

  const CW = 7.6, CH = 3.2;
  const card = glassCard({ w: CW, h: CH, r: 0.42, blur: 5.2, tint: 0.12, rim: 0.55, refract: 0.03, shadow: 0.3 });
  shot.scene.add(card.group);
  const quote = textLayer(QUOTE, { size: 0.4, weight: 700, color: '#ffffff', lineHeight: 1.22 });
  quote.mesh.position.set(-CW / 2 + 0.5, CH / 2 - 0.72, 0.02);
  const avatar = shape({ w: 0.5, h: 0.5, r: 0.25, color: '#f3ebfa', maxW: 0.8, maxH: 0.8 });
  avatar.mesh.position.set(-CW / 2 + 0.75, -CH / 2 + 0.55, 0.02);
  const initial = textLayer('H', { size: 0.26, weight: 800, color: '#7b2fa8', align: 'center' });
  initial.mesh.position.set(-CW / 2 + 0.75, -CH / 2 + 0.46, 0.03);
  const name = textLayer(BY.name, { size: 0.24, weight: 800, color: '#ffffff' });
  name.mesh.position.set(-CW / 2 + 1.15, -CH / 2 + 0.58, 0.02);
  const role = textLayer(BY.role, { size: 0.18, weight: 500, color: '#f1eaff' });
  role.mesh.position.set(-CW / 2 + 1.15, -CH / 2 + 0.3, 0.02);
  // a heart, drawn from two dots and a turned square (as in the reference)
  const heart = new THREE.Group();
  const h1 = shape({ w: 0.2, h: 0.2, r: 0.1, maxW: 0.4, maxH: 0.4 }), h2 = shape({ w: 0.2, h: 0.2, r: 0.1, maxW: 0.4, maxH: 0.4 }), h3 = shape({ w: 0.2, h: 0.2, r: 0.02, maxW: 0.4, maxH: 0.4 });
  h1.mesh.position.set(-0.07, 0.04, 0); h2.mesh.position.set(0.07, 0.04, 0); h3.mesh.position.set(0, -0.035, 0); h3.mesh.rotation.z = Math.PI / 4;
  heart.add(h1.mesh, h2.mesh, h3.mesh);
  heart.position.set(CW / 2 - 0.6, -CH / 2 + 0.48, 0.02);
  card.group.add(quote.mesh, avatar.mesh, initial.mesh, name.mesh, role.mesh, heart);

  // brand in the corners, riding with the camera
  shot.scene.add(shot.camera);
  const mark = textLayer('HerCova', { size: 0.34, weight: 800, color: '#7b2fa8' });
  mark.mesh.position.set(-4.35, 2.25, -10);
  const url = textLayer('hercovahealth.com', { size: 0.2, weight: 700, color: '#16141a', align: 'right' });
  url.mesh.position.set(4.35, 2.28, -10);
  shot.camera.add(mark.mesh, url.mesh);

  const nWords = QUOTE.replace(/\n/g, ' ').split(' ').length;
  const wordAt = (i) => a + 1.15 + i * 0.12;
  const byAt = wordAt(nWords) + 0.2;

  shot.update = (t) => {
    const k = seg(t, a, a + 1.6, 'expo.out');
    const drift = seg(t, a + 1.6, b, 'sine.inOut');
    shot.pose([lerp(0.9, 0.15, k) - 0.2 * drift, lerp(1.2, 0.1, k), lerp(11.5, D - 0.25, k) - 0.5 * drift], [lerp(0.9, 0.1, k) - 0.15 * drift, lerp(1.25, 0.05, k), 0], 30);
    shot.lens.aperture = 0;
    shot.lens.bloom = 0.03;
    // the card: from filling the frame to its place on her coat
    const c = SETTLE.at(t, a + 0.1);
    card.group.position.set(lerp(0, -3.5, c), lerp(0.2, -2.25, c), lerp(9, 1.4, c));
    card.group.scale.setScalar(Math.max(lerp(1.35, 1, c), 0.001));
    card.group.rotation.set(lerp(0.08, -0.03, c), lerp(-0.1, 0.07, c), 0);
    card.u.uSheen.value = lerp(-8, 8, seg(t, a + 0.9, a + 2.4, 'power2.inOut'));
    // the quote: word by word, each word's letters out of a blur together (lines break between words)
    let wi = 0;
    quote.all((l, j) => {
      const prev = quote.letters[j - 1];
      if (j > 0 && prev && (prev.space || prev.line !== l.line) && !l.space) wi++;
      if (l.space) return { alpha: 0 };
      return blurIn(clamp((t - wordAt(wi)) / 0.35), { rise: 0.12, blur: 4, scale: 0.96 });
    });
    const by = clamp((t - byAt) / 0.4);
    [name, role, initial].forEach((L, i) => L.all((l, j) => blurIn(clamp((t - byAt - 0.05 * i - j * 0.012) / 0.4))));
    avatar.u.uA.value = by;
    const hk = HEART.at(t, byAt + 0.35);
    heart.scale.setScalar(Math.max(hk, 0.001));
    [mark, url].forEach((L, i) => L.all((l, j) => blurIn(clamp((t - a - 0.4 - i * 0.1 - j * 0.01) / 0.45))));
  };
  return shot;
}
