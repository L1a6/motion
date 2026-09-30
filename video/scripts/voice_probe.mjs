// Probes which extra ElevenLabs voices this (free) account can actually use: the shared Voice
// Library, and Voice Design previews. Reads ELEVENLABS_API_KEY from .env (sent only to api.elevenlabs.io).
//   node scripts/voice_probe.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const H = { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' };
const API = 'https://api.elevenlabs.io';

const r = await fetch(`${API}/v1/shared-voices?gender=female&page_size=40&language=en&sort=usage_character_count_1y`, { headers: H });
const j = await r.json();
console.log('library search', r.status, (j.voices || []).length);
for (const v of (j.voices || []).slice(0, 40)) console.log([v.voice_id, v.name, v.accent, v.age, v.descriptive, v.use_case, v.category].join(' | '));
const v0 = (j.voices || []).find((v) => !/africa|nigeria/i.test(`${v.accent} ${v.name}`));
if (v0) {
  const t = await fetch(`${API}/v1/text-to-speech/${v0.voice_id}?output_format=mp3_44100_128`, { method: 'POST', headers: H, body: JSON.stringify({ text: 'Care that reaches her, anywhere.', model_id: 'eleven_v3' }) });
  console.log('tts with a library voice', t.status, t.ok ? 'OK' : (await t.text()).slice(0, 220));
}
const d = await fetch(`${API}/v1/text-to-voice/create-previews`, { method: 'POST', headers: H, body: JSON.stringify({
  voice_description: 'A sweet, warm, gentle young woman with a soft, caring American voice, calm and reassuring, clear studio quality.',
  text: 'Every seven minutes, a woman in Nigeria dies in pregnancy or childbirth. HerCova walks with her, watching, guiding, and catching the warning signs early.' }) });
console.log('voice design previews', d.status, d.ok ? `${((await d.json()).previews || []).length} previews` : (await d.text()).slice(0, 220));
