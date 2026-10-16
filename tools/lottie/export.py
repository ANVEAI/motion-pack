#!/usr/bin/env python3
"""motion-pack / tools / lottie / export.py: export a SUBSET of the pack's 2D type and graphics parts to Lottie JSON for apps and websites.

    python3 tools/lottie/export.py tools/lottie/examples/title.json -o out/title.lottie.json [--allow-lossy] [--validate]
    python3 tools/lottie/export.py --matrix          # which kinetic-type presets export exactly, lossily, or not at all (measured, not claimed)

How: tools/lottie/sample.mjs samples the pack's own pure functions of t at the frame rate (type/presets.js unitStates, the drawOnAt maths of
type/gfx/drawon.js, type/ease.js springTrack and eases); this file turns the samples into Lottie keyframes (linear between frame samples,
redundant keys removed within a tolerance) on shape layers whose outlines come from the bundled OFL font (fontTools) or an SVG.

Spec (JSON): {w, h, fps, seconds, name?, background?, layers: [...]}, layers bottom to top:
  {"type": "text", "text", "preset", "at", "out"?, "params"?, "size", "weight"?, "font"?, "color", "pos": [x, y], "align": "left|center", "tracking"?}
  {"type": "drawon", "svg": "icon.svg", "at", "dur", "stagger"?, "ease"?, "mode"?, "fillAfter"?, "pos": [cx, cy], "size", "stroke", "width"}
  {"type": "shape", "shape": "rect|ellipse|path", "size": [w, h], "d"?, "radius"?, "fill"?, "stroke"?, "width"?, "pos": [x, y],
   "track": {"cls": "ui", "x": [[t, v], ...], "y", "scale", "rot", "opacity"}  or  "keys": {"x": [{"t", "v", "ease"}], ...}}
What cannot export (blur, 3D flips, variable weight, glyph scrambles, RGB split, outline fills, kerning) is listed per preset by --matrix and
reported (or refused without --allow-lossy) per export."""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
import geom                                    # noqa: E402

FONT = os.path.join(PACK, 'templates', '_shared', 'fonts', 'Manrope-Variable.ttf')
DROP = {'blur': 0.0, 'rotX': 0.0, 'track': 0.0, 'wght': None, 'glyph': None, 'rgb': 0.0, 'fill': None, 'stroke': None}
WHY = {'blur': 'Lottie spec 1.0 has no blur effect (layer effects are outside the spec)', 'rotX': '3D rotation needs 3D layers, outside the spec',
       'track': 'letter-spacing animation would need per-glyph layers inside a line unit', 'wght': 'variable-font weight is not animatable on outlines',
       'glyph': 'scrambled glyphs swap the outline every frame', 'rgb': 'the RGB split is a blend-mode effect', 'fill': 'outline-to-fill needs stroke + fill per glyph (not built yet)',
       'stroke': 'outline-to-fill needs stroke + fill per glyph (not built yet)'}
EPS = {'p': 0.05, 's': 0.05, 'r': 0.05, 'o': 0.1, 'e': 0.05, 'mask': 0.05}


class ExportError(Exception):
    pass


def sample(fps, frames, items):
    r = subprocess.run(['node', os.path.join(HERE, 'sample.mjs')], input=json.dumps({'fps': fps, 'frames': frames, 'items': items}), capture_output=True, text=True)
    if r.returncode:
        raise ExportError('sampler failed: ' + r.stderr.strip()[-400:])
    return json.loads(r.stdout)['items']


# ------------------------------------------------------------------------------------------------ keyframes
def _close(a, b, eps):
    return all(abs(x - y) <= eps for x, y in zip(a, b))


def prop(values, eps, as_list=True):
    """per-frame samples (numbers or lists) -> a Lottie property: static when constant, else linear keyframes with every key kept that a
    straight line from the last kept key cannot reproduce within eps at the frames in between"""
    vals = [list(v) if isinstance(v, (list, tuple)) else [float(v)] for v in values]
    if all(_close(v, vals[0], eps) for v in vals):
        k = vals[0]
        return {'a': 0, 'k': [round(x, 4) for x in k] if as_list else round(k[0], 4)}
    keep, a = [0], 0
    n = len(vals)
    b = a + 1
    while b < n:
        if b + 1 < n:
            c = b + 1
            ok = all(_close(vals[m], [vals[a][j] + (vals[c][j] - vals[a][j]) * (m - a) / (c - a) for j in range(len(vals[a]))], eps) for m in range(a + 1, c))
            if ok:
                b = c
                continue
        keep.append(b)
        a, b = b, b + 1
    keys = []
    lin = {'i': {'x': [1], 'y': [1]}, 'o': {'x': [0], 'y': [0]}}
    for idx, f in enumerate(keep):
        kf = {'t': f, 's': [round(x, 4) for x in vals[f]]}
        if idx + 1 < len(keep):
            kf.update(lin)
        keys.append(kf)
    return {'a': 1, 'k': keys}


def value_at(p, f):
    """evaluate a property written by prop() at frame f (linear keys): the round-trip check the tests use"""
    if not p['a']:
        return p['k'] if isinstance(p['k'], list) else [p['k']]
    ks = p['k']
    if f <= ks[0]['t']:
        return ks[0]['s']
    for a, b in zip(ks, ks[1:]):
        if a['t'] <= f <= b['t']:
            u = (f - a['t']) / float(b['t'] - a['t'])
            return [x + (y - x) * u for x, y in zip(a['s'], b['s'])]
    return ks[-1]['s']


def color(h, alpha=1.0):
    h = h.lstrip('#')
    return [round(int(h[i:i + 2], 16) / 255.0, 4) for i in (0, 2, 4)] + [alpha]


def static_ks():
    return {'a': {'a': 0, 'k': [0, 0]}, 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0}, 'o': {'a': 0, 'k': 100}}


def rect_path(x0, y0, x1, y1):
    return {'c': True, 'v': [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 'i': [[0, 0]] * 4, 'o': [[0, 0]] * 4}


def shape_layer(name, shapes, frames, ind, masks=None, ip=0):
    L = {'ty': 4, 'nm': name, 'ind': ind, 'ip': ip, 'op': frames, 'st': 0, 'ks': static_ks(), 'shapes': shapes}
    if masks:
        L['masksProperties'] = masks
        L['hasMask'] = True                                               # lottie-web applies masksProperties only when this flag is set
    return L


def group(items, tr):
    return {'ty': 'gr', 'nm': 'group', 'it': items + [dict({'ty': 'tr'}, **tr)]}


# ------------------------------------------------------------------------------------------------ parts
def text_units(L, unit):
    """lines -> animation units (word | char | line) with x0, x1 (px, line-relative) and their glyphs, like type/render-canvas.js toUnits"""
    lines = []
    for li, line in enumerate(L['text'].split('\n')):
        glyphs, m = geom.layout(line, L.get('font') and os.path.join(PACK, L['font']) or FONT, L['size'], L.get('weight', 800))
        tr = L.get('tracking', -0.035) * L['size']
        x = 0.0
        for g in glyphs:                                                   # canvas letterSpacing: tracking after every character
            w = g['x1'] - g['x0']
            g['x0'], g['x1'] = x, x + w
            x += w + tr
        lines.append((li, glyphs, x, m))
    units = []
    for li, glyphs, width, m in lines:
        if unit == 'line':
            gs = [g for g in glyphs if g['ch'].strip()]
            if gs:
                units.append({'text': ''.join(g['ch'] for g in glyphs).strip(), 'line': li, 'glyphs': gs, 'width': width, 'm': m})
            continue
        cur = []
        for g in glyphs + [{'ch': ' '}]:
            if g['ch'].strip():
                cur.append(g)
            elif cur:
                if unit == 'word':
                    units.append({'text': ''.join(x['ch'] for x in cur), 'line': li, 'glyphs': cur, 'width': width, 'm': m})
                else:
                    units += [{'text': x['ch'], 'line': li, 'glyphs': [x], 'width': width, 'm': m} for x in cur]
                cur = []
    for u in units:
        u['x0'], u['x1'] = u['glyphs'][0]['x0'], u['glyphs'][-1]['x1']
    return units


def build_text(L, smp, frames, W, H, ind0):
    units, states = L['_units'], smp['states']
    size, S = L['size'], H / 1080.0
    dropped = {}
    for row in states:
        for s in row:
            for k, neutral in DROP.items():
                v = s.get(k)
                if (neutral is None and v is not None) or (neutral is not None and v is not None and abs(float(v) - neutral) > 1e-4):
                    dropped[k] = WHY[k]
    lh = 1.0 * size
    ax, ay = L['pos']
    fps = L['_fps']
    win = smp.get('window') or [0, None]
    ip = max(0, int(round(float(win[0]) * fps)))                          # the text is a timed clip: in at `at`, out after its exit (if it has one)
    op = frames if ('out' not in L or win[1] is None) else min(frames, int(round(float(win[1]) * fps)) + 1)
    layers = []
    for i, u in enumerate(units):
        width = u['width']
        off = -width / 2 if L.get('align', 'center') == 'center' else 0.0
        bx = ax + off + u['x0']
        uw = u['x1'] - u['x0']
        top = ay + u['line'] * lh * 1.1
        by = top + size * 0.98
        cx, cy = bx + uw / 2, by - size * 0.36
        k = u['m']['k']
        shapes = []
        for g in u['glyphs']:
            gx = ax + off + g['x0']
            for sub in g['subs']:
                shapes.append({'ty': 'sh', 'ks': {'a': 0, 'k': geom.to_lottie(sub, lambda p, gx=gx: (gx + p[0] * k, by - p[1] * k))}})
        col = L.get('color', '#FFFFFF')
        shapes.append({'ty': 'fl', 'c': {'a': 0, 'k': color(col)}, 'o': {'a': 0, 'k': 100}, 'r': 1})
        P = [[cx + s[i]['x'] * size + s[i]['shake'][0] * S, cy + s[i]['y'] * size + s[i]['shake'][1] * S] for s in states]
        tr = {'a': {'a': 0, 'k': [round(cx, 3), round(cy, 3)]}, 'p': prop(P, EPS['p']), 's': prop([[s[i]['scale'] * 100] * 2 for s in states], EPS['s']),
              'r': prop([s[i]['rot'] for s in states], EPS['r'], False), 'o': prop([max(0.0, min(1.0, s[i]['opacity'])) * 100 for s in states], EPS['o'], False)}
        masks = []
        if smp.get('mask') == 'line':
            masks.append({'mode': 'a', 'inv': False, 'o': {'a': 0, 'k': 100}, 'x': {'a': 0, 'k': 0},
                          'pt': {'a': 0, 'k': rect_path(round(bx - size * 0.2, 3), round(top, 3), round(bx + uw + size * 0.2, 3), round(top + size * 1.12, 3))}})
        clips = [s[i]['clip'] for s in states]
        if any(c < 1 - 1e-4 for c in clips):
            x0, w = bx - size * 0.2, uw + size * 0.4
            y0, y1 = top - size * 0.2, top + size * 1.4
            p = prop([[x0 + w * c] for c in clips], EPS['mask'])
            if p['a']:
                pt = {'a': 1, 'k': [dict({kk: vv for kk, vv in kf.items() if kk != 's'}, s=[rect_path(round(x0, 3), round(y0, 3), round(kf['s'][0], 3), round(y1, 3))]) for kf in p['k']]}
            else:
                pt = {'a': 0, 'k': rect_path(round(x0, 3), round(y0, 3), round(p['k'][0], 3), round(y1, 3))}
            masks.append({'mode': 'a', 'inv': False, 'o': {'a': 0, 'k': 100}, 'x': {'a': 0, 'k': 0}, 'pt': pt})   # lottie-web reads x (expansion)
        layers.append(shape_layer('%s unit %d: %s' % (L['preset'], i, u['text']), [group(shapes, tr)], op, ind0 + i, masks, ip))
    return layers, dropped


def build_drawon(L, smp, frames, ind):
    els, vb = L['_els']
    sc = L['size'] / float(max(vb[2], vb[3]))
    cx, cy = L['pos']
    ox, oy = cx - vb[2] * sc / 2 - vb[0] * sc, cy - vb[3] * sc / 2 - vb[1] * sc
    tf = lambda p: (ox + p[0] * sc, oy + p[1] * sc)                       # noqa: E731
    groups, notes = [], []
    for j, (tag, subs, a) in enumerate(els):
        if a.get('_note'):
            notes.append('%s: %s' % (tag, a['_note']))
        items = [{'ty': 'sh', 'ks': {'a': 0, 'k': geom.to_lottie(s, tf)}} for s in subs]
        items.append({'ty': 'tm', 's': {'a': 0, 'k': 0}, 'e': prop([row[j] * 100 for row in smp['k']], EPS['e'], False), 'o': {'a': 0, 'k': 0}, 'm': 2})
        stroke = L.get('stroke') or (a.get('stroke') if a.get('stroke', 'none') not in ('none', 'currentColor') else '#FFFFFF')
        items.append({'ty': 'st', 'c': {'a': 0, 'k': color(stroke)}, 'o': {'a': 0, 'k': 100}, 'w': {'a': 0, 'k': L.get('width', 2) * 1.0}, 'lc': 2, 'lj': 2})
        fill = a.get('fill')
        if fill and fill not in ('none', 'currentColor') and L.get('fillAfter', 0) > 0:
            items.append({'ty': 'fl', 'c': {'a': 0, 'k': color(fill)}, 'o': prop([row[j] * 100 for row in smp['fill']], EPS['o'], False), 'r': 1})
        groups.append(group(items, {'a': {'a': 0, 'k': [0, 0]}, 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0}, 'o': {'a': 0, 'k': 100}}))
    return [shape_layer('drawon: %s' % os.path.basename(L.get('svg', 'inline')), groups, frames, ind)], notes


def build_shape(L, smp, frames, ind):
    w, h = L.get('size', [100, 100])
    if L.get('shape') == 'ellipse':
        geo = [{'ty': 'el', 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [w, h]}}]
    elif L.get('shape') == 'path':
        geo = [{'ty': 'sh', 'ks': {'a': 0, 'k': geom.to_lottie(s)}} for s in geom.subpaths_from_d(L['d'])]
    else:
        geo = [{'ty': 'rc', 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [w, h]}, 'r': {'a': 0, 'k': L.get('radius', 0)}}]
    if L.get('fill'):
        geo.append({'ty': 'fl', 'c': {'a': 0, 'k': color(L['fill'])}, 'o': {'a': 0, 'k': 100}, 'r': 1})
    if L.get('stroke'):
        geo.append({'ty': 'st', 'c': {'a': 0, 'k': color(L['stroke'])}, 'o': {'a': 0, 'k': 100}, 'w': {'a': 0, 'k': L.get('width', 2)}, 'lc': 2, 'lj': 2})
    pr = smp['props'] if smp else {}
    n = frames
    x = pr.get('x', [L['pos'][0]] * n)
    y = pr.get('y', [L['pos'][1]] * n)
    tr = {'a': {'a': 0, 'k': [0, 0]}, 'p': prop([[a, b] for a, b in zip(x, y)], EPS['p']), 's': prop([[v, v] for v in pr.get('scale', [100] * n)], EPS['s']),
          'r': prop(pr.get('rot', [0] * n), EPS['r'], False), 'o': prop(pr.get('opacity', [100] * n), EPS['o'], False)}
    return [shape_layer('shape: %s' % L.get('shape', 'rect'), [group(geo, tr)], frames, ind)]


# ------------------------------------------------------------------------------------------------ the document
def export(spec, allow_lossy=False):
    fps, W, H = float(spec.get('fps', 30)), int(spec['w']), int(spec['h'])
    frames = int(round(float(spec['seconds']) * fps))
    req = []
    for L in spec['layers']:
        L['_fps'] = fps
        if L['type'] == 'text':
            from_preset = sample(fps, 1, [{'kind': 'type', 'preset': L['preset'], 'at': 0, 'units': ['x']}])[0]['unit']
            L['_units'] = text_units(L, L.get('unit') or from_preset)
            req.append({'kind': 'type', 'preset': L['preset'], 'at': L.get('at', 0), 'units': [u['text'] for u in L['_units']],
                        **{k: L[k] for k in ('out', 'params', 'stagger', 'dur', 'noExit') if k in L}})
        elif L['type'] == 'drawon':
            txt = L.get('svgText') or open(os.path.join(PACK, L['svg']) if not os.path.isabs(L['svg']) else L['svg'], encoding='utf-8').read()
            L['_els'] = geom.svg_elements(txt)
            req.append({'kind': 'drawon', 'n': len(L['_els'][0]), **{k: L[k] for k in ('at', 'dur', 'stagger', 'ease', 'mode', 'fillAfter') if k in L}})
        elif L['type'] == 'shape':
            if L.get('track'):
                t = dict(L['track'])
                req.append({'kind': 'track', 'cls': t.pop('cls', 'ui'), 'props': t})
            else:
                req.append({'kind': 'eased', 'props': L.get('keys') or {}})
        else:
            raise ExportError('unknown layer type %s' % L['type'])
    smps = sample(fps, frames, req)
    layers, report = [], {'dropped': {}, 'notes': [], 'layers': 0, 'keyframes': 0}
    ind = 1
    for L, smp in zip(spec['layers'], smps):
        if L['type'] == 'text':
            ls, dropped = build_text(L, smp, frames, W, H, ind)
            if dropped:
                report['dropped'][L['preset']] = dropped
        elif L['type'] == 'drawon':
            ls, notes = build_drawon(L, smp, frames, ind)
            report['notes'] += notes
        else:
            ls = build_shape(L, smp, frames, ind)
        layers += ls
        ind += len(ls)
    if report['dropped'] and not allow_lossy:
        raise ExportError('these preset properties cannot be exported: %s (pass --allow-lossy to export without them)' %
                          '; '.join('%s: %s' % (p, ', '.join(sorted(d))) for p, d in report['dropped'].items()))
    if spec.get('background'):
        layers.insert(0, shape_layer('background', [group([{'ty': 'rc', 'p': {'a': 0, 'k': [W / 2, H / 2]}, 's': {'a': 0, 'k': [W, H]}, 'r': {'a': 0, 'k': 0}},
                                                           {'ty': 'fl', 'c': {'a': 0, 'k': color(spec['background'])}, 'o': {'a': 0, 'k': 100}, 'r': 1}],
                                                          {'a': {'a': 0, 'k': [0, 0]}, 'p': {'a': 0, 'k': [0, 0]}, 's': {'a': 0, 'k': [100, 100]}, 'r': {'a': 0, 'k': 0}, 'o': {'a': 0, 'k': 100}})],
                                     frames, ind))
    doc = {'v': '5.7.0', 'ver': 10001, 'nm': spec.get('name', 'motion-pack export'), 'fr': fps, 'ip': 0, 'op': frames, 'w': W, 'h': H, 'ddd': 0, 'assets': [],
           'layers': list(reversed(layers))}                                  # Lottie draws the first layer on top
    report['layers'] = len(doc['layers'])
    report['keyframes'] = json.dumps(doc).count('"t":')
    return doc, report


def matrix(fps=30):
    """per kinetic-type preset: which unsupported properties its own samples use (sampled from type/presets.js over 3 s of a 3-word line)"""
    sys.path.insert(0, HERE)
    r = subprocess.run(['node', '--input-type=module', '-e', "import {PRESET_IDS} from '%s'; console.log(JSON.stringify(PRESET_IDS))" % os.path.join(PACK, 'type', 'presets.js')],
                       capture_output=True, text=True, check=True)
    ids = json.loads(r.stdout)
    items = [{'kind': 'type', 'preset': p, 'at': 0.1, 'out': 2.0, 'units': ['One', 'two', 'three'], 'params': {'hits': [0.5]}} for p in ids]
    smps = sample(fps, int(3 * fps), items)
    out = {}
    for p, smp in zip(ids, smps):
        used = set()
        for row in smp['states']:
            for s in row:
                for k, neutral in DROP.items():
                    v = s.get(k)
                    if (neutral is None and v is not None) or (neutral is not None and v is not None and abs(float(v) - neutral) > 1e-4):
                        used.add(k)
        out[p] = {'export': 'exact' if not used else 'lossy', 'drops': sorted(used), 'unit': smp['unit'], 'mask': smp.get('mask')}
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('spec', nargs='?')
    ap.add_argument('-o', '--out')
    ap.add_argument('--allow-lossy', action='store_true')
    ap.add_argument('--validate', action='store_true', help='validate against the pinned Lottie spec schema (tools/lottie/validate.py)')
    ap.add_argument('--matrix', action='store_true')
    a = ap.parse_args(argv)
    if a.matrix:
        for p, r in matrix().items():
            print('%-18s %-6s unit=%-5s %s' % (p, r['export'], r['unit'], ('drops: ' + ', '.join(r['drops'])) if r['drops'] else ''))
        return 0
    spec = json.load(open(a.spec, encoding='utf-8'))
    try:
        doc, rep = export(spec, a.allow_lossy)
    except ExportError as e:
        print('lottie: %s' % e, file=sys.stderr)
        return 2
    out = a.out or os.path.splitext(a.spec)[0] + '.lottie.json'
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    json.dump(doc, open(out, 'w', encoding='utf-8'), separators=(',', ':'))
    print('lottie: %s  %d layers, %d keyframes, %.1f KB%s' % (out, rep['layers'], rep['keyframes'], os.path.getsize(out) / 1024.0,
                                                           ('; dropped ' + json.dumps(rep['dropped'])) if rep['dropped'] else ''))
    for n in rep['notes']:
        print('  note: ' + n)
    if a.validate:
        import validate
        errs = validate.validate(doc)
        print('schema: %s' % ('valid (lottie-spec %s)' % validate.VERSION if not errs else '%d errors' % len(errs)))
        for e in errs[:10]:
            print('  ' + e)
        return 1 if errs else 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
