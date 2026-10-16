"""motion-pack / tools / captions / burn.py: the burned-in pass. Each event becomes one transparent PNG at its placed box (the bundled OFL Manrope
on a scrim box), and ffmpeg overlays them in time. No libass needed (many ffmpeg builds have none; the pack burns captions through PNG layers).

    pngs = render_pngs(evs, out_dir, W, H, opts)                     # writes cap_0001.png ... ; returns [(path, x, y, start, end)]
    args = burn_args('in.mp4', pngs, 'out.mp4', video=[...])         # pure: the ffmpeg argument list (overlay chain, enable windows)

The scrim is opaque enough that white text passes WCAG 4.5:1 over any picture (a11y_check measures it against the real frames anyway).
Over a few hundred events the overlay chain gets long; burn a long programme in parts, or burn through the composition (type/captions.js)."""
import os

from PIL import Image, ImageDraw, ImageFont

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = os.path.join(PACK, 'templates', '_shared', 'fonts', 'Manrope-Variable.ttf')
STYLE = {'fg': (255, 255, 255, 255), 'scrim': (0, 0, 0, 194), 'weight': 700, 'radius': 0.18}


def _font(px, weight):
    f = ImageFont.truetype(FONT, int(round(px)))
    try:
        f.set_variation_by_axes([weight])
    except (OSError, AttributeError):
        pass                                                                    # a FreeType build without variation support draws the default instance
    return f


def render_event(e, o, style=None):
    """RGBA image of one event and its top-left (x, y) in the frame. The box width follows the measured text, centred in the event box."""
    st = {**STYLE, **(style or {})}
    f = _font(o['font_px'], st['weight'])
    pad = o['pad'] * o['font_px']
    lh = o['line_h'] * o['font_px']
    widths = [f.getlength(x) for x in e['lines']]
    w = int(round(max(widths) + 2 * pad))
    h = int(round(len(e['lines']) * lh + 2 * pad))
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=int(st['radius'] * o['font_px']), fill=st['scrim'])
    for i, (ln, lw) in enumerate(zip(e['lines'], widths)):
        y = pad + i * lh + (lh - o['font_px']) / 2
        d.text(((w - lw) / 2, y), ln, font=f, fill=st['fg'])
    x0, y0, x1, y1 = e['box']
    cx = (x0 + x1) / 2
    y = y1 - h if e.get('position', 'bottom') == 'bottom' else y0
    return im, int(round(cx - w / 2)), int(round(y))


def render_pngs(evs, out_dir, o, style=None):
    os.makedirs(out_dir, exist_ok=True)
    out = []
    for i, e in enumerate(evs, 1):
        im, x, y = render_event(e, o, style)
        p = os.path.join(out_dir, 'cap_%04d.png' % i)
        im.save(p, optimize=True)
        out.append((p, x, y, e['start'], e['end']))
    return out


def overlay_graph(items):
    """the filter_complex string: [0:v] then one overlay per PNG input (inputs 1..n), each enabled on [start, end)"""
    parts, cur = [], '0:v'
    for k, (_, x, y, a, b) in enumerate(items, 1):
        nxt = 'v%d' % k
        parts.append("[%s][%d:v]overlay=x=%d:y=%d:eof_action=repeat:enable='gte(t,%.3f)*lt(t,%.3f)'[%s]" % (cur, k, x, y, a, b, nxt))
        cur = nxt
    return ';'.join(parts), cur


def burn_args(src, items, out, video=None, audio=('-c:a', 'copy')):
    """ffmpeg arguments (no 'ffmpeg' itself). `video` is the encoder part (tools/deliver.py video_args gives the per-platform one);
    the default is H.264 High, CRF 18, BT.709 tags. Audio is copied untouched so the measured loudness stays."""
    video = list(video) if video else ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                                       '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv']
    args = ['-y', '-v', 'error', '-i', src]
    for p, *_ in items:
        args += ['-i', p]
    if items:
        g, last = overlay_graph(items)
        args += ['-filter_complex', g, '-map', '[%s]' % last]
    else:
        args += ['-map', '0:v']
    return args + ['-map', '0:a?'] + video + list(audio) + ['-movflags', '+faststart', out]
