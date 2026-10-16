#!/usr/bin/env python3
"""type/gfx/r78-glyphs.js lists the code-point ranges the bundled UI font (Manrope) can draw, so layout.pillWall can lint its labels without a browser. This test reads the
table out of the JS file and the cmap out of the font and fails when they differ (a font swap or a stale table). Needs fontTools (a dependency of matplotlib, in requirements.txt).
  python3 -m pytest -q tools/tests/test_pill_glyphs.py     the check
  python3 tools/tests/test_pill_glyphs.py --print          the line to paste into type/gfx/r78-glyphs.js"""
import os
import re
import sys

import pytest

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
JS = os.path.join(PACK, 'type', 'gfx', 'r78-glyphs.js')
FONT = os.path.join(PACK, 'templates', '_shared', 'fonts', 'Manrope-Variable.ttf')


def font_ranges():
    from fontTools.ttLib import TTFont
    cps = sorted(TTFont(FONT).getBestCmap().keys())
    out, s, p = [], cps[0], cps[0]
    for c in cps[1:]:
        if c == p + 1:
            p = c
            continue
        out.append([s, p])
        s = p = c
    out.append([s, p])
    return out


def js_ranges():
    src = open(JS, encoding='utf-8').read()
    m = re.search(r'export const MANROPE_RANGES = (\[\[.*?\]\]);', src, re.S)
    assert m, 'MANROPE_RANGES not found in type/gfx/r78-glyphs.js'
    return [[int(a), int(b)] for a, b in re.findall(r'\[(\d+), (\d+)\]', m.group(1))]


def test_the_table_is_the_fonts_cmap():
    pytest.importorskip('fontTools')
    assert js_ranges() == font_ranges()


def test_the_table_is_sorted_and_disjoint():
    r = js_ranges()
    assert r and all(a <= b for a, b in r) and all(r[i][1] < r[i + 1][0] - 0 for i in range(len(r) - 1))


if __name__ == '__main__':
    if '--print' in sys.argv:
        print('export const MANROPE_RANGES = ' + str(font_ranges()).replace('],', '],') + ';')
