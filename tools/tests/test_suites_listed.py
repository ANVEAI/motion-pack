#!/usr/bin/env python3
"""The real-GPU runner (layers/tests/run-all.sh) must run every browser suite, and CI (.github/workflows/ci.yml) must run every node-only one.
A browser suite is a tracked `*.test.mjs` that opens Chrome through layers/tests/harness.mjs (`open`) or has a `--chrome` mode; it must be listed in
run-all.sh, with `--chrome` when it has that mode (its node checks alone are a subset). A suite with neither is node-only and must be a CI step.
(run-all.sh used to miss layers/tests/r3.test.mjs and the --chrome modes of r45 and r45type although the README calls it the GPU check.)
Run: python3 -m pytest -q tools/tests"""
import os
import re
import subprocess

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RUN_ALL = os.path.join(PACK, 'layers', 'tests', 'run-all.sh')
CI = os.path.join(PACK, '.github', 'workflows', 'ci.yml')


def _suites():
    files = subprocess.run(['git', 'ls-files', '*.test.mjs'], cwd=PACK, capture_output=True, text=True, check=True).stdout.split()
    out = {}
    for f in files:
        src = open(os.path.join(PACK, f), encoding='utf-8').read()
        opens = bool(re.search(r"import\s*\{[^}]*\bopen\b[^}]*\}\s*from\s*['\"][./]*(?:layers/tests/)?harness\.mjs['\"]", src))
        out[f] = {'browser': opens or "'--chrome'" in src, 'chrome_flag': "'--chrome'" in src}
    return out


def _run_all_entries():
    src = open(RUN_ALL, encoding='utf-8').read()
    return {m.group(1): m.group(2).split() for m in re.finditer(r'^\s*"([^"\s]+\.mjs)((?:\s+[^"]*)?)"\s*$', src, re.M)}


def test_every_browser_suite_is_in_run_all_with_its_chrome_flag():
    listed, missing, flag = _run_all_entries(), [], []
    assert listed, 'no suites parsed from run-all.sh'
    for f, s in _suites().items():
        if not s['browser']:
            continue
        if f not in listed:
            missing.append(f)
        elif s['chrome_flag'] and '--chrome' not in listed[f]:
            flag.append(f)
    assert not missing, 'browser suites missing from layers/tests/run-all.sh: %s' % missing
    assert not flag, 'suites with a --chrome mode listed without --chrome in run-all.sh: %s' % flag


def test_every_listed_file_exists_and_every_node_only_suite_runs_in_ci():
    for f in _run_all_entries():
        assert os.path.exists(os.path.join(PACK, f)), 'run-all.sh lists a missing file: ' + f
    ci = open(CI, encoding='utf-8').read()
    node_only = [f for f, s in _suites().items() if not s['browser'] and ('node ' + f) not in ci]
    assert not node_only, 'node-only suites that no CI step runs: %s' % node_only
