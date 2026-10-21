"""Archive / heritage sounds (2026-10-14, round-3 reference study): a film projector loop for archive openings and a typewriter line for all-caps
credit and archive cards, plus the projected hologram beam for beam / hologram overlays. Motivated by docs/evidence/reference-round3-2026-10.md
(craft only: every sound here is owned synthesis, no samples). Starting values; audition before a hero use."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import sec, ms, t_of, env_ad, svf, white, pink, brown, rng, add_at, pan_st
from mpaudio.registry import snd
from .ambience import add_wrap
from .foley import _f

PLOOP = sec(4.0)          # 4.0 s: 96 claw pulls at 24 fps, every periodic part has a whole number of cycles


def _cyc(f, secs=4.0):
    return round(f * secs) / secs


# ------------------------------------------------------------------------------------------------------------- projector
@snd("snd.amb.projector", "ambience", ["family:amb", "tier:3", "anchor:loop", "mood:warm", "use:short_film", "archive", "film"], tier=3, loop=True,
     kind="fixed", use=["short_film", "launch", "ad"], pairs=["cut", "filmBurn", "dissolve"], seed=600,
     desc="film projector: 24 fps claw-and-shutter clatter (accented pull-down), motor whirr on 96 Hz harmonics, fan air and a slow reel flutter; 4.0 s seamless loop")
def projector(seed):
    r = rng(seed)
    t = t_of(PLOOP)
    flutter = 1.0 + 0.12 * np.sin(dsp.TWO_PI * 0.75 * t) + 0.05 * np.sin(dsp.TWO_PI * 2.0 * t + 1.0)   # 3 and 8 cycles per loop
    y = np.zeros((PLOOP, 2))
    step = PLOOP / 96.0
    lv = np.exp(r.normal(0.0, 0.12, 96))
    for k in range(96):                                                       # claw pull-down: a hard tick + a woody clack
        m = ms(22)
        tt = t_of(m)
        tick = svf(white(m, seed + 3 * k), r.uniform(2600, 3400), 1.6, "bp") * env_ad(tt, 0.0001, 0.0016) * 1.6
        clack = svf(brown(m, seed + 3 * k + 1), 620, 1.4, "bp") * env_ad(tt, 0.0004, 0.006) * 1.2
        shut = svf(white(m, seed + 3 * k + 2), 5200, 1.0, "bp") * env_ad(tt, 0.0001, 0.0008) * 0.5          # the shutter blade, half a frame later
        ev = np.zeros(ms(45))
        add_at(ev, tick + clack, 0)
        add_at(ev, shut, int(step / 2))
        g = lv[k] * (1.0 if k % 2 == 0 else 0.78) * flutter[int(k * step)]
        add_wrap(y, pan_st(ev, 0.12 * np.sin(k)), int(round(k * step)), g)
    whirr = sum(a * np.sin(dsp.TWO_PI * _cyc(f) * t + ph) for f, a, ph in ((96.0, 0.5, 0.0), (192.0, 0.32, 1.1), (288.0, 0.18, 2.0), (480.0, 0.08, 0.4)))
    whirr *= 0.75 + 0.25 * np.sin(dsp.TWO_PI * 24.0 * t)                     # the intermittent movement modulates the motor load
    y += np.stack([whirr, whirr], 1) * 0.11 * flutter[:, None]
    air = np.stack([dsp.fft_filter(pink(PLOOP, seed + 7), 250, 4500, 2), dsp.fft_filter(pink(PLOOP, seed + 8), 250, 4500, 2)], 1)
    y += air / (np.std(air) + 1e-12) * 0.035
    sprocket = dsp.fft_filter(white(PLOOP, seed + 9), 5000, 11000, 2) * (0.5 + 0.5 * np.sin(dsp.TWO_PI * 24.0 * t)) ** 4
    y += np.stack([sprocket, np.roll(sprocket, 37)], 1) / (np.std(sprocket) + 1e-12) * 0.012
    return y


# ------------------------------------------------------------------------------------------------------------- typewriter
def _strike(seed, space=False):
    """one type strike: a hard slug click, a short metal typebar ring, the platen thump, then the key's return click"""
    r = rng(seed)
    n = ms(120)
    t = t_of(n)
    y = np.zeros(n)
    if space:
        y += np.sin(dsp.TWO_PI * r.uniform(120, 150) * t) * env_ad(t, 0.0015, 0.03) * 0.9
        y += svf(brown(n, seed + 1), 400, 1.0, "bp") * env_ad(t, 0.001, 0.02) * 0.9
        y += svf(white(n, seed + 2), 1800, 1.2, "bp") * env_ad(t, 0.0002, 0.003) * 0.5
        return y
    y += svf(white(n, seed), r.uniform(3000, 4300), 1.5, "bp") * env_ad(t, 0.0001, 0.0016) * 1.4
    y += dsp.modal(r.uniform(950, 1250), (1.0, 2.31, 3.68, 5.12), (1.0, 0.55, 0.35, 0.2), (0.07, 0.05, 0.035, 0.025), n, seed=seed) * 0.28
    y += np.sin(dsp.TWO_PI * r.uniform(170, 230) * t) * env_ad(t, 0.0008, 0.022) * 0.55
    y += svf(brown(n, seed + 3), 300, 1.2, "bp") * env_ad(t, 0.0006, 0.015) * 0.6
    rel = ms(r.uniform(38, 55))
    m = ms(10)
    add_at(y, svf(white(m, seed + 4), 2600, 1.4, "bp") * env_ad(t_of(m), 0.0001, 0.0012) * 0.35, rel)
    return y


def _bell(seed):
    n = sec(1.1)
    t = t_of(n)
    y = dsp.modal(2620.0, (1.0, 2.32, 4.25, 6.63), (1.0, 0.45, 0.25, 0.12), (1.0, 0.55, 0.32, 0.2), n, seed=seed)
    y += svf(white(n, seed + 1), 5000, 1.2, "bp") * env_ad(t, 0.0001, 0.001) * 0.6                     # the striker
    return y * 0.55


def _carriage_return(seed):
    """the lever throw: a ratchet run (fast clicks, rate rising then easing), a slide hiss, then the carriage stop"""
    r = rng(seed)
    span = 0.42
    n = sec(span + 0.25)
    y = np.zeros(n)
    tt, k = 0.0, 0
    while tt < span:
        u = tt / span
        rate = 30 + 55 * np.sin(np.pi * min(1.0, u * 1.1))
        m = ms(8)
        add_at(y, svf(white(m, seed + 10 + k), r.uniform(1900, 3200), 1.5, "bp") * env_ad(t_of(m), 0.0001, 0.0011), sec(tt), 0.55 * r.uniform(0.7, 1.0))
        tt += 1.0 / rate
        k += 1
    slide = svf(pink(sec(span), seed + 5), 1400, 0.8, "bp") * dsp.env_bell(sec(span), 0.45, 1.5, 2.0) * 0.35
    add_at(y, slide, 0)
    m = ms(120)
    t = t_of(m)
    stop = np.sin(dsp.TWO_PI * 115 * t) * env_ad(t, 0.001, 0.04) * 1.0 + svf(white(m, seed + 6), 2400, 1.3, "bp") * env_ad(t, 0.0001, 0.002) * 0.9
    stop += dsp.modal(820.0, (1.0, 2.6, 4.1), (1.0, 0.5, 0.3), (0.12, 0.08, 0.05), m, seed=seed) * 0.25
    add_at(y, stop, sec(span))
    return y


@_f("snd.foley.typewriter", ["anchor:start", "size:l", "archive", "type"],
    "typewriter line: 9 humanised strikes (each a different take, one space bar), the end-of-line bell, two more strikes, then the carriage-return ratchet and stop; anchor = the first strike (rr:4 = four different lines)",
    410, tier=3, use=("short_film", "ad", "launch", "kinetic"), pairs=("cut", "textReveal"), kind="fixed")
def typewriter(seed):
    r = rng(seed)
    y = np.zeros((sec(2.9), 2))
    tt = 0.02
    first = sec(tt)
    for k in range(11):
        if k == 8:                                                            # the bell rings near the end of the line
            add_at(y, pan_st(_bell(seed + 900), 0.35), sec(tt + 0.02), 1.0)
            tt += 0.12
        sp = k == 4
        add_at(y, pan_st(_strike(seed + 17 * k, space=sp), -0.25 + 0.05 * k), sec(tt), np.exp(r.normal(0.0, 0.12)))
        tt += r.uniform(0.095, 0.16) * (1.25 if sp else 1.0)
    tt += 0.18
    add_at(y, pan_st(_carriage_return(seed + 500), 0.1), sec(tt), 1.0)
    return dsp.reverb(y, "room", 0.06, seed), first


# ------------------------------------------------------------------------------------------------------------- hologram beam
A2, E3 = 110.0, 164.81
CHATTER = (1760.0, 2217.46, 2637.02, 2959.96, 3520.0)        # A-major data blips


@snd("snd.ui.hologram_beam", "ui", ["family:ui", "tier:3", "anchor:end", "tonal:yes", "size:m", "key:A", "mood:tech", "beam", "hologram"], tier=3, tonal=True,
     kind="fixed", use=["ad", "launch", "kinetic"], pairs=["lumaWipe", "maskReveal", "cut"], seed=620,
     desc="projected hologram beam: a quick A3-to-A5 ignition glide, then a soft detuned A2/E3 hum with a 6 Hz shimmer, airy noise and a quiet A-major data chatter; 2.4 s plus a short plate tail, anchor = the beam at full")
def hologram_beam(seed):
    r = rng(seed)
    n = sec(2.4)
    t = t_of(n)
    on = sec(0.18)
    body = dsp.saw_n(np.full(n, A2), n) + dsp.saw_n(np.full(n, A2 * 1.006), n) * 0.8 + dsp.saw_n(np.full(n, E3), n) * 0.45
    body = dsp.lp(body, 900) * (0.78 + 0.22 * np.sin(dsp.TWO_PI * 6.0 * t))
    env = np.clip(t / 0.18, 0, 1) ** 1.5 * np.where(t > 1.7, np.exp(-(t - 1.7) / 0.22), 1.0)
    y = dsp.decorrelate(body, seed, 6.0) * env[:, None] * 0.25
    g = np.sin(dsp.phase(dsp.expo(220.0, 880.0, np.clip(t / 0.18, 0, 1)))) * env_ad(t, 0.01, 0.12) * np.clip(1.2 - t / 0.3, 0, 1)
    y += pan_st(g, 0.0) * 0.25
    air = np.stack([svf(pink(n, seed + 1), 5200, 0.9, "bp"), svf(pink(n, seed + 2), 5400, 0.9, "bp")], 1)
    air *= (0.6 + 0.4 * np.sin(dsp.TWO_PI * 13.0 * t) * np.sin(dsp.TWO_PI * 3.1 * t + 0.7))[:, None]
    y += air / (np.max(np.abs(air)) + 1e-12) * 0.16 * env[:, None]
    for i in dsp.grain_times(n, lambda tt: 22.0 * np.clip((tt - 0.15) / 0.2, 0, 1) * np.where(tt > 1.7, 0.3, 1.0), seed):
        m = ms(r.uniform(8, 18))
        b = dsp.tri_n(np.full(m, CHATTER[int(r.integers(len(CHATTER)))]), m) * env_ad(t_of(m), 0.0008, 0.005)
        add_at(y, pan_st(b, r.uniform(-0.7, 0.7)), int(i), 0.12 * np.exp(r.normal(0, 0.3)))
    return dsp.reverb(y, "plate", 0.12, seed), on
