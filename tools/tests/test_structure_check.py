"""tools/structure_check.py: a plan that follows its beat sheet scores high, a plan that breaks it scores low, and every check names the fix.
Also: patterns/*.json are well-formed (sections inside 0-100 and ordered, every number in range, every structure cites its evidence in
docs/research/launch-video-patterns.md, no brand names), and every shipped genre template either passes its pattern or is reported with a reason.
Run: python3 -m pytest -q tools/tests/test_structure_check.py"""
import copy
import json
import os
import subprocess
import sys

import pytest

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'tools'))
import structure_check as sc  # noqa: E402

P = sc.load_patterns()
PAT_DIR = os.path.join(REPO, 'patterns')
DOC = os.path.join(REPO, 'docs', 'research', 'launch-video-patterns.md')


def good_ad15():
    """a 15 s ad that follows ad-15: hook text on frame 0 with a punch, problem, a held reveal, proof, a 2.5 s end card"""
    shots, t = [], 0.0
    spec = [('hook', 1.25, 'Your desk, handled.'), ('hook', 1.25, ''), ('problem', 1.25, 'Five tabs.'), ('problem', 1.25, 'Five bills.'),
            ('product', 2.2, 'Orbit'), ('product', 1.8, 'It does the busywork.'), ('proof', 1.75, 'Works with your tools.'),
            ('proof', 1.75, 'Your files stay put.'), ('cta', 2.5, 'Try it on your desk')]
    for i, (sec, d, text) in enumerate(spec):
        s = {'id': '%s%d' % (sec, i), 'sec': sec, 'start': round(t, 4), 'dur': d, 'text': text, 'textDur': d}
        if i:
            s['tx'] = 'transitions/cut'
        if sec in ('product', 'cta') and text in ('Orbit', 'Try it on your desk'):
            s['hold'] = True
        shots.append(s)
        t += d
    return {'template': 'ad', 'fps': 30, 'seconds': 15, 'shots': shots, 'cues': [{'id': 'sfx/hit/punch', 't': 0}]}


def score(plan, pid='ad-15'):
    return sc.score(plan, P, pid)


# ---------------------------------------------------------------- the data files

def test_pattern_files_parse_and_are_consistent():
    for f in ('structures.json', 'hooks.json', 'ctas.json', 'lengths.json'):
        json.load(open(os.path.join(PAT_DIR, f), encoding='utf-8'))
    need = {'saas-launch', 'saas-feature-drop', 'explainer', 'hardware-reveal', 'teaser', 'trailer', 'title-sequence', 'tutorial', 'vlog',
            'podcast-clip', 'founder-story', 'short-film', 'ad-15', 'ad-30'}
    assert need <= set(P['structures']), need - set(P['structures'])
    for pid, s in P['structures'].items():
        assert s['sections'], pid
        prev = -1
        for x in s['sections']:
            assert 0 <= x['start'] < x['end'] <= 100, (pid, x['name'])
            assert x['start'] >= prev - 15, (pid, x['name'], 'sections out of order')
            prev = x['start']
            assert 0 <= x['music'] <= 1, (pid, x['name'])
            assert isinstance(x['sfx_role'], str) and x['sfx_role'], (pid, x['name'])
            assert x['text_wps_max'] > 0 and x['asl_s'][0] <= x['asl_s'][1], (pid, x['name'])
        assert s['sections'][0]['start'] == 0 and s['sections'][-1]['end'] == 100, pid
        assert s['length_s'][0] <= s['length_s'][1] and s['asl_s'][0] <= s['asl_s'][1], pid
        ev = s['evidence'].split('#', 1)[0]   # the evidence lives in docs/research (launch-video-patterns.md, or a lane's own research note such as explainer-data-patterns.md)
        assert ev.startswith('docs/research/') and ev.endswith('.md') and os.path.exists(os.path.join(REPO, ev)), (pid, s['evidence'])
        assert s['grade'] in P['grades'], (pid, s['grade'])
        if s.get('cta'):
            lo, hi = s['cta']['start_pct']
            assert 0 <= lo <= hi <= 100, pid


def test_template_map_points_at_real_patterns():
    for tpl, rules in P['template_map'].items():
        for r in rules if isinstance(rules, list) else [rules]:
            assert r.get('pattern') is None or r['pattern'] in P['structures'], (tpl, r)
            assert r.get('pattern') or r.get('why'), (tpl, 'an unscored template needs a reason')
            assert os.path.isdir(os.path.join(REPO, 'templates', tpl)), tpl


def test_hooks_have_original_lines_and_frame0_rules():
    H = json.load(open(os.path.join(PAT_DIR, 'hooks.json'), encoding='utf-8'))
    ids = {h['id'] for h in H['hooks']}
    # the seven archetypes the ad template and story-script already use must all be here
    assert {'payoff-first', 'pattern-break', 'claim-or-question', 'in-medias-res', 'curiosity-gap', 'social-proof', 'problem-agitate'} <= ids
    for h in H['hooks']:
        assert h['examples'] and all(len(e.split()) <= 12 for e in h['examples']), h['id']
        assert h['frame0'] and h['use_when'] and h['grade'] in H['grades'], h['id']
        if h['id'] == 'social-proof':
            assert 'source' in h['frame0'].lower() or 'source' in h.get('needs', '').lower()


def test_lengths_and_ctas_cite_sources():
    for f in ('lengths.json', 'ctas.json'):
        D = json.load(open(os.path.join(PAT_DIR, f), encoding='utf-8'))
        rows = D['platforms'] if 'platforms' in D else D['ctas']
        assert rows
        for k, v in (rows.items() if isinstance(rows, dict) else enumerate(rows)):
            assert v.get('source') and v.get('grade') in D['grades'], (f, k)
            assert v.get('accessed') == '2026-10-16' or v['grade'] in ('inference', 'house'), (f, k)


def test_evidence_doc_has_every_structure_section():
    for pid, s in P['structures'].items():
        doc = open(os.path.join(REPO, s['evidence'].split('#', 1)[0]), encoding='utf-8').read()
        anchor = s['evidence'].split('#', 1)[1] if '#' in s['evidence'] else None
        assert anchor and ('{#%s}' % anchor in doc or '<a id="%s">' % anchor in doc), (pid, s['evidence'])


def test_shipped_pattern_data_links_only_platform_pages():
    """vendor, studio and author sources are cited through docs/research (tools/check_names.py, a CI step, guards the names themselves);
    the only URLs in patterns/*.json are the help pages of the platforms the pack targets"""
    import re
    allowed = ('support.google.com', 'business.google.com', 'ads.tiktok.com', 'www.facebook.com/business', 'www.linkedin.com/help', 'help.x.com')
    for f in os.listdir(PAT_DIR):
        if f.endswith('.json'):
            for url in re.findall(r'https?://[^\s"]+', open(os.path.join(PAT_DIR, f), encoding='utf-8').read()):
                assert any(url.split('://', 1)[1].startswith(a) for a in allowed), (f, url)


# ---------------------------------------------------------------- scoring

def test_good_plan_scores_high_with_no_fixes_of_substance():
    r = score(good_ad15())
    assert r['score'] >= 90, (r['score'], r['fixes'])
    assert all(v >= 0.9 for v in r['parts'].values()), r['parts']


def test_bad_plan_scores_low_and_names_each_fix():
    """mutation-style: one broken plan breaks every check at once"""
    bad = good_ad15()
    for s in bad['shots']:
        s['dur'] = 5.0          # three 5 s shots: ASL 5 s against 0.8-2.0
    bad['shots'] = [
        {'id': 'logo', 'kind': 'logo', 'start': 0, 'dur': 3, 'text': '', 'tx': ''},                                     # logo bumper, no hook text
        {'id': 'product', 'sec': 'product', 'start': 3, 'dur': 9, 'text': 'Orbit runs every errand on your desk while you sleep and keeps every file', 'textDur': 1.0},
        {'id': 'cta', 'sec': 'cta', 'start': 12, 'dur': 0.8, 'text': 'Buy', 'textDur': 0.8},                          # CTA too early and 0.8 s long
        {'id': 'tail', 'sec': 'tail', 'start': 12.8, 'dur': 2.2, 'text': ''},
    ]
    bad['cues'] = [{'id': 'sfx/hit/punch', 't': 3.0}]
    r = score(bad)
    assert r['score'] < 45, r['score']
    joined = ' '.join(r['fixes'])
    for word in ('frame 0 opens on a logo', 'no hook text', 'first sound', 'no "problem" section', 'shots in', 'words/s', 'end card holds'):
        assert word in joined, (word, r['fixes'])


@pytest.mark.parametrize('mutate,part', [
    (lambda p: p['shots'].insert(0, p['shots'][0] | {'id': 'logo', 'kind': 'logo', 'text': '', 'sec': 'logo'}), 'hook'),
    (lambda p: p.__setitem__('cues', []), 'hook'),
    (lambda p: [s.__setitem__('textDur', 0.3) for s in p['shots'] if s['text']], 'text'),
    (lambda p: [s.__setitem__('sec', 'body') for s in p['shots'] if s['sec'] in ('problem', 'proof')], 'timing'),
    (lambda p: p['shots'].__setitem__(slice(None), [p['shots'][0] | {'dur': 12.5, 'textDur': 1.25}, p['shots'][-1] | {'start': 12.5}]), 'pace'),
    (lambda p: p['shots'][-1].__setitem__('dur', 1.0), 'cta'),
])
def test_each_single_mutation_lowers_its_own_check(mutate, part):
    base = score(good_ad15())
    p = good_ad15()
    mutate(p)
    r = score(p)
    assert r['parts'][part] < base['parts'][part] - 0.1, (part, base['parts'][part], r['parts'][part], r['fixes'])
    assert r['score'] < base['score'], (part, r['score'])
    assert r['fixes'], part


def test_quiet_open_satisfies_the_sound_rule():
    p = good_ad15()
    p['cues'] = [{'id': 'sfx/ui/pop', 't': 1.2}]
    assert score(p)['parts']['hook'] < 1
    p['audio'] = {'quiet': [{'t': [0, 1.2], 'kind': 'open', 'why': 'sound enters on the first visual event'}]}
    assert score(p)['parts']['hook'] == 1


def test_continuous_film_is_paced_by_motion_events_not_shots():
    p = {'template': 'x', 'fps': 30, 'seconds': 30, 'audio': {'mode': 'continuous', 'events': [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28]},
         'shots': [{'id': 'claim', 'start': 0, 'dur': 30, 'move': 'cam2d.push2d'}], 'cues': [{'t': 0}]}
    r = sc.score(p, P, 'saas-feature-drop')
    assert r['continuous'] and r['detail']['pace']['mode'] == 'continuous' and r['parts']['pace'] == 1
    p['audio']['events'] = [0, 1]          # 29 s with nothing new
    r = sc.score(p, P, 'saas-feature-drop')
    assert r['parts']['pace'] < 1 and any('no motion event' in f for f in r['fixes'])


def test_explicit_structure_sections_win():
    p = good_ad15()
    p['structure'] = {'pattern': 'ad-15', 'sections': [{'name': 'hook', 't': [0, 2.5]}, {'name': 'problem', 't': [2.5, 5]}, {'name': 'product', 't': [5, 9]},
                                                       {'name': 'proof', 't': [9, 12.5]}, {'name': 'cta', 't': [12.5, 15]}]}
    for s in p['shots']:
        s['sec'] = 'x'
    pid, why = sc.pick_pattern(p, P)
    assert pid == 'ad-15' and why == 'plan.structure.pattern'
    assert score(p)['parts']['timing'] >= 0.9


def test_cli_exit_codes(tmp_path):
    good = tmp_path / 'good.json'
    good.write_text(json.dumps(good_ad15()))
    bad = tmp_path / 'bad.json'
    b = good_ad15()
    b['shots'] = [b['shots'][0] | {'kind': 'logo', 'dur': 15, 'text': ''}]
    bad.write_text(json.dumps(b))
    run = lambda *a: subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'structure_check.py'), *a], capture_output=True, text=True)
    assert run(str(good)).returncode == 0
    r = run(str(bad))
    assert r.returncode == 1 and 'fix:' in r.stdout
    assert run(str(good), '--pattern', 'no-such').returncode == 2
    assert run(str(tmp_path / 'missing.json')).returncode == 2
    assert run('--list').returncode == 0
    j = json.loads(run(str(good), '--json').stdout)
    assert j['pattern'] == 'ad-15' and j['score'] >= 90


def test_every_genre_template_passes_or_is_reported_with_a_reason():
    rows, code = sc.run_all(P)
    seen = set()
    for f, r, why in rows:
        tpl = f.split(os.sep)[1]
        seen.add(tpl)
        if r is None:
            assert why, f
            continue
        assert r['score'] >= r['pass_score'], (f, r['pattern'], r['score'], r['fixes'])
    assert code == 0
    genre = {d for d in os.listdir(os.path.join(REPO, 'templates')) if not d.startswith(('demo-', '_')) and os.path.isdir(os.path.join(REPO, 'templates', d))
             and os.path.exists(os.path.join(REPO, 'templates', d, 'config.mjs'))}
    assert genre <= set(P['template_map']), 'genre templates with no template_map entry: %s' % (genre - set(P['template_map']))


def test_a_long_quiet_open_does_not_excuse_a_silent_start():
    p = good_ad15()
    p['cues'] = [{'id': 'sfx/ui/pop', 't': 3.0}]
    p['audio'] = {'quiet': [{'t': [0, 3.0], 'kind': 'open', 'why': 'too long: a quiet open is at most 2 s'}]}
    assert score(p)['parts']['hook'] < 1


def test_characters_per_second_ceiling_bites_on_its_own():
    p = good_ad15()
    s = p['shots'][6]
    s['text'] = 'Unbelievably extraordinary transformations'      # 3 words in 1.75 s is under 3 w/s, but 42 chars is 24 cps
    r = score(p)
    assert r['parts']['text'] < 1 and any('chars/s' in f and 'Unbelievably' in f for f in r['fixes'])


def test_sections_out_of_order_are_penalised():
    p = good_ad15()
    for s in p['shots']:          # swap the problem and proof beats: proof first, problem late
        s['sec'] = {'problem': 'proof', 'proof': 'problem'}.get(s['sec'], s['sec'])
    r = score(p)
    assert r['parts']['timing'] < score(good_ad15())['parts']['timing'] and any('reorder' in f for f in r['fixes'])


def test_section_labels_from_shot_ids():
    assert sc._label({'id': 'problem0'}) == 'problem'
    assert sc._label({'id': 'chapter-b'}) == 'chapter'
    assert sc._label({'id': 'hook_1'}) == 'hook'
    assert sc._label({'id': 'h2h'}) == 'h2h'
    assert sc._label({'id': 'x', 'sec': 'Proof'}) == 'proof'


def test_text_floor_bites_on_its_own():
    p = good_ad15()
    p['shots'][6]['text'], p['shots'][6]['textDur'] = 'Go now', 0.7      # 2.9 w/s and 9 cps pass; 0.7 s is under the 0.83 s floor
    r = score(p)
    assert r['parts']['text'] < 1 and any('"Go now"' in f for f in r['fixes'])


def test_order_penalty_inside_the_tolerance():
    """founder-story lets problem (25-40%) and demo (35-82%) overlap; a demo that starts before the problem is out of order even when both are in tolerance"""
    base = {'template': 'x', 'fps': 30, 'seconds': 100, 'cues': [{'t': 0}]}
    order = [('hook', 0, 8), ('why', 8, 30), ('problem', 30, 36), ('demo', 36, 82), ('ask', 88, 100)]
    swap = [('hook', 0, 8), ('why', 8, 30), ('demo', 30, 82), ('problem', 33, 38), ('ask', 88, 100)]
    def plan(rows):
        return dict(base, structure={'sections': [{'name': n, 't': [a, b]} for n, a, b in rows]},
                    shots=[{'id': n, 'start': a, 'dur': b - a} for n, a, b in rows])
    good, bad = sc.score(plan(order), P, 'founder-story'), sc.score(plan(swap), P, 'founder-story')
    assert bad['parts']['timing'] < good['parts']['timing'] and any('reorder' in f for f in bad['fixes'])


def test_cutdowns_name_real_sections_in_pattern_order():
    for pid, s in P['structures'].items():
        names = [x['name'] for x in s['sections']]
        for secs, keep in (s.get('cutdowns') or {}).items():
            assert float(secs) < s['length_s'][1], (pid, secs)
            assert all(k in names for k in keep), (pid, secs, keep)
            assert [names.index(k) for k in keep] == sorted(names.index(k) for k in keep), (pid, secs, 'out of order')
            req = {x['name'] for x in s['sections'] if x['name'] == (s.get('cta') or {}).get('section')}
            assert req <= set(keep), (pid, secs, 'a cut-down keeps the CTA section')
