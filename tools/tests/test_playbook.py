"""The playbook machinery (motion-pack v0.5): the schemas and tools/playbook_build.py, the lint checks (tools/playbook_checks.py, tools/playbook_lint.py),
`mp plan` through the CLI, `mp brief`, `mp study` and `mp rules promote` (tools/playbook.py, tools/playbook_research.py).
Fixtures: tools/tests/fixtures/playbook (3 rules, 1 format, a fill for its TODOs, and the MEASUREMENTS of one real v0.4.0 render: saas-launch-16x9's
plan, ears, eyes, probe and study JSON; the MP4 itself is not committed). Nothing renders here.
Run: python3 -m pytest -q tools/tests/test_playbook.py"""
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'tools'))
import playbook_lib as L  # noqa: E402
import playbook_checks as K  # noqa: E402
import playbook_lint as PL  # noqa: E402
import playbook_build as B  # noqa: E402
import playbook as PB  # noqa: E402
import playbook_research as R  # noqa: E402

FX = os.path.join(HERE, 'fixtures', 'playbook')
RENDER = os.path.join(FX, 'render-v040', 'saas-launch-16x9.mp4')
NODE = shutil.which('node')
MP = os.path.join(REPO, 'tools', 'mp')
pytestmark = pytest.mark.skipif(NODE is None, reason='node not installed')


def J(p):
    return json.load(open(p, encoding='utf-8'))


@pytest.fixture()
def pb(tmp_path):
    """a writable copy of the fixture playbook"""
    d = str(tmp_path / 'pb')
    shutil.copytree(FX, d, ignore=shutil.ignore_patterns('render-v040'))
    return d


def mp(*args, cwd=None):
    e = dict(os.environ, PYTHON=sys.executable)
    return subprocess.run([MP, *args], cwd=cwd or REPO, capture_output=True, text=True, env=e, timeout=300)


# ---------------------------------------------------------------- schemas + build

def test_the_fixture_playbook_is_valid_and_its_index_current():
    probs, rules, formats, inbox = B.validate(FX)
    assert not probs, probs
    assert len(rules) == 3 and list(formats) == ['launch-film']
    assert B.main(['--check', '--playbook', FX]) == 0


def test_the_pack_playbook_validates():
    assert B.main(['--check']) == 0


def _rewrite(pb, rel, fn):
    p = os.path.join(pb, rel)
    d = J(p)
    fn(d)
    json.dump(d, open(p, 'w'), indent=1)


@pytest.mark.parametrize('rel,mut,expect', [
    ('rules/sound.json', lambda d: d.append(copy.deepcopy(d[0])), 'duplicate id'),
    ('rules/sound.json', lambda d: d[0]['enforce'].update(check='lint.sound.nope'), 'not a registered check'),
    ('rules/sound.json', lambda d: d[0]['enforce'].update(default='plan.audio.nope'), 'not a plan default'),
    ('rules/hook.json', lambda d: d[0]['enforce'].update(part='type/noSuchPreset'), 'does not resolve'),
    ('rules/sound.json', lambda d: d[0].update(status='prose-only'), 'status prose-only'),
    ('rules/delivery.json', lambda d: d[0]['enforce'].update(check=None), 'status enforced needs enforce.check'),
    ('rules/sound.json', lambda d: d[0].update(grade='gospel'), "'gospel' is not one of"),
    ('rules/sound.json', lambda d: d[0].update(id='hook.quiet_open'), 'must start with "sound."'),
    ('rules/sound.json', lambda d: d[0].update(colour='red'), "'colour' does not match"),
    ('rules/sound.json', lambda d: d[0].update(sources=[{'doc': 'docs/evidence/no-such-study.md'}]), 'does not exist'),
    ('rules/sound.json', lambda d: d[0].update(conflicts_with=['sound.ghost']), 'unknown rule sound.ghost'),
    ('rules/sound.json', lambda d: d[0].update(status='candidate'), 'belongs in playbook/inbox'),
    ('rules/hook.json', lambda d: d[0].update(sources=[]), 'needs at least one source'),
    ('formats/launch-film.json', lambda d: d['rules'].append('story.ghost'), 'rule story.ghost is not in the playbook'),
    ('formats/launch-film.json', lambda d: d['beats'][-1]['at'].__setitem__(1, 0.9), 'must cover 0..1'),
    ('formats/launch-film.json', lambda d: d['beats'][1]['at'].__setitem__(0, 0.05), 'overlap'),
    ('formats/launch-film.json', lambda d: d.update(template='templates/no-such-template'), 'has no config.mjs'),
    ('formats/launch-film.json', lambda d: d.update(lead_aspect='1:1'), 'lead_aspect'),
    ('formats/launch-film.json', lambda d: d['hooks'].append('no-such-hook'), 'not in patterns/hooks.json'),
    ('formats/launch-film.json', lambda d: d['recommended_parts']['turn'].append('sfx/whoosh/no_such_sound'), 'recommended part sfx/whoosh/no_such_sound'),
    ('formats/launch-film.json', lambda d: d['recommended_parts'].update(ghost=['transitions/whip']), 'unknown beat ghost'),
    ('formats/launch-film.json', lambda d: d.update(id='launch'), 'does not match the file name'),
    ('formats/launch-film.json', lambda d: d['signals'].update(goals=['fame']), "'fame' is not one of"),
    ('formats/launch-film.json', lambda d: d['exemplars'][0].pop('grade'), "'grade' is a required property"),
])
def test_build_catches(pb, rel, mut, expect):
    _rewrite(pb, rel, mut)
    probs = B.validate(pb)[0]
    assert any(expect in p for p in probs), probs


def test_build_check_flags_a_stale_index(pb):
    assert B.main(['--check', '--playbook', pb]) == 0
    _rewrite(pb, 'rules/delivery.json', lambda d: d[0].update(statement='Master louder.'))
    assert B.main(['--check', '--playbook', pb]) == 1
    assert B.main(['--playbook', pb]) == 0                                     # regenerates the index
    assert B.main(['--check', '--playbook', pb]) == 0


def test_every_rule_enforce_id_is_registered_where_it_claims():
    assert {'lint.sound.quiet_open', 'lint.master.loudness', 'lint.hook.text_by', 'lint.eyes.banding', 'lint.ears.sync', 'lint.honesty.todo'} <= set(K.CHECKS)
    d = B.defaults_registry()
    assert {'plan.audio.quiet_open', 'plan.audio.bass_entry', 'plan.audio.name_silence', 'plan.audio.master', 'plan.hook.text'} <= set(d)
    assert B.part_ok('ui.appWindow') and B.part_ok('transitions/whip') and B.part_ok('music/bed_corporate_bright_loop8') and not B.part_ok('ui.noSuchThing')


# ---------------------------------------------------------------- severity and score

def test_grade_decides_severity():
    assert K.severity('fail', 'house') == 'FAIL' and K.severity('fail', 'measured-A') == 'FAIL'
    assert K.severity('fail', 'craft') == 'WARN' and K.severity('fail', 'measured') == 'WARN'
    assert K.severity('fail', 'inferred') == 'INFO' and K.severity('warn', 'inferred') == 'INFO'
    assert K.severity('warn', 'house') == 'WARN' and K.severity('pass', 'house') == 'PASS' and K.severity('na', 'house') == 'N/A'


# ---------------------------------------------------------------- checks on synthetic plans

def plan(**kw):
    p = {'template': 'saas-launch', 'fps': 30, 'seconds': 30, 'aspect': '16:9', 'W': 1920, 'H': 1080,
         'shots': [{'id': 'hook', 'start': 0, 'dur': 3}, {'id': 'body', 'start': 3, 'dur': 23}, {'id': 'end', 'start': 26, 'dur': 4, 'hold': True}],
         'texts': [{'id': 'h', 'text': 'Requests land everywhere.', 't': [0.12, 3]}],
         'audio': {'mode': 'music', 'quiet': [{'t': [0, 1.5], 'kind': 'open', 'db': -9}, {'t': [20, 21.2], 'kind': 'gap', 'role': 'name'}, {'t': [26, 30], 'kind': 'hold'}],
                   'bass_entry_s': 8.0, 'first_hit_s': 1.5},
         'cues': [], 'claims': []}
    for k, v in kw.items():
        p[k] = v
    return p


def chk(cid, p=None, ears=None, eyes=None, probe=None, fm=None, **params):
    ctx = K.Ctx(p, ears, eyes, probe, None, fm, None)
    return K.run_check(cid, ctx, params)


def ears_with(open2=-9.0, open1=-9.5, tail=True, shape='quiet hold', quiet=None, lufs=-14.0, tp=-1.6, frame=0, hits=(1.4,)):
    return {'ears/structure': {'status': 'pass', 'measured': {'quiet_shape': {'open_2s_vs_body_db': open2, 'open_vs_body_db': open1, 'quiet_tail': tail, 'end_shape': shape, 'tail_2s_vs_body_db': -18, 'quiet_open': open2 <= -6},
                                                              'quiet': quiet if quiet is not None else []}},
            'ears/loudness': {'status': 'pass', 'measured': {'integrated_lufs': lufs, 'true_peak_dbtp': tp}},
            'ears/sync': {'status': 'pass', 'measured': {'first_audible_frame': frame, 'hits': list(hits)}}}


def test_quiet_open_from_plan_and_from_ears():
    assert chk('lint.sound.quiet_open', plan())[0] == 'pass'
    p = plan()
    p['audio']['quiet'] = p['audio']['quiet'][1:]
    assert chk('lint.sound.quiet_open', p)[0] == 'fail'
    p = plan()
    p['audio']['quiet'][0]['db'] = -3
    assert chk('lint.sound.quiet_open', p)[0] == 'fail'
    p['audio']['quiet'][0].update(db=-9, t=[0, 4])
    assert chk('lint.sound.quiet_open', p)[0] == 'fail'
    assert chk('lint.sound.quiet_open', None, ears_with(-9))[0] == 'pass'
    assert chk('lint.sound.quiet_open', None, ears_with(0.5))[0] == 'fail'
    assert chk('lint.sound.quiet_open', None, ears_with(-20))[0] == 'warn'
    assert chk('lint.sound.quiet_open', None, ears_with(-5), quiet_open_db=[-6, -4])[0] == 'pass'   # params from the rule / format win
    assert chk('lint.sound.quiet_open')[0] == 'na'


def test_bass_entry_name_silence_tail_first_sound_first_hit():
    assert chk('lint.sound.bass_entry', plan())[0] == 'pass'                     # 8 / 30 = 27%
    p = plan()
    p['audio']['bass_entry_s'] = 2.0
    assert chk('lint.sound.bass_entry', p)[0] == 'fail'
    del p['audio']['bass_entry_s']
    assert chk('lint.sound.bass_entry', p)[0] == 'fail'
    assert chk('lint.sound.name_silence', plan())[0] == 'pass'
    p = plan()
    p['audio']['quiet'][1]['t'] = [20, 23]
    assert chk('lint.sound.name_silence', p)[0] == 'fail'                       # 3 s is longer than 1-1.5 s
    r = chk('lint.sound.name_silence', plan(), ears_with(quiet=[]))
    assert r[0] == 'fail' and 'not quiet there' in r[1], r                     # planned, but the render keeps sound there
    assert chk('lint.sound.name_silence', plan(), ears_with(quiet=[{'t': [20, 21], 'under_programme_db': 14}]))[0] == 'pass'
    assert chk('lint.sound.tail', plan())[0] == 'pass'
    assert chk('lint.sound.tail', None, ears_with(tail=False, shape='slam'))[0] == 'fail'
    assert chk('lint.sound.tail', None, ears_with(tail=False, shape='slam'), tail='sting')[0] == 'pass'
    assert chk('lint.sound.first_sound', None, ears_with(frame=9))[0] == 'pass'      # the quiet open excuses a late first sound
    assert chk('lint.sound.first_sound', None, ears_with(open2=0, frame=9))[0] == 'fail'
    assert chk('lint.sound.first_hit', None, ears_with(hits=(0.3,)))[0] == 'fail'
    assert chk('lint.sound.first_hit', None, ears_with(hits=(1.2,)))[0] == 'pass'
    assert chk('lint.sound.first_hit', None, ears_with(hits=(4.0,)))[0] == 'warn'


def test_master_loudness_and_true_peak():
    assert chk('lint.master.loudness', None, ears_with(lufs=-14.3))[0] == 'pass'
    assert chk('lint.master.loudness', None, ears_with(lufs=-21.5))[0] == 'fail'
    assert chk('lint.master.loudness', plan())[0] == 'na'
    assert chk('lint.master.true_peak', None, ears_with(tp=-0.5))[0] == 'fail'
    assert chk('lint.master.true_peak', None, ears_with(tp=-1.2), true_peak_max_dbtp=-1.5)[0] == 'fail'
    assert chk('lint.master.true_peak', None, ears_with(tp=-1.6), true_peak_max_dbtp=-1.5)[0] == 'pass'


def test_hook_type_pacing_end_checks():
    assert chk('lint.hook.text_by', plan())[0] == 'pass'
    assert chk('lint.hook.text_by', plan(texts=[{'text': 'Late words', 't': [3.5, 5]}]))[0] == 'fail'
    assert chk('lint.hook.text_by', plan(texts=[{'text': 'TODO(hook): write it', 't': [0.1, 2]}]))[0] == 'na'   # an unwritten slot is lint.honesty.todo's job
    assert chk('lint.hook.frame0', plan(shots=[{'id': 'logo', 'start': 0, 'dur': 2}, {'id': 'body', 'start': 2, 'dur': 28}]))[0] == 'fail'
    assert chk('lint.hook.words', plan(texts=[{'text': 'one two three four five six seven eight', 't': [0.1, 3]}]))[0] == 'fail'
    assert chk('lint.type.words_per_line', plan(texts=[{'text': 'one two three\nfour five six', 't': [0.1, 3]}]))[0] == 'pass'
    assert chk('lint.type.words_per_line', plan(texts=[{'text': 'one two three four five six seven', 't': [0.1, 3]}]))[0] == 'fail'
    assert chk('lint.type.reading_time', plan(texts=[{'text': 'one two three four five six', 't': [1, 1.6]}]))[0] == 'fail'
    assert chk('lint.type.reading_time', plan())[0] == 'pass'
    fm = J(os.path.join(FX, 'formats', 'launch-film.json'))
    assert chk('lint.type.beat_words', plan(texts=[{'text': 'one two three four five six seven', 't': [0.1, 2]}]), fm=fm)[0] == 'fail'   # hook max 6
    assert chk('lint.type.beat_words', plan(), fm=fm)[0] == 'pass'
    assert chk('lint.pacing.length', plan(), length_s=[30, 38])[0] == 'pass'
    assert chk('lint.pacing.length', plan(seconds=60), length_s=[30, 38])[0] == 'fail'
    assert chk('lint.pacing.length', plan(), probe={'duration': 45.0}, length_s=[30, 38])[0] == 'fail'   # the delivered file wins over the plan
    assert chk('lint.end.hold', plan())[0] == 'pass'
    assert chk('lint.end.hold', plan(shots=[{'id': 'body', 'start': 0, 'dur': 29.5}, {'id': 'end', 'start': 29.5, 'dur': 0.5}], audio={}))[0] == 'fail'


def test_delivery_honesty_ids_on_a_plan_file(tmp_path):
    good = plan(claims=[{'text': 'Routed 12,400 requests', 'source': 'the beta dashboard export, 2026-10-01'}])
    bad = plan(claims=[{'text': 'Saves 40% of your time', 'source': 'internal benchmark'}], texts=[{'text': 'TODO(hook): write it', 't': [0, 2]}, {'text': 'A planned feature', 't': [3, 6]}],
               cues=[{'t': 0, 'id': 'sfx/whoosh/no_such_sound'}])
    for name, p in (('good', good), ('bad', bad)):
        json.dump(p, open(tmp_path / (name + '.json'), 'w'))
    g = K.Ctx(good, plan_path=str(tmp_path / 'good.json'))
    b = K.Ctx(bad, plan_path=str(tmp_path / 'bad.json'))
    for cid in ('lint.honesty.claims', 'lint.honesty.todo', 'lint.honesty.banned_words', 'lint.honesty.names', 'lint.ids.resolve', 'lint.delivery.size'):
        assert K.run_check(cid, g, {})[0] == 'pass', cid
    for cid in ('lint.honesty.claims', 'lint.honesty.todo', 'lint.honesty.banned_words', 'lint.ids.resolve'):
        assert K.run_check(cid, b, {})[0] == 'fail', cid
    assert K.run_check('lint.delivery.size', K.Ctx(plan(W=1080, H=1920)), {})[0] == 'fail'
    assert K.run_check('lint.delivery.size', K.Ctx(None, probe={'width': 1920, 'height': 1080}, aspect='9:16'), {})[0] == 'fail'


def test_wrappers_follow_the_report_status():
    eyes = {'eyes/banding': {'status': 'fail', 'issues': [{'severity': 'fail', 'what': 'bands', 'fix': 'add grain'}]}}
    assert chk('lint.eyes.banding', None, None, eyes)[:1] == ('fail',) and 'add grain' in chk('lint.eyes.banding', None, None, eyes)[2]
    assert chk('lint.eyes.banding')[0] == 'na' and chk('lint.ears.sync', None, {'ears/sync': {'status': 'warn'}})[0] == 'warn'


# ---------------------------------------------------------------- lint on the real v0.4.0 render (its measurements)

def test_lint_the_real_v040_saas_launch_render():
    """the 19 Oct release render of saas-launch at 16:9: right loudness, early hook words, but no quiet open (the CHANGELOG's launch-template weak spot)"""
    plan_, plan_path, ears, eyes, pr, aspect = PL.load_target(RENDER, do_measure=False)
    assert plan_ and ears and eyes and pr['width'] == 1920 and aspect == '16:9'
    fm = L.load_formats(FX)['launch-film']
    res = PL.lint(K.Ctx(plan_, PL._by_id(ears), PL._by_id(eyes), pr, aspect, fm, plan_path), L.rules_by_id(FX), fm, all_checks=True)
    v = {r['rule']: r for r in res['rows']}
    assert v['delivery.master_loudness']['verdict'] == 'PASS' and '-14.16' in v['delivery.master_loudness']['value']
    assert v['sound.quiet_open']['verdict'] == 'FAIL' and '+0.5 dB' in v['sound.quiet_open']['value']
    assert v['hook.text_early']['verdict'] == 'PASS'
    assert v['(check) lint.pacing.length']['verdict'] == 'WARN'               # 60 s against the 30-38 s launch film
    assert v['(check) lint.sound.name_silence']['verdict'] == 'WARN'          # the template plans no silence under the name
    assert v['(check) lint.eyes.readability']['verdict'] == 'FAIL' and v['(check) lint.eyes.frames']['verdict'] == 'FAIL'
    assert v['(check) lint.delivery.size']['verdict'] == 'PASS' and v['(check) lint.honesty.todo']['verdict'] == 'PASS'
    assert res['counts']['FAIL'] == 3 and 0 < res['score'] < 100
    r = mp('lint', RENDER, '--playbook', FX, '--no-measure', '--json')
    assert r.returncode == 1, r.stderr
    j = json.loads(r.stdout)
    assert j['format'] is None and {x['rule'] for x in j['rows'] if not x['rule'].startswith('(check)')} == {'sound.quiet_open', 'hook.text_early', 'delivery.master_loudness'}
    assert {x['check'] for x in j['rows'] if x['rule'].startswith('(check)')} == set(PL.ALWAYS)     # the honesty floor runs on every lint


# ---------------------------------------------------------------- mp plan -> fill -> mp lint, through the CLI

def _fill(v, F):
    if isinstance(v, dict):
        return {k: _fill(x, F) for k, x in v.items()}
    if isinstance(v, list):
        return [_fill(x, F) for x in v]
    if isinstance(v, str) and v.startswith('TODO('):
        return F.get(v[5:v.index(')')], v)
    return v


@pytest.mark.parametrize('length,aspect', [(15, '16:9'), (30, '9:16'), (45, '16:9')])
def test_mp_plan_then_lint(tmp_path, length, aspect):
    out = tmp_path / 'plan.json'
    r = mp('plan', 'launch-film', '--length', str(length), '--aspect', aspect, '--playbook', FX, '--out', str(out), '--project-out', str(tmp_path / 'project.json'))
    assert r.returncode == 0, r.stderr
    assert ('outside' in r.stderr) == (length == 15 or length == 45)
    p = J(out)
    assert p['seconds'] == length and p['aspect'] == aspect and p['playbook']['format'] == 'launch-film'
    assert J(tmp_path / 'project.json')['template'] == 'saas-launch'
    r = mp('lint', str(out), '--playbook', FX, '--all-checks', '--json')
    j = json.loads(r.stdout)
    assert r.returncode == 1 and any(x['check'] == 'lint.honesty.todo' and x['verdict'] == 'FAIL' for x in j['rows'])
    F = {k: v for k, v in J(os.path.join(FX, 'fill-launch-film.json')).items() if not k.startswith('//')}
    p = _fill(p, F)
    p['claims'] = []
    json.dump(p, open(out, 'w'))
    r = mp('lint', str(out), '--playbook', FX, '--all-checks', '--json')
    j = json.loads(r.stdout)
    fails = [x['check'] for x in j['rows'] if x['verdict'] == 'FAIL']
    if length == 15:                                                            # outside the format's 30-38 s: the hook slot is too short to read its words
        assert r.returncode == 1 and fails == ['lint.type.reading_time'], fails
    else:
        assert r.returncode == 0 and not fails, fails
    v = {x['check']: x['verdict'] for x in j['rows']}
    assert v['lint.sound.quiet_open'] == v['lint.sound.name_silence'] == v['lint.sound.bass_entry'] == v['lint.end.hold'] == 'PASS'
    assert v['lint.pacing.length'] == ('PASS' if length == 30 else 'WARN')


def test_mp_plan_refuses_an_unknown_format():
    r = mp('plan', 'no-such-format', '--playbook', FX)
    assert r.returncode == 2 and 'launch-film' in r.stderr


# ---------------------------------------------------------------- brief, study, promote

def test_classify_and_questions():
    fms = L.load_formats(FX)
    other = copy.deepcopy(fms['launch-film'])
    other.update(id='explainer', signals={'keywords': ['how', 'explain', 'works'], 'goals': ['explain'], 'platforms': ['youtube']})
    fms2 = {'launch-film': fms['launch-film'], 'explainer': other}
    rk = R.classify('We are launching a SaaS tool next week', fms2)
    assert rk[0][1] == 'launch-film' and rk[0][0] > rk[1][0] + 1 and not R.questions(rk, fms2, None, None)
    rk = R.classify('how it works', fms2, goal='explain')
    assert rk[0][1] == 'explainer'
    rk = R.classify('a film about our company', fms2)
    qs = R.questions(rk, fms2, None, None)
    assert 1 <= len(qs) <= 2 and '--goal' in qs[0]
    rk = R.classify('a film about our company', fms2, goal='launch', platform='x')
    assert rk[0][1] == 'launch-film' and not R.questions(rk, fms2, 'launch', 'x')


def test_mp_brief_writes_the_research_pack_then_the_plan(tmp_path):
    r = mp('brief', 'We are launching Orbit, a SaaS tool that routes requests', '--playbook', FX, '--out', str(tmp_path), '--platform', 'x')
    assert r.returncode == 0, r.stdout + r.stderr
    rp = J(tmp_path / 'research-pack.json')
    assert rp['format']['id'] == 'launch-film' and 'keyword "launching"' in rp['format']['why']
    assert [b['id'] for b in rp['beats']][0] == 'hook' and rp['rules_by_beat']['hook'][0]['id'] == 'sound.quiet_open'
    assert rp['rules_by_beat']['hook'][0]['params']['quiet_open_db'] == [-11, -7]
    assert rp['exemplars'] and rp['recommended_parts']['turn'] and rp['hooks'] and rp['honesty'] and rp['sound']['beds'] == ['music/bed_corporate_bright_loop8']
    md = open(tmp_path / 'research-pack.md').read()
    assert '## Honesty checklist' in md and '`transitions/whip`' in md and 'Closest exemplars' in md
    p = J(tmp_path / 'plan.json')
    assert p['playbook']['research'] == 'research-pack.json' and p['platform'] == 'x.video'
    r = mp('brief', 'a short film about cats', '--playbook', FX, '--out', str(tmp_path / 'b'))
    assert r.returncode == 3 and '--goal' in r.stdout and not os.path.exists(tmp_path / 'b' / 'plan.json')


def test_mp_study_our_render_reports_gaps():
    r = mp('study', RENDER, '--playbook', FX, '--no-measure')
    assert r.returncode == 1, r.stdout + r.stderr                               # the quiet-open FAIL
    assert 'gaps against the closest exemplar' in r.stdout and 'quiet_open_db' in r.stdout and 'lufs' in r.stdout


def test_mp_study_a_reference_writes_brand_free_candidates_and_promote(pb):
    st = os.path.join(FX, 'render-v040', 'saas-launch-16x9.study.json')
    r = mp('study', st, '--reference', '--slug', 'round-x-01', '--playbook', pb)
    assert r.returncode == 0, r.stdout + r.stderr
    inbox = os.listdir(os.path.join(pb, 'inbox'))
    assert len(inbox) == 1 and inbox[0].endswith('-round-x-01.json')
    cands = J(os.path.join(pb, 'inbox', inbox[0]))
    assert len(cands) >= 4 and all(c['status'] == 'candidate' for c in cands)
    assert all('meta' not in json.dumps(c) and 'source' not in c for c in cands)
    assert not B.validate(pb)[0]                                               # candidates are schema-valid in the inbox
    assert mp('study', st, '--reference', '--slug', 'Some_Account', '--playbook', pb).returncode == 2
    done, probs = PB.promote(pb, inbox[0], ['sound.quiet_open_roundx01'], 'sound.quiet_open_alt', 'measured')
    assert done == ['sound.quiet_open_alt'] and not probs
    rules = L.rules_by_id(pb)
    assert rules['sound.quiet_open_alt']['status'] == 'enforced' and rules['sound.quiet_open_alt']['grade'] == 'measured'
    assert J(os.path.join(pb, 'inbox', inbox[0]))[0]['promoted_to'] == 'sound.quiet_open_alt'   # kept, marked, never deleted
    assert PB.promote(pb, inbox[0], ['sound.quiet_open_roundx01'])[0] == []                     # once only
    assert PB.promote(pb, inbox[0], ['sound.end_shape_roundx01'], 'sound.quiet_open')[1]        # an existing id is refused
    assert not B.validate(pb)[0]


def test_mp_formats_and_rules_cli():
    r = mp('formats', '--playbook', FX)
    assert r.returncode == 0 and r.stdout.startswith('launch-film')
    r = mp('rules', '--playbook', FX, '--area', 'sound')
    assert r.returncode == 0 and 'sound.quiet_open' in r.stdout and 'hook.' not in r.stdout
    assert mp('rules', '--playbook', FX, '--gaps').returncode == 1             # no prose-only rule in the fixtures
    r = mp('rules', '--playbook', FX, '--format', 'launch-film', '--json')
    assert {x['id'] for x in json.loads(r.stdout)} == {'sound.quiet_open', 'hook.text_early', 'delivery.master_loudness'}


# ---------------------------------------------------------------- the extra checks (tools/playbook_checks_extra.py): each wraps a pack gate, N/A without its input

SHOTLIST = os.path.join(REPO, 'skills', 'story-script', 'assets', 'shotlist.example.json')
DESIGN = os.path.join(REPO, 'skills', 'frame-design', 'assets', 'design.example.json')


def xchk(cid, **kw):
    ctx = K.Ctx(kw.pop('plan', None), kw.pop('ears', None), None, None, None, None, kw.pop('plan_path', None), **kw)
    return K.run_check(cid, ctx, {})


def test_every_extra_check_is_na_without_its_input():
    for cid in [c for c in K.CHECKS if c.startswith(('lint.shotlist.', 'lint.design.', 'lint.type.captions', 'lint.study.', 'lint.motion.', 'lint.honesty.charts', 'lint.honesty.quotes'))]:
        assert K.run_check(cid, K.Ctx(plan()), {})[0] == 'na', cid


def test_shotlist_checks_wrap_lint_shotlist():
    good = J(SHOTLIST)
    for n in ('hook_variants', 'transition_reason', 'same_scale_run', 'sound_off', 'send_line', 'turn_window', 'payoff_before_turn', 'poster_max_words', 'social_proof'):
        assert xchk('lint.shotlist.' + n, shotlist=good)[0] == 'pass', n
    bad = copy.deepcopy(good)
    bad['hooks'] = bad['hooks'][:1]
    del bad['sound_off'], bad['send_line']
    bad['shots'][3]['transition'] = {'kind': 'smash', 'reason': None}
    bad['hooks'][0]['poster_text'] = 'one two three four five six'
    assert xchk('lint.shotlist.hook_variants', shotlist=bad)[0] == 'warn'
    assert xchk('lint.shotlist.sound_off', shotlist=bad)[0] == 'warn' and xchk('lint.shotlist.send_line', shotlist=bad)[0] == 'warn'
    assert xchk('lint.shotlist.transition_reason', shotlist=bad)[0] == 'fail'
    assert xchk('lint.shotlist.poster_max_words', shotlist=bad)[0] == 'fail'
    ctx = K.Ctx(None, shotlist=good)
    assert K.run_check('lint.shotlist.poster_max_words', ctx, {'poster_max_words': 2})[0] == 'fail'   # the rule's params reach lint_shotlist


def test_label_hold_design_contrast_and_captions(tmp_path):
    sl = J(SHOTLIST)
    assert xchk('lint.storyboard.label_hold', shotlist=sl)[0] == 'fail'           # the example's 1.5 s labelled shot: the storyboard README's known finding
    sl['shots'][4]['dur_s'] = 2.5
    p = plan(texts=[{'text': 'Fictional app · demo data', 't': [1, 4], 'role': 'label'}])
    assert xchk('lint.storyboard.label_hold', plan=p)[0] == 'pass'
    p['texts'][0]['t'] = [1, 2.2]
    assert xchk('lint.storyboard.label_hold', plan=p)[0] == 'fail'
    assert xchk('lint.design.contrast', design_path=DESIGN)[0] == 'pass'
    d = J(DESIGN)
    d['palette']['ink'] = '#E0E0E0'
    json.dump(d, open(tmp_path / 'design.json', 'w'))
    r = xchk('lint.design.contrast', design_path=str(tmp_path / 'design.json'))
    assert r[0] == 'fail' and 'contrast.py' in r[2]
    ev = [{'start': 0.5, 'end': 2.5, 'lines': ['A short line']}, {'start': 2.6, 'end': 3.0, 'lines': ['x' * 60, 'y' * 60, 'z' * 60]}]
    json.dump({'events': ev}, open(tmp_path / 'c.events.json', 'w'))
    assert xchk('lint.type.captions', captions_path=str(tmp_path / 'c.events.json'))[0] == 'fail'
    json.dump({'events': ev[:1]}, open(tmp_path / 'ok.events.json', 'w'))
    assert xchk('lint.type.captions', captions_path=str(tmp_path / 'ok.events.json'))[0] in ('pass', 'warn')


def test_chart_and_quote_gates_over_template_plans(tmp_path):
    ds = os.path.join(REPO, 'templates', 'data-story', 'out', 'plan.json')
    fs = os.path.join(REPO, 'templates', 'founder-story', 'out', 'plan.json')
    assert xchk('lint.honesty.charts', plan=J(ds), plan_path=ds)[0] == 'pass'
    assert xchk('lint.honesty.quotes', plan=J(fs), plan_path=fs)[0] == 'pass'
    b = J(ds)
    b['datasets']['monthly']['method'] = b['datasets']['monthly']['source']
    json.dump(b, open(tmp_path / 'ds.json', 'w'))
    assert xchk('lint.honesty.charts', plan=b, plan_path=str(tmp_path / 'ds.json'))[0] == 'fail'
    q = J(fs)
    q['quote']['text'] = 'it always starts with listening'
    json.dump(q, open(tmp_path / 'fs.json', 'w'))
    assert xchk('lint.honesty.quotes', plan=q, plan_path=str(tmp_path / 'fs.json'))[0] == 'fail'


def test_mix_checks_wrap_the_mixer_and_the_grid():
    p = plan(cues=[{'t': 0.0, 'id': 'sfx/whoosh/swish_s'}, {'t': 2.0, 'id': 'sfx/ui/pop'}], music='music/bed_tech_pulse_loop8')
    assert xchk('lint.mix.cues', plan=p)[0] == 'pass'
    hits = [{'t': t, 'id': 'sfx/tx/smash_cut'} for t in (1.0, 2.0, 3.0)]
    r = xchk('lint.mix.cues', plan=plan(cues=hits))
    assert r[0] == 'fail' and 'R4' in r[1]
    assert xchk('lint.mix.qa', plan=p)[0] == 'pass'                               # 120 BPM at 30 fps: 15 frames a beat
    assert xchk('lint.mix.qa', plan=plan(bpm=180))[0] == 'fail'                   # exactly 10 frames a beat: on the grid but under 12
    assert xchk('lint.mix.qa', plan=plan(bpm=133))[0] == 'fail'                   # 13.5 frames a beat: snapping to 14 moves the tempo 3.3%
    assert xchk('lint.mix.qa', plan=plan())[0] == 'na'


def test_trailer_gap_loop_seam_seek_and_study_tier(tmp_path):
    p = plan()
    p['audio']['quiet'].append({'t': [24, 26], 'kind': 'gap'})
    assert xchk('lint.sound.trailer_gap', plan=p)[0] == 'pass'
    assert xchk('lint.sound.trailer_gap', plan=p, ears=ears_with(quiet=[{'t': [24, 26], 'under_programme_db': 12}]))[0] == 'fail'
    assert xchk('lint.sound.trailer_gap', plan=p, ears=ears_with(quiet=[{'t': [24, 26], 'under_programme_db': 34}]))[0] == 'pass'
    p['audio']['quiet'][-1]['t'] = [24, 28.5]
    assert xchk('lint.sound.trailer_gap', plan=p)[0] == 'fail'
    e = ears_with()
    e['ears/structure']['measured']['loop_seam'] = {'level_step_db': 9.0}
    assert xchk('lint.motion.loop_seam', plan=plan(), ears=e)[0] == 'na'          # no declared loop: a seam step means nothing
    assert xchk('lint.motion.loop_seam', plan=plan(loop=True), ears=e)[0] == 'fail'
    e['ears/structure']['measured']['loop_seam'] = {'level_step_db': 1.0}
    assert xchk('lint.motion.loop_seam', plan=plan(loop=True), ears=e)[0] == 'pass'
    (tmp_path / 'page').mkdir()
    (tmp_path / 'page' / 'scene.js').write_text('// Math.random() in a comment is fine\nexport const at = (t) => t * 2;\n')
    assert xchk('lint.motion.seek', page_dir=str(tmp_path / 'page'))[0] == 'pass'
    (tmp_path / 'page' / 'bad.js').write_text('export const jitter = () => Math.random();\n')
    assert xchk('lint.motion.seek', page_dir=str(tmp_path / 'page'))[0] == 'fail'
    st = J(os.path.join(FX, 'render-v040', 'saas-launch-16x9.study.json'))
    assert xchk('lint.study.tier', study=st)[0] == 'pass'
    st['evidence'] = {'tier': 'B', 'boosted': True}
    assert xchk('lint.study.tier', study=st)[0] == 'fail'


def test_evidence_id_sources_resolve(pb):
    _rewrite(pb, 'rules/sound.json', lambda d: d[0].update(sources=[{'doc': 'docs/evidence/INDEX.md#ref-concept-ad'}]))
    assert not B.validate(pb)[0]
    _rewrite(pb, 'rules/sound.json', lambda d: d[0].update(sources=[{'doc': 'docs/evidence/INDEX.md#ref-no-such-study'}]))
    assert any('names no evidence id' in p for p in B.validate(pb)[0])
    idx = open(os.path.join(REPO, 'docs', 'evidence', 'INDEX.md')).read()
    for k in B.evidence_ids():
        assert '<a id="%s"></a>' % k in idx


def test_lint_finds_the_extra_inputs_next_to_the_target(tmp_path):
    shutil.copy(SHOTLIST, tmp_path / 'shotlist.json')
    shutil.copy(DESIGN, tmp_path / 'design.json')
    json.dump(plan(), open(tmp_path / 'plan.json', 'w'))
    ins = PL.find_inputs(str(tmp_path / 'plan.json'), plan())
    assert ins['shotlist']['title'] and ins['design_path'].endswith('design.json') and ins['captions_path'] is None
    assert PL.find_inputs(RENDER, None)['study']['quiet']
