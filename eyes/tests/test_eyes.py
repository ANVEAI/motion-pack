"""eyes checks on synthetic videos (Pillow + numpy frames encoded with x264 at a few hundred px, 1-7 s each, written under pytest's tmp dir).
Every test names the check it proves; eyes/tests/*.mutants.json break the code under test and require these tests to fail (tools/mutation_check.py).
Run: python3 -m pytest -q eyes/tests"""
import json
import os
import shutil
import subprocess
import sys

import numpy as np
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, PACK)
sys.path.insert(0, HERE)
import synth as s  # noqa: E402
from eyes import core, report  # noqa: E402
from eyes.look import analyze, main  # noqa: E402

W, H = 540, 960
FPS = 30
_CACHE = {}
_DIR = {}


@pytest.fixture(scope='session', autouse=True)
def _tmp(tmp_path_factory):
    _DIR['d'] = str(tmp_path_factory.mktemp('eyes'))


def vid(name, fn, n, **kw):
    """build a clip once per session"""
    if name not in _CACHE:
        _CACHE[name] = s.make_video(os.path.join(_DIR['d'], name + '.mp4'), fn, n, **kw)
    return _CACHE[name]


def check(rep, cid):
    return next(c for c in rep['checks'] if c['id'] == 'eyes/' + cid)


def whats(c):
    return ' | '.join(i['what'] for i in c['issues'])


def run(path, cid, **kw):
    kw.setdefault('draft', True)
    return check(analyze(path, only=[cid], **kw), cid)


SCENE = s.moving_scene(W, H)


def scene(i):
    return SCENE(i)


def segments(*segs):
    """frame function from [(count, fn(local index))...]"""
    def f(i):
        for n, fn in segs:
            if i < n:
                return fn(i)
            i -= n
        return segs[-1][1](segs[-1][0] - 1)
    return f


def black(i):
    return s.solid(W, H, (0, 0, 0))


def still(i):
    return scene(0)


# ------------------------------------------------------------------------------------------------ eyes/frame0
def test_a_moving_scene_with_a_hero_passes_frame0():
    c = run(vid('good', scene, 60), 'frame0')
    assert c['status'] == 'pass', whats(c)
    assert c['measured']['subject_contrast'] >= 3.0 and c['measured']['first_change_frame'] <= 6


def test_a_black_frame0_fails():
    c = run(vid('black0', segments((10, black), (50, scene)), 60), 'frame0')
    assert c['status'] == 'fail' and 'black' in whats(c)
    assert c['measured']['mean_luma'] < 2


def test_a_uniform_frame0_fails_and_a_flat_low_contrast_one_is_called_out():
    c = run(vid('flat0', segments((10, lambda i: s.solid(W, H, (120, 120, 120))), (50, scene)), 60), 'frame0')
    assert c['status'] == 'fail' and 'near-uniform' in whats(c)
    ramp = np.linspace(100, 126, W)[None, :, None] * np.ones((H, 1, 3))
    c2 = run(vid('lowc0', segments((10, lambda i: ramp), (50, scene)), 60), 'frame0')
    assert 'low contrast' in whats(c2) and c2['measured']['std_luma'] < 12 and c2['status'] == 'fail' and 'no readable subject' in whats(c2)   # a smooth ramp has no hero either


def disc_on_grade(level):
    yy, xx = np.mgrid[0:H, 0:W]

    def f(i):
        d = np.sqrt((xx - W * (0.5 + 0.1 * np.sin(0.2 * i))) ** 2 + (yy - H * 0.5) ** 2)
        m = np.clip((70 - d) / 2, 0, 1)[..., None]
        base = (90 + 25 * np.sin(yy / H * 3))[..., None] * np.ones((1, 1, 3))
        return np.clip(base * (1 - m) + level * m + np.random.default_rng(i).normal(0, 1.5, (H, W, 3)), 0, 255)
    return f


def test_a_hero_that_barely_separates_from_its_backdrop_is_called_out():
    weak = run(vid('subj105', disc_on_grade(105), 40), 'frame0')
    assert weak['status'] == 'fail' and 'no readable subject' in whats(weak) and weak['measured']['subject_contrast'] < 1.5
    soft = run(vid('subj200', disc_on_grade(200), 40), 'frame0')
    assert soft['status'] == 'warn' and 'reads at' in whats(soft) and 1.5 <= soft['measured']['subject_contrast'] < 3.0, (soft['measured'], whats(soft))


@pytest.mark.parametrize('lead,status', [(3, 'pass'), (10, 'warn'), (22, 'fail')])
def test_first_visible_change_by_frame_6_warns_by_half_a_second_and_fails_after(lead, status):
    c = run(vid('lead%d' % lead, segments((lead, still), (60, lambda i: scene(i + 1 if i else 0))), lead + 60), 'frame0')
    if lead == 3:
        assert c['status'] == 'pass', whats(c)
    assert c['status'] == status, (c['measured'], whats(c))
    assert (c['measured']['first_change_frame'] or 99) >= lead


def test_a_still_opening_with_no_change_for_a_second_fails():
    c = run(vid('stillopen', still, 60), 'frame0')
    assert c['status'] == 'fail' and 'nothing visibly changes' in whats(c)
    assert run(vid('stillopen', still, 60), 'frames', plan={'fps': 30})['measured']['frozen_runs'] == [], 'a freeze from frame 0 belongs to frame0, not to frames'


# ------------------------------------------------------------------------------------------------ eyes/frames
def test_black_frames_mid_clip_fail_unless_the_plan_dips():
    p = vid('blackmid', segments((30, scene), (6, black), (54, lambda i: scene(i + 30))), 90)
    c = run(p, 'frames')
    assert c['status'] == 'fail' and 'black frames' in whats(c) and not c['measured']['black_runs'][0]['planned']
    plan = {'fps': 30, 'shots': [{'id': 'a', 'start': 0, 'dur': 1.1, 'tx': 'transitions/cut'}, {'id': 'b', 'start': 1.1, 'dur': 1.9, 'tx': 'transitions/dip-to-black'}]}
    c2 = run(p, 'frames', plan=plan)
    assert c2['status'] == 'pass' and c2['measured']['black_runs'][0]['planned'] and any('planned' in n for n in c2['notes'])
    blip = run(vid('blip', segments((30, scene), (2, black), (58, lambda i: scene(i + 30))), 90), 'frames')
    assert blip['status'] == 'pass' and not blip['measured']['black_runs'], 'a 2-frame black blip is under black_min_frames'


def test_a_black_tail_warns_and_a_long_one_fails():
    c = run(vid('tail', segments((60, scene), (12, black)), 72), 'frames')
    assert c['status'] == 'warn' and 'ends on' in whats(c)
    c2 = run(vid('tail2', segments((60, scene), (36, black)), 96), 'frames')
    assert c2['status'] == 'fail'


def test_frozen_picture_warns_from_half_a_second_fails_after_two_and_a_planned_hold_passes():
    held = vid('frz1', segments((30, scene), (30, lambda i: scene(29)), (30, lambda i: scene(i + 30))), 90)
    c = run(held, 'frames')
    assert c['status'] == 'warn' and 'frozen' in whats(c), (c['measured'], whats(c))
    plan = {'fps': 30, 'shots': [{'id': 'a', 'start': 0, 'dur': 1, 'tx': 'x'}, {'id': 'hold', 'start': 0.97, 'dur': 1.05, 'hold': True}, {'id': 'c', 'start': 2, 'dur': 1}]}
    c2 = run(held, 'frames', plan=plan)
    assert c2['status'] == 'pass' and c2['measured']['frozen_runs'][0]['planned']
    c3 = run(vid('frz2', segments((30, scene), (80, lambda i: scene(29)), (30, lambda i: scene(i + 30))), 140), 'frames')
    assert c3['status'] == 'fail'
    short = run(vid('frz3', segments((30, scene), (10, lambda i: scene(29)), (50, lambda i: scene(i + 30))), 90), 'frames')
    assert short['status'] == 'pass' and not short['measured']['frozen_runs'], 'a 0.3 s freeze is under frozen_warn_s'


def test_a_still_end_card_without_a_plan_is_a_note_and_with_a_plan_it_is_judged():
    p = vid('endcard', segments((45, scene), (45, lambda i: scene(44))), 90)
    c = run(p, 'frames')
    assert c['status'] == 'pass' and any('end-card' in n for n in c['notes'])
    c2 = run(p, 'frames', plan={'fps': 30, 'shots': []})
    assert c2['status'] == 'warn'


def test_a_slow_small_motion_is_not_a_freeze():
    def small(i):
        f = scene(0).copy()
        f[400:412, 100 + 2 * i:112 + 2 * i] = 255                              # a 12 px square: the mean moves by 0.05 level, a few pixels move by a lot
        return f
    c = run(vid('smallmove', segments((15, scene), (60, small)), 75), 'frames')
    assert c['status'] == 'pass' and not c['measured']['frozen_runs']


def test_an_empty_colour_field_mid_clip_is_flagged():
    grey = lambda i: s.solid(W, H, (110, 110, 110))
    c = run(vid('empty', segments((30, scene), (36, grey), (30, lambda i: scene(i + 30))), 96), 'frames')
    assert c['status'] == 'fail' and 'empty colour field' in whats(c) and len(c['issues']) == 1, whats(c)


def test_a_timestamp_gap_is_a_stall():
    p = vid('stall', scene, 60, vf="setpts='if(gte(N,30),PTS+0.5/TB,PTS)'", extra_out=['-fps_mode', 'passthrough'])
    c = run(p, 'frames')
    assert c['status'] == 'fail' and 'playback stall' in whats(c)
    assert 0.9 < c['measured']['stalls'][0]['t'] < 1.1 and c['measured']['stalls'][0]['gap_s'] > 0.4
    assert run(vid('good', scene, 60), 'frames')['measured']['stalls'] == []


# ------------------------------------------------------------------------------------------------ eyes/flashes
def flash(hz, area=1.0, on=(255, 255, 255), off=(0, 0, 0)):
    def f(i):
        a = np.empty((H, W, 3), np.uint8)
        a[:] = off
        if int(np.floor(i / FPS * 2 * hz)) % 2:
            a[:int(H * area)] = on
        return a
    return f


def test_a_4_hz_flash_fails_and_a_2_hz_and_a_3_hz_one_pass():
    f4 = run(vid('f4', flash(4), 90), 'flashes')
    assert f4['status'] == 'fail' and f4['measured']['general']['max_per_s'] == 4 and '4 general flashes in one second' in whats(f4)
    assert 0.0 <= f4['issues'][0]['t'][0] < 1.0
    for hz in (2, 3):
        c = run(vid('f%d' % hz, flash(hz), 90), 'flashes')
        assert c['status'] == 'pass' and c['measured']['general']['max_per_s'] == hz


def test_the_flash_must_cover_a_quarter_of_the_frame():
    small = run(vid('f4small', flash(4, 0.15), 90), 'flashes')
    assert small['status'] == 'pass' and small['measured']['general']['max_per_s'] == 0
    big = run(vid('f4big', flash(4, 0.3), 90), 'flashes')
    assert big['status'] == 'fail'


def test_a_one_hertz_breathing_fade_is_not_a_flash():
    def fade(i):
        v = int(127 * (1 + np.sin(i / FPS * np.pi * 2)))                      # one full swing a second
        return s.solid(W, H, (v, v, v))
    c = run(vid('fade1', fade, 90), 'flashes')
    assert c['status'] == 'pass' and c['measured']['general']['max_per_s'] <= 1, c['measured']


def test_a_red_flash_fails_at_4_hz_even_when_the_luminance_does_not_change_and_passes_at_2():
    lum = core.LIN[200] * 0.2126
    g = int(np.argmax(core.LIN >= lum))
    f4 = run(vid('red4', flash(4, 1.0, (200, 0, 0), (g, g, g)), 90), 'flashes')
    assert f4['status'] == 'fail' and f4['measured']['general']['max_per_s'] == 0 and f4['measured']['red']['max_per_s'] == 4 and '4 red flashes in one second' in whats(f4)
    assert run(vid('red2', flash(2, 1.0, (200, 0, 0), (g, g, g)), 90), 'flashes')['status'] == 'pass'


def test_a_4_hz_flicker_under_a_10_percent_luminance_swing_is_not_a_flash():
    c = run(vid('swing6', flash(4, 1.0, (120, 120, 120), (100, 100, 100)), 90), 'flashes')    # 0.188 against 0.127 relative luminance
    assert c['status'] == 'pass' and c['measured']['general']['max_per_s'] == 0 and c['measured']['peak_changed_area'] == 0.0


def test_the_red_mask_needs_a_saturated_red_and_a_real_step_and_a_bright_flicker_needs_a_dark_side():
    dark = run(vid('redfaint', flash(4, 1.0, (12, 0, 0), (0, 0, 0)), 90), 'flashes')
    assert dark['status'] == 'pass' and dark['measured']['red']['max_per_s'] == 0                          # R - G - B under 16 / 255: not a red transition
    orange = run(vid('orange4', flash(4, 1.0, (255, 150, 80), (0, 0, 0)), 90), 'flashes')
    assert orange['measured']['red']['max_per_s'] == 0 and orange['measured']['general']['max_per_s'] == 4  # R / (R + G + B) in linear light under 0.8: not saturated
    bright = run(vid('bright4', flash(4, 1.0, (255, 255, 255), (240, 240, 240)), 90), 'flashes')
    assert bright['status'] == 'pass' and bright['measured']['general']['max_per_s'] == 0                  # the darker side is over 0.80 relative luminance: not a flash


# ------------------------------------------------------------------------------------------------ eyes/banding
def ramp(lo, hi, noise=0.0):
    xx = np.linspace(0, 1, W)[None, :] * np.ones((H, 1))
    rng = np.random.default_rng(5)

    def f(i):
        v = lo + (hi - lo) * xx
        v = np.floor(v) if not noise else v + rng.normal(0, noise, (H, W))
        v = np.clip(np.rint(v), 0, 255)
        return np.stack([v] * 3, -1)
    return f


def test_a_posterised_gradient_fails_and_the_same_gradient_with_grain_passes():
    bad = run(vid('post', ramp(30, 60), 30, crf=12), 'banding')
    assert bad['status'] == 'fail' and 'banding' in whats(bad) and bad['measured']['max_banded_share'] > 0.8
    assert 'grain' in bad['issues'][0]['fix'] and 'dither' in bad['issues'][0]['fix']
    box = bad['measured']['frames'][0]['box']
    assert box[0] <= 2 and box[2] >= W - 2
    ok = run(vid('dith', ramp(30, 60, 1.2), 30, crf=12), 'banding')
    assert ok['status'] == 'pass' and ok['measured']['max_banded_share'] < 0.01


def test_a_vertical_posterised_gradient_fails_too():
    yy = np.linspace(0, 1, H)[:, None] * np.ones((1, W))
    v = np.stack([np.floor(30 + 60 * yy)] * 3, -1)
    c = run(vid('postv', lambda i: v, 30, crf=12), 'banding')
    assert c['status'] == 'fail' and c['measured']['max_banded_share'] > 0.8


def test_a_bright_gradient_steps_are_below_the_visible_threshold_and_a_flat_field_is_not_banding():
    assert run(vid('postbright', ramp(200, 230), 30, crf=12), 'banding')['measured']['max_banded_share'] == 0.0
    assert run(vid('flatgrey', lambda i: s.solid(W, H, (60, 60, 60)), 30, crf=12), 'banding')['measured']['max_banded_share'] == 0.0


def test_edges_and_single_steps_are_not_staircases():
    def panels(i):
        a = np.empty((H, W, 3), np.uint8)
        a[:, :W // 3], a[:, W // 3:2 * W // 3], a[:, 2 * W // 3:] = 60, 120, 60            # big steps: edges, not contours
        return a
    assert run(vid('panels', panels, 20, crf=12), 'banding')['measured']['max_banded_share'] == 0.0

    def onestep(i):
        a = np.empty((H, W, 3), np.uint8)
        a[:, :W // 2], a[:, W // 2:] = 60, 62                                              # one contour: not a staircase
        return a
    assert run(vid('onestep', onestep, 20, crf=12), 'banding')['measured']['max_banded_share'] == 0.0


def test_one_banded_frame_in_twelve_is_a_warning_not_a_fail():
    p = vid('banded1', segments((20, scene), (4, lambda i: ramp(30, 60)(0)), (36, lambda i: scene(i + 20))), 60, crf=12)
    c = run(p, 'banding')
    assert c['status'] == 'warn' and sum(1 for r in c['measured']['frames'] if r['banded_share'] >= 0.04) == 1, (c['measured']['max_banded_share'], c['measured']['samples'])


# ------------------------------------------------------------------------------------------------ eyes/safezones
def with_text(base_fn, text, xy, size, fill=(255, 255, 255)):
    def f(i):
        return s.text_frame(base_fn(i), text, xy, size, fill)[0]
    return f


def plan_texts(box, **kw):
    t = {'id': 'hook', 'text': kw.pop('text', 'Your desk handled'), 't': kw.pop('t', [0, 2.5]), 'box': box, 'fontPx': kw.pop('fontPx', 70), 'role': kw.pop('role', 'read'), 'fg': kw.pop('fg', '#FFFFFF')}
    t.update(kw)
    return {'fps': 30, 'size': [W, H], 'texts': [t], 'platform': 'tiktok.organic'}


def test_plan_boxes_inside_the_safe_rect_pass_and_boxes_over_the_bands_fail():
    p = vid('good', scene, 60)
    x0, y0, x1, y1, _ = core.safe_rect('conservative', W, H)
    ok = run(p, 'safezones', plan=plan_texts([x0 + 5, y0 + 5, x1 - 5, y0 + 60]))
    assert ok['status'] == 'pass' and ok['measured']['mode'] == 'plan'
    bad = run(p, 'safezones', plan=plan_texts([x0 + 5, y1 - 40, x1 + 40, y1 + 40]))
    assert bad['status'] == 'fail' and 'bottom by 40 px' in whats(bad) and 'right by 40 px' in whats(bad)
    right = run(p, 'safezones', plan=plan_texts([x0 + 5, y0 + 5, W - 10, y0 + 60]))
    assert right['status'] == 'fail' and 'right by' in whats(right)
    assert 'x %d-%d, y %d-%d' % (round(x0), round(x1), round(y0), round(y1)) in bad['issues'][0]['fix']
    lt = run(p, 'safezones', plan=plan_texts([x0 - 12, y0 - 25, x0 + 200, y0 + 30]))
    assert lt['status'] == 'fail' and 'left by 12 px' in whats(lt) and 'top by 25 px' in whats(lt)
    edge = run(p, 'safezones', plan=plan_texts([x0 - 0.4, y0, x1 + 0.4, y1]))                  # lintRect's half-pixel tolerance
    assert edge['status'] == 'pass'


def test_the_safe_rect_matches_safezones_js_and_the_platform_presets():
    assert core.safe_rect('conservative', 1080, 1920)[:4] == (65, 269, 960, 1248)                 # SKILL.md: x 65-960, y 269-1248
    assert core.safe_rect('tiktok.organic', 1080, 1920)[:4] == (65, 269, 960, 1248)
    assert core.safe_rect('wideTitle', 1920, 1080)[:4] == (96, 54, 1824, 1026)
    x0, y0, x1, y1, _ = core.safe_rect('yt.ad.15', 1920, 1080)
    assert (x0, y0, x1, y1) == (96.0, 54.0, 1824.0, 1080 - 86.4)
    assert core.safe_rect('reels', 540, 960)[:4] == (30, 110, 480, 750)                              # scaled by H / 1920
    x0, y0, x1, y1, note = core.safe_rect('tiktok.organic', 1920, 1080)                               # a shape the platform does not take: the shape's default
    assert (x0, y1) == (96, 1026) and 'does not take' in note


def test_text_in_the_bottom_band_is_found_without_a_plan_and_text_in_the_safe_area_is_not():
    bad = run(vid('txtbottom', with_text(scene, 'SALE 50% OFF', (60, 800), 36), 90), 'safezones')
    assert bad['status'] == 'fail' and 'text-like block' in whats(bad), (bad['measured'], whats(bad))
    assert bad['measured']['mode'] == 'detect' and bad['issues'][0]['t'][1] - bad['issues'][0]['t'][0] >= 1.0
    ok = run(vid('txtsafe', with_text(scene, 'SALE 50% OFF', (110, 330), 36), 90), 'safezones')
    assert ok['status'] == 'pass' and ok['measured']['blocks'] and all(b['outside'] < 0.15 for b in ok['measured']['blocks'])
    assert run(vid('good', scene, 60), 'safezones')['measured']['blocks'] == []


def test_bright_low_contrast_text_and_a_non_text_blob_in_the_band_are_not_reported():
    grey = lambda i: s.text_frame(s.solid(W, H, (175, 175, 175)), 'SALE 50% OFF', (60, 800), 36, (255, 255, 255))[0]
    assert run(vid('txtfaint', grey, 90), 'safezones')['measured']['blocks'] == []                    # an 80 level step, a 2.2:1 ratio
    yy, xx = np.mgrid[0:H, 0:W]
    patch = (yy > 780) & (yy < 860) & (xx > 100) & (xx < 180)
    stripes = (patch & (((xx // 8) % 2) == 0))[..., None]
    square = lambda i: np.where(patch[..., None], np.where(stripes, 255, 20), scene(i)).astype(np.uint8)
    assert run(vid('blob', square, 90), 'safezones')['measured']['blocks'] == []                      # a striped square: edges, density and contrast of text, the shape of an icon


def test_text_half_over_the_edge_warns_and_text_seen_for_one_sample_is_not_reported():
    c = run(vid('txtstrad', with_text(scene, 'SALE 50% OFF', (110, 592), 36), 90), 'safezones')
    assert c['status'] == 'warn' and 'text-like block' in whats(c) and all(0.15 <= b['outside'] < 0.5 for b in c['measured']['blocks']), (c['measured']['blocks'], whats(c))

    def blink(i):
        f = scene(i)
        return s.text_frame(f, 'SALE 50% OFF', (60, 800), 36)[0] if 18 <= i <= 26 else f           # on screen over exactly one of the 2 fps samples (ffmpeg's fps filter takes frames 7, 22, 37, ...)
    assert run(vid('txtblink', blink, 90), 'safezones')['measured']['blocks'] == []


def test_text_in_the_right_band_of_a_9_16_frame_fails():
    big = s.moving_scene(1080, 1920)
    p = vid('txtright', lambda i: s.text_frame(big(i), 'NEW', (968, 900), 56)[0], 45, w=1080, h=1920, crf=20)
    c = run(p, 'safezones', draft=False)
    assert c['status'] == 'fail', (c['measured'], whats(c))
    assert any(b['box'][0] >= 960 - 10 for b in c['measured']['blocks'])


def test_a_flickering_edge_pattern_is_not_a_persistent_text_block():
    rng = np.random.default_rng(2)
    p = vid('noise', lambda i: np.stack([np.where(np.random.default_rng(i).random((H, W)) > 0.5, 230, 20).astype(np.uint8)] * 3, -1), 60)
    assert run(p, 'safezones')['measured']['blocks'] == []


# ------------------------------------------------------------------------------------------------ eyes/readability
def text_scene(text, xy, size, fill, bg=None):
    def f(i):
        base = scene(i) if bg is None else s.solid(W, H, bg)
        return s.text_frame(base, text, xy, size, fill)[0]
    return f


def box_of(text, xy, size):
    _, bb = s.text_frame(s.solid(W, H, (0, 0, 0)), text, xy, size)
    return [bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[3] + 4]


def test_text_size_against_the_frame_design_floors():
    fp = vid('rd_small', text_scene('Your desk handled', (30, 60), 26, (255, 255, 255)), 90)
    bx = box_of('Your desk handled', (30, 60), 26)
    small = run(fp, 'readability', plan=plan_texts(bx, fontPx=26))
    assert small['status'] == 'fail' and 'is 52 px at 1080' in whats(small) and small['measured']['texts'][0]['floor_at_1080'] == 56
    big = run(vid('rd_big', text_scene('Your desk handled', (30, 60), 40, (255, 255, 255)), 90), 'readability', plan=plan_texts(box_of('Your desk handled', (30, 60), 40), fontPx=40))
    assert big['status'] == 'pass', whats(big)
    assert big['measured']['texts'][0]['size_at_1080'] == 80.0 and big['measured']['texts'][0]['size_on_phone_px'] == pytest.approx(26.7, abs=0.1)


def test_text_on_screen_time_follows_0_35_plus_0_28_per_word():
    bx = box_of('Your desk handled', (30, 60), 40)
    p = vid('rd_big', text_scene('Your desk handled', (30, 60), 40, (255, 255, 255)), 90)
    short = run(p, 'readability', plan=plan_texts(bx, fontPx=40, text='Works with the tools you already use', t=[0, 1.0]))
    assert short['status'] == 'fail' and 'need 2.31 s' in whats(short) and 'has 7 words (at most 6)' in whats(short)
    near = run(p, 'readability', plan=plan_texts(bx, fontPx=40, text='Works with the tools you', t=[0, 1.6]))
    assert near['status'] == 'warn', whats(near)
    assert run(p, 'readability', plan=plan_texts(bx, fontPx=40, text='Your desk handled', t=[0, 1.5]))['status'] == 'pass'
    lbl = run(p, 'readability', plan=plan_texts(bx, fontPx=40, text='Concept render', t=[0, 1.2], role='label'))
    assert lbl['status'] == 'fail' and 'labels need 2.0 s' in whats(lbl)
    end = run(p, 'readability', plan=plan_texts(bx, fontPx=40, text='anvevoice.app', t=[0, 2.0], role='endcard'))
    assert end['status'] == 'warn' and 'held 2.00 s (3-4.5 s)' in whats(end)


def wcag(a, b):
    """the WCAG 2.x ratio of two 0-255 grey levels, written out here so the test does not lean on core"""
    lin = lambda v: (v / 255 / 12.92) if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4
    hi, lo = max(lin(a), lin(b)), min(lin(a), lin(b))
    return (hi + 0.05) / (lo + 0.05)


def test_caption_size_caps_and_the_phone_floor():
    text = 'Your desk handled'
    p = vid('rd_big', text_scene(text, (30, 60), 40, (255, 255, 255)), 90)
    cap = run(p, 'readability', plan=plan_texts(box_of(text, (30, 60), 40), fontPx=100, role='caption', t=[0, 3]))
    assert 'captions run 64-80 px' in whats(cap) or 'is 200 px at 1080; 9:16 captions run 64-80 px' in whats(cap), whats(cap)
    ok = run(p, 'readability', plan=plan_texts(box_of(text, (30, 60), 40), fontPx=40, role='caption', t=[0, 3]))
    assert 'captions run' not in whats(ok) and ok['measured']['texts'][0]['size_at_1080'] == 80.0
    wide = vid('rd_wide', lambda i: np.clip(s.moving_scene(640, 360)(i), 0, 255), 60, w=640, h=360)
    tiny = run(wide, 'readability', plan={'fps': 30, 'size': [640, 360], 'texts': [{'text': 'tiny line', 't': [0, 2], 'box': [20, 20, 120, 40], 'fontPx': 14, 'role': 'read'}]})
    assert tiny['status'] == 'fail' and 'renders 7.9 px high on a 360 px wide phone (floor 9 px)' in whats(tiny)


def test_measured_contrast_matches_the_wcag_ratio_and_fails_on_a_light_backdrop():
    bg = (20, 20, 20)
    text = 'Your desk handled'
    p = vid('rd_dark', text_scene(text, (30, 60), 40, (255, 255, 255), bg), 90)
    bx = box_of(text, (30, 60), 40)
    exp = wcag(255, 20)
    c = run(p, 'readability', plan=plan_texts(bx, fontPx=40, fg='#FFFFFF'))
    got = c['measured']['texts'][0]['contrast_worst']
    assert c['status'] == 'pass' and got == pytest.approx(exp, rel=0.1), (got, exp)
    light = vid('rd_light', text_scene(text, (30, 60), 40, (255, 255, 255), (190, 190, 190)), 90)
    exp2 = wcag(255, 190)
    c2 = run(light, 'readability', plan=plan_texts(bx, fontPx=40, fg='#FFFFFF'))
    got2 = c2['measured']['texts'][0]['contrast_worst']
    assert c2['status'] == 'fail' and got2 == pytest.approx(exp2, rel=0.1) and got2 < 3.0 and 'contrast.py' in c2['issues'][0]['fix'], (got2, exp2)
    mid = vid('rd_mid', text_scene(text, (30, 60), 40, (255, 255, 255), (120, 120, 120)), 90)
    c3 = run(mid, 'readability', plan=plan_texts(bx, fontPx=40, fg='#FFFFFF'))
    assert c3['status'] == 'warn' and 3.0 <= c3['measured']['texts'][0]['contrast_worst'] < 4.5


def test_contrast_is_taken_against_the_lightest_background_the_text_crosses():
    text = 'Your desk handled'

    def split(i):
        bg = np.empty((H, W, 3), np.uint8)
        bg[:], bg[:, W // 2:] = 20, 200                                                            # the text crosses a dark and a light half
        return s.text_frame(bg, text, (30, 60), 40, (255, 255, 255))[0]
    c = run(vid('rd_split', split, 60), 'readability', plan=plan_texts(box_of(text, (30, 60), 40), fontPx=40))
    assert c['status'] == 'fail' and c['measured']['texts'][0]['contrast_worst'] == pytest.approx(wcag(255, 200), rel=0.1), c['measured']['texts']


def test_without_a_text_colour_the_contrast_is_estimated_and_never_fails_alone():
    text = 'Your desk handled'
    p = vid('rd_light', text_scene(text, (30, 60), 40, (255, 255, 255), (190, 190, 190)), 90)
    plan = plan_texts(box_of(text, (30, 60), 40), fontPx=40)
    plan['texts'][0].pop('fg')
    c = run(p, 'readability', plan=plan)
    t = c['measured']['texts'][0]
    assert t['fg_source'] == 'estimated' and t['contrast_worst'] < 3.0 and c['status'] == 'warn'


def test_the_hook_text_must_start_by_0_3_s_on_tiktok_and_have_at_most_7_words():
    bx = box_of('Your desk handled', (30, 60), 40)
    p = vid('rd_big', text_scene('Your desk handled', (30, 60), 40, (255, 255, 255)), 90)
    late = run(p, 'readability', plan=plan_texts(bx, fontPx=40, t=[1.0, 2.5]))
    assert late['status'] == 'warn' and 'hook text goes on screen by 0.3 s' in whats(late) and late['measured']['hook_text_start_s'] == 1.0
    assert run(p, 'readability', plan=plan_texts(bx, fontPx=40, t=[0.0, 2.5]))['status'] == 'pass'
    long_ = run(p, 'readability', plan=plan_texts(bx, fontPx=40, text='one two three four five six seven eight', t=[0.0, 4]))
    assert 'at most 7' in whats(long_)


def test_shot_text_and_captions_are_read_from_the_plan_for_timing():
    p = vid('good', scene, 60)
    plan = {'fps': 30, 'platform': 'yt.ad.15', 'shots': [{'id': 'proof0', 'start': 0, 'dur': 1.75, 'text': 'Works with the tools you already use', 'textDur': 1.75}]}
    c = run(p, 'readability', plan=plan)
    assert c['status'] == 'fail' and c['measured']['texts'][0]['source'] == 'shots[].text'
    cap = {'fps': 30, 'captions': [{'id': 'cap0', 'words': [{'w': 'Most'}, {'w': 'of'}, {'w': 'my'}], 'start': 0, 'end': 0.7}]}
    c2 = run(p, 'readability', plan=cap)
    assert c2['status'] == 'warn' and c2['measured']['texts'][0]['role'] == 'caption'
    assert core.plan_texts({'texts': []}, W, H) == [] and run(p, 'readability')['status'] == 'n/a'


def test_a_plan_at_another_size_is_scaled_to_the_delivered_frame():
    t = core.plan_texts({'size': [1080, 1920], 'texts': [{'text': 'a b', 't': [0, 2], 'box': [108, 192, 540, 384], 'fontPx': 80}]}, 540, 960)[0]
    assert t['box'] == (54, 96, 270, 192) and t['font_px'] == 40


# ------------------------------------------------------------------------------------------------ eyes/pacing
def other(i):
    return 255 - scene(i)


def cut_video(every, n_shots):
    segs = [(every, scene if k % 2 == 0 else other) for k in range(n_shots)]
    return segments(*segs)


def test_hard_cuts_are_found_at_the_frame_they_happen_and_counted_per_minute():
    p = vid('cuts', cut_video(15, 6), 90)
    c = run(p, 'pacing')
    assert c['measured']['cut_times_s'] == [0.5, 1.0, 1.5, 2.0, 2.5]
    assert c['measured']['cuts_per_min'] == 100.0 and c['measured']['shots'] == 6 and c['measured']['shot_median_s'] == 0.5
    assert run(vid('good', scene, 60), 'pacing')['measured']['cuts'] == 0


def test_constant_busy_motion_and_a_one_frame_flash_are_not_extra_cuts():
    noise = vid('noise', lambda i: np.stack([np.where(np.random.default_rng(i).random((H, W)) > 0.5, 230, 20).astype(np.uint8)] * 3, -1), 60)
    assert run(noise, 'pacing')['measured']['cuts'] == 0                                                # a big difference every frame is not a cut
    white = lambda i: s.solid(W, H, (255, 255, 255))
    p = vid('flashcut', segments((30, scene), (1, white), (59, other)), 90)
    assert len(run(p, 'pacing')['measured']['cuts']) if False else run(p, 'pacing')['measured']['cuts'] == 1   # into and out of the flash within 0.15 s: one cut


def test_a_picture_that_does_not_change_for_over_3_5_s_warns_and_a_planned_hold_is_a_note():
    def quiet(i):
        f = scene(0).astype(np.float32)
        return np.clip(f + np.random.default_rng(i).normal(0, 1.2, f.shape), 0, 255)
    p = vid('static5', quiet, 150)
    c = run(p, 'pacing')
    assert c['status'] == 'warn' and 'barely changes for 5.0 s' in whats(c), (c['measured'], whats(c))
    plan = {'fps': 30, 'shots': [{'id': 'h', 'start': 0, 'dur': 5, 'hold': True}]}
    c2 = run(p, 'pacing', plan=plan)
    assert c2['status'] == 'pass' and any('planned hold' in n for n in c2['notes'])
    long_ = run(vid('static8', quiet, 240), 'pacing')
    assert long_['status'] == 'fail'


def test_shot_length_is_judged_against_the_format_and_the_plan_pace_rule():
    p = vid('cuts', cut_video(15, 6), 90)
    hype = run(p, 'pacing', fmt='short_film')
    assert hype['status'] == 'warn' and 'outside the short_film range 4.0-8.0 s' in whats(hype)
    assert run(p, 'pacing', fmt='beat_edit', plan={'fps': 30, 'beatSec': 0.5})['status'] == 'pass'
    rule = run(p, 'pacing', plan={'fps': 30, 'paceRule': {'aslMax': 0.4, 'longMax': 0.45}})
    assert rule['status'] == 'warn' and 'plan rule 0.40 s' in whats(rule) and 'longMax' in whats(rule)
    assert run(p, 'pacing', plan={'fps': 30, 'template': 'ad'})['measured']['format'] == 'hype_ad'


# ------------------------------------------------------------------------------------------------ eyes/composition
def boxed(inner_w, inner_h, W_=W, H_=H):
    sc = s.moving_scene(inner_w, inner_h, seed=4)

    def f(i):
        a = np.zeros((H_, W_, 3), np.uint8)
        y0, x0 = (H_ - inner_h) // 2, (W_ - inner_w) // 2
        a[y0:y0 + inner_h, x0:x0 + inner_w] = np.clip(sc(i), 0, 255).astype(np.uint8)
        return a
    return f


def test_a_16_9_clip_inside_a_9_16_frame_is_a_letterbox_failure_unless_the_plan_asks_for_bars():
    p = vid('letterbox', boxed(W, 304), 60)
    c = run(p, 'composition')
    assert c['status'] == 'fail' and 'black bars' in whats(c) and c['measured']['bars']['top'] > 0.3 and c['measured']['bar_area'] > 0.6
    asked = run(p, 'composition', plan={'fps': 30, 'eyes': {'letterbox': True}})
    assert asked['status'] == 'pass' and any('asked for' in n for n in asked['notes'])
    asked2 = run(p, 'composition', plan={'fps': 30, 'layers': [{'kind': 'bars'}]})
    assert asked2['status'] == 'pass'


def test_thin_bars_warn_and_thick_bars_fail():
    c = run(vid('thinbars', boxed(W, 864), 60), 'composition')
    assert c['status'] == 'warn' and 'black bars' in whats(c) and 0.02 <= c['measured']['bars']['top'] < 0.15 and c['measured']['bar_area'] < 0.15


def test_a_pillarboxed_wide_frame_fails():
    p = vid('pillar', boxed(270, 360, 640, 360), 60, w=640, h=360)
    c = run(p, 'composition')
    assert c['status'] == 'fail' and c['measured']['bars']['left'] > 0.25 and c['measured']['bars']['right'] > 0.25 and c['measured']['aspect'] == '16:9'


def test_aspect_and_resolution_against_the_platform():
    p = vid('wide', lambda i: np.clip(s.moving_scene(640, 360)(i), 0, 255), 30, w=640, h=360)
    c = run(p, 'composition', platform='tiktok.organic')
    assert c['status'] == 'fail' and 'takes 9:16' in whats(c)
    assert 'aspect' not in {i['kind'] for i in run(p, 'composition', platform='yt.ad.15')['issues']}
    res = run(vid('good', scene, 60), 'composition', draft=False)
    assert res['status'] == 'fail' and 'shorter side is 540' in whats(res)
    mid = vid('r720', lambda i: np.clip(s.moving_scene(720, 1280)(i), 0, 255), 20, w=720, h=1280)
    assert run(mid, 'composition', draft=False)['status'] == 'warn'
    assert run(vid('good', scene, 60), 'composition', draft=True)['status'] == 'pass'


def discs(k):
    yy, xx = np.mgrid[0:H, 0:W]
    pos = [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)][:k]

    def f(i):
        fr = np.full((H, W, 3), 25.0)
        for cx, cy in pos:
            d = np.sqrt((xx - cx * W) ** 2 + (yy - cy * H) ** 2)
            fr += (np.clip((60 - d) / 2.0, 0, 1) * 200)[..., None]
        return np.clip(fr + np.random.default_rng(i).normal(0, 1.5, fr.shape), 0, 255)
    return f


def test_four_equal_focal_points_warn_and_one_hero_does_not():
    one = run(vid('hero1', discs(1), 60), 'composition')
    four = run(vid('hero4', discs(4), 60), 'composition')
    assert one['measured']['competing_share'] == 0.0 and one['status'] == 'pass'
    assert four['measured']['competing_share'] >= 0.9 and four['status'] == 'warn' and 'second focal point' in whats(four)


# ------------------------------------------------------------------------------------------------ eyes/encode
def test_yuv444_fails_and_a_missing_faststart_and_missing_tags_warn():
    c = run(vid('yuv444', scene, 30, pix='yuv444p'), 'encode')
    assert c['status'] == 'fail' and 'pixel format is yuv444p' in whats(c)
    nf = run(vid('nofast', scene, 30, faststart=False), 'encode')
    assert nf['measured']['faststart'] is False and 'moov atom is after mdat' in whats(nf) and 'faststart' in nf['issues'][0]['fix']
    good = run(vid('good', scene, 60), 'encode')
    assert good['measured']['faststart'] is True and good['status'] == 'pass', whats(good)
    nt = run(vid('notag', lambda i: np.clip(s.moving_scene(720, 1280)(i), 0, 255), 12, w=720, h=1280, tag=False), 'encode')
    assert nt['status'] == 'warn' and 'no colour tags' in whats(nt)


def test_a_long_keyframe_interval_warns_and_over_10_s_fails():
    sc = s.moving_scene(270, 480)
    f = lambda i: np.clip(sc(i), 0, 255)
    warn = run(vid('gop7', f, 210, w=270, h=480, x264='keyint=300:min-keyint=300:scenecut=0'), 'encode')
    assert warn['status'] == 'warn' and 'keyframe interval is 7.0 s' in whats(warn) and warn['measured']['gop_max_s'] == 7.0
    fail = run(vid('gop11', f, 330, w=270, h=480, x264='keyint=400:min-keyint=400:scenecut=0'), 'encode')
    assert fail['status'] == 'fail'
    assert run(vid('gop2', f, 210, w=270, h=480, x264='keyint=60:min-keyint=60'), 'encode')['measured']['gop_max_s'] == 2.0


def test_a_starved_bit_rate_and_a_blocky_encode_are_flagged_and_a_clean_one_is_not():
    xx = np.linspace(0, 1, W)[None, :] * np.ones((H, 1))
    yy = np.linspace(0, 1, H)[:, None] * np.ones((1, W))

    def smooth(i):
        v = 60 + 60 * xx + 60 * yy + 8 * np.sin((xx * 5 + i * 0.05) * 3)
        return np.stack([v, v * 0.9, v * 0.8], -1)
    clean = run(vid('sm14', smooth, 30, crf=14), 'encode')
    blocky = run(vid('sm40', smooth, 30, crf=40), 'encode')
    assert clean['measured']['blockiness'] < 1.75 and 'blockiness' not in whats(clean)
    assert blocky['measured']['blockiness'] > 2.5 and blocky['status'] == 'fail' and 'blockiness' in whats(blocky)
    starved = run(vid('abr', scene, 60, crf=None, extra_out=['-b:v', '20k', '-maxrate', '20k', '-bufsize', '40k']), 'encode', draft=False)
    assert starved['measured']['bits_per_pixel'] < 0.004 and 'bits per pixel' in whats(starved)
    assert 'bits per pixel' not in whats(run(vid('abr', scene, 60, crf=None, extra_out=['-b:v', '20k', '-maxrate', '20k', '-bufsize', '40k']), 'encode', draft=True))


# ------------------------------------------------------------------------------------------------ report, scores, determinism, CLI, spec
def test_scores_count_one_problem_once_and_a_fail_caps_the_category_at_7():
    mk = lambda sev, kind: {'severity': sev, 'kind': kind, 't': [1, 1], 'what': 'x', 'fix': 'y', 'viewer': 'z'}
    chk = [{'id': 'eyes/readability', 'category': 'readability', 'status': 'warn', 'issues': [mk('warn', 'time'), mk('warn', 'time'), mk('warn', 'time')], 'notes': []},
           {'id': 'eyes/safezones', 'category': 'safezones', 'status': 'fail', 'issues': [mk('fail', 'safe')], 'notes': []},
           {'id': 'eyes/hook', 'category': 'hook', 'status': 'pass', 'issues': [], 'notes': []}]
    sc = report.scores(chk)
    assert sc['readability'] == 9 and sc['safezones'] == 7 and sc['hook'] == 10 and sc['banding'] is None
    assert sc['critic_phone_readability'] == 7 and sc['critic_hook_2s'] == 10 and sc['critic_variety'] is None
    top = report.top_issues(chk)
    assert [t['check'] for t in top][:2] == ['eyes/safezones', 'eyes/readability']


def test_the_top_three_are_the_worst_three_by_severity_and_weight():
    mk = lambda cid, cat, sev, t: {'id': cid, 'category': cat, 'status': sev, 'notes': [], 'issues': [{'severity': sev, 'kind': 'k', 't': [t, t], 'what': 'x', 'fix': 'y', 'viewer': cid}]}
    chk = [mk('eyes/encode', 'encode', 'warn', 1), mk('eyes/pacing', 'pacing', 'warn', 2), mk('eyes/readability', 'readability', 'warn', 3), mk('eyes/flashes', 'flashes', 'fail', 4)]
    assert [t['check'] for t in report.top_issues(chk)] == ['eyes/flashes', 'eyes/readability', 'eyes/pacing']      # the heaviest category first; the encode warning is left out


def test_the_same_clip_gives_the_same_report_twice_and_the_cli_writes_json_and_markdown(tmp_path):
    p = vid('good', scene, 60)
    a, b = analyze(p, draft=True), analyze(p, draft=True)
    assert json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)
    j, m = str(tmp_path / 'e.json'), str(tmp_path / 'e.md')
    main([p, '--draft', '--json', j, '--md', m, '--quiet'])
    rep = json.load(open(j))
    assert [c['id'] for c in rep['checks']] == ['eyes/' + k for k in ('frame0', 'frames', 'flashes', 'banding', 'safezones', 'readability', 'pacing', 'composition', 'encode')]
    md = open(m).read()
    assert md.startswith('# Eyes report') and '## What a viewer would notice' in md and '## Picture scores' in md and '| `eyes/flashes` |' in md
    for c in rep['checks']:
        assert set(c) == {'id', 'category', 'status', 'measured', 'target', 'issues', 'notes'}
        for i in c['issues']:
            assert i['fix'] and i['viewer'] and i['what'] and i['severity'] in ('warn', 'fail')


def test_every_issue_names_a_time_and_a_fix_on_a_broken_clip():
    p = vid('blackmid', segments((30, scene), (6, black), (54, lambda i: scene(i + 30))), 90)
    rep = analyze(p, draft=True)
    top = rep['top_issues']
    assert top and all(t['fix'] and t['viewer'] for t in top) and top[0]['t'] is not None
    assert len(top) <= 3 and rep['scores']['continuity'] <= 7


def test_the_manifest_lists_every_check_with_a_source_and_the_platform_tables_match_the_js():
    man = json.load(open(os.path.join(PACK, 'eyes', 'manifest.json')))
    assert set(man['checks']) == {'eyes/' + k for k in ('frame0', 'frames', 'flashes', 'banding', 'safezones', 'readability', 'pacing', 'composition', 'encode')}
    assert all(c['source'] and c['doc'] and c['category'] in report.CATS for c in man['checks'].values())
    assert set(report.CATS) == {c['category'] for c in man['checks'].values()}
    for row, cats in man['spec']['score']['critic_rows'].items():
        assert set(cats) <= set(report.CATS), row
    if not shutil.which('node'):
        pytest.skip('node not installed')
    js = subprocess.run(['node', '-e', "Promise.all([import('./type/safezones.js'), import('./templates/_shared/plan.mjs')]).then(([a, b]) => console.log(JSON.stringify({SAFE: a.SAFE, P: b.PLATFORMS, S: b.SIZES})))"],
                        cwd=PACK, capture_output=True, text=True, check=True).stdout
    d = json.loads(js)
    pl = man['spec']['platforms']
    assert pl['sizes'] == d['S']
    for k, z in d['SAFE'].items():
        assert {a: pl['safezones'][k][a] for a in ('ref', 'top', 'bottom', 'left', 'right')} == {a: z[a] for a in ('ref', 'top', 'bottom', 'left', 'right')}, k
    assert set(pl['safezones']) == set(d['SAFE'])
    assert set(pl['presets']) == set(d['P'])
    shape = {'tall': '9:16', 'wide': '16:9', 'square': '1:1'}
    for k, v in d['P'].items():
        assert pl['presets'][k]['safe_frac'] == v['safe'] and shape[v['aspect']] in pl['presets'][k]['aspects'], k


# ------------------------------------------------------------------------------------------------ the pack's own committed demos
def test_the_ad_demo_with_its_plan_reads_its_planned_dip_and_hold_and_finds_a_real_picture():
    mp4, plan = os.path.join(PACK, 'templates', 'ad', 'out', 'ad-15.mp4'), os.path.join(PACK, 'templates', 'ad', 'out', 'plan.json')
    rep = analyze(mp4, plan=json.load(open(plan)))
    fr = check(rep, 'frames')
    assert fr['measured']['black_runs'] and all(r['planned'] for r in fr['measured']['black_runs'])
    assert any(r['planned'] for r in fr['measured']['frozen_runs'])
    assert check(rep, 'frame0')['status'] == 'pass' and check(rep, 'flashes')['status'] == 'pass'
    assert check(rep, 'pacing')['measured']['format'] == 'hype_ad' and check(rep, 'composition')['measured']['aspect'] == '16:9'
    texts = check(rep, 'readability')['measured']['texts']
    assert texts and all(t['source'] == 'shots[].text' for t in texts)


def test_the_9_16_demo_with_a_16_9_platform_override_is_a_composition_failure():
    mp4 = os.path.join(PACK, 'examples', 'brewly-teaser', 'brewly-teaser-9x16.mp4')
    c = check(analyze(mp4, only=['composition'], platform='yt.ad.15'), 'composition')
    assert c['measured']['aspect'] == '9:16' and c['status'] in ('pass', 'warn')                      # yt.ad.15 takes 9:16
    c2 = check(analyze(mp4, only=['composition'], platform='hero.web'), 'composition')
    assert c2['status'] == 'fail' and 'takes 16:9' in whats(c2)


def test_two_colour_line_accent_is_text_not_backdrop():
    """a headline with an accent word (ink + violet on paper): with fgAlt the accent glyphs are text, so the line scores its real worst pair (violet 7.2:1), not ink vs violet"""
    import numpy as np
    from eyes.checks_text import box_contrast
    crop = np.full((60, 200, 3), (0xF5, 0xF4, 0xF0), np.uint8)
    crop[20:40, 10:80] = (0x14, 0x13, 0x1A)       # ink word
    crop[20:40, 110:190] = (0x4A, 0x18, 0xED)     # accent word
    without = box_contrast(crop, '#14131A')
    with_alt = box_contrast(crop, '#14131A', ['#4A18ED'])
    assert without[0] < 3.0                        # the old reading: the accent counted as backdrop
    assert 6.5 < with_alt[0] < 8.0                 # violet on paper, about 7.2:1
