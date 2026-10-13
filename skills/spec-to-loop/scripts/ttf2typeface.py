#!/usr/bin/env python3
"""spec-to-loop: pin a variable font to a weight (fontTools instancer), then bake chosen glyphs to a three.js typeface JSON.
usage: python3 ttf2typeface.py <font.ttf> <out.typeface.json> <chars> [--wght 800] [--axis wght=800 ...] [--save-ttf static.ttf]
The JSON is what FontLoader.parse() takes (resolution = unitsPerEm, ha = advance, o = 'm l q b' outline; y up, TrueType outers clockwise).
Put it next to the page (render.mjs serves the page's folder) and point CONFIG.font.url at it with a RELATIVE url. No kerning (the
template lays glyphs out by advance + trackingEm). Needs fontTools (pip install fonttools). Check the font's licence before you
ship its outlines in a public page."""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.basePen import BasePen
a = sys.argv[1:]
if len(a) < 3: sys.exit(__doc__)
src, out, chars = a[0], a[1], a[2]
axes, save = {}, None
i = 3
while i < len(a):
    if a[i] == '--wght': axes['wght'] = float(a[i + 1]); i += 2
    elif a[i] == '--axis': k, v = a[i + 1].split('='); axes[k] = float(v); i += 2
    elif a[i] == '--save-ttf': save = a[i + 1]; i += 2
    else: sys.exit('bad arg ' + a[i])
f = TTFont(src)
if 'fvar' in f and axes:
    f = instancer.instantiateVariableFont(f, axes)
if save: f.save(save)
gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f['head'].unitsPerEm
class P(BasePen):
    def __init__(s, g): super().__init__(g); s.o = []
    def _moveTo(s, p): s.o += ['m', p[0], p[1]]
    def _lineTo(s, p): s.o += ['l', p[0], p[1]]
    def _curveToOne(s, a, b, c): s.o += ['b', c[0], c[1], a[0], a[1], b[0], b[1]]      # cubic: end, c1, c2
    def _qCurveToOne(s, a, b): s.o += ['q', b[0], b[1], a[0], a[1]]                    # quadratic: end, control
    def _closePath(s): pass
r = lambda v: str(int(round(v))) if not isinstance(v, str) else v
glyphs = {}
for ch in sorted(set(chars) | {' '}):
    gn = cmap[ord(ch)]; p = P(gs); gs[gn].draw(p)
    adv = f['hmtx'][gn][0]; glyphs[ch] = {'ha': adv, 'x_min': 0, 'x_max': adv, 'o': ' '.join(r(v) for v in p.o)}
json.dump({'glyphs': glyphs, 'familyName': f['name'].getDebugName(1), 'ascender': f['hhea'].ascent, 'descender': f['hhea'].descent,
           'underlinePosition': -100, 'underlineThickness': 50, 'boundingBox': {'yMin': -500, 'xMin': -100, 'yMax': 2 * upm, 'xMax': 2 * upm},
           'resolution': upm, 'capHeightEm': f['OS/2'].sCapHeight / upm}, open(out, 'w'))
print(f'{out}: {len(glyphs)} glyphs, upm {upm}, cap height {f["OS/2"].sCapHeight / upm:.3f} em, axes {axes}')
