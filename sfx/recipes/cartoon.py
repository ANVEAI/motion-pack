"""Cartoon motion sounds. Rule: pitch follows motion (up = rising/forward, down = falling), wobble marks elasticity, one sound per action beat (mickey-mousing).
Used by the mime-style wordless character spots."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, rng, add_at, expo, note_hz
from mpaudio.registry import snd


def boing_sig(f0=170.0, A=0.55, tau_a=0.28, n=None, seed=1, start_glide=None):
    n = n or sec(0.8)
    t = t_of(n)
    rate = np.interp(t, [0, 0.7], [12, 5])
    phi = np.cumsum(dsp.TWO_PI * rate / SR)
    f = f0 * (1 + A * np.exp(-t / tau_a) * np.sin(phi))
    if start_glide:
        a, b, d = start_glide
        g = np.where(t < d, expo(a, b, t / d) / b, 1.0)
        f = f * g
    ph = dsp.phase(f)
    y = np.sin(ph) + 0.35 * np.sin(2 * ph)
    y = svf(y, np.clip(f * 4.5, 200, 9000), 2.0, "lp")
    return y * env_ad(t, 0.003, 0.30)


@snd("snd.cartoon.boing", "cartoon", ["family:cartoon", "tier:2", "anchor:crest", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime", "ad"], pairs=["smash", "punchIn", "cut"], desc="boing: wobbling pitch, decaying", tonal=True, seed=110)
def boing(seed):
    return boing_sig(170.0, seed=seed)


@snd("snd.cartoon.boing_hi", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:comic", "size:s"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="smaller, higher boing for small hops", tonal=True, seed=111)
def boing_hi(seed):
    return boing_sig(300.0, 0.45, 0.2, sec(0.55), seed)


@snd("snd.cartoon.sproing", "cartoon", ["family:cartoon", "tier:2", "anchor:crest", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime"], pairs=["cut", "punchIn"], desc="sproing: upward start then wobble", tonal=True, seed=112)
def sproing(seed):
    return boing_sig(330.0, 0.5, 0.3, sec(0.9), seed, start_glide=(110.0, 330.0, 0.08))


@snd("snd.cartoon.spring", "cartoon", ["family:cartoon", "tier:3", "anchor:noise", "tonal:yes", "mood:comic", "size:m"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="metallic spring: low Karplus-Strong with swept comb", tonal=True, seed=113)
def spring(seed):
    n = sec(0.8)
    y = dsp.ks(78.0, n, seed, g=0.9992, damp=0.55)
    d = (1.0 + 3.0 * np.linspace(0, 1, n)) * SR / 1000.0
    idx = np.arange(n) - d
    comb = np.interp(idx, np.arange(n), y)
    return (y + 0.8 * comb) * env_ad(t_of(n), 0.001, 0.35)


@snd("snd.cartoon.squeak", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:comic", "size:xs"], tier=3, use=["mime"], pairs=["cut"], desc="rubber squeak: 1.4 to 2.1 kHz glide with vibrato", tonal=True, seed=114)
def squeak(seed, a=1400.0, b=2100.0):
    n = sec(0.16)
    t = t_of(n)
    f = expo(a, b, t / 0.07) * (1 + 0.06 * np.sin(dsp.TWO_PI * 55 * t))
    ph = dsp.phase(f)
    y = np.sin(ph) + 0.25 * np.sin(3 * ph)
    return svf(y, 2800, 3.0, "bp") * env_ad(t, 0.004, 0.05) * 3.0


@snd("snd.cartoon.squeeze_toy", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:comic", "size:xs"], tier=3, use=["mime"], pairs=["cut"], desc="squeeze toy: squeak then drop on release", tonal=True, seed=115)
def squeeze(seed):
    n = sec(0.22)
    y = np.zeros(n)
    add_at(y, squeak(seed)[:sec(0.1)], 0, 1.0)
    add_at(y, squeak(seed + 1, 2100.0, 1500.0)[:sec(0.1)], dsp.ms(100), 0.7)
    return y


def whistle(f0, f1, dur, seed, vib=True, breath=-22):
    n = sec(dur)
    t = t_of(n)
    f = expo(f0, f1, t / dur)
    if vib:
        vd = 18.0 * np.minimum(t / 0.2, 1.0)
        f = f * 2 ** (vd / 1200 * np.sin(dsp.TWO_PI * 5.5 * t))
    y = np.sin(dsp.phase(f))
    y += dsp.hp(white(n, seed), 4000) * db(breath) * 2
    return y * env_ad(t, 0.02, dur * 0.8) * np.where(t > dur - 0.03, np.cos(np.clip((t - (dur - 0.03)) / 0.03, 0, 1) * np.pi / 2), 1)


@snd("snd.cartoon.slide_whistle_up", "cartoon", ["family:cartoon", "tier:2", "anchor:scatter", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime", "ad"], pairs=["cut"], desc="slide whistle up 400 to 1800 Hz (hop, rise)", tonal=True, seed=116)
def whistle_up(seed):
    return whistle(400.0, 1800.0, 0.6, seed)


@snd("snd.cartoon.slide_whistle_down", "cartoon", ["family:cartoon", "tier:2", "anchor:scatter", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime", "ad"], pairs=["cut"], desc="slide whistle down 1800 to 300 Hz (fall)", tonal=True, seed=117)
def whistle_down(seed):
    return whistle(1800.0, 300.0, 0.7, seed)


@snd("snd.cartoon.skid", "cartoon", ["family:cartoon", "tier:3", "anchor:noise", "tonal:no", "mood:comic", "size:m"], tier=3, use=["mime", "ad"], pairs=["whip"], desc="shoe / tyre skid", seed=118)
def skid(seed):
    n = sec(0.45)
    t = t_of(n)
    f = 700 * (1 + 0.08 * np.sin(dsp.TWO_PI * 30 * t))
    y = dsp.saw_n(f, n) * 0.7 + white(n, seed) * 0.3
    return svf(y, expo(1600, 800, t / 0.4), 3.0, "bp") * env_ad(t, 0.01, 0.2) * 3.0


@snd("snd.cartoon.slip", "cartoon", ["family:cartoon", "tier:2", "anchor:scatter", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime"], pairs=["smash", "cut"], desc="slip and fall: whistle down 1500 to 200 + thud", tonal=True, seed=119)
def slip(seed):
    n = sec(0.8)
    y = np.zeros(n)
    add_at(y, whistle(1500.0, 200.0, 0.5, seed), 0, 0.9)
    m = sec(0.2)
    t = t_of(m)
    add_at(y, np.sin(dsp.phase(70 + 40 * np.exp(-t / 0.03))) * env_ad(t, 0.002, 0.07), sec(0.5), 1.1)
    return y


def _steps(seed, notes, spacing, dur, voice):
    n = sec(spacing * len(notes) + 0.3)
    y = np.zeros((n, 2))
    for k, m in enumerate(notes):
        v = voice(note_hz(m), dur, seed + k)
        add_at(y, dsp.pan_st(v, 0.2 * (1 if k % 2 else -1)), sec(spacing * k), 1.0 - 0.04 * k)
    return y


@snd("snd.cartoon.tiptoe", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:comic", "size:m", "sneaky"], tier=3, use=["mime", "short_film"], pairs=["cut"], desc="sneaky pizzicato tiptoe, six steps", tonal=True, seed=120)
def tiptoe(seed):
    return _steps(seed, [57, 58, 57, 56, 57, 58], 0.2, 0.09, lambda f, d, s: I.pizz(f, d, s))


@snd("snd.cartoon.walk_bounce", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:playful", "size:m"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="marimba footfalls on an A pentatonic walk", tonal=True, seed=121)
def walk_bounce(seed):
    return _steps(seed, [69, 71, 73, 76, 73, 71], 0.18, 0.07, lambda f, d, s: I.marimba(f, d, 1.0, s))


@snd("snd.cartoon.xylo_up", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:playful", "size:s"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="quick xylophone run up the A major scale", tonal=True, seed=122)
def xylo_up(seed):
    return _steps(seed, [69, 71, 73, 74, 76, 78, 80, 81], 0.05, 0.1, lambda f, d, s: I.marimba(f * 2, d, 1.0, s))


@snd("snd.cartoon.xylo_down", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:playful", "size:s"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="quick xylophone run down the A major scale", tonal=True, seed=123)
def xylo_down(seed):
    return _steps(seed, [81, 80, 78, 76, 74, 73, 71, 69], 0.05, 0.1, lambda f, d, s: I.marimba(f * 2, d, 1.0, s))


@snd("snd.cartoon.bonk", "cartoon", ["family:cartoon", "tier:2", "anchor:noise", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime", "ad"], pairs=["smash", "cut"], desc="bonk on the head: wood block + thud + star ring", tonal=True, seed=124)
def bonk(seed):
    n = sec(0.7)
    y = np.zeros(n)
    add_at(y, dsp.modal(520.0, (1, 2.3, 4.1), (1, .5, .3), (0.09, 0.04, 0.02), sec(0.3), seed=seed) * 1.2, 0, 1.0)
    m = sec(0.2)
    t = t_of(m)
    add_at(y, np.sin(dsp.phase(60 + 50 * np.exp(-t / 0.02))) * env_ad(t, 0.002, 0.06), 0, 0.9)
    add_at(y, I.bell(1318.5, 0.4, 0.3, 3.0), dsp.ms(120), 0.35)
    return y


@snd("snd.cartoon.pop_eye", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:comic", "size:s"], tier=3, use=["mime"], pairs=["punchIn", "cut"], desc="take / eye bulge: fast chirp + boing", tonal=True, seed=125)
def pop_eye(seed):
    n = sec(0.45)
    y = np.zeros(n)
    m = sec(0.1)
    t = t_of(m)
    add_at(y, np.sin(dsp.phase(expo(300, 1500, t / 0.035))) * env_ad(t, 0.001, 0.03), 0, 0.9)
    add_at(y, boing_sig(260.0, 0.4, 0.15, sec(0.4), seed), dsp.ms(30), 0.7)
    return y


@snd("snd.cartoon.gulp", "cartoon", ["family:cartoon", "tier:3", "anchor:scatter", "tonal:yes", "mood:comic", "size:s"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="comic gulp: pitch-down blip + bubble", tonal=True, seed=126)
def gulp(seed):
    from .liquid import bubble_sig
    n = sec(0.3)
    y = np.zeros(n)
    m = sec(0.1)
    t = t_of(m)
    add_at(y, np.sin(dsp.phase(expo(900, 300, t / 0.08))) * env_ad(t, 0.002, 0.03), 0, 0.9)
    add_at(y, bubble_sig(3.0, seed), dsp.ms(70), 0.6)
    return y


@snd("snd.cartoon.zip_run", "cartoon", ["family:cartoon", "tier:2", "anchor:scatter", "tonal:yes", "mood:comic", "size:m"], tier=2, use=["mime"], pairs=["whip", "cut"], desc="scurry: rapid rising steps + swish + stop whistle", tonal=True, seed=127)
def zip_run(seed):
    n = sec(0.9)
    y = np.zeros(n)
    for k in range(10):
        m = sec(0.03)
        t = t_of(m)
        add_at(y, np.sin(dsp.TWO_PI * 700 * 2 ** (k / 8) * t) * env_ad(t, 0.0005, 0.008), sec(0.04 * k), 0.7)
    sw = svf(white(sec(0.4), seed), np.linspace(3000, 900, sec(0.4)), 1.2, "bp") * dsp.env_bell(sec(0.4), 0.3, 2, 2) * 2
    add_at(y, sw, 0, 0.6)
    add_at(y, whistle(1100.0, 1250.0, 0.12, seed, False), sec(0.55), 0.6)
    add_at(y, whistle(1250.0, 1500.0, 0.15, seed, False), sec(0.66), 0.6)
    return y


@snd("snd.cartoon.poof", "cartoon", ["family:cartoon", "tier:2", "anchor:noise", "tonal:no", "mood:comic", "size:m"], tier=2, use=["mime", "ad"], pairs=["smoke", "dissolve", "cut"], desc="puff of smoke: noise bell + sub + sparkle tail", seed=128)
def poof(seed):
    n = sec(1.0)
    t = t_of(n)
    y = dsp.lp(white(n, seed), 2000) * env_ad(t, 0.01, 0.07) * 1.6
    y += np.sin(dsp.phase(expo(90, 50, t / 0.2))) * env_ad(t, 0.004, 0.1) * 0.7
    from .materials import sparkle
    add_at(y, sparkle(seed)[:sec(0.5)].mean(axis=1), dsp.ms(100), 0.4)
    return y


@snd("snd.cartoon.sad_brass", "cartoon", ["family:cartoon", "tier:2", "anchor:scatter", "tonal:yes", "mood:comic", "size:l"], tier=2, use=["mime", "ad"], pairs=["freeze", "cut"], desc="wah-wah-wah-waaah fail trombone (own synthesis)", tonal=True, seed=129)
def sad_brass(seed):
    n = sec(1.9)
    y = np.zeros(n)
    notes = [58, 57, 56, 55]
    durs = [0.28, 0.28, 0.28, 0.9]
    t0 = 0.0
    for k, (m, d) in enumerate(zip(notes, durs)):
        nn = sec(d + 0.05)
        t = t_of(nn)
        f = np.full(nn, note_hz(m))
        if k == 3:
            f = f * 2 ** (-1.0 / 12 * np.clip((t - 0.2) / 0.6, 0, 1)) * (1 + 0.012 * np.sin(dsp.TWO_PI * 5 * t) * np.clip(t / 0.3, 0, 1))
        v = dsp.saw_n(f, nn)
        v = svf(v, 2200 * np.exp(-t / 0.2) + 600, 1.2, "lp")
        wah = 700 + 700 * np.sin(np.pi * np.clip(t / d, 0, 1))
        v = svf(v, wah, 2.5, "bp") * 2.0 + v * 0.3
        v *= env_ad(t, 0.02, d * 0.9)
        add_at(y, v, sec(t0), 1.0)
        t0 += d
    return dsp.reverb(y, "room", 0.1)


@snd("snd.cartoon.tada", "cartoon", ["family:cartoon", "tier:2", "anchor:crest", "tonal:yes", "mood:playful", "size:m"], tier=2, use=["mime", "ad", "launch"], pairs=["reveal", "cut"], desc="ta-da brass-ish fanfare on the A triad", tonal=True, seed=130)
def tada(seed):
    n = sec(1.2)
    y = np.zeros(n)
    add_at(y, I.stab([note_hz(66), note_hz(69), note_hz(73)], 0.18, seed=seed, fc0=3200, fc1=1200, tau=0.15), 0, 0.7)
    add_at(y, I.stab([note_hz(69), note_hz(73), note_hz(76)], 0.8, seed=seed + 1, fc0=3600, fc1=1000, tau=0.3), dsp.ms(190), 1.0)
    cym = svf(white(sec(0.5), seed), 7000, 0.7, "hp") * env_ad(t_of(sec(0.5)), 0.001, 0.2)
    add_at(y, cym, dsp.ms(190), 0.3)
    return dsp.reverb(y, "room", 0.12)


@snd("snd.cartoon.record_scratch", "cartoon", ["family:cartoon", "tier:2", "anchor:noise", "tonal:no", "mood:comic", "size:m"], tier=2, use=["mime", "talking_head", "ad"], pairs=["freeze", "cut"], desc="record scratch / freeze: playback-rate jitter on a held chord", seed=131)
def record_scratch(seed):
    from .risers import varispeed, held_chord
    n = sec(0.45)
    src = held_chord(sec(1.0), seed, 57)
    r = rng(seed)
    rate = 1.0 + np.cumsum(r.normal(0, 0.02, n))
    rate = np.clip(rate, -1.5, 1.8)
    rate = np.convolve(rate, np.ones(60) / 60, "same")
    u = t_of(n)
    rate = rate * np.clip(1 - u / 0.4, 0.0, 1)
    y = varispeed(src, np.abs(rate))
    y = y * np.clip(1 - u / 0.45, 0, 1)
    y += dsp.hp(white(n, seed), 3000) * env_ad(u, 0.001, 0.08) * 0.5
    return y * 2.0


@snd("snd.cartoon.rimshot", "cartoon", ["family:cartoon", "tier:2", "anchor:noise", "tonal:no", "mood:comic", "size:m"], tier=2, use=["mime", "ad", "talking_head"], pairs=["cut"], desc="ba-dum-tss rimshot", seed=132)
def rimshot(seed):
    n = sec(1.0)
    y = np.zeros(n)
    add_at(y, I.snare(seed), 0, 0.9)
    add_at(y, I.tom(seed, 190.0), dsp.ms(140), 0.8)
    add_at(y, dsp.lp(I.hat(seed, True, 1.0, 0.8), 12000), dsp.ms(280), 0.8)
    return y


@snd("snd.cartoon.bike_horn", "cartoon", ["family:cartoon", "tier:3", "anchor:scatter", "tonal:yes", "mood:comic", "size:s"], tier=3, use=["mime", "ad"], pairs=["cut"], desc="clown / bike horn honk", tonal=True, seed=133)
def bike_horn(seed):
    n = sec(0.3)
    t = t_of(n)
    f = 285 * (1 + 0.05 * np.exp(-t / 0.02))
    y = dsp.pulse_n(f, n, 0.4) + 0.1 * white(n, seed)
    y = svf(y, 1500, 2.0, "bp") * 2.0 + svf(y, 600, 1.0, "lp")
    return y * env_ad(t, 0.01, 0.25) * np.where(t > 0.26, np.cos(np.clip((t - 0.26) / 0.04, 0, 1) * np.pi / 2), 1)


@snd("snd.cartoon.raspberry", "cartoon", ["family:cartoon", "tier:3", "anchor:scatter", "tonal:no", "mood:comic", "size:s"], tier=3, use=["mime"], pairs=["cut"], desc="blown raspberry: noise-AM'd saw through a low-pass", seed=134)
def raspberry(seed):
    n = sec(0.55)
    t = t_of(n)
    am = 0.5 + 0.5 * np.sign(np.sin(dsp.TWO_PI * (28 - 8 * t) * t + 0.3 * white(n, seed)))
    y = dsp.saw_n(110 * (1 - 0.1 * t), n) * am
    return svf(y, 1100, 1.2, "lp") * env_ad(t, 0.02, 0.3) * 1.5


@snd("snd.cartoon.cuckoo", "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "tonal:yes", "mood:comic", "size:s"], tier=3, use=["mime", "short_film"], pairs=["cut"], desc="cuckoo: falling minor third, twice", tonal=True, seed=135)
def cuckoo(seed):
    n = sec(1.0)
    y = np.zeros(n)
    for k in range(2):
        for j, f in enumerate((880.0, 740.0)):
            m = sec(0.2)
            t = t_of(m)
            v = (np.sin(dsp.TWO_PI * f * t) + 0.15 * np.sin(dsp.TWO_PI * 2 * f * t)) * env_ad(t, 0.01, 0.08)
            add_at(y, v, sec(0.5 * k + 0.17 * j), 1.0)
    return y
