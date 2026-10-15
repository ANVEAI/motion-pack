"""Synthetic test videos for eyes (Pillow + numpy frames piped into ffmpeg x264; a few seconds each, written under pytest's tmp dir, nothing committed)."""
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'templates', '_shared', 'fonts', 'IBMPlexMono-SemiBold.ttf')


def make_video(path, frame_fn, n, w=540, h=960, fps=30, crf=14, extra_out=None, pix='yuv420p', x264=None, vf=None, tag=True, faststart=True):
    """encode frame_fn(i) -> (h, w, 3) uint8 for i in range(n) with libx264 (CRF crf or none, faststart unless faststart=False, bt709 tags unless tag=False). extra_out: more output args"""
    cmd = [FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (w, h), '-r', str(fps), '-i', '-']
    if vf:
        cmd += ['-vf', vf]
    cmd += ['-c:v', 'libx264', '-preset', 'veryfast'] + (['-crf', str(crf)] if crf is not None else []) + ['-pix_fmt', pix] + (['-movflags', '+faststart'] if faststart else [])
    if tag:
        cmd += ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
    if x264:
        cmd += ['-x264-params', x264]
    cmd += (extra_out or []) + [path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(np.ascontiguousarray(frame_fn(i), dtype=np.uint8).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError('ffmpeg failed for ' + path)
    return path


def solid(w, h, rgb):
    a = np.empty((h, w, 3), np.uint8)
    a[:] = rgb
    return a


def moving_scene(w=540, h=960, seed=3):
    """a function i -> frame: a bright disc that drifts across a dark graded backdrop with fine grain (so no check sees a flat or banded frame), one hero"""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w]
    bg = (28 + 22 * (yy / h))[..., None] * np.ones((1, 1, 3))
    bg[..., 2] += 14
    grain = rng.normal(0, 2.0, (h, w, 1))

    def f(i):
        cx, cy = w * (0.3 + 0.012 * i), h * 0.5
        r = min(w, h) * 0.13
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        disc = np.clip((r - d) / 2.0, 0, 1)[..., None]
        fr = bg * (1 - disc) + np.array([235, 220, 190])[None, None, :] * disc + grain
        return np.clip(fr, 0, 255)
    return f


def text_frame(base, text, box, size, fill=(255, 255, 255), stroke=0):
    """draw `text` with its top-left at box[:2] onto a copy of the uint8 frame; returns the frame and the drawn bbox"""
    im = Image.fromarray(np.ascontiguousarray(base, dtype=np.uint8))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, size)
    d.text((box[0], box[1]), text, font=f, fill=fill, stroke_width=stroke)
    return np.asarray(im), d.textbbox((box[0], box[1]), text, font=f)
