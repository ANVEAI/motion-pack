"""storyboard/sheet.py: the storyboard sheet as PNG, HTML and a print-friendly PDF.
A card = the board frame + shot id, beat, scale, time range, action, sound intent, text, transition and reason, camera, honesty label, and the warnings of that panel.
The PDF is the same cards paginated onto letter pages by Pillow (no extra dependency); the HTML has live text and links the panel PNGs."""
import html
import os
import re

from PIL import Image, ImageDraw, ImageFont

from storyboard import core

BG, FG, DIM, WARN, LINE = '#FFFFFF', '#141414', '#5F5F5F', '#B42318', '#D0D0D0'


def _font(name, size):
    return ImageFont.truetype(os.path.join(core.FONT_DIR, name), int(round(size)), layout_engine=ImageFont.Layout.BASIC)


def _manrope(size, weight=600):
    f = _font('Manrope-Variable.ttf', size)
    f.set_variation_by_axes([weight])
    return f


def _wrap(text, font, max_w):
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if cur and font.getlength(t) > max_w:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    return lines or ['']


def fmt_range(p):
    return '%.2f-%.2f s  frames %d-%d (%d)' % (p['start_s'], p['start_s'] + p['dur_s'], p['start_frame'], p['start_frame'] + p['frames'], p['frames'])


def transition_text(p):
    t = p.get('transition') or {}
    k = t.get('kind') or 'cut'
    return k if not t.get('reason') else '%s: %s' % (k, t['reason'])


def card_rows(p):
    """(label, text, warn?) rows under the frame, the same for every renderer"""
    rows = [('ACTION', p['action'], False), ('SOUND', p['sound'], False)]
    if p['text']:
        lay = p.get('text_layout') or {}
        rows.append(('TEXT', '"%s"  (%s, %s px, %s)' % (p['text'], p['text_kind'], lay.get('size_px', '?'), (lay.get('font') or '').split('/')[-1]), False))
    rows += [('TRANSITION', transition_text(p), False), ('CAMERA', p['camera'] or 'not specified (a locked frame is drawn)', False),
             ('LABEL', p['honesty'] or 'none', False)]
    rows += [('WARN', w, True) for w in p['warnings']]
    return rows


def render_card(p, board, width):
    """one card as a PIL image `width` px wide"""
    pad = max(10, width // 40)
    fs = max(13.0, width / 38.0)
    f_h, f_b, f_l = _manrope(fs * 1.25, 800), _manrope(fs, 500), _font('IBMPlexMono-SemiBold.ttf', fs * 0.8)
    inner = width - 2 * pad
    fr = board.resize((inner, round(board.height * inner / board.width)), Image.LANCZOS)
    head = '%s  %s  %s' % (p['id'], p['beat'], (p['scale'] or '').upper())
    sub = fmt_range(p)
    parts, y = [], pad + fr.height + pad * 0.6
    parts.append(('h', head, y, FG)); y += fs * 1.25 * 1.35
    parts.append(('s', sub, y, DIM)); y += fs * 1.5
    for lab, txt, warn in card_rows(p):
        lines = _wrap(txt, f_b, inner - fs * 6.2)
        parts.append(('l', lab, y, WARN if warn else DIM))
        for i, ln in enumerate(lines):
            parts.append(('b', ln, y + i * fs * 1.28, WARN if warn else FG))
        y += len(lines) * fs * 1.28 + fs * 0.45
    h = int(y + pad)
    im = Image.new('RGB', (width, h), BG)
    d = ImageDraw.Draw(im)
    im.paste(fr, (pad, pad))
    d.rectangle((pad - 1, pad - 1, pad + fr.width, pad + fr.height), outline=LINE)
    for kind, txt, yy, col in parts:
        if kind == 'h':
            d.text((pad, yy), txt, font=f_h, fill=col)
        elif kind == 's':
            d.text((pad, yy), txt, font=f_l, fill=col)
        elif kind == 'l':
            d.text((pad, yy + fs * 0.12), txt, font=f_l, fill=col)
        else:
            d.text((pad + fs * 6.2, yy), txt, font=f_b, fill=col)
    d.rectangle((0, 0, width - 1, h - 1), outline=LINE)
    return im


def header_lines(info):
    s = info['summary']
    return [('%s' % s['title'], 'title'),
            ('%s  |  %s  |  %.2f s at %s fps  |  %d shots  |  lead aspect %s' % (s['format'], s['aspect'], s['length_s'], s['fps'], s['shots'], s['aspect']), 'sub'),
            ('Schematic panels are drawings of the shot, not the picture. Safe zone: %s%s. Lint: %s.' % (
                s['platform'], ' (a working estimate, verify before a paid campaign)' if s['platform_verify'] else '', s['lint']), 'sub'),
            ('%d warning%s. %s' % (s['warnings'], '' if s['warnings'] == 1 else 's', 'Approve this sheet and the animatic before the full render (SKILL.md production gates).'), 'sub')]


def render_header(info, width):
    fs = max(15.0, width / 80.0)
    f_t, f_s = _manrope(fs * 1.9, 800), _manrope(fs, 500)
    rows = header_lines(info)
    h = int(fs * 1.9 * 1.5 + fs * 1.5 * (len(rows) - 1) + fs * 1.5)
    im = Image.new('RGB', (width, h), BG)
    d = ImageDraw.Draw(im)
    y = fs * 0.5
    for txt, kind in rows:
        if kind == 'title':
            d.text((fs, y), txt, font=f_t, fill=FG)
            y += fs * 1.9 * 1.3
        else:
            d.text((fs, y), txt, font=f_s, fill=DIM)
            y += fs * 1.5
    return im


def render_sheet(info, boards, card_w, cols):
    """the whole sheet: header + a grid of cards (rows are as tall as their tallest card)"""
    pad = 16
    cards = [render_card(p, b, card_w) for p, b in zip(info['panels'], boards)]
    W = cols * card_w + (cols + 1) * pad
    head = render_header(info, W)
    rows = [cards[i:i + cols] for i in range(0, len(cards), cols)]
    H = head.height + sum(max(c.height for c in r) + pad for r in rows) + pad
    im = Image.new('RGB', (W, H), '#EDEDED')
    im.paste(head, (0, 0))
    y = head.height
    for r in rows:
        for i, c in enumerate(r):
            im.paste(c, (pad + i * (card_w + pad), y))
        y += max(c.height for c in r) + pad
    return im


def render_pdf(info, boards, path, cols=2, page=(1275, 1650), margin=60):
    """letter pages at 150 dpi (two cards across). Cards are never split across pages; a row that does not fit starts the next page."""
    pw, ph = page
    gap = 20
    cw = (pw - 2 * margin - (cols - 1) * gap) // cols
    cards = [render_card(p, b, cw) for p, b in zip(info['panels'], boards)]
    head = render_header(info, pw - 2 * margin)
    pages = []
    cur = Image.new('RGB', (pw, ph), BG)
    cur.paste(head, (margin, margin))
    y = margin + head.height + gap
    for r0 in range(0, len(cards), cols):
        row = cards[r0:r0 + cols]
        row_h = max(c.height for c in row)
        if y + row_h > ph - margin and y > margin + head.height + gap:
            pages.append(cur)
            cur, y = Image.new('RGB', (pw, ph), BG), margin
        for i, c in enumerate(row):
            cur.paste(c, (margin + i * (cw + gap), y))
        y += row_h + gap
    pages.append(cur)
    pages[0].save(path, 'PDF', resolution=150.0, save_all=True, append_images=pages[1:])
    return len(pages)


def render_html(info, path, panel_dir='panels'):
    s = info['summary']
    e = html.escape
    out = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
           '<title>%s: storyboard</title>' % e(s['title']),
           '<style>body{font:15px/1.4 system-ui,sans-serif;margin:24px;color:#141414;background:#fff}h1{margin:0 0 4px}.sub{color:#5F5F5F;margin:2px 0}',
           '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px;margin-top:16px}.panel{border:1px solid #D0D0D0;padding:10px;break-inside:avoid}',
           '.panel img{width:100%;display:block;border:1px solid #D0D0D0}.panel h2{font-size:16px;margin:8px 0 2px}.panel .r{color:#5F5F5F;font-size:13px;margin:0 0 6px}',
           '.panel dl{margin:0;display:grid;grid-template-columns:90px 1fr;gap:2px 8px}.panel dt{color:#5F5F5F;font:600 11px ui-monospace,monospace}.panel dd{margin:0}',
           '.warn{color:#B42318}@media print{body{margin:8mm}.grid{grid-template-columns:repeat(2,1fr)}}</style></head><body>']
    out.append('<h1>%s</h1>' % e(s['title']))
    for txt, kind in header_lines(info)[1:]:
        out.append('<p class="sub">%s</p>' % e(txt))
    out.append('<div class="grid">')
    for p in info['panels']:
        out.append('<article class="panel" id="%s"><img src="%s/%s.png" alt="board frame of shot %s (%s)">' % (e(p['id']), panel_dir, e(p['id']), e(p['id']), e(p['source'])))
        out.append('<h2>%s &middot; %s &middot; %s</h2><p class="r">%s</p><dl>' % (e(p['id']), e(p['beat']), e((p['scale'] or '').upper()), e(fmt_range(p))))
        for lab, txt, warn in card_rows(p):
            out.append('<dt>%s</dt><dd%s>%s</dd>' % (lab, ' class="warn"' if warn else '', e(txt)))
        out.append('</dl></article>')
    out.append('</div></body></html>')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out) + '\n')
