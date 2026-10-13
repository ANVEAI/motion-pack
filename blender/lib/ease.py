# motion-pack/blender: the house easing set, ported from motion-pack camera/ease.js (same names, same cubic-beziers,
# same Newton solve), plus the closed-form helpers the recipes use. Pure functions of their arguments: no clock, no
# unseeded randomness. MIT (see blender/LICENSE).
import math
import random

TAU = 2.0 * math.pi


def clamp(x, a=0.0, b=1.0):
    return min(b, max(a, x))


def lerp(a, b, k):
    return a + (b - a) * k


def seg(t, a, b):
    """0..1 progress of t through [a, b] (a step at b when the window is empty)."""
    if b <= a:
        return 1.0 if t >= b else 0.0
    return clamp((t - a) / (b - a))


def sstep(a, b, x):
    t = seg(x, a, b)
    return t * t * (3.0 - 2.0 * t)


def bezier(p1x, p1y, p2x, p2y):
    """CSS cubic-bezier(p1x, p1y, p2x, p2y) as y(x), solved like ease.js (8 Newton steps, 1e-6 tolerance)."""
    cx = 3.0 * p1x
    bx = 3.0 * (p2x - p1x) - cx
    ax = 1.0 - cx - bx
    cy = 3.0 * p1y
    by = 3.0 * (p2y - p1y) - cy
    ay = 1.0 - cy - by

    def f(x):
        if x <= 0.0:
            return 0.0
        if x >= 1.0:
            return 1.0
        t = x
        for _ in range(8):
            d = ((ax * t + bx) * t + cx) * t - x
            if abs(d) < 1e-6:
                break
            dd = (3.0 * ax * t + 2.0 * bx) * t + cx
            if abs(dd) < 1e-6:
                break
            t -= d / dd
        return ((ay * t + by) * t + cy) * t
    return f


def _quint(x):
    x = clamp(x)
    return 16.0 * x ** 5 if x < 0.5 else 1.0 - (-2.0 * x + 2.0) ** 5 / 2.0


E = {
    "enter": bezier(0.16, 1, 0.3, 1),
    "hero": bezier(0.22, 1, 0.36, 1),
    "exit": bezier(0.7, 0, 0.84, 0),
    "move": bezier(0.65, 0, 0.35, 1),
    "soft": bezier(0.4, 0, 0.2, 1),
    "cam": bezier(0.33, 0, 0.12, 1),
    "pop": bezier(0.34, 1.56, 0.64, 1),
    "lin": clamp,
    "sine": lambda x: 0.5 - 0.5 * math.cos(math.pi * clamp(x)),
    "expoOut": lambda x: 1.0 if x >= 1 else 1.0 - 2.0 ** (-10.0 * clamp(x)),
    "quint": _quint,
    # the launch film's own glide: a symmetric, slower-shouldered move
    "glide": bezier(0.45, 0, 0.55, 1),
}


def ease(name):
    if callable(name):
        return name
    if name not in E:
        raise KeyError("unknown ease %r (have %s)" % (name, ", ".join(sorted(E))))
    return E[name]


def env(t, hits, attack=1.0 / 30, decay=8.0 / 30, curve="exp"):
    """Beat / cut envelope (ease.js env): linear rise over `attack` ending ON each hit, decay after; max over hits."""
    m = 0.0
    for h in hits or ():
        dt = t - h
        if dt < -attack or dt > decay:
            continue
        if dt <= 0:
            v = (dt + attack) / attack
        else:
            k = dt / decay
            v = math.exp(-4.0 * k) * (1.0 - k) if curve == "exp" else (1.0 - k if curve == "lin" else 1.0 - E["soft"](k))
        m = max(m, v)
    return m


def window_env(t, t0, tin, thold, tout, e="soft"):
    fn = ease(e)
    if t < t0:
        return 0.0
    a = t - t0
    if a < tin:
        return fn(a / tin)
    if a < tin + thold:
        return 1.0
    if a < tin + thold + tout:
        return 1.0 - fn((a - tin - thold) / tout)
    return 0.0


def hermite(keys, r):
    """Piecewise cubic Hermite through (r, value, slope) keys: C1 curves with no kinks between moves."""
    if r <= keys[0][0]:
        return keys[0][1] + keys[0][2] * (r - keys[0][0])
    for (r0, v0, m0), (r1, v1, m1) in zip(keys, keys[1:]):
        if r <= r1:
            h = r1 - r0
            s = (r - r0) / h
            return ((2 * s ** 3 - 3 * s ** 2 + 1) * v0 + (s ** 3 - 2 * s ** 2 + s) * h * m0
                    + (-2 * s ** 3 + 3 * s ** 2) * v1 + (s ** 3 - s ** 2) * h * m1)
    return keys[-1][1]


def sines(seed, freqs, amps):
    """Closed-form band-limited noise (ease.js sines): seeded phases, deterministic from t alone. freqs in Hz."""
    r = random.Random(seed)
    ph = [r.random() * TAU for _ in freqs]
    norm = math.sqrt(sum(a * a for a in amps)) or 1.0
    return lambda t: sum(a * math.sin(TAU * f * t + p) for f, a, p in zip(freqs, amps, ph)) / norm


def loop_sines(seed, harmonics, amps, period):
    """Seamless variant: integer harmonics of 1/period, so value(t) == value(t + period) exactly."""
    r = random.Random(seed)
    ph = [r.random() * TAU for _ in harmonics]
    norm = math.sqrt(sum(a * a for a in amps)) or 1.0
    return lambda t: sum(a * math.sin(TAU * k * t / period + p) for k, a, p in zip(harmonics, amps, ph)) / norm
