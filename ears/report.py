"""motion-pack / ears / report.py: per-category 1-10 scores (references/critic.md: 8 or more = passes), the ranked "what a listener would
notice" summary, and the Markdown report."""
from .core import SPEC

CATS = ['loudness', 'cleanliness', 'tone', 'speech', 'sync', 'structure', 'variety', 'stereo']
SEV = {'fail': 2, 'warn': 1}


def scores(checks):
    sp = SPEC['score']
    out = {}
    for cat in CATS:
        cs = [c for c in checks if c['category'] == cat]
        if not cs or all(c['status'] == 'n/a' for c in cs):
            out[cat] = None
            continue
        worst = {}                                   # one problem counts once, at its worst severity, however many lines it hits
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
    have = [out[c] for c in sp['critic_sound_sync'] if out.get(c) is not None]
    out['critic_sound_sync'] = min(have) if have else None
    return out


def top_issues(checks, n=3):
    w = SPEC['score']['listener_weight']
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
    return [{'check': cid, 'severity': i['severity'], 't': i.get('t'), 'listener': i['listener'], 'fix': i['fix']} for _, _, _, cid, i in pick]


def _ts(t):
    if not t:
        return 'whole mix'
    return '%.2f s' % t[0] if abs(t[1] - t[0]) < 1e-3 else '%.2f-%.2f s' % (t[0], t[1])


def _measured(c):
    m = c['measured'] or {}
    pick = {'ears/loudness': ['integrated_lufs', 'true_peak_dbtp', 'lra_lu', 'tail_peak_dbfs'],
            'ears/clipping': ['clipped_runs', 'intersample_over_samples', 'crest_factor_db', 'plr_lu'],
            'ears/tone': ['db_per_octave_vs_mid'],
            'ears/speech': ['source', 'speech_s', 'ducking_db_median', 'smr_db_median', 'words_per_min'],
            'ears/sync': ['tempo_bpm', 'tempo_confidence', 'first_audible_frame', 'cuts_on_onset', 'cuts_on_beat', 'cues_on_anchor'],
            'ears/structure': ['drop_s', 'drop_share', 'final_sting_s', 'breath'],
            'ears/repetition': ['onset_clusters', 'rhythm_elements'],
            'ears/stereo': ['correlation', 'mono_loss_db', 'width_db'],
            'ears/compare': []}.get(c['id'], [])
    parts = []
    for k in pick:
        v = m.get(k)
        if v is None:
            continue
        if k == 'tail_peak_dbfs' and v <= -150:
            v = 'digital zero'
        if isinstance(v, dict):
            v = ', '.join('%s %s' % (a, b) for a, b in v.items() if not isinstance(b, list))
        parts.append('%s %s' % (k.replace('_', ' '), v))
    return '; '.join(parts) or '-'


def markdown(rep):
    L = ['# Ears report: %s' % rep['input'], '',
         'Measured by `ears/listen.py` (motion-pack). It measures; it does not replace one human listen at phone size and on headphones.', '',
         '%.2f s, %s Hz, %s channel(s), %s fps%s.' % (rep['duration_s'], 48000, rep['channels'], rep['fps'], ', checked as a WAV master' if rep['is_master'] else ''), '',
         '## What a listener would notice', '']
    if rep['top_issues']:
        for k, i in enumerate(rep['top_issues'], 1):
            L.append('%d. **%s** (%s, %s, `%s`). Fix: %s' % (k, i['listener'], i['severity'], _ts(i['t']), i['check'], i['fix']))
    else:
        L.append('Nothing measurable stands out. Still listen once on a phone speaker and on headphones.')
    sc = rep['scores']
    L += ['', '## Sound scores (1-10; 8 or more passes, `references/critic.md`)', '', '| category | score |', '|---|---|']
    L += ['| %s | %s |' % (k, 'n/a' if sc.get(k) is None else sc[k]) for k in CATS]
    L += ['| **critic "Sound sync" row** (min of %s) | **%s** |' % (', '.join(SPEC['score']['critic_sound_sync']),
                                                                    'n/a' if sc.get('critic_sound_sync') is None else sc['critic_sound_sync']), '',
          '## Checks', '', '| check | status | measured | target |', '|---|---|---|---|']
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
    st = next((c for c in rep['checks'] if c['id'] == 'ears/structure'), None)
    if st and st['measured'].get('sections'):
        L += ['', '### Sections', '', '| from (s) | to (s) | RMS dBFS | label |', '|---|---|---|---|']
        L += ['| %.1f | %.1f | %.1f | %s |' % (s['t'][0], s['t'][1], s['level_dbfs'], s['label']) for s in st['measured']['sections']]
    L += ['', '### Mood', '', rep['mood']['text']]
    return '\n'.join(L) + '\n'
