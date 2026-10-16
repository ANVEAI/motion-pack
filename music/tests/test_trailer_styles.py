#!/usr/bin/env python3
"""Tests for the genre trailer scores (music/trailer_styles.py, film lane 2026-10-16), plain asserts (pytest, or: python3 music/tests/test_trailer_styles.py):
every marker a whole frame at any fps, the JS mirror (templates/_shared/film/plan-film.mjs scoreMarkers) agrees with Python, deterministic and seeded, and the planned
shape measured on the mix: the wall stops dead into the gap (horror: digital silence), the title hit is the loudest onset after it, the button is near-silent, the
tail carries a final hit, the last 0.15 s is digital zero."""
import json
import os
import subprocess
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import _path  # noqa: F401, E402
from mpaudio import dsp  # noqa: E402
import trailer_styles as TS  # noqa: E402
from presets import TRAILERS  # noqa: E402
SR = dsp.SR
SHORT = (1, 1, 2)


def _db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.asarray(x, float) ** 2)) + 1e-12)


def test_markers_whole_frames_and_order():
    for st in TS.STYLES:
        for fps in (24, 25, 30, 60):
            mk = TS.styled_markers(st, fps)
            F, fpb = mk["frames"], mk["frames_per_beat"]
            for k, b in mk["beats"].items():
                assert F[k] == b * fpb, (st, fps, k)
            assert 0 == F["act1_start"] < F["act2_start"] < F["act3_start"] < F["gap_start"] < F["gap_end"] <= F["hit"] < F["button_start"] <= F["tail_start"] < F["final_hit"] < F["end"]
            assert F["visual_cut_frame"] == F["hit"] - 1


def test_js_mirror_agrees():
    code = ("import('%s/templates/_shared/film/plan-film.mjs').then(m => console.log(JSON.stringify(%s)))" %
            (ROOT, "['thriller','scifi','horror','drama'].flatMap(s => [[3,2,4],[1,1,1]].map(a => m.scoreMarkers(s, 30, a, 6, 10).frames))"))
    js = json.loads(subprocess.run(["node", "-e", code], capture_output=True, text=True, check=True).stdout)
    py = [TS.styled_markers(s, 30, a, 6, 10)["frames"] for s in TS.STYLES for a in ((3, 2, 4), (1, 1, 1))]
    assert js == py


def test_presets_carry_the_style_keys():
    for st in TS.STYLES:
        p = TRAILERS["trailer_" + st]
        for k in ("bpm", "gap_beats", "cresc_bars", "ring_beats", "button_beats", "tail_beats", "final_hit_beat", "gap_below_wall_db", "prog_act2", "prog_act3"):
            assert k in p, (st, k)


def test_deterministic_and_seeded():
    a, b = TS.render_styled("thriller", 30, 1, SHORT, 4, 6), TS.render_styled("thriller", 30, 1, SHORT, 4, 6)
    assert np.array_equal(a["mix"], b["mix"])
    assert not np.array_equal(a["mix"], TS.render_styled("thriller", 30, 2, SHORT, 4, 6)["mix"])


def test_shape_on_the_mix():
    for st in TS.STYLES:
        r = TS.render_styled(st, 30, 1, SHORT, 6, 8)
        y = TS.finish(r["mix"], 30)
        S = {k: int(round(v * SR / 30)) for k, v in r["markers"]["frames"].items()}
        wall = _db(y[S["act3_start"]:S["gap_start"]])
        gap = y[S["gap_start"] + dsp.ms(60):S["crescendo_start"]]
        if TRAILERS["trailer_" + st]["gap_below_wall_db"] >= 90:
            assert np.max(np.abs(gap)) == 0.0, st                                          # horror: digital silence
        else:
            assert _db(gap) < wall - 30, (st, _db(gap), wall)
        hit = _db(y[S["hit"]:S["hit"] + dsp.ms(300)])
        assert hit > wall - 6, (st, hit, wall)                                              # the title hit lands as hard as the wall
        assert _db(y[S["hit"] - dsp.ms(30):S["hit"] - dsp.ms(3)]) < hit - 20 or S["crescendo_start"] < S["hit"], st   # out of the silence (no crescendo) it is a cliff
        assert _db(y[S["button_start"] + dsp.ms(1500):S["tail_start"]]) < hit - 35, st       # the button: the hit has rung out
        assert _db(y[S["final_hit"]:S["final_hit"] + dsp.ms(300)]) > _db(y[S["tail_start"]:S["final_hit"]]) + 3, st   # the release-card hit
        assert np.max(np.abs(y[-dsp.ms(150):])) == 0.0, st


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
