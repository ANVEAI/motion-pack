#!/usr/bin/env python3
"""Music kit tests (plain asserts; run: python3 music/tests/test_music.py)."""
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
import _path  # noqa: F401
from mpaudio import dsp, meter  # noqa: E402
import compose as C  # noqa: E402
import mixer  # noqa: E402
SR = dsp.SR


def test_euclid():
    assert C.bjorklund(4, 16) == [1, 0, 0, 0] * 4
    assert sum(C.bjorklund(5, 16)) == 5 and sum(C.bjorklund(7, 16)) == 7
    assert C.bjorklund(3, 8) == [1, 0, 0, 1, 0, 0, 1, 0]


def test_chords_in_key():
    # A major (tonic MIDI 57): I = A C# E, V = E G# B, vi = F# A C#, IV = D F# A
    assert C.chord_midi(57, "major", "I") == [57, 61, 64]
    assert C.chord_midi(57, "major", "V") == [64, 68, 71]
    assert [n % 12 for n in C.chord_midi(57, "major", "vi")] == [6, 9, 1]
    assert [n % 12 for n in C.chord_midi(57, "minor", "i")] == [9, 0, 4]


def test_compose_deterministic_and_grid():
    a = C.compose("hype_house", "reel_15s", 4, 30)
    b = C.compose("hype_house", "reel_15s", 4, 30)
    assert np.array_equal(a["mix"], b["mix"])
    fpb = a["meta"]["frames_per_beat"]
    assert fpb == 14 and abs(a["meta"]["bpm"] - 128.5714) < 1e-3
    kicks = [e for e in a["events"] if e["kind"] == "kick"]
    assert kicks and all(abs(e["frame"] - round(e["frame"])) < 0.01 for e in kicks)
    assert a["meta"]["length_frames"] == a["meta"]["bars"] * fpb * 4


def test_hook_has_event_in_first_3_frames():
    r = C.compose("hype_house", "reel_15s", 4, 30)
    assert np.max(np.abs(r["mix"][: 3 * 1600])) > 0.05


def test_loop_is_seamless():
    r = C.compose("lofi_warm", "loop_8", 2, 30)
    m = r["mix"].mean(axis=1)
    step = abs(m[0] - m[-1]) / (np.max(np.abs(np.diff(m))) + 1e-9)
    assert step < 1.5, step


def test_duck_depth_and_lookahead():
    vo = np.zeros((SR * 4, 2))
    t = np.arange(SR) / SR
    vo[SR:2 * SR, 0] = 0.3 * np.sin(2 * np.pi * 220 * t)
    env = mixer.duck_envelope(vo)
    assert abs(20 * np.log10(env[int(1.6 * SR)]) + 9.0) < 0.5
    assert env[int((1.0 - 0.05) * SR)] < 0.97            # the duck starts BEFORE the first syllable (80 ms look-ahead)
    assert env[int(3.5 * SR)] > 0.975                    # recovered (within 0.2 dB after about 4 release constants)


def test_duck_depth_param_and_bed_automation():
    vo = np.zeros((SR * 4, 2))
    t = np.arange(SR) / SR
    vo[SR:2 * SR, 0] = 0.3 * np.sin(2 * np.pi * 220 * t)
    assert abs(20 * np.log10(mixer.duck_envelope(vo, depth_db=12.0)[int(1.6 * SR)]) + 12.0) < 0.5
    assert np.array_equal(mixer.duck_envelope(vo), mixer.duck_envelope(vo, depth_db=9.0))     # the default is unchanged
    m = mixer.Mix(30, 4.0, lib=object())
    assert m.duck_db == 9.0 and np.all(m.bed_gain() == 1.0)                                   # no duck_db / automation: as before
    m.automate_bed([{"frame": 30, "gain_db": 0.0}, {"frame": 60, "gain_db": -20.0}])
    gdb = 20 * np.log10(m.bed_gain())
    assert abs(gdb[0]) < 1e-9 and abs(gdb[int(1.5 * SR)] + 10.0) < 0.2 and abs(gdb[int(3.5 * SR)] + 20.0) < 1e-6   # linear in dB between breakpoints, held outside
    import tempfile
    import soundfile as sf
    with tempfile.TemporaryDirectory() as td:                                                 # the cue sheet carries both through
        sf.write(os.path.join(td, "bed.wav"), 0.1 * np.ones((SR * 4, 2)), SR)
        sf.write(os.path.join(td, "vo.wav"), vo, SR)
        sheet = {"fps": 30, "length_s": 4.0, "bed": {"file": "bed.wav", "loop": False, "automation": [{"frame": 0, "gain_db": 0}, {"frame": 90, "gain_db": -30}]},
                 "vo": {"file": "vo.wav", "duck_db": 12}}
        m2 = mixer.mix_from_cuesheet(sheet, td)
        assert m2.duck_db == 12.0 and m2.bed_auto is not None
        assert mixer.mix_from_cuesheet({k: v for k, v in sheet.items() if k != "vo"}, td).duck_db == 9.0


def test_cue_lint():
    cues = [{"id": "snd.hit.cinema", "frame": 10, "tier": 1}, {"id": "snd.hit.sub_drop", "frame": 60, "tier": 1, "over_bed_db": 7.0}]
    iss = mixer.lint_cues(cues, 30)
    assert any("R4" in i for i in iss) and any("R2" in i for i in iss) and any("R10" in i for i in iss)


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
