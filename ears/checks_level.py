"""motion-pack / ears / checks_level.py: loudness, clipping / distortion, tonal balance, stereo.
Every check returns {id, category, status, measured, target, issues[], notes[]}; an issue is {severity, t, what, fix, listener}."""
import numpy as np

from .core import SPEC, SR, meter, db, runs, fmt_ranges, short_term, lra, tp_envelope, stft_power, band

ORDER = {'n/a': -1, 'info': 0, 'pass': 0, 'warn': 1, 'fail': 2}


def result(cid, category, measured, target, issues, notes=None, status=None):
    st = status or (max((i['severity'] for i in issues), key=ORDER.get) if issues else 'pass')
    return {'id': cid, 'category': category, 'status': st, 'measured': measured, 'target': target, 'issues': issues, 'notes': notes or []}


def issue(sev, t, what, fix, listener, kind=None):
    """kind groups repeats of one problem (e.g. ducking on several lines) so a score counts it once"""
    return {'severity': sev, 't': t, 'what': what, 'fix': fix, 'listener': listener, 'kind': kind}


# ------------------------------------------------------------------------------------------------ loudness
def loudness(ctx):
    x, sp = ctx['x'], SPEC['loudness']
    dur = len(x) / SR
    I = meter.lufs_integrated(x)
    if I <= -69.9:
        return result('ears/loudness', 'loudness', {'integrated_lufs': None}, 'audio present', [
            issue('fail', None, 'no audible audio track (integrated loudness below -70 LUFS)', 'mux the mixed master (templates/_shared/audio.py) into the render',
                  'There is no sound at all.')])
    st_t, st = short_term(x, 3.0, 0.5)
    _, mom = short_term(x, 0.4, 0.1)
    L = lra(x)
    spk = meter.sample_peak_db(x)
    env = tp_envelope(x)
    tp = float(20 * np.log10(env.max() + 1e-20))
    master = ctx['is_master']
    tp_lim = sp['tp_master_dbtp'] if master else sp['tp_delivered_dbtp']
    tgt = ctx.get('target_lufs', sp['target_lufs'])
    issues, notes = [], []
    d = I - tgt
    if abs(d) > sp['pass_lu']:
        sev = 'warn' if abs(d) <= sp['warn_lu'] else 'fail'
        issues.append(issue(sev, None, 'integrated %.1f LUFS is %+.1f LU off the %.0f LUFS target' % (I, d, tgt),
                            'remaster through music/mixer.py (master.lufs %.0f); never gain stems by hand' % tgt,
                            ('It plays %.1f dB louder than other videos until the platform turns it down.' % d) if d > 0 else
                            ('It sounds %.1f dB quieter than other videos; YouTube and most apps will not turn it up.' % -d)))
    if tp > tp_lim:
        over = tp - tp_lim
        rs = runs(env > 10 ** (tp_lim / 20), np.arange(len(env)) / SR, 0.0, 0.25)
        issues.append(issue('warn' if over <= sp['tp_warn_margin_db'] else 'fail', rs[0] if rs else None,
                            'true peak %.2f dBTP is over the %.1f dBTP %s ceiling at %s' % (tp, tp_lim, 'master' if master else 'delivered', fmt_ranges(rs)),
                            'keep the WAV master at -1.5 dBTP (-2.0 to -2.5 for click-dense UI mixes: plan.ceilingDb) and check the AAC probe',
                            'Peaks may crunch on phone speakers, and HyperFrames may lower the whole track.'))
    if L is not None and L > sp['lra_max_lu']:
        issues.append(issue('warn', None, 'loudness range %.1f LU is wide for short-form (house max %.0f LU)' % (L, sp['lra_max_lu']),
                            'even out the quiet and loud sections: raise the quiet bed or shorten the silent stretch; check the short-term curve',
                            'Some parts are much quieter than others; on a phone the quiet parts get lost.'))
    # the last 0.15 s must be digital zero (AAC smears about one frame of 1024 samples into it, so a coded file skips the first 25 ms)
    skip = 0 if master else sp['tail_codec_skip_s']
    tail = x[max(0, len(x) - int(sp['tail_s'] * SR) + int(skip * SR)):]
    tail_db = max(-150.0, float(20 * np.log10(np.max(np.abs(tail)) + 1e-20))) if len(tail) else -150.0
    lim = sp['tail_digital_zero_dbfs'] if master else sp['tail_near_zero_dbfs']
    if tail_db > lim:
        issues.append(issue('fail', [round(dur - sp['tail_s'], 2), round(dur, 2)],
                            'the last %.2f s peaks at %.1f dBFS, not digital silence' % (sp['tail_s'], tail_db),
                            'fade to zero and hold the last 0.15 s at digital zero (music/mixer.py master does this)',
                            'The sound is cut off at the end instead of finishing, which clicks when the video loops.'))
    plats = {}
    for name, p in sp['platforms'].items():
        off = p['lufs'] - I
        plats[name] = {'target_lufs': p['lufs'], 'playback_gain_db': round(off if (off < 0 or p['boosts_quiet']) else 0.0, 1), 'grade': p['grade']}
    notes.append('platform playback offsets (negative = turned down): ' + ', '.join('%s %+.1f dB' % (k, v['playback_gain_db']) for k, v in plats.items()))
    m = {'integrated_lufs': round(I, 2), 'short_term_max_lufs': round(float(st.max()), 2), 'momentary_max_lufs': round(float(mom.max()), 2),
         'lra_lu': None if L is None else round(L, 1), 'sample_peak_dbfs': round(spk, 2), 'true_peak_dbtp': round(tp, 2), 'plr_lu': round(tp - I, 1),
         'tail_peak_dbfs': round(tail_db, 1), 'short_term_curve': [[round(float(a), 1), round(float(b), 1)] for a, b in zip(st_t, st)],
         'platforms': plats, 'master_spec': 'wav master' if master else 'delivered file'}
    return result('ears/loudness', 'loudness', m, '%.0f +- %.1f LUFS-I, TP <= %.1f dBTP, LRA <= %.0f LU, last %.2f s silent' % (
        tgt, sp['pass_lu'], tp_lim, sp['lra_max_lu'], sp['tail_s']), issues, notes)


# ------------------------------------------------------------------------------------------------ clipping / distortion
def clipping(ctx):
    x, sp = ctx['x'], SPEC['clipping']
    dur = len(x) / SR
    ax = np.abs(x)
    pk = float(ax.max()) if len(ax) else 0.0
    issues = []
    clip_runs = []
    level = min(sp['clip_level'], pk * 0.9995) if pk >= 10 ** (-1 / 20) else sp['clip_level']   # flat tops at the file's own maximum too
    for c in range(x.shape[1]):
        hot = ax[:, c] >= level
        if not hot.any():
            continue
        d = np.diff(np.concatenate([[0], hot.astype(np.int8), [0]]))
        s, e = np.where(d == 1)[0], np.where(d == -1)[0]
        for a, b in zip(s, e):
            if b - a >= sp['min_run']:
                clip_runs.append((a / SR, b / SR, b - a))
    clip_runs.sort()
    over_fs = int((ax > 1.0).sum())
    env = tp_envelope(x)
    isp = env > 1.0
    tp = float(20 * np.log10(env.max() + 1e-20))
    I = meter.lufs_integrated(x)
    rms = meter.rms_db(x)
    crest = float(20 * np.log10(pk + 1e-20) - rms)
    plr = tp - I
    if clip_runs:
        rs = []
        for a, b, _ in clip_runs:
            if rs and a - rs[-1][1] <= 0.25:
                rs[-1][1] = b
            else:
                rs.append([a, b])
        rs = [[round(a, 2), round(b + 0.01, 2)] for a, b in rs]
        issues.append(issue('fail', rs[0], '%d clipped runs (>= %d flat-topped samples) at %s' % (len(clip_runs), sp['min_run'], fmt_ranges(rs)),
                            'find the cue or stem that peaks there and let music/mixer.py solve its level (never gain by hand); remaster with the TP limiter',
                            'You hear crackle or distortion at %s.' % fmt_ranges(rs, 2)))
    if over_fs:
        r2 = runs(np.abs(x).max(axis=1) > 1.0, np.arange(len(x)) / SR, 0.0, 0.25)
        issues.append(issue('fail', r2[0] if r2 else None, '%d decoded samples over 0 dBFS (the source was clipped or mastered too hot) at %s' % (over_fs, fmt_ranges(r2)),
                            'remaster to -1.5 dBTP on the WAV and re-encode; a player clips these samples',
                            'Peaks distort on playback.'))
    if isp.any():
        r3 = runs(isp, np.arange(len(env)) / SR, 0.0, 0.25)
        issues.append(issue('fail' if tp > 0.5 else 'warn', r3[0] if r3 else None,
                            'intersample overs: true peak %.2f dBTP above 0 at %s' % (tp, fmt_ranges(r3)),
                            'run the true-peak limiter (music/mixer.py, ceiling -1.5 dBTP) instead of a sample-peak normaliser',
                            'Transients may crack after the platform re-encodes the audio.'))
    if I > -69 and plr < sp['plr_warn_lu']:
        issues.append(issue('fail' if plr < sp['plr_fail_lu'] else 'warn', None,
                            'peak-to-loudness ratio %.1f LU: transients are squashed (house minimum %.0f)' % (plr, sp['plr_warn_lu']),
                            'lower the master target or the limiter drive; let hits peak 8-12 LU over the programme loudness',
                            'It sounds flat and tiring: the hits have no punch.'))
    m = {'clipped_runs': len(clip_runs), 'samples_over_0dbfs': over_fs, 'intersample_over_samples': int(isp.sum()), 'true_peak_dbtp': round(tp, 2),
         'sample_peak_dbfs': round(20 * np.log10(pk + 1e-20), 2), 'crest_factor_db': round(crest, 1), 'plr_lu': round(plr, 1), 'duration_s': round(dur, 2)}
    return result('ears/clipping', 'cleanliness', m, 'no flat-topped runs, no samples or true peaks over 0 dBFS, PLR >= %.0f LU' % sp['plr_warn_lu'], issues)


# ------------------------------------------------------------------------------------------------ tonal balance
TONE_TEXT = {
    'mud': ('mud: 250-500 Hz is heavy', 'cut 2-4 dB around 300-400 Hz on the stem that fills it (usually the bed pads or a low whoosh), or pick a leaner bed preset',
            'It sounds boxy and muddy, as if through a blanket.'),
    'boomy': ('boomy: 60-250 Hz dominates', 'high-pass the non-bass stems at 80-100 Hz and cut the bed 2-3 dB in 60-250 Hz',
              'The bass booms and covers everything else; on headphones it feels heavy.'),
    'thin': ('thin: almost no low end below 250 Hz', 'add body: a bed with a bass part, or a sub-safe hit; check on headphones (phone speakers hide this)',
             'It sounds small and tinny on headphones.'),
    'harsh': ('harsh: 2-5 kHz presence is too strong', 'tame 2-5 kHz by 2-3 dB on the brightest stem (UI ticks, whooshes, plucks) or swap a sweetener for a softer one',
              'It is shrill and fatiguing, especially on phone speakers.'),
    'sibilant': ('sibilant / fizzy: 5-10 kHz is too strong', 'de-ess the voice (5-9 kHz) or lower hi-hat / noise sweeteners',
                 'Ss and hats hiss.'),
    'dull': ('dull: almost no air above 10 kHz', 'add a +2 dB high shelf above 10 kHz on the bed, or a brighter sweetener on the hits',
             'It sounds dull and muffled, like a low-bitrate copy.'),
}
OCT = {k: np.log2(b / a) for k, (a, b) in SPEC['tone']['bands_hz'].items()}


def _rel(P):
    """per-octave band energy relative to the mid band (dB): P is {band: power}"""
    ref = P['mid'] / OCT['mid']
    return {k: float(db(P[k] / OCT[k] / max(ref, 1e-20))) for k in P}


def _flags(r, extra=0.0):
    rng = SPEC['tone']['range_db_per_octave_vs_mid']
    c_low, c_mud, c_mid = (np.log2(np.sqrt(a * b)) for a, b in (SPEC['tone']['bands_hz'][k] for k in ('low', 'mud', 'mid')))
    line = r['low'] + (c_mud - c_low) / (c_mid - c_low) * (0.0 - r['low'])
    out = {}
    if r['mud'] > rng['mud'][1] + extra or (r['mud'] > SPEC['tone']['mud_line_min_db'] and r['mud'] - line > SPEC['tone']['mud_over_line_db'] + extra):
        out['mud'] = max(r['mud'] - rng['mud'][1], r['mud'] - line - SPEC['tone']['mud_over_line_db'])
    if r['low'] > rng['low'][1] + extra or r['sub'] > rng['sub'][1] + extra:
        out['boomy'] = max(r['low'] - rng['low'][1], r['sub'] - rng['sub'][1])
    if r['low'] < rng['low'][0] - extra and r['sub'] < rng['sub'][0] + 10:
        out['thin'] = rng['low'][0] - r['low']
    if r['presence'] > rng['presence'][1] + extra:
        out['harsh'] = r['presence'] - rng['presence'][1]
    if r['sibilance'] > rng['sibilance'][1] + extra:
        out['sibilant'] = r['sibilance'] - rng['sibilance'][1]
    if r['air'] < rng['air'][0] - extra and r['sibilance'] < rng['sibilance'][0] + 6:
        out['dull'] = rng['air'][0] - r['air']
    return out


def tone(ctx):
    S, t, f = ctx['S_tone']
    bands = SPEC['tone']['bands_hz']
    Pb = {k: band(S, f, a, b) for k, (a, b) in bands.items()}
    tot = sum(Pb.values())
    lev = db(tot)
    live = lev > (np.max(lev) - 35)                                   # ignore near-silent frames
    if not live.any():
        return result('ears/tone', 'tone', {}, 'n/a', [], ['silent'], status='n/a')
    P = {k: float(v[live].mean()) for k, v in Pb.items()}
    if sum(P.values()) <= 0 or P['mid'] <= 0:
        return result('ears/tone', 'tone', {}, 'n/a', [], ['no energy in the mono sum (silent, or L and R cancel: see ears/stereo)'], status='n/a')
    share = {k: round(P[k] / sum(P.values()), 3) for k in P}
    r = _rel(P)
    flags = _flags(r)
    # time ranges: 1 s blocks (hop 0.5 s) with the same rule
    hop = float(t[1] - t[0]) if len(t) > 1 else 0.05
    per = max(1, int(round(0.5 / hop)))
    blk_t, blk_flags = [], []
    for a in range(0, len(t) - per, per):
        sl = slice(a, a + 2 * per)
        if live[sl].mean() < 0.5:
            blk_t.append(t[a]); blk_flags.append({}); continue
        blk_t.append(t[a]); blk_flags.append(_flags(_rel({k: float(v[sl].mean()) for k, v in Pb.items()})))
    issues, lean = [], []
    for k, over in sorted(flags.items(), key=lambda kv: -kv[1]):
        if over <= SPEC['tone']['note_margin_db']:                      # just past a house range: a note, not a verdict
            lean.append('leans %s (%.1f dB past the house range)' % (k, over))
            continue
        mask = np.array([k in b for b in blk_flags]) if blk_flags else np.zeros(0, bool)
        rs = runs(mask, np.array(blk_t), SPEC['tone']['min_run_s'] - 0.5, 0.5) if len(mask) else []
        what, fix, lis = TONE_TEXT[k]
        issues.append(issue('fail' if over > 6 else 'warn', rs[0] if rs else None,
                            '%s (%.1f dB past the house range)%s' % (what, over, '; worst at ' + fmt_ranges(rs) if rs else ' across the whole mix'),
                            fix, lis + (' Most at %s.' % fmt_ranges(rs, 2) if rs else '')))
    # passing flags that only occur locally (the mix overall is fine)
    local = {}
    for b, tt in zip(blk_flags, blk_t):
        for k in b:
            if k not in flags:
                local.setdefault(k, []).append(tt)
    notes = lean + ['locally %s at %s' % (k, ', '.join('%.1f s' % v for v in ts[:4])) for k, ts in local.items() if len(ts) >= 2]
    rng = SPEC['tone']['range_db_per_octave_vs_mid']
    m = {'band_share': share, 'db_per_octave_vs_mid': {k: round(v, 1) for k, v in r.items()},
         'centroid_hz': round(float((S[live] * f[None, :]).sum() / (S[live].sum() + 1e-20)), 0)}
    return result('ears/tone', 'tone', m, 'per-octave energy vs 500 Hz-2 kHz inside ' + ', '.join('%s %s..%s' % (k, a, b) for k, (a, b) in rng.items()) + ' dB', issues, notes)


# ------------------------------------------------------------------------------------------------ stereo
def stereo(ctx):
    x, sp = ctx['x'], SPEC['stereo']
    L, R = x[:, 0], x[:, 1]
    if ctx.get('channels') == 1 or np.allclose(L, R, atol=1e-6):
        return result('ears/stereo', 'stereo', {'mono': True, 'correlation': 1.0, 'mono_loss_db': 0.0, 'width_db': None},
                      'correlation > 0, mono loss <= %.1f dB' % sp['mono_loss_warn_db'], [], ['mono source: nothing to check (it is fully mono-compatible)'])
    corr = float((L * R).sum() / np.sqrt((L ** 2).sum() * (R ** 2).sum() + 1e-20))
    M, Sd = (L + R) / 2, (L - R) / 2
    Ist = meter.lufs_integrated(x)
    Imo = meter.lufs_integrated(np.stack([M, M], 1))
    loss = Ist - Imo
    width = float(db((Sd ** 2).sum()) - db((M ** 2).sum()))
    blk = int(0.5 * SR)
    ts, cs = [], []
    for a in range(0, len(L) - blk, blk):
        l, r = L[a:a + blk], R[a:a + blk]
        e = np.sqrt((l ** 2).sum() * (r ** 2).sum())
        if 10 * np.log10((l ** 2).mean() + (r ** 2).mean() + 1e-20) < -50 or e <= 0:
            continue
        ts.append(a / SR); cs.append(float((l * r).sum() / e))
    issues = []
    if ts:
        neg = runs(np.array(cs) < sp['corr_warn'], np.array(ts), 0.5, 0.5)
        if neg:
            issues.append(issue('warn', neg[0], 'L/R correlation below 0 (out-of-phase content) at %s' % fmt_ranges(neg),
                                'check the stereo widener or the panned layers there; collapse the wide layer below 150 Hz to mono',
                                'On a phone (mono speaker) parts of the sound thin out or vanish at %s.' % fmt_ranges(neg, 2)))
    if loss > sp['mono_loss_warn_db']:
        issues.append(issue('fail' if loss > sp['mono_loss_fail_db'] else 'warn', None, 'summing to mono loses %.1f dB' % loss,
                            'reduce width on the main bed and keep hits and voice centred',
                            'On a single phone speaker it gets noticeably quieter and hollow.'))
    if width > sp['width_warn_db']:
        issues.append(issue('warn', None, 'very wide image: side is %.1f dB vs mid' % width, 'narrow the bed; keep key elements in the centre',
                            'It sounds phasey and unstable, and loses its centre on mono speakers.'))
    m = {'mono': False, 'correlation': round(corr, 2), 'min_block_correlation': round(min(cs), 2) if cs else None,
         'mono_loss_db': round(loss, 2), 'width_db': round(width, 1)}
    return result('ears/stereo', 'stereo', m, 'correlation > 0, mono loss <= %.1f dB, side <= %.0f dB vs mid' % (sp['mono_loss_warn_db'], sp['width_warn_db']), issues)


def tone_stft(y):
    return stft_power(y, 8192, 2400)
