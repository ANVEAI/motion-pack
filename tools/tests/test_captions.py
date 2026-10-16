#!/usr/bin/env python3
"""tools/captions: segmentation, line breaks, timing, SDH, placement, the three file formats (and their parsers), the validator and a real burn-in
on a 1-second synthetic clip. Run: python3 -m pytest -q tools/tests/test_captions.py"""
import json
import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

import pytest

TOOLS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, TOOLS)
from a11y import safezones                                       # noqa: E402
from captions import burn, core, formats, validate             # noqa: E402

PACK = os.path.dirname(TOOLS)
FF = shutil.which('ffmpeg')


def W(text, t0=0.0, step=0.3, speaker=None):
    """words with even timing: each word lasts 0.25 s, starts every `step` s"""
    out = []
    for i, w in enumerate(text.split()):
        out.append({'w': w, 's': round(t0 + i * step, 3), 'e': round(t0 + i * step + 0.25, 3), 'speaker': speaker})
    return out


def test_safe_table_is_read_from_the_js_source():
    t = safezones.table()
    assert t['conservative'] == {'ref': 'tall', 'top': 269.0, 'bottom': 672.0, 'left': 65.0, 'right': 120.0}
    r = safezones.rect('conservative', 1080, 1920)
    assert (r['x0'], r['y0'], r['x1'], r['y1']) == (65.0, 269.0, 960.0, 1248.0)
    sq = safezones.rect('linkedin.video', 1080, 1080)                 # a plan.mjs preset (fractions)
    assert abs(sq['y1'] - 972.0) < 1e-6


def test_short_text_stays_on_one_line():
    assert core.break_lines(['Hello', 'there.'], 42) == (['Hello there.'], 0.0)


def test_line_break_avoids_ending_on_a_function_word():
    toks = 'I opened the settings file and then I saved the whole thing'.split()
    lines, _ = core.break_lines(toks, 42)
    assert all(len(x) <= 42 for x in lines) and len(lines) == 2
    assert not core.glue_end(lines[0].split()[-1]), lines


def test_line_break_prefers_punctuation():
    toks = 'Well, we open the settings file in the sidebar.'.split()
    lines, _ = core.break_lines(toks, 42)
    assert lines[0].endswith(','), lines


def test_cannot_fit_returns_none():
    assert core.break_lines(['x' * 50], 42) is None
    assert core.break_lines('aaaa bbbb cccc dddd'.split(), 8, max_lines=2) is None


def test_events_respect_every_limit_and_break_at_sentences():
    o = core.options(fps=30)
    words = W('This is the first sentence of the demo. And here is a second one that runs a little longer than the first. Short end.')
    evs = core.build_events(words, o)
    for e in evs:
        assert len(e['lines']) <= 2 and all(len(x) <= 42 for x in e['lines'])
    starts = [e['lines'][0].split()[0] for e in evs]
    assert 'And' in starts, [e['lines'] for e in evs]                # the sentence boundary is an event boundary
    issues = validate.validate(evs, o)
    assert not [i for i in issues if i['severity'] == 'fail'], issues


def test_timing_min_duration_gap_and_frame_grid():
    o = core.options(fps=25)
    words = [{'w': 'Hi.', 's': 0.0, 'e': 0.2, 'speaker': None}, {'w': 'Then', 's': 3.0, 'e': 3.2, 'speaker': None}, {'w': 'more.', 's': 3.3, 'e': 3.5, 'speaker': None}]
    evs = core.build_events(words, o)
    assert evs[0]['end'] - evs[0]['start'] >= o['min_dur'] - 1e-9          # a one-word event still stays 5/6 s
    for e in evs:
        for t in (e['start'], e['end']):
            assert abs(t * 25 - round(t * 25)) < 1e-6                    # on the frame grid


def test_chaining_closes_short_gaps_to_two_frames():
    o = core.options(fps=30)
    a = W('This first sentence is long enough to need two lines here.', 0.0)
    b = W('Another sentence starts soon after it and also runs long.', a[-1]['e'] + 0.3)
    evs = core.build_events(a + b, o)
    assert len(evs) == 2
    g = evs[1]['start'] - evs[0]['end']
    assert abs(g - 2 / 30) < 1e-6, g


def test_cps_limit_for_kids_is_stricter():
    words = W('Fast talkers say a great many words in one short breath here.', 0.0, step=0.12)
    words += W('And they carry on right away without a pause.', words[-1]['e'] + 0.05, step=0.12)
    o_adult, o_kids = core.options(audience='adult'), core.options(audience='kids')
    assert o_kids['cps'] == 17 and o_adult['cps'] == 20
    evs = core.build_events(words, o_kids)
    rules = {i['rule'] for i in validate.validate(evs, o_kids)}
    assert 'cps' in rules                                                 # fast speech is reported, not hidden


def test_validator_reports_each_violation_with_times():
    o = core.options(fps=30)
    evs = [{'start': 0.0, 'end': 0.4, 'lines': ['x' * 45]},
           {'start': 0.41, 'end': 9.0, 'lines': ['a', 'b', 'c']},
           {'start': 8.5, 'end': 9.5, 'lines': ['Overlap of the']}]
    got = {(i['rule'], tuple(i['t'])) for i in validate.validate(evs, o, duration=9.2)}
    assert ('chars_per_line', (0.0, 0.4)) in got and ('min_duration', (0.0, 0.4)) in got and ('cps', (0.0, 0.4)) in got
    assert ('gap', (0.0, 0.4)) in got
    assert ('lines', (0.41, 9.0)) in got and ('max_duration', (0.41, 9.0)) in got and ('overlap', (0.41, 9.0)) in got
    assert ('past_end', (8.5, 9.5)) in got
    assert validate.summary(validate.validate(evs, o)) == 'fail'


def test_sdh_speaker_labels_and_sound_tags():
    words = W('Where were you all morning?', 0.5, speaker='Ana') + W('Stuck in a meeting.', 2.5, speaker='Ben') + W('Fair enough.', 9.0, speaker='Ana')
    plan = {'seconds': 12, 'cues': [{'id': 'sfx/device/phone_buzz', 't': 5.5}, {'id': 'sfx/ui/pop', 't': 6.0}, {'id': 'sfx/hit/soft', 't': 2.6}],
            'music': 'music/bed_lofi_warm_loop8'}
    o = core.options(fps=30, sdh=True)
    evs = core.build(words, o, plan)
    text = [' / '.join(e['lines']) for e in evs]
    music = [e for e in evs if e['kind'] == 'music']
    assert len(music) == 1 and 'moved from 0.00 s' in music[0]['notes'][0]      # no room at 0 s (speech at 0.5 s): the next gap, with a note
    assert any(t.startswith('ANA:') for t in text) and any('BEN:' in t for t in text)
    assert any(e['kind'] == 'sound' and 'phone' in e['lines'][0].lower() for e in evs)   # the buzz has its own event in the gap
    assert not any('pop' in t.lower() for t in text)                              # UI ticks are never captioned at level key
    assert not [i for i in validate.validate(evs, o, 12) if i['severity'] == 'fail']


def test_sdh_tag_text_from_manifest_and_override():
    assert core.sound_cues({'cues': [{'id': 'sfx/amb/applause', 't': 1}]}, 'all') == []   # ambience never
    got = core.sound_cues({'cues': [{'id': 'sfx/foley/door_close', 't': 1, 'sdh': 'door slams'}, {'id': 'sfx/hit/soft', 't': 2, 'sdh': False}]})
    assert got == [(1.0, '[door slams]')]


def test_placement_moves_to_top_when_plan_text_is_at_the_bottom():
    o = core.options(fps=30, W=1080, H=1920)
    words = W('A caption that should dodge the lower third.', 1.0)
    plan = {'texts': [{'text': 'Name', 't': [0, 5], 'box': [100, 1100, 900, 1240], 'fontPx': 56}]}
    evs = core.place(core.build_events(words, o), plan, 1080, 1920, o)
    assert evs[0]['position'] == 'top'
    r = safezones.rect('conservative', 1080, 1920)
    x0, y0, x1, y1 = evs[0]['box']
    assert x0 >= r['x0'] - 0.5 and x1 <= r['x1'] + 0.5 and y0 >= r['y0'] - 0.5


def test_burn_profile_fits_the_safe_width():
    o = core.options(profile='burn', W=1080, H=1920)
    assert 18 <= o['max_chars'] <= 42 and o['max_chars'] < 42                  # 64 px Manrope on a 895 px safe width


def _track():
    o = core.options(fps=30, W=1920, H=1080)
    words = W('Dark mode, in three steps. Let me show you how it works today.', 0.2)
    return core.place(core.build_events(words, o), {}, 1920, 1080, o), o


def test_srt_vtt_ttml_round_trip():
    evs, o = _track()
    for fmt, text in (('srt', formats.srt(evs)), ('vtt', formats.vtt(evs)), ('ttml', formats.ttml(evs))):
        back = formats.parse(text, fmt)
        assert len(back) == len(evs), fmt
        for a, b in zip(evs, back):
            assert abs(a['start'] - b['start']) < 0.0015 and abs(a['end'] - b['end']) < 0.0015
            assert a['lines'] == b['lines'], (fmt, a['lines'], b['lines'])


def test_vtt_positions_and_ttml_profile():
    evs, o = _track()
    v = formats.vtt(evs)
    assert v.startswith('WEBVTT') and 'line:' in v and ',end' in v and 'align:center' in v
    back = formats.parse_vtt(v, frame=(1920, 1080))
    assert all(abs(b['box_edge'] - a['box'][3]) < 1.5 for a, b in zip(evs, back))   # the bottom edge survives the percent round trip
    root = ET.fromstring(formats.ttml(evs).encode())
    assert root.tag == '{http://www.w3.org/ns/ttml}tt'
    assert root.get('{http://www.w3.org/ns/ttml#parameter}contentProfiles').endswith('imsc1.1/text')
    regions = root.findall('.//{http://www.w3.org/ns/ttml}region')
    assert regions and all(r.get('{http://www.w3.org/ns/ttml#styling}origin').endswith('%') for r in regions)


def test_escaping():
    e = [{'start': 0, 'end': 1, 'lines': ['Tom & Jerry <3'], 'kind': 'speech'}]
    assert 'Tom &amp; Jerry &lt;3' in formats.vtt(e)
    assert formats.parse(formats.ttml(e), 'ttml')[0]['lines'] == ['Tom & Jerry <3']


def test_export_cli_on_a_template_plan(tmp_path):
    from captions import export
    plan = os.path.join(PACK, 'templates', 'tutorial', 'out', 'plan.json')
    if not os.path.exists(plan):
        pytest.skip('tutorial plan not built')
    rc = export.main(['--plan', plan, '--out', str(tmp_path)])
    assert rc == 0
    rep = json.load(open(tmp_path / 'captions.en.report.json'))
    assert rep['status'] in ('pass', 'warn') and rep['events'] > 3
    assert (tmp_path / 'captions.en.vtt').read_text().startswith('WEBVTT')


@pytest.mark.skipif(FF is None, reason='ffmpeg not installed')
def test_burn_in_on_a_one_second_clip(tmp_path):
    src = str(tmp_path / 'in.mp4')
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=320x180:r=30:d=1', '-f', 'lavfi', '-i', 'sine=f=440:r=48000:d=1',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src], check=True)
    o = core.options(fps=30, profile='burn', W=320, H=180)
    evs = core.place([{'start': 0.1, 'end': 0.9, 'lines': ['Hi.'], 'kind': 'speech', 'notes': []}], {}, 320, 180, o)
    items = burn.render_pngs(evs, str(tmp_path / 'png'), o)
    out = str(tmp_path / 'out.mp4')
    args = burn.burn_args(src, items, out)
    assert "enable='gte(t,0.100)*lt(t,0.900)'" in ' '.join(args) and '-c:a' in args and args[args.index('-c:a') + 1] == 'copy'
    subprocess.run([FF] + args, check=True)
    _, x, y, _, _ = items[0]

    def px(t):
        r = subprocess.run([FF, '-v', 'error', '-ss', str(t), '-i', out, '-frames:v', '1', '-vf', 'crop=2:2:%d:%d' % (x + 2, y + 2), '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                           capture_output=True, check=True)
        return r.stdout[0]
    assert px(0.5) < 100 < px(0.95)                                               # the scrim is there while the event is up, gone after
