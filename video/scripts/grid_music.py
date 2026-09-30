"""Beat grid and exact drop times for a track: tempo, the bar phase, and the sharpest
low-end/broadband jumps (where a section lands). Used to cut a track to the picture.

    .venv/Scripts/python scripts/grid_music.py <file.mp3> [min_bpm max_bpm]
"""
import subprocess
import sys

import numpy as np

SR = 22050
path = sys.argv[1]
lo_bpm, hi_bpm = (float(sys.argv[2]), float(sys.argv[3])) if len(sys.argv) > 3 else (70.0, 180.0)
x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, dtype=np.float32)
hop, win = 256, 2048
n = 1 + (len(x) - win) // hop
fr = np.lib.stride_tricks.as_strided(x, shape=(n, win), strides=(x.strides[0] * hop, x.strides[0]))
S = np.abs(np.fft.rfft(fr * np.hanning(win), axis=1))
f = np.fft.rfftfreq(win, 1 / SR)
fps = SR / hop
logS = np.log1p(S * 10)
flux = np.concatenate([[0], np.maximum(0, np.diff(logS, axis=0)).sum(1)])
flux = (flux - flux.mean()) / flux.std()
# tempo + phase: maximise onset strength on a regular grid
best = (-1, 0, 0)
for bpm in np.arange(lo_bpm, hi_bpm, 0.05):
    p = 60 / bpm * fps
    idx = np.arange(0, len(flux) - p, p)
    for ph in np.linspace(0, p, 32, endpoint=False):
        sc = flux[np.round(idx + ph).astype(int)].mean()
        if sc > best[0]:
            best = (sc, bpm, ph / fps)
_, bpm, phase = best
beat = 60 / bpm
# section landings: big jumps in 0.5 s energy (low band and broadband)
low = S[:, (f > 30) & (f < 160)].sum(1)
allb = S.sum(1)
w = int(0.5 * fps)
def db(v):
    return 20 * np.log10(np.convolve(v, np.ones(w) / w, mode="same") + 1e-9)
dl, da = db(low), db(allb)
jump = (np.roll(dl, -w // 2) - np.roll(dl, w)) + (np.roll(da, -w // 2) - np.roll(da, w))
cands = []
for i in np.argsort(-jump):
    t = i / fps
    if t < 1 or t > len(x) / SR - 2:
        continue
    if all(abs(t - c) > 4 for c, _ in cands):
        cands.append((t, jump[i]))
    if len(cands) >= 8:
        break
print(f"{path.split('/')[-1]}: {bpm:.2f} BPM (beat {beat:.4f}s, bar {4 * beat:.4f}s), a beat at {phase:.3f}s")
for t, j in sorted(cands):
    k = (t - phase) / beat
    print(f"  landing ~{t:6.2f}s  (jump {j:5.1f} dB)  nearest beat {phase + round(k) * beat:7.3f}s  [beat index {int(round(k))}]")
