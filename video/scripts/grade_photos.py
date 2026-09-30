"""Grades the film's two photographs (baked, deterministic).

The film is neutral: white ground, near-black type, the brand purple spent only as an
accent. The photographs follow that: she is black and white while the film is about the
risk, and colour arrives only when she reaches care.

  hero-mono.jpg     the hero mother (already monochrome at source): neutral black and
                    white, gentle S-curve, blacks held just off pure black
  hero-subject.png  the same, cut out with the alpha from remove-background
  mb-color.png      mother + newborn (the website's Vision photograph) in natural colour,
                    whites cleaned, cut out, upscaled 2x (Lanczos + light unsharp) so the
                    4K master stays sharp

Film grain is not baked in: the film's own grain layer moves over every frame.

    .venv/Scripts/python scripts/grade_photos.py
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "images")
OUT = os.path.join(IMG, "graded")
os.makedirs(OUT, exist_ok=True)


def s_curve(x, k=0.18):
    # gentle contrast around mid-grey
    return np.clip(x + k * np.sin((x - 0.5) * np.pi) * (1 - np.abs(2 * x - 1)) * 0.9, 0, 1)


def to8(a):
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---------------------------------------------------------------- hero mother, black and white
src = np.asarray(Image.open(os.path.join(IMG, "hero-mother-gele-hd.jpeg")).convert("RGB")).astype(np.float32) / 255.0
lum = src @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
lum = s_curve(np.clip((lum - 0.02) / 0.96, 0, 1), 0.2)
ink = np.array([0.067, 0.063, 0.075], dtype=np.float32)  # #111013: blacks held off pure black
mono = ink[None, None, :] + (1 - ink)[None, None, :] * lum[..., None]
Image.fromarray(to8(mono)).save(os.path.join(OUT, "hero-mono.jpg"), quality=95, subsampling=0)
cut = Image.open(os.path.join(OUT, "hero-cutout.png")).convert("RGBA").resize((mono.shape[1], mono.shape[0]), Image.LANCZOS)
alpha = np.asarray(cut)[..., 3]
Image.fromarray(np.dstack([to8(mono), alpha]), "RGBA").save(os.path.join(OUT, "hero-subject.png"))
print("hero-mono.jpg, hero-subject.png")

# ---------------------------------------------------------------- mother + newborn, natural colour
src = np.asarray(Image.open(os.path.join(IMG, "console-mother-baby.jpeg")).convert("RGB")).astype(np.float32) / 255.0
# clean whites with a soft shoulder, keep skin tones: a per-channel levels lift, not a tint
lo, hi = 0.015, 0.93
col = np.clip((src - lo) / (hi - lo), 0, 1)
col = col ** 0.97
col = np.clip(col + 0.06 * np.sin((col - 0.5) * np.pi) * (1 - np.abs(2 * col - 1)), 0, 1)  # a touch of contrast
a = np.asarray(Image.open(os.path.join(OUT, "mb-cutout.png")).convert("RGBA"))[..., 3]
big = Image.fromarray(np.dstack([to8(col), a]), "RGBA").resize((col.shape[1] * 2, col.shape[0] * 2), Image.LANCZOS)
rgb = big.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
big = Image.merge("RGBA", (*rgb.split(), big.split()[3]))
big.save(os.path.join(OUT, "mb-color.png"))
print("mb-color.png", big.size)
