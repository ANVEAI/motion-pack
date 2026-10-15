#!/usr/bin/env python3
"""Tests for the trailer family (recipes/trailer.py, film lane 2026-10-16): measurement only, no listening (pytest, or: python3 sfx/tests/test_trailer.py).
The sfx QA rules on every sound (peak -6 dBFS, finite, DC, silent edges for one-shots, loop seams), and the shapes the trailer template relies on:
risers are exactly N bars at 120 BPM with the anchor on the last sample, reverse swells end on their anchor, the braam's fundamental is A1, the hit-silence-hit
file has its silence and its second hit 2.0 s after the anchor, the clock loop ticks on every beat at 120 BPM, the heartbeat loop beats 5 times in 4 s, the bundle resolves."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from mpaudio import dsp, meter, registry  # noqa: E402
import recipes  # noqa: E402
SR = dsp.SR
recipes.load_all()
IDS = sorted(k for k in registry.SOUNDS if k.startswith("snd.trailer."))


def _r(sid, seed=None):
    return registry.render(sid, seed)


def _onsets(m, hop=dsp.ms(5), rise_db=12.0, floor_db=-50.0):
    e = np.array([np.max(np.abs(m[i:i + hop])) for i in range(0, len(m) - hop, hop)])
    d = 20 * np.log10(e + 1e-9)
    on = np.nonzero((d[1:] - d[:-1] >= rise_db) & (d[1:] > floor_db))[0] + 1
    keep = []
    for i in on:
        if not keep or i - keep[-1] > 8:
            keep.append(int(i))
    return [k * hop / SR for k in keep]


def test_family_size_and_qa_rules():
    assert len(IDS) >= 27, IDS
    for sid in IDS:
        y, a, s = _r(sid)
        assert np.isfinite(y).all(), sid
        assert -6.2 <= meter.sample_peak_db(y) <= -5.9, (sid, meter.sample_peak_db(y))
        assert 0 <= a < len(y), sid
        dc = float(np.max(np.abs(y.mean(axis=0))))
        assert dc / (np.max(np.abs(y)) + 1e-9) < (1e-3 if len(y) >= SR // 2 else 0.01), (sid, dc)
        if s.loop:
            m = y.astype(float).mean(axis=1)
            assert abs(m[0] - m[-1]) / (np.max(np.abs(np.diff(m))) + 1e-9) <= 1.5, sid       # the seam: no step at the wrap
        else:
            assert np.max(np.abs(y[:dsp.ms(0.5)])) < dsp.db(-60) and np.max(np.abs(y[-dsp.ms(1):])) < dsp.db(-60), sid   # silent edges


def test_deterministic():
    for sid in IDS:
        a, b = _r(sid)[0], _r(sid)[0]
        assert np.array_equal(a, b), sid


def test_risers_are_whole_bars_and_end_on_the_anchor():
    for secs in (2, 4, 8, 12):
        y, a, _ = _r("snd.trailer.riser_%ds" % secs)
        assert abs(len(y) / SR - secs) < 0.06, (secs, len(y) / SR)
        assert len(y) - 1 - a <= dsp.ms(45), (secs, len(y) - a)                             # the anchor is the end (the finish fade is at most 40 ms after it)
        m = np.abs(y.mean(axis=1))
        assert m[-SR // 4:].mean() > 4 * m[:SR // 4].mean(), secs                             # it rises


def test_reverse_swells_end_on_their_anchor():
    for secs in (1, 2, 4):
        y, a, _ = _r("snd.trailer.reverse_swell_%ds" % secs)
        assert abs(a / SR - secs) < 0.05 and len(y) - a <= dsp.ms(45), (secs, a / SR, len(y))
        m = np.abs(y.mean(axis=1))
        assert m[a - dsp.ms(50):a].mean() > 3 * m[:dsp.ms(200)].mean(), secs
    y, a, _ = _r("snd.trailer.reverse_braam")
    assert len(y) - a <= dsp.ms(45)


def test_braam_is_on_A1():
    y, a, _ = _r("snd.trailer.braam_low")
    m = y[a:a + SR].mean(axis=1)
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    f = np.fft.rfftfreq(len(m), 1 / SR)
    lo = (f > 40) & (f < 70)
    assert abs(f[lo][np.argmax(sp[lo])] - 55.0) < 2.0


def test_hit_silence_hit_shape():
    y, a, _ = _r("snd.trailer.hit_silence_hit")
    m = np.abs(y.mean(axis=1))
    rms = lambda s0, s1: np.sqrt(np.mean(m[int(s0 * SR) + a:int(s1 * SR) + a] ** 2))
    assert 20 * np.log10(rms(1.3, 1.9) / rms(0.0, 0.3)) < -35                               # the silence
    assert 20 * np.log10(rms(2.0, 2.3) / rms(0.0, 0.3)) > -8                                # the second hit, 2.0 s after the anchor
    ons = _onsets(y.mean(axis=1))
    assert any(abs(o - (a / SR + 2.0)) < 0.03 for o in ons), ons


def test_clock_and_heart_loops():
    y, _, _ = _r("snd.trailer.clock_tick_loop")
    m = y.mean(axis=1)
    ons = [o - 4.0 for o in _onsets(np.concatenate([m, m]), rise_db=10.0, floor_db=-40.0) if o >= 3.99]   # the second copy: the tick on 0 is seen across the wrap
    assert len(ons) == 8 and np.allclose(np.diff(ons), 0.5, atol=0.012) and ons[0] < 0.02, ons             # every beat at 120 BPM, the first on 0
    y, _, _ = _r("snd.trailer.heartbeat_loop")
    m = y.mean(axis=1)
    hop = dsp.ms(10)
    e = np.array([np.sqrt(np.mean(m[i:i + hop] ** 2)) for i in range(0, len(m) - hop, hop)])
    pk = [i for i in range(1, len(e) - 1) if e[i] > e[i - 1] and e[i] >= e[i + 1] and e[i] > 0.5 * e.max()]
    lub = pk[0::2]
    assert len(pk) == 10 and np.allclose(np.diff(lub) * 0.01, 0.8, atol=0.02) and all(abs((b - a) * 0.01 - 0.22) < 0.03 for a, b in zip(pk[0::2], pk[1::2])), pk   # 5 lub-dubs per 4 s (75 BPM), the dub 0.22 s after


def test_bundle_resolves():
    b = json.load(open(os.path.join(HERE, "bundles.json")))["trailer"]
    for role, sid in b["roles"].items():
        assert sid in registry.SOUNDS, (role, sid)


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
