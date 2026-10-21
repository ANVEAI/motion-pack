"""motion-pack / ears / checks_shape.py: structure (sections, drop, the breath before the final sting, loop seam), repetition fatigue,
and the comparison with reference studies (tools/refstudy.py study.json). Same result shape as checks_level.py."""
import numpy as np
from scipy.ndimage import uniform_filter1d

from .core import SPEC, SR, db, runs, fmt_ranges, band, stft_power, lra, quiet_shape
from .checks_level import result, issue

BLOCK = 0.5


def _blocks(S, t, f, y):
    """0.5 s blocks: 7 band levels (dB, from the 10 ms spectrogram) for novelty, and the RMS level of each block in dBFS"""
    bands = SPEC['tone']['bands_hz']
    B = np.stack([band(S, f, a, b) for a, b in bands.values()], 1)
    per = max(1, int(round(BLOCK / float(t[1] - t[0]))))
    n = len(t) // per
    if n == 0:
        return np.zeros((0, len(bands))), np.zeros(0), np.zeros(0)
    Bb = B[:n * per].reshape(n, per, -1).mean(axis=1)
    k = int(BLOCK * SR)
    rms = np.array([np.mean(y[i * k:(i + 1) * k] ** 2) if i * k < len(y) else 0.0 for i in range(n)])
    return db(Bb), db(rms, 1e-12), np.arange(n) * BLOCK


def _novelty(F, k=4):
    """Foote checkerboard novelty on a cosine self-similarity matrix of standardised block features"""
    Z = (F - F.mean(0)) / (F.std(0) + 1e-6)
    Z = Z / (np.linalg.norm(Z, axis=1, keepdims=True) + 1e-9)
    M = Z @ Z.T
    n = len(Z)
    g = np.outer(np.r_[-np.ones(k), np.ones(k)], np.r_[-np.ones(k), np.ones(k)])     # +1 within a segment, -1 across the boundary
    nov = np.zeros(n)
    for i in range(k, n - k):
        nov[i] = (M[i - k:i + k, i - k:i + k] * g).sum()
    return np.maximum(nov, 0)


def structure(ctx):
    S, t, f = ctx['S']
    sp = SPEC['structure']
    y, dur = ctx['y'], len(ctx['y']) / SR
    F, lev, bt = _blocks(S, t, f, y)
    issues, notes = [], []
    m = {}
    if len(bt) >= 12:
        nov = _novelty(np.c_[F, lev[:, None]], 4)
        thr = nov.mean() + 0.5 * nov.std()
        peaks = [i for i in range(1, len(nov) - 1) if nov[i] > thr and nov[i] >= nov[i - 1] and nov[i] >= nov[i + 1]]
        keep = []
        for i in sorted(peaks, key=lambda i: -nov[i]):
            if all(abs(i - j) >= 4 for j in keep):
                keep.append(i)
        bounds = [0] + sorted(keep) + [len(bt)]
    else:
        bounds, nov = [0, len(bt)], np.zeros(len(bt))
    secs = []
    for a, b in zip(bounds[:-1], bounds[1:]):
        if b <= a:
            continue
        secs.append({'t': [round(a * BLOCK, 2), round(min(b * BLOCK, dur), 2)], 'level_dbfs': round(float(db(np.mean(10 ** (lev[a:b] / 10)))), 1), 'label': 'body'})
    drop = None
    best = sp['drop_step_db']
    for i in range(1, len(secs)):
        step = secs[i]['level_dbfs'] - secs[i - 1]['level_dbfs']
        if step >= best:
            best, drop = step, i
    if secs:
        secs[0]['label'] = 'intro' if len(secs) > 2 else secs[0]['label']
        if len(secs) > 2:
            secs[-1]['label'] = 'outro'
    if drop is not None:
        secs[drop]['label'] = 'drop'
        j = drop - 1
        while j > 0 and secs[j]['level_dbfs'] >= secs[j - 1]['level_dbfs'] - 0.5 and secs[j]['label'] == 'body':
            secs[j]['label'] = 'build'; j -= 1
        dt = secs[drop]['t'][0]
        m['drop_s'], m['drop_share'], m['drop_step_db'] = dt, round(dt / dur, 2), round(best, 1)
        louder_before = max((x['level_dbfs'] for x in secs[:drop]), default=-200) > secs[drop]['level_dbfs'] - 3
        if dt / dur > sp['late_drop_share'] and not louder_before:     # a finale after loud sections is not a late drop
            issues.append(issue('warn', [dt, dt], 'late drop: the biggest energy step arrives at %.1f s (%d%% of the runtime; house max %d%%)' % (
                dt, round(dt / dur * 100), round(sp['late_drop_share'] * 100)), 'shorten the build or move the reveal + drop earlier, and leave the last 20% for payoff + end card',
                'The music only takes off at the very end; on a short most viewers have scrolled away by then.'))
    else:
        notes.append('no drop: no section is %.0f dB louder than the one before' % sp['drop_step_db'])
    L = lra(ctx['x'])
    lv_ok = lev[lev > -70]
    spread = float(np.percentile(lv_ok, 90) - np.percentile(lv_ok, 10)) if len(lv_ok) > 4 else 0.0    # half-second levels, P90 - P10
    m['lra_lu'], m['section_spread_db'] = (None if L is None else round(L, 1)), round(spread, 1)
    if drop is None and L is not None and L < sp['flat_lra_lu'] and spread < sp['flat_spread_db'] and dur >= 6:
        issues.append(issue('warn', None, 'flat: one level from start to end (LRA %.1f LU, half-second levels within %.1f dB, no drop); critic.md asks the audio to have a shape on its own' % (L, spread),
                            'give the sound an arc: thin the bed under the setup (-4 to -6 dB or a sparser section), bring the full bed in on the turn or reveal, '
                            'and dip it right before the final sting', 'With eyes closed the sound sits at one level throughout: no build, no release, no payoff.'))
    m['sections'] = secs
    m['energy_curve_dbfs'] = [[round(float(a), 1), round(float(b), 1)] for a, b in zip(bt, lev)]
    m['novelty'] = [round(float(v), 2) for v in nov]
    # the breath before the final sting: a dip (>= breath_depth below the programme median) that ends right before the last big hit
    sting = None
    cues = ctx.get('cues') or []
    named = [c for c in cues if any(k in c['id'] for k in ('/logo/', 'sting', 'stinger'))]
    if named:
        sting = (named[-1]['frame'] + 1) / ctx['fps']
    else:
        on, st = ctx['onsets'], ctx['strengths']
        lv50 = db(uniform_filter1d(y ** 2, int(0.05 * SR)))
        def jump(o):                                       # a sting is an event: the next 100 ms peak 6 dB over the loud end (P90) of the second before it
            a, b = int(max(0, o - 1.0) * SR), int(max(0, o - 0.05) * SR)
            return b > a and float(lv50[int(o * SR):int((o + 0.1) * SR)].max()) - float(np.percentile(lv50[a:b], 90)) >= 6
        late = [o for o, s in zip(on, st) if o > 0.6 * dur and len(st) and s >= np.percentile(st, 90) and jump(o)]
        sting = late[-1] if late else None
    if sting is not None:
        lv = db(uniform_filter1d(y ** 2, int(0.05 * SR)))[::480]
        tt = np.arange(len(lv)) * 480 / SR
        med = float(np.median(lv[lv > lv.max() - 60])) if (lv > lv.max() - 60).any() else -60
        win = (tt >= sting - sp['breath_max_s'] - 0.5) & (tt < sting - 0.02)
        quiet = (lv < med - sp['breath_depth_db']) & win
        rs = [r for r in runs(quiet, tt, 0.05, 0.05) if sting - r[1] <= 0.3]
        m['final_sting_s'] = round(sting, 2)
        m['programme_median_db'] = round(med, 1)
        if rs:
            a, b = rs[-1]
            m['breath'] = {'t': [a, b], 'length_s': round(b - a, 2), 'depth_db': round(med - float(lv[(tt >= a) & (tt < b)].mean()), 1)}
            if b - a < sp['breath_min_s']:
                notes.append('suggestion: the breath before the final sting at %.2f s is only %.2f s; 0.2-0.4 s lets the payoff land '
                             '(music/mixer.py pre-hit vacuum, or a cut)' % (sting, b - a))
        else:
            m['breath'] = None
            notes.append('suggestion: no breath before the final sting at %.2f s; a 200-400 ms dip (10 dB) right before it makes the payoff land '
                         '(references/launch-playbook.md, silence before the payoff)' % sting)
    _quiet(ctx, lev, bt, dur, m, issues, notes)
    # loop seam: end vs start (only judged with --loop)
    n = int(BLOCK * SR)
    if len(y) > 4 * n:
        e_tail = y[-n - int(0.15 * SR):-int(0.15 * SR)] if len(y) > n + int(0.15 * SR) else y[-n:]
        Sa, _, fa = stft_power(y[:n], 2048, 512)
        Sb, _, _ = stft_power(e_tail, 2048, 512)
        ba = np.array([band(Sa, fa, a, b).mean() for a, b in SPEC['tone']['bands_hz'].values()])
        bb = np.array([band(Sb, fa, a, b).mean() for a, b in SPEC['tone']['bands_hz'].values()])
        lvl = float(db(ba.sum()) - db(bb.sum()))
        shape = float(np.sqrt(np.mean(((db(ba) - db(ba.sum())) - (db(bb) - db(bb.sum()))) ** 2)))
        m['loop_seam'] = {'level_step_db': round(lvl, 1), 'spectral_distance_db': round(shape, 1)}
        if ctx.get('loop') and max(abs(lvl), shape) > sp['loop_seam_warn_db']:
            issues.append(issue('warn', [round(dur - 0.5, 2), 0.5], 'loop seam: start vs end differ by %.1f dB level and %.1f dB in spectral shape' % (lvl, shape),
                                'make the last state equal the first: end on the bed loop point, or crossfade the tail into the opening sound',
                                'When it loops you hear a jump in the sound.'))
    return result('ears/structure', 'structure', m, 'drop <= %d%% of runtime, a %.1f-%.0f s breath before the final sting, no unplanned dead air >= %.0f s%s' % (
        round(sp['late_drop_share'] * 100), sp['breath_min_s'], sp['breath_max_s'], SPEC['quiet']['unplanned_warn_s'], ', a seamless loop' if ctx.get('loop') else ''), issues, notes)


def _sustained_sub(y, below_hz=150, share_min=0.85, level_min_dbfs=-60.0):
    """the ending that sits on one held low note: the last 2 s (before the digital-zero 0.15 s) have at least share_min of their energy under below_hz
    and are audible (above level_min_dbfs). Round 3's 'sustained sub' end next to the quiet hold and the pre-sting silence; None when it is not."""
    seg = y[-int(2.15 * SR):-int(0.15 * SR)]
    if len(seg) < int(1.5 * SR):
        return None
    S, _, f = stft_power(seg, 2048, 512)
    low = float((band(S, f, 0, below_hz) / (S.sum(1) + 1e-12)).mean())
    lvl = float(10 * np.log10(np.mean(np.asarray(seg, float) ** 2) + 1e-12))
    if low >= share_min and lvl > level_min_dbfs:
        return {'low_share': round(low, 3), 'below_hz': below_hz, 'level_dbfs': round(lvl, 1)}
    return None


def _kind(a, b, dur):
    return 'open' if a <= BLOCK else ('hold' if b >= dur - BLOCK else 'dip')


def _quiet(ctx, lev, bt, dur, m, issues, notes):
    """near-silent stretches (0.5 s blocks >= depth_db under the programme median). Planned ones (plan.audio.quiet) are intended shape:
    a quiet open, a mid-film reset dip or trailer gap, an end-card quiet hold; unplanned ones of unplanned_warn_s or more are dead air.
    The breath before the final sting stays with the breath check. Also the ending shape on the refstudy definition."""
    q = SPEC['quiet']
    planned = ctx.get('quiet') or []
    live = lev[lev > lev.max() - 30] if len(lev) else lev               # the programme: blocks within 30 dB of the loudest (a long hold cannot drag it down)
    if len(live) < 4:
        return
    med = float(np.median(live))
    mask = lev < med - q['depth_db']
    rs = runs(mask, bt, q['min_s'], 0.0) if len(bt) > 1 else []
    sting = m.get('final_sting_s')
    rows = []
    for a, b in rs:
        b = min(b, round(dur, 2))
        hit = None
        for p in planned:
            ov = min(b, p['t'][1]) - max(a, p['t'][0])
            if ov >= q['plan_overlap'] * (b - a) - 1e-6:
                hit = p; break
        if hit is None and sting is not None and abs(sting - b) <= 0.3 + BLOCK and b - a <= SPEC['structure']['breath_max_s'] and b < dur - BLOCK:
            continue                                                       # the breath before the final sting: judged above (a PLANNED region, e.g. the silence under the name before the sonic logo, stays a row)
        depth = round(med - float(np.mean(lev[(bt >= a) & (bt < b)])), 1)
        kind = (hit or {}).get('kind') or _kind(a, b, dur)
        row = {'t': [a, b], 'length_s': round(b - a, 2), 'under_programme_db': depth, 'kind': kind, 'planned': hit is not None}
        if hit is not None and hit.get('why'):
            row['why'] = hit['why']
        rows.append(row)
        if hit is None and b - a >= q['unplanned_warn_s']:
            issues.append(issue('warn', [a, b], 'dead air: %.1f s of near-silence (%.0f dB under the programme) at %.1f-%.1f s, not marked as planned' % (b - a, depth, a, b),
                                'if it is intended (a quiet open, a reset dip, a trailer gap or an end-card quiet hold), mark it in plan.audio.quiet '
                                '[{"t": [%.1f, %.1f], "kind": "%s", "why": "..."}]; otherwise carry the bed or room tone through it' % (a, b, kind),
                                'The sound drops out at %.1f-%.1f s; unless the picture is holding too, it reads as a mistake.' % (a, b), kind='dead_air'))
        elif hit is not None:
            mx = q['max_s'].get(kind, q['max_s']['dip'])
            if b - a > mx + q['max_margin_s']:
                issues.append(issue('warn', [a, b], 'planned quiet %s of %.1f s at %.1f-%.1f s is longer than the house max %.0f s' % (kind, b - a, a, b, mx),
                                    'shorten it to %.0f s or less (round 4/5 references: open <= 2 s, dip / gap 1-4 s, end-card hold 4-9 s)' % mx,
                                    'The quiet runs long enough to feel like the sound has stopped.'))
    for p in planned:
        a, b = p['t']
        if not any(min(b, r['t'][1]) - max(a, r['t'][0]) > 0 for r in rows) and b - a >= q['min_s']:
            k = (bt >= a) & (bt < b)
            under = round(med - float(np.mean(lev[k])), 1) if k.any() else None
            notes.append('planned quiet %s %.1f-%.1f s measures only %s dB under the programme (near-silence is >= %.0f dB): fine if a thinned bed was meant' % (
                p.get('kind') or _kind(a, b, dur), a, b, under, q['depth_db']))
    m['quiet'] = rows
    m['programme_block_median_dbfs'] = round(med, 1)
    sh = quiet_shape(_refstudy_like(ctx['y'])['curve'])
    if sh:
        m['quiet_shape'] = sh
        m['end_shape'] = sh['end_shape']
        sub = _sustained_sub(ctx['y'])
        if sub:
            m['end_shape'] = 'sustained sub'                                # the refstudy loudness curve cannot tell a held low note from a decay or a hold
            m['sustained_sub'] = sub
            notes.append('ending: sustained sub (the last 2 s hold one low note: %.0f%% of the energy under %d Hz at %.0f dBFS), round 3\'s end shape for music-led, moody films' % (
                sub['low_share'] * 100, sub['below_hz'], sub['level_dbfs']))
        elif sh['end_shape'] == 'quiet hold':
            notes.append('ending: quiet hold (the last 2 s %.0f dB under the body), a first-class end for explainers and partnership posts%s' % (
                -sh['tail_2s_vs_body_db'], '' if any(r['planned'] and r['kind'] == 'hold' for r in rows) else '; mark it in plan.audio.quiet (kind hold) so it reads as intended'))
        else:
            notes.append('ending: %s (the last 2 s %+.0f dB against the body)' % (sh['end_shape'], sh['tail_2s_vs_body_db']))


# ------------------------------------------------------------------------------------------------ repetition fatigue
def _onset_vec(y, t0):
    a = int(t0 * SR)
    seg = y[a:a + int(0.08 * SR)]
    if len(seg) < 256:
        return None, None
    X = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    fr = np.fft.rfftfreq(len(seg), 1 / SR)
    edges = np.geomspace(100, 16000, 25)
    v = np.array([X[(fr >= a) & (fr < b)].sum() for a, b in zip(edges[:-1], edges[1:])])
    return db(v), float(db(X.sum()))


def repetition(ctx):
    y, sp = ctx['y'], SPEC['repetition']
    on, st = ctx['onsets'], ctx['strengths']
    tm = ctx['tempo']
    issues, notes = [], []
    if len(on) == 0:
        return result('ears/repetition', 'variety', {'clusters': 0}, 'n/a', [], ['no onsets'], status='n/a')
    keep = [i for i in range(len(on)) if st[i] >= np.percentile(st, 50)]
    clusters = []
    for i in keep:
        v, lev = _onset_vec(y, on[i])
        if v is None:
            continue
        z = v - v.mean()
        z /= np.linalg.norm(z) + 1e-9
        for c in clusters:
            if float(z @ c['z']) >= sp['similarity'] and abs(lev - c['lev']) <= sp['level_match_db']:
                c['t'].append(float(on[i])); break
        else:
            clusters.append({'z': z, 'lev': lev, 't': [float(on[i])]})
    beats = np.asarray(tm['beats'])
    period = 60.0 / tm['bpm'] if tm['bpm'] else None
    rows = []
    for c in clusters:
        ts = np.array(c['t'])
        if len(ts) < 2:
            continue
        grid = np.concatenate([beats + k * period / 4 for k in range(4)]) if beats.size and period else np.zeros(0)
        on_grid = grid.size and np.mean([np.min(np.abs(grid - x)) < 0.03 for x in ts]) >= 0.7
        rhythmic = bool(on_grid and tm['confidence'] >= 0.4)          # on the music's 16th-note grid: part of the music, not an SFX
        best, at = 0, 0.0
        for x in ts:
            k = int(((ts >= x) & (ts < x + sp['window_s'])).sum())
            if k > best:
                best, at = k, float(x)
        rows.append({'times': [round(x, 2) for x in ts], 'max_in_window': best, 'window_start': round(at, 2), 'rhythm_element': rhythmic})
    for r in sorted(rows, key=lambda r: -r['max_in_window']):
        if r['rhythm_element'] or r['max_in_window'] <= sp['max_repeats']:
            continue
        a = r['window_start']
        issues.append(issue('warn', [a, round(a + sp['window_s'], 2)], 'the same sound repeats %d times within %.0f s (%s)' % (
            r['max_in_window'], sp['window_s'], ', '.join('%.2f' % x for x in r['times'][:6])),
            'vary it: a round-robin seed (rr:4 sounds), a sibling id from the same family, or drop every other one',
            'One sound effect keeps repeating identically around %.0f-%.0f s and starts to grate.' % (a, a + sp['window_s'])))
    plan_rep = []
    cues = ctx.get('cues') or []
    ids = sorted({c['id'] for c in cues})
    for cid in ids:
        ts = sorted(c['t'] for c in cues if c['id'] == cid)
        best = max(sum(1 for u in ts if x <= u < x + sp['window_s']) for x in ts)
        if best >= 3:
            plan_rep.append({'id': cid, 'count': len(ts), 'max_in_window': best})
            if best > 2 * sp['max_repeats']:
                issues.append(issue('warn', [ts[0], ts[-1]], 'plan: %s is cued %d times within %.0f s' % (cid, best, sp['window_s']),
                                    'swap some for a sibling id in the same family (the mixer already round-robins seeds; the id itself still repeats)',
                                    'The same kind of effect keeps coming back.'))
    notes += ['plan repeats id %s %dx in %.0f s (the mixer varies the take, so this is a note up to %d)' % (r['id'], r['max_in_window'], sp['window_s'], 2 * sp['max_repeats'])
              for r in plan_rep if r['max_in_window'] <= 2 * sp['max_repeats']]
    m = {'onset_clusters': len(rows), 'rhythm_elements': sum(r['rhythm_element'] for r in rows), 'repeats': [r for r in rows if not r['rhythm_element']][:12],
         'plan_repeats': plan_rep}
    return result('ears/repetition', 'variety', m, 'the same non-rhythmic sound <= %d times per %.0f s' % (sp['max_repeats'], sp['window_s']), issues, notes)


# ------------------------------------------------------------------------------------------------ comparison with reference studies
def _refstudy_like(y):
    """the same numbers tools/refstudy.py writes, measured on our mix: 0.25 s RMS curve, low (<150) / mid / high (>4 k) shares, brightness"""
    S, t, f = stft_power(y, 2048, 512)
    tot = S.sum(1) + 1e-12
    low, high = band(S, f, 0, 150) / tot, band(S, f, 4000, 24000) / tot
    m = f < 11025
    cen = (S[:, m] * f[None, m]).sum(1) / (S[:, m].sum(1) + 1e-12)
    step = int(0.25 * SR)
    curve = [float(10 * np.log10(np.mean(y[a:a + step] ** 2) + 1e-12) + 3.0) for a in range(0, len(y) - step + 1, step)]
    return {'low': float(low.mean()), 'high': float(high.mean()), 'mid': float(1 - low.mean() - high.mean()), 'brightness': float(cen.mean()), 'curve': curve}


def _shape(c, n=40):
    c = np.asarray([v if v is not None else -60 for v in c], float)
    c = np.maximum(c, -60)
    return np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(c)), c) if len(c) > 1 else np.zeros(n)


def _role_line(role, low):
    rng = SPEC['bass_share_by_role'].get(role)
    if not isinstance(rng, list):
        return None
    src = (SPEC['bass_share_by_role'].get('sources') or {}).get(role, 'round 4/5 references')
    pos = 'below' if low < rng[0] else ('above' if low > rng[1] else 'inside')
    return 'bass share (<150 Hz) %.0f%% vs %.0f-%.0f%% for a %s bed (%s): %s the range' % (low * 100, rng[0] * 100, rng[1] * 100, role, src, pos)


def compare(ctx):
    refs = ctx.get('refs') or []
    role = ctx.get('role')
    if not refs and not role:
        return result('ears/compare', 'compare', {}, 'n/a', [], ['no --ref study.json given'], status='n/a')
    me = _refstudy_like(ctx['y'])
    if not refs:
        line = _role_line(role, me['low'])
        return result('ears/compare', 'compare', {'role': role, 'mine': {'low': round(me['low'], 3)}, 'differences': [line] if line else []},
                      'bass share inside the role range', [], [line or 'unknown role %r' % role], status='info')
    I = ctx['lufs']
    rows, lines = [], []
    for name, st in refs:
        a = st.get('audio') or {}
        bs = a.get('band_share_mean') or {}
        r = {'ref': name, 'lufs': (st.get('loudness') or {}).get('integrated_lufs'), 'tempo': a.get('tempo_bpm_estimate'), 'tempo_conf': a.get('tempo_confidence'),
             'low': bs.get('low_<150Hz'), 'high': bs.get('high_>4kHz'), 'brightness': a.get('brightness_hz_mean'),
             'cuts_on_onset': (a.get('sync') or {}).get('share_on_onset')}
        qs = st.get('quiet') or quiet_shape(a.get('loudness_curve_4hz_dbfs'))
        if qs:
            r['open_db'], r['tail_db'], r['end_shape'] = qs.get('open_vs_body_db'), qs.get('tail_2s_vs_body_db'), qs.get('end_shape')
        if a.get('loudness_curve_4hz_dbfs'):
            sa, sb = _shape(me['curve']), _shape(a['loudness_curve_4hz_dbfs'])
            r['curve_corr'] = round(float(np.corrcoef(sa, sb)[0, 1]), 2) if sa.std() > 0 and sb.std() > 0 else None
            r['spread_db'] = round(float(np.percentile(sb, 90) - np.percentile(sb, 10)), 1)
        rows.append(r)
    def rng(k):
        v = [r[k] for r in rows if r.get(k) is not None]
        return (min(v), float(np.median(v)), max(v)) if v else None
    mine = {'lufs': I, 'tempo': ctx['tempo']['bpm'], 'low': me['low'], 'high': me['high'], 'brightness': me['brightness'],
            'cuts_on_onset': ctx.get('cuts_on_onset'), 'spread_db': float(np.percentile(_shape(me['curve']), 90) - np.percentile(_shape(me['curve']), 10))}
    qm = quiet_shape(me['curve'])
    if qm:
        mine['open_db'], mine['tail_db'] = qm['open_vs_body_db'], qm['tail_2s_vs_body_db']
    label = {'lufs': ('loudness', '%.1f LUFS', 1), 'tempo': ('tempo', '%.0f BPM', 1), 'low': ('bass share (<150 Hz)', '%.0f%%', 100), 'high': ('high share (>4 kHz)', '%.1f%%', 100),
             'brightness': ('brightness', '%.0f Hz', 1), 'cuts_on_onset': ('cuts on an onset', '%.0f%%', 100), 'spread_db': ('loudness-curve spread P90-P10', '%.1f dB', 1),
             'open_db': ('quiet open (first 2 s vs body)', '%+.1f dB', 1), 'tail_db': ('quiet tail (last 2 s vs body)', '%+.1f dB', 1)}
    for k, (nm, fm, sc) in label.items():
        g = rng(k)
        if g is None or mine.get(k) is None:
            continue
        v = mine[k]
        pos = 'below' if v < g[0] else ('above' if v > g[2] else 'inside')
        lines.append('%s: %s vs refs %s to %s (median %s): %s the reference range' % (nm, fm % (v * sc), fm % (g[0] * sc), fm % (g[2] * sc), fm % (g[1] * sc), pos))
    cc = [r['curve_corr'] for r in rows if r.get('curve_corr') is not None]
    if cc:
        lines.append('loudness-curve shape: correlation %.2f with the closest reference (median %.2f); %s' % (
            max(cc), float(np.median(cc)), 'a similar arc' if max(cc) > 0.5 else 'a different arc (where it builds and drops)'))
    ends = [r['end_shape'] for r in rows if r.get('end_shape')]
    if ends and qm:
        lines.append('ending: %s; references end %s' % (qm['end_shape'], ', '.join('%s %d' % (k, ends.count(k)) for k in sorted(set(ends)))))
    if role:
        line = _role_line(role, me['low'])
        if line:
            lines.append(line)
    m = {'refs': rows, 'mine': {k: (round(v, 3) if isinstance(v, float) else v) for k, v in mine.items()}, 'differences': lines, 'role': role}
    return result('ears/compare', 'compare', m, 'inside the references\' ranges', [], lines, status='info')
