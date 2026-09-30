// Voice auditions: lists the female voices this ElevenLabs account can use (free plan: the premade
// voices), then reads the same two lines in each so the voice can be chosen by ear.
// Reads ELEVENLABS_API_KEY from .env (sent only to api.elevenlabs.io).
//
//   node scripts/voice_samples.mjs list                 -> the female voices, with accent and description
//   node scripts/voice_samples.mjs make <id> [<id>...]  -> renders/voice-samples/<name>.mp3
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const H = { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' };
const API = 'https://api.elevenlabs.io';
const MODEL = 'eleven_v3';
// the stakes and the promise: the two lines that most need a warm, sweet read
const LINES = [
  'Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth.',
  'HerCova walks with her. Watching, guiding, and catching the warning signs early.',
  'Care that reaches her, anywhere.',
];

async function list() {
  const r = await fetch(`${API}/v1/voices`, { headers: H });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  const f = j.voices.filter((v) => (v.labels?.gender || '').toLowerCase() === 'female');
  for (const v of f) console.log([v.voice_id, v.name, v.category, v.labels?.accent, v.labels?.age, v.labels?.descriptive || v.labels?.description, v.labels?.use_case || v.labels?.['use case']].join(' | '));
}

async function make(ids) {
  const out = path.join(ROOT, 'renders', 'voice-samples');
  fs.mkdirSync(out, { recursive: true });
  const r = await fetch(`${API}/v1/voices`, { headers: H });
  const all = (await r.json()).voices;
  for (const id of ids) {
    const v = all.find((x) => x.voice_id === id);
    const name = (v?.name || id).split(/\s|-/)[0].toLowerCase();
    const parts = [];
    for (const [k, text] of LINES.entries()) {
      const res = await fetch(`${API}/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
      });
      if (!res.ok) { console.log(name, 'FAILED', res.status, (await res.text()).slice(0, 160)); parts.length = 0; break; }
      const f = path.join(out, `.${name}-${k}.mp3`);
      fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
      parts.push(f);
    }
    if (!parts.length) continue;
    // one file per voice: the three lines with a short breath between them
    const dst = path.join(out, `${name}.mp3`);
    const inputs = parts.flatMap((p) => ['-i', p]);
    const graph = parts.map((_, i) => `[${i}:a]apad=pad_dur=0.6[a${i}]`).join(';') + ';' + parts.map((_, i) => `[a${i}]`).join('') + `concat=n=${parts.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[o]`;
    execFileSync('ffmpeg', ['-hide_banner', '-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-map', '[o]', '-ar', '44100', '-b:a', '192k', dst]);
    parts.forEach((p) => fs.unlinkSync(p));
    console.log(name, '->', path.relative(ROOT, dst), `(${v?.labels?.accent || ''}, ${v?.labels?.descriptive || v?.labels?.description || ''})`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
await ({ list, make }[cmd] ?? (() => console.log('usage: list | make <voice_id>...')))(rest);
