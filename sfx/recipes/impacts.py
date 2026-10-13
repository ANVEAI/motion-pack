"""Impacts, hits, booms: tonal crest for the knock, noise for the crack, sub for weight (layers: transient 0-10 ms, body, tail)."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, brown, pink, add_at
from mpaudio.registry import snd

KEY_ROOT = 55.0  # A1 (project key A)


def _click(n, seed, fc=2500, q=1.2, dur=0.003, g=1.0):
    t = t_of(n)
    return svf(white(n, seed), fc, q, "bp") * env_ad(t, 0.0002, dur) * g * 3.0


def sub_drop(seed, f0=62.0, f1=36.0, glide=0.28, tau=0.38, length=1.2, click_g=0.5):
    n = sec(length)
    t = t_of(n)
    f = dsp.expo(f0, f1, t / glide)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.002, tau)
    return y + _click(n, seed, g=click_g)


@snd("snd.hit.sub_drop", "impact", ["family:hit", "tier:1", "anchor:crest", "tonal:yes", "size:l", "mood:cinematic", "sub"], tier=1, use=["launch", "short_film", "ad"], pairs=["dipToBlack", "flash", "cut"],
     desc="sub drop 62 to 36 Hz with a click; hero hit weight", tonal=True, seed=3)
def hit_sub_drop(seed):
    return sub_drop(seed)


@snd("snd.hit.punch", "impact", ["family:hit", "tier:3", "anchor:crest", "tonal:yes", "size:xs", "mood:tech", "zoom"], tier=3, use=["talking_head", "beat_edit", "ad"], pairs=["scalePunch", "punchIn", "cut"],
     desc="150 ms punch for zoom punch-ins and jump-cut emphasis", tonal=True, seed=4)
def hit_punch(seed):
    n = sec(0.2)
    t = t_of(n)
    f = 70 + 70 * np.exp(-t / 0.018)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.001, 0.07)
    return y + _click(n, seed, 3000, 1.2, 0.002, 0.45)


@snd("snd.hit.thud", "impact", ["family:hit", "tier:2", "anchor:crest", "tonal:yes", "size:m", "mood:warm"], tier=2, use=["ad", "launch", "short_film"], pairs=["dissolve", "flash", "hardcut"],
     desc="soft object / button weight, 350 ms", tonal=True, seed=5)
def hit_thud(seed):
    n = sec(0.45)
    t = t_of(n)
    f = 52 + 55 * np.exp(-t / 0.035)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.002, 0.11)
    y += dsp.lp(brown(n, seed), 220) * env_ad(t, 0.001, 0.06) * 1.5
    y += _click(n, seed + 1, 1400, 0.8, 0.004, 0.25)
    return y


@snd("snd.hit.soft", "impact", ["family:hit", "tier:3", "anchor:noise", "tonal:no", "size:s", "mood:warm"], tier=3, use=["talking_head", "short_film", "ad"], pairs=["dissolve", "cut"],
     desc="cushioned thump, very soft; paired with fades and match cuts", seed=6)
def hit_soft(seed):
    n = sec(0.3)
    t = t_of(n)
    y = dsp.hp(dsp.lp(brown(n, seed), 160), 45) * env_ad(t, 0.004, 0.07) * 2.0
    y += np.sin(dsp.phase(np.full(n, 70.0))) * env_ad(t, 0.004, 0.06)
    return y


@snd("snd.hit.slam", "impact", ["family:hit", "tier:2", "anchor:crest", "tonal:yes", "size:m", "metal"], tier=2, use=["ad", "launch", "mime"], pairs=["shatter", "cut"],
     desc="metal clack slam: bar modes + noise crack + 80 Hz body", tonal=True, seed=7)
def hit_slam(seed):
    n = sec(0.7)
    t = t_of(n)
    y = dsp.modal(420.0, (1, 2.756, 5.404), (1.0, 0.6, 0.3), (0.35, 0.2, 0.1), n, phases=(0, 0, 0)) * 0.7
    y += svf(white(n, seed), 4200, 0.9, "bp") * env_ad(t, 0.0003, 0.03) * 2.0
    y += np.sin(dsp.phase(np.full(n, 80.0))) * env_ad(t, 0.002, 0.15) * 0.8
    return y


@snd("snd.hit.cinema", "impact", ["family:hit", "tier:1", "anchor:crest", "tonal:yes", "size:xl", "mood:cinematic", "sub", "reverse-swell"], tier=1, use=["launch", "short_film"], pairs=["dipToBlack", "flash", "zoomThrough", "cut"],
     desc="cinematic hero impact: sub drop + noise sweep + metal ring + reverse pre-swell + hall tail", kind="fixed", tonal=True, seed=8)
def hit_cinema(seed):
    pre = sec(0.3)
    n = sec(2.5)
    t = t_of(n)
    y = np.zeros(n)
    y += sub_drop(seed, length=2.5, click_g=0.4)[:n]
    sweep = svf(white(n, seed + 1), dsp.expo(7000, 250, t / 0.45), 0.9, "lp") * env_ad(t, 0.002, 0.30)
    y += sweep * 0.7
    ring = dsp.modal(220.0, (1, 2.76, 5.40, 8.93), (1, .6, .4, .25), (1.8, 1.2, 0.8, 0.5), n, phases=(0, 0, 0, 0)) * 0.2
    y += ring
    y = np.concatenate([np.zeros(pre), y])
    # reverse pre-swell: reversed noise burst through a lowpass, ends at the anchor
    m = pre
    s = svf(white(m, seed + 2), dsp.expo(300, 5000, np.linspace(0, 1, m)), 0.9, "lp")
    s = s * np.linspace(0, 1, m) ** 2.2 * 0.5
    y[:pre] += s
    st = dsp.reverb(y, "hall", 0.25, seed)
    return st, pre


@snd("snd.hit.deep_impact", "impact", ["family:hit", "tier:1", "anchor:crest", "tonal:yes", "size:xl", "mood:cinematic", "sub", "trailer"], tier=1, use=["launch", "short_film"], pairs=["dipToBlack", "cut", "flash"],
     desc="huge trailer impact with long cavern tail", tonal=True, seed=9)
def hit_deep(seed):
    n = sec(3.2)
    t = t_of(n)
    y = sub_drop(seed, 56, 30, 0.4, 0.7, 3.2, 0.4)[:n] * 1.0
    y += dsp.lp(brown(n, seed), 400) * env_ad(t, 0.002, 0.35) * 1.4
    y += svf(white(n, seed + 3), dsp.expo(5000, 200, t / 0.6), 0.8, "lp") * env_ad(t, 0.001, 0.25) * 0.6
    return dsp.reverb(y, "cavern", 0.28, seed)


@snd("snd.hit.boom_meme", "impact", ["family:hit", "tier:2", "anchor:crest", "tonal:yes", "size:l", "mood:comic", "meme"], tier=2, use=["mime", "beat_edit", "talking_head"], pairs=["punchIn", "smash", "freeze"],
     desc="comedic boom for punch-ins and freeze frames", tonal=True, seed=10)
def hit_boom_meme(seed):
    n = sec(1.4)
    t = t_of(n)
    f = dsp.expo(118, 34, t / 0.5)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.002, 0.35)
    y = dsp.oversample_apply(y * 1.2, lambda z: np.tanh(z * 2.5) / np.tanh(2.5), 4)
    y += _click(n, seed, 2200, 1.0, 0.002, 0.6)
    y += dsp.svf(dsp.saw_n(90.0, n), 1200, 0.9, "lp") * env_ad(t, 0.002, 0.2) * 0.5
    return y


@snd("snd.hit.stab", "impact", ["family:hit", "tier:2", "anchor:crest", "tonal:yes", "size:m", "mood:tech", "key:A"], tier=2, use=["launch", "ad", "beat_edit"], pairs=["flash", "cut", "maskReveal"],
     desc="brand stab on the A major triad (A3 C#4 E4)", tonal=True, seed=11)
def hit_stab(seed):
    return I.stab([dsp.note_hz(57), dsp.note_hz(61), dsp.note_hz(64)], dur=0.9, seed=seed, fc0=4500, fc1=700, tau=0.12)


@snd("snd.hit.rock", "impact", ["family:hit", "tier:2", "anchor:noise", "tonal:no", "size:m", "mood:cinematic"], tier=2, use=["short_film", "mime"], pairs=["smash", "cut"],
     desc="heavy block / stone drop", seed=12)
def hit_rock(seed):
    n = sec(0.6)
    t = t_of(n)
    y = dsp.hp(dsp.lp(brown(n, seed), 350), 45) * env_ad(t, 0.001, 0.12) * 2.2
    y += dsp.modal(90.0, (1, 1.9, 3.1), (1, .5, .3), (0.25, 0.15, 0.1), n, phases=(0, 0, 0)) * 0.6
    return y


@snd("snd.hit.braam", "impact", ["family:hit", "tier:1", "anchor:noise", "tonal:yes", "size:xl", "mood:cinematic", "brass"], tier=1, use=["launch", "short_film"], pairs=["dipToBlack", "cut"],
     desc="trailer-style brass-like braam on A1/E2: detuned saws with a closing filter", tonal=True, seed=13)
def hit_braam(seed):
    n = sec(2.2)
    t = t_of(n)
    y = np.zeros(n)
    for f in (55.0, 82.41, 110.0):
        for k in range(4):
            y += dsp.saw_n(f * 2 ** ((k - 1.5) * 8 / 1200), n, ph0=dsp.rng(seed + k).random())
    y = svf(y, 2600 * np.exp(-t / 0.5) + 150, 1.4, "lp")
    y *= env_ad(t, 0.012, 0.8)
    y += _click(n, seed, 3000, 1.0, 0.003, 0.2)
    return dsp.reverb(y / 8, "hall", 0.2, seed)


@snd("snd.hit.low_thump", "impact", ["family:hit", "tier:3", "anchor:crest", "tonal:yes", "size:s", "mood:tech", "sub"], tier=3, use=["ad", "talking_head", "beat_edit"], pairs=["cut", "hardcut"],
     desc="tiny low thump for beat-synced hard cuts", tonal=True, seed=14)
def hit_low_thump(seed):
    n = sec(0.2)
    t = t_of(n)
    f = 48 + 34 * np.exp(-t / 0.03)
    return np.sin(dsp.phase(f)) * env_ad(t, 0.001, 0.08)
