"""Expansion: more impacts, risers, whooshes, word-free synthetic crowd reactions and cartoon extras (owned synthesis).
Risers end on their anchor (whole bars at 120 BPM: 1 bar = 2.0 s) and are placed one frame before the hit, like the rest of the riser family."""
import numpy as np
from mpaudio import dsp, instruments as I, instruments_ext as X
from mpaudio.dsp import sec, ms, t_of, env_ad, svf, white, pink, brown, rng, add_at, expo, pan_st
from mpaudio.registry import snd
from .whoosh import whoosh_core
from .voices import vowel_note, VOWELS


def _hit(id, tags, desc, seed, tier=1, use=("launch", "short_film", "ad"), pairs=("hardCut", "flash", "dipToBlack"), **kw):
    return snd(id, "impact", ["family:impact", "tier:%d" % tier, *tags], tier=tier, use=list(use), pairs=list(pairs), desc=desc, seed=seed, **kw)


def _rise(id, bars, tags, desc, seed, use=("launch", "ad", "beat_edit")):
    return snd(id, "riser", ["family:riser", "tier:2", "anchor:end", "bars:%d" % bars, "bpm:120", *tags], tier=2, use=list(use), pairs=["flash", "zoomThrough", "cut", "smash"],
               desc=desc, kind="fixed", seed=seed)


def _wh(id, tags, desc, seed, tier=2, use=("ad", "launch", "beat_edit"), pairs=("whip", "push"), **kw):
    return snd(id, "whoosh", ["family:whoosh", "anchor:noise", "tier:%d" % tier, *tags], tier=tier, use=list(use), pairs=list(pairs), desc=desc, seed=seed, **kw)


# ------------------------------------------------------------------------------------------------ impacts
@_hit("snd.hit.taiko", ["anchor:crest", "tonal:yes", "size:l", "mood:cinematic"], "taiko-style big drum: low hide boom, stick slap, hall", 460, tonal=True)
def taiko(seed):
    return X.taiko(seed)


@_hit("snd.hit.cymbal_swell", ["anchor:end", "tonal:no", "size:l", "reverse-swell"], "reverse cymbal swell into a soft crash (anchor = the crash)", 461, tier=2, kind="fixed",
      pairs=("flash", "lightLeak", "dissolve"))
def cymbal_swell(seed):
    crash = I.hat(seed, True, 1.0, 1.6)
    crash = np.asarray(dsp.lp(crash, 12000))
    sw = crash[::-1][-sec(1.4):] * np.linspace(0, 1, sec(1.4)) ** 2
    y = np.zeros(sec(1.4) + len(crash))
    add_at(y, sw, 0)
    add_at(y, crash, sec(1.4), 0.8)
    return y, sec(1.4)


@_hit("snd.hit.explosion_small", ["anchor:crest", "tonal:no", "size:l", "sub"], "small explosion: noise blast, sub thump, debris grains", 462, tier=2, pairs=("smash", "hardCut", "flash"))
def explosion(seed):
    n = sec(2.2)
    t = t_of(n)
    blast = dsp.lp(white(n, seed), 2500) * env_ad(t, 0.002, 0.25) + dsp.fft_filter(brown(n, seed + 1), 40, 300, 2) * env_ad(t, 0.004, 0.6) * 2.5
    blast += np.sin(dsp.phase(55 * (1 + np.exp(-t / 0.05)))) * env_ad(t, 0.002, 0.3) * 0.8
    r = rng(seed)
    for i in dsp.grain_times(sec(1.2), lambda tt: 80 * np.exp(-tt / 0.4), seed + 2):
        m = sec(0.03)
        add_at(blast, svf(white(m, seed + int(i)), r.uniform(1500, 5000), 2.0, "bp") * env_ad(t_of(m), 0.0002, 0.006), int(i) + ms(60), 0.3)
    return dsp.reverb(blast, "hall", 0.15, seed)


@_hit("snd.hit.bass_drop_wobble", ["anchor:crest", "tonal:yes", "size:l", "sub", "mood:hype", "key:A"], "bass drop with a wobble: sub hit then LFO-filtered saw on A1", 463, tier=1, tonal=True,
      use=("beat_edit", "ad"), pairs=("smash", "hardCut", "speedRamp"))
def bass_wobble(seed):
    y = np.zeros(sec(1.8))
    add_at(y, I.e808(seed, 55.0, 1.0, 1.0, 2.0), 0)
    add_at(y, X.wobble_bass(55.0, 1.6, seed, 4.0) * 0.6, 0)
    return y


@_hit("snd.hit.metal_cinematic", ["anchor:crest", "tonal:yes", "size:xl", "mood:cinematic"], "cinematic metal impact: inharmonic clang, sub, long hall ring", 464, tonal=True)
def metal_cine(seed):
    n = sec(3.2)
    t = t_of(n)
    y = dsp.modal(310.0, (1.0, 1.73, 2.41, 3.12, 3.77, 4.6, 5.9), (1.0, 0.8, 0.6, 0.5, 0.35, 0.25, 0.15), (2.4, 2.0, 1.6, 1.2, 0.9, 0.7, 0.5), n, seed=seed)
    y += svf(white(n, seed), 2500, 0.8, "bp") * env_ad(t, 0.0003, 0.02) * 1.5
    y += np.sin(dsp.phase(48 * (1 + 0.5 * np.exp(-t / 0.04)))) * env_ad(t, 0.002, 0.5) * 0.9
    return dsp.reverb(y, "hall", 0.3, seed)


@_hit("snd.hit.glass_hit", ["anchor:crest", "tonal:yes", "size:l", "mood:tech"], "glassy tonal hit: crystal partials over a soft sub, plate tail", 465, tier=2, tonal=True,
      pairs=("flash", "hardCut", "maskReveal"))
def glass_hit(seed):
    n = sec(2.0)
    t = t_of(n)
    y = dsp.modal(1318.5, (1.0, 2.32, 4.25, 6.63), (1.0, 0.5, 0.25, 0.12), (1.4, 0.8, 0.4, 0.2), n, attack_ms=0.05, seed=seed)
    y += dsp.modal(880.0, (1.0, 2.32), (0.6, 0.3), (1.0, 0.5), n, attack_ms=0.05, seed=seed + 1)
    y += np.sin(dsp.phase(np.full(n, 55.0))) * env_ad(t, 0.003, 0.3) * 0.6
    return dsp.reverb(y, "plate", 0.25, seed)


# ------------------------------------------------------------------------------------------------ risers
@_rise("snd.riser.siren", 1, ["tonal:yes", "mood:tense"], "two-tone siren rising in pitch and rate, 1 bar", 470)
def siren(seed):
    n = sec(2.0)
    t = t_of(n)
    u = t / 2.0
    rate = expo(1.5, 7.0, u)
    f = expo(500, 1100, u) * (1 + 0.18 * np.sign(np.sin(dsp.phase(rate))))
    f = dsp.lp(f, 40)
    y = dsp.saw_n(f, n) * 0.5 + np.sin(dsp.phase(f)) * 0.5
    y = dsp.lp(y, 3500) * (0.15 + 0.85 * u ** 1.5)
    return dsp.fade_out(y, ms(5)), n - 1


@_rise("snd.riser.glitch_stutter", 1, ["tonal:no", "mood:tech"], "glitch stutter build: retriggered noise/tone slices accelerating, 1 bar", 471)
def glitch_riser(seed):
    n = sec(2.0)
    r = rng(seed)
    y = np.zeros(n)
    pos, gap = 0, 0.25
    k = 0
    while pos < n - ms(10):
        m = max(ms(12), int(sec(gap) * 0.7))
        tt = t_of(m)
        src = dsp.bitcrush(svf(white(m, seed + k), r.uniform(800, 6000), 2.0, "bp"), 6, int(r.integers(1, 6)))
        src += dsp.pulse_n(np.full(m, r.choice([220, 330, 440, 660, 880])), m, 0.3) * 0.3
        add_at(y, src * np.minimum(1, (m - np.arange(m)) / ms(2)), pos, 0.3 + 0.7 * pos / n)
        pos += max(ms(20), sec(gap))
        gap *= 0.86
        k += 1
    return dsp.fade_out(y, ms(5)), n - 1


@_rise("snd.riser.snare_roll_build", 2, ["tonal:no", "mood:hype"], "2-bar snare roll build: accelerating, pitch and level rising, noise wash under", 472)
def snare_build(seed):
    n = sec(4.0)
    y = np.zeros(n)
    t0, k = 0.0, 0
    while t0 < 3.97:
        u = t0 / 4.0
        iv = 0.25 * (1 - u) ** 1.6 + 0.022
        v = I.snare(seed + k, 1.0, 0.2)
        if u > 0.3:
            v = np.interp(np.arange(0, len(v), 1 + 0.4 * u), np.arange(len(v)), v)
        add_at(y, v, sec(t0), 0.2 + 0.8 * u ** 1.3)
        t0 += iv
        k += 1
    from .risers import riser_noise
    y = np.stack([y, y], 1) + riser_noise(n, seed + 5, burst=False) * 0.25
    return dsp.fade_out(y, ms(5)), n - 1


@_rise("snd.riser.pitch_noise", 1, ["tonal:yes"], "pitched noise riser: band-passed noise and a sine both climbing two octaves", 473)
def pitch_noise(seed):
    n = sec(2.0)
    t = t_of(n)
    u = t / 2.0
    f = expo(220, 1760, u)
    y = svf(white(n, seed), f * 2, 6.0, "bp") * 1.5 + np.sin(dsp.phase(f)) * 0.4
    return dsp.fade_out(y * u ** 2, ms(5)), n - 1


@_rise("snd.riser.string_tension", 2, ["tonal:yes", "mood:cinematic", "key:A"], "string tension: tremolo cluster on A climbing a fourth with a crescendo, 2 bars", 474,
       use=("short_film", "launch", "ad"))
def string_tension(seed):
    n = sec(4.0)
    t = t_of(n)
    u = t / 4.0
    y = np.zeros(n)
    for k, st in enumerate((0, 1, 7, 12)):
        f0 = dsp.note_hz(45 + st)
        fr = f0 * 2 ** (5 * u ** 1.5 / 12)
        y += dsp.saw_n(fr * (1 + 0.002 * k), n, rng(seed + k).random())
    trem = 0.55 + 0.45 * (0.5 + 0.5 * np.sin(dsp.phase(expo(8, 16, u))))
    y = svf(y / 4, 700 + 3500 * u, 0.7, "lp") * trem * (0.08 + 0.92 * u ** 2)
    return dsp.fade_out(y, ms(5)), n - 1


# ------------------------------------------------------------------------------------------------ whooshes
@_wh("snd.whoosh.blade", ["tonal:yes", "size:s"], "blade swish: thin bright pass with a metallic ring", 480, tier=3, use=("ad", "beat_edit", "short_film"), pairs=("whip", "maskReveal"))
def blade(seed):
    st = whoosh_core(0.15, "pass", seed, dur=0.28, f_lo=2500, f_hi=9000, q=3.0)
    n = sec(0.6)
    ring = dsp.modal(4200.0, (1.0, 1.5, 2.8), (1.0, 0.5, 0.3), (0.3, 0.2, 0.1), n, attack_ms=0.3, seed=seed) * 0.25
    y = np.zeros((n, 2))
    add_at(y, st, 0)
    add_at(y, dsp.stereo(ring), sec(0.13))
    return y


@_wh("snd.whoosh.fire", ["tonal:no", "size:l", "mood:hype"], "fire whoosh: roaring low pass with crackle", 481, pairs=("whip", "zoomThrough", "filmBurn"))
def fire(seed):
    n = sec(0.95)
    t = t_of(n)
    roar = dsp.fft_filter(brown(n, seed), 50, 500, 2) * dsp.env_bell(n, 0.5, 2, 2) * 1.2
    roar += svf(pink(n, seed + 1), expo(500, 2500, t / 0.95), 1.0, "bp") * dsp.env_bell(n, 0.5, 2, 2) * 1.5
    r = rng(seed)
    for i in dsp.grain_times(n, lambda tt: 60 * dsp.env_bell(len(tt), 0.5, 2, 2), seed + 3):
        m = ms(6)
        add_at(roar, svf(white(m, seed + int(i)), r.uniform(2000, 6000), 1.5, "bp") * np.exp(-np.arange(m) / ms(1.5)), int(i), 0.5)
    return pan_st(roar, np.linspace(-0.5, 0.5, n))


@_wh("snd.whoosh.magic_swirl", ["tonal:yes", "size:l", "mood:playful"], "magic swirl: whoosh with circling glissando sines and sparkle", 482, pairs=("morph", "lightLeak", "dissolve"),
     use=("ad", "mime", "launch"))
def magic(seed):
    n = sec(1.1)
    t = t_of(n)
    w = whoosh_core(0.4, "pass", seed, dur=1.1)
    m = len(w)
    s = np.zeros(m)
    tt = t_of(m)
    for k, f0 in enumerate((880, 1318.5, 1760)):
        s += np.sin(dsp.phase(f0 * (1 + 0.25 * np.sin(dsp.TWO_PI * (3 + k) * tt)))) * dsp.env_bell(m, 0.5, 2, 2) * 0.15
    s += dsp.hp(white(m, seed + 4), 7000) * dsp.env_bell(m, 0.6, 2, 2) * 0.1
    pan = np.sin(dsp.TWO_PI * 1.5 * tt) * 0.8
    return w + pan_st(s, pan)


@_wh("snd.whoosh.scifi_pass", ["tonal:yes", "size:l", "mood:tech"], "sci-fi pass-by: FM tone with Doppler fall and noise body", 483, pairs=("whip", "zoomThrough", "glitch"))
def scifi(seed):
    n = sec(0.95)
    t = t_of(n)
    u = t / 0.95
    dop = 1.0 + 0.25 * np.tanh((0.5 - u) * 6)
    f = 520 * dop
    y = dsp.fm(f, 1.5, 2.5 * dsp.env_bell(n, 0.5, 2, 2), n) * dsp.env_bell(n, 0.5, 2.5, 2.5) * 0.5
    y = y + svf(white(n, seed), 2000 * dop, 1.0, "bp") * dsp.env_bell(n, 0.5, 2.5, 2.5) * 0.5
    return pan_st(y, np.linspace(-0.8, 0.8, n))


# ------------------------------------------------------------------------------------------------ crowd (word-free formant voices)
def _crowd(seed, voices, vowel_seq, f0_range, contour, dur, spread=0.12, k_f=(0.95, 1.25)):
    r = rng(seed)
    n = sec(dur + spread + 0.1)
    out = np.zeros((n, 2))
    for k in range(voices):
        f0 = r.uniform(*f0_range)
        v = vowel_seq[k % len(vowel_seq)]
        d = dur * r.uniform(0.75, 1.0)
        y = vowel_note(v, lambda tt, _f=f0, _d=d: _f * contour(tt / _d), d, seed + k, k_f=r.uniform(*k_f), breath=0.08)
        add_at(out, pan_st(y, r.uniform(-0.9, 0.9)), sec(r.uniform(0, spread)), np.exp(r.normal(0, 0.25)))
    return dsp.reverb(out, "hall", 0.25, seed)


def _cr(id, tags, desc, seed, use=("mime", "ad", "short_film")):
    return snd(id, "crowd", ["family:crowd", "tier:2", "anchor:noise", "tonal:no", "wordless", *tags], tier=2, use=list(use), pairs=["cut", "hardCut"], desc=desc, seed=seed)


@_cr("snd.crowd.cheer_synth", ["size:l", "mood:hype"], "synthetic crowd cheer: 18 word-free voices rising 'eh/ah' + claps", 490)
def cheer(seed):
    y = _crowd(seed, 18, "eaea", (180, 420), lambda u: 1 + 0.35 * np.clip(u * 2, 0, 1) - 0.1 * np.clip(u - 0.6, 0, 1), 1.8)
    from .ambience import applause
    cl = applause(seed)[:len(y)]
    return y + cl[:len(y)] * 0.25 * np.linspace(1, 0.3, len(y))[:, None]


@_cr("snd.crowd.aww_synth", ["size:m", "mood:warm"], "synthetic crowd 'aww': 14 voices, falling glide on a-o", 491)
def aww(seed):
    return _crowd(seed, 14, "aoao", (200, 380), lambda u: 1.12 - 0.3 * np.clip(u, 0, 1), 1.3)


@_cr("snd.crowd.boo_synth", ["size:l", "mood:comic"], "synthetic crowd 'boo': 16 low voices on u, slight fall", 492)
def boo(seed):
    return _crowd(seed, 16, "uuo", (100, 190), lambda u: 1.0 - 0.08 * np.clip(u, 0, 1), 1.6, k_f=(0.85, 1.05))


# ------------------------------------------------------------------------------------------------ cartoon extras
def _ct(id, tags, desc, seed, tonal=True, kind="peak"):
    return snd(id, "cartoon", ["family:cartoon", "tier:3", "anchor:crest", "mood:comic", "tonal:" + ("yes" if tonal else "no"), *tags], tier=3, use=["mime", "ad", "talking_head"],
               pairs=["cut", "hardCut"], desc=desc, tonal=tonal, seed=seed, kind=kind)


@_ct("snd.cartoon.whistle", ["size:s"], "pea whistle: 2.8 kHz tone with a fast pea trill, 0.6 s", 495)
def pea_whistle(seed):
    n = sec(0.6)
    t = t_of(n)
    f = 2800 * (1 + 0.04 * np.sign(np.sin(dsp.TWO_PI * 32 * t)))
    f = dsp.lp(f, 400)
    y = np.sin(dsp.phase(f)) + dsp.hp(white(n, seed), 4000) * 0.1
    return y * np.minimum(t / 0.02, 1) * np.where(t > 0.52, (0.6 - t) / 0.08, 1)


@_ct("snd.cartoon.bonk_pitch", ["size:s"], "pitched wooden bonk with a downward glide (tune per character)", 496)
def bonk_pitch(seed):
    n = sec(0.4)
    t = t_of(n)
    f = 620 * (1 - 0.45 * (1 - np.exp(-t / 0.06)))
    y = np.sin(dsp.phase(f)) * env_ad(t, 0.0008, 0.09) + np.sin(dsp.phase(f * 2.7)) * env_ad(t, 0.0005, 0.02) * 0.4
    return y + svf(white(n, seed), 2000, 1.2, "bp") * env_ad(t, 0.0002, 0.004) * 1.2


@_ct("snd.cartoon.slip_long", ["size:l"], "long slip: slide-whistle down, skid, then a thud (anchor = thud)", 497, kind="fixed")
def slip_long(seed):
    from .cartoon import whistle
    y = np.zeros(sec(1.8))
    add_at(y, whistle(1600, 300, 0.9, seed), 0, 0.7)
    m = sec(0.4)
    add_at(y, svf(white(m, seed + 1), 1800, 3.0, "bp") * dsp.env_bell(m, 0.3, 1, 2) * 0.6, sec(0.85))
    hit = sec(1.25)
    add_at(y, np.sin(dsp.phase(90 * (1 + 0.6 * np.exp(-t_of(sec(0.4)) / 0.02)))) * env_ad(t_of(sec(0.4)), 0.001, 0.08), hit)
    add_at(y, svf(white(sec(0.1), seed + 2), 900, 1.0, "bp") * env_ad(t_of(sec(0.1)), 0.0002, 0.01) * 1.5, hit)
    return y, hit


@_ct("snd.cartoon.surprise_sting", ["size:m", "key:A"], "surprise sting: quick xylophone run up into a brassy tremolo stab", 498, kind="fixed")
def surprise(seed):
    y = np.zeros(sec(1.4))
    for k, m in enumerate((69, 73, 76, 81, 85)):
        add_at(y, I.marimba(dsp.note_hz(m + 12), 0.08, 0.8, seed), ms(35 * k))
    at = ms(35 * 5)
    st = X.brass_stab([dsp.note_hz(m) for m in (57, 61, 64, 70)], 0.7, seed)
    tt = t_of(len(st))
    add_at(y, st * (0.7 + 0.3 * np.sin(dsp.TWO_PI * 14 * tt)), at)
    return y, at
