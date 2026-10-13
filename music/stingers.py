"""motion-pack / music / stingers.py : musical stingers in the project key (A), 120 BPM grid (1 bar = 2.0 s). Each returns (stereo float64, anchor_sample, info).
Anchor = the hit / landing moment; risers end one frame (33 ms at 30 fps) before it; rings ring out (no fade-out) so the clip reads as 'designed'."""
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, ms, add_at, note_hz, t_of
from recipes.risers import riser_noise

A = 69
S_ = lambda x: dsp.stereo(x)


def _buf(seconds):
    return np.zeros((sec(seconds), 2))


def button(seed=1, minor=False):
    y = _buf(3.0)
    third = 3 if minor else 4
    ch = [A - 12, A - 12 + third, A - 12 + 7, A, A + third]
    add_at(y, S_(I.stab([note_hz(m) for m in ch], 0.9, 1.0, seed, 4500.0, 900.0, 0.2)), 0, 0.9)
    add_at(y, S_(I.e808(seed, note_hz(A - 36), 1.4, 1.0, 1.6)), 0, 0.7)
    add_at(y, S_(np.asarray(dsp.lp(I.hat(seed, True, 1.0, 1.6), 12000))), 0, 0.6)
    for m in ch[:3]:
        add_at(y, S_(I.pad(note_hz(m + 12), 1.6, 0.6, seed + m, 7.0, 2200.0, 0.01, 1.2)), 0, 0.25)
    return dsp.reverb(y, "hall", 0.18), 0, {"kind": "button", "minor": minor}


def rise_hit(seed=1, bars=2):
    L = int(bars * 2.0 * SR)
    pre = L
    y = np.zeros((pre + sec(2.6), 2))
    r = riser_noise(pre - dsp.ms(33), seed, burst=False)
    add_at(y, dsp.fade_out(r, dsp.ms(5)), 0, 0.8)
    t0 = pre - sec(2.0)
    k = 0
    while t0 < pre - dsp.ms(60):
        u = (t0 - (pre - sec(2.0))) / sec(2.0)
        add_at(y, S_(I.snare(seed + k, 1.0, 0.25)), int(t0), 0.2 + 0.7 * u ** 1.5)
        t0 += max(0.025 * SR, 0.125 * SR * (1 - 0.8 * u))
        k += 1
    add_at(y, S_(I.kick(seed, 120.0, 38.0, 0.05, 0.6, 0.3, 1.0, 0.6)), pre, 1.0)
    add_at(y, S_(I.stab([note_hz(A - 12), note_hz(A), note_hz(A + 4), note_hz(A + 7)], 0.8, 1.0, seed, 4500.0, 800.0, 0.15)), pre, 0.8)
    add_at(y, S_(np.asarray(dsp.lp(I.hat(seed, True, 1.0, 1.6), 12000))), pre, 0.6)
    return dsp.reverb(y, "plate", 0.15), pre, {"kind": "rise_hit", "bars": bars, "riser_end_frame_offset": -1}


def pluck_resolve(seed=1):
    y = _buf(2.6)
    for k, m in enumerate((A - 12, A - 8, A - 5, A)):
        add_at(y, S_(I.pluck(note_hz(m), 0.2, seed + k, 0.996)), ms(110 * k), 0.8)
    land = ms(480)
    add_at(y, S_(I.bell(note_hz(A + 12), 1.4, 1.4, 5.0)), land, 0.8)
    for m in (A - 12, A - 5, A):
        add_at(y, S_(I.pad(note_hz(m), 1.4, 0.6, seed + m, 7.0, 2000.0, 0.02, 0.9)), land, 0.25)
    return dsp.reverb(y, "room", 0.15), land, {"kind": "pluck_resolve"}


def tension_stab(seed=1):
    y = _buf(2.6)
    ch = [A - 12, A - 11, A - 5 + 0, A - 12 + 8]          # A, Bb, E, F : dissonant cluster
    add_at(y, S_(I.stab([note_hz(m) for m in ch], 0.5, 1.0, seed, 3000.0, 400.0, 0.2, 4, 14.0)), 0, 0.9)
    add_at(y, S_(I.e808(seed, note_hz(A - 36), 1.2, 1.0, 1.2)), 0, 0.7)
    return dsp.reverb(y, "hall", 0.25), 0, {"kind": "tension_stab"}


def bounce_out(seed=1):
    y = _buf(1.6)
    for k, m in enumerate((A + 7, A + 4, A, A - 5)):
        add_at(y, S_(I.marimba(note_hz(m + 12), 0.12, 1.0, seed + k)), ms(130 * k), 0.8)
    last = ms(130 * 3)
    add_at(y, S_(I.cowbell(seed, 0.8)), last, 0.4)
    add_at(y, S_(I.pizz(note_hz(A - 24), 0.2, seed)), last, 0.9)
    return y, last, {"kind": "bounce_out"}


def lofi_chord(seed=1):
    y = _buf(3.0)
    ch = [A - 12, A - 5, A, A + 4, A + 7 + 0]
    for j, m in enumerate(ch):
        add_at(y, S_(I.keys(note_hz(m), 1.4, 0.8, seed + j)), j * ms(6), 0.5)
    n = sec(3.0)
    r = np.random.default_rng(seed)
    cr = np.zeros(n)
    for i in dsp.grain_times(n, lambda t: np.full_like(t, 30.0) * np.exp(-t / 1.5), seed):
        mm = int(r.integers(8, 40))
        add_at(cr, dsp.white(mm, int(i)) * np.exp(-np.arange(mm) / (mm * 0.3)), int(i), float(np.exp(r.normal(-3.2, 0.7))))
    y += S_(cr)
    return dsp.reverb(y, "room", 0.12), 0, {"kind": "lofi_chord"}


def epic_swell(seed=1):
    pre = sec(2.0)
    y = np.zeros((pre + sec(3.0), 2))
    u = np.linspace(0, 1, pre)
    for m in (A - 24, A - 12, A - 5, A, A + 4):
        pd = I.pad(note_hz(m), 2.0, 0.6, seed + m, 12.0, 1800.0, 0.5, 0.05)[:pre]
        add_at(y, S_(pd * (u[:len(pd)] ** 1.6)), 0, 0.4)
    add_at(y, riser_noise(pre - dsp.ms(33), seed, burst=False) * 0.5, 0, 0.7)
    from recipes.impacts import sub_drop
    add_at(y, S_(sub_drop(seed, 56.0, 32.0, 0.35, 0.6, 3.0)), pre, 1.0)
    add_at(y, S_(I.stab([note_hz(A - 12), note_hz(A), note_hz(A + 4), note_hz(A + 7)], 1.2, 1.0, seed, 3800.0, 700.0, 0.3)), pre, 0.6)
    return dsp.reverb(y, "cavern", 0.25), pre, {"kind": "epic_swell", "riser_end_frame_offset": -1}


def outro_sparkle(seed=1):
    from recipes.materials import sparkle
    y = _buf(2.6)
    add_at(y, S_(I.bell(note_hz(A + 12), 1.6, 1.6, 5.0)), 0, 0.8)
    add_at(y, sparkle(seed)[:sec(1.6)], ms(60), 0.4)
    for m in (A - 12, A - 5, A, A + 4):
        add_at(y, S_(I.pad(note_hz(m), 1.6, 0.6, seed + m, 7.0, 2200.0, 0.03, 1.0)), 0, 0.25)
    return dsp.reverb(y, "plate", 0.15), 0, {"kind": "outro_sparkle"}


STINGERS = {"button_major": lambda s: button(s, False), "button_minor": lambda s: button(s, True), "rise_hit_2bar": lambda s: rise_hit(s, 2), "rise_hit_1bar": lambda s: rise_hit(s, 1),
            "pluck_resolve": pluck_resolve, "tension_stab": tension_stab, "bounce_out": bounce_out, "lofi_chord": lofi_chord, "epic_swell": epic_swell, "outro_sparkle": outro_sparkle}
