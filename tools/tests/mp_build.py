"""Helpers shared by the template-build tests (test_worked_example.py, test_lint_gate.py). Nothing here renders; the one gitignored input a build needs, a music bed WAV, is built on demand."""
import json
import os
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXAMPLE = os.path.join(REPO, "examples", "brewly-teaser", "template")
NODE = shutil.which("node")


def env():
    e = dict(os.environ)
    e["PATH"] = os.path.dirname(sys.executable) + os.pathsep + e.get("PATH", "")   # make.mjs runs `python3`: use the interpreter that runs the tests
    e.pop("MP_ALLOW_LINT", None)
    return e


def ensure_bed(bed="bed_uplift_corporate_loop8"):
    """the music WAV masters are gitignored and CI does not build the whole library: build only the one bed the example names (what README step 1 would have done)"""
    man = json.load(open(os.path.join(REPO, "music", "manifest.json")))["items"]
    f = os.path.join(REPO, "music", next(i["file"] for i in man if i["id"] == "music." + bed))
    if not os.path.exists(f):
        r = subprocess.run([sys.executable, "build_music.py", "--only", bed], cwd=os.path.join(REPO, "music"), capture_output=True, text=True, env=env())
        assert r.returncode == 0 and os.path.exists(f), r.stdout[-800:] + r.stderr[-800:]
