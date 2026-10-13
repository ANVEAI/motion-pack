"""Foley family (owned synthesis): footsteps on four surfaces, doors, drawer, chair, keys, coin, cup, chai glasses, pen, stamp, zipper, scissors, tape, paper tear,
book, laptop. Every recipe is seed-driven, so each id has round-robin takes: seeds s, s+1, s+2, s+3 are the four takes (tag rr:4); the mixer already picks
seed + occurrence for a repeated id, so a walk never repeats the same step. Starting values; audition before a hero use."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import sec, ms, t_of, env_ad, svf, white, pink, rng, add_at
from mpaudio.registry import snd


def _f(id, tags, desc, seed, tier=3, use=("short_film", "mime", "ad"), pairs=("cut",), tonal=False, **kw):
    return snd(id, "foley", ["family:foley", "foley", "rr:4", "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), *tags], tier=tier, use=list(use), pairs=list(pairs),
               desc=desc, tonal=tonal, seed=seed, **kw)


def burst(n, seed, fc, q, tau, a=0.0002):
    return svf(white(n, seed), fc, q, "bp") * env_ad(t_of(n), a, tau)


def thump(n, f, tau, a=0.001):
    t = t_of(n)
    return np.sin(dsp.phase(f * (1 + 0.4 * np.exp(-t / 0.01)))) * env_ad(t, a, tau)


def crunch(n, seed, rate, lo, hi, span):
    """grain cloud of tiny crunches (gravel, tape, paper fibres) inside `span` seconds"""
    r = rng(seed)
    y = np.zeros(n)
    for i in dsp.grain_times(min(n, sec(span)), lambda t: np.full_like(t, rate), seed):
        m = int(r.integers(30, 160))
        g = dsp.bp(white(m + 64, seed + int(i)), r.uniform(lo, lo * 1.6), r.uniform(hi * 0.7, hi), 1)[:m] * np.exp(-np.arange(m) / (m * 0.25))
        add_at(y, g, int(i), np.exp(r.normal(-1.0, 0.5)))
    return y


def stick_slip(n, seed, f0, f1, fc, q=6.0, jitter=0.25):
    """creak: friction pulse train whose rate wanders f0 -> f1, through a body resonance"""
    r = rng(seed)
    u = np.linspace(0, 1, n)
    rate = dsp.expo(f0, f1, u) * (1 + jitter * dsp.lp(r.standard_normal(n), 8))
    ph = np.cumsum(np.maximum(rate, 5) / dsp.SR)
    pulses = np.diff(np.floor(ph), prepend=0.0)
    return svf(pulses, fc, q, "bp") * 6.0


def _step(seed, heel, toe, gap_ms=70):
    n = sec(0.45)
    y = np.zeros(n)
    add_at(y, heel, 0)
    add_at(y, toe, ms(gap_ms + 15 * (rng(seed).random() - 0.5)), 0.6)
    return y


@_f("snd.foley.footstep_concrete", ["anchor:crest", "size:xs", "surface:concrete"], "footstep on concrete: hard heel crack + gritty scuff", 400)
def fs_concrete(seed):
    n = sec(0.2)
    h = burst(n, seed, 2600, 1.0, 0.01) * 1.5 + thump(n, 110, 0.02) * 0.5 + burst(n, seed + 1, 5000, 0.8, 0.03) * 0.3
    return _step(seed, h, burst(n, seed + 2, 3200, 1.2, 0.008) + burst(n, seed + 3, 6000, 1.0, 0.02) * 0.3)


@_f("snd.foley.footstep_wood", ["anchor:crest", "size:xs", "surface:wood"], "footstep on wooden floor: boards resonate under the heel", 401)
def fs_wood(seed):
    n = sec(0.3)
    h = dsp.modal(180.0 * (1 + 0.05 * rng(seed).random()), (1.0, 2.3, 3.9), (1.0, 0.5, 0.25), (0.12, 0.08, 0.05), n, seed=seed) + burst(n, seed, 1800, 1.0, 0.006) * 1.2
    return _step(seed, h, burst(n, seed + 1, 1400, 1.0, 0.008) * 0.8 + dsp.modal(260.0, (1.0, 2.5), (0.6, 0.3), (0.07, 0.04), n, seed=seed + 1))


@_f("snd.foley.footstep_gravel", ["anchor:noise", "size:s", "surface:gravel"], "footstep on gravel: crunch grain cloud on heel and toe", 402)
def fs_gravel(seed):
    n = sec(0.5)
    return _step(seed, crunch(n, seed, 900, 1200, 7000, 0.12) + thump(n, 90, 0.03) * 0.3, crunch(n, seed + 1, 700, 1500, 8000, 0.09), 110)


@_f("snd.foley.footstep_carpet", ["anchor:noise", "size:xs", "surface:carpet"], "footstep on carpet: soft muffled thud", 403, use=("short_film", "talking_head"))
def fs_carpet(seed):
    n = sec(0.25)
    h = dsp.lp(white(n, seed), 700) * env_ad(t_of(n), 0.004, 0.03) + thump(n, 85, 0.03, 0.004) * 0.6
    return _step(seed, h, dsp.lp(white(n, seed + 1), 900) * env_ad(t_of(n), 0.003, 0.02) * 0.7, 90)


@_f("snd.foley.door_open", ["anchor:noise", "size:m"], "door open: latch click, hinge creak, air", 404, pairs=("cut", "push"))
def door_open(seed):
    n = sec(1.1)
    y = np.zeros(n)
    add_at(y, burst(sec(0.05), seed, 3500, 1.5, 0.004) * 1.5, 0)
    add_at(y, burst(sec(0.05), seed + 1, 2400, 1.5, 0.005), ms(60))
    cr = stick_slip(sec(0.7), seed, 35, 70, 900, 8) * dsp.env_bell(sec(0.7), 0.4, 1.5, 2.0)
    add_at(y, cr, ms(120), 0.5)
    add_at(y, dsp.fft_filter(pink(sec(0.8), seed + 3), 70, 600, 2) * dsp.env_bell(sec(0.8), 0.5, 2, 2) * 0.4, ms(150))
    return y


@_f("snd.foley.door_close", ["anchor:crest", "size:m"], "door close: swing air, heavy thud, latch", 405, tier=2, pairs=("hardCut", "dipToBlack"))
def door_close(seed):
    n = sec(0.9)
    y = np.zeros(n)
    add_at(y, dsp.lp(pink(sec(0.3), seed), 500) * dsp.env_bell(sec(0.3), 0.8, 2, 1) * 0.4, 0)
    m = sec(0.6)
    add_at(y, dsp.modal(85.0, (1.0, 1.9, 3.1), (1.0, 0.5, 0.3), (0.25, 0.15, 0.08), m, seed=seed) + burst(m, seed + 1, 900, 0.9, 0.01) * 1.2, ms(290))
    add_at(y, burst(sec(0.05), seed + 2, 3200, 1.6, 0.004), ms(305), 0.7)
    return y


@_f("snd.foley.drawer", ["anchor:end", "size:m"], "drawer slides open on runners and stops", 406, kind="fixed")
def drawer(seed):
    n = sec(0.75)
    t = t_of(n)
    roll = svf(white(n, seed), 1200 + 600 * np.sin(dsp.TWO_PI * 23 * t), 2.0, "bp") * (0.5 + 0.5 * np.abs(np.sin(dsp.TWO_PI * 11 * t)))
    roll *= dsp.env_bell(n, 0.6, 1.2, 0.5) * 0.6
    y = np.zeros(sec(0.95))
    add_at(y, roll, 0)
    stop = sec(0.66)
    add_at(y, thump(sec(0.2), 140, 0.03) + burst(sec(0.2), seed + 1, 2000, 1.2, 0.006), stop)
    return y, stop


@_f("snd.foley.chair_creak", ["anchor:noise", "size:m", "mood:comic"], "chair creak: friction stick-slip through a wooden body", 407, use=("short_film", "mime"))
def chair_creak(seed):
    n = sec(0.8)
    return stick_slip(n, seed, 25, 60, 700, 5) * dsp.env_bell(n, 0.45, 1.5, 1.5) + stick_slip(n, seed + 1, 60, 45, 1500, 6) * dsp.env_bell(n, 0.6, 2, 2) * 0.4


@_f("snd.foley.keys_jingle", ["anchor:noise", "size:s"], "key ring jingle: clustered small metallic hits", 408, use=("short_film", "ad"))
def keys_jingle(seed):
    r = rng(seed)
    n = sec(0.9)
    y = np.zeros(n)
    for k in range(22):
        f = r.uniform(2400, 6200)
        v = dsp.modal(f, (1.0, 2.76, 5.4), (1.0, 0.5, 0.2), (0.25, 0.12, 0.05), sec(0.3), attack_ms=0.05, seed=seed + k)
        add_at(y, v, sec(abs(r.normal(0.25, 0.14))), np.exp(r.normal(-0.6, 0.5)))
    return y


@_f("snd.foley.coin_drop", ["anchor:crest", "size:m", "mood:warm"], "coin drop: ringing hit, accelerating bounces, spin-down rattle", 409, use=("ad", "mime"), pairs=("cut",))
def coin_drop(seed):
    n = sec(1.6)
    y = np.zeros(n)
    tpos, gap, amp = 0.0, 0.16, 1.0
    for k in range(9):
        v = dsp.modal(3150.0, (1.0, 1.43, 2.37), (1.0, 0.6, 0.3), (0.5 * amp, 0.3, 0.15), sec(0.6), attack_ms=0.05, seed=seed + k)
        add_at(y, v, sec(tpos), amp)
        tpos += gap
        gap *= 0.7
        amp *= 0.72
    m = sec(0.5)
    tt = t_of(m)
    rattle = burst(m, seed + 30, 4000, 2.0, 1.0) * (0.5 + 0.5 * np.sin(dsp.TWO_PI * dsp.expo(8, 40, tt / 0.5) * tt)) * np.linspace(0.3, 0, m)
    add_at(y, rattle, sec(tpos))
    return y


@_f("snd.foley.cup_set_down", ["anchor:crest", "size:xs"], "ceramic cup set down on a table: knock + short ring", 410, use=("short_film", "talking_head"))
def cup_down(seed):
    n = sec(0.4)
    return dsp.modal(1850.0, (1.0, 2.56, 4.1), (0.6, 0.35, 0.15), (0.2, 0.1, 0.05), n, seed=seed) + thump(n, 160, 0.02) * 0.7 + burst(n, seed, 1500, 1.0, 0.005)


@_f("snd.foley.chai_cup_clink", ["anchor:crest", "size:xs", "region:in", "mood:warm"], "chai glasses clink: two small glass tumblers touch (cheers)", 411, tonal=True,
    use=("ad", "short_film", "mime"), pairs=("cut", "match"))
def chai_clink(seed):
    n = sec(0.9)
    y = dsp.modal(2840.0, (1.0, 2.32, 4.25), (1.0, 0.45, 0.2), (0.6, 0.3, 0.12), n, attack_ms=0.05, seed=seed)
    add_at(y, dsp.modal(3390.0, (1.0, 2.35, 4.3), (0.8, 0.4, 0.15), (0.5, 0.25, 0.1), n, attack_ms=0.05, seed=seed + 1), ms(9), 0.8)
    return y + burst(n, seed + 2, 5000, 1.5, 0.002) * 0.6


@_f("snd.foley.pen_click", ["anchor:crest", "size:xs"], "retractable pen click: press + release", 412, use=("talking_head", "ad"), pairs=("cut", "caption"))
def pen_click(seed):
    n = sec(0.16)
    y = burst(n, seed, 3800, 2.0, 0.0025) * 1.4
    add_at(y, burst(sec(0.05), seed + 1, 4600, 2.0, 0.002), ms(75), 0.8)
    return y


@_f("snd.foley.stamp", ["anchor:crest", "size:s", "mood:comic"], "rubber stamp on paper: dull thud + paper slap", 413, tier=2, use=("ad", "mime", "talking_head"), pairs=("scalePunch", "hardCut"))
def stamp(seed):
    n = sec(0.35)
    return thump(n, 150, 0.04) + burst(n, seed, 1100, 0.9, 0.012) * 1.1 + burst(n, seed + 1, 4500, 1.0, 0.006) * 0.5


@_f("snd.foley.zipper", ["anchor:noise", "size:s"], "zipper pull: tooth-click train speeding up then easing", 414, use=("short_film", "ad"))
def zipper(seed):
    n = sec(0.55)
    u = np.linspace(0, 1, n)
    rate = 120 + 260 * np.sin(np.pi * u)
    ph = np.cumsum(rate / dsp.SR)
    ticks = np.diff(np.floor(ph), prepend=0.0)
    y = svf(ticks, 3200, 3.0, "bp") * 5 + svf(white(n, seed), 2500, 1.0, "bp") * 0.15
    return y * dsp.env_bell(n, 0.5, 0.6, 0.8)


@_f("snd.foley.scissors", ["anchor:crest", "size:s"], "scissors: two snips (blade scrape + close click)", 415, use=("ad", "talking_head"), pairs=("cut", "maskReveal"))
def scissors(seed):
    y = np.zeros(sec(0.5))
    for k in range(2):
        m = sec(0.12)
        tt = t_of(m)
        scr = svf(white(m, seed + k), dsp.expo(2500, 6500, tt / 0.12), 4.0, "bp") * dsp.env_bell(m, 0.8, 1.5, 3.0) * 0.6
        add_at(y, scr, ms(220 * k))
        add_at(y, burst(sec(0.04), seed + 5 + k, 4200, 2.5, 0.002) * 1.5, ms(220 * k + 110))
    return y


@_f("snd.foley.tape_tear", ["anchor:noise", "size:s"], "packing tape ripped off the roll: dense crackle", 416, use=("ad", "talking_head"), pairs=("cut", "maskReveal"))
def tape_tear(seed):
    n = sec(0.6)
    y = crunch(n, seed, 4000, 1500, 7000, 0.55)
    return y * dsp.env_bell(n, 0.75, 0.8, 3.0)


@_f("snd.foley.paper_tear", ["anchor:noise", "size:s"], "paper torn in one pull: fibrous rip", 417, use=("ad", "short_film"), pairs=("maskReveal", "cut"))
def paper_tear(seed):
    n = sec(0.5)
    y = crunch(n, seed, 2500, 700, 5000, 0.45) + svf(white(n, seed + 1), 1800, 0.8, "bp") * 0.15
    return y * dsp.env_bell(n, 0.4, 0.8, 1.5)


@_f("snd.foley.book_thud", ["anchor:crest", "size:s"], "book dropped flat on a desk: low thud + paper slap", 418, tier=2, pairs=("hardCut", "smash"))
def book_thud(seed):
    n = sec(0.45)
    return thump(n, 120, 0.05) * 1.1 + burst(n, seed, 900, 0.8, 0.015) + burst(n, seed + 1, 3500, 1.0, 0.008) * 0.6


@_f("snd.foley.laptop_close", ["anchor:crest", "size:s"], "laptop lid close: hinge friction, soft thud, magnet click", 419, use=("talking_head", "ad", "short_film"), pairs=("dipToBlack", "hardCut"))
def laptop_close(seed):
    y = np.zeros(sec(0.7))
    add_at(y, stick_slip(sec(0.3), seed, 40, 30, 1200, 5) * dsp.env_bell(sec(0.3), 0.5, 2, 2) * 0.25, 0)
    add_at(y, thump(sec(0.25), 170, 0.025) + burst(sec(0.25), seed + 1, 1600, 1.0, 0.006), ms(330))
    add_at(y, burst(sec(0.05), seed + 2, 3600, 2.0, 0.002) * 0.6, ms(345))
    return y
