"""motion-pack / tools / captions / formats.py: caption events to SRT, WebVTT (with cue positioning) and TTML (IMSC1.1 Text profile), and back.

    srt(evs) / vtt(evs, kind='captions') / ttml(evs, lang='en')   -> str
    parse(path_or_text, fmt=None)                                    -> events [{start, end, lines, box?}] for the validator

Positions: WebVTT gets `line:<pct>%[,end] position:50% size:<pct>% align:center` from the event box (percent of the frame), TTML a region per
position (origin and extent in percent of the root container). SRT has no portable positioning, so it carries none unless an8=True, which
adds the {\\an8} top tag that some players honour and others print as text."""
import html
import re
import xml.etree.ElementTree as ET


def ts(t, sep='.'):
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return '%02d:%02d:%02d%s%03d' % (h, m, s, sep, ms)


def parse_ts(s):
    s = s.strip().replace(',', '.')
    parts = s.split(':')
    if len(parts) == 2:
        parts = ['0'] + parts
    h, m, sec = parts
    return int(h) * 3600 + int(m) * 60 + float(sec)


def srt(evs, an8=False):
    out = []
    for i, e in enumerate(evs, 1):
        lines = list(e['lines'])
        if an8 and e.get('position') == 'top' and lines:
            lines[0] = '{\\an8}' + lines[0]
        out.append('%d\n%s --> %s\n%s\n' % (i, ts(e['start'], ','), ts(e['end'], ','), '\n'.join(lines)))
    return '\n'.join(out)


def _pct(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')


def vtt_settings(e):
    """cue settings from the event box: the line is the box's bottom edge (line:..%,end) for a bottom caption and its top edge for a top one"""
    if not e.get('box') or not e.get('frame'):
        return ''
    W, H = e['frame']
    x0, y0, x1, y1 = e['box']
    size = 100.0 * (x1 - x0) / W
    pos = 100.0 * (x0 + x1) / 2 / W
    if e.get('position') == 'top':
        line = 'line:%s%%' % _pct(100.0 * y0 / H)
    else:
        line = 'line:%s%%,end' % _pct(100.0 * y1 / H)
    return ' %s position:%s%% size:%s%% align:center' % (line, _pct(pos), _pct(size))


def _vtt_text(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def vtt(evs, kind='captions', lang='en', voices=False):
    """WebVTT. kind is a NOTE only: the browser takes the track kind (captions, subtitles, descriptions) from the <track kind> attribute.
    voices=True wraps speech in <v Name> spans (semantic; most players do not draw the name, so SDH also prints it in the text)."""
    out = ['WEBVTT', '', 'NOTE kind=%s lang=%s made by motion-pack tools/captions' % (kind, lang), '']
    for i, e in enumerate(evs, 1):
        body = '\n'.join(_vtt_text(x) for x in e['lines'])
        if voices and e.get('speaker'):
            body = '<v %s>%s</v>' % (_vtt_text(str(e['speaker'])), body)
        out += ['c%d' % i, '%s --> %s%s' % (ts(e['start']), ts(e['end']), vtt_settings(e)), body, '']
    return '\n'.join(out)


TT = 'http://www.w3.org/ns/ttml'
TTS = 'http://www.w3.org/ns/ttml#styling'
TTP = 'http://www.w3.org/ns/ttml#parameter'
IMSC11_TEXT = 'http://www.w3.org/ns/ttml/profile/imsc1.1/text'


def _regions(evs):
    """one region per position (bottom, top): the union of that position's event boxes, in percent of the frame. Each event names its region."""
    boxes = {}
    for e in evs:
        pos = e.get('position', 'bottom')
        if e.get('box') and e.get('frame'):
            W, H = e['frame']
            x0, y0, x1, y1 = e['box']
            b = (100 * x0 / W, 100 * y0 / H, 100 * x1 / W, 100 * y1 / H)
        else:
            b = (10.0, 75.0, 90.0, 90.0) if pos != 'top' else (10.0, 10.0, 90.0, 25.0)
        u = boxes.get(pos, b)
        boxes[pos] = (min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3]))
        e['_region'] = pos
    return {(pos, (round(x0, 2), round(y0, 2), round(x1 - x0, 2), round(y1 - y0, 2))): pos for pos, (x0, y0, x1, y1) in boxes.items()}


def ttml(evs, lang='en', color='#FFFFFF', background='#000000C2', font='proportionalSansSerif'):
    """TTML2 document in the IMSC1.1 Text profile: media time base, clock times, regions in percent, one <p> per event with <br/> between lines"""
    regs = _regions(evs)
    head = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<tt xmlns="%s" xmlns:tts="%s" xmlns:ttp="%s" xml:lang="%s" ttp:timeBase="media" ttp:contentProfiles="%s">' % (TT, TTS, TTP, lang, IMSC11_TEXT),
            '  <head>', '    <styling>',
            '      <style xml:id="s1" tts:color="%s" tts:fontFamily="%s" tts:fontSize="100%%" tts:textAlign="center" tts:lineHeight="125%%"/>' % (color, font),
            '      <style xml:id="box" tts:backgroundColor="%s"/>' % background,
            '    </styling>', '    <layout>']
    for (pos, (x, y, w, h)), name in regs.items():
        head.append('      <region xml:id="%s" tts:origin="%s%% %s%%" tts:extent="%s%% %s%%" tts:displayAlign="%s"/>' % (name, _pct(x), _pct(y), _pct(w), _pct(h), 'before' if pos == 'top' else 'after'))
    head += ['    </layout>', '  </head>', '  <body style="s1">', '    <div>']
    body = []
    for i, e in enumerate(evs, 1):
        txt = '<span style="box">%s</span>' % '<br/>'.join(html.escape(x, quote=False) for x in e['lines'])
        body.append('      <p xml:id="c%d" begin="%s" end="%s" region="%s">%s</p>' % (i, ts(e['start']), ts(e['end']), e.pop('_region'), txt))
    return '\n'.join(head + body + ['    </div>', '  </body>', '</tt>', ''])


# ------------------------------------------------------------------------------------------------ parsing (for the validator and round trips)
_ARROW = re.compile(r'^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)(.*)$')


def _blocks(text):
    return [b for b in re.split(r'\n\s*\n', text.replace('\r\n', '\n').strip()) if b.strip()]


def parse_srt(text):
    evs = []
    for b in _blocks(text):
        ln = b.split('\n')
        k = next((i for i, x in enumerate(ln) if '-->' in x), None)
        if k is None:
            continue
        m = _ARROW.match(ln[k])
        evs.append({'start': parse_ts(m.group(1)), 'end': parse_ts(m.group(2)), 'lines': [re.sub(r'\{\\an\d\}', '', x) for x in ln[k + 1:]]})
    return evs


def parse_vtt(text, frame=None):
    evs = []
    for b in _blocks(text):
        ln = b.split('\n')
        k = next((i for i, x in enumerate(ln) if '-->' in x), None)
        if k is None:                                                   # the header, NOTE, STYLE and REGION blocks have no timing line
            continue
        m = _ARROW.match(ln[k])
        lines = [html.unescape(re.sub(r'</?v[^>]*>|</?c[^>]*>', '', x)) for x in ln[k + 1:]]
        e = {'start': parse_ts(m.group(1)), 'end': parse_ts(m.group(2)), 'lines': lines, 'settings': m.group(3).strip()}
        st = dict(kv.split(':', 1) for kv in e['settings'].split() if ':' in kv)
        if frame and 'line' in st and 'size' in st and 'position' in st:
            W, H = frame
            lp = st['line'].split(',')
            y = float(lp[0].rstrip('%')) / 100 * H
            w = float(st['size'].rstrip('%')) / 100 * W
            cx = float(st['position'].rstrip('%')) / 100 * W
            e['position'] = 'bottom' if len(lp) > 1 and lp[1] == 'end' else 'top'
            e['frame'] = [W, H]
            e['box_edge'] = y
            e['box_x'] = [cx - w / 2, cx + w / 2]
        evs.append(e)
    return evs


def _flat(el, out):
    """text of an element with <br/> as a line break, through nested spans"""
    out[-1] += el.text or ''
    for ch in el:
        if ch.tag == '{%s}br' % TT:
            out.append('')
        else:
            _flat(ch, out)
        out[-1] += ch.tail or ''
    return out


def parse_ttml(text):
    root = ET.fromstring(text.encode('utf-8') if isinstance(text, str) else text)
    evs = []
    for p in root.iter('{%s}p' % TT):
        lines = _flat(p, [''])
        evs.append({'start': parse_ts(p.get('begin')), 'end': parse_ts(p.get('end')), 'lines': [x.strip() for x in lines], 'region': p.get('region')})
    return evs


def parse(src, fmt=None, frame=None):
    text = src
    if '\n' not in src and len(src) < 4096:
        fmt = fmt or src.rsplit('.', 1)[-1].lower()
        text = open(src, encoding='utf-8').read()
    fmt = fmt or ('vtt' if text.lstrip().startswith('WEBVTT') else 'ttml' if text.lstrip().startswith('<') else 'srt')
    if fmt in ('ttml', 'xml', 'dfxp', 'imsc'):
        return parse_ttml(text)
    if fmt == 'vtt':
        return parse_vtt(text, frame)
    return parse_srt(text)
