#!/usr/bin/env python3
"""Tests for the hardware launch family (recipes/hardware.py, xp-hardware 2026-10-16) and the hardware_launch bundle.
Measurement only, no listening: the library rules (peak -6 dBFS, quiet edges, determinism, seamless loop) plus shape checks that say the sound is the
thing its name promises (a sub hit is sub, a fan spin-up rises, a light sweep peaks where its anchor says, chimes ring on A).
pytest sfx/tests/test_hardware.py, or python3 sfx/tests/test_hardware.py."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from mpaudio import dsp, meter, registry  # noqa: E402
import recipes  # noqa: E402
SR = dsp.SR
IDS = ["snd.hw." + k for k in ("sub_hit", "sub_pulse", "chime_metal", "chime_reveal", "click_latch", "click_detent", "port_insert", "fan_spinup", "hum_loop",
                                "power_on", "power_off", "led_on", "parts_separate", "parts_seat", "light_sweep")]


def _r(sid, seed=None):
    recipes.load_all()
    return registry.render(sid, seed)


def _centroid(x):
    m = x.mean(axis=1) if x.ndim == 2 else x
    S = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    f = np.fft.rfftfreq(len(m), 1 / SR)
    return float((S * f).sum() / (S.sum() + 1e-12))


def _band_peak(x, lo, hi):
    m = x.mean(axis=1) if x.ndim == 2 else x
    S = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    f = np.fft.rfftfreq(len(m), 1 / SR)
    k = (f >= lo) & (f <= hi)
    return float(f[k][np.argmax(S[k])])


def test_all_registered_and_in_manifest():
    recipes.load_all()
    man = {d["id"]: d for d in json.load(open(os.path.join(HERE, "manifest.json")))["sounds"]}
    for sid in IDS:
        assert sid in registry.SOUNDS, sid
        assert sid in man, sid + " missing from sfx/manifest.json (run python3 sfx/build_library.py)"
        assert man[sid]["category"] == "hw"


def test_library_rules():
    for sid in IDS:
        y, a, s = _r(sid)
        assert np.isfinite(y).all(), sid
        assert -6.2 <= meter.sample_peak_db(y) <= -5.9, sid
        assert 0 <= a < len(y), sid
        if not s.loop:
            assert np.max(np.abs(y[:dsp.ms(0.5)])) < 10 ** (-60 / 20), sid + " starts with a click"
            assert np.max(np.abs(y[-dsp.ms(1):])) < 10 ** (-60 / 20), sid + " ends with a click"


def test_deterministic():
    for sid in IDS:
        y1, a1, _ = _r(sid)
        y2, a2, _ = _r(sid)
        assert a1 == a2 and np.array_equal(y1, y2), sid


def test_round_robin_differs():
    for sid in ("snd.hw.sub_pulse", "snd.hw.chime_metal", "snd.hw.click_detent", "snd.hw.port_insert"):
        s = registry.SOUNDS[sid]
        y1, _, _ = _r(sid, s.seed)
        y2, _, _ = _r(sid, s.seed + 1)
        n = min(len(y1), len(y2))
        assert not np.array_equal(y1[:n], y2[:n]), sid + " is tagged rr:4 but two seeds are identical"


def test_sub_hit_is_sub_and_peaks_on_anchor():
    y, a, _ = _r("snd.hw.sub_hit")
    assert _centroid(y) < 90, _centroid(y)
    assert 30 <= _band_peak(y, 20, 200) <= 60
    env = np.max(np.abs(y), axis=1)
    assert abs(int(np.argmax(env)) - a) <= dsp.ms(2)
    # a phone speaker still gets something: energy above 80 Hz (the second harmonic + whump) is within 20 dB of the total
    m = y.mean(axis=1)
    hi = dsp.hp(m, 80, 4)
    assert 20 * np.log10(np.std(hi) / np.std(m) + 1e-12) > -20


def test_chimes_ring_on_A():
    y, a, _ = _r("snd.hw.chime_metal")
    assert abs(_band_peak(y[a:], 600, 1200) - 880) < 12
    y, a, _ = _r("snd.hw.chime_reveal")
    assert abs(_band_peak(y[a:], 600, 1000) - 880) < 12 and abs(_band_peak(y[a:], 1200, 1500) - 1318.5) < 15
    assert a < dsp.ms(20), "chime_reveal anchor must be the FIRST strike"


def test_fan_spinup_rises():
    y, a, _ = _r("snd.hw.fan_spinup")
    m = y.mean(axis=1)
    w = dsp.ms(200)
    early, late = m[dsp.ms(100):dsp.ms(100) + w], m[dsp.ms(1700):dsp.ms(1700) + w]
    assert _centroid(late) > _centroid(early) * 1.3
    assert np.std(late) > np.std(early) * 2.0
    assert a < dsp.ms(10)


def test_hum_loop_seamless_and_on_A():
    y, _, s = _r("snd.hw.hum_loop")
    assert s.loop and len(y) == dsp.sec(4.0)
    m = y.mean(axis=1)
    step = abs(m[0] - m[-1])
    assert step <= 1.5 * np.max(np.abs(np.diff(m)))
    assert abs(_band_peak(y, 40, 150) - 55) < 3 or abs(_band_peak(y, 40, 150) - 110) < 3


def test_light_sweep_anchor_is_its_peak():
    y, a, _ = _r("snd.hw.light_sweep")
    h = dsp.ms(20)
    e = np.sqrt(np.convolve(y.mean(axis=1) ** 2, np.ones(h) / h, "same"))
    assert abs(int(np.argmax(e)) - a) < dsp.ms(60)
    assert 0.7 < a / SR < 1.1


def test_power_on_anchor_after_sweep():
    y, a, _ = _r("snd.hw.power_on")
    assert 0.40 < a / SR < 0.52, a / SR      # the chord crest lands after the 0.45 s sweep
    assert abs(_band_peak(y[a:a + dsp.sec(0.5)], 400, 480) - 440) < 8


def test_bundle():
    b = json.load(open(os.path.join(HERE, "bundles.json")))["hardware_launch"]
    recipes.load_all()
    for role, sid in b["roles"].items():
        assert sid in registry.SOUNDS, (role, sid)
    assert b["roles"]["reveal_hit"] == "snd.hw.sub_hit"


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
