"""motion-pack / eyes / core.py: probing, decoding, side inputs (plan, platform), the platform safe rectangle and the shared picture maths.
Everything is numpy / scipy on frames that ffmpeg decodes; nothing is downloaded and nothing reads the clock, so the same file gives the same report."""
import json
import os
import re
import subprocess

import numpy as np

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
FFPROBE = os.environ.get('FFPROBE', 'ffprobe')
MANIFEST = json.load(open(os.path.join(os.path.dirname(__file__), 'manifest.json')))
SPEC = MANIFEST['spec']
ORDER = {'n/a': -1, 'info': 0, 'pass': 0, 'warn': 1, 'fail': 2}


# ------------------------------------------------------------------------------------------------ result shapes (the same as ears)
def result(cid, category, measured, target, issues, notes=None, status=None):
    st = status or (max((i['severity'] for i in issues), key=ORDER.get) if issues else 'pass')
    return {'id': cid, 'category': category, 'status': st, 'measured': measured, 'target': target, 'issues': issues, 'notes': notes or []}


def issue(sev, t, what, fix, viewer, kind=None):
    """kind groups repeats of one problem (several frames, several lines) so a score counts it once"""
    return {'severity': sev, 't': t, 'what': what, 'fix': fix, 'viewer': viewer, 'kind': kind}


def na(cid, category, why, target=''):
    return result(cid, category, {}, target, [], [why], status='n/a')


# ------------------------------------------------------------------------------------------------ probing
def probe(path):
    """width, height (as displayed), fps, codec, profile, pix_fmt, colour tags, bit rates, container, size, duration; None where ffprobe has no value"""
    r = subprocess.run([FFPROBE, '-v', 'error', '-show_entries',
                        'stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,bit_rate,color_range,color_space,color_transfer,'
                        'color_primaries,nb_frames:stream_tags=rotate:stream_side_data=rotation:format=format_name,duration,size,bit_rate',
                        '-of', 'json', path], capture_output=True, text=True)
    info = {k: None for k in ('width', 'height', 'fps', 'codec', 'profile', 'pix_fmt', 'color_range', 'color_space', 'color_transfer', 'color_primaries', 'v_bit_rate',
                              'a_bit_rate', 'format', 'size', 'duration', 'has_audio', 'nb_frames')}
    info['has_audio'] = False
    if r.returncode != 0:
        return info
    d = json.loads(r.stdout or '{}')
    for s in d.get('streams', []):
        if s.get('codec_type') == 'audio':
            info['has_audio'] = True
            info['a_bit_rate'] = int(s['bit_rate']) if str(s.get('bit_rate', '')).isdigit() else None
        if s.get('codec_type') == 'video' and info['width'] is None:
            w, h = int(s.get('width') or 0), int(s.get('height') or 0)
            rot = (s.get('tags') or {}).get('rotate')
            for sd in s.get('side_data_list') or []:
                rot = sd.get('rotation', rot)
            if rot is not None and abs(int(float(rot))) % 180 == 90:
                w, h = h, w                                                   # ffmpeg autorotates on decode
            info.update(width=w, height=h, codec=s.get('codec_name'), profile=s.get('profile'), pix_fmt=s.get('pix_fmt'), color_range=s.get('color_range'),
                        color_space=s.get('color_space'), color_transfer=s.get('color_transfer'), color_primaries=s.get('color_primaries'),
                        v_bit_rate=int(s['bit_rate']) if str(s.get('bit_rate', '')).isdigit() else None,
                        nb_frames=int(s['nb_frames']) if str(s.get('nb_frames', '')).isdigit() else None)
            for key in ('avg_frame_rate', 'r_frame_rate'):
                a, _, b = (s.get(key) or '0/1').partition('/')
                if float(b or 1) and float(a) and info['fps'] is None:
                    info['fps'] = float(a) / float(b or 1)
    f = d.get('format') or {}
    info.update(format=f.get('format_name'), size=int(f['size']) if str(f.get('size', '')).isdigit() else None, duration=float(f.get('duration') or 0) or None)
    return info


def packets(path):
    """[(pts seconds, is_keyframe)] of the video stream in presentation order (ffprobe packets: no decode)"""
    r = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', path], capture_output=True, text=True)
    out = []
    for line in r.stdout.splitlines():
        a, _, fl = line.partition(',')
        try:
            out.append((float(a), 'K' in fl))
        except ValueError:
            continue
    return sorted(out)


_FPSMODE = None


def _passthrough():
    global _FPSMODE
    if _FPSMODE is None:
        h = subprocess.run([FFMPEG, '-hide_banner', '-h', 'full'], capture_output=True, text=True).stdout
        _FPSMODE = ['-fps_mode', 'passthrough'] if 'fps_mode' in h else ['-vsync', '0']
    return _FPSMODE


# ------------------------------------------------------------------------------------------------ decoding
def _read_exact(f, n):
    buf = bytearray()
    while len(buf) < n:
        b = f.read(n - len(buf))
        if not b:
            break
        buf += b
    return bytes(buf)


def iter_frames(path, w, h, pix='rgb24', vf=None):
    """frames as numpy arrays (h, w, 3) uint8 for rgb24 or (h, w) for gray, decoded by ffmpeg through the filter chain vf (which must end at w x h)"""
    ch = 3 if pix == 'rgb24' else 1
    cmd = [FFMPEG, '-v', 'error', '-nostdin', '-i', path, '-an', '-sn'] + (['-vf', vf] if vf else []) + _passthrough() + ['-f', 'rawvideo', '-pix_fmt', pix, '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    fsz = w * h * ch
    try:
        while True:
            b = _read_exact(p.stdout, fsz)
            if len(b) < fsz:
                break
            a = np.frombuffer(b, np.uint8)
            yield a.reshape(h, w, 3) if ch == 3 else a.reshape(h, w)
    finally:
        p.stdout.close()
        p.kill()
        p.wait()


def iter_select(path, idxs, w, h, pix='rgb24', vf_tail=None):
    """(index, array) for the decoded frames with these indexes (0-based, decode order), native size unless vf_tail rescales to w x h"""
    idxs = sorted({int(i) for i in idxs})
    for a in range(0, len(idxs), 120):
        chunk = idxs[a:a + 120]
        sel = 'select=' + '+'.join('eq(n\\,%d)' % i for i in chunk)
        vf = sel + (',' + vf_tail if vf_tail else '')
        for i, fr in zip(chunk, iter_frames(path, w, h, pix, vf)):
            yield i, fr


def lin_lut():
    c = np.arange(256) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


LIN = lin_lut()


def luma(rgb):
    """BT.709 luma on the gamma values, 0-255 float (rgb: (..., 3) uint8)"""
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def rel_lum(rgb):
    """WCAG relative luminance 0-1 of (..., 3) uint8 rgb"""
    lin = LIN[rgb]
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722


def lum_from_gray(y):
    """relative luminance of a gray (gamma) value array 0-255"""
    return LIN[np.clip(np.rint(y), 0, 255).astype(np.uint8)]


def ratio(l1, l2):
    hi, lo = np.maximum(l1, l2), np.minimum(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def parse_hex(h):
    m = re.match(r'^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$', str(h or '').strip())
    if not m:
        return None
    s = m.group(1)
    s = ''.join(c * 2 for c in s) if len(s) == 3 else s
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def runs(mask, t, min_len=0.0, merge_gap=0.0):
    """contiguous True runs of a boolean series sampled at times t -> [[t0, t1]] (t1 = the next sample after the last True; merged over gaps; at least min_len long)"""
    out, start = [], None
    n = len(mask)
    for i in range(n):
        if mask[i] and start is None:
            start = i
        if start is not None and (not mask[i] or i == n - 1):
            last = i if mask[i] else i - 1
            a = float(t[start])
            b = float(t[last + 1]) if last + 1 < len(t) else float(t[last] + (t[last] - t[last - 1] if last > 0 else 0.0))
            if out and a - out[-1][1] <= merge_gap:
                out[-1][1] = b
            else:
                out.append([a, b])
            start = None
    return [[round(a, 2), round(b, 2)] for a, b in out if b - a >= min_len - 1e-9]


def fmt_ranges(rs, n=4):
    s = ', '.join('%.2f-%.2f s' % (a, b) for a, b in rs[:n])
    return s + (' (+%d more)' % (len(rs) - n) if len(rs) > n else '')


# ------------------------------------------------------------------------------------------------ the clip: one analysis pass shared by every check
class Clip:
    """a decoded clip at analysis resolution (long side SPEC.analysis.long_side px): gray frames and the per-frame numbers the checks share.
    Frame times come from the video's own timestamps (so a stall is visible), frame i is decode-order frame i."""

    def __init__(self, path, info=None):
        self.path = path
        self.info = info or probe(path)
        W, H = self.info['width'], self.info['height']
        if not W or not H:
            raise SystemExit('eyes: %s has no video stream' % path)
        self.W, self.H = W, H
        self.s = min(W, H) / 1080.0                                           # px of this frame relative to the 1080 reference (frame-design size table)
        L = SPEC['analysis']['long_side']
        self.aw, self.ah = (L, max(8, int(round(L * H / W)))) if W >= H else (max(8, int(round(L * W / H))), L)
        self._decode()
        n = self.n
        pk = packets(path)
        t0 = pk[0][0] if pk else 0.0
        fps = self.info['fps'] or 30.0
        if len(pk) == n:
            self.t = np.array([a - t0 for a, _ in pk])
            self.key = np.array([k for _, k in pk])
        else:
            self.t = np.arange(n) / fps
            self.key = np.zeros(n, bool)
            self.key[0] = n > 0
        self.pk_ok = len(pk) == n
        self.fps = fps
        self.dur = float(self.t[-1] + 1.0 / fps) if n else 0.0

    def _decode(self):
        aw, ah = self.aw, self.ah
        vf = 'scale=%d:%d:flags=area' % (aw, ah)
        ys, mean_y, std_y, mean_l, diff, diff_hi, up, dn, red = [], [], [], [], [], [], [], [], []
        prev_l = None
        prev_red = None
        for rgb in iter_frames(self.path, aw, ah, 'rgb24', vf):
            y = luma(rgb.astype(np.float32))
            ys.append(np.rint(y).astype(np.uint8))
            mean_y.append(float(y.mean()))
            std_y.append(float(y.std()))
            lin = LIN[rgb]
            lum = lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722
            mean_l.append(float(lum.mean()))
            sat = lin.sum(axis=2)
            fs = SPEC['flashes']
            rmask = (lin[..., 0] >= fs['red_ratio'] * np.maximum(sat, 1e-9)) & ((rgb[..., 0].astype(np.int16) - rgb[..., 1] - rgb[..., 2]) >= fs['red_gamma_min'] * 255)
            ra = float(rmask.mean())
            if prev_l is None:
                diff.append(0.0); diff_hi.append(0.0); up.append(0.0); dn.append(0.0); red.append(0.0)
            else:
                ad = np.abs(y - prev_y)
                diff.append(float(ad.mean()))
                diff_hi.append(float((ad >= SPEC['frames']['frozen_hi_delta']).mean()))
                d = lum - prev_l
                big = (np.abs(d) >= fs['luminance_delta']) & (np.minimum(lum, prev_l) < fs['darker_max'])
                up.append(float((big & (d > 0)).mean()))
                dn.append(float((big & (d < 0)).mean()))
                red.append(ra - prev_red)
            prev_l, prev_y, prev_red = lum, y, ra
        self.Y = np.stack(ys) if ys else np.zeros((0, ah, aw), np.uint8)
        self.n = len(ys)
        self.mean_y, self.std_y, self.mean_l = np.array(mean_y), np.array(std_y), np.array(mean_l)
        self.diff = np.array(diff)                                            # mean |Y_i - Y_(i-1)| in 0-255 levels
        self.diff_hi = np.array(diff_hi)                                      # share of pixels that moved by frozen_hi_delta levels or more
        self.area_up, self.area_dn, self.d_red = np.array(up), np.array(dn), np.array(red)

    def idx(self, t):
        """nearest frame index to time t (s)"""
        return int(np.clip(np.searchsorted(self.t, t - 1e-9), 0, max(0, self.n - 1)))


def detect_cuts(clip):
    """hard cuts: a frame-to-frame mean difference far above its neighbours' (>= scene.min_diff levels and >= scene.k x the local median), at least min_gap_s apart.
    returns [frame index of the first frame of the new shot]"""
    sc = SPEC['scene']
    d, n = clip.diff / 255.0, clip.n                                          # the difference as a fraction of full scale
    out = []
    for i in range(1, n):
        lo, hi = max(1, i - 4), min(n, i + 5)
        nb = np.concatenate([d[lo:i], d[i + 1:hi]])
        med = float(np.median(nb)) if len(nb) else 0.0
        if d[i] >= sc['min_diff'] and d[i] >= sc['k'] * max(med, sc['floor']):
            if out and clip.t[i] - clip.t[out[-1]] < sc['min_gap_s']:
                if d[i] > d[out[-1]]:
                    out[-1] = i
            else:
                out.append(i)
    return out


# ------------------------------------------------------------------------------------------------ platform + plan
def aspect_name(W, H):
    r = W / H
    for name, v in (('9:16', 9 / 16), ('4:5', 4 / 5), ('1:1', 1.0), ('16:9', 16 / 9)):
        if abs(r - v) / v <= SPEC['composition']['aspect_tol']:
            return name
    return '%.3f:1' % r


def default_platform(W, H):
    return SPEC['platforms']['default_by_aspect'].get(aspect_name(W, H), 'conservative')


def safe_rect(platform, W, H):
    """(x0, y0, x1, y1, source note) of the safe area in px of a W x H frame. A type/safezones.js id (conservative, tiktok, reels, ...) scales its reference px by
    H / 1920 (tall) or H / 1080 (wide). A plan.mjs preset id (tiktok.organic, x.video, ...) uses the conservative rect when the delivered frame is 9:16 and its
    fractions (top, bottom, side) otherwise."""
    P = SPEC['platforms']
    z = P['safezones'].get(platform)
    if z:
        sc = H / (1920.0 if z['ref'] == 'tall' else 1080.0)
        return z['left'] * sc, z['top'] * sc, W - z['right'] * sc, H - z['bottom'] * sc, 'type/safezones.js %s' % platform
    pr = P['presets'].get(platform)
    if pr:
        asp = aspect_name(W, H)
        if asp == '9:16':
            return safe_rect('conservative', W, H)[:4] + ('platforms.md 9:16 conservative rectangle (%s)' % platform,)
        if asp not in pr['aspects']:                                           # the platform does not take this shape: the composition check says so; the rect is the shape's default
            return safe_rect(default_platform(W, H), W, H)[:4] + ('default for %s (%s does not take it)' % (asp, platform),)
        f = pr['safe_frac']
        return f['side'] * W, f['top'] * H, W - f['side'] * W, H - f['bottom'] * H, 'templates/_shared/plan.mjs %s' % platform
    return safe_rect(default_platform(W, H), W, H)


def resolve_platform(platform, plan, W, H):
    if platform and platform != 'auto':
        if platform not in SPEC['platforms']['safezones'] and platform not in SPEC['platforms']['presets']:
            raise SystemExit('eyes: unknown platform %r (known: %s)' % (platform, ', '.join(list(SPEC['platforms']['presets']) + list(SPEC['platforms']['safezones']))))
        return platform
    p = (plan or {}).get('platform')
    if p in SPEC['platforms']['presets'] or p in SPEC['platforms']['safezones']:
        return p
    return default_platform(W, H)


def load_json(path):
    return json.load(open(path)) if path else None


def plan_scale(plan, W):
    """the factor from the plan's own frame width to the delivered one (an animatic plan at 960 px read against a 1080 render); 1 when the plan names no size"""
    if not plan:
        return 1.0
    sz = plan.get('size')
    pw = plan.get('W') or (sz[0] if isinstance(sz, (list, tuple)) and sz else None)
    return W / float(pw) if pw else 1.0


def plan_texts(plan, W, H):
    """on-screen texts a plan declares -> [{id, text, t: [a, b], box: (x0, y0, x1, y1) px of the delivered frame or None, font_px (delivered px) or None,
    role, fg, bg, lines, src}]. Sources, in order: plan.texts / plan.eyes.texts (explicit: box, fontPx, role, fg, bg, lines, text, t | start + end | start + dur);
    shots[].text with textDur (timing only); talking-head captions[] (words + start / end, timing only)."""
    if not plan:
        return []
    k = plan_scale(plan, W)
    fps = float(plan.get('fps') or 30)
    out = []
    ex = plan.get('texts') or (plan.get('eyes') or {}).get('texts') or []
    for i, x in enumerate(ex):
        t = x.get('t')
        if not t:
            a = x.get('start', x.get('at'))
            b = x.get('end', (a + x['dur']) if a is not None and x.get('dur') is not None else None)
            t = [a, b] if a is not None and b is not None else None
        if not t or len(t) != 2:
            continue
        bx = x.get('box')
        if isinstance(bx, dict):
            bx = [bx.get('x0'), bx.get('y0'), bx.get('x1'), bx.get('y1')]
        box = tuple(float(v) * k for v in bx) if bx and len(bx) == 4 and all(v is not None for v in bx) else None
        out.append({'id': x.get('id') or 'text%d' % i, 'text': str(x.get('text', '')), 't': [float(t[0]), float(t[1])], 'box': box,
                    'font_px': float(x['fontPx']) * k if x.get('fontPx') else None, 'role': (x.get('role') or 'read').lower(), 'fg': x.get('fg'), 'bg': x.get('bg'), 'fg_alt': list(x.get('fgAlt') or []),
                    'lines': x.get('lines'), 'src': 'plan.texts'})
    if out:
        return out
    for s in plan.get('shots') or []:
        if isinstance(s.get('text'), str) and s['text'].strip() and s.get('textDur') and s.get('start') is not None:
            out.append({'id': s.get('id', 'shot'), 'text': s['text'].replace('*', ''), 't': [float(s['start']), float(s['start']) + float(s['textDur'])], 'box': None,
                        'font_px': None, 'role': 'read', 'fg': None, 'bg': None, 'lines': None, 'src': 'shots[].text'})
    for c in plan.get('captions') or []:
        if isinstance(c, dict) and isinstance(c.get('words'), list) and c.get('start') is not None and c.get('end') is not None:
            out.append({'id': c.get('id', 'cap'), 'text': ' '.join(str(w.get('w', '')) for w in c['words']), 't': [float(c['start']), float(c['end'])], 'box': None,
                        'font_px': None, 'role': 'caption', 'fg': None, 'bg': None, 'lines': None, 'src': 'captions[]'})
    return out


def plan_holds(plan):
    """planned still holds [(t0, t1, why)]: shots with hold true, plan.holds / plan.eyes.holds [{t: [a, b], why}], and audio.quiet regions of kind hold (an end card on near-silence)"""
    out = []
    if not plan:
        return out
    for s in plan.get('shots') or []:
        if s.get('hold') and s.get('start') is not None and s.get('dur'):
            out.append((float(s['start']), float(s['start']) + float(s['dur']), 'shot %s hold' % s.get('id', '')))
    for h in plan.get('holds') or (plan.get('eyes') or {}).get('holds') or []:
        t = h.get('t') if isinstance(h, dict) else h
        if t and len(t) == 2:
            out.append((float(t[0]), float(t[1]), (h.get('why') if isinstance(h, dict) else '') or 'plan.holds'))
    for q in ((plan.get('audio') or {}).get('quiet') or []):
        if isinstance(q, dict) and q.get('kind') == 'hold' and q.get('t') and len(q['t']) == 2:
            out.append((float(q['t'][0]), float(q['t'][1]), 'audio.quiet hold'))
    return out


def plan_black(plan):
    """planned dark stretches [(t0, t1)]: plan.black / plan.eyes.black [[a, b]], and 0.5 s either side of a shot start whose transition is a dip (tx contains dip)"""
    out = []
    if not plan:
        return out
    for b in plan.get('black') or (plan.get('eyes') or {}).get('black') or []:
        t = b.get('t') if isinstance(b, dict) else b
        if t and len(t) == 2:
            out.append((float(t[0]), float(t[1])))
    w = SPEC['frames']['dip_window_s']
    for s in plan.get('shots') or []:
        tx = str(s.get('tx') or s.get('transition') or '')
        if 'dip' in tx.lower() and s.get('start') is not None:
            out.append((float(s['start']) - w, float(s['start']) + w))
    return out


def inside(t0, t1, regions, slack=0.1):
    return any(t0 >= a - slack and t1 <= b + slack for a, b, *_ in regions)


def overlap(t0, t1, regions):
    return sum(max(0.0, min(t1, b) - max(t0, a)) for a, b, *_ in regions)
