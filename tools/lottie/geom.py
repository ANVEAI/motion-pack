"""motion-pack / tools / lottie / geom.py: outlines as Lottie bezier shapes. Pure Python.

    subpaths_from_d('M0 0 L10 0 ...') -> [Sub]       an SVG path `d` (M L H V C S Q T A Z, absolute and relative; arcs become cubics)
    svg_elements(svg_text) -> [(tag, [Sub], attrs)]  path / line / polyline / polygon / circle / ellipse / rect of an SVG, plus the viewBox
    glyph_runs(text, font_file, size_px, weight) -> laid-out glyph outlines (fontTools; advance widths, no kerning)
    to_lottie(sub, tf) -> {'c', 'v', 'i', 'o'}       one closed or open bezier in Lottie form (tangents relative to their vertex)

A Sub is {'start': (x, y), 'segs': [((c1x, c1y), (c2x, c2y), (x, y)), ...], 'closed': bool}; every segment is a cubic (lines have their
control points on the line), so one shape type covers everything."""
import math
import re
import xml.etree.ElementTree as ET

_TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def _line(p, q):
    return ((p[0] + (q[0] - p[0]) / 3, p[1] + (q[1] - p[1]) / 3), (p[0] + 2 * (q[0] - p[0]) / 3, p[1] + 2 * (q[1] - p[1]) / 3), q)


def _quad(p, c, q):
    return ((p[0] + 2 / 3 * (c[0] - p[0]), p[1] + 2 / 3 * (c[1] - p[1])), (q[0] + 2 / 3 * (c[0] - q[0]), q[1] + 2 / 3 * (c[1] - q[1])), q)


def _arc(p, rx, ry, phi, large, sweep, q):
    """SVG elliptical arc -> cubic segments (endpoint to centre parameterisation, SVG 1.1 implementation notes F.6)"""
    if p == q:
        return []
    if rx == 0 or ry == 0:
        return [_line(p, q)]
    rx, ry = abs(rx), abs(ry)
    cp, sp = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    dx, dy = (p[0] - q[0]) / 2, (p[1] - q[1]) / 2
    x1, y1 = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = x1 ** 2 / rx ** 2 + y1 ** 2 / ry ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx ** 2 * ry ** 2 - rx ** 2 * y1 ** 2 - ry ** 2 * x1 ** 2
    den = rx ** 2 * y1 ** 2 + ry ** 2 * x1 ** 2
    co = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        co = -co
    cx1, cy1 = co * rx * y1 / ry, -co * ry * x1 / rx
    cx, cy = cp * cx1 - sp * cy1 + (p[0] + q[0]) / 2, sp * cx1 + cp * cy1 + (p[1] + q[1]) / 2

    def ang(u, v):
        a = math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
        return a
    t1 = ang((1, 0), ((x1 - cx1) / rx, (y1 - cy1) / ry))
    dt = ang(((x1 - cx1) / rx, (y1 - cy1) / ry), ((-x1 - cx1) / rx, (-y1 - cy1) / ry))
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(1, int(math.ceil(abs(dt) / (math.pi / 2) - 1e-9)))
    d = dt / n
    k = 4 / 3 * math.tan(d / 4)
    segs, a = [], t1

    def pt(t):
        x, y = rx * math.cos(t), ry * math.sin(t)
        return (cp * x - sp * y + cx, sp * x + cp * y + cy)

    def dv(t):
        x, y = -rx * math.sin(t), ry * math.cos(t)
        return (cp * x - sp * y, sp * x + cp * y)
    for _ in range(n):
        b = a + d
        p0, p3, d0, d3 = pt(a), pt(b), dv(a), dv(b)
        segs.append(((p0[0] + k * d0[0], p0[1] + k * d0[1]), (p3[0] - k * d3[0], p3[1] - k * d3[1]), p3))
        a = b
    segs[-1] = (segs[-1][0], segs[-1][1], q)
    return segs


def subpaths_from_d(d):
    toks = _TOK.findall(d or '')
    subs, cur, pos, start, cmd, last_c, i = [], None, (0.0, 0.0), (0.0, 0.0), None, None, 0

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v
    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd in 'Zz':
                if cur is not None:
                    if pos != start:
                        cur['segs'].append(_line(pos, start))
                    cur['closed'] = True
                    pos = start
                    cur = None
                last_c = None
                continue
        if cmd is None:
            raise ValueError('path data must start with a command')
        rel = cmd.islower()
        C = cmd.upper()
        ox, oy = pos if rel else (0.0, 0.0)
        if C == 'M':
            pos = (ox + num(), oy + num())
            start = pos
            cur = {'start': pos, 'segs': [], 'closed': False}
            subs.append(cur)
            cmd = 'l' if rel else 'L'
            last_c = None
            continue
        if cur is None:                                                  # drawing after Z continues from the last start point
            cur = {'start': pos, 'segs': [], 'closed': False}
            subs.append(cur)
        if C == 'L':
            q = (ox + num(), oy + num())
            cur['segs'].append(_line(pos, q))
            last_c = None
        elif C == 'H':
            q = ((pos[0] if rel else 0.0) + num(), pos[1])
            cur['segs'].append(_line(pos, q))
            last_c = None
        elif C == 'V':
            q = (pos[0], (pos[1] if rel else 0.0) + num())
            cur['segs'].append(_line(pos, q))
            last_c = None
        elif C == 'C':
            c1, c2, q = (ox + num(), oy + num()), (ox + num(), oy + num()), (ox + num(), oy + num())
            cur['segs'].append((c1, c2, q))
            last_c = ('c', c2)
        elif C == 'S':
            c1 = (2 * pos[0] - last_c[1][0], 2 * pos[1] - last_c[1][1]) if last_c and last_c[0] == 'c' else pos
            c2, q = (ox + num(), oy + num()), (ox + num(), oy + num())
            cur['segs'].append((c1, c2, q))
            last_c = ('c', c2)
        elif C == 'Q':
            c, q = (ox + num(), oy + num()), (ox + num(), oy + num())
            cur['segs'].append(_quad(pos, c, q))
            last_c = ('q', c)
        elif C == 'T':
            c = (2 * pos[0] - last_c[1][0], 2 * pos[1] - last_c[1][1]) if last_c and last_c[0] == 'q' else pos
            q = (ox + num(), oy + num())
            cur['segs'].append(_quad(pos, c, q))
            last_c = ('q', c)
        elif C == 'A':
            rx, ry, phi, la, sw = num(), num(), num(), num(), num()
            q = (ox + num(), oy + num())
            cur['segs'].extend(_arc(pos, rx, ry, phi, int(la), int(sw), q))
            last_c = None
        else:
            raise ValueError('unsupported path command %s' % cmd)
        pos = cur['segs'][-1][2] if cur['segs'] else pos
    return [s for s in subs if s['segs']]


def _nums(s):
    return [float(x) for x in re.findall(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', s or '')]


def ellipse(cx, cy, rx, ry):
    k = 0.5522847498307936
    p = [(cx + rx, cy), (cx, cy + ry), (cx - rx, cy), (cx, cy - ry)]
    segs = []
    for a in range(4):
        p0, p1 = p[a], p[(a + 1) % 4]
        t0 = (-(p0[1] - cy) / ry * rx, (p0[0] - cx) / rx * ry)
        t1 = (-(p1[1] - cy) / ry * rx, (p1[0] - cx) / rx * ry)
        segs.append(((p0[0] + k * t0[0], p0[1] + k * t0[1]), (p1[0] - k * t1[0], p1[1] - k * t1[1]), p1))
    return {'start': p[0], 'segs': segs, 'closed': True}


def svg_elements(text):
    """[(tag, [Sub], attrs)] in document order and the viewBox (x, y, w, h). Element transforms are NOT applied: run the icon through SVGO
    (the motion-stack draw-on-safe config) first, which bakes them; an element that still has one is reported."""
    root = ET.fromstring(text)
    vb = _nums(root.get('viewBox')) or [0, 0, float(_nums(root.get('width'))[0] if root.get('width') else 24), float(_nums(root.get('height'))[0] if root.get('height') else 24)]
    inherit = {k: root.get(k) for k in ('fill', 'stroke', 'stroke-width') if root.get(k) is not None}
    out = []
    for el in root.iter():
        tag = el.tag.split('}')[-1]
        a = {**inherit, **{k: v for k, v in el.attrib.items()}}
        if tag == 'g':
            continue
        if tag == 'path':
            subs = subpaths_from_d(el.get('d'))
        elif tag == 'line':
            p, q = (float(el.get('x1', 0)), float(el.get('y1', 0))), (float(el.get('x2', 0)), float(el.get('y2', 0)))
            subs = [{'start': p, 'segs': [_line(p, q)], 'closed': False}]
        elif tag in ('polyline', 'polygon'):
            n = _nums(el.get('points'))
            pts = list(zip(n[0::2], n[1::2]))
            if len(pts) < 2:
                continue
            segs = [_line(pts[k], pts[k + 1]) for k in range(len(pts) - 1)]
            if tag == 'polygon':
                segs.append(_line(pts[-1], pts[0]))
            subs = [{'start': pts[0], 'segs': segs, 'closed': tag == 'polygon'}]
        elif tag == 'circle':
            r = float(el.get('r', 0))
            subs = [ellipse(float(el.get('cx', 0)), float(el.get('cy', 0)), r, r)]
        elif tag == 'ellipse':
            subs = [ellipse(float(el.get('cx', 0)), float(el.get('cy', 0)), float(el.get('rx', 0)), float(el.get('ry', 0)))]
        elif tag == 'rect':
            x, y, w, h = (float(el.get(k, 0)) for k in ('x', 'y', 'width', 'height'))
            pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
            subs = [{'start': pts[0], 'segs': [_line(pts[k], pts[(k + 1) % 4]) for k in range(4)], 'closed': True}]
            if el.get('rx') or el.get('ry'):
                a['_note'] = 'rect corner radius ignored'
        else:
            continue
        if el.get('transform'):
            a['_note'] = 'element transform not applied (bake it with SVGO first)'
        out.append((tag, subs, a))
    return out, tuple(vb[:4])


def to_lottie(sub, tf=lambda p: p):
    """Lottie bezier {c, v, i, o}: v = vertices, o[k] = out tangent of vertex k, i[k] = in tangent, both relative to the vertex"""
    v = [tf(sub['start'])]
    o, i = [], [[0.0, 0.0]]
    for c1, c2, q in sub['segs']:
        a, b, qq = tf(c1), tf(c2), tf(q)
        o.append([a[0] - v[-1][0], a[1] - v[-1][1]])
        v.append(qq)
        i.append([b[0] - qq[0], b[1] - qq[1]])
    o.append([0.0, 0.0])
    closed = sub['closed']
    if closed and len(v) > 1 and abs(v[-1][0] - v[0][0]) < 1e-6 and abs(v[-1][1] - v[0][1]) < 1e-6:
        i[0] = i[-1]
        v, i, o = v[:-1], i[:-1], o[:-1]
    r = lambda p: [round(p[0], 3), round(p[1], 3)]                    # noqa: E731
    return {'c': bool(closed), 'v': [r(p) for p in v], 'i': [r(p) for p in i], 'o': [r(p) for p in o]}


# ------------------------------------------------------------------------------------------------ glyphs
_FONTS = {}


def _font(path, weight):
    key = (path, weight)
    if key not in _FONTS:
        from fontTools.ttLib import TTFont
        f = TTFont(path)
        if 'fvar' in f:
            from fontTools.varLib.instancer import instantiateVariableFont
            axes = {a.axisTag: a for a in f['fvar'].axes}
            loc = {'wght': max(axes['wght'].minValue, min(axes['wght'].maxValue, weight))} if 'wght' in axes else {}
            f = instantiateVariableFont(f, loc) if loc else f
        _FONTS[key] = f
    return _FONTS[key]


def glyph_subs(font, gname):
    from fontTools.pens.basePen import BasePen

    class Pen(BasePen):
        def __init__(self, gs):
            super().__init__(gs)
            self.subs, self.cur = [], None

        def _moveTo(self, p):
            self.cur = {'start': p, 'segs': [], 'closed': False}
            self.subs.append(self.cur)

        def _lineTo(self, p):
            self.cur['segs'].append(_line(self._getCurrentPoint(), p))

        def _curveToOne(self, a, b, c):
            self.cur['segs'].append((a, b, c))

        def _qCurveToOne(self, a, b):
            self.cur['segs'].append(_quad(self._getCurrentPoint(), a, b))

        def _closePath(self):
            if self.cur['segs'] and self.cur['segs'][-1][2] != self.cur['start']:
                self.cur['segs'].append(_line(self._getCurrentPoint(), self.cur['start']))
            self.cur['closed'] = True

        def _endPath(self):
            pass
    gs = font.getGlyphSet()
    pen = Pen(gs)
    gs[gname].draw(pen)
    return [s for s in pen.subs if s['segs']], gs[gname].width


def layout(text, font_file, size, weight=800):
    """one line of text: [{'ch', 'x0', 'x1', 'subs' (font units, y up)}] with x in px from the line start, plus the em scale and metrics (px)"""
    f = _font(font_file, weight)
    cmap = f.getBestCmap()
    upm = f['head'].unitsPerEm
    k = size / float(upm)
    hh = f['hhea']
    out, x = [], 0.0
    for ch in text:
        g = cmap.get(ord(ch)) or '.notdef'
        subs, adv = glyph_subs(f, g)
        out.append({'ch': ch, 'x0': x, 'x1': x + adv * k, 'subs': subs})
        x += adv * k
    return out, {'k': k, 'ascent': hh.ascent * k, 'descent': hh.descent * k, 'width': x}
