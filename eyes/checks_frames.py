"""motion-pack / eyes / checks_frames.py: frame 0, black / empty / frozen frames and stalls, flashes, banding.
Every check returns {id, category, status, measured, target, issues[], notes[]}; an issue is {severity, t, what, fix, viewer, kind}."""
import numpy as np
from scipy.ndimage import gaussian_filter

from . import core
from .core import SPEC, result, issue, runs, fmt_ranges, ratio, lum_from_gray


def idx_runs(mask):
    """half-open index runs [(i0, i1)] of the True stretches of a boolean array"""
    m = np.concatenate([[0], np.asarray(mask, np.int8), [0]])
    d = np.diff(m)
    return list(zip(np.where(d == 1)[0].tolist(), np.where(d == -1)[0].tolist()))


def _t(c, i):
    return float(c.t[i]) if i < c.n else float(c.dur)


# ------------------------------------------------------------------------------------------------ frame 0
def subject_contrast(y):
    """the WCAG ratio at the most salient spot of a luma frame: the 85th over the 15th luminance percentile inside a window around the strongest centre-surround
    response (a hero against its backdrop), and the window's mask"""
    sp = SPEC['frame0']
    lum = lum_from_gray(y)
    m = max(y.shape)
    sal = np.abs(gaussian_filter(lum, sp['subject_sigma_frac'][0] * m) - gaussian_filter(lum, sp['subject_sigma_frac'][1] * m))
    py, px = np.unravel_index(int(np.argmax(sal)), sal.shape)
    yy, xx = np.ogrid[:y.shape[0], :y.shape[1]]
    win = (yy - py) ** 2 + (xx - px) ** 2 <= (sp['subject_sigma_frac'][1] * m) ** 2
    hi, lo = np.percentile(lum[win], [85, 15])
    return float(ratio(hi, lo)), win


def frame0(ctx):
    c, sp = ctx['clip'], SPEC['frame0']
    cid = 'eyes/frame0'
    if c.n < 2:
        return core.na(cid, 'hook', 'fewer than 2 frames')
    y0 = c.Y[0].astype(np.int16)
    mean, std = float(c.mean_y[0]), float(c.std_y[0])
    issues, notes = [], []
    if mean <= sp['black_mean_y'] and std <= sp['black_std_y']:
        issues.append(issue('fail', [0.0, 0.0], 'frame 0 is black (mean luma %.1f of 255)' % mean,
                            'start on a strong image already in motion: move the logo or fade to the end and cut the black (SKILL.md banned defaults: a black frame 0)',
                            'The first frame is black, so there is nothing to stop the scroll on.', 'black'))
    elif std <= sp['uniform_std_y']:
        issues.append(issue('fail', [0.0, 0.0], 'frame 0 is near-uniform (luma std %.1f)' % std,
                            'open on the hero image, not an empty colour field; frame 0 is also the poster some surfaces show',
                            'The first frame is an empty colour field.', 'uniform'))
    elif std <= sp['low_contrast_std_y']:
        issues.append(issue('warn', [0.0, 0.0], 'frame 0 is low contrast (luma std %.1f, under %d)' % (std, sp['low_contrast_std_y']),
                            'raise the hero against its backdrop (frame-design: the hero is the brightest or highest-contrast thing at frame 0)',
                            'The first frame is flat and grey; nothing in it pulls the eye.', 'lowcontrast'))
    sc, mask = subject_contrast(c.Y[0])
    if not issues:
        if sc < sp['subject_contrast_warn']:
            issues.append(issue('fail', [0.0, 0.0], 'no readable subject in frame 0: its strongest region has a %.2f:1 ratio against the rest (needs %.1f:1)' % (sc, sp['subject_contrast_pass']),
                                'make one hero clearly lighter or darker than its backdrop at frame 0 (a scrim or a lighter plate), then re-run',
                                'The first frame has no clear subject, so the eye has nowhere to land.', 'subject'))
        elif sc < sp['subject_contrast_pass']:
            issues.append(issue('warn', [0.0, 0.0], 'the subject of frame 0 reads at %.2f:1 against the rest (needs %.1f:1)' % (sc, sp['subject_contrast_pass']),
                                'push the hero away from its backdrop by 1.5x in luminance (grade, scrim, or a darker plate behind it)',
                                'The first frame is soft: the subject barely separates from the background.', 'subject'))
    first, first_s, lim = None, None, max(sp['first_change_s_max'] * 2, 1.0)
    for i in range(1, c.n):
        if c.t[i] > lim:
            break
        d = np.abs(c.Y[i].astype(np.int16) - y0)
        if float((d >= sp['change_pixel_delta']).mean()) >= sp['change_pixel_frac'] or float(d.mean()) >= sp['change_mean_delta']:
            first, first_s = i, float(c.t[i])
            break
    if first is None:
        issues.append(issue('fail', [0.0, round(lim, 2)], 'nothing visibly changes in the first %.1f s' % lim,
                            'start the first move on frames 1-6: a camera push, an element entering, a reveal (SKILL.md: the first visible change lands by frame 6)',
                            'The opening is a still image, so the clip looks like a freeze or a thumbnail.', 'motion'))
    elif first > sp['first_change_frame_max']:
        sev = 'warn' if first_s <= sp['first_change_s_max'] else 'fail'
        issues.append(issue(sev, [0.0, round(first_s, 2)], 'the first visible change is on frame %d (%.2f s); the rule is frame %d, and %.1f s at the latest' % (
            first, first_s, sp['first_change_frame_max'], sp['first_change_s_max']),
            'move the first motion onto frames 1-6 (trim the still lead-in, or start the move earlier in the shot)',
            'The opening holds still for a beat before anything moves.' if sev == 'warn' else 'The opening is a still image for over half a second.', 'motion'))
    p5, p95 = np.percentile(c.Y[0], [5, 95])
    m = {'mean_luma': round(mean, 1), 'std_luma': round(std, 1), 'p5_p95_luma': [int(p5), int(p95)], 'subject_contrast': round(sc, 2),
         'first_change_frame': first, 'first_change_s': None if first_s is None else round(first_s, 3)}
    return result(cid, 'hook', m, 'not black or flat, subject >= %.1f:1, first change by frame %d (<= %.1f s)' % (sp['subject_contrast_pass'], sp['first_change_frame_max'], sp['first_change_s_max']),
                  issues, notes)


# ------------------------------------------------------------------------------------------------ black, empty, frozen, stalls
def frames(ctx):
    c, sp, plan = ctx['clip'], SPEC['frames'], ctx.get('plan')
    cid = 'eyes/frames'
    if c.n < 2:
        return core.na(cid, 'continuity', 'fewer than 2 frames')
    holds, blacks = core.plan_holds(plan), core.plan_black(plan)
    issues, notes = [], []
    black = (c.mean_y <= sp['black_mean_y']) & (c.std_y <= sp['black_std_y'])
    empty = (c.std_y <= sp['empty_std_y']) & ~black
    still = np.concatenate([[False], (c.diff[1:] <= sp['frozen_diff']) & (c.diff_hi[1:] <= sp['frozen_hi_frac'])])
    rows = {'black': [], 'empty': [], 'frozen': [], 'stalls': []}
    for i0, i1 in idx_runs(black):
        t0, t1 = _t(c, i0), _t(c, i1)
        if i0 == 0 or i1 - i0 < sp['black_min_frames']:
            continue
        planned = core.inside(t0, t1, blacks, 0.15)
        rows['black'].append({'t': [round(t0, 2), round(t1, 2)], 'planned': planned})
        if planned:
            notes.append('black %.2f-%.2f s is planned (a dip in the plan)' % (t0, t1))
        elif i1 >= c.n:
            sev = 'fail' if t1 - t0 >= 1.0 else ('warn' if t1 - t0 >= sp['black_tail_warn_s'] else None)
            if sev:
                issues.append(issue(sev, [round(t0, 2), round(t1, 2)], 'the clip ends on %.2f s of black' % (t1 - t0),
                                    'trim the dead last frames (SKILL.md: trim a dead last 1-2 s) or hold the end card instead of fading out', 'The clip trails off into black.', 'black_tail'))
        else:
            issues.append(issue('fail', [round(t0, 2), round(t1, 2)], 'black frames at %.2f-%.2f s (%d frames) that the plan does not call a dip' % (t0, t1, i1 - i0),
                                'find the missing media or a bad cut at that time; if it is a dip to black, name it in plan.black or give the shot a dip transition',
                                'The picture drops out to black in the middle of the clip.', 'black'))
    for i0, i1 in idx_runs(empty):
        t0, t1 = _t(c, i0), _t(c, i1)
        if i0 == 0 or t1 - t0 < sp['empty_warn_s']:
            continue
        planned = core.inside(t0, t1, holds)
        rows['empty'].append({'t': [round(t0, 2), round(t1, 2)], 'planned': planned})
        if planned:
            notes.append('empty colour field %.2f-%.2f s is a planned hold' % (t0, t1))
        else:
            issues.append(issue('fail' if t1 - t0 >= sp['empty_fail_s'] else 'warn', [round(t0, 2), round(t1, 2)],
                                'an empty colour field for %.2f s at %.2f s (luma std under %d)' % (t1 - t0, t0, sp['empty_std_y']),
                                'something failed to render or load there: check the shot at that time (media path, a clip outside its data-start window)',
                                'The screen goes blank for a moment.', 'empty'))
    for i0, i1 in idx_runs(still):
        a = max(0, i0 - 1)
        t0, t1 = _t(c, a), _t(c, i1)
        dur = t1 - t0
        if a == 0 or dur < sp['frozen_warn_s']:
            continue
        if (black | empty)[a:i1].mean() > 0.8:
            continue                                                       # already reported as black or empty
        planned = core.inside(t0, t1, holds)
        tail_hold = (not plan) and i1 >= c.n and dur <= sp['endcard_hold_max_s']
        rows['frozen'].append({'t': [round(t0, 2), round(t1, 2)], 'planned': planned, 'end_card': tail_hold})
        if planned:
            notes.append('still picture %.2f-%.2f s is a planned hold' % (t0, t1))
        elif tail_hold:
            notes.append('the last %.2f s is a still picture: read as an end-card hold (up to %.1f s; give a plan to mark it)' % (dur, sp['endcard_hold_max_s']))
        else:
            issues.append(issue('fail' if dur >= sp['frozen_fail_s'] else 'warn', [round(t0, 2), round(t1, 2)],
                                'the picture is frozen for %.2f s at %.2f s (consecutive frames differ by under %.2f level)' % (dur, t0, sp['frozen_diff']),
                                'a render stall or a duplicated frame run: re-render that span; for an intended hold, mark it (plan.shots[].hold true, plan.holds, or audio.quiet kind hold)',
                                'The video stops dead for a moment, like a stall.', 'frozen'))
    if c.pk_ok and c.n > 2:
        gaps = np.diff(c.t)
        exp = 1.0 / c.fps
        for i in np.where((gaps > sp['stall_gap_frames'] * exp) & (gaps >= sp['stall_min_s']))[0]:
            rows['stalls'].append({'t': round(float(c.t[i]), 2), 'gap_s': round(float(gaps[i]), 3)})
            issues.append(issue('fail', [round(float(c.t[i]), 2), round(float(c.t[i + 1]), 2)], 'a playback stall: no frame for %.2f s after %.2f s (%.1f frame times)' % (gaps[i], c.t[i], gaps[i] / exp),
                                'the timestamps jump: re-mux with a constant frame rate (ffmpeg -vf fps=%g -fps_mode cfr) or re-render the span' % round(c.fps, 3), 'The video stutters and hangs there.', 'stall'))
    elif not c.pk_ok:
        notes.append('packet count differs from the decoded frame count: stalls are not checked')
    dup = float(still.mean())
    m = {'frames': c.n, 'duration_s': round(c.dur, 3), 'black_runs': rows['black'], 'empty_runs': rows['empty'], 'frozen_runs': rows['frozen'], 'stalls': rows['stalls'],
         'duplicate_frame_share': round(dup, 4)}
    return result(cid, 'continuity', m, 'no unplanned black, empty or frozen run over %.1f s, no stall, no black tail' % sp['frozen_warn_s'], issues, notes)


# ------------------------------------------------------------------------------------------------ flashes
def _events(a, b, area_min):
    """alternating transition events [(frame, sign)] from per-frame area shares (a = up, b = down): a frame whose changed area reaches area_min is one transition,
    consecutive same-direction transitions are one (a ramp counts once)"""
    ev = []
    for i in range(len(a)):
        if a[i] + b[i] >= area_min:
            s = 1 if a[i] >= b[i] else -1
            if not ev or ev[-1][1] != s:
                ev.append((i, s))
    return ev


def _per_second(ev, t, window):
    """the most flashes (opposing pairs) in any window of `window` s, and the [t0, t1] of every window that is over the limit later filtered by the caller"""
    times = [float(t[i]) for i, _ in ev]
    best, at = 0, None
    wins = []
    for a in range(len(times)):
        n = sum(1 for x in times[a:] if x < times[a] + window - 1e-9)
        fl = n // 2
        wins.append((times[a], times[a] + window, fl))
        if fl > best:
            best, at = fl, times[a]
    return best, at, wins


def flashes(ctx):
    c, sp = ctx['clip'], SPEC['flashes']
    cid = 'eyes/flashes'
    if c.n < 3:
        return core.na(cid, 'flashes', 'fewer than 3 frames')
    gen = _events(c.area_up, c.area_dn, sp['area_min'])
    red = _events(np.maximum(c.d_red, 0), np.maximum(-c.d_red, 0), sp['red_area_min'])
    issues, notes = [], []
    out = {}
    for name, ev, label in (('general', gen, 'general flash'), ('red', red, 'red flash')):
        best, at, wins = _per_second(ev, c.t, sp['window_s'])
        out[name] = {'max_per_s': best, 'at_s': None if at is None else round(at, 2), 'transitions': len(ev)}
        if best > sp['max_per_s']:
            bad = sorted((a, b) for a, b, fl in wins if fl > sp['max_per_s'])
            rs = []
            for a, b in bad:
                if rs and a <= rs[-1][1]:
                    rs[-1][1] = max(rs[-1][1], b)
                else:
                    rs.append([a, b])
            rs = [[round(a, 2), round(b, 2)] for a, b in rs]
            issues.append(issue('fail', rs[0], '%d %ss in one second at %s (WCAG 2.3.1 allows %d)' % (best, label, fmt_ranges(rs), sp['max_per_s']),
                                ('keep the flashing area under a quarter of the frame, or space the flash onsets at least %.2f s apart (at most %d a second); layers flash `peak: 0.7`, '
                                 'and fade a strobe over 4 or more frames' % (1.0 / sp['max_per_s'], sp['max_per_s'])) if name == 'general' else
                                ('swap the saturated red for a darker or less saturated red, or keep the red area under a quarter of the frame and at most %d changes a second' % sp['max_per_s']),
                                'A strobing flash that can be uncomfortable or unsafe for photosensitive viewers.', name))
        elif best == sp['max_per_s']:
            notes.append('%d %ss in one second at %.2f s: at the limit, no margin' % (best, label, at))
    peak = float(max(c.area_up.max(), c.area_dn.max())) if c.n else 0.0
    out['peak_changed_area'] = round(peak, 3)
    out['fps'] = round(c.fps, 3)
    return result(cid, 'flashes', out, 'at most %d general and %d red flashes in any %.0f s (WCAG 2.3.1; 10%% luminance change over 25%% of the frame)' % (sp['max_per_s'], sp['max_per_s'], sp['window_s']),
                  issues, notes)


# ------------------------------------------------------------------------------------------------ banding
def staircase(Y, plateau_px, step_max, min_steps):
    """the share of an (H, W) uint8 luma frame in banding staircases along its rows, and the mask: runs of identical values at least plateau_px wide, with a
    1..step_max level step to the next such run that a viewer can see (Weber contrast of the step in linear light, over its level plus a viewing flare, at least
    weber_min: one code value is 1.1% at luma 215 and 4.8% at luma 50), in a row that has at least min_steps of them"""
    H, W = Y.shape
    Yi = Y.astype(np.int16)
    start = np.ones((H, W), bool)
    start[:, 1:] = Yi[:, 1:] != Yi[:, :-1]
    st = np.flatnonzero(start.ravel())
    en = np.append(st[1:], H * W)
    ln = en - st
    val = Yi.ravel()[st]
    row = st // W
    dv = np.abs(val[1:] - val[:-1])
    lo, hi = np.minimum(val[1:], val[:-1]).clip(0, 255), np.maximum(val[1:], val[:-1]).clip(0, 255)
    weber = (core.LIN[hi] - core.LIN[lo]) / (core.LIN[lo] + SPEC['banding']['flare'])
    ok = (row[1:] == row[:-1]) & (dv >= 1) & (dv <= step_max) & (ln[:-1] >= plateau_px) & (ln[1:] >= plateau_px) & (weber >= SPEC['banding']['weber_min'])
    cnt = np.bincount(row[:-1][ok], minlength=H)
    ok &= cnt[row[:-1]] >= min_steps
    sel = np.zeros(len(st), bool)
    sel[:-1] |= ok
    sel[1:] |= ok
    flat = np.zeros(H * W + 1, np.int32)
    np.add.at(flat, st[sel], 1)
    np.add.at(flat, en[sel], -1)
    mask = (np.cumsum(flat)[:-1] > 0).reshape(H, W)
    return float(mask.mean()), mask


def banding_frame(Y, s):
    sp = SPEC['banding']
    pm = max(3, int(round(sp['plateau_min_px_1080'] * s)))
    f1, m1 = staircase(Y, pm, sp['step_max'], sp['min_steps_per_row'])
    f2, m2 = staircase(np.ascontiguousarray(Y.T), pm, sp['step_max'], sp['min_steps_per_row'])
    mask = m1 | m2.T
    return float(mask.mean()), mask


def sample_indices(c, cuts, n):
    """n frame indexes: the middle of each shot (subsampled to n), topped up with evenly spaced frames"""
    b = [0] + [x for x in cuts if 0 < x < c.n] + [c.n]
    mids = sorted({(b[k] + b[k + 1]) // 2 for k in range(len(b) - 1)})
    if len(mids) > n:
        mids = [mids[int(round(k))] for k in np.linspace(0, len(mids) - 1, n)]
    have = set(mids)
    k = 0
    while len(have) < min(n, c.n) and k < 4 * n:
        have.add(min(c.n - 1, int((k + 0.5) * c.n / n)))
        k += 1
    return sorted(have)[:max(n, len(mids))]


def banding(ctx):
    c, sp = ctx['clip'], SPEC['banding']
    cid = 'eyes/banding'
    if c.n < 1:
        return core.na(cid, 'banding', 'no frames')
    idxs = sample_indices(c, ctx['cuts'], sp['samples'])
    rows, issues = [], []
    for i, Y in core.iter_select(c.path, idxs, c.W, c.H, 'gray', 'extractplanes=y'):
        frac, mask = banding_frame(Y, c.s)
        box = None
        if frac > 0:
            ys, xs = np.where(mask.any(axis=1))[0], np.where(mask.any(axis=0))[0]
            box = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        rows.append({'frame': i, 't': round(float(c.t[i]), 2), 'banded_share': round(frac, 4), 'box': box})
    worst = max(rows, key=lambda r: r['banded_share']) if rows else None
    bad = [r for r in rows if r['banded_share'] >= sp['warn_frac']]
    if bad:
        fail = sum(1 for r in rows if r['banded_share'] >= sp['fail_frac']) >= max(1, sp['fail_samples_frac'] * len(rows))
        ts = ', '.join('%.2f s (%.0f%%)' % (r['t'], 100 * r['banded_share']) for r in bad[:5])
        issues.append(issue('fail' if fail else 'warn', [bad[0]['t'], bad[-1]['t']],
                            'banding on %d of %d sampled frames: %s of the frame sits in one-step luma staircases (worst %.0f%% at %.2f s, region %s)' % (
                                len(bad), len(rows), ts, 100 * worst['banded_share'], worst['t'], worst['box']),
                            'add grain over the gradient (layers/presets/stocks.js `upload-safe`, or `grain` 0.02 or more on meshGradient); or dither before the encode '
                            '(ffmpeg -vf "noise=alls=3:allf=t+u"); encode with a lower CRF (18 or less) and `-tune grain`; never bake a long smooth ramp at 8 bit without noise',
                            'A smooth gradient breaks into visible stripes (contour bands), especially on a phone in a dark room.', 'banding'))
    m = {'samples': len(rows), 'max_banded_share': 0.0 if not rows else worst['banded_share'], 'worst_t': None if not worst else worst['t'],
         'mean_banded_share': round(float(np.mean([r['banded_share'] for r in rows])), 4) if rows else 0.0, 'frames': rows}
    return result(cid, 'banding', m, 'banded share under %.0f%% of the frame (fail from %.0f%%)' % (100 * sp['warn_frac'], 100 * sp['fail_frac']), issues)
