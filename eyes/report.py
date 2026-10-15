"""motion-pack / eyes / report.py: per-category 1-10 scores (references/critic.md: 8 or more = passes), the ranked "what a viewer would notice" summary and the Markdown report."""
from .core import SPEC

CATS = ['hook', 'continuity', 'flashes', 'banding', 'safezones', 'readability', 'pacing', 'composition', 'encode']
SEV = {'fail': 2, 'warn': 1}


def scores(checks):
    sp = SPEC['score']
    out = {}
    for cat in CATS:
        cs = [c for c in checks if c['category'] == cat]
        if not cs or all(c['status'] == 'n/a' for c in cs):
            out[cat] = None
            continue
        worst = {}                                   # one problem counts once, at its worst severity, however many frames or lines it hits
        for c in cs:
            for k, i in enumerate(c['issues']):
                key = (c['id'], i.get('kind') or k)
                if SEV.get(i['severity'], 0) > SEV.get(worst.get(key), 0):
                    worst[key] = i['severity']
        fails, warns = sum(v == 'fail' for v in worst.values()), sum(v == 'warn' for v in worst.values())
        s = 10 - sp['fail_cost'] * fails - sp['warn_cost'] * warns
        if fails:
            s = min(s, sp['fail_cap'])
        out[cat] = max(1, s)
    for row, cats in sp['critic_rows'].items():
        have = [out[c] for c in cats if out.get(c) is not None]
        out['critic_' + row] = min(have) if have else None
    return out


def top_issues(checks, n=3):
    w = SPEC['score']['viewer_weight']
    flat = []
    for c in checks:
        for k, i in enumerate(c['issues']):              # each check lists its most important issue first
            t0 = i['t'][0] if i.get('t') else 1e9
            flat.append((SEV.get(i['severity'], 0) * w.get(c['category'], 0.5), k, t0, c['id'], i))
    flat.sort(key=lambda r: (-r[0], r[1], r[2]))
    first, seen = [], set()
    for r in flat:                                   # one issue per check first, so three different problems are named
        if r[3] not in seen:
            first.append(r); seen.add(r[3])
    pick = (first + [r for r in flat if r not in first])[:n]
    pick.sort(key=lambda r: (-r[0], r[1], r[2]))
    return [{'check': cid, 'severity': i['severity'], 't': i.get('t'), 'viewer': i['viewer'], 'fix': i['fix']} for _, _, _, cid, i in pick]


def _ts(t):
    if not t:
        return 'whole clip'
    return '%.2f s' % t[0] if abs(t[1] - t[0]) < 1e-3 else '%.2f-%.2f s' % (t[0], t[1])


def _measured(c):
    m = c['measured'] or {}
    pick = {'eyes/frame0': ['mean_luma', 'std_luma', 'subject_contrast', 'first_change_frame', 'first_change_s'],
            'eyes/frames': ['duplicate_frame_share'],
            'eyes/flashes': [],
            'eyes/banding': ['max_banded_share', 'worst_t', 'mean_banded_share'],
            'eyes/safezones': ['mode', 'platform', 'safe_rect'],
            'eyes/readability': ['hook_text_start_s', 'with_boxes'],
            'eyes/pacing': ['cuts_per_min', 'shots', 'shot_median_s', 'shot_mean_s', 'shot_longest_s', 'static_hold_longest_s', 'format'],
            'eyes/composition': ['aspect', 'size', 'competing_share', 'bar_area'],
            'eyes/encode': ['codec', 'pix_fmt', 'faststart', 'gop_max_s', 'bits_per_pixel', 'blockiness']}.get(c['id'], [])
    parts = []
    if c['id'] == 'eyes/frames':
        parts += ['%d black, %d empty, %d frozen run(s), %d stall(s)' % (len(m.get('black_runs', [])), len(m.get('empty_runs', [])), len(m.get('frozen_runs', [])), len(m.get('stalls', [])))]
    if c['id'] == 'eyes/flashes' and m:
        parts += ['general %s/s, red %s/s (limit %d)' % (m['general']['max_per_s'], m['red']['max_per_s'], SPEC['flashes']['max_per_s'])]
    if c['id'] == 'eyes/readability':
        rs = [r for r in m.get('texts', [])]
        cw = [r['contrast_worst'] for r in rs if 'contrast_worst' in r]
        parts += ['%d text(s)' % len(rs)] + (['worst contrast %.2f:1' % min(cw)] if cw else [])
    if c['id'] == 'eyes/safezones' and m:
        parts += ['%d block(s)' % len(m.get('blocks', []))]
    for k in pick:
        v = m.get(k)
        if v is None:
            continue
        parts.append('%s %s' % (k.replace('_', ' '), v))
    return '; '.join(parts) or '-'


def markdown(rep):
    L = ['# Eyes report: %s' % rep['input'], '',
         'Measured by `eyes/look.py` (motion-pack). It measures; it does not replace one human look at phone size.', '',
         '%.2f s, %dx%d, %.3g fps, platform %s%s.' % (rep['duration_s'], rep['width'], rep['height'], rep['fps'], rep['platform'], ', plan read' if rep['plan'] else ', no plan'), '',
         '## What a viewer would notice', '']
    if rep['top_issues']:
        for k, i in enumerate(rep['top_issues'], 1):
            L.append('%d. **%s** (%s, %s, `%s`). Fix: %s' % (k, i['viewer'], i['severity'], _ts(i['t']), i['check'], i['fix']))
    else:
        L.append('Nothing measurable stands out. Still look once at a 360 px wide still and on a phone.')
    sc = rep['scores']
    L += ['', '## Picture scores (1-10; 8 or more passes, `references/critic.md`)', '', '| category | score |', '|---|---|']
    L += ['| %s | %s |' % (k, 'n/a' if sc.get(k) is None else sc[k]) for k in CATS]
    for row, cats in SPEC['score']['critic_rows'].items():
        v = sc.get('critic_' + row)
        L.append('| **critic "%s" row** (min of %s) | **%s** |' % (row, ', '.join(cats), 'n/a' if v is None else v))
    L += ['', '## Checks', '', '| check | status | measured | target |', '|---|---|---|---|']
    for c in rep['checks']:
        L.append('| `%s` | %s | %s | %s |' % (c['id'], c['status'], _measured(c).replace('|', '/'), c['target'].replace('|', '/')))
    for c in rep['checks']:
        if not c['issues'] and not c['notes']:
            continue
        L += ['', '### %s (%s)' % (c['id'], c['status']), '']
        for i in c['issues']:
            L.append('- **%s** at %s: %s. Fix: %s' % (i['severity'], _ts(i['t']), i['what'], i['fix']))
        for n in c['notes']:
            L.append('- note: %s' % n)
    return '\n'.join(L) + '\n'
