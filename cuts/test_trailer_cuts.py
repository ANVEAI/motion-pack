#!/usr/bin/env python3
"""Tests for the trailer cut plan (cuts/trailer.py + patterns.json `trailer`, film lane 2026-10-16): the cut rate accelerates act by act, every cut sits on the
half-beat grid, no stub shot, braams on the pattern's downbeats, hit-silence-hit stays inside its range, and the JS mirror (templates/_shared/film/plan-film.mjs
montage) gives the same cuts. pytest, or: python3 cuts/test_trailer_cuts.py"""
import json
import os
import subprocess
import sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import trailer_plan as TR  # noqa: E402


def _acts(bars, fpb):
    acts, f = [], 0
    for name, b in zip(("act1", "act2", "act3"), bars):
        acts.append({"name": name, "start": f, "end": f + b * 4 * fpb})
        f += b * 4 * fpb
    return acts


def test_accelerates_on_the_grid():
    for fpb in (15, 18, 22, 21, 12):
        for bars in ((4, 6, 6), (2, 3, 3), (1, 1, 2), (8, 8, 8)):
            r = TR.plan(_acts(bars, fpb), 30, fpb)
            assert r["accelerates"], (fpb, bars, r["cuts_per_s"])
            hb = fpb * 0.5
            for a in r["acts"]:
                assert all(abs((c - a["start"]) - round((c - a["start"]) / hb) * hb) <= 0.5 for c in a["cuts"]), (fpb, bars, a["name"])   # on the half-beat grid (within half a frame)
                lens = [b - x for x, b in zip(a["cuts"], a["cuts"][1:] + [a["end"]])]
                assert min(lens) >= int(hb), (fpb, bars, a["name"], lens)                                    # no stub shorter than the grid step
            a2, a3 = r["acts"][1], r["acts"][2]
            assert len(a3["braams"]) == bars[2] and all((b - a3["start"]) % (4 * fpb) == 0 for b in a3["braams"])   # a braam on every act-3 bar


def test_act3_reaches_eighth_notes():
    r = TR.plan(_acts((4, 6, 6), 15), 30, 15)
    a3 = r["acts"][2]
    lens = [b - x for x, b in zip(a3["cuts"], a3["cuts"][1:] + [a3["end"]])]
    assert min(lens) in (7, 8) and lens[0] >= 30 and all(abs(x - 7.5) <= 0.5 for x in lens[-4:])                # 2 beats at the start, 8th notes (7.5 frames: 7 / 8) at the end


def test_hit_silence_hit():
    r = TR.hit_silence_hit(900, 30)
    assert r["hit_b"] - r["hit_a"] == 60 and r["black"] == [901, 960] and r["quiet"][0]["kind"] == "gap"
    for bad in (0.5, 3.5):
        try:
            TR.hit_silence_hit(900, 30, bad)
        except AssertionError:
            continue
        raise AssertionError("gap %s should be refused" % bad)


def test_patterns_block():
    P = json.load(open(os.path.join(HERE, "patterns.json")))["trailer"]
    assert set(P) >= {"accelerate3Act", "hitSilenceHit", "silenceBeforeHit", "cutdown30", "cutdown15"}


def test_js_mirror_agrees():
    root = os.path.dirname(HERE)
    cases = [(0, 360, 15, "act2"), (360, 720, 15, "act3"), (0, 528, 22, "act1"), (100, 600, 18, "act3")]
    code = "import('%s/templates/_shared/film/plan-film.mjs').then(m => console.log(JSON.stringify(%s.map(([a,b,f,n]) => m.montage(a,b,f,n)))))" % (root, json.dumps(cases))
    js = json.loads(subprocess.run(["node", "-e", code], capture_output=True, text=True, check=True).stdout)
    assert js == [TR.montage(a, b, 30, f, n) for a, b, f, n in cases]


if __name__ == "__main__":
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
