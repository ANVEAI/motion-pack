"""motion-pack / music / logo.py : sonic logos. A logo is a 1.2-2.5 s signature (FM-bell motif + soft pad chord + sub on the last note) used the same way every time.
motif_from_name(name) hashes a brand name (SHA-256) to a stable, ORIGINAL pattern from the bank + rhythm + hold, so every brand gets its own signature without
copying anyone's. Key = project key (A major, MIDI 69)."""
import hashlib
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp
import recipes.stingers as S

BANK = ["ascend_land", "fifth_lift", "question", "pulse_pad", "two_note", "drop_land"]


def motif_from_name(name):
    d = hashlib.sha256(name.strip().lower().encode()).digest()
    pat = BANK[d[0] % len(BANK)]
    notes = list(S.PATTERNS[pat])
    rh = list(S.RHYTHM_MS[pat])
    scale = 0.85 + (d[1] % 40) / 100.0                             # 0.85 .. 1.24 : tempo of the motif
    rh = [int(round(x * scale)) for x in rh]
    if d[2] % 3 == 0 and len(notes) >= 3:                          # ornament: lift the penultimate note a scale step (+2 semitones)
        notes[-2] = notes[-2] + 2
    if d[3] % 4 == 0:
        notes[-1] = notes[-1] + 12 if notes[-1] < 12 else notes[-1]
    hold = 0.75 + (d[4] % 60) / 100.0
    return {"name": name, "pattern": pat, "notes": notes, "rhythm_ms": rh, "hold_s": round(hold, 2), "sha": d.hex()[:12]}


def render_logo(name=None, pattern=None, tonic=69, seed=1, tail=0.30):
    """returns (stereo float64, anchor_sample) ; anchor = the landing (last) note"""
    if name is not None:
        m = motif_from_name(name)
        y = S.logo_sig(m["pattern"], tonic, seed, m["hold_s"], m["rhythm_ms"], 2.5, True, True, tail, notes=m["notes"])
        return y, dsp.ms(m["rhythm_ms"][len(m["notes"]) - 1]), m
    y = S.logo_sig(pattern, tonic, seed, tail=tail)
    return y, dsp.ms(S.RHYTHM_MS[pattern][len(S.PATTERNS[pattern]) - 1]), {"pattern": pattern, "notes": S.PATTERNS[pattern]}


def render_logo_sitar(name=None, pattern=None, tonic=57, seed=1, total=3.2):
    """sitar-and-tanpura sonic logo: the same hash-derived (or bank) motif played as sitar plucks in just intonation over a tanpura Sa-Pa,
    with a tabla Dha under the landing note. Returns (stereo float64, anchor_sample, info); anchor = the landing (last) note."""
    from mpaudio import indian as IN
    if name is not None:
        m = motif_from_name(name)
        notes, rh = m["notes"], m["rhythm_ms"]
        info = dict(m, timbre="sitar")
    else:
        notes, rh = list(S.PATTERNS[pattern]), list(S.RHYTHM_MS[pattern])
        info = {"pattern": pattern, "notes": notes, "timbre": "sitar"}
    sa = dsp.note_hz(tonic)
    n = dsp.sec(total)
    y = np.zeros((n, 2))
    # tanpura bed: Pa (low) and Sa plucked just before the motif, so the logo opens on its drone
    for k, (f, at) in enumerate(((sa * 0.75, 0.0), (sa, 0.12), (sa / 2, 0.24))):
        v = IN.jawari(dsp.ks(f, dsp.sec(total), seed + k, g=0.9993, damp=0.7, bright=0.9), 0.75, 0.22)
        dsp.add_at(y, dsp.pan_st(v, [-0.4, 0.3, 0.0][k]), dsp.sec(at), 0.22)
    off = dsp.ms(60)
    for k, (st, t_ms) in enumerate(zip(notes, rh)):
        last = k == len(notes) - 1
        v = IN.sitar_pluck(IN.ji_hz(sa * 2, st), 2.0 if last else 0.9, seed + 10 + k, 1.0, meend=(-1.0, 0.1) if last and len(notes) > 2 else None, sa_hz=sa)
        dsp.add_at(y, dsp.pan_st(v, 0.1 * (k - len(notes) / 2) / max(1, len(notes))), off + dsp.ms(t_ms), 0.8 if last else 0.6)
    land = off + dsp.ms(rh[len(notes) - 1])
    dsp.add_at(y, dsp.pan_st(IN.tabla("dha", seed + 50, sa), 0.0), land, 0.55)
    return y, land, info
