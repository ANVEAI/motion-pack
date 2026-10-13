"""Whooshes and swishes by size: band-passed noise, exponential fc sweep, skewed bell amplitude, air + body layers, pan path.
Alignment: the anchor is the loudest sample; in a transition put it on the frame of maximum on-screen velocity (+1 frame)."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, db, expo, env_bell, svf, white, pink, pan_st
from mpaudio.registry import snd


def whoosh_core(size, direction="pass", seed=1, pan=None, dur=None, f_lo=None, f_hi=None, q=None, air=None, body=None):
    dur = dur or 0.12 * 13.0 ** size
    n = sec(dur)
    src = pink(n, seed) if size >= 0.3 else white(n, seed)
    u = np.linspace(0, 1, n)
    f_lo = f_lo or 700.0 * 0.35 ** size
    f_hi = f_hi or 7500.0 * 0.55 ** size
    q = q or (1.6 - 0.7 * size)
    if direction == "in":
        peak, rise, fall, fc = 0.7, 2.0, 4.0, expo(f_lo, f_hi, u)
    elif direction == "out":
        peak, rise, fall, fc = 0.3, 4.0, 2.0, expo(f_hi, f_lo, u)
    else:
        peak, rise, fall = 0.5, 2.5, 2.5
        fc = expo(f_lo, f_hi, np.minimum(u / 0.65, 1.0)) * 2.0 ** (-0.25 * np.clip((u - 0.65) / 0.35, 0, 1) * 4)
    amp = env_bell(n, peak, rise, fall)
    y = svf(src, fc, q, "bp") + 0.5 * svf(src, np.minimum(fc * 2.1, 18000), q, "bp")
    y = y * amp
    a_w = (0.25 - 0.16 * min(size / 0.5, 1)) if air is None else air
    airl = dsp.hp(white(n, seed + 11), 6000) * np.roll(env_bell(n, min(peak + 0.08, 0.95), rise, fall), int(0.08 * n)) * a_w
    y = y + airl
    bw = (0.32 if size >= 0.45 else 0.0) if body is None else body
    if bw > 0:
        y += dsp.lp(pink(n, seed + 3), 250) * env_bell(n, 0.55, 2.0, 2.0) * bw
    if size >= 0.8:
        y += np.sin(dsp.phase(np.full(n, 55.0))) * env_bell(n, 0.55, 2.0, 2.0) * 0.12
    if pan is None:
        pan = {"in": (-0.5, 0.0), "out": (0.0, 0.5), "pass": (-0.7, 0.7)}[direction]
    y = y / (np.max(np.abs(y)) + 1e-9)
    st = pan_st(y, np.linspace(pan[0], pan[1], n))
    # decorrelated air in the opposite channel to widen
    w = dsp.hp(white(n, seed + 21), 5000) * env_bell(n, peak, rise, fall) * 0.08
    st[:, 0] += w
    st[:, 1] -= w
    return st


def _w(id, size, direction, dur, tier, use, pairs, desc, tags=(), **kw):
    @snd(id, "whoosh", ["family:whoosh", "size:" + ("xs" if size < 0.1 else "s" if size < 0.3 else "m" if size < 0.6 else "l" if size < 0.9 else "xl"), "anchor:noise", "tonal:no", *tags],
         tier=tier, use=use, pairs=pairs, desc=desc, seed=17 + int(size * 50))
    def f(seed, _s=size, _d=direction, _dur=dur, _kw=kw):
        return whoosh_core(_s, _d, seed, dur=_dur, **_kw)
    f.__name__ = id.replace(".", "_")
    return f


_w("snd.whoosh.swish_xs", 0.0, "pass", 0.12, 3, ["talking_head", "kinetic", "ad"], ["slide", "push", "caption"], "UI swipe, caption slide, hand wave", f_lo=2600, f_hi=7500, tags=["tier:3"])
_w("snd.whoosh.swish_s", 0.18, "in", 0.20, 3, ["talking_head", "ad", "launch"], ["slide", "push", "broll"], "element enters frame, B-roll in/out", f_lo=1900, f_hi=6000, tags=["tier:3"])
_w("snd.whoosh.swish_out", 0.18, "out", 0.20, 3, ["talking_head", "ad", "launch"], ["slide", "push", "broll"], "element leaves frame", f_lo=1900, f_hi=6000, tags=["tier:3"])
_w("snd.whoosh.whoosh_m", 0.45, "pass", 0.45, 2, ["ad", "launch", "beat_edit"], ["whip", "slide", "push"], "standard transition whoosh (whip pan)", f_lo=800, f_hi=4000, tags=["tier:2"])
_w("snd.whoosh.whoosh_in_m", 0.45, "in", 0.50, 2, ["ad", "launch"], ["push", "zoomThrough", "maskReveal"], "object arrives into frame", f_lo=800, f_hi=4000, tags=["tier:2"])
_w("snd.whoosh.whoosh_l", 0.72, "in", 0.80, 2, ["launch", "short_film", "ad"], ["zoomThrough", "dipToBlack", "maskReveal"], "scene change / logo reveal in", f_lo=450, f_hi=3000, tags=["tier:2"])
_w("snd.whoosh.whoosh_xl", 1.0, "in", 1.50, 1, ["launch", "short_film"], ["zoomThrough", "dipToBlack", "lightLeak"], "title card swell, hero transition", f_lo=260, f_hi=2300, tags=["tier:1"])
_w("snd.whoosh.flyby", 0.6, "pass", 1.10, 2, ["ad", "mime", "launch"], ["whip", "zoomThrough"], "car / drone / character flyby with Doppler fall", f_lo=900, f_hi=3000, tags=["tier:2"])
_w("snd.whoosh.zip", 0.1, "in", 0.09, 3, ["talking_head", "beat_edit", "ad"], ["scalePunch", "punchIn", "speedRamp"], "zoom punch-in zip, speed lines", f_lo=1500, f_hi=9000, q=2.0, tags=["tier:3"])
_w("snd.whoosh.whip_pan", 0.35, "pass", 0.32, 2, ["beat_edit", "ad", "mime"], ["whip", "blurCross"], "fast whip pan: symmetric pass with sharp centre", f_lo=1200, f_hi=5200, q=1.2, tags=["tier:2"])


@snd("snd.whoosh.reverse", "whoosh", ["family:whoosh", "size:m", "tier:2", "anchor:noise", "tonal:no", "reverse"], tier=2, use=["launch", "short_film"], pairs=["flash", "lightLeak"],
     desc="reverse swell that ends on the anchor (pre-hit swell)", kind="fixed", seed=61)
def whoosh_reverse(seed):
    n = sec(0.6)
    st = whoosh_core(0.5, "out", seed, dur=0.6, f_lo=700, f_hi=3800)
    st = st[::-1].copy()
    st = dsp.fade_out(st, 90)
    return st, len(st) - 1
