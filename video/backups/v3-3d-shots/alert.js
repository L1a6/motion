/*
 * 5 · THE ALERT (25.0 – 31.2 s), two shots joined by a whip pan.
 *  phone    her phone floats over a soft full-bleed photograph of her at home. She reports a danger sign; the
 *           card lifts off the screen as a frosted-glass slab and flies out of frame — the camera whips after it
 *  console  her care team's screen, over a soft photograph of the clinic. The same glass card flies in and
 *           lands as the flagged row ("danger"); on "alerted" a nurse claims it. "Her care team is alerted."
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { Shot, V3, clamp, lerp, seg, spring, ease, bump, loadTexture } from '../engine.js';
import { studio, MAT } from '../studio.js';
import { screen, rr, card, text, chip, dot, C } from '../ui.js';
import { type3d } from '../type3d.js';

const T = window.HC_T;
const WORDS = window.HERCOVA_WORDS || {};
const vo3 = T.vo.find((v) => v.id === 'vo3');
const w3 = (i) => vo3.at + (WORDS.vo3 ? WORDS.vo3[i][1] : i * 0.35);
const POP = spring(260, 16);
const LAND = spring(150, 15);

function backdrop(url, w, h, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  loadTexture(url).then((tex) => { m.material.map = tex; m.material.needsUpdate = true; });
  m.position.z = z;
  return m;
}
function roundedPlane(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ShapeGeometry(s, 16);
  // UVs across the rectangle, so a screen texture maps edge to edge
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

// the frosted-glass card: a translucent slab with the card's words on a plate just inside its face
function glassCard(scr) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(2.9, 1.0, 0.1, 6, 0.08), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.62, specularIntensity: 1 }));
  const face = new THREE.Mesh(roundedPlane(2.9, 1.0, 0.08), new THREE.MeshBasicMaterial({ map: scr.tex, transparent: true, toneMapped: false }));
  face.position.z = 0.052;
  slab.castShadow = true;
  g.add(slab, face);
  return g;
}
function drawAlertCard(ctx, w, h, s) {
  dot(ctx, 70, h / 2, 16, C.red);
  text(ctx, 'Danger sign reported', 118, h / 2 - 8, 50, 800, C.ink);
  text(ctx, s.claimed ? 'Her care team is alerted' : 'Severe headache · blurred vision', 118, h / 2 + 50, 34, 500, s.claimed ? C.purple : C.ink2);
}

/* ======================================================================
   her phone
   ====================================================================== */
export function phone() {
  const [a, b] = T.shots.phone;
  const shot = new Shot('phone', { fov: 30, background: '#e9dcc9' });
  const S = shot.scene;
  const lights = studio(S, { env: 1.1, key: 2.4, rim: 1.4, hemi: 0.4, keyPos: [-6, 8, 10], shadowBox: 8 });
  S.add(backdrop('assets/stock/home-blur.jpg', 64, 42.7, -22));

  const rig = new THREE.Group();
  S.add(rig);
  const PW = 3.0, PH = 6.2;
  const body = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, 0.32, 10, 0.44), new THREE.MeshPhysicalMaterial({ color: '#cbbfe2', metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.1 }));
  body.castShadow = true;
  rig.add(body);
  const bezel = new THREE.Mesh(roundedPlane(PW - 0.1, PH - 0.1, 0.4), new THREE.MeshPhysicalMaterial({ color: '#0c0a10', roughness: 0.15, clearcoat: 1 }));
  bezel.position.z = 0.161;
  rig.add(bezel);
  const scr = screen(900, 1950);
  const display = new THREE.Mesh(roundedPlane(PW - 0.26, PH - 0.26, 0.33), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  display.position.z = 0.163;
  rig.add(display);
  const sheen = new THREE.Mesh(roundedPlane(PW - 0.1, PH - 0.1, 0.4), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.08, metalness: 0 }));
  sheen.position.z = 0.166;
  rig.add(sheen);
  [[-1, 1.5, 0.5], [-1, 0.8, 0.5], [1, 1.1, 0.8]].forEach(([side, y, len]) => {
    const btn = new THREE.Mesh(new RoundedBoxGeometry(0.06, len, 0.12, 4, 0.03), body.material);
    btn.position.set(side * (PW / 2 + 0.02), y, 0);
    rig.add(btn);
  });

  const cardScr = screen(1160, 400);
  const gcard = glassCard(cardScr);
  S.add(gcard);

  const tap = 25.55, report = 25.9, lift = 26.45;
  const drawPhone = (ctx, s) => {
    const W = 900, H = 1950;
    ctx.fillStyle = C.ground; ctx.fillRect(0, 0, W, H);
    // status bar and the island
    text(ctx, '9:41', 70, 78, 34, 700, C.ink);
    ctx.fillStyle = '#0c0a10'; rr(ctx, W / 2 - 110, 30, 220, 64, 32); ctx.fill();
    [[W - 150, 18], [W - 110, 24], [W - 70, 30]].forEach(([x, h]) => { ctx.fillStyle = C.ink; rr(ctx, x, 80 - h, 22, h, 5); ctx.fill(); });
    // header
    text(ctx, 'Good morning', 60, 230, 36, 500, C.mute);
    text(ctx, 'Week 28', 60, 316, 86, 800, C.ink, { track: -0.03 });
    dot(ctx, W - 110, 262, 56, C.lilac); text(ctx, 'A', W - 110, 280, 48, 800, C.purple, { align: 'center' });
    // progress
    ctx.fillStyle = C.hair; rr(ctx, 60, 360, W - 120, 16, 8); ctx.fill();
    ctx.fillStyle = C.purple; rr(ctx, 60, 360, (W - 120) * 0.7, 16, 8); ctx.fill();
    text(ctx, '12 weeks to go', 60, 430, 32, 500, C.ink2);
    // today's check-in
    card(ctx, 44, 490, W - 88, 560, 44);
    text(ctx, "Today's check-in", 96, 580, 44, 800, C.ink);
    text(ctx, 'Anything worrying you today?', 96, 640, 32, 500, C.mute);
    const opts = ['Severe headache', 'Blurred vision', 'Swelling', 'Bleeding', 'Fever', 'All good'];
    opts.forEach((o, i) => {
      const x = 96 + (i % 2) * 360, y = 690 + Math.floor(i / 2) * 110;
      const on = s.sel && (i === 0 || i === 1);
      ctx.fillStyle = on ? C.purple : C.fill; rr(ctx, x, y, 336, 86, 24); ctx.fill();
      text(ctx, o, x + 32, y + 56, 32, 700, on ? '#ffffff' : C.ink);
    });
    // her guidance
    card(ctx, 44, 1090, W - 88, 250, 44);
    text(ctx, 'This week', 96, 1170, 32, 500, C.mute);
    text(ctx, 'Rest, and keep your', 96, 1230, 42, 700, C.ink);
    text(ctx, 'clinic appointment.', 96, 1284, 42, 700, C.ink);
    // the report, sliding up from the foot of the screen
    if (s.card > 0) {
      const y = lerp(H + 40, 1380, s.card);
      ctx.save();
      ctx.globalAlpha = s.onScreen;
      card(ctx, 44, y, W - 88, 330, 44, C.paper, 0.2);
      ctx.fillStyle = C.redSoft; rr(ctx, 44, y, W - 88, 330, 44); ctx.fill();
      dot(ctx, 110, y + 90, 18, C.red);
      text(ctx, 'Danger sign reported', 150, y + 104, 44, 800, C.ink);
      text(ctx, 'Severe headache · blurred vision', 96, y + 184, 32, 500, C.ink2);
      text(ctx, 'Alerting your care team…', 96, y + 262, 34, 700, C.red);
      ctx.restore();
    }
    // tab bar
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, H - 170, W, 170);
    ['Home', 'Check-in', 'Learn', 'Me'].forEach((l, i) => { const x = 112 + i * 225; dot(ctx, x, H - 118, 22, i === 1 ? C.purple : C.hair); text(ctx, l, x, H - 60, 26, 700, i === 1 ? C.purple : C.mute, { align: 'center' }); });
    ctx.fillStyle = C.ink; rr(ctx, W / 2 - 130, H - 26, 260, 10, 5); ctx.fill();
  };

  const CAM = (t) => {
    const k = seg(t, a, lift, 'sine.inOut');
    const w = seg(t, lift + 0.3, b, 'power3.in'); // the whip: the camera snaps right after the card
    return { p: [lerp(-2.6, -1.2, k) + 5.5 * w, lerp(1.2, 0.8, k), lerp(14.2, 12.4, k)], l: [lerp(0.2, 0.3, k) + 7 * w, lerp(0.35, 0.3, k), 0] };
  };
  const _v = new V3();
  shot.update = (t) => {
    const c = CAM(t);
    shot.pose(c.p, c.l, 30);
    shot.lens.focus = shot.camera.position.distanceTo(_v.set(0, 0, 0));
    shot.lens.aperture = 4;
    shot.lens.bloom = 0.1;
    rig.rotation.set(-0.06 + 0.02 * Math.sin(t * 0.9), 0.32 - 0.1 * seg(t, a, lift, 'sine.inOut'), 0.03);
    rig.position.y = 0.08 * Math.sin(t * 1.1);
    const sel = t > tap;
    const cardIn = seg(t, report, report + 0.5, 'expo.out');
    const onScreen = 1 - seg(t, lift - 0.02, lift + 0.05);
    scr.draw({ sel, card: Math.round(cardIn * 60) / 60, onScreen }, (ctx, s) => drawPhone(ctx, s));
    // the card lifts off the glass and flies toward the lens and out of frame
    const u = clamp((t - lift) / (b - lift));
    gcard.visible = t > lift;
    cardScr.draw({ claimed: false }, (ctx, s) => drawAlertCard(ctx, 1160, 400, s));
    const start = new V3(0, -2.2 + 0.0, 0.3).applyMatrix4(rig.matrixWorld);
    const e = ease('power2.in')(u);
    gcard.position.set(start.x + 7.5 * e, start.y + lerp(0, 1.9, ease('power2.out')(clamp(u * 2))), start.z + lerp(0, 3.2, ease('power2.out')(clamp(u * 1.6))));
    gcard.rotation.set(lerp(-0.06, 0.12, u), lerp(0.32, -0.25, u), lerp(0.03, -0.08, u));
    gcard.scale.setScalar(lerp(0.9, 1.05, clamp(u * 2)));
  };
  return shot;
}

/* ======================================================================
   her care team's screen
   ====================================================================== */
export function consoleShot() {
  const [a, b] = T.shots.console;
  const shot = new Shot('console', { fov: 30, background: '#cfd6df' });
  const S = shot.scene;
  studio(S, { env: 1.0, key: 2.2, rim: 1.2, hemi: 0.45, keyPos: [-8, 9, 12], shadowBox: 9 });
  S.add(backdrop('assets/stock/clinic-blur.jpg', 64, 45.2, -24));

  const rig = new THREE.Group();
  rig.rotation.y = -0.22;
  S.add(rig);
  const MW = 9.2, MH = 5.9;
  const mon = new THREE.Mesh(new RoundedBoxGeometry(MW, MH, 0.24, 8, 0.2), new THREE.MeshPhysicalMaterial({ color: '#1a1620', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.2 }));
  mon.castShadow = true;
  rig.add(mon);
  const scr = screen(1600, 1000);
  const display = new THREE.Mesh(roundedPlane(MW - 0.3, MH - 0.3, 0.1), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  display.position.z = 0.123;
  rig.add(display);

  const cardScr = screen(1160, 400);
  const gcard = glassCard(cardScr);
  S.add(gcard);
  const say = type3d('Her care team is alerted.', { weight: 800, size: 0.46, depth: 0.1, bevel: 0.012, tracking: -0.02, material: MAT.gloss('#ffffff'), align: 'left' });
  say.group.position.set(-4.1, -2.35, 1.4);
  rig.add(say.group);

  const flagAt = w3(2) - 0.05, claimAt = w3(9);
  const drawConsole = (ctx, s) => {
    const W = 1600, H = 1000;
    ctx.fillStyle = '#f7f6fa'; ctx.fillRect(0, 0, W, H);
    // sidebar
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 300, H);
    text(ctx, 'HerCova', 40, 80, 40, 800, C.purple, { track: -0.03 });
    text(ctx, 'CARE TEAM', 40, 118, 18, 700, C.mute, { track: 0.2 });
    ['Today', 'Women', 'Alerts', 'Referrals', 'Reports'].forEach((l, i) => {
      if (i === 2) { ctx.fillStyle = C.lilac2; rr(ctx, 20, 176 + i * 64, 260, 52, 14); ctx.fill(); }
      text(ctx, l, 44, 211 + i * 64, 24, i === 2 ? 800 : 500, i === 2 ? C.purple : C.ink2);
    });
    // header
    text(ctx, 'Alerts', 350, 100, 48, 800, C.ink, { track: -0.03 });
    text(ctx, 'Tuesday · On duty: 3', 350, 142, 22, 500, C.mute);
    // rows: the new one slides in on top, the rest move down
    const rows = [['A. O.', 'Week 34', 'Check-in done', C.lilac2, C.purple], ['F. B.', 'Week 22', 'Stable', C.greenSoft, C.green], ['N. E.', 'Week 30', 'Check-in done', C.lilac2, C.purple], ['H. M.', 'Week 18', 'Stable', C.greenSoft, C.green], ['R. A.', 'Week 26', 'Stable', C.greenSoft, C.green]];
    const top = 190, rh = 118;
    const shift = s.flag * rh;
    rows.forEach((r, i) => {
      const y = top + i * rh + shift;
      if (y > H) return;
      card(ctx, 340, y, W - 390, rh - 18, 20, '#ffffff', 0.05);
      dot(ctx, 400, y + 50, 26, C.fill); text(ctx, r[0], 400, y + 58, 20, 800, C.ink2, { align: 'center' });
      text(ctx, 'Enrolled woman', 450, y + 46, 26, 700, C.ink);
      text(ctx, r[1], 450, y + 80, 20, 500, C.mute);
      chip(ctx, r[2], W - 330, y + 30, 42, r[3], r[4]);
    });
    if (s.flag > 0) {
      ctx.save();
      ctx.globalAlpha = s.flag;
      const y = top + (s.flag - 1) * rh;
      card(ctx, 340, y, W - 390, rh - 18, 20, '#ffffff', 0.12);
      ctx.fillStyle = C.red; rr(ctx, 340, y, 10, rh - 18, 5); ctx.fill();
      dot(ctx, 400, y + 50, 26, C.redSoft); dot(ctx, 400, y + 50, 10, C.red);
      text(ctx, 'Danger sign reported', 450, y + 46, 26, 800, C.ink);
      text(ctx, 'Week 28 · severe headache, blurred vision · just now', 450, y + 80, 20, 500, C.ink2);
      if (s.claimed) chip(ctx, '✓ Claimed · nurse on duty', W - 420, y + 30, 42, C.lilac2, C.purple);
      else { ctx.fillStyle = C.purple; rr(ctx, W - 230, y + 28, 150, 46, 23); ctx.fill(); text(ctx, 'Claim', W - 155, y + 59, 22, 800, '#ffffff', { align: 'center' }); }
      ctx.restore();
    }
    // the cursor
    if (s.cursor) {
      const [cx, cy] = s.cursor;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s.press ? 0.86 : 1, s.press ? 0.86 : 1);
      ctx.fillStyle = C.ink; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.lineTo(11, 33); ctx.lineTo(20, 52); ctx.lineTo(28, 48); ctx.lineTo(19, 30); ctx.lineTo(34, 30); ctx.closePath();
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }
  };

  const _v = new V3();
  shot.update = (t) => {
    // arrive out of the whip (the camera settles from the left), then a slow push toward the flagged row
    const w = seg(t, a, a + 0.45, 'power3.out');
    const k = seg(t, a + 0.4, b, 'sine.inOut');
    const p = [lerp(-7.5, -1.4, w) + lerp(0, 0.8, k), lerp(0.2, 0.9, k), lerp(14.5, 11.2, k)];
    const l = [lerp(-8, 0, w) + lerp(0, 0.6, k), lerp(0, 0.9, k), 0];
    shot.pose(p, l, 30);
    shot.lens.focus = shot.camera.position.distanceTo(_v.set(0.5, 0.8, 0));
    shot.lens.aperture = 3.5;
    shot.lens.bloom = 0.1;
    // the glass card lands as the flagged row
    const u = ease('power3.out')(clamp((t - a) / (flagAt - a + 0.15)));
    const rowPos = new V3(0.35, 1.55, 0.3).applyMatrix4(rig.matrixWorld);
    gcard.visible = u < 1;
    gcard.position.set(lerp(-9, rowPos.x, u), lerp(1.2, rowPos.y, u), lerp(3.5, rowPos.z, u));
    gcard.rotation.set(lerp(0.12, 0, u), lerp(-0.25, -0.22, u), lerp(-0.08, 0, u));
    gcard.scale.setScalar(lerp(1.05, 0.95, u));
    cardScr.draw({ claimed: false }, (ctx, s) => drawAlertCard(ctx, 1160, 400, s));
    const flag = seg(t, flagAt, flagAt + 0.35, 'power3.out');
    const claimed = t > claimAt + 0.05;
    const cur = t > claimAt - 1.0 ? [lerp(1100, 1440, seg(t, claimAt - 1.0, claimAt - 0.15, 'power3.inOut')), lerp(700, 243, seg(t, claimAt - 1.0, claimAt - 0.15, 'power3.inOut'))] : null;
    scr.draw({ flag: Math.round(flag * 60) / 60, claimed, cursor: cur && cur.map(Math.round), press: Math.abs(t - claimAt) < 0.08 }, (ctx, s) => drawConsole(ctx, s));
    // "Her care team is alerted." lands on "alerted"
    say.letters.forEach((l2, i) => {
      const kk = LAND.at(t, claimAt - 0.05 + i * 0.02);
      l2.mesh.visible = kk > 0.001;
      l2.mesh.scale.setScalar(Math.max(kk, 0.001));
      l2.mesh.position.y = l2.home.y + lerp(-0.3, 0, kk);
    });
  };
  return shot;
}
