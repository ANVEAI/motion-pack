#!/usr/bin/env python3
"""Primitive + contract tests (plain asserts; run: python3 sfx/tests/test_primitives.py). Measurement only, no listening."""
import os
import subprocess
import sys
import tempfile
import numpy as np
import soundfile as sf
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "music"))
from mpaudio import dsp, meter, registry  # noqa: E402
import recipes  # noqa: E402
SR = dsp.SR


def test_svf_lowpass_minus3db():
    t = np.arange(SR) / SR
    x = np.sin(2 * np.pi * 1000 * t)
    y = dsp.svf(x, 1000.0, 0.7071, "lp")
    g = 20 * np.log10(np.sqrt(np.mean(y[SR // 2:] ** 2)) / np.sqrt(np.mean(x[SR // 2:] ** 2)))
    assert abs(g + 3.0) < 0.35, g


def test_noise_colours():
    for col, slope in (("pink", 0.0), ("brown", -3.0)):                   # power PER OCTAVE: flat for pink (1/f PSD), -3 dB/oct for brown (1/f^2 PSD)
        x = dsp.noise(SR * 8, 5, col)
        X = np.abs(np.fft.rfft(x)) ** 2
        f = np.fft.rfftfreq(len(x), 1 / SR)
        pa = X[(f > 200) & (f < 400)].sum()
        pb = X[(f > 3200) & (f < 6400)].sum()
        measured = 10 * np.log10(pb / pa) / 4.0
        assert abs(measured - slope) < 0.8, (col, measured)


def test_ks_pitch():
    f0 = 440.0
    y = dsp.ks(f0, SR, 3, g=0.9995)
    seg = y[2000:2000 + 32768]
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    k = int(np.argmax(X))
    est = np.fft.rfftfreq(len(seg), 1 / SR)[k]
    assert abs(1200 * np.log2(est / f0)) < 8, est


def test_meter_vs_ffmpeg():
    t = np.arange(SR * 4) / SR
    x = np.stack([np.sin(2 * np.pi * 997 * t) * 10 ** (-20 / 20)] * 2, 1)
    assert abs(meter.lufs_integrated(x) + 20.0) < 0.15, meter.lufs_integrated(x)
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "a.wav")
        sf.write(p, x, SR, subtype="PCM_24")
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", p, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
        import re
        I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", r.stderr).group(1))
    assert abs(I - meter.lufs_integrated(x)) < 0.1, (I, meter.lufs_integrated(x))


def test_limiter_ceiling():
    import mixer
    r = np.random.default_rng(1)
    x = r.normal(0, 0.4, (SR * 2, 2))
    x[10000:10100] *= 6
    y, g = mixer.limiter(x, -1.5)
    assert meter.true_peak_db(y) <= -1.5 + 0.1, meter.true_peak_db(y)
    y2, G, _ = mixer.master(x * 0.3, -14.0, -1.5)
    assert abs(meter.lufs_integrated(y2) + 14.0) < 0.1


def test_determinism_and_trim():
    recipes.load_all()
    for sid in ("snd.whoosh.whoosh_m", "snd.hit.cinema", "snd.voice.mumble", "snd.liquid.pour", "snd.amb.rain"):
        a = registry.render(sid)[0]
        b = registry.render(sid)[0]
        assert registry.sha(a) == registry.sha(b), sid
        assert abs(meter.sample_peak_db(a) + 6.0) < 0.05
        assert np.isfinite(a).all()


def test_anchor_contract():
    """a cue on visual frame F puts its anchor sample on (F + 1) x 1600 (30 fps); risers end one frame before the hit anchor"""
    import mixer
    m = mixer.Mix(30, 6.0)
    for sid, F in (("snd.hit.thud", 30), ("snd.whoosh.whoosh_m", 75), ("snd.ui.pop", 120), ("snd.hit.punch", 149)):
        m.add_cue(sid, F)
    out = m._render_sfx()
    for c in m.cues:
        a = m._cue_signal(c)
        win = np.zeros_like(out)
        dsp.add_at(win, a, c["pos"] - c["anchor"], 1.0)
        pk = int(np.argmax(np.max(np.abs(win), axis=1)))
        assert pk == (c["frame"] + 1) * 1600, (c["id"], pk, (c["frame"] + 1) * 1600)
    m2 = mixer.Mix(30, 6.0)
    m2.add_cue("snd.riser.noise_1bar", 100)
    c = m2.cues[0]
    assert c["pos"] == 100 * 1600           # riser anchor (its END) = one frame before the hit anchor at (100 + 1) x 1600


def test_tempo_snap_and_cuts():
    import grid
    assert grid.snap_bpm(120, 30) == (120.0, 15)
    b, n = grid.snap_bpm(128, 30)
    assert n == 14 and abs(b - 128.5714) < 1e-3
    cm = grid.cut_map(120, 30, 4, "steady_beat")
    assert cm["frames"][:5] == [0, 15, 30, 45, 60] and len(cm["frames"]) == 16
    cm = grid.cut_map(128, 30, 2, "bar_hold")
    assert cm["frames"] == [0, 56]


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
