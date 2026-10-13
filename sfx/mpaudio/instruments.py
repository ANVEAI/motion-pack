"""motion-pack / sfx / mpaudio / instruments.py
Shared synthesised voices used by BOTH the sfx library (drums, stabs, bells...) and the music kit (beds, stingers, logos).
Every voice: mono float64 array, attack at index 0, peak about 1.0 at velocity 1, deterministic from (params, seed). Owned synthesis only.
Drum recipes follow standard synthesis practice (sine + pitch envelope kick, noise+tone snare, six-oscillator metallic hat) re-implemented here;
the metallic ratios are a published circuit analysis used only as numbers, no sample or preset is imitated."""
import numpy as np
from . import dsp
from .dsp import SR, t_of, env_ad, white, svf, rng, db

# --------------------------------------------------------------------------------------------------------------- drums


def kick(seed=1, f0=150.0, f1=48.0, tau=0.025, decay=0.28, click=0.25, length=0.6, drive=0.0, vel=1.0):
    n = dsp.sec(length)
    t = t_of(n)
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    body = np.sin(dsp.phase(f)) * env_ad(t, 0.001, decay)
    c = svf(white(n, seed), 3500, 1.2, "bp") * env_ad(t, 0.0002, 0.002) * click * 3.0
    y = body + c
    if drive > 0:
        y = dsp.oversample_apply(y, lambda z: np.tanh(z * (1 + drive)) / np.tanh(1 + drive), 4)
    return y * vel


def snare(seed=1, vel=1.0, length=0.4):
    n = dsp.sec(length)
    t = t_of(n)
    f = 180 + 50 * np.exp(-t / 0.015)
    tone = dsp.tri_n(f, n) * env_ad(t, 0.001, 0.09) * 0.8
    nz = svf(white(n, seed), 1900, 0.9, "bp") * env_ad(t, 0.001, 0.14) * 1.6
    air = dsp.hp(white(n, seed + 1), 6000) * env_ad(t, 0.001, 0.14) * 0.5
    return (tone + nz + air) * vel * 0.8


def clap(seed=1, vel=1.0, length=0.45):
    n = dsp.sec(length)
    t = t_of(n)
    y = np.zeros(n)
    for k, o in enumerate((0, 9, 18, 30)):
        tau = 0.09 if k == 3 else 0.006
        b = svf(white(n, seed + k), 1200, 1.6, "bp") * env_ad(t - o / 1000.0, 0.0005, tau)
        y += b
    y = dsp.hp(y, 400) * 2.2
    return y * vel


def hat(seed=1, open_=False, vel=0.8, length=None):
    length = length or (0.4 if open_ else 0.12)
    n = dsp.sec(length)
    t = t_of(n)
    y = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        y += dsp.pulse_n(f * 2.0, n, 0.5)
    y = y / 6.0 * 0.7 + 0.4 * white(n, seed)
    y = dsp.hp(y, 6500 + 2500 * vel, 2)
    return y * env_ad(t, 0.0005, 0.25 if open_ else 0.035) * (0.4 + 0.6 * vel) * 1.6


def rim(seed=1, vel=1.0):
    n = dsp.sec(0.12)
    t = t_of(n)
    y = (np.sin(dsp.TWO_PI * 1700 * t) + np.sin(dsp.TWO_PI * 480 * t)) * env_ad(t, 0.0003, 0.014)
    y += svf(white(n, seed), 4500, 1.0, "bp") * env_ad(t, 0.0001, 0.002) * 1.2
    return y * 0.6 * vel


def tom(seed=1, f0=160.0, vel=1.0, length=0.6):
    n = dsp.sec(length)
    t = t_of(n)
    f = f0 * (1 + 0.14 * np.exp(-t / 0.04))
    ratios = (1.0, 1.594, 2.136, 2.296, 2.653, 2.918)
    amps = (1.0, 0.35, 0.22, 0.14, 0.1, 0.06)
    y = np.zeros(n)
    for r, a in zip(ratios, amps):
        y += a * np.sin(dsp.phase(f * r)) * np.exp(-t / (0.22 / (0.6 + 0.4 * r)))
    y *= dsp.fade_in(np.ones(n), 40)
    y += svf(white(n, seed), 2500, 1.0, "bp") * env_ad(t, 0.0002, 0.004) * 0.5
    return y * vel * 0.55


def cowbell(seed=1, vel=1.0):
    n = dsp.sec(0.4)
    t = t_of(n)
    y = dsp.pulse_n(540.0, n, 0.5) + dsp.pulse_n(800.0, n, 0.5)
    y = svf(y, 1100, 2.5, "bp") * env_ad(t, 0.0005, 0.09) * 2.0
    return y * vel


def shaker(seed=1, vel=1.0):
    n = dsp.sec(0.2)
    t = t_of(n)
    y = dsp.hp(white(n, seed), 5000)
    e = env_ad(t, 0.012, 0.03) + 0.7 * env_ad(t - 0.035, 0.012, 0.03)
    return y * e * vel * 0.8


def dhol_low(seed=1, vel=1.0):
    """synthesised low hand-drum thump: membrane modes + beater click (own synthesis, no sample imitation)"""
    n = dsp.sec(0.5)
    t = t_of(n)
    f = 85 * (1 + 0.5 * np.exp(-t / 0.03))
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.001, 0.2) + 0.4 * np.sin(dsp.phase(f * 1.59)) * np.exp(-t / 0.1)
    y += svf(white(n, seed), 1800, 1.0, "bp") * env_ad(t, 0.0002, 0.006) * 0.8
    return y * vel * 0.8


def dhol_rim(seed=1, vel=1.0):
    n = dsp.sec(0.3)
    t = t_of(n)
    y = dsp.modal(190.0 * 1.0, (1, 2.1, 3.3, 4.6), (1, .7, .5, .3), (0.12, 0.08, 0.06, 0.04), n, seed=seed)
    y += svf(white(n, seed), 3600, 1.2, "bp") * env_ad(t, 0.0002, 0.012) * 1.4
    return y * vel * 0.6


def e808(seed=1, f=55.0, length=1.0, vel=1.0, drive=2.5):
    n = dsp.sec(length)
    t = t_of(n)
    fr = f * (1 + 0.3 * np.exp(-t / 0.025))
    y = np.sin(dsp.phase(fr)) * env_ad(t, 0.010, 0.55)
    y = dsp.oversample_apply(y, lambda z: np.tanh(z * drive) / np.tanh(drive), 4)
    return y * vel


# --------------------------------------------------------------------------------------------------------------- tonal voices
def _len(dur, rel):
    return dsp.sec(dur + rel)


def pluck(f, dur=0.4, seed=1, g=0.9965, vel=1.0, damp=0.5, rel=0.08, bright=0.6):
    n = _len(dur, rel)
    y = dsp.ks(f, n, seed, g=g, damp=damp, bright=bright)
    t = t_of(n)
    y = y * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.03))
    return y * vel * 1.1


def pizz(f, dur=0.12, seed=1, vel=1.0):
    return pluck(f, dur, seed, g=0.992, vel=vel, damp=0.55, rel=0.05, bright=0.3)


def bell(f, dur=1.2, T=None, index=6.0, ratio=1.4, vel=1.0, seed=1):
    T = T or dur
    n = dsp.sec(dur + 0.2)
    t = t_of(n)
    idx = index * np.exp(-t / (0.22 * T))
    y = dsp.fm(f, ratio, idx, n) * env_ad(t, 0.0008, T * 0.35)
    y += 0.3 * np.sin(dsp.TWO_PI * f * 2.0 * t) * env_ad(t, 0.0008, T * 0.1)
    return y * vel * 0.7


def marimba(f, dur=0.3, vel=1.0, seed=1):
    n = dsp.sec(dur + 0.25)
    y = dsp.modal(f, (1, 4.0, 10.0), (1.0, 0.35, 0.08), (0.35 + dur, 0.12, 0.04), n, seed=seed, phases=(0, 0, 0))
    return y * vel * 0.9


def keys(f, dur=0.5, vel=1.0, seed=1):
    """FM electric-piano-ish"""
    n = dsp.sec(dur + 0.3)
    t = t_of(n)
    idx = 1.5 * np.exp(-t / 0.25) + 0.3
    y = dsp.fm(f, 1.0, idx, n) * env_ad(t, 0.002, 0.6)
    y += 0.25 * dsp.fm(f * 2.0, 1.0, 0.8 * np.exp(-t / 0.1), n) * env_ad(t, 0.002, 0.2)
    rel = np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.08))
    return y * rel * vel * 0.7


def pad(f, dur=2.0, vel=1.0, seed=1, detune=9.0, fc=1800.0, attack=0.12, rel=0.35, voices=3):
    n = dsp.sec(dur + rel)
    y = np.zeros(n)
    for k in range(voices):
        cents = (k - (voices - 1) / 2) * detune
        y += dsp.saw_n(f * 2 ** (cents / 1200), n, ph0=(k * 0.31) % 1.0)
    y = y / voices
    t = t_of(n)
    cut = fc * (0.35 + 0.65 * np.minimum(t / max(dur * 0.5, 0.05), 1.0))
    y = dsp.svf(y, cut, 0.8, "lp")
    e = np.where(t < attack, 0.5 - 0.5 * np.cos(np.pi * t / attack), 1.0) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel * 0.35)))
    return y * e * vel * 0.8


def bass_saw(f, dur=0.4, vel=1.0, seed=1, fc=700.0):
    n = dsp.sec(dur + 0.06)
    t = t_of(n)
    y = dsp.saw_n(f, n) * 0.6 + np.sin(dsp.phase(np.full(n, f))) * 0.7
    cut = fc * (0.4 + 0.6 * np.exp(-t / 0.12))
    y = dsp.svf(y, cut, 1.0, "lp")
    e = env_ad(t, 0.004, 1e9) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.02))
    return y * e * vel * 0.9


def bass_sub(f, dur=0.4, vel=1.0, seed=1):
    n = dsp.sec(dur + 0.08)
    t = t_of(n)
    y = np.sin(dsp.phase(np.full(n, f))) + 0.18 * np.sin(dsp.phase(np.full(n, f * 2)))
    e = env_ad(t, 0.006, 1e9) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.03))
    return y * e * vel * 0.9


def lead(f, dur=0.4, vel=1.0, seed=1, fc=3200.0, vib=True):
    n = dsp.sec(dur + 0.12)
    t = t_of(n)
    fr = f * (1 + (0.004 * np.minimum(t / 0.25, 1.0) * np.sin(dsp.TWO_PI * 5.5 * t) if vib else 0))
    y = dsp.saw_n(fr, n) * 0.6 + dsp.pulse_n(fr * 1.003, n, 0.35) * 0.4
    y = dsp.svf(y, fc * (0.5 + 0.5 * np.exp(-t / 0.2)), 1.1, "lp")
    e = env_ad(t, 0.006, 1e9) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.05))
    return y * e * vel * 0.7


def stab(freqs, dur=0.5, vel=1.0, seed=1, fc0=4500.0, fc1=700.0, tau=0.12, saws=3, detune=9.0):
    n = dsp.sec(dur + 0.2)
    t = t_of(n)
    y = np.zeros(n)
    for f in freqs:
        for k in range(saws):
            y += dsp.saw_n(f * 2 ** (((k - (saws - 1) / 2) * detune) / 1200), n, ph0=rng(seed + k).random())
    y /= max(1, len(freqs) * saws) / 2.0
    y = dsp.svf(y, fc1 + (fc0 - fc1) * np.exp(-t / tau), 1.0, "lp")
    return y * env_ad(t, 0.002, dur * 0.6) * vel * 0.8


def supersaw(f, n, spread_cents, seed=1, voices=7):
    """spread_cents scalar or array"""
    y = np.zeros(n)
    sp = np.broadcast_to(np.asarray(spread_cents, float), (n,))
    for k in range(voices):
        pos = (k - (voices - 1) / 2) / ((voices - 1) / 2)
        fr = np.broadcast_to(np.asarray(f, float), (n,)) * 2 ** (pos * sp / 1200)
        y += dsp.saw_n(fr, n, ph0=rng(seed * 31 + k).random())
    return y / voices * 1.6
