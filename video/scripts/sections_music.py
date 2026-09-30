"""Second-by-second anatomy of a music track: loudness, drum activity, low end, brightness,
and the moments where the arrangement changes. Used to cut the score to the picture.

    .venv/Scripts/python scripts/sections_music.py <file.mp3> [bpm]
"""
import subprocess
import sys

import numpy as np

SR = 22050
path = sys.argv[1]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
hop, win = 512, 2048
n = 1 + (len(x) - win) // hop
frames = np.lib.stride_tricks.as_strided(x, shape=(n, win), strides=(x.strides[0] * hop, x.strides[0]))
spec = np.abs(np.fft.rfft(frames * np.hanning(win).astype(np.float32), axis=1))
freqs = np.fft.rfftfreq(win, 1 / SR)
fps = SR / hop
logspec = np.log1p(spec * 10)
# percussive flux: broadband, and the low (kick) band separately
flux = np.concatenate([[0], np.maximum(0, np.diff(logspec, axis=0)).sum(axis=1)])
kick = np.concatenate([[0], np.maximum(0, np.diff(logspec[:, (freqs > 40) & (freqs < 130)], axis=0)).sum(axis=1)])
fz = (flux - np.median(flux)) / (flux.std() + 1e-9)
kz = (kick - np.median(kick)) / (kick.std() + 1e-9)
mag = spec.sum(axis=1) + 1e-9
cent = (spec * freqs).sum(axis=1) / mag
low = spec[:, freqs < 150].sum(axis=1) / mag
rms = np.sqrt((frames ** 2).mean(axis=1))
secs = int(len(x) / SR)
peak = 20 * np.log10(rms.max() + 1e-9)
prev = None
print(f"{path.split('/')[-1]}  {secs}s")
print("  sec   dB   drums kick  low  bright  | level")
for s in range(secs):
    sl = slice(int(s * fps), int((s + 1) * fps))
    db = 20 * np.log10(rms[sl].mean() + 1e-9) - peak
    dr = float(np.mean(fz[sl] > 2.5))
    kk = float(np.mean(kz[sl] > 2.5))
    lo = float(low[sl].mean())
    br = float(np.median(cent[sl]))
    mark = ''
    if prev is not None and (abs(db - prev[0]) > 3.5 or abs(dr - prev[1]) > 0.08):
        mark = '  <-- change'
    prev = (db, dr)
    bar = '#' * max(0, int((db + 30) * 1.3))
    print(f"  {s:3d}  {db:5.1f}  {dr:5.2f} {kk:5.2f}  {lo:4.2f}  {br:5.0f}  | {bar}{mark}")
