#!/usr/bin/env python3
"""Tests for tools/check_generated.py, the CI gate that runs right after a generator (sfx/build_library.py, music/build_music.py, make-manifests.mjs):
a rebuilt manifest that differs from the committed one must fail, an identical one must pass. Each test builds a throwaway git repo; no network.
Run: python3 -m pytest -q tools/tests"""
import json
import os
import subprocess
import sys
import tempfile

TOOLS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, TOOLS)
import check_generated  # noqa: E402


def _repo(td):
    git = lambda *a: subprocess.run(['git', *a], cwd=td, check=True, capture_output=True)
    git('init', '-q'); git('config', 'user.email', 't@example.invalid'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false')
    os.makedirs(os.path.join(td, 'sfx'))
    with open(os.path.join(td, 'sfx', 'manifest.json'), 'w') as f:
        json.dump({'sounds': [{'id': 'snd.elec.arc', 'sha': 'aaaa'}]}, f, indent=1)
    git('add', '-A'); git('commit', '-q', '-m', 'init')
    return git


def test_an_identical_rebuild_passes_and_a_changed_sha_fails():
    with tempfile.TemporaryDirectory() as td:
        _repo(td)
        assert check_generated.changed(['sfx/manifest.json'], root=td) == []
        with open(os.path.join(td, 'sfx', 'manifest.json'), 'w') as f:   # what a rebuild does when a recipe gain moved: one sha changes
            json.dump({'sounds': [{'id': 'snd.elec.arc', 'sha': 'bbbb'}]}, f, indent=1)
        bad = check_generated.changed(['sfx/manifest.json'], root=td)
        assert len(bad) == 1 and bad[0][0] == 'sfx/manifest.json' and 'differs from the commit' in bad[0][1]


def test_staged_changes_count_and_missing_or_untracked_files_fail():
    with tempfile.TemporaryDirectory() as td:
        git = _repo(td)
        with open(os.path.join(td, 'sfx', 'manifest.json'), 'a') as f:
            f.write('\n')
        git('add', '-A')                                                  # staged, so a plain `git diff` would not see it
        assert check_generated.changed(['sfx/manifest.json'], root=td)
        assert check_generated.changed(['music/manifest.json'], root=td) == [('music/manifest.json', 'missing')]
        with open(os.path.join(td, 'new.json'), 'w') as f:
            f.write('{}')
        assert check_generated.changed(['new.json'], root=td) == [('new.json', 'not tracked by git')]


def test_the_cli_exits_1_on_drift_and_names_the_regenerating_command():
    with tempfile.TemporaryDirectory() as td:
        _repo(td)
        script = os.path.join(TOOLS, 'check_generated.py')
        ok = subprocess.run([sys.executable, '-c', 'import sys; sys.path.insert(0, %r); import check_generated as c; c.PACK = %r; sys.exit(c.main(["sfx/manifest.json"]))' % (TOOLS, td)], capture_output=True, text=True)
        assert ok.returncode == 0, ok.stdout + ok.stderr
        with open(os.path.join(td, 'sfx', 'manifest.json'), 'w') as f:
            f.write('{}')
        r = subprocess.run([sys.executable, '-c', 'import sys; sys.path.insert(0, %r); import check_generated as c; c.PACK = %r; sys.exit(c.main(["sfx/manifest.json"]))' % (TOOLS, td)], capture_output=True, text=True)
        assert r.returncode == 1 and 'FAIL sfx/manifest.json' in r.stdout and 'python3 sfx/build_library.py' in r.stdout
        assert os.path.exists(script)


def test_ignore_field_passes_a_sha_only_change_and_still_fails_a_measured_field():
    with tempfile.TemporaryDirectory() as td:
        _repo(td)
        path = os.path.join(td, 'sfx', 'manifest.json')
        with open(path, 'w') as f:                                       # another CPU: the shas moved by one LSB, nothing else
            json.dump({'sounds': [{'id': 'snd.elec.arc', 'sha': 'cccc'}]}, f, indent=1)
        assert check_generated.changed(['sfx/manifest.json'], root=td, ignore=['sha']) == []
        assert check_generated.changed(['sfx/manifest.json'], root=td)   # without the flag it is a change
        with open(path, 'w') as f:                                       # a recipe change: a measured field moved too
            json.dump({'sounds': [{'id': 'snd.elec.arc', 'sha': 'cccc', 'peak_dbfs': -7.0}]}, f, indent=1)
        bad = check_generated.changed(['sfx/manifest.json'], root=td, ignore=['sha'])
        assert len(bad) == 1 and 'outside sha' in bad[0][1]
