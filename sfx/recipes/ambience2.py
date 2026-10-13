"""Expansion ambience: 8.0 s seamless loops (same circular-synthesis rules as ambience.py: integer cycles per loop, events wrap around the loop end).
Weather, water, fire, birds, train, an Indian street (synthetic horns and a two-stroke putter only), monsoon, indoor crowd murmur and a tanpura drone."""
import numpy as np
from mpaudio import dsp, indian as IN
from mpaudio.dsp import SR, sec, ms, t_of, env_ad, svf, white, pink, brown, rng
from .ambience import L, XF, add_wrap, make_loop, cyc, stereo_noise, _amb, _babble_loop


def _norm(x):
    return x / (np.std(x) + 1e-12)


def _drops(seed, rate, lo, hi, gain_mu=-1.5):
    out = np.zeros((L, 2))
    for ch in range(2):
        r = rng(seed + ch)
        bank = [dsp.bp(white(160, seed + 90 + j), r.uniform(lo, lo * 2), r.uniform(hi * 0.8, hi), 1)[:96] * np.exp(-np.arange(96) / 22.0) for j in range(32)]
        for i in dsp.grain_times(L, lambda t: np.full_like(t, rate), seed + 20 + ch):
            add_wrap(out[:, ch], bank[r.integers(0, 32)], i, np.exp(r.normal(gain_mu, 0.6)))
    return out


def _bed(seed, lo, hi, colour="pink"):
    st = stereo_noise(seed, colour)
    return np.stack([_norm(dsp.fft_filter(st[:, c], lo, hi, 2)) for c in range(2)], 1)


@_amb("snd.amb.rain_light", ["mood:calm", "use:short_film"], "light rain: sparse drops on a soft hiss", 500, use=["short_film", "talking_head"], pairs=["cut", "dissolve"])
def rain_light(seed):
    return _bed(seed, 400, 7000) * 0.25 + _drops(seed, 350, 2500, 9000, -1.2)


@_amb("snd.amb.rain_heavy", ["mood:tense", "use:short_film"], "heavy rain: dense drops, roaring wash, gutter rumble", 501, use=["short_film"], pairs=["cut", "dissolve"])
def rain_heavy(seed):
    return _bed(seed, 150, 9000) * 0.6 + _drops(seed, 4000, 1500, 8000, -2.0) + _bed(seed + 7, 40, 250, "brown") * 0.2


@_amb("snd.amb.thunder", ["mood:tense", "use:short_film"], "distant thunder: low rumble bed with one rolling clap (wraps the loop)", 502, use=["short_film"], pairs=["cut", "flash"])
def thunder(seed):
    t = t_of(L)
    bed = _bed(seed, 25, 180, "brown") * (0.5 + 0.2 * np.sin(dsp.TWO_PI * 0.25 * t))[:, None]
    m = sec(4.5)
    tt = t_of(m)
    clap = dsp.lp(brown(m, seed + 3), 900) * (env_ad(tt, 0.02, 0.4) + 0.6 * env_ad(tt - 0.5, 0.2, 1.2) + 0.3 * env_ad(tt - 1.4, 0.3, 1.3))
    clap = _norm(dsp.fft_filter(clap, 30, 900, 2)) * 1.2
    out = bed.copy()
    for ch in range(2):
        add_wrap(out[:, ch], clap * (0.9 if ch else 1.0), sec(2.0) + ch * ms(7))
    return out


@_amb("snd.amb.stream", ["mood:calm", "use:short_film"], "stream: babbling bubbles over a filtered water bed", 503, use=["short_film", "talking_head"], pairs=["cut", "dissolve"])
def stream(seed):
    from .liquid import bubble_sig
    out = _bed(seed, 300, 4000) * 0.3
    for ch in range(2):
        r = rng(seed + 40 + ch)
        for i in dsp.grain_times(L, lambda t: np.full_like(t, 90.0), seed + 50 + ch):
            add_wrap(out[:, ch], bubble_sig(r.uniform(1.0, 5.0), seed + int(i), rise=0.3, amp=0.4), i, np.exp(r.normal(-0.8, 0.5)))
    return out


@_amb("snd.amb.fire_crackle", ["mood:warm", "use:short_film"], "campfire / chulha: low roar with random wood crackles and pops", 504, use=["short_film", "ad"], pairs=["cut"])
def fire(seed):
    t = t_of(L)
    out = _bed(seed, 60, 600, "brown") * (0.35 + 0.08 * np.sin(dsp.TWO_PI * 0.5 * t))[:, None]
    for ch in range(2):
        r = rng(seed + 60 + ch)
        for i in dsp.grain_times(L, lambda tt: np.full_like(tt, 25.0), seed + 70 + ch):
            m = int(r.integers(ms(1), ms(6)))
            g = svf(white(m, seed + int(i)), r.uniform(1500, 6000), 1.2, "bp") * np.exp(-np.arange(m) / (m * 0.3))
            add_wrap(out[:, ch], g * 6, i, np.exp(r.normal(-0.5, 0.7)))
    return out


def _chirp(seed, f0, f1, dur, fm_hz=0.0, fm_dep=0.0):
    n = sec(dur)
    t = t_of(n)
    f = dsp.expo(f0, f1, t / dur) * (1 + fm_dep * np.sin(dsp.TWO_PI * fm_hz * t))
    return np.sin(dsp.phase(f)) * dsp.env_bell(n, 0.3, 1.5, 2.0)


@_amb("snd.amb.birds_morning", ["mood:calm", "use:short_film"], "morning birds: three FM-chirp species calling over light air", 505, use=["short_film", "ad", "talking_head"], pairs=["cut", "dissolve"])
def birds(seed):
    out = _bed(seed, 1500, 8000) * 0.04
    r = rng(seed)
    species = [(3200, 4200, 0.08, 40, 0.05, 3), (2400, 1800, 0.18, 12, 0.08, 2), (5000, 5600, 0.04, 80, 0.03, 6)]
    for s, (f0, f1, d, fmh, fmd, reps) in enumerate(species):
        for call in range(4 + s):
            start = r.uniform(0, 8.0)
            pan = r.uniform(-0.9, 0.9)
            for k in range(reps):
                c = _chirp(seed + 10 * s + k, f0 * r.uniform(0.95, 1.05), f1, d, fmh, fmd) * 0.3
                st = dsp.pan_st(c, pan)
                for ch in range(2):
                    add_wrap(out[:, ch], st[:, ch], sec(start + k * d * 1.6), np.exp(r.normal(-0.3, 0.3)))
    return out


@_amb("snd.amb.train_chug", ["mood:warm", "use:short_film"], "train interior: wheel-joint clacks in pairs, chug, low rumble", 506, use=["short_film", "ad"], pairs=["cut"])
def train(seed):
    t = t_of(L)
    out = _bed(seed, 30, 300, "brown") * 0.5
    chug = _norm(svf(white(L, seed + 2), 500, 1.0, "bp")) * (0.5 + 0.5 * np.sin(dsp.TWO_PI * 2.0 * t) ** 8) * 0.25
    out += np.stack([chug, chug], 1)
    for k in range(4):                    # clack-clack every 2.0 s (integer per loop)
        for d in (0.0, 0.14):
            m = sec(0.12)
            tt = t_of(m)
            v = (np.sin(dsp.TWO_PI * 160 * tt) * env_ad(tt, 0.001, 0.02) + svf(white(m, seed + k), 1800, 1.0, "bp") * env_ad(tt, 0.0002, 0.008)) * 0.9
            for ch in range(2):
                add_wrap(out[:, ch], v, sec(k * 2.0 + d) + ch * ms(3))
    return out


@_amb("snd.amb.indian_street_horns", ["mood:hype", "use:short_film", "region:in"], "Indian street: traffic rumble, two-stroke putter, scattered synthetic horn beeps (no recordings)", 507,
      use=["short_film", "ad", "mime"], pairs=["cut"])
def street(seed):
    t = t_of(L)
    out = _bed(seed, 30, 400, "brown") * 0.6 + _bed(seed + 1, 1500, 4500) * 0.12
    put = np.diff(np.floor(np.cumsum(np.full(L, cyc(26.0)) / SR)), prepend=0.0)
    put = svf(put, 350, 3.0, "bp") * 4 * (0.6 + 0.4 * np.sin(dsp.TWO_PI * 0.125 * t))
    out += dsp.pan_st(put, -0.4) * 0.5
    r = rng(seed)
    for k in range(9):
        f = r.choice([380, 420, 470, 520, 610, 700])
        d = r.choice([0.12, 0.2, 0.35])
        m = sec(d)
        tt = t_of(m)
        h = dsp.lp(dsp.pulse_n(np.full(m, f), m, 0.4) + dsp.pulse_n(np.full(m, f * 1.26), m, 0.4), 2200) * np.minimum(tt / 0.01, 1) * np.minimum((d - tt) / 0.015, 1)
        st = dsp.pan_st(h, r.uniform(-0.9, 0.9)) * 0.12 * np.exp(r.normal(0, 0.4))
        s0 = sec(r.uniform(0, 8.0))
        for rep in range(int(r.integers(1, 3))):
            for ch in range(2):
                add_wrap(out[:, ch], st[:, ch], s0 + rep * sec(d + 0.08))
    return out


@_amb("snd.amb.monsoon", ["mood:tense", "use:short_film", "region:in"], "monsoon: heavy rain, wind gusts, distant thunder roll", 508, use=["short_film", "ad"], pairs=["cut", "dissolve"])
def monsoon(seed):
    t = t_of(L)
    out = rain_heavy(seed) * 0.8
    wind = np.stack([svf(pink(L, seed + 11 + c), 500 + 250 * np.sin(dsp.TWO_PI * 0.125 * t + c), 1.3, "bp") for c in range(2)], 1)
    out += _norm(wind) * (0.3 + 0.25 * np.sin(dsp.TWO_PI * 0.25 * t + 1.0) ** 2)[:, None]
    out += thunder(seed + 5) * 0.5
    return out


@_amb("snd.amb.crowd_murmur", ["mood:warm", "use:short_film"], "indoor crowd murmur bed (office party / cafe): 16 word-free babble voices, low-passed, roomy", 509,
      use=["short_film", "ad", "mime"], pairs=["cut"])
def murmur(seed):
    r = rng(seed)
    out = np.zeros((L, 2))
    for k in range(16):
        b = _babble_loop(seed + 5 * k, ["adult", "female", "big", "adult"][k % 4], 1.0)
        out += dsp.pan_st(dsp.fft_filter(b, None, 1400, 2), r.uniform(-0.9, 0.9)) * 0.25
    tail = dsp.reverb(out, "room", 0.35, seed)
    loop = tail[:L].copy()
    loop[:len(tail) - L] += tail[L:L + min(len(tail) - L, L)]
    return loop


@_amb("snd.amb.tanpura_drone", ["mood:calm", "use:short_film", "region:in", "key:A", "instrument:tanpura"], "tanpura drone: Pa-Sa-Sa-Sa(kharaj) cycle with jivari buzz, two cycles per 8.0 s loop", 510,
      use=["short_film", "talking_head", "ad"], pairs=["cut", "dissolve"])
def tanpura(seed):
    a = IN.tanpura_cycle(L, seed, 110.0, 0.0, 4.0)
    b = IN.tanpura_cycle(L, seed + 10, 110.0, 4.0, 4.0)
    return np.stack([a + 0.85 * b, 0.85 * a + b], 1)
