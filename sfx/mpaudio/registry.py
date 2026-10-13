"""motion-pack / sfx / mpaudio / registry.py
The sound registry: every library sound is a recipe `fn(seed) -> (audio, anchor)` registered with metadata.
`finish()` makes it library-ready (stereo, DC/sub cleaned, trimmed, faded, peak-normalised), `describe()` measures it.
Anchor = the sample inside the finished buffer that must land on (visual frame + 1) x SR/fps (the v9 hit contract)."""
import hashlib
import numpy as np
from scipy.signal import butter, sosfilt
from . import dsp, meter, phone

SR = dsp.SR
SOUNDS = {}


class Snd:
    def __init__(self, id, fn, cat, tags, tier, use, pairs, desc, kind, loop, tonal, seed, peak_db, size):
        self.id, self.fn, self.cat, self.tags, self.tier = id, fn, cat, list(tags), tier
        self.use, self.pairs, self.desc, self.kind, self.loop, self.tonal = list(use), list(pairs), desc, kind, loop, tonal
        self.seed, self.peak_db, self.size = seed, peak_db, size


def snd(id, cat, tags=(), tier=3, use=(), pairs=(), desc="", kind="peak", loop=False, tonal=False, seed=1, peak_db=-6.0, size=None):
    """decorator. kind: 'peak' (anchor = loudest sample) | 'fixed' (anchor returned by the recipe, e.g. the end of a riser)"""
    def deco(fn):
        if id in SOUNDS:
            raise ValueError("duplicate sound id " + id)
        SOUNDS[id] = Snd(id, fn, cat, tags, tier, use, pairs, desc or (fn.__doc__ or "").strip().split("\n")[0], kind, loop, tonal, seed, peak_db, size)
        return fn
    return deco


_HP = butter(2, 30.0 / (SR / 2), "highpass", output="sos")


def finish(y, anchor, s):
    y = dsp.stereo(np.asarray(y, float))
    y = np.nan_to_num(y)
    if s.loop:
        y = y - y.mean(axis=0)
        pk = np.max(np.abs(y)) + 1e-12
        return (y * (dsp.db(s.peak_db) / pk)).astype(np.float32), 0
    if len(y) > 600:
        y = sosfilt(_HP, y, axis=0)
    env = np.max(np.abs(y), axis=1)
    pk = env.max() + 1e-12
    thr = pk * dsp.db(-66.0)
    idx = np.nonzero(env > thr)[0]
    if len(idx) == 0:
        raise ValueError(s.id + ": silent")
    pre = dsp.ms(1.5)
    a, b = max(0, idx[0] - pre), idx[-1] + 1
    if anchor is not None:
        anchor = int(anchor) - a
        b = max(b, a + anchor + 2)
    y = y[a:b]
    lead = max(0, pre - idx[0])          # guarantee >= 1.5 ms of true silence before the onset
    if lead:
        y = np.concatenate([np.zeros((lead, 2)), y], 0)
        anchor = None if anchor is None else anchor + lead
    if len(y) >= dsp.ms(100):
        y = y - y.mean(axis=0)
    y = dsp.fade_in(y, dsp.ms(1.0))
    tail = np.max(np.abs(y[-dsp.ms(10):]))
    # a truncated tail that is still audible gets a longer fade (40 ms) so the end never clicks
    y = dsp.fade_out(y, min(len(y) // 2, dsp.ms(40) if tail > dsp.db(-50) * pk else dsp.ms(12)))
    pk = np.max(np.abs(y)) + 1e-12
    y = y * (dsp.db(s.peak_db) / pk)
    if s.kind == "peak" or anchor is None:
        anchor = int(np.argmax(np.max(np.abs(y), axis=1)))
    anchor = int(np.clip(anchor, 0, len(y) - 1))
    return y.astype(np.float32), anchor


def render(sid, seed=None):
    s = SOUNDS[sid]
    out = s.fn(s.seed if seed is None else seed)
    if isinstance(out, tuple):
        y, anchor = out
    else:
        y, anchor = out, None
    return finish(y, anchor, s) + (s,)


def sha(y):
    return hashlib.sha256(np.ascontiguousarray(y).tobytes()).hexdigest()[:16]


def describe(y, anchor, s):
    n = len(y)
    cen = meter.centroid_hz(y)
    d = {
        "id": s.id, "category": s.cat, "tags": s.tags, "tier": s.tier, "desc": s.desc, "use": s.use, "pairs_with": s.pairs,
        "duration_s": round(n / SR, 4), "samples": n, "anchor_sample": anchor, "anchor_ms": round(anchor / SR * 1000, 2),
        "anchor_kind": "loop" if s.loop else s.kind, "tonal": s.tonal, "loop": s.loop, "seed": s.seed,
        "peak_dbfs": round(meter.sample_peak_db(y), 2), "true_peak_dbtp": round(meter.true_peak_db(y), 2),
        "lufs_integrated": round(meter.lufs_integrated(y), 2), "lufs_m_max": round(meter.lufs_momentary_max(y), 2),
        "lufs_s_max": round(meter.lufs_short_max(y), 2),
        "centroid_hz": round(cen), "crest_db": round(meter.crest_db(y), 1),
        "sub28_db": round(meter.band_energy_ratio_db(y, 28.0), 1),
        "sha": sha(y),
    }
    # phone check: how much K-weighted level survives a phone speaker voicing (a hero hit that is all sub disappears on a phone)
    if n >= dsp.ms(50):
        pv = phone.phone_voice(y.astype(float))
        d["phone_drop_db"] = round(meter.k_level(pv, 0, min(n, SR)) - meter.k_level(y.astype(float), 0, min(n, SR)), 1)
        d["phone_safe"] = bool(d["phone_drop_db"] > -6.0)
    return d
