"""Sonic logos and stingers. Logo = 3-5 note motif (FM bell) + soft pad chord + sub on the last note; all in the project key (A major, A = MIDI 69).
motif_from_name() in music/logo.py hashes a brand name into a stable, original pattern; no existing logo is imitated."""
import numpy as np
from mpaudio import dsp, instruments as I
from mpaudio.dsp import SR, sec, db, t_of, env_ad, svf, white, rng, add_at, note_hz, expo
from mpaudio.registry import snd

PATTERNS = {
    "ascend_land": [0, 4, 7, 12],
    "fifth_lift": [0, 7, 4],
    "question": [0, 2, 7],
    "pulse_pad": [0, 0, 7, 0],
    "two_note": [7, 12],
    "drop_land": [12, 7, 0],
    "hybrid": [0, 0, 7, 12],
}
RHYTHM_MS = {"ascend_land": [0, 140, 280, 560], "fifth_lift": [0, 160, 340], "question": [0, 160, 340], "pulse_pad": [0, 140, 280, 560], "two_note": [0, 220], "drop_land": [0, 160, 340], "hybrid": [0, 140, 280, 560]}


def logo_sig(pattern="hybrid", tonic=69, seed=1, hold=0.9, rhythm=None, total=2.4, pad=True, sub=True, tail=0.30, notes=None):
    notes = notes if notes is not None else PATTERNS[pattern]
    rh = rhythm or RHYTHM_MS[pattern]
    n = sec(total)
    y = np.zeros(n)
    last_t = rh[len(notes) - 1]
    for k, st in enumerate(notes):
        f = note_hz(tonic + st)
        d = hold if k == len(notes) - 1 else 0.25
        add_at(y, I.bell(f, d, d, 6.0, vel=1.0 if k == len(notes) - 1 else 0.8), dsp.ms(rh[k]), 1.0)
    if pad:
        final = notes[-1]
        chord = [tonic - 12 + final, tonic - 12 + final + 4, tonic - 12 + final + 7, tonic + final + 2]
        for j, m in enumerate(chord):
            v = I.pad(note_hz(m), hold + 0.2, vel=0.5 if j < 3 else 0.2, seed=seed + j, fc=2400, attack=0.04, rel=0.8)
            add_at(y, v, dsp.ms(last_t), 0.25)
    if sub:
        m = sec(0.8)
        t = t_of(m)
        add_at(y, np.sin(dsp.phase(np.full(m, note_hz(tonic - 36)))) * env_ad(t, 0.005, 0.6), dsp.ms(last_t), 0.5)
    return dsp.reverb(y, "hall", tail)


def _logo(pattern, seed):
    anchor_ms = RHYTHM_MS[pattern][len(PATTERNS[pattern]) - 1]

    def f(s, _p=pattern):
        return logo_sig(_p, 69, s), dsp.ms(RHYTHM_MS[_p][len(PATTERNS[_p]) - 1])
    return f


for _p, _desc in (("ascend_land", "confident: major arpeggio resolving up an octave"), ("fifth_lift", "friendly: rise a fifth, land on the third"), ("question", "curious: ends unresolved on the fifth"),
                  ("pulse_pad", "authoritative: repeated tonic then rise"), ("two_note", "minimal: fifth to octave"), ("drop_land", "closure for end cards: descending resolution"),
                  ("hybrid", "hybrid [0,0,7,12] on A major: pulse then rise to the octave")):
    snd("snd.logo." + _p, "logo", ["family:logo", "tier:1", "anchor:crest", "tonal:yes", "key:A", "mood:" + ("tech" if _p in ("pulse_pad", "hybrid") else "warm"), "size:l"], tier=1, use=["launch", "ad", "short_film", "talking_head"],
        pairs=["dipToBlack", "dissolve", "hardCut", "flash"], desc="sonic logo, " + _desc + " (anchor = the landing note)", kind="fixed", tonal=True, seed=190)(_logo(_p, 190))


def _mono(x):
    return x.mean(axis=1) if x.ndim == 2 else x


@snd("snd.stinger.reveal", "stinger", ["family:stinger", "tier:2", "anchor:crest", "tonal:yes", "key:A", "size:m"], tier=2, use=["launch", "ad"], pairs=["maskReveal", "flash", "hardCut"], desc="reveal: 300 ms inhale into brand stab + sparkle (anchor = the stab)", kind="fixed", tonal=True, seed=191)
def stinger_reveal(seed):
    from .risers import lift_inhale
    from .impacts import hit_stab
    from .materials import sparkle
    pre = sec(0.3)
    n = pre + sec(1.4)
    y = np.zeros(n)
    add_at(y, _mono(lift_inhale(seed)[0]), 0, 0.5)
    add_at(y, hit_stab(seed), pre, 1.0)
    add_at(y, _mono(sparkle(seed + 1))[:sec(1.0)], pre + dsp.ms(30), 0.25)
    return dsp.reverb(y, "plate", 0.12), pre


@snd("snd.stinger.win", "stinger", ["family:stinger", "tier:2", "anchor:crest", "tonal:yes", "key:A", "mood:playful"], tier=2, use=["ad", "mime", "launch"], pairs=["flash", "hardCut"], desc="win: reverse cymbal into ta-da + success arpeggio", kind="fixed", tonal=True, seed=192)
def stinger_win(seed):
    from .cartoon import tada
    from .ui import ui_success
    pre = sec(0.4)
    n = pre + sec(1.5)
    y = np.zeros(n)
    cym = dsp.hp(white(pre, seed), 5000) * np.linspace(0, 1, pre) ** 2.5
    add_at(y, cym, 0, 0.4)
    add_at(y, _mono(tada(seed)), pre, 0.9)
    add_at(y, ui_success(seed), pre + dsp.ms(40), 0.5)
    return y, pre


@snd("snd.stinger.alert", "stinger", ["family:stinger", "tier:2", "anchor:crest", "tonal:yes", "mood:tense"], tier=2, use=["ad", "talking_head", "beat_edit"], pairs=["glitch", "hardCut"], desc="alert: three pulsing E5 tones then a punch (pattern interrupt)", kind="fixed", tonal=True, seed=193)
def stinger_alert(seed):
    from .impacts import hit_punch
    pre = sec(0.36)
    n = sec(1.0)
    y = np.zeros(n)
    for k in range(3):
        m = sec(0.12)
        t = t_of(m)
        v = np.sin(dsp.TWO_PI * 659.25 * t) * (0.5 + 0.5 * np.sin(dsp.TWO_PI * 8 * t)) * env_ad(t, 0.004, 0.08)
        add_at(y, v, sec(0.12 * k), 0.5)
    add_at(y, hit_punch(seed), pre, 1.0)
    return y, pre


@snd("snd.stinger.cut_to_black", "stinger", ["family:stinger", "tier:1", "anchor:crest", "tonal:yes", "mood:cinematic"], tier=1, use=["short_film", "launch"], pairs=["dipToBlack", "hardCut"], desc="cinema hit cut off at 350 ms, then studio air: for the last frame before black", kind="fixed", tonal=True, seed=194)
def stinger_cut_black(seed):
    from .impacts import sub_drop
    n = sec(1.6)
    t = t_of(n)
    h = sub_drop(seed, length=1.6)
    hs = svf(white(n, seed), expo(6000, 250, t / 0.4), 0.9, "lp") * env_ad(t, 0.002, 0.2) * 0.7
    y = (h + hs)
    g = np.where(t < 0.342, 1.0, np.where(t < 0.35, np.cos((t - 0.342) / 0.008 * np.pi / 2), 0.0))
    y = y * g
    air = dsp.fft_filter(white(n, seed + 5), 60, 900, 2)
    air = air / np.std(air) * 0.01 * np.clip((t - 0.35) / 0.2, 0, 1)
    return y + air, 0


@snd("snd.stinger.question", "stinger", ["family:stinger", "tier:3", "anchor:crest", "tonal:yes", "key:A", "mood:warm"], tier=3, use=["talking_head", "ad", "short_film"], pairs=["dissolve", "hardCut"], desc="question motif, bell only: to-be-continued", kind="fixed", tonal=True, seed=195)
def stinger_question(seed):
    return logo_sig("question", 69, seed, pad=False, sub=False, total=1.4), dsp.ms(RHYTHM_MS["question"][2])


@snd("snd.stinger.bump", "stinger", ["family:stinger", "tier:3", "anchor:crest", "tonal:yes", "mood:comic"], tier=3, use=["mime", "talking_head", "ad"], pairs=["hardCut"], desc="two-note comedy bump + sub", kind="fixed", tonal=True, seed=196)
def stinger_bump(seed):
    n = sec(0.5)
    y = np.zeros(n)
    add_at(y, I.marimba(note_hz(57), 0.12, 1.0, seed), 0, 0.8)
    add_at(y, I.marimba(note_hz(64), 0.2, 1.0, seed), dsp.ms(140), 1.0)
    m = sec(0.3)
    t = t_of(m)
    add_at(y, np.sin(dsp.phase(np.full(m, 55.0))) * env_ad(t, 0.004, 0.1), dsp.ms(140), 0.7)
    return y, dsp.ms(140)
