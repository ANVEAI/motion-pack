"""ears detectors on synthetic signals (numpy only, a few seconds each, nothing large on disk). Run: python3 -m pytest -q ears/tests"""
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
from ears.listen import analyze  # noqa: E402
from ears import core, mood  # noqa: E402


def check(rep, cid):
    return next(c for c in rep['checks'] if c['id'] == 'ears/' + cid)


def whats(c):
    return ' | '.join(i['what'] for i in c['issues'])


# ------------------------------------------------------------------------------------------------ loudness
def test_lufs_of_a_minus_20_dbfs_1khz_sine():
    x = s.sine(1000.0, -20.0, 10.0)
    # BS.1770: a 0 dBFS 1 kHz sine in one channel reads -3.01 LUFS, so -20 dBFS in one channel is -23.01 and in both channels -20.0
    assert core.meter.lufs_integrated(np.stack([x, np.zeros_like(x)], 1)) == pytest.approx(-23.01, abs=0.3)
    rep = analyze(s.st(x))
    assert check(rep, 'loudness')['measured']['integrated_lufs'] == pytest.approx(-20.0, abs=0.3)
    assert check(rep, 'loudness')['status'] == 'fail'                       # 6 LU under the -14 target


def test_loudness_target_true_peak_and_tail():
    x = s.sine(1000.0, -11.0, 6.0)                                           # about -14 LUFS (dual mono, -11 dBFS peak = -14 RMS... K at 1 kHz ~ +0.7)
    x *= 10 ** ((-14.0 - core.meter.lufs_integrated(s.st(x))) / 20)
    fade = np.ones_like(x)
    n = int(0.2 * s.SR)
    fade[-n:] = 0
    rep = analyze(s.st(x * fade), is_master=True)
    lo = check(rep, 'loudness')
    assert lo['measured']['integrated_lufs'] == pytest.approx(-14.0, abs=0.2)
    assert lo['status'] == 'pass', whats(lo)
    rep2 = analyze(s.st(x), is_master=True)                                  # no digital zero at the end
    assert 'not digital silence' in whats(check(rep2, 'loudness'))


def test_lra_is_small_for_a_steady_signal_and_large_for_a_jump():
    steady = s.pink(12, 3, -20)
    jump = np.concatenate([s.pink(6, 4, -30), s.pink(6, 5, -14)])            # -40 would fall under the -20 LU relative gate
    assert core.lra(s.st(steady)) < 2.0
    assert core.lra(s.st(jump)) > 12.0


# ------------------------------------------------------------------------------------------------ clipping
def test_clipped_sine_is_flagged_and_a_clean_one_is_not():
    clean = s.sine(440.0, -6.0, 3.0)
    clipped = np.clip(1.6 * s.sine(440.0, 0.0, 3.0), -1.0, 1.0)
    rc, rx = analyze(s.st(clean)), analyze(s.st(clipped))
    assert check(rc, 'clipping')['measured']['clipped_runs'] == 0
    cx = check(rx, 'clipping')
    assert cx['status'] == 'fail' and cx['measured']['clipped_runs'] > 100
    assert 'clipped runs' in whats(cx)
    assert any(i['check'] == 'ears/clipping' for i in rx['top_issues'])


def test_intersample_over_is_caught():
    # a sine at fs/4 with a 45 degree phase: every sample sits at 0.707 of the true peak
    t = np.arange(int(2 * s.SR))
    x = 1.25 * np.sin(2 * np.pi * (s.SR / 4) * t / s.SR + np.pi / 4)
    x = x / np.abs(x).max() * 0.99                                         # samples at -0.09 dBFS, true peak about +2.9 dBTP
    c = check(analyze(s.st(x)), 'clipping')
    assert c['measured']['true_peak_dbtp'] > 2.0
    assert 'intersample' in whats(c)


# ------------------------------------------------------------------------------------------------ tone
def test_mud_heavy_mix_flags_mud_and_a_balanced_one_does_not():
    base = s.mix_like(8, 2)
    muddy = base + 4.0 * s.bandpass(base, 200, 500)
    tb, tm = check(analyze(s.st(base)), 'tone'), check(analyze(s.st(muddy)), 'tone')
    assert 'mud' not in whats(tb), whats(tb)
    assert 'mud' in whats(tm)
    assert tm['measured']['db_per_octave_vs_mid']['mud'] > tb['measured']['db_per_octave_vs_mid']['mud'] + 6


def test_harsh_and_dull_are_told_apart():
    base = s.mix_like(6, 3)
    harsh = base + 6.0 * s.bandpass(s.pink(6, 9, -22), 2000, 5000)
    dull = s.lowpass(base, 1500.0, order=4)
    assert 'harsh' in whats(check(analyze(s.st(harsh)), 'tone'))
    assert 'dull' in whats(check(analyze(s.st(dull)), 'tone'))


# ------------------------------------------------------------------------------------------------ rhythm and sync
def test_click_track_at_120_bpm_reads_120():
    rep = analyze(s.st(s.click_track(120.0, 8.0)))
    sy = check(rep, 'sync')['measured']
    assert sy['tempo_bpm'] == pytest.approx(120.0, abs=2.0)
    assert sy['tempo_confidence'] > 0.5


def test_cuts_on_onsets_pass_and_cuts_off_them_fail():
    y = s.click_track(120.0, 8.0, offset=0.02)
    on = [0.02 + 0.5 * k for k in range(1, 15)]
    good = analyze(s.st(y), cuts=on[::2])
    bad = analyze(s.st(y), cuts=[t + 0.23 for t in on[::2]])
    assert check(good, 'sync')['measured']['cuts_on_onset'] == 1.0
    assert check(bad, 'sync')['measured']['cuts_on_onset'] == 0.0 and check(bad, 'sync')['status'] == 'fail'


def _plan_with_clicks(shift_frames, fps=30):
    """kicks on frames F (a bed on the beat) + the pack's own ui click placed on F + 1 + shift"""
    n = 8 * s.SR
    rng = np.random.default_rng(1)
    bed = 0.02 * rng.standard_normal(n)
    for k in range(16):
        a = int(k * 0.5 * s.SR)
        tt = np.arange(int(0.12 * s.SR)) / s.SR
        bed[a:a + len(tt)] += 0.5 * np.sin(2 * np.pi * (50 + 80 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 18)
    cues = []
    for i, t in enumerate((1.0, 2.5, 4.0, 5.5)):
        take = core.cue_take('sfx/ui/click', i)
        assert take is not None
        a, anc = take
        f = int(round(t * fps))
        pos = int((f + 1 + shift_frames) * s.SR / fps) - anc
        bed[pos:pos + len(a)] += 0.6 * a
        cues.append({'id': 'sfx/ui/click', 't': t})
    return bed, {'fps': fps, 'cues': cues, 'shots': []}


def test_cue_anchor_on_f_plus_1_passes_and_on_f_fails():
    y, plan = _plan_with_clicks(0)
    ok = check(analyze(s.st(y), plan=plan), 'sync')
    assert ok['measured']['cues_on_anchor'] == 1.0, ok['measured']['cue_rows']
    y, plan = _plan_with_clicks(-1)
    late = check(analyze(s.st(y), plan=plan), 'sync')
    dts = [r['dt_frames'] for r in late['measured']['cue_rows'] if r['dt_frames'] is not None]
    assert dts and all(abs(d + 1) < 0.2 for d in dts)
    assert late['status'] == 'fail'


def test_silent_first_frames_are_flagged():
    y = np.concatenate([np.zeros(int(0.5 * s.SR)), s.click_track(120, 4)])
    assert 'first audible sound' in whats(check(analyze(s.st(y)), 'sync'))


# ------------------------------------------------------------------------------------------------ speech
R = [(2.0, 5.5), (8.5, 11.5)]


def _speech_mix(depth_db, sec=14):
    bed = 2 * s.mix_like(sec, 5)
    return bed * s.duck_env(sec, R, depth_db) + s.speech_like(sec, R, dbfs=-14)


def test_speech_without_ducking_fails_and_with_10_db_ducking_passes():
    tr = [(a, b, int((b - a) * 2.4)) for a, b in R]                         # 144 words per minute
    no = check(analyze(s.st(_speech_mix(0)), transcript=tr), 'speech')
    assert no['status'] == 'fail' and 'drops only' in whats(no)
    yes = check(analyze(s.st(_speech_mix(10)), transcript=tr), 'speech')
    assert yes['status'] == 'pass', whats(yes)
    assert yes['measured']['ducking_db_median'] == pytest.approx(10, abs=1.0)
    assert yes['measured']['words_per_min'] == pytest.approx(142, abs=6)


def test_the_detector_finds_speech_like_bursts_and_nothing_in_a_plain_bed():
    sp = check(analyze(s.st(_speech_mix(10))), 'speech')
    assert sp['measured']['source'] == 'vad'
    found = sum(min(b, rb) - max(a, ra) for a, b in R for ra, rb in (r['t'] for r in sp['measured']['regions']) if min(b, rb) > max(a, ra))
    assert found > 0.6 * sum(b - a for a, b in R)
    assert sp['status'] == 'pass' and not sp['issues']                      # detector regions: measured, never judged
    assert sp['measured']['ducking_db_median'] > 8
    no = check(analyze(s.st(_speech_mix(0) + s.speech_like(14, R, seed=1, dbfs=-12))), 'speech')
    assert not no['issues'] and any('unverified' in n for n in no['notes'])


def test_words_json_is_a_transcript():
    words = {'words': [{'w': 'a', 's': 2.0, 'e': 2.3}, {'w': 'b', 's': 2.4, 'e': 2.8}, {'w': 'c', 's': 4.0, 'e': 4.4}]}
    assert core.speech_from(words) == [(2.0, 2.8, 2), (4.0, 4.4, 1)]
    assert check(analyze(s.st(s.mix_like(10))), 'speech')['status'] == 'n/a'
    assert check(analyze(s.st(s.click_track(120, 8))), 'speech')['status'] == 'n/a'


# ------------------------------------------------------------------------------------------------ structure
def _final_hit(gap):
    bed = s.mix_like(10, 7)
    for t in (1.0, 3.0, 5.0):
        a = int(t * s.SR)
        bed[a:a + 480] += s.click(0.01, 900.0, 0.4)
    if gap:
        bed[int(7.5 * s.SR):int(9.5 * s.SR)] *= 10 ** (-40 / 20)
    a = int(9.5 * s.SR)
    tt = np.arange(int(0.4 * s.SR)) / s.SR
    bed[a:a + len(tt)] += 0.8 * np.sin(2 * np.pi * 220 * tt) * np.exp(-tt * 8)
    return bed


def test_a_two_second_breath_before_the_final_hit_is_found():
    st = check(analyze(s.st(_final_hit(True))), 'structure')
    assert st['measured']['final_sting_s'] == pytest.approx(9.5, abs=0.05)
    assert st['measured']['breath']['length_s'] == pytest.approx(2.0, abs=0.25)
    assert 'breath' not in whats(st)
    st2 = check(analyze(s.st(_final_hit(False))), 'structure')
    assert st2['measured']['breath'] is None
    assert any('no breath before the final sting' in n for n in st2['notes'])


def test_a_late_drop_is_flagged():
    y = np.concatenate([s.mix_like(16, 8) * 0.12, s.mix_like(4, 9)])
    st = check(analyze(s.st(y)), 'structure')
    assert st['measured']['drop_share'] > 0.75
    assert 'late drop' in whats(st)


def test_a_flat_mix_fails_the_blindfold_test_and_a_shaped_one_does_not():
    flat = check(analyze(s.st(s.mix_like(10, 4))), 'structure')
    assert 'flat: one level' in whats(flat)
    shaped = np.concatenate([s.mix_like(4, 1) * 0.25, s.mix_like(6, 2)])
    assert 'flat' not in whats(check(analyze(s.st(shaped)), 'structure'))


def test_loop_seam_only_judged_with_loop():
    y = np.concatenate([s.mix_like(4, 1) * 0.1, s.mix_like(4, 2)])
    assert 'loop seam' in whats(check(analyze(s.st(y), loop=True), 'structure'))
    assert 'loop seam' not in whats(check(analyze(s.st(y)), 'structure'))


# ------------------------------------------------------------------------------------------------ repetition, stereo
def test_the_same_sfx_repeated_often_is_flagged():
    y = 0.003 * np.random.default_rng(3).standard_normal(10 * s.SR)
    c = s.click(0.03, 2500.0, 0.5) * np.exp(-np.arange(int(0.03 * s.SR)) / s.SR * 60)
    for t in (0.7, 1.9, 2.6, 4.1, 4.5, 5.8, 7.3):
        a = int(t * s.SR)
        y[a:a + len(c)] += c
    r = check(analyze(s.st(y)), 'repetition')
    assert 'repeats' in whats(r)


def test_stereo_phase_problems():
    x = s.pink(5, 1, -20)
    anti = np.stack([x, -x], 1)
    st = check(analyze(anti), 'stereo')
    assert st['status'] == 'fail' and st['measured']['correlation'] < -0.9
    assert check(analyze(s.st(x)), 'stereo')['measured']['mono']


# ------------------------------------------------------------------------------------------------ compare, mood, scores, CLI
def test_compare_with_a_reference_study():
    ref = {'loudness': {'integrated_lufs': -10.0}, 'audio': {'band_share_mean': {'low_<150Hz': 0.6, 'mid': 0.38, 'high_>4kHz': 0.02}, 'tempo_bpm_estimate': 128,
           'tempo_confidence': 0.5, 'brightness_hz_mean': 400, 'loudness_curve_4hz_dbfs': [-30 + i * 0.2 for i in range(40)], 'sync': {'share_on_onset': 0.7}}}
    c = check(analyze(s.st(s.click_track(120, 8)), refs=[('ref', ref)]), 'compare')
    assert c['status'] == 'info' and any(d.startswith('loudness') for d in c['measured']['differences'])


def test_mood_is_unavailable_without_a_local_model(monkeypatch):
    monkeypatch.delenv('EARS_CLAP_MODEL', raising=False)
    m = mood.labels(np.zeros(s.SR), s.SR, [{'t': [0, 1]}])
    assert m['available'] is False and m['text'] == 'mood: not available (no local model)'


def test_scores_follow_the_critic_rubric():
    rep = analyze(s.st(np.clip(1.6 * s.sine(440.0, 0.0, 3.0), -1, 1)))
    assert rep['scores']['cleanliness'] <= 7                                 # any fail caps a category below 8
    assert rep['scores']['critic_sound_sync'] <= 7
    assert 1 <= len(rep['top_issues']) <= 3


@pytest.mark.skipif(shutil.which(os.environ.get('FFMPEG', 'ffmpeg')) is None, reason='ffmpeg not on PATH')
def test_cli_on_a_short_wav(tmp_path):
    import soundfile as sf
    w = tmp_path / 'a.wav'
    y = s.click_track(120, 3)
    y[-int(0.2 * s.SR):] = 0
    sf.write(str(w), s.st(y), s.SR, subtype='PCM_16')
    r = subprocess.run([sys.executable, os.path.join(PACK, 'ears', 'listen.py'), str(w), '--json', str(tmp_path / 'o.json'), '--md', str(tmp_path / 'o.md')],
                       capture_output=True, text=True, timeout=240)
    assert r.returncode == 0, r.stderr
    assert 'mood: not available (no local model)' in r.stdout
    rep = json.load(open(tmp_path / 'o.json'))
    assert {c['id'] for c in rep['checks']} >= {'ears/loudness', 'ears/clipping', 'ears/tone', 'ears/speech', 'ears/sync', 'ears/structure',
                                               'ears/repetition', 'ears/stereo', 'ears/compare'}
    assert '## What a listener would notice' in open(tmp_path / 'o.md').read()


def test_gemini_mood_is_opt_in_and_fails_soft(monkeypatch, tmp_path):
    """--mood gemini without MP_GCP_PROJECT (or without the cloud module) reports unavailable, never raises"""
    from ears import mood
    monkeypatch.delenv('MP_GCP_PROJECT', raising=False)
    r = mood.gemini(str(tmp_path / 'missing.wav'))
    assert r['available'] is False and r['text'].startswith('mood: gemini not available')


# ------------------------------------------------------------------------------------------------ round 4/5: modes, planned quiet, end shape
def _with_hold(body_s=10.0, hold_s=6.0):
    """a shaped body, then an end-card quiet hold of near-silence (-70 dBFS room tone), the last 0.15 s at digital zero"""
    body = np.concatenate([s.mix_like(3, 11) * 0.3, s.mix_like(body_s - 3, 12)])
    hold = 10 ** (-70 / 20) * np.random.default_rng(3).standard_normal(int(hold_s * s.SR))
    y = np.concatenate([body, hold])
    y[-int(0.15 * s.SR):] = 0
    return y


def test_a_planned_quiet_hold_passes_and_the_same_file_unmarked_warns():
    y = _with_hold()
    bare = check(analyze(s.st(y)), 'structure')
    assert 'dead air' in whats(bare) and bare['status'] == 'warn'
    plan = {'fps': 30, 'audio': {'quiet': [{'t': [10.0, 16.0], 'kind': 'hold', 'why': 'end card holds on near-silence'}]}}
    ok = check(analyze(s.st(y), plan=plan), 'structure')
    assert 'dead air' not in whats(ok) and ok['status'] == 'pass', whats(ok)
    row = ok['measured']['quiet'][-1]
    assert row['planned'] and row['kind'] == 'hold' and row['length_s'] == pytest.approx(6.0, abs=0.5)
    assert ok['measured']['end_shape'] == 'quiet hold'
    long = check(analyze(s.st(_with_hold(10.0, 11.0)), plan={'audio': {'quiet': [{'t': [10.0, 21.0], 'kind': 'hold'}]}}), 'structure')
    assert 'longer than the house max 9 s' in whats(long)


def test_a_planned_quiet_open_waives_the_frame_0_event():
    y = np.concatenate([np.zeros(int(1.5 * s.SR)), s.click_track(120, 6)])
    assert 'first audible sound' in whats(check(analyze(s.st(y)), 'sync'))
    sy = check(analyze(s.st(y), quiet=[{'t': [0, 1.5], 'kind': 'open', 'why': 'sound enters on the first visual event'}]), 'sync')
    assert 'first audible sound' not in whats(sy) and any('planned quiet open' in n for n in sy['notes'])
    y3 = np.concatenate([np.zeros(int(3.5 * s.SR)), s.click_track(120, 6)])
    assert 'planned quiet open runs' in whats(check(analyze(s.st(y3), quiet=[[0, 3.5]]), 'sync'))


def test_mode_vo_judges_speech_continuity_not_cut_sync():
    y = s.click_track(120.0, 8.0, offset=0.02)
    cuts = [0.02 + 0.5 * k + 0.23 for k in range(1, 14, 2)]                 # every cut off the onsets
    tr = [(0.5, 7.5, 20)]
    words = [(0.5 + 0.35 * k, 0.5 + 0.35 * k + 0.3) for k in range(20)]
    music = check(analyze(s.st(y), cuts=cuts), 'sync')
    assert music['status'] == 'fail'                                          # default mode unchanged
    vo = check(analyze(s.st(y), cuts=cuts, transcript=tr, words=words, mode='vo'), 'sync')
    assert 'of an onset' not in whats(vo) and any('information only' in n for n in vo['notes'])
    assert vo['measured']['cuts_under_speech'] == 1.0
    assert vo['measured']['cuts_inside_words'] > 0 and 'inside a word' in whats(vo)
    gaps = [0.5 + 0.35 * k + 0.325 for k in range(1, 12, 2)]               # cuts in the 50 ms gaps between words
    clean = check(analyze(s.st(y), cuts=gaps, transcript=tr, words=words, plan={'audio': {'mode': 'vo'}}), 'sync')
    assert clean['measured']['cuts_inside_words'] == 0 and 'inside a word' not in whats(clean)


def test_mode_continuous_scores_motion_events_on_onsets():
    y = s.click_track(120.0, 8.0, offset=0.02)
    on = [0.02 + 0.5 * k for k in range(1, 15)]
    good = check(analyze(s.st(y), mode='continuous', events=on[::3]), 'sync')
    assert good['measured']['events_on_onset'] == 1.0 and good['status'] == 'pass', whats(good)
    bad = check(analyze(s.st(y), plan={'audio': {'mode': 'continuous', 'events': [t + 0.23 for t in on[::3]]}}), 'sync')
    assert bad['measured']['events_on_onset'] == 0.0 and 'motion events' in whats(bad) and bad['status'] == 'fail'
    none = check(analyze(s.st(y), mode='continuous'), 'sync')
    assert any('no motion events' in n for n in none['notes'])


def test_bass_share_by_role_and_reference_quiet_shape():
    y = s.mix_like(10, 4)
    c = check(analyze(s.st(y), role='trailer'), 'compare')
    assert c['status'] == 'info' and 'for a trailer bed' in ' '.join(c['notes'])
    ref = {'loudness': {'integrated_lufs': -15.0}, 'audio': {'band_share_mean': {'low_<150Hz': 0.3, 'high_>4kHz': 0.05},
           'loudness_curve_4hz_dbfs': [-60.0] * 4 + [-16.0] * 40 + [-70.0] * 8}}
    c2 = check(analyze(s.st(y), refs=[('r', ref)], role='proof'), 'compare')
    d = ' | '.join(c2['measured']['differences'])
    assert 'quiet tail' in d and 'references end quiet hold 1' in d and 'proof bed' in d


@pytest.mark.skipif(shutil.which(core.FFMPEG) is None, reason='ffmpeg not on PATH')
def test_cli_continuous_mode_measures_motion_events_from_the_video(tmp_path):
    clip = str(tmp_path / 'c.mp4')
    vf = "drawbox=x=20:y=20:w=60:h=40:color=white:t=fill:enable='gte(t,1.0)',drawbox=x=0:y=140:w=320:h=24:color=0x4A18ED:t=fill:enable='gte(t,2.5)'"
    subprocess.run([core.FFMPEG, '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=0x202428:s=320x180:r=30:d=4', '-f', 'lavfi', '-i',
                    "aevalsrc='0.02*sin(2*PI*110*t)+0.6*sin(2*PI*1500*t)*(between(t,1,1.03)+between(t,2.5,2.53))':s=48000:d=4", '-vf', vf,
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', clip], check=True)
    from ears.listen import main
    rep = main([clip, '--mode', 'continuous', '--quiet', '--json', str(tmp_path / 'e.json')])
    sy = check(rep, 'sync')
    assert rep['mode'] == 'continuous' and sy['measured']['motion_events'] == 2 and sy['measured']['events_on_onset'] == 1.0
