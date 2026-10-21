#!/usr/bin/env python3
"""motion-pack / tools / playbook_checks.py: the lint check registry behind `mp lint`, and the lint itself.

    python3 tools/playbook_checks.py <plan.json | render.mp4> [--format id] [--json] [--playbook DIR] [--all-checks] [--no-measure]
    python3 tools/playbook_checks.py --list            # every check id, what it reads and its default params

A CHECK is a small pure function over what a film leaves behind: plan.json (the plan shape templates and `mp plan` write), the ears and eyes
reports of the render (<render>.ears.json / .eyes.json; run here when missing unless --no-measure) and the probed frame size. It returns
(raw verdict pass | warn | fail | na, measured value, fix hint). Checks WRAP what exists rather than re-measure it: tools/structure_check.py
(timeline, beat-sheet score), ears (loudness, true peak, quiet open and tail, sync, sections), eyes (frame 0, banding, safe zones,
readability), the plan lint of templates/_shared/plan.mjs (lint.proof, banned demo words), tools/check_names.py and tools/check_ids.py.

A RULE (playbook/rules/*.json) names a check in enforce.check and lends it params; its GRADE sets the severity of a failure:
house and measured-A FAIL, measured and craft WARN, inferred is INFO only. The rules evaluated are the format's (--format, or
plan.playbook.format), else every enforced rule; --all-checks adds every registered check no rule covers (at its default grade), and an
empty playbook falls back to that. Score: 100 x the grade-weighted share of passes (a WARN counts half; N/A and INFO are left out).
Exit 0 = no FAIL, 1 = at least one FAIL, 2 = usage or unreadable input."""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import playbook_lib as L  # noqa: E402
import structure_check as SC  # noqa: E402

PACK = L.PACK
ASPECT_SIZES = {'16:9': (1920, 1080), '9:16': (1080, 1920), '1:1': (1080, 1080), '4:5': (1080, 1350)}   # templates/_shared/project.mjs ASPECT_SIZES
END_LABELS = {'end', 'endcard', 'end_card', 'card', 'cta', 'outro', 'lockup', 'close'}


# ---------------------------------------------------------------- context

class Ctx:
    """what a check may read: plan (dict | None), tl (structure_check timeline | None), ears / eyes ({check id: check} | None), probe ({width,
    height, duration} | None), aspect, fm (format | None), plan_path; and for the extra checks shotlist (dict), design_path, captions_path,
    study (a refstudy study.json), page_dir (the composition's folder)"""
    def __init__(self, plan=None, ears=None, eyes=None, probe=None, aspect=None, fm=None, plan_path=None, shotlist=None, design_path=None, captions_path=None, study=None, page_dir=None):
        self.plan, self.ears, self.eyes, self.probe, self.fm, self.plan_path = plan, ears, eyes, probe, fm, plan_path
        self.shotlist, self.design_path, self.captions_path, self.study, self.page_dir = shotlist, design_path, captions_path, study, page_dir   # tools/playbook_checks_extra.py
        self.aspect = aspect or (plan or {}).get('aspect')
        self.tl = SC.timeline(plan) if plan else None
        self._honesty = None

    def em(self, kind, cid):
        """the measured block of an ears / eyes check, or None"""
        rep = self.ears if kind == 'ears' else self.eyes
        c = (rep or {}).get('%s/%s' % (kind, cid))
        return (c or {}).get('measured') if c else None

    def honesty(self):
        if self._honesty is None and self.plan_path:
            r = subprocess.run(['node', os.path.join(HERE, 'playbook_plan.mjs'), '--honesty', self.plan_path], capture_output=True, text=True)
            self._honesty = json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else {'error': (r.stderr or '').strip()[-200:]}
        return self._honesty


def _rng(v, lo, hi):
    return lo - 1e-6 <= v <= hi + 1e-6


def _quiet(ctx, kind=None, role=None):
    a = ((ctx.plan or {}).get('audio') or {}) if isinstance((ctx.plan or {}).get('audio'), dict) else {}
    out = []
    for q in a.get('quiet') or []:
        if not isinstance(q, dict) or not q.get('t'):
            continue
        if role and not (q.get('role') == role or (q.get('kind') == 'gap' and role in str(q.get('why', '')).lower())):
            continue
        if kind and q.get('kind') != kind:
            continue
        out.append(q)
    return out


def _texts(ctx):
    """plan texts without TODO markers (an unwritten slot is lint.honesty.todo's job, not a word count)"""
    return [t for t in (ctx.tl or {}).get('texts', []) if not L.TODO_RX.search(t['text'] or '')]


def _words(s):
    return SC._words(s or '')


def _seconds(ctx):
    if ctx.probe and ctx.probe.get('duration'):
        return float(ctx.probe['duration'])
    return float((ctx.tl or {}).get('T') or 0) or None


# ---------------------------------------------------------------- sound and music

def quiet_open(ctx, p):
    lo, hi = p['quiet_open_db']
    qs = (ctx.em('ears', 'structure') or {}).get('quiet_shape')
    if qs:
        v = qs['open_2s_vs_body_db'] if p['quiet_open_s'][1] >= 2 else qs['open_vs_body_db']
        val = 'first 2 s %+.1f dB, first 1 s %+.1f dB vs the body' % (qs['open_2s_vs_body_db'], qs['open_vs_body_db'])
        if _rng(v, lo, hi):
            return 'pass', val, ''
        if v < lo:
            return 'warn', val, 'the open is deeper than %d dB under the body: keep a word or room tone audible' % -lo
        return 'fail', val, 'open %d-%d dB under the body for %g-%g s (bring the bed in after the open; mark it plan.audio.quiet kind open)' % (-hi, -lo, p['quiet_open_s'][0], p['quiet_open_s'][1])
    if ctx.plan is None:
        return 'na', '', 'needs a plan or the ears report'
    q = [x for x in _quiet(ctx, 'open') if x['t'][0] <= 0.05]
    if not q:
        return 'fail', 'no planned quiet open', 'add plan.audio.quiet [{"t": [0, %g], "kind": "open", "db": %g}] and mix to it' % (p['quiet_open_s'][1], (lo + hi) / 2)
    d = q[0]['t'][1] - q[0]['t'][0]
    db = q[0].get('db')
    val = 'planned open %.2f s%s' % (d, '' if db is None else ' at %+g dB' % db)
    if not _rng(d, *p['quiet_open_s']) or (db is not None and not _rng(db, lo, hi)):
        return 'fail', val, 'the quiet open lasts %g-%g s at %d-%d dB under the body' % (p['quiet_open_s'][0], p['quiet_open_s'][1], -hi, -lo)
    return 'pass', val, ''


def bass_entry(ctx, p):
    if ctx.plan is None:
        return 'na', '', 'bass entry is read from the plan (ears has no low-band curve over time yet)'
    t, T = ((ctx.plan.get('audio') or {}).get('bass_entry_s')), _seconds(ctx)
    lo, hi = p['bass_entry_pct']
    if t is None or not T:
        return 'fail', 'no plan.audio.bass_entry_s', 'let the bass enter at %d-%d%% of the runtime (plan.audio.bass_entry_s), on a beat start' % (lo * 100, hi * 100)
    v = t / T
    return ('pass' if _rng(v, lo, hi) else 'fail'), 'bass enters %.2f s = %.0f%%' % (t, v * 100), '' if _rng(v, lo, hi) else 'move the bass entry to %.1f-%.1f s' % (lo * T, hi * T)


def name_silence(ctx, p):
    if ctx.plan is None:
        return 'na', '', 'the name window comes from the plan'
    q = _quiet(ctx, role='name')
    lo, hi = p['name_silence_s']
    if not q:
        return 'fail', 'no planned silence under the name', 'add plan.audio.quiet [{"t": [a, a + %g], "kind": "gap", "role": "name"}] where the name lands, and cut the bed there' % ((lo + hi) / 2)
    a, b = q[0]['t']
    val = 'planned %.2f s at %.2f s' % (b - a, a)
    if not _rng(b - a, lo, hi):
        return 'fail', val, 'the silence under the name lasts %g-%g s' % (lo, hi)
    at, T = p.get('at_pct'), _seconds(ctx)
    if at and T and not _rng(a / T, at[0] - 0.02, at[1] + 0.02):
        return 'fail', val + ' (%.0f%% of the runtime)' % (100 * a / T), 'land the name at %.0f-%.0f%% of the runtime' % (100 * at[0], 100 * at[1])
    rows = (ctx.em('ears', 'structure') or {}).get('quiet')
    if rows is not None:
        hit = [r for r in rows if min(b, r['t'][1]) - max(a, r['t'][0]) > 0]
        if not hit:
            return 'fail', val + '; the render is not quiet there', 'the mix keeps sound under the name: duck the bed and the SFX in %.2f-%.2f s' % (a, b)
        val += '; measured %.1f dB under the programme' % hit[0].get('under_programme_db', 0)
    return 'pass', val, ''


SHAPE_OK = {'quiet-hold': ('quiet hold', 'decay'), 'decay': ('decay', 'quiet hold'), 'sting': ('slam', 'sustained sub'), 'slam': ('slam', 'sustained sub'),
            'sonic-logo': ('slam', 'sustained sub', 'decay'), 'sustained-sub': ('sustained sub',)}


def tail(ctx, p):
    """the end shape: p.tail may list alternatives ('slam | decay'); quiet-hold / decay also pass on ears' quiet tail; tail_db_max caps the last 2 s"""
    wants = [w.strip() for w in str(p.get('tail', 'quiet-hold')).split('|') if w.strip()]
    known = [w for w in wants if w in SHAPE_OK]
    if not known:
        return 'na', 'end shape %s is judged by hand (or by lint.motion.loop_seam)' % ' | '.join(wants), ''
    cap = p.get('tail_db_max')
    qs = (ctx.em('ears', 'structure') or {}).get('quiet_shape')
    if qs:
        shape, t2 = qs.get('end_shape'), qs.get('tail_2s_vs_body_db', 0)
        val = 'end shape %s, last 2 s %+.1f dB vs the body' % (shape, t2)
        ok = any(shape in SHAPE_OK[w] or (w in ('quiet-hold', 'decay') and qs.get('quiet_tail')) for w in known)
        if ok and cap is not None and any(w in ('quiet-hold', 'decay') for w in known) and shape not in ('slam', 'sustained sub') and t2 > cap + 1e-6:
            return 'fail', val, 'the tail must fall at least %g dB under the body' % -cap
        return ('pass' if ok else 'fail'), val, '' if ok else 'end on a %s (plan.audio.quiet kind hold over the end card; the bed falls away)' % ' or '.join(known)
    if ctx.plan is None:
        return 'na', '', ''
    T = _seconds(ctx) or 0
    planned = (ctx.plan.get('audio') or {}).get('tail')
    if any(w in ('quiet-hold', 'decay') for w in known) and (any(q['t'][1] >= T - 0.05 for q in _quiet(ctx, 'hold')) or planned in known):
        return 'pass', 'planned %s' % (planned or 'hold'), ''
    ok = planned in known or (any(w in ('sting', 'slam', 'sonic-logo') for w in known) and any(c >= T - 2 for c in (ctx.tl or {}).get('cues', [])))
    return ('pass' if ok else 'fail'), 'tail %s' % planned, '' if ok else 'end on a %s' % ' or '.join(known)


def first_sound(ctx, p):
    sy = ctx.em('ears', 'sync')
    planned_open = bool([q for q in _quiet(ctx, 'open') if q['t'][0] <= 0.05]) or bool(((ctx.em('ears', 'structure') or {}).get('quiet_shape') or {}).get('quiet_open'))
    if sy and sy.get('first_audible_frame') is not None:
        f = sy['first_audible_frame']
        ok = f <= p['first_sound_frame_max'] or planned_open
        return ('pass' if ok else 'fail'), 'first sound on frame %d%s' % (f, ', quiet open' if planned_open else ''), '' if ok else 'a sound on frames 0-%d, or a planned quiet open' % p['first_sound_frame_max']
    if ctx.plan is None:
        return 'na', '', ''
    cues = (ctx.tl or {}).get('cues') or []
    ok = planned_open or (cues and cues[0] <= p['first_sound_frame_max'] / 30.0 + 1e-6)
    return ('pass' if ok else 'fail'), ('quiet open planned' if planned_open else 'first cue %.2f s' % cues[0] if cues else 'no cues'), '' if ok else 'put a cue on frames 0-%d or plan a quiet open' % p['first_sound_frame_max']


def first_hit(ctx, p):
    lo, hi = p['first_hit_s']
    sy = ctx.em('ears', 'sync')
    t = (sy or {}).get('hits', [None])[0] if sy and sy.get('hits') else ((ctx.plan or {}).get('audio') or {}).get('first_hit_s') if ctx.plan else None
    if t is None:
        return 'na', '', ''
    if t < lo - 1e-6:
        return 'fail', 'first hit %.2f s' % t, 'hold the first hit until %g s, after the quiet open' % lo
    return ('pass' if t <= hi + 1e-6 else 'warn'), 'first hit %.2f s' % t, '' if t <= hi + 1e-6 else 'the first hit comes late: land it by %g s' % hi


def loudness(ctx, p):
    m = ctx.em('ears', 'loudness')
    if not m:
        return 'na', '', 'measured on the render'
    v = m['integrated_lufs']
    ok = abs(v - p['lufs']) <= p['lufs_tol'] + 1e-6
    return ('pass' if ok else 'fail'), '%.2f LUFS-I' % v, '' if ok else 'master to %g LUFS-I +/- %g (tools/deliver.py, or the mix gain; the true-peak guard can cut a render)' % (p['lufs'], p['lufs_tol'])


def true_peak(ctx, p):
    m = ctx.em('ears', 'loudness')
    if not m:
        return 'na', '', 'measured on the render'
    v = m['true_peak_dbtp']
    ok = v <= p['true_peak_max_dbtp'] + 1e-6
    return ('pass' if ok else 'fail'), '%.2f dBTP' % v, '' if ok else 'limit to %g dBTP (oversampled limiter)' % p['true_peak_max_dbtp']


# ---------------------------------------------------------------- hook, type, pacing, end

def hook_frame0(ctx, p):
    c = (ctx.eyes or {}).get('eyes/frame0')
    if c:
        return {'pass': 'pass', 'warn': 'warn', 'fail': 'fail'}.get(c['status'], 'na'), 'eyes/frame0 %s' % c['status'], '; '.join(i.get('what', '') for i in c.get('issues', []))[:160]
    if not (ctx.tl and ctx.tl['shots']):
        return 'na', '', ''
    lab = ctx.tl['shots'][0]['label']
    bad = lab in SC.LOGO_LABELS
    return ('fail' if bad else 'pass'), 'frame 0 is "%s"' % lab, 'start on the stake, already moving; the logo goes to the end card' if bad else ''


def hook_text_by(ctx, p):
    tall = (ctx.aspect or '') in ('9:16', '4:5')
    by = p.get('text_by_s_tall' if tall else 'text_by_s_wide') or p['hook_text_by_s']   # a rule may set the deadline per aspect
    m = ctx.em('eyes', 'readability')
    t = (m or {}).get('hook_text_start_s')
    if t is None:
        tx = _texts(ctx)
        t = min((x['a'] for x in tx), default=None)
    if t is None:
        return 'na', 'no text', ''
    return ('pass' if t <= by + 1e-6 else 'fail'), 'first words at %.2f s' % t, '' if t <= by + 1e-6 else 'put the hook words on screen by %g s' % by


def hook_words(ctx, p):
    mx = p.get('beat_max_words') or p['hook_max_words']
    early = [t for t in _texts(ctx) if t['a'] <= p['hook_text_by_s'] + 1e-6]
    if not early:
        return 'na', 'no hook text', ''
    w = max(_words(t['text']) for t in early)
    return ('pass' if w <= mx else 'fail'), '%d words' % w, '' if w <= mx else 'cut the hook line to %d words' % mx


def words_per_line(ctx, p):
    mx, bad, n = p['max_words_per_line'], [], 0
    for t in _texts(ctx):
        for ln in re.split(r'\n|<br\s*/?>', t['text']):
            n += 1
            if _words(ln) > mx:
                bad.append('"%s" %d' % (ln.strip()[:28], _words(ln)))
    if not n:
        return 'na', 'no text', ''
    return ('pass' if not bad else 'fail'), '%d lines, %d over %d words' % (n, len(bad), mx) + (': ' + '; '.join(bad[:2]) if bad else ''), '' if not bad else 'break the line (\\n) or cut words'


def reading_time(ctx, p):
    m = ctx.em('eyes', 'readability')
    rows = []
    if m and m.get('texts'):
        rows = [(x.get('text', ''), x['on_screen_s'], x['needed_s']) for x in m['texts'] if x.get('on_screen_s') is not None and x.get('needed_s') is not None]
    else:
        rows = [(t['text'], t['b'] - t['a'], p['read_base_s'] + p['read_per_word_s'] * _words(t['text'])) for t in _texts(ctx)]
    if not rows:
        return 'na', 'no text', ''
    short = [r for r in rows if r[1] < r[2] - 1e-6]
    worst = min(rows, key=lambda r: r[1] - r[2])
    return ('pass' if not short else 'fail'), '%d of %d texts too short (worst "%s" %.2f s, needs %.2f s)' % (len(short), len(rows), worst[0][:24], worst[1], worst[2]), \
        '' if not short else 'hold each line %.2f s + %.2f s per word, or cut words' % (p['read_base_s'], p['read_per_word_s'])


def beat_words(ctx, p):
    if not ctx.fm:
        return 'na', 'no format', ''
    T, bad, n = _seconds(ctx) or 0, [], 0
    for b in ctx.fm.get('beats') or []:
        mx = (b.get('text') or {}).get('max_words')
        if mx is None or not T:
            continue
        a, z = b['at'][0] * T, b['at'][1] * T
        for t in _texts(ctx):
            if a - 1e-6 <= t['a'] < z:
                n += 1
                if _words(t['text']) > mx:
                    bad.append('%s %d>%d' % (b['id'], _words(t['text']), mx))
    if not n:
        return 'na', 'no text inside the beats', ''
    return ('pass' if not bad else 'fail'), '%d texts, over: %s' % (n, ', '.join(bad[:3]) or 'none'), '' if not bad else 'cut each beat line to its word limit'


def length(ctx, p):
    rng, T = p.get('length_s'), _seconds(ctx)
    if not rng or not T:
        return 'na', '', 'needs a format length'
    ok = _rng(T, rng[0] - 0.5, rng[1] + 0.5)
    return ('pass' if ok else 'fail'), '%.1f s (format %g-%g s)' % (T, rng[0], rng[1]), '' if ok else 'cut to %g-%g s' % tuple(rng)


def end_hold(ctx, p):
    need = p.get('min_hold_s') or (p['end_hold_s'][0] if isinstance(p['end_hold_s'], list) else p['end_hold_s'])   # min_hold_s: the rules' spelling
    fr = ctx.em('eyes', 'frames')
    held = [r['t'][1] - r['t'][0] for r in (fr or {}).get('frozen_runs', []) if r.get('end_card')]
    v = max(held) if held else None
    if v is None and ctx.tl and ctx.tl['shots']:
        last = ctx.tl['shots'][-1]
        holds = [q['t'][1] - q['t'][0] for q in _quiet(ctx, 'hold')]
        if last.get('hold') or last['label'] in END_LABELS or holds:
            v = max([last['end'] - last['start']] + holds)
    if v is None:
        return 'na', '', ''
    return ('pass' if v >= need - 1e-6 else 'fail'), 'end card holds %.2f s' % v, '' if v >= need - 1e-6 else 'hold the end card at least %g s' % need


def structure(ctx, p):
    if ctx.plan is None:
        return 'na', '', ''
    P = SC.load_patterns()
    try:
        pid, why = SC.pick_pattern(ctx.plan, P, p.get('pattern'))
    except KeyError:
        return 'na', 'unknown pattern', ''
    if pid is None:
        return 'na', why[:80], ''
    r = SC.score(ctx.plan, P, pid)
    ok = r['score'] >= r['pass_score']
    return ('pass' if ok else 'fail'), '%s %.0f/100 (pass %s)' % (pid, r['score'], r['pass_score']), '' if ok else '; '.join(r.get('fixes', [])[:2])[:200]


# ---------------------------------------------------------------- delivery, honesty, ids

def size(ctx, p):
    want = ASPECT_SIZES.get(ctx.aspect or '')
    if not want:
        return 'na', 'no aspect', ''
    got = (ctx.probe['width'], ctx.probe['height']) if ctx.probe and ctx.probe.get('width') else ((ctx.plan or {}).get('W'), (ctx.plan or {}).get('H'))
    if not got[0]:
        return 'na', '', ''
    ok = tuple(got) == want
    return ('pass' if ok else 'fail'), '%dx%d for %s' % (got[0], got[1], ctx.aspect), '' if ok else 'the build ignored the aspect: re-render at %dx%d' % want


def claims(ctx, p):
    h = ctx.honesty()
    if not h:
        return 'na', '', ''
    if 'error' in h:
        return 'fail', 'the honesty lint did not run', h['error']
    bad = h['claimsWithoutSource']
    return ('pass' if not bad else 'fail'), '%d claim(s) with a digit and no real source' % len(bad), '' if not bad else 'give "%s" a source that says where the number comes from' % bad[0][:40]


def todo(ctx, p):
    if ctx.plan is None:
        return 'na', '', ''
    paths = L.todo_paths({k: v for k, v in ctx.plan.items() if k != 'playbook'})
    return ('pass' if not paths else 'fail'), '%d TODO left' % len(paths) + (' (%s)' % ', '.join(paths[:3]) if paths else ''), '' if not paths else 'write every TODO (story-script for words, frame-design for the look)'


def banned_words(ctx, p):
    h = ctx.honesty()
    if not h or 'error' in h:
        return 'na', '', ''
    return ('pass' if not h['banned'] else 'fail'), ', '.join(h['banned']) or 'none', '' if not h['banned'] else 'say placeholder, demo data, render or example'


def names(ctx, p):
    if not ctx.plan_path:
        return 'na', '', ''
    d = tempfile.mkdtemp(prefix='mp-lint-names-')
    try:
        shutil.copy(ctx.plan_path, os.path.join(d, 'plan.json'))
        r = subprocess.run([sys.executable, os.path.join(HERE, 'check_names.py'), '--root', d, '--denylist', os.path.join(HERE, 'name_denylist.txt')], capture_output=True, text=True)
    finally:
        shutil.rmtree(d, ignore_errors=True)
    return ('pass' if r.returncode == 0 else 'fail'), 'clean' if r.returncode == 0 else 'a denylisted name', '' if r.returncode == 0 else 'say it as a tier and a measured number, never the account'


def ids(ctx, p):
    if not ctx.plan_path:
        return 'na', '', ''
    r = subprocess.run([sys.executable, os.path.join(HERE, 'check_ids.py'), ctx.plan_path], capture_output=True, text=True)
    m = re.search(r'unresolved: (\d+)', r.stdout or '')
    if not m:
        return 'fail', 'check_ids did not run', (r.stderr or '')[-160:]
    bad = [ln.split()[2] for ln in r.stdout.splitlines() if ln.startswith('UNRESOLVED')]
    return ('pass' if m.group(1) == '0' else 'fail'), '%s unresolved' % m.group(1) + (' (%s)' % ', '.join(bad[:3]) if bad else ''), '' if not bad else 'use registered ids (mp list, catalog)'


def wrap(kind, cid):
    def fn(ctx, p):
        c = ((ctx.ears if kind == 'ears' else ctx.eyes) or {}).get('%s/%s' % (kind, cid))
        if not c:
            return 'na', '', 'run %s on the render' % kind
        st = c.get('status')
        iss = '; '.join(i.get('what', '') for i in c.get('issues', []) if i.get('severity') in ('fail', 'warn'))[:180]
        fix = next((i.get('fix', '') for i in c.get('issues', []) if i.get('fix')), '')
        return {'pass': 'pass', 'warn': 'warn', 'fail': 'fail'}.get(st, 'na'), '%s/%s %s%s' % (kind, cid, st, (': ' + iss) if iss else ''), fix[:180]
    fn.__doc__ = 'wraps %s/%s: its status is the raw verdict' % (kind, cid)
    return fn


# ---------------------------------------------------------------- the registry

def C(fn, grade, params=None, doc=''):
    return {'fn': fn, 'grade': grade, 'params': params or {}, 'doc': doc or (fn.__doc__ or '').strip()}


CHECKS = {
    'lint.sound.quiet_open': C(quiet_open, 'craft', {'quiet_open_db': [-11, -7], 'quiet_open_s': [1, 2]}, 'the first 1-2 s sit quiet_open_db under the body (ears quiet_shape, or plan.audio.quiet kind open)'),
    'lint.sound.bass_entry': C(bass_entry, 'craft', {'bass_entry_pct': [0.2, 0.35]}, 'plan.audio.bass_entry_s at bass_entry_pct of the runtime'),
    'lint.sound.name_silence': C(name_silence, 'craft', {'name_silence_s': [1.0, 1.5]}, 'a planned silence under the name (plan.audio.quiet role name), measured quiet in the render'),
    'lint.sound.tail': C(tail, 'craft', {'tail': 'quiet-hold'}, 'the end shape: quiet-hold, sting / slam, decay (ears quiet_shape or plan.audio)'),
    'lint.sound.first_sound': C(first_sound, 'house', {'first_sound_frame_max': 3}, 'a sound on frames 0-3, or a planned quiet open (ears/sync, plan cues)'),
    'lint.sound.first_hit': C(first_hit, 'craft', {'first_hit_s': [1, 2]}, 'the first hit lands after the quiet open, inside first_hit_s'),
    'lint.master.loudness': C(loudness, 'house', {'lufs': -14, 'lufs_tol': 0.5}, 'integrated loudness of the delivered file (ears/loudness)'),
    'lint.master.true_peak': C(true_peak, 'house', {'true_peak_max_dbtp': -1.0}, 'true peak of the delivered file (ears/loudness)'),
    'lint.hook.frame0': C(hook_frame0, 'house', {}, 'frame 0 is not a logo, title card or black (eyes/frame0, or the first shot label)'),
    'lint.hook.text_by': C(hook_text_by, 'craft', {'hook_text_by_s': 2.0}, 'the first words are on screen by hook_text_by_s (eyes/readability, or plan texts)'),
    'lint.hook.words': C(hook_words, 'craft', {'hook_max_words': 7, 'hook_text_by_s': 2.0}, 'the hook line has at most hook_max_words (or the hook beat max_words)'),
    'lint.type.words_per_line': C(words_per_line, 'craft', {'max_words_per_line': 6}, 'every line of on-screen text has at most max_words_per_line words'),
    'lint.type.reading_time': C(reading_time, 'house', {'read_base_s': 0.35, 'read_per_word_s': 0.28}, 'each text stays read_base_s + read_per_word_s per word (eyes/readability rows, or plan texts)'),
    'lint.type.beat_words': C(beat_words, 'craft', {}, 'texts inside each format beat keep the beat text.max_words'),
    'lint.pacing.length': C(length, 'craft', {'length_s': None}, 'the runtime sits inside the format length_s'),
    'lint.end.hold': C(end_hold, 'craft', {'end_hold_s': [1.5, 6]}, 'the end card holds at least end_hold_s (eyes frozen end-card run, or the plan end beat)'),
    'lint.structure.score': C(structure, 'craft', {'pattern': None}, 'tools/structure_check.py beat-sheet score >= the pattern pass score'),
    'lint.delivery.size': C(size, 'house', {}, 'the frame size matches the aspect (ffprobe, or plan W x H)'),
    'lint.honesty.claims': C(claims, 'house', {}, 'every claim with a digit has a real source (templates/_shared/plan.mjs lint.proof)'),
    'lint.honesty.todo': C(todo, 'house', {}, 'no TODO marker left in the plan'),
    'lint.honesty.banned_words': C(banned_words, 'house', {}, 'no banned demo words (in development, planned, illustration)'),
    'lint.honesty.names': C(names, 'house', {}, 'no studied account or brand name (tools/check_names.py)'),
    'lint.ids.resolve': C(ids, 'house', {}, 'every pack id in the plan resolves (tools/check_ids.py)'),
}
for _k in ('loudness', 'clipping', 'tone', 'speech', 'sync', 'structure', 'repetition', 'stereo'):
    CHECKS['lint.ears.' + _k] = C(wrap('ears', _k), 'house', {}, 'wraps ears/%s' % _k)
for _k in ('frame0', 'frames', 'flashes', 'banding', 'safezones', 'readability', 'pacing', 'composition', 'encode'):
    CHECKS['lint.eyes.' + _k] = C(wrap('eyes', _k), 'house', {}, 'wraps eyes/%s' % _k)


def severity(raw, grade):
    if raw == 'pass':
        return 'PASS'
    if raw == 'na':
        return 'N/A'
    if grade == 'inferred':
        return 'INFO'
    if raw == 'fail' and grade in ('house', 'measured-A'):
        return 'FAIL'
    return 'WARN'


def run_check(cid, ctx, params):
    spec = CHECKS[cid]
    p = dict(spec['params'])
    p.update({k: v for k, v in (params or {}).items() if v is not None})
    try:
        return spec['fn'](ctx, p)
    except (KeyError, TypeError, ValueError, IndexError) as e:
        return 'fail', 'check error: %s' % e, 'fix the input the check reads'


SCORE = {'PASS': 1.0, 'WARN': 0.5, 'FAIL': 0.0}

import playbook_checks_extra  # noqa: E402,F401  (registers lint.shotlist.*, lint.mix.*, lint.motion.*, ... into CHECKS)
