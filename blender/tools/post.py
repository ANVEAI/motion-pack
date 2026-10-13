#!/usr/bin/env python3
"""motion-pack/blender post tools (system python3 + numpy + Pillow; ffmpeg on PATH). Called by run.py; usable alone.

  post.py encode  --frames DIR --count N --fps 30 --out plate.mp4 [--crf 18] [--lens] [--start 0]
        H.264 yuv420p proxy (bt709 tags, +faststart). RGBA frames are flattened on black. --lens bakes the launch
        film's lens character into the MP4 only (amber-tinted veiling bloom, vignette; no grain, the pack's layers add
        grain): the PNG masters stay clean for compositing.
  post.py sheet   --frames DIR --out sheet.jpg [--pick 0,30,...] [--n 8] [--label TEXT]
  post.py compare A.png B.png                      pixel equality, max abs diff (8-bit), PSNR -> JSON
  post.py contact --out all.jpg PNG_OR_MP4 ...     one labelled tile per input (showcase review sheet)
MIT (see blender/LICENSE)."""
import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw


def _blur(im, r):
    for axis in (0, 1):
        for _ in range(3):
            pad = [(r + 1, r) if i == axis else (0, 0) for i in range(im.ndim)]
            c = np.cumsum(np.pad(im, pad, mode="edge"), axis=axis)
            n = c.shape[axis]
            im = (np.take(c, range(2 * r + 1, n), axis=axis) - np.take(c, range(0, n - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return im


def lens(rgb, bloom=0.11, thr=0.6, tint=(1.0, 0.82, 0.62), vignette=0.22):
    """plate_post.lens without CA and grain (CA 0.0012 fringed the band; the pack's layers own grain)."""
    h, w, _ = rgb.shape
    if bloom > 0:
        lum = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        hi = rgb * (np.clip((lum - thr) / (1 - thr), 0, 1) ** 1.5)[..., None]
        f = 4
        hh, ww = h - h % f, w - w % f
        small = hi[:hh, :ww].reshape(hh // f, f, ww // f, f, 3).mean(axis=(1, 3))
        g1, g2 = _blur(small, 3), _blur(small, 14)
        up = lambda s: np.repeat(np.repeat(s, f, 0), f, 1)
        glow = np.zeros_like(rgb)
        glow[:hh, :ww] = 0.6 * up(g1) + 0.4 * up(g2)
        glow = _blur(glow, 2) * np.array(tint, np.float32)
        rgb = 1 - (1 - rgb) * (1 - np.clip(glow * bloom * 6, 0, 1))
    if vignette > 0:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        cx, cy, R = (w - 1) / 2.0, (h - 1) / 2.0, 0.5 * math.hypot(w, h)
        rgb = rgb * (1 - vignette * (((xx - cx) ** 2 + (yy - cy) ** 2) / (R * R)) ** 1.3)[..., None]
    return np.clip(rgb, 0, 1)


def load_rgb(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
        im = Image.alpha_composite(bg, im.convert("RGBA"))
    return im.convert("RGB")


def cmd_encode(a):
    first = Image.open(os.path.join(a.frames, "f%04d.png" % a.start))
    w, h = first.size
    enc = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (w, h), "-r", str(a.fps),
           "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", str(a.crf), "-pix_fmt", "yuv420p", "-g", str(a.fps),
           "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-movflags", "+faststart", "-an",
           a.out + ".part.mp4"]
    p = subprocess.Popen(enc, stdin=subprocess.PIPE)
    for f in range(a.start, a.start + a.count):
        im = load_rgb(os.path.join(a.frames, "f%04d.png" % f))
        if a.lens:
            arr = lens(np.asarray(im, np.float32) / 255.0)
            p.stdin.write((arr * 255.0 + 0.5).astype(np.uint8).tobytes())
        else:
            p.stdin.write(im.tobytes())
    p.stdin.close()
    if p.wait() != 0:
        sys.exit("ffmpeg failed")
    os.replace(a.out + ".part.mp4", a.out)
    print(json.dumps({"mp4": a.out, "frames": a.count, "mb": round(os.path.getsize(a.out) / 1e6, 2), "lens": a.lens}))


def tile(paths, labels, out, tw=480, cols=4, title=None):
    ims = [load_rgb(p) for p in paths]
    w, h = ims[0].size
    if h > w:
        tw = int(tw * 0.6)
    th = round(h * tw / w)
    cols = min(cols if w >= h else cols + 2, len(ims))
    rows = (len(ims) + cols - 1) // cols
    top = 22 if title else 0
    S = Image.new("RGB", (tw * cols, th * rows + top), (16, 16, 18))
    d = ImageDraw.Draw(S)
    if title:
        d.text((8, 5), title, fill=(230, 230, 230))
    for i, (im, lb) in enumerate(zip(ims, labels)):
        x, y = (i % cols) * tw, (i // cols) * th + top
        k = min(tw / im.size[0], th / im.size[1])          # fit (letterbox), never stretch a 9:16 into a 16:9 tile
        rw, rh = max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))
        S.paste(im.resize((rw, rh), Image.LANCZOS), (x + (tw - rw) // 2, y + (th - rh) // 2))
        d.text((x + 6, y + 4), lb, fill=(255, 210, 60))
    S.save(out, quality=88)
    return S.size


def cmd_sheet(a):
    names = sorted(f for f in os.listdir(a.frames) if f.startswith("f") and f.endswith(".png"))
    if a.pick:
        want = ["f%04d.png" % int(x) for x in a.pick.split(",")]
        names = [n for n in want if n in names]
    if len(names) > a.n:
        idx = [round(i * (len(names) - 1) / (a.n - 1)) for i in range(a.n)]
        names = [names[i] for i in idx]
    size = tile([os.path.join(a.frames, n) for n in names], [n[:-4] for n in names], a.out, title=a.label)
    print(json.dumps({"sheet": a.out, "size": size, "frames": names}))


def cmd_compare(a):
    x = np.asarray(Image.open(a.a).convert("RGBA"), np.float64)
    y = np.asarray(Image.open(a.b).convert("RGBA"), np.float64)
    d = np.abs(x - y)
    mse = float((d ** 2).mean())
    print(json.dumps({"pixel_equal": bool(d.max() == 0), "max_abs_8bit": float(d.max()), "changed_px_frac": float((d > 0).mean()),
                      "psnr_db": None if mse == 0 else round(10 * math.log10(255.0 ** 2 / mse), 2)}))


def cmd_contact(a):
    paths, labels, tmp = [], [], os.path.join(os.path.dirname(os.path.abspath(a.out)), ".contact")
    os.makedirs(tmp, exist_ok=True)
    for i, src in enumerate(a.inputs):
        if src.endswith(".mp4"):
            for k, frac in enumerate((0.15, 0.5, 0.85)):
                info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                                      capture_output=True, text=True).stdout.strip()
                t = float(info or 1) * frac
                p = os.path.join(tmp, "%02d_%d.png" % (i, k))
                subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "%.3f" % t, "-i", src, "-frames:v", "1", p], check=True)
                paths.append(p)
                labels.append("%s @%.1fs" % (os.path.basename(src)[:44], t))
        else:
            paths.append(src)
            labels.append(os.path.basename(src)[:50])
    print(json.dumps({"contact": a.out, "size": tile(paths, labels, a.out, tw=a.tw, cols=3, title=a.title)}))


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    e = sp.add_parser("encode")
    e.add_argument("--frames", required=True)
    e.add_argument("--count", type=int, required=True)
    e.add_argument("--start", type=int, default=0)
    e.add_argument("--fps", type=int, default=30)
    e.add_argument("--out", required=True)
    e.add_argument("--crf", type=int, default=18)
    e.add_argument("--lens", action="store_true")
    s = sp.add_parser("sheet")
    s.add_argument("--frames", required=True)
    s.add_argument("--out", required=True)
    s.add_argument("--pick", default=None)
    s.add_argument("--n", type=int, default=8)
    s.add_argument("--label", default=None)
    c = sp.add_parser("compare")
    c.add_argument("a")
    c.add_argument("b")
    k = sp.add_parser("contact")
    k.add_argument("--out", required=True)
    k.add_argument("--title", default=None)
    k.add_argument("--tw", type=int, default=420)
    k.add_argument("inputs", nargs="+")
    a = ap.parse_args()
    {"encode": cmd_encode, "sheet": cmd_sheet, "compare": cmd_compare, "contact": cmd_contact}[a.cmd](a)


if __name__ == "__main__":
    main()
