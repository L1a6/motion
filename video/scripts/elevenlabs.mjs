// ElevenLabs helper for the HerCova film: voiceover (with word timestamps) and sound effects.
// Reads ELEVENLABS_API_KEY from ./.env. The key is never printed.
//
//   node scripts/elevenlabs.mjs vo      -> assets/audio/vo/vo{1..4}.mp3 + vo.words.json
//   node scripts/elevenlabs.mjs sfx     -> assets/sfx/el-*.mp3
//   node scripts/elevenlabs.mjs music   -> assets/audio/music-el.mp3 (paid plans only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const KEY = env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing from .env');
const API = 'https://api.elevenlabs.io';
const H = { 'xi-api-key': KEY, 'Content-Type': 'application/json' };

// Sarah — "Mature, Reassuring, Confident", an ElevenLabs premade voice (usable on the free plan).
// On a paid plan, the preferred voice is Chineye ("Warm and Expressive", Nigerian):
//   { publicOwner: '4dc1d6f56f64e6f3eec5c01c7dce61cfb47f4f77ee3dd6184d84b8829fd20faa', id: 'PSIwmc50KeuW20kehlBE' }
const VOICE = { publicOwner: null, id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' };

// The script: 35 words, one line per beat. `say` is what she speaks, `text` is the caption.
export const LINES = [
  { id: 'vo1', say: 'Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth.' },
  { id: 'vo2', say: 'HerCova walks with her. When a danger sign appears, her care team is alerted.' },
  { id: 'vo3', say: 'And she reaches care, in time.' },
  { id: 'vo4', say: 'Enroll at HerCova health dot com.' },
];

async function ensureVoice() {
  if (!VOICE.publicOwner) return VOICE.id; // premade voice, nothing to add
  const add = await fetch(`${API}/v1/voices/add/${VOICE.publicOwner}/${VOICE.id}`, {
    method: 'POST', headers: H, body: JSON.stringify({ new_name: VOICE.name }),
  });
  const j = await add.json();
  if (!add.ok) throw new Error(`add voice failed: ${add.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.voice_id || VOICE.id;
}

/** Character alignment -> word timings. */
function toWords(al) {
  const words = [];
  let cur = null;
  for (let i = 0; i < al.characters.length; i++) {
    const ch = al.characters[i];
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } continue; }
    if (!cur) cur = { text: '', start: al.character_start_times_seconds[i], end: 0 };
    cur.text += ch;
    cur.end = al.character_end_times_seconds[i];
  }
  if (cur) words.push(cur);
  return words;
}

async function vo() {
  const voiceId = await ensureVoice();
  const outDir = path.join(ROOT, 'assets/audio/vo');
  fs.mkdirSync(outDir, { recursive: true });
  const all = {};
  for (let i = 0; i < LINES.length; i++) {
    const line = LINES[i];
    const body = {
      text: line.say,
      model_id: 'eleven_multilingual_v2',
      // Continuity: tell the model what surrounds this line so the four takes sound like one read.
      previous_text: LINES.slice(0, i).map((l) => l.say).join(' ') || undefined,
      next_text: LINES.slice(i + 1).map((l) => l.say).join(' ') || undefined,
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true, speed: 1.08 },
    };
    const r = await fetch(`${API}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST', headers: H, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`tts ${line.id} failed: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    fs.writeFileSync(path.join(outDir, `${line.id}.mp3`), Buffer.from(j.audio_base64, 'base64'));
    all[line.id] = toWords(j.alignment);
    console.log(line.id, 'ok', all[line.id].length, 'words, ends', all[line.id].at(-1).end.toFixed(2) + 's');
  }
  fs.writeFileSync(path.join(outDir, 'vo.words.json'), JSON.stringify(all, null, 2));
}

// Sound design brief -> ElevenLabs sound generation.
const SFX = [
  { id: 'el-whoosh-soft', dur: 1.2, prompt: 'very soft airy whoosh, gentle breath of wind passing by, smooth and warm, no impact, premium brand film UI' },
  { id: 'el-tick', dur: 0.6, prompt: 'single gentle clock tick, soft wooden tick, close and intimate, clean, short' },
  { id: 'el-swell', dur: 3.5, prompt: 'soft warm cinematic swell rising gently, airy shimmer pad building to a tender resolve, hopeful, no drums, no impact' },
  { id: 'el-chime', dur: 2.5, prompt: 'reassuring gentle notification chime, two soft warm bell tones rising, calm and kind, hospital-free, premium' },
  { id: 'el-sparkle', dur: 2.0, prompt: 'light magical sparkle shimmer, delicate glittering chimes, soft and elegant logo reveal' },
];

async function sfx() {
  const outDir = path.join(ROOT, 'assets/sfx');
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of SFX) {
    const r = await fetch(`${API}/v1/sound-generation?output_format=mp3_44100_128`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ text: s.prompt, duration_seconds: s.dur, prompt_influence: 0.55 }),
    });
    if (!r.ok) { console.log(s.id, 'failed', r.status, (await r.text()).slice(0, 200)); continue; }
    fs.writeFileSync(path.join(outDir, `${s.id}.mp3`), Buffer.from(await r.arrayBuffer()));
    console.log(s.id, 'ok');
  }
}

async function music() {
  const r = await fetch(`${API}/v1/music?output_format=mp3_44100_128`, {
    method: 'POST', headers: H,
    body: JSON.stringify({
      prompt: 'Warm, hopeful cinematic instrumental for a maternal health brand film. Soft felt piano and warm string pad, a light heartbeat-like pulse, gentle build in the middle, resolved major ending. Intimate, premium, tender. No vocals.',
      music_length_ms: 15000,
    }),
  });
  if (!r.ok) { console.log('music failed', r.status, (await r.text()).slice(0, 300)); return; }
  fs.writeFileSync(path.join(ROOT, 'assets/audio/music-el.mp3'), Buffer.from(await r.arrayBuffer()));
  console.log('music ok');
}

const cmd = process.argv[2];
await ({ vo, sfx, music }[cmd] ?? (() => console.log('usage: vo | sfx | music')))();
