/*
 * The phone's live screen: the HerCova app's home, drawn into a canvas the 3D phone wears as its display
 * (film/gl.js). Laid out in points on a 390-pt-wide screen, drawn at ~3×. The dynamic island morphs into a
 * live activity ("Check-in due") on a spring; the camera then dives through it.
 */
const T = window.HC_T;
export const SCREEN_W = 1200;
export const SCREEN_H = 2560;
const U = SCREEN_W / 390; // px per point
const PT_H = SCREEN_H / U;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const seg = (t, a, b, e = 'none') => gsap.parseEase(e)(clamp((t - a) / (b - a)));
function spring(k, c) {
  const w0 = Math.sqrt(k), z = c / (2 * Math.sqrt(k));
  const wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
  return (t, t0) => (t <= t0 ? 0 : 1 - Math.exp(-z * w0 * (t - t0)) * (Math.cos(wd * (t - t0)) + ((z * w0) / wd) * Math.sin(wd * (t - t0))));
}
const islandSpring = spring(120, 12.5);
const INK = '#1d1d1f', GREY = '#6e6e73', PURPLE = '#7f5ac4', LILAC = '#f1e9f8', DEEP = '#6a47ad'; // deep lilac only — never plum
const MARK = new Path2D(window.HC_LOGO.P.purple.split('Z')[0] + 'Z'); // the swoosh
const FIG = new Path2D(window.HC_LOGO.P.orange);

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function text(ctx, s, x, y, size, weight, color, align = 'left') {
  ctx.font = `${weight} ${size}px "Open Sauce One"`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}
function mark(ctx, x, y, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(h / 524, h / 524);
  ctx.fillStyle = '#7B2FA8';
  ctx.fill(MARK);
  ctx.fillStyle = '#EE7B1E';
  ctx.fill(FIG);
  ctx.restore();
}

export function drawScreen(ctx, t) {
  ctx.setTransform(U, 0, 0, U, 0, 0);
  ctx.clearRect(0, 0, 390, PT_H);
  ctx.fillStyle = '#f7f5fa';
  ctx.fillRect(0, 0, 390, PT_H);

  // status bar
  text(ctx, '9:41', 44, 38, 16, 700, INK);
  ctx.fillStyle = INK;
  [0, 1, 2, 3].forEach((i) => rr(ctx, 292 + i * 5, 34 - (i + 1) * 3, 3.2, (i + 1) * 3, 1) || ctx.fill());
  rr(ctx, 320, 27, 26, 12, 3.5); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
  rr(ctx, 322.5, 29.5, 19, 7, 2); ctx.fill();

  // greeting
  text(ctx, 'Good morning, Amina', 24, 104, 16, 500, GREY);
  text(ctx, 'Week 28', 24, 146, 38, 800, INK);
  rr(ctx, 196, 120, 112, 28, 14); ctx.fillStyle = LILAC; ctx.fill();
  text(ctx, 'Third trimester', 252, 139, 12.5, 700, PURPLE, 'center');
  // the week ring
  ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.strokeStyle = '#e9e1f2'; ctx.beginPath(); ctx.arc(340, 128, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = PURPLE; ctx.beginPath(); ctx.arc(340, 128, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (28 / 40) * seg(t, T.S.phone.in + 0.6, T.S.phone.in + 1.8, 'power3.out')); ctx.stroke();

  // check-in card
  ctx.save();
  ctx.shadowColor = 'rgba(29,10,48,0.10)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  rr(ctx, 16, 176, 358, 300, 26); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  text(ctx, "Today's check-in", 36, 212, 14, 600, GREY);
  text(ctx, 'How are you feeling?', 36, 244, 23, 700, INK);
  const chips = ['Severe headache', 'Blurred vision', 'Swollen face', 'Feeling well'];
  chips.forEach((c, i) => {
    const x = 36 + (i % 2) * 163, y = 264 + Math.floor(i / 2) * 72;
    rr(ctx, x, y, 155, 62, 18); ctx.fillStyle = LILAC; ctx.fill();
    text(ctx, c, x + 14, y + 36, 14, 600, DEEP);
  });
  rr(ctx, 36, 412, 318, 48, 24); ctx.fillStyle = INK; ctx.fill();
  text(ctx, 'Start check-in', 195, 442, 16, 700, '#fff', 'center');

  // this week
  ctx.save();
  ctx.shadowColor = 'rgba(29,10,48,0.08)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
  rr(ctx, 16, 492, 358, 104, 26); ctx.fillStyle = '#ffffff'; ctx.fill();
  rr(ctx, 16, 612, 358, 92, 26); ctx.fill();
  ctx.restore();
  text(ctx, 'This week', 36, 524, 13, 700, PURPLE);
  text(ctx, 'Rest when you can, and keep', 36, 552, 16, 600, INK);
  text(ctx, 'your clinic visit on Thursday.', 36, 574, 16, 600, INK);
  rr(ctx, 36, 632, 52, 52, 14); ctx.fillStyle = LILAC; ctx.fill();
  text(ctx, 'THU', 62, 654, 10, 800, PURPLE, 'center');
  text(ctx, '10', 62, 676, 20, 800, DEEP, 'center');
  text(ctx, 'Antenatal visit', 104, 654, 16, 700, INK);
  text(ctx, 'Ikeja PHC · 10:00', 104, 676, 14, 500, GREY);

  // tab bar
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(0, PT_H - 84, 390, 84);
  ['Home', 'Check-in', 'Learn', 'Care team'].forEach((l, i) => {
    const x = 49 + i * 97;
    ctx.fillStyle = i === 0 ? PURPLE : '#b8b3c2';
    rr(ctx, x - 11, PT_H - 70, 22, 22, 7); ctx.fill();
    text(ctx, l, x, PT_H - 32, 11, 600, i === 0 ? PURPLE : '#9a96a3', 'center');
  });
  rr(ctx, 128, PT_H - 14, 134, 5, 2.5); ctx.fillStyle = INK; ctx.fill();

  // the dynamic island → a live activity (shape morph on a spring)
  const p = islandSpring(t, T.S.phone.island);
  const w = lerp(122, 370, p), h = lerp(36, 96, p), r = lerp(18, 46, p);
  rr(ctx, 195 - w / 2, 11, w, h, r);
  ctx.fillStyle = '#000';
  ctx.fill();
  const a = clamp((p - 0.55) / 0.3);
  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = a;
    rr(ctx, 30, 30, 58, 58, 16); ctx.fillStyle = '#ffffff'; ctx.fill();
    mark(ctx, 46.5, 34, 50);
    text(ctx, 'Check-in due', 102, 54, 18, 700, '#fff');
    text(ctx, 'Week 28 · one minute', 102, 77, 14, 500, 'rgba(255,255,255,0.62)');
    rr(ctx, 286, 40, 74, 36, 18); ctx.fillStyle = PURPLE; ctx.fill();
    text(ctx, 'Start', 323, 64, 15, 700, '#fff', 'center');
    ctx.restore();
  }
}
