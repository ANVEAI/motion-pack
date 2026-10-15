"""Hardware launch family (2026-10-16, lane xp-hardware): the sound shape of a device keynote reveal and a hardware launch film, synthesised in code
(no samples, CC0 output). A dark cold open lives on a sub pulse and an electric hum; a light sweep has an airy shimmer that peaks where the light crosses the
edge; the reveal lands on a deep sub hit; the exploded view separates with a soft magnetic release and seats with a clunk; ports click home; a fan spins
up; the device powers on with an original rising tone. Craft learned from how device reveals are scored (the sub carries the weight, the metal carries
the "precision"), never a copy of any real product's sounds.
Tuned to the pack key (A): the hum sits on A1/A2 (55 / 110 Hz), the chimes on A5 / E6 / A6, the power-on tone resolves on an A major triad.
Ids: snd.hw.* (pack id sfx/hw/<name>). Starting values: nothing here has been heard by a human; audition once before a hero use."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, ms, t_of, env_ad, svf, white, pink, brown, rng, add_at, pan_st
from mpaudio.registry import snd

A1, A2 = 55.0, 110.0
LOOP = sec(4.0)            # 4.0 s hum loop: 220 A1 cycles, every periodic part has a whole number of cycles per loop


def _h(id, tags, desc, seed, tier=3, use=("launch", "ad", "product"), pairs=("cut",), tonal=False, **kw):
    return snd(id, "hw", ["family:hw", "hardware", "device", "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), "mood:tech", *tags], tier=tier, use=list(use),
               pairs=list(pairs), desc=desc, tonal=tonal, seed=seed, **kw)


def _crest_tone(freqs, amps, t60s, n, at, attack_ms=1.2):
    """tonal partials whose cosines all crest on sample `at` (anchor-exact): phase integrated outward from 0 at the anchor, sin^2 attack ending on it"""
    t = (np.arange(n) - at) / SR
    y = np.zeros(n)
    for f, a, d in zip(freqs, amps, t60s):
        if f >= 0.46 * SR:
            continue
        y += a * np.cos(dsp.TWO_PI * f * t) * np.exp(-6.9078 * np.maximum(t, 0) / max(d, 1e-4))
    a_n = max(2, ms(attack_ms))
    ramp = np.zeros(n)
    i0 = max(0, at - a_n)
    ramp[i0:at] = np.sin(np.linspace(0, np.pi / 2, at - i0)) ** 2
    ramp[at:] = 1.0
    return y * ramp


def _click(n, seed, fc=3200, q=1.4, a=0.00015, tau=0.0018, g=1.0):
    t = t_of(n)
    return svf(white(n, seed), fc, q, "bp") * env_ad(t, a, tau) * g * 3.0


# ------------------------------------------------------------------------------------------------------------- sub hits
@_h("snd.hw.sub_hit", ["anchor:crest", "size:l", "sub", "reveal"],
    "deep reveal sub hit: a 52 to 34 Hz sine drop with a second harmonic (so a phone speaker still hears it), a felt 'whump' of low brown noise and a "
    "soft transient; about 2 s; anchor = the crest (put it on the reveal frame)",
    900, tier=1, tonal=True, pairs=("cut", "flash", "dipToBlack", "reveal"))
def sub_hit(seed):
    n = sec(2.2)
    at = ms(4)
    t = (np.arange(n) - at) / SR
    tp = np.maximum(t, 0)
    f = dsp.expo(52.0, 34.0, np.clip(tp / 0.45, 0, 1))
    ph = np.cumsum(f) / SR * dsp.TWO_PI
    ph -= ph[at]
    body = np.cos(ph) * np.exp(-tp / 0.55) + 0.32 * np.cos(2 * ph) * np.exp(-tp / 0.22)
    body[:at] *= np.sin(np.linspace(0, np.pi / 2, at)) ** 2
    whump = dsp.lp(brown(n, seed), 180) * env_ad(tp, 0.004, 0.16)
    whump = whump / (np.max(np.abs(whump)) + 1e-12) * 0.35
    tr = _click(n, seed + 1, 1800, 0.9, 0.0001, 0.004, 0.25)
    y = body + whump + np.roll(tr, at)
    return dsp.stereo(y) * np.array([1.0, 1.0]), at


@_h("snd.hw.sub_pulse", ["anchor:crest", "size:s", "sub", "heartbeat", "rr:4", "cold-open"],
    "dark cold-open heartbeat: one short sub pulse (A1 55 Hz with a 110 Hz edge) and a muffled knock; 0.6 s; repeat it on the beats of a dark open",
    901, tonal=True, pairs=("cut",))
def sub_pulse(seed):
    r = rng(seed)
    n = sec(0.62)
    at = ms(3)
    f0 = A1 * (1.0 + r.uniform(-0.01, 0.01))
    y = _crest_tone([f0, 2 * f0, 3 * f0], [1.0, 0.36, 0.08], [0.32, 0.14, 0.06], n, at, 2.0)
    k = dsp.lp(white(n, seed + 1), 900) * env_ad(np.maximum((np.arange(n) - at) / SR, 0), 0.0005, 0.018)
    y += k / (np.max(np.abs(k)) + 1e-12) * 0.18
    return dsp.stereo(y), at


# ------------------------------------------------------------------------------------------------------------- metallic chimes
_BAR = (1.0, 2.756, 5.404, 8.933)          # free-free bar modes (an aluminium bar struck in the middle): the "machined metal" colour


@_h("snd.hw.chime_metal", ["anchor:crest", "size:s", "key:A", "metal", "precision", "rr:4"],
    "machined-metal chime: an aluminium-bar strike on A5 (880 Hz, free-bar partials 1 / 2.76 / 5.40 / 8.93) with a bright tick; about 1.4 s; "
    "for a spec landing, an edge glint, a callout value",
    902, tonal=True, pairs=("flash", "maskReveal", "cut"))
def chime_metal(seed):
    r = rng(seed)
    n = sec(1.5)
    at = ms(2)
    f0 = 880.0 * 2 ** (r.uniform(-0.004, 0.004))
    y = _crest_tone([f0 * k for k in _BAR], [1.0, 0.42, 0.22, 0.10], [1.25, 0.6, 0.28, 0.14], n, at, 0.6)
    y += np.roll(_click(n, seed + 1, 7200, 2.0, 0.00005, 0.0009, 0.18), at)
    st = pan_st(y, r.uniform(-0.12, 0.12))
    return dsp.reverb(st, "room", 0.12, seed), at


@_h("snd.hw.chime_reveal", ["anchor:crest", "size:m", "key:A", "metal", "glass", "title"],
    "two-strike reveal chime: A5 then E6 80 ms later on aluminium-bar partials, a soft A6 air shimmer above, a short hall; about 2.5 s; anchor = the "
    "first strike (the product name or the device's first full frame)",
    903, tier=2, tonal=True, kind="fixed", pairs=("flash", "maskReveal", "reveal", "cut"))
def chime_reveal(seed):
    n = sec(2.4)
    at = ms(2)
    a = _crest_tone([880.0 * k for k in _BAR], [1.0, 0.38, 0.18, 0.08], [2.2, 0.9, 0.35, 0.16], n, at, 0.6)
    b = _crest_tone([1318.5 * k for k in _BAR], [0.72, 0.28, 0.12, 0.05], [2.0, 0.8, 0.3, 0.14], n, at + ms(80), 0.6)
    t = np.maximum((np.arange(n) - at) / SR, 0)
    air = dsp.fft_filter(white(n, seed + 3), 5000, 14000, 2)
    air = air / (np.std(air) + 1e-12) * 0.03 * env_ad(t, 0.12, 0.6) + 0.08 * np.sin(dsp.TWO_PI * 1760.0 * t) * env_ad(t, 0.25, 0.9)
    y = np.stack([a + 0.85 * b + air, 0.85 * a + b + np.roll(air, ms(0.7))], 1)
    return dsp.reverb(y, "hall", 0.2, seed), at


# ------------------------------------------------------------------------------------------------------------- mechanical clicks
@_h("snd.hw.click_latch", ["anchor:crest", "size:xs", "mechanical", "latch", "seat"],
    "two-stage latch: a light pre-click, then the seat (a damped 1.4 kHz metal tick over a 190 Hz chassis knock) 22 ms later; anchor = the seat; "
    "a lid closing, a part seating in the exploded view",
    904, tonal=True, pairs=("cut", "push"))
def click_latch(seed):
    n = sec(0.32)
    at = ms(26)
    pre = _click(n, seed, 4200, 1.6, 0.0001, 0.0012, 0.35)
    y = np.roll(pre, ms(4))
    y += _crest_tone([1410.0, 1410.0 * 2.31, 190.0], [0.55, 0.22, 0.9], [0.05, 0.03, 0.08], n, at, 0.3)
    y += np.roll(_click(n, seed + 1, 2600, 1.0, 0.00008, 0.0025, 0.6), at)
    return pan_st(y, 0.0), at


@_h("snd.hw.click_detent", ["anchor:crest", "size:xs", "mechanical", "detent", "rr:4", "tick"],
    "small detent click: a 2.9 kHz tick on a 420 Hz body, 60 ms; one per step of a port tour, a rotary step, a spec row landing (rr:4: each repeat differs)",
    905, tonal=True, pairs=("cut", "push"))
def click_detent(seed):
    r = rng(seed)
    n = sec(0.08)
    at = ms(2)
    fb = 420.0 * (1 + r.uniform(-0.05, 0.05))
    y = _crest_tone([2900.0 * (1 + r.uniform(-0.04, 0.04)), fb], [0.6, 0.8], [0.012, 0.03], n, at, 0.2)
    y += np.roll(_click(n, seed, 5200, 1.8, 0.00005, 0.0007, 0.4), at)
    return pan_st(y, r.uniform(-0.2, 0.2)), at


@_h("snd.hw.port_insert", ["anchor:crest", "size:s", "mechanical", "connector", "plug", "rr:4"],
    "a connector pushed home: 110 ms of friction slide (band-passed noise rising), then the click-in (metal tick + body) on the anchor; for the ports / IO tour",
    906, tonal=True, pairs=("cut", "push"))
def port_insert(seed):
    r = rng(seed)
    n = sec(0.36)
    at = ms(118)
    t = t_of(n)
    slide = svf(white(n, seed), dsp.expo(1200, 3400, np.clip(t / 0.118, 0, 1)), 1.4, "bp") * np.clip(t / 0.118, 0, 1) ** 1.5 * (t < 0.118)
    y = slide * 0.22
    y += _crest_tone([2350.0 * (1 + r.uniform(-0.03, 0.03)), 1050.0, 240.0], [0.5, 0.3, 0.7], [0.03, 0.04, 0.06], n, at, 0.25)
    y += np.roll(_click(n, seed + 1, 3800, 1.2, 0.00006, 0.0012, 0.5), at)
    return pan_st(y, r.uniform(-0.15, 0.15)), at


# ------------------------------------------------------------------------------------------------------------- fan spin-up
@_h("snd.hw.fan_spinup", ["anchor:start", "size:l", "fan", "airflow", "power-on"],
    "fan spin-up: 7 blades from rest to 2400 rpm over 1.6 s (blade-pass tone rising 0 to 280 Hz with its harmonics), airflow noise rising with the speed, "
    "a faint bearing whine; settles to a steady whir and fades by 3.2 s; anchor = the start (the frame the device powers on)",
    907, tier=3, tonal=True, kind="fixed", pairs=("cut",))
def fan_spinup(seed):
    n = sec(3.4)
    t = t_of(n)
    at = ms(2)
    u = np.clip((t - at / SR) / 1.6, 0, 1)
    spd = np.where(t < at / SR, 0.0, 1 - (1 - u) ** 2.4)                    # spin-up curve (fast start, eased settle)
    bpf = 280.0 * spd                                                         # 7 blades x 40 rev/s
    ph = np.cumsum(bpf) / SR * dsp.TWO_PI
    tone = sum((0.9 / k) * np.sin(k * ph + 0.7 * k) for k in range(1, 6)) * spd ** 1.2
    air = svf(pink(n, seed), 600 + 5200 * spd ** 1.3, 0.7, "lp")
    air = air / (np.std(air) + 1e-12) * (0.06 + 0.5 * spd ** 1.5) * 0.25
    am = 1 + 0.25 * np.sin(ph)                                                # each blade passing modulates the flow
    whine = 0.03 * np.sin(np.cumsum(5400.0 * spd) / SR * dsp.TWO_PI) * spd ** 2
    env = np.clip((3.2 - t) / 1.2, 0, 1) ** 1.5 * np.clip(t / 0.01, 0, 1)
    y = (0.35 * tone + air * am + whine) * env
    return np.stack([y, np.roll(y, ms(0.35))], 1), at


# ------------------------------------------------------------------------------------------------------------- electric hum
@_h("snd.hw.hum_loop", ["anchor:loop", "size:m", "key:A", "loop", "hum", "electric", "cold-open"],
    "electric hum: a transformer buzz on A1 / A2 (55 / 110 Hz, odd-heavy harmonics, slow breathing), a very quiet coil whine on A7 (3520 Hz) and an air "
    "hiss; 4.0 s seamless loop for a dark cold open or a powered-on hold (sit it under the bed: overBedDb about -10)",
    908, tonal=True, loop=True, kind="fixed", pairs=("cut",))
def hum_loop(seed):
    t = t_of(LOOP)
    r = rng(seed)
    br = 1.0 + 0.12 * np.sin(dsp.TWO_PI * 0.5 * t) + 0.06 * np.sin(dsp.TWO_PI * 1.25 * t + 1.1)    # whole cycles per 4 s loop
    y = np.zeros(LOOP)
    for h in range(1, 18):
        f = A1 * h
        a = (h ** -0.85) * (1.0 if h % 2 else 0.5)
        y += a * np.sin(dsp.TWO_PI * f * t + r.uniform(0, dsp.TWO_PI))
    y = dsp.soft_clip(y / (np.max(np.abs(y)) + 1e-12), 1.6) * br
    whine = 0.012 * np.sin(dsp.TWO_PI * 3520.0 * t) * (1 + 0.3 * np.sin(dsp.TWO_PI * 0.75 * t))
    hiss = np.stack([dsp.fft_filter(white(LOOP, seed + 1), 3000, 12000, 2), dsp.fft_filter(white(LOOP, seed + 2), 3000, 12000, 2)], 1)
    hiss = hiss / (np.std(hiss) + 1e-12) * 0.012
    st = np.stack([y + whine, np.roll(y, ms(0.5)) + whine], 1) * 0.5 + hiss
    return st, 0


# ------------------------------------------------------------------------------------------------------------- power on / off
@_h("snd.hw.power_on", ["anchor:crest", "size:m", "key:A", "boot", "tone", "power-on"],
    "power-on: a relay thunk, a 0.45 s rising sine sweep (A2 to A4) that blooms into an original A major chord (A4 C#5 E5, cosine-crest) with a soft "
    "shimmer; about 2.4 s; anchor = the chord crest (the frame the LED band reaches full)",
    909, tier=2, tonal=True, kind="fixed", pairs=("flash", "cut", "powerOn"))
def power_on(seed):
    n = sec(2.6)
    sw = sec(0.45)
    at = ms(6) + sw
    t = t_of(n)
    y = np.zeros(n)
    y += np.roll(_crest_tone([140.0, 320.0], [0.8, 0.35], [0.06, 0.03], n, ms(6), 0.3), 0)
    y += np.roll(_click(n, seed, 2200, 1.0, 0.0001, 0.003, 0.3), ms(6))
    u = np.clip((t - ms(6) / SR) / (sw / SR), 0, 1)
    f = dsp.expo(110.0, 440.0, u)
    ph = np.cumsum(f) / SR * dsp.TWO_PI
    sweep = np.sin(ph) * (u > 0) * (u < 1) * np.sin(np.pi * u / 2) ** 2 * 0.35
    y += sweep
    chord = _crest_tone([440.0, 554.37, 659.26, 880.0], [0.9, 0.6, 0.65, 0.25], [1.6, 1.4, 1.5, 0.9], n, at, 30.0)
    y += chord
    tt = np.maximum(t - at / SR, 0)
    sh = dsp.fft_filter(white(n, seed + 2), 4000, 12000, 2)
    y += sh / (np.std(sh) + 1e-12) * 0.015 * env_ad(tt, 0.05, 0.5) * (t > at / SR)
    st = np.stack([y, np.roll(y, ms(0.6))], 1)
    return dsp.reverb(st, "room", 0.16, seed), at


@_h("snd.hw.power_off", ["anchor:start", "size:m", "key:A", "tone", "power-down"],
    "clean power-down: the A major chord falls a fifth and darkens over 0.8 s, then a relay click; ends in digital zero by 1.2 s; anchor = the start "
    "(the frame the light starts to die); pair with the end of a powered-on hold",
    910, tonal=True, kind="fixed", pairs=("dipToBlack", "cut", "powerOff"))
def power_off(seed):
    n = sec(1.25)
    t = t_of(n)
    at = ms(2)
    u = np.clip(t / 0.8, 0, 1)
    y = np.zeros(n)
    for f, a in ((440.0, 0.8), (554.37, 0.5), (659.26, 0.55)):
        ff = f * dsp.expo(1.0, 2 / 3, u)
        y += a * np.sin(np.cumsum(ff) / SR * dsp.TWO_PI) * (1 - u) ** 1.8
    y = dsp.lp(y, 4000) * np.clip(t / 0.004, 0, 1)
    y += np.roll(_click(n, seed, 2600, 1.2, 0.0001, 0.0022, 0.5), sec(0.82))
    return pan_st(y, 0.0), at


@_h("snd.hw.led_on", ["anchor:crest", "size:xs", "led", "ignite", "blip"],
    "LED band ignition: a capacitor-charge chirp (2 to 6 kHz in 40 ms) into a soft electronic blip on E6; 0.4 s; anchor = the blip",
    911, tonal=True, kind="fixed", pairs=("flash", "cut"))
def led_on(seed):
    n = sec(0.42)
    ch = ms(40)
    at = ms(3) + ch
    t = t_of(n)
    u = np.clip((t - ms(3) / SR) / (ch / SR), 0, 1)
    chirp = np.sin(np.cumsum(dsp.expo(2000.0, 6000.0, u)) / SR * dsp.TWO_PI) * (u > 0) * (u < 1) * u ** 2 * 0.12
    y = chirp + _crest_tone([1318.5, 2637.0], [0.6, 0.18], [0.22, 0.08], n, at, 4.0)
    return pan_st(y, 0.0), at


# ------------------------------------------------------------------------------------------------------------- exploded view
@_h("snd.hw.parts_separate", ["anchor:start", "size:m", "explode", "magnetic", "whoosh"],
    "exploded-view separation: a magnetic release click on the anchor, then a soft metallic 'shhk' (band-passed noise with a 1.1 kHz plate ring) and a "
    "short low air push as the parts travel; about 0.9 s; anchor = the release (the first part leaves)",
    912, tier=3, kind="fixed", pairs=("push", "cut", "zoomThrough"))
def parts_separate(seed):
    r = rng(seed)
    n = sec(0.95)
    t = t_of(n)
    at = ms(3)
    y = np.zeros((n, 2))
    rel = _crest_tone([2100.0, 640.0], [0.45, 0.5], [0.02, 0.05], n, at, 0.2) + np.roll(_click(n, seed, 3600, 1.4, 0.00006, 0.0012, 0.5), at)
    y += pan_st(rel, 0.0)
    tt = np.maximum(t - at / SR, 0)
    sh = svf(white(n, seed + 1), dsp.expo(5200, 1600, np.clip(tt / 0.5, 0, 1)), 1.1, "bp") * env_ad(tt, 0.05, 0.22)
    ring = 0.05 * np.sin(dsp.TWO_PI * 1100.0 * tt) * env_ad(tt, 0.004, 0.2)
    push = dsp.hp(dsp.lp(brown(n, seed + 2), 260), 45, 4) * env_ad(tt, 0.08, 0.2)
    push = push / (np.max(np.abs(push)) + 1e-12) * 0.25
    y += dsp.decorrelate((sh * 0.5 + ring + push) * (t > at / SR), seed, 4.0)
    return y, at


@_h("snd.hw.parts_seat", ["anchor:crest", "size:s", "explode", "magnetic", "seat", "clunk"],
    "reassembly seat: a dense magnetic clunk (a 160 Hz chassis body under a damped 980 Hz plate) with a soft tick; 0.45 s; anchor = the contact",
    913, tonal=True, pairs=("cut", "push"))
def parts_seat(seed):
    n = sec(0.45)
    at = ms(3)
    y = _crest_tone([160.0, 980.0, 980.0 * 2.31], [1.0, 0.4, 0.15], [0.12, 0.06, 0.03], n, at, 0.5)
    y += np.roll(_click(n, seed, 2800, 1.1, 0.00008, 0.002, 0.45), at)
    return pan_st(y, 0.0), at


# ------------------------------------------------------------------------------------------------------------- light sweep
@_h("snd.hw.light_sweep", ["anchor:peak", "size:m", "sweep", "shimmer", "air", "glint"],
    "light sweep across a material: an airy band-passed noise swell whose centre rises 1.8 to 7 kHz and peaks with a faint A6 shimmer where the light "
    "crosses the edge; about 1.6 s, peak at 0.9 s; anchor = the peak (the frame the glint is brightest)",
    914, tier=3, pairs=("maskReveal", "lightLeak", "flash"))
def light_sweep(seed):
    n = sec(1.7)
    t = t_of(n)
    pk = 0.9
    u = np.clip(t / 1.6, 0, 1)
    env = np.exp(-((t - pk) / 0.32) ** 2) * (t < 1.65)
    nz = svf(white(n, seed), dsp.expo(1800, 7000, u), 1.6, "bp")
    nz = nz / (np.std(nz) + 1e-12)
    sh = np.sin(dsp.TWO_PI * 1760.0 * t) * np.exp(-((t - pk) / 0.12) ** 2) * 0.18
    y = (nz * 0.22 + sh) * env
    L = y * (0.75 + 0.25 * np.cos(np.pi * u))                                  # the sweep crosses the stereo field left to right
    R = np.roll(y, ms(0.4)) * (0.75 - 0.25 * np.cos(np.pi * u))
    return np.stack([L, R], 1), None
