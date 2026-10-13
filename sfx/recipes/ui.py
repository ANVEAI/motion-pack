"""Clicks, pops, UI blips, typing, counters. Tonal cues use the project key (A major: A C# E F# B)."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, rng, note_hz, add_at
from mpaudio.registry import snd

A5, CS6, E6, B6, FS6, A6 = 880.0, 1108.73, 1318.51, 1975.53, 1479.98, 1760.0


def _burst(n, seed, fc, q, tau, g=1.0, a=0.0002):
    return svf(white(n, seed), fc, q, "bp") * env_ad(t_of(n), a, tau) * g * 3.0


@snd("snd.ui.click", "ui", ["family:ui", "tier:3", "anchor:noise", "tonal:no", "size:xs"], tier=3, use=["ad", "talking_head", "kinetic"], pairs=["cut", "caption"], desc="light UI click: 3.2 kHz burst + 190 Hz thunk", seed=40)
def ui_click(seed):
    n = sec(0.1)
    t = t_of(n)
    y = _burst(n, seed, 3200, 1.4, 0.004, 1.2)
    y += np.sin(dsp.phase(np.full(n, 190.0))) * env_ad(t, 0.0012, 0.02) * 0.28
    return y


@snd("snd.ui.tick", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "size:xs"], tier=3, use=["kinetic", "talking_head"], pairs=["cut", "caption"], desc="2.2 kHz tick, 25 ms", tonal=True, seed=41)
def ui_tick(seed):
    n = sec(0.05)
    t = t_of(n)
    return np.sin(dsp.TWO_PI * 2200 * (1 + 0.03 * (dsp.rng(seed).random() - 0.5)) * t) * env_ad(t, 0.0005, 0.004)


def _two(n, f1, f2, seed, dur=0.035, tau=0.014):
    y = np.zeros(n)
    for k, f in enumerate((f1, f2)):
        m = sec(dur + 0.05)
        t = t_of(m)
        v = np.sin(dsp.TWO_PI * f * t) * env_ad(t, 0.0015, tau)
        add_at(y, v, sec(k * dur), 1.0)
    return y


@snd("snd.ui.toggle_on", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "key:A"], tier=3, use=["ad", "launch"], pairs=["caption", "cut"], desc="toggle on: A5 to E6", tonal=True, seed=42)
def ui_toggle_on(seed):
    return _two(sec(0.14), A5, E6, seed)


@snd("snd.ui.toggle_off", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "key:A"], tier=3, use=["ad", "launch"], pairs=["caption", "cut"], desc="toggle off: E6 to A5", tonal=True, seed=43)
def ui_toggle_off(seed):
    return _two(sec(0.14), E6, A5, seed)


@snd("snd.ui.blip", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "key:A"], tier=3, use=["ad", "kinetic", "launch"], pairs=["caption", "textReveal"], desc="A5 blip, triangle + octave", tonal=True, seed=44)
def ui_blip(seed):
    n = sec(0.14)
    t = t_of(n)
    y = dsp.tri_n(np.full(n, A5), n) + 0.2 * np.sin(dsp.TWO_PI * A5 * 2 * t)
    return y * env_ad(t, 0.002, 0.024)


@snd("snd.ui.success", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "mood:warm", "key:A"], tier=3, use=["ad", "launch", "talking_head"], pairs=["statReveal", "cut"], desc="success arpeggio A5 C#6 E6 with sparkle", tonal=True, seed=45)
def ui_success(seed):
    n = sec(0.6)
    y = np.zeros(n)
    for k, f in enumerate((A5, CS6, E6)):
        m = sec(0.3)
        t = t_of(m)
        v = (np.sin(dsp.TWO_PI * f * t) + 0.3 * np.sin(dsp.TWO_PI * f * 3 * t)) * env_ad(t, 0.002, 0.04)
        add_at(y, v, sec(0.06 * k), 1.0)
    r = rng(seed)
    for k in range(7):
        f = note_hz(int(r.choice([93, 97, 100, 102, 105])))
        m = sec(0.25)
        t = t_of(m)
        add_at(y, np.sin(dsp.TWO_PI * f * t) * env_ad(t, 0.0005, 0.05), sec(0.14 + r.random() * 0.2), 0.08)
    return y


@snd("snd.ui.error", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "mood:tense"], tier=3, use=["ad", "talking_head"], pairs=["glitch", "cut"], desc="error: two low buzzes, second drops two semitones", tonal=True, seed=46)
def ui_error(seed):
    n = sec(0.32)
    y = np.zeros(n)
    for k, f in enumerate((190.0, 190.0 * 2 ** (-2 / 12))):
        m = sec(0.1)
        t = t_of(m)
        v = svf(dsp.pulse_n(f, m, 0.3), 900, 0.8, "lp") * env_ad(t, 0.002, 0.06)
        add_at(y, v, sec(0.13 * k), 1.0)
    return y


@snd("snd.ui.notify", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "key:A"], tier=3, use=["ad", "launch"], pairs=["caption"], desc="two-note FM bell chime E6 to B6", tonal=True, seed=47)
def ui_notify(seed):
    n = sec(1.0)
    y = np.zeros(n)
    add_at(y, I.bell(E6, 0.5, 0.45, 4.5, vel=1.0), 0, 1.0)
    add_at(y, I.bell(B6, 0.6, 0.45, 4.5, vel=0.9), sec(0.02), 1.0)
    return y


@snd("snd.ui.pop", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "size:xs"], tier=3, use=["talking_head", "kinetic", "ad"], pairs=["textReveal", "caption", "cut"], desc="UI pop: 380 to 920 Hz chirp in 28 ms; word appears", tonal=True, seed=48)
def ui_pop(seed):
    n = sec(0.1)
    t = t_of(n)
    f = dsp.expo(380, 920, t / 0.028)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.001, 0.018)
    return y + _burst(n, seed, 4000, 1.0, 0.002, 0.12)


@snd("snd.ui.pop_down", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "size:xs"], tier=3, use=["talking_head", "kinetic", "ad"], pairs=["caption", "cut"], desc="reverse chirp: element disappears", tonal=True, seed=49)
def ui_pop_down(seed):
    n = sec(0.1)
    t = t_of(n)
    f = dsp.expo(920, 380, t / 0.028)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.001, 0.018)
    return y + _burst(n, seed, 3000, 1.0, 0.002, 0.1)


@snd("snd.ui.slide", "ui", ["family:ui", "tier:3", "anchor:noise", "tonal:no", "size:s"], tier=3, use=["ad", "launch", "kinetic"], pairs=["slide", "push"], desc="friction slide 1.5 to 2.4 kHz, 180 ms", seed=50)
def ui_slide(seed):
    n = sec(0.2)
    u = np.linspace(0, 1, n)
    return svf(white(n, seed), 1500 + 900 * u, 1.4, "bp") * dsp.env_bell(n, 0.45, 2.0, 2.0) * 3


@snd("snd.ui.swipe_ding", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "key:A"], tier=3, use=["ad", "launch"], pairs=["slide", "push"], desc="swish then an E6 ding", tonal=True, seed=51)
def ui_swipe_ding(seed):
    n = sec(0.5)
    y = np.zeros(n)
    sw = svf(white(sec(0.14), seed), np.linspace(2600, 7500, sec(0.14)), 1.6, "bp") * dsp.env_bell(sec(0.14), 0.5, 2.5, 2.5) * 2.5
    add_at(y, sw, 0, 0.6)
    add_at(y, I.bell(E6, 0.3, 0.3, 3.0), sec(0.14), 0.9)
    return y


def key_sound(seed, kind="reg", mech=True):
    n = sec(0.1)
    t = t_of(n)
    r = rng(seed)
    f = {"reg": 180 + 80 * r.random(), "space": 120.0, "enter": 150.0}[kind]
    t60 = 0.08 if kind == "space" else 0.045
    y = dsp.hp(white(n, seed), 2000) * env_ad(t, 0.0003, 0.006) * 0.6
    y += np.sin(dsp.TWO_PI * f * t) * np.exp(-6.9 * t / t60) * (1.4 if kind == "space" else 1.0) * 0.8
    if mech:
        add_at(y, _burst(sec(0.04), seed + 1, 4000, 1.4, 0.003, 0.25), sec(0.02), 1.0)
    return y


@snd("snd.ui.type_key", "ui", ["family:ui", "tier:3", "anchor:noise", "tonal:no", "size:xs", "foley"], tier=3, use=["kinetic", "ad", "talking_head"], pairs=["textReveal", "caption"], desc="one mechanical key press", seed=52)
def ui_type_key(seed):
    return key_sound(seed)


@snd("snd.ui.typing_burst", "ui", ["family:ui", "tier:3", "anchor:noise", "tonal:no", "size:m", "foley", "typing"], tier=3, use=["kinetic", "ad", "talking_head"], pairs=["textReveal"], desc="~1.2 s of typing at 210 wpm (log-normal key intervals, round-robin takes)", seed=53)
def ui_typing(seed, text="motion pack makes video fast"):
    r = rng(seed)
    med = 60.0 / (210 * 5)
    n = sec(1.6)
    y = np.zeros(n)
    t0 = 0.0
    for k, ch in enumerate(text):
        kind = "space" if ch == " " else "reg"
        d = key_sound(seed + 7 * k, kind)
        add_at(y, d, sec(t0), db(r.uniform(-1.5, 1.5)))
        t0 += med * float(np.exp(r.normal(0, 0.35)))
        if ch == " " and r.random() < 0.025:
            t0 += 0.25
        if t0 > 1.35:
            break
    return y


@snd("snd.ui.count_tick", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "size:xs", "counter"], tier=3, use=["ad", "launch", "talking_head"], pairs=["statReveal"], desc="counter tick: one per displayed increment", tonal=True, seed=54)
def ui_count_tick(seed):
    n = sec(0.05)
    t = t_of(n)
    return np.sin(dsp.TWO_PI * 1800 * t) * env_ad(t, 0.0005, 0.006)


@snd("snd.ui.count_run", "ui", ["family:ui", "tier:3", "anchor:noise", "tonal:yes", "size:m", "counter"], tier=3, use=["ad", "launch", "talking_head"], pairs=["statReveal"], desc="count-up run: 14 ticks rising 3 semitones per 10 ticks, then a ding", tonal=True, seed=55)
def ui_count_run(seed):
    n = sec(0.9)
    y = np.zeros(n)
    for k in range(14):
        f = 1800 * 2 ** ((3 * k / 10) / 12)
        m = sec(0.04)
        t = t_of(m)
        add_at(y, np.sin(dsp.TWO_PI * f * t) * env_ad(t, 0.0005, 0.006), sec(0.04 * k), 0.7)
    add_at(y, I.bell(E6, 0.35, 0.3, 3.0), sec(0.62), 0.9)
    return y


@snd("snd.ui.finger_snap", "ui", ["family:ui", "tier:3", "anchor:noise", "tonal:no", "size:xs", "foley"], tier=3, use=["mime", "talking_head", "ad"], pairs=["cut"], desc="finger snap: 2.3 kHz crack + 380 Hz body", seed=56)
def ui_snap(seed):
    n = sec(0.2)
    t = t_of(n)
    y = _burst(n, seed, 2300, 1.2, 0.008, 1.0, 0.0003)
    y += np.sin(dsp.phase(380 * (1 + 0.3 * np.exp(-t / 0.01)))) * env_ad(t, 0.001, 0.03) * 0.5
    return y


@snd("snd.ui.camera_ping", "ui", ["family:ui", "tier:3", "anchor:crest", "tonal:yes", "key:A", "size:xs"], tier=3, use=["ad", "launch"], pairs=["flash"], desc="single high ping A6, 400 ms", tonal=True, seed=57)
def ui_ping(seed):
    return I.bell(A6, 0.4, 0.35, 3.0)
