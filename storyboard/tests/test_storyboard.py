"""storyboard: the sheet, the checks and the animatic. Every test here is proved to fail on a mutation (tools/mutation_check.py with storyboard/tests/*.mutants.json).
Run: python3 -m pytest -q storyboard/tests   (needs ffmpeg, node and the sound library: python3 sfx/build_library.py)"""
import copy
import hashlib
import html as html_mod
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
import pytest
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, PACK)
from storyboard import animatic, board, core, draw  # noqa: E402

EXAMPLE = os.path.join(PACK, 'skills', 'story-script', 'assets', 'shotlist.example.json')
DESIGN = os.path.join(PACK, 'skills', 'frame-design', 'assets', 'design.example.json')
STUB = os.path.join(HERE, 'stub_snapshot.py')
COMMITTED = os.path.join(PACK, 'storyboard', 'examples', 'every-draft')


def load(p):
    return json.load(open(p, encoding='utf-8'))


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


@pytest.fixture()
def tmp():
    d = tempfile.mkdtemp(prefix='sb-test-')
    yield d
    shutil.rmtree(d, ignore_errors=True)


def put(d, name, doc):
    p = os.path.join(d, name)
    json.dump(doc, open(p, 'w'), indent=1)
    return p


def run(sl, out, design=DESIGN, **kw):
    kw.setdefault('make_animatic', False)
    kw.setdefault('make_pdf', False)
    return board.build(sl, design, out=out, log=lambda *a: None, **kw)


def example_doc():
    return load(EXAMPLE)


def shot(doc, sid):
    return next(s for s in doc['shots'] if s['id'] == sid)


# ------------------------------------------------------------------------------------------------------------------------------ panels
def test_one_panel_per_shot(tmp):
    code, rep = run(EXAMPLE, tmp, make_pdf=True)
    n = len(example_doc()['shots'])
    assert code == 0 and len(rep['panels']) == n == 7
    assert len([f for f in os.listdir(os.path.join(tmp, 'panels')) if f.endswith('.png')]) == n
    assert open(os.path.join(tmp, 'storyboard.html'), encoding='utf-8').read().count('<article class="panel"') == n
    assert rep['summary']['shots'] == n and os.path.getsize(os.path.join(tmp, 'storyboard.pdf')) > 5000


def test_a_panel_carries_every_field_the_gate_needs(tmp):
    code, rep = run(EXAMPLE, tmp)
    html = open(os.path.join(tmp, 'storyboard.html'), encoding='utf-8').read()
    for p, s in zip(rep['panels'], example_doc()['shots']):
        assert (p['id'], p['beat'], p['scale'], p['action'], p['sound']) == (s['id'], s['beat'], s['scale'], s['action'], s['sound'])
        assert p['frames'] > 0 and p['transition']['kind'] == s['transition']['kind'] and p['transition']['reason'] == s['transition']['reason']
        for t in (s['id'], s['beat'], s['action'], s['sound'], s['transition']['kind']):
            assert html_mod.escape(t) in html
        if s['transition']['reason']:
            assert html_mod.escape(s['transition']['reason']) in html


def test_honesty_labels_are_in_every_panel_that_has_one(tmp):
    code, rep = run(EXAMPLE, tmp)
    html = open(os.path.join(tmp, 'storyboard.html'), encoding='utf-8').read()
    labelled = [s for s in example_doc()['shots'] if s.get('honesty')]
    assert len(labelled) == 2
    for s in labelled:
        p = next(p for p in rep['panels'] if p['id'] == s['id'])
        assert p['honesty'] == s['honesty'] and p['honesty_layout'] and html_mod.escape(s['honesty']) in html
    # and the label is drawn in the frame, not only written under it: the same shot without it is a different picture
    doc = example_doc()
    shot(doc, 's05')['honesty'] = None
    d2 = os.path.join(tmp, 'b')
    os.makedirs(d2)
    run(put(d2, 'sl.json', doc), os.path.join(d2, 'out'))
    assert sha(os.path.join(tmp, 'panels', 's05.png')) != sha(os.path.join(d2, 'out', 'panels', 's05.png'))
    assert sha(os.path.join(tmp, 'panels', 's01.png')) == sha(os.path.join(d2, 'out', 'panels', 's01.png'))


def test_every_panel_says_what_kind_of_frame_it_is(tmp):
    code, rep = run(EXAMPLE, tmp)
    assert {p['source'] for p in rep['panels']} == {'schematic'} and rep['frame_source'] == 'schematic'
    assert 'not the picture' in open(os.path.join(tmp, 'storyboard.html'), encoding='utf-8').read()


def test_schematic_boards_are_deterministic_in_process_and_across_processes(tmp):
    a, b = os.path.join(tmp, 'a'), os.path.join(tmp, 'b')
    run(EXAMPLE, a)
    run(EXAMPLE, b)
    names = ['storyboard.png'] + ['panels/' + f for f in sorted(os.listdir(os.path.join(a, 'panels')))]
    assert [sha(os.path.join(a, n)) for n in names] == [sha(os.path.join(b, n)) for n in names]
    outs = []
    for k in range(2):
        o = os.path.join(tmp, 'p%d' % k)
        r = subprocess.run([sys.executable, os.path.join(PACK, 'storyboard', 'board.py'), EXAMPLE, '--design', DESIGN, '--out', o, '--no-animatic', '--no-pdf'], capture_output=True, text=True,
                           env=dict(os.environ, PYTHONHASHSEED=str(k * 777)))
        assert r.returncode == 0, r.stdout + r.stderr
        outs.append(o)
    assert [sha(os.path.join(outs[0], n)) for n in names] == [sha(os.path.join(outs[1], n)) for n in names]
    assert [sha(os.path.join(a, n)) for n in names] == [sha(os.path.join(outs[0], n)) for n in names]


# ------------------------------------------------------------------------------------------------------------------------------ type at its real size
def test_text_is_set_at_the_designs_size_in_the_designs_font(tmp):
    code, rep = run(EXAMPLE, tmp)
    p = next(p for p in rep['panels'] if p['id'] == 's07')
    assert p['text_layout']['size_px'] == 96 and p['text_layout']['font'].endswith('Manrope-Variable.ttf') and p['text_layout']['lines'] == ['Every draft, saved.']
    d = load(DESIGN)
    d['type']['sizes_px_at_1080']['end_line'] = 150
    code, rep2 = run(EXAMPLE, os.path.join(tmp, 'big'), design=put(tmp, 'design.json', d))
    p2 = next(p for p in rep2['panels'] if p['id'] == 's07')
    r1, r2 = p['text_layout']['rect'], p2['text_layout']['rect']
    assert p2['text_layout']['size_px'] == 150 and (r2['x1'] - r2['x0']) > 1.4 * (r1['x1'] - r1['x0'])


def test_a_design_font_that_is_missing_falls_back_and_says_so(tmp):
    d = load(DESIGN)
    d['type']['display']['file'] = 'templates/_shared/fonts/NoSuchFont.ttf'
    code, rep = run(EXAMPLE, tmp, design=put(tmp, 'd.json', d))
    assert code == 0 and any('NoSuchFont' in n for n in rep['notes'])


# ------------------------------------------------------------------------------------------------------------------------------ safe zone
def node_json(js):
    return json.loads(subprocess.run(['node', '--input-type=module', '-e', js], capture_output=True, text=True, check=True).stdout)


def test_safe_rect_and_lint_rect_match_type_safezones_js():
    cases = [('conservative', 1080, 1920), ('tiktok', 1080, 1920), ('wideTitle', 1920, 1080), ('wideAction', 1920, 1080), ('reels', 1080, 1080)]
    rects = [{'x0': -10, 'y0': 10, 'x1': 500, 'y1': 500}, {'x0': 100, 'y0': 100, 'x1': 2000, 'y1': 1100}, {'x0': 300, 'y0': 300, 'x1': 600, 'y1': 600}]
    js = "import * as m from 'file://%s/type/safezones.js'; const out=[]; for (const [p,W,H] of %s) for (const r of %s) out.push({r: m.safeRect(p,W,H), v: m.lintRect(r,p,W,H)}); console.log(JSON.stringify(out));" % (
        PACK, json.dumps(cases), json.dumps(rects))
    want = node_json(js)
    k = 0
    for p, W, H in cases:
        for r in rects:
            got = core.safe_rect(p, W, H)
            assert all(abs(got[f] - want[k]['r'][f]) < 1e-9 for f in ('x0', 'y0', 'x1', 'y1'))
            mine = core.lint_rect(r, p, W, H)                                           # JS toFixed(1) and Python round() differ on exact halves: compare within 0.11 px
            assert [(v['side']) for v in mine] == [v['side'] for v in want[k]['v']] and all(abs(a['px'] - b['px']) <= 0.11 for a, b in zip(mine, want[k]['v'])), (p, r)
            k += 1


def test_text_outside_the_safe_zone_is_flagged_and_inside_is_not(tmp):
    code, rep = run(EXAMPLE, tmp)
    assert all(not p['safe_violations'] for p in rep['panels'])
    doc = example_doc()
    shot(doc, 's07')['text_at'] = {'x': 0.985, 'y': 0.5}                         # centre on the right edge: half the line is outside
    code, rep = run(put(tmp, 'sl.json', doc), os.path.join(tmp, 'bad'))
    p = next(p for p in rep['panels'] if p['id'] == 's07')
    assert any(v['what'] == 'text' and v['side'] == 'right' and v['px'] > 100 for v in p['safe_violations'])
    assert any('safe zone' in w for w in p['warnings'])
    assert all(not q['safe_violations'] for q in rep['panels'] if q['id'] != 's07')


def test_a_long_honesty_label_that_leaves_the_safe_zone_is_flagged(tmp):
    doc = example_doc()
    shot(doc, 's07')['honesty'] = 'Render · fictional product · demo data only · not a real customer · no real logos shown · all names invented · not for resale'
    code, rep = run(put(tmp, 'sl.json', doc), os.path.join(tmp, 'o'))
    p = next(p for p in rep['panels'] if p['id'] == 's07')
    assert any(v['what'] == 'honesty label' and v['side'] == 'right' for v in p['safe_violations'])


def test_a_tall_frame_uses_the_conservative_zone_and_flags_a_low_caption(tmp):
    doc = example_doc()
    doc['aspect'] = '9:16'
    shot(doc, 's07')['text_at'] = {'x': 0.5, 'y': 0.93}
    d = load(DESIGN)
    code, rep = run(put(tmp, 'sl.json', doc), os.path.join(tmp, 'o'), design=put(tmp, 'd.json', d))
    assert rep['safe']['platform'] == 'conservative' and rep['safe']['canvas'] == [1080, 1920]
    p = next(p for p in rep['panels'] if p['id'] == 's07')
    assert any(v['side'] == 'bottom' for v in p['safe_violations'])


# ------------------------------------------------------------------------------------------------------------------------------ reading speed, label hold
def test_reading_speed_warns_when_a_line_is_too_fast_and_not_otherwise(tmp):
    code, rep = run(EXAMPLE, tmp)
    p = next(p for p in rep['panels'] if p['id'] == 's07')
    assert p['reading']['ok'] and p['reading']['words'] == 3 and p['reading']['wps'] == 1.0
    doc = example_doc()
    shot(doc, 's02')['text'] = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen'
    code, rep = run(put(tmp, 'sl.json', doc), os.path.join(tmp, 'bad'))
    q = next(p for p in rep['panels'] if p['id'] == 's02')
    assert q['reading']['wps'] == 5.6 and not q['reading']['ok'] and any('words/s exceeds 3.5' in w for w in q['warnings'])
    assert [p['id'] for p in rep['panels'] if not p['reading'] or p['reading']['ok']].count('s07') == 1


def test_a_hold_that_is_too_short_for_the_words_warns(tmp):
    doc = example_doc()
    shot(doc, 's06')['text'] = 'one two three four five'                          # 5 words need 0.35 + 5 x 0.28 = 1.75 s; the shot is 1.5 s (3.3 w/s: under the rate limit)
    code, rep = run(put(tmp, 'sl.json', doc), os.path.join(tmp, 'o'))
    q = next(p for p in rep['panels'] if p['id'] == 's06')
    assert q['reading']['hold_needed_s'] == 1.75 and any('need at least 1.75 s' in w for w in q['warnings']) and not any('words/s' in w for w in q['warnings'])


def test_an_honesty_label_on_screen_under_two_seconds_warns_and_a_run_of_shots_counts(tmp):
    code, rep = run(EXAMPLE, tmp)
    assert [p['id'] for p in rep['panels'] if any('honesty label shown' in w for w in p['warnings'])] == ['s05']
    doc = example_doc()
    shot(doc, 's06')['honesty'] = shot(doc, 's05')['honesty']                     # the same label over two shots: 3.0 s in a row
    code, rep = run(put(tmp, 'sl.json', doc), os.path.join(tmp, 'o'))
    assert not any('honesty label shown' in w for p in rep['panels'] for w in p['warnings'])


# ------------------------------------------------------------------------------------------------------------------------------ the lint gate
def test_the_linter_gates_the_drawing(tmp):
    doc = example_doc()
    shot(doc, 's03')['transition'] = {'kind': 'whip', 'reason': None}              # a transition with no reason is a FAIL
    sl = put(tmp, 'sl.json', doc)
    out = os.path.join(tmp, 'out')
    code, rep = run(sl, out)
    assert code == 1 and not os.path.exists(out) and rep['lint']['rc'] == 1
    code, rep = run(sl, out, allow_lint=True)
    assert code == 0 and rep['lint']['waived'] is True and os.path.exists(os.path.join(out, 'storyboard.png'))
    assert load(os.path.join(out, 'report.json'))['lint']['waived'] is True


def test_the_cli_exit_codes(tmp):
    doc = example_doc()
    shot(doc, 's03')['transition'] = {'kind': 'whip', 'reason': None}
    sl = put(tmp, 'sl.json', doc)
    cmd = [sys.executable, os.path.join(PACK, 'storyboard', 'board.py'), sl, '--out', os.path.join(tmp, 'o'), '--no-animatic', '--no-pdf']
    assert subprocess.run(cmd, capture_output=True).returncode == 1
    assert subprocess.run(cmd + ['--allow-lint'], capture_output=True).returncode == 0
    assert subprocess.run([sys.executable, os.path.join(PACK, 'storyboard', 'board.py'), os.path.join(tmp, 'nope.json')], capture_output=True).returncode == 2


# ------------------------------------------------------------------------------------------------------------------------------ timeline
def test_the_timeline_adds_up_to_the_runtime_to_the_frame():
    shots = [{'id': 'a', 'dur_s': 0.7}, {'id': 'b', 'dur_s': 0.7}, {'id': 'c', 'dur_s': 0.7}, {'id': 'd', 'dur_s': 0.7}]
    tl = core.timeline(shots, 25)
    assert sum(r['frames'] for r in tl) == core.total_frames(shots, 25) == 70
    assert [r['start_frame'] for r in tl] == [0, 18, 35, 52]
    assert [r['frames'] for r in tl] == [18, 17, 17, 18]


# ------------------------------------------------------------------------------------------------------------------------------ real key frames
def test_real_key_frames_replace_the_schematic_at_each_shots_hero_time(tmp):
    proj = os.path.join(tmp, 'tpl')
    os.makedirs(os.path.join(proj, 'out'))
    open(os.path.join(proj, 'index.html'), 'w').write('<html></html>')
    sl = example_doc()
    plan = {'seconds': 16, 'fps': 30, 'shots': [{'id': s['id'], 'start': s['start_s'], 'dur': s['dur_s']} for s in sl['shots']]}
    pp = put(os.path.join(proj, 'out'), 'plan.json', plan)
    os.environ['STORYBOARD_SNAPSHOT_CMD'] = '%s %s' % (sys.executable, STUB)
    try:
        code, rep = run(EXAMPLE, os.path.join(tmp, 'o'), plan_path=pp, hero_frac=1.5)
    finally:
        del os.environ['STORYBOARD_SNAPSHOT_CMD']
    assert code == 0 and rep['frame_source'] == 'composition' and {p['source'] for p in rep['panels']} == {'composition'}
    for p, s in zip(rep['panels'], sl['shots']):                                  # a hero time past the end is kept inside the shot, one frame before its end
        assert s['start_s'] <= p['hero_s'] <= s['start_s'] + s['dur_s'] - 1 / 30 + 1e-3
    px = Image.open(os.path.join(tmp, 'o', 'panels', 's01.png')).getpixel((480, 270))
    assert px[0] > 150 and px[1] < 90 and px[2] < 90                                 # the stub's flat red frame is what the panel shows
    assert rep['real']['timing'] == 'plan shots by id'


def test_real_frames_fall_back_to_the_schematic_when_the_browser_is_unavailable(tmp):
    proj = os.path.join(tmp, 'tpl')
    os.makedirs(os.path.join(proj, 'out'))
    open(os.path.join(proj, 'index.html'), 'w').write('<html></html>')
    pp = put(os.path.join(proj, 'out'), 'plan.json', {'seconds': 16, 'fps': 30, 'shots': []})
    os.environ['STORYBOARD_SNAPSHOT_CMD'] = '%s %s' % (sys.executable, STUB)
    os.environ['STUB_FAIL'] = '1'
    try:
        code, rep = run(EXAMPLE, os.path.join(tmp, 'o'), plan_path=pp)
        code2, _ = run(EXAMPLE, os.path.join(tmp, 'o2'), plan_path=pp, real_mode='always')
    finally:
        del os.environ['STORYBOARD_SNAPSHOT_CMD'], os.environ['STUB_FAIL']
    assert code == 0 and rep['frame_source'] == 'schematic' and any('real key frames unavailable' in n for n in rep['notes'])
    assert code2 == 2


# ------------------------------------------------------------------------------------------------------------------------------ sound intent
def test_every_sound_intent_rule_names_a_real_sound():
    mixer, meter, sweeteners, registry = animatic._music_modules()
    rules = animatic._rules()
    assert len(rules) > 30
    for r in rules:
        assert animatic.sid(r['id']) in registry.SOUNDS, r


def test_the_example_sound_lines_map_clause_by_clause_and_unmapped_clauses_are_listed(tmp):
    code, rep = run(EXAMPLE, tmp)
    ap = load(os.path.join(tmp, 'animatic.plan.json'))
    got = {(c['shot'], c['id']) for c in ap['cues']}
    assert ('s03', 'sfx/ceramic/clink') in got and ('s03', 'sfx/liquid/splash') in got and ('s03', 'sfx/voice/gasp') in got and ('s05', 'sfx/stinger/win') in got
    assert {'shot': 's04', 'clause': 'near silence'} in ap['intent_only']              # nothing is invented for a clause no rule matches
    first = next(c for c in ap['cues'] if c['shot'] == 's01')
    assert first['frame'] == 0                                                         # "typing burst on frame 0"
    assert {s['kind'] for s in ap['sweeteners']} == {'smash'}                          # cuts are silent by default; the smash transitions get the pack sweetener


def test_the_bed_sidecar_gives_a_beat_alignment_for_the_cuts(tmp):
    bed = 'bed_tech_pulse_loop8'
    man = {i['id']: i for i in load(os.path.join(PACK, 'music', 'manifest.json'))['items']}
    if not os.path.exists(os.path.join(PACK, 'music', man['music.' + bed]['file'])):
        subprocess.run([sys.executable, 'build_music.py', '--only', bed], cwd=os.path.join(PACK, 'music'), check=True, capture_output=True)
    code, rep = run(EXAMPLE, tmp, music='music/' + bed)
    ap = load(os.path.join(tmp, 'animatic.plan.json'))
    assert ap['bed']['kind'] == 'music' and ap['bed']['bpm'] == 120.0
    assert ap['beat_alignment']['cut_frames'] == [75, 150, 240, 300, 345, 390]
    assert all(d == 0 for d in ap['beat_alignment']['frames_from_nearest_beat'])         # 120 BPM at 30 fps: a beat every 15 frames, every cut of the example is a multiple of 15
    assert ap['beat_alignment']['share_within_2_frames'] == 1.0


# ------------------------------------------------------------------------------------------------------------------------------ the animatic
def mini_doc():
    d = example_doc()
    d['fps'] = 25
    d['length_s'] = 2.8
    d['turn'] = {'at_s': 1.4, 'what': 'the screen wakes'}
    d['shots'] = [
        {'id': 'a1', 'beat': 'HOOK', 'role': 'stake', 'dur_s': 0.7, 'scale': 'WS', 'action': 'the worker types', 'sound': 'typing burst on frame 0', 'text': '', 'text_kind': 'super',
         'honesty': None, 'transition': {'kind': 'cut', 'reason': None}},
        {'id': 'a2', 'beat': 'ESC', 'role': 'stake', 'dur_s': 0.7, 'scale': 'MS', 'action': 'the mug tips', 'sound': 'ceramic clink; splash', 'text': '', 'text_kind': 'super',
         'honesty': None, 'camera': 'push in', 'transition': {'kind': 'cut', 'reason': None}},
        {'id': 'a3', 'beat': 'TURN', 'role': 'turn', 'dur_s': 0.7, 'scale': 'CU', 'action': 'the screen wakes', 'sound': 'a bright win sting', 'text': '', 'text_kind': 'super',
         'honesty': None, 'transition': {'kind': 'dissolve', 'reason': 'EMOTION: relief'}},
        {'id': 'a4', 'beat': 'CARD', 'role': 'payoff', 'dur_s': 0.7, 'scale': 'CARD', 'action': 'the line', 'sound': 'two-note sonic sting', 'text': 'Saved.', 'text_kind': 'card',
         'honesty': 'Render', 'transition': {'kind': 'cut', 'reason': None}}]
    return d


def ffprobe_frames(p):
    return animatic.probe(p)


@pytest.fixture(scope='module')
def mini_build():
    d = tempfile.mkdtemp(prefix='sb-mini-')
    sl = put(d, 'sl.json', mini_doc())
    code, rep = board.build(sl, None, out=os.path.join(d, 'out'), make_pdf=False, allow_lint=True, log=lambda *a: None)
    assert code == 0
    yield d, rep
    shutil.rmtree(d, ignore_errors=True)


def test_animatic_has_exactly_the_shot_sum_in_frames_and_audio_samples(mini_build):
    d, rep = mini_build
    m = rep['animatic']['measured']
    mp4 = os.path.join(d, 'out', 'animatic.mp4')
    pr = animatic.probe(mp4)
    assert pr['frames'] == m['frames'] == m['expected_frames'] == 70                    # round(2.8 s x 25 fps); per-shot rounding would give 72
    assert abs(pr['duration_s'] - 2.8) <= 1 / 25 + 1e-6
    assert m['audio_samples_master'] == m['audio_samples_expected'] == 70 * 1920
    dec = animatic.decode_mp4(mp4)
    assert abs(len(dec) - 70 * 1920) <= 1920                                            # the AAC file is within one frame of the picture
    ap = load(os.path.join(d, 'out', 'animatic.plan.json'))
    assert ap['frames'] == 70 and [s['start_frame'] for s in ap['shots']] == [0, 18, 35, 52]


def test_animatic_loudness_is_the_pack_spec_measured_on_the_delivered_mp4(mini_build):
    d, rep = mini_build
    mixer, meter, sweeteners, registry = animatic._music_modules()
    dec = animatic.decode_mp4(os.path.join(d, 'out', 'animatic.mp4'))
    assert abs(meter.lufs_integrated(dec) - (-14.0)) <= 0.5
    assert meter.true_peak_db(dec) <= -1.0
    assert rep['animatic']['measured']['delivered_lufs_i'] == pytest.approx(meter.lufs_integrated(dec), abs=0.01)


def test_the_click_track_is_the_bed_when_there_is_none_and_the_cues_are_on_the_shot_starts(mini_build):
    d, rep = mini_build
    ap = load(os.path.join(d, 'out', 'animatic.plan.json'))
    assert ap['bed']['kind'] == 'click' and ap['bed']['bpm'] == 120 and ap['bed']['chosen_by'] == 'default'
    by = {(c['shot'], c['id']): c['frame'] for c in ap['cues']}
    assert by[('a1', 'sfx/ui/typing_burst')] == 0 and by[('a2', 'sfx/ceramic/clink')] == 18 and by[('a2', 'sfx/liquid/splash')] == 18 + 17 // 2
    assert by[('a3', 'sfx/stinger/win')] == 35 and by[('a4', 'sfx/logo/two_note')] == 52
    assert ap['shots'][2]['transition'] == {'kind': 'dissolve', 'reason': 'EMOTION: relief', 'render': 'fade', 'frames': 8}
    assert {'kind': 'dissolve', 'frame': 35, 'duration_frames': 8, 'shot': 'a3'} in ap['sweeteners']


def test_timecode_and_shot_id_are_burnt_into_the_picture(mini_build, tmp):
    d, rep = mini_build
    mp4 = os.path.join(d, 'out', 'animatic.mp4')
    fr = []
    for n in (3, 4):                                                                   # two frames of the same shot: only the timecode changes
        p = os.path.join(tmp, 'f%d.png' % n)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, '-vf', 'select=eq(n\\,%d)' % n, '-frames:v', '1', p], check=True)
        fr.append(np.asarray(Image.open(p).convert('L'), float))
    diff = np.abs(fr[0] - fr[1]) > 40
    assert diff.any()
    ys, xs = np.nonzero(diff)
    assert ys.max() < 60 and xs.max() < 520                                              # inside the burnt-in bar at the top left, nowhere else
    bar = fr[0][8:30, 8:200]
    assert bar.min() < 60 and bar.max() > 200                                           # dark bar, white text


def test_a_music_bed_plays_through_the_whole_animatic(tmp):
    bed = 'bed_tech_pulse_loop8'
    man = {i['id']: i for i in load(os.path.join(PACK, 'music', 'manifest.json'))['items']}
    if not os.path.exists(os.path.join(PACK, 'music', man['music.' + bed]['file'])):
        subprocess.run([sys.executable, 'build_music.py', '--only', bed], cwd=os.path.join(PACK, 'music'), check=True, capture_output=True)
    doc = mini_doc()
    for s in doc['shots']:
        s['sound'] = 'near silence'                                                    # no cue matches: the bed is all there is
        s['transition'] = {'kind': 'cut', 'reason': None}
    code, rep = board.build(put(tmp, 'sl.json', doc), None, out=os.path.join(tmp, 'o'), make_pdf=False, allow_lint=True, music='music/' + bed, log=lambda *a: None)
    assert code == 0 and load(os.path.join(tmp, 'o', 'animatic.plan.json'))['cues'] == []
    dec = animatic.decode_mp4(os.path.join(tmp, 'o', 'animatic.mp4'))
    for a, b in ((0.3, 0.6), (1.2, 1.5), (2.0, 2.5)):
        seg = dec[int(a * 48000):int(b * 48000)]
        assert 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12) > -35, (a, b)       # a bed cut short, or never looped, leaves silence here
    assert rep['animatic']['measured']['frames'] == 70


def test_the_plan_is_the_same_bytes_twice(mini_build, tmp):
    d, rep = mini_build
    code, rep2 = board.build(os.path.join(d, 'sl.json'), None, out=os.path.join(tmp, 'o'), make_animatic=False, make_pdf=False, allow_lint=True, log=lambda *a: None)
    assert open(os.path.join(tmp, 'o', 'animatic.plan.json'), 'rb').read() == open(os.path.join(d, 'out', 'animatic.plan.json'), 'rb').read()


# ------------------------------------------------------------------------------------------------------------------------------ the committed worked example
def test_the_committed_worked_example_is_what_the_tool_makes_from_the_example_shot_list(tmp):
    code, rep = run(EXAMPLE, tmp)
    assert open(os.path.join(tmp, 'animatic.plan.json'), 'rb').read() == open(os.path.join(COMMITTED, 'animatic.plan.json'), 'rb').read()
    png = Image.open(os.path.join(COMMITTED, 'storyboard.png'))
    mine = Image.open(os.path.join(tmp, 'storyboard.png'))
    assert png.size == mine.size and os.path.getsize(os.path.join(COMMITTED, 'storyboard.png')) > 50000
    c = load(os.path.join(COMMITTED, 'report.json'))
    assert [p['id'] for p in c['panels']] == [p['id'] for p in rep['panels']] and c['summary']['warnings'] == rep['summary']['warnings']
