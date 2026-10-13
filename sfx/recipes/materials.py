"""Materials and foley: glass, metal, wood, paper, cloth, plastic, camera, cash, sparkle. Modal ratio tables are starting values (textbook free-free bar,
approximate glass / bell tables); every entry carries a measured spectrum in the manifest."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, pink, brown, rng, add_at, note_hz, expo
from mpaudio.registry import snd


def _exc(n, seed, ms_=1.5, fc=5000, q=1.2, g=1.0):
    return svf(white(n, seed), fc, q, "bp") * env_ad(t_of(n), 0.0001, ms_ / 1000.0) * g * 3.0


def glass_tap_sig(seed, f0=None, n=None):
    r = rng(seed)
    f0 = f0 or (1760 + r.random() * 880)
    n = n or sec(1.4)
    y = dsp.modal(f0, (1, 2.32, 4.25, 6.63, 9.38), (1.0, 0.6, 0.4, 0.25, 0.15), (1.2, 0.9, 0.5, 0.3, 0.2), n, seed=seed)
    return y + _exc(n, seed + 1, 1.5, 6000, 1.5, 0.5)


@snd("snd.glass.tap", "glass", ["family:glass", "tier:3", "anchor:noise", "tonal:yes", "size:xs"], tier=3, use=["ad", "short_film", "mime"], pairs=["cut", "reveal"], desc="wine-glass tap, long ring", tonal=True, seed=70)
def glass_tap(seed):
    return dsp.reverb(glass_tap_sig(seed), "tiny", 0.1)


@snd("snd.glass.clink", "glass", ["family:glass", "tier:3", "anchor:noise", "tonal:yes", "size:s"], tier=3, use=["ad", "short_film"], pairs=["cut", "reveal"], desc="two glasses clink (35 ms apart)", tonal=True, seed=71)
def glass_clink(seed):
    n = sec(1.2)
    y = np.zeros(n)
    add_at(y, glass_tap_sig(seed, 2090.0, n), 0, 1.0)
    add_at(y, glass_tap_sig(seed + 5, 2090.0 * 1.12, n), dsp.ms(35), 0.85)
    return dsp.reverb(y, "tiny", 0.1)


@snd("snd.glass.shatter", "glass", ["family:glass", "tier:1", "anchor:noise", "tonal:no", "size:l", "mood:comic", "impact"], tier=1, use=["ad", "mime", "short_film", "beat_edit"], pairs=["shatter", "smash", "cut"], desc="glass shatter: crack + 120-400 pings + low body", seed=72)
def glass_shatter(seed):
    n = sec(1.5)
    t = t_of(n)
    r = rng(seed)
    y = _exc(n, seed, 25.0, 6000, 1.5, 1.2) * env_ad(t, 0.0005, 0.025)
    y += np.sin(dsp.phase(np.full(n, 180.0))) * env_ad(t, 0.002, 0.08) * 0.35
    times = dsp.grain_times(n, lambda tt: 900 * np.exp(-tt / 0.25), seed)
    for i in times:
        f = r.uniform(2000, 9000)
        m = sec(r.uniform(0.008, 0.04))
        tt = t_of(m)
        add_at(y, np.sin(dsp.TWO_PI * f * tt) * np.exp(-tt / (m / SR * 0.35)), int(i), r.uniform(0.04, 0.2))
    return dsp.reverb(y, "room", 0.12)


@snd("snd.glass.crack", "glass", ["family:glass", "tier:2", "anchor:noise", "tonal:no", "size:s"], tier=2, use=["short_film", "ad"], pairs=["cut"], desc="glass crack: 3 stuttered noise bursts and a ring", seed=73)
def glass_crack(seed):
    n = sec(0.7)
    y = np.zeros(n)
    for o, g in ((0, 1.0), (7, 0.6), (19, 0.5)):
        add_at(y, _exc(sec(0.05), seed + o, 3.0, 5000, 2.0, g), dsp.ms(o), 1.0)
    add_at(y, glass_tap_sig(seed, 3100.0, n), 0, 0.2)
    return y


@snd("snd.metal.clang", "metal", ["family:metal", "tier:2", "anchor:noise", "tonal:yes", "size:m"], tier=2, use=["mime", "ad", "short_film"], pairs=["cut", "smash"], desc="steel-plate clang, seeded object", tonal=True, seed=74)
def metal_clang(seed):
    r = rng(seed)
    n = sec(1.4)
    ratios = np.exp(r.uniform(0, np.log(14.0), 24))
    ratios[0] = 1.0
    f0 = r.uniform(280, 520)
    y = dsp.modal(f0, ratios, ratios ** -0.6, 0.8 * ratios ** -0.5, n, seed=seed)
    y += _exc(n, seed + 1, 2.0, 3000, 1.0, 0.9)
    return dsp.reverb(y, "room", 0.1)


@snd("snd.metal.ping", "metal", ["family:metal", "tier:3", "anchor:crest", "tonal:yes", "key:A", "size:s"], tier=3, use=["ad", "launch"], pairs=["flash", "reveal"], desc="FM metal ping on A6", tonal=True, seed=75)
def metal_ping(seed):
    return I.bell(1760.0, 1.2, 1.2, 6.0)


@snd("snd.metal.scrape", "metal", ["family:metal", "tier:3", "anchor:noise", "tonal:no", "size:s"], tier=3, use=["mime", "short_film"], pairs=["glitch"], desc="metal scrape: AM saw through a rising band-pass", seed=76)
def metal_scrape(seed):
    n = sec(0.4)
    u = np.linspace(0, 1, n)
    am = 1.0 - 0.7 * (white(n, seed) * 0.5 + 0.5)
    y = dsp.saw_n(90.0, n) * am
    return svf(y, expo(900, 3000, u), 4.0, "bp") * dsp.env_bell(n, 0.5, 1.5, 2.0) * 3.0


@snd("snd.wood.knock", "wood", ["family:wood", "tier:3", "anchor:noise", "tonal:yes", "size:xs"], tier=3, use=["short_film", "mime", "ad"], pairs=["cut"], desc="wood block knock", tonal=True, seed=77)
def wood_knock(seed):
    n = sec(0.2)
    return dsp.modal(700.0, (1, 2.3, 4.1), (1, .5, .3), (0.04, 0.02, 0.01), n, seed=seed) * 1.2 + _exc(n, seed, 3.0, 2500, 1.0, 0.4)


@snd("snd.wood.tap", "wood", ["family:wood", "tier:3", "anchor:noise", "tonal:yes", "size:xs", "mood:warm"], tier=3, use=["short_film", "talking_head"], pairs=["cut"], desc="softer wood tap, lowpassed", tonal=True, seed=78)
def wood_tap(seed):
    n = sec(0.2)
    return dsp.lp(dsp.modal(450.0, (1, 2.3, 4.1), (1, .4, .2), (0.05, 0.025, 0.012), n, seed=seed) * 1.2 + _exc(n, seed, 4.0, 1800, 1.0, 0.4), 3000)


@snd("snd.wood.door_knock", "wood", ["family:wood", "tier:3", "anchor:noise", "tonal:yes", "size:m", "foley"], tier=3, use=["short_film", "mime"], pairs=["cut"], desc="three door knocks", tonal=True, seed=79)
def wood_door_knock(seed):
    n = sec(0.9)
    y = np.zeros(n)
    for k, o in enumerate((0, 0.2, 0.4)):
        m = sec(0.2)
        v = dsp.modal(180.0, (1, 2.1, 3.4), (1, .6, .4), (0.07, 0.04, 0.02), m, seed=seed + k) + _exc(m, seed + k, 3.0, 1200, 1.0, 0.5)
        add_at(y, v, sec(o), 1.0 - 0.1 * k)
    return y


@snd("snd.wood.creak", "wood", ["family:wood", "tier:3", "anchor:scatter", "tonal:no", "size:m", "mood:tense"], tier=3, use=["short_film", "mime"], pairs=["cut"], desc="door / floorboard creak: stick-slip saw", seed=80)
def wood_creak(seed):
    n = sec(0.7)
    r = rng(seed)
    steps = r.uniform(25, 60)
    nstep = max(2, int(steps * 0.7))
    f = np.repeat(r.uniform(60, 110, nstep), n // nstep + 1)[:n]
    f = np.convolve(f, np.ones(80) / 80, "same")
    y = dsp.saw_n(f, n)
    y = svf(y, 700 + 500 * r.random(), 6.0, "bp") * dsp.env_bell(n, 0.45, 1.5, 1.8) * 3.0
    return y


@snd("snd.paper.rustle", "paper", ["family:paper", "tier:3", "anchor:scatter", "tonal:no", "size:s", "foley"], tier=3, use=["short_film", "ad", "talking_head"], pairs=["reveal", "pageTurn"], desc="paper rustle: grain cloud", seed=81)
def paper_rustle(seed):
    n = sec(0.7)
    r = rng(seed)
    y = np.zeros(n)

    def rate(t):
        u = np.clip(t / 0.6, 0, 1)
        return 80 + 320 * np.sin(np.pi * u) ** 2
    for i in dsp.grain_times(n, rate, seed):
        m = sec(r.uniform(0.0004, 0.002))
        g = dsp.bp(white(m + 64, int(i)), r.uniform(2000, 6500), r.uniform(7000, 9000), 1)[:m] if m > 8 else white(m, int(i))
        add_at(y, g * np.hanning(len(g)), int(i), np.exp(r.normal(-1.0, 0.7)))
    return dsp.hp(y, 1200)


@snd("snd.paper.crumple", "paper", ["family:paper", "tier:3", "anchor:scatter", "tonal:no", "size:m", "foley"], tier=3, use=["short_film", "ad", "mime"], pairs=["cut"], desc="paper crumple: dense bursty grains + hard clicks", seed=82)
def paper_crumple(seed):
    n = sec(1.0)
    r = rng(seed)
    y = np.zeros(n)
    walk = np.cumsum(r.normal(0, 0.05, 40)).repeat(n // 40 + 1)[:n]

    def rate(t):
        idx = np.minimum((t * SR).astype(int), n - 1)
        return 600 + 1400 * np.exp(walk[idx]) / np.exp(walk).max() * np.exp(-t / 0.7)
    for i in dsp.grain_times(n, rate, seed):
        m = sec(r.uniform(0.0003, 0.0018))
        g = white(m, int(i)) * np.hanning(m)
        add_at(y, dsp.hp(g, 1500) if m > 40 else g, int(i), np.exp(r.normal(-1.2, 0.8)) * (3.0 if r.random() < 0.02 else 1.0))
    return dsp.lp(dsp.hp(y, 1500), 8500)


@snd("snd.paper.flip", "paper", ["family:paper", "tier:3", "anchor:noise", "tonal:no", "size:s", "foley"], tier=3, use=["short_film", "ad"], pairs=["pageTurn", "slide"], desc="page turn: swish + rustle + soft thud", seed=83)
def paper_flip(seed):
    n = sec(0.4)
    u = np.linspace(0, 1, sec(0.18))
    y = np.zeros(n)
    add_at(y, svf(white(len(u), seed), 1200 + 2800 * u, 1.0, "bp") * dsp.env_bell(len(u), 0.6, 2.0, 2.5) * 3.0, 0, 0.8)
    add_at(y, paper_rustle(seed)[:sec(0.12)], dsp.ms(60), 0.5)
    m = sec(0.1)
    add_at(y, np.sin(dsp.TWO_PI * 120 * t_of(m)) * env_ad(t_of(m), 0.002, 0.03), sec(0.2), 0.5)
    return y


@snd("snd.cloth.swish", "cloth", ["family:cloth", "tier:3", "anchor:noise", "tonal:no", "size:s", "foley"], tier=3, use=["short_film", "mime", "talking_head"], pairs=["whip", "slide"], desc="cloth swish: pink noise 300-1200 Hz", seed=84)
def cloth_swish(seed):
    n = sec(0.3)
    return svf(pink(n, seed), np.linspace(300, 1200, n), 0.7, "bp") * dsp.env_bell(n, 0.5, 2.0, 2.0) * 3.0


@snd("snd.cloth.flap", "cloth", ["family:cloth", "tier:3", "anchor:noise", "tonal:no", "size:m", "foley"], tier=3, use=["mime", "short_film"], pairs=["whip"], desc="cloth flap x3 decaying", seed=85)
def cloth_flap(seed):
    n = sec(0.45)
    y = np.zeros(n)
    for k in range(3):
        m = sec(0.12)
        t = t_of(m)
        v = dsp.lp(np.sin(dsp.phase(np.full(m, 95.0))) * env_ad(t, 0.002, 0.03) + white(m, seed + k) * env_ad(t, 0.004, 0.025) * 0.6, 900)
        add_at(y, v, sec(0.07 * k), 0.6 ** k)
    return y


@snd("snd.cloth.footstep", "cloth", ["family:cloth", "tier:3", "anchor:noise", "tonal:no", "size:s", "foley"], tier=3, use=["short_film", "mime"], pairs=["cut"], desc="soft shoe footstep: low thump + scuff", seed=86)
def foot_step(seed):
    n = sec(0.3)
    t = t_of(n)
    y = np.sin(dsp.phase(70 + 40 * np.exp(-t / 0.02))) * env_ad(t, 0.003, 0.05) * 0.8
    y += dsp.lp(brown(n, seed), 400) * env_ad(t, 0.002, 0.04) * 1.2
    y += svf(white(n, seed + 1), 2200, 0.8, "bp") * env_ad(t, 0.01, 0.04) * 0.5
    return dsp.hp(y, 40)


@snd("snd.plastic.click", "plastic", ["family:plastic", "tier:3", "anchor:noise", "tonal:yes", "size:xs"], tier=3, use=["ad", "talking_head"], pairs=["cut"], desc="plastic tap/click", tonal=True, seed=87)
def plastic_click(seed):
    n = sec(0.12)
    return dsp.lp(dsp.modal(1100.0, (1, 1.8, 2.9), (1, .5, .3), (0.025, 0.015, 0.01), n, seed=seed) + _exc(n, seed, 8.0, 3000, 1.0, 0.5), 4000)


@snd("snd.plastic.switch", "plastic", ["family:plastic", "tier:3", "anchor:noise", "tonal:no", "size:xs", "foley"], tier=3, use=["ad", "talking_head", "short_film"], pairs=["cut"], desc="light switch: clack with spring", seed=88)
def plastic_switch(seed):
    n = sec(0.16)
    y = _exc(n, seed, 3.0, 2800, 1.0, 1.0)
    add_at(y, dsp.modal(900.0, (1, 2.4), (1, .5), (0.02, 0.012), sec(0.06), seed=seed), dsp.ms(2), 0.6)
    add_at(y, _exc(sec(0.04), seed + 1, 4.0, 1800, 1.0, 0.4), dsp.ms(40), 1.0)
    return y


@snd("snd.camera.shutter", "camera", ["family:camera", "tier:3", "anchor:noise", "tonal:no", "size:xs"], tier=3, use=["ad", "launch", "talking_head"], pairs=["flash", "freeze"], desc="camera shutter: open/close clicks 58 ms apart", seed=89)
def camera_shutter(seed):
    n = sec(0.2)
    y = np.zeros(n)
    for o, g in ((0, 1.0), (58, 0.8)):
        m = sec(0.05)
        t = t_of(m)
        v = _exc(m, seed + o, 3.0, 3500, 1.4, 1.0) + np.sin(dsp.TWO_PI * 900 * t) * env_ad(t, 0.0008, 0.012) * 0.5
        add_at(y, v, dsp.ms(o), g)
    return y


@snd("snd.cash.ka_ching", "cash", ["family:cash", "tier:2", "anchor:noise", "tonal:yes", "key:A", "size:m"], tier=2, use=["ad", "launch"], pairs=["statReveal", "cut"], desc="register slide + two FM bells E7/B7", tonal=True, seed=90)
def cash_ka_ching(seed):
    n = sec(1.2)
    y = np.zeros(n)
    add_at(y, metal_scrape(seed)[:sec(0.2)], 0, 0.5)
    add_at(y, I.bell(2637.02, 0.9, 0.8, 5.0), dsp.ms(160), 0.7)
    add_at(y, I.bell(3951.07, 0.9, 0.8, 5.0), dsp.ms(220), 0.6)
    return y


@snd("snd.sparkle.shimmer", "sparkle", ["family:sparkle", "tier:3", "anchor:scatter", "tonal:yes", "key:A", "mood:warm"], tier=3, use=["ad", "launch", "short_film"], pairs=["flash", "reveal", "dissolve"], desc="12 random A-major sparkle tings, 1 s", tonal=True, seed=91)
def sparkle(seed):
    r = rng(seed)
    n = sec(1.1)
    y = np.zeros(n)
    notes = [93, 97, 100, 102, 105, 107, 109]
    for k in range(12):
        f = note_hz(int(r.choice(notes)))
        m = sec(0.5)
        t = t_of(m)
        v = (np.sin(dsp.TWO_PI * f * t) + 0.28 * np.sin(dsp.TWO_PI * f * 2.76 * t) + 0.1 * np.sin(dsp.TWO_PI * f * 5.4 * t)) * env_ad(t, 0.0004, 0.07 * (0.7 + 0.6 * r.random()))
        add_at(y, v, sec(0.012 + r.random() * 0.3), (0.2 + 0.25 * r.random()) * 0.93 ** k)
    return dsp.reverb(y, "plate", 0.15)


@snd("snd.sizzle.grain", "sparkle", ["family:foley", "tier:3", "anchor:scatter", "tonal:no", "size:m", "foley"], tier=3, use=["ad"], pairs=["reveal"], desc="sizzle: 5-12 kHz grains at 1500/s, 1 s", seed=92)
def sizzle(seed):
    n = sec(1.0)
    r = rng(seed)
    y = np.zeros(n)
    for i in dsp.grain_times(n, lambda t: 1500 * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * t)) * np.sin(np.pi * np.clip(t, 0, 1)), seed):
        m = 48
        g = dsp.hp(white(m + 32, int(i)), r.uniform(3500, 6500))[:m] * np.hanning(m)
        add_at(y, g, int(i), np.exp(r.normal(-1.0, 0.5)))
    return dsp.lp(y, 9500)


@snd("snd.ceramic.clink", "glass", ["family:ceramic", "tier:3", "anchor:noise", "tonal:yes", "size:xs"], tier=3, use=["ad", "short_film"], pairs=["cut"], desc="ceramic mug tap", tonal=True, seed=93)
def ceramic_clink(seed):
    n = sec(0.5)
    return dsp.modal(1400.0, (1, 2.7, 5.1, 8.2), (1, .6, .3, .2), (0.25, 0.12, 0.06, 0.04), n, seed=seed) + _exc(n, seed, 2.0, 4500, 1.2, 0.5)
