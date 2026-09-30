// Mixes and masters the film's soundtrack from timing.js (the one timing config).
//
//   voice  : high-pass, de-mud, gentle compression, presence + air      -> loudest element
//   music  : carved in the voice band, sidechain-ducked under the voice -> ~15-20 dB under her
//   sfx    : placed per cue, trimmed well under the voice
//   master : two-pass EBU R128 loudnorm to -14 LUFS, true peak <= -1.5 dBTP, fades in/out
//
//   node scripts/mix_audio.mjs            -> assets/audio/mix.wav (+ stems in assets/audio/stems)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'timing.js'), 'utf8'), ctx);
const T = ctx.globalThis.HERCOVA_TIMING;
const DUR = T.duration;
const SR = 48000;
const STEMS = path.join(ROOT, 'assets/audio/stems');
fs.mkdirSync(STEMS, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-y', '-nostats', ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
const run = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stderr;

/** EBU R128 integrated loudness, true peak and loudness range of a file. */
function measure(file) {
  const summary = run(['-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).split('Summary:')[1] || '';
  return {
    I: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]),
    TP: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]),
    LRA: Number(/LRA:\s+(-?[\d.]+) LU/.exec(summary)?.[1]),
  };
}

/* ------------------------------------------------------------- 1. voice bus */
{
  const inputs = [];
  const chains = [];
  T.vo.forEach((v, i) => {
    inputs.push('-i', v.file);
    const ms = Math.round(v.at * 1000);
    chains.push(
      `[${i}:a]aresample=${SR},aformat=channel_layouts=mono,` +
        'highpass=f=85,' +                                   // rumble / plosive thump
        'equalizer=f=280:t=q:w=1.2:g=-2,' +                  // de-mud
        'acompressor=threshold=-22dB:ratio=2.6:attack=6:release=90:makeup=2.5dB:knee=6,' +
        'equalizer=f=3300:t=q:w=1.1:g=2.2,' +                // presence: words cut through
        'highshelf=f=10000:g=1.8,' +                         // air
        `adelay=${ms}:all=1,apad=whole_dur=${DUR}[v${i}]`,
    );
  });
  const mixIn = T.vo.map((_, i) => `[v${i}]`).join('');
  ff([...inputs, '-filter_complex', `${chains.join(';')};${mixIn}amix=inputs=${T.vo.length}:normalize=0:duration=longest,atrim=0:${DUR},pan=stereo|c0=c0|c1=c0[out]`,
    '-map', '[out]', '-ar', SR, '-c:a', 'pcm_s24le', path.join(STEMS, 'voice.wav')]);
}

/* ------------------------------------------------------------- 2. sfx bus */
{
  const inputs = [];
  const chains = [];
  T.sfx.forEach((s, i) => {
    inputs.push('-i', s.file);
    const ms = Math.round(s.at * 1000);
    chains.push(`[${i}:a]aresample=${SR},aformat=channel_layouts=stereo,highpass=f=120,volume=${s.gain}dB,adelay=${ms}:all=1,apad=whole_dur=${DUR}[s${i}]`);
  });
  const fixed = chains;
  const mixIn = T.sfx.map((_, i) => `[s${i}]`).join('');
  ff([...inputs, '-filter_complex', `${fixed.join(';')};${mixIn}amix=inputs=${T.sfx.length}:normalize=0:duration=longest,atrim=0:${DUR}[out]`,
    '-map', '[out]', '-ar', SR, '-c:a', 'pcm_s24le', path.join(STEMS, 'sfx.wav')]);
}

/* ------------------------------------------------------------- 3. levels */
const voiceL = measure(path.join(STEMS, 'voice.wav'));
const musicL = measure(T.music.file);
// Music sits 8 dB under the voice before ducking; the sidechain takes a further ~6-8 dB
// while she speaks, landing the bed ~17-19 dB under her words and letting it breathe in gaps.
const musicGain = voiceL.I - 8 - musicL.I;
console.log(`voice ${voiceL.I.toFixed(1)} LUFS, music raw ${musicL.I.toFixed(1)} LUFS -> music gain ${musicGain.toFixed(1)} dB`);

/* ------------------------------------------------------------- 4. pre-master */
const PRE = path.join(STEMS, 'premaster.wav');
ff([
  '-i', path.join(STEMS, 'voice.wav'), '-i', T.music.file, '-i', path.join(STEMS, 'sfx.wav'),
  '-filter_complex',
  `[0:a]asplit=2[vo][vside];` +
    `[1:a]aresample=${SR},volume=${musicGain.toFixed(2)}dB,` +
    'equalizer=f=1000:t=q:w=1.4:g=-3,equalizer=f=2500:t=q:w=1.4:g=-2.5,' +  // carve the voice band
    `apad=whole_dur=${DUR},atrim=0:${DUR}[mus];` +
    '[mus][vside]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=450:knee=4:makeup=1[duck];' +
    '[2:a]volume=0dB[fx];' +
    '[vo][duck][fx]amix=inputs=3:normalize=0:duration=first[out]',
  '-map', '[out]', '-ar', SR, '-c:a', 'pcm_s24le', PRE,
]);

/* ------------------------------------------------------------- 5. master (two-pass loudnorm) */
const TARGET = { I: -14, TP: -1.5, LRA: 11 };
const pass1 = run(['-i', PRE, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-']);
const j = JSON.parse(pass1.slice(pass1.lastIndexOf('{'), pass1.lastIndexOf('}') + 1));
const OUT = path.join(ROOT, 'assets/audio/mix.wav');
ff(['-i', PRE, '-af',
  `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,` +
    `alimiter=limit=${Math.pow(10, (TARGET.TP - 0.2) / 20).toFixed(4)}:attack=3:release=60:level=disabled,` +
    `afade=t=in:st=0:d=0.12,afade=t=out:st=${(DUR - 0.6).toFixed(2)}:d=0.6,aresample=${SR}`,
  '-ar', SR, '-c:a', 'pcm_s24le', OUT]);

/* ------------------------------------------------------------- 6. verify */
const fin = measure(OUT);
const v = measure(path.join(STEMS, 'voice.wav'));
console.log(`MASTER  integrated ${fin.I.toFixed(1)} LUFS · true peak ${fin.TP.toFixed(1)} dBTP · LRA ${fin.LRA.toFixed(1)} LU`);
if (fin.TP > -1.0) console.log('WARNING: true peak above -1 dBTP');

// Voice-vs-bed margin while she speaks: music stem measured only inside VO windows.
const duckedBed = path.join(STEMS, 'music-ducked.wav');
ff(['-i', path.join(STEMS, 'voice.wav'), '-i', T.music.file, '-filter_complex',
  `[1:a]aresample=${SR},volume=${musicGain.toFixed(2)}dB,equalizer=f=1000:t=q:w=1.4:g=-3,equalizer=f=2500:t=q:w=1.4:g=-2.5,apad=whole_dur=${DUR},atrim=0:${DUR}[mus];` +
    '[mus][0:a]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=450:knee=4:makeup=1[out]',
  '-map', '[out]', '-ar', SR, '-c:a', 'pcm_s24le', duckedBed]);
const windows = T.vo.map((x) => {
  const w = T.words[x.id];
  return [x.at + w[0][1], x.at + w[w.length - 1][2]];
});
const sel = windows.map(([a, b]) => `between(t,${a.toFixed(2)},${b.toFixed(2)})`).join('+');
const cut = (src, dst) => ff(['-i', src, '-af', `aselect='${sel}',asetpts=N/SR/TB`, '-c:a', 'pcm_s24le', dst]);
cut(path.join(STEMS, 'voice.wav'), path.join(STEMS, '_v_in.wav'));
cut(duckedBed, path.join(STEMS, '_m_in.wav'));
const vin = measure(path.join(STEMS, '_v_in.wav'));
const min = measure(path.join(STEMS, '_m_in.wav'));
console.log(`while she speaks: voice ${vin.I.toFixed(1)} LUFS, music ${min.I.toFixed(1)} LUFS -> bed is ${(vin.I - min.I).toFixed(1)} dB under the voice`);
fs.rmSync(path.join(STEMS, '_v_in.wav'));
fs.rmSync(path.join(STEMS, '_m_in.wav'));
