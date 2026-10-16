#!/usr/bin/env python3
"""tools/describe: the audio-description script. Lines sit in speech gaps and never overlap speech or each other; author lines beat drafts;
what does not fit becomes an extended-AD pause at a word boundary; the extended picture is checked on a real 1-second clip.
Run: python3 -m pytest -q tools/tests/test_describe.py"""
import os
import shutil
import subprocess
import sys

import pytest

TOOLS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, TOOLS)
from describe import core, export                              # noqa: E402

FF = shutil.which('ffmpeg')
PLAN = {'seconds': 12, 'fps': 30,
        'shots': [{'id': 'a', 'start': 0, 'dur': 4, 'text': 'Out of *beans*.'}, {'id': 'b', 'start': 4, 'dur': 4, 'ad': 'A hand tips an empty bag over a mug.'},
                  {'id': 'c', 'start': 8, 'dur': 4}],
        'overlays': [{'id': 'lowerThird.cleanBar', 'at': 8.2, 'dur': 2, 'params': {'name': 'Placeholder Name', 'role': 'Founder'}},
                     {'id': 'ui.waveform', 'at': 0, 'dur': 12, 'params': {}}]}
WORDS = [{'w': 'hello', 's': 1.0, 'e': 1.4}, {'w': 'there', 's': 1.45, 'e': 1.9}, {'w': 'friend', 's': 5.0, 'e': 7.8}, {'w': 'end', 's': 8.1, 'e': 11.6}]


def test_items_prefer_author_lines_and_label_drafts():
    it = {i['id']: i for i in core.describe_items(PLAN)}
    assert it['b']['text'] == 'A hand tips an empty bag over a mug.' and not it['b']['draft']
    assert it['a']['draft'] and it['a']['text'] == 'On screen: "Out of beans."'          # accent marks stripped
    assert 'Placeholder Name' in it['c']['text'] and 'waveform' not in it['c']['text']   # long-lived HUD parts are skipped


def test_shotlist_action_is_used_when_the_plan_has_none():
    sl = {'shots': [{'id': 'a', 'start_s': 0, 'dur_s': 4, 'action': 'the worker types fast; the mug edges closer', 'text': ''}]}
    it = core.describe_items({'seconds': 4}, sl)
    assert it[0]['text'].startswith('The worker types fast') and not it[0]['draft']


def test_placement_stays_in_gaps():
    items = core.describe_items(PLAN)
    rep = core.place(items, WORDS, 12)
    for p in rep['placed']:
        for w in WORDS:
            assert p['end'] <= w['s'] + 1e-6 or p['start'] >= w['e'] - 1e-6, (p, w)      # never over speech
    spans = sorted((p['start'], p['end']) for p in rep['placed'])
    assert all(a[1] <= b[0] + 1e-9 for a, b in zip(spans, spans[1:]))                  # never over each other


def test_unfit_lines_become_pauses_at_word_boundaries():
    words = [{'w': 'talk', 's': 0.0, 'e': 3.95}, {'w': 'more', 's': 4.0, 'e': 12.0}]
    rep = core.place(core.describe_items(PLAN), words, 12)
    assert rep['unplaced']
    ext = core.extend(rep, words)
    for p in ext['pauses']:
        assert not any(w['s'] < p['at'] < w['e'] for w in words)                         # never inside a word
    assert ext['added_s'] == pytest.approx(sum(p['dur'] for p in ext['pauses']))
    assert all(c['paused'] for c in ext['cues'] if c['id'] in {u['id'] for u in rep['unplaced']})


def test_vtt_is_a_descriptions_track(tmp_path):
    rc = export.main(['--plan', _write(tmp_path, PLAN), '--out', str(tmp_path / 'ad')])
    assert rc == 0
    v = (tmp_path / 'ad' / 'ad.en.vtt').read_text()
    assert v.startswith('WEBVTT') and 'kind=descriptions' in v and 'No synthesised voice' in v
    assert 'No voice is synthesised' in (tmp_path / 'ad' / 'ad.en.txt').read_text()


def _write(tmp_path, plan):
    import json
    p = tmp_path / 'plan.json'
    p.write_text(json.dumps(plan))
    return str(p)


@pytest.mark.skipif(FF is None, reason='ffmpeg not installed')
def test_extended_picture_pauses_on_a_one_second_clip(tmp_path):
    src = str(tmp_path / 'in.mp4')
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=128x72:r=30:d=1', '-f', 'lavfi', '-i', 'sine=f=440:r=48000:d=1',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src], check=True)
    out = str(tmp_path / 'ext.mp4')
    args = core.ffmpeg_extended(src, [{'at': 0.5, 'dur': 0.5}], out, 1.0)
    subprocess.run([FF] + args, check=True)
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
    assert d == pytest.approx(1.5, abs=0.08)
