"""Smooths the HerCova logo for the film.

The brand's own SVG (apps/web/public/media/hercova-logo.svg) is a bitmap trace: integer
vertices joined by straight segments, so curves show as tiny facets when the mark fills the
frame (and at 4K). This keeps every real corner (the H, the r, the v), fits centripetal
Catmull-Rom curves (as cubic Beziers) through the rest, and makes the dots true circles. The
traced originals are kept in assets/data/logo_traced.json (the source this script reads);
the smoothed paths are written into index.html (#markArc, #markSwoosh, #markHead) and
film.js (WORDMARK). Proofs: snapshots/logo-*-before-after.png.

    .venv/Scripts/python scripts/smooth_logo.py
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPACING = 0.5      # resample step (logo units)
SIGMA = 1.6        # smoothing along the outline (logo units)
CORNER_DEG = 38    # a turn sharper than this over +-4 units is a real corner
PROBE = 4.0
EPS = 0.06         # simplification tolerance (logo units)
sys.setrecursionlimit(20000)


def subpaths(d):
    out = []
    for m in re.finditer(r"M([^MZ]+)Z?", d):
        nums = np.array(list(map(float, re.findall(r"-?\d+(?:\.\d+)?", m.group(1))))).reshape(-1, 2)
        if len(nums) >= 3:
            out.append(nums)
    return out


def resample_closed(P, step):
    Q = np.vstack([P, P[:1]])
    seg = np.hypot(*np.diff(Q, axis=0).T)
    acc = np.concatenate([[0], np.cumsum(seg)])
    u = np.arange(0, acc[-1], step)
    return np.stack([np.interp(u, acc, Q[:, 0]), np.interp(u, acc, Q[:, 1])], axis=1), acc[-1]


def corners(R, step):
    n = len(R)
    k = max(2, int(round(PROBE / step)))
    a = R - np.roll(R, k, axis=0)
    b = np.roll(R, -k, axis=0) - R
    ang = np.degrees(np.arccos(np.clip((a * b).sum(1) / (np.hypot(*a.T) * np.hypot(*b.T) + 1e-9), -1, 1)))
    # keep local maxima above the threshold
    idx = [i for i in range(n) if ang[i] > CORNER_DEG and ang[i] >= ang[(i - 1) % n] and ang[i] >= ang[(i + 1) % n]]
    # merge maxima closer than PROBE (one corner per turn)
    merged = []
    for i in idx:
        if merged and (i - merged[-1]) * step < PROBE:
            if ang[i] > ang[merged[-1]]:
                merged[-1] = i
            continue
        merged.append(i)
    if len(merged) > 1 and (merged[0] + n - merged[-1]) * step < PROBE:
        merged.pop()
    return merged


def smooth_run(S, sigma_pts):
    # Gaussian smoothing of an open run with its two ends pinned
    if len(S) < 5:
        return S
    r = int(3 * sigma_pts)
    ker = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_pts) ** 2)
    ker /= ker.sum()
    pad = np.vstack([np.repeat(S[:1], r, 0), S, np.repeat(S[-1:], r, 0)])
    out = np.stack([np.convolve(pad[:, 0], ker, "valid"), np.convolve(pad[:, 1], ker, "valid")], 1)
    # pin the ends and blend in over one sigma so a corner stays exactly where it was
    w = np.clip(np.minimum(np.arange(len(S)), np.arange(len(S))[::-1]) / max(1, sigma_pts), 0, 1)[:, None]
    return S * (1 - w) + out * w


def rdp(P, eps):
    if len(P) < 3:
        return P
    a, b = P[0], P[-1]
    ab = b - a
    L = np.hypot(*ab)
    d = np.abs(ab[0] * (P[:, 1] - a[1]) - ab[1] * (P[:, 0] - a[0])) / L if L > 1e-9 else np.hypot(*(P - a).T)
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(P[:i + 1], eps)[:-1], rdp(P[i:], eps)])
    return np.vstack([a, b])


def fit_circle(P):
    A = np.column_stack([2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))])
    b = (P ** 2).sum(1)
    cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
    r = np.sqrt(c + cx * cx + cy * cy)
    res = np.sqrt(np.mean((np.hypot(P[:, 0] - cx, P[:, 1] - cy) - r) ** 2)) / r
    return cx, cy, r, res


def simplify_closed(P, eps):
    # RDP on a closed ring: split at the vertex farthest from the first one
    j = int(np.argmax(np.hypot(*(P - P[0]).T)))
    a = rdp(np.vstack([P[:j + 1]]), eps)
    b = rdp(np.vstack([P[j:], P[:1]]), eps)
    return np.vstack([a[:-1], b[:-1]])


def centripetal_segments(P, corner):
    """Closed centripetal Catmull-Rom through P as cubic Beziers; a corner vertex is a C0 break."""
    n = len(P)
    segs = []
    for i in range(n):
        p1, p2 = P[i], P[(i + 1) % n]
        p0 = 2 * p1 - p2 if corner[i] else P[(i - 1) % n]
        p3 = 2 * p2 - p1 if corner[(i + 1) % n] else P[(i + 2) % n]
        d01 = max(np.hypot(*(p1 - p0)), 1e-6) ** 0.5
        d12 = max(np.hypot(*(p2 - p1)), 1e-6) ** 0.5
        d23 = max(np.hypot(*(p3 - p2)), 1e-6) ** 0.5
        m1 = (p2 - p1) + d12 * ((p1 - p0) / d01 - (p2 - p0) / (d01 + d12))
        m2 = (p2 - p1) + d12 * ((p3 - p2) / d23 - (p3 - p1) / (d12 + d23))
        segs.append((p1 + m1 / 3, p2 - m2 / 3, p2))
    return segs


def smooth_path(d, simplify=1.6, corner_deg=52, corner_edge=4.0):
    out = []
    f = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")
    for P in subpaths(d):
        # test the whole outline, not just its vertices: a half-disc (the eye of the e) has every
        # vertex on a circle, but its flat edge is not
        cx, cy, r, res = fit_circle(resample_closed(P, 1.0)[0])
        if res < 0.035 and len(P) >= 8:  # a dot: make it a true circle, winding the same way (holes stay holes)
            area = 0.5 * np.sum(P[:, 0] * np.roll(P[:, 1], -1) - np.roll(P[:, 0], -1) * P[:, 1])
            sw = 1 if area > 0 else 0
            out.append(f"M{f(cx - r)} {f(cy)}A{f(r)} {f(r)} 0 1 {sw} {f(cx + r)} {f(cy)}A{f(r)} {f(r)} 0 1 {sw} {f(cx - r)} {f(cy)}Z")
            continue
        S = simplify_closed(P, simplify)
        n = len(S)
        a = S - np.roll(S, 1, axis=0)
        b = np.roll(S, -1, axis=0) - S
        turn = np.degrees(np.arccos(np.clip((a * b).sum(1) / (np.hypot(*a.T) * np.hypot(*b.T) + 1e-9), -1, 1)))
        # a real corner turns sharply between two real edges; a 1-2 unit jog is the trace's staircase
        corner = (turn > corner_deg) & (np.minimum(np.hypot(*a.T), np.hypot(*b.T)) >= corner_edge)
        segs = centripetal_segments(S, corner)
        s = f"M{f(S[0][0])} {f(S[0][1])}"
        for c1, c2, p in segs:
            s += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p[0])} {f(p[1])}"
        out.append(s + "Z")
    return "".join(out)


HTML = os.path.join(ROOT, "index.html")
FILM = os.path.join(ROOT, "film.js")
TRACED = os.path.join(ROOT, "assets", "data", "logo_traced.json")
html = open(HTML, encoding="utf8").read()
film = open(FILM, encoding="utf8").read()
ARC_RE = r'(id="markArc"[^>]*\sd=")([^"]+)(")'
SWOOSH_RE = r'(id="markSwoosh"[^>]*\sd=")([^"]+)(")'
HEAD_RE = r'(id="markHead"[^>]*\sd=")([^"]+)(")'
WORD_RE = r"(const WORDMARK = ')([^']+)(')"
# the brand's traced paths are the source of truth; keep them so this script can run again
if not os.path.exists(TRACED):
    json.dump({"arc": re.search(ARC_RE, html).group(2), "swoosh": re.search(SWOOSH_RE, html).group(2),
               "head": re.search(HEAD_RE, html).group(2), "word": re.search(WORD_RE, film).group(2)}, open(TRACED, "w"))
paths = json.load(open(TRACED))
smooth = {k: smooth_path(v) for k, v in paths.items()}
html = re.sub(ARC_RE, lambda m: m.group(1) + smooth["arc"] + m.group(3), html, count=1)
html = re.sub(SWOOSH_RE, lambda m: m.group(1) + smooth["swoosh"] + m.group(3), html, count=1)
html = re.sub(HEAD_RE, lambda m: m.group(1) + smooth["head"] + m.group(3), html, count=1)
film = re.sub(WORD_RE, lambda m: m.group(1) + smooth["word"] + m.group(3), film, count=1)
open(HTML, "w", encoding="utf8").write(html)
open(FILM, "w", encoding="utf8").write(film)
print({k: (len(paths[k]), len(v)) for k, v in smooth.items()})


# proof: before / after, 6x, anti-aliased by supersampling
def flatten(sub):
    """One subpath (M, L, C, A-circle, Z) -> polygon points, for the proof raster."""
    toks = re.findall(r"[MLCAZ]|-?\d+(?:\.\d+)?", sub)
    pts, i, cur = [], 0, None
    while i < len(toks):
        t = toks[i]; i += 1
        if t in "ML":
            cur = (float(toks[i]), float(toks[i + 1])); i += 2; pts.append(cur)
        elif t == "C":
            c1, c2, p = [(float(toks[i + k]), float(toks[i + k + 1])) for k in (0, 2, 4)]; i += 6
            for u in np.linspace(0, 1, 14)[1:]:
                v = 1 - u
                pts.append(tuple(v ** 3 * cur[j] + 3 * v * v * u * c1[j] + 3 * v * u * u * c2[j] + u ** 3 * p[j] for j in (0, 1)))
            cur = p
        elif t == "A":
            r = float(toks[i]); x1 = float(toks[i + 5]); i += 7
            cx, cy = (cur[0] + x1) / 2, cur[1]
            return [(cx + r * np.cos(a), cy + r * np.sin(a)) for a in np.linspace(0, 2 * np.pi, 180)]
    return pts


def raster(d, colour, img, s, ox, oy):
    dr = ImageDraw.Draw(img)
    for sub in re.findall(r"M[^M]+", d):
        dr.polygon([((x - ox) * s, (y - oy) * s) for x, y in flatten(sub)], fill=colour)


SS = 4
for tag, crop, zoom in (("mark", (90, 0, 250, 270), 6), ("word", (690, 180, 1020, 380), 3)):
    S = zoom * SS
    row = []
    for name, src in (("before", paths), ("after", smooth)):
        im = Image.new("RGB", (int((crop[2] - crop[0]) * S), int((crop[3] - crop[1]) * S)), "white")
        for k, col in (("arc", (123, 47, 168)), ("swoosh", (238, 123, 30)), ("head", (238, 123, 30)), ("word", (123, 47, 168))):
            raster(src[k], col, im, S, crop[0], crop[1])
        row.append(im.resize((im.width // SS, im.height // SS), Image.LANCZOS))
    sheet = Image.new("RGB", (row[0].width * 2 + 20, row[0].height), "white")
    sheet.paste(row[0], (0, 0)); sheet.paste(row[1], (row[0].width + 20, 0))
    sheet.save(os.path.join(ROOT, "snapshots", f"logo-{tag}-before-after.png"))
