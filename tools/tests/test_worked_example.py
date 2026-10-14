#!/usr/bin/env python3
"""The README's worked example (examples/brewly-teaser) must build from a clean clone: copy its template/ into templates/, run `node make.mjs`, get a plan, a mix and an index.html.
This is the documented reproduction, step for step, up to (not including) the HyperFrames render: no browser, no GPU, nothing gitignored beyond the one music bed it builds itself.
It failed before 2026-10-15: brewly passes `media: []`, so assets/media never existed and audio.py died on the mix.wav write. Run: python3 -m pytest -q tools/tests/test_worked_example.py"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import pytest

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXAMPLE = os.path.join(REPO, "examples", "brewly-teaser", "template")
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")


def _env():
    e = dict(os.environ)
    e["PATH"] = os.path.dirname(sys.executable) + os.pathsep + e.get("PATH", "")   # make.mjs runs `python3`: use the interpreter that runs the tests
    return e


def _ensure_bed(bed="bed_uplift_corporate_loop8"):
    """the music WAV masters are gitignored (CI does not build the whole library): build only the one bed the example names, like README step 1 would"""
    man = json.load(open(os.path.join(REPO, "music", "manifest.json")))["items"]
    f = os.path.join(REPO, "music", next(i["file"] for i in man if i["id"] == "music." + bed))
    if not os.path.exists(f):
        r = subprocess.run([sys.executable, "build_music.py", "--only", bed], cwd=os.path.join(REPO, "music"), capture_output=True, text=True, env=_env())
        assert r.returncode == 0 and os.path.exists(f), r.stdout[-800:] + r.stderr[-800:]


@pytest.fixture()
def brewly():
    """templates/<scratch>/ holds a copy of the example template, as the README says (templates find the pack two folders up); removed afterwards"""
    _ensure_bed()
    d = tempfile.mkdtemp(prefix="wx-brewly-", dir=os.path.join(REPO, "templates"))
    for f in os.listdir(EXAMPLE):
        shutil.copy(os.path.join(EXAMPLE, f), d)
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)


def _make(d, *args):
    return subprocess.run([NODE, "make.mjs", *args], cwd=d, capture_output=True, text=True, env=_env(), timeout=600)


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


def test_documented_reproduction_9x16(brewly):
    _assert_built(brewly, _make(brewly), "node make.mjs")


def test_documented_reproduction_16x9(brewly):
    _assert_built(brewly, _make(brewly, "--set", "aspect=16:9", "--set", "platform=x.video"), "node make.mjs --set aspect=16:9 --set platform=x.video")


def test_a_template_with_no_linked_media_still_gets_assets_media():
    """compose.stage() makes assets/media itself: the mix is written there even when `media` is empty (brewly, multi-voice-doc)"""
    with tempfile.TemporaryDirectory() as td:
        js = f"import {{ stage }} from {json.dumps('file://' + os.path.join(REPO, 'templates', '_shared', 'compose.mjs'))}; stage({json.dumps(td)}, {{ media: [] }});"
        r = subprocess.run([NODE, "--input-type=module", "-e", js], capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        assert os.path.isdir(os.path.join(td, "assets", "media"))
