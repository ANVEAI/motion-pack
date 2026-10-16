"""ears/checks_ab.py on synthetic stems (numpy only, a few seconds each): the before / after audio swap of cuts/story78.py abReplay.
The 'before' stem is low-passed pink noise, the 'after' stem is full-band pink noise, each scaled to a stated LUFS; the file is stem A then stem B, with the switch on a chosen frame.
Every check can fail: the tests change the level, move the switch, make the stems identical, drop the plan block and edit the story plan.
Run: python3 -m pytest -q ears/tests/test_ab_replay.py"""
import os
import sys

import numpy as np
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, PACK)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(PACK, 'cuts'))
import synth as s  # noqa: E402
from ears.listen import analyze  # noqa: E402
from ears import core, checks_ab  # noqa: E402
import story78  # noqa: E402

SR = 48000
FPS = 30


def scaled(y, lufs):
    x = s.st(y)
    return y * 10 ** ((lufs - core.meter.lufs_integrated(x)) / 20)


def file_of(a, b, shift_frames=0):
    """stem A then stem B, the switch `shift_frames` after the 90-frame boundary (negative = early)"""
    cut = int((90 + shift_frames) * SR / FPS)
    full_a = np.concatenate([a, a])[:cut] if cut > len(a) else a[:cut]
    y = np.concatenate([full_a, b[:len(a) + len(b) - cut] if cut < len(a) else b])
    return s.st(y[:len(a) + len(b)])


def plan(mode='replay', a=(0, 90), b=(90, 180), flip=90, tol=1.0):
    return {'fps': FPS, 'audio': {'abReplay': {'fps': FPS, 'mode': mode, 'flip_frame': flip, 'a': list(a), 'b': list(b), 'tol_db': tol, 'gain_b_db': 0.0}}}


def ab(rep):
    return next(c for c in rep['checks'] if c['id'] == 'ears/ab_replay')


def stems(la=-23.0, lb=-23.0, sec=3.0):
    return scaled(s.lowpass(s.pink(sec, 1, -23.0), 3000.0), la), scaled(s.pink(sec, 2, -23.0), lb)


def test_matched_levels_and_a_switch_on_the_flip_frame_pass():
    a, b = stems()
    c = ab(analyze(file_of(a, b), FPS, plan=plan()))
    assert c['status'] == 'pass', c['issues']
    assert abs(c['measured']['diff_db']) <= 0.3
    assert abs(c['measured']['offset_frames']) <= 0.5, c['measured']
    assert c['measured']['prominence'] >= 2.5


@pytest.mark.parametrize('db, status', [(0.5, 'pass'), (1.5, 'warn'), (2.6, 'fail'), (-3.0, 'fail')])
def test_level_difference_thresholds(db, status):
    a, b = stems(-23.0, -23.0 + db)
    c = ab(analyze(file_of(a, b), FPS, plan=plan()))
    lvl = [i for i in c['issues'] if i.get('kind') == 'level']
    got = 'pass' if not lvl else max((i['severity'] for i in lvl), key={'warn': 1, 'fail': 2}.get)
    assert got == status, (c['measured'], c['issues'])
    if lvl:
        assert ('louder' if db > 0 else 'quieter') in lvl[0]['listener']


def test_a_louder_second_half_says_so_with_the_gain_to_apply():
    a, b = stems(-23.0, -20.0)
    i = [q for q in ab(analyze(file_of(a, b), FPS, plan=plan()))['issues'] if q.get('kind') == 'level'][0]
    assert i['severity'] == 'fail' and 'louder' in i['listener'] and '+-3.0' not in i['fix'] and '-3.0' in i['fix']


@pytest.mark.parametrize('shift, status', [(0, 'pass'), (1, 'pass'), (-1, 'pass'), (2, 'warn'), (3, 'fail'), (-3, 'fail'), (6, 'fail')])
def test_the_switch_must_land_on_the_flip_frame(shift, status):
    a, b = stems()
    c = ab(analyze(file_of(a, b, shift), FPS, plan=plan()))
    fl = [i for i in c['issues'] if i.get('kind') == 'flip']
    got = 'pass' if not fl else max((i['severity'] for i in fl), key={'warn': 1, 'fail': 2}.get)
    # a shift of exactly one frame is at the edge of the 1-frame pass (the detector localises to about 5 ms): pass or warn, never fail
    if abs(shift) == 1:
        assert got in ('pass', 'warn'), c['measured']
    else:
        assert got == status, (shift, c['measured'], c['issues'])
    assert c['measured']['offset_frames'] == pytest.approx(shift, abs=0.45)


def test_identical_stems_have_no_audible_change_to_place():
    a, _ = stems()
    c = ab(analyze(file_of(a, a), FPS, plan=plan()))
    assert any('no clear change' in i['what'] for i in c['issues']), c['measured']
    assert c['status'] in ('warn', 'fail')


def test_flip_mode_measures_a_window_either_side_and_a_wrong_frame_fails():
    a, b = stems(sec=4.0)
    x = s.st(np.concatenate([a[:int(2 * SR)], b[int(2 * SR):int(4 * SR)]]))
    ok = ab(analyze(x, FPS, plan=plan('flip', (0, 60), (60, 120), 60)))
    assert ok['status'] == 'pass', ok['issues']
    bad = ab(analyze(x, FPS, plan=plan('flip', (0, 75), (75, 120), 75)))
    assert any(i['severity'] == 'fail' and 'frames' in i['what'] for i in bad['issues']), bad['measured']


def test_not_planned_is_not_applicable_and_a_bad_block_is_ignored():
    a, b = stems()
    x = file_of(a, b)
    assert ab_missing(analyze(x, FPS))
    assert ab_missing(analyze(x, FPS, plan={'fps': FPS, 'audio': {'abReplay': {'flip_frame': 'x'}}}))
    assert ab_missing(analyze(x, FPS, plan={'fps': FPS, 'audio': {'abReplay': {'fps': 30, 'mode': 'sideways', 'flip_frame': 90, 'a': [0, 90], 'b': [90, 180]}}}))
    assert checks_ab.ab_replay({'ab': None})['status'] == 'n/a'


def ab_missing(rep):
    return not any(c['id'] == 'ears/ab_replay' for c in rep['checks'])


def test_a_silent_half_fails_and_a_tiny_half_is_not_measurable():
    a, b = stems()
    c = ab(analyze(file_of(a, np.zeros_like(b)), FPS, plan=plan()))
    assert any(i['severity'] == 'fail' and 'no audible' in i['what'] for i in c['issues'])
    short = ab(analyze(file_of(a, b), FPS, plan=plan(a=(0, 5), b=(90, 95))))
    assert short['measured']['lufs_a'] is None and any('not measurable' in n for n in short['notes'])


def test_the_story_plan_feeds_the_check():
    """cuts/story78.py plan_audio is exactly what ears reads: a file built to the plan passes; the gain it asks for on stem B is what brings the halves together"""
    a, b = stems(-23.0, -25.5)
    r0 = story78.ab_replay(3.0, FPS, 'replay', lufs_a=-23.0, lufs_b=-25.5)
    g = r0['audio']['tracks'][1]['gain_db']
    assert g == pytest.approx(2.5)
    x = file_of(a, b * 10 ** (g / 20))
    c = ab(analyze(x, FPS, plan={'fps': FPS, 'audio': r0['plan_audio']}))
    assert c['status'] == 'pass', (c['measured'], c['issues'])
    assert c['measured']['flip_s'] == pytest.approx(r0['flip']['frame'] / FPS)
    c0 = ab(analyze(file_of(a, b), FPS, plan={'fps': FPS, 'audio': r0['plan_audio']}))
    assert any(i.get('kind') == 'level' for i in c0['issues'])             # without the gain the 2.5 dB gap is reported


def test_the_report_and_the_manifest_know_the_check():
    import json
    m = json.load(open(os.path.join(PACK, 'ears', 'manifest.json')))
    assert 'ears/ab_replay' in m['checks'] and 'ab_replay' in m['spec']
    assert m['spec']['ab_replay']['tol_db'] == 1.0
    a, b = stems()
    rep = analyze(file_of(a, b), FPS, plan=plan())
    from ears import report
    assert 'ears/ab_replay' in report.markdown(rep) and rep['scores']['sync'] is not None
