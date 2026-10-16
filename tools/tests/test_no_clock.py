#!/usr/bin/env python3
"""CONTRIBUTING rule 1 as a gate: no clock and no unseeded random in the code that draws, moves or plans a frame (pytest, CI).
Scans every tracked .js / .mjs / .html file of the part modules (type, layers, camera, transitions/lib, objects, templates, terminal, physics) for
Math.random(), Date.now(), performance.now() and new Date(), outside comments. Demo pages and tests (timing a render is fine there), the renderer and
the build tools (tools/, wall-clock logs) and physics/bake.mjs (logs its bake time; the baked table is what ships) are out of scope.
Seeded generators (mulberry32, hashf, rng(seed)) are the way to vary things. Run: python3 -m pytest -q tools/tests"""
import os
import re
import subprocess

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCOPE = ('type/', 'layers/', 'camera/', 'transitions/lib/', 'objects/', 'templates/', 'terminal/', 'physics/')
SKIP = re.compile(r'(^|/)(demo|tests|qa)/|\.test\.mjs$|^physics/bake\.mjs$|^templates/[^/]+/out/')   # *.test.mjs: a test next to its template (templates/_explain, _hw) times its runs, like tests/
BAN = re.compile(r'\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(|\bnew\s+Date\s*\(')


def _code(src):
    """the source with /* */ and // comments blanked (line numbers kept)"""
    src = re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), src, flags=re.S)
    return [re.sub(r'(?<![:\'"\\])//.*$', '', ln) for ln in src.split('\n')]


def offenders(files):
    out = []
    for f in files:
        try:
            lines = _code(open(os.path.join(PACK, f), encoding='utf-8').read())
        except (OSError, UnicodeDecodeError):
            continue
        out += ['%s:%d: %s' % (f, i + 1, ln.strip()[:120]) for i, ln in enumerate(lines) if BAN.search(ln)]
    return out


def test_no_clock_or_unseeded_random_in_part_code():
    files = subprocess.run(['git', 'ls-files', '*.js', '*.mjs', '*.html'], cwd=PACK, capture_output=True, text=True, check=True).stdout.split()
    files = [f for f in files if f.startswith(SCOPE) and not SKIP.search(f)]
    assert len(files) > 100, 'scope matched only %d files' % len(files)
    bad = offenders(files)
    assert not bad, 'a part must be a pure function of t (CONTRIBUTING rule 1); use a seeded generator:\n' + '\n'.join(bad[:20])


def test_the_scanner_sees_through_comments_but_not_code():
    src = "const a = 1; // Math.random() in a comment\n/* Date.now() */ const b = Math.random();\nconst u = 'http://x'; performance.now();"
    lines = _code(src)
    assert not BAN.search(lines[0]) and BAN.search(lines[1]) and BAN.search(lines[2])
