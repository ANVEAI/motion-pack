"""motion-pack / ears / checks_ab.py: the before / after audio swap (cuts/story78.py abReplay), judged on the delivered file.
One clip is heard twice (stem A, then stem B), or one shot flips from A to B part-way, and the swap is meant to land on the SAME frame as the picture flip. The plan says where
(plan.audio.abReplay = {fps, mode, flip_frame, a: [start_frame, end_frame], b: [...], tol_db, gain_b_db}); this check measures the file:
  level      the two halves are level-matched: integrated LUFS (BS.1770, gated) of window A and of window B differ by no more than tol_db (1 dB: pass; up to 2 dB: warn; more: fail).
             The point of the piece is that the difference reads as content, not loudness. In flip mode the windows are the `flip_window_s` seconds either side of the flip.
  flip       the sound changes ON the flip frame: the largest step in the log spectrum (150 Hz-8 kHz: the mean level of 12 log-spaced bands over the 100 ms before a boundary against the 100 ms after it) within +-0.5 s of the flip sits within 1 frame of it
             (warn at 2 frames, fail beyond), stands out from the local median by `novelty_prominence`, and no other step of nearly the same size sits within half a second of it.
Every issue carries the fix with the numbers. Returns the same {id, category, status, measured, target, issues, notes} as every ears check; category 'sync'. n/a when the plan has no abReplay."""
import numpy as np

from .core import SPEC, SR, meter, stft_power
from .checks_level import result, issue


def _win(a, b, fps, n):
    s, e = int(round(a / fps * SR)), int(round(b / fps * SR))
    return max(0, min(n, s)), max(0, min(n, e))


def plan_block(plan):
    """plan.audio.abReplay (or plan.abReplay) as a validated dict, or None"""
    a = (plan or {}).get('audio') if isinstance((plan or {}).get('audio'), dict) else {}
    ab = a.get('abReplay', (plan or {}).get('abReplay'))
    if not isinstance(ab, dict):
        return None
    try:
        out = {'fps': float(ab.get('fps') or (plan or {}).get('fps') or 30), 'mode': ab.get('mode', 'replay'), 'flip_frame': int(ab['flip_frame']),
               'a': [int(v) for v in ab['a']], 'b': [int(v) for v in ab['b']], 'tol_db': float(ab.get('tol_db', SPEC['ab_replay']['tol_db'])), 'gain_b_db': float(ab.get('gain_b_db', 0.0))}
    except (KeyError, TypeError, ValueError):
        return None
    if len(out['a']) != 2 or len(out['b']) != 2 or out['fps'] <= 0 or out['mode'] not in ('replay', 'flip'):
        return None
    return out


def ab_replay(ctx):
    ab, sp = ctx.get('ab'), SPEC['ab_replay']
    if not ab:
        return result('ears/ab_replay', 'sync', {'planned': False}, 'plan.audio.abReplay', [], ['no before / after swap planned'], status='n/a')
    x, y, fps, n = ctx['x'], ctx['y'], float(ab['fps']), len(ctx['x'])
    issues, notes, m = [], [], {'planned': True, 'mode': ab['mode'], 'flip_frame': ab['flip_frame']}
    flip_t = ab['flip_frame'] / fps
    # ---- level: integrated loudness of each half
    if ab['mode'] == 'flip':
        w = sp['flip_window_s']
        ra = (int(max(ab['a'][0] / fps, flip_t - w) * SR), int(flip_t * SR))
        rb = (int(flip_t * SR), int(min(ab['b'][1] / fps, flip_t + w) * SR))
    else:
        ra, rb = _win(ab['a'][0], ab['a'][1], fps, n), _win(ab['b'][0], ab['b'][1], fps, n)
    ra, rb = (max(0, ra[0]), min(n, ra[1])), (max(0, rb[0]), min(n, rb[1]))
    la, lb = (ra[1] - ra[0]) / SR, (rb[1] - rb[0]) / SR
    if min(la, lb) < sp['min_window_s']:
        notes.append('a half is under %.1f s long (%.2f s and %.2f s): the loudness match is not measurable' % (sp['min_window_s'], la, lb))
        m.update({'lufs_a': None, 'lufs_b': None, 'diff_db': None})
    else:
        LA, LB = float(meter.lufs_integrated(x[ra[0]:ra[1]])), float(meter.lufs_integrated(x[rb[0]:rb[1]]))
        d = LA - LB
        m.update({'lufs_a': round(LA, 2), 'lufs_b': round(LB, 2), 'diff_db': round(d, 2), 'tol_db': ab['tol_db']})
        if LA <= -69.9 or LB <= -69.9:
            issues.append(issue('fail', [ra[0] / SR, rb[1] / SR], 'a half has no audible audio (integrated loudness below -70 LUFS)', 'mux both stems into the render (cuts/story78.py audio.tracks)', 'One half of the comparison is silent.', kind='level'))
        elif abs(d) > sp['tol_db_max']:
            issues.append(issue('fail', [rb[0] / SR, rb[1] / SR], 'the halves differ by %.1f dB (A %.1f, B %.1f LUFS), over %.1f dB' % (abs(d), LA, LB, sp['tol_db_max']),
                                'set the gain on stem B to %+.1f dB more than now (plan.audio.abReplay.gain_b_db was %+.1f): `cutgen.py ab-replay --lufs-a %.1f --lufs-b %.1f`' % (d, ab['gain_b_db'], LA, LB - ab['gain_b_db']),
                                'The second half is clearly %s than the first, so the difference sounds like volume, not like the fix.' % ('quieter' if d > 0 else 'louder'), kind='level'))
        elif abs(d) > ab['tol_db']:
            issues.append(issue('warn', [rb[0] / SR, rb[1] / SR], 'the halves differ by %.1f dB, over the %.1f dB match' % (abs(d), ab['tol_db']),
                                'raise stem B by %+.1f dB (plan.audio.abReplay.gain_b_db %+.1f)' % (d, ab['gain_b_db']), 'The second half is slightly %s than the first.' % ('quieter' if d > 0 else 'louder'), kind='level'))
    # ---- flip: the sound changes on the flip frame. A change-point detector on the log spectrum (12 bands from 150 Hz to 8 kHz, 5 ms frames): for every candidate boundary the mean spectrum of the
    # 100 ms before it against the 100 ms after it; a step in the sound (the swap) is the largest value within +-0.5 s of the flip. It localises a hard switch to about 5 ms.
    hop, n_fft, W = 240, 1024, 20
    S, t, f = stft_power(y, n_fft, hop)
    if len(t) < 2 * W + 8 or flip_t * SR > len(y):
        notes.append('the file is too short to hold the flip frame (%.2f s)' % flip_t)
        m.update({'novelty_peak_s': None})
    else:
        lo, hi = sp['band_hz']
        edges = np.geomspace(lo, hi, sp['bands'] + 1)                       # log-spaced bands: many bins per band, so the noise of a band's level is small and a real step in the spectrum stands out
        cols = [(f >= a) & (f < b) for a, b in zip(edges[:-1], edges[1:])]
        L = np.stack([10 * np.log10(S[:, c].sum(axis=1) + 1e-12) for c in cols if c.sum() >= 2], axis=1)
        cs = np.concatenate([np.zeros((1, L.shape[1])), np.cumsum(L, axis=0)])
        ks = np.arange(W, len(L) - W + 1)
        D = np.abs((cs[ks + W] - cs[ks]) - (cs[ks] - cs[ks - W])).mean(axis=1) / W
        td = ((ks - 0.5) * hop + n_fft / 2) / SR
        near = (td > flip_t - 0.5) & (td < flip_t + 0.5)
        far = (td > flip_t - 2.5) & (td < flip_t + 2.5) & ~((td > flip_t - 0.5 - W * hop / SR) & (td < flip_t + 0.5 + W * hop / SR))
        if not near.any():
            notes.append('the flip frame is outside the analysable part of the file')
            m.update({'novelty_peak_s': None})
        else:
            k = int(np.argmax(np.where(near, D, -1)))
            pk, tp = float(D[k]), float(td[k])
            med = float(np.median(D[far])) if far.any() else float(np.median(D))
            prom = pk / (med + 1e-9)
            off = (tp - flip_t) * fps
            rest = near & ~((td > tp - 0.15) & (td < tp + 0.15))
            second = float(D[rest].max() / (pk + 1e-12)) if rest.any() else 0.0
            m.update({'flip_s': round(flip_t, 4), 'novelty_peak_s': round(tp, 4), 'offset_frames': round(off, 2), 'prominence': round(prom, 1), 'second_peak_ratio': round(second, 2)})
            if prom < sp['novelty_prominence']:
                issues.append(issue('warn', [flip_t - 0.1, flip_t + 0.1], 'no clear change of sound on the flip frame (the largest step is only %.1f x the local median, under %.1f x), so the swap cannot be placed' % (prom, sp['novelty_prominence']),
                                    'make the two stems differ where the claim is (the demo has to show a difference), or move plan.audio.abReplay.flip_frame to where the sound does change; then listen once', 'You cannot hear anything change when the picture flips.', kind='flip'))
            elif abs(off) > sp['flip_warn_frames']:
                issues.append(issue('fail', [min(tp, flip_t), max(tp, flip_t)], 'the sound changes %.1f frames %s the picture flip (frame %d)' % (abs(off), 'after' if off > 0 else 'before', ab['flip_frame']),
                                    'start stem B on frame %d: audio.switch_sample = round(%d * 48000 / %g) (cuts/story78.py), and check the mux offset' % (ab['flip_frame'], ab['flip_frame'], fps),
                                    'The sound changes %s the picture does.' % ('after' if off > 0 else 'before'), kind='flip'))
            elif abs(off) > sp['flip_tol_frames']:
                issues.append(issue('warn', [min(tp, flip_t), max(tp, flip_t)], 'the sound changes %.1f frames %s the picture flip' % (abs(off), 'after' if off > 0 else 'before'),
                                    'put the stem switch on frame %d exactly (a hard switch, or a crossfade centred on it)' % ab['flip_frame'], 'The sound changes just %s the picture.' % ('after' if off > 0 else 'before'), kind='flip'))
            if second > 0.8 and prom >= sp['novelty_prominence']:
                issues.append(issue('warn', [flip_t - 0.5, flip_t + 0.5], 'another change nearly as big (%.0f %% of the swap) sits within half a second of the flip' % (100 * second),
                                    'keep other events (hits, cuts, risers) half a second away from the swap so it reads as the one change', 'Something else happens at the same moment, so the swap is hard to hear.', kind='flip2'))
    tgt = 'halves within %.1f dB, the sound changes within %g frame of the flip' % (ab['tol_db'], sp['flip_tol_frames'])
    return result('ears/ab_replay', 'sync', m, tgt, issues, notes)
