#!/usr/bin/env python3
"""Tests for the electric family (recipes/elec.py, gap sfx/elec/arc): the arc zap, the crackle loop and the zap-off power-down, plus the neon_power_on bundle
(pytest, or plain asserts: python3 sfx/tests/test_elec.py). Measurement only, no listening: the sfx QA rules (peak, true peak, LUFS-S, DC, edges,
digital-zero tail, loop seam) and a few shape checks (110 Hz buzz, falling pitch, thinning crackles)."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from mpaudio import dsp, meter, registry  # noqa: E402
import recipes  # noqa: E402
SR = dsp.SR
ARC, LOOP, OFF = "snd.elec.arc", "snd.elec.crackle_loop", "snd.elec.zap_off"
NEW = (ARC, LOOP, OFF)
LSB24 = 2.0 ** -23            # one 24-bit step (full scale 1.0): anything smaller writes as digital zero


def _r(sid, seed=None):
    recipes.load_all()
    return registry.render(sid, seed)


def _man():
    return json.load(open(os.path.join(HERE, "manifest.json")))


def _env(y, hop_ms=2):
    h = dsp.ms(hop_ms)
    m = np.max(np.abs(y), axis=1)
    return np.array([m[i:i + h].max() for i in range(0, len(m) - h + 1, h)])


def _onsets(y, hop_ms=2, rise_db=6.0):
    e = 20 * np.log10(_env(y, hop_ms) + 1e-9)
    return int(np.sum((e[1:] - e[:-1]) >= rise_db))


def _f0(x, lo=25.0, hi=160.0):
    """autocorrelation pitch of a low-passed mono segment"""
    x = dsp.lp(x - x.mean(), 700)
    ac = np.correlate(x, x, "full")[len(x) - 1:]
    a, b = int(SR / hi), int(SR / lo)
    return SR / (a + int(np.argmax(ac[a:b])))


def sec_(x):
    return int(round(x * SR))


def test_registered_in_elec_category():
    recipes.load_all()
    assert "elec" in recipes.MODULES
    for sid in NEW:
        assert sid in registry.SOUNDS, sid
        s = registry.SOUNDS[sid]
        assert s.cat == "elec" and "family:elec" in s.tags, sid
    assert registry.SOUNDS[LOOP].loop and not registry.SOUNDS[ARC].loop and not registry.SOUNDS[OFF].loop
    from mpaudio import sweeteners as SW
    assert SW.resolve_sfx("sfx/elec/arc") == ARC and SW.resolve_sfx("sfx/elec/crackle_loop") == LOOP and SW.resolve_sfx("sfx/elec/zap_off") == OFF


def test_deterministic_and_round_robin():
    for sid in NEW:
        a, anc, s = _r(sid)
        b, anc2, _ = _r(sid)
        assert registry.sha(a) == registry.sha(b) and anc == anc2, sid                 # same seed -> identical samples
        assert registry.sha(a) != registry.sha(_r(sid, s.seed + 1)[0]), sid           # another seed -> another take
    s = registry.SOUNDS[ARC]
    assert "rr:4" in s.tags
    takes = {registry.sha(_r(ARC, s.seed + k)[0]) for k in range(4)}
    assert len(takes) == 4                                                           # four distinct strikes for the mixer's seed + occurrence


def test_level_convention():
    """peak -6 dBFS like every library sound, true peak under the qa.py -3 dBTP warning, LUFS-S max inside the range the rest of the library spans"""
    man = _man()["sounds"]
    rest = [d for d in man if d["category"] != "elec"]
    for sid in NEW:
        a, anc, s = _r(sid)
        assert abs(meter.sample_peak_db(a) + 6.0) < 0.05, (sid, meter.sample_peak_db(a))
        assert meter.true_peak_db(a) <= -3.0, (sid, meter.true_peak_db(a))
        assert np.isfinite(a).all() and a.shape[1] == 2 and a.dtype == np.float32, sid
        ref = [d["lufs_s_max"] for d in rest if d["loop"] == s.loop]
        ls = meter.lufs_short_max(a)
        assert min(ref) <= ls <= max(ref), (sid, ls, min(ref), max(ref))
        li = meter.lufs_integrated(a)
        assert -32.0 <= li <= -12.0, (sid, li)


def test_no_dc_offset():
    for sid in NEW:
        a = _r(sid)[0]
        dc = float(np.max(np.abs(a.astype(float).mean(axis=0))))
        assert dc / float(np.max(np.abs(a))) < 1e-3, (sid, dc)


def test_one_shots_start_clean_and_end_in_digital_zero():
    for sid in (ARC, OFF):
        a = _r(sid)[0].astype(float)
        assert meter.sample_peak_db(a[:dsp.ms(0.5)]) < -60, sid                     # qa.py start edge
        assert meter.sample_peak_db(a[-dsp.ms(1):]) < -60, sid                      # qa.py end edge
        assert np.max(np.abs(a[-1])) < LSB24, (sid, np.max(np.abs(a[-1])))           # the last sample writes as 0 at 24-bit
        assert meter.sample_peak_db(a[-dsp.ms(5):]) < -45, sid                      # and the fade is already deep 5 ms before the end
        w = os.path.join(HERE, "library", "elec", sid + ".wav")
        if os.path.exists(w):                                                        # the built WAV (gitignored; present after build_library.py)
            import soundfile as sf
            x, sr = sf.read(w, dtype="int32")
            assert sr == SR and np.all(x[-1] == 0), (sid, x[-1])


def test_crackle_loop_is_seamless():
    a = _r(LOOP)[0].astype(float)
    assert len(a) == 4 * SR, len(a)
    for ch in range(2):                                                              # the qa.py seam rule, per channel and on the mono sum
        m = a[:, ch]
        assert abs(m[0] - m[-1]) <= 1.5 * np.max(np.abs(np.diff(m))), ch
    m = a.mean(axis=1)
    assert abs(m[0] - m[-1]) <= 1.5 * np.max(np.abs(np.diff(m)))
    w = np.concatenate([m[-dsp.ms(25):], m[:dsp.ms(25)]])
    assert np.sqrt(np.mean(w ** 2)) >= 0.3 * np.sqrt(np.mean(m ** 2))               # no level notch at the wrap
    two = np.concatenate([a, a])                                                     # tiled: the K-weighted level of 100 ms windows across the seam stays in the loop's own spread
    blk = dsp.ms(100)
    lv = [meter.k_level(two, i, blk) for i in range(0, len(two) - blk, blk // 2)]
    seam = meter.k_level(two, len(a) - blk // 2, blk)
    assert min(lv) - 0.5 <= seam <= max(lv) + 0.5, (seam, min(lv), max(lv))
    assert _onsets(a) >= 40                                                          # sparks keep crackling all the way through


def test_arc_shape():
    a, anc, s = _r(ARC)
    assert 0.25 <= len(a) / SR <= 0.5, len(a) / SR
    assert anc < dsp.ms(10)                                                          # anchor = the crack at the head
    m = a.astype(float).mean(axis=1)
    seg = m[sec_(0.02):sec_(0.15)]
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    fr = np.fft.rfftfreq(len(seg), 1.0 / SR)
    buzz = sp[(fr > 100) & (fr < 120)].max()
    assert buzz > 4 * np.median(sp[(fr > 60) & (fr < 400)]), "no 110 Hz buzz"         # the pitched mains-style buzz
    hi = (sp[fr > 2000] ** 2).sum() / (sp ** 2).sum()
    assert hi > 0.02, hi                                                             # the noise burst / crackles above 2 kHz
    d = registry.describe(a, anc, s)
    assert d["sub28_db"] < -20 and d["phone_safe"], d


def test_zap_off_falls_thins_and_dies():
    a, anc, s = _r(OFF)
    assert 0.9 <= len(a) / SR <= 1.6, len(a) / SR
    assert anc < dsp.ms(10)                                                          # anchor = the snap: the frame the light dies
    m = a.astype(float).mean(axis=1)
    early, late = _f0(m[sec_(0.12):sec_(0.32)]), _f0(m[sec_(0.65):sec_(0.85)])
    assert early > 1.4 * late, (early, late)                                         # the buzz pitch falls
    assert 70 < early < 115 and 30 < late < 70, (early, late)
    n1, n2 = _onsets(a[sec_(0.05):sec_(0.55)], 2, 4.0), _onsets(a[sec_(0.55):], 2, 4.0)
    assert n1 > n2, (n1, n2)                                                         # crackles thin out
    w = sec_(0.1)
    rms = [np.sqrt(np.mean(m[i:i + w] ** 2)) for i in range(sec_(0.05), len(m) - w, w)]
    assert rms[-1] < 0.1 * max(rms)                                                  # it powers down (and test_one_shots... checks the digital zero)


def test_manifest_and_bundle():
    man = _man()
    ids = {d["id"]: d for d in man["sounds"]}
    for sid in NEW:
        assert sid in ids, sid + " missing: run python3 sfx/build_library.py"
        d = ids[sid]
        for k in ("lufs_integrated", "lufs_m_max", "lufs_s_max", "true_peak_dbtp", "peak_dbfs", "sha"):
            assert d.get(k) is not None, (sid, k)
        assert d["category"] == "elec" and d["file"] == "library/elec/%s.wav" % sid
        assert registry.sha(_r(sid)[0]) == d["sha"], sid
    assert ids[LOOP]["loop"] is True and ids[LOOP]["over_bed_db"] is None              # a bed-style loop: the mixer sits it 10 dB under the bed
    assert ids[ARC]["over_bed_db"] == 3.5 and ids[OFF]["anchor_kind"] == "fixed"
    import bundles
    assert not bundles.validate()
    b = json.load(open(os.path.join(HERE, "bundles.json")))["neon_power_on"]["roles"]
    assert b["power_on"] == ARC and b["live"] == LOOP and b["power_off"] == OFF


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
