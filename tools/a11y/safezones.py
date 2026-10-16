"""Platform safe rectangles for the Python tools, parsed from type/safezones.js so the JS table stays the only copy.

    rect(platform, W, H) -> dict(x0, y0, x1, y1, w, h, scale)      same maths as safeRect() in type/safezones.js
    default_platform(W, H, plan=None) -> the plan's own platform, else 'wideTitle' (16:9 / 1:1) or 'conservative' (9:16)

The per-platform rows in that file are working estimates flagged verify:true (the research sources conflict); `conservative` is their union."""
import os
import re

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(PACK, 'type', 'safezones.js')
_ROW = re.compile(r"^\s*([A-Za-z]\w*)\s*:\s*\{\s*ref:\s*'(tall|wide)'\s*,\s*top:\s*([\d.]+)\s*,\s*bottom:\s*([\d.]+)\s*,\s*left:\s*([\d.]+)\s*,\s*right:\s*([\d.]+)", re.M)
_CACHE = {}


def table(src=SRC):
    """{name: {ref, top, bottom, left, right}} from the SAFE object of type/safezones.js"""
    if src not in _CACHE:
        txt = open(src, encoding='utf-8').read()
        body = txt[txt.index('export const SAFE'):]
        body = body[:body.index('};')]
        rows = {m.group(1): {'ref': m.group(2), 'top': float(m.group(3)), 'bottom': float(m.group(4)), 'left': float(m.group(5)), 'right': float(m.group(6))}
                for m in _ROW.finditer(body)}
        if 'conservative' not in rows or 'wideTitle' not in rows:
            raise ValueError('could not parse the SAFE table of %s' % src)
        _CACHE[src] = rows
    return _CACHE[src]


PLAN_SRC = os.path.join(PACK, 'templates', '_shared', 'plan.mjs')
_PROW = re.compile(r"^\s*'([\w.]+)'\s*:\s*\{\s*aspect:\s*'(\w+)'\s*,\s*safe:\s*\{\s*top:\s*([\d.]+)\s*,\s*bottom:\s*([\d.]+)\s*,\s*side:\s*([\d.]+)", re.M)


def plan_table(src=PLAN_SRC):
    """{preset: {aspect, top, bottom, side}} (fractions of the frame) from the platform presets of templates/_shared/plan.mjs"""
    if src not in _CACHE:
        txt = open(src, encoding='utf-8').read() if os.path.exists(src) else ''
        _CACHE[src] = {m.group(1): {'aspect': m.group(2), 'top': float(m.group(3)), 'bottom': float(m.group(4)), 'side': float(m.group(5))} for m in _PROW.finditer(txt)}
    return _CACHE[src]


def resolve(platform, W, H):
    """a row of SAFE, a plan.mjs preset, or the aspect default ('conservative' for tall, 'wideTitle' otherwise)"""
    if platform in table() or platform in plan_table():
        return platform
    return 'conservative' if H > W else 'wideTitle'


def rect(platform, W, H):
    name = resolve(platform, W, H)
    if name in table():
        z = table()[name]
        s = H / (1920.0 if z['ref'] == 'tall' else 1080.0)
        x0, y0, x1, y1 = z['left'] * s, z['top'] * s, W - z['right'] * s, H - z['bottom'] * s
    else:
        z = plan_table()[name]
        s = min(W, H) / 1080.0
        x0, y0, x1, y1 = z['side'] * W, z['top'] * H, W - z['side'] * W, H - z['bottom'] * H
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'w': x1 - x0, 'h': y1 - y0, 'scale': s, 'platform': name}


def default_platform(W, H, plan=None):
    plan = plan or {}
    for key in ('safe', 'platform'):
        v = plan.get(key)
        if isinstance(v, str) and v:
            return resolve(v, W, H)
    scene = plan.get('scene') or {}
    if isinstance(scene.get('platform'), str):
        return resolve(scene['platform'], W, H)
    return 'conservative' if H > W else 'wideTitle'


def frame_size(plan, fallback=(1920, 1080)):
    """(W, H) of a plan: size, W/H, scene.W/H, aspect, else the fallback"""
    plan = plan or {}
    if isinstance(plan.get('size'), (list, tuple)) and len(plan['size']) == 2:
        return int(plan['size'][0]), int(plan['size'][1])
    if plan.get('W') and plan.get('H'):
        return int(plan['W']), int(plan['H'])
    sc = plan.get('scene') or {}
    if sc.get('W') and sc.get('H'):
        return int(sc['W']), int(sc['H'])
    asp = {'16:9': (1920, 1080), '9:16': (1080, 1920), '1:1': (1080, 1080), '4:5': (1080, 1350)}
    return asp.get(plan.get('aspect'), fallback)
