#!/usr/bin/env python3
"""v0.6 fixes found by running the real pipeline on a film (each failed before its fix):
  - the turn-window check divided a percent range by 100 twice (rule_params already makes [30, 80] fractions), so a turn at 31 % warned;
  - mp lint reused the eyes / ears reports saved next to a render even after the render was replaced at the same path;
  - mp brief counted negated phrases ("no voice-over") and meta lines (tone, brand) as signals and ranked a pre-launch brief trailer / beat-edit.
Run: python3 -m pytest -q tools/tests/test_v06_fixes.py"""
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(PACK, 'tools'))
import playbook_lib as L  # noqa: E402
import playbook_checks as K  # noqa: E402
import playbook_lint as PL  # noqa: E402
import playbook_research as R  # noqa: E402

FMTS = L.load_formats(L.playbook_dir(None))
RULES = L.rules_by_id(L.playbook_dir(None))


# ---------------------------------------------------------------- turn window

def _shotlist(turn_at, length=20.0):
    shots = [{'id': 's1', 'role': 'hook', 'dur_s': turn_at}, {'id': 's2', 'role': 'turn', 'dur_s': length - turn_at - 4}, {'id': 's3', 'role': 'payoff', 'dur_s': 4}]
    return {'length_s': length, 'fps': 30, 'turn': {'at_s': turn_at}, 'shots': shots}


def _turn_rows(sl):
    r = RULES['story.one_turn_in_window']
    ctx = K.Ctx(plan={'seconds': sl['length_s']}, shotlist=sl)
    return K.run_check(r['enforce']['check'], ctx, L.rule_params(r, None, K.CHECKS[r['enforce']['check']]['params']))


def test_turn_window_params_are_fractions_once():
    r = RULES['story.one_turn_in_window']
    p = L.rule_params(r, None, K.CHECKS[r['enforce']['check']]['params'])
    assert p['turn_window_pct'] == [0.3, 0.8], p   # the rule writes [30, 80]; rule_params makes it fractions
    import playbook_checks_extra as X
    seen = {}
    orig = X.subprocess.run

    def spy(cmd, **kw):
        if cmd and cmd[-1].endswith('.json') and 'lint_shotlist' in ' '.join(cmd):
            seen['lint'] = json.load(open(cmd[-1]))['lint']
        return orig(cmd, **kw)
    X.subprocess.run = spy
    try:
        _turn_rows(_shotlist(6.2))
    finally:
        X.subprocess.run = orig
    assert seen['lint']['turn_window'] == [0.3, 0.8], seen   # was [0.003, 0.008]


def test_a_turn_at_31_percent_is_inside_the_window():
    sl = _shotlist(6.2)   # 31 % of 20 s
    v, val, _ = _turn_rows(sl)
    assert v == 'pass' or 'turn' not in val, (v, val)
    v, val, _ = _turn_rows(_shotlist(2.0))   # 10 %: outside
    assert v in ('warn', 'fail') and 'turn' in val, (v, val)


# ---------------------------------------------------------------- stale eyes / ears reports

def _fake_render(d, payload):
    mp4 = os.path.join(d, 'film-16x9.mp4')
    with open(mp4, 'wb') as f:
        f.write(payload)
    return mp4


def test_a_report_for_an_older_render_is_not_reused(tmp_path):
    d = str(tmp_path)
    mp4 = _fake_render(d, b'first render')
    rep = {'checks': [{'id': 'eyes/frame0', 'status': 'fail'}]}
    json.dump(rep, open(mp4[:-4] + '.eyes.json', 'w'))
    json.dump({'eyes': PL.render_key(mp4)}, open(mp4[:-4] + '.reports.json', 'w'))
    assert PL.fresh_report(mp4, 'eyes') == rep                       # keyed on this render: reused
    time.sleep(0.02)
    _fake_render(d, b'second render, same path')                     # re-rendered: the saved report is stale
    assert PL.fresh_report(mp4, 'eyes') is None
    os.remove(mp4[:-4] + '.reports.json')                            # no key: fresh only when newer than the render
    assert PL.fresh_report(mp4, 'eyes') is None
    time.sleep(0.02)
    json.dump(rep, open(mp4[:-4] + '.eyes.json', 'w'))
    assert PL.fresh_report(mp4, 'eyes') == rep


def test_load_target_measures_again_when_the_report_is_stale(tmp_path, monkeypatch):
    d = str(tmp_path)
    mp4 = _fake_render(d, b'old')
    json.dump({'checks': [{'id': 'ears/loudness', 'status': 'fail'}]}, open(mp4[:-4] + '.ears.json', 'w'))
    json.dump({'checks': [{'id': 'eyes/frame0', 'status': 'fail'}]}, open(mp4[:-4] + '.eyes.json', 'w'))
    time.sleep(0.02)
    _fake_render(d, b'new render')
    calls = []
    monkeypatch.setattr(PL, 'measure', lambda path, tool, plan: calls.append(tool) or {'checks': [{'id': '%s/x' % tool, 'status': 'pass'}]})
    monkeypatch.setattr(PL, 'probe', lambda path, eyes=None: {'width': 1920, 'height': 1080, 'duration': 1})
    plan, _, ears, eyes, _, _ = PL.load_target(mp4)
    assert sorted(calls) == ['ears', 'eyes'] and ears['checks'][0]['status'] == 'pass' and eyes['checks'][0]['status'] == 'pass'


# ---------------------------------------------------------------- mp brief: negation, meta lines, goal and audience weight

BRIEF = os.path.join(HERE, 'fixtures', 'briefs', 'pre-launch-office-suite.md')


def test_the_pre_launch_brief_picks_launch_film():
    rk = R.classify(open(BRIEF, encoding='utf-8').read(), FMTS)
    assert rk[0][1] == 'launch-film', rk[:3]
    assert rk[0][0] >= rk[1][0] + 2, rk[:3]                       # a clear pick: no question asked
    assert not R.questions(rk, FMTS, None, None)
    top = dict((f, w) for _, f, w in rk)
    assert not any('music' in w or 'brand' in w for w in top['beat-edit']), top['beat-edit']   # meta lines (tone, brand) carry no signal


def test_negated_phrases_are_not_signals():
    fms = {'talking-head': FMTS['talking-head'], 'launch-film': FMTS['launch-film']}
    with_neg = R.classify('a launch film for our app, no podcast, not a talking head', fms)
    assert with_neg[0][1] == 'launch-film' and not any('podcast' in w for _, f, ws in with_neg for w in ws), with_neg
    assert 'voice' not in R._negate('no voice-over, music and sound design') and 'music' in R._negate('no voice-over, music and sound design')
    assert 'demo' not in R._negate('not a book a demo film')


def test_weak_words_count_less_than_goal_and_audience():
    rk = R.classify('**Goal:** launch\n**Who it is for:** founders and engineering teams\nA hype film series', FMTS)
    assert rk[0][1] == 'launch-film', rk[:3]
    tr = next(w for _, f, w in rk if f == 'trailer')
    assert all('(weak)' in x for x in tr if x.startswith('keyword')), tr
