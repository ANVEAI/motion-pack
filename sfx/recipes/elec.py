"""Electric family (2026-10-14, gap sfx/elec/arc): a short arc zap, a sustained crackle loop and a zap-off power-down, to pair with electric / neon outline
type (type/gfx lowerThird.neonBorder, neon looks) and power-on moments. Owned synthesis only, no samples: a transient crack, filtered-noise bursts and
micro-crackles, and a pitched mains-style buzz (harmonic stack plus noise "rasp" gated at the buzz period, the way an arc re-strikes every half cycle)
whose amplitude follows a SEEDED RANDOM WALK (log-amplitude walk at a 250 Hz control rate; a Brownian bridge in the loop so it wraps).
The buzz is tuned to A2 = 110 Hz (the pack key, A major) instead of a literal 100 Hz mains buzz, so it does not fight an A-major bed.
Starting values: audition before a hero use (nothing here has been heard by a human)."""
import numpy as np
from mpaudio import dsp
from mpaudio.dsp import SR, sec, ms, t_of, env_ad, svf, white, rng, add_at, pan_st
from mpaudio.registry import snd
from .ambience import add_wrap

A2 = 110.0
LOOP = sec(4.0)          # 4.0 s loop: 440 buzz cycles, every periodic part has a whole number of cycles per loop


def _e(id, tags, desc, seed, tier=3, use=("ad", "launch", "kinetic"), pairs=("cut",), tonal=False, **kw):
    return snd(id, "elec", ["family:elec", "electric", "neon", "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), "mood:tech", *tags], tier=tier, use=list(use),
               pairs=list(pairs), desc=desc, tonal=tonal, seed=seed, **kw)


def _walk(n, seed, step_db=1.2, range_db=9.0, rate_hz=250.0, circular=False):
    """seeded random walk in dB at a control rate, soft-bounded to +-range_db (tanh), linearly interpolated to n samples -> linear gain.
    circular=True: Brownian bridge (the walk returns to its start), sampled so sample n would equal sample 0 -> the envelope wraps a loop."""
    k = max(2, int(round(n / SR * rate_hz)))
    pts = np.concatenate([[0.0], np.cumsum(rng(seed).normal(0.0, step_db, k))])
    if circular:
        pts = pts - np.linspace(0.0, 1.0, k + 1) * pts[-1]
        x = np.arange(n) * (k / n)
    else:
        x = np.linspace(0.0, k, n)
    w = np.interp(x, np.arange(k + 1), range_db * np.tanh(pts / range_db))
    return dsp.db(w)


def _buzz(ph, seed, n_harm=48, tilt=0.9, rasp=0.6):
    """mains-style buzz from a phase array (radians): odd-heavy harmonic stack (fixed seeded phases), soft-clipped, plus white noise gated twice per
    cycle (the arc re-strike rasp). Circular if ph advances a whole number of cycles over the buffer."""
    r = rng(seed)
    y = np.zeros(len(ph))
    for h in range(1, n_harm + 1):
        y += (h ** -tilt) * (1.0 if h % 2 else 0.55) * np.sin(h * ph + r.uniform(0, dsp.TWO_PI))
    y = dsp.soft_clip(y / (np.max(np.abs(y)) + 1e-12), 2.2)
    gate = (0.5 + 0.5 * np.cos(2.0 * ph)) ** 6
    nz = dsp.fft_filter(white(len(ph), seed + 1), 1800, 9000, 2)
    nz = nz / (np.std(nz) + 1e-12) * gate
    return y + rasp * nz * 0.35


def _tick(r, seed, fc_lo=2200, fc_hi=9000, long_ms=2.2):
    """one micro-crackle: a 0.3-2.2 ms band-passed noise spark"""
    m = int(r.integers(ms(0.3), ms(long_ms))) + ms(1)
    e = np.exp(-np.arange(m) / (m * 0.22))
    return svf(white(m, seed), r.uniform(fc_lo, fc_hi), r.uniform(0.7, 1.8), "bp") * e * 3.0


def _crack(seed):
    """the strike: a broadband crack (two stacked noise transients) with a short 160 Hz body thump"""
    n = ms(60)
    t = t_of(n)
    y = svf(white(n, seed), 4200, 0.6, "bp") * env_ad(t, 0.00008, 0.0016) * 3.2
    y += dsp.hp(white(n, seed + 1), 1500) * env_ad(t, 0.00005, 0.0007) * 1.6
    y += np.sin(dsp.TWO_PI * 160.0 * t) * env_ad(t, 0.0006, 0.012) * 0.35
    return y


# ------------------------------------------------------------------------------------------------------------- arc (short zap)
@_e("snd.elec.arc", ["anchor:crest", "size:s", "rr:4", "zap"],
    "electric arc zap: a hard crack, a band-passed noise burst whose centre and level random-walk, micro-crackles and a raspy A2 (110 Hz) mains-style buzz "
    "with a seeded random-walk envelope; about 0.35 s, anchor = the crack (rr:4 = four different strikes)",
    700, use=("ad", "launch", "kinetic"), pairs=("cut", "flash", "glitch", "textReveal", "powerOn"))
def arc(seed):
    r = rng(seed)
    n = sec(0.42)
    t = t_of(n)
    y = np.zeros((n, 2))
    t0 = ms(2)
    add_at(y, pan_st(_crack(seed), 0.0), t0)
    # filtered-noise burst: centre frequency and level random-walk (the arc wanders), quick decay
    fc = 3000.0 * _walk(n, seed + 11, 1.5, 9.0)
    bz = svf(white(n, seed + 12), fc, 0.9, "bp") * env_ad(t - t0 / SR, 0.001, 0.07) * _walk(n, seed + 13, 1.4, 8.0)
    y += dsp.decorrelate(bz, seed, 3.0) * 2.0
    # pitched buzz: A2 with slight pitch wobble, held ~0.16 s then decaying, random-walk amplitude plus sputter
    f0 = A2 * (1.0 + 0.006 * np.sin(dsp.TWO_PI * r.uniform(5, 9) * t)) * (1.0 + 0.02 * np.exp(-t / 0.03))
    env = np.clip((t - t0 / SR) / 0.004, 0, 1) * np.where(t < 0.16, 1.0, np.exp(-(t - 0.16) / 0.05))
    sputter = np.clip(_walk(n, seed + 14, 3.0, 12.0, 400.0) * 1.4, 0, 1)
    b = _buzz(dsp.phase(f0), seed + 15, tilt=0.75, rasp=1.0) * env * _walk(n, seed + 16, 1.0, 6.0) * sputter
    y += pan_st(b, r.uniform(-0.15, 0.15)) * 0.7
    # micro-crackles, densest right after the strike
    for i in dsp.grain_times(n, lambda tt: 650.0 * np.exp(-np.maximum(tt - 0.002, 0) / 0.09) * (tt > 0.003), seed + 17):
        add_at(y, pan_st(_tick(r, seed + 100 + int(i)), r.uniform(-0.6, 0.6)), int(i), 0.28 * np.exp(r.normal(0.0, 0.6)))
    return y


# ------------------------------------------------------------------------------------------------------------- crackle loop (sustained)
@_e("snd.elec.crackle_loop", ["anchor:loop", "size:m", "key:A", "loop", "hum"],
    "sustained electric crackle: a raspy A2 (110 Hz) buzz breathing on a seeded random-walk envelope (a Brownian bridge, so it wraps), a hiss bed that "
    "follows the same walk, and scattered sparks with the odd louder snap; 4.0 s seamless loop for neon signs and live wires",
    701, tonal=True, loop=True, kind="fixed", use=("ad", "launch", "kinetic", "short_film"), pairs=("cut",))
def crackle_loop(seed):
    r = rng(seed)
    t = t_of(LOOP)
    walk = _walk(LOOP, seed + 1, 1.0, 6.0, 250.0, circular=True)
    pm = 0.012 * np.sin(dsp.TWO_PI * 3.0 * t) + 0.008 * np.sin(dsp.TWO_PI * 7.25 * t + 1.3)  # phase wobble, whole cycles per loop
    ph = dsp.TWO_PI * A2 * t + pm * dsp.TWO_PI
    flick = np.clip(_walk(LOOP, seed + 2, 2.5, 12.0, 300.0, circular=True) * 1.3, 0.15, 1.0)    # fast flicker: the arc gutters, never fully drops
    b = _buzz(ph, seed + 3) * walk * flick
    y = np.stack([b, np.roll(b, ms(0.4))], 1) * 0.4
    hiss = np.stack([dsp.fft_filter(white(LOOP, seed + 4), 2500, 10000, 2), dsp.fft_filter(white(LOOP, seed + 5), 2500, 10000, 2)], 1)
    y += hiss / (np.std(hiss) + 1e-12) * 0.035 * (walk * flick)[:, None]
    for ch in range(2):
        rr = rng(seed + 20 + ch)
        for i in dsp.grain_times(LOOP, lambda tt: np.full_like(tt, 70.0), seed + 30 + ch):
            add_wrap(y[:, ch], _tick(rr, seed + 200 + 7 * int(i) + ch), int(i), 0.2 * np.exp(rr.normal(0.0, 0.7)))
    for k in range(int(r.integers(3, 6))):                                    # a few louder snaps (crack + spark cluster), wrapping the loop end
        at = int(r.integers(0, LOOP))
        c = pan_st(_crack(seed + 300 + k), r.uniform(-0.4, 0.4)) * 0.3
        for ch in range(2):
            add_wrap(y[:, ch], c[:, ch], at)
            for j in range(int(r.integers(4, 10))):
                add_wrap(y[:, ch], _tick(r, seed + 400 + 10 * k + j), at + int(r.integers(0, ms(40))), 0.18 * np.exp(r.normal(0, 0.5)))
    return y


# ------------------------------------------------------------------------------------------------------------- zap off (power-down)
@_e("snd.elec.zap_off", ["anchor:start", "size:m", "key:A", "power_down"],
    "zap-off / power-down: a relay snap, then the A2 buzz falls about 1.7 octaves (110 to 34 Hz) and darkens while the crackles thin out and the arc "
    "sputters; ends in digital zero after about 1.3 s; anchor = the snap (put it on the frame the light dies)",
    702, tonal=True, kind="fixed", use=("ad", "launch", "kinetic", "short_film"), pairs=("cut", "dipToBlack", "powerOff"))
def zap_off(seed):
    r = rng(seed)
    n = sec(1.5)
    t = t_of(n)
    T = 1.25
    u = np.clip(t / T, 0, 1)
    y = np.zeros((n, 2))
    t0 = ms(2)
    m = ms(80)
    tt = t_of(m)
    snap = np.pad(_crack(seed), (0, m - ms(60))) * 0.9 + svf(white(m, seed + 1), 2400, 1.3, "bp") * env_ad(tt, 0.0002, 0.004) * 1.2 \
        + np.sin(dsp.TWO_PI * 180.0 * tt) * env_ad(tt, 0.0008, 0.02) * 0.5                                # relay clack under the crack
    add_at(y, pan_st(snap, 0.0), t0)
    f0 = dsp.expo(A2, 34.0, u ** 0.8)
    ph = dsp.phase(f0)
    r_ = rng(seed + 2)
    hb = np.zeros(n)
    for h in range(1, 49):                                                    # harmonic stack whose tilt steepens as it falls (the buzz darkens)
        hb += (1.0 if h % 2 else 0.55) * h ** -(0.9 + 1.1 * u) * np.sin(h * ph + r_.uniform(0, dsp.TWO_PI))
    hb = dsp.soft_clip(hb / (np.max(np.abs(hb)) + 1e-12), 2.0)
    gate = (0.5 + 0.5 * np.cos(2.0 * ph)) ** 6
    rasp = dsp.fft_filter(white(n, seed + 3), 1800, 9000, 2)
    rasp = rasp / (np.std(rasp) + 1e-12) * gate * 0.3 * (1 - u) ** 2
    env = np.clip((t - t0 / SR) / 0.006, 0, 1) * (1 - u) ** 1.6 * np.where(t > T, 0.0, 1.0)
    sputter = np.clip(_walk(n, seed + 4, 2.0, 12.0, 120.0) * 1.3, 0, 1) ** (1.0 + 2.0 * u)  # sputter deepens as it dies
    b = (hb + rasp) * env * _walk(n, seed + 5, 1.0, 5.0) * (0.35 + 0.65 * sputter)
    y += pan_st(b, 0.0) * 0.55
    for i in dsp.grain_times(n, lambda x: 160.0 * np.clip(1 - x / T, 0, 1) ** 3, seed + 6):    # crackles thin out
        g = 0.3 * np.clip(1 - i / SR / T, 0, 1) ** 1.5
        add_at(y, pan_st(_tick(r, seed + 100 + int(i)), r.uniform(-0.6, 0.6)), int(i), g * np.exp(r.normal(0.0, 0.5)))
    return y, t0
