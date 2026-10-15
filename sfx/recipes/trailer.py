"""Trailer family (2026-10-16, film lane): the sound shapes a modern film trailer is cut on, synthesised from scratch (numpy/scipy, seeded, no samples).
Craft learned from how trailers are built (docs/research/film-trailer-craft.md), never copied from any trailer, score or sample library:
  braams        brass-like low blasts (detuned saw stacks on A1 / E2 / A2, a filter that bites then closes, tanh growl, a sub layer): the "the stakes just rose" hit
  booms         a sub boom with a chest punch and a long cavern tail; a metallic impact (inharmonic anvil modes + sub + crack + a ringing hall)
  sub drop      a slow 60 -> 30 Hz drop under a title or a cut to black
  reverse       reverse swells of 1, 2 and 4 s and a reverse braam: they END on the anchor (the hit lands there)
  risers        tension risers of 1, 2, 4 and 6 bars at 120 BPM (2, 4, 8, 12 s): a Shepard climb + band-passed noise + a string cluster that tightens + an
                accelerating pulse; the anchor is the END sample: put it ONE FRAME BEFORE the hit (cue frame = hit frame - 1)
  clocks        a seamless 4 s tick-tock loop at 120 BPM and an 8 s accelerating clock that ends on its anchor
  heart         a seamless 4 s heartbeat loop at 75 BPM (5 lub-dubs per loop)
  whooshes      a trailer pass-by (Doppler body, anchor = the pass) and a reverse suck that ends on its anchor (the hard stop into silence)
  beds          8 s seamless loops: a dark drone, a bowed-metal drone, a tremolo tension-strings bed (every periodic part has a whole number of cycles per loop)
  silence       a tinnitus ring for the "silence before the hit", the hit-silence-hit pattern as one file (the second hit 2.0 s after the anchor), a button sting
Everything is in A (the pack key) so it sits on the music module's beds. Measured, never auditioned by a human: listen once before a hero use."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, ms, db, t_of, env_ad, svf, white, pink, brown, rng, add_at, pan_st, expo
from mpaudio.registry import snd
from .ambience import add_wrap

A0, A1, E2, A2, C3, E3, A3 = 27.5, 55.0, 82.41, 110.0, 130.81, 164.81, 220.0
BAR = 2.0                       # one bar at 120 BPM


def _t(id, tags, desc, seed, tier=1, use=("trailer", "short_film", "launch"), pairs=("cut",), kind="fixed", tonal=True, loop=False, **kw):
    return snd(id, "trailer", ["family:trailer", "trailer", "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), "mood:cinematic", *tags], tier=tier, use=list(use),
               pairs=list(pairs), desc=desc, kind=kind, tonal=tonal, loop=loop, seed=seed, **kw)


def _click(n, seed, fc=2500.0, q=1.0, dur=0.003, g=1.0):
    t = t_of(n)
    return svf(white(n, seed), fc, q, "bp") * env_ad(t, 0.0002, dur) * g * 3.0


def _st(y, seed, wide=0.6):
    """mono -> a wide stereo image (decorrelated side)"""
    if y.ndim == 2:
        return y
    s = dsp.decorrelate(y, seed, 9.0)
    return dsp.widen(s, 1.0 + wide)


# ------------------------------------------------------------------------------------------------------------------------------------- braams
def braam(seed, notes=(A1, E2, A2), dur=3.6, bite=2800.0, close=0.65, growl=0.35, sub=0.9, voices=6, drive=1.8, attack=0.035):
    """the braam: per note `voices` detuned saws; a low-pass that opens to `bite` Hz on the attack and closes with time constant `close`;
    an AM growl (7 Hz, fading) and tanh drive for the brass edge; a sine sub on the lowest note. Returns (stereo, anchor = the onset)."""
    pre = ms(20)
    n = sec(dur) + pre
    t = np.maximum(t_of(n) - pre / SR, 0.0)
    r = rng(seed)
    y = np.zeros((n, 2))
    for j, f in enumerate(notes):
        for k in range(voices):
            c = (k - (voices - 1) / 2) * 9.0 + r.uniform(-2, 2)
            v = dsp.saw_n(f * 2 ** (c / 1200) * (1 + 0.004 * np.exp(-t / 0.08)), n, r.random())
            y += pan_st(v, (k / max(1, voices - 1) - 0.5) * 0.8) * (1.0 if j == 0 else 0.75)
    fc = 120.0 + (bite - 120.0) * np.exp(-t / close) * np.minimum(1.0, t / 0.05)
    y = np.stack([svf(y[:, 0], fc, 1.3, "lp"), svf(y[:, 1], fc * 1.02, 1.3, "lp")], 1)
    am = 1.0 - growl * np.exp(-t / 0.9) * (0.5 + 0.5 * np.sin(dsp.TWO_PI * 7.0 * t))
    e = env_ad(t, attack, dur * 0.42) * (t_of(n) >= pre / SR)
    y = y * (am * e)[:, None] / (voices * len(notes) * 0.5)
    y = dsp.soft_clip(y * drive, 1.0) / drive * 1.6
    s = np.sin(dsp.phase(np.full(n, notes[0]))) * env_ad(t, attack * 0.6, dur * 0.5) * (t_of(n) >= pre / SR) * sub
    y += pan_st(s, 0.0)
    y = dsp.reverb(y, "hall", 0.22, seed)
    return y, pre


@_t("snd.trailer.braam_low", ["anchor:onset", "size:xl", "brass", "braam", "key:A"],
    "trailer braam on A1 / E2 / A2: detuned saw stacks, a bite that closes, a fading growl, a sine sub; 3.6 s + hall; anchor = the onset (cut on it)", 1301,
    pairs=("cut", "dipToBlack", "smash"))
def braam_low(seed):
    return braam(seed)


@_t("snd.trailer.braam_octave", ["anchor:onset", "size:xl", "brass", "braam", "key:A", "minor"],
    "heavier braam: A1 + A2 + C3 + E3 (A minor, wide), more drive, longer bite; for the last act-3 downbeat or the title", 1302, pairs=("cut", "smash"))
def braam_octave(seed):
    return braam(seed, (A1, A2, C3, E3), dur=4.2, bite=3600.0, close=0.9, growl=0.45, drive=2.4, voices=5)


@_t("snd.trailer.braam_short", ["anchor:onset", "size:m", "brass", "braam", "pulse", "key:A", "rr:4"],
    "short braam stab, 1.1 s: the montage pulse on act-2 / act-3 downbeats (rr:4: four takes)", 1303, tier=2, pairs=("cut",))
def braam_short(seed):
    y, a = braam(seed, (A1, E2), dur=1.1, bite=2200.0, close=0.22, growl=0.2, sub=0.7, voices=5, drive=1.6, attack=0.012)
    return y[:a + sec(1.6)], a


@_t("snd.trailer.reverse_braam", ["anchor:end", "size:l", "brass", "braam", "reverse", "key:A"],
    "reverse braam, 2.4 s: the braam's hall tail played backwards, swelling into its anchor at the END (it sucks into the title hit; cue it on the hit frame)", 1304,
    pairs=("cut", "dipToBlack"))
def reverse_braam(seed):
    y, a = braam(seed, dur=2.0)
    y = y[a:a + sec(2.4)][::-1].copy()
    y *= np.linspace(0.3, 1.0, len(y))[:, None] ** 2
    tail = sec(0.03)
    y = np.concatenate([y, y[-1:] * np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 2], 0)
    return y, len(y) - tail - 1


# ------------------------------------------------------------------------------------------------------------------------------------- booms + impacts
def boom(seed, f0=118.0, f1=31.0, glide=0.22, tau=0.9, length=3.4, body=1.3, room="cavern", wet=0.3):
    n = sec(length)
    t = t_of(n)
    f = f1 + (f0 - f1) * np.exp(-t / glide)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.002, tau)
    y += dsp.oversample_apply(np.sin(dsp.phase(f * 2.0)) * env_ad(t, 0.001, 0.12) * 0.5, lambda z: np.tanh(z * 2.0), 4)
    y += dsp.lp(brown(n, seed), 350.0) * env_ad(t, 0.001, 0.22) * body
    y += svf(white(n, seed + 1), expo(6000.0, 300.0, t / 0.4), 0.8, "lp") * env_ad(t, 0.0005, 0.06) * 0.7
    return dsp.reverb(_st(y, seed, 0.3), room, wet, seed)


@_t("snd.trailer.boom_hit", ["anchor:crest", "size:xl", "sub", "boom"],
    "trailer boom: 118 -> 31 Hz sub with a driven chest punch, a brown-noise body, a closing crack and a cavern tail (about 5 s); anchor = the punch", 1310,
    kind="peak", pairs=("cut", "dipToBlack", "smash", "flash"))
def boom_hit(seed):
    return boom(seed)


@_t("snd.trailer.boom_metal", ["anchor:crest", "size:xl", "metal", "impact", "sub"],
    "metallic trailer impact: inharmonic anvil modes (1, 2.32, 4.25, 6.63, 9.38) on a sub boom, a broadband crack and a long ringing hall", 1311,
    kind="peak", pairs=("cut", "smash", "flash"))
def boom_metal(seed):
    n = sec(3.6)
    t = t_of(n)
    y = boom(seed, 96.0, 34.0, 0.18, 0.6, 3.6, 0.8, "hall", 0.0)[:n, 0]
    y += dsp.modal(311.0, (1.0, 2.32, 4.25, 6.63, 9.38), (1.0, 0.7, 0.5, 0.35, 0.2), (1.6, 1.1, 0.7, 0.45, 0.3), n, phases=(0, 0, 0, 0, 0)) * 0.55
    y += svf(white(n, seed + 7), 3800.0, 0.6, "bp") * env_ad(t, 0.0002, 0.012) * 2.2
    return dsp.reverb(_st(y, seed, 0.5), "hall", 0.32, seed)


@_t("snd.trailer.metal_hit", ["anchor:crest", "size:m", "metal", "impact", "rr:4"],
    "short steel hit, 1.2 s: a struck plate (bar modes), a crack and a small room; for montage cuts and card slams (rr:4)", 1312, tier=2, kind="peak", pairs=("cut", "smash"))
def metal_hit(seed):
    n = sec(1.2)
    t = t_of(n)
    r = rng(seed)
    f0 = 520.0 * (1 + r.uniform(-0.06, 0.06))
    y = dsp.modal(f0, (1.0, 2.756, 5.404, 8.933), (1.0, 0.6, 0.35, 0.2), (0.5, 0.3, 0.18, 0.1), n, phases=(0, 0, 0, 0)) * 0.8
    y += svf(white(n, seed), 4500.0, 0.8, "bp") * env_ad(t, 0.0002, 0.01) * 2.0
    y += np.sin(dsp.phase(70.0 + 60.0 * np.exp(-t / 0.03))) * env_ad(t, 0.001, 0.12) * 0.8
    return dsp.reverb(_st(y, seed, 0.4), "room", 0.25, seed)


@_t("snd.trailer.hit_title", ["anchor:crest", "size:xl", "sub", "braam", "metal", "reverse-swell", "title"],
    "the title-card hit: a 0.5 s reverse swell into a braam, a boom and a metal ring together; anchor = the hit (the swell sits before it), long hall tail", 1313,
    pairs=("cut", "dipToBlack", "flash"))
def hit_title(seed):
    pre = sec(0.5)
    br, ba = braam(seed, (A1, E2, A2, E3), dur=4.0, bite=3200.0, close=0.8, growl=0.4, drive=2.2, voices=5)
    bm = boom(seed + 1, 130.0, 30.0, 0.25, 1.0, 4.0)
    mt = metal_hit(seed + 2)
    n = pre + max(len(br) - ba, len(bm)) + sec(0.2)
    y = np.zeros((n, 2))
    add_at(y, br[ba:], pre, 0.9)
    add_at(y, bm, pre, 1.0)
    add_at(y, dsp.stereo(mt), pre, 0.35)
    sw = dsp.reverb(_st(svf(white(sec(0.9), seed + 4), 1800.0, 0.7, "bp") * env_ad(t_of(sec(0.9)), 0.001, 0.25), seed), "hall", 0.6, seed)
    sw = sw[::-1][-pre:] * np.linspace(0, 1, pre)[:, None] ** 3
    add_at(y, sw, 0, 0.8)
    return y, pre


@_t("snd.trailer.sub_drop_long", ["anchor:crest", "size:l", "sub", "drop"],
    "long sub drop, 3 s: 62 -> 30 Hz under a title or a cut to black, a soft click on the onset; anchor = the onset", 1314, pairs=("cut", "dipToBlack"))
def sub_drop_long(seed):
    pre = ms(5)
    n = sec(3.0) + pre
    t = np.maximum(t_of(n) - pre / SR, 0)
    f = expo(62.0, 30.0, t / 1.4)
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.004, 1.1) * (t_of(n) >= pre / SR)
    y += _click(n, seed, 2200.0, 1.0, 0.003, 0.25) * (t_of(n) >= pre / SR)
    return y, pre


# ------------------------------------------------------------------------------------------------------------------------------------- reverse swells
def rev_swell(seed, length):
    """a reverse swell of exactly `length` s: decorrelated band-passed noise plus A-minor partials whose envelopes are reversed hall decays (each partial
    rises on its own curve: high partials late, as a reversed tail does), a light hall for air; it ends on the anchor, then a 25 ms fall"""
    m = sec(length)
    u = np.linspace(0.0, 1.0, m)
    r = rng(seed)
    nz = np.stack([white(m, seed), white(m, seed + 1)], 1)
    fc = expo(500.0, 3800.0, u)
    nz = np.stack([svf(nz[:, 0], fc, 0.7, "bp"), svf(nz[:, 1], fc * 1.03, 0.7, "bp")], 1)
    w = nz * (u ** 2.4)[:, None] * 0.9
    for k, f in enumerate((A2, C3, E3, A3, 440.0)):
        e = np.exp(-(1.0 - u) * length / (0.35 + 0.25 * (4 - k)))
        w += pan_st(np.sin(dsp.TWO_PI * f * t_of(m) + r.uniform(0, 6.28)) * e * 0.18, (k - 2) * 0.3)
    w = dsp.reverb(w, "hall", 0.12, seed)[:m]
    w *= np.minimum(1.0, u / 0.15)[:, None]
    tail = ms(25)
    w = np.concatenate([w, w[-1:] * np.cos(np.linspace(0, np.pi / 2, tail))[:, None] ** 2], 0)
    return w, m - 1


for _L, _s in ((1, 1320), (2, 1321), (4, 1322)):
    def _mk(L=_L, s=_s):
        @_t("snd.trailer.reverse_swell_%ds" % L, ["anchor:end", "reverse", "swell", "size:%s" % ("s" if L == 1 else "m" if L == 2 else "l")],
            "reverse swell, %d s: a reversed hall tail that rises and ENDS on the anchor (cue it on the hit frame: the hit lands where the swell ends)" % L, s,
            tier=2, pairs=("cut", "dipToBlack", "flash"))
        def f(seed):
            return rev_swell(seed, float(L))
        return f
    _mk()


# ------------------------------------------------------------------------------------------------------------------------------------- tension risers
def tension_riser(seed, bars):
    """a riser of `bars` bars at 120 BPM: Shepard climb (always rising), band-passed noise that opens, a tremolo string cluster on A / Bb / E that
    tightens (trem 6 -> 18 Hz), an accelerating sub pulse (1 per beat -> 1 per 16th). Anchor = the last sample."""
    n = sec(bars * BAR)
    t = t_of(n)
    u = t / (bars * BAR)
    y = np.zeros(n)
    for k in range(9):                                            # Shepard: octave-spaced partials, gaussian in log-frequency, one octave over the riser
        f = 30.0 * 2.0 ** (k + u)
        w = np.exp(-0.5 * (np.log2(f / 800.0) / 1.3) ** 2)
        y += w * np.sin(dsp.phase(f)) * 0.22
    nz = white(n, seed)
    y += svf(nz, expo(300.0, 7000.0, u), 2.0 + 4.0 * u, "bp") * 0.5
    trem = 6.0 + 12.0 * u
    tr = 0.55 + 0.45 * np.sin(dsp.phase(trem))
    for f, g in ((A3, 1.0), (233.08, 0.8), (329.63, 0.7), (440.0, 0.5)):
        for k in range(3):
            y += dsp.saw_n(f * 2 ** ((k - 1) * 6 / 1200) * (1 + 0.06 * u), n, rng(seed + k).random()) * g * 0.05 * tr
    beats = []
    pos = 0.0
    while pos < bars * BAR - 0.06:
        beats.append(pos)
        uu = pos / (bars * BAR)
        pos += 0.5 / (1 + 3 * uu ** 1.5)
    for b in beats:
        i = int(b * SR)
        m = sec(0.25)
        tt = t_of(m)
        add_at(y, np.sin(dsp.phase(48.0 + 50.0 * np.exp(-tt / 0.02))) * env_ad(tt, 0.001, 0.07) * (0.3 + 0.6 * b / (bars * BAR)), i)
    y *= (0.05 + 0.95 * u ** 2.2)
    y = dsp.fade_in(y, ms(30))
    return _st(y, seed, 0.7), n - 1


for _b, _s in ((1, 1330), (2, 1331), (4, 1332), (6, 1333)):
    def _mk(b=_b, s=_s):
        @_t("snd.trailer.riser_%ds" % int(b * BAR), ["anchor:end", "riser", "bars:%d" % b, "bpm:120", "shepard", "strings", "size:%s" % ("s" if b == 1 else "m" if b == 2 else "l")],
            "tension riser, %d bar%s at 120 BPM (%d s): Shepard climb, opening noise, a tightening string cluster, an accelerating sub pulse; anchor = the END: "
            "cue it ONE FRAME BEFORE the hit" % (b, "" if b == 1 else "s", int(b * BAR)), s, tier=1 if b >= 4 else 2, pairs=("cut", "flash", "smash", "dipToBlack"))
        def f(seed):
            return tension_riser(seed, b)
        return f
    _mk()


# ------------------------------------------------------------------------------------------------------------------------------------- clocks + heart
def _tick(seed, f0, vel=1.0):
    m = sec(0.09)
    tt = t_of(m)
    y = dsp.modal(f0, (1.0, 2.41, 3.9), (1.0, 0.5, 0.25), (0.03, 0.02, 0.012), m, phases=(0, 0, 0)) * 0.8
    y += svf(white(m, seed), f0 * 2.2, 2.0, "bp") * env_ad(tt, 0.0002, 0.004) * 1.5
    return y * vel


@_t("snd.trailer.clock_tick_loop", ["anchor:loop", "clock", "tick", "bpm:120", "loop"],
    "ticking clock, 4.0 s seamless loop at 120 BPM: a tick (2.1 kHz) and a lower tock (1.6 kHz) on every beat, a small room; start it on a beat", 1340,
    tier=2, kind="fixed", loop=True, tonal=False, pairs=("cut",))
def clock_tick_loop(seed):
    L = sec(4.0)
    y = np.zeros(L)
    for k in range(8):
        add_wrap(y, _tick(seed + k % 2, 2100.0 if k % 2 == 0 else 1600.0, 1.0 if k % 2 == 0 else 0.8), int(k * 0.5 * SR) + ms(2))
    r = dsp.reverb(y, "room", 0.18, seed)
    out = r[:L].copy()
    out[:len(r) - L] += r[L:]
    return out


@_t("snd.trailer.clock_accel", ["anchor:end", "clock", "tick", "riser", "accelerate"],
    "accelerating clock, 8 s: ticks from one per beat to one per 32nd note, rising in level and pitch; anchor = the END (cue it one frame before the hit)", 1341,
    tier=2, tonal=False, pairs=("cut", "smash"))
def clock_accel(seed):
    n = sec(8.0)
    y = np.zeros(n)
    pos, k = 0.0, 0
    while pos < 7.96:
        u = pos / 8.0
        add_at(y, _tick(seed + k, 1600.0 * (1 + 0.5 * u) if k % 2 else 2100.0 * (1 + 0.5 * u), 0.35 + 0.65 * u ** 1.5), int(pos * SR))
        pos += 0.5 / (1 + 15 * u ** 2.2)
        k += 1
    y = dsp.reverb(y, "room", 0.15, seed)[:n]
    return y, n - 1


@_t("snd.trailer.heartbeat_loop", ["anchor:loop", "heart", "pulse", "sub", "loop", "bpm:75"],
    "heartbeat, 4.0 s seamless loop at 75 BPM: 5 lub-dubs (a 52 Hz thump and a softer 64 Hz one 0.22 s later); under a quiet scene or the silence", 1342,
    tier=2, kind="fixed", loop=True, pairs=("cut", "dipToBlack"))
def heartbeat_loop(seed):
    L = sec(4.0)
    y = np.zeros(L)
    m = sec(0.35)
    tt = t_of(m)
    lub = np.sin(dsp.phase(52.0 + 40.0 * np.exp(-tt / 0.02))) * env_ad(tt, 0.003, 0.07) + dsp.lp(brown(m, seed), 180.0) * env_ad(tt, 0.002, 0.04) * 0.8
    dub = np.sin(dsp.phase(64.0 + 40.0 * np.exp(-tt / 0.015))) * env_ad(tt, 0.002, 0.05) * 0.7
    for k in range(5):
        add_wrap(y, lub, int(k * 0.8 * SR) + ms(2))
        add_wrap(y, dub, int((k * 0.8 + 0.22) * SR))
    return y - _circ_lp(y, 30.0)                                     # circular high-pass: keeps the seam and drops the sub-28 Hz energy


# ------------------------------------------------------------------------------------------------------------------------------------- whooshes
@_t("snd.trailer.whoosh_by", ["anchor:crest", "whoosh", "doppler", "pass-by", "size:l"],
    "trailer pass-by, 1.8 s: a low noise body and a tone with a Doppler fall, panned left to right; anchor = the pass (peaks on the cut)", 1350,
    tier=2, kind="peak", tonal=False, pairs=("whip", "cut", "push", "zoomThrough"))
def whoosh_by(seed):
    n = sec(1.8)
    t = t_of(n)
    c = 0.9
    d = (t - c) / 0.32
    amp = 1.0 / (1.0 + d ** 2)
    nz = svf(pink(n, seed), 260.0 + 900.0 * amp, 0.7, "bp") * amp * 1.4
    nz += svf(white(n, seed + 1), 1800.0 + 3000.0 * amp, 1.2, "bp") * amp ** 2 * 0.35
    f = 140.0 * (1 + 0.18 * np.tanh(-d))
    tone = np.sin(dsp.phase(f)) * amp * 0.45
    pan = np.tanh(d * 1.3) * 0.85
    return pan_st(nz + tone, pan)


@_t("snd.trailer.whoosh_suck", ["anchor:end", "whoosh", "reverse", "suck", "stop"],
    "reverse suck, 1.0 s: air pulled in, ENDING on the anchor (the hard stop into silence; cue it on the frame the picture cuts to black)", 1351,
    tier=2, tonal=False, pairs=("cut", "dipToBlack"))
def whoosh_suck(seed):
    n = sec(1.0)
    t = t_of(n)
    u = t / 1.0
    y = svf(pink(n, seed), expo(200.0, 4200.0, u), 0.9, "bp") * u ** 2.6 * 1.6
    y += svf(white(n, seed + 1), expo(800.0, 9000.0, u), 2.0, "bp") * u ** 4 * 0.4
    tail = ms(8)
    y = np.concatenate([y, y[-1:] * np.cos(np.linspace(0, np.pi / 2, tail)) ** 2])
    return _st(y, seed, 0.8), n - 1


# ------------------------------------------------------------------------------------------------------------------------------------- beds (8 s seamless loops)
L8 = sec(8.0)


def _cyc(f):
    return round(f * 8.0) / 8.0


def _circ_lp(y, fc):
    X = np.fft.rfft(y, axis=0)
    f = np.fft.rfftfreq(len(y), 1.0 / SR)
    g = 1.0 / (1.0 + (f / fc) ** 4)
    return np.fft.irfft(X * (g[:, None] if y.ndim == 2 else g), len(y), axis=0)


@_t("snd.trailer.drone_dark_loop", ["anchor:loop", "drone", "dark", "sub", "loop", "key:A"],
    "dark trailer drone, 8.0 s seamless loop: A0 / A1 / E2 beating partials, a circular low rumble and a slow breathing filter (whole cycles per loop)", 1360,
    tier=3, kind="fixed", loop=True, pairs=("cut", "dipToBlack"))
def drone_dark_loop(seed):
    t = t_of(L8)
    y = np.zeros((L8, 2))
    for f, g in ((A1, 1.0), (_cyc(A1 * 1.004), 0.8), (_cyc(E2), 0.45), (_cyc(A2 * 0.997), 0.3)):
        for ch in (0, 1):
            ff = _cyc(f + (0.125 if ch else -0.125))
            ph = dsp.TWO_PI * ff * t
            y[:, ch] += (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * g
    rum = np.stack([brown(L8, seed), brown(L8, seed + 1)], 1)
    rum = rum - rum.mean(0)
    rum = _circ_lp(rum, 90.0) - _circ_lp(rum, 34.0)                 # band 34-90 Hz: no wasted energy under 28 Hz
    rum /= np.std(rum) + 1e-9
    breath = 0.7 + 0.3 * np.sin(dsp.TWO_PI * t / 8.0)
    lo = _circ_lp(y, 160.0)
    hi = _circ_lp(y, 520.0)
    return (lo * (1 - breath[:, None] * 0.5) + hi * breath[:, None] * 0.5) + rum * 0.5


@_t("snd.trailer.drone_metal_loop", ["anchor:loop", "drone", "metal", "bowed", "eerie", "loop"],
    "bowed-metal drone, 8.0 s seamless loop: inharmonic plate partials (311 Hz family) beating slowly, a scraping band of noise; horror and sci-fi beds", 1361,
    tier=3, kind="fixed", loop=True, pairs=("cut", "dipToBlack"))
def drone_metal_loop(seed):
    t = t_of(L8)
    y = np.zeros((L8, 2))
    r = rng(seed)
    for k, rt in enumerate((1.0, 1.73, 2.32, 3.11, 4.25, 5.6)):
        f = _cyc(155.5 * rt)
        am = 0.6 + 0.4 * np.sin(dsp.TWO_PI * (k + 1) / 8.0 * t + r.uniform(0, 6.28))
        for ch in (0, 1):
            y[:, ch] += np.sin(dsp.TWO_PI * _cyc(f + (0.25 if ch else 0.0)) * t + r.uniform(0, 6.28)) * am / (1 + 0.5 * k)
    nz = np.stack([white(L8, seed), white(L8, seed + 2)], 1)
    X = np.fft.rfft(nz, axis=0)
    fr = np.fft.rfftfreq(L8, 1.0 / SR)
    band = np.exp(-0.5 * ((fr - 2400.0) / 500.0) ** 2)
    nz = np.fft.irfft(X * band[:, None], L8, axis=0)
    nz /= np.std(nz) + 1e-9
    scrape = 0.5 + 0.5 * np.sin(dsp.TWO_PI * 3 / 8.0 * t) ** 2
    return y * 0.5 + nz * scrape[:, None] * 0.12


@_t("snd.trailer.strings_tension_loop", ["anchor:loop", "strings", "tremolo", "tension", "loop", "key:A"],
    "tension strings bed, 8.0 s seamless loop: a tremolo cluster on A3 / Bb3 / E4 (12 Hz, whole cycles), bow noise, a slow swell; the act-1 / act-2 bed", 1362,
    tier=3, kind="fixed", loop=True, pairs=("cut", "dipToBlack"))
def strings_tension_loop(seed):
    t = t_of(L8)
    y = np.zeros((L8, 2))
    r = rng(seed)
    for f, g in ((A3, 1.0), (233.08, 0.75), (329.63, 0.6), (A2, 0.5)):
        for k in range(4):
            ff = _cyc(f * 2 ** ((k - 1.5) * 5 / 1200))
            ph = dsp.TWO_PI * ff * t + r.uniform(0, 6.28)
            s = sum(np.sin(h * ph) / h for h in range(1, 12))
            y[:, k % 2] += s * g * 0.2
    trem = 0.6 + 0.4 * (0.5 + 0.5 * np.sin(dsp.TWO_PI * 12.0 * t))
    swell = 0.75 + 0.25 * np.sin(dsp.TWO_PI * t / 8.0 - np.pi / 2)
    bow = np.stack([white(L8, seed + 5), white(L8, seed + 6)], 1)
    bow = _circ_lp(bow, 6000.0) - _circ_lp(bow, 2000.0)
    y = _circ_lp(y, 3200.0) * (trem * swell)[:, None] + bow * 0.03
    return y


# ------------------------------------------------------------------------------------------------------------------------------------- silence, patterns, button
@_t("snd.trailer.ring_tinnitus", ["anchor:onset", "ring", "silence", "tinnitus", "size:s"],
    "tinnitus ring, 3 s: a soft 3.52 kHz tone with a slow beat, fading in and out; the ear ringing in the silence before the hit (keep it 20+ dB under)", 1370,
    tier=3, pairs=("cut", "dipToBlack"))
def ring_tinnitus(seed):
    pre = ms(3)
    n = sec(3.0) + pre
    t = np.maximum(t_of(n) - pre / SR, 0)
    y = np.sin(dsp.TWO_PI * 3520.0 * t) * (0.8 + 0.2 * np.sin(dsp.TWO_PI * 0.7 * t)) + 0.25 * np.sin(dsp.TWO_PI * 3527.0 * t)
    e = np.minimum(1.0, t / 0.25) * np.exp(-t / 1.6) * (t_of(n) >= pre / SR)
    return y * e, pre


@_t("snd.trailer.hit_silence_hit", ["anchor:crest", "pattern", "silence", "boom", "braam"],
    "the hit-silence-hit pattern as one file: a boom (the anchor), 1.6 s of near-silence with a faint ring, then a braam + boom exactly 2.0 s after the anchor", 1371,
    kind="fixed", pairs=("cut", "dipToBlack", "smash"))
def hit_silence_hit(seed):
    a = boom(seed, 110.0, 32.0, 0.2, 0.5, 2.0, 1.0, "hall", 0.12)
    n = sec(6.5)
    y = np.zeros((n, 2))
    pre = ms(4)
    add_at(y, a, pre, 1.0)
    g = sec(1.6)
    y[pre + sec(0.4):pre + sec(2.0)] *= np.linspace(1.0, 0.0, sec(1.6))[:, None] ** 3     # the first hit is choked into the silence
    rr, ra = ring_tinnitus(seed)
    add_at(y, dsp.stereo(rr[ra:ra + g] * 0.02), pre + sec(0.4), 1.0)
    br, ba = braam(seed + 1, dur=3.2)
    add_at(y, br[ba:], pre + sec(2.0), 0.9)
    add_at(y, boom(seed + 2), pre + sec(2.0), 1.0)
    return y, pre


@_t("snd.trailer.sting_button", ["anchor:crest", "sting", "button", "shock", "strings"],
    "button sting, 2.6 s: a dissonant string cluster stab (A3 Bb3 Eb4 A4), a metal scrape and a short boom: the last beat after the title", 1372,
    kind="peak", pairs=("cut", "smash"))
def sting_button(seed):
    n = sec(2.6)
    t = t_of(n)
    y = np.zeros(n)
    for f in (A3, 233.08, 311.13, 440.0):
        for k in range(4):
            y += dsp.saw_n(f * 2 ** ((k - 1.5) * 8 / 1200), n, rng(seed + k).random()) * 0.09
    y = svf(y, 3000.0 * np.exp(-t / 0.4) + 400.0, 0.9, "lp") * env_ad(t, 0.004, 0.45)
    y += svf(white(n, seed), expo(5000.0, 1500.0, t / 0.6), 3.0, "bp") * env_ad(t, 0.001, 0.25) * 0.5
    y += boom(seed + 1, 100.0, 34.0, 0.15, 0.35, 2.6, 0.6, "room", 0.0)[:n, 0] * 0.8
    return dsp.reverb(_st(y, seed, 0.5), "hall", 0.25, seed)
