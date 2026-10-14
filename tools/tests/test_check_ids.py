#!/usr/bin/env python3
"""tools/check_ids.py must resolve every id family SKILL.md hard rule 1 names (transitions, sfx, music, type, layers, objects, blender, cam2d / cam3d, cuts) plus templates, and, with --docs, read Markdown.
It used to know six families and no Markdown, while the README said it "resolves every one" and the skill said a clean run means the ids are safe. These tests plant one wrong id per family in a scratch folder
(check_ids takes PATH arguments, so nothing is written into the pack) and assert each is reported, that the right ids pass, and that the pack itself is clean in both modes.
Run: python3 -m pytest -q tools/tests/test_check_ids.py"""
import os
import re
import subprocess
import sys
import tempfile

import pytest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
CHECK = os.path.join(TOOLS, "check_ids.py")
BAD = {   # family -> a plausible but wrong id
    "transitions": "transitions/nope", "sfx": "sfx/hit/nope", "music": "music/bed_nope_loop8", "type": "type/nope", "blender": "blender/nopeRecipe",
    "layers": "layers/nope", "objects": "objects/does-not-exist",
    "layers (dotted)": "layers/overlay.nope", "objects (camelCase)": "objects/doesNotExist", "objects (capital)": "objects/Laptop", "cuts (group)": "cuts/nope/x", "cuts (name)": "cuts/story/nope", "cuts (retime)": "cuts/retime/nope",
    "cam3d": "cam3d.noSuchMove", "cam2d": "cam2d.noSuchMove", "templates": "templates/nope"}
GOOD = ["transitions/whip", "sfx/hit/punch", "music/bed_tech_pulse_loop8", "type/scaleSlam", "blender/turntable", "layers/vignette", "layers/grain", "layers/overlay.grain", "layers/README.md", "objects/laptop", "objects/index.js", "cuts/story/interruptOpen",
        "cuts/sections/build_accelerate", "cuts/retime/heroRamp", "cuts/interrupts", "cam3d.pushIn", "cam2d.push2d", "cam2d.dutchRoll.presets", "templates/ad"]


def run(*args):
    return subprocess.run([sys.executable, CHECK, *args], capture_output=True, text=True, timeout=300)


@pytest.fixture(scope="module")
def probe():
    with tempfile.TemporaryDirectory() as d:
        yield d


def write(d, name, text):
    p = os.path.join(d, name)
    open(p, "w").write(text)
    return p


@pytest.fixture(scope="module")
def bad_run(probe):
    """one run over a file that holds one wrong id per family (the registries take a few seconds to load, so not one run per family)"""
    f = write(probe, "bad.mjs", "export const X = [\n" + "".join(f"  '{v}',\n" for v in BAD.values()) + "];\n")
    return run(f)


def test_the_wrong_ids_fail_the_run(bad_run):
    assert bad_run.returncode == 1 and f"unresolved: {len(BAD)}" in bad_run.stdout, bad_run.stdout[-900:]


@pytest.mark.parametrize("family", sorted(BAD))
def test_a_wrong_id_of_every_family_is_reported(family, bad_run):
    assert re.search(r"UNRESOLVED \w+\s+" + re.escape(BAD[family]) + r"\s", bad_run.stdout), (family, bad_run.stdout[-900:])


def test_right_ids_of_every_family_pass(probe):
    f = write(probe, "good.mjs", "export const X = [" + ", ".join(f"'{i}'" for i in GOOD) + "];\n")
    r = run(f)
    assert r.returncode == 0, r.stdout[-800:]
    assert "unresolved: 0" in r.stdout and re.search(r"'cam': 3", r.stdout) and re.search(r"'cuts': 4", r.stdout), r.stdout[:400]


def test_every_family_of_hard_rule_1_is_covered():
    """the families the skill names in rule 1 are the ones the script checks: if the skill grows a family, this fails until the script does too"""
    rule = open(os.path.join(REPO, "skills", "motion-pack", "SKILL.md")).read().split("1. **Ids, not copies.**", 1)[1].split("2. **Plan first.**", 1)[0]
    named = set(re.findall(r"`(transitions|sfx|music|type|layers|objects|blender|cuts)/", rule)) | set(re.findall(r"`(cam2d|cam3d)\.", rule))
    assert named == {"transitions", "sfx", "music", "type", "layers", "objects", "blender", "cuts", "cam2d", "cam3d"}, named
    covered = {k.split(" ")[0] for k in BAD}
    assert named <= covered, f"rule 1 names families check_ids does not test: {sorted(named - covered)}"


def test_markdown_is_read_only_with_docs_and_only_inside_code(probe):
    md = write(probe, "doc.md", "Prose id objects/not-in-backticks is not scanned.\n\nUse `transitions/nope` and `sfx/hit/nope`.\n\n```bash\nnode make.mjs --tx 'music/bed_nope_loop8'\n```\n"
               "Placeholders `sfx/<cat>/<name>`, `objects/*`, a path `objects/index.js`, a file `cam2d.js` and a real id `transitions/whip` are fine.\n")
    assert run(md).returncode == 0, "Markdown must not be read without --docs"
    r = run("--docs", md)
    assert r.returncode == 1 and "unresolved: 3" in r.stdout, r.stdout[-600:]
    for want in ("transitions/nope", "sfx/hit/nope", "music/bed_nope_loop8"):
        assert want in r.stdout
    assert "not-in-backticks" not in r.stdout and "index" not in r.stdout.split("unresolved")[-2][-400:]


def test_off_style_ids_are_reported_in_markdown_too(probe):
    """the verifier's C5 probe: a camelCase objects id and a dotted layers id used to match no pattern, so a typo in either passed silently in code and in Markdown"""
    md = write(probe, "offstyle.md", "Use `objects/doesNotExist`, `objects/logoExtrude` and `layers/look.nope`; `layers/overlay.grain` and `objects/logo-extrude` are real.\n")
    r = run("--docs", md)
    assert r.returncode == 1 and "unresolved: 3" in r.stdout, r.stdout[-600:]
    for want in ("objects/doesNotExist", "objects/logoExtrude", "layers/look.nope"):
        assert want in r.stdout


def test_the_pack_is_clean_in_both_modes():
    r = run("--docs")
    assert r.returncode == 0 and "unresolved: 0" in r.stdout and "markdown scanned" in r.stdout, r.stdout[-1500:]
    r = run()
    assert r.returncode == 0 and "markdown not scanned" in r.stdout, r.stdout[-1500:]
