// The film's 3D cut: every shot, and the transitions between them. film/core.js drives window.__gl.render(t).
import { render, addShot, addTransition, allLoaded, toScreen, V3, W, H } from './engine.js';
import { pulse } from './shots/pulse.js';
import { woman } from './shots/woman.js';
import { glass } from './shots/glass.js';
import { drum } from './shots/drum.js';
import { phone, consoleShot } from './shots/alert.js';
import { doctor } from './shots/doctor.js';
import { time } from './shots/time.js';
import { end } from './shots/end.js';

const T = window.HC_T;
const S = T.shots;

const uvOf = (shot, v) => { const s = toScreen(shot, v); return [s[0] / W, 1 - s[1] / H]; };

const pulseShot = addShot(pulse(), ...S.pulse);
const womanShot = addShot(woman(), ...S.woman);
// crash zoom through the clock ring, into her pearl, out of her heart
addTransition(pulseShot, womanShot, T.through[0], T.through[1], 'zoom', { center: () => uvOf(pulseShot, new V3(0, 0, 0)) });
const glassShot = addShot(glass(), ...S.glass);
// crash zoom into her pin, out into the fluted-glass world
addTransition(womanShot, glassShot, T.dive[0] + 0.1, T.dive[1] + 0.05, 'zoom', { center: () => uvOf(womanShot, womanShot.herTop) });
const drumShot = addShot(drum(), ...S.drum);
// a vertical whip out of the glass, onto the drum
addTransition(glassShot, drumShot, S.drum[0] - 0.05, S.drum[0] + 0.3, 'whip', { dir: [0, 1] });
const phoneShot = addShot(phone(), ...S.phone);
addTransition(drumShot, phoneShot, S.phone[0] - 0.05, S.phone[0] + 0.3, 'zoom', { center: [0.46, 0.5] });
const consoleSh = addShot(consoleShot(), ...S.console);
// the whip after the glass card, from her phone to her care team
addTransition(phoneShot, consoleSh, S.console[0], S.phone[1], 'whip', { dir: [1, 0], ease: 'power1.inOut' });
const doctorShot = addShot(doctor(), ...S.doctor);
addTransition(consoleSh, doctorShot, S.doctor[0], S.doctor[0] + 0.32, 'zoom', { center: [0.62, 0.62] });
const timeShot = addShot(time(), ...S.time);
addTransition(doctorShot, timeShot, S.time[0], S.time[0] + 0.3, 'whip', { dir: [-1, 0] });
const endShot = addShot(end(), ...S.end);
addTransition(timeShot, endShot, S.end[0], S.end[0] + 0.32, 'zoom', { center: [0.36, 0.52] });

const DEBUG = !!window.__HC3D_DEBUG;
const t0 = performance.now();
allLoaded().then(() => {
  // warm every shader once so no frame pays for compilation
  [0.6, 2.5, 3.6, 5.0, 8.5, 11.0, 12.9, 15.0, 19.6, 22, 25.1, 26.8, 27.2, 29, 31.1, 33, 36.6, 39, 41.1, 42.5, 45, 47.8].forEach((t) => render(t));
  if (DEBUG) console.log('[3d] ready in', Math.round(performance.now() - t0), 'ms');
  window.__gl = { render, shots: { pulse: pulseShot, woman: womanShot, glass: glassShot, drum: drumShot, phone: phoneShot, console: consoleSh, doctor: doctorShot, time: timeShot, end: endShot } };
  if (window.__hcRenderNow) window.__hcRenderNow();
  if (window.__hc3dReady) window.__hc3dReady();
}).catch((e) => console.error('[3d] asset load failed', e));
