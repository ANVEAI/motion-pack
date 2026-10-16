#!/usr/bin/env python3
"""lane human: the footage tools on synthetic signals (pytest, CI: ffmpeg + numpy only, no GPU, no real people).
voice chain (loudness spec, high-pass, byte-identical reruns), chroma key (background replaced, subject kept, spill pulled, identical frames twice), conform (VFR detected and
fixed, a mic offset recovered), breaths (a breath in a gap found, a silent gap left alone), the template voice stem (deterministic, a guide band per speaker, the J / L insert
sound placed on its window), and the human.mjs CLI. Run: python3 -m pytest -q tools/tests/test_human_tools.py"""
import hashlib, json, os, subprocess, sys
import numpy as np
import pytest
from scipy.io import wavfile

PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HT = os.path.join(PACK, 'tools', 'human')
sys.path.insert(0, HT); sys.path.insert(0, os.path.join(PACK, 'sfx'))
import voice_chain, chroma, conform, breaths  # noqa: E402
from mpaudio import meter  # noqa: E402
SR = 48000


def run(*a, **k):
    return subprocess.run(list(a), capture_output=True, text=True, check=True, **k)


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def wav(path, y, sr=SR):
    wavfile.write(path, sr, np.asarray(y, np.float32))
    return path


@pytest.fixture(scope='module')
def tmp(tmp_path_factory):
    return tmp_path_factory.mktemp('human')


# ---------------- voice chain ----------------
def speechy(n=4 * SR, seed=1):
    rng = np.random.default_rng(seed)
    t = np.arange(n) / SR
    syll = (np.sin(2 * np.pi * 3.2 * t) > 0.2).astype(float)          # syllable-like gating
    y = 0.25 * np.sin(2 * np.pi * 180 * t) * syll + 0.04 * rng.standard_normal(n) * syll + 0.3 * np.sin(2 * np.pi * 30 * t)   # voice + breathiness + 30 Hz rumble
    return np.stack([y, y], 1)


def band(y, f0, f1):
    Y = np.abs(np.fft.rfft(y[:, 0]))
    f = np.fft.rfftfreq(len(y), 1 / SR)
    return float(np.sum(Y[(f >= f0) & (f < f1)] ** 2))


def test_voice_chain_meets_the_pack_loudness_spec_and_cuts_rumble(tmp):
    src = wav(str(tmp / 'v.wav'), speechy())
    y, rep = voice_chain.process(src)
    assert abs(meter.lufs_integrated(y) - (-14.0)) <= 0.5, rep
    assert meter.true_peak_db(y) <= -1.5 + 1e-3, rep
    x = speechy()
    assert band(y, 20, 45) / band(y, 150, 210) < 0.1 * band(x, 20, 45) / band(x, 150, 210), 'the 80 Hz high-pass must take the 30 Hz rumble down by more than 10 dB relative to the voice'
    assert rep['filter'].startswith('highpass=') and 'deesser' in rep['filter'] and 'acompressor' in rep['filter']


def test_voice_chain_reruns_are_byte_identical(tmp):
    src = wav(str(tmp / 'v2.wav'), speechy(seed=2))
    a, b = str(tmp / 'a.wav'), str(tmp / 'b.wav')
    voice_chain.main([src, a]); voice_chain.main([src, b])
    assert sha(a) == sha(b)


def test_voice_chain_no_loudness_keeps_the_level_for_the_mixer(tmp):
    src = wav(str(tmp / 'v3.wav'), speechy(seed=3) * 0.3)
    y, rep = voice_chain.process(src, loudness=False)
    assert rep['target_lufs'] is None and abs(meter.lufs_integrated(y) - rep['lufs_after_tone']) < 0.01


# ---------------- chroma key ----------------
def green_clip(path, w=320, h=180):
    # a green screen with a red "subject" and a green-tinted rim around it (spill)
    vf = (f'drawbox=x=110:y=40:w=100:h=110:color=0xC03020:t=fill,drawbox=x=106:y=36:w=108:h=118:color=0x70B060:t=4')
    run('ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0x00B140:s={w}x{h}:r=30:d=1', '-vf', vf, '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', path)
    return path


def test_chroma_sample_finds_the_green(tmp):
    s = chroma.sample(green_clip(str(tmp / 'g.mp4')))
    assert s['despill'] == 'green' and s['rgb'][1] > 150 and s['rgb'][0] < 40


def test_chroma_key_replaces_the_background_and_keeps_the_subject_deterministically(tmp):
    src = green_clip(str(tmp / 'g2.mp4'))
    a, b = str(tmp / 'k1.rgb'), str(tmp / 'k2.rgb')
    chroma.main(['key', src, a, '--bg', '#2040E0', '--raw']); chroma.main(['key', src, b, '--bg', '#2040E0', '--raw'])
    assert sha(a) == sha(b), 'two runs must give the same composited frames'
    f = np.frombuffer(open(a, 'rb').read(), np.uint8).reshape(-1, 180, 320, 3)[5].astype(int)
    bg, subj = f[10:30, 10:60].reshape(-1, 3).mean(0), f[70:120, 130:190].reshape(-1, 3).mean(0)
    assert bg[2] > 180 and bg[1] < 110, f'background should be the blue plate, got {bg}'
    assert subj[0] > 150 and subj[1] < 90, f'the red subject must survive the key, got {subj}'


# ---------------- conform ----------------
def vfr_clip(path):
    run('ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=160x90:r=30:d=3', '-f', 'lavfi', '-i', 'sine=f=440:d=3:sample_rate=44100',
        '-vf', "settb=1/90000,setpts='(N/30+if(eq(mod(N,4),0),0.012,0))/TB'", '-fps_mode', 'passthrough', '-enc_time_base', '1/90000', '-video_track_timescale', '90000', '-c:v', 'libx264', '-crf', '30', '-c:a', 'aac', '-shortest', path)
    return path


def test_conform_detects_vfr_and_cfr_fixes_it(tmp):
    src = vfr_clip(str(tmp / 'vfr.mp4'))
    p = conform.probe(src)
    assert p['vfr'] is True and p['audio_rate'] == 44100 and 'cfr' in p['advice']
    q = conform.cfr(src, str(tmp / 'cfr.mp4'), fps=30)
    assert q['vfr'] is False and abs(q['avg_frame_rate'] - 30) < 0.01 and q['audio_rate'] == 48000


def test_conform_sync_recovers_a_mic_offset(tmp):
    rng = np.random.default_rng(4)
    n = 6 * SR
    ref = np.zeros(n)
    for k in range(9):   # claps and syllables
        a = int((0.4 + k * 0.61 + 0.2 * rng.random()) * SR)
        ref[a:a + 2000] += rng.standard_normal(2000) * np.exp(-np.arange(2000) / 300)
    late = np.concatenate([np.zeros(int(0.37 * SR)), ref])[:n] * 0.6 + 0.002 * rng.standard_normal(n)
    r = conform.sync(wav(str(tmp / 'cam.wav'), np.stack([ref, ref], 1)), wav(str(tmp / 'mic.wav'), np.stack([late, late], 1)), max_s=2)
    assert abs(r['offset_s'] - 0.37) <= 0.01 and r['confidence'] > 5, r


# ---------------- breaths ----------------
def test_breaths_finds_the_breath_and_leaves_the_silent_gap(tmp):
    rng = np.random.default_rng(5)
    n = 6 * SR
    y = 0.0003 * rng.standard_normal(n)
    words = [(0.3, 1.0), (1.1, 1.8), (3.0, 3.6), (4.8, 5.5)]
    for s, e in words:
        a, b = int(s * SR), int(e * SR)
        y[a:b] += 0.3 * np.sin(2 * np.pi * 220 * np.arange(b - a) / SR) + 0.05 * rng.standard_normal(b - a)
    a, b = int(2.3 * SR), int(2.65 * SR)                       # a breath in gap 1.8-3.0 (gap 3.6-4.8 stays silent)
    y[a:b] += 0.02 * rng.standard_normal(b - a) * np.hanning(b - a)
    src = wav(str(tmp / 'br.wav'), np.stack([y, y], 1))
    r = breaths.detect(breaths.level(src), words)
    assert len(r['breaths']) == 1 and 2.2 <= r['breaths'][0][0] <= 2.4 and 2.5 <= r['breaths'][0][1] <= 2.75, r


# ---------------- template voice stem ----------------
def test_voice_stem_is_deterministic_with_a_band_per_speaker_and_the_insert_sound_on_its_window(tmp):
    plan = {'fps': 30, 'seconds': 4.0, 'voice': {'fps': 30, 'placeholder': 'guide', 'sources': {'mix': {'src': None}, 'b': {'src': None}},
            'segments': [{'source': 'mix', 'src_in': 0, 'src_out': 2, 'start': 0, 'speaker': 'Host', 'words': [[0.2, 0.6], [0.7, 1.2]]},
                         {'source': 'mix', 'src_in': 2, 'src_out': 4, 'start': 2, 'speaker': 'Guest', 'words': [[2.2, 2.8]]}],
            'nat': [{'source': 'b', 'amb': 'sfx/amb/city', 'audioIn': 1.4, 'audioOut': 1.9, 'pictureIn': 1.7, 'gainDb': -14}]}}
    pp = str(tmp / 'plan.json'); json.dump(plan, open(pp, 'w'))
    if not os.path.exists(os.path.join(PACK, 'sfx', 'library', 'ambience', 'snd.amb.city.wav')):
        plan['voice']['nat'] = []; json.dump(plan, open(pp, 'w'))
    a, b = str(tmp / 'vo1.wav'), str(tmp / 'vo2.wav')
    run(sys.executable, os.path.join(PACK, 'templates', '_shared', 'human', 'voice.py'), pp, a)
    run(sys.executable, os.path.join(PACK, 'templates', '_shared', 'human', 'voice.py'), pp, b)
    assert sha(a) == sha(b)
    _, y = wavfile.read(a)
    env = json.load(open(str(tmp / 'env.json')))
    assert set(env['by']) == {'Host', 'Guest'} and len(env['all']) == 120 and max(env['all']) <= 1.0
    rms = lambda s, e: float(np.sqrt(np.mean(y[int(s * SR):int(e * SR), 0] ** 2)))
    assert rms(0.3, 0.5) > 30 * rms(1.95, 2.15), 'the guide sounds inside words and is near silent between them'
    assert np.all(y[-int(0.15 * SR):] == 0), 'the last 0.15 s is digital zero'
    if plan['voice']['nat']:
        assert rms(1.5, 1.8) > 10 * rms(2.95, 3.05) + 1e-7, 'the insert sound fills its J / L window'


# ---------------- the CLI ----------------
def node(*a):
    return run('node', os.path.join(HT, 'human.mjs'), *a)


def test_cli_words_fillers_autocut_broll_cursor_captions(tmp):
    srt = tmp / 't.srt'
    srt.write_text('1\n00:00:00,500 --> 00:00:02,000\nSo, um, the view here.\n\n2\n00:00:03,500 --> 00:00:09,000\nYou know, the coffee is good, and the light by the window is lovely this early.\n')
    W = json.loads(node('words', str(srt)).stdout)
    assert W['estimated'] and len(W['words']) == 21
    wp = tmp / 'w.json'; wp.write_text(json.dumps(W))
    F = json.loads(node('fillers', str(wp)).stdout)
    assert F['hard'] == 1 and F['soft'] == 1 and F['cut'] == 0
    A = json.loads(node('autocut', str(wp), '--cut-fillers', 'hard').stdout)
    assert any(c['why'] == 'filler cut' for c in A['cuts']) and any(c['why'].startswith('silence') for c in A['cuts']) and A['seconds'] < 7.5
    B = json.loads(node('broll', str(wp), '--keywords', 'coffee', '--tail-free', '0').stdout)
    assert B['slots'] and B['slots'][0]['word'].startswith('coffee') and B['slots'][0]['src'] is None
    cp = tmp / 'c.json'; cp.write_text(json.dumps({'clicks': [{'t': 1, 'x': 0.2, 'y': 0.3}, {'t': 2, 'x': 0.8, 'y': 0.7}]}))
    T = json.loads(node('cursor', str(cp), '--end', '3').stdout)
    assert T['estimated'] and len(T['track']) == 91 and sum(1 for q in T['track'] if len(q) == 4) == 2
    P = json.loads(node('captions', '--pick', 'karaoke', '--aspect', '9:16').stdout)
    assert P['base'] == 'karaoke' and not P['lint']
    assert 'doc' in json.loads(node('captions').stdout)
