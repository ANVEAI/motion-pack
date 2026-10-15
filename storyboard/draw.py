"""storyboard/draw.py: lay out a shot's on-screen text at its real size and draw the board frame (PIL, no clock, no randomness).

The frame is laid out on the real canvas (1920 x 1080, 1080 x 1920, ...) with the design's fonts at the design's px sizes and then scaled to the board size, so a panel's text is as big
relative to the frame as it will be in the film, and the safe-zone check measures real px. A schematic frame is a DRAWING of the shot: a subject block sized by the shot scale,
the camera move as an arrow, the text, the honesty label and the platform safe zone. It is never the picture, and every panel says which it is (SCHEMATIC or COMPOSITION).
Fonts use FreeType's basic layout so the same inputs give the same pixels on every machine with the pinned Pillow."""
import os
import re

from PIL import Image, ImageDraw, ImageFont

from storyboard import core

HATCH_PHASE = 0                      # dash phase of the safe-zone outline (a constant: boards are reproducible)
INK, PAPER, ACCENT, MUTED = '#141414', '#F3F2EF', '#C2410C', '#5F5F5F'
CHIP_BG, CHIP_FG, CAM = '#141414', '#FFFFFF', '#1D4ED8'
DEFAULT_FONTS = {'display': ('Manrope-Variable.ttf', 800, 'Manrope'), 'text': ('Manrope-Variable.ttf', 600, 'Manrope'), 'mono': ('IBMPlexMono-SemiBold.ttf', 600, 'IBM Plex Mono')}
# scale label -> (subject height as a share of the frame height, anchored on the ground line?)
SCALES = {'EWS': (0.10, True), 'WS': (0.22, True), 'MWS': (0.34, True), 'MS': (0.46, True), 'MCU': (0.62, False), 'CU': (0.84, False), 'ECU': (1.15, False)}


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Fonts:
    """font roles (display, text, mono) from design.json type{}, with the pack's bundled OFL fonts as the fallback. `notes` says what fell back and why."""

    def __init__(self, design=None, design_dir=None):
        self.cache, self.notes, self.roles = {}, [], {}
        t = (design or {}).get('type') or {}
        for role, (fname, weight, family) in DEFAULT_FONTS.items():
            spec = t.get(role) or {}
            path, w, fam = os.path.join(core.FONT_DIR, fname), weight, family
            f = spec.get('file')
            if f:
                cands = [f] if os.path.isabs(f) else [os.path.join(core.PACK, f)] + ([os.path.join(design_dir, f)] if design_dir else [])
                hit = next((c for c in cands if os.path.exists(c)), None)
                if hit:
                    path, w, fam = hit, spec.get('weight', weight), spec.get('family', family)
                else:
                    self.notes.append('type.%s file "%s" not found: used the bundled %s' % (role, f, family))
            elif spec:
                self.notes.append('type.%s has no file: used the bundled %s' % (role, family))
            self.roles[role] = {'file': os.path.relpath(path, core.PACK) if path.startswith(core.PACK) else path, 'path': path, 'weight': w, 'family': fam}

    def get(self, role, size):
        r = self.roles[role]
        key = (role, int(round(size)))
        if key not in self.cache:
            f = ImageFont.truetype(r['path'], int(round(size)), layout_engine=ImageFont.Layout.BASIC)
            try:
                ax = f.get_variation_axes()
                f.set_variation_by_axes([max(ax[0]['minimum'], min(ax[0]['maximum'], r['weight']))])
            except (OSError, AttributeError):
                pass                                          # a static font has no weight axis
            self.cache[key] = f
        return self.cache[key]


class Ctx:
    """everything one board needs: canvas, board size, design, safe zone, palette, sizes"""

    def __init__(self, shotlist, design=None, design_dir=None, platform=None):
        self.aspect = shotlist.get('aspect') or '16:9'
        self.W, self.H = core.canvas_size(self.aspect)
        self.bw, self.bh = core.board_size(self.aspect)
        self.tall = self.H > self.W
        self.design = design or {}
        self.fonts = Fonts(design, design_dir)
        pal = self.design.get('palette') or {}
        self.paper, self.ink, self.accent, self.muted = pal.get('paper', PAPER), pal.get('ink', INK), pal.get('accent', ACCENT), pal.get('muted', MUTED)
        spec = core.SPEC['board']
        self.sizes = dict(spec['default_sizes_px_at_1080'])
        self.sizes.update(((self.design.get('type') or {}).get('sizes_px_at_1080')) or {})
        self.max_words = int(((self.design.get('type') or {}).get('max_words_per_line')) or 6)
        self.platform = platform
        self.safe = core.safe_rect(platform, self.W, self.H)
        self.line_height = spec['line_height']
        self.gap = spec['caption_gap_px'] * self.safe['scale']
        g = (self.design.get('grid') or {}).get(self.aspect) or {}
        self.hero_third = g.get('hero_third')


# ---------------------------------------------------------------------------------------------------------------- text
def _tokens(text):
    """words as lists of (piece, accent): `*word*` marks the accent word and punctuation glued to it stays on the same word"""
    out, prev_space = [], True
    for i, seg in enumerate(text.split('*')):
        accent = i % 2 == 1
        for j, part in enumerate(re.split(r'(\s+)', seg)):
            if not part:
                continue
            if part.isspace():
                prev_space = True
                continue
            if prev_space or not out:
                out.append([(part, accent)])
            else:
                out[-1].append((part, accent))
            prev_space = False
    return out


def wrap(text, font, max_w, max_words):
    """greedy wrap by pixel width and by words per line. returns (rows, widths): rows are lists of words, a word is a list of (piece, accent)."""
    sp = font.getlength(' ')
    ww = lambda w: sum(font.getlength(p) for p, _ in w)
    rows, cur, curw = [], [], 0.0
    for w in _tokens(text):
        wl = ww(w)
        add = wl if not cur else sp + wl
        if cur and (curw + add > max_w or len(cur) >= max_words):
            rows.append(cur)
            cur, curw = [w], wl
        else:
            cur.append(w)
            curw += add
    if cur:
        rows.append(cur)
    widths = [sum(ww(w) for w in r) + sp * (len(r) - 1) for r in rows]
    return rows, widths


def text_spec(kind, ctx):
    """(font role, px size at the 1080 reference) for a text kind"""
    s = ctx.sizes
    if kind == 'card':
        return 'display', s.get('end_line', s.get('headline', 96))
    if kind == 'label':
        return 'mono', s.get('label_9x16' if ctx.tall else 'label_16x9', 28)
    if kind == 'in_world':
        return 'text', s.get('in_world', round(s.get('label_9x16' if ctx.tall else 'label_16x9', 28) * 1.6))
    return 'display', (s.get('caption_9x16', s.get('headline', 96)) if ctx.tall else s.get('headline', 96))


def layout_text(shot, ctx, subject=None):
    """the shot's on-screen text at its real size: rows, widths, the rect it fills on the canvas, the font used. None when the shot has no text."""
    text = shot.get('text') or ''
    if not text.strip():
        return None
    kind = shot.get('text_kind') or 'super'
    role, size = text_spec(kind, ctx)
    font = ctx.fonts.get(role, size)
    S = ctx.safe
    rows, widths = wrap(text, font, S['w'], ctx.max_words)
    lh = size * ctx.line_height
    bw, bh = (max(widths) if widths else 0.0), lh * len(rows)
    at = shot.get('text_at')
    if isinstance(at, dict):
        cx, cy = at.get('x', 0.5) * ctx.W, at.get('y', 0.5) * ctx.H
        x0, y0 = cx - bw / 2, cy - bh / 2
    elif kind == 'card':
        x0, y0 = (S['x0'] + S['x1'] - bw) / 2, (S['y0'] + S['y1'] - bh) / 2
    elif kind == 'label':
        x0, y0 = S['x0'], S['y1'] - ctx.gap - bh - (honesty_height(shot, ctx) if shot.get('honesty') else 0)
    elif kind == 'in_world':
        cx, cy = ((subject['x0'] + subject['x1']) / 2, (subject['y0'] + subject['y1']) / 2) if subject else (ctx.W / 2, ctx.H * 0.42)
        x0, y0 = cx - bw / 2, cy - bh / 2
    else:
        x0, y0 = (S['x0'] + S['x1'] - bw) / 2, S['y1'] - ctx.gap - bh        # a super: the caption box, centred, its bottom a gap above the safe bottom
    return {'kind': kind, 'role': role, 'size_px': round(size, 1), 'font': ctx.fonts.roles[role]['file'], 'rows': rows, 'widths': widths, 'line_h': lh,
            'lines': [' '.join(''.join(p for p, _ in w) for w in r) for r in rows], 'x0': x0, 'y0': y0,
            'rect': {'x0': round(x0, 1), 'y0': round(y0, 1), 'x1': round(x0 + bw, 1), 'y1': round(y0 + bh, 1)}}


def honesty_height(shot, ctx):
    role, size = text_spec('label', ctx)
    return size * ctx.line_height


def layout_honesty(shot, ctx):
    """the honesty label of the shot, bottom-left inside the safe rect (design frames.labels.style), at the label size"""
    h = (shot.get('honesty') or '').strip()
    if not h:
        return None
    role, size = text_spec('label', ctx)
    font = ctx.fonts.get(role, size)
    w = font.getlength(h)
    S = ctx.safe
    x0, y0 = S['x0'], S['y1'] - ctx.gap * 0.5 - size * ctx.line_height
    return {'text': h, 'role': role, 'size_px': size, 'x0': x0, 'y0': y0, 'rect': {'x0': round(x0, 1), 'y0': round(y0, 1), 'x1': round(x0 + w, 1), 'y1': round(y0 + size * ctx.line_height, 1)}}


def draw_rows(d, lay, ctx, color, accent):
    font = ctx.fonts.get(lay['role'], lay['size_px'])
    sp = font.getlength(' ')
    y = lay['y0']
    for row, wdt in zip(lay['rows'], lay['widths']):
        x = lay['x0'] + ((lay['rect']['x1'] - lay['rect']['x0']) - wdt) / 2 if lay['kind'] != 'label' else lay['x0']
        for wi, w in enumerate(row):
            for piece, acc in w:
                d.text((x, y), piece, font=font, fill=rgb(accent if acc else color))
                x += font.getlength(piece)
            if wi < len(row) - 1:
                x += sp
        y += lay['line_h']


# ---------------------------------------------------------------------------------------------------------------- camera
def parse_camera(text):
    """the shot's camera field -> {kind, dir, label}. kind: in, out, pan, tilt, track, orbit, handheld, whip, locked, none"""
    t = (text or '').lower().strip()
    if not t:
        return {'kind': 'none', 'dir': None, 'label': ''}
    d = 'left' if 'left' in t else 'right' if 'right' in t else 'up' if re.search(r'\b(up|rise|crane up)\b', t) else 'down' if re.search(r'\b(down|sink|crane down)\b', t) else None
    k = 'whip' if 'whip' in t else 'out' if re.search(r'pull(ing)?[ -]?(out|back)|dolly[ -]?out|zoom[ -]?out|widen', t) else \
        'in' if re.search(r'push|dolly[ -]?in|zoom[ -]?in|creep|move in', t) else \
        'orbit' if re.search(r'orbit|arc\b|circle|revolve', t) else 'tilt' if 'tilt' in t or d in ('up', 'down') and 'pan' not in t else \
        'pan' if 'pan' in t else 'track' if re.search(r'track|truck|dolly|slide', t) else 'handheld' if re.search(r'handheld|hand-held|shake|wobble', t) else \
        'locked' if re.search(r'lock|static|tripod|still|fixed|hold', t) else 'none'
    return {'kind': k, 'dir': d, 'label': (text or '').strip()}


def _arrow(d, p0, p1, color, w):
    d.line([p0, p1], fill=color, width=w)
    import math
    a = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    L = w * 4.2
    for s in (-0.45, 0.45):
        d.line([p1, (p1[0] - L * math.cos(a + s), p1[1] - L * math.sin(a + s))], fill=color, width=w)


def draw_camera(d, cam, ctx):
    W, H = ctx.W, ctx.H
    c, w = rgb(CAM) + (235,), max(5, int(ctx.W / 280))
    k, dr = cam['kind'], cam['dir']
    if k in ('in', 'out'):
        m = 0.12
        inner = (W * 0.30, H * 0.30, W * 0.70, H * 0.70)
        outer = (W * m, H * m, W * (1 - m), H * (1 - m))
        end = inner if k == 'in' else outer
        d.rectangle(end, outline=c, width=w)                                   # the end framing
        for (ox, oy), (ix, iy) in zip([(outer[0], outer[1]), (outer[2], outer[1]), (outer[2], outer[3]), (outer[0], outer[3])],
                                      [(inner[0], inner[1]), (inner[2], inner[1]), (inner[2], inner[3]), (inner[0], inner[3])]):
            p0, p1 = ((ox, oy), (ix, iy)) if k == 'in' else ((ix, iy), (ox, oy))
            _arrow(d, p0, p1, c, w)
    elif k in ('pan', 'track', 'whip'):
        sgn = -1 if dr == 'left' else 1
        y = H * 0.5
        x0, x1 = (W * 0.30, W * 0.70) if sgn > 0 else (W * 0.70, W * 0.30)
        _arrow(d, (x0, y), (x1, y), c, w)
        if k == 'whip':
            _arrow(d, (x0, y + w * 3), (x1, y + w * 3), c, w)
    elif k == 'tilt':
        sgn = -1 if dr == 'down' else 1
        x = W * 0.5
        y0, y1 = (H * 0.72, H * 0.28) if sgn > 0 else (H * 0.28, H * 0.72)
        _arrow(d, (x, y0), (x, y1), c, w)
    elif k == 'orbit':
        import math
        cx, cy, r = W * 0.5, H * 0.5, min(W, H) * 0.30
        pts = [(cx + r * math.cos(math.radians(a)), cy + r * 0.55 * math.sin(math.radians(a))) for a in range(200, 341, 10)]
        d.line(pts, fill=c, width=w)
        _arrow(d, pts[-2], pts[-1], c, w)
    elif k == 'handheld':
        import math
        pts = [(W * 0.30 + i * W * 0.4 / 40, H * 0.5 + math.sin(i * 1.3) * H * 0.02) for i in range(41)]
        d.line(pts, fill=c, width=w)
    elif k == 'locked':
        x, y, s = W * 0.5, H * 0.5, min(W, H) * 0.05
        d.rounded_rectangle((x - s, y - s * 0.2, x + s, y + s * 1.1), radius=s * 0.2, outline=c, width=w)
        d.arc((x - s * 0.6, y - s * 1.2, x + s * 0.6, y + s * 0.4), 180, 360, fill=c, width=w)


# ---------------------------------------------------------------------------------------------------------------- subject blocks
def subject_label(action):
    first = re.split(r'[;,.]', action or '')[0].strip()
    ws = first.split()[:3]
    s = ' '.join(ws)
    return s if len(s) <= 28 else s[:27] + '.'


def subject_rects(shot, ctx):
    """the subject block(s) of the shot by its scale label: a list of {x0,y0,x1,y1,kind}"""
    W, H = ctx.W, ctx.H
    scale = (shot.get('scale') or 'MS').upper()
    cx = W / 2
    if ctx.hero_third in ('left', 'right') and not ctx.tall:
        cx = W * (0.30 if ctx.hero_third == 'left' else 0.70)
    ground = H * 0.74
    out = []
    if scale == 'CARD':
        return out
    if scale == 'SCREEN':
        w, h = W * 0.62, H * 0.62
        return [{'x0': (W - w) / 2, 'y0': (H - h) / 2, 'x1': (W + w) / 2, 'y1': (H + h) / 2, 'kind': 'screen'}]
    if scale == 'INSERT':
        s = min(W, H) * 0.36
        return [{'x0': cx - s / 2, 'y0': H * 0.5 - s / 2, 'x1': cx + s / 2, 'y1': H * 0.5 + s / 2, 'kind': 'insert'}]
    key = scale if scale in SCALES else 'MS'
    hf, grounded = SCALES[key]
    h = H * hf
    w = min(h * 0.62, W * 0.9)
    y1 = ground if grounded else H * 0.5 + h / 2
    if key == 'ECU':
        y1 = H * 0.5 + h / 2
    blocks = []
    if scale == '2S':
        bw = min(H * 0.46 * 0.62, W * 0.3)
        for dx in (-0.6, 0.6):
            blocks.append({'x0': cx + dx * bw - bw / 2, 'y0': ground - H * 0.46, 'x1': cx + dx * bw + bw / 2, 'y1': ground, 'kind': 'person'})
        return blocks
    if scale == 'OTS':
        blocks.append({'x0': -W * 0.02, 'y0': H * 0.38, 'x1': W * 0.26, 'y1': H * 1.02, 'kind': 'shoulder'})
        w2 = min(H * 0.46 * 0.62, W * 0.3)
        blocks.append({'x0': W * 0.62 - w2 / 2, 'y0': ground - H * 0.46, 'x1': W * 0.62 + w2 / 2, 'y1': ground, 'kind': 'person'})
        return blocks
    blocks.append({'x0': cx - w / 2, 'y0': y1 - h, 'x1': cx + w / 2, 'y1': y1, 'kind': 'person'})
    return blocks


def draw_subject(d, blocks, shot, ctx):
    ink, muted = rgb(ctx.ink), rgb(ctx.muted)
    lw = max(3, int(ctx.W / 480))
    font = ctx.fonts.get('mono', 26)
    for i, b in enumerate(blocks):
        box = (b['x0'], b['y0'], b['x1'], b['y1'])
        if b['kind'] == 'shoulder':
            d.rounded_rectangle(box, radius=40, fill=muted + (90,), outline=ink + (255,), width=lw)
            d.text(((b['x0'] + b['x1']) / 2, b['y0'] + 40), 'FOREGROUND', font=font, fill=ink + (255,), anchor='mm')
            continue
        d.rounded_rectangle(box, radius=24, fill=muted + (46,), outline=ink + (255,), width=lw)
        if b['kind'] == 'screen':
            d.line([(b['x0'], b['y0'] + 52), (b['x1'], b['y0'] + 52)], fill=ink + (255,), width=lw)
            for k in range(3):
                d.ellipse((b['x0'] + 18 + k * 26, b['y0'] + 18, b['x0'] + 34 + k * 26, b['y0'] + 34), outline=ink + (255,), width=2)
        elif b['kind'] == 'person':
            r = (b['x1'] - b['x0']) * 0.2                                         # a head circle gives the block a human scale
            d.ellipse(((b['x0'] + b['x1']) / 2 - r, b['y0'] + r * 0.4, (b['x0'] + b['x1']) / 2 + r, b['y0'] + r * 2.4), outline=ink + (255,), width=lw)
        if i == len(blocks) - 1 or b['kind'] != 'person':
            lab = subject_label(shot.get('action')) if b['kind'] != 'insert' else 'INSERT: ' + subject_label(shot.get('action'))
            lf = ctx.fonts.get('mono', 38)
            cx = (b['x0'] + b['x1']) / 2
            narrow = (b['x1'] - b['x0']) < ctx.W * 0.35
            maxw = max(b['x1'] - b['x0'] - 20, ctx.W * 0.3) if narrow else b['x1'] - b['x0'] - 20
            lines, cur = [], ''
            for w in lab.split():
                t = (cur + ' ' + w).strip()
                if cur and lf.getlength(t) > maxw:
                    lines.append(cur)
                    cur = w
                else:
                    cur = t
            lines.append(cur)
            y = b['y1'] + 14 if narrow else (b['y0'] + b['y1']) / 2 - len(lines) * 24
            for ln in lines:
                d.text((cx, y), ln, font=lf, fill=ink + (255,), anchor='ma')
                y += 48


# ---------------------------------------------------------------------------------------------------------------- the frame
def dashed_rect(d, rect, color, w, dash=18, gap=12, phase=HATCH_PHASE):
    x0, y0, x1, y1 = rect
    for (a, b, c_, e) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
        ln = max(abs(c_ - a), abs(e - b))
        if ln <= 0:
            continue
        ux, uy = (c_ - a) / ln, (e - b) / ln
        t = -phase
        while t < ln:
            s, f = max(t, 0), min(t + dash, ln)
            if f > s:
                d.line([(a + ux * s, b + uy * s), (a + ux * f, b + uy * f)], fill=color, width=w)
            t += dash + gap


def chip(d, xy, text, ctx, anchor='ra', bg=CHIP_BG, fg=CHIP_FG, size=40):
    font = ctx.fonts.get('mono', size)
    w = font.getlength(text)
    pad = size * 0.4
    x, y = xy
    x0 = x - w - 2 * pad if anchor == 'ra' else x
    d.rounded_rectangle((x0, y, x0 + w + 2 * pad, y + size * 1.5), radius=size * 0.3, fill=rgb(bg))
    d.text((x0 + pad, y + size * 0.2), text, font=font, fill=rgb(fg))
    return y + size * 1.5


def render_board(shot, layout, ctx, real=None, source_label=None):
    """the board frame of one shot at board size (RGB). `layout` is {'text': layout_text(), 'honesty': layout_honesty(), 'subject': [...]}. `real` is a PIL image of the composition."""
    W, H = ctx.W, ctx.H
    base = Image.new('RGBA', (W, H), rgb(ctx.paper) + (255,))
    if real is not None:
        im = real.convert('RGB')
        s = min(W / im.width, H / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        base.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    if real is None:
        scale = (shot.get('scale') or 'MS').upper()
        if scale in SCALES or scale in ('2S', 'OTS', 'POV'):
            d.line([(0, H * 0.74), (W, H * 0.74)], fill=rgb(ctx.muted) + (120,), width=3)
        draw_subject(d, layout['subject'], shot, ctx)
    if real is None:
        draw_camera(d, parse_camera(shot.get('camera')), ctx)        # a real frame already shows the move
        if layout['text']:
            draw_rows(d, layout['text'], ctx, ctx.ink, ctx.accent)
        if layout['honesty']:
            h = layout['honesty']
            d.text((h['x0'], h['y0']), h['text'], font=ctx.fonts.get(h['role'], h['size_px']), fill=rgb(ctx.muted))
    S = ctx.safe
    shade = rgb(ACCENT) + (34,)
    d.rectangle((0, 0, W, S['y0']), fill=shade)
    d.rectangle((0, S['y1'], W, H), fill=shade)
    d.rectangle((0, S['y0'], S['x0'], S['y1']), fill=shade)
    d.rectangle((S['x1'], S['y0'], W, S['y1']), fill=shade)
    dashed_rect(d, (S['x0'], S['y0'], S['x1'], S['y1']), rgb(ACCENT) + (210,), max(3, int(W / 640)))
    y = 18
    y = chip(d, (W - 18, y), (shot.get('scale') or '?').upper(), ctx) + 8
    chip(d, (W - 18, y), source_label or 'SCHEMATIC', ctx, bg='#FFFFFF', fg='#141414', size=30)
    out = Image.alpha_composite(base, ov).convert('RGB')
    return out.resize((ctx.bw, ctx.bh), Image.LANCZOS)
