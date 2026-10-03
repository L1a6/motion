// The studio every shot shares: HDRI reflections (Poly Haven, CC0), a key light with soft shadows, a rim
// light, and the brand's materials.
import * as THREE from 'three';
import { loadEnv } from './engine.js';

export const ENV = loadEnv('assets/hdri/studio_small_09_2k.hdr');

export function studio(scene, { env = 1, key = 2.0, rim = 1.2, hemi = 0.35, keyPos = [-8, 14, 12], rimPos = [9, 6, -12], shadow = true, shadowBox = 12 } = {}) {
  ENV.then((tex) => { scene.environment = tex; });
  scene.environmentIntensity = env;
  const lights = {};
  if (hemi) scene.add((lights.hemi = new THREE.HemisphereLight(0xffffff, 0xd9c8f0, hemi)));
  if (key) {
    const k = (lights.key = new THREE.DirectionalLight(0xffffff, key));
    k.position.set(...keyPos);
    if (shadow) {
      k.castShadow = true;
      k.shadow.mapSize.set(2048, 2048);
      Object.assign(k.shadow.camera, { left: -shadowBox, right: shadowBox, top: shadowBox, bottom: -shadowBox, near: 0.5, far: 80 });
      k.shadow.bias = -0.0003;
      k.shadow.normalBias = 0.02;
      k.shadow.radius = 4;
    }
    scene.add(k, k.target);
  }
  if (rim) {
    const r = (lights.rim = new THREE.DirectionalLight(0xf3e8ff, rim));
    r.position.set(...rimPos);
    scene.add(r);
  }
  return lights;
}

const phys = (o) => new THREE.MeshPhysicalMaterial(o);
export const MAT = {
  porcelain: () => phys({ color: '#ffffff', roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
  gloss: (color) => phys({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 }),
  purple: () => phys({ color: '#7b2fa8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }),
  orange: (glow = 0.3) => phys({ color: '#ee7b1e', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#ee7b1e', emissiveIntensity: glow }),
  ink: () => phys({ color: '#141019', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
  glass: (o = {}) => phys({ color: '#ffffff', transmission: 1, thickness: 0.5, roughness: 0.03, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.35, iridescenceIOR: 1.25, specularIntensity: 1, ...o }),
  frosted: (o = {}) => phys({ color: '#ffffff', transmission: 1, thickness: 0.8, roughness: 0.42, ior: 1.4, clearcoat: 1, clearcoatRoughness: 0.25, specularIntensity: 0.9, ...o }),
  light: (color, intensity = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false }),
};
