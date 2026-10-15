"""motion-pack / eyes / checks_text.py: safe zones (plan boxes, or text-like edges without a plan) and text readability (size, time on screen, contrast from pixels).
Same result shape as checks_frames.py."""
import numpy as np
from scipy import ndimage

from . import core
from .core import SPEC, result, issue, ratio, rel_lum, parse_hex, LIN, iter_frames, iter_select


# ------------------------------------------------------------------------------------------------ safe zones
def lint_rect(box, rect, tol):
    """sides of box (x0, y0, x1, y1) that leave the safe rect (x0, y0, x1, y1), with the px over: type/safezones.js lintRect"""
    out = []
    if box[0] < rect[0] - tol: out.append(('left', rect[0] - box[0]))
    if box[2] > rect[2] + tol: out.append(('right', box[2] - rect[2]))
    if box[1] < rect[1] - tol: out.append(('top', rect[1] - box[1]))
    if box[3] > rect[3] + tol: out.append(('bottom', box[3] - rect[3]))
    return out


def outside_frac(box, rect):
    a = max(0.0, (box[2] - box[0]) * (box[3] - box[1]))
    if a <= 0:
        return 0.0
    iw = max(0.0, min(box[2], rect[2]) - max(box[0], rect[0]))
    ih = max(0.0, min(box[3], rect[3]) - max(box[1], rect[1]))
    return 1.0 - iw * ih / a


def text_candidates(Y, s):
    """text-like blocks of a gray frame (H, W): [(x0, y0, x1, y1)] where strong edges close horizontally into a line-shaped, dense, high-contrast block.
    s = the frame's short side / 1080 (every size in the spec is px at the 1080 reference)"""
    sp = SPEC['safezones']
    Yi = Y.astype(np.int16)
    E = np.zeros(Y.shape, bool)
    E[:, 1:] |= np.abs(Yi[:, 1:] - Yi[:, :-1]) >= sp['edge_delta']
    E[1:, :] |= np.abs(Yi[1:, :] - Yi[:-1, :]) >= sp['edge_delta']
    if not E.any():
        return []
    rx, ry = max(2, int(round(12 * s))), max(1, int(round(3 * s)))
    D = ndimage.binary_dilation(E, structure=np.ones((2 * ry + 1, 2 * rx + 1), bool))
    lab, n = ndimage.label(D, structure=np.ones((3, 3), bool))
    lum = core.LIN[Y]
    out = []
    H, W = Y.shape
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        y0, y1, x0, x1 = y0 + ry, y1 - ry, x0 + rx, x1 - rx                      # the dilation grew the box by its radius
        h, w = (y1 - y0) / s, (x1 - x0) / s
        if not (sp['height_px_1080'][0] <= h <= sp['height_px_1080'][1]) or w < sp['min_width_px_1080'] or w < sp['min_aspect'] * h:
            continue
        if (x1 - x0) * (y1 - y0) > sp['max_area_frac'] * W * H:
            continue
        e = E[y0:y1, x0:x1]
        dens = float(e.mean())
        if not (sp['edge_density'][0] <= dens <= sp['edge_density'][1]):
            continue
        mid = e[int(0.25 * e.shape[0]):max(int(0.75 * e.shape[0]), int(0.25 * e.shape[0]) + 1)]
        trans = np.median((np.diff(mid.astype(np.int8), axis=1) == 1).sum(axis=1))
        if trans < sp['row_transitions_min']:
            continue
        p5, p95 = np.percentile(lum[y0:y1, x0:x1], [5, 95])
        if ratio(p95, p5) < sp['contrast_min']:
            continue
        out.append((x0, y0, x1, y1))
    return out


def iou(a, b):
    iw, ih = min(a[2], b[2]) - max(a[0], b[0]), min(a[3], b[3]) - max(a[1], b[1])
    if iw <= 0 or ih <= 0:
        return 0.0
    i = iw * ih
    return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i)


def detect_text_tracks(c):
    """persistent text-like blocks [{box (px of the delivered frame), t: [a, b]}]: candidates that repeat at the same place on persist_samples samples taken at sample_fps"""
    sp = SPEC['safezones']
    k = min(1.0, 540.0 / min(c.W, c.H))
    sw, sh = int(round(c.W * k)), int(round(c.H * k))
    s = min(sw, sh) / 1080.0
    dt = 1.0 / sp['sample_fps']
    per = []
    for fr in iter_frames(c.path, sw, sh, 'gray', 'fps=%g,scale=%d:%d:flags=area' % (sp['sample_fps'], sw, sh)):
        per.append(text_candidates(fr, s))
    tracks = []
    for i, cands in enumerate(per):
        for b in cands:
            for tr in tracks:
                if tr['last'] == i - 1 and iou(tr['box'], b) >= sp['iou_min']:
                    tr['last'], tr['n'] = i, tr['n'] + 1
                    tr['box'] = tuple(0.5 * (u + v) for u, v in zip(tr['box'], b))
                    break
            else:
                tracks.append({'box': tuple(float(v) for v in b), 'first': i, 'last': i, 'n': 1})
    keep = []
    for tr in sorted((t for t in tracks if t['n'] >= sp['persist_samples']), key=lambda t: (-t['n'], t['first'])):
        if not any(iou(tr['box'], o['box']) >= sp['iou_min'] and tr['first'] <= o['last'] and o['first'] <= tr['last'] for o in keep):     # one block, however many variants of it tracked
            keep.append(tr)
    keep.sort(key=lambda t: (t['first'], t['box'][1], t['box'][0]))
    return [{'box': tuple(v / k for v in tr['box']), 't': [round(tr['first'] * dt, 2), round((tr['last'] + 1) * dt, 2)]} for tr in keep]


def safezones(ctx):
    c, sp = ctx['clip'], SPEC['safezones']
    cid = 'eyes/safezones'
    x0, y0, x1, y1, src = core.safe_rect(ctx['platform'], c.W, c.H)
    rect = (x0, y0, x1, y1)
    boxes = [t for t in ctx['texts'] if t['box']]
    issues, notes, rows = [], [], []
    mode = 'plan' if boxes else 'detect'
    if boxes:
        for t in boxes:
            v = lint_rect(t['box'], rect, sp['lint_tolerance_px'])
            rows.append({'id': t['id'], 'box': [round(u, 1) for u in t['box']], 't': t['t'], 'violations': [{'side': a, 'px': round(b, 1)} for a, b in v]})
            if v:
                sides = ', '.join('%s by %.0f px' % (a, b) for a, b in v)
                issues.append(issue('fail', [round(t['t'][0], 2), round(t['t'][1], 2)], 'text "%s" (%s) leaves the %s safe area %s: %s' % (
                    t['text'][:30], t['id'], ctx['platform'], tuple(round(u) for u in rect), sides),
                    'move the box inside x %d-%d, y %d-%d (type/safezones.js captionBox, or re-lay out the shot: faces and key text stay out of the bottom 35%% of a 9:16 frame)' % tuple(round(u) for u in (rect[0], rect[2], rect[1], rect[3])),
                    'Part of the text is hidden behind the app interface (title, buttons, captions) or cut off.', 'safe'))
    else:
        for tr in detect_text_tracks(c):
            of = outside_frac(tr['box'], rect)
            rows.append({'box': [round(u) for u in tr['box']], 't': tr['t'], 'outside': round(of, 2)})
            if of >= sp['warn_outside_frac']:
                sev = 'fail' if of >= sp['fail_outside_frac'] else 'warn'
                v = lint_rect(tr['box'], rect, 0.0)
                issues.append(issue(sev, tr['t'], 'a text-like block at %s sits %.0f%% outside the %s safe area %s (%s)' % (
                    tuple(round(u) for u in tr['box']), 100 * of, ctx['platform'], tuple(round(u) for u in rect), ', '.join('%s %.0f px' % a for a in v)),
                    'move that text or graphic inside the safe rectangle; if it is in-scene text that cannot move, keep it out of the platform UI bands or reframe the shot',
                    'Words or a graphic sit where the app draws its own buttons and captions, so they get covered or look cropped.', 'safe'))
        notes.append('no text boxes in the plan: judged by text-like edges that persist for %d samples (a heuristic; it cannot read). Give plan.texts [{text, t, box, fontPx}] for an exact check' % sp['persist_samples'])
    m = {'mode': mode, 'platform': ctx['platform'], 'safe_rect': [round(u, 1) for u in rect], 'safe_rect_source': src, 'blocks': rows}
    return result(cid, 'safezones', m, 'every text box inside the %s safe rectangle (%s)' % (ctx['platform'], src), issues, notes)


# ------------------------------------------------------------------------------------------------ readability
def otsu(v):
    h, edges = np.histogram(v, bins=64, range=(0, 255))
    p = h / max(1, h.sum())
    w0, mu = np.cumsum(p), np.cumsum(p * (edges[:-1] + 2))
    mt = mu[-1]
    with np.errstate(divide='ignore', invalid='ignore'):
        sb = (mt * w0 - mu) ** 2 / (w0 * (1 - w0))
    return float(edges[int(np.nanargmax(sb)) + 1]) if np.isfinite(sb).any() else 127.0


def box_contrast(crop, fg=None):
    """text contrast in a decoded crop (h, w, 3) uint8: (worst WCAG ratio, fg luminance, bg P5 and P95 luminance, estimated?, fg share) or None when no text pixels are found.
    fg = '#rrggbb': text pixels are those within bg_dist (RGB distance) of it; otherwise the minority side of an Otsu split of the luma is the text"""
    sp = SPEC['readability']
    rgb = parse_hex(fg)
    lum = rel_lum(crop)
    if rgb is not None:
        d = np.sqrt(((crop.astype(np.float32) - np.array(rgb, np.float32)) ** 2).sum(axis=2))
        fgm = d <= sp['bg_dist']
        est = False
        fl = float(core.rel_lum(np.array(rgb, np.uint8)))
    else:
        y = core.luma(crop.astype(np.float32))
        th = otsu(y.ravel())
        hi = y > th
        fgm = hi if hi.mean() <= 0.5 else ~hi
        est = True
        fl = float(np.median(lum[fgm])) if fgm.any() else 0.0
    share = float(fgm.mean())
    if share < 0.005 or share > 0.9:
        return None
    bgm = ~ndimage.binary_dilation(fgm, iterations=2)                      # the anti-aliased rim of the strokes is neither text nor backdrop
    if bgm.mean() < 0.05:
        bgm = ~fgm
    bg = lum[bgm]
    p5, p95 = np.percentile(bg, [5, 95])
    return float(min(ratio(fl, p5), ratio(fl, p95))), fl, float(p5), float(p95), est, share


def _hex(rgb):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in rgb)


def readability(ctx):
    c, sp = ctx['clip'], SPEC['readability']
    cid = 'eyes/readability'
    texts = ctx['texts']
    if not texts:
        return core.na(cid, 'readability', 'no on-screen texts declared: give the plan texts (plan.texts [{text, t, box, fontPx, role, fg}], shots[].text with textDur, or captions[])',
                       'text at or over the frame-design floors, held 0.35 s + 0.28 s per word, 4.5:1 over its backdrop')
    tall = c.H > c.W
    aspect = 'tall' if tall else 'wide'
    issues, notes, rows = [], [], []
    wants = {}                                                                # frame index -> [(text row, crop box)]
    for t in texts:
        words = len(t['text'].split())
        dur = t['t'][1] - t['t'][0]
        need = max(sp['hold_min_s'], sp['hold_base_s'] + sp['hold_per_word_s'] * words)
        row = {'id': t['id'], 'text': t['text'][:40], 'role': t['role'], 'words': words, 't': [round(t['t'][0], 2), round(t['t'][1], 2)], 'on_screen_s': round(dur, 2),
               'needed_s': round(need, 2), 'source': t['src']}
        tt = [round(t['t'][0], 2), round(t['t'][1], 2)]
        if words and dur < need - 1e-6:
            sev = 'warn' if (dur >= 0.8 * need or t['role'] == 'caption') else 'fail'                  # captions follow the voice: the viewer hears the words too
            issues.append(issue(sev, tt, 'text "%s" (%s) is on screen %.2f s; %d words need %.2f s (0.35 s + 0.28 s per word)' % (t['text'][:30], t['id'], dur, words, need),
                                'hold it %.2f s, or cut it to %d words' % (need, max(1, int((dur - sp['hold_base_s']) / sp['hold_per_word_s']))), 'The words vanish before you can finish reading them.', 'time'))
        if t['role'] == 'label' and dur < sp['label_min_s']:
            issues.append(issue('fail', tt, 'honesty label "%s" is on screen %.2f s; labels need %.1f s' % (t['text'][:30], dur, sp['label_min_s']),
                                'hold the label for at least %.1f s' % sp['label_min_s'], 'The disclosure flashes by unread.', 'label'))
        if t['role'] == 'endcard' and dur < sp['endcard_hold_s'][0]:
            issues.append(issue('warn', tt, 'end-card text "%s" is held %.2f s (3-4.5 s)' % (t['text'][:30], dur), 'hold the end card %.1f-%.1f s' % tuple(sp['endcard_hold_s']), 'The end card is gone before you can read the address.', 'endcard'))
        if t['role'] == 'read' and words > sp['read_max_words']:
            issues.append(issue('warn', tt, 'read line "%s" has %d words (at most %d)' % (t['text'][:30], words, sp['read_max_words']), 'cut it to %d words or split it over two shots' % sp['read_max_words'], 'Too many words to take in at a glance.', 'words'))
        fpx, est = t['font_px'], False
        if fpx is None and t['box']:
            lines = int(t['lines'] or 1)
            fpx, est = (t['box'][3] - t['box'][1]) / (lines * 1.18), True
        if fpx:
            f1080 = fpx / c.s
            floor = sp['floors_px_1080'].get(t['role'], sp['floors_px_1080']['read'])[aspect]
            phone = fpx * sp['phone_width_px'] / c.W
            row.update(font_px=round(fpx, 1), size_at_1080=round(f1080, 1), floor_at_1080=floor, size_on_phone_px=round(phone, 1), size_estimated=est)
            if f1080 < floor - 0.5:
                issues.append(issue('fail' if not est else 'warn', tt, '%s "%s" (%s) is %.0f px at 1080%s; the %s floor is %d px' % (
                    t['role'], t['text'][:30], t['id'], f1080, ' (estimated from its box)' if est else '', aspect, floor),
                    'raise it to %d px or more at the 1080 reference (shorter side), or cut words so a bigger size fits' % floor, 'The text is too small to read on a phone.', 'size'))
            if t['role'] == 'caption' and tall and f1080 > sp['caption_max_px_tall']:
                issues.append(issue('warn', tt, 'caption "%s" is %.0f px at 1080; 9:16 captions run 64-%d px' % (t['text'][:30], f1080, sp['caption_max_px_tall']),
                                'bring it down to 64-80 px', 'The caption is so large it crowds the picture.', 'size'))
            if phone < sp['phone_min_px']:
                issues.append(issue('fail' if not est else 'warn', tt, 'text "%s" renders %.1f px high on a %d px wide phone (floor %.0f px)' % (t['text'][:30], phone, sp['phone_width_px'], sp['phone_min_px']),
                                    'make it larger or re-lay out so it is not shrunk by the aspect (type sizes come from the shorter frame side)', 'On a phone the text is a smear.', 'phone'))
            elif phone < sp['phone_target_px']:
                notes.append('text %s renders %.1f px on a 360 px wide phone (under %.0f px: check a 360 px still)' % (t['id'], phone, sp['phone_target_px']))
        if t['box']:
            bx = t['box']
            n = sp['samples'] if dur >= 1.0 else 1
            for k in range(n):
                tm = t['t'][0] + dur * ((k + 0.5) / n if n > 1 else 0.5)
                tm = min(max(tm, t['t'][0]), c.dur - 1e-3)
                wants.setdefault(c.idx(tm), []).append((row, bx, t))
        rows.append(row)
    if wants:
        for i, fr in iter_select(c.path, list(wants), c.W, c.H, 'rgb24'):
            for row, bx, t in wants[i]:
                x0, y0, x1, y1 = (int(round(v)) for v in bx)
                x0, y0, x1, y1 = max(0, x0), max(0, y0), min(c.W, x1), min(c.H, y1)
                if x1 - x0 < sp['min_box_px'] or y1 - y0 < sp['min_box_px']:
                    continue
                r = box_contrast(fr[y0:y1, x0:x1], t['fg'])
                if r:
                    row.setdefault('_c', []).append((r[0], float(c.t[i]), r))
    for row in rows:
        cs = row.pop('_c', None)
        if not cs:
            continue
        worst = min(cs, key=lambda x: x[0])
        t = next(x for x in texts if x['id'] == row['id'])
        est = worst[2][4]
        row.update(contrast_worst=round(worst[0], 2), contrast_median=round(float(np.median([x[0] for x in cs])), 2), contrast_t=round(worst[1], 2), contrast_samples=len(cs),
                   fg_source='estimated' if est else 'plan', bg_luminance=[round(worst[2][2], 3), round(worst[2][3], 3)])
        if worst[0] < sp['contrast_pass']:
            sev = 'fail' if worst[0] < sp['contrast_fail'] else 'warn'
            if est and sev == 'fail':
                sev = 'warn'
            fgh = t['fg'] or 'the text colour'
            issues.append(issue(sev, [round(t['t'][0], 2), round(t['t'][1], 2)], 'text "%s" (%s) has %.2f:1 contrast against what is behind it at %.2f s (%s; needs %.1f:1, hard floor %.1f:1)' % (
                t['text'][:30], t['id'], worst[0], worst[1], 'the text colour was estimated from the pixels' if est else 'from the plan colour %s' % fgh, sp['contrast_pass'], sp['contrast_fail']),
                'put a scrim, plate or stroke behind it (40-60%% dark under light text), or move it over a calmer area; the colour fix: python3 skills/frame-design/scripts/contrast.py --pair "%s" "#bg"' % (t['fg'] or '#fg'),
                'The text blends into the picture behind it and is hard to read.', 'contrast'))
    hook = None
    first = min(texts, key=lambda x: x['t'][0])
    by = SPEC['platforms']['presets'].get(ctx['platform'], {}).get('hook_text_by_s')
    if by is not None and ctx.get('plan') and first['src'] != 'captions[]':
        hook = round(first['t'][0], 2)
        if first['t'][0] > by + 1.0 / c.fps:
            issues.append(issue('warn', [hook, hook], 'the first on-screen text starts at %.2f s; hook text goes on screen by %.1f s (%s)' % (first['t'][0], by, ctx['platform']),
                                'start the hook line by %.1f s (frame %d)' % (by, int(by * c.fps)), 'The clip opens without a word to read, so the hook arrives late.', 'hook_text'))
        hw = len(first['text'].split())
        if first['t'][0] <= 1.0 and hw > sp['hook_max_words']:
            issues.append(issue('warn', [hook, hook], 'the hook text has %d words (at most %d)' % (hw, sp['hook_max_words']), 'cut it to %d words' % sp['hook_max_words'], 'The opening line is too long to read in the first second.', 'hook_words'))
    m = {'texts': rows, 'hook_text_start_s': hook, 'with_boxes': sum(1 for t in texts if t['box'])}
    if not m['with_boxes']:
        notes.append('the plan gives no text boxes, so size is not measured from pixels and contrast is not measured; add plan.texts [{text, t, box, fontPx, fg}]')
    return result(cid, 'readability', m, 'text over the frame-design floors (%d px / %d px at 1080, wide / tall read line), held 0.35 s + 0.28 s per word, >= %.1f:1 contrast' % (
        sp['floors_px_1080']['read']['wide'], sp['floors_px_1080']['read']['tall'], sp['contrast_pass']), issues, notes)
