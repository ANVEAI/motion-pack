#!/usr/bin/env python3
"""The 'peak' anchor must not depend on the CPU (pytest, or plain asserts: python3 sfx/tests/test_anchor.py).
A rebuild on x86-64 Linux differs from arm64 macOS by at most one 24-bit LSB in 248 of 301 sounds (FMA / libm last bits, same pinned numpy / scipy / numba).
With argmax as the anchor, that flipped the anchor of two repeating sounds between their near-equal peaks: snd.cartoon.cuckoo 681 ms vs 181 ms and
snd.device.phone_ring_synth 842 ms vs 1942 ms, so a cue lined up on one machine landed half a second off on the other. registry.peak_anchor takes the
first sample within 1e-5 of the peak; here every repeating sound is rebuilt with +-1 LSB of seeded noise and its anchor must not move."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from mpaudio import dsp, registry  # noqa: E402
import recipes  # noqa: E402
LSB24 = 2.0 ** -23
TIED = ("snd.cartoon.cuckoo", "snd.device.phone_ring_synth")


def _r(sid):
    recipes.load_all()
    return registry.render(sid)


def _noisy(y, k):
    return y.astype(np.float64) + np.random.default_rng(k).integers(-1, 2, size=y.shape) * LSB24


def test_repeating_sounds_keep_their_anchor_under_one_lsb_of_noise_and_argmax_does_not():
    flips = 0
    for sid in TIED:
        y, anchor, s = _r(sid)
        assert s.kind == "peak" and anchor == registry.peak_anchor(y)
        moved = [abs(registry.peak_anchor(_noisy(y, k)) - anchor) for k in range(24)]
        assert max(moved) <= dsp.ms(1), "%s: anchor moves %d samples under 1 LSB of noise" % (sid, max(moved))
        flips += sum(abs(int(np.argmax(np.max(np.abs(_noisy(y, k)), axis=1))) - anchor) > dsp.ms(100) for k in range(24))
    assert flips > 0, "the fixture is not sensitive: plain argmax never jumped to the other call either, so this test would pass without the fix"


def test_the_cuckoo_anchor_is_its_first_call_and_the_manifest_agrees():
    y, anchor, _ = _r("snd.cartoon.cuckoo")
    assert anchor / dsp.SR < 0.4, "anchor %.3f s: the first of the two calls is the hit" % (anchor / dsp.SR)
    man = {s["id"]: s for s in json.load(open(os.path.join(HERE, "manifest.json")))["sounds"]}
    for sid in TIED:
        assert man[sid]["anchor_sample"] == _r(sid)[1]


if __name__ == "__main__":
    test_repeating_sounds_keep_their_anchor_under_one_lsb_of_noise_and_argmax_does_not()
    test_the_cuckoo_anchor_is_its_first_call_and_the_manifest_agrees()
    print("ok")
