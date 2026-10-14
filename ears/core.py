"""motion-pack / ears / core.py: decoding, side inputs (plan, cuts, transcript, reference studies) and the shared DSP.
Loudness reuses the pack's one meter (sfx/mpaudio/meter.py: BS.1770-4 K-weighting, 48 kHz coefficients); everything else is numpy/scipy."""
import json
import os
import subprocess
import sys

import numpy as np
from scipy.signal import resample_poly

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(PACK, 'sfx'))
from mpaudio import meter  # noqa: E402  (the pack's single loudness meter)

SR = 48000
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
FFPROBE = os.environ.get('FFPROBE', 'ffprobe')
MANIFEST = json.load(open(os.path.join(os.path.dirname(__file__), 'manifest.json')))
SPEC = MANIFEST['spec']


# ------------------------------------------------------------------------------------------------ decoding
def probe(path):
    """channels, sample rate, fps (None without video), duration of a media file via ffprobe"""
    r = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'stream=codec_type,channels,sample_rate,r_frame_rate:format=duration',
                        '-of', 'json', path], capture_output=True, text=True)
    info = {'channels': None, 'sample_rate': None, 'fps': None, 'duration': None}
    if r.returncode != 0:
        return info
    d = json.loads(r.stdout or '{}')
    for s in d.get('streams', []):
        if s.get('codec_type') == 'audio' and info['channels'] is None:
            info['channels'], info['sample_rate'] = s.get('channels'), int(s.get('sample_rate') or 0) or None
        if s.get('codec_type') == 'video' and info['fps'] is None:
            a, _, b = (s.get('r_frame_rate') or '0/1').partition('/')
            info['fps'] = float(a) / float(b or 1) if float(b or 1) and float(a) else None
    info['duration'] = float((d.get('format') or {}).get('duration') or 0) or None
    return info


def decode(path):
    """any audio or video file -> (n, 2) float64 at 48 kHz (ffmpeg resamples; mono is duplicated, so check probe()['channels'])"""
    r = subprocess.run([FFMPEG, '-v', 'error', '-nostdin', '-i', path, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True)
    if r.returncode != 0:
        raise SystemExit('ears: ffmpeg could not decode %s: %s' % (path, r.stderr.decode(errors='ignore')[-400:]))
    a = np.frombuffer(r.stdout, dtype='<f4').astype(np.float64)
    return a.reshape(-1, 2) if a.size else np.zeros((0, 2))


# ------------------------------------------------------------------------------------------------ side inputs
def load_json(path):
    return json.load(open(path)) if path else None


def cuts_from(obj, fps):
    """cut times (s) from: a list of seconds; a list of {time_s|t|frame}; {cuts: [...]} (cutgen, refstudy study.json); {frames_out: [...]} (cutgen snap);
    or a plan.json (shot starts after 0)"""
    if obj is None:
        return None
    if isinstance(obj, dict):
        if 'shots' in obj:
            return sorted({round(float(s['start']), 4) for s in obj['shots'] if float(s.get('start', 0)) > 1e-6})
        f = float(obj.get('fps') or fps)
        if 'frames_out' in obj:
            return [x / f for x in obj['frames_out'] if x > 0]
        return cuts_from(obj.get('cuts', []), f)
    out = []
    for c in obj:
        if isinstance(c, (int, float)):
            out.append(float(c))
        elif isinstance(c, dict):
            if 'time_s' in c: out.append(float(c['time_s']))
            elif 't' in c: out.append(float(c['t']))
            elif 'frame' in c: out.append(float(c['frame']) / fps)
    return sorted(t for t in out if t > 1e-6)


def speech_from(obj):
    """speech segments [(s, e, words)] from a refstudy study.json (speech.segments s/e/text), a Whisper JSON (segments start/end/text, words)
    or a word list ({words: [{w, s, e}]}, the talking-head template's words.json)"""
    if obj is None:
        return None
    if isinstance(obj, dict) and isinstance(obj.get('speech'), dict):
        obj = obj['speech']
    if isinstance(obj, dict) and isinstance(obj.get('words'), list) and 'segments' not in obj:   # words.json: [{w, s, e}] -> lines (gaps over 0.3 s split)
        segs = []
        for w in obj['words']:
            a, b = w.get('s', w.get('start')), w.get('e', w.get('end'))
            if a is None or b is None:
                continue
            if segs and a - segs[-1]['e'] <= 0.3:
                segs[-1]['e'] = b; segs[-1]['n'] += 1
            else:
                segs.append({'s': a, 'e': b, 'n': 1})
        return [(float(x['s']), float(x['e']), x['n']) for x in segs]
    segs = obj.get('segments', []) if isinstance(obj, dict) else obj
    out = []
    for s in segs or []:
        a, b = s.get('s', s.get('start')), s.get('e', s.get('end'))
        if a is None or b is None or b <= a:
            continue
        words = len(s['words']) if isinstance(s.get('words'), list) else len(str(s.get('text', '')).split())
        out.append((float(a), float(b), words))
    return out


def words_from(obj):
    """word timings [(s, e)] when the transcript has them: a talking-head words.json ({words: [{w, s, e}]}) or a Whisper JSON run with
    word timestamps (segments[].words[{start, end}]); None for segment-only transcripts (a refstudy study.json, plain Whisper)"""
    if obj is None:
        return None
    if isinstance(obj, dict) and isinstance(obj.get('speech'), dict):
        obj = obj['speech']
    ws = []
    if isinstance(obj, dict) and isinstance(obj.get('words'), list) and 'segments' not in obj:
        ws = obj['words']
    else:
        for sg in (obj.get('segments', []) if isinstance(obj, dict) else obj) or []:
            if isinstance(sg, dict) and isinstance(sg.get('words'), list):
                ws += [w for w in sg['words'] if isinstance(w, dict)]
    out = []
    for w in ws:
        a, b = w.get('s', w.get('start')), w.get('e', w.get('end'))
        if a is not None and b is not None and b > a:
            out.append((float(a), float(b)))
    return sorted(out) or None


QUIET_KINDS = ('open', 'dip', 'gap', 'hold')


def plan_audio(plan):
    """the sound intent a plan.json may carry (all optional):
      plan.audio.mode   'music' | 'vo' | 'continuous': how ears/sync scores the edit (references/critic.md, cut-sync scope)
      plan.audio.quiet  [{t: [a, b], kind: open|dip|gap|hold, why}]: planned quiet regions, judged as intended shape, not as level faults
      plan.audio.events [seconds | {t} | {frame}]: the picture's motion events (a continuous film's accents) for mode continuous
      plan.audio.role   'proof' | 'explainer' | 'hype' | 'trailer' | 'vo_doc' | 'brand_launch': the bed's role, for the bass-share-by-role guidance
    Top-level plan.audioMode / plan.quiet / plan.motionEvents / plan.audioRole are read too. returns {mode, quiet, events, role}"""
    plan = plan or {}
    a = plan.get('audio') if isinstance(plan.get('audio'), dict) else {}
    fps = float(plan.get('fps') or 30)
    ev = a.get('events', plan.get('motionEvents'))
    word = lambda x: x.strip().lower() if isinstance(x, str) and x.strip() else x                  # 'VO' and ' Continuous ' mean what they say
    return {'mode': word(a.get('mode', plan.get('audioMode'))), 'quiet': quiet_from(a.get('quiet', plan.get('quiet'))),
            'events': events_from(ev, fps) if ev is not None else None, 'role': word(a.get('role', plan.get('audioRole')))}


def quiet_from(obj):
    """planned quiet regions from [{t: [a, b], kind, why}] or [[a, b], ...] -> [{t, kind, why}] (kind inferred later when missing)"""
    out = []
    for q in obj or []:
        if isinstance(q, dict):
            t = q.get('t') or [q.get('start'), q.get('end')]
            kind, why = q.get('kind'), q.get('why', '')
        else:
            t, kind, why = q, None, ''
        if t and len(t) == 2 and t[0] is not None and t[1] is not None and float(t[1]) > float(t[0]):
            out.append({'t': [float(t[0]), float(t[1])], 'kind': kind if kind in QUIET_KINDS else None, 'why': why})
    return out


def events_from(obj, fps=30.0):
    """motion-event times (s) from: a list of seconds or {t}|{time_s}|{frame}; a refstudy study.json (motion.events); {events: [...]}"""
    if obj is None:
        return None
    if isinstance(obj, dict):
        if isinstance(obj.get('motion'), dict):
            return [float(x) for x in obj['motion'].get('events', [])]
        return events_from(obj.get('events', []), float(obj.get('fps') or fps))
    out = []
    for c in obj:
        if isinstance(c, (int, float)):
            out.append(float(c))
        elif isinstance(c, dict):
            if 't' in c: out.append(float(c['t']))
            elif 'time_s' in c: out.append(float(c['time_s']))
            elif 'frame' in c: out.append(float(c['frame']) / fps)
    return sorted(out)


def quiet_shape(curve, step=0.25):
    """the quiet open / quiet tail / end shape of tools/refstudy.py (one definition for references and our mixes)"""
    sys.path.insert(0, os.path.join(PACK, 'tools'))
    import refstudy
    return refstudy.quiet_shape(curve, step)


_REG = None


def cue_take(cid, occurrence=0):
    """the exact take music/mixer.py places for the n-th use of a cue id: (mono float, anchor sample) or None.
    Occurrence 0 is the library take; later ones re-render the recipe with seed + n (the mixer's round robin)."""
    global _REG
    sid = 'snd.' + '.'.join(cid.split('/')[1:]) if cid.startswith('sfx/') else cid
    try:
        if _REG is None:
            import importlib
            from mpaudio import registry
            import recipes
            for m in recipes.MODULES:
                try:
                    importlib.import_module('recipes.' + m)
                except Exception:
                    pass
            _REG = registry
        s = _REG.SOUNDS.get(sid)
        if s is None:
            return None
        y, anchor, _ = _REG.render(sid, s.seed + occurrence if occurrence else None)
        y = np.asarray(y, float)
        return (y.mean(axis=1) if y.ndim == 2 else y), int(anchor or 0)
    except Exception:
        return None


def plan_cues(plan, fps):
    """plan.json cues -> [{id, t, frame, kind, offset}] with the sfx manifest's anchor kind and frame offset (risers end one frame early)"""
    if not plan or not plan.get('cues'):
        return []
    try:
        man = {s['id']: s for s in json.load(open(os.path.join(PACK, 'sfx', 'manifest.json')))['sounds']}
    except Exception:
        man = {}
    out, seen = [], {}
    for c in plan['cues']:
        if c.get('loopTo') or 't' not in c:
            continue
        cid = c['id']
        occ = seen.get(cid, 0)
        seen[cid] = occ + 1
        sid = 'snd.' + '.'.join(cid.split('/')[1:]) if cid.startswith('sfx/') else cid
        e = man.get(sid, {})
        kind = e.get('anchor_kind') or ('fixed' if 'riser' in cid else 'crest')
        off = e.get('anchor_frame_offset', -1 if '/riser/' in cid else 0)
        if e.get('loop'):
            continue
        f = int(np.floor(float(c['t']) * fps + 0.5))
        out.append({'id': cid, 't': float(c['t']), 'frame': f, 'kind': kind, 'offset': int(off), 'riser': '/riser/' in cid or sid.startswith('snd.riser'),
                    'why': c.get('why', ''), 'occurrence': occ})
    return out


# ------------------------------------------------------------------------------------------------ DSP
def mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


def stft_power(y, n_fft, hop):
    """power spectrogram (frames, bins) of a mono signal, Hann window; frame i is centred on i*hop + n_fft/2"""
    y = np.asarray(y, np.float32)
    if len(y) < n_fft:
        y = np.concatenate([y, np.zeros(n_fft - len(y), np.float32)])
    nfr = 1 + (len(y) - n_fft) // hop
    w = np.hanning(n_fft).astype(np.float32)
    S = np.empty((nfr, n_fft // 2 + 1), np.float32)
    step = 2048
    for a in range(0, nfr, step):
        idx = np.arange(n_fft)[None, :] + hop * np.arange(a, min(nfr, a + step))[:, None]
        S[a:a + len(idx)] = np.abs(np.fft.rfft(y[idx] * w, axis=1)) ** 2
    t = (np.arange(nfr) * hop + n_fft / 2) / SR
    f = np.fft.rfftfreq(n_fft, 1 / SR)
    return S, t, f


def band(S, f, lo, hi):
    return S[:, (f >= lo) & (f < hi)].sum(axis=1)


def db(p, floor=1e-12):
    return 10 * np.log10(np.maximum(p, floor))


def runs(mask, t, min_len=0.0, merge_gap=0.0):
    """contiguous True runs of a boolean series sampled at times t -> [[t0, t1]] (merged over gaps, at least min_len long)"""
    out, start = [], None
    dt = float(t[1] - t[0]) if len(t) > 1 else 0.0
    for i, m in enumerate(mask):
        if m and start is None:
            start = t[i]
        if (not m or i == len(mask) - 1) and start is not None:
            end = t[i] + (dt if m else 0)
            if out and start - out[-1][1] <= merge_gap:
                out[-1][1] = end
            else:
                out.append([start, end])
            start = None
    return [[round(float(a), 2), round(float(b), 2)] for a, b in out if b - a >= min_len]


def fmt_ranges(rs, n=4):
    s = ', '.join('%.1f-%.1f s' % (a, b) for a, b in rs[:n])
    return s + (' (+%d more)' % (len(rs) - n) if len(rs) > n else '')


# ------------------------------------------------------------------------------------------------ loudness
def short_term(x, win=3.0, hop=0.1):
    """BS.1770 loudness of sliding windows (3 s = short-term, 0.4 s = momentary): (times of window ends, LUFS)"""
    z = meter.kweight(x)
    p = (z ** 2).sum(axis=1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    n, w, h = len(p), int(win * SR), int(hop * SR)
    if n < w:
        return np.array([n / SR]), np.array([-0.691 + 10 * np.log10(c[-1] / max(w, 1) + 1e-20)])
    ends = np.arange(w, n + 1, h)
    ms = (c[ends] - c[ends - w]) / w
    return ends / SR, -0.691 + 10 * np.log10(ms + 1e-20)


def lra(x, skip=None):
    """loudness range, EBU Tech 3342: short-term (3 s, 10 Hz) values gated at -70 LUFS absolute and -20 LU relative; P95 - P10.
    skip: [[a, b], ...] seconds (planned quiet regions): short-term windows that overlap one are left out, so intended shape is not a range fault"""
    if len(x) < 3 * SR:
        return None
    t, st = short_term(x, 3.0, 0.1)
    if skip:
        keep = np.ones(len(t), bool)
        for a, b in skip:
            keep &= ~((t > a) & (t - 3.0 < b))                  # the window (t - 3, t] overlaps (a, b)
        t, st = t[keep], st[keep]
    st = st[st > -70]
    if len(st) < 2:
        return None
    rel = 10 * np.log10(np.mean(10 ** (st / 10))) - 20
    st = st[st > rel]
    return float(np.percentile(st, 95) - np.percentile(st, 10)) if len(st) > 1 else 0.0


def tp_envelope(x, os_=4):
    """per-sample true peak (max over the 4 oversampled points of each input sample, both channels)"""
    pad = 256
    y = np.concatenate([np.zeros((pad, x.shape[1])), x, np.zeros((pad, x.shape[1]))], 0)
    up = np.max(np.abs(resample_poly(y, os_, 1, axis=0)), axis=1)
    return up.reshape(-1, os_).max(axis=1)[pad:-pad]


# ------------------------------------------------------------------------------------------------ onsets, tempo
def onset_envelope(y, n_fft=1024, hop=240):
    """spectral flux on log magnitude: (env, times) at SR/hop frames per second"""
    S, t, _ = stft_power(y, n_fft, hop)
    L = np.log1p(100.0 * np.sqrt(S))
    flux = np.concatenate([[0.0], np.maximum(0.0, np.diff(L, axis=0)).sum(axis=1)])
    return flux, t


def refine(y, t, half=0.02):
    """move an onset to the steepest rise of the 2 ms envelope within +-half seconds (sub-frame accurate attack time)"""
    a, b = max(0, int((t - half) * SR)), min(len(y), int((t + half) * SR))
    if b - a < 64:
        return t
    e = np.convolve(np.abs(y[a:b]), np.ones(96) / 96, mode='same')
    d = np.diff(e)
    return (a + int(np.argmax(d))) / SR


def onsets(y, min_gap=0.05):
    """onset times (refined), strengths, plus the raw envelope; local maxima above a moving median + 0.6 std"""
    env, t = onset_envelope(y)
    k = 3
    env_s = np.convolve(env, np.ones(k) / k, mode='same')
    fps = SR / 240
    w = int(0.5 * fps)
    from scipy.ndimage import median_filter
    med = median_filter(env_s, size=2 * w + 1, mode='nearest')
    thr = med + 0.6 * np.std(env_s) + 1e-9
    idx = np.where((env_s[1:-1] > thr[1:-1]) & (env_s[1:-1] >= env_s[:-2]) & (env_s[1:-1] >= env_s[2:]))[0] + 1
    gap, keep = int(min_gap * fps), []
    for i in idx:
        if not keep or i - keep[-1] >= gap:
            keep.append(i)
        elif env_s[i] > env_s[keep[-1]]:
            keep[-1] = i
    times = np.array([refine(y, t[i]) for i in keep])
    return times, env_s[keep] if keep else np.array([]), env_s, t


def tempo(y):
    """tempo (BPM) by autocorrelation of a 100 Hz onset envelope with a log-normal prior around 120 BPM (1 octave), parabolic lag
    interpolation and a phase-fitted beat grid. returns dict(bpm, confidence, beats)"""
    env, t = onset_envelope(y, 2048, 480)
    fps = SR / 480
    e = env - env.mean()
    if len(e) < fps * 2 or not np.any(e):
        return {'bpm': None, 'confidence': 0.0, 'beats': []}
    n = 1 << int(np.ceil(np.log2(2 * len(e))))
    F = np.fft.rfft(e, n)
    ac = np.fft.irfft(F * np.conj(F), n)[:len(e)]
    lo, hi = SPEC['sync']['tempo_range_bpm']
    lags = np.arange(int(60 * fps / hi), min(len(ac) - 1, int(60 * fps / lo) + 1))
    if len(lags) < 3 or ac[0] <= 0:
        return {'bpm': None, 'confidence': 0.0, 'beats': []}
    bpm_l = 60 * fps / lags
    prior = np.exp(-0.5 * (np.log2(bpm_l / 120.0)) ** 2)
    score = np.maximum(ac[lags], 0) * prior
    i = int(np.argmax(score))
    L = float(lags[i])
    if 0 < i < len(lags) - 1:                                     # parabolic refinement on the raw autocorrelation
        y0, y1, y2 = ac[lags[i] - 1], ac[lags[i]], ac[lags[i] + 1]
        den = y0 - 2 * y1 + y2
        if den < 0:
            L += 0.5 * (y0 - y2) / den
    conf = float(max(0.0, ac[lags[i]] / ac[0]))
    # phase: the offset that collects the most envelope on a grid of period L
    best, ph = -1, 0.0
    for p in np.arange(0, L, 1.0):
        pos = np.arange(p, len(env) - 1, L)
        s = np.interp(pos, np.arange(len(env)), env).sum()
        if s > best:
            best, ph = s, p
    beats = [float(np.interp(p, np.arange(len(t)), t)) for p in np.arange(ph, len(env) - 1, L)]
    return {'bpm': float(60 * fps / L), 'confidence': conf, 'beats': beats}
