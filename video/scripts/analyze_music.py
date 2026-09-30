"""Tempo, beat grid and energy map of a music file — used to cut the score to the picture.

    .venv/Scripts/python scripts/analyze_music.py assets/audio/music-cands/mk-31.mp3
"""
import subprocess
import sys

import numpy as np

SR = 22050
path = sys.argv[1]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
hop = 512
win = 2048
frames = 1 + (len(x) - win) // hop
window = np.hanning(win).astype(np.float32)
spec = np.empty((frames, win // 2 + 1), dtype=np.float32)
for i in range(frames):
    seg = x[i * hop:i * hop + win] * window
    spec[i] = np.abs(np.fft.rfft(seg))
logspec = np.log1p(spec * 10)
flux = np.maximum(0, np.diff(logspec, axis=0)).sum(axis=1)
flux = np.concatenate([[0], flux])
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = SR / hop
# tempo by autocorrelation of the onset envelope
ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
lags = np.arange(len(ac))
bpm_range = (70, 160)
lo, hi = int(fps * 60 / bpm_range[1]), int(fps * 60 / bpm_range[0])
lag = lo + int(np.argmax(ac[lo:hi]))
bpm = 60 * fps / lag
# beat phase: offset that maximises onset energy on the grid
period = lag
best, phase = -1, 0
for ph in range(period):
    s = flux[ph::period].sum()
    if s > best:
        best, phase = s, ph
first_beat = phase / fps
beat = 60 / bpm
print(f"tempo {bpm:.2f} BPM  beat {beat:.4f}s  first beat {first_beat:.3f}s  duration {len(x) / SR:.1f}s")
# energy map (RMS in dB) per 2 s, and onset density
rms = np.sqrt(np.convolve(x ** 2, np.ones(SR) / SR, mode="same"))
for t0 in range(0, int(len(x) / SR), 2):
    r = 20 * np.log10(rms[t0 * SR:(t0 + 2) * SR].mean() + 1e-9)
    on = flux[int(t0 * fps):int((t0 + 2) * fps)].mean()
    bar = "#" * max(0, int((r + 40) * 1.2))
    print(f"{t0:4d}s  {r:6.1f} dB  onset {on:5.2f}  {bar}")
