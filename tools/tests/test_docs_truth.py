#!/usr/bin/env python3
"""The documentation must say what the code does. Each test here pins one finding of the clean-clone audit of 2026-10-14 so a doc that drifts again fails CI instead of misleading a user:
  - the shell blocks in the Markdown can be pasted (no `\\ # comment` that breaks a continuation) and the ears command only uses flags listen.py has;
  - the render3d.sh commands are the repo-root form, and the folder and page they name exist;
  - phrases that described the pack before the DOM approximations, the 301-sound library and the second character are gone;
  - the lists in the cheat sheet (bundles, music presets, type presets) name every key of the registry they describe;
  - the inline count markers (tools/count.py) are checked, filled in and rejected when stale or unknown;
  - the README says what is and is not deterministic, and one Python version.
Run: python3 -m pytest -q tools/tests/test_docs_truth.py"""
import json
import os
import re
import shlex
import subprocess
import sys

import pytest

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(TOOLS)
sys.path.insert(0, TOOLS)
import count  # noqa: E402


def tracked(*globs):
    out = subprocess.run(["git", "-C", REPO, "ls-files", *globs], capture_output=True, text=True).stdout.split("\n")
    return [f for f in out if f and os.path.exists(os.path.join(REPO, f))]


def read(rel):
    return open(os.path.join(REPO, rel), encoding="utf-8").read()


def fenced_shell_blocks(text):
    """(first line number, [lines]) of every ```bash / sh / shell / zsh / console fence"""
    blocks, cur, lang, start = [], None, None, 0
    for n, line in enumerate(text.split("\n"), 1):
        m = re.match(r"\s*```(\w*)", line)
        if m and cur is None:
            cur, lang, start = [], m.group(1).lower(), n + 1
        elif m and cur is not None:
            if lang in ("bash", "sh", "shell", "zsh", "console"):
                blocks.append((start, cur))
            cur = None
        elif cur is not None:
            cur.append(line)
    return blocks


MD = [f for f in tracked("*.md") if not f.startswith("docs/research/") and not f.endswith("RUNLOG.md")]


# ------------------------------------------------------------------------------------------------------------------------------ pasteable commands
def test_no_shell_block_has_text_after_a_line_continuation():
    """`\\` followed by spaces or a comment escapes the space, not the newline: the command ends there and the next line runs on its own"""
    bad = []
    for f in MD:
        for start, lines in fenced_shell_blocks(read(f)):
            bad += [f"{f}:{start + i}: {l.strip()[:80]}" for i, l in enumerate(lines) if re.search(r"\\[ \t]+\S*\s*$", l) or re.search(r"\\[ \t]*#", l)]
    assert not bad, "a backslash continuation must be the last character of the line:\n" + "\n".join(bad)


def test_the_ears_command_pastes_and_uses_flags_that_exist():
    block = next(lines for _, lines in fenced_shell_blocks(read("ears/README.md")) if any("ears/listen.py" in l for l in lines))
    argv = shlex.split(re.sub(r"\\\n", " ", "\n".join(block)).replace("\\\n", " "), comments=True)
    assert argv[:2] == ["python3", "ears/listen.py"] and " " not in argv, argv
    helptext = subprocess.run([sys.executable, os.path.join(REPO, "ears", "listen.py"), "--help"], capture_output=True, text=True).stdout
    flags = [a for a in argv if a.startswith("--")]
    assert {"--plan", "--transcript", "--ref", "--json", "--md"} <= set(flags), flags
    assert all(f in helptext for f in flags), [f for f in flags if f not in helptext]


def test_render3d_commands_are_the_repo_root_form_and_name_real_files():
    seen = 0
    for f in MD + ["skills/motion-pack/SKILL.md"]:
        for m in re.finditer(r"render3d\.sh\s+([^\s`|<]+)\s+([^\s`|<]+)\s+(wide|tall)", read(f)):   # a <placeholder> form is a usage line, not a command
            seen += 1
            before = read(f)[max(0, m.start() - 40):m.start()]
            assert before.endswith("templates/_shared/") or before.endswith("bash templates/_shared/") or "_shared/" in before, (f, m.group(0))
            assert not before.endswith("../_shared/"), f"{f}: ../_shared/render3d.sh cannot work from any folder: {m.group(0)}"
            assert os.path.isdir(os.path.join(REPO, m.group(1))) and os.path.exists(os.path.join(REPO, m.group(1), m.group(2))), (f, m.group(0))
    assert seen >= 4, "the docs should show the render3d.sh command for both three.js templates"
    assert os.path.exists(os.path.join(REPO, "templates", "_shared", "render3d.sh"))


# ------------------------------------------------------------------------------------------------------------------------------ stale statements
STALE = [
    (r"13 of (the )?23 transitions", "the DOM back-end covers all 49 visual transitions (26 exact, 23 approximated)"),
    (r"hard-cut[s]? in DOM templates", "GL-only looks play as DOM approximations; only speedRamp is a logged hard cut"),
    (r"GL-only keys (hard-cut|stay hard cuts|are not registered)", "GL-only looks are registered with approx: true"),
    (r"\(188 sounds\)", "the registry has 301 sounds"),
    (r"45 film poses", "POSES has 41 film poses plus 6 generic ones"),
    (r"\bone rigged character\b|props, set pieces and one character", "there are two characters: the rigged 3D worker and the flat 2D mascot"),
    (r"adds 25 \(merged\)|the 25 added transitions|11 more real DOM back-ends", "tx-shaders-x adds 27, registry-x has 27, tx-dom-x has 13 real back-ends"),
    (r"The 14 presets are", "type/presets.js has 15 presets (outlineFill)"),
    (r"\b15 (recent )?launch(es| films)\b", "the research table lists 20 launch films"),
]


@pytest.mark.parametrize("pattern,why", STALE, ids=[p[:28] for p, _ in STALE])
def test_stale_statements_are_gone(pattern, why):
    hits = []
    for f in tracked("*.md", "*.mjs", "*.js", "*.py", "*.json", "*.yml", "*.txt"):
        if f.startswith(("docs/research/", "tools/tests/", "catalog/index.html")) or f.endswith(("RUNLOG.md", "package-lock.json")) or "/renders/" in f:
            continue
        for n, line in enumerate(read(f).split("\n"), 1):
            if re.search(pattern, line):
                hits.append(f"{f}:{n}")
    assert not hits, f"{why}: {hits[:6]}"


# ------------------------------------------------------------------------------------------------------------------------------ lists name every key
def _apis():
    return read("skills/motion-pack/references/apis.md")


def test_apis_lists_every_sfx_bundle():
    names = [k for k, v in json.load(open(os.path.join(REPO, "sfx", "bundles.json"))).items() if isinstance(v, dict)]
    missing = [k for k in names if f"`{k}`" not in _apis()]
    assert not missing, f"apis.md does not name the bundles {missing}"


def test_apis_lists_every_music_preset():
    import importlib.util
    spec = importlib.util.spec_from_file_location("mp_presets", os.path.join(REPO, "music", "presets.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    line = next(l for l in _apis().split("\n") if "music/presets.py" in l and "presets (the original 10" in l)
    missing = [k for k in m.PRESETS if k not in line]
    assert not missing, f"apis.md does not name the music presets {missing}"


def test_apis_lists_every_type_preset():
    ids = json.loads(subprocess.run(["node", "-e", "import('./type/presets.js').then(m=>console.log(JSON.stringify(m.PRESET_IDS)))"], cwd=REPO, capture_output=True, text=True).stdout)
    para = next(l for l in _apis().split("\n") if "presets are maskRise" in l)
    assert [i for i in ids if i not in para] == [], f"apis.md does not name {[i for i in ids if i not in para]}"


# ------------------------------------------------------------------------------------------------------------------------------ inline count markers
def test_marker_fill_sets_the_value_and_reports_unknown_keys():
    text = "a <!--n:sfx-->188<!--/n--> b <!--n:nope-->1<!--/n--> c <!--n:sfx-->301<!--/n-->"
    out, bad = count.fill(text, {"sfx": "301"})
    assert out == "a <!--n:sfx-->301<!--/n--> b <!--n:nope-->1<!--/n--> c <!--n:sfx-->301<!--/n-->" and bad == ["nope"]


def test_every_marker_in_the_docs_is_current_and_known():
    vals = count.inline_values(count.counts())
    files = count.marked_files()
    assert {"README.md"} | {"skills/motion-pack/references/apis.md", "transitions/README.md", "objects/README.md", "music/README.md", "templates/README.md"} <= set(files) | {"README.md"}
    for f in files:
        text = read(f)
        fixed, bad = count.fill(text, vals)
        assert not bad, f"{f}: unknown count key(s) {bad} (python3 tools/count.py --keys)"
        assert fixed == text, f"{f} has a stale inline count: run python3 tools/count.py --write"


def test_count_check_fails_on_a_stale_marker(tmp_path):
    """a copy of the pack's count.py run against a doc whose marker is wrong exits 1 (the CI step); against the real pack it exits 0"""
    ok = subprocess.run([sys.executable, os.path.join(TOOLS, "count.py"), "--check"], capture_output=True, text=True)
    assert ok.returncode == 0, ok.stdout + ok.stderr
    f = os.path.join(REPO, "objects", "README.md")
    orig = open(f, encoding="utf-8").read()
    try:
        open(f, "w", encoding="utf-8").write(re.sub(r"(<!--n:poses_film-->)\d+", r"\g<1>99", orig, count=1))
        bad = subprocess.run([sys.executable, os.path.join(TOOLS, "count.py"), "--check"], capture_output=True, text=True)
        assert bad.returncode == 1 and "inline counts STALE in objects/README.md" in bad.stdout, bad.stdout
    finally:
        open(f, "w", encoding="utf-8").write(orig)


def test_readme_table_labels_say_what_is_counted():
    c = count.counts()
    row = {l.split("|")[1].strip(): l for l in read("README.md").split("\n") if l.startswith("| `")}
    t = row["`templates/`"]
    assert f"{len(c['templates'])} genre templates" in t and all(n in t for n in c["templates"]) and not any(n in t.split(";")[0] for n in c["template_demos"]), t
    assert f"{len(c['template_demos'])} part demos" in t
    assert f"{c['camera_moves']} camera moves" in row["`camera/`"] and f"{c['camera_helpers']} helpers" in row["`camera/`"], row["`camera/`"]
    assert f"{c['objects_characters']} characters" in row["`objects/`"], row["`objects/`"]
    assert c["camera_moves"] + c["camera_helpers"] == c["camera"] and (c["camera_moves"], c["objects_characters"]) == (33, 2)
    for n in c["templates"]:
        assert os.path.exists(os.path.join(REPO, "templates", n, "config.mjs")) and not n.startswith("demo-")


# ------------------------------------------------------------------------------------------------------------------------------ room tone levels
def test_room_tone_levels_in_the_docs_are_what_the_mixer_places():
    """RECIPE F and the gotchas quote the room-tone stem level under a bed for several overBedDb values; the mixer is run here with the same cue sheet so the numbers cannot drift"""
    import tempfile
    from mp_build import ensure_bed
    bed = "bed_cinematic_drone_loop8"
    ensure_bed(bed)
    sys.path.insert(0, os.path.join(REPO, "music"))
    import mixer
    import soundfile as sf
    from mpaudio import meter
    man = {i["id"]: i["file"] for i in json.load(open(os.path.join(REPO, "music", "manifest.json")))["items"]}
    gotcha = next(l for l in read("skills/motion-pack/references/gotchas.md").split("\n") if l.startswith("- **Room tone is not -48"))
    nums = re.search(r"reads (-?\d+\.\d) LUFS at the loop default.*?(-?\d+\.\d) at `overBedDb: -20`, (-?\d+\.\d) at -26 and (-?\d+\.\d) at -30.*?measures (-?\d+\.\d) over the bed \((-?\d+\.\d) LUFS\)", gotcha)
    assert nums, "the gotcha no longer states the measured levels in the expected form"
    want = {None: float(nums.group(1)), -20: float(nums.group(2)), -26: float(nums.group(3)), -30: float(nums.group(4)), -38: float(nums.group(6))}
    for over, lufs in want.items():
        with tempfile.TemporaryDirectory() as td:
            sheet = {"fps": 30, "length_s": 12, "bed": {"file": os.path.join(REPO, "music", man["music." + bed]), "gain_db": 0, "loop": True},
                     "cues": [{"id": "snd.amb.room_tone", "frame": 0, **({"over_bed_db": over} if over is not None else {})}], "master": {"lufs": -14, "ceiling_db": -1.5}}
            rep = mixer.mix_from_cuesheet(sheet, td).render(td, lufs=-14, ceiling_db=-1.5)
            x, _ = sf.read(os.path.join(td, "stem_sfx.flac"))
            got = meter.lufs_integrated(x)
            assert abs(got - lufs) <= 0.15, f"overBedDb {over}: the docs say {lufs} LUFS, the mixer gives {got:.2f}"
            if over == -38:
                assert abs(rep["cues"][0]["measured_over_bed_db"] - float(nums.group(5))) <= 0.1 and rep["cues"][0]["trim_db"] == -30.0, rep["cues"][0]
    man_item = next(s for s in json.load(open(os.path.join(REPO, "sfx", "manifest.json")))["sounds"] if s["id"] == "snd.amb.room_tone")
    assert abs(man_item["lufs_integrated"] - (-18.1)) <= 0.05 and "-18.1 LUFS-I" in read("skills/motion-pack/SKILL.md").replace("\u2212", "-")
    assert "-48" not in man_item["desc"], man_item["desc"]


# ------------------------------------------------------------------------------------------------------------------------------ install and determinism statements
def test_one_python_version_everywhere():
    readme, skill, req = read("README.md"), read("skills/motion-pack/SKILL.md"), read("requirements.txt")
    assert "python3.11 -m venv" in readme and "pip install -r requirements.txt" in readme.split("python3.11 -m venv")[1].split("```")[0]
    compat = next(l for l in skill.split("\n") if l.startswith("compatibility:"))
    assert "Python 3.11" in compat and "3.10" in compat and "numba" in compat and "puppeteer-core" in compat and "Node 22" in compat and "ffmpeg" in compat and "Blender 5.2" in compat, compat
    assert "Tested with Python 3.11" in req


def test_the_readme_says_what_is_and_is_not_deterministic():
    readme = read("README.md")
    sec = readme.split("What is and is not deterministic", 1)[1].split("\n## ", 1)[0]
    for must in ("--workers 1", "2/255", "audio", "frame N", "GPU"):
        assert must in sec, f"the determinism section must mention {must!r}"
    assert "the same pixels and the same audio every time" not in readme and "comes out the same every time" not in readme
    assert "What is and is not deterministic" in read("skills/motion-pack/SKILL.md")
