#!/usr/bin/env python3
"""The README's worked example (examples/brewly-teaser) must build from a clean clone: copy its template/ into templates/, run `node make.mjs`, get a plan, a mix and an index.html.
This is the documented reproduction, step for step, up to (not including) the HyperFrames render: no browser, no GPU, nothing gitignored beyond the one music bed it builds itself.
It failed before 2026-10-15: brewly passes `media: []`, so assets/media never existed and audio.py died on the mix.wav write. Run: python3 -m pytest -q tools/tests/test_worked_example.py"""
import json
import os
import subprocess
import tempfile

from mp_build import NODE, REPO


def _assert_built(d, r, label):
    assert r.returncode == 0, f"{label}: node make.mjs exit {r.returncode}\n{r.stdout[-1200:]}\n{r.stderr[-1200:]}"
    assert "todo: none" in r.stdout, f"{label}: a transition, type, layer or sound id did not resolve\n{r.stdout[-800:]}"
    plan = json.load(open(os.path.join(d, "out", "plan.json")))
    assert plan["shots"] and plan["cues"] and plan["lint"]["claimsWithoutSource"] == [] and plan["lint"]["unmotivatedTransitions"] == []
    mix = os.path.join(d, "assets", "media", "mix.wav")
    assert os.path.getsize(mix) > 100_000, "the mix is missing or empty"
    rep = json.load(open(mix + ".json"))
    assert abs(rep["lufs_i"] - (-14.0)) <= 0.5 and rep["true_peak_dbtp"] <= -1.0, rep
    html = open(os.path.join(d, "index.html")).read()
    assert 'src="assets/media/mix.wav"' in html and "Brewly" in html


def test_documented_reproduction_9x16(brewly, make):
    _assert_built(brewly, make(brewly), "node make.mjs")


def test_documented_reproduction_16x9(brewly, make):
    _assert_built(brewly, make(brewly, "--set", "aspect=16:9", "--set", "platform=x.video"), "node make.mjs --set aspect=16:9 --set platform=x.video")


def test_a_template_with_no_linked_media_still_gets_assets_media():
    """compose.stage() makes assets/media itself: the mix is written there even when `media` is empty (brewly, multi-voice-doc)"""
    with tempfile.TemporaryDirectory() as td:
        js = f"import {{ stage }} from {json.dumps('file://' + os.path.join(REPO, 'templates', '_shared', 'compose.mjs'))}; stage({json.dumps(td)}, {{ media: [] }});"
        r = subprocess.run([NODE, "--input-type=module", "-e", js], capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        assert os.path.isdir(os.path.join(td, "assets", "media"))
