"""Builds music audition films: the same picture (a draft render) with each candidate score, so
the song can be chosen by ear, in context.

1. The voice + effects stem is mixed offline from index.html's audio tags (the voice through the
   same chain as the film's voiceover bus).
2. For each candidate: scripts/edit_music.py <name> cuts it to picture, build_audio.mjs writes its
   level automation, and the score is mixed under the stem with that automation.
3. Every audition is matched to -16 LUFS (so none wins by being louder) and muxed with the draft's
   picture into renders/audition-<n>-<name>.mp4. The film is left on the chosen score.

    .venv/Scripts/python scripts/audition.py renders/draft-v9.mp4 showreel whip betterday
"""
import html
import json
import os
import re
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIX = os.path.join(ROOT, "assets", "audio", "mix")
SR = 48000
FILM = float(re.search(r'data-composition-id="main"[^>]*data-duration="([\d.]+)"', open(os.path.join(ROOT, "index.html"), encoding="utf8").read()).group(1))
video = sys.argv[1]
names = sys.argv[2:]
PY = os.path.join(ROOT, ".venv", "Scripts", "python.exe")


def run(args, **kw):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True, **kw)


def tags():
    src = open(os.path.join(ROOT, "index.html"), encoding="utf8").read()
    out = []
    for m in re.finditer(r"<audio\b([^>]*)>", src):
        a = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
        out.append(a)
    return out


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


# ---------------------------------------------------------------- 1 · voice + effects stem
stem_path = os.path.join(MIX, "stem-vo-sfx.wav")
clips = [t for t in tags() if t.get("id") != "music-bed"]
inputs, chains, vo_labels, fx_labels = [], [], [], []
for i, c in enumerate(clips):
    inputs += ["-i", c["src"]]
    ms = int(round(float(c["data-start"]) * 1000))
    chains.append(f"[{i}:a]atrim=0:{float(c['data-duration']):.3f},asetpts=PTS-STARTPTS,aformat=sample_rates={SR}:channel_layouts=stereo,"
                  f"volume={float(c.get('data-volume', 1)):.3f},adelay={ms}|{ms}[c{i}]")
    (vo_labels if c.get("data-audio-group") == "voiceover" else fx_labels).append(f"[c{i}]")
VOICE_CHAIN = "highpass=f=85,equalizer=f=280:t=q:w=1.2:g=-2,acompressor=threshold=-22dB:ratio=2.6:attack=6:release=90,equalizer=f=3300:t=q:w=1.1:g=2.2,treble=g=1.6:f=10000"
graph = ";".join(chains)
graph += f";{''.join(vo_labels)}amix=inputs={len(vo_labels)}:normalize=0,{VOICE_CHAIN}[vo]"
graph += f";{''.join(fx_labels)}amix=inputs={len(fx_labels)}:normalize=0[fx]"
graph += f";[vo][fx]amix=inputs=2:normalize=0,apad=whole_dur={FILM},atrim=0:{FILM}[stem]"
run(["ffmpeg", "-hide_banner", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-map", "[stem]", "-ar", str(SR), "-c:a", "pcm_f32le", stem_path])
stem = load(stem_path)
print(f"stem: {len(clips)} clips, {len(stem) / SR:.2f}s")


def envelope(points, n):
    t = np.arange(n) / SR
    pts = sorted(points, key=lambda p: p["t"])
    return np.interp(t, [p["t"] for p in pts], [p["v"] for p in pts], left=pts[0]["v"], right=pts[-1]["v"])


def lufs(path):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])


# ---------------------------------------------------------------- 2 · each candidate under the stem
made = []
for k, name in enumerate(names, 1):
    print(run([PY, "scripts/edit_music.py", name]).stdout.strip().splitlines()[-1])
    print(run(["node", "scripts/build_audio.mjs"]).stdout.strip().replace("\n", " | "))
    bed = next(t for t in tags() if t.get("id") == "music-bed")
    auto = json.loads(html.unescape(bed["data-automation"]))["lanes"][0]["points"]
    music = load(os.path.join(MIX, "music.wav"))
    n = min(len(stem), len(music))
    mix = stem[:n] + music[:n] * envelope(auto, n)[:, None] * float(bed.get("data-volume", 1))
    raw = os.path.join(MIX, f"audition-{name}.wav")
    import wave
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(raw, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    gain = -16.0 - lufs(raw)
    out = os.path.join(ROOT, "renders", f"audition-{k}-{name}.mp4")
    run(["ffmpeg", "-hide_banner", "-y", "-loglevel", "error", "-i", video, "-i", raw, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-af", f"volume={gain:.2f}dB,alimiter=limit=0.89:attack=5:release=50", "-c:a", "aac", "-b:a", "256k", "-shortest", out])
    made.append(out)
    print(f"  -> {os.path.relpath(out, ROOT)}  ({lufs(out):.1f} LUFS)")

# leave the film on the first (chosen) candidate
run([PY, "scripts/edit_music.py", names[0]])
run(["node", "scripts/build_audio.mjs"])
print("film score:", names[0])
