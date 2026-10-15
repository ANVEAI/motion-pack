#!/usr/bin/env python3
"""The plan lint is a gate, not a printout. SKILL.md and templates/ad/config.mjs promise that a claim with a digit and no `source` (lint.proof) fails the build and that lint refuses an
unmotivated transition. Before 2026-10-15 cues.mjs only console.logged both and exited 0, so an unsourced stat reached index.html and the mix. Now cues.mjs exits 2, every make.mjs stops with it,
and --allow-lint (or MP_ALLOW_LINT=1 for render3d.sh) is the one documented waiver, recorded in plan.lint.allowed. No render, no browser. Run: python3 -m pytest -q tools/tests/test_lint_gate.py"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

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
    assert r.returncode == 2 and "lint.proof" in r.stderr and "Ships in 2 days" in r.stderr, (r.returncode, r.stderr[-800:])   # the docs say make.mjs exits 2
    assert "execFileSync" not in r.stderr and "    at " not in r.stderr, "the gate stops the build with its message, not a Node stack trace:\n" + r.stderr[-800:]
    assert not os.path.exists(os.path.join(brewly, "index.html")) and not os.path.exists(os.path.join(brewly, "assets", "media", "mix.wav")), "a failed lint must not leave a page or a mix behind"
    r = make(brewly, *bad, "--allow-lint")
    assert r.returncode == 0, r.stderr[-800:]
    assert os.path.exists(os.path.join(brewly, "index.html")) and os.path.exists(os.path.join(brewly, "assets", "media", "mix.wav"))
    assert json.load(open(os.path.join(brewly, "out", "plan.json")))["lint"]["allowed"][0].startswith("lint.proof")


# ---- the part demos build their own plan (no config.mjs, so no cues.mjs): they run the same gate through compose.mjs lintPlan / lintStop ----
COMPOSE = os.path.join(REPO, "templates", "_shared", "compose.mjs")
LIGHT_DEMOS = ["demo-r3-ui", "demo-ui-kit", "demo-r45-ui"]   # no plate render before the plan, so the gate can be run here without a browser


def tracked_makes():
    out = subprocess.run(["git", "ls-files", "templates/*/make.mjs", "examples/*/template/make.mjs"], cwd=REPO, capture_output=True, text=True).stdout.split()
    return [os.path.join(REPO, f) for f in out] or sorted(os.path.join(REPO, "templates", d, "make.mjs") for d in os.listdir(os.path.join(REPO, "templates")) if os.path.exists(os.path.join(REPO, "templates", d, "make.mjs")) and not d.startswith("wx-"))


@pytest.mark.parametrize("f", tracked_makes(), ids=lambda f: os.path.relpath(f, REPO))
def test_every_make_runs_the_gate_before_it_stages_and_mixes_through_mix(f):
    """templates/README.md says every make.mjs runs the lint gate first: either cues.mjs (runPlan) or, for a demo that builds its own plan, lintPlan + lintStop, before stage();
    and the mix goes through compose.mix(), so a failing audio.py ends the build with its own message, not a Node stack trace"""
    s = open(f).read()
    gate = min([i for i in (s.find("runPlan("), s.find("lintStop(")) if i >= 0] or [-1])
    assert gate >= 0, "this make.mjs never runs the lint gate (runPlan or lintPlan + lintStop)"
    assert "lintStop(" not in s or "lintPlan(" in s, "lintStop needs lintPlan to fill plan.lint first"
    assert s.find("stage(DIR") < 0 or gate < s.find("stage(DIR"), "the gate must run before anything is staged"
    assert "audio.py')" not in s, "call compose.mix(), not execFileSync(... audio.py ...)"
    assert "everyClaimHasSource: true" not in s, "a lint result is computed, never asserted"


@pytest.mark.parametrize("demo", LIGHT_DEMOS)
def test_a_part_demo_stops_on_an_unsourced_digit(demo, make):
    d = tempfile.mkdtemp(prefix="wx-gate-", dir=os.path.join(REPO, "templates"))
    try:
        s = open(os.path.join(REPO, "templates", demo, "make.mjs")).read()
        assert s.count("const fails = lintPlan(plan);") == 1
        s = s.replace("const fails = lintPlan(plan);", "plan.claims = [...(plan.claims || []), { text: 'Saves 40% of your time' }];\nconst fails = lintPlan(plan);")
        open(os.path.join(d, "make.mjs"), "w").write(s)
        r = make(d)
        assert r.returncode == 2 and "lint.proof" in r.stderr and "Saves 40% of your time" in r.stderr and demo in r.stderr, (r.returncode, r.stdout[-400:], r.stderr[-800:])
        assert "    at " not in r.stderr, r.stderr[-800:]
        assert not os.path.exists(os.path.join(d, "assets")) and not os.path.exists(os.path.join(d, "index.html")), "the gate must stop before stage(), the mix and the page"
        assert json.load(open(os.path.join(d, "out", "plan.json")))["lint"]["claimsWithoutSource"] == ["Saves 40% of your time"]
    finally:
        shutil.rmtree(d, ignore_errors=True)


def test_lint_tx_reads_the_demos_transition_spelling():
    """the demos write shot.transition (not shot.tx): a non-cut one with no txReason is still an unmotivated transition"""
    js = ("import('%s').then((m) => console.log(JSON.stringify(m.lintTransitions([{ id: 'a', transition: 'transitions/whip' }, { id: 'b', transition: 'transitions/cut' }, "
          "{ id: 'c', tx: 'transitions/whip', txReason: 'RHYTHM' }, { id: 'd', transition: 'transitions/push', txReason: 'STORY' }]))))") % os.path.join(REPO, "templates", "_shared", "plan.mjs")
    r = subprocess.run([NODE, "-e", js], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0 and json.loads(r.stdout) == ["a"], r.stdout + r.stderr


def test_mix_failure_has_no_node_stack_trace():
    """compose.mix(): when audio.py stops (here: no plan file), make.mjs ends with audio.py's own message and exit code, not execFileSync's 'Command failed' and a Node stack"""
    with tempfile.TemporaryDirectory() as d:
        js = "import('%s').then((m) => m.mix('%s', '%s', '%s'))" % (COMPOSE, os.path.join(d, "missing-plan.json"), os.path.join(d, "mix.wav"), sys.executable)
        r = subprocess.run([NODE, "-e", js], capture_output=True, text=True, timeout=120, env=env())
    assert r.returncode == 1, (r.returncode, r.stderr[-600:])
    assert "missing-plan.json" in r.stderr and "Command failed" not in r.stderr and "node:child_process" not in r.stderr and "    at " not in r.stderr, r.stderr[-800:]
