"""Cuts the score to the picture. Every candidate is a free track from Pixabay (Pixabay Content
License: commercial use, no attribution required), analysed with scripts/grid_music.py and
scripts/sections_music.py, and cut on bar lines so every musical landing hits a film moment:

  film 10.000   the line of care arrives ("HerCova walks with her")  <- the track's first drop
  film ~21-24   the pull-back and the payoff ("she reaches care, in time") <- a breath, then the second drop
  film end      the logo and the tagline                                <- the track's own ending

Each cut has a short pre-roll crossfade so the incoming downbeat keeps its transient. The edit
is EQ'd for small speakers and mastered to the voice's loudness; build_audio.mjs sets its level
under her voice. The chosen edit is written to assets/audio/mix/music-edit.wav (+ .json with its
drop time); every candidate is also written as music-edit-<name>.wav for auditions.

    .venv/Scripts/python scripts/edit_music.py            # the chosen score
    .venv/Scripts/python scripts/edit_music.py whip       # "whip" as the film's score
    .venv/Scripts/python scripts/edit_music.py --all      # every candidate that fits the film, chosen as the film's
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDS = os.path.join(ROOT, "assets", "audio", "music-cands")
MIX = os.path.join(ROOT, "assets", "audio", "mix")
FILM = 33.0

EDITS = {
    # Pumpupthemind, "Creative Technology Showreel": 150 BPM, bars at 0.05 + 1.6n; drops at 12.85 and
    # 64.05 (32 bars apart); the riser before the second drop; a clean decay from ~102
    "showreel": dict(src="pu-showreel.mp3", segs=[(2.85, 24.05), (60.85, 67.25), (100.85, 104.25)], xf=[0.05, 0.12],
                     drop=24.4, note="drop 1 on the line of care (10.0); a riser under 'And she reaches care,'; drop 2 on 'time.' (24.4); the decay under the end card"),
    # kontraa, "Whip | Afro Dancehall": 124.75 BPM (bar 1.9238); drop at 20.25; silence, then drop 2 at 60.65
    # (21 bars later); the last bar at 158.764 (51 bars on), its final chord at 160.69 ringing out to ~161.7
    "whip": dict(src="kx-whip.mp3", segs=[(10.25, 31.7928), (58.7262, 64.4976), (158.764, 162.4498)], xf=[0.05, 0.1],
                 drop=23.467, note="drop 1 on the line of care (10.0); the breakdown's last bar and its silence at the pull-back; drop 2 on 'care,' as she turns to colour (23.47); the final chord after 'anywhere.'"),
    # penguinmusic, "Better Day": 90 BPM (bar 2.6667); the drop lands on the downbeat at 21.33 after a one-bar
    # fill from 18.663; the calm outro from 80.0. The drop is used twice: on the line of care, and — after the
    # song breathes back to its pre-drop bar at the pull-back — again as she resolves into colour.
    "betterday": dict(src="pg-betterday.mp3", segs=[(11.33, 31.997), (18.663, 23.996), (80.0, 87.0)], xf=[0.08, 0.12],
                      drop=23.333, note="the drop on the line of care (10.0); the pre-drop bar as a breath at the pull-back (20.67); the drop again on 'care,' as she turns to colour (23.33); the calm outro under the logo"),
    # penguinmusic, "Lazy Day - Stylish Futuristic Chill": 94.97 BPM (bar 2.5271); a bass-less intro, the groove
    # drops at 18.93; the quiet outro from ~60.7. Drop 2 lands on the bloom as she reaches care.
    "lazyday": dict(src="pg-lazyday.mp3", segs=[(8.93, 29.038), (16.403, 21.457), (59.364, 67.202)], xf=[0.06, 0.12],
                    drop=22.635, note="the soft intro under the stakes; the drop on the line of care (10.0); the pre-drop bar at the pull-back; the drop again on the bloom (22.64); the quiet outro under the logo"),
    # MFCC, "Background Music" (chill positive hip hop): 86.05 BPM (bar 2.7891); intro, the drop at 11.30; the last
    # section from 50.35, fading from 56
    "mfcc": dict(src="mf-background.mp3", segs=[(1.30, 22.456), (8.511, 14.089), (50.347, 56.613)], xf=[0.06, 0.12],
                 drop=23.945, note="the intro under the stakes; the drop on the line of care (10.0); the pre-drop bar at the pull-back; the drop again in the pause after 'care,' (23.95); the last section under the logo"),
    # AlexGrohl, "Sweet Life (Luxury Chill)": 121.96 BPM (bar 1.9679); the breakdown 48-63 and its drop at 64.93; an
    # earlier break and drop at 34.43; the fade from 95
    "sweetlife": dict(src="ag-sweetlife.mp3", segs=[(54.93, 76.737), (32.462, 40.334), (94.449, 97.770)], xf=[0.06, 0.12],
                      drop=23.775, note="the breakdown under the stakes; its drop on the line of care (10.0); a one-bar break at the pull-back; the drop in the pause after 'care,' (23.78); the fade under the sign-off"),
    # Rockot, "EONA - Emotional Ambient Pop" (the previous score)
    "eona": dict(src="rk-eona.mp3", segs=[(5.569, 27.276), (91.666, 95.568), (138.480, 143.870)], xf=[0.06, 0.22],
                 drop=23.658, note="previous score"),
}
CHOSEN = "betterday"  # chosen by ear from renders/audition-*.mp4 (2026-09-29)
EQ = "highpass=f=45,bass=g=-2.5:f=110:w=0.8,equalizer=f=2600:t=q:w=1.1:g=3.5,treble=g=2.5:f=7500"


def build(name, e):
    segs, xf = e["segs"], e["xf"]
    chains = []
    for i, (a, b) in enumerate(segs):
        pre = xf[i - 1] if i else 0.0
        chains.append(f"[0:a]atrim={a - pre:.3f}:{b:.3f},asetpts=PTS-STARTPTS[s{i}]")
    graph, cur = ";".join(chains), "s0"
    for i in range(1, len(segs)):
        graph += f";[{cur}][s{i}]acrossfade=d={xf[i - 1]}:c1=tri:c2=tri[x{i}]"
        cur = f"x{i}"
    total = sum(b - a for a, b in segs)
    if abs(total - FILM) > 0.02:  # an edit cut for an earlier film length is skipped, not fatal
        print(f"{name:10s} skipped: edit is {total:.3f}s, film is {FILM}s")
        return None
    graph += f";[{cur}]afade=t=in:st=0:d=1.2,afade=t=out:st={total - 0.9:.2f}:d=0.9,{EQ},loudnorm=I=-16:TP=-1.5:LRA=9[out]"
    out = os.path.join(MIX, f"music-edit-{name}.wav")
    subprocess.run(["ffmpeg", "-hide_banner", "-y", "-loglevel", "error", "-i", os.path.join(CANDS, e["src"]), "-filter_complex", graph, "-map", "[out]", "-ar", "48000", out], check=True)
    cuts = [round(sum(b - a for a, b in segs[:i]), 3) for i in range(1, len(segs))]
    print(f"{name:10s} {total:.3f}s  cuts at film {cuts}  drop {e['drop']}  — {e['note']}")
    return out


args = [a for a in sys.argv[1:] if not a.startswith("--")]
chosen = args[0] if args else CHOSEN
names = list(EDITS) if "--all" in sys.argv else [chosen]
paths = {n: build(n, EDITS[n]) for n in names}
import shutil
shutil.copyfile(paths[chosen], os.path.join(MIX, "music-edit.wav"))
meta = {"name": chosen, "src": EDITS[chosen]["src"], "drop": EDITS[chosen]["drop"]}
json.dump(meta, open(os.path.join(MIX, "music-edit.json"), "w"))
# the picture reads the score's drop too (a camera punch lands on it)
with open(os.path.join(ROOT, "assets", "audio", "music.js"), "w", encoding="utf8") as f:
    f.write("// Generated by scripts/edit_music.py — the film's score and its second drop.\n(function (g) { g.HERCOVA_MUSIC = " + json.dumps(meta) + "; })(typeof window !== 'undefined' ? window : globalThis);\n")
print(f"film score: {chosen}")
