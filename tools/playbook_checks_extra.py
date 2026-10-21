"""motion-pack / tools / playbook_checks_extra.py: the lint checks that read more than the plan and the render (registered into
tools/playbook_checks.CHECKS on import).

They WRAP the pack's existing gates, each on the file it judges, and return N/A when that file is not given or found (never a pass):
  lint.shotlist.*          skills/story-script/scripts/lint_shotlist.py on shotlist.json (its FAIL / WARN lines, by the rule each one names)
  lint.storyboard.label_hold   storyboard/checks.py label_runs on shotlist.json; without one, the plan's honesty-label texts
  lint.design.contrast     skills/frame-design/scripts/contrast.py on design.json
  lint.type.captions       tools/captions/validate.py on a caption track (captions/*.events.json, .vtt, .srt)
  lint.ears.ab_replay      the ears/ab_replay report (the before / after audio swap)
  lint.honesty.charts      templates/_explain/honesty.mjs datasetProblems on plan.datasets (the data-story gate)
  lint.honesty.quotes      templates/_shared/human/core.mjs quoteCheck on plan.quote against plan.transcript (the founder-story gate)
  lint.mix.cues            music/mixer.py lint_cues on the plan's cue sheet (tier spacing, over-bed ceiling, round robin, phone partners, first event)
  lint.mix.qa              music/grid.py snap_bpm: the bed's tempo lands on whole frames per beat (the plan's bpm, or its music id's)
  lint.sound.trailer_gap   a planned gap (plan.audio.quiet kind gap) of gap_s, measured under the programme by ears/structure
  lint.motion.loop_seam    ears/structure loop_seam level step, for a plan that declares a loop (plan.loop)
  lint.motion.seek         the no-clock scan of tools/tests/test_no_clock.py over the composition's own sources (Date.now, Math.random,
                           performance.now, new Date): the static half of seek safety; the page seek test is motion-stack's seekcheck.mjs
  lint.study.tier          a refstudy study.json's reach tier: a boosted-looking reference is never evidence
  lint.sound.master_limiter    the master's own report (<master>.wav.json): limiter, target loudness, WAV ceiling, AAC probes
  lint.sound.renderer_lowering the delivered loudness (ears) against the master's: a renderer that lowered the track fails
Inputs come from Ctx: shotlist (dict), design_path, captions_path, study (dict), page_dir; tools/playbook_lint.py finds them next to the plan or
the render (shotlist.json, design.json, captions/, <render>.study.json, the project's build/templates/<template>) or takes them as flags."""
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.abspath(os.path.join(HERE, '..'))
import playbook_checks as K  # noqa: E402

SHOTLIST_LINT = os.path.join(PACK, 'skills', 'story-script', 'scripts', 'lint_shotlist.py')
CONTRAST = os.path.join(PACK, 'skills', 'frame-design', 'scripts', 'contrast.py')
VALIDATE = os.path.join(PACK, 'tools', 'captions', 'validate.py')


# ---------------------------------------------------------------- shotlist (story-script's linter)

SHOT_RX = {
    'hook_variants': r'hook variants; write three|two hooks share an archetype|archetype "[^"]*" not in',
    'payoff_before_turn': r'payoff shot comes before the turn|no shot has role "payoff"',
    'poster_max_words': r'poster has \d+ words',
    'product_before_turn': r'the product appears at',
    'same_scale_run': r'shots in a row',
    'send_line': r'no send_line',
    'social_proof': r'social-proof needs a claim',
    'sound_off': r'no "sound_off" sentence',
    'transition_reason': r'has no reason',
    'turn_window': r'of the runtime; house window|no shot has role "turn"',
}


def _shot_lint(ctx, p):
    """run lint_shotlist.py once per params set on a copy of the shotlist with the rule's thresholds in its lint{} -> [(level, msg)]"""
    over = {}
    if p.get('poster_max_words') is not None:
        over['poster_max_words'] = p['poster_max_words']
    if p.get('same_scale_run_max') is not None:
        over['same_scale_run'] = p['same_scale_run_max']
    if p.get('turn_window_pct'):
        over['turn_window'] = [p['turn_window_pct'][0] / 100.0, p['turn_window_pct'][1] / 100.0]
    doc = dict(ctx.shotlist)
    doc['lint'] = dict(doc.get('lint') or {}, **over)
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(doc, f)
    try:
        r = subprocess.run([sys.executable, SHOTLIST_LINT, f.name], capture_output=True, text=True)
    finally:
        os.unlink(f.name)
    return [(ln[:4], ln[6:]) for ln in (r.stdout or '').splitlines() if ln.startswith(('FAIL  ', 'WARN  '))]


def shotlist_check(name):
    rx = re.compile(SHOT_RX[name])

    def fn(ctx, p):
        if not ctx.shotlist:
            return 'na', 'no shotlist.json', 'pass --shotlist (story-script writes it)'
        hits = [(lv, m) for lv, m in _shot_lint(ctx, p) if rx.search(m)]
        if not hits:
            return 'pass', 'lint_shotlist: clean', ''
        lv = 'fail' if any(h[0] == 'FAIL' for h in hits) else 'warn'
        return lv, 'lint_shotlist: ' + '; '.join(m for _, m in hits)[:120], 'fix it in shotlist.json (story-script), then re-plan'
    fn.__doc__ = 'wraps lint_shotlist.py (%s)' % name
    return fn


# ---------------------------------------------------------------- labels, design, captions

LABEL_RX = re.compile(r'placeholder|demo data|demo figures|example data|fictional|\brender\b|concept|ai voice|synthetic|screens recreated|in build|illustrative', re.I)


def label_hold(ctx, p):
    need = next((p[k] for k in ('label_min_on_screen_s', 'label_hold_s_min', 'label_min_s') if p.get(k) is not None), 2.0)
    if ctx.shotlist and ctx.shotlist.get('shots'):
        sys.path.insert(0, PACK)
        from storyboard import checks as SB
        per, short = SB.label_runs(ctx.shotlist['shots'], float(ctx.shotlist.get('fps') or 30), need)
        if not per:
            return 'na', 'no honesty label in the shotlist', ''
        return ('pass' if not short else 'fail'), '%d labelled shots, %d label run(s) under %g s' % (len(per), len(short), need), \
            '' if not short else 'hold "%s" at least %g s (storyboard label hold)' % (short[0]['label'], need)
    labels = [t for t in K._texts(ctx) if t.get('role') in ('label', 'honesty') or LABEL_RX.search(t['text'] or '')]
    if not labels:
        return 'na', 'no honesty label in the plan texts', ''
    short = [t for t in labels if t['b'] - t['a'] < need - 1e-6]
    return ('pass' if not short else 'fail'), '%d labels, %d under %g s' % (len(labels), len(short), need), '' if not short else 'hold "%s" at least %g s' % (short[0]['text'][:30], need)


def design_contrast(ctx, p):
    if not ctx.design_path:
        return 'na', 'no design.json', 'pass --design (frame-design writes it)'
    r = subprocess.run([sys.executable, CONTRAST, ctx.design_path, '--json'], capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
    except ValueError:
        return 'fail', 'contrast.py could not read it', (r.stdout or r.stderr).strip()[-160:]
    bad = [x for x in j.get('pairs', []) if not x.get('pass')]
    return ('pass' if j.get('pass') else 'fail'), '%d pairs, %d below WCAG' % (len(j.get('pairs', [])), len(bad)), \
        '' if j.get('pass') else 'use %s for %s on %s (contrast.py nearest passing colour)' % (bad[0].get('suggest'), bad[0]['fg'], bad[0]['bg']) if bad else 'see contrast.py'


def captions(ctx, p):
    if not ctx.captions_path:
        return 'na', 'no caption track', 'export one: python3 tools/captions/export.py --plan plan.json --out captions'
    args = [sys.executable, VALIDATE, ctx.captions_path, '--json'] + (['--audience', 'kids'] if p.get('audience') == 'kids' else [])
    r = subprocess.run(args, capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
    except ValueError:
        return 'fail', 'validate.py could not read the track', (r.stderr or '').strip()[-160:]
    iss = [i for i in j['issues'] if i['severity'] in ('fail', 'warn')]
    st = {'fail': 'fail', 'warn': 'warn'}.get(j['status'], 'pass')
    return st, '%d events, %s%s' % (j['events'], j['status'], (': ' + iss[0]['what']) if iss else ''), iss[0]['fix'] if iss else ''


# ---------------------------------------------------------------- honesty gates over the plan

def charts(ctx, p):
    h = ctx.honesty()
    if not h or 'error' in h or h.get('datasets') is None:
        return 'na', 'no datasets in the plan', ''
    return ('pass' if not h['datasets'] else 'fail'), '%d dataset problem(s)' % len(h['datasets']), h['datasets'][0] if h['datasets'] else ''


def quotes(ctx, p):
    h = ctx.honesty()
    if not h or 'error' in h or h.get('quote') is None:
        return 'na', 'no pull quote in the plan', ''
    q = h['quote']
    return ('pass' if q.get('ok') else 'fail'), 'verbatim run of the transcript' if q.get('ok') else q.get('why', 'not verbatim'), '' if q.get('ok') else 'quote the speaker\'s own words, verbatim'


# ---------------------------------------------------------------- mix

def mix_cues(ctx, p):
    if ctx.plan is None:
        return 'na', '', ''
    sys.path.insert(0, os.path.join(PACK, 'music'))
    import mixer
    lib = mixer.Library()
    fps = float(ctx.plan.get('fps') or 30)
    cues = []
    for c in ctx.plan.get('cues') or []:
        cid = str(c.get('id', ''))
        if not cid.startswith('sfx/') or c.get('t') is None:
            continue
        sid = 'snd.' + '.'.join(cid.split('/')[1:])
        e = lib.by_id.get(sid)
        cues.append({'id': sid, 'frame': int(round(float(c['t']) * fps)), 'tier': (e or {}).get('tier', 3), 'over_bed_db': c.get('overBedDb')})
    if not cues:
        return 'na', 'no SFX cues in the plan', ''
    a = ctx.plan.get('audio') if isinstance(ctx.plan.get('audio'), dict) else {}
    iss = mixer.lint_cues(cues, fps=fps, lib=lib, quiet=a.get('quiet'))
    return ('pass' if not iss else 'fail'), '%d cues, %d issue(s)%s' % (len(cues), len(iss), (': ' + iss[0]) if iss else ''), '' if not iss else 'music/mixer.py lint_cues: respace or swap the cues it names'


def mix_qa(ctx, p):
    if ctx.plan is None:
        return 'na', '', ''
    bpm = ctx.plan.get('bpm')
    mid = ctx.plan.get('music')
    if bpm is None and isinstance(mid, str) and mid.startswith('music/'):
        man = json.load(open(os.path.join(PACK, 'music', 'manifest.json'), encoding='utf-8'))['items']
        bpm = next((i.get('bpm') for i in man if i['id'] == 'music.' + mid[6:]), None)
    if not bpm:
        return 'na', 'no bed tempo', ''
    sys.path.insert(0, os.path.join(PACK, 'music'))
    import grid
    fps = float(ctx.plan.get('fps') or 30)
    snapped, n = grid.snap_bpm(float(bpm), fps)
    err = abs(snapped / float(bpm) - 1) * 100
    lo = p.get('min_frames_per_beat', 12)
    ok = err <= p.get('max_error_pct', 3) + 1e-9 and n >= lo
    return ('pass' if ok else 'fail'), '%g BPM -> %d frames a beat (%.2f%% off)' % (bpm, n, err), '' if ok else 'pick a bed whose tempo snaps within %g%% at %d+ frames a beat' % (p.get('max_error_pct', 3), lo)


def trailer_gap(ctx, p):
    gap = [q for q in K._quiet(ctx, 'gap') if q.get('role') != 'name']
    if ctx.plan is None or not gap:
        return 'na', 'no planned gap', ''
    lo, hi = p.get('gap_s', [1, 3])
    a, b = gap[-1]['t']
    if not K._rng(b - a, lo, hi):
        return 'fail', 'planned gap %.2f s' % (b - a), 'the silence lasts %g-%g s' % (lo, hi)
    rows = (ctx.em('ears', 'structure') or {}).get('quiet')
    if rows is None:
        return 'pass', 'planned gap %.2f s (not measured)' % (b - a), ''
    hit = [r for r in rows if min(b, r['t'][1]) - max(a, r['t'][0]) > 0]
    need = p.get('gap_under_wall_db_min', 30)
    if not hit or (hit[0].get('under_programme_db') or 0) < need - 1e-6:
        return 'fail', 'gap measures %s dB under' % (hit[0].get('under_programme_db') if hit else 'not quiet,'), 'drop the gap at least %g dB under the wall' % need
    return 'pass', 'gap %.2f s, %.0f dB under' % (b - a, hit[0]['under_programme_db']), ''


# ---------------------------------------------------------------- motion

def loop_seam(ctx, p):
    if not (ctx.plan or {}).get('loop'):
        return 'na', 'the plan declares no loop (plan.loop)', ''
    ls = (ctx.em('ears', 'structure') or {}).get('loop_seam')
    if not ls:
        return 'na', 'no ears loop seam measure', 'run ears on the render'
    mx = p.get('audio_seam_warn_db', 6)
    ok = ls['level_step_db'] <= mx + 1e-6
    return ('pass' if ok else 'fail'), 'seam level step %.1f dB' % ls['level_step_db'], '' if ok else 'match the last frames\' sound to the first (seam step <= %g dB)' % mx


def seek(ctx, p):
    if not ctx.page_dir or not os.path.isdir(ctx.page_dir):
        return 'na', 'no composition folder', 'pass --page <the template build folder>'
    sys.path.insert(0, os.path.join(PACK, 'tools', 'tests'))
    import test_no_clock as NC
    files = []
    for ext in ('*.js', '*.mjs', '*.html'):
        files += [f for f in glob.glob(os.path.join(ctx.page_dir, '**', ext), recursive=True)
                  if '/node_modules/' not in f and '/assets/mp/' not in f and '/out/' not in f and not f.endswith('.test.mjs') and not os.path.islink(f)]
    if not files:
        return 'na', 'no sources in the composition folder', ''
    bad = []
    for f in files:
        try:
            lines = NC._code(open(f, encoding='utf-8').read())
        except (OSError, UnicodeDecodeError):
            continue
        bad += ['%s:%d' % (os.path.relpath(f, ctx.page_dir), i + 1) for i, ln in enumerate(lines) if NC.BAN.search(ln)]
    return ('pass' if not bad else 'fail'), '%d files, %d clock / random call(s)%s' % (len(files), len(bad), (' (' + ', '.join(bad[:2]) + ')') if bad else ''), \
        '' if not bad else 'draw from t only: a seeded generator (mulberry32), no wall clock (then seekcheck.mjs on the page)'


def _master_report(ctx):
    """the master's own report (templates/_shared/audio.py writes <master>.wav.json): the newest under the composition folder, or None"""
    if not ctx.page_dir or not os.path.isdir(ctx.page_dir):
        return None, None
    hits = glob.glob(os.path.join(ctx.page_dir, '**', 'assets', 'media', '*.wav.json'), recursive=True) + glob.glob(os.path.join(ctx.page_dir, 'out', '*-mix.wav.json'))
    if not hits:
        return None, None
    f = max(hits, key=os.path.getmtime)
    try:
        return json.load(open(f, encoding='utf-8')), f
    except (OSError, ValueError):
        return None, f


def master_limiter(ctx, p):
    """rule sound.master_ends_in_tp_limiter: the master went through the true-peak limiter, landed on target and under the ceiling, and its AAC probes read under the guard"""
    rep, f = _master_report(ctx)
    if rep is None:
        return 'na', 'no master report (<master>.wav.json)', 'pass --page <the template build folder>'
    lim = rep.get('limiter', rep.get('via') == 'music/mixer.py')
    lufs, tp, tgt = rep.get('lufs_i'), rep.get('true_peak_dbtp'), rep.get('target_lufs', -14.0)
    worst = max([q.get('true_peak_db', -99) for q in rep.get('aac_probes') or []], default=None)
    bad = [] if lim else ['no limiter on the master']
    if lufs is None or abs(lufs - tgt) > p.get('lufs_tol', 0.5) + 1e-6:
        bad.append('%s LUFS-I, target %g' % (lufs, tgt))
    if tp is not None and tp > p.get('limiter_ceiling_dbtp', -1.5) + 0.05:
        bad.append('WAV %.2f dBTP' % tp)
    if worst is not None and worst > p.get('encoded_true_peak_max_dbtp', -1.0) + 1e-6:
        bad.append('AAC probe %.2f dBTP' % worst)
    val = '%s LUFS-I, %s dBTP WAV, AAC worst %s' % (lufs, tp, 'n/a' if worst is None else '%.2f' % worst)
    return ('pass' if not bad else 'fail'), val + ('' if not bad else ': ' + '; '.join(bad)), '' if not bad else 're-mix through templates/_shared/audio.py (music/mixer.py master_for_delivery: 4x-oversampled limiter, AAC-probed ceiling)'


def renderer_lowering(ctx, p):
    """rule sound.no_renderer_lowering: the delivered file is as loud as its master (no renderer guard or re-mix lowered it)"""
    rep, _ = _master_report(ctx)
    m = ctx.em('ears', 'loudness')
    if rep is None or not m or rep.get('lufs_i') is None:
        return 'na', 'needs the master report and the ears report', ''
    d = m['integrated_lufs'] - rep['lufs_i']
    tol = p.get('lowering_tol_db', 1.0)
    return ('pass' if d >= -tol - 1e-6 else 'fail'), 'delivered %.2f vs master %.2f LUFS-I (%+.1f dB)' % (m['integrated_lufs'], rep['lufs_i'], d), \
        '' if d >= -tol - 1e-6 else 'the renderer lowered the track: re-render with mp render (it remuxes the master), or node tools/mp-audio.mjs <build> <mp4>'


def study_tier(ctx, p):
    ev = (ctx.study or {}).get('evidence')
    if not ev:
        return 'na', 'no study', ''
    boosted = ev.get('boosted') or ev.get('tier') == 'B'
    return ('fail' if boosted else 'pass'), 'tier %s%s' % (ev.get('tier'), ', boosted-looking' if boosted else ''), \
        'a boosted-looking reference is not craft or reach evidence: study another' if boosted else ''


C = K.C
EXTRA = {'lint.shotlist.' + n: C(shotlist_check(n), 'craft', {}, 'story-script lint_shotlist.py on shotlist.json: %s' % n.replace('_', ' ')) for n in SHOT_RX}
EXTRA.update({
    'lint.storyboard.label_hold': C(label_hold, 'house', {'label_min_on_screen_s': 2.0}, 'every honesty label stays on screen >= 2 s in a row (storyboard label_runs on shotlist.json, or plan texts)'),
    'lint.design.contrast': C(design_contrast, 'house', {}, 'every palette pair of design.json passes WCAG (frame-design contrast.py)'),
    'lint.type.captions': C(captions, 'house', {}, 'the caption track passes tools/captions/validate.py (chars per line, lines, cps, durations)'),
    'lint.ears.ab_replay': C(K.wrap('ears', 'ab_replay'), 'house', {}, 'wraps ears/ab_replay (the before / after audio swap)'),
    'lint.honesty.charts': C(charts, 'house', {}, 'every dataset has a source and a different method (templates/_explain/honesty.mjs)'),
    'lint.honesty.quotes': C(quotes, 'house', {}, 'a pull quote is a verbatim run of the transcript (human/core.mjs quoteCheck)'),
    'lint.mix.cues': C(mix_cues, 'house', {}, 'the cue sheet passes music/mixer.py lint_cues'),
    'lint.mix.qa': C(mix_qa, 'house', {'max_error_pct': 3, 'min_frames_per_beat': 12}, 'the bed tempo snaps to whole frames a beat (music/grid.py snap_bpm)'),
    'lint.sound.trailer_gap': C(trailer_gap, 'craft', {'gap_s': [1, 3], 'gap_under_wall_db_min': 30}, 'a planned gap of gap_s, measured gap_under_wall_db_min under the programme'),
    'lint.motion.loop_seam': C(loop_seam, 'craft', {'audio_seam_warn_db': 6}, 'a declared loop has no level step at its seam (ears/structure loop_seam)'),
    'lint.motion.seek': C(seek, 'house', {}, 'no wall clock or unseeded random in the composition sources (the test_no_clock scan)'),
    'lint.study.tier': C(study_tier, 'house', {}, 'a reference study is not boosted-looking (refstudy evidence tier)'),
    'lint.sound.master_limiter': C(master_limiter, 'house', {'limiter_ceiling_dbtp': -1.5, 'encoded_true_peak_max_dbtp': -1.0, 'lufs_tol': 0.5}, 'the master report: limiter, -14 +/- 0.5 LUFS-I, <= -1.5 dBTP WAV, every AAC probe <= -1.0'),
    'lint.sound.renderer_lowering': C(renderer_lowering, 'house', {'lowering_tol_db': 1.0}, 'the delivered file is within 1 dB of its master (no renderer lowering)'),
})
K.CHECKS.update(EXTRA)
