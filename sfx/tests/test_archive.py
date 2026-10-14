#!/usr/bin/env python3
"""Tests for the round-3 archive sounds (recipes/archive.py): the projector loop, the typewriter line and the hologram beam
(plain asserts; run: python3 sfx/tests/test_archive.py). Measurement only, no listening."""
import json
import os
import sys
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from mpaudio import dsp, meter, registry  # noqa: E402
import recipes  # noqa: E402
SR = dsp.SR
NEW = ("snd.amb.projector", "snd.foley.typewriter", "snd.ui.hologram_beam")


def _r(sid, seed=None):
    recipes.load_all()
    return registry.render(sid, seed)


def _env(y, hop_ms=2):
    h = dsp.ms(hop_ms)
    m = np.max(np.abs(y), axis=1)
    return np.array([m[i:i + h].max() for i in range(0, len(m) - h + 1, h)])


def _onsets(y, hop_ms=2, rise_db=6.0):
    e = 20 * np.log10(_env(y, hop_ms) + 1e-9)
    return int(np.sum((e[1:] - e[:-1]) >= rise_db))


def test_registered_deterministic_normalised():
    recipes.load_all()
    for sid in NEW:
        assert sid in registry.SOUNDS, sid
        a, anc, s = _r(sid)
        assert registry.sha(a) == registry.sha(_r(sid)[0]), sid
        assert abs(meter.sample_peak_db(a) + 6.0) < 0.05, (sid, meter.sample_peak_db(a))
        assert np.isfinite(a).all() and a.shape[1] == 2, sid
        assert 0 <= anc < len(a), sid


def test_manifest_lists_new_ids():
    man = json.load(open(os.path.join(HERE, "manifest.json")))
    ids = {d["id"]: d for d in man["sounds"]}
    for sid in NEW:
        assert sid in ids, sid + " missing: run python3 sfx/build_library.py"
    assert ids["snd.amb.projector"]["loop"] is True
    assert ids["snd.foley.typewriter"]["category"] == "foley"


def test_projector_is_a_seamless_4_s_loop_at_24_fps():
    a = _r("snd.amb.projector")[0]
    assert len(a) == 4 * SR, len(a)
    m = a.mean(axis=1)
    assert abs(m[0] - m[-1]) <= 1.5 * np.max(np.abs(np.diff(m)))            # the qa.py seam rule
    two = np.concatenate([a, a])
    e = _env(two, 5)
    seam = len(a) // dsp.ms(5)
    assert e[seam - 4:seam + 4].min() > 0.15 * np.median(e)                  # no notch across the wrap
    env = np.abs(m)
    blk = SR // 1000                                                         # 1 ms blocks -> envelope at 1 kHz
    ev = env[:len(env) // blk * blk].reshape(-1, blk).mean(axis=1)
    sp = np.abs(np.fft.rfft(ev - ev.mean()))
    f = np.fft.rfftfreq(len(ev), 1.0 / 1000)
    band = (f > 10) & (f < 60)
    peak = f[band][np.argmax(sp[band])]
    assert abs(peak - 24.0) < 0.5 or abs(peak - 48.0) < 0.5, peak            # the 24 fps claw (or its shutter double) leads the rhythm


def test_typewriter_line():
    a, anc, s = _r("snd.foley.typewriter")
    assert 2.0 < len(a) / SR < 3.5, len(a) / SR
    assert anc < dsp.ms(30)                                                  # anchor = the first strike
    assert _onsets(a[:sec_(1.6)]) >= 9, _onsets(a[:sec_(1.6)])              # many separate strikes, not one burst
    assert "rr:4" in s.tags
    b = _r("snd.foley.typewriter", s.seed + 1)[0]
    assert registry.sha(a) != registry.sha(b)                                # takes differ
    m = a.mean(axis=1)
    spec = lambda x: np.abs(np.fft.rfft(x * np.hanning(len(x))))
    seg = m[sec_(0.9):sec_(2.0)]
    fr = np.fft.rfftfreq(len(seg), 1.0 / SR)
    sp = spec(seg)
    bell = sp[(fr > 2560) & (fr < 2680)].max()
    near = np.median(sp[(fr > 1500) & (fr < 4000)])
    assert bell > 8 * near, (bell, near)                                     # the end-of-line bell rings
    tail = a[-sec_(0.75):]
    assert _onsets(tail, 2, 4.0) >= 6                                        # the carriage-return ratchet


def test_hologram_beam_sustains_with_chatter():
    a, anc, s = _r("snd.ui.hologram_beam")
    assert 2.0 < len(a) / SR < 4.5
    assert dsp.ms(100) < anc < dsp.ms(300)                                   # anchor = the beam at full
    m = a.mean(axis=1)
    w = dsp.ms(100)
    rms = np.array([np.sqrt(np.mean(m[i:i + w] ** 2)) for i in range(0, len(m) - w, w)])
    mid = rms[int(0.4 * SR / w):int(1.6 * SR / w)]
    assert mid.min() > 0.35 * rms.max(), (mid.min(), rms.max())              # a held beam, not a hit
    hi = np.abs(np.fft.rfft(m[sec_(0.4):sec_(1.6)]))
    fr = np.fft.rfftfreq(sec_(1.6) - sec_(0.4), 1.0 / SR)
    assert hi[fr > 1500].sum() / hi.sum() > 0.08                             # the data chatter / air sits above the hum
    d = registry.describe(a, anc, s)
    assert 150 <= d["centroid_hz"] <= 6000, d["centroid_hz"]


def test_archive_bundle_resolves():
    import bundles
    assert not bundles.validate()
    b = json.load(open(os.path.join(HERE, "bundles.json")))
    r = b["archive_open"]["roles"]
    assert r["projector"] == "snd.amb.projector" and r["credit_line"] == "snd.foley.typewriter" and r["beam"] == "snd.ui.hologram_beam"


def sec_(x):
    return int(round(x * SR))


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v()
            n += 1
            print("ok", k)
    print("%d tests passed" % n)
