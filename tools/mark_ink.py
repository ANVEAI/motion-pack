#!/usr/bin/env python3
"""mark_ink.py: the ink fraction of a mark image, for title.partnerLockup's optical balancing (equal ink area, not equal height).

  python3 tools/mark_ink.py logo.png [--channel alpha|luma|luma-light] [--crop tight.png]

ink = sum of the mark's coverage over the image box / (width x height), the same formula as inkFromMask() / markFromImage() in type/gfx/r45-type.js:
  alpha       alpha-weighted coverage (soft edges count in part); the default, for marks on a transparent ground
  luma        dark ink on an opaque light ground: (1 - luma) x alpha
  luma-light  light ink on an opaque dark ground: luma x alpha
Transparent margins count as part of the box, so crop the file to the mark first: --crop writes a tight copy and measures THAT one.

Prints one JSON line with the ink, the box (h = 100) and a mark to paste into the lockup's `marks` (set licensed: true yourself, only for a mark you may use):
  { "ink": 0.31, "w": 300, "h": 100, "px": [1200, 400], "margin": 0.0, "mark": { "href": "logo.png", "w": 300, "h": 100, "ink": 0.31, "licensed": false } }
"""
import argparse
import json
import sys

import numpy as np
from PIL import Image


def ink_of(rgba, channel="alpha"):
    """rgba: uint8 array (h, w, 4). Same arithmetic as inkFromMask()."""
    a = rgba[..., 3].astype(np.float64) / 255.0
    if channel == "alpha":
        return float(a.mean())
    lum = (0.2126 * rgba[..., 0] + 0.7152 * rgba[..., 1] + 0.0722 * rgba[..., 2]) / 255.0
    return float((a * ((1.0 - lum) if channel == "luma" else lum)).mean())


def tight_box(rgba, channel="alpha", eps=0.02):
    """bounding box (x0, y0, x1, y1) of the pixels that carry ink, or the whole image if none do"""
    a = rgba[..., 3].astype(np.float64) / 255.0
    if channel != "alpha":
        lum = (0.2126 * rgba[..., 0] + 0.7152 * rgba[..., 1] + 0.0722 * rgba[..., 2]) / 255.0
        a = a * ((1.0 - lum) if channel == "luma" else lum)
    ys, xs = np.where(a > eps)
    if not len(xs):
        return 0, 0, rgba.shape[1], rgba.shape[0]
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def measure(path, channel="alpha", crop=None):
    im = Image.open(path).convert("RGBA")
    rgba = np.asarray(im)
    h, w = rgba.shape[:2]
    x0, y0, x1, y1 = tight_box(rgba, channel)
    margin = 1.0 - ((x1 - x0) * (y1 - y0)) / float(w * h)
    if crop:
        im = im.crop((x0, y0, x1, y1))
        im.save(crop)
        rgba = np.asarray(im)
        h, w = rgba.shape[:2]
    ink = ink_of(rgba, channel)
    bw = int(round(100.0 * w / h))
    href = crop or path
    return {"ink": round(ink, 4), "w": bw, "h": 100, "px": [w, h], "margin": round(margin, 3),
            "mark": {"href": href, "w": bw, "h": 100, "ink": round(ink, 4), "licensed": False}}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("image")
    ap.add_argument("--channel", choices=("alpha", "luma", "luma-light"), default="alpha")
    ap.add_argument("--crop", help="write a tight-cropped copy here and measure it")
    a = ap.parse_args(argv)
    out = measure(a.image, a.channel, a.crop)
    if out["margin"] > 0.05 and not a.crop:
        print(f"note: {out['margin'] * 100:.0f}% of the box is empty margin; crop the file to the mark (--crop tight.png) so gaps and edges sit on the mark", file=sys.stderr)
    print(json.dumps(out))
    return out


if __name__ == "__main__":
    main()
