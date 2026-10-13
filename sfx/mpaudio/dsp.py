"""motion-pack / sfx / mpaudio / dsp.py
Owned DSP primitives (numpy / scipy / numba only). Everything is a pure function of (params, seed): no global state, no files, no samples.
Ideas reused (and re-written here) from our own v9 pipeline: sfx9.py (TPT state-variable filter with per-sample cutoff, sin^2 attack envelopes,
equal-power pan, energy-normalised IR). Sample rate is fixed at 48 kHz; fps is a project parameter handled in grid.py.
"""
import numpy as np
from numba import njit
from scipy.signal import lfilter, fftconvolve, resample_poly, sosfilt, butter

SR = 48000
TWO_PI = 2.0 * np.pi


# ----------------------------------------------------------------------------------------------------------------- basics
def rng(seed):
    return np.random.default_rng(int(seed) & 0x7FFFFFFF)


def t_of(n):
    return np.arange(n) / SR


def ms(x):
    """milliseconds -> samples (int)"""
    return int(round(x * SR / 1000.0))


def sec(x):
    return int(round(x * SR))


def db(x):
    return 10.0 ** (x / 20.0)


def to_db(x):
    return 20.0 * np.log10(np.maximum(x, 1e-12))


# ----------------------------------------------------------------------------------------------------------------- noise colours
def white(n, seed):
    return rng(seed).uniform(-1.0, 1.0, n)


def _colour(n, seed, expo):
    w = rng(seed).standard_normal(n)
    X = np.fft.rfft(w)
    f = np.arange(len(X), dtype=float)
    f[0] = 1.0
    X = X * f ** (-expo)
    X[0] = 0.0
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12) * 0.5


def pink(n, seed):
    """1/f noise by FFT shaping (circular, so a loop of length n wraps seamlessly), rms 0.5"""
    return _colour(n, seed, 0.5)


def brown(n, seed):
    """1/f^2 noise by FFT shaping (circular), rms 0.5"""
    return _colour(n, seed, 1.0)


def noise(n, seed, colour="white"):
    return {"white": white, "pink": pink, "brown": brown}[colour](n, seed)


# ----------------------------------------------------------------------------------------------------------------- filters
@njit(cache=True)
def _svf(x, fc, q, mode):
    n = x.shape[0]
    y = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    for i in range(n):
        k = 1.0 / q[i]
        g = np.tan(np.pi * min(max(fc[i], 15.0), 21500.0) / 48000.0)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            y[i] = v2
        elif mode == 1:
            y[i] = v1 * k
        elif mode == 2:
            y[i] = x[i] - k * v1 - v2
        else:
            y[i] = x[i] - k * v1
    return y


_MODES = {"lp": 0, "bp": 1, "hp": 2, "notch": 3}


def svf(x, fc, q=0.707, kind="bp"):
    """TPT state-variable filter (12 dB/oct), per-sample cutoff and Q allowed. bp is unity-peak."""
    x = np.ascontiguousarray(x, dtype=np.float64)
    fc = np.ascontiguousarray(np.broadcast_to(np.asarray(fc, float), x.shape))
    q = np.ascontiguousarray(np.broadcast_to(np.asarray(q, float), x.shape))
    return _svf(x, fc, q, _MODES[kind])


def svf2(x, fc, q=0.707, kind="lp"):
    """two cascaded svf = 24 dB/oct"""
    return svf(svf(x, fc, q, kind), fc, q, kind)


def biquad(x, kind, f0, q=0.707, gain_db=0.0):
    """RBJ cookbook biquad (static). kinds: lp hp bp peak lowshelf highshelf notch allpass"""
    A = 10.0 ** (gain_db / 40.0)
    w0 = TWO_PI * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    al = sw / (2.0 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "bp":
        b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "notch":
        b = [1, -2 * cw, 1]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "allpass":
        b = [1 - al, -2 * cw, 1 + al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == "peak":
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind in ("lowshelf", "highshelf"):
        sq = 2 * np.sqrt(A) * al
        if kind == "lowshelf":
            b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sq)]
            a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sq]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sq)]
            a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sq]
    else:
        raise ValueError(kind)
    b = np.array(b, float) / a[0]
    a = np.array(a, float) / a[0]
    return lfilter(b, a, x, axis=0)


def hp(x, f0, order=2):
    sos = butter(order, f0 / (SR / 2), "highpass", output="sos")
    return sosfilt(sos, x, axis=0)


def lp(x, f0, order=2):
    sos = butter(order, min(f0, 0.45 * SR) / (SR / 2), "lowpass", output="sos")
    return sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), min(hi, 0.45 * SR) / (SR / 2)], "bandpass", output="sos")
    return sosfilt(sos, x, axis=0)


def fft_filter(x, f_lo=None, f_hi=None, slope=2):
    """zero-phase circular brick-ish filter in the frequency domain (loops stay seamless). slope in octave-rolloff orders."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    g = np.ones_like(f)
    if f_lo:
        g *= 1.0 / np.sqrt(1.0 + (f_lo / np.maximum(f, 1e-3)) ** (2 * slope))
    if f_hi:
        g *= 1.0 / np.sqrt(1.0 + (np.maximum(f, 1e-3) / f_hi) ** (2 * slope))
    return np.fft.irfft(X * g, n)


# ----------------------------------------------------------------------------------------------------------------- envelopes
def env_ad(t, a, tau):
    """sin^2 attack of length a, then exponential decay with time constant tau (functions of time: stateless)"""
    t = np.asarray(t, float)
    return np.where(t < 0, 0.0, np.where(t < a, np.sin(np.pi / 2 * np.clip(t, 0, a) / max(a, 1e-9)) ** 2, np.exp(-np.maximum(t - a, 0) / tau)))


def env_bell(n, peak=0.5, rise=2.0, fall=2.0):
    """skewed bell over n samples: peak position in 0..1, rise/fall powers"""
    u = np.linspace(0, 1, n)
    return np.where(u < peak, (u / max(peak, 1e-6)) ** rise, ((1 - u) / max(1 - peak, 1e-6)) ** fall)


def env_adsr(n, a, d, s, r):
    """times in seconds, sustain level s"""
    na, nd, nr = sec(a), sec(d), sec(r)
    ns = max(0, n - na - nd - nr)
    e = np.concatenate([np.linspace(0, 1, max(na, 1), endpoint=False), np.linspace(1, s, max(nd, 1), endpoint=False), np.full(ns, s), np.linspace(s, 0, max(nr, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def fade_in(x, n):
    n = min(n, len(x))
    x = x.copy()
    w = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
    x[:n] = x[:n] * (w[:, None] if x.ndim == 2 else w)
    return x


def fade_out(x, n):
    n = min(n, len(x))
    x = x.copy()
    w = np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    x[-n:] = x[-n:] * (w[:, None] if x.ndim == 2 else w)
    return x


def expo(a, b, u):
    """exponential interpolation a -> b over u in 0..1"""
    return a * (b / a) ** np.clip(u, 0, 1)


# ----------------------------------------------------------------------------------------------------------------- oscillators
def phase(freq):
    """integrate a frequency array (Hz) -> radians, starting at 0"""
    return np.concatenate([[0.0], np.cumsum(TWO_PI * np.asarray(freq, float)[:-1] / SR)])


def sine(freq, ph0=0.0):
    return np.sin(phase(freq) + ph0)


@njit(cache=True)
def _blep(t, dt):
    if t < dt:
        t = t / dt
        return t + t - t * t - 1.0
    elif t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


@njit(cache=True)
def _saw(dt, ph0):
    n = dt.shape[0]
    y = np.empty(n)
    t = ph0
    for i in range(n):
        y[i] = 2.0 * t - 1.0 - _blep(t, dt[i])
        t += dt[i]
        if t >= 1.0:
            t -= 1.0
    return y


@njit(cache=True)
def _pulse(dt, width, ph0):
    n = dt.shape[0]
    y = np.empty(n)
    t = ph0
    for i in range(n):
        v = 1.0 if t < width else -1.0
        v += _blep(t, dt[i])
        t2 = t + (1.0 - width)
        if t2 >= 1.0:
            t2 -= 1.0
        v -= _blep(t2, dt[i])
        y[i] = v
        t += dt[i]
        if t >= 1.0:
            t -= 1.0
    return y


def saw_n(freq, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    return _saw(np.ascontiguousarray(f / SR), float(ph0))


def pulse_n(freq, n, width=0.5, ph0=0.0):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    return _pulse(np.ascontiguousarray(f / SR), float(width), float(ph0))


def tri_n(freq, n):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    p = (phase(f) / TWO_PI) % 1.0
    return 4.0 * np.abs(p - 0.5) - 1.0


def square_naive(freq, n):
    f = np.broadcast_to(np.asarray(freq, float), (n,))
    return np.sign(np.sin(phase(f)) + 1e-9)


def fm(fc, ratio, index, n, amp_t60=None, ph0=0.0):
    """2-operator FM. index: scalar or array (envelope). returns sine carrier phase-modulated"""
    f = np.broadcast_to(np.asarray(fc, float), (n,))
    ph = phase(f)
    idx = np.broadcast_to(np.asarray(index, float), (n,))
    return np.sin(ph + ph0 + idx * np.sin(ph * ratio))


# ----------------------------------------------------------------------------------------------------------------- modal / physical
def modal(f0, ratios, amps, t60s, n, attack_ms=0.4, phases=None, seed=0):
    """sum of exponentially decaying sines. t60 seconds per mode. attack: short sin^2 ramp (no click)"""
    t = t_of(n)
    y = np.zeros(n)
    r = rng(seed)
    a_n = max(2, ms(attack_ms))
    ramp = np.ones(n)
    ramp[:a_n] = np.sin(np.linspace(0, np.pi / 2, a_n)) ** 2
    for k, (rt, am, d) in enumerate(zip(ratios, amps, t60s)):
        f = f0 * rt
        if f >= 0.46 * SR:
            continue
        ph = (r.random() * TWO_PI) if phases is None else phases[k]
        y += am * np.exp(-6.9078 * t / max(d, 1e-4)) * np.sin(TWO_PI * f * t + ph)
    return y * ramp


@njit(cache=True)
def _ks(n, period, seed_noise, g, damp):
    y = np.zeros(n)
    N = int(period)
    frac = period - N
    buf = seed_noise[:N + 2].copy()
    # allpass fractional delay
    c = (1.0 - frac) / (1.0 + frac)
    ap_x1 = 0.0
    ap_y1 = 0.0
    idx = 0
    prev = 0.0
    for i in range(n):
        cur = buf[idx]
        lp_ = damp * cur + (1.0 - damp) * prev
        prev = cur
        v = lp_ * g
        out = c * (v - ap_y1) + ap_x1
        ap_x1 = v
        ap_y1 = out
        buf[idx] = out
        y[i] = cur
        idx += 1
        if idx >= N:
            idx = 0
    return y


def ks(f0, n, seed, g=0.997, damp=0.5, bright=1.0):
    """Karplus-Strong plucked string with an all-pass fractional delay (in tune to ~1 cent)"""
    period = SR / f0 - (1.0 - damp)   # total loop delay = buffer (N) + all-pass fraction + the averaging filter's (1 - damp) samples
    period = max(period, 4.0)
    e = rng(seed).uniform(-1, 1, int(period) + 4)
    if bright < 1.0:
        e = lfilter([bright, 0], [1, -(1 - bright)], e)
    return _ks(n, period, e, g, damp)


# ----------------------------------------------------------------------------------------------------------------- grains
def grain_times(n, rate_fn, seed):
    """inhomogeneous Poisson: rate_fn(t_array) grains/s -> sorted sample indices"""
    lam = np.maximum(rate_fn(t_of(n)), 0.0)
    cum = np.cumsum(lam) / SR
    total = cum[-1]
    r = rng(seed)
    k = r.poisson(total)
    u = np.sort(r.uniform(0, total, k))
    return np.searchsorted(cum, u)


def add_at(dst, src, start, gain=1.0):
    """mix src into dst at sample index start (bounds-safe). works for mono dst/src or (n,2)"""
    if start >= len(dst) or start + len(src) <= 0:
        return dst
    s0 = max(0, -start)
    d0 = max(0, start)
    ln = min(len(src) - s0, len(dst) - d0)
    if ln <= 0:
        return dst
    dst[d0:d0 + ln] += src[s0:s0 + ln] * gain
    return dst


# ----------------------------------------------------------------------------------------------------------------- formant voice
def rosenberg(ph, oq=0.6):
    """Rosenberg glottal pulse from a phase in cycles (0..1 fraction)"""
    p = ph % 1.0
    tp = oq * 0.8
    tn = oq * 0.2
    y = np.zeros_like(p)
    m1 = p < tp
    y[m1] = 0.5 * (1 - np.cos(np.pi * p[m1] / tp))
    m2 = (p >= tp) & (p < tp + tn)
    y[m2] = np.cos(np.pi / 2 * (p[m2] - tp) / tn)
    return y - y.mean()


def formant_voice(f0, formants, n, seed, oq=0.6, breath=0.06, bw=(60, 90, 150, 200), gains=(1.0, 0.6, 0.35, 0.2)):
    """f0: array Hz (n,), formants: list of arrays/scalars Hz (n,) or scalar (F1,F2,F3...). Parallel resonator bank on a glottal source."""
    f0 = np.broadcast_to(np.asarray(f0, float), (n,))
    ph = np.cumsum(f0 / SR)
    src = np.gradient(rosenberg(ph, oq))
    src = src / (np.max(np.abs(src)) + 1e-9)
    src = src + breath * white(n, seed)
    y = np.zeros(n)
    for k, F in enumerate(formants):
        Fk = np.broadcast_to(np.asarray(F, float), (n,))
        q = np.maximum(Fk / bw[min(k, len(bw) - 1)], 2.0)
        y += gains[min(k, len(gains) - 1)] * svf(src, Fk, q, "bp")
    return y


# ----------------------------------------------------------------------------------------------------------------- space
_IR_CACHE = {}


def make_ir(seconds=1.2, decay=0.24, predelay=0.011, seed=31337, bright=0.9, dark=0.08):
    """seeded stereo IR: exponentially decaying noise whose high end darkens over time; energy-normalised so wet stems stay linear"""
    key = (seconds, decay, predelay, seed, bright, dark)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    n, pre = int(seconds * SR), int(predelay * SR)
    out = []
    t = np.maximum(np.arange(n) - pre, 0) / SR
    c = bright - (bright - dark) * np.minimum(t / seconds, 1.0)
    for ch in (1, 2):
        w = rng(seed * ch).uniform(-1, 1, n)
        a = _onepole(w, c)
        a = a * np.exp(-t / decay) * (1 - np.exp(-t / 0.006))
        a[:pre] = 0
        out.append(a)
    sc = 1 / np.sqrt((np.sum(out[0] ** 2) + np.sum(out[1] ** 2)) / 2)
    ir = (out[0] * sc, out[1] * sc)
    _IR_CACHE[key] = ir
    return ir


@njit(cache=True)
def _onepole(w, c):
    y = np.empty(w.shape[0])
    s = 0.0
    for i in range(w.shape[0]):
        s += (w[i] - s) * c[i]
        y[i] = s
    return y


ROOMS = {"tiny": (0.12, 0.035, 0.002), "room": (0.45, 0.11, 0.006), "hall": (1.4, 0.38, 0.014), "plate": (1.8, 0.5, 0.004), "cavern": (3.6, 1.1, 0.025)}


def reverb(x, kind="room", wet=0.2, seed=7):
    """x mono or (n,2). returns same length + tail as (n+tail, 2). dry kept at unity, wet added (send level)."""
    secs, dec, pre = ROOMS[kind]
    L, R = make_ir(secs, dec, pre, seed)
    x2 = x if x.ndim == 2 else np.stack([x, x], 1)
    wl = fftconvolve(x2[:, 0], L) * wet
    wr = fftconvolve(x2[:, 1], R) * wet
    n = len(wl)
    out = np.zeros((n, 2))
    out[:len(x2)] += x2
    out[:, 0] += wl
    out[:, 1] += wr
    return out


# ----------------------------------------------------------------------------------------------------------------- saturation
def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def bitcrush(x, bits=8, div=1):
    if div > 1:
        x = np.repeat(x[::div], div)[:len(x)]
        if len(x) < 1:
            return x
    q = 2.0 ** (bits - 1)
    return np.round(x * q) / q


def oversample_apply(x, fn, factor=4):
    y = resample_poly(x, factor, 1)
    y = fn(y)
    return resample_poly(y, 1, factor)[:len(x)]


# ----------------------------------------------------------------------------------------------------------------- stereo
def pan_st(m, p):
    """equal-power pan; p in -1..1, scalar or array. returns (n,2)"""
    a = (np.clip(np.asarray(p, float), -1, 1) + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], 1)


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], 1)


def widen(st, amount=1.0):
    """mid/side widen (amount 1 = unchanged, 0 = mono, 2 = wide)"""
    m = (st[:, 0] + st[:, 1]) * 0.5
    s = (st[:, 0] - st[:, 1]) * 0.5 * amount
    return np.stack([m + s, m - s], 1)


def decorrelate(x, seed, ms_max=14.0):
    """cheap stereo from a mono: a Haas offset and complementary comb-free allpass-ish tilt"""
    d = max(1, ms(ms_max * (0.4 + 0.6 * rng(seed).random())))
    L = x
    R = np.concatenate([np.zeros(d), x[:-d]])
    return np.stack([L, R], 1)


def haas(x, delay_ms=6.0, side=1):
    d = ms(delay_ms)
    y = np.stack([x, x], 1)
    y[:, side] = np.concatenate([np.zeros(d), x[:-d]])
    return y


def glide(f0, f1, n, shape="exp"):
    u = np.linspace(0, 1, n)
    return expo(f0, f1, u) if shape == "exp" else f0 + (f1 - f0) * u


def semis(st):
    return 2.0 ** (st / 12.0)


def note_hz(midi):
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)
