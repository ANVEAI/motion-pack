"""Liquid: Minnaert bubble model. An air bubble of radius r rings at f = 3.26 / r Hz (r in metres), damped sinusoid whose pitch rises ~20% over its life
(van den Doel-style damping d = 0.043 f + 0.0014 f^1.5). All values are starting points to tune by ear."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, t_of, env_ad, svf, white, pink, rng, add_at
from mpaudio.registry import snd


def bubble_sig(r_mm, seed=1, rise=0.2, amp=1.0):
    f0 = 3.26 / (r_mm / 1000.0)
    d = 0.043 * f0 + 0.0014 * f0 ** 1.5
    n = max(sec(0.01), sec(min(7.0 / d, 0.6)))
    t = t_of(n)
    f = f0 * (1 + rise * (1 - np.exp(-t * d / 2)))
    y = np.sin(dsp.phase(f)) * np.exp(-d * t)
    a = dsp.ms(1.5)
    y[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    return y * amp


@snd("snd.liquid.bubble", "liquid", ["family:liquid", "tier:3", "anchor:crest", "tonal:yes", "size:xs"], tier=3, use=["ad", "short_film", "mime"], pairs=["ink", "cut"], desc="single bubble, r = 2 mm", tonal=True, seed=100)
def bubble(seed):
    return bubble_sig(2.0, seed)


@snd("snd.liquid.drip", "liquid", ["family:liquid", "tier:3", "anchor:noise", "tonal:yes", "size:xs"], tier=3, use=["short_film", "ad"], pairs=["cut"], desc="drip: click + 1.2 mm bubble", tonal=True, seed=101)
def drip(seed):
    n = sec(0.3)
    y = np.zeros(n)
    add_at(y, svf(white(sec(0.01), seed), 3000, 1.0, "bp") * env_ad(t_of(sec(0.01)), 0.0002, 0.003) * 3.0, 0, 0.5)
    add_at(y, bubble_sig(1.2, seed), dsp.ms(3), 1.0)
    return dsp.reverb(y, "tiny", 0.08)


@snd("snd.liquid.pour", "liquid", ["family:liquid", "tier:3", "anchor:scatter", "tonal:no", "size:l"], tier=3, use=["ad", "short_film"], pairs=["reveal"], desc="pour into a container: bubble cloud, pitch rises as it fills, 1.6 s", seed=102)
def pour(seed):
    n = sec(1.6)
    r = rng(seed)
    y = pink(n, seed)
    y = dsp.lp(y, 3000) * 0.03
    for i in dsp.grain_times(n, lambda t: 60 + 190 * np.minimum(t / 1.0, 1.0), seed + 1):
        u = i / n
        rr = np.exp(r.normal(np.log(1.6), 0.5)) * (1 - 0.25 * u)
        add_at(y, bubble_sig(float(np.clip(rr, 0.5, 5)), int(i), amp=np.exp(r.normal(-1.5, 0.5))), int(i), 1.0)
    return y


@snd("snd.liquid.splash", "liquid", ["family:liquid", "tier:2", "anchor:noise", "tonal:no", "size:m"], tier=2, use=["ad", "short_film", "mime"], pairs=["cut", "ink"], desc="splash: noise burst + 60 bubbles", seed=103)
def splash(seed):
    n = sec(0.8)
    t = t_of(n)
    r = rng(seed)
    y = svf(white(n, seed), 1600, 0.8, "bp") * env_ad(t, 0.002, 0.09) * 2.5
    for i in dsp.grain_times(n, lambda tt: 240 * np.exp(-tt / 0.12), seed + 1):
        add_at(y, bubble_sig(float(np.clip(np.exp(r.normal(np.log(2), 0.5)), 0.6, 6)), int(i)), int(i), np.exp(r.normal(-1.3, 0.4)))
    return dsp.lp(y, 5500)


@snd("snd.liquid.glug", "liquid", ["family:liquid", "tier:3", "anchor:scatter", "tonal:yes", "size:m", "mood:comic"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="three big glug bubbles, falling pitch", tonal=True, seed=104)
def glug(seed):
    n = sec(0.6)
    y = np.zeros(n)
    for k, rr in enumerate((6.5, 7.5, 8.8)):
        m = sec(0.2)
        t = t_of(m)
        f = (3.26 / (rr / 1000.0)) * (1 - 0.12 * k) * (1 + 0.2 * (1 - np.exp(-t / 0.03)))
        v = np.sin(dsp.phase(f)) * np.exp(-t / 0.04) + 0.3 * np.sin(dsp.phase(np.full(m, 140.0))) * np.exp(-t / 0.06)
        add_at(y, v, dsp.ms(90 * k), 0.9 ** k)
    return y


@snd("snd.liquid.fizz", "liquid", ["family:liquid", "tier:3", "anchor:scatter", "tonal:no", "size:m"], tier=3, use=["ad"], pairs=["reveal"], desc="carbonation fizz with pops, 1.2 s", seed=105)
def fizz(seed):
    n = sec(1.2)
    r = rng(seed)
    y = np.zeros(n)
    for i in dsp.grain_times(n, lambda t: 3000 * np.sin(np.pi * np.clip(t / 1.2, 0, 1)) ** 0.5, seed):
        m = 40
        add_at(y, dsp.hp(white(m + 32, int(i)), 6000)[:m] * np.hanning(m), int(i), np.exp(r.normal(-1.2, 0.5)))
    for i in dsp.grain_times(n, lambda t: np.full_like(t, 20.0), seed + 2):
        add_at(y, bubble_sig(0.8, int(i), amp=0.3), int(i), 1.0)
    return dsp.lp(y, 11000)


@snd("snd.liquid.bubbles_run", "liquid", ["family:liquid", "tier:3", "anchor:scatter", "tonal:no", "size:m"], tier=3, use=["ad", "short_film"], pairs=["ink", "dissolve"], desc="bubbles rising: sparse cloud with rising pitch, 1.4 s", seed=106)
def bubbles_run(seed):
    n = sec(1.4)
    r = rng(seed)
    y = np.zeros(n)
    for i in dsp.grain_times(n, lambda t: 30 + 25 * np.sin(np.pi * np.clip(t / 1.4, 0, 1)), seed):
        u = i / n
        add_at(y, bubble_sig(float(np.clip(3.0 * (1 - 0.6 * u) * np.exp(r.normal(0, 0.3)), 0.6, 8)), int(i), amp=np.exp(r.normal(-1.2, 0.4))), int(i), 1.0)
    return y
