#!/usr/bin/env python3
"""music/reveal.py (xp-hardware): the dark -> reveal score composed per cut. Measurement only: markers on whole frames, the drop on the reveal bar, one drop,
the dark open well under the drop, deterministic, the tail is digital zero, refuses fractional bars. pytest music/tests/test_reveal.py"""
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import reveal as RV  # noqa: E402
from mpaudio import meter  # noqa: E402
from mpaudio.dsp import SR  # noqa: E402

SECS = [{"name": "dark", "bars": 2, "energy": 0.08}, {"name": "sweep", "bars": 1, "energy": [0.25, 0.5]}, {"name": "reveal", "bars": 2, "energy": 1.0}, {"name": "tail", "bars": 1, "energy": 0.3}]


def _r():
    return RV.render_reveal(SECS, fps=30, bpm=120, seed=3, tail_s=1.0)


def test_markers_whole_frames_and_one_drop_on_reveal():
    M = RV.markers(SECS, 30, 120)
    assert M["frames_per_beat"] == 15 and M["frames_per_bar"] == 60
    assert [s["frame0"] for s in M["sections"]] == [0, 120, 180, 300]
    assert [d["section"] for d in M["drops"]] == ["reveal"] and M["drops"][0]["frame"] == 180


def test_dark_open_sits_well_under_the_drop_and_tail_is_zero():
    r = _r()
    y = r["mix"]
    dark, drop = y[: 3 * SR], y[6 * SR: 8 * SR]
    assert meter.lufs_integrated(drop) - meter.lufs_integrated(dark) >= 8.0
    assert np.max(np.abs(y[-int(0.15 * SR):])) == 0.0
    assert abs(len(y) / SR - (12.0 + 1.0)) < 1e-3
    assert meter.true_peak_db(y) <= -1.4


def test_deterministic():
    a, b = _r()["mix"], _r()["mix"]
    assert np.array_equal(a, b)


def test_refuses_fractional_bars():
    try:
        RV.structure([{"name": "x", "bars": 1.5, "energy": 0.5}])
    except ValueError:
        return
    raise AssertionError("fractional bars accepted")


def test_preset_not_left_in_presets():
    _r()
    from presets import PRESETS
    assert "hw_reveal" not in PRESETS, "the score preset must not leak into the library presets (build_music would make a loop bed of it)"


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
