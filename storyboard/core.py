"""storyboard/core.py: inputs, the shot timeline, the platform safe rects and the spec.
Nothing here draws or encodes. Timeline: a shot starts on round(cumulative seconds x fps) and the animatic ends on round(total seconds x fps), so the shot lengths in frames
add up to the runtime to the frame (rounding each shot on its own drifts by up to half a frame per shot)."""
import ast
import json
import os
import re
import shutil
import subprocess
import sys

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
MANIFEST = json.load(open(os.path.join(PACK, 'storyboard', 'manifest.json'), encoding='utf-8'))
SPEC = MANIFEST['spec']
LINT = os.path.join(PACK, 'skills', 'story-script', 'scripts', 'lint_shotlist.py')
FONT_DIR = os.path.join(PACK, 'templates', '_shared', 'fonts')


def load_json(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def words(s):
    return len([w for w in re.split(r'\s+', (s or '').strip()) if w])


def plain(text):
    """the on-screen text without the `*accent*` markers a design.json end card uses"""
    return (text or '').replace('*', '')


# ---------------------------------------------------------------------------------------------------------------- aspect
def aspect_key(aspect):
    a = (aspect or '16:9').replace(' ', '')
    return a if a in SPEC['board']['canvas_px'] else 'other:' + a


def canvas_size(aspect):
    """(W, H) of the real canvas the design sizes refer to (px at 1080: the short side is 1080, 1080 x 1350 for 4:5)"""
    k = aspect_key(aspect)
    if k in SPEC['board']['canvas_px']:
        return tuple(SPEC['board']['canvas_px'][k])
    m = re.match(r'^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$', k[6:])
    w, h = (float(m.group(1)), float(m.group(2))) if m else (16.0, 9.0)
    return (round(1080 * w / h / 2) * 2, 1080) if w >= h else (1080, round(1080 * h / w / 2) * 2)


def board_size(aspect):
    k = aspect_key(aspect)
    if k in SPEC['board']['board_px']:
        return tuple(SPEC['board']['board_px'][k])
    W, H = canvas_size(aspect)
    s = 960.0 / max(W, H)
    return (round(W * s / 2) * 2, round(H * s / 2) * 2)


def is_tall(aspect):
    W, H = canvas_size(aspect)
    return H > W


# ---------------------------------------------------------------------------------------------------------------- timeline
def timeline(shots, fps):
    """one row per shot: start_s, dur_s, start_frame, frames. Boundaries are round(cumulative seconds x fps), so the frames add up to round(total x fps)."""
    rows, cum, b0 = [], 0.0, 0
    for s in shots:
        dur = float(s.get('dur_s') or 0)
        cum += dur
        b1 = int(round(cum * fps))
        rows.append({'id': s.get('id'), 'start_s': round(cum - dur, 6), 'dur_s': dur, 'start_frame': b0, 'frames': b1 - b0})
        b0 = b1
    return rows


def total_frames(shots, fps):
    return int(round(sum(float(s.get('dur_s') or 0) for s in shots) * fps))


def tc(frame, fps):
    """SMPTE-style HH:MM:SS:FF for a frame number (non-drop)"""
    fps_i = int(round(fps))
    s, f = divmod(int(frame), fps_i)
    return '%02d:%02d:%02d:%02d' % (s // 3600, s // 60 % 60, s % 60, f)


# ---------------------------------------------------------------------------------------------------------------- safe zones (single source: type/safezones.js)
_SAFE = {}


def safe_table():
    if 'SAFE' not in _SAFE:
        if shutil.which('node') is None:
            raise RuntimeError('node is required: the platform safe zones are read from type/safezones.js')
        js = "import('file://%s/type/safezones.js').then(m=>console.log(JSON.stringify(m.SAFE)))" % PACK
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError('cannot read type/safezones.js: ' + r.stderr[-300:])
        _SAFE['SAFE'] = json.loads(r.stdout)
    return _SAFE['SAFE']


def safe_rect(platform, W, H):
    """mirror of safeRect() in type/safezones.js (a test compares them): px rect of the safe area and its scale"""
    z = safe_table()[platform]
    s = H / (1920.0 if z['ref'] == 'tall' else 1080.0)
    x0, y0, x1, y1 = z['left'] * s, z['top'] * s, W - z['right'] * s, H - z['bottom'] * s
    return {'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1, 'w': x1 - x0, 'h': y1 - y0, 'scale': s, 'verify': bool(z.get('verify'))}


def lint_rect(rect, platform, W, H):
    """mirror of lintRect(): the sides of `rect` ({x0,y0,x1,y1} output px) that leave the safe area and by how many px"""
    r, out = safe_rect(platform, W, H), []
    if rect['x0'] < r['x0'] - 0.5:
        out.append({'side': 'left', 'px': round(r['x0'] - rect['x0'], 1)})
    if rect['x1'] > r['x1'] + 0.5:
        out.append({'side': 'right', 'px': round(rect['x1'] - r['x1'], 1)})
    if rect['y0'] < r['y0'] - 0.5:
        out.append({'side': 'top', 'px': round(r['y0'] - rect['y0'], 1)})
    if rect['y1'] > r['y1'] + 0.5:
        out.append({'side': 'bottom', 'px': round(rect['y1'] - r['y1'], 1)})
    return out


def pick_platform(design, aspect, override=None):
    """--safe, else the design's safe.zones_9x16 / zones_16x9, else the spec default. Unknown names are an error, never a silent fallback."""
    table = safe_table()
    tall = is_tall(aspect)
    name = override
    if not name and design:
        sf = design.get('safe') or {}
        name = sf.get('zones_9x16') if tall else sf.get('zones_16x9')
    if not name:
        name = SPEC['board']['default_safe']['tall' if tall else 'other']
    if name not in table:
        raise ValueError('unknown safe zone "%s"; known: %s' % (name, ', '.join(sorted(table))))
    return name


def lint_defaults(doc):
    """the linter's own thresholds, so the reading-speed check can never disagree with it: its DEFAULTS, overridden by shotlist.json lint{}"""
    src = open(LINT, encoding='utf-8').read()
    m = re.search(r'^DEFAULTS = (\{.*?^\})', src, re.S | re.M)
    L = dict(ast.literal_eval(m.group(1)))
    L.update(doc.get('lint') or {})
    return L


def run_lint(shotlist_path):
    """run the story-script linter. returns {rc, findings:[{level, msg}], summary}"""
    r = subprocess.run([sys.executable, '-I', LINT, shotlist_path], capture_output=True, text=True)
    findings, summary = [], ''
    for line in r.stdout.splitlines():
        m = re.match(r'^(FAIL|WARN)\s+(.*)$', line)
        if m:
            findings.append({'level': m.group(1), 'msg': m.group(2)})
        elif line.strip():
            summary = line.strip()
    return {'rc': r.returncode, 'findings': findings, 'summary': summary}
