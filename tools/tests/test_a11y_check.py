#!/usr/bin/env python3
"""tools/a11y_check.py and tools/a11y/cvd.py on tiny synthetic fixtures: planned flashes, the measured flash count through eyes on a 1-second
strobe clip, caption contrast against frame pixels (with and without a scrim), size and reading-time floors, colour-blind collapse, colour-only meaning.
Run: python3 -m pytest -q tools/tests/test_a11y_check.py"""
import os
import shutil
import subprocess
import sys

import numpy as np
import pytest

TOOLS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, TOOLS)
sys.path.insert(0, os.path.dirname(TOOLS))
import a11y_check as A                                          # noqa: E402
from a11y import cvd                                            # noqa: E402

FF = shutil.which('ffmpeg')


# ------------------------------------------------------------------------------------------------ colour maths
def test_ciede2000_matches_the_published_test_pairs():
    # Sharma, Wu & Dalal (2005) test data, pairs 1, 7 and 34
    assert cvd.de2000_lab((50, 2.6772, -79.7751), (50, 0, -82.7485)) == pytest.approx(2.0425, abs=1e-4)
    assert cvd.de2000_lab((50, 0, 0), (50, -1, 2)) == pytest.approx(2.3669, abs=1e-4)
    assert cvd.de2000_lab((2.0776, 0.0795, -1.135), (0.9033, -0.0636, -0.5514)) == pytest.approx(0.9082, abs=1e-4)


def test_simulation_keeps_neutrals_and_collapses_a_confusion_pair():
    for k in cvd.KINDS:
        assert cvd.simulate('#FFFFFF', k) == '#FFFFFF' and cvd.simulate('#000000', k) == '#000000'
    red, green = '#D62728', '#2CA02C'                               # a common chart red and green
    assert cvd.de2000(red, green) > 50
    assert cvd.de2000(cvd.simulate(red, 'deutan'), cvd.simulate(green, 'deutan')) < 10
    assert cvd.de2000(cvd.simulate('#1F4E9E', 'deutan'), cvd.simulate('#F2B705', 'deutan')) > 40   # blue vs amber survives


def test_wcag_ratio():
    assert cvd.wcag('#FFFFFF', '#000000') == pytest.approx(21.0)
    assert cvd.wcag('#777777', '#FFFFFF') == pytest.approx(4.48, abs=0.01)


# ------------------------------------------------------------------------------------------------ checks
def test_colour_blind_flags_red_green_but_not_blue_amber():
    bad = A.check_colour_blind({'palette': {'paper': '#FFFFFF', 'error': '#D62728', 'success': '#2CA02C'}})
    assert bad['status'] == 'warn' and 'deutan' in bad['issues'][0]['what']
    ok = A.check_colour_blind({'palette': {'paper': '#FFFFFF', 'accent': '#1F4E9E', 'warning': '#F2B705'}})
    assert ok['status'] == 'pass' and ok['measured']['pairs_tested'] == 1


def test_colour_only_needs_cues_and_labels():
    d = {'palette': {'success': '#0F766E', 'error': '#B42318'}, 'a11y': {'cues': {'success': 'tick icon'}}}
    plan = {'overlays': [{'id': 'chart.donut', 'at': 1, 'params': {'colors': ['#111111', '#222222', '#333333'], 'labels': ['a', 'b']}},
                         {'id': 'chart.race', 'at': 2, 'params': {'colors': ['#111111', '#222222'], 'labels': ['a', 'b']}}]}
    r = A.check_colour_only(d, plan)
    whats = ' | '.join(i['what'] for i in r['issues'])
    assert '"error"' in whats and '"success"' not in whats                    # the declared cue clears success
    assert 'chart.donut colour-codes 3 items' in whats and 'chart.race' not in whats


def test_planned_flashes_over_three_a_second_fail():
    shots = [{'start': 0.0, 'tx': 'transitions/cut'}] + [{'start': 1 + 0.2 * i, 'tx': 'transitions/flash'} for i in range(5)]
    r = A.check_flash_plan({'shots': shots})
    assert r['status'] == 'fail' and r['measured']['max_per_s'] == 5 and r['issues'][0]['t'] == [1.0, 2.0]
    ok = A.check_flash_plan({'shots': [{'start': i * 0.5, 'tx': 'transitions/flash'} for i in range(4)], 'overlays': [{'id': 'fx.impactFrame', 'at': 9}]})
    assert ok['status'] == 'pass' and ok['measured']['planned_flashes'] == 5


@pytest.mark.skipif(FF is None, reason='ffmpeg not installed')
def test_measured_flashes_come_from_eyes(tmp_path):
    src = str(tmp_path / 'strobe.mp4')                         # black / white every 3 frames = 5 flashes a second
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', "color=c=black:s=96x54:r=30:d=1,geq=lum='if(lt(mod(N\\,6)\\,3)\\,16\\,235)':cb=128:cr=128",
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src], check=True)
    r = A.check_flash_plan({}, src)
    assert r['status'] == 'fail' and r['measured']['eyes']['general']['max_per_s'] > 3


def test_caption_contrast_with_and_without_scrim():
    white_bg = np.full((20, 80, 3), 245, np.uint8)
    r_plain, _, _ = A.caption_contrast(white_bg, '#FFFFFF', None)
    r_scrim, _, _ = A.caption_contrast(white_bg, '#FFFFFF', ((0, 0, 0), 194 / 255.0))
    assert r_plain < 1.2 and r_scrim > 4.5
    busy = np.zeros((20, 80, 3), np.uint8)
    busy[:, 40:] = 255                                          # half black, half white: the worst side counts
    assert A.caption_contrast(busy, '#FFFFFF', None)[0] < 1.1


@pytest.mark.skipif(FF is None, reason='ffmpeg not installed')
def test_caption_contrast_reads_the_frame_behind_the_box(tmp_path):
    src = str(tmp_path / 'bright.mp4')
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=192x108:r=30:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', src], check=True)
    ev = [{'start': 0.1, 'end': 0.9, 'lines': ['Hello'], 'box': [40, 80, 150, 100], 'frame': [192, 108]}]
    assert A.check_caption_contrast(ev, src, 'plain')['status'] == 'fail'
    assert A.check_caption_contrast(ev, src, 'burn')['status'] == 'pass'


def test_text_size_and_reading_time():
    plan = {'size': [1080, 1920], 'texts': [{'text': 'Too small', 't': [0, 3], 'fontPx': 40, 'role': 'read'},
                                            {'text': 'Fine and big', 't': [3, 6], 'fontPx': 72, 'role': 'read'},
                                            {'text': 'one two three four five six', 't': [6, 6.8], 'fontPx': 72, 'role': 'read'}]}
    s = A.check_text_size(plan)
    assert s['status'] == 'fail' and len(s['issues']) == 1 and 'Too small' in s['issues'][0]['what']
    r = A.check_reading_time(plan)
    assert r['status'] == 'fail' and 'one two three' in r['issues'][0]['what']


def test_cli_end_to_end(tmp_path):
    import json
    p = tmp_path / 'plan.json'
    p.write_text(json.dumps({'size': [1920, 1080], 'texts': [{'text': 'Readable line', 't': [0, 3], 'fontPx': 60, 'role': 'read'}]}))
    d = tmp_path / 'design.json'
    d.write_text(json.dumps({'palette': {'paper': '#FFFFFF', 'ink': '#111111', 'accent': '#1F4E9E'}}))
    rc = A.main(['--plan', str(p), '--design', str(d), '--json', str(tmp_path / 'r.json'), '--md', str(tmp_path / 'r.md')])
    rep = json.loads((tmp_path / 'r.json').read_text())
    assert rc == 0 and rep['status'] == 'pass' and (tmp_path / 'r.md').read_text().startswith('# Accessibility check')
