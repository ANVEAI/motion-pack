#!/usr/bin/env python3
"""The plan lint is a gate, not a printout. SKILL.md and templates/ad/config.mjs promise that a claim with a digit and no `source` (lint.proof) fails the build and that lint refuses an
unmotivated transition. Before 2026-10-15 cues.mjs only console.logged both and exited 0, so an unsourced stat reached index.html and the mix. Now cues.mjs exits 2, every make.mjs stops with it,
and --allow-lint (or MP_ALLOW_LINT=1 for render3d.sh) is the one documented waiver, recorded in plan.lint.allowed. No render, no browser. Run: python3 -m pytest -q tools/tests/test_lint_gate.py"""
import json
import os
import subprocess

import pytest

from mp_build import NODE, REPO, env

CUES = os.path.join(REPO, "templates", "_shared", "cues.mjs")
AD = os.path.join(REPO, "templates", "ad")
BAD_PROOF = ["--set", "proof.0.text=Saves 40% of your time", "--set", "length=15"]
NO_REASON = ["--set", "transitions.hook>problem.1="]   # ad: the smash into the problem loses its reason
pytestmark = pytest.mark.skipif(NODE is None, reason="node is not installed")


def cues(d, *args, extra_env=None, name="lintgate"):
    """run cues.mjs on a template folder; the plan goes to out/<name>.json (a throwaway name: the committed plan.json files stay untouched) and is returned with the process"""
    r = subprocess.run([NODE, CUES, d, "--name", name, *args], capture_output=True, text=True, env={**env(), **(extra_env or {})}, timeout=300)
    f = os.path.join(d, "out", name + ".json")
    plan = json.load(open(f)) if os.path.exists(f) else None
    if os.path.exists(f):
        os.remove(f)
    return r, plan


def shipped_templates():
    """every template folder with a config.mjs (the same set tools/count.py counts), plus the worked example's"""
    t = os.path.join(REPO, "templates")
    return sorted(os.path.join(t, n) for n in os.listdir(t) if os.path.exists(os.path.join(t, n, "config.mjs")) and not n.startswith("wx-"))


@pytest.mark.parametrize("d", shipped_templates(), ids=lambda d: os.path.basename(d))
def test_every_shipped_template_passes_its_own_lint(d):
    r, plan = cues(d)
    assert r.returncode == 0, f"{os.path.basename(d)} trips the lint it ships with:\n{r.stdout[-600:]}\n{r.stderr[-900:]}"
    assert plan["lint"]["claimsWithoutSource"] == [] and plan["lint"]["unmotivatedTransitions"] == [] and "allowed" not in plan["lint"]


@pytest.mark.parametrize("args", [["--set", "length=30"], ["--set", "length=15"]], ids=["ad-30s", "ad-15s"])
def test_the_ad_passes_at_both_lengths(args):
    r, _ = cues(AD, *args)
    assert r.returncode == 0, r.stderr[-900:]


def test_a_digit_without_a_source_exits_2_and_says_so():
    r, plan = cues(AD, *BAD_PROOF)
    assert r.returncode == 2, (r.returncode, r.stdout[-400:], r.stderr[-600:])
    assert "lint.proof" in r.stderr and "Saves 40% of your time" in r.stderr and "--allow-lint" in r.stderr
    assert plan["lint"]["claimsWithoutSource"] == ["Saves 40% of your time"], "the plan is still written, so plan.lint shows what failed"


def test_a_digit_with_a_source_passes():
    r, _ = cues(AD, *BAD_PROOF, "--set", "proof.0.source=our own 12-user study, March")
    assert r.returncode == 0, r.stderr[-600:]


def test_an_unmotivated_transition_exits_2_and_names_the_shot():
    r, plan = cues(AD, *NO_REASON)
    assert r.returncode == 2, (r.returncode, r.stdout[-400:], r.stderr[-600:])
    assert "lint.tx" in r.stderr and plan["lint"]["unmotivatedTransitions"], plan["lint"]
    assert plan["lint"]["unmotivatedTransitions"][0] in r.stderr


@pytest.mark.parametrize("how", ["flag", "env"])
def test_allow_lint_waives_it_and_records_the_waiver(how):
    args = BAD_PROOF + NO_REASON + (["--allow-lint"] if how == "flag" else [])
    r, plan = cues(AD, *args, extra_env={"MP_ALLOW_LINT": "1"} if how == "env" else None)
    assert r.returncode == 0, r.stderr[-600:]
    assert "waived" in r.stderr and len(plan["lint"]["allowed"]) == 2, plan["lint"]
    assert any(m.startswith("lint.proof") for m in plan["lint"]["allowed"]) and any(m.startswith("lint.tx") for m in plan["lint"]["allowed"])


def test_make_stops_before_building_and_allow_lint_lets_it_go_on(brewly, make):
    """node make.mjs (the worked example's copy of the ad pipeline): the failing lint stops it before it stages, mixes or writes a page; --allow-lint builds"""
    bad = ["--set", "proof.0.text=Ships in 2 days"]
    r = make(brewly, *bad)
    assert r.returncode != 0 and "lint.proof" in r.stderr and "Ships in 2 days" in r.stderr, (r.returncode, r.stderr[-800:])
    assert not os.path.exists(os.path.join(brewly, "index.html")) and not os.path.exists(os.path.join(brewly, "assets", "media", "mix.wav")), "a failed lint must not leave a page or a mix behind"
    r = make(brewly, *bad, "--allow-lint")
    assert r.returncode == 0, r.stderr[-800:]
    assert os.path.exists(os.path.join(brewly, "index.html")) and os.path.exists(os.path.join(brewly, "assets", "media", "mix.wav"))
    assert json.load(open(os.path.join(brewly, "out", "plan.json")))["lint"]["allowed"][0].startswith("lint.proof")
