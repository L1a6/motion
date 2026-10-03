/*
 * A small canvas UI kit for the screens inside the 3D devices (her portal, the care-team console): crisp
 * text in the brand face, rounded cards, soft shadows. A screen redraws only when its state changes.
 */
import * as THREE from 'three';
import { track } from './engine.js';

export const FONT = '"Open Sauce One", sans-serif';
track(Promise.all(['500', '700', '800'].map((w) => document.fonts.load(`${w} 40px "Open Sauce One"`))));

export const C = {
  ink: '#16141a', ink2: '#4a4751', mute: '#8e8b96', hair: '#e8e6ec', fill: '#f4f3f6', paper: '#ffffff', ground: '#f6f3fa',
  purple: '#7b2fa8', lilac: '#e6d8f4', lilac2: '#f3ebfa', orange: '#ee7b1e', red: '#d6483f', redSoft: '#fbe9e7', green: '#3f9142', greenSoft: '#e7f3e7',
};

export function screen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let key = null;
  return {
    canvas, ctx, tex, w, h,
    // draw(state) redraws only when the state's key changes, so a still screen costs nothing
    draw(state, fn) {
      const k = JSON.stringify(state);
      if (k === key) return;
      key = k;
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      fn(ctx, state);
      ctx.restore();
      tex.needsUpdate = true;
    },
  };
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function card(ctx, x, y, w, h, r, fill = C.paper, shadow = 0.12) {
  ctx.save();
  if (shadow) { ctx.shadowColor = `rgba(40, 20, 60, ${shadow})`; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14; }
  ctx.fillStyle = fill;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}
export function text(ctx, s, x, y, size, weight = 700, color = C.ink, { align = 'left', track = -0.01, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha; // inherit any fade already set by the caller
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${track * size}px`;
  ctx.fillText(s, x, y);
  ctx.restore();
}
export function chip(ctx, s, x, y, h, fill, color, size = h * 0.42) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(s).width + h * 0.9;
  ctx.fillStyle = fill;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x + h * 0.45, y + h / 2 + 1);
  ctx.restore();
  return w;
}
export function dot(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
