"""motion-pack / sfx / mpaudio / instruments_ext.py : extra owned voices for the expansion presets and SFX (taiko, string tremolo, guitar strum, chiptune
square / noise, brass-like stab, ride, upright bass). Mono float64 outputs, same conventions as instruments.py."""
import numpy as np
from . import dsp
from .dsp import SR, sec, t_of, env_ad, svf, white, rng, add_at


def taiko(seed=1, f0=62.0, vel=1.0, room=True):
    n = sec(1.6)
    t = t_of(n)
    f = f0 * (1 + 0.22 * np.exp(-t / 0.03))
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.002, 0.5)
    for r, a, d in ((1.59, 0.4, 0.22), (2.14, 0.25, 0.15), (2.65, 0.15, 0.1)):
        y += a * np.sin(dsp.phase(f * r)) * np.exp(-t / d)
    y += svf(white(n, seed), 900, 0.8, "bp") * env_ad(t, 0.0003, 0.012) * 1.4      # bachi (stick) slap on the hide
    y += dsp.lp(white(n, seed + 1), 400) * env_ad(t, 0.001, 0.08) * 0.6
    if room:
        y = dsp.reverb(y, "hall", 0.18, seed)[:, 0][:n]
    return y * vel


def strings_trem(f, dur=2.0, seed=1, vel=1.0, trem_hz=12.0, voices=5, fc=2600.0):
    """bowed-string ensemble stand-in: detuned saws, bow noise, measured tremolo (amplitude) at trem_hz"""
    n = sec(dur)
    t = t_of(n)
    y = np.zeros(n)
    for k in range(voices):
        c = (k - (voices - 1) / 2) * 7.0
        vib = 1 + 0.003 * np.sin(dsp.TWO_PI * (5.0 + 0.3 * k) * t + k)
        y += dsp.saw_n(f * 2 ** (c / 1200) * vib, n, rng(seed + k).random())
    y = svf(y / voices, fc, 0.7, "lp") + dsp.bp(white(n, seed), 2000, 6000, 1) * 0.04
    trem = 0.6 + 0.4 * (0.5 + 0.5 * np.sin(dsp.TWO_PI * trem_hz * t)) if trem_hz else 1.0
    e = np.minimum(t / 0.12, 1.0) * np.where(t > dur - 0.2, np.clip((dur - t) / 0.2, 0, 1), 1.0)
    return y * trem * e * vel


def guitar_strum(freqs, dur=1.2, seed=1, vel=1.0, spread_ms=14.0, down=True):
    """nylon / steel-ish strum: Karplus-Strong strings offset in time"""
    fs = list(freqs) if down else list(freqs)[::-1]
    n = sec(dur + spread_ms * len(fs) / 1000 + 0.05)
    y = np.zeros(n)
    for k, f in enumerate(fs):
        v = dsp.ks(f, sec(dur), seed + k, g=0.9975, damp=0.6, bright=0.75)
        add_at(y, v * (0.9 - 0.05 * k), dsp.ms(k * spread_ms))
    t = t_of(n)
    y += svf(white(n, seed + 50), 3000, 0.8, "bp") * env_ad(t, 0.0005, 0.01) * 0.2
    return y * vel


def chip(f, dur=0.2, vel=1.0, width=0.25, arp=None):
    """naive (aliased on purpose) square / pulse voice, 8-bit style. arp: optional list of semitone offsets cycled at 50 Hz"""
    n = sec(dur)
    t = t_of(n)
    fr = np.full(n, float(f))
    if arp:
        idx = (t * 50).astype(int) % len(arp)
        fr = f * 2.0 ** (np.asarray(arp)[idx] / 12.0)
    ph = np.cumsum(fr / SR) % 1.0
    y = np.where(ph < width, 1.0, -1.0)
    y = dsp.bitcrush(y * 0.5, 6)
    e = np.where(t > dur - 0.01, np.clip((dur - t) / 0.01, 0, 1), 1.0) * np.minimum(t / 0.002, 1.0)
    return y * e * vel


def chip_noise(seed=1, dur=0.06, vel=1.0, div=4):
    n = sec(dur)
    t = t_of(n)
    y = dsp.bitcrush(white(n, seed), 4, div)
    return y * np.exp(-t / (dur * 0.3)) * vel * 0.6


def brass_stab(freqs, dur=0.6, seed=1, vel=1.0):
    """brass-like orchestral stab: saws with a fast-opening then closing filter, slight pitch scoop"""
    n = sec(dur + 0.25)
    t = t_of(n)
    y = np.zeros(n)
    for k, f in enumerate(freqs):
        fr = f * (1 - 0.02 * np.exp(-t / 0.03))
        y += dsp.saw_n(fr * 2 ** ((k % 3 - 1) * 6 / 1200), n, rng(seed + k).random())
    fc = 600 + 3800 * np.exp(-t / 0.18) * np.minimum(t / 0.02, 1.0)
    y = svf(y / max(1, len(freqs)), fc, 1.0, "lp")
    return y * env_ad(t, 0.012, dur * 0.7) * vel


def ride(seed=1, vel=1.0):
    n = sec(1.1)
    t = t_of(n)
    y = np.zeros(n)
    for f in (310.0, 452.0, 587.0, 761.0, 925.0, 1170.0):
        y += dsp.pulse_n(f * 3.1, n, 0.5)
    y = dsp.hp(y / 6 * 0.4 + white(n, seed) * 0.5, 5500) * env_ad(t, 0.0005, 0.35)
    y += dsp.modal(2600.0, (1.0, 1.41), (0.3, 0.2), (0.8, 0.6), n, seed=seed) * 0.4    # bell
    return y * vel * 0.6


def upright(f, dur=0.45, seed=1, vel=1.0):
    n = sec(dur + 0.1)
    t = t_of(n)
    y = dsp.ks(f, n, seed, g=0.996, damp=0.5, bright=0.35)
    y = dsp.lp(y, 900) + np.sin(dsp.phase(np.full(n, f))) * env_ad(t, 0.004, dur * 0.6) * 0.5
    return y * np.where(t > dur, np.exp(-(t - dur) / 0.04), 1.0) * vel


def wobble_bass(f, dur=1.6, seed=1, rate_hz=4.0, vel=1.0):
    """saw + square through a low-pass whose cutoff an LFO opens and closes (wobble)"""
    n = sec(dur)
    t = t_of(n)
    y = dsp.saw_n(np.full(n, f), n) * 0.6 + dsp.pulse_n(np.full(n, f), n, 0.5) * 0.4
    lfo = 0.5 - 0.5 * np.cos(dsp.TWO_PI * rate_hz * t)
    y = svf(y, 120 + 2200 * lfo, 3.0, "lp")
    y = np.tanh(y * 1.8)
    return y * np.minimum(t / 0.004, 1.0) * np.where(t > dur - 0.08, np.clip((dur - t) / 0.08, 0, 1), 1.0) * vel
