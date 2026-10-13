"""Drum and percussion one-shots (the same voices the music kit plays, in mpaudio.instruments)."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.registry import snd


def _d(id, fn, desc, size, tags=(), tonal=False, use=("beat_edit", "ad", "launch")):
    snd(id, "drum", ["family:drum", "tier:3", "anchor:noise", "tonal:" + ("yes" if tonal else "no"), size, *tags], tier=3, use=list(use), pairs=["hardCut", "scalePunch"], desc=desc, tonal=tonal, seed=180)(fn)


_d("snd.drum.kick", lambda s: I.kick(s), "kick: sine 150 to 48 Hz, tau 25 ms, soft click", "size:m", ["mood:tech"], True)
_d("snd.drum.kick_sub", lambda s: I.kick(s, 120.0, 42.0, 0.04, 0.45, 0.15, 0.9), "sub kick: end pitch 42 Hz, long decay", "size:l", ["mood:cinematic", "sub"], True)
_d("snd.drum.kick_punch", lambda s: I.kick(s, 180.0, 55.0, 0.02, 0.22, 0.35, 0.5, 1.8), "punchy kick with soft drive", "size:m", ["mood:tech"], True)
_d("snd.drum.snare", lambda s: I.snare(s), "snare: tri 185 Hz + band-passed noise + air", "size:m")
_d("snd.drum.clap", lambda s: I.clap(s), "clap: four stacked noise bursts", "size:m")
_d("snd.drum.hat_closed", lambda s: I.hat(s, False, 0.8), "closed hat (six-oscillator metallic + noise)", "size:xs")
_d("snd.drum.hat_open", lambda s: I.hat(s, True, 0.8), "open hat", "size:s")
_d("snd.drum.rim", lambda s: I.rim(s), "rim click", "size:xs", ["mood:playful"], True)
_d("snd.drum.tom_lo", lambda s: I.tom(s, 110.0), "low tom, membrane modes", "size:m", ["mood:cinematic"], True)
_d("snd.drum.tom_hi", lambda s: I.tom(s, 220.0), "high tom", "size:s", ["mood:playful"], True)
_d("snd.drum.cowbell", lambda s: I.cowbell(s), "cowbell: two squares band-passed", "size:s", ["mood:playful", "mood:comic"], True, ("mime", "ad"))
_d("snd.drum.shaker", lambda s: I.shaker(s), "shaker: two back-and-forth bursts", "size:xs", ["mood:playful"])
_d("snd.drum.dhol_low", lambda s: I.dhol_low(s), "synthesised low hand-drum thump (own synthesis)", "size:m", ["mood:warm", "region:in"], True, ("ad", "mime", "launch"))
_d("snd.drum.dhol_rim", lambda s: I.dhol_rim(s), "synthesised bright hand-drum rim", "size:s", ["mood:warm", "region:in"], True, ("ad", "mime", "launch"))
_d("snd.drum.808", lambda s: I.e808(s), "808-style sine bass hit on A1 with soft drive", "size:l", ["mood:tech", "sub"], True)


@snd("snd.drum.crash", "drum", ["family:drum", "tier:2", "anchor:noise", "tonal:no", "size:l"], tier=2, use=["beat_edit", "ad", "launch"], pairs=["flash", "hardCut"], desc="crash cymbal: metallic partials + noise, 1.6 s", seed=181)
def crash(seed):
    n = dsp.sec(1.8)
    t = dsp.t_of(n)
    y = np.zeros(n)
    for f in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0):
        y += dsp.pulse_n(f * 2.6, n, 0.5)
    y = y / 6 * 0.5 + dsp.white(n, seed) * 0.8
    return dsp.lp(dsp.hp(y, 4500, 2), 12000, 2) * dsp.env_ad(t, 0.001, 0.55)


@snd("snd.drum.snare_roll", "drum", ["family:drum", "tier:2", "anchor:end", "tonal:no", "size:m", "riser"], tier=2, use=["beat_edit", "launch", "ad"], pairs=["flash", "hardCut", "smash"], desc="accelerating snare roll, 2 s, ends on the anchor", kind="fixed", seed=182)
def snare_roll(seed):
    n = dsp.sec(2.0)
    y = np.zeros(n)
    t0 = 0.0
    k = 0
    while t0 < 1.96:
        u = t0 / 2.0
        iv = 0.125 * (1 - 0.8 * u)
        dsp.add_at(y, I.snare(seed + k, 1.0, 0.25), dsp.sec(t0), 0.25 + 0.75 * u ** 1.5)
        t0 += max(iv, 0.025)
        k += 1
    return y, n - 1
