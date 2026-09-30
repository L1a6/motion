// Builds the film's sound: prepares every file, then writes the audio tracks into
// index.html (between AUDIO:BEGIN / AUDIO:END) — one <audio> per cue, so the Studio
// timeline shows the edit, and every cue sits on the moment it belongs to.
//
//   voice  : 5 ElevenLabs lines, loudness-matched, on a "voiceover" bus with
//            high-pass, de-mud, compression, presence and air
//   music  : the chosen Pixabay track, cut to picture by scripts/edit_music.py,
//            mastered to the voice's loudness, automated: ~7 dB under every line,
//            up in the gaps, open for the drop in the pause after "care,", fades out
//   sfx    : ~50 cues from the sound palette, peak-normalised, levelled per cue
//
//   node scripts/build_audio.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'timing.js'), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/audio/words.js'), 'utf8'), ctx);
const T = ctx.globalThis.HERCOVA_TIMING;
const WORDS = ctx.globalThis.HERCOVA_WORDS;
const MIX = path.join(ROOT, 'assets/audio/mix');
fs.mkdirSync(MIX, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-y', '-loglevel', 'error', ...args], { cwd: ROOT });
const probeDur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { cwd: ROOT }).toString());
const maxVol = (f) => Number(/max_volume: (-?[\d.]+) dB/.exec(spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'], { cwd: ROOT, encoding: 'utf8' }).stderr)?.[1] ?? 0);
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/* ------------------------------------------------------------ word times */
const vo = (id) => T.vo.find((v) => v.id === id);
const wAt = (id, re) => vo(id).at + (WORDS[id].find((w) => re.test(w[0])) || WORDS[id][0])[1];
const wEnd = (id) => vo(id).at + Math.min(WORDS[id].at(-1)[2], vo(id).trim ?? 1e9);

/* ------------------------------------------------------------ prepare files */
// voice: each line to -16 LUFS; vo5 trimmed after "anywhere." (the CTA is gone)
for (const v of T.vo) {
  const out = path.join(MIX, `${v.id}.wav`);
  const trim = v.trim ? ['-t', String(v.trim)] : [];
  const fade = v.trim ? `,afade=t=out:st=${(v.trim - 0.12).toFixed(2)}:d=0.12` : '';
  ff(['-i', `assets/audio/vo/${v.id}.mp3`, ...trim, '-af', `loudnorm=I=-16:TP=-1.5:LRA=7${fade}`, '-ar', '48000', '-ac', '1', out]);
}
// music: the chosen Pixabay track (Pixabay Content License), cut to the picture on bar lines by scripts/edit_music.py
fs.copyFileSync(path.join(MIX, 'music-edit.wav'), path.join(MIX, 'music.wav'));
// real pauses inside a voice line (the aligner folds a pause into the word before it)
const pauses = (id) => {
  const err = spawnSync('ffmpeg', ['-hide_banner', '-i', path.join(MIX, `${id}.wav`), '-af', 'silencedetect=n=-45dB:d=0.25', '-f', 'null', '-'], { cwd: ROOT, encoding: 'utf8' }).stderr;
  const s = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const e = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  return s.map((a, i) => [vo(id).at + a, vo(id).at + (e[i] ?? a)]).filter(([a, b]) => b > a);
};
// sfx: peak-normalise to -1 dBFS so a cue's level is set by its volume, not by its source
const SFX_SRC = {
  heartbeat: 'assets/sfx/heartbeat.mp3', ignite: 'assets/sfx/ignite.mp3', ripple: 'assets/sfx/ripple.mp3', iris: 'assets/sfx/iris.mp3',
  typehit: 'assets/sfx/typehit.mp3', tickrun: 'assets/sfx/tickrun.mp3', dissolve: 'assets/sfx/dissolve.mp3', lowhit: 'assets/sfx/lowhit.mp3',
  dive: 'assets/sfx/dive.mp3', zip: 'assets/sfx/zip.mp3', whip: 'assets/sfx/whip.mp3', pop: 'assets/sfx/pop.mp3', pages: 'assets/sfx/pages.mp3',
  alert: 'assets/sfx/alert.mp3', swell: 'assets/sfx/swell.mp3', bloom: 'assets/sfx/bloom.mp3', logo: 'assets/sfx/logo.mp3', click: 'assets/sfx/click.mp3',
  shimmer: 'assets/sfx/shimmer.mp3', nodes: 'assets/sfx/nodes.mp3', tick: 'assets/sfx/el-tick.mp3', whoosh: 'assets/sfx/el-whoosh-soft.mp3', sparkle: 'assets/sfx/el-sparkle.mp3',
};
const LIB = path.join(ROOT, '..', '.claude', 'skills', 'media-use', 'audio', 'assets', 'sfx');
for (const [k, f] of [['notify', 'notification.mp3'], ['uipop', 'pop.mp3'], ['softclick', 'click-soft.mp3'], ['swish', 'whoosh-short.mp3']]) {
  const dst = path.join(ROOT, 'assets/sfx/lib', f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (!fs.existsSync(dst)) fs.copyFileSync(path.join(LIB, f), dst);
  SFX_SRC[k] = rel(dst);
}
const SFX = {};
for (const [k, src] of Object.entries(SFX_SRC)) {
  const out = path.join(MIX, `sfx-${k}.wav`);
  const gain = -1 - maxVol(src);
  ff(['-i', src, '-af', `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.004`, '-ar', '48000', out]);
  SFX[k] = { file: rel(out), dur: probeDur(out) };
}

/* ------------------------------------------------------------ the cue sheet */
const S1 = T.s1, S2 = T.s2, S3 = T.s3, S4 = T.s4, S5 = T.s5, S6 = T.s6, S7 = T.s7, S8 = T.s8, S9 = T.s9;
const beats = T.heartbeat.beats.map((b) => T.heartbeat.at + b);
const redAt = wAt('vo3', /^danger/i);
const claimAt = wAt('vo3', /^alerted/i);
const CUES = [
  // 1 · her heartbeat: one line runs in and draws her
  ['heartbeat', T.heartbeat.at, 0.55, 'the heartbeat'],
  ['zip', 0.0, 0.26, 'her heartbeat line races in'],
  ['ignite', beats[0] - 0.04, 0.42, 'the line spikes on the first beat'],
  ['swish', 0.93, 0.24, 'the line meets her and splits to draw her'],
  ['ripple', beats[1] - 0.02, 0.14, 'heartbeat'],
  ['uipop', beats[2] - 0.01, 0.24, 'her outline closes: her dot, on her heart'],
  ['ripple', beats[3] - 0.02, 0.2, 'her photograph fills in'],
  ['shimmer', S1.label, 0.2, 'label decodes'],
  ['iris', S1.iris[0] - 0.1, 0.55, 'her photograph fills the drawing from her heart'],
  // 2 · her
  ['typehit', wAt('vo1', /^every/i) - 0.06, 0.3, '"Every"'],
  ['typehit', wAt('vo1', /^seven/i) - 0.1, 0.4, '"7" punch-in'],
  ['whoosh', wAt('vo1', /^minutes/i) - 0.12, 0.32, '"minutes," rises'],
  ['tickrun', S2.ring[0] + 0.1, 0.42, 'the clock ring laps seven times'],
  ['tick', S2.ring[1] - 0.02, 0.5, '07:00'],
  // 3 · one of many
  ['dissolve', S2.dissolve - 0.08, 0.62, 'her photograph becomes particles'],
  ['whoosh', S2.dissolve + 0.05, 0.28, 'type re-sets'],
  ['shimmer', S3.fly[1] - 0.35, 0.3, 'particles land as Nigeria'],
  ['lowhit', S3.lost - 0.05, 0.3, 'one dot goes dark'],
  ['softclick', 7.62, 0.25, 'source line'],
  // 4 · dive
  ['dive', S4.dive[0] - 0.15, 0.38, 'the dive'],
  // 5 · the line
  ['zip', S5.enter[0] - 0.02, 0.55, 'the line of care races in'],
  ['whoosh', S5.toPhone[0], 0.38, 'pan to her phone'],
  ['uipop', S5.toPhone[1] - 0.05, 0.3, 'the line plugs in'],
  ['swish', S5.toPhone[1] - 0.12, 0.34, 'the line draws the phone'],
  // 6 · her portal
  ['swish', S6.phoneIn, 0.42, 'phone rises'],
  ['uipop', S6.phoneIn + 0.3, 0.2, 'header'],
  ['uipop', S6.phoneIn + 0.39, 0.2, 'week card'],
  ['uipop', S6.phoneIn + 0.48, 0.2, 'check-in card'],
  ['tick', S6.phoneIn + 0.6, 0.18, 'week counter'],
  ['click', S6.checkTap - 0.01, 0.55, 'tap: No'],
  ['shimmer', S6.checkTap + 0.48, 0.25, 'checked in'],
  ['whoosh', S6.checkTap + 0.45, 0.3, 'the check-in floats out'],
  ['pages', S6.guide - 0.06, 0.4, 'guidance'],
  ['swish', S6.scroll, 0.3, 'scroll'],
  ['click', S6.yesTap - 0.01, 0.58, 'tap: Yes'],
  ['ripple', S6.danger, 0.5, 'danger sign reported'],
  ['lowhit', S6.danger, 0.22, 'danger sub'],
  ['swish', S6.danger + 0.12, 0.36, 'the danger card floats out'],
  ['zip', S6.surge[0] - 0.03, 0.5, 'the line surges to the care team'],
  // 7 · console
  ['whip', S7.toConsole[0], 0.62, 'whip to the console'],
  ['swish', S6.surge[1] - 0.05, 0.3, 'the line draws the console'],
  ['whoosh', S7.consoleIn - 0.05, 0.3, 'the console wipes in'],
  ['nodes', S7.consoleIn + 0.1, 0.38, 'dashboard assembles'],
  ['uipop', S7.consoleIn + 0.26, 0.18, 'tile'],
  ['uipop', S7.consoleIn + 0.33, 0.18, 'tile'],
  ['uipop', S7.consoleIn + 0.4, 0.18, 'tile'],
  ['notify', redAt - 0.02, 0.5, 'red flag lands'],
  ['typehit', redAt, 0.25, 'danger punch-in'],
  ['softclick', claimAt - 0.3, 0.2, 'hover'],
  ['click', claimAt - 0.02, 0.6, 'Claim'],
  ['alert', claimAt + 0.04, 0.5, 'her care team is alerted'],
  ['uipop', S7.referral, 0.32, 'referred to care'],
  ['whoosh', claimAt + 0.05, 0.18, 'the camera makes room'],
  ['swish', claimAt + 0.1, 0.3, 'her profile slides in'],
  ...[0, 1, 2, 3].map((i) => ['softclick', claimAt + 0.48 + i * 0.06, 0.09, 'care timeline item']),
  ['sparkle', S7.referral + 0.02, 0.22, 'referral sparkle'],
  // 8 · home
  ['swell', S8.bloom[0] - 3.0, 0.32, 'riser into her moment'],
  ['whoosh', S8.overview[0], 0.42, 'pull back to the whole route'],
  ['zip', S8.pulse[0], 0.4, 'help runs home'],
  ['bloom', S8.bloom[0] - 0.12, 0.7, 'she reaches care'],
  ['shimmer', wAt('vo4', /^time/i) - 0.05, 0.32, '"in time."'],
  ['whoosh', S8.close[0], 0.35, 'the photograph closes into her dot'],
  // micro layer: the frame system, kinetic type, the payoff artwork
  ...[S1.iris[0], S2.dissolve, S5.handoff, S5.toPhone[1], S7.toConsole[1], S8.overview[0], S9.handoff].map((t) => ['softclick', t + 0.02, 0.1, 'chapter label decodes']),
  ['whoosh', wAt('vo2', /^hercova/i) - 0.1, 0.24, '"HerCova walks with her." rises'],
  ['swish', wAt('vo2', /^with/i) - 0.12, 0.18, '"with her." streaks in'],
  ['swish', wAt('vo2', /^watching/i) - 0.12, 0.2, '"Watching," streaks in'],
  ['swish', wAt('vo2', /^guiding/i) - 0.12, 0.2, '"guiding," streaks in'],
  ['swish', wAt('vo2', /^catching/i) - 0.12, 0.18, '"catching the" streaks in'],
  ['swish', wAt('vo2', /^warning/i) - 0.12, 0.2, '"warning signs" streaks in'],
  ['swish', wAt('vo2', /^early/i) - 0.12, 0.22, '"early." streaks in'],
  ['swish', wAt('vo4', /^and/i) - 0.12, 0.16, '"And she reaches care," slides in'],
  ['swish', wAt('vo4', /^in$/i) - 0.16, 0.26, '"in time." streaks in'],
  ['softclick', S8.overview[1] - 0.4, 0.14, 'route labels'],
  ['dissolve', S8.bloom[0] - 0.02, 0.5, 'dots stream out of her dot'],
  ['shimmer', S8.bloom[1] - 0.1, 0.3, 'halftone resolves into mother and baby'],
  ['dissolve', S8.close[0], 0.34, 'the artwork collapses into her dot'],
  ['swish', S9.domain - 0.35, 0.2, 'the line signs off'],
  ['shimmer', S9.handoff + 0.8, 0.14, 'Nigeria returns, faintly'],
  // 9 · logo
  ['logo', S9.handoff - 0.06, 0.72, 'the line becomes the logo'],
  ['sparkle', S9.handoff, 0.42, 'logo burst'],
  ['swish', S9.lockup[0], 0.3, 'mark glides into the lockup'],
  ['softclick', S9.domain, 0.2, 'domain'],
];

/* ------------------------------------------------------------ music automation */
const MUSIC_AT = 0.0; // the score's intro sits under the heartbeat opening
const MUSIC_DUR = T.duration - MUSIC_AT;
const L = (t, v) => ({ t: +Math.max(0, t - MUSIC_AT).toFixed(3), v: +v.toFixed(3) });
// the bed is mastered to the voice's loudness: 1.0 is level with her, ~0.45 sits ~7 dB under her
const OPEN = 1.0;                           // between her lines the score carries the film
// under each line, set by measuring the voice alone against the music in the speech band (300-3500 Hz): ~7-9 dB under her
const UNDER = [0.21, 0.3, 0.3, 0.15, 0.23, 0.23];
const pts = [L(MUSIC_AT, 0), L(MUSIC_AT + 1.0, 0.9)];
const windows = T.vo.map((v) => [v.at + WORDS[v.id][0][1], wEnd(v.id)]);
// open only in real gaps: a short gap between two lines stays tucked under her
windows.forEach(([a, b], i) => {
  const prevEnd = i ? windows[i - 1][1] : -1e9;
  const nextStart = i < windows.length - 1 ? windows[i + 1][0] : 1e9;
  if (a - prevEnd > 1.0) pts.push(L(a - 0.35, OPEN));
  pts.push(L(a, UNDER[i]), L(b, UNDER[i]));
  if (i < windows.length - 1 && nextStart - b > 1.0) pts.push(L(Math.min(b + (i === 3 ? 0.5 : 0.6), nextStart - 0.45), i === 3 ? 1 : OPEN));
});
// if the score's second drop (scripts/edit_music.py -> music-edit.json) lands in a real pause in vo4,
// open the music for it, then tuck back under her
{
  const { name, drop } = JSON.parse(fs.readFileSync(path.join(MIX, 'music-edit.json'), 'utf8'));
  // a drop just before a pause (under the end of a word) still gets its groove heard in that pause
  const gap = drop == null ? null : pauses('vo4').find(([a, b]) => a - 0.4 <= drop && drop <= b);
  if (gap) pts.push(L(gap[0] + 0.01, UNDER[3]), L(gap[0] + 0.08, 0.95), L(gap[1] - 0.1, 0.95), L(gap[1] - 0.02, UNDER[3]));
  console.log(`score: ${name}; drop ${drop ?? 'none'}${gap ? ` opens in the pause ${gap[0].toFixed(2)}-${gap[1].toFixed(2)}` : ' (under her voice)'}`);
}
pts.push(L(windows.at(-1)[1] + 0.35, 0.95), L(T.duration - 0.05, 0)); // after her last word the score closes the film
pts.sort((a, b) => a.t - b.t);
const musicAuto = { version: 1, lanes: [{ target: 'volume', points: pts }] };

/* ------------------------------------------------------------ voice bus */
const voiceChain = {
  version: 1,
  nodes: [
    { type: 'highpass', id: 'n1', label: 'Remove Rumble', params: { frequency: 85, q: 0.707 } },
    { type: 'peaking', id: 'n2', label: 'Reduce Mud', params: { frequency: 280, gain: -2, q: 1.2 } },
    { type: 'compressor', id: 'n3', label: 'Even Out Levels', params: { threshold: -22, ratio: 2.6, attack: 6, release: 90 } },
    { type: 'peaking', id: 'n4', label: 'Add Clarity', params: { frequency: 3300, gain: 2.2, q: 1.1 } },
    { type: 'highshelf', id: 'n5', label: 'Air', params: { frequency: 10000, gain: 1.6 } },
  ],
};
const attr = (o) => JSON.stringify(o).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// vo4 is the quietest line (-17.7 LUFS after normalising: a short line with a long pause) and it
// sits on the score's climax, so it gets a small lift
const VO_GAIN = { vo4: 1.2 };
// the effects bus: accents under the score, not over it (the per-cue levels were set against a quieter bed)
const SFX_GAIN = 0.34;

/* ------------------------------------------------------------ write the tags */
const lines = [];
lines.push(`      <hf-audio-group id="voiceover" data-label="Voiceover" data-volume="1" data-fx-chain="${attr(voiceChain)}"></hf-audio-group>`);
for (const v of T.vo) {
  const dur = probeDur(path.join(MIX, `${v.id}.wav`));
  lines.push(`      <audio id="${v.id}" src="assets/audio/mix/${v.id}.wav" data-audio-group="voiceover" data-start="${v.at}" data-duration="${dur.toFixed(3)}" data-track-index="11" data-volume="${VO_GAIN[v.id] ?? 1}"></audio>`);
}
lines.push(`      <audio id="music-bed" src="assets/audio/mix/music.wav" data-start="${MUSIC_AT}" data-duration="${MUSIC_DUR.toFixed(3)}" data-track-index="12" data-volume="1" data-automation="${attr(musicAuto)}"></audio>`);
const lanes = Array(9).fill(0);
CUES.sort((a, b) => a[1] - b[1]).forEach(([k, at, vol, why], i) => {
  const s = SFX[k];
  if (!s) throw new Error(`unknown sfx ${k}`);
  const start = Math.max(0, at);
  const dur = Math.min(s.dur, T.duration - start);
  let lane = lanes.findIndex((end) => end <= start);
  if (lane < 0) lane = lanes.indexOf(Math.min(...lanes));
  lanes[lane] = start + dur;
  lines.push(`      <audio id="sfx-${String(i).padStart(2, '0')}-${k}" src="${s.file}" data-audio-group="sfx" data-start="${start.toFixed(3)}" data-duration="${dur.toFixed(3)}" data-track-index="${13 + lane}" data-volume="${(vol * SFX_GAIN).toFixed(3)}"></audio><!-- ${why} -->`);
});
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a = html.indexOf('<!-- AUDIO:BEGIN -->'), b = html.indexOf('<!-- AUDIO:END -->');
fs.writeFileSync(path.join(ROOT, 'index.html'), html.slice(0, a) + '<!-- AUDIO:BEGIN -->\n' + lines.join('\n') + '\n      ' + html.slice(b));
console.log(`wrote ${T.vo.length} voice tracks, 1 music bed (${pts.length} automation points), ${CUES.length} sound cues`);
