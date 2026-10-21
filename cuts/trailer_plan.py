#!/usr/bin/env python3
"""motion-pack / cuts / trailer.py: the trailer cut plan (2026-10-16, film lane). Stdlib only, deterministic, JSON out.

The craft (docs/evidence/film-trailer-craft.md, house starting values, tune by eye): a trailer's cut rate ACCELERATES act by act, every cut sits on the
music's grid, the stakes-rising hits (braams) land on bar downbeats, and the fastest stretch stops dead into a short silence before the title hit.

  rate(act, u)        beats per shot at the normalised time u (0..1) inside an act: act1 holds (8 beats), act2 4 -> 2, act3 2 -> 1 -> 0.5 (8th notes at the end)
  montage(f0, f1, fps, fpb, act)   frame-exact cut points from f0 to f1 (every cut on a whole half-beat of the grid; the last shot is never shorter than the quantum)
  plan(acts, fps, fpb)             the montage of every act + the braam downbeats + the silence + the hit
  hit_silence_hit(frame, fps, gap_s)   the pattern as cue rows: hit A, picture to black, a planned silence, hit B
  cutdown(beats, keep)             which beats a 30 s or 15 s cut keeps (by priority), so the cut-downs come from ONE plan

CLI:  python3 cuts/trailer_plan.py accel --bpm 120 --fps 30 --act-bars 4,6,6
      python3 cuts/trailer_plan.py hsh --frame 900 --fps 30 [--gap 2.0]
The same numbers are data in cuts/patterns.json, group `trailer` (`cuts/trailer/accelerate3Act`, `cuts/trailer/hitSilenceHit`, `cuts/trailer/silenceBeforeHit`,
`cuts/trailer/cutdown30`, `cuts/trailer/cutdown15`)."""
import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def _pat():
    with open(os.path.join(HERE, "patterns.json")) as f:
        return json.load(f)["trailer"]


def rate(act, u, P=None):
    """beats per shot at normalised time u in an act (piecewise linear between the pattern's knots)"""
    P = P or _pat()["accelerate3Act"]
    knots = P["beats_per_shot"][act]
    u = max(0.0, min(1.0, u))
    if len(knots) == 1:
        return float(knots[0][1])
    for (u0, b0), (u1, b1) in zip(knots, knots[1:]):
        if u <= u1:
            k = 0.0 if u1 == u0 else (u - u0) / (u1 - u0)
            return b0 + (b1 - b0) * k
    return float(knots[-1][1])


def montage(f0, f1, fps, fpb, act, P=None, act0=None, act1=None):
    """cut frames [f0, ..., < f1] for one act: shot lengths follow rate(), counted in whole half-beats, and every cut is placed on the half-beat grid of the act
    (frame = act start + round(k x fpb / 2)), so a cut on an even k is exactly a beat even when half a beat is not a whole frame. act0 / act1: the act this span sits in
    (the rate follows the act's clock); default = the span itself."""
    P = P or _pat()["accelerate3Act"]
    a0 = f0 if act0 is None else act0
    a1 = f1 if act1 is None else act1
    hb = fpb * P["quantum_beats"]                                   # frames per grid step (may be fractional: 7.5 at 120 BPM / 30 fps)
    k = int(round((f0 - a0) / hb))
    cuts, last = [f0], f0
    while True:
        u = (last - a0) / max(1, a1 - a0)
        n = max(1, int(round(rate(act, u, P) / P["quantum_beats"])))
        k += n
        f = a0 + int(round(k * hb))
        if f > f1 - hb + 1e-9:
            break
        cuts.append(f)
        last = f
    tail = max(1, int(round(rate(act, 1.0, P) / P["quantum_beats"]))) * hb
    if len(cuts) > 1 and f1 - cuts[-1] < 0.5 * tail:                # a stub at the end of the span joins the shot before it
        cuts.pop()
    return cuts


def plan(acts, fps=30, fpb=15, P=None):
    """acts: [{name: act1|act2|act3, start, end}] in frames. Returns the cut list per act, the braam downbeats (act2 every 2 bars, act3 every bar) and the stats"""
    P = P or _pat()["accelerate3Act"]
    out, bar = {"fps": fps, "frames_per_beat": fpb, "acts": []}, 4 * fpb
    for a in acts:
        c = montage(a["start"], a["end"], fps, fpb, a["name"], P)
        every = P["braam_every_bars"].get(a["name"])
        br = [a["start"] + k * every * bar for k in range((a["end"] - a["start"]) // (every * bar) + 1) if a["start"] + k * every * bar < a["end"]] if every else []
        lens = [b - x for x, b in zip(c, c[1:] + [a["end"]])]
        out["acts"].append({**a, "cuts": c, "braams": br, "shots": len(c), "asl_s": round(sum(lens) / len(lens) / fps, 3), "min_s": round(min(lens) / fps, 3)})
    rates = [x["shots"] / ((x["end"] - x["start"]) / fps) for x in out["acts"]]
    out["accelerates"] = all(b >= a - 1e-9 for a, b in zip(rates, rates[1:]))
    out["cuts_per_s"] = [round(r, 3) for r in rates]
    return out


def hit_silence_hit(frame, fps=30, gap_s=None, P=None):
    """hit A on `frame`, the picture goes to black on the next frame, `gap_s` of planned silence, hit B (the title) on the frame after it"""
    P = P or _pat()["hitSilenceHit"]
    g = gap_s if gap_s is not None else P["gap_s"]
    lo, hi = P["gap_range_s"]
    assert lo <= g <= hi, "the silence is %.2f s: keep it %.1f-%.1f s (shorter reads as a stutter, longer as a dropout)" % (g, lo, hi)
    gf = int(round(g * fps))
    b = frame + gf
    return {"pattern": "hitSilenceHit", "hit_a": frame, "black": [frame + 1, b], "hit_b": b, "quiet": [{"t": [round((frame + P["ring_frames"]) / fps, 4), round(b / fps, 4)], "kind": "gap", "why": "the silence before the hit"}],
            "cues": [{"id": P["sfx_a"], "frame": frame, "why": "hit A"}, {"id": P["sfx_ring"], "frame": frame + P["ring_frames"], "gain_db": P["ring_db"], "why": "the ear rings in the silence"},
                     {"id": P["sfx_b"], "frame": b, "why": "hit B (the title)"}]}


def cutdown(items, length):
    """items: [{id, keep: {full, 30, 15} priorities (lower = kept first) or a list of lengths}] -> the ids a cut keeps, in order"""
    key = str(length)
    return [it["id"] for it in items if key == "full" or key in [str(x) for x in it.get("in", ["full", "30", "15"])]]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("accel")
    a.add_argument("--bpm", type=float, default=120)
    a.add_argument("--fps", type=int, default=30)
    a.add_argument("--act-bars", default="4,6,6")
    h = sub.add_parser("hsh")
    h.add_argument("--frame", type=int, required=True)
    h.add_argument("--fps", type=int, default=30)
    h.add_argument("--gap", type=float)
    x = ap.parse_args(argv)
    if x.cmd == "accel":
        fpb = max(4, round(x.fps * 60.0 / x.bpm))
        bars = [int(v) for v in x.act_bars.split(",")]
        acts, f = [], 0
        for name, b in zip(("act1", "act2", "act3"), bars):
            acts.append({"name": name, "start": f, "end": f + b * 4 * fpb})
            f += b * 4 * fpb
        r = plan(acts, x.fps, fpb)
    else:
        r = hit_silence_hit(x.frame, x.fps, x.gap)
    print(json.dumps(r, indent=1))
    return r


if __name__ == "__main__":
    main()
