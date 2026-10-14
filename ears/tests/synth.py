"""Synthetic test signals for ears (numpy only, 48 kHz, a few seconds each; nothing is written to disk)."""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000


def t_(sec):
    return np.arange(int(sec * SR)) / SR


def sine(f=1000.0, dbfs=-20.0, sec=10.0):
    return 10 ** (dbfs / 20) * np.sin(2 * np.pi * f * t_(sec))


def pink(sec, seed=0, dbfs=-20.0):
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    W = np.fft.rfft(rng.standard_normal(n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    W[1:] /= np.sqrt(fr[1:])
    W[fr < 20] = 0                                    # no sub-audio drift: real mixes are high-passed
    y = np.fft.irfft(W, n)
    return y / np.sqrt(np.mean(y ** 2)) * 10 ** (dbfs / 20)


def bandpass(y, lo, hi, order=4):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), y)


def lowpass(y, hi, order=1):
    return sosfilt(butter(order, hi, 'lowpass', fs=SR, output='sos'), y)


def mix_like(sec, seed=0):
    """a balanced 'mix': pink noise with a gentle top-end roll-off (about -4 dB / octave above 2 kHz), plus a bass tone"""
    y = lowpass(pink(sec, seed, -22.0), 2500.0) + 0.05 * np.sin(2 * np.pi * 55 * t_(sec)) + 0.03 * np.sin(2 * np.pi * 82.4 * t_(sec))
    return y


def click(sec=0.01, f=1000.0, amp=0.5):
    n = int(sec * SR)
    return amp * np.sin(2 * np.pi * f * np.arange(n) / SR) * np.hanning(n)


def click_track(bpm=120.0, sec=8.0, offset=0.02):
    y = np.zeros(int(sec * SR))
    c = click()
    k = 0
    while True:
        s = int((offset + k * 60.0 / bpm) * SR)
        if s + len(c) >= len(y):
            break
        y[s:s + len(c)] += c
        k += 1
    return y


def speech_like(sec, regions, seed=1, dbfs=-18.0):
    """band-limited noise (300-3400 Hz) chopped into syllables (4-6 per second, irregular) inside `regions`"""
    rng = np.random.default_rng(seed)
    n = int(sec * SR)
    env = np.zeros(n)
    for a, b in regions:
        t = a
        while t < b - 0.1:
            d = rng.uniform(0.09, 0.2)
            s, e = int(t * SR), int(min(b, t + d) * SR)
            env[s:e] = np.hanning(e - s) * rng.uniform(0.6, 1.0)
            t += d + rng.uniform(0.03, 0.12)
    y = bandpass(rng.standard_normal(n), 300, 3400) * env
    return y / np.sqrt(np.mean(y[env > 0] ** 2)) * 10 ** (dbfs / 20)


def duck_env(sec, regions, depth_db, ramp=0.08):
    g = np.ones(int(sec * SR))
    lo = 10 ** (-depth_db / 20)
    for a, b in regions:
        s, e = int((a - ramp) * SR), int((b + ramp) * SR)
        g[s:e] = lo
        r = int(ramp * SR)
        g[s - r:s] = np.linspace(1, lo, r)
        g[e:e + r] = np.linspace(lo, 1, r)
    return g


def st(y):
    return np.stack([y, y], 1)
