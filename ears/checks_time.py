"""motion-pack / ears / checks_time.py: speech (VAD, speech-to-music ratio, ducking), rhythm and sync, structure, repetition fatigue.
Same result shape as checks_level.py."""
import numpy as np
from scipy.ndimage import median_filter, uniform_filter1d

from . import core
from .core import SPEC, SR, db, runs, fmt_ranges, band, stft_power
from .checks_level import result, issue


# ------------------------------------------------------------------------------------------------ speech
def vad(S, t, f, loose=False):
    """energy + spectral voice activity on a 10 ms grid: the 300-3400 Hz band carries most of the energy, its envelope moves at
    syllable rate (2-8 Hz) by more than 7 dB and does not move with the out-of-band energy (drums move every band together).
    Tuned for precision over recall on the pack's own mixes (a ducked VO film, music-only demos, a formant-babble scene): it finds
    clear, forward voice-over and misses some lines; a transcript gives exact regions. returns [[t0, t1]]"""
    fps = 1.0 / float(t[1] - t[0])
    sp = band(S, f, 300, 3400)
    tot = S.sum(axis=1) + 1e-20
    out = band(S, f, 20, 200) + band(S, f, 6000, 20000)
    r = sp / tot
    e_sp, e_out = db(sp), db(out)
    w1, w06 = int(1.0 * fps) | 1, int(0.6 * fps) | 1
    d_sp = e_sp - uniform_filter1d(e_sp, w06, mode='nearest')
    d_out = e_out - uniform_filter1d(e_out, w06, mode='nearest')
    mod = np.sqrt(uniform_filter1d(d_sp ** 2, w1, mode='nearest'))
    cov = uniform_filter1d(d_sp * d_out, w1, mode='nearest')
    var_o = uniform_filter1d(d_out ** 2, w1, mode='nearest')
    comod = cov / np.sqrt(mod ** 2 * var_o + 1e-9)
    live = e_sp > (np.percentile(e_sp, 95) - 40)
    rr = uniform_filter1d(r, w1, mode='nearest')
    cand = live & (rr > 0.45) & (mod > 7.0) & (comod < 0.5)
    cand = median_filter(cand.astype(np.int8), size=int(0.3 * fps) | 1) > 0
    if loose:                                             # a permissive per-frame mask: anything that might be speech
        return live & (rr > 0.35) & (mod > 4.0)
    return runs(cand, t, 0.6, 0.4)


def _mean_pow(p, t, a, b):
    m = (t >= a) & (t < b)
    return float(p[m].mean()) if m.sum() >= 5 else None


def _syllabic(p, t, a, b):
    """how much the speech band jumps between syllable peaks (P90) and the floor (P10), dB; None on short spans"""
    m = (t >= a) & (t < b)
    if m.sum() < 20:
        return None
    p10, p90 = np.percentile(p[m], 10), np.percentile(p[m], 90)
    return float(db(max(p90 - p10, 1e-20)) - db(p10))


def _references(regs, i, dur, reach=6.0, longest=2.0):
    """music-only stretches next to speech region i: the gaps between regions minus the duck release (0.4 s after speech) and look-ahead
    (0.15 s before it), at least 0.5 s long, within `reach` s; at most one per side, the part nearest the line, up to `longest` s"""
    a, b = regs[i]
    prev_end = regs[i - 1][1] if i > 0 else None
    next_start = regs[i + 1][0] if i + 1 < len(regs) else None
    out = []
    g0, g1 = (prev_end + 0.4) if prev_end is not None else 0.0, a - 0.15
    if g1 - g0 >= 0.5 and a - g1 <= reach:
        out.append((max(g0, g1 - longest), g1))
    g0, g1 = b + 0.4, (next_start - 0.15) if next_start is not None else dur
    if g1 - g0 >= 0.5 and g0 - b <= reach:
        out.append((g0, min(g1, g0 + longest)))
    return out


def speech(ctx):
    S, t, f = ctx['S']
    sp = SPEC['speech']
    tr = ctx.get('transcript')
    if tr:
        regs = []
        for a, b, _ in sorted(tr):
            if regs and a - regs[-1][1] < 0.3:
                regs[-1][1] = round(b, 2)
            else:
                regs.append([round(a, 2), round(b, 2)])
        source = 'transcript'
    else:
        regs, source = vad(S, t, f), 'vad'
    if not regs:
        return result('ears/speech', 'speech', {'source': source, 'speech_s': 0.0}, 'speech-to-music >= %.0f dB, ducking >= %.0f dB' % (sp['smr_pass_db'], sp['duck_min_db']),
                      [], ['no speech detected (music / SFX-only mix); pass --transcript to check a voice the detector missed'], status='n/a')
    p_sp = band(S, f, *sp['band_hz'])
    cands = {'below 100 Hz': band(S, f, 20, 100), 'above 10 kHz': band(S, f, 10000, 16000)}
    floor = db(np.percentile(S.sum(axis=1), 95)) - 60
    maybe = vad(S, t, f, loose=True) if source == 'vad' else None
    issues, rows = [], []
    dur = float(t[-1])
    for i, (a, b) in enumerate(regs):
        if b - a < 0.6:
            continue
        refs = _references(regs, i, dur)
        if source == 'vad':                               # the detector misses lines, so a gap must also look nothing like speech
            refs = [r for r in refs if float(maybe[(t >= r[0]) & (t < r[1])].mean() if ((t >= r[0]) & (t < r[1])).any() else 1) < 0.2]
        fl_d = _syllabic(p_sp, t, a + 0.15, b - 0.1)
        lv_d = _mean_pow(p_sp, t, a + 0.15, b - 0.1)
        if source == 'vad' and fl_d is not None and lv_d:  # a gap as loud as the line in the speech band that moves like it is undetected speech
            refs = [r for r in refs if not ((_mean_pow(p_sp, t, *r) or 0) >= lv_d * 10 ** (-1.5 / 10) and (_syllabic(p_sp, t, *r) or -99) >= fl_d - 6)]
        row = {'t': [a, b], 'duck_db': None, 'band': None, 'refs': [[round(x, 2), round(y, 2)] for x, y in refs]}
        best = None
        for name, p in cands.items():                     # the bass under the voice first (speech has little below 100 Hz); air above 10 kHz otherwise
            outs = [v for v in (_mean_pow(p, t, x, y) for x, y in refs) if v is not None]
            during = _mean_pow(p, t, a + 0.15, b - 0.1)
            if not outs or during is None or db(float(np.mean(outs))) < floor:
                continue
            best = (name, float(np.mean(outs)), during, [float(db(v)) for v in outs])
            break
        if best is None:
            row['why'] = 'no music-only stretch of 0.5 s next to the line (gaps that move like speech are skipped), or no music at all'
        elif len(best[3]) == 2 and abs(best[3][0] - best[3][1]) > 4:
            row['why'] = 'the music changes around the line (before and after differ by %.1f dB)' % abs(best[3][0] - best[3][1])
        elif db(best[1]) - db(best[2]) < -1:
            row['why'] = 'the music is louder during the line than around it (it changes there)'
        else:
            depth = float(db(best[1]) - db(best[2]))
            row.update(duck_db=round(depth, 1), band=best[0])
            m_out = [v for v in (_mean_pow(p_sp, t, x, y) for x, y in refs) if v is not None]
            p_during = _mean_pow(p_sp, t, a + 0.15, b - 0.1)
            if m_out and p_during:
                mus = float(np.mean(m_out)) * 10 ** (-max(depth, 0.0) / 10)
                spe = p_during - mus
                row['smr_db'] = round(float(db(spe) - db(mus)), 1) if spe > 0 else -20.0
                row['smr_method'] = 'reference'
        if row.get('smr_db') is None and fl_d is not None:   # no music-only reference: the syllable peaks over the floor between syllables
            row['smr_db'] = round(fl_d, 1)
            row['smr_method'] = 'floor (upper bound: the floor holds music and room)'
        rows.append(row)
    ducks = [r['duck_db'] for r in rows if r.get('duck_db') is not None]
    smrs = [r['smr_db'] for r in rows if r.get('smr_db') is not None]
    unsure = source == 'vad'
    for r in ([] if unsure else rows):                   # detector regions miss lines, so their gaps may hold speech: numbers only, no verdict
        a, b = r['t']
        d = r.get('duck_db')
        if d is not None and d < sp['duck_min_db']:
            sev = 'fail' if d < sp['duck_warn_db'] and not unsure else 'warn'
            issues.append(issue(sev, [a, b], 'music under the voice drops only %.1f dB (pack rule >= %.0f dB) at %.1f-%.1f s (measured %s against %s)%s' % (
                d, sp['duck_min_db'], a, b, r['band'], ', '.join('%.1f-%.1f s' % tuple(x) for x in r['refs']), ' [speech found by the detector]' if unsure else ''),
                'duck the bed 9 dB under the VO: add the voice as plan vo / Mix.add_vo so music/mixer.py ducks it (R5)',
                'The music stays as loud while someone talks at %.1f-%.1f s.' % (a, b), kind='ducking'))
        s = r.get('smr_db')
        if s is not None and s < sp['smr_pass_db']:
            sev = 'fail' if s < sp['smr_warn_db'] and not unsure else 'warn'
            issues.append(issue(sev, [a, b], 'speech only %.1f dB over the music in 300 Hz-3.4 kHz at %.1f-%.1f s (masking; %s method)' % (s, a, b, r['smr_method'].split(' ')[0]),
                                'raise the voice or carve the bed 2-4 dB at 1-4 kHz under it; pick a sparser bed section for the line',
                                'Words are hard to make out under the music at %.1f-%.1f s.' % (a, b), kind='masking'))
    m = {'source': source, 'regions': rows, 'speech_s': round(sum(b - a for a, b in regs), 1), 'speech_share': round(sum(b - a for a, b in regs) / max(dur, 1e-6), 2),
         'ducking_db_median': round(float(np.median(ducks)), 1) if ducks else None, 'smr_db_median': round(float(np.median(smrs)), 1) if smrs else None}
    notes = []
    if not ducks:
        whys = sorted({r.get('why', '') for r in rows if r.get('why')})
        notes.append('ducking not measurable: %s. Judge it by ear, or check the stems (music/mixer.py writes stem_music.wav)' % ('; '.join(whys) or 'no reference'))
    if tr:
        words = sum(w for _, _, w in tr)
        secs = sum(b - a for a, b, _ in tr)
        wpm = words / secs * 60 if secs else 0
        m['words_per_min'] = round(wpm)
        lo, hi = sp['wpm_range']
        if wpm and not lo <= wpm <= hi:
            issues.append(issue('warn', None, '%d words per minute (house range %d-%d)' % (wpm, lo, hi),
                                'cut words from the script (story-script) rather than speeding the read' if wpm > hi else 'tighten the pauses between lines',
                                'The voice is %s.' % ('rushed and hard to follow' if wpm > hi else 'slow and draggy')))
    elif source == 'vad':
        low = [r for r in rows if (r.get('duck_db') is not None and r['duck_db'] < sp['duck_min_db']) or (r.get('smr_db') is not None and r['smr_db'] < sp['smr_pass_db'])]
        notes.append('speech found by the energy + spectral detector (it misses some lines, so the gaps it compares against may hold speech): '
                     'ducking and masking are measured but not judged. Pass --transcript (refstudy study.json, Whisper JSON or a words.json) for a verdict.')
        if low:
            notes.append('unverified: ' + '; '.join('%.1f-%.1f s duck %s dB, speech over music %s dB' % (r['t'][0], r['t'][1], r.get('duck_db'), r.get('smr_db')) for r in low[:6]))
    return result('ears/speech', 'speech', m, 'ducking >= %.0f dB, speech-to-music >= %.0f dB in 300 Hz-3.4 kHz, %d-%d wpm' % (
        sp['duck_min_db'], sp['smr_pass_db'], sp['wpm_range'][0], sp['wpm_range'][1]), issues, notes)


# ------------------------------------------------------------------------------------------------ rhythm and sync
def _nearest(ts, ref):
    ref = np.asarray(ref)
    if not ref.size:
        return None
    i = int(np.argmin(np.abs(ref - ts)))
    return float(ref[i])


EDGES = [150, 400, 1000, 2500, 6000, 16000]


def _bandenv(sig):
    """1 ms, 5-band magnitude envelopes (150 Hz-16 kHz): (frames, 5). Bands keep a cue apart from a kick or a pad on the same frame."""
    S, _, f = stft_power(np.asarray(sig, float), 256, 48)
    return np.sqrt(np.stack([band(S, f, a, b) for a, b in zip(EDGES[:-1], EDGES[1:])], 1))


def _hp(sig):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(2, 200.0, 'hp', fs=SR, output='sos'), np.asarray(sig, float))


def _wave_align(yh, tpl, anchor, exp, search):
    """sample-exact matched filter: normalised cross-correlation of the 200 Hz high-passed take with the mix. The mixer only scales a take
    (gain, pan, limiter), so its own waveform peaks at the true lag even under a louder kick on the neighbouring frame."""
    from scipy.signal import fftconvolve
    a0, a1 = max(0, anchor - int(0.05 * SR)), min(len(tpl), anchor + int(0.15 * SR))
    T = _hp(tpl)[a0:a1]
    tn = np.sqrt((T ** 2).sum())
    if len(T) < 64 or tn <= 0:
        return None, 0.0
    pre = anchor - a0
    lo = int(round(exp * SR)) - int(search * SR) - pre
    hi = lo + 2 * int(search * SR) + len(T)
    seg = np.concatenate([np.zeros(max(0, -lo)), yh[max(0, lo):min(len(yh), hi)], np.zeros(max(0, hi - len(yh)))])
    num = fftconvolve(seg, T[::-1], mode='valid')
    c2 = np.concatenate([[0.0], np.cumsum(seg ** 2)])
    den = np.sqrt(np.maximum(c2[len(T):] - c2[:-len(T)], 1e-20)) * tn
    r = num / den[:len(num)]
    l = int(np.argmax(r))
    sig = r[l] >= 0.15 and r[l] >= 5 * float(np.median(np.abs(r)))     # a real peak, not the noise floor of an absent take
    return (lo + l + pre) / SR, float(r[l]) if sig else 0.0


def _align(y, c, exp, search, yh=None):
    """find the cue's own take (the exact take music/mixer.py places, round robin included) within +-search s of the expected anchor:
    first a sample-exact waveform matched filter; when the take was altered (another mixer, heavy processing) a 5-band 1 ms envelope match.
    returns (measured anchor time, match 0-1) or (None, None)"""
    take = core.cue_take(c['id'], c.get('occurrence', 0))
    if take is None:
        return None, None
    tpl, anchor = take
    if yh is not None:
        t_w, r_w = _wave_align(yh, tpl, anchor, exp, search)
        if t_w is not None and r_w > 0:
            return t_w, r_w
    a0, a1 = max(0, anchor - int(0.1 * SR)), min(len(tpl), anchor + int(0.2 * SR))
    T = _bandenv(tpl[a0:a1])
    if len(T) < 8 or not np.any(T):
        return None, None
    pre = (anchor - a0) / SR
    lo = int(round((exp - search - pre) * SR))
    hi = lo + int(round(2 * search * SR)) + (a1 - a0) + 256
    seg = np.concatenate([np.zeros(max(0, -lo)), y[max(0, lo):min(len(y), hi)], np.zeros(max(0, hi - len(y)))])
    M = _bandenv(seg)
    n = len(T)
    Tz = T - T.mean(0)
    tn = np.sqrt((Tz ** 2).sum())
    rs = np.full(len(M) - n + 1, -1.0)
    for l in range(len(rs)):
        Wz = M[l:l + n] - M[l:l + n].mean(0)
        d = np.sqrt((Wz ** 2).sum()) * tn
        rs[l] = float((Wz * Tz).sum() / d) if d > 0 else 0.0
    if not len(rs):
        return None, None
    lag = int(np.argmax(rs))
    l_exp = int(round(search * SR / 48))                     # the lag that puts the anchor exactly on the expected sample
    if 0 <= l_exp < len(rs) and rs[lag] - rs[l_exp] < 0.05:   # a near tie (long, smooth takes): no evidence against the plan
        lag = l_exp
    return (lo + lag * 48) / SR + pre, (float(rs[lag]) if rs[lag] >= 0.5 else 0.0)


def _chance_share(on, tol, dur):
    """the chance level of 'within tol of an onset': the fraction of the timeline inside the merged +/- tol windows around the onsets.
    A cut or an event placed at random in time lands inside with this probability (a busy bed at 4 onsets/s makes it 40-60%)."""
    if dur <= 0 or not len(on):
        return 0.0
    cover, end = 0.0, 0.0
    for a, b in zip(np.clip(np.sort(np.asarray(on, float)) - tol, 0.0, dur), np.clip(np.sort(np.asarray(on, float)) + tol, 0.0, dur)):
        a = max(a, end)
        if b > a:
            cover += b - a
            end = b
    return min(1.0, cover / dur)


def _chance_note(share, n, chance, what):
    """a plain sentence when a sync share is within chance of what luck gives (a binomial z < 2 above it)"""
    z = (share * n - chance * n) / np.sqrt(n * chance * (1 - chance)) if 0 < chance < 1 else None
    if z is None or z >= 2:
        return None
    return 'chance level: %d%% of the timeline is inside the onset windows, so %d%% of %s on an onset is %s (z %.1f); it is not evidence of sync' % (
        round(chance * 100), round(share * 100), what, 'about what luck gives' if z > -2 else 'below what luck gives', z)


def sync(ctx):
    y, fps, sp = ctx['y'], ctx['fps'], SPEC['sync']
    on, strg = ctx['onsets'], ctx['strengths']
    tm = ctx['tempo']
    dur = len(y) / SR
    issues, notes = [], []
    hits = [float(a) for a, s in zip(on, strg) if len(strg) and s >= np.percentile(strg, 90)]
    # R10: an audible event on frames 0-3
    lvl = db(uniform_filter1d(y ** 2, int(0.05 * SR))) if len(y) else np.zeros(1)
    first = np.argmax(lvl > -35) / SR if (lvl > -35).any() else None
    first_f = None if first is None else int(np.floor(first * fps))
    q_open = next((q for q in (ctx.get('quiet') or []) if q['t'][0] <= 1.0 / fps + 1e-6), None)      # a planned quiet open (plan.audio.quiet)
    mode = ctx.get('mode', 'music')
    if first_f is None or first_f > sp['first_event_frame_max']:
        qmax = SPEC['quiet']['max_s']['open']
        if q_open is not None and first is not None and first <= q_open['t'][1] + 0.25:
            notes.append('planned quiet open %.1f-%.1f s (%s): the sound enters at frame %d (%.2f s), as planned; the picture must move from frame 0'
                         % (q_open['t'][0], q_open['t'][1], q_open.get('why') or 'plan.audio.quiet', first_f, first))
            if first > qmax + SPEC['quiet']['max_margin_s']:
                issues.append(issue('warn', [0.0, round(first, 2)], 'the planned quiet open runs %.2f s (house max %.1f s: the sound enters 1-2 s after a moving frame 0)' % (first, qmax),
                                    'bring the first sound in by %.1f s: on the first meaningful visual event' % qmax,
                                    'The opening stays silent long enough that a viewer may think the sound is off.'))
        else:
            issues.append(issue('warn', [0.0, round(first or dur, 2)], 'first audible sound at %s (pack R10: an event on frames 0-%d)' % (
                'never' if first is None else 'frame %d (%.2f s)' % (first_f, first), sp['first_event_frame_max']),
                'put a hit or the bed downbeat on frame 0 (plan cue t: 0), or, if the quiet open is intended (sound enters 1-2 s after a moving frame 0), '
                'mark it in plan.audio.quiet [{"t": [0, %.1f], "kind": "open", "why": "..."}]' % min(2.0, first or 2.0),
                'The first moment is silent, so a scrolling viewer hears nothing to stop for.'))
    m = {'tempo_bpm': None if not tm['bpm'] else round(tm['bpm'], 1), 'tempo_confidence': round(tm['confidence'], 2), 'beats': len(tm['beats']),
         'onsets': len(on), 'onsets_per_s': round(len(on) / max(dur, 1e-6), 2), 'hits': [round(h, 3) for h in hits][:40],
         'first_audible_frame': first_f, 'fps': fps, 'mode': mode}
    if tm['bpm'] and tm['confidence'] < 0.3:
        notes.append('tempo confidence %.2f: the tempo is a guess (speech or free-time music)' % tm['confidence'])
    if tm['bpm']:
        notes.append('tempo can read as half or double time; %.1f BPM also fits %.1f / %.1f' % (tm['bpm'], tm['bpm'] / 2, tm['bpm'] * 2))
    cuts = ctx.get('cuts')
    tol = sp['cut_tolerance_frames'] / fps
    if cuts:
        rows = []
        for c in cuts:
            n_on, n_b = _nearest(c, on), _nearest(c, tm['beats'])
            rows.append({'t': round(c, 3), 'onset_dt_frames': None if n_on is None else round((n_on - c) * fps, 1),
                         'beat_dt_frames': None if n_b is None else round((n_b - c) * fps, 1),
                         'on_onset': n_on is not None and abs(n_on - c) <= tol, 'on_beat': n_b is not None and abs(n_b - c) <= tol, 'nearest_onset': n_on})
        share = sum(r['on_onset'] for r in rows) / len(rows)
        share_b = sum(r['on_beat'] for r in rows) / len(rows)
        m.update(cuts=len(rows), cuts_on_onset=round(share, 2), cuts_on_beat=round(share_b, 2), cuts_on_onset_chance=round(_chance_share(on, tol, dur), 2))
        nt = _chance_note(share, len(rows), m['cuts_on_onset_chance'], 'cuts') if len(rows) >= 4 else None
        if nt and mode == 'music':
            notes.append(nt)
        if mode != 'music':
            notes.append('mode %s: cuts on onsets %d%% is information only (the >= %d%% rule applies to music-led, cut-driven pieces; references/critic.md)'
                         % (mode, round(share * 100), round(sp['cuts_on_onset_min'] * 100)))
        elif share < sp['cuts_on_onset_min']:
            off = [r for r in rows if not r['on_onset']]
            fix = '; '.join('%.2f s -> %.2f s (%+.0f f)' % (r['t'], r['nearest_onset'], r['onset_dt_frames']) for r in off[:4] if r['nearest_onset'] is not None)
            issues.append(issue('fail' if share < sp['cuts_on_onset_min'] / 2 else 'warn', [off[0]['t'], off[0]['t']] if off else None,
                                '%d%% of %d cuts sit within %d frames of an onset (target >= %d%%)' % (round(share * 100), len(rows), sp['cut_tolerance_frames'], round(sp['cuts_on_onset_min'] * 100)),
                                'move the cuts to the nearest onset: %s, or run cuts/cutgen.py snap --study <refstudy study.json>' % (fix or 'add a cue on each cut'),
                                'Cuts land between sounds, so the edit feels unmotivated and loose.'))
        m['cut_rows'] = [{k: v for k, v in r.items() if k != 'nearest_onset'} for r in rows]
    if mode == 'vo':
        _vo_continuity(ctx, cuts or [], m, issues, notes)
    elif mode == 'continuous':
        _motion_sync(ctx, on, tol, m, issues, notes)
    cues = ctx.get('cues') or []
    if cues:
        rows = []
        yh = _hp(y)
        for c in cues:
            exp = (c['frame'] + 1 + c['offset']) / fps
            meas, conf = _align(y, c, exp, sp['anchor_search_frames'] / fps, yh)
            if not conf:
                meas = None
            dt = None if meas is None else (meas - exp) * fps
            rows.append({'id': c['id'], 't': c['t'], 'expected_s': round(exp, 3), 'measured_s': None if meas is None else round(meas, 3),
                         'dt_frames': None if dt is None else round(dt, 2), 'match': None if conf is None else round(conf, 2), 'riser': c['riser']})
        meas = [r for r in rows if r.get('dt_frames') is not None]
        good = [r for r in meas if abs(r['dt_frames']) <= sp['anchor_pass_frames']]
        m['cue_rows'] = rows
        m['cues_checked'] = len(meas)
        m['cues_on_anchor'] = round(len(good) / len(meas), 2) if meas else None
        bad = [r for r in meas if abs(r['dt_frames']) > sp['anchor_warn_frames']]
        near_miss = [r for r in meas if sp['anchor_pass_frames'] < abs(r['dt_frames']) <= sp['anchor_warn_frames']]
        if meas and len(good) / len(meas) < 0.8:
            share = len(good) / len(meas)
            worst = sorted(bad + near_miss, key=lambda r: -abs(r['dt_frames']))
            issues.append(issue('fail' if share < 0.5 else 'warn', [worst[0]['expected_s'], worst[0]['expected_s']] if worst else None,
                                '%d of %d measurable cues land on their anchor frame (F + 1, risers F) within %.1f frame' % (len(good), len(meas), sp['anchor_pass_frames']),
                                'place cues through templates/_shared/audio.py or music/mixer.py (anchor sample on (F + 1) x 48000 / fps); off: ' +
                                '; '.join('%s at %.2f s %+.1f f' % (r['id'], r['expected_s'], r['dt_frames']) for r in worst[:4]),
                                'Some sounds land a little before or after the picture, so hits feel late or early.'))
        risers = [r for r in meas if r.get('riser')]
        for r in risers:
            if abs(r['dt_frames']) > 1.0:
                issues.append(issue('warn', [r['expected_s'], r['expected_s']], 'riser %s peaks %+.1f frames from one frame before its hit' % (r['id'], r['dt_frames']),
                                    'end the riser one frame before the hit (sfx manifest anchor_frame_offset -1; mixer places it)',
                                    'The build-up does not lead cleanly into the hit.'))
        missing = [r for r in rows if r.get('measured_s') is None and not r.get('note')]
        if missing:
            notes.append('%d cue(s) not detectable in the mix (buried under the bed or soft attack): %s' % (len(missing), ', '.join('%s at %.2f s' % (r['id'], r['t']) for r in missing[:5])))
    edit = {'music': '>= %d%% of cuts within %d frames of an onset' % (round(sp['cuts_on_onset_min'] * 100), sp['cut_tolerance_frames']),
            'vo': 'no cut inside a word (VO-led: cuts sit under the voice)',
            'continuous': '>= %d%% of motion events within %d frames of an onset' % (round(sp['cuts_on_onset_min'] * 100), sp['cut_tolerance_frames'])}[mode]
    return result('ears/sync', 'sync', m, '%s, cue anchors on F + 1, risers end on F, an event by frame %d (or a planned quiet open)' % (
        edit, sp['first_event_frame_max']), issues, notes)


def _vo_continuity(ctx, cuts, m, issues, notes):
    """VO-led films: the voice is the continuity. Cuts may (and mostly do) land under speech; a cut inside a word is the fault.
    Needs word timings (words.json, or a Whisper JSON with word timestamps); with segments only, the share of cuts under speech is reported."""
    tr, words, edge = ctx.get('transcript'), ctx.get('words'), SPEC['sync']['word_edge_s']
    if not tr and not words:
        notes.append('mode vo without --transcript: speech continuity not checked (pass a words.json or a Whisper JSON with word timestamps)')
        return
    if tr and cuts:
        under = sum(1 for c in cuts if any(a <= c <= b for a, b, _ in tr))
        m['cuts_under_speech'] = round(under / len(cuts), 2)
        notes.append('%d%% of cuts fall under a speech line (reference VO documentaries: 61-89%%; cuts do not wait for sentence ends)' % round(under / len(cuts) * 100))
    if not words:
        notes.append('segment-level transcript: cuts inside words cannot be checked (pass a words.json or Whisper word timestamps)')
        return
    inside = [(c, a, b) for c in cuts for a, b in words if a + edge < c < b - edge]
    m['cuts_inside_words'] = len(inside)
    if inside:
        issues.append(issue('warn', [inside[0][0], inside[0][0]], '%d cut(s) land inside a word: %s' % (
            len(inside), ', '.join('%.2f s (word %.2f-%.2f)' % x for x in inside[:4])),
            'move each cut to the nearest word boundary or into the gap between words (a speech gap is where a diagram or UI should advance)',
            'The picture jumps in the middle of a word, so the voice and the edit fight.'))


def _motion_sync(ctx, on, tol, m, issues, notes):
    """continuous films: the picture's motion events (things appearing, flashes, large changes) should land on onsets, as cuts do in a cut edit"""
    sp = SPEC['sync']
    ev = ctx.get('events')
    if not ev:
        notes.append('mode continuous: no motion events (plan.audio.events, --events with a refstudy study.json, or an MP4 so ears measures them)')
        return
    rows = []
    for e in ev:
        n_on = _nearest(e, on)
        rows.append({'t': round(e, 3), 'onset_dt_frames': None if n_on is None else round((n_on - e) * ctx['fps'], 1), 'on_onset': n_on is not None and abs(n_on - e) <= tol,
                     'nearest_onset': n_on})
    share = sum(r['on_onset'] for r in rows) / len(rows)
    dur = len(ctx['y']) / SR
    m.update(motion_events=len(rows), events_on_onset=round(share, 2), events_on_onset_chance=round(_chance_share(on, tol, dur), 2),
             event_rows=[{k: v for k, v in r.items() if k != 'nearest_onset'} for r in rows])
    nt = _chance_note(share, len(rows), m['events_on_onset_chance'], 'motion events') if len(rows) >= 4 else None
    if nt:
        notes.append(nt)
    if share < sp['cuts_on_onset_min']:
        off = [r for r in rows if not r['on_onset']]
        fix = '; '.join('%.2f s -> %.2f s (%+.0f f)' % (r['t'], r['nearest_onset'], r['onset_dt_frames']) for r in off[:4] if r['nearest_onset'] is not None)
        issues.append(issue('fail' if share < sp['cuts_on_onset_min'] / 2 else 'warn', [off[0]['t'], off[0]['t']] if off else None,
                            '%d%% of %d motion events sit within %d frames of an onset (target >= %d%%; continuous film)' % (
                                round(share * 100), len(rows), sp['cut_tolerance_frames'], round(sp['cuts_on_onset_min'] * 100)),
                            'put a cue on each accent (plan cue t = the event frame) or move the accent to the music: %s' % (fix or 'add a cue per event'),
                            'Things appear on screen between sounds, so the motion and the music feel unrelated.'))
