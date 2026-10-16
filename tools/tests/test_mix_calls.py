#!/usr/bin/env python3
"""compose.mjs mix(planJson, wav, py, args): the third argument is the PYTHON executable. templates/talking-head/make.mjs used to pass '--stem' there, so the
build spawned `--stem` as a program and never made its stem. Every tracked make / build script must pass audio.py flags in the fourth argument, and mix() itself
must refuse a flag in the python slot (exit 2) instead of spawning it. Run: python3 -m pytest -q tools/tests"""
import os
import re
import subprocess

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CALL = re.compile(r"(?<![\w.])mix\(([^;]*?)\);")


def _calls():
    files = subprocess.run(['git', 'ls-files', '*.mjs'], cwd=PACK, capture_output=True, text=True, check=True).stdout.split()
    for f in files:
        src = open(os.path.join(PACK, f), encoding='utf-8').read()
        if 'mix' not in src or 'function mix' in src:
            continue
        for m in CALL.finditer(src):
            yield f, m.group(1)


def test_no_make_passes_an_audio_flag_as_the_python_executable():
    bad = [(f, a[:120]) for f, a in _calls() if re.search(r",\s*'--[a-z-]+'\s*$", a.strip())]
    assert not bad, 'mix() third argument is the python executable; pass flags as the fourth (args) argument: %s' % bad


def test_talking_head_asks_for_a_stem():
    src = open(os.path.join(PACK, 'templates', 'talking-head', 'make.mjs'), encoding='utf-8').read()
    assert re.search(r"mix\([^;]*\[\s*'--stem'\s*\]\s*\)", src), 'talking-head must mix a stem (--stem in the args list)'


def test_mix_refuses_a_flag_in_the_python_slot():
    js = "import('%s').then((m) => m.mix('nope.json', 'nope.wav', '--stem'))" % os.path.join(PACK, 'templates', '_shared', 'compose.mjs')
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60)
    assert r.returncode == 2 and 'python executable' in r.stderr, (r.returncode, r.stderr[-300:])
