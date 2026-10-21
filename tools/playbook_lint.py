#!/usr/bin/env python3
"""motion-pack / tools / playbook_lint.py: `mp lint`: which learnings a plan or a render kept, and which it broke.

    python3 tools/playbook_lint.py <plan.json | render.mp4> [--format id] [--json] [--playbook DIR] [--all-checks] [--no-measure]
    python3 tools/playbook_lint.py --list                # every check id, its default grade and params (tools/playbook_checks.py)

A render is read with its neighbours: <render>.plan.json, <render>.ears.json, <render>.eyes.json and <render>.probe.json (a cached
{width, height, duration}; else ffprobe, else the eyes report). An ears / eyes report is reused only when it was measured on this render
(keyed on the render's sha256 in <render>.reports.json, or newer than the render when it has no key); missing or stale reports are measured here (ears/listen.py, eyes/look.py,
through MP_RENDER_PREFIX when set) unless --no-measure. The table: rule, grade, verdict (PASS / WARN / FAIL / INFO / N/A), measured value,
fix hint, then a score and the rules the format applies that no check enforces (defaults, parts, prose-only gaps). The honesty floor
(lint.honesty.todo, .claims, .banned_words) runs on every lint, whatever the format names. Inputs the extra checks read (shotlist.json,
design.json, a caption track, <render>.study.json, the composition folder) are found next to the target or given as flags. A film that follows a style
(plan.style or plan.playbook.style, from mp plan --style) also runs the checks its signature features name (tools/playbook_checks_style.py: palette, type,
transitions, sound), and lists the features to look at by hand. Exit 1 on any FAIL."""
import argparse
import glob
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import playbook_lib as L  # noqa: E402
import playbook_checks as K  # noqa: E402


def _j(p):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _by_id(rep):
    return {c['id']: c for c in (rep or {}).get('checks', [])} if rep else None


def probe(mp4, eyes=None):
    base = mp4[:-4]
    pj = _j(base + '.probe.json')
    if pj and os.path.exists(mp4) and os.path.getmtime(base + '.probe.json') < os.path.getmtime(mp4):
        pj = None   # cached for an older render at this path
    if pj:
        return pj
    if os.path.exists(mp4):
        r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', mp4], capture_output=True, text=True)
        if r.returncode == 0:
            d = json.loads(r.stdout)
            s = (d.get('streams') or [{}])[0]
            return {'width': s.get('width'), 'height': s.get('height'), 'duration': float((d.get('format') or {}).get('duration') or 0)}
    if eyes:
        return {'width': eyes.get('width'), 'height': eyes.get('height'), 'duration': eyes.get('duration_s')}
    return None


def render_key(mp4):
    """what a saved ears / eyes report is keyed on: the render's sha256 (a re-render at the same path is a new key)"""
    import hashlib
    h = hashlib.sha256()
    with open(mp4, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def _stamp_path(mp4):
    return mp4[:-4] + '.reports.json'


def fresh_report(mp4, tool):
    """the saved <render>.<tool>.json when it was measured on THIS render, else None. A report is fresh when the stamp file (<render>.reports.json,
    written by measure()) holds the render's current sha256 for that tool; a report with no stamp entry is fresh only when it is newer than the render
    (mp check writes reports after the render). A stale report is never reused: mp lint used to read the eyes / ears of an older render at the same path."""
    rep = mp4[:-4] + '.%s.json' % tool
    if not os.path.exists(rep):
        return None
    if not os.path.exists(mp4):
        return _j(rep)   # measurements without the render (a copied report): nothing to compare against
    stamp = _j(_stamp_path(mp4)) or {}
    if tool in stamp:
        return _j(rep) if stamp[tool] == render_key(mp4) and os.path.getmtime(rep) >= os.path.getmtime(mp4) - 1e-6 else None
    return _j(rep) if os.path.getmtime(rep) >= os.path.getmtime(mp4) else None


def measure(mp4, tool, plan_path):
    """run ears or eyes on a render when its report is missing (the same call as mp check)"""
    script = {'ears': 'ears/listen.py', 'eyes': 'eyes/look.py'}[tool]
    base = mp4[:-4]
    pre = os.environ.get('MP_RENDER_PREFIX', '').split()
    cmd = pre + [sys.executable, os.path.join(L.PACK, script), mp4] + (['--plan', plan_path] if plan_path else []) + ['--json', base + '.%s.json' % tool, '--md', base + '.%s.md' % tool, '--quiet']
    subprocess.run(cmd, capture_output=True, text=True)
    rep = _j(base + '.%s.json' % tool)
    if rep is not None:   # key the report on the render it measured
        stamp = _j(_stamp_path(mp4)) or {}
        stamp[tool] = render_key(mp4)
        with open(_stamp_path(mp4), 'w', encoding='utf-8') as f:
            json.dump(stamp, f, indent=1)
    return rep


def load_target(path, do_measure=True):
    """-> (plan, plan_path, ears, eyes, probe, aspect)"""
    if path.endswith('.json'):
        plan = _j(path)
        if plan is None:
            raise ValueError('cannot read %s' % path)
        return plan, path, None, None, None, plan.get('aspect')
    if not path.endswith('.mp4'):
        raise ValueError('lint a plan.json or a render .mp4 (got %s)' % path)
    base = path[:-4]
    plan_path = base + '.plan.json' if os.path.exists(base + '.plan.json') else None
    plan = _j(plan_path) if plan_path else None
    ears, eyes = fresh_report(path, 'ears'), fresh_report(path, 'eyes')   # a report saved for an older render at this path is not reused
    if not os.path.exists(path) and not (ears or eyes or plan):
        raise ValueError('no render and no measurements at %s' % path)
    if do_measure and os.path.exists(path):
        ears = ears or measure(path, 'ears', plan_path)
        eyes = eyes or measure(path, 'eyes', plan_path)
    m = re.search(r'-(\d+)x(\d+)\.mp4$', path)
    aspect = '%s:%s' % m.groups() if m else (plan or {}).get('aspect')
    return plan, plan_path, ears, eyes, probe(path, eyes), aspect


def find_inputs(target, plan, shotlist=None, design=None, captions=None, page=None, study=None):
    """the files the extra checks read (tools/playbook_checks_extra.py), from flags or found next to the target: shotlist.json, design.json,
    captions/*.events.json (or a .vtt / .srt there), <render>.study.json, the project's build/templates/<template> -> Ctx keyword arguments"""
    d = os.path.dirname(os.path.abspath(target))
    dirs = [d, os.path.dirname(d)] if target.endswith('.mp4') else [d]
    first = lambda names: next((os.path.join(x, n) for x in dirs for n in names if os.path.exists(os.path.join(x, n))), None)
    sl = shotlist or first(['shotlist.json'])
    cap = captions
    if not cap:
        for x in dirs:
            hits = sorted(glob.glob(os.path.join(x, 'captions', '*.events.json'))) or sorted(glob.glob(os.path.join(x, 'captions', '*.vtt')) + glob.glob(os.path.join(x, 'captions', '*.srt')))
            if hits:
                cap = hits[0]
                break
    pg = page
    if not pg and target.endswith('.mp4') and (plan or {}).get('template'):
        c = os.path.join(os.path.dirname(d), 'build', 'templates', plan['template'])
        pg = c if os.path.isdir(c) else None
    st = study or (target[:-4] + '.study.json' if target.endswith('.mp4') and os.path.exists(target[:-4] + '.study.json') else None)
    pj = first(['project.json'])
    return {'shotlist': _j(sl) if sl else None, 'design_path': design or first(['design.json']), 'captions_path': cap, 'study': _j(st) if st else None, 'page_dir': pg,
            'project': _j(pj) if pj and target.endswith('.mp4') else None}


ALWAYS = ('lint.honesty.todo', 'lint.honesty.claims', 'lint.honesty.banned_words')


def lint(ctx, rules, fm=None, all_checks=False):
    """-> {format, rows: [{rule, title, grade, check, beat, verdict, raw, value, fix}], score, counts, unchecked}"""
    if fm:
        ids = L.format_rule_ids(fm)
        chosen = [rules[i] for i in ids if i in rules]
        missing = [i for i in ids if i not in rules]
    else:
        chosen, missing = [r for r in rules.values() if (r.get('enforce') or {}).get('check') and r.get('status') != 'candidate'], []
    rows, covered, unchecked = [], set(), []
    for r in chosen:
        cid = (r.get('enforce') or {}).get('check')
        if not cid:
            unchecked.append({'rule': r['id'], 'status': r.get('status'), 'grade': r.get('grade'), 'default': r['enforce'].get('default'), 'part': r['enforce'].get('part')})
            continue
        b = L.beat_of_rule(fm, r['id']) if fm else None
        if cid not in K.CHECKS:
            rows.append({'rule': r['id'], 'title': r.get('title', ''), 'grade': r['grade'], 'check': cid, 'beat': b and b['id'], 'raw': 'fail', 'verdict': 'FAIL', 'value': 'unknown check', 'fix': 'python3 tools/playbook_build.py names the registered checks'})
            continue
        covered.add(cid)
        raw, val, fix = K.run_check(cid, ctx, L.rule_params(r, fm, K.CHECKS[cid]['params']))
        rows.append({'rule': r['id'], 'title': r.get('title', ''), 'grade': r['grade'], 'check': cid, 'beat': b and b['id'], 'raw': raw, 'verdict': K.severity(raw, r['grade']), 'value': val, 'fix': fix})
    for cid in [c for c in ALWAYS if c not in covered] if not all_checks else []:   # the honesty floor runs on every lint, whatever the format names
        spec = K.CHECKS[cid]
        raw, val, fix = K.run_check(cid, ctx, spec['params'])
        rows.append({'rule': '(check) ' + cid, 'title': spec['doc'][:60], 'grade': spec['grade'], 'check': cid, 'beat': None, 'raw': raw, 'verdict': K.severity(raw, spec['grade']), 'value': val, 'fix': fix})
        covered.add(cid)
    if all_checks:
        for cid, spec in K.CHECKS.items():
            if cid in covered:
                continue
            p = dict(spec['params'])
            if fm:
                p.update({k: v for k, v in (fm.get('sound_shape') or {}).items() if k in p})
                p['length_s'] = fm.get('length_s') if 'length_s' in p else p.get('length_s')
            raw, val, fix = K.run_check(cid, ctx, p)
            rows.append({'rule': '(check) ' + cid, 'title': spec['doc'][:60], 'grade': spec['grade'], 'check': cid, 'beat': None, 'raw': raw, 'verdict': K.severity(raw, spec['grade']), 'value': val, 'fix': fix})
    style, review = None, []
    try:
        import playbook_checks_style as KS
        style = KS.style_of(ctx)
    except (OSError, ValueError):
        style = None
    if style:   # the style's signature features: the mechanical ones run at their check's grade, the rest are listed for a look by hand
        for sf in style.get('signature_features') or []:
            cid = sf.get('check')
            if cid == 'review' or cid not in K.CHECKS:
                review.append(sf.get('text', ''))
                continue
            if cid in covered:
                continue
            spec = K.CHECKS[cid]
            raw, val, fix = K.run_check(cid, ctx, spec['params'])
            rows.append({'rule': '(style %s) %s' % (style['id'], cid), 'title': sf.get('text', '')[:60], 'grade': spec['grade'], 'check': cid, 'beat': None, 'raw': raw, 'verdict': K.severity(raw, spec['grade']), 'value': val, 'fix': fix})
            covered.add(cid)
    num = den = 0.0
    for x in rows:
        w = L.GRADE_WEIGHT.get(x['grade'], 1)
        if x['verdict'] in K.SCORE and w:
            num += w * K.SCORE[x['verdict']]
            den += w
    counts = {v: sum(1 for x in rows if x['verdict'] == v) for v in ('PASS', 'WARN', 'FAIL', 'INFO', 'N/A')}
    return {'format': fm and fm.get('id'), 'rows': rows, 'score': round(100 * num / den, 1) if den else None, 'counts': counts, 'unchecked': unchecked, 'missing_rules': missing,
            **({'style': {'id': style['id'], 'review': review}} if style else {})}


def table(res):
    rows = res['rows']
    w = max([len(r['rule']) for r in rows] + [4])
    out = ['%-*s  %-10s  %-7s  %-46s  %s' % (w, 'rule', 'grade', 'verdict', 'value', 'fix')]
    hidden = [r for r in rows if r['verdict'] == 'N/A' and r['rule'].startswith('(check)')]
    for r in rows:
        if r in hidden:
            continue
        out.append('%-*s  %-10s  %-7s  %-46s  %s' % (w, r['rule'], r['grade'], r['verdict'], (r['value'] or '')[:46], r['fix'] if r['verdict'] not in ('PASS', 'N/A') else ''))
    c = res['counts']
    out.append('score %s/100  ·  %d PASS, %d WARN, %d FAIL, %d INFO, %d N/A%s' % (res['score'] if res['score'] is not None else '-', c['PASS'], c['WARN'], c['FAIL'], c['INFO'], c['N/A'],
                                                                                 '  ·  format %s' % res['format'] if res['format'] else ''))
    if hidden:
        out.append('n/a here (no input for them): ' + ', '.join(r['check'] for r in hidden))
    if res['unchecked']:
        by = {}
        for u in res['unchecked']:
            by.setdefault(u['status'], []).append(u['rule'])
        out.append('not checked here (look by hand): ' + ', '.join('%d %s' % (len(v), k) for k, v in sorted(by.items())) + ('  ·  mp rules --format %s lists them' % res['format'] if res['format'] else '') + '  (--json has every id)')
    if res.get('style'):
        out.append('style %s: %d signature feature(s) to look at by hand: %s' % (res['style']['id'], len(res['style']['review']), ' · '.join(res['style']['review'])) if res['style']['review'] else 'style %s: every signature feature is checked above' % res['style']['id'])
    if res['missing_rules']:
        out.append('the format names rules the playbook does not have: ' + ', '.join(res['missing_rules']))
    return '\n'.join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('target', nargs='?')
    ap.add_argument('--format')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--playbook')
    ap.add_argument('--all-checks', action='store_true')
    ap.add_argument('--no-measure', action='store_true')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--shotlist', help='shotlist.json (story-script); default: next to the target')
    ap.add_argument('--design', help='design.json (frame-design); default: next to the target')
    ap.add_argument('--captions', help='a caption track (.events.json, .vtt, .srt); default: captions/ next to the target')
    ap.add_argument('--page', help="the composition folder for lint.motion.seek; default: the project's build/templates/<template>")
    ap.add_argument('--study', help='a refstudy study.json; default: <render>.study.json')
    a = ap.parse_args(argv)
    if a.list:
        for cid, s in K.CHECKS.items():
            print('%-28s %-6s %-40s %s' % (cid, s['grade'], json.dumps(s['params'])[:40], s['doc']))
        return 0
    if not a.target:
        ap.print_help()
        return 2
    try:
        plan, plan_path, ears, eyes, pr, aspect = load_target(a.target, not a.no_measure)
    except ValueError as e:
        print('mp lint: %s' % e, file=sys.stderr)
        return 2
    pb = L.playbook_dir(a.playbook)
    formats, rules = L.load_formats(pb), L.rules_by_id(pb)
    fid = a.format or ((plan or {}).get('playbook') or {}).get('format')
    if fid and fid not in formats:
        print('mp lint: no format "%s" (formats: %s)' % (fid, ', '.join(formats) or 'none yet'), file=sys.stderr)
        return 2
    tpl = (plan or {}).get('template')
    by_tpl = [k for k, f in formats.items() if os.path.basename(f.get('template', '')) == tpl] if tpl else []
    if not fid and len(by_tpl) == 1:
        fid = by_tpl[0]                                                          # the one format built on this template
        print('mp lint: format %s (the one format on template %s; --format overrides)' % (fid, tpl), file=sys.stderr)
    fm = formats.get(fid) if fid else None
    if not fm and rules:                                                         # no format: the rules that apply to every format, or to a format on this template
        rules = {k: r for k, r in rules.items() if not (r.get('scope') or {}).get('formats') or set(r['scope']['formats']) & set(by_tpl)}
    ctx = K.Ctx(plan, _by_id(ears), _by_id(eyes), pr, aspect, fm, plan_path, playbook=pb, **find_inputs(a.target, plan, a.shotlist, a.design, a.captions, a.page, a.study))
    res = lint(ctx, rules, fm, a.all_checks or not rules)
    res['target'] = a.target
    if not rules:
        res['note'] = 'the playbook has no rules yet: every registered check ran at its default grade'
    print(json.dumps(res, indent=1) if a.json else table(res) + ('\n' + res['note'] if res.get('note') else ''))
    return 1 if res['counts']['FAIL'] else 0


if __name__ == '__main__':
    sys.exit(main())
