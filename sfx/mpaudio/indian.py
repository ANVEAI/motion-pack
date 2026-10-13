"""motion-pack / sfx / mpaudio / indian.py : owned synthesis of Indian instrument voices (no samples, no imitation of any recording).
Shared by sfx/recipes/indian.py (one-shots) and music/compose.py + music/theka.py (beds). Every voice returns a mono float64 array; sa_hz defaults to A (project key).
Models (starting values from physics / practice; tune by ear, nothing here has had a listening pass yet):
- tabla dayan: harmonic modal bank. Raman (1920) showed the loaded (syahi) membrane gives its first modes in ratios close to 1:2:3:4:5, so the drum
  has a clear pitch. Strokes differ by which modes ring and how long (na = rim, fundamental damped; tun = centre, fundamental rings; te = closed).
- tabla bayan: low membrane whose pitch rises with wrist pressure; modelled with a HEURISTIC exponential glide f(t) = f0 (1 + g (1 - e^(-t/tau))), not a measured model.
- sitar: Karplus-Strong + a jawari (curved bridge) one-sided contact nonlinearity, whose buzz fades as the string amplitude falls, + a sympathetic (tarab) resonator bank.
- santoor: modal hammered strings, three slightly detuned strings per course (beating).
- shehnai: narrow pulse (double-reed buzz) through a formant stack, with meend (glide into the note) and delayed vibrato.
- bansuri: sine with a weak 2nd / 3rd harmonic, breath noise in a band around f0, onset chiff and scoop.
- harmonium / shruti box: detuned reed pair (asymmetric pulse) with a bellows swell.
- percussion and metals: modal banks (nagara, dholak, thali, manjira, ghungroo, temple bell) with the usual strike transients.
JI_RATIOS: Hindustani just-intonation ratios relative to Sa (the 12 svaras as commonly tuned on a tanpura / harmonium-free ensemble)."""
import numpy as np
from . import dsp
from .dsp import SR, sec, ms, t_of, env_ad, svf, white, pink, rng, add_at, expo

SA = 220.0                     # A3: the project key. Dayan tuned to Sa.
JI_RATIOS = {0: 1.0, 1: 16 / 15, 2: 9 / 8, 3: 6 / 5, 4: 5 / 4, 5: 4 / 3, 6: 45 / 32, 7: 3 / 2, 8: 8 / 5, 9: 5 / 3, 10: 9 / 5, 11: 15 / 8}
SVARA = {0: "Sa", 1: "komal Re", 2: "Re", 3: "komal Ga", 4: "Ga", 5: "Ma", 6: "tivra Ma", 7: "Pa", 8: "komal Dha", 9: "Dha", 10: "komal Ni", 11: "Ni"}
RAGA_SCALES = {"bilawal": [0, 2, 4, 5, 7, 9, 11], "kafi": [0, 2, 3, 5, 7, 9, 10], "khamaj": [0, 2, 4, 5, 7, 9, 10], "bhairav": [0, 1, 4, 5, 7, 8, 11],
               "yaman": [0, 2, 4, 6, 7, 9, 11], "bhupali": [0, 2, 4, 7, 9], "asavari": [0, 2, 3, 5, 7, 8, 10]}


def ji_hz(sa_hz, semis):
    """just-intonation frequency of a svara `semis` semitones above Sa (any octave)"""
    o, pc = divmod(int(round(semis)), 12)
    return sa_hz * (2.0 ** o) * JI_RATIOS[pc]


def bend(x, ratio):
    """time-varying pitch shift by reading x at a variable rate (ratio > 1 = up). ratio: array of output length. Duration is the output length."""
    pos = np.cumsum(ratio) - ratio[0]
    pos = np.minimum(pos, len(x) - 2)
    return np.interp(pos, np.arange(len(x)), x)


# --------------------------------------------------------------------------------------------------------------------- tabla
DAYAN_RATIOS = (1.0, 2.0, 3.0, 4.01, 5.02, 6.04)
# stroke: (mode amps, mode t60 s, click fc Hz, click gain, click tau s)
DAYAN_STROKES = {
    "na": ((0.12, 1.0, 0.75, 0.35, 0.2, 0.1), (0.07, 0.95, 0.65, 0.45, 0.3, 0.2), 3200.0, 0.9, 0.0035),
    "tin": ((0.35, 0.85, 0.55, 0.5, 0.25, 0.12), (0.18, 1.2, 0.9, 0.7, 0.5, 0.3), 2200.0, 0.55, 0.004),
    "tun": ((1.0, 0.35, 0.18, 0.08, 0.04, 0.02), (1.5, 0.6, 0.4, 0.3, 0.2, 0.15), 1300.0, 0.35, 0.005),
    "te": ((0.7, 0.35, 0.12, 0.05, 0.02, 0.01), (0.06, 0.05, 0.04, 0.03, 0.03, 0.02), 1900.0, 1.1, 0.006),
    "re": ((0.55, 0.3, 0.1, 0.05, 0.02, 0.01), (0.05, 0.045, 0.035, 0.03, 0.03, 0.02), 2600.0, 0.9, 0.005),
}


def dayan(stroke="na", seed=1, sa_hz=SA, vel=1.0):
    amps, t60, cfc, cg, ctau = DAYAN_STROKES[stroke]
    n = sec(max(t60) * 0.9 + 0.06)
    t = t_of(n)
    y = dsp.modal(sa_hz, DAYAN_RATIOS, amps, t60, n, attack_ms=0.25, seed=seed)
    y += svf(white(n, seed + 1), cfc, 1.3, "bp") * env_ad(t, 0.0002, ctau) * cg * 2.0
    return y * vel


def bayan_ge(seed=1, f0=96.0, glide=0.32, tau_glide=0.11, decay=0.55, vel=1.0):
    """open bayan stroke with the heuristic exponential pitch glide (wrist pressure)"""
    n = sec(decay * 2.4)
    t = t_of(n)
    f = f0 * (1.0 + glide * (1.0 - np.exp(-t / tau_glide)))
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.002, decay)
    y += 0.32 * np.sin(dsp.phase(f * 1.52)) * np.exp(-t / (decay * 0.35))
    y += 0.18 * np.sin(dsp.phase(f * 2.01)) * np.exp(-t / (decay * 0.25))
    y += dsp.lp(white(n, seed), 900) * env_ad(t, 0.0005, 0.012) * 0.6
    return y * vel


def bayan_ka(seed=1, vel=1.0):
    """closed bayan slap: flat palm, no ring"""
    n = sec(0.16)
    t = t_of(n)
    y = svf(white(n, seed), 650, 1.1, "bp") * env_ad(t, 0.0003, 0.018) * 1.4
    y += np.sin(dsp.phase(np.full(n, 120.0))) * env_ad(t, 0.001, 0.03) * 0.6
    return y * vel


def tabla(bol, seed=1, sa_hz=SA, vel=1.0):
    """bol -> mono stroke. na/ta tin tun te re ge ka dha dhin dhi tirakita"""
    b = bol.lower()
    if b in ("na", "ta"):
        return dayan("na", seed, sa_hz, vel)
    if b in ("tin", "ti"):
        return dayan("tin", seed, sa_hz, vel)
    if b == "tun":
        return dayan("tun", seed, sa_hz, vel)
    if b in ("te", "tit"):
        return dayan("te", seed, sa_hz, vel)
    if b in ("re", "ra"):
        return dayan("re", seed, sa_hz, vel)
    if b in ("ge", "ghe"):
        return bayan_ge(seed, vel=vel)
    if b in ("ka", "ke", "kat"):
        return bayan_ka(seed, vel)
    if b == "dha":
        return _mix(dayan("na", seed, sa_hz, vel), bayan_ge(seed + 7, vel=vel * 0.55))
    if b in ("dhin", "dhi"):
        return _mix(dayan("tin", seed, sa_hz, vel), bayan_ge(seed + 7, vel=vel * 0.55))
    if b == "tirakita":
        return tirakita(seed, sa_hz, vel)
    raise KeyError("unknown bol " + bol)


def tirakita(seed=1, sa_hz=SA, vel=1.0, gap=0.065):
    y = np.zeros(sec(4 * gap + 0.9))
    for k, b in enumerate(("te", "re", "ka", "na")):
        add_at(y, tabla(b, seed + k, sa_hz, vel * (0.8 + 0.07 * k)), sec(k * gap))
    return y


def _mix(a, b):
    n = max(len(a), len(b))
    y = np.zeros(n)
    y[:len(a)] += a
    y[:len(b)] += b
    return y


# --------------------------------------------------------------------------------------------------------------------- strings
def jawari(x, amount=0.6, knee=0.28):
    """one-sided soft contact with the curved bridge: the positive excursion is squashed above `knee` x peak; the buzz fades as the string decays"""
    pk = np.max(np.abs(x)) + 1e-12
    k = knee * pk

    def f(z):
        over = np.logaddexp(0.0, (z - k) / (0.05 * pk)) * 0.05 * pk       # softplus(z - k)
        return z - amount * over
    y = dsp.oversample_apply(x, f, 4)
    return y - np.mean(y)


TARAB = (0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 19)          # tarab (sympathetic) strings tuned to a bilawal set above Sa


def tarab_bank(x, sa_hz=SA, q=700.0, gain=0.12, notes=TARAB):
    y = np.zeros_like(x)
    for s in notes:
        f = ji_hz(sa_hz * 2, s)
        if f < 0.45 * SR:
            y += svf(x, f, q, "bp")
    return y * gain


def sitar_pluck(f, dur=2.4, seed=1, vel=1.0, meend=None, sa_hz=SA, tarab=True, buzz=0.65):
    """meend: None or (semitones_from, glide_s) -> the note slides in from that interval. Returns mono."""
    n = sec(dur)
    if meend:
        st, gl = meend
        t = t_of(n)
        ratio = 2.0 ** (st * (1.0 - np.clip(t / gl, 0, 1)) ** 2 / 12.0)      # reading rate: starts st semitones off, settles on f
        x = dsp.ks(f, int(n * 2.0 ** (max(st, 0) / 12.0)) + 16, seed, g=0.9988, damp=0.82, bright=0.95)
        x = bend(x, ratio)[:n]
    else:
        x = dsp.ks(f, n, seed, g=0.9988, damp=0.82, bright=0.95)
    t = t_of(n)
    x = jawari(x, buzz)
    x += svf(white(n, seed + 3), 3500, 1.0, "bp") * env_ad(t, 0.0002, 0.004) * 0.6 * (np.max(np.abs(x)) + 1e-9)   # mizrab (plectrum) tick
    if tarab:
        x = x + tarab_bank(x, sa_hz)
    x = x * np.where(t > dur - 0.05, np.cos(np.clip((t - (dur - 0.05)) / 0.05, 0, 1) * np.pi / 2), 1.0)
    return x / (np.max(np.abs(x)) + 1e-9) * vel


def sitar_jhala(seed=1, sa_hz=SA, notes=(0, 0, 7, 0, 0, 12, 0, 0, 9, 0, 0, 7), rate=11.0, vel=1.0):
    """jhala: fast alternation of melody strokes with the chikari (high drone strings, Sa'' and Pa'')"""
    gap = 1.0 / rate
    y = np.zeros(sec(len(notes) * gap + 1.4))
    for k, s in enumerate(notes):
        if k % 3 == 0:
            v = sitar_pluck(ji_hz(sa_hz, s), 1.2, seed + k, 1.0, sa_hz=sa_hz, tarab=False)
        else:
            v = sitar_pluck(ji_hz(sa_hz * 4, 0 if k % 3 == 1 else 7), 0.35, seed + k, 0.45, sa_hz=sa_hz, tarab=False, buzz=0.8)
        add_at(y, v, sec(k * gap))
    return y + tarab_bank(y, sa_hz, gain=0.08)


def santoor_hit(f, dur=2.6, seed=1, vel=1.0):
    n = sec(dur)
    t = t_of(n)
    y = np.zeros(n)
    for k, c in enumerate((-1.6, 0.0, 1.4)):
        y += dsp.modal(f * 2 ** (c / 1200), (1.0, 2.003, 3.009, 4.02, 5.04), (1.0, 0.5, 0.33, 0.18, 0.1), (dur * 0.9, dur * 0.6, dur * 0.45, 0.6, 0.4), n, attack_ms=0.2, seed=seed + k)
    y /= 3.0
    y += svf(white(n, seed + 9), 2600, 1.1, "bp") * env_ad(t, 0.0002, 0.003) * 0.7
    return y * vel


# --------------------------------------------------------------------------------------------------------------------- winds / reeds
def shehnai_note(f, dur=1.2, seed=1, vel=1.0, meend=-2.0, glide_s=0.22, vib_cents=28.0):
    n = sec(dur)
    t = t_of(n)
    fr = f * 2.0 ** ((meend * np.clip(1 - t / glide_s, 0, 1) ** 2) / 12.0) if meend else np.full(n, f)
    vd = vib_cents * np.clip((t - 0.3) / 0.3, 0, 1)
    fr = fr * 2 ** (vd / 1200 * np.sin(dsp.TWO_PI * 5.6 * t))
    src = dsp.pulse_n(fr, n, 0.13)
    y = np.zeros(n)
    for F, q, g in ((720, 4.0, 1.0), (1300, 5.0, 0.85), (2500, 6.0, 0.55), (3400, 8.0, 0.3)):
        y += svf(src, F, q, "bp") * g
    y += dsp.hp(white(n, seed), 2500) * 0.03
    e = np.minimum(t / 0.06, 1.0) ** 2 * np.where(t > dur - 0.09, np.clip((dur - t) / 0.09, 0, 1), 1.0)
    return y * e * vel


def bansuri_note(f, dur=1.4, seed=1, vel=1.0, vib_cents=14.0):
    n = sec(dur)
    t = t_of(n)
    fr = f * (1 - 0.025 * np.exp(-t / 0.05)) * 2 ** (vib_cents * np.clip((t - 0.35) / 0.4, 0, 1) / 1200 * np.sin(dsp.TWO_PI * 4.8 * t))
    ph = dsp.phase(fr)
    y = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    br = svf(white(n, seed), fr, 12.0, "bp") * 0.08 + dsp.hp(white(n, seed + 1), 3000) * 0.015
    chiff = svf(white(n, seed + 2), 2 * f, 3.0, "bp") * env_ad(t, 0.004, 0.03) * 0.8
    e = np.minimum(t / 0.08, 1.0) ** 2 * np.where(t > dur - 0.12, np.clip((dur - t) / 0.12, 0, 1), 1.0)
    return (y + br) * e * vel + chiff * vel


def reed(f, n, seed=1, cents=4.0, width=0.32, circular=False):
    """detuned reed pair (free reed: asymmetric pulse), low-passed (circular=True: zero-phase FFT low-pass so a loop stays seamless)"""
    a = dsp.pulse_n(np.asarray(f) * 2 ** (-cents / 2400), n, width, rng(seed).random())
    b = dsp.pulse_n(np.asarray(f) * 2 ** (cents / 2400), n, width, rng(seed + 1).random())
    return (dsp.fft_filter(a + b, None, 3200, 2) if circular else dsp.lp(a + b, 3200, 2)) * 0.5


def harmonium_chord(freqs, dur=1.6, seed=1, vel=1.0):
    n = sec(dur)
    t = t_of(n)
    y = np.zeros(n)
    for k, f in enumerate(freqs):
        y += reed(f, n, seed + 2 * k)
    bellows = (0.8 + 0.2 * np.sin(dsp.TWO_PI * 0.7 * t - np.pi / 2)) * np.minimum(t / 0.09, 1.0) ** 2
    rel = np.where(t > dur - 0.15, np.clip((dur - t) / 0.15, 0, 1), 1.0)
    return y / max(1, len(freqs)) * bellows * rel * vel


def shruti_loop(n, seed=1, sa_hz=110.0, bellows_hz=0.25):
    """drone loop of length n (frequencies must be k / (n/SR) for a seamless wrap: callers pass n = 8 s and snapped tones). Sa, Pa, Sa'"""
    t = t_of(n)
    y = np.zeros(n)
    for k, (f, g) in enumerate(((sa_hz, 1.0), (sa_hz * 1.5, 0.7), (sa_hz * 2.0, 0.55))):
        y += reed(np.full(n, f), n, seed + 3 * k, cents=0.0, circular=True) * g
        y += reed(np.full(n, f + 0.25), n, seed + 3 * k + 1, cents=0.0, circular=True) * g * 0.8      # 0.25 Hz beating, integer cycles over 8 s
    return y * (0.82 + 0.18 * np.sin(dsp.TWO_PI * bellows_hz * t))


def shankh(seed=1, f0=338.0, dur=2.4, vel=1.0):
    n = sec(dur)
    t = t_of(n)
    f = f0 * (0.86 + 0.14 * (1 - np.exp(-t / 0.18))) * (1 - 0.04 * np.clip((t - (dur - 0.45)) / 0.45, 0, 1))
    f = f * (1 + 0.003 * np.sin(dsp.TWO_PI * 4.2 * t))
    y = dsp.formant_voice(f, [620.0, 1150.0, 2450.0, 3300.0], n, seed, oq=0.35, breath=0.12, gains=(1.0, 0.75, 0.4, 0.2))
    e = np.minimum(t / 0.28, 1.0) ** 2 * np.where(t > dur - 0.4, np.clip((dur - t) / 0.4, 0, 1), 1.0)
    return y * e * vel


# --------------------------------------------------------------------------------------------------------------------- percussion / metals
def nagara(seed=1, f0=68.0, vel=1.0):
    n = sec(1.3)
    t = t_of(n)
    f = f0 * (1 + 0.15 * np.exp(-t / 0.04))
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.0015, 0.42)
    for r, a, d in ((1.5, 0.45, 0.25), (1.98, 0.3, 0.18), (2.44, 0.2, 0.12), (2.9, 0.12, 0.08)):
        y += a * np.sin(dsp.phase(f * r)) * np.exp(-t / d)
    y += svf(white(n, seed), 1500, 0.9, "bp") * env_ad(t, 0.0002, 0.006) * 1.6
    return y * vel


def dholak_ge(seed=1, vel=1.0):
    return bayan_ge(seed, f0=112.0, glide=0.18, tau_glide=0.07, decay=0.32, vel=vel)


def dholak_dha(seed=1, vel=1.0):
    n = sec(0.35)
    t = t_of(n)
    tr = dsp.modal(330.0, (1.0, 1.62, 2.31, 2.9), (1.0, 0.6, 0.4, 0.2), (0.16, 0.1, 0.07, 0.05), n, seed=seed)
    tr += svf(white(n, seed + 1), 3000, 1.2, "bp") * env_ad(t, 0.0002, 0.004) * 1.2
    return _mix(tr * 1.6, dholak_ge(seed + 3, 0.7)) * vel


def manjira(seed=1, vel=1.0):
    n = sec(1.7)
    t = t_of(n)
    y = np.zeros(n)
    for k, d in enumerate((0.0, 1.7)):          # two cups, beating doublet
        y += dsp.modal(1880.0 * (1 + d / 1000), (1.0, 1.47, 2.09, 2.56, 3.18, 3.91), (1.0, 0.7, 0.55, 0.4, 0.3, 0.2), (1.4, 1.1, 0.9, 0.7, 0.5, 0.35), n, attack_ms=0.1, seed=seed + k)
    y += dsp.hp(white(n, seed + 5), 5000) * env_ad(t, 0.0002, 0.01) * 0.8
    return y * 0.5 * vel


def ghungroo(seed=1, vel=1.0, shakes=2, bells=26, span=0.32):
    r = rng(seed)
    n = sec(span * shakes + 0.35)
    y = np.zeros(n)
    for s in range(shakes):
        for b in range(bells):
            f = r.uniform(3400, 6800)
            m = sec(0.2)
            v = dsp.modal(f, (1.0, 2.32, 4.25), (1.0, 0.4, 0.15), (0.16, 0.08, 0.04), m, attack_ms=0.05, seed=seed + 31 * s + b)
            pos = sec(s * span + abs(r.normal(0.0, 0.045)))
            add_at(y, v, pos, np.exp(r.normal(-0.7, 0.4)))
    return y * vel


def thali(seed=1, vel=1.0):
    n = sec(1.5)
    t = t_of(n)
    r = rng(seed)
    ratios = (1.0, 1.59, 2.14, 2.30, 2.65, 2.92, 3.16, 3.50, 4.15, 4.9)
    amps = tuple(float(a) for a in r.uniform(0.25, 1.0, len(ratios)) * np.linspace(1.0, 0.4, len(ratios)))
    t60 = tuple(float(d) for d in np.linspace(1.3, 0.45, len(ratios)))
    y = dsp.modal(420.0, ratios, amps, t60, n, attack_ms=0.1, seed=seed)
    y += svf(white(n, seed + 1), 4200, 1.0, "bp") * env_ad(t, 0.0002, 0.003) * 1.5
    return y * vel


def temple_bell(seed=1, f=520.0, vel=1.0, dur=5.5):
    """ghanta: church-bell-like partials (hum, prime, minor third, fifth, nominal ...) with doublet beating and a clapper tick"""
    n = sec(dur)
    t = t_of(n)
    ratios = (0.5, 1.0, 1.183, 1.506, 2.0, 2.514, 2.662, 3.011, 4.166)
    amps = (0.55, 1.0, 0.6, 0.45, 0.7, 0.35, 0.3, 0.22, 0.12)
    t60 = (dur, dur * 0.9, dur * 0.75, dur * 0.65, dur * 0.55, dur * 0.4, dur * 0.35, dur * 0.28, dur * 0.18)
    y = dsp.modal(f, ratios, amps, t60, n, attack_ms=0.1, seed=seed) + dsp.modal(f * 1.0016, ratios, amps, t60, n, attack_ms=0.1, seed=seed + 1)
    y += svf(white(n, seed + 2), 4000, 1.5, "bp") * env_ad(t, 0.0001, 0.002) * 2.0
    return y * 0.5 * vel


def tanpura_cycle(n, seed=1, sa_hz=110.0, start=0.0, cycle_s=4.0, pa=True):
    """one tanpura cycle written into a buffer of length n with wrap-around: Pa (mandra) - Sa - Sa - Sa (kharaj), jivari buzz on every string"""
    y = np.zeros(n)
    strings = [(sa_hz * 0.75 if pa else sa_hz * 2 / 3 * 1.0, 0.0), (sa_hz, 0.22), (sa_hz, 0.44), (sa_hz / 2, 0.66)]
    for k, (f, frac) in enumerate(strings):
        v = dsp.ks(f, sec(cycle_s * 1.1), seed + k, g=0.99935, damp=0.7, bright=0.9)
        v = jawari(v, 0.75, 0.22) * (0.9 if k else 0.8)
        v *= np.where(np.arange(len(v)) > len(v) - sec(0.3), np.cos(np.clip((np.arange(len(v)) - (len(v) - sec(0.3))) / sec(0.3), 0, 1) * np.pi / 2), 1.0)
        st = int(sec(start + frac * cycle_s)) % n
        first = min(len(v), n - st)
        y[st:st + first] += v[:first]
        if first < len(v):
            rem = v[first:]
            y[:min(len(rem), n)] += rem[:n]
    return y
