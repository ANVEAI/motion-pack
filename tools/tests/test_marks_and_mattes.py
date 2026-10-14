#!/usr/bin/env python3
"""Tests for tools/mark_ink.py (the ink of a mark image, for title.partnerLockup) and tools/alpha_frames.py (a video alpha -> the PNG matte sequence that type.behindSubject takes).
Everything is generated on the spot (numpy + ffmpeg lavfi): no assets, no network. Run: python3 -m pytest -q tools/tests"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import pytest
from PIL import Image

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
import alpha_frames  # noqa: E402
import mark_ink  # noqa: E402

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
HAS_FFMPEG = shutil.which(FFMPEG) is not None


def ring_png(path, w=400, h=200, r_out=90.0, r_in=45.0, ss=4, ink=(255, 255, 255)):
    """an anti-aliased ring (supersampled) centred in a transparent w x h image; returns the analytic ink fraction"""
    ys, xs = np.mgrid[0:h * ss, 0:w * ss]
    d = np.hypot((xs + 0.5) / ss - w / 2, (ys + 0.5) / ss - h / 2)
    cov = ((d <= r_out) & (d >= r_in)).astype(np.float64).reshape(h, ss, w, ss).mean(axis=(1, 3))
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = ink
    rgba[..., 3] = np.round(cov * 255).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(path)
    return np.pi * (r_out ** 2 - r_in ** 2) / (w * h)


def test_mark_ink_matches_the_analytic_area_and_crops_the_margin():
    with tempfile.TemporaryDirectory() as td:
        f = os.path.join(td, "ring.png")
        want = ring_png(f)
        got = mark_ink.measure(f)
        assert got["ink"] == pytest.approx(want, rel=0.01)
        assert got["w"] == 200 and got["h"] == 100 and got["px"] == [400, 200]            # box aspect, h = 100
        assert got["margin"] == pytest.approx(1 - (180 * 180) / (400 * 200), abs=0.02)    # the ring only fills a 180 x 180 box of it
        tight = os.path.join(td, "tight.png")
        c = mark_ink.measure(f, crop=tight)
        assert Image.open(tight).size[0] in (180, 181, 182) and c["w"] == 100
        assert c["ink"] == pytest.approx(np.pi * (90 ** 2 - 45 ** 2) / (180 * 180), rel=0.02)
        r = subprocess.run([sys.executable, os.path.join(TOOLS, "mark_ink.py"), f], capture_output=True, text=True)       # the CLI prints one JSON line and a margin note
        assert r.returncode == 0 and json.loads(r.stdout)["ink"] == got["ink"] and "margin" in r.stderr


def test_mark_ink_luma_channels_read_dark_and_light_ink_on_an_opaque_ground():
    a = np.full((10, 10, 4), 255, np.uint8)            # white ground
    a[:, :5, :3] = 0                                   # left half black ink
    assert mark_ink.ink_of(a, "luma") == pytest.approx(0.5)
    assert mark_ink.ink_of(a, "luma-light") == pytest.approx(0.5)      # the white half counts for light ink
    assert mark_ink.ink_of(a, "alpha") == pytest.approx(1.0)           # fully opaque: alpha alone carries no shape


def _ffmpeg(*args):
    r = subprocess.run([FFMPEG, "-v", "error", "-nostdin", "-y", *args], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr


def _has_encoder(name):
    return HAS_FFMPEG and name in subprocess.run([FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout


def _circle_alpha(k, n=10, size=(96, 64)):
    """where the generated circle is in frame k (centre x moves 10 -> 70 across the clip)"""
    return 10 + 60 * k / n, size[1] / 2


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg not on PATH")
def test_alpha_frames_turns_a_video_alpha_into_matte_pngs():
    with tempfile.TemporaryDirectory() as td:
        mov = os.path.join(td, "subject.mov")
        geq = "geq=r=255:g=255:b=255:a='if(lt(hypot(X-(10+60*T)\\,Y-32)\\,12)\\,255\\,0)'"
        _ffmpeg("-f", "lavfi", "-i", f"color=c=white:s=96x64:r=10:d=1,format=rgba,{geq}", "-c:v", "qtrle", "-pix_fmt", "argb", mov)
        out = os.path.join(td, "matte")
        spec = alpha_frames.main([mov, out, "--prefix", "assets/matte"])
        assert spec == {"frames": "assets/matte/f_%04d.png", "fps": 10.0, "count": 10, "first": 1}
        for k in (0, 4, 9):
            im = np.asarray(Image.open(os.path.join(out, "f_%04d.png" % (k + 1))).convert("RGBA"))
            cx, cy = _circle_alpha(k)
            assert im[int(cy), int(round(cx)), 3] > 240, f"frame {k}: the circle centre is opaque"
            assert im[2, 2, 3] < 10 and im[62, 93, 3] < 10, f"frame {k}: the corners are transparent"
            assert (im[im[..., 3] > 240][:, :3] == 255).all(), "the colour is white, the matte lives in alpha"
            far = int(round(cx + 40)) if cx < 40 else int(round(cx - 40))
            assert im[int(cy), far, 3] < 10, f"frame {k}: well away from the circle is transparent"
        # the circle really moves: the matte of the last frame differs from the first
        a0 = np.asarray(Image.open(os.path.join(out, "f_0001.png")).convert("RGBA"))[..., 3]
        a9 = np.asarray(Image.open(os.path.join(out, "f_0010.png")).convert("RGBA"))[..., 3]
        assert np.abs(a0.astype(int) - a9.astype(int)).sum() > 255 * 200
        # --fps resamples, --scale shrinks, and a rerun with fewer frames removes the old ones
        spec2 = alpha_frames.main([mov, out, "--fps", "5", "--scale", "0.5"])
        assert spec2["count"] == 5 and spec2["fps"] == 5.0 and Image.open(os.path.join(out, "f_0001.png")).size == (48, 32)
        assert not os.path.exists(os.path.join(out, "f_0006.png"))


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg not on PATH")
def test_alpha_frames_luma_mode_reads_a_grey_matte_video_and_alpha_mode_refuses_one_without_alpha():
    with tempfile.TemporaryDirectory() as td:
        mp4 = os.path.join(td, "matte.mkv")
        _ffmpeg("-f", "lavfi", "-i", "color=c=black:s=96x64:r=10:d=0.5,format=gray,geq=lum='if(lt(hypot(X-48\\,Y-32)\\,16)\\,255\\,0)'", "-c:v", "ffv1", mp4)
        out = os.path.join(td, "m")
        spec = alpha_frames.main([mp4, out, "--mode", "luma"])
        assert spec["count"] == 5
        im = np.asarray(Image.open(os.path.join(out, "f_0001.png")).convert("RGBA"))
        assert im[32, 48, 3] > 240 and im[2, 2, 3] < 10, "white in the matte video = opaque, black = transparent"
        with pytest.raises(SystemExit) as e:
            alpha_frames.main([mp4, os.path.join(td, "x"), "--mode", "alpha"])
        assert "no alpha channel" in str(e.value) and "--mode luma" in str(e.value)


@pytest.mark.skipif(not _has_encoder("libvpx-vp9"), reason="ffmpeg without libvpx-vp9")
def test_alpha_frames_decodes_a_vp9_webm_alpha_with_libvpx():
    with tempfile.TemporaryDirectory() as td:
        webm = os.path.join(td, "subject.webm")
        geq = "geq=r=255:g=255:b=255:a='if(lt(hypot(X-48\\,Y-32)\\,14)\\,255\\,0)'"
        _ffmpeg("-f", "lavfi", "-i", f"color=c=white:s=96x64:r=10:d=0.5,format=rgba,{geq}", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", webm)
        out = os.path.join(td, "w")
        spec = alpha_frames.main([webm, out])
        im = np.asarray(Image.open(os.path.join(out, "f_0001.png")).convert("RGBA"))
        assert spec["count"] == 5 and im[32, 48, 3] > 230 and im[2, 2, 3] < 25, "the VP9 alpha plane survives (the native decoder would drop it)"
