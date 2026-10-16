"""SaaS UI sound palette (2026-10-16, lane xp-saas): the micro-sounds of a product demo that the library did not have yet: a hover tick, a drag lift and a drop
snap, a zoom-to-region swell, a highlight ring drawing on, a command palette opening, the soft tick of a streaming answer, a success chime, a keyboard chord,
a toast arriving, a price reveal and a "connected" link. Owned synthesis (CC0), deterministic per seed; tonal parts sit in the project key (A major: A C# E F# B).
Craft only: no sample, no imitation of any product's system sounds. Starting values: audition once before a hero use (nothing here has been heard by a person)."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import sec, ms, t_of, env_ad, svf, white, pink, rng, add_at, pan_st
from mpaudio.registry import snd

A4, E5, A5, CS6, E6, FS6, A6, B6, CS7, E7 = 440.0, 659.26, 880.0, 1108.73, 1318.51, 1479.98, 1760.0, 1975.53, 2217.46, 2637.02


def _c(id, tags, desc, seed, tier=3, use=("ad", "launch", "kinetic"), pairs=("cut",), tonal=False, **kw):
    return snd(id, "ui", ["family:ui", "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), "saas", *tags], tier=tier, use=list(use), pairs=list(pairs), desc=desc, tonal=tonal, seed=seed, **kw)


def _tone(f, n, a, tau, harm=0.18):
    t = t_of(n)
    return (np.sin(dsp.TWO_PI * f * t) + harm * np.sin(dsp.TWO_PI * 2 * f * t)) * env_ad(t, a, tau)


def _tick(seed, fc, tau, g=1.0, n=None):
    n = n or ms(30)
    return svf(white(n, seed), fc, 2.2, "bp") * env_ad(t_of(n), 0.0002, tau) * 3.0 * g


@_c("snd.ui.hover_tick", ["anchor:crest", "size:xs", "rr:4", "hover"], "hover: a very soft high tick (3.6 kHz damped sine + air), 30 ms, for a cursor landing on a control", 610, tonal=True, pairs=("cut", "caption"))
def hover_tick(seed):
    r = rng(seed)
    n = ms(40)
    y = _tone(3600 * (1 + 0.04 * (r.random() - 0.5)), n, 0.0006, 0.0045, 0.0) * 0.8 + _tick(seed, 7000, 0.0015, 0.25, n)
    return y


@_c("snd.ui.drag_lift", ["anchor:crest", "size:xs", "drag"], "drag lift: a small upward blip (A5 to C#6 glide) over a soft plastic tick, the moment a card is picked up", 612, tonal=True, pairs=("cut",))
def drag_lift(seed):
    n = sec(0.16)
    t = t_of(n)
    f = dsp.glide(A5, CS6, n)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.004, 0.035) * 0.7
    add_at(y, _tick(seed, 2600, 0.003, 0.6), 0, 1.0)
    return y


@_c("snd.ui.drop_snap", ["anchor:noise", "size:xs", "rr:4", "drop"], "drop snap: a magnetic snap into place (bright click, 150 Hz thunk, a short E6 ping), 0.15 s", 614, pairs=("cut", "push"))
def drop_snap(seed):
    r = rng(seed)
    n = sec(0.18)
    t = t_of(n)
    y = _tick(seed, 4200 * (1 + 0.05 * (r.random() - 0.5)), 0.0025, 1.2, n)
    y += np.sin(dsp.TWO_PI * 150 * t) * env_ad(t, 0.0008, 0.028) * 0.55
    add_at(y, _tone(E6, ms(120), 0.001, 0.025, 0.1) * 0.22, ms(6), 1.0)
    return y


@_c("snd.ui.zoom_in", ["anchor:end", "size:s", "mood:tech", "zoom"], "zoom to region: a soft rising air swell (600 Hz to 5 kHz band) with a faint E5 to E6 glide, 0.45 s; anchor = the landing at the end", 616,
    tonal=True, pairs=("zoomThrough", "push", "cut"), kind="fixed")
def zoom_in(seed):
    n = sec(0.45)
    u = np.linspace(0, 1, n)
    x = pink(n, seed)
    fc = dsp.expo(600, 5000, u)
    y = np.zeros(n)
    for a, b in ((0, n // 2), (n // 2, n)):   # two passes with their own centre: a cheap time-varying band
        y[a:b] = svf(x[a:b], float(fc[(a + b) // 2]), 1.1, "bp")
    env = u ** 1.6 * (1 - np.clip((u - 0.92) / 0.08, 0, 1))
    y = y * env * 2.2 + np.sin(dsp.phase(dsp.glide(E5, E6, n))) * env * 0.12
    return pan_st(y, 0.0), int(n * 0.93)


@_c("snd.ui.highlight_draw", ["anchor:start", "size:s", "callout"], "highlight ring draws on: a quick soft marker stroke (filtered noise, 0.3 s) that ends on a tiny A6 glint", 618, tonal=True, pairs=("cut", "maskReveal"), kind="fixed")
def highlight_draw(seed):
    n = sec(0.42)
    t = t_of(n)
    u = np.linspace(0, 1, n)
    stroke = svf(white(n, seed), 2800, 0.9, "bp") * np.sin(np.pi * np.clip(u / 0.72, 0, 1)) ** 1.5 * 0.55
    add_at(stroke, _tone(A6, ms(160), 0.001, 0.04, 0.0) * 0.3, sec(0.29), 1.0)
    return stroke, ms(2)


@_c("snd.ui.palette_open", ["anchor:crest", "size:s", "command"], "command palette opens: a short upward air flick and a soft two-note E6 + B6 shimmer, 0.3 s", 620, tonal=True, pairs=("cut", "push"))
def palette_open(seed):
    n = sec(0.34)
    t = t_of(n)
    y = svf(white(n, seed), 5200, 0.8, "bp") * env_ad(t, 0.012, 0.03) * 0.6
    add_at(y, _tone(E6, ms(260), 0.003, 0.06, 0.1) * 0.5, ms(24), 1.0)
    add_at(y, _tone(B6, ms(240), 0.003, 0.05, 0.0) * 0.32, ms(52), 1.0)
    return y


@_c("snd.ui.stream_tick", ["anchor:crest", "size:xs", "rr:4", "ai", "streaming"], "streaming answer: a soft dull tick with a faint E6 body, 35 ms, one per word group of an AI answer (keep it 12 dB or more under the bed)", 622, tonal=True, pairs=("caption",))
def stream_tick(seed):
    r = rng(seed)
    n = ms(45)
    y = _tick(seed, 1900 * (1 + 0.08 * (r.random() - 0.5)), 0.003, 0.7, n) + _tone(E6 * (1 + 0.01 * (r.random() - 0.5)), n, 0.0008, 0.006, 0.0) * 0.35
    return y


@_c("snd.ui.success_chime", ["anchor:crest", "size:m", "mood:warm", "key:A", "result"], "success chime: a bright FM bell pair E6 then A6 with a short shimmer tail, 0.9 s (the payoff of a UI action: applied, sent, done)", 624,
    tier=2, tonal=True, pairs=("statReveal", "cut"))
def success_chime(seed):
    n = sec(1.0)
    y = np.zeros(n)
    add_at(y, I.bell(E6, 0.7, index=2.2, ratio=2.0, seed=seed) * 0.8, 0, 1.0)
    add_at(y, I.bell(A6, 0.8, index=2.0, ratio=2.0, seed=seed + 1), ms(85), 1.0)
    y = y[:n]
    st = dsp.reverb(np.stack([y, y], 1), "room", 0.16, seed=seed)[:n]
    return st


@_c("snd.ui.key_chord", ["anchor:noise", "size:xs", "keyboard", "shortcut"], "keyboard chord: two keycaps a few ms apart (bright clack + low thock each) then a tiny A6 confirm, 0.22 s", 626, tonal=True, pairs=("cut",))
def key_chord(seed):
    r = rng(seed)
    n = sec(0.24)
    y = np.zeros(n)
    for k, d in enumerate((0, ms(14 + int(r.integers(0, 8))))):
        m = ms(70)
        t = t_of(m)
        cap = _tick(seed + k, 3600 - 600 * k, 0.003, 1.0, m) + np.sin(dsp.TWO_PI * (210 - 30 * k) * t) * env_ad(t, 0.0008, 0.02) * 0.5
        add_at(y, cap, d, 1.0 - 0.15 * k)
    add_at(y, _tone(A6, ms(140), 0.002, 0.03, 0.0) * 0.25, ms(40), 1.0)
    return y


@_c("snd.ui.toast_in", ["anchor:crest", "size:s", "rr:4", "notification"], "toast arrives: a soft bloop gliding A6 to E6 with a little air, 0.25 s (one per notification in a stack)", 628, tonal=True, pairs=("cut", "push"))
def toast_in(seed):
    r = rng(seed)
    n = sec(0.26)
    t = t_of(n)
    f0 = A6 * (1 + 0.012 * (r.random() - 0.5))
    y = np.sin(dsp.phase(dsp.glide(f0, E6, n))) * env_ad(t, 0.004, 0.05) * 0.8 + svf(white(n, seed), 6000, 0.8, "bp") * env_ad(t, 0.002, 0.02) * 0.25
    return y


@_c("snd.ui.price_reveal", ["anchor:crest", "size:s", "mood:warm", "key:A", "pricing"], "price reveal: a quick rising pluck figure A5 C#6 E6 A6 with an air lift, 0.55 s (the featured plan lifts)", 630, tonal=True, pairs=("statReveal", "cut"))
def price_reveal(seed):
    n = sec(0.62)
    y = np.zeros(n)
    for k, f in enumerate((A5, CS6, E6, A6)):
        add_at(y, I.pluck(f, 0.22, seed=seed + k, bright=0.5) * (0.6 + 0.12 * k), ms(48 * k), 1.0)
    u = np.linspace(0, 1, n)
    y += svf(pink(n, seed + 9), 4000, 0.9, "bp") * np.sin(np.pi * np.clip(u / 0.6, 0, 1)) * 0.2
    return y


@_c("snd.ui.connect", ["anchor:crest", "size:s", "key:A", "integrations"], "connected: a soft click then two plucks a fifth apart (A5, E6), 0.32 s (an integration links, a connector reaches its tile)", 632, tonal=True, pairs=("cut",))
def connect(seed):
    n = sec(0.36)
    y = _tick(seed, 3000, 0.002, 0.8, n)
    add_at(y, I.pluck(A5, 0.16, seed=seed, bright=0.45) * 0.7, ms(30), 1.0)
    add_at(y, I.pluck(E6, 0.2, seed=seed + 1, bright=0.45) * 0.8, ms(110), 1.0)
    return y
