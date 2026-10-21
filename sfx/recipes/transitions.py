"""Transition sweeteners: the sound of each edit type (see docs/evidence/sound.md section 4.10 and docs/evidence/edit.md taxonomy).
`pairs_with` uses the plan.* transition names: hardCut whip flash glitch scalePunch dissolve dipToBlack push blurCross freezeHold lightLeak filmBurn
zoomThrough maskReveal iris lumaWipe match morph ink speedRamp smash."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, pink, brown, rng, add_at, note_hz, expo, env_bell
from mpaudio.registry import snd


def _st(x):
    return dsp.stereo(x)


def _T(id, tags, pairs, desc, seed=200, tier=2, kind="peak", tonal=False, use=("ad", "launch", "beat_edit")):
    return snd(id, "transition", ["family:transition", "tier:%d" % tier, *tags], tier=tier, use=list(use), pairs=list(pairs), desc=desc, seed=seed, kind=kind, tonal=tonal)


@_T("snd.tx.cut_tick", ["anchor:noise", "tonal:no", "size:xs"], ["hardCut"], "6-10 ms tick on a hard cut so it is not a sterile hole", 200, 3)
def cut_tick(seed):
    n = sec(0.05)
    t = t_of(n)
    y = dsp.hp(white(n, seed), 3000) * env_ad(t, 0.0003, 0.006) * 1.5
    y += np.sin(dsp.TWO_PI * 90 * t) * env_ad(t, 0.001, 0.008) * 0.35
    return y


@_T("snd.tx.scale_punch", ["anchor:crest", "tonal:yes", "size:s"], ["scalePunch", "punchIn"], "zoom punch-in: 60 Hz punch + zip", 201, 3, tonal=True, use=("talking_head", "beat_edit", "ad"))
def scale_punch(seed):
    from .impacts import hit_punch
    from .whoosh import whoosh_core
    n = sec(0.3)
    y = np.zeros((n, 2))
    z = whoosh_core(0.1, "in", seed, dur=0.09, f_lo=1500, f_hi=9000, q=2.0)
    add_at(y, z, 0, 0.5)
    add_at(y, _st(hit_punch(seed)), dsp.ms(70), 1.0)
    return y


@_T("snd.tx.glitch_stutter", ["anchor:noise", "tonal:no", "size:m", "mood:tech"], ["glitch"], "stutter glitch: repeated grains, bit-crush, zzt bursts, hard gate", 202, 2, use=("beat_edit", "ad", "launch"))
def glitch_stutter(seed):
    r = rng(seed)
    n = sec(0.35)
    t = t_of(n)
    base = svf(white(n, seed), 2400, 1.5, "bp") * 2.0 + dsp.saw_n(220.0, n) * 0.5
    base *= env_ad(t, 0.001, 0.2)
    out = np.zeros(n)
    pos = 0
    while pos < n:
        g = base[pos:pos + dsp.ms(r.integers(25, 40))]
        k = int(r.integers(3, 6))
        for j in range(k):
            m = min(len(g), n - pos)
            if m <= 0:
                break
            out[pos:pos + m] = g[:m]
            pos += m
        pos += dsp.ms(r.integers(5, 20))
    out = dsp.bitcrush(out, 6, int(r.integers(6, 12)))
    gate = ((t * 16.0) % 1.0 < 0.6).astype(float)
    zzt = np.sin(dsp.TWO_PI * 2000 * t) * (((t * 24.0) % 1.0) < 0.4) * 0.3
    return (out * gate + zzt * gate) * np.where(t > 0.32, np.cos(np.clip((t - 0.32) / 0.03, 0, 1) * np.pi / 2), 1.0)


def _stop_sig(length, rate_fn, seed):
    from .risers import varispeed, held_chord
    n = sec(length)
    src = held_chord(sec(2.0), seed, 57)
    u = t_of(n)
    rate = rate_fn(u)
    y = varispeed(src, rate)
    return dsp.hp(svf(y, np.clip(8000 * rate, 60, 9000), 0.9, "lp"), 90), rate


@_T("snd.tx.tape_stop", ["anchor:start", "tonal:yes", "size:s"], ["freezeHold", "speedRamp"], "tape stop 350 ms: held chord, pitch and lowpass fall", 203, 2, kind="fixed", tonal=True, use=("mime", "talking_head", "beat_edit"))
def tape_stop(seed):
    y, _ = _stop_sig(0.35, lambda u: np.exp(-u / (0.35 / 3)), seed)
    return y, 0


@_T("snd.tx.tape_down", ["anchor:start", "tonal:yes", "size:m"], ["speedRamp", "freezeHold"], "tape slow-down 500 ms to 0.3x (speed ramp into slow motion)", 204, 2, kind="fixed", tonal=True, use=("beat_edit", "ad"))
def tape_down(seed):
    y, _ = _stop_sig(0.5, lambda u: 1.0 - 0.7 * np.clip(u / 0.4, 0, 1), seed)
    return y * dsp.fade_out(np.ones(len(y)), 400), 0


@_T("snd.tx.flash_swell", ["anchor:crest", "tonal:yes", "size:m"], ["flash", "lightLeak"], "white-flash air swell + shimmer partials + soft thud", 205, 2, tonal=True)
def flash_swell(seed):
    n = sec(0.7)
    t = t_of(n)
    y = dsp.hp(white(n, seed), 3000) * env_bell(n, 0.45, 2.0, 2.0) * 0.8
    for f in (3200.0, 4800.0, 6400.0):
        y += np.sin(dsp.TWO_PI * f * t) * env_bell(n, 0.45, 2.0, 2.0) * 0.08
    y += np.sin(dsp.phase(60 + 40 * np.exp(-t / 0.03))) * env_ad(t - 0.31, 0.004, 0.09) * 0.45
    return y


@_T("snd.tx.light_leak", ["anchor:noise", "tonal:yes", "size:l", "mood:warm"], ["lightLeak", "dissolve"], "warm light leak swell: A-major pad + soft air, 1.1 s", 206, 2, tonal=True, use=("short_film", "launch", "ad"))
def light_leak(seed):
    n = sec(1.1)
    t = t_of(n)
    y = np.zeros(n)
    for m in (57, 61, 64, 69):
        y += I.pad(note_hz(m), 0.9, 0.5, seed + m, 12.0, 1500, 0.35, 0.3)[:n]
    y *= env_bell(n, 0.5, 1.6, 1.8)
    y += dsp.hp(white(n, seed), 4500) * env_bell(n, 0.5, 2.0, 2.0) * 0.1
    return y


@_T("snd.tx.film_burn", ["anchor:scatter", "tonal:no", "size:l", "mood:warm"], ["filmBurn", "lightLeak"], "film burn: crackle grains + low warm swell + hiss, 0.9 s", 207, 2, use=("short_film", "ad", "launch"))
def film_burn(seed):
    n = sec(0.9)
    r = rng(seed)
    y = dsp.hp(dsp.lp(pink(n, seed), 450), 70) * env_bell(n, 0.5, 1.8, 2.0) * 1.4
    y += dsp.hp(white(n, seed + 1), 5000) * env_bell(n, 0.5, 2, 2) * 0.12
    for i in dsp.grain_times(n, lambda tt: 160 * np.sin(np.pi * np.clip(tt / 0.9, 0, 1)) + 20, seed + 2):
        m = int(r.integers(8, 60))
        add_at(y, white(m, int(i)) * np.exp(-np.arange(m) / (m * 0.3)), int(i), np.exp(r.normal(-1.0, 0.8)))
    return y


@_T("snd.tx.dissolve_pad", ["anchor:noise", "tonal:yes", "size:m", "mood:warm"], ["dissolve", "match"], "cross-dissolve pad: detuned saws on the A triad, 1.0 s bell", 208, 3, tonal=True, use=("short_film", "talking_head", "ad"))
def dissolve_pad(seed):
    n = sec(1.0)
    y = np.zeros(n)
    for m in (57, 61, 64):
        y += I.pad(note_hz(m), 0.8, 0.5, seed + m, 12.0, 1800, 0.3, 0.3)[:n]
    return y * env_bell(n, 0.5, 1.4, 1.6)


@_T("snd.tx.zoom_through", ["anchor:crest", "tonal:yes", "size:m"], ["zoomThrough"], "zoom-through: 360 ms riser ending on a soft thud (anchor = the thud)", 209, 2, kind="fixed", tonal=True)
def zoom_through(seed):
    from .risers import riser_noise
    from .impacts import hit_thud
    pre = sec(0.36)
    y = np.zeros((pre + sec(0.5), 2))
    add_at(y, riser_noise(pre, seed, 400.0, 8000.0, 1.0, 3.0, burst=False) * 0.9, 0, 1.0)
    add_at(y, _st(hit_thud(seed)), pre, 1.0)
    return y, pre


@_T("snd.tx.match_link", ["anchor:crest", "tonal:yes", "size:s", "mood:warm"], ["match", "morph"], "match cut link: sine glide A5 to E6 across the cut, no whoosh", 210, 3, kind="fixed", tonal=True, use=("short_film", "ad", "launch"))
def match_link(seed):
    n = sec(0.36)
    t = t_of(n)
    f = np.where(t < 0.18, expo(880.0, 1318.5, t / 0.18), 1318.5)
    y = np.sin(dsp.phase(f)) * env_bell(n, 0.5, 1.6, 2.2) * 0.8 + 0.1 * np.sin(dsp.phase(f * 2.0)) * env_bell(n, 0.5, 1.6, 2.2)
    return y, sec(0.18)


@_T("snd.tx.freeze_hit", ["anchor:start", "tonal:yes", "size:m", "mood:comic"], ["freezeHold"], "freeze frame: tape stop 220 ms + closing lowpass + low thud", 211, 2, kind="fixed", tonal=True, use=("mime", "talking_head", "beat_edit"))
def freeze_hit(seed):
    y, _ = _stop_sig(0.45, lambda u: np.exp(-u / 0.07), seed)
    t = t_of(len(y))
    y[:] = y * np.where(t < 0.22, 1.0, np.cos(np.clip((t - 0.22) / 0.2, 0, 1) * np.pi / 2))
    y += np.sin(dsp.phase(60 + 40 * np.exp(-t / 0.03))) * env_ad(t, 0.003, 0.1) * 0.5
    return y, 0


@_T("snd.tx.ink_bloom", ["anchor:noise", "tonal:no", "size:l", "mood:cinematic", "sub"], ["ink", "morph", "dissolve"], "ink bleed: dark noise swell + sub + a few bubbles, 1.0 s", 212, 2, use=("short_film", "launch", "ad"))
def ink_bloom(seed):
    from .liquid import bubble_sig
    n = sec(1.0)
    t = t_of(n)
    y = svf(brown(n, seed), expo(300, 1400, t), 1.0, "lp") * env_bell(n, 0.55, 1.8, 2.0) * 2.0
    y += np.sin(dsp.phase(np.full(n, 70.0))) * env_bell(n, 0.5, 1.6, 2.0) * 0.5
    r = rng(seed)
    for k in range(5):
        add_at(y, bubble_sig(float(r.uniform(1.5, 4)), seed + k), sec(0.3 + 0.12 * k), 0.15)
    return y


@_T("snd.tx.iris_close", ["anchor:noise", "tonal:yes", "size:s", "mood:comic"], ["iris"], "iris close: falling sine bwoop 900 to 200 Hz", 213, 3, tonal=True, use=("mime", "short_film"))
def iris_close(seed):
    n = sec(0.45)
    t = t_of(n)
    y = np.sin(dsp.phase(expo(900.0, 200.0, t / 0.4))) * env_bell(n, 0.2, 1.0, 1.6)
    return y + dsp.hp(white(n, seed), 4000) * env_bell(n, 0.2, 1.5, 2.0) * 0.05


@_T("snd.tx.iris_open", ["anchor:noise", "tonal:yes", "size:s", "mood:comic"], ["iris"], "iris open: rising sine bwoop 200 to 900 Hz", 214, 3, tonal=True, use=("mime", "short_film"))
def iris_open(seed):
    n = sec(0.45)
    t = t_of(n)
    y = np.sin(dsp.phase(expo(200.0, 900.0, t / 0.4))) * env_bell(n, 0.8, 1.6, 1.0)
    return y + dsp.hp(white(n, seed), 4000) * env_bell(n, 0.8, 2.0, 1.5) * 0.05


@_T("snd.tx.luma_wipe", ["anchor:noise", "tonal:no", "size:m"], ["lumaWipe", "push"], "luma wipe: noise with a sweeping notch 300 to 6000 Hz", 215, 2)
def luma_wipe(seed):
    n = sec(0.5)
    t = t_of(n)
    y = pink(n, seed)
    y = svf(y, expo(300.0, 6000.0, t / 0.5), 3.0, "notch")
    y = dsp.hp(svf(y, 3000, 0.7, "lp"), 70) * env_bell(n, 0.5, 2.0, 2.0) * 1.5
    return _st(y)


@_T("snd.tx.push", ["anchor:noise", "tonal:no", "size:s"], ["push", "slide"], "push / slide: swish in + friction, 300 ms", 216, 3, use=("ad", "launch", "talking_head"))
def push(seed):
    from .whoosh import whoosh_core
    from .ui import ui_slide
    y = np.zeros((sec(0.32), 2))
    add_at(y, whoosh_core(0.18, "in", seed, dur=0.22, f_lo=1900, f_hi=6000), 0, 1.0)
    add_at(y, _st(ui_slide(seed)), dsp.ms(40), 0.5)
    return y


@_T("snd.tx.speed_ramp", ["anchor:noise", "tonal:no", "size:m"], ["speedRamp"], "speed ramp: tape slow-down then whoosh, 0.9 s (anchor at the ramp peak)", 217, 2, kind="fixed")
def speed_ramp(seed):
    from .whoosh import whoosh_core
    y = np.zeros((sec(0.9), 2))
    td, _ = _stop_sig(0.4, lambda u: 1.0 - 0.7 * np.clip(u / 0.35, 0, 1), seed)
    add_at(y, _st(td * np.linspace(1, 0.2, len(td)) ** 0.5), 0, 0.35)
    add_at(y, whoosh_core(0.45, "in", seed, dur=0.5, f_lo=800, f_hi=4000), dsp.ms(300), 1.0)
    return y, dsp.ms(300) + sec(0.35)


@_T("snd.tx.shutter_flash", ["anchor:noise", "tonal:no", "size:s"], ["flash", "freezeHold"], "camera shutter into a short flash air", 218, 3, use=("ad", "launch", "talking_head"))
def shutter_flash(seed):
    from .materials import camera_shutter
    y = np.zeros((sec(0.5), 2))
    add_at(y, _st(camera_shutter(seed)), 0, 1.0)
    n = sec(0.35)
    add_at(y, _st(dsp.hp(white(n, seed), 4000) * env_bell(n, 0.3, 2.0, 2.0) * 0.4), dsp.ms(20), 1.0)
    return y


@_T("snd.tx.dip_to_black", ["anchor:start", "tonal:no", "size:l", "mood:cinematic"], ["dipToBlack"], "fade out: downlifter + low thud, 1.0 s", 219, 2, kind="fixed", use=("short_film", "launch"))
def dip_to_black(seed):
    from .risers import lift_down
    y = np.zeros((sec(1.1), 2))
    add_at(y, lift_down(seed)[0], 0, 0.8)
    t = t_of(sec(0.3))
    add_at(y, _st(dsp.lp(np.sin(dsp.phase(55 + 25 * np.exp(-t / 0.05))) * env_ad(t, 0.005, 0.1), 200)), 0, 0.6)
    return y, 0


@_T("snd.tx.blur_cross", ["anchor:noise", "tonal:no", "size:m"], ["blurCross", "dissolve"], "blur cross-dissolve air: pink band 800 to 2.2 kHz swell, 0.6 s", 220, 3, use=("ad", "talking_head", "short_film"))
def blur_cross(seed):
    n = sec(0.6)
    t = t_of(n)
    y = svf(pink(n, seed), expo(800.0, 2200.0, t / 0.6), 0.8, "bp") * env_bell(n, 0.5, 1.8, 1.8) * 2.0
    return _st(y)


@_T("snd.tx.smash_cut", ["anchor:crest", "tonal:yes", "size:l"], ["smash", "hardCut"], "smash cut: sub boom + noise crack, no tail (place after silence)", 221, 1, tonal=True, use=("ad", "short_film", "mime"))
def smash_cut(seed):
    from .impacts import sub_drop
    n = sec(0.7)
    t = t_of(n)
    y = sub_drop(seed, 70.0, 38.0, 0.15, 0.25, 0.7, 0.8)[:n]
    y += svf(white(n, seed), expo(5000, 400, t / 0.12), 1.0, "lp") * env_ad(t, 0.0005, 0.06) * 1.0
    return y


@_T("snd.tx.morph_warble", ["anchor:noise", "tonal:yes", "size:m", "mood:comic"], ["morph", "iris"], "morph warble: two detuned glides with vibrato, 0.55 s", 222, 3, tonal=True, use=("mime", "ad"))
def morph_warble(seed):
    n = sec(0.55)
    t = t_of(n)
    y = np.zeros(n)
    for a, b in ((330.0, 660.0), (333.0, 495.0)):
        f = expo(a, b, t / 0.5) * (1 + 0.02 * np.sin(dsp.TWO_PI * 9 * t))
        y += np.sin(dsp.phase(f))
    return y * env_bell(n, 0.4, 1.6, 1.8) * 0.6


@_T("snd.tx.mask_reveal", ["anchor:end", "tonal:yes", "size:s", "mood:warm"], ["maskReveal"], "mask reveal: 250 ms swish up ending in shimmer", 223, 3, kind="fixed", tonal=True, use=("ad", "launch"))
def mask_reveal(seed):
    from .materials import sparkle
    pre = sec(0.25)
    y = np.zeros((pre + sec(0.7), 2))
    add_at(y, _st(svf(white(pre, seed), expo(900, 7000, np.linspace(0, 1, pre)), 1.6, "bp") * np.linspace(0, 1, pre) ** 2 * 2.5), 0, 0.7)
    add_at(y, _st(sparkle(seed))[:sec(0.7)], pre, 0.4)
    return y, pre
