"""Word-free character voices (mime-style wordless reactions): glottal source + formant resonators. NO speech, NO TTS, no intelligible words.
Contour carries meaning: rising = question / surprise, falling = statement / resignation, fast flutter = excitement.
Formant values: commonly reproduced adult male averages (Peterson & Barney 1952), scaled per character size; starting values, tuned by ear."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, rng, add_at, expo
from mpaudio.registry import snd

VOWELS = {"a": (730, 1090, 2440), "e": (530, 1840, 2480), "i": (270, 2290, 3010), "o": (570, 840, 2410), "u": (300, 870, 2240)}
CHAR = {"big": (0.85, 85.0), "adult": (1.0, 120.0), "female": (1.17, 210.0), "child": (1.35, 300.0), "tiny": (1.6, 520.0)}
MOOD = {"calm": (4.5, 1.0, 2.0), "normal": (5.8, 1.8, 3.5), "excited": (7.5, 2.5, 5.0)}


def _smooth(a, ms_=25.0):
    k = max(3, dsp.ms(ms_))
    w = np.hanning(k)
    w /= w.sum()
    p = np.pad(a, (k, k), mode="edge")
    from scipy.signal import fftconvolve
    return fftconvolve(p, w, "same")[k:-k]


def babble(character="adult", mood="normal", duration=1.2, seed=1, contour="statement", vowels="aeiou", nsyl=None, vib=True, breath=0.05, rate=None):
    k_f, base = CHAR[character]
    rate0, step, clamp = MOOD[mood]
    rate = rate or rate0
    r = rng(seed)
    n = sec(duration)
    f0 = np.full(n, base)
    F = [np.full(n, v * k_f) for v in VOWELS["a"]]
    env = np.zeros(n)
    cons = np.zeros(n)
    t = 0.02
    off = 0.0
    i = 0
    words = r.integers(2, 5)
    while t < duration - 0.08 and (nsyl is None or i < nsyl):
        d = float(r.uniform(0.6, 0.95) / rate)
        a, b = sec(t), min(n, sec(t + d))
        off = float(np.clip(off + r.normal(0, step), -clamp, clamp))
        u0 = a / n
        trend = {"statement": -3.0 * u0, "question": (4.0 * np.clip((u0 - 0.7) / 0.3, 0, 1)), "surprise": 5.0 * (1 - u0) * 1.0, "flat": 0.0}[contour]
        f0[a:] = base * 2 ** ((off + trend) / 12)
        vw = VOWELS[str(r.choice(list(vowels)))]
        for j in range(3):
            F[j][a:] = vw[j] * k_f
        env[a:b] = env_ad(np.arange(b - a) / SR, 0.008, 0.12 + 0.2 * d)[:b - a] * np.where(np.arange(b - a) / SR > d * 0.85, np.cos(np.clip((np.arange(b - a) / SR - d * 0.85) / (d * 0.15), 0, 1) * np.pi / 2), 1.0)
        if r.random() < 0.55:
            kind = r.choice(["p", "k", "t", "s"])
            m = sec(0.012 if kind != "s" else 0.06)
            fc = {"p": 800, "k": 2000, "t": 4000, "s": 5500}[kind]
            cb = svf(white(m, seed + i), fc, 1.2, "bp" if kind != "s" else "hp") * np.hanning(m)
            add_at(cons, cb, max(0, a - m // 2), 1.2 if kind != "s" else 0.8)
        i += 1
        t += d + (float(r.uniform(0.08, 0.16)) if (i % words == 0) else 0.02)
        if i % words == 0:
            words = r.integers(2, 5)
    f0 = _smooth(f0, 20)
    F = [_smooth(f, 30) for f in F]
    if vib:
        f0 = f0 * (1 + 0.0115 * np.sin(dsp.TWO_PI * 5.5 * t_of(n)) * np.clip(_smooth(env, 80) * 3 - 0.5, 0, 1))
    y = dsp.formant_voice(f0, F, n, seed, breath=breath)
    y = y / (np.max(np.abs(y)) + 1e-9) * env + cons * 0.5
    y = dsp.lp(y, 8000)
    return y


def vowel_note(vowel, f0_curve, dur, seed, k_f=1.0, breath=0.04, env_a=0.01, tau=None):
    n = sec(dur)
    t = t_of(n)
    vw = VOWELS[vowel]
    y = dsp.formant_voice(f0_curve(t), [vw[0] * k_f, vw[1] * k_f, vw[2] * k_f], n, seed, breath=breath)
    y = y / (np.max(np.abs(y)) + 1e-9)
    e = env_ad(t, env_a, tau or dur * 0.5) * np.where(t > dur - 0.04, np.cos(np.clip((t - (dur - 0.04)) / 0.04, 0, 1) * np.pi / 2), 1.0)
    return y * e


def _v(id, fn, desc, size, tags=(), seed=140):
    snd(id, "voice", ["family:voice", "tier:3", "anchor:scatter", "tonal:no", "mood:comic", size, "wordless", *tags], tier=3, use=["mime", "short_film", "ad"], pairs=["cut"], desc=desc, seed=seed)(fn)


def grunt(seed):
    return babble("big", "calm", 0.55, seed, "statement", "ao", nsyl=2)


def chirp(seed):
    n = sec(0.45)
    y = np.zeros(n)
    r = rng(seed)
    for k in range(4):
        f = 520 * 2 ** ((k * 2 + r.integers(-1, 2)) / 12)
        add_at(y, vowel_note(str(r.choice(list("ie"))), lambda t, _f=f: _f * (1 + 0.012 * np.sin(2 * np.pi * 7 * t)), 0.07, seed + k, 1.6, 0.03), sec(0.085 * k), 1.0)
    return y


def chirp_q(seed):
    n = sec(0.5)
    y = np.zeros(n)
    for k, st in enumerate((0, 1, 3, 7)):
        f = 560 * 2 ** (st / 12)
        add_at(y, vowel_note("e" if k < 3 else "i", lambda t, _f=f: _f * (1 + 0.012 * np.sin(2 * np.pi * 7 * t)), 0.09 if k < 3 else 0.14, seed + k, 1.6, 0.03), sec(0.1 * k), 1.0)
    return y


def mumble(seed):
    return babble("adult", "normal", 1.5, seed, "statement")


def mumble_child(seed):
    return babble("child", "excited", 1.2, seed, "surprise")


def oh(seed):
    return vowel_note("o", lambda t: 190 * (2 ** (4 / 12)) * 2 ** (-(7 / 12) * np.clip(t / 0.3, 0, 1)), 0.35, seed, 1.0, 0.05, 0.2)


def huh(seed):
    n = sec(0.32)
    y = np.zeros(n)
    add_at(y, vowel_note("a", lambda t: 170 * np.ones_like(t), 0.1, seed, 1.0, 0.06, 0.012, 0.06), 0, 0.9)
    add_at(y, vowel_note("a", lambda t: 170 * 2 ** (np.clip(t / 0.2, 0, 1) * 5 / 12), 0.2, seed + 1, 1.0, 0.06, 0.02, 0.1), sec(0.1), 1.0)
    return y


def hmm(seed):
    n = sec(0.3)
    t = t_of(n)
    f0 = 140 * 2 ** (np.clip(t / 0.3, 0, 1) * 2 / 12)
    y = dsp.formant_voice(f0, [250.0, 1000.0, 2300.0], n, seed, breath=0.02, gains=(1.0, 0.15, 0.1))
    y = y / (np.max(np.abs(y)) + 1e-9)
    return y * env_ad(t, 0.04, 0.15) * np.where(t > 0.26, np.cos(np.clip((t - 0.26) / 0.04, 0, 1) * np.pi / 2), 1.0)


def giggle(seed):
    n = sec(0.75)
    y = np.zeros(n)
    for k in range(8):
        f = 420 * 2 ** (-(4 * k / 7) / 12)
        add_at(y, vowel_note("i", lambda t, _f=f: _f * np.ones_like(t), 0.05, seed + k, 1.3, 0.3, 0.004, 0.02), sec(k / 14.0), 1.0 - 0.04 * k)
    return y


def gasp(seed):
    n = sec(0.4)
    t = t_of(n)
    br = svf(white(n, seed), expo(1200, 3200, t / 0.3), 1.0, "bp") * env_ad(t, 0.12, 0.12) * 2.5
    v = vowel_note("a", lambda tt: 260 * 2 ** (np.clip(tt / 0.3, 0, 1) * 3 / 12), 0.4, seed, 1.15, 0.5, 0.15, 0.1) * 0.3
    return br + v


def sigh(seed):
    n = sec(0.9)
    t = t_of(n)
    br = svf(white(n, seed), 1500, 0.8, "bp") * env_ad(t, 0.08, 0.3) * 1.2
    v = vowel_note("a", lambda tt: 200 * 2 ** (-np.clip(tt / 0.8, 0, 1) * 4 / 12), 0.9, seed, 1.0, 0.4, 0.08, 0.3) * 0.5
    return br + v


def wow(seed):
    n = sec(0.6)
    y = np.zeros(n)
    add_at(y, vowel_note("u", lambda t: 180 * 2 ** (np.clip(t / 0.2, 0, 1) * 5 / 12), 0.25, seed, 1.0, 0.03, 0.03, 0.15), 0, 1.0)
    add_at(y, vowel_note("a", lambda t: 240 * 2 ** (-np.clip(t / 0.3, 0, 1) * 4 / 12), 0.35, seed + 1, 1.0, 0.03, 0.03, 0.18), sec(0.2), 1.0)
    return y


_v("snd.voice.grunt", grunt, "big gruff 1-2 syllable grunt, falling", "size:m", ["char:big"], 140)
_v("snd.voice.chirp", chirp, "tiny creature chirp, 4 rising notes", "size:xs", ["char:tiny"], 141)
_v("snd.voice.chirp_question", chirp_q, "tiny chirp that ends on a rising question", "size:xs", ["char:tiny", "contour:question"], 142)
_v("snd.voice.mumble", mumble, "word-free adult mumble, 1.5 s statement contour", "size:l", ["char:adult"], 143)
_v("snd.voice.mumble_child", mumble_child, "word-free excited child babble, surprise contour", "size:l", ["char:child"], 144)
_v("snd.voice.oh", oh, "surprised 'oh' (vowel /o/, falling)", "size:s", ["contour:surprise"], 145)
_v("snd.voice.huh", huh, "'huh?' (vowel /a/ then rise)", "size:s", ["contour:question"], 146)
_v("snd.voice.hmm", hmm, "thinking 'hmm' (nasal hum, slight rise)", "size:s", ["contour:question"], 147)
_v("snd.voice.giggle", giggle, "stylised synth giggle: 8 /i/ bursts at 14 Hz, descending", "size:m", ["char:child"], 148)
_v("snd.voice.gasp", gasp, "gasp: breath inhale with rising vowel", "size:s", ["contour:surprise"], 149)
_v("snd.voice.sigh", sigh, "sigh: breath exhale with falling vowel", "size:m", ["contour:statement"], 150)
_v("snd.voice.wow", wow, "'wooow': /u/ rising into /a/ falling", "size:m", ["contour:surprise"], 151)
