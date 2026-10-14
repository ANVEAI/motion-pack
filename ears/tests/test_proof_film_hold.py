"""templates/proof-film: the quiet end-card hold reads as a 'quiet hold' in ears, because a flat room tone sits under the falling bed.
A pulsing bed (a kick every beat, an accent every bar) that merely falls 40 dB still reads as a DECAY: its pulse is the same 10 dB at any level, and refstudy's quiet hold wants the last
2 s within 8 dB. The film therefore adds `sfx/amb/room_tone` (plan cue overBedDb) as the bed leaves. This test mixes the committed plan's bed automation and cues over a stand-in pulsing bed
(the real bed master is gitignored) through templates/_shared/audio.py -> music/mixer.py, with and without the room tone cue, and runs ears' own end-shape classifier on the result.
Needs the sound library (CI builds it first: python3 sfx/build_library.py). Run: python3 -m pytest -q ears/tests/test_proof_film_hold.py"""
import argparse
import copy
import json
import os
import sys

import numpy as np
import pytest
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, PACK)
sys.path.insert(0, os.path.join(PACK, 'templates', '_shared'))
PLAN = os.path.join(PACK, 'templates', 'proof-film', 'out', 'plan.json')
ROOM = os.path.join(PACK, 'sfx', 'library', 'ambience', 'snd.amb.room_tone.wav')
pytestmark = pytest.mark.skipif(not os.path.exists(ROOM), reason='sound library not built (python3 sfx/build_library.py)')

SR = 48000


def stand_in_bed(path, bpm=120.0, sec=8.0):
    """a pulsing bed: a 60 Hz kick on every beat (every 4th beat 10 dB louder), a hat on the off-beat, a soft pad: the shape that makes a bed read as a pulse at any level"""
    n = int(sec * SR); y = np.zeros(n); beat = 60.0 / bpm; rng = np.random.default_rng(3)
    k = np.arange(int(0.18 * SR)) / SR; kick = np.sin(2 * np.pi * 60 * k) * np.exp(-k * 22)
    hat = rng.standard_normal(int(0.04 * SR)) * np.exp(-np.arange(int(0.04 * SR)) / SR * 120) * 0.05
    for i in range(int(sec / beat)):
        a = int(i * beat * SR); g = 1.0 if i % 4 == 0 else 0.32
        y[a:a + len(kick)] += g * kick[:max(0, min(len(kick), n - a))]
        b = int((i + 0.5) * beat * SR); y[b:b + len(hat)] += hat[:max(0, min(len(hat), n - b))]
    t = np.arange(n) / SR; y += 0.03 * np.sin(2 * np.pi * 220 * t) * 0.5
    y = y / np.max(np.abs(y)) * 0.5
    sf.write(path, np.stack([y, y], 1), SR, subtype='FLOAT')


def mix_and_shape(plan, tmp_path, name):
    import audio                                                       # templates/_shared/audio.py: the real pass-through (overBedDb -> the mixer's over_bed_db)
    from ears.checks_shape import _refstudy_like
    from ears.core import quiet_shape
    bed = str(tmp_path / 'bed.wav'); stand_in_bed(bed)
    pj = str(tmp_path / (name + '.json')); json.dump(plan, open(pj, 'w'))
    out = str(tmp_path / (name + '.wav')); audio.via_music_mixer(plan, out, bed, argparse.Namespace(target=-14.0, plan=pj))
    y, sr = sf.read(out, always_2d=True); assert sr == SR
    return quiet_shape(_refstudy_like(y.mean(1))['curve'])


def test_room_tone_under_the_bed_makes_the_hold_flat_and_the_bed_alone_does_not(tmp_path):
    P = json.load(open(PLAN)); hold = next(q for q in P['audio']['quiet'] if q['kind'] == 'hold')
    room = [c for c in P['cues'] if c['id'] == 'sfx/amb/room_tone']
    assert len(room) == 1 and room[0]['overBedDb'] <= -20 and room[0]['t'] <= hold['t'][0] and hold['t'][1] - hold['t'][0] >= 3
    with_room = mix_and_shape(P, tmp_path, 'with_room')
    Q = copy.deepcopy(P); Q['cues'] = [c for c in Q['cues'] if c['id'] != 'sfx/amb/room_tone']
    without = mix_and_shape(Q, tmp_path, 'without_room')
    assert with_room['end_shape'] == 'quiet hold' and with_room['quiet_tail'], with_room
    assert with_room['tail_2s_vs_body_db'] <= -10, with_room                 # the refstudy bar for a quiet tail: 10 dB under the body
    assert without['end_shape'] != 'quiet hold', without                       # the stand-in bed alone falls 40 dB and still pulses: a decay


def test_the_room_tone_itself_is_flat():
    """the floor under the hold: in every 2 s window of the library sound the 0.25 s RMS blocks spread (p90 - p10) under 3 dB; the quiet-hold classifier allows 8"""
    y, sr = sf.read(ROOM, always_2d=True); y = y.mean(1); n = int(0.25 * sr)
    b = np.array([10 * np.log10(np.mean(y[a:a + n] ** 2) + 1e-12) for a in range(0, len(y) - n + 1, n)])
    spread = [np.percentile(b[a:a + 8], 90) - np.percentile(b[a:a + 8], 10) for a in range(len(b) - 7)]
    assert max(spread) < 3.0, spread
