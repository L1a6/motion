"""Measures the film's mix balance offline: the voice, effects and music stems rebuilt from
index.html's audio tags (the music with its automation), then compared window by window.

    .venv/Scripts/python scripts/measure_mix.py
"""
import html
import json
import os
import re
import subprocess

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
DUR = float(re.search(r'data-composition-id="main"[^>]*data-duration="([\d.]+)"', open(os.path.join(ROOT, "index.html"), encoding="utf8").read()).group(1))


def tags():
    src = open(os.path.join(ROOT, "index.html"), encoding="utf8").read()
    return [dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1))) for m in re.finditer(r"<audio\b([^>]*)>", src)]


def stem(clips, chain=None):
    inputs, parts, labels = [], [], []
    for i, c in enumerate(clips):
        inputs += ["-i", c["src"]]
        ms = int(round(float(c["data-start"]) * 1000))
        parts.append(f"[{i}:a]atrim=0:{float(c['data-duration']):.3f},asetpts=PTS-STARTPTS,aformat=sample_rates={SR}:channel_layouts=mono,volume={float(c.get('data-volume', 1)):.3f},adelay={ms}[c{i}]")
        labels.append(f"[c{i}]")
    g = ";".join(parts) + f";{''.join(labels)}amix=inputs={len(labels)}:normalize=0" + (f",{chain}" if chain else "") + f",apad=whole_dur={DUR},atrim=0:{DUR}[o]"
    raw = subprocess.run(["ffmpeg", "-v", "error", *inputs, "-filter_complex", g, "-map", "[o]", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], cwd=ROOT, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


t = tags()
VOICE = "highpass=f=85,equalizer=f=280:t=q:w=1.2:g=-2,acompressor=threshold=-22dB:ratio=2.6:attack=6:release=90,equalizer=f=3300:t=q:w=1.1:g=2.2,treble=g=1.6:f=10000"
vo = stem([c for c in t if c.get("data-audio-group") == "voiceover"], VOICE)
fx = stem([c for c in t if c.get("data-audio-group") == "sfx"])
bed = next(c for c in t if c.get("id") == "music-bed")
pts = json.loads(html.unescape(bed["data-automation"]))["lanes"][0]["points"]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(ROOT, bed["src"]), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
mus = np.frombuffer(raw, dtype=np.float32)
n = min(len(vo), len(fx), len(mus))
env = np.interp(np.arange(n) / SR, [p["t"] for p in pts], [p["v"] for p in pts])
mus = mus[:n] * env * float(bed.get("data-volume", 1))
vo, fx = vo[:n], fx[:n]


def db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


print(f"whole film   voice {db(vo):6.1f}   effects {db(fx):6.1f}   music {db(mus):6.1f}   (RMS dBFS)")
print("   window        voice   effects   music   effects vs music")
for a in np.arange(0, DUR, 1.5):
    s = slice(int(a * SR), int(min(DUR, a + 1.5) * SR))
    print(f"  {a:5.1f}-{min(DUR, a + 1.5):5.1f}   {db(vo[s]):6.1f}   {db(fx[s]):6.1f}   {db(mus[s]):6.1f}   {db(fx[s]) - db(mus[s]):+6.1f} dB")
# the loudest effect moments against the music under them (100 ms windows)
w = int(0.1 * SR)
peaks = sorted(((db(fx[i:i + w]) - db(mus[i:i + w]), i / SR) for i in range(0, n - w, w)), reverse=True)[:8]
print("loudest effect moments over the music:", ", ".join(f"{tt:.1f}s ({d:+.1f} dB)" for d, tt in peaks))
