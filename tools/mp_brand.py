#!/usr/bin/env python3
"""motion-pack / tools / mp_brand.py: palette candidates from YOUR logo, measured, and a suggested accent / ink / paper for project.json (`mp brand`).

    python3 tools/mp_brand.py logo.svg|logo.png [--contrast skills/frame-design/scripts/contrast.py] [--json]

How it works (deterministic, standard library + Pillow):
  * SVG: every #hex and rgb() colour in fill / stroke / stop-color / style, weighted by how often it appears (a colour the logo uses once is a detail, not the brand).
  * PNG / JPG / WebP: opaque pixels only (alpha >= 128), downscaled to 160 px, median-cut to 8 colours, weighted by pixel share.
  * accent = the most chromatic candidate (CIELAB chroma x sqrt(share)) with L* between 20 and 85 (else the most chromatic at any L*, moved below); ink = the darkest near-neutral (L* < 25), else #111111;
    paper = the lightest (L* > 92), else #F5F2EA. A logo with no chromatic colour keeps the pack accent and says so.
  * then measured with frame-design's contrast.py (WCAG 2.x): ink on paper >= 4.5 (text), accent on paper >= 3 (large text and marks: the templates set
    accent words at >= 56 px bold), white on accent >= 3 (the CTA pill, large bold text). A failing accent is moved in L* to the nearest passing one (same hue),
    which is printed next to the logo's own colour: the logo is never recoloured, only the video palette.
Exit 0 = the suggested palette passes; 1 = it cannot pass (a fix is printed); 2 = bad input."""
import argparse
import importlib.util
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONTRAST = os.path.join(HERE, '..', 'skills', 'frame-design', 'scripts', 'contrast.py')
PACK_ACCENT, PACK_INK, PACK_PAPER = '#4A18ED', '#111111', '#F5F2EA'


def load_contrast(p):
    spec = importlib.util.spec_from_file_location('contrast', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def svg_colours(text):
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    out = {}
    for m in re.finditer(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b', text):
        h = m.group(1)
        h = ''.join(c * 2 for c in h) if len(h) == 3 else h
        out['#' + h.upper()] = out.get('#' + h.upper(), 0) + 1
    for m in re.finditer(r'rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', text):
        h = '#%02X%02X%02X' % tuple(min(255, int(x)) for x in m.groups())
        out[h] = out.get(h, 0) + 1
    for name, hx in (('black', '#000000'), ('white', '#FFFFFF')):
        n = len(re.findall(r'(?:fill|stroke|stop-color)\s*[:=]\s*["\']?%s\b' % name, text))
        if n:
            out[hx] = out.get(hx, 0) + n
    if not out:   # an SVG with no colour paints black by default
        out['#000000'] = 1
    tot = sum(out.values())
    return [(h, n / tot) for h, n in sorted(out.items(), key=lambda kv: (-kv[1], kv[0]))]


def raster_colours(path):
    from PIL import Image
    im = Image.open(path).convert('RGBA')
    im.thumbnail((160, 160))
    px = [p for p in im.getdata() if p[3] >= 128]
    if not px:
        raise SystemExit('mp brand: the image has no opaque pixels')
    rgb = Image.new('RGB', (len(px), 1))
    rgb.putdata([p[:3] for p in px])
    q = rgb.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal, counts = q.getpalette(), sorted(q.getcolors(), key=lambda c: (-c[0], c[1]))
    tot = sum(c for c, _ in counts)
    return [('#%02X%02X%02X' % tuple(pal[i * 3:i * 3 + 3]), c / tot) for c, i in counts]


def analyse(path, C):
    cands = svg_colours(open(path, encoding='utf-8', errors='replace').read()) if path.lower().endswith('.svg') else raster_colours(path)
    rows = []
    for hx, share in cands:
        L, a, b = C.rgb_to_lab(C.parse_hex(hx))
        rows.append({'hex': hx, 'share': round(share, 3), 'L': round(L, 1), 'chroma': round(math.hypot(a, b), 1)})
    chroma = [r for r in rows if r['chroma'] >= 20 and 20 <= r['L'] <= 85] or [r for r in rows if r['chroma'] >= 20]   # a pale or very dark brand colour still sets the hue; the fix below moves its L*
    accent_src = max(chroma, key=lambda r: (r['chroma'] * math.sqrt(r['share']), r['hex'])) if chroma else None
    darks = [r for r in rows if r['L'] < 25 and r['chroma'] < 25]
    lights = [r for r in rows if r['L'] > 92 and r['chroma'] < 12]   # paper is a near-neutral: a pale brand colour is an accent, not a background
    notes = []
    if accent_src is None:
        notes.append('the logo has no chromatic colour (chroma >= 20): the pack accent %s is kept; pick your own with mp set brand.accent' % PACK_ACCENT)
    accent = accent_src['hex'] if accent_src else PACK_ACCENT
    _, aa, ab = C.rgb_to_lab(C.parse_hex(accent))
    tint = lambda L, k: C.to_hex(C.lab_to_rgb((L, aa * k, ab * k)))   # a neutral pulled a little toward the accent hue, so ink and paper belong to the brand
    ink = min(darks, key=lambda r: (r['L'], r['hex']))['hex'] if darks else tint(11.0, 0.12)
    pure = [r for r in lights if r['hex'] not in ('#FFFFFF',)]
    paper = max(pure, key=lambda r: (r['L'], r['hex']))['hex'] if pure else tint(96.5, 0.05)   # pure white is harsh on a phone in a dark room: an off-white of the brand hue
    if not darks:
        notes.append('no near-black in the logo: ink %s is a near-black tinted toward the accent' % ink)
    if not pure:
        notes.append('no off-white in the logo: paper %s is an off-white tinted toward the accent (pure white glares on a phone)' % paper)
    if C.ratio(C.parse_hex(ink), C.parse_hex(paper)) < 4.5:
        notes.append('ink %s on paper %s is under 4.5:1: ink falls back to %s' % (ink, paper, PACK_INK))
        ink = PACK_INK
    fixed = accent
    for _ in range(4):   # accent on paper >= 3 and white on accent >= 3: move L* until both pass (same hue), at most a few steps
        p, w = C.parse_hex(fixed), (255, 255, 255)
        if C.ratio(p, C.parse_hex(paper)) < 3.0:
            s = C.suggest(p, C.parse_hex(paper), 3.0)
            fixed = s[1] if s else fixed
        elif C.ratio(w, p) < 3.0:
            s = C.suggest(p, w, 3.0)
            fixed = s[1] if s else fixed
        else:
            break
    if fixed != accent:
        notes.append('the logo colour %s fails contrast in video type; the nearest passing accent of the same hue is %s (your logo file is not changed)' % (accent, fixed))
    pairs = [('ink', ink, 'paper', paper, 4.5, 'text'), ('accent', fixed, 'paper', paper, 3.0, 'large text, marks'), ('white', '#FFFFFF', 'accent', fixed, 3.0, 'CTA pill text (large, bold)')]
    measured = [{'fg': f, 'fg_hex': fh, 'bg': b, 'bg_hex': bh, 'ratio': round(C.ratio(C.parse_hex(fh), C.parse_hex(bh)), 2), 'min': m, 'use': u} for f, fh, b, bh, m, u in pairs]
    for r in measured:
        r['pass'] = r['ratio'] >= r['min']
    return {'logo': os.path.abspath(path), 'candidates': rows, 'suggest': {'accent': fixed, 'ink': ink, 'paper': paper}, 'logo_accent': accent, 'contrast': measured,
            'pass': all(r['pass'] for r in measured), 'notes': notes}


def report(r):
    out = ['palette candidates from %s' % os.path.basename(r['logo'])]
    for c in r['candidates'][:8]:
        out.append('  %s  share %5.1f%%  L* %5.1f  chroma %5.1f' % (c['hex'], c['share'] * 100, c['L'], c['chroma']))
    s = r['suggest']
    out.append('suggested: accent %s  ink %s  paper %s' % (s['accent'], s['ink'], s['paper']))
    for p in r['contrast']:
        out.append('  %s %-8s on %-6s %5.2f:1 (needs %.1f, %s)' % ('ok  ' if p['pass'] else 'FAIL', p['fg'], p['bg'], p['ratio'], p['min'], p['use']))
    out += ['note: ' + n for n in r['notes']]
    out.append('apply: mp brand %s --write   (or mp set brand.accent "%s")' % (os.path.basename(r['logo']), s['accent']))
    return '\n'.join(out)


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('logo')
    ap.add_argument('--contrast', default=DEFAULT_CONTRAST)
    ap.add_argument('--json', action='store_true', help='machine-readable only')
    a = ap.parse_args(argv)
    if not os.path.isfile(a.logo):
        print('mp brand: no such file %s' % a.logo, file=sys.stderr)
        return 2
    if not re.search(r'\.(svg|png|jpe?g|webp)$', a.logo, re.I):
        print('mp brand: give an SVG, PNG, JPG or WebP logo', file=sys.stderr)
        return 2
    r = analyse(a.logo, load_contrast(a.contrast))
    r['report'] = report(r)
    print(json.dumps(r, indent=1))
    return 0 if r['pass'] else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
