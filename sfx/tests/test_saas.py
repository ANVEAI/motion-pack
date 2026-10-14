#!/usr/bin/env python3
"""Tests for the 2026-10-14 SaaS / launch-film sounds (recipes/saas.py), the saas_launch and mockumentary bundles and the mixer's loop stop
(plain asserts; run: python3 sfx/tests/test_saas.py). Measurement only, no listening."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "music"))
from mpaudio import dsp, meter, registry  # noqa: E402
import recipes  # noqa: E402
SR = dsp.SR
NEW = ("snd.paper.card_riffle", "snd.paper.card_shuffle_settle", "snd.ui.scan_sweep", "snd.tx.pixel_dissolve", "snd.ui.agent_working",
       "snd.hit.brand_field_slam", "snd.sparkle.letter_assemble")


def _r(sid, seed=None):
    recipes.load_all()
    return registry.render(sid, seed)


def _env(y, hop_ms=5):
    h = dsp.ms(hop_ms)
    m = np.max(np.abs(y), axis=1)
    return np.array([m[i:i + h].max() for i in range(0, len(m) - h + 1, h)])


def _onsets(y, hop_ms=2, rise_db=6.0):
    """count envelope rises of >= rise_db between neighbouring windows (a crude transient counter)"""
    e = 20 * np.log10(_env(y, hop_ms) + 1e-9)
    return int(np.sum((e[1:] - e[:-1]) >= rise_db))


def test_registered_deterministic_normalised():
    recipes.load_all()
    for sid in NEW:
        assert sid in registry.SOUNDS, sid
        a, anc, s = _r(sid)
        b = _r(sid)[0]
        assert registry.sha(a) == registry.sha(b), sid
        assert abs(meter.sample_peak_db(a) + 6.0) < 0.05, (sid, meter.sample_peak_db(a))
        assert np.isfinite(a).all() and a.shape[1] == 2, sid
        assert 0 <= anc < len(a), sid


def test_manifest_lists_new_ids():
    man = json.load(open(os.path.join(HERE, "manifest.json")))
    ids = {d["id"]: d for d in man["sounds"]}
    for sid in NEW:
        assert sid in ids, sid + " missing: run python3 sfx/build_library.py"
    assert ids["snd.ui.agent_working"]["loop"] is True
    assert "snd.tx.pixel_dissolve" in man["by_transition"]["pixelSort"]


def test_card_riffle_is_a_flutter_with_takes():
    a = _r("snd.paper.card_riffle")[0]
    assert 0.25 < len(a) / SR < 0.7, len(a) / SR
    assert _onsets(a) >= 10, _onsets(a)                                    # many separate card flicks, not one swish
    s = registry.SOUNDS["snd.paper.card_riffle"]
    assert "rr:4" in s.tags
    b = _r("snd.paper.card_riffle", s.seed + 1)[0]
    assert registry.sha(a) != registry.sha(b)                              # round-robin takes differ


def test_shuffle_settles_on_the_anchor():
    a, anc, _ = _r("snd.paper.card_shuffle_settle")
    pre = np.max(np.abs(a[anc - dsp.ms(60):anc - dsp.ms(10)]))
    post = np.max(np.abs(a[anc:anc + dsp.ms(15)]))
    assert post > 2.0 * pre, (post, pre)                                   # the anchor is the square-up tap, after a quieter gap
    assert anc > 0.6 * SR


def test_scan_sweep_rises():
    a, anc, _ = _r("snd.ui.scan_sweep")
    assert 0.8 <= len(a) / SR <= 1.5, len(a) / SR
    m = a.mean(axis=1)
    q = len(m) // 4
    c1, c3 = meter.centroid_hz(np.stack([m[:q]] * 2, 1)), meter.centroid_hz(np.stack([m[2 * q:3 * q]] * 2, 1))
    assert c3 > 1.5 * c1, (c1, c3)                                         # brightness rises over the sweep
    assert anc > len(a) // 2                                               # anchor = the crest near the end


def test_pixel_dissolve_thins_out():
    a = _r("snd.tx.pixel_dissolve")[0]
    n = len(a) // 3
    rms = [np.sqrt(np.mean(a[k * n:(k + 1) * n] ** 2)) for k in range(3)]
    assert rms[0] > rms[1] > rms[2], rms


def test_agent_working_is_a_seamless_4_to_8_s_loop():
    a = _r("snd.ui.agent_working")[0]
    assert 4.0 <= len(a) / SR <= 8.0, len(a) / SR
    m = a.mean(axis=1)
    jump = abs(m[0] - m[-1])
    assert jump <= 1.5 * np.max(np.abs(np.diff(m))), jump                  # the qa.py seam rule
    two = np.concatenate([a, a])
    e = _env(two, 10)
    seam = len(a) // dsp.ms(10)
    assert e[seam - 3:seam + 3].min() > 0.2 * np.median(e)                 # no notch or click across the wrap
    beats = _env(a, 10)
    assert beats.max() / np.median(beats) > 1.3                            # rhythmic, not a flat drone


def test_brand_slam_is_low_and_phone_safe():
    recipes.load_all()
    y, anc, s = _r("snd.hit.brand_field_slam")
    d = registry.describe(y, anc, s)
    assert d["centroid_hz"] < 600, d["centroid_hz"]
    assert d["phone_safe"], d["phone_drop_db"]
    assert anc < dsp.ms(60)                                                # the thump is the first thing you hear


def test_letters_converge_to_centre():
    a, anc, _ = _r("snd.sparkle.letter_assemble")
    w = dsp.ms(150)
    side = lambda x: np.sqrt(np.mean((x[:, 0] - x[:, 1]) ** 2)) / (np.sqrt(np.mean((x[:, 0] + x[:, 1]) ** 2)) + 1e-12)
    assert side(a[anc - w:anc]) < side(a[dsp.ms(20):dsp.ms(20) + w]), "the swarm narrows to the centre"
    early, late = np.sqrt(np.mean(a[:anc // 2] ** 2)), np.sqrt(np.mean(a[anc // 2:anc] ** 2))
    assert late > early                                                    # the swarm thickens toward the lock


def test_new_bundles_resolve():
    import bundles
    assert not bundles.validate()
    b = json.load(open(os.path.join(HERE, "bundles.json")))
    for name in ("saas_launch", "mockumentary"):
        assert name in b, name
    r = b["saas_launch"]["roles"]
    assert r["working"] == "snd.ui.agent_working" and r["brand_field"] == "snd.hit.brand_field_slam" and r["logo"].startswith("snd.logo.")
    m = b["mockumentary"]["roles"]
    assert m["room"] == "snd.amb.room_tone" and m["format_break"] == "snd.cartoon.record_scratch" and m["tape_stop"] == "snd.tx.tape_stop"


def test_mixer_loop_until_frame():
    import mixer
    mx = mixer.Mix(30, 8.0)
    mx.add_cue("snd.ui.agent_working", 30, until_frame=120)
    out = mx._render_sfx()
    spf = SR // 30
    assert np.max(np.abs(out[:31 * spf - 1])) == 0                         # loops start on their cue sample
    assert np.max(np.abs(out[31 * spf:60 * spf])) > 0
    assert np.max(np.abs(out[120 * spf:])) == 0                            # and stop at until_frame (faded)
    mx2 = mixer.Mix(30, 8.0)
    mx2.add_cue("snd.ui.agent_working", 30)
    assert np.max(np.abs(mx2._render_sfx()[7 * SR:])) > 0                  # without it the loop runs to the end


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
