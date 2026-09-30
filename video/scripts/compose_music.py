"""Original score for the HerCova film, synthesized from scratch (no samples).

Warm, hopeful, resolved. 80 BPM, 4/4, so one bar = 3.0s. Six bars plus a tail
(19s), lined up with the film's beats (see TIMING in index.html):

  bar 1  0-3s    the stakes      Bm(add9) pad alone, felt-piano motif, dark filter
  bar 2  3-6s    stakes -> line  Gmaj7, piano arpeggio enters, soft heartbeat pulse
  bar 3  6-9s    the line draws  D/F# -> Asus4, pad opens, swell builds to the connect
  bar 4  9-12s   care team, her  D(add9) arrival on the connect, fullest texture
  bar 5  12-15s  she is reached  G -> Em7 -> A7sus4, a tender lift into the close
  bar 6  15s-    the promise     Dmaj9 resolve on the logo, held, fades out

Everything is deterministic (seeded noise), so re-running produces the same file.

    python scripts/compose_music.py assets/audio/music.wav
"""

import sys
import wave

import numpy as np

SR = 44100
DUR = 19.0
BEAT = 60.0 / 80.0  # 0.75s
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def hz(note: str) -> float:
    names = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6,
             "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    name, octave = note[:-1], int(note[-1])
    midi = 12 * (octave + 1) + names[name]
    return 440.0 * 2 ** ((midi - 69) / 12)


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# --------------------------------------------------------------- instruments

def felt_piano(freq, dur, vel=0.5):
    """Additive piano with per-partial decay, slight inharmonicity, soft hammer."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.00018
    for k in range(1, 11):
        f = freq * k * np.sqrt(1 + B * k * k)
        if f > 9000:
            break
        amp = (1.0 / k ** 1.35) * (0.55 if k == 2 else 1.0)
        decay = 1.1 + 0.55 * k  # higher partials die faster
        out += amp * np.exp(-decay * t / max(0.6, freq / 440)) * np.sin(2 * np.pi * f * t + k)
    # body: a slow second decay stage keeps the note singing
    out += 0.25 * np.exp(-0.9 * t) * np.sin(2 * np.pi * freq * t)
    attack = smoothstep(t / 0.006)
    hammer = rng.standard_normal(n) * np.exp(-t / 0.004) * 0.04
    release = smoothstep((dur - t) / 0.25)
    return (out * attack + hammer) * release * vel


def pad_voice(freq, dur, bright):
    """Detuned additive saw pad; `bright` in 0..1 sets the harmonic rolloff."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rolloff = 1.9 - 0.8 * bright
    for det in (-0.07, 0.0, 0.065):
        f0 = freq * 2 ** (det / 12)
        for k in range(1, 12):
            if f0 * k > 7000:
                break
            out += (1.0 / k ** rolloff) * np.sin(2 * np.pi * f0 * k * t + det * 40 * k)
    # slow breathing tremolo
    out *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.22 * t)
    env = smoothstep(t / 0.9) * smoothstep((dur - t) / 1.1)
    return out * env / 3.0


def soft_kick(vel=0.5):
    n = int(SR * 0.45)
    t = np.arange(n) / SR
    f = 48 + 38 * np.exp(-t / 0.035)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * np.exp(-t / 0.13)
    click = rng.standard_normal(n) * np.exp(-t / 0.002) * 0.02
    return (body + click) * vel


def shaker(vel=0.12):
    n = int(SR * 0.12)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # crude high-pass: difference of noise
    noise = np.diff(noise, prepend=0)
    return noise * np.exp(-t / 0.028) * smoothstep(t / 0.004) * vel


def sub(freq, dur, vel=0.22):
    n = int(SR * dur)
    t = np.arange(n) / SR
    env = smoothstep(t / 0.08) * smoothstep((dur - t) / 0.4)
    return (np.sin(2 * np.pi * freq * t) + 0.2 * np.sin(4 * np.pi * freq * t)) * env * vel


# ------------------------------------------------------------------- mixing

L = np.zeros(N)
R = np.zeros(N)


def place(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg = np.cos((pan + 1) * np.pi / 4)
    rg = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * lg
    R[i:i + len(sig)] += sig * rg


bar = lambda b: b * 4 * BEAT  # noqa: E731

# Harmony: (start_bar, bars, pad notes, bass note, brightness)
CHORDS = [
    (0, 1.0, ["B2", "F#3", "C#4", "D4"], "B1", 0.15),          # Bm(add9)
    (1, 1.0, ["G2", "D3", "F#3", "B3"], "G1", 0.35),           # Gmaj7
    (2, 0.5, ["F#2", "D3", "A3", "E4"], "F#1", 0.55),          # D/F#(add9)
    (2.5, 0.5, ["A2", "E3", "A3", "D4"], "A1", 0.7),           # Asus4
    (3, 1.0, ["D3", "A3", "E4", "F#4"], "D2", 0.85),           # D(add9) arrival
    (4, 0.5, ["G2", "D3", "B3", "F#4"], "G1", 0.7),            # Gmaj7
    (4.5, 0.25, ["E3", "B3", "D4", "G4"], "E2", 0.6),          # Em7
    (4.75, 0.25, ["A2", "E3", "G3", "D4"], "A1", 0.65),        # A7sus4
    (5, 1.2, ["D3", "A3", "C#4", "E4", "F#4"], "D2", 0.5),     # Dmaj9 resolve
]

for start_bar, bars, notes, bass, bright in CHORDS:
    start = bar(start_bar)
    dur = bars * 4 * BEAT + 1.2  # overlap for legato
    if start_bar >= 5:
        dur = DUR - start
    for j, nt in enumerate(notes):
        place(pad_voice(hz(nt), dur, bright), start, pan=(-0.35 + 0.7 * j / max(1, len(notes) - 1)),
              gain=0.085)
    if start_bar >= 1:
        place(sub(hz(bass), min(dur, DUR - start)), start, gain=0.9)

# Felt-piano motif. (time_in_beats, note, velocity)
MOTIF = [
    # bar 1: a tender, questioning phrase
    (0.0, "F#4", 0.30), (1.5, "D5", 0.26), (2.0, "C#5", 0.24), (3.0, "B4", 0.28),
    # bar 2: arpeggio begins (8ths)
    (4.0, "G3", 0.24), (4.5, "D4", 0.2), (5.0, "B4", 0.24), (5.5, "F#4", 0.2),
    (6.0, "D5", 0.26), (6.5, "B4", 0.2), (7.0, "A4", 0.22), (7.5, "F#4", 0.2),
    # bar 3: lifting
    (8.0, "F#3", 0.26), (8.5, "D4", 0.22), (9.0, "A4", 0.26), (9.5, "E5", 0.24),
    (10.0, "A3", 0.26), (10.5, "E4", 0.22), (11.0, "A4", 0.28), (11.5, "D5", 0.3),
    # bar 4: arrival, melody on top
    (12.0, "D4", 0.3), (12.0, "F#5", 0.34), (12.5, "A4", 0.22), (13.0, "E5", 0.3),
    (13.5, "A4", 0.2), (14.0, "D5", 0.3), (14.5, "F#4", 0.2), (15.0, "A5", 0.26), (15.5, "E5", 0.22),
    # bar 5: tender lift
    (16.0, "G3", 0.24), (16.5, "D4", 0.2), (17.0, "B4", 0.26), (17.5, "D5", 0.24),
    (18.0, "E3", 0.22), (18.0, "G4", 0.22), (18.5, "B4", 0.2),
    (19.0, "A3", 0.24), (19.0, "E5", 0.26), (19.5, "D5", 0.24),
    # bar 6: the resolve and a last high glint
    (20.0, "D4", 0.32), (20.0, "A4", 0.26), (20.0, "C#5", 0.24), (20.0, "F#5", 0.32),
    (21.0, "A5", 0.14), (21.5, "D6", 0.1), (22.5, "F#6", 0.07),
]
for beats, nt, vel in MOTIF:
    start = beats * BEAT
    d = min(4.5, DUR - start)
    pan = np.clip((hz(nt) - 400) / 900, -0.4, 0.4)
    place(felt_piano(hz(nt), d, vel), start, pan=pan, gain=0.55)

# Heartbeat pulse: from bar 2, on beats 1 and 3; every beat in bar 4; softer in bar 5; stops for the resolve.
for b in range(4, 20):
    in_bar4 = 12 <= b < 16
    if b % 2 == 0 or in_bar4:
        v = (0.30 + 0.25 * min(b - 4, 12) / 12) * (0.7 if b >= 16 else 1.0)
        place(soft_kick(v), b * BEAT, gain=0.8)
    if 8 <= b < 20:
        place(shaker(0.05 + 0.04 * min(b - 8, 8) / 8), b * BEAT + BEAT / 2, pan=0.3)

# Swell: filtered noise + pad lift building across bar 3 into the arrival at 9s.
sw_n = int(SR * 3.2)
sw_t = np.arange(sw_n) / SR
sw = rng.standard_normal(sw_n)
# smooth the noise into a breathy wash with a moving average
k = 24
sw = np.convolve(sw, np.ones(k) / k, mode="same")
sw *= (sw_t / 3.2) ** 2.2 * smoothstep((3.2 - sw_t) / 0.15)
place(sw, 5.9, pan=-0.2, gain=0.55)
place(np.roll(sw, 311), 5.9, pan=0.2, gain=0.45)  # offset copy for width

# ----------------------------------------------------------------- reverb

def reverb(x, seconds=2.4, mix=0.32, seed=1):
    r = np.random.default_rng(seed)
    n = int(SR * seconds)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * 6.9 / seconds)
    ir = np.convolve(ir, np.ones(6) / 6, mode="same")  # darken the tail
    ir[: int(0.012 * SR)] = 0  # pre-delay
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + wet * mix * 1.4


L = reverb(L, seed=1)
R = reverb(R, seed=2)

# ----------------------------------------------------------------- master
fade_in = smoothstep(t_all / 0.35)
fade_out = smoothstep((DUR - t_all) / 2.2)
L *= fade_in * fade_out
R *= fade_in * fade_out

# gentle bus glue: soft saturation, then normalize to -1 dBFS peak
st = np.stack([L, R])
st = np.tanh(st * 1.4) / np.tanh(1.4)
st *= 10 ** (-1 / 20) / np.max(np.abs(st))

pcm = (st.T * 32767).astype("<i2")
out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out, f"{DUR}s")
