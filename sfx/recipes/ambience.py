"""Seamless ambience loops (8.0 s). Circular synthesis: noise shaped in the frequency domain over the whole loop, periodic modulations use an INTEGER number of
cycles per loop, scattered events wrap around the loop end, and non-circular sources are equal-power cross-faded onto their own head."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, pink, brown, rng, expo
from mpaudio.registry import snd

L = sec(8.0)
XF = sec(0.6)


def add_wrap(dst, src, start, gain=1.0):
    n = len(dst)
    start = int(start) % n
    m = len(src)
    first = min(m, n - start)
    dst[start:start + first] += src[:first] * gain
    if first < m:
        dst[:m - first] += src[first:] * gain


def make_loop(x):
    """x has length L + XF; equal-power crossfade of the overhang onto the head"""
    out = x[:L].copy()
    w = np.linspace(0, np.pi / 2, XF)
    out[:XF] = out[:XF] * np.sin(w) + x[L:L + XF] * np.cos(w)
    return out


def cyc(freq_hz):
    """snap a frequency to an integer number of cycles over the loop"""
    return round(freq_hz * 8.0) / 8.0


def stereo_noise(seed, colour="pink"):
    f = pink if colour == "pink" else brown
    return np.stack([f(L, seed), f(L, seed + 1000)], 1)


def _amb(id, tags, desc, seed, **kw):
    return snd(id, "ambience", ["family:amb", "tier:3", "anchor:loop", *tags], tier=3, loop=True, kind="fixed", desc=desc, seed=seed, **kw)


@_amb("snd.amb.room_tone", ["mood:warm", "use:short_film"], "empty room tone with 50 Hz mains hum (India), -48 dBFS style floor", 160, use=["short_film", "talking_head"], pairs=["cut", "jcut"])
def room_tone(seed):
    st = stereo_noise(seed)
    st = np.stack([dsp.fft_filter(st[:, 0], 40, 1400, 2), dsp.fft_filter(st[:, 1], 40, 1400, 2)], 1)
    st /= np.std(st)
    t = t_of(L)
    hum = sum(a * np.sin(dsp.TWO_PI * f * t) for f, a in ((50, 0.45), (100, 0.2), (150, 0.1)))
    drift = 1 + 0.14 * np.sin(dsp.TWO_PI * 0.125 * t)
    return (st + hum[:, None] * 0.6) * drift[:, None]


def _babble_loop(seed, character="adult", level=1.0):
    from .voices import babble
    x = babble(character, "normal", 8.0 + 0.6, seed, "flat", breath=0.12, rate=5.0)
    x = dsp.lp(x, 2000)
    x = np.pad(x, (0, max(0, L + XF - len(x))))[:L + XF]
    return make_loop(x) * level


@_amb("snd.amb.office", ["mood:tech", "use:talking_head"], "office: room tone + distant murmur + keyboard + HVAC", 161, use=["talking_head", "ad", "short_film"], pairs=["cut"])
def office(seed):
    base = room_tone(seed)
    r = rng(seed)
    out = base * 0.8
    for k in range(3):
        b = _babble_loop(seed + 10 * k, "adult" if k != 1 else "female")
        out += dsp.pan_st(b, [-0.5, 0.0, 0.55][k]) * 0.45
    from .ui import key_sound
    kb = np.zeros(L)
    t0 = 0.8
    while t0 < 7.5:
        for j in range(r.integers(6, 14)):
            add_wrap(kb, key_sound(seed + int(t0 * 100) + j, "reg"), sec(t0), db(r.uniform(-3, 0)))
            t0 += 0.07 + 0.05 * r.random()
        t0 += r.uniform(1.0, 2.5)
    out += dsp.pan_st(kb, 0.35) * 0.35
    hv = dsp.fft_filter(brown(L, seed + 7), 30, 180, 2)
    out += np.stack([hv, hv], 1) / np.std(hv) * 0.5
    return out


@_amb("snd.amb.studio_air", ["mood:warm", "use:short_film"], "near-silent studio air: dark pink floor + faint 8 kHz air (not digital zero)", 162, use=["short_film", "talking_head", "launch"], pairs=["dipToBlack", "cut"])
def studio_air(seed):
    st = stereo_noise(seed)
    lo = np.stack([dsp.fft_filter(st[:, 0], 30, 900, 2), dsp.fft_filter(st[:, 1], 30, 900, 2)], 1)
    hi = np.stack([dsp.fft_filter(white(L, seed + 3), 6500, 12000, 2), dsp.fft_filter(white(L, seed + 4), 6500, 12000, 2)], 1)
    return lo / np.std(lo) + hi / np.std(hi) * 0.12


def cricket(seed, f=4600.0, chirp_hz=3.5, pulse_hz=30.0):
    t = t_of(L)
    f = cyc(f)
    carrier = np.sin(dsp.TWO_PI * f * t + rng(seed).random() * 6.28)
    ch = cyc(chirp_hz)
    ph = rng(seed + 1).random()
    chirp_gate = (((t * ch + ph) % 1.0) < 0.35).astype(float)
    pul = np.maximum(0.0, np.sin(dsp.TWO_PI * (round(pulse_hz * 8) / 8) * t)) ** 2
    am = 0.6 + 0.4 * np.sin(dsp.TWO_PI * 0.5 * t)
    g = np.convolve(chirp_gate * pul, np.ones(24) / 24, "same")
    return carrier * g * am


@_amb("snd.amb.night", ["mood:tense", "use:short_film"], "night: low brown floor + 12 detuned crickets", 163, use=["short_film", "mime"], pairs=["cut", "dipToBlack"])
def night(seed):
    r = rng(seed)
    bed = dsp.fft_filter(brown(L, seed), 40, 250, 2)
    bed = bed / np.std(bed) * 0.6
    cr = np.zeros((L, 2))
    for k in range(12):
        c = cricket(seed + k, 4600 + r.uniform(-120, 120), r.uniform(2.75, 4.25), r.uniform(28, 34))
        cr += dsp.pan_st(c, r.uniform(-0.9, 0.9))
    cr = cr / 6.0
    return np.stack([bed, bed], 1) + cr * 0.5


@_amb("snd.amb.crickets", ["mood:tense", "use:short_film"], "crickets only, 3 voices", 164, use=["short_film", "mime"], pairs=["cut"])
def crickets_only(seed):
    r = rng(seed)
    cr = np.zeros((L, 2))
    for k in range(3):
        cr += dsp.pan_st(cricket(seed + k, 4600 + 40 * k, 3.0 + 0.5 * k, 30), -0.5 + 0.5 * k)
    return cr


@_amb("snd.amb.rain", ["mood:tense", "use:short_film"], "rain: Poisson drops + pink bed, interior window taps", 165, use=["short_film"], pairs=["cut", "dissolve"])
def rain(seed):
    out = np.zeros((L, 2))
    for ch in range(2):
        r = rng(seed + ch)
        bed = dsp.fft_filter(pink(L, seed + 10 + ch), 200, 6000, 2)
        out[:, ch] = bed / np.std(bed) * 0.5
        bank = [dsp.bp(white(160, seed + 90 + j), r.uniform(2000, 6000), r.uniform(7000, 9500), 1)[:96] * np.exp(-np.arange(96) / 22.0) for j in range(48)]
        for i in dsp.grain_times(L, lambda t: np.full_like(t, 1500.0), seed + 20 + ch):
            add_wrap(out[:, ch], bank[r.integers(0, 48)], i, np.exp(r.normal(-1.5, 0.6)))
    from .materials import wood_tap
    r = rng(seed)
    for k in range(12):
        add_wrap(out[:, 0], wood_tap(seed + k)[:sec(0.05)], r.integers(0, L), 0.15)
    return out


@_amb("snd.amb.wind", ["mood:tense", "use:short_film"], "wind: pink noise through a slowly wandering band-pass + gust", 166, use=["short_film"], pairs=["cut"])
def wind(seed):
    st = np.zeros((L + XF, 2))
    t = t_of(L + XF)
    for ch in range(2):
        fc = 550 + 250 * np.sin(dsp.TWO_PI * 0.125 * t + ch) + 120 * np.sin(dsp.TWO_PI * 0.375 * t + 2 * ch)
        amp = 0.6 + 0.3 * np.sin(dsp.TWO_PI * 0.25 * t + 1.7 * ch) + 0.15 * np.sin(dsp.TWO_PI * 0.5 * t)
        st[:, ch] = svf(pink(L + XF, seed + ch), fc, 1.5, "bp") * amp
    gust = np.exp(-0.5 * ((t - 4.2) / 0.9) ** 2)
    st *= (1 + 1.2 * gust)[:, None]
    return np.stack([make_loop(st[:, 0]), make_loop(st[:, 1])], 1)


@_amb("snd.amb.crowd", ["mood:warm", "use:short_film"], "crowd murmur: 12 smeared babble voices, wide", 167, use=["short_film", "ad", "mime"], pairs=["cut"])
def crowd(seed):
    r = rng(seed)
    out = np.zeros((L, 2))
    for k in range(12):
        ch = ["adult", "female", "child", "big"][k % 4]
        b = _babble_loop(seed + 3 * k, ch, 1.0)
        out += dsp.pan_st(b, r.uniform(-0.9, 0.9)) * 0.3
    return dsp.reverb(out, "hall", 0.4)[:L] if False else out


@_amb("snd.amb.applause", ["mood:warm", "use:ad"], "applause: dense claps swell and fade", 168, use=["ad", "mime", "short_film"], pairs=["cut"])
def applause(seed):
    out = np.zeros((L, 2))
    for ch in range(2):
        r = rng(seed + ch)
        times = dsp.grain_times(L, lambda t: 3000 * (0.4 + 0.6 * np.sin(np.pi * t / 8.0) ** 0.5), seed + 30 + ch)
        bank = []
        for j in range(48):
            m = int(r.integers(20, 100))
            bank.append(dsp.bp(white(m + 64, seed + 70 + j), r.uniform(1000, 3000), r.uniform(4000, 6000), 1)[:m] * np.exp(-np.arange(m) / (m * 0.3)))
        for i in times:
            add_wrap(out[:, ch], bank[r.integers(0, 48)], i, np.exp(r.normal(-1.2, 0.6)))
    return out


@_amb("snd.amb.city", ["mood:tech", "use:short_film"], "city: brown rumble + traffic hiss + distant horn", 169, use=["short_film", "ad"], pairs=["cut"])
def city(seed):
    rum = dsp.fft_filter(brown(L, seed), 30, 300, 2)
    hiss = dsp.fft_filter(white(L, seed + 1), 1800, 4500, 2)
    t = t_of(L)
    hiss = hiss / np.std(hiss) * (0.25 + 0.15 * np.sin(dsp.TWO_PI * 0.125 * t))
    y = rum / np.std(rum) * 0.8 + hiss
    horn = np.zeros(L)
    m = sec(0.4)
    tt = t_of(m)
    h = (dsp.saw_n(420.0, m) + dsp.saw_n(530.0, m)) * 0.5
    h = dsp.lp(h, 1200) * env_ad(tt, 0.03, 0.2)
    add_wrap(horn, h, sec(5.2), 0.05)
    return np.stack([y, y], 1) + dsp.pan_st(horn, 0.6)


@_amb("snd.amb.server_hum", ["mood:tech", "use:ad"], "server room: 120 Hz hum + fan noise", 170, use=["ad", "launch", "short_film"], pairs=["cut"])
def server_hum(seed):
    t = t_of(L)
    hum = sum(a * np.sin(dsp.TWO_PI * f * t) for f, a in ((120, 0.5), (240, 0.25), (360, 0.12)))
    fan = dsp.fft_filter(pink(L, seed), 900, 2800, 2)
    fan = fan / np.std(fan) * 0.5 * (1 + 0.03 * np.sin(dsp.TWO_PI * 0.5 * t))
    st = np.stack([hum + fan, hum + dsp.fft_filter(pink(L, seed + 1), 900, 2800, 2) / np.std(fan) * 0.5], 1)
    return st


@_amb("snd.amb.tension_drone", ["mood:tense", "mood:cinematic", "use:short_film"], "tension drone on A1/E2: beating saws, slow filter sweep", 171, use=["short_film", "launch"], pairs=["cut", "dipToBlack"])
def tension_drone(seed):
    t = t_of(L)
    y = np.zeros((L, 2))
    for f, g in ((55.0, 1.0), (82.5, 0.6), (110.0, 0.35)):
        for k, d in enumerate((-0.375, 0.375)):
            f2 = cyc(f + d) if f > 60 else f + d
            ph = dsp.TWO_PI * f2 * t
            s = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.33 * np.sin(3 * ph) + 0.2 * np.sin(4 * ph)
            y[:, k] += s * g
    cut = 0.5 + 0.5 * (0.5 - 0.5 * np.cos(dsp.TWO_PI * t / 8.0))
    X = np.fft.rfft(y, axis=0)
    f = np.fft.rfftfreq(L, 1.0 / SR)
    # sweep by blending two circularly lowpassed copies
    lo = np.fft.irfft(X / (1 + (f / 250.0) ** 4)[:, None], L, axis=0)
    hi = np.fft.irfft(X / (1 + (f / 700.0) ** 4)[:, None], L, axis=0)
    return lo * (1 - cut)[:, None] + hi * cut[:, None]


@_amb("snd.amb.vinyl_crackle", ["mood:warm", "use:talking_head"], "lo-fi vinyl crackle + faint hiss", 172, use=["talking_head", "short_film"], pairs=["cut"])
def vinyl(seed):
    out = np.zeros((L, 2))
    for ch in range(2):
        r = rng(seed + ch)
        out[:, ch] = dsp.fft_filter(white(L, seed + 5 + ch), 3000, 9000, 2) * 0.02
        for i in dsp.grain_times(L, lambda t: np.full_like(t, 40.0), seed + 9 + ch):
            m = r.integers(8, 40)
            add_wrap(out[:, ch], white(m, int(i)) * np.exp(-np.arange(m) / (m * 0.3)), i, np.exp(r.normal(-1.0, 0.8)))
    return out
