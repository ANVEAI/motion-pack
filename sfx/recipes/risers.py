"""Risers and downlifters. Riser lengths are whole bars at 120 BPM (1 bar = 2.0 s) so they end on a downbeat; the riser's anchor is its END
sample: place the end ONE FRAME BEFORE the hit's anchor (manifest: anchor_frame_offset = -1)."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, expo, pink
from mpaudio.registry import snd


def riser_noise(n, seed, f0=220.0, f1=9000.0, q0=1.2, q1=5.0, burst=True):
    u = np.linspace(0, 1, n)
    a = white(n, seed)
    b = white(n, seed + 100)
    q = q0 + (q1 - q0) * u ** 2
    fc = expo(f0, f1, u)
    mid = svf(a, fc, q, "bp")
    side = svf(b, fc * 1.01, q, "bp")
    w = 0.2 + 0.8 * u
    amp = u ** 2.5
    y = np.stack([(mid + side * w) * amp, (mid - side * w) * amp], 1)
    y /= np.max(np.abs(y)) + 1e-9
    if burst:
        nb = dsp.ms(40)
        y[-nb:] += np.stack([white(nb, seed + 5), white(nb, seed + 6)], 1) * 0.4 * np.linspace(0.3, 1, nb)[:, None]
    return y


def _riser(id, bars, tags, desc, use=("launch", "ad", "beat_edit")):
    @snd(id, "riser", ["family:riser", "tier:2", "anchor:end", "tonal:no", "bars:%d" % bars, "bpm:120", *tags], tier=2, use=list(use), pairs=["flash", "zoomThrough", "cut", "smash"],
         desc=desc, kind="fixed", seed=20 + bars)
    def f(seed, _b=bars):
        n = sec(_b * 2.0)
        y = riser_noise(n, seed)
        return y, n - 1
    f.__name__ = id.replace(".", "_")
    return f


_riser("snd.riser.noise_1bar", 1, ["size:s"], "1-bar noise riser (2.0 s at 120 BPM) ending on the anchor")
_riser("snd.riser.noise_2bar", 2, ["size:m"], "2-bar noise riser (4.0 s at 120 BPM)")
_riser("snd.riser.noise_4bar", 4, ["size:l"], "4-bar noise riser (8.0 s at 120 BPM)")


@snd("snd.riser.supersaw_2bar", "riser", ["family:riser", "tier:2", "anchor:end", "tonal:yes", "bars:2", "bpm:120", "mood:tech", "key:A"], tier=2, use=["launch", "beat_edit", "ad"], pairs=["flash", "cut", "smash"],
     desc="2-bar supersaw riser, A3 to A4 (octave up) with opening filter", kind="fixed", tonal=True, seed=24)
def riser_supersaw(seed):
    n = sec(4.0)
    u = np.linspace(0, 1, n)
    f = expo(220.0, 440.0, u)
    y = I.supersaw(f, n, 14 + 16 * u, seed)
    y = svf(y, expo(500, 6000, u), 0.9, "lp") * u ** 2 * 1.0
    return dsp.widen(np.stack([y, np.roll(y, 37)], 1), 1.6), n - 1


@snd("snd.riser.shepard", "riser", ["family:riser", "tier:2", "anchor:end", "tonal:yes", "mood:tense", "loopable"], tier=2, use=["short_film", "launch", "ad"], pairs=["cut", "dipToBlack"],
     desc="Shepard-Risset rising glissando, endless tension, 4 s", kind="fixed", tonal=True, seed=25)
def riser_shepard(seed):
    n = sec(4.0)
    u = np.linspace(0, 1, n)
    y = np.zeros(n)
    for k in range(9):
        f = 30.0 * 2.0 ** (k + u)
        w = np.exp(-0.5 * ((np.log2(f / 1000.0)) / 1.4) ** 2)
        y += w * np.sin(dsp.phase(f))
    y *= 0.3 + 0.7 * u
    return y, n - 1


@snd("snd.riser.heartbeat", "riser", ["family:riser", "tier:2", "anchor:end", "tonal:yes", "mood:tense", "sub"], tier=2, use=["short_film", "launch"], pairs=["cut", "dipToBlack"],
     desc="accelerating sub heartbeat 0.9 s to 0.18 s, ends on the hit", kind="fixed", tonal=True, seed=26)
def riser_heartbeat(seed):
    n = sec(4.0)
    y = np.zeros(n)
    t0, iv = 0.0, 0.9
    k = 0
    tot = 3.75
    while t0 < tot:
        u = t0 / tot
        g = db(-24 + 18 * u)
        m = sec(0.2)
        t = t_of(m)
        th = np.sin(dsp.phase(70 - 25 * (1 - np.exp(-t / 0.05)) + 0 * t)) * env_ad(t, 0.002, 0.06)
        dsp.add_at(y, th, sec(t0), g)
        dsp.add_at(y, th, sec(t0 + 0.14 * iv / 0.9 + 0.05), g * 0.6)
        iv = max(0.18, iv * 0.86)
        t0 += iv
        k += 1
    return y, n - 1


@snd("snd.riser.reverse_cymbal", "riser", ["family:riser", "tier:2", "anchor:end", "tonal:no", "size:m"], tier=2, use=["launch", "ad", "beat_edit"], pairs=["flash", "cut", "smash"],
     desc="synthesised cymbal, time reversed, 2 s", kind="fixed", seed=27)
def riser_reverse_cym(seed):
    n = sec(2.4)
    t = t_of(n)
    y = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        y += dsp.pulse_n(f * 2.5, n, 0.5)
    y = y / 6 * 0.6 + white(n, seed) * 0.7
    y = dsp.lp(dsp.hp(y, 5500, 2), 11000, 2) * env_ad(t, 0.001, 0.9)
    y = y[::-1].copy()
    return y, n - 1


def varispeed(src, rate):
    """read src at a time-varying rate (linear interpolation, aliasing is part of the sound)"""
    pos = np.concatenate([[0.0], np.cumsum(rate[:-1])])
    pos = np.clip(pos, 0, len(src) - 1)
    return np.interp(pos, np.arange(len(src)), src)


def held_chord(n, seed, root=57):
    y = np.zeros(n)
    for m in (root, root + 4, root + 7, root + 12):
        y += dsp.saw_n(dsp.note_hz(m), n) + dsp.saw_n(dsp.note_hz(m) * 1.004, n)
    return svf(y, 2200, 0.8, "lp") / 8.0


@snd("snd.riser.tape_up", "riser", ["family:riser", "tier:2", "anchor:end", "tonal:yes", "tape"], tier=2, use=["beat_edit", "mime", "ad"], pairs=["speedRamp", "cut"],
     desc="tape spin-up: held A chord pitch 0.05 to 1.0 in 0.5 s", kind="fixed", tonal=True, seed=28)
def riser_tape_up(seed):
    n = sec(0.5)
    src = held_chord(sec(1.0), seed)
    u = np.linspace(0, 1, n)
    rate = 0.05 * 20.0 ** (u ** 0.8)
    y = varispeed(src, rate)
    y = svf(y, 8000 * rate, 0.9, "lp") * (0.3 + 0.7 * u)
    return y, n - 1


@snd("snd.lift.inhale", "riser", ["family:lift", "tier:3", "anchor:end", "tonal:no", "size:xs"], tier=3, use=["talking_head", "ad", "launch"], pairs=["textReveal", "maskReveal", "cut"],
     desc="300 ms breath before a word or title; ends 1 frame before the hit", kind="fixed", seed=29)
def lift_inhale(seed):
    n = sec(0.30)
    y = riser_noise(n, seed, 500.0, 5000.0, 1.0, 2.5, burst=False)
    u = np.linspace(0, 1, n)
    return y * (u ** 1.5)[:, None], n - 1


@snd("snd.lift.down", "riser", ["family:lift", "tier:2", "anchor:start", "tonal:no", "size:m", "downlifter"], tier=2, use=["launch", "ad", "short_film"], pairs=["dipToBlack", "dissolve", "cut"],
     desc="downlifter 0.9 s: starts exactly on the drop, carries energy out", kind="fixed", seed=30)
def lift_down(seed):
    n = sec(0.9)
    u = np.linspace(0, 1, n)
    a = white(n, seed)
    b = white(n, seed + 1)
    fc = expo(9000.0, 180.0, u)
    y = np.stack([svf(a, fc, 1.5, "bp"), svf(b, fc * 1.01, 1.5, "bp")], 1) * ((1 - u) ** 1.8)[:, None]
    return y, 0


@snd("snd.lift.down_long", "riser", ["family:lift", "tier:2", "anchor:start", "tonal:no", "size:l", "downlifter"], tier=2, use=["launch", "short_film"], pairs=["dipToBlack", "dissolve"],
     desc="downlifter 2.0 s (1 bar at 120 BPM) after a hero hit", kind="fixed", seed=31)
def lift_down_long(seed):
    n = sec(2.0)
    u = np.linspace(0, 1, n)
    a = white(n, seed)
    b = white(n, seed + 1)
    fc = expo(7000.0, 150.0, u)
    y = np.stack([svf(a, fc, 2.0, "bp"), svf(b, fc * 1.01, 2.0, "bp")], 1) * ((1 - u) ** 1.8)[:, None]
    return y, 0
