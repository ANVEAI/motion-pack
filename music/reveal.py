"""motion-pack / music / reveal.py : the dark -> reveal score for device / hardware launch films (xp-hardware, 2026-10-16). NOT a loop and NOT a library bed:
it is composed per cut, so the drop lands on the film's reveal frame whatever the length (templates/hardware-reveal, hardware-teaser and spec-sheet call it).

Shape (craft from how device keynote reveals and hardware launch films are scored, never a copy of any): a dark open that is almost only a sub heartbeat and a
drone (energy ~0.08), a rising build under the light sweep (energy ramps, a 16th tick enters), ONE pre-drop gap (the drums' last beat, compose.py) and the DROP
on the reveal bar (crash + kick + a one-bar noise riser that ends one frame before it, compose.py _transitions), a confident groove under the hero shots,
a lower, intimate stretch for the "inside" macro, a lift for the spec sheet, a calmer price card, and a tonic button on the end card ("tail" section).

  sections = [{"name": "dark", "bars": 3, "energy": 0.08}, {"name": "sweep", "bars": 2, "energy": [0.25, 0.5]}, {"name": "reveal", "bars": 4, "energy": 1.0}, ...]
  render_reveal(sections, fps=30, bpm=120, seed=3) -> {"mix": (n, 2) float, "stems": {...}, "events": [...], "meta": {...}, "markers": {...}}
  python3 music/reveal.py --sections sections.json --fps 30 --bpm 120 --seed 3 --out out/score.wav    (writes score.wav, 24-bit, and score.json: the sidecar)

Every section starts on a bar line; with the tempo snap (one beat = whole frames) every marker is a whole frame. The preset ('hw_reveal', defined HERE and injected
into compose.PRESETS at call time, so build_music.py does not turn it into a library loop) is A minor, 120 BPM: sub kick heartbeat from energy 0.05, a 16th tick
from 0.3, kick / clap / hats from 0.6, taiko on the drop, a saw bass from 0.55, a dark synth pad throughout, a bell motif only at the top (0.85).
Owned synthesis only (compose.py voices). Deterministic for a seed. The stand-alone mix is normalised to -16 LUFS-I (the library's preview level); music/mixer.py sets
the real level under the cues."""
import json
import os
import sys
import numpy as np
import _path  # noqa: F401
from mpaudio import dsp, meter
from mpaudio.dsp import SR
import compose as C
import grid
from presets import PRESETS

_E8 = list(range(0, 16, 2))
_E16 = list(range(16))
PRESET = dict(bpm=120, key=9, scale="minor", prog="cinematic", drums="pattern",
              drum_pat=[("kick_sub", [0, 10], 0.95, 0.9, 0.05), ("tick", _E16, 0.3, 0.32, 0.3), ("kick", [0, 8], 1.0, 1.0, 0.6), ("clap", [4, 12], 0.85, 0.55, 0.7),
                        ("hat", _E8, 0.6, 0.42, 0.6), ("hat", [1, 3, 5, 7, 9, 11, 13, 15], 0.4, 0.26, 0.85), ("taiko", [0], 0.9, 0.55, 0.9), ("crash", [0], 0.5, 0.25, 0.97)],
              bass="saw", bass_steps=_E8, harmony="synthpad", lead="bell", swing=0.0, humanize=0, pump=True, lead_at=0.85, loop_energy=0.8,
              mood=["cinematic", "tech", "confident"], use=["launch", "product"],
              desc="dark -> reveal: sub heartbeat + drone open, a ticking build, the drop on the reveal, a confident groove, a tonic button (A minor, 120 BPM)")
DEFAULT_SECTIONS = [{"name": "dark", "bars": 3, "energy": 0.08}, {"name": "sweep", "bars": 2, "energy": [0.25, 0.5]}, {"name": "reveal", "bars": 4, "energy": 1.0},
                    {"name": "explode", "bars": 4, "energy": 0.85}, {"name": "scale", "bars": 2, "energy": 0.7}, {"name": "ports", "bars": 3, "energy": 0.8},
                    {"name": "inside", "bars": 3, "energy": 0.6}, {"name": "specs", "bars": 3, "energy": 0.85}, {"name": "price", "bars": 2, "energy": 0.5},
                    {"name": "tail", "bars": 2, "energy": 0.3}]


def gain_for(s):
    """section level (dB): an explicit `gain_db` (number, or [from, to] for a ramp), else from the energy: the dark open sits ~12 dB under the drop, so the
    reveal is a real arrival (compose.py balances its stems over the whole track, which alone leaves a dark open only ~4 dB under the drop)"""
    if s.get("gain_db") is not None:
        g = s["gain_db"]
        return tuple(float(x) for x in g) if isinstance(g, (list, tuple)) else float(g)
    e = _energy(s["energy"])
    f = lambda x: -9.0 * (1.0 - min(1.0, max(0.0, x))) ** 1.4
    return (f(e[0]), f(e[1])) if isinstance(e, tuple) else f(e)


def automation(sections, fps, bpm, n, vacuum_beats=0.5):
    """per-sample gain (linear) from the section levels: ramps inside a ramped section, 40 ms glides between sections, an instant step UP on every drop
    (the arrival is a cut, not a fade) after a `vacuum_beats` dip to -18 dB (the pre-hit vacuum: the drums already rest on the last beat)"""
    M = markers(sections, fps, bpm)
    spf = SR / fps
    g = np.zeros(n)
    drops = {d["frame"] for d in M["drops"]}
    for i, (s, m) in enumerate(zip(sections, M["sections"])):
        a = int(round(m["frame0"] * spf))
        b = int(round((M["sections"][i + 1]["frame0"] if i + 1 < len(M["sections"]) else M["end_frame"]) * spf)) if i + 1 < len(M["sections"]) else n
        gd = gain_for(s)
        g[a:b] = np.linspace(gd[0], gd[1], b - a) if isinstance(gd, tuple) else gd
    glide = int(0.04 * SR)
    out = g.copy()
    for m in M["sections"][1:]:
        a = int(round(m["frame0"] * spf))
        if m["frame0"] in drops:
            v = int(round(vacuum_beats * M["frames_per_beat"] * spf))
            out[a - v:a] = np.minimum(out[a - v:a], np.linspace(out[a - v], -18.0, v))
            continue
        lo, hi = max(0, a - glide), min(n, a + glide)
        out[lo:hi] = np.linspace(g[lo], g[hi - 1], hi - lo)
    return 10 ** (out / 20)


def _energy(e):
    return tuple(float(x) for x in e) if isinstance(e, (list, tuple)) else float(e)


def structure(sections):
    """[{name, bars, energy}] -> compose.py structure [(name, bars, energy)]; refuses fractional or empty sections (every marker must be a bar line)"""
    out = []
    for s in sections:
        b = s["bars"]
        if not (isinstance(b, int) and b >= 1):
            raise ValueError("section %s: bars must be a whole number >= 1, got %r" % (s.get("name"), b))
        out.append((str(s["name"]), b, _energy(s["energy"])))
    if not out:
        raise ValueError("no sections")
    return out


def markers(sections, fps=30, bpm=120):
    """section start frames, the drop frames (every section whose energy jumps >= 0.3 over the bar before: compose.py puts its crash + kick there), the end"""
    bpm_s, fpb = grid.snap_bpm(bpm, fps)
    st, out, drops, prev_e, bar = structure(sections), [], [], 0.0, 0
    for name, bars, e in st:
        e0 = e[0] if isinstance(e, tuple) else e
        f0 = bar * 4 * fpb
        out.append({"name": name, "bar0": bar, "bars": bars, "frame0": f0, "t0": round(f0 / fps, 4), "energy": e})
        if bar > 0 and e0 - prev_e >= 0.3:
            drops.append({"section": name, "frame": f0, "t": round(f0 / fps, 4)})
        prev_e = e[1] if isinstance(e, tuple) else e
        bar += bars
    end = bar * 4 * fpb
    return {"bpm": round(bpm_s, 4), "frames_per_beat": fpb, "frames_per_bar": 4 * fpb, "sections": out, "drops": drops, "end_frame": end, "seconds": round(end / fps, 4)}


def render_reveal(sections=None, fps=30, bpm=120, seed=3, preset=None, tail_s=1.2):
    sections = sections or DEFAULT_SECTIONS
    PRESETS["hw_reveal"] = dict(preset or PRESET, bpm=bpm)
    try:
        r = C.compose("hw_reveal", structure(sections), seed, fps, bpm=bpm, loop=False)
    finally:
        PRESETS.pop("hw_reveal", None)
    M = markers(sections, fps, bpm)
    n_body = int(round(M["end_frame"] * SR / fps))
    n = n_body + int(round(tail_s * SR))
    mix = r["mix"][:n].copy()
    if len(mix) < n:
        mix = np.concatenate([mix, np.zeros((n - len(mix), 2))])
    auto = automation(sections, fps, bpm, n)
    mix *= auto[:, None]
    # ring-out: the tail section's button decays naturally, then a 0.5 s raised-cosine fade to digital zero over the last 0.15 s
    f = int(0.5 * SR)
    mix[-f:] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(f) / f))[:, None]
    mix[-int(0.15 * SR):] = 0.0
    L = meter.lufs_integrated(mix)
    g = 10 ** ((-16.0 - L) / 20)
    mix *= g
    tp = meter.true_peak_db(mix)
    if tp > -1.5:
        mix *= 10 ** ((-1.5 - tp) / 20)
    stems = {k: v[:n] * auto[:len(v[:n]), None] * g for k, v in r["stems"].items()}
    ev = [dict(e, frame=round(e["sample"] * fps / SR, 2)) for e in r["events"] if e["sample"] < n]
    meta = dict(r["meta"], length_s=round(n / SR, 4), lufs_i=round(meter.lufs_integrated(mix), 2), true_peak_dbtp=round(meter.true_peak_db(mix), 2), tail_s=tail_s)
    return {"mix": mix, "stems": stems, "events": ev, "meta": meta, "markers": M}


def main(argv):
    import argparse
    import soundfile as sf
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sections", default=None, help="JSON file or inline JSON list of {name, bars, energy}; default = the 56 s reveal")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--bpm", type=float, default=120)
    ap.add_argument("--seed", type=int, default=3)
    ap.add_argument("--tail", type=float, default=1.2, help="seconds of ring-out after the last section (the end-card quiet hold rides on it)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    secs = None
    if a.sections:
        secs = json.load(open(a.sections)) if os.path.exists(a.sections) else json.loads(a.sections)
    r = render_reveal(secs, a.fps, a.bpm, a.seed, tail_s=a.tail)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    sf.write(a.out, r["mix"].astype(np.float32), SR, subtype="PCM_24")
    side = {"file": os.path.basename(a.out), "kind": "score", "generator": "music/reveal.py", "seed": a.seed, "fps": a.fps, "markers": r["markers"], "meta": r["meta"],
            "drops": r["markers"]["drops"], "events": [e for e in r["events"] if e["kind"] in ("drop", "riser", "button", "hook_hit")]}
    json.dump(side, open(os.path.splitext(a.out)[0] + ".json", "w"), indent=1)
    print(a.out, "%.2f s" % r["meta"]["length_s"], "bpm", r["markers"]["bpm"], "drops at frames", [d["frame"] for d in r["markers"]["drops"]],
          "LUFS-I", r["meta"]["lufs_i"], "TP", r["meta"]["true_peak_dbtp"])


if __name__ == "__main__":
    main(sys.argv[1:])
