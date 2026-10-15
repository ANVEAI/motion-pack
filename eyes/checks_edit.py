"""motion-pack / eyes / checks_edit.py: pacing, composition (one hero, bars, aspect and resolution) and the encode.
Same result shape as checks_frames.py."""
import json
import os
import struct

import numpy as np
from scipy import ndimage
from scipy.ndimage import gaussian_filter

from . import core
from .core import SPEC, PACK, result, issue, iter_select
from .checks_frames import sample_indices


def _pace_table():
    return json.load(open(os.path.join(PACK, 'cuts', 'patterns.json')))['pace']


def plan_format(plan, fmt):
    if fmt:
        return fmt
    if plan:
        return plan.get('format') if plan.get('format') in _pace_table() else SPEC['pacing']['template_format'].get(plan.get('template'))
    return None


# ------------------------------------------------------------------------------------------------ pacing
def static_holds(c):
    """[(frame a, frame b)] stretches where the picture stays within static_diff_levels (mean) of where the stretch began"""
    thr, out, a = SPEC['pacing']['static_diff_levels'], [], 0
    ref = c.Y[0].astype(np.float32)
    for i in range(1, c.n):
        if float(np.abs(c.Y[i] - ref).mean()) >= thr:
            out.append((a, i))
            a, ref = i, c.Y[i].astype(np.float32)
    out.append((a, c.n))
    return out


def pacing(ctx):
    c, sp, plan = ctx['clip'], SPEC['pacing'], ctx.get('plan')
    cid = 'eyes/pacing'
    if c.n < 2:
        return core.na(cid, 'pacing', 'fewer than 2 frames')
    cuts = ctx['cuts']
    b = [0] + list(cuts) + [c.n]
    tb = [float(c.t[i]) if i < c.n else c.dur for i in b]
    shots = [(tb[k], tb[k + 1]) for k in range(len(b) - 1)]
    lens = np.array([y - x for x, y in shots])
    holds = core.plan_holds(plan)
    issues, notes = [], []
    fmt = ctx.get('format')
    rule = (plan or {}).get('paceRule') or {}
    m = {'cuts': len(cuts), 'cuts_per_min': round(len(cuts) * 60.0 / c.dur, 1), 'shots': len(shots), 'shots_per_30s': round(len(shots) * 30.0 / c.dur, 1),
         'shot_median_s': round(float(np.median(lens)), 2), 'shot_mean_s': round(float(lens.mean()), 2), 'shot_longest_s': round(float(lens.max()), 2), 'format': fmt,
         'cut_times_s': [round(float(c.t[i]), 3) for i in cuts]}
    if plan and plan.get('shots'):
        starts = [float(s['start']) for s in plan['shots'] if s.get('start') is not None and float(s['start']) > 1e-6]
        tol = sp['cut_match_frames'] / c.fps
        hit = sum(1 for s in starts if any(abs(s - float(c.t[i])) <= tol + 1e-6 for i in cuts))
        m['plan_cuts'], m['plan_cuts_found'] = len(starts), hit
        if starts:
            notes.append('%d of %d planned shot starts show as a hard cut in the picture (within %d frames); the rest are dissolves, in-shot moves or transitions the detector does not count' % (hit, len(starts), sp['cut_match_frames']))
    sts = static_holds(c)
    runs_ = [(float(c.t[a]), float(c.t[bb]) if bb < c.n else c.dur) for a, bb in sts]
    longest = max(runs_, key=lambda r: r[1] - r[0])
    m['static_hold_longest_s'] = round(longest[1] - longest[0], 2)
    m['static_hold_at_s'] = round(longest[0], 2)
    for t0, t1 in runs_:
        d = t1 - t0
        if d <= sp['static_warn_s']:
            continue
        if core.overlap(t0, t1, holds) >= 0.8 * d:
            notes.append('static hold %.2f-%.2f s (%.1f s) is a planned hold' % (t0, t1, d))
        elif (not plan) and t1 >= c.dur - 0.05 and d <= SPEC['frames']['endcard_hold_max_s']:
            notes.append('the last %.1f s hold still: read as an end card (give a plan to mark it)' % d)
        else:
            issues.append(issue('fail' if d > sp['static_fail_s'] else 'warn', [round(t0, 2), round(t1, 2)],
                                'the picture barely changes for %.1f s (%.2f-%.2f s); something should visibly change at least every %.1f s' % (d, t0, t1, sp['static_warn_s']),
                                'add an interrupt there: a cut, a push-in, a new element, a punch-in (cuts/interrupts, virality interrupt ladder); a planned hold goes in plan.shots[].hold',
                                'The video sits still and loses the viewer.', 'static'))
    tab = _pace_table()
    asl, mean_asl = m['shot_mean_s'], m['shot_mean_s']
    if rule.get('aslMax') is not None or rule.get('longMax') is not None:
        am, lm = float(rule.get('aslMax', sp['default_asl_max_s'])), float(rule.get('longMax', sp['default_long_max_s']))
        m['rule'] = {'aslMax': am, 'longMax': lm, 'source': 'plan.paceRule'}
        if mean_asl > am:
            issues.append(issue('warn', None, 'average shot length %.2f s is over the plan rule %.2f s (%d detected shots)' % (mean_asl, am, len(shots)),
                                'cut more often or add interrupts; or fix paceRule if the film is meant to be slow (only hard cuts are detected, so a dissolve-driven film reads long)', 'The edit feels slow.', 'asl'))
        for x, y in shots:
            if y - x > lm and core.overlap(x, y, holds) < 0.8 * (y - x) and not (y >= c.dur - 0.05 and not plan):
                issues.append(issue('warn', [round(x, 2), round(y, 2)], 'a shot of %.2f s (%.2f-%.2f s) is over the plan rule longMax %.1f s' % (y - x, x, y, lm),
                                    'cut into it, or mark it plan.shots[].hold true if it is a hero reveal or an end card', 'One shot drags on.', 'long'))
    elif fmt and fmt in tab:
        f = tab[fmt]
        m['rule'] = {'format': fmt, 'source': 'cuts/patterns.json pace'}
        lo, hi = None, None
        if 'asl_s' in f:
            lo, hi = f['asl_s']
        elif 'asl_beats' in f and plan and plan.get('beatSec'):
            lo, hi = (v * float(plan['beatSec']) for v in f['asl_beats'])
        if lo is not None:
            m['rule']['asl_s'] = [round(lo, 2), round(hi, 2)]
            if not lo - 1e-9 <= mean_asl <= hi + 1e-9:
                issues.append(issue('warn', None, 'average shot length %.2f s is outside the %s range %.1f-%.1f s' % (mean_asl, fmt, lo, hi),
                                    ('cut more often (target %.1f-%.1f s per shot)' if mean_asl > hi else 'let shots breathe (target %.1f-%.1f s per shot)') % (lo, hi),
                                    'The edit is faster or slower than this kind of video usually is.', 'asl'))
        if 'shots_per_30s' in f:
            slo, shi = f['shots_per_30s']
            m['rule']['shots_per_30s'] = [slo, shi]
            if not slo * 0.8 <= m['shots_per_30s'] <= shi * 1.2:
                notes.append('%.1f shots per 30 s is outside the %s range %d-%d (hard cuts only)' % (m['shots_per_30s'], fmt, slo, shi))
    else:
        notes.append('no format or paceRule: only the static-hold rule is judged; pass --format hype_ad|beat_edit|talking_head|mime_spot|short_film for the shot-length range')
    return result(cid, 'pacing', m, 'a visible change at least every %.1f s; shot length against the format (cuts/patterns.json pace) or the plan paceRule' % sp['static_warn_s'], issues, notes)


# ------------------------------------------------------------------------------------------------ composition
def bars(c):
    """persistent near-black edge bars as fractions of the frame sides: {top, bottom, left, right}"""
    sp = SPEC['composition']
    Y = c.Y.astype(np.float32)
    dark = lambda m, s: (m <= sp['bar_mean_y']) & (s <= sp['bar_std_y'])
    rows = dark(Y.mean(axis=2), Y.std(axis=2)).mean(axis=0) >= sp['bar_persist']
    cols = dark(Y.mean(axis=1), Y.std(axis=1)).mean(axis=0) >= sp['bar_persist']
    lead = lambda a: int(np.argmin(a)) if not a.all() else len(a)
    h, w = c.Y.shape[1:]
    return {'top': lead(rows) / h, 'bottom': lead(rows[::-1]) / h, 'left': lead(cols) / w, 'right': lead(cols[::-1]) / w}


def saliency_blobs(Y):
    """the saliency blobs of a luma frame: [(mass, (cy, cx))] strongest first, from the centre-surround response thresholded at hero_threshold of its maximum"""
    sp = SPEC['composition']
    lum = core.LIN[Y]
    m = max(Y.shape)
    S = np.abs(gaussian_filter(lum, sp['sigma_frac'][0] * m) - gaussian_filter(lum, sp['sigma_frac'][1] * m))
    if S.max() <= 1e-4:
        return [], S
    mask = ndimage.binary_dilation(S >= sp['hero_threshold'] * S.max(), iterations=2)
    lab, n = ndimage.label(mask, structure=np.ones((3, 3), bool))
    out = []
    for k in range(1, n + 1):
        sel = lab == k
        if sel.mean() < sp['hero_min_area']:
            continue
        mass = float(S[sel].sum())
        cy, cx = ndimage.center_of_mass(S * sel)
        out.append((mass, (float(cy), float(cx))))
    return sorted(out, reverse=True), S


def composition(ctx):
    c, sp, plan = ctx['clip'], SPEC['composition'], ctx.get('plan')
    cid = 'eyes/composition'
    issues, notes = [], []
    asp = core.aspect_name(c.W, c.H)
    pl = ctx['platform']
    pr = SPEC['platforms']['presets'].get(pl)
    allowed = pr['aspects'] if pr else (['9:16'] if SPEC['platforms']['safezones'].get(pl, {}).get('ref') == 'tall' else ['16:9'])
    short = min(c.W, c.H)
    if asp not in allowed:
        issues.append(issue('fail', None, 'the frame is %s (%dx%d); %s takes %s' % (asp, c.W, c.H, pl, ', '.join(allowed)),
                            're-lay the film out for %s (do not crop or letterbox it: Export set, platforms.md); size %s' % (allowed[0], 'x'.join(str(v) for v in SPEC['platforms']['sizes']['tall' if allowed[0] == '9:16' else 'square' if allowed[0] == '1:1' else 'wide'])),
                            'The video is the wrong shape for where it plays: the feed crops it or pads it with bars.', 'aspect'))
    if short < sp['short_side_warn']:
        (notes if ctx.get('draft') else issues).append(('draft: shorter side %d px (waived)' % short) if ctx.get('draft') else issue(
            'fail', None, 'the shorter side is %d px (under %d)' % (short, sp['short_side_warn']), 'render at 1080 on the shorter side (templates render 1920x1080 or 1080x1920)', 'The picture is soft and pixelated on a phone.', 'res'))
    elif short < sp['short_side_pass']:
        (notes if ctx.get('draft') else issues).append(('draft: shorter side %d px (waived)' % short) if ctx.get('draft') else issue(
            'warn', None, 'the shorter side is %d px; the pack masters at %d' % (short, sp['short_side_pass']), 'render at 1080 on the shorter side', 'The picture is a little soft.', 'res'))
    bz = bars(c)
    total = 1 - (1 - bz['top'] - bz['bottom']) * (1 - bz['left'] - bz['right'])
    ask = bool((plan or {}).get('eyes', {}).get('letterbox')) or any(k in json.dumps({x: (plan or {}).get(x) for x in ('layers', 'look', 'finish')}).lower() for k in ('letterbox', 'bars'))
    bar_sides = {k: round(v, 3) for k, v in bz.items() if v >= sp['bar_min_frac']}
    if bar_sides:
        ts = ', '.join('%s %.0f%%' % (k, 100 * v) for k, v in bar_sides.items())
        if ask:
            notes.append('black bars (%s) are asked for in the plan (letterbox look)' % ts)
        else:
            issues.append(issue('fail' if total >= sp['bar_fail_frac'] else 'warn', None, 'black bars on %s of the frame sides (%.0f%% of the area) that the plan does not ask for' % (ts, 100 * total),
                                'the content is letterboxed or pillarboxed: re-layout it to fill the %s frame (never place a 16:9 clip inside 9:16); if the bars are a look, name them in plan.layers (bars) or plan.eyes.letterbox' % asp,
                                'Thick black bars shrink the picture and waste the screen.', 'bars'))
    idxs = sorted(set(sample_indices(c, ctx['cuts'], sp['key_frames']) + [0, c.n - 1]))
    rows, comp = [], []
    for i in idxs:
        bl, S = saliency_blobs(c.Y[i])
        tot = sum(x[0] for x in bl) or 1.0
        top = bl[0][0] if bl else 0.0
        rivals = [x for x in bl[1:] if x[0] >= sp['hero_mass_ratio'] * top]
        p = S / max(S.sum(), 1e-9)
        yy, xx = np.mgrid[0:S.shape[0], 0:S.shape[1]]
        my, mx = (p * yy).sum(), (p * xx).sum()
        spread = float(np.sqrt((p * (yy - my) ** 2).sum() / S.shape[0] ** 2 + (p * (xx - mx) ** 2).sum() / S.shape[1] ** 2))
        rows.append({'frame': i, 't': round(float(c.t[i]), 2), 'blobs': len(bl), 'competing': len(rivals), 'hero_share': round(top / tot, 2), 'spread': round(spread, 3)})
        if rivals:
            comp.append(rows[-1])
    frac = len(comp) / len(rows) if rows else 0.0
    if frac >= sp['competing_warn_frac'] and comp:
        issues.append(issue('warn', [comp[0]['t'], comp[-1]['t']], '%d of %d key frames have a second focal point as strong as the first (at %s s)' % (len(comp), len(rows), ', '.join('%.2f' % r['t'] for r in comp[:6])),
                            'give each key frame one hero: dim, shrink or remove the competing element (frame-design: the hero is the brightest or highest-contrast thing; one support, then texture)',
                            'The eye does not know where to look: two or more things pull equally.', 'hero'))
    m = {'aspect': asp, 'size': [c.W, c.H], 'platform': pl, 'accepted_aspects': allowed, 'bars': bar_sides, 'bar_area': round(total, 3), 'letterbox_asked': ask,
         'key_frames': rows, 'competing_share': round(frac, 2)}
    return result(cid, 'composition', m, 'one hero per key frame (under %.0f%% competing), no unplanned bars, %s at %d px or more on the shorter side' % (100 * sp['competing_warn_frac'], '/'.join(allowed), sp['short_side_pass']), issues, notes)


# ------------------------------------------------------------------------------------------------ encode
def faststart(path):
    """True when the moov atom comes before mdat, False when after, None when the file is not an MP4 / MOV box file"""
    try:
        with open(path, 'rb') as f:
            pos, size_total = 0, os.path.getsize(path)
            seen = []
            while pos < size_total and len(seen) < 64:
                f.seek(pos)
                h = f.read(8)
                if len(h) < 8:
                    break
                size, typ = struct.unpack('>I4s', h)
                if size == 1:
                    size = struct.unpack('>Q', f.read(8))[0]
                elif size == 0:
                    size = size_total - pos
                seen.append(typ)
                if typ in (b'moov', b'mdat') and b'moov' in seen and b'mdat' in seen:
                    return seen.index(b'moov') < seen.index(b'mdat')
                if size < 8:
                    return None
                pos += size
            return (seen.index(b'moov') < seen.index(b'mdat')) if b'moov' in seen and b'mdat' in seen else None
    except OSError:
        return None


def blockiness(Y):
    """the mean step across 8 and 16 px grid lines over the mean step elsewhere, on small steps only (an edge of the picture is not a block edge); 1.0 = no grid"""
    sp = SPEC['encode']
    Yi = Y.astype(np.int16)
    best = 1.0
    for d, ax in ((np.abs(Yi[:, 1:] - Yi[:, :-1]), 1), (np.abs(Yi[1:, :] - Yi[:-1, :]), 0)):
        idx = np.arange(d.shape[ax])
        for g in sp['grid']:
            bm = (idx + 1) % g == 0
            sb, so = (d[:, bm], d[:, ~bm]) if ax == 1 else (d[bm, :], d[~bm, :])
            sb, so = sb[sb <= sp['small_step_max']], so[so <= sp['small_step_max']]
            if sb.size and so.size and so.mean() >= 0.05:
                best = max(best, float(sb.mean() / so.mean()))
    return best


def encode(ctx):
    c, sp, info = ctx['clip'], SPEC['encode'], ctx['info']
    cid = 'eyes/encode'
    issues, notes = [], []
    fs = faststart(c.path)
    if info['codec'] not in sp['codecs']:
        issues.append(issue('warn', None, 'the video codec is %s; the pack masters H.264 (High)' % info['codec'], 're-encode: ffmpeg -c:v libx264 -profile:v high -pix_fmt yuv420p -movflags +faststart', 'Some platforms re-encode or reject other codecs, and older phones cannot play them.', 'codec'))
    if info['pix_fmt'] != sp['pix_fmt']:
        issues.append(issue('fail', None, 'the pixel format is %s, not %s' % (info['pix_fmt'], sp['pix_fmt']), 're-encode with -pix_fmt yuv420p (4:2:2, 4:4:4 and 10-bit files do not play in feeds or upload)', 'The video may not play on a phone or may be rejected on upload.', 'pix_fmt'))
    if fs is False:
        issues.append(issue('warn', None, 'the moov atom is after mdat: the file cannot start playing before it is fully downloaded', 're-mux: ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4', 'The video waits to load before it starts, and some uploaders stall.', 'faststart'))
    elif fs is None:
        notes.append('not an MP4 / MOV box file (%s): faststart not checked' % info['format'])
    if (info['height'] or 0) >= sp['colour_tag_min_height'] and not (info['color_space'] or info['color_primaries']) and info['color_space'] != 'bt709':
        issues.append(issue('warn', None, 'a %dp file with no colour tags (color_space, primaries, transfer are unset)' % info['height'], 're-encode with -colorspace bt709 -color_primaries bt709 -color_trc bt709 (setparams) so players do not guess', 'Colours can shift between players: skin looks off and blacks lift.', 'tags'))
    gop = None
    if c.pk_ok and c.key.any():
        kt = list(c.t[c.key]) + [c.dur]
        gop = float(max(np.diff(kt))) if len(kt) > 1 else c.dur
        if gop > sp['gop_warn_s']:
            issues.append(issue('fail' if gop > sp['gop_fail_s'] else 'warn', None, 'the longest keyframe interval is %.1f s (%d frames); over %.0f s warns' % (gop, round(gop * c.fps), sp['gop_warn_s']),
                                're-encode with -g %d -keyint_min %d (a keyframe every 2 s) and scenecut on' % (round(2 * c.fps), round(2 * c.fps)), 'The video seeks and loops slowly, and a platform re-encode keeps the long gap.', 'gop'))
    vbr = info['v_bit_rate'] or ((info['size'] * 8 / info['duration'] - (info['a_bit_rate'] or 0)) if info['size'] and info['duration'] else None)
    bpp = vbr / (c.W * c.H * c.fps) if vbr else None
    if bpp is not None and not ctx.get('draft'):
        if bpp < sp['bpp_warn']:
            issues.append(issue('fail' if bpp < sp['bpp_fail'] else 'warn', None, 'only %.4f bits per pixel per frame (%.2f Mb/s at %dx%d, %g fps); under %.3f warns' % (bpp, vbr / 1e6, c.W, c.H, c.fps, sp['bpp_warn']),
                                'raise the bit rate or lower the CRF (the pack demos use CRF 23; a 15 s 1080p file is a few MB)', 'Detail smears into blocks, worst in dark or noisy shots.', 'bitrate'))
    idxs = sample_indices(c, ctx['cuts'], sp['samples'])
    vals = [blockiness(Y) for _, Y in iter_select(c.path, idxs, c.W, c.H, 'gray', 'extractplanes=y')]
    blk = float(np.median(vals)) if vals else 1.0
    if blk >= sp['block_warn']:
        issues.append(issue('fail' if blk >= sp['block_fail'] else 'warn', None, 'blockiness %.2f (steps across the 8 and 16 px grid are %.0f%% larger than elsewhere; worst frame %.2f)' % (blk, 100 * (blk - 1), max(vals)),
                            're-encode with a lower CRF (18-23) and a slower preset; keep the source at full size so the encoder does not resample; avoid re-encoding an already compressed file', 'The picture shows visible squares, especially in smooth areas and dark scenes.', 'blocks'))
    m = {'codec': info['codec'], 'profile': info['profile'], 'pix_fmt': info['pix_fmt'], 'container': info['format'], 'faststart': fs, 'gop_max_s': None if gop is None else round(gop, 2),
         'video_bitrate_bps': vbr, 'bits_per_pixel': None if bpp is None else round(bpp, 4), 'blockiness': round(blk, 3), 'blockiness_max': round(max(vals), 3) if vals else None,
         'color_space': info['color_space'], 'color_primaries': info['color_primaries'], 'color_transfer': info['color_transfer'], 'color_range': info['color_range'],
         'size_bytes': info['size'], 'has_audio': info['has_audio']}
    return result(cid, 'encode', m, 'H.264 yuv420p, faststart, colour tagged, keyframe at least every %.0f s, >= %.3f bits per pixel, blockiness under %.2f' % (sp['gop_warn_s'], sp['bpp_warn'], sp['block_warn']), issues, notes)
