#!/usr/bin/env python3
"""Tests for the trailer-arc bed (music/trailer.py, gap music/bed_trailer_arc), plain asserts (pytest, or: python3 music/tests/test_trailer.py):
markers on whole frames at any fps, deterministic render, the length rule, the planned shape measured on the master (gap, crescendo, hard stop, quiet hold,
digital-zero tail), and that ears finds the planned gap and the crescendo at the marker times (+/- 2 frames) and reads the gap and hold as intended only when marked."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))              # the repository root, for ears
import _path  # noqa: F401, E402
from mpaudio import dsp  # noqa: E402
import mixer  # noqa: E402
import trailer as TR  # noqa: E402
from presets import TRAILERS  # noqa: E402
SR = dsp.SR
SHORT = (2, 2, 2)                                       # whole bars in each act: a 24 s trailer renders in about a second


def _master(fps=30, act_bars=SHORT, seed=1):
    r = TR.render_trailer("trailer_arc", fps, seed, act_bars)
    y, _, _ = mixer.master(r["mix"], -16.0, -1.5)
    return r, TR.finish(y, fps)


def test_markers_are_whole_frames_at_any_fps():
    p = TRAILERS["trailer_arc"]
    for fps in (24, 25, 30, 60):
        mk = TR.markers("trailer_arc", fps)
        fpb = mk["frames_per_beat"]
        assert isinstance(fpb, int) and fpb >= 1
        for k, b in mk["beats"].items():
            assert mk["frames"][k] == b * fpb and isinstance(mk["frames"][k], int), (fps, k)           # a whole number of beats is a whole number of frames
        F = mk["frames"]
        assert F["act1_start"] == 0 and F["act1_start"] < F["act2_start"] < F["act3_start"] < F["gap_start"] < F["gap_end"] == F["crescendo_start"] < F["hit"] < F["quiet_hold_start"] < F["end"]
        assert F["visual_cut_frame"] == F["hit"] - 1                                                  # house rule R1: the hit lands one frame after the picture cut
        assert (F["gap_end"] - F["gap_start"]) == p["gap_beats"] * fpb and (F["hit"] - F["crescendo_start"]) == 4 * p["cresc_bars"] * fpb


def test_deterministic_and_seeded():
    a, b = TR.render_trailer("trailer_arc", 30, 1, (1, 1, 1)), TR.render_trailer("trailer_arc", 30, 1, (1, 1, 1))
    assert np.array_equal(a["mix"], b["mix"])
    assert not np.array_equal(a["mix"], TR.render_trailer("trailer_arc", 30, 2, (1, 1, 1))["mix"])
    assert sorted(a["stems"]) == sorted(TR.STEMS) and a["meta"]["loop"] is False


def test_length_rule_changes_only_the_acts():
    a, b = TR.markers("trailer_arc", 30, (1, 1, 1)), TR.markers("trailer_arc", 30, (3, 2, 4))
    bar = 4 * a["frames_per_beat"]
    assert b["frames"]["gap_start"] - a["frames"]["gap_start"] == (3 + 2 + 4 - 3) * bar              # whole bars, all before the gap
    for k in ("gap_end", "crescendo_start", "hit", "quiet_hold_start", "end"):
        assert b["frames"][k] - b["frames"]["gap_start"] == a["frames"][k] - a["frames"]["gap_start"], k   # the gap, crescendo, hit and hold keep their lengths
    for bad in ((0, 1, 1), (1, 1), (1.5, 1, 1)):
        try:
            TR.markers("trailer_arc", 30, bad)
        except AssertionError:
            continue
        raise AssertionError("act_bars %r should be rejected" % (bad,))


def test_planned_shape_on_the_master():
    r, y = _master()
    mk, spf = r["markers"]["frames"], SR // 30
    assert len(y) == mk["end"] * spf
    lv = lambda a, b: 10 * np.log10(np.mean(y[a * spf:b * spf] ** 2) + 1e-20)
    beat = r["meta"]["frames_per_beat"]
    wall, gap = lv(mk["act3_start"], mk["gap_start"]), lv(mk["gap_start"], mk["gap_end"])
    assert wall - gap >= 30.0, (wall, gap)                                                             # a planned valley, not a dip
    assert lv(mk["hit"] - beat, mk["hit"]) - lv(mk["crescendo_start"], mk["crescendo_start"] + beat) >= 12.0     # the crescendo climbs into the hit
    assert lv(mk["hit"], mk["hit"] + beat) - lv(mk["quiet_hold_start"], mk["end"]) >= 40.0              # the hit rings out into a quiet hold
    assert lv(mk["act1_start"], mk["act2_start"]) < lv(mk["act2_start"], mk["act3_start"]) < wall      # the acts rise
    assert np.max(np.abs(y[-int(0.15 * SR):])) == 0.0                                                  # the last 0.15 s is digital zero
    hit = mk["hit"] * spf                                                                              # hard stop: nothing but the hit's own layer continues
    pre, post = np.sqrt(np.mean(y[hit - dsp.ms(20):hit] ** 2)), np.sqrt(np.mean(y[hit:hit + dsp.ms(20)] ** 2))
    assert post > 0.5 * pre                                                                            # the hit is there on the marker sample
    onsets = [e for e in r["events"] if e["kind"] == "hit"]
    assert len(onsets) == 1 and onsets[0]["sample"] == hit


def test_bed_in_the_library_matches_its_sidecar():
    """The committed manifest row must match the code's markers; the sidecar and WAV (music/library/ is gitignored, so absent on a clean checkout,
    present after build_music.py) are checked too when they exist."""
    man = json.load(open(os.path.join(HERE, "manifest.json")))["items"]
    it = {i["id"]: i for i in man}["music.bed_trailer_arc"]
    mk = TR.markers("trailer_arc", it["fps"])
    assert it["loop"] is False and "non-loop" in it["tags"] and it["sidecar"].endswith("bed_trailer_arc.json")
    assert it["markers"] == mk["frames"] and it["act_bars"] == list(mk["act_bars"])                    # the manifest is what the code computes
    assert it["markers"]["visual_cut_frame"] == it["markers"]["hit"] - 1 and "never loop" in it["length_rule"]
    path = os.path.join(HERE, it["sidecar"])
    if not os.path.exists(path):
        return                                                                                          # clean checkout: the library is built locally, not in CI
    side = json.load(open(path))
    assert side["loop"] is False
    assert side["markers"] == it["markers"] and side["hit_frame"] == it["markers"]["hit"]
    assert side["markers"]["visual_cut_frame"] == side["markers"]["hit"] - 1
    assert "never loop" in side["length_rule"] and set(side["marker_doc"]) >= set(side["markers"])


def test_ears_finds_the_gap_and_the_crescendo_at_the_markers_and_reads_planned_quiet_as_shape():
    from ears.listen import analyze
    r, y = _master()
    mk, fps = r["markers"], 30
    s = r["markers"]["seconds"]
    st = np.stack([y, y], 1) if y.ndim == 1 else y
    tol = 2.0 / fps + 0.5 / fps + 1e-6                                                                  # +/- 2 frames, plus ears' own half-frame rounding
    bare = analyze(st, fps=fps)
    chk = next(c for c in bare["checks"] if c["id"] == "ears/structure")
    rows = chk["measured"]["quiet"]
    gap = next(q for q in rows if q["t"][0] < s["gap_end"] and q["t"][1] > s["gap_start"])
    assert abs(gap["t"][0] - s["gap_start"]) <= tol and abs(gap["t"][1] - s["gap_end"]) <= tol, (gap, s)  # the valley is found at the marker times
    assert not gap["planned"] and any("dead air" in i["what"] for i in chk["issues"])                   # unmarked, it warns
    sec = [x for x in chk["measured"]["sections"] if x["label"] == "drop"]
    assert sec and abs(sec[0]["t"][0] - s["crescendo_start"]) <= tol, (sec, s)                          # the crescendo is the biggest step, at its marker
    plan = {"fps": fps, "audio": {"role": "trailer", "quiet": [
        {"t": [s["gap_start"], s["gap_end"]], "kind": "gap", "why": "planned valley before the crescendo"},
        {"t": [s["quiet_hold_start"], s["end"]], "kind": "hold", "why": "quiet hold under the end card"}]}}
    ok = analyze(st, fps=fps, plan=plan)
    chk = next(c for c in ok["checks"] if c["id"] == "ears/structure")
    assert chk["status"] == "pass" and not any("dead air" in i["what"] for i in chk["issues"]), [i["what"] for i in chk["issues"]]
    assert all(q["planned"] for q in chk["measured"]["quiet"] if q["length_s"] >= 2.0)
    assert chk["measured"]["end_shape"] == "quiet hold"
    cmp_ = next(c for c in ok["checks"] if c["id"] == "ears/compare")
    assert cmp_["status"] == "info" and "trailer bed" in " ".join(cmp_["notes"])


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
