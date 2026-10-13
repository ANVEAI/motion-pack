#!/usr/bin/env python3
"""Tests for the 2026-10-13 audio expansion (plain asserts; run: python3 music/tests/test_expansion.py):
mixer stereo loop tiling fix, just intonation, tempo ramp grid, thekas on whole frames + seamless, new presets deterministic, sitar logo anchor, sweetener coverage."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import _path  # noqa: F401
from mpaudio import dsp, indian as IN, sweeteners as SW  # noqa: E402
import compose as C  # noqa: E402
import grid  # noqa: E402
import mixer  # noqa: E402
import theka  # noqa: E402
import logo  # noqa: E402
SR = dsp.SR


def test_add_bed_loop_stereo_tiles_along_time():
    t = np.arange(SR) / SR
    bed = np.stack([np.sin(2 * np.pi * 220 * t), np.sin(2 * np.pi * 330 * t)], 1) * 0.1      # 1.0 s stereo bed, distinct channels
    m = mixer.Mix(fps=30, length_s=3.5)
    m.add_bed(bed, loop=True)
    assert m.bed.shape == (int(3.5 * SR), 2)
    assert np.allclose(m.bed[SR:2 * SR], bed) and np.allclose(m.bed[3 * SR:], bed[:len(m.bed) - 3 * SR])
    assert not np.allclose(m.bed[:, 0], m.bed[:, 1])                                            # channels not mixed up
    m2 = mixer.Mix(fps=30, length_s=2.5)
    m2.add_bed(bed[:, 0], loop=True)                                                            # mono bed is accepted too
    assert np.allclose(m2.bed[:, 0], m2.bed[:, 1])
    assert mixer.tile_rows(bed, 3 * SR).shape == (3 * SR, 2)


def test_just_intonation():
    assert abs(IN.ji_hz(220.0, 7) - 330.0) < 1e-9 and abs(IN.ji_hz(220.0, 4) - 275.0) < 1e-9 and abs(IN.ji_hz(220.0, 12) - 440.0) < 1e-9
    assert abs(IN.ji_hz(220.0, -5) - 165.0) < 1e-9 and abs(IN.ji_hz(220.0, -7) - 220.0 * 2 / 3) < 1e-9   # mandra Pa (3/4), mandra Ma (2/3)
    pc = C.Piece("indian_fusion", "loop_8", 1, 30, loop=True)
    assert pc.tuning == "ji" and abs(pc.hz(pc.root + 7) / pc.hz(pc.root) - 1.5) < 1e-12
    pe = C.Piece("tech_pulse", "loop_8", 1, 30, loop=True)
    assert abs(pe.hz(69) - 440.0) < 1e-9


def test_tempo_ramp_frame_exact():
    rm = grid.tempo_ramp_map(100, 128, 30, 16)
    assert rm["bar_frames_per_beat"][0] == 18 and rm["bar_frames_per_beat"][-1] == 14
    assert all(isinstance(f, int) for f in rm["beat_frames"]) and rm["beat_frames"] == sorted(rm["beat_frames"])
    assert all(a >= b for a, b in zip(rm["bar_frames_per_beat"], rm["bar_frames_per_beat"][1:]))
    r = C.compose("anthem_ramp", "anthem_ramp_16", 2, 30)
    tr = r["meta"]["tempo_ramp"]
    assert tr["bar_frames"] == rm["bar_frames"] and r["meta"]["length_frames"] == rm["end_frame"]
    kicks = [e for e in r["events"] if e["kind"] in ("kick", "kick_soft")]
    assert kicks and all(abs(e["frame"] - round(e["frame"])) < 0.01 for e in kicks)


def test_theka_on_whole_frames_and_seamless():
    for name, cyc in (("teental", 2), ("keherwa", 4), ("dadra", 6)):
        r = theka.render_theka(name, 30, cyc, 3)
        fpb = r["meta"]["frames_per_beat"]
        assert r["meta"]["length_frames"] == fpb * len(theka.THEKAS[name]["bols"]) * cyc
        assert len(r["mix"]) == r["meta"]["length_frames"] * SR // 30
        assert sum(e["sam"] for e in r["events"]) == cyc
        m = r["mix"].mean(axis=1)
        assert abs(m[0] - m[-1]) / (np.max(np.abs(np.diff(m))) + 1e-9) < 1.5, name
        r2 = theka.render_theka(name, 30, cyc, 3)
        assert np.array_equal(r["mix"], r2["mix"])


def test_new_presets_deterministic_and_finite():
    for p in ("indian_fusion", "raga_calm", "lofi_jazz", "chiptune_8bit", "jazz_walk", "orchestral_synth_epic"):
        a = C.compose(p, "loop_8", 4, 30)
        b = C.compose(p, "loop_8", 4, 30)
        assert np.array_equal(a["mix"], b["mix"]) and np.isfinite(a["mix"]).all(), p
        assert abs(a["meta"]["bpm"] * a["meta"]["frames_per_beat"] / (30 * 60) - 1) < 1e-4            # one beat = whole frames


def test_sitar_logo_anchor():
    y, a, info = logo.render_logo_sitar(name="Orbit", seed=3)
    assert info["timbre"] == "sitar" and 0 < a < len(y)
    env = np.max(np.abs(y[a:a + dsp.ms(30)]), axis=1).max()
    pre = np.max(np.abs(y[a - dsp.ms(30):a - dsp.ms(5)]), axis=1).max()
    assert env > pre                                                                           # the landing note is an onset


def test_every_transition_kind_has_a_sweetener():
    cat = json.load(open(os.path.join(os.path.dirname(HERE), "transitions", "catalog.json")))
    kinds = {t["id"].split(".", 1)[1] for t in cat["transitions"] if t["id"].startswith("tx.")}
    missing = sorted(k for k in kinds if not SW.sweeten(k, 100, 8, 0.5))          # TABLE row, or the catalog fallback for kinds added on the visual side
    assert all(SW.TABLE.get(k) for k in ("shutter", "swipeUp", "spin", "pagePeel", "pixelSort", "dip"))   # the 5 formerly pending pairings (+ dip) are explicit rows
    assert not missing, missing
    assert all(c["frame"] == 100 + 4 for c in SW.sweeten("pagePeel", 100, 8)[:1])


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
