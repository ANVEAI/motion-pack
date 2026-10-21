#!/usr/bin/env python3
"""The STYLE layer (playbook/styles, v0.6): every style validates and its parts resolve, `mp plan <format> --style` lays it over a format so the
template really builds with it, `mp lint` runs the style checks and each one fails when the film breaks it, and `mp styles` prints the prompt.
Run: python3 -m pytest -q tools/tests/test_styles.py"""
import json
import os
import subprocess
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(PACK, 'tools'))
import playbook_lib as L  # noqa: E402
import playbook_build as B  # noqa: E402
import playbook_checks as K  # noqa: E402
import playbook_checks_style as KS  # noqa: E402

PB = L.playbook_dir(None)
STYLES = L.load_styles(PB)
MP = os.path.join(PACK, 'tools', 'mp.mjs')


def mp(*args, cwd=None):
    return subprocess.run(['node', MP] + list(args), capture_output=True, text=True, cwd=cwd)


def test_ten_styles_validate_with_measured_palettes():
    assert len(STYLES) >= 10, sorted(STYLES)
    probs, styles, measured = B.validate_styles(PB, L.load_formats(PB))
    assert not probs, probs[:5]
    for f, got in measured.items():
        st = json.load(open(f, encoding='utf-8'))
        assert st['palette']['contrast'] == got, (f, got)   # the file holds what contrast.py measures
        assert 150 <= len(st['prompt']) <= 250 and st['id'] == os.path.basename(f)[:-5]


def test_every_style_part_resolves_and_recipes_list_them():
    for sid, st in STYLES.items():
        used, named = L.style_parts(st)
        assert all(B.part_ok(p) for p in used + named), (sid, [p for p in used + named if not B.part_ok(p)])
        assert set(used) <= set(st['recipes']), (sid, set(used) - set(st['recipes']))


def test_a_style_with_a_failing_palette_or_unknown_part_is_a_problem(tmp_path):
    pb = tmp_path / 'pb'
    for d in ('styles', 'formats'):
        os.makedirs(pb / d)
    st = json.load(open(STYLES['blueprint']['_file'], encoding='utf-8'))
    st['palette']['ink'] = '#1A3A6A'                       # dark ink on drafting blue: fails 4.5:1
    st['transitions']['by_reason']['ENERGY'] = 'transitions/noSuchTransition'
    st['type']['presets']['headline'] = 'type/blurIn'      # a line-unit preset: the accent word would lose its colour
    json.dump(st, open(pb / 'styles' / 'blueprint.json', 'w'))
    probs, _, _ = B.validate_styles(str(pb), L.load_formats(PB))
    assert any('contrast.py' in p for p in probs) and any('noSuchTransition' in p for p in probs) and any('splits by line' in p for p in probs), probs


def _plan(tmp_path, sid, fmt='ad', length='10'):
    r = mp('plan', fmt, '--style', sid, '--length', length, '--aspect', '16:9', '--out', str(tmp_path / 'plan.json'), '--project-out', str(tmp_path / 'project.json'))
    assert r.returncode == 0, r.stdout + r.stderr
    return json.load(open(tmp_path / 'plan.json')), json.load(open(tmp_path / 'project.json'))


@pytest.mark.parametrize('sid', sorted(STYLES))
def test_mp_plan_style_reaches_the_template_build(tmp_path, sid):
    st = STYLES[sid]
    plan, proj = _plan(tmp_path, sid)
    assert plan['style']['id'] == sid and plan['playbook']['style'] == sid and proj['playbook']['style'] == sid
    assert {k: proj['brand'][k] for k in ('paper', 'ink', 'accent', 'muted')} == L.style_palette(st)
    assert proj['brand']['fonts']['display'] == st['type']['display'] and proj['music'] == st['sound']['bed']
    ov = proj['overrides']['ad']
    assert ov['type.headline'] == st['type']['presets']['headline'] and ov['layers'] == st['layers']
    for k, v in ov.items():
        if k.startswith('transitions.'):
            assert v[0] == st['transitions']['by_reason'][v[1].split(':')[0]], (k, v)
    # the template builds its plan from that project (PROJECT_MAP + overrides, the same path mp render takes), and the style checks pass on it
    proj['brand'].update(name='Night Library', url='library.example', cta='Come in late')
    proj['text'] = {'headline': 'Read after *dark*.', 'problem': ['Doors shut at six.'], 'product': 'Open until *midnight*.'}
    proj['claims'] = [{'text': 'Lamps stay on.'}]
    pf = tmp_path / 'filled.json'
    json.dump(proj, open(pf, 'w'))
    js = ("import('%s/templates/_shared/project.mjs').then(async (P) => { const m = await import('%s/templates/ad/config.mjs');"
          " const { project } = P.loadProject(%s); const r = P.applyProject(m.CONFIG, m.PROJECT_MAP, project, { template: 'ad', aspect: '16:9', ASPECTS: m.ASPECTS });"
          " console.log(JSON.stringify(m.buildPlan(r.config))); })") % (PACK, PACK, json.dumps(str(pf)))
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    tp = json.loads(r.stdout)
    tp['playbook'] = {'style': sid}
    ctx = K.Ctx(plan=tp, project=proj)
    for cid in ('lint.style.palette', 'lint.style.type', 'lint.style.transitions', 'lint.style.sound'):
        v = K.run_check(cid, ctx, {})
        assert v[0] == 'pass', (sid, cid, v)
    plates = (st.get('apply') or {}).get('templates/ad', {}).get('plates', False)
    assert plates or not any(s.get('media') for s in tp['shots']), 'a type-only style film links no plate footage'


def test_each_style_check_fails_when_the_film_breaks_it():
    st = STYLES['blueprint']
    plan = {'playbook': {'style': 'blueprint'}, 'music': 'music.bed_hype_house_loop8',
            'shots': [{'id': 'a', 'tx': 'transitions/lightLeak', 'type': 'type/scaleSlam'}]}
    proj = {'brand': {'paper': '#0E2A5A', 'ink': '#1A3A6A', 'accent': '#FFD23F'}}
    ctx = K.Ctx(plan=plan, project=proj)
    assert K.run_check('lint.style.palette', ctx, {})[0] == 'fail'
    assert K.run_check('lint.style.transitions', ctx, {})[0] == 'fail'             # lightLeak is banned by blueprint
    assert K.run_check('lint.style.type', ctx, {})[0] == 'fail'
    assert K.run_check('lint.style.sound', ctx, {})[0] == 'warn'
    ok = K.Ctx(plan={'playbook': {'style': 'blueprint'}}, project={'brand': {'paper': '#0E2A5A', 'ink': '#EAF2FF', 'accent': '#FFD23F'}})
    assert K.run_check('lint.style.palette', ok, {})[0] == 'pass'
    assert K.severity('fail', K.CHECKS['lint.style.palette']['grade']) == 'FAIL'
    none = K.Ctx(plan={'shots': []})
    assert all(K.run_check(c, none, {})[0] == 'na' for c in ('lint.style.palette', 'lint.style.type', 'lint.style.transitions', 'lint.style.sound'))
    assert KS.style_of(ctx)['id'] == st['id']


def test_mp_lint_runs_the_style_features_and_lists_the_review_ones(tmp_path):
    _plan(tmp_path, 'neon-night')
    r = subprocess.run([sys.executable, os.path.join(PACK, 'tools', 'playbook_lint.py'), str(tmp_path / 'plan.json'), '--json'], capture_output=True, text=True)
    j = json.loads(r.stdout)
    rows = {x['check']: x['verdict'] for x in j['rows'] if x['rule'].startswith('(style neon-night)')}
    assert rows.get('lint.style.palette') == 'PASS' and rows.get('lint.style.transitions') == 'PASS', rows
    assert j['style']['id'] == 'neon-night' and j['style']['review'], j.get('style')


def test_mp_styles_lists_and_prints_the_prompt():
    r = mp('styles')
    assert r.returncode == 0 and all(s in r.stdout for s in STYLES)
    r = mp('styles', 'editorial-print')
    assert r.returncode == 0 and STYLES['editorial-print']['prompt'] in r.stdout and 'mp plan' in r.stdout
    r = mp('styles', 'editorial-print', '--zh')
    assert r.returncode == 0 and STYLES['editorial-print']['prompt_zh'] in r.stdout
    assert mp('styles', 'no-such-style').returncode == 2
    assert mp('plan', 'ad', '--style', 'no-such-style').returncode == 2


def test_ad_offers_a_ten_second_cut():
    r = subprocess.run(['node', '-e', "import('%s/tools/playbook_plan.mjs').then(async (m) => console.log(JSON.stringify((await m.templateInfo('ad', '16:9')).lengths)))" % PACK], capture_output=True, text=True)
    assert 10 in json.loads(r.stdout.strip().split('\n')[-1]), r.stdout + r.stderr


PROMPTS = json.load(open(os.path.join(PACK, 'playbook', 'prompts.json'), encoding='utf-8'))['prompts']


def test_the_gallery_has_twenty_prompts_and_every_style():
    assert len(PROMPTS) >= 20 and {p['style'] for p in PROMPTS} == set(STYLES)
    import playbook_research as R
    fms = L.load_formats(PB)
    for p in PROMPTS:
        assert 150 <= len(p['prompt']) <= 250 and R.classify(p['prompt'], fms)[0][1] == p['format'], p['id']


@pytest.mark.parametrize('p', PROMPTS, ids=[p['id'] for p in PROMPTS])
def test_every_gallery_prompt_plans_with_its_style(tmp_path, p):
    r = mp('plan', p['format'], '--style', p['style'], '--length', str(p['length']), '--aspect', p['aspect'], '--out', str(tmp_path / 'plan.json'), '--project-out', str(tmp_path / 'project.json'))
    assert r.returncode == 0, r.stdout + r.stderr
    plan = json.load(open(tmp_path / 'plan.json'))
    assert plan['style']['id'] == p['style'] and plan['aspect'] == p['aspect'] and plan['style']['applied']
