"""Indian instruments (owned synthesis, mpaudio/indian.py): tabla bols, sitar, santoor, shehnai, bansuri, harmonium, shruti box, conch, temple bell,
thali, dholak, manjira, ghungroo, nagara. Tonal voices are tuned to Sa = A (project key), just intonation where a svara other than Sa sounds.
These are stylised synth voices for ads, reels and short films, not imitations of any recording; tune by ear before a hero use."""
import numpy as np
from mpaudio import dsp, indian as IN
from mpaudio.dsp import sec, t_of, add_at
from mpaudio.registry import snd

SA = IN.SA


def _i(id, tags, desc, seed, tier=3, use=("ad", "mime", "short_film"), pairs=("cut",), tonal=True, **kw):
    return snd(id, "indian", ["family:indian", "region:in", "tier:%d" % tier, "tonal:" + ("yes" if tonal else "no"), *tags], tier=tier, use=list(use), pairs=list(pairs),
               desc=desc, tonal=tonal, seed=seed, **kw)


# ---- tabla (dayan modal bank after Raman 1920; bayan heuristic glide)
for _bol, _d, _sz in (("na", "tabla Na: rim stroke, fundamental damped, harmonics 2-3 ring", "size:xs"),
                      ("tin", "tabla Tin: open stroke on the maidan, soft ringing harmonics", "size:xs"),
                      ("tun", "tabla Tun: centre stroke, the fundamental rings (clear Sa)", "size:s"),
                      ("te", "tabla Te: closed centre stroke, dry", "size:xs"),
                      ("ka", "tabla Ka: closed bayan slap, flat and dry", "size:xs"),
                      ("dha", "tabla Dha: Na + open Ge together", "size:s"),
                      ("dhin", "tabla Dhin: Tin + open Ge together", "size:s"),
                      ("tirakita", "tabla Tirakita: four fast strokes Ti-Ra-Ki-Ta (fill)", "size:s")):
    _i("snd.indian.%s" % ("tabla_" + _bol), ["anchor:crest", _sz, "key:A", "instrument:tabla", "rr:4"], _d, 300 + len(_bol), pairs=("cut", "hardCut") if _bol in ("dha", "na") else ("cut",),
       use=("ad", "mime", "beat_edit", "short_film"))(lambda s, _b=_bol: IN.tabla(_b, s))


@_i("snd.indian.tabla_ge_open", ["anchor:crest", "size:s", "instrument:tabla", "rr:4"], "tabla Ge (bayan open): low stroke with the exponential pitch glide of wrist pressure", 311,
    use=("ad", "mime", "beat_edit"), pairs=("cut", "hardCut"))
def tabla_ge(seed):
    return IN.bayan_ge(seed)


# ---- strings
@_i("snd.indian.sitar_pluck", ["anchor:crest", "size:m", "key:A", "instrument:sitar"], "sitar pluck on Sa: Karplus-Strong + jawari bridge buzz + tarab resonator bank", 320, kind="peak",
    use=("ad", "short_film", "launch"), pairs=("cut", "dissolve"))
def sitar_pluck(seed):
    return IN.sitar_pluck(SA, 2.4, seed)


@_i("snd.indian.sitar_meend", ["anchor:crest", "size:m", "key:A", "instrument:sitar", "mood:warm"], "sitar meend: pluck Re, pulled up into Ga (two-semitone glide) over 0.45 s", 321,
    use=("ad", "short_film"), pairs=("dissolve", "cut"))
def sitar_meend(seed):
    return IN.sitar_pluck(IN.ji_hz(SA, 4), 2.6, seed, meend=(-2.0, 0.45))


@_i("snd.indian.sitar_jhala", ["anchor:crest", "size:m", "key:A", "instrument:sitar", "mood:hype"], "sitar jhala: fast melody strokes alternating with chikari drone strings (~1.1 s)", 322,
    tier=2, use=("ad", "beat_edit", "launch"), pairs=("cut", "speedRamp"))
def sitar_jhala(seed):
    return IN.sitar_jhala(seed)


@_i("snd.indian.santoor_hit", ["anchor:crest", "size:m", "key:A", "instrument:santoor", "mood:calm"], "santoor: hammered course of three detuned strings on Pa, long shimmer", 323,
    use=("ad", "short_film", "talking_head"), pairs=("dissolve", "cut"))
def santoor_hit(seed):
    y = IN.santoor_hit(IN.ji_hz(SA * 2, 7), 2.6, seed)
    add_at(y, IN.santoor_hit(IN.ji_hz(SA * 2, 12), 2.4, seed + 1)[:len(y) - sec(0.11)], sec(0.11), 0.6)
    return y


# ---- winds and reeds
@_i("snd.indian.shehnai_note", ["anchor:noise", "size:m", "key:A", "instrument:shehnai", "mood:festive"], "shehnai-like reed lead: pulse buzz through a formant stack, meend into Sa', vibrato", 324,
    use=("ad", "short_film", "launch"), pairs=("cut", "flash"))
def shehnai(seed):
    return IN.shehnai_note(SA * 2, 1.3, seed)


@_i("snd.indian.bansuri_note", ["anchor:noise", "size:m", "key:A", "instrument:bansuri", "mood:calm"], "bansuri-like flute on Pa: breathy sine, chiff and scoop", 325,
    use=("short_film", "talking_head", "ad"), pairs=("dissolve", "lightLeak"))
def bansuri(seed):
    return IN.bansuri_note(IN.ji_hz(SA * 2, 7), 1.6, seed)


@_i("snd.indian.harmonium_chord", ["anchor:noise", "size:m", "key:A", "instrument:harmonium", "mood:warm"], "harmonium chord Sa-Ga-Pa: detuned reed pairs with a bellows swell", 326,
    use=("ad", "talking_head", "mime"), pairs=("dissolve", "cut"))
def harmonium(seed):
    return IN.harmonium_chord([IN.ji_hz(SA, s) for s in (0, 4, 7, 12)], 1.6, seed)


@_i("snd.indian.shruti_drone", ["anchor:loop", "size:l", "key:A", "instrument:shruti", "loop", "mood:calm"], "shruti box drone Sa-Pa-Sa' (8.0 s seamless loop, 0.25 Hz bellows)", 327,
    loop=True, kind="fixed", use=("short_film", "talking_head", "ad"), pairs=("cut", "dissolve"))
def shruti(seed):
    return IN.shruti_loop(sec(8.0), seed, 110.0)


@_i("snd.indian.shankh_conch", ["anchor:noise", "size:l", "mood:festive", "instrument:shankh"], "shankh (conch) call: lip-buzz source, slow rise, falling end", 328, tier=2,
    use=("launch", "short_film", "ad"), pairs=("flash", "dipToBlack"))
def shankh(seed):
    return dsp.reverb(IN.shankh(seed), "hall", 0.22, seed)


# ---- metals
@_i("snd.indian.ghanta_temple_bell", ["anchor:crest", "size:l", "mood:calm", "instrument:ghanta"], "temple bell (ghanta): hum/prime/third/fifth/nominal partials, beating doublet, 5.5 s", 329,
    tier=2, use=("short_film", "launch", "ad"), pairs=("flash", "dissolve", "hardCut"))
def ghanta(seed):
    return IN.temple_bell(seed)


@_i("snd.indian.thali_clang", ["anchor:crest", "size:m", "mood:festive", "instrument:thali"], "thali (brass plate) struck with a spoon: inharmonic plate modes", 330,
    use=("mime", "ad", "short_film"), pairs=("hardCut", "smash"))
def thali(seed):
    return IN.thali(seed)


@_i("snd.indian.manjira", ["anchor:crest", "size:m", "mood:festive", "instrument:manjira"], "manjira: pair of small cymbals, bright beating ring", 331,
    use=("ad", "mime"), pairs=("cut", "flash"))
def manjira(seed):
    return IN.manjira(seed)


@_i("snd.indian.ghungroo", ["anchor:crest", "size:s", "mood:festive", "instrument:ghungroo", "rr:4"], "ghungroo: ankle-bell cluster, two shakes", 332, tonal=False,
    use=("ad", "mime", "short_film"), pairs=("cut", "lightLeak"))
def ghungroo(seed):
    return IN.ghungroo(seed)


# ---- drums
@_i("snd.indian.dholak_dha", ["anchor:crest", "size:s", "instrument:dholak", "rr:4"], "dholak Dha: treble head slap + bass head", 333, use=("ad", "mime", "beat_edit"), pairs=("cut", "hardCut"))
def dholak_dha(seed):
    return IN.dholak_dha(seed)


@_i("snd.indian.dholak_ge", ["anchor:crest", "size:s", "instrument:dholak", "rr:4"], "dholak Ge: bass head with a short pitch glide", 334, use=("ad", "mime", "beat_edit"), pairs=("cut",))
def dholak_ge(seed):
    return IN.dholak_ge(seed)


@_i("snd.indian.nagara_hit", ["anchor:crest", "size:l", "instrument:nagara", "mood:festive"], "nagara (kettle drum): low boom with a stick crack", 335, tier=2,
    use=("launch", "ad", "short_film"), pairs=("hardCut", "smash", "flash"))
def nagara(seed):
    return dsp.reverb(IN.nagara(seed), "room", 0.15, seed)


@_i("snd.indian.dhol_bhangra_hit", ["anchor:crest", "size:m", "instrument:dhol", "mood:hype"], "dhol double hit: dagga (bass) + tilli (stick) flam, bhangra accent", 336,
    tier=2, use=("ad", "beat_edit", "launch"), pairs=("hardCut", "scalePunch", "smash"))
def dhol_bhangra(seed):
    from mpaudio import instruments as I
    y = np.zeros(sec(0.6))
    add_at(y, I.dhol_low(seed, 1.0), 0)
    add_at(y, I.dhol_rim(seed + 1, 0.9), dsp.ms(18))
    add_at(y, I.dhol_rim(seed + 2, 0.6), dsp.ms(95))
    return y
