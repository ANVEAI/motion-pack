"""SaaS / launch-film sounds (2026-10-14): card systems, scan overlays, pixel dissolves, an "AI at work" texture, the brand-field slam and letters
assembling. Motivated by the sentence-led product films studied in skills/motion-pack/references/success-patterns.md (craft only: every sound here is
owned synthesis, no samples). Tonal parts sit in the project key (A major). Starting values; audition before a hero use."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import sec, ms, t_of, env_ad, svf, white, pink, brown, rng, add_at, expo, pan_st
from mpaudio.registry import snd
from .ambience import add_wrap

A2, E3, A3, A5, CS6, E6, FS6, B6, A6 = 110.0, 164.81, 220.0, 880.0, 1108.73, 1318.51, 1479.98, 1975.53, 1760.0


def _flick(seed, fc, tau, body=0.35):
    """one card edge leaving the thumb: a band-passed snap + a small papery body"""
    n = ms(14)
    t = t_of(n)
    y = svf(white(n, seed), fc, 1.3, "bp") * env_ad(t, 0.0002, tau) * 2.5
    y += svf(white(n, seed + 7), fc * 0.28, 1.0, "bp") * env_ad(t, 0.0004, tau * 1.8) * body
    return y


def _riffle(seed, cards, span, pan0=-0.3, pan1=0.3, gain=1.0):
    """a riffle: `cards` flicks over `span` s, slightly accelerating then easing, fc and level jittered per card; returns (n, 2)"""
    r = rng(seed)
    n = sec(span + 0.05)
    out = np.zeros((n, 2))
    u = np.linspace(0, 1, cards)
    gaps = (1.15 - 0.3 * np.sin(np.pi * u)) * r.uniform(0.85, 1.15, cards)
    times = np.concatenate([[0.0], np.cumsum(gaps)[:-1]])
    times = times / times[-1] * span if times[-1] > 0 else times
    lvl = (0.55 + 0.45 * np.sin(np.pi * np.clip(u * 1.1, 0, 1))) * gain
    for k in range(cards):
        f = _flick(seed + 31 * k, r.uniform(2400, 5200), r.uniform(0.0012, 0.0028))
        add_at(out, pan_st(f, pan0 + (pan1 - pan0) * u[k]), sec(times[k]), lvl[k] * np.exp(r.normal(0, 0.18)))
    air = dsp.bp(pink(n, seed + 3), 1500, 6500, 2) * dsp.env_bell(n, 0.5, 1.6, 2.2) * 0.35 * gain
    out += np.stack([air, air], 1)
    return out


def _c(id, cat, tags, desc, seed, tier=3, use=("ad", "launch", "kinetic"), pairs=("cut",), tonal=False, **kw):
    return snd(id, cat, ["family:" + cat, "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), *tags], tier=tier, use=list(use), pairs=list(pairs), desc=desc,
               tonal=tonal, seed=seed, **kw)


# ------------------------------------------------------------------------------------------------------------- cards
@_c("snd.paper.card_riffle", "paper", ["anchor:scatter", "size:s", "foley", "rr:4", "cards"],
    "card-stack riffle: 16-23 fast paper flicks with a little air, panned across the stack (4 round-robin takes)", 520, pairs=("push", "cut", "slide"))
def card_riffle(seed):
    r = rng(seed)
    cards = int(r.integers(16, 24))
    return _riffle(seed, cards, r.uniform(0.34, 0.46), pan0=r.uniform(-0.45, -0.15), pan1=r.uniform(0.15, 0.45))


@_c("snd.paper.card_shuffle_settle", "paper", ["anchor:end", "size:m", "foley", "rr:4", "cards"],
    "card shuffle: two interleaving riffles (L and R), a short bridge flutter, then the stack squared on the table (anchor = the settle tap)", 524,
    pairs=("push", "cut"), kind="fixed")
def card_shuffle_settle(seed):
    r = rng(seed)
    y = np.zeros((sec(1.35), 2))
    add_at(y, _riffle(seed, int(r.integers(15, 20)), 0.42, -0.6, -0.15), 0, 0.9)
    add_at(y, _riffle(seed + 1, int(r.integers(15, 20)), 0.42, 0.6, 0.15), ms(9), 0.9)
    add_at(y, _riffle(seed + 2, 22, 0.2, -0.1, 0.1, gain=0.45), sec(0.5), 1.0)                  # the bridge: cards falling together
    settle = sec(0.86)
    for k, (g, d) in enumerate(((1.0, 0), (0.45, ms(95)))):                                        # square-up: one firm tap, one lighter re-tap
        m = sec(0.12)
        t = t_of(m)
        tap = dsp.bp(brown(m, seed + 50 + k), 180, 900, 2) * env_ad(t, 0.0008, 0.018) * 4.0
        tap += np.sin(dsp.TWO_PI * (150 + 20 * k) * t) * env_ad(t, 0.0015, 0.03) * 0.6
        tap += svf(white(m, seed + 60 + k), 3000, 1.0, "bp") * env_ad(t, 0.0002, 0.002) * 0.6
        add_at(y, pan_st(tap, 0.0), settle + d, g)
    return y, settle + ms(1)


# ------------------------------------------------------------------------------------------------------------- scan
@_c("snd.ui.scan_sweep", "ui", ["anchor:end", "size:m", "key:A", "mood:tech", "scan"],
    "scan overlay: soft rising resonant noise sweep 350 Hz to 7 kHz with a faint A3-to-A5 glide, 1.2 s (anchor = the crest near the end, the scan line reaching the far edge)",
    530, tier=3, tonal=True, pairs=("lumaWipe", "maskReveal", "cut"), kind="fixed")
def scan_sweep(seed):
    n = sec(1.2)
    u = np.linspace(0, 1, n)
    fc = expo(350, 7000, u ** 1.15)
    nz = np.stack([svf(pink(n, seed), fc, 3.0, "bp"), svf(pink(n, seed + 1), fc * 1.03, 3.0, "bp")], 1)
    nz /= np.max(np.abs(nz)) + 1e-12
    glide = np.sin(dsp.phase(expo(A3, A5, u))) * 0.07
    env = dsp.env_bell(n, 0.8, 1.6, 5.0)
    y = (nz + glide[:, None]) * env[:, None]
    return y, int(0.8 * n)


# ------------------------------------------------------------------------------------------------------------- pixel dissolve
@_c("snd.tx.pixel_dissolve", "transition", ["anchor:noise", "size:m", "mood:tech", "bitcrush", "pixel"],
    "pixel dissolve: a dense cloud of 8-bit blips and crushed noise that thins out while the sample rate drops, 0.9 s", 540, tier=2,
    use=("ad", "launch", "beat_edit"), pairs=("dissolve", "pixelSort", "glitch"))
def pixel_dissolve(seed):
    r = rng(seed)
    n = sec(0.9)
    L, R = np.zeros(n), np.zeros(n)
    palette = [220.0 * 2 ** (s / 12) for s in (0, 4, 7, 9, 12, 16, 19, 21, 24, 28, 31)]       # A-major-ish "pixel colours"
    for i in dsp.grain_times(n, lambda t: 900 * np.exp(-t / 0.22) + 30, seed):
        m = ms(r.uniform(4, 12))
        f = palette[int(r.integers(len(palette)))] * (2 if r.random() < 0.3 else 1)
        g = dsp.pulse_n(np.full(m, f), m, 0.5) * env_ad(t_of(m), 0.0002, 0.004)
        p = r.uniform(-0.9, 0.9)
        a = (p + 1) * np.pi / 4
        amp = np.exp(r.normal(-1.0, 0.4))
        add_at(L, g * np.cos(a), int(i), amp)
        add_at(R, g * np.sin(a), int(i), amp)
    t = t_of(n)
    hiss = dsp.hp(white(n, seed + 5), 2500) * env_ad(t, 0.004, 0.18) * 0.5
    L += hiss
    R += dsp.hp(white(n, seed + 6), 2500) * env_ad(t, 0.004, 0.18) * 0.5
    out = []
    for ch in (L, R):                                                     # the crush deepens over time: crossfade three crush depths
        c1, c2, c3 = dsp.bitcrush(ch, 8, 2), dsp.bitcrush(ch, 5, 6), dsp.bitcrush(ch, 3, 16)
        w1 = np.clip(1 - u_of(n) * 3, 0, 1)
        w3 = np.clip(u_of(n) * 3 - 2, 0, 1)
        out.append(c1 * w1 + c2 * (1 - w1 - w3) + c3 * w3)
    y = np.stack(out, 1)
    return dsp.lp(y, 11000)


def u_of(n):
    return np.linspace(0, 1, n)


# ------------------------------------------------------------------------------------------------------------- AI at work
LOOP = sec(4.0)            # 2 bars at 120 BPM: every periodic part has a whole number of cycles in 4.0 s


def _cyc4(f):
    return round(f * 4.0) / 4.0


@_c("snd.ui.agent_working", "ui", ["anchor:loop", "size:m", "key:A", "mood:tech", "loop", "agent"],
    "AI at work: low-key 120 BPM texture (soft beat pulse, quiet 16th ticks, A-major data blips, breathing A2/E3 drone), 4.0 s seamless loop; sits under step lists and progress UI",
    550, tier=3, tonal=True, loop=True, kind="fixed", use=("ad", "launch", "kinetic"), pairs=("cut",))
def agent_working(seed):
    r = rng(seed)
    t = t_of(LOOP)
    breath = 0.7 + 0.3 * np.sin(dsp.TWO_PI * 0.25 * t - np.pi / 2)                          # 1 cycle per loop
    drone = sum(g * np.sin(dsp.TWO_PI * _cyc4(f) * t) for f, g in ((A2, 0.5), (E3, 0.3), (A3, 0.15))) * breath
    y = np.stack([drone, drone], 1) * 0.55
    beat = sec(0.5)
    for k in range(8):                                                                        # beat pulse, accent on each bar line
        m = sec(0.2)
        tt = t_of(m)
        p = np.sin(dsp.TWO_PI * A3 * tt) * env_ad(tt, 0.003, 0.035) + svf(white(m, seed + k), 900, 1.2, "bp") * env_ad(tt, 0.001, 0.01) * 0.6
        add_wrap(y, pan_st(p, 0.0), k * beat, 0.5 if k % 4 == 0 else 0.3)
    acc = (1.0, 0.35, 0.6, 0.35)
    for k in range(32):                                                                       # 16th ticks: on the grid, level humanised by seed
        m = ms(30)
        tt = t_of(m)
        h = dsp.hp(white(m + 64, seed + 100 + k), 6500)[:m] * env_ad(tt, 0.0002, 0.004)
        add_wrap(y, pan_st(h, 0.3 if k % 2 else -0.3), k * beat // 4, 0.22 * acc[k % 4] * np.exp(r.normal(0, 0.15)))
    notes = (A5, CS6, E6, FS6, B6)
    for k in sorted(r.choice(32, 7, replace=False)):                                          # data blips on random 16ths
        m = ms(70)
        tt = t_of(m)
        f = notes[int(r.integers(len(notes)))]
        b = dsp.tri_n(np.full(m, f), m) * env_ad(tt, 0.002, 0.014)
        add_wrap(y, pan_st(b, r.uniform(-0.6, 0.6)), k * beat // 4 + ms(4), 0.16)
    air = np.stack([dsp.fft_filter(pink(LOOP, seed + 7), 2500, 9000, 2), dsp.fft_filter(pink(LOOP, seed + 8), 2500, 9000, 2)], 1)
    y += air / (np.std(air) + 1e-12) * 0.02
    return y


# ------------------------------------------------------------------------------------------------------------- brand field
@_c("snd.hit.brand_field_slam", "impact", ["anchor:crest", "size:m", "mood:warm", "soft"],
    "brand-field slam: soft low thump (95 to 52 Hz) with a papery body and a wide air bloom, for the cut to the solid brand colour", 560, tier=2,
    use=("launch", "ad", "kinetic"), pairs=("hardCut", "dip", "cut"))
def brand_field_slam(seed):
    n = sec(1.4)
    t = t_of(n)
    f = 52 + 43 * np.exp(-t / 0.04)
    thump = np.sin(dsp.phase(f)) * env_ad(t, 0.004, 0.17)
    thump += np.sin(dsp.phase(2 * f)) * env_ad(t, 0.003, 0.06) * 0.35                          # an octave so it survives a phone speaker
    body = dsp.bp(brown(n, seed), 120, 450, 2) * env_ad(t, 0.003, 0.05)
    body *= 0.5 / (np.max(np.abs(body)) + 1e-12)
    airL = dsp.bp(pink(n, seed + 1), 2500, 12000, 2)
    airR = dsp.bp(pink(n, seed + 2), 2500, 12000, 2)
    aenv = env_ad(t, 0.008, 0.3) * 0.18 / (max(np.max(np.abs(airL)), np.max(np.abs(airR))) + 1e-12)
    y = np.stack([thump + body + airL * aenv, thump + body + airR * aenv], 1)
    return dsp.reverb(y, "room", 0.08, seed)


# ------------------------------------------------------------------------------------------------------------- letters
@_c("snd.sparkle.letter_assemble", "sparkle", ["anchor:end", "size:m", "key:A", "mood:warm", "type"],
    "letters assembling: a swarm of tiny ticks that thickens, narrows to the centre and converges on A-major pitches, then a soft set-ting (anchor = the letters lock)",
    570, tier=3, tonal=True, pairs=("maskReveal", "cut"), kind="fixed")
def letter_assemble(seed):
    r = rng(seed)
    n = sec(1.15)
    lock = sec(0.82)
    y = np.zeros((n, 2))
    targets = (A6, A6 * 2 ** (4 / 12), A6 * 2 ** (7 / 12), A6 * 2)
    for i in dsp.grain_times(lock, lambda tt: 25 + 140 * np.clip(tt / 0.82, 0, 1) ** 1.6, seed):
        u = i / lock
        f0 = r.uniform(2500, 9000)
        f = np.exp(np.log(f0) + (np.log(targets[int(r.integers(4))]) - np.log(f0)) * u ** 2)
        m = ms(40)
        tt = t_of(m)
        g = np.sin(dsp.TWO_PI * f * tt) * env_ad(tt, 0.0003, r.uniform(0.004, 0.012))
        add_at(y, pan_st(g, r.uniform(-1, 1) * (1 - u) ** 1.5), int(i), 0.12 + 0.25 * u)
    ting = I.bell(A6, 0.3, 0.3, 2.0, 1.0, vel=0.9) + 0.5 * I.bell(A6 * 1.5, 0.3, 0.3, 2.0, 1.0, vel=0.7)
    add_at(y, pan_st(ting, 0.0), lock, 0.5)
    m = ms(20)
    add_at(y, pan_st(svf(white(m, seed + 9), 4500, 1.4, "bp") * env_ad(t_of(m), 0.0002, 0.0015), 0.0), lock, 0.6)
    return dsp.reverb(y, "plate", 0.1, seed), lock
