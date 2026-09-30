"""Profiles candidate music tracks so the score can be chosen on evidence: tempo, key/mode,
percussion density, brightness, low end, and a 2-second loudness curve.

    .venv/Scripts/python scripts/profile_music.py <file.mp3> [...]
"""
import subprocess
import sys

import numpy as np

SR = 22050
KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def profile(path):
    x = load(path)
    hop, win = 512, 2048
    n = 1 + (len(x) - win) // hop
    w = np.hanning(win).astype(np.float32)
    frames = np.lib.stride_tricks.as_strided(x, shape=(n, win), strides=(x.strides[0] * hop, x.strides[0]))
    spec = np.abs(np.fft.rfft(frames * w, axis=1))
    freqs = np.fft.rfftfreq(win, 1 / SR)
    fps = SR / hop
    # onsets / tempo
    logspec = np.log1p(spec * 10)
    flux = np.concatenate([[0], np.maximum(0, np.diff(logspec, axis=0)).sum(axis=1)])
    fz = (flux - flux.mean()) / (flux.std() + 1e-9)
    ac = np.correlate(fz, fz, mode="full")[len(fz) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 60)
    lag = lo + int(np.argmax(ac[lo:hi]))
    bpm = 60 * fps / lag
    # percussiveness: share of flux in sharp peaks
    perc = float(np.mean(fz > 2.0))
    # brightness and low end
    mag = spec.sum(axis=1) + 1e-9
    centroid = float(np.median((spec * freqs).sum(axis=1) / mag))
    low = float(np.median(spec[:, freqs < 150].sum(axis=1) / mag))
    # key via chroma
    chroma = np.zeros(12)
    valid = (freqs > 60) & (freqs < 4000)
    pc = np.round(12 * np.log2(freqs[valid] / 440.0) + 9).astype(int) % 12
    e = spec[:, valid].sum(axis=0)
    for i in range(12):
        chroma[i] = e[pc == i].sum()
    chroma /= chroma.sum()
    best = max([(np.corrcoef(np.roll(KS_MAJ, k), chroma)[0, 1], NOTES[k] + ' major') for k in range(12)] + [(np.corrcoef(np.roll(KS_MIN, k), chroma)[0, 1], NOTES[k] + ' minor') for k in range(12)])
    # loudness curve, 2 s blocks
    blk = SR * 2
    curve = [20 * np.log10(np.sqrt(np.mean(x[i:i + blk] ** 2)) + 1e-9) for i in range(0, len(x) - blk + 1, blk)]
    peak = max(curve)
    spark = ''.join(' .:-=+*#%@'[max(0, min(9, int((c - peak + 30) / 3)))] for c in curve)
    return dict(dur=len(x) / SR, bpm=bpm, perc=perc, centroid=centroid, low=low, key=best[1], keyconf=best[0], spark=spark, peak=peak)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        r = profile(p)
        print(f"{p.split('/')[-1].split(chr(92))[-1]:>12}  {r['dur']:5.0f}s  {r['bpm']:5.1f}bpm  perc {r['perc']:.3f}  bright {r['centroid']:5.0f}Hz  low {r['low']:.2f}  {r['key']:<9} ({r['keyconf']:.2f})")
        print(f"{'':>12}  |{r['spark']}|")
