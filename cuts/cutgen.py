#!/usr/bin/env python3
"""motion-pack / cuts / cutgen.py: BPM + pattern -> frame-exact cut points (stdlib only, deterministic).

Subcommands (all print JSON):
  beats      --bpm 128 --fps 30 --pattern every_2 --bars 8 [--offset 0.0] [--snap] [--tx whip]
             cut list; --snap uses the nearest BPM whose beat is a whole number of frames (zero rounding error);
             --tx attaches a transition window per cut from ../transitions/catalog.json (swap ON the beat) + its sound cues
  section    --bpm 128 --fps 30 --plan build_accelerate [--offset 0.0] [--snap]
  split      --mode J|L|film_J|broll_lead --cut-frame 120 --fps 30 [--ms 400] [--sr 48000]
  talking    --cuts 0,72,150,260 --fps 30 [--end-frame 330] [--claims 150]       jump-cut reframes + punch-ins
  smash      --cut-frame 120 --fps 30 [--sr 48000]
  interrupts --duration 30 --fps 30 [--seed 1]                                      the interrupt ladder
Library use: import cutgen; cutgen.beat_cuts(...)."""
import argparse, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "patterns.json")) as _f:
    PATTERNS = json.load(_f)
CATALOG_PATH = os.path.join(HERE, "..", "transitions", "catalog.json")


def snap_bpm(bpm, fps):
    """Nearest tempo whose beat is a whole number of frames (sound.md 8: BPM_snap = fps*60/round(fps*60/BPM))."""
    return fps * 60.0 / max(1, round(fps * 60.0 / bpm))


def frame_of(t, fps):
    return int(math.floor(t * fps + 0.5))      # round half up, identical in JS (Math.round) for t >= 0


def beat_positions(pattern, bars, start_beat=0.0):
    p = PATTERNS["beat"][pattern]
    cyc, total, out = p["cycle_beats"], bars * 4.0, []
    k = 0
    while True:
        base = k * cyc
        if base >= total:
            break
        for c in p["cuts"]:
            b = base + c
            if b < total:
                out.append(start_beat + b)
        k += 1
    return sorted(set(out))


def load_catalog():
    if not os.path.exists(CATALOG_PATH):
        raise SystemExit("transitions/catalog.json missing: run node transitions/tools/build.mjs")
    with open(CATALOG_PATH) as f:
        return {t["key"]: t for t in json.load(f)["transitions"]}


def tx_window(entry, cut_frame, bpm, fps):
    """Same math as transitions/lib/tx-core.js txWindow(): length = beats on the grid, swap exactly on cut_frame."""
    tm = entry["timing"]
    n = max(tm.get("minFrames", 2), int(math.floor(tm["beats"] * 60.0 / bpm * fps + 0.5)))
    start = cut_frame - int(math.floor(tm["cut"] * n + 0.5))
    cues = []
    for s in entry["sfx"]:
        anchor = {"cut": cut_frame, "start": start, "end": start + n, "peak": cut_frame}[s["at"]] + s["offset_f"]
        cue = {"sfx": s["id"], "anchor_frame": anchor, "gain_db": s["gain_db"]}
        if s.get("note"):
            cue["note"] = s["note"]       # e.g. alt / optional / pending: the planner picks, the first cue is the default
        cues.append(cue)
    return {"key": entry["key"], "id": entry["id"], "start": start, "cut": cut_frame, "end": start + n, "frames": n, "sfx": cues}


def beat_cuts(bpm, fps, pattern, bars, offset=0.0, snap=False, tx=None, start_beat=0.0):
    used = snap_bpm(bpm, fps) if snap else float(bpm)
    spb = 60.0 / used
    cuts = []
    for i, b in enumerate(beat_positions(pattern, bars, start_beat)):
        t = offset + b * spb
        f = frame_of(t, fps)
        cuts.append({"i": i, "beat": round(b, 6), "bar": int(b // 4) + 1, "beat_in_bar": round(b % 4 + 1, 6),
                     "time_s": round(t, 6), "frame": f, "err_ms": round((f / fps - t) * 1000.0, 3)})
    out = {"bpm": bpm, "bpm_used": round(used, 6), "fps": fps, "beat_frames": round(fps * spb, 6), "pattern": pattern,
           "bars": bars, "offset_s": offset, "max_abs_err_ms": max([abs(c["err_ms"]) for c in cuts] or [0]), "cuts": cuts}
    if snap:
        out["tempo_drift_pct"] = round((used - bpm) / bpm * 100.0, 4)
    if tx:
        cat, warn = load_catalog(), []
        if tx not in cat:
            raise SystemExit("unknown transition " + tx)
        for c in cuts:
            c["tx"] = tx_window(cat[tx], c["frame"], used, fps)
        for a, b in zip(cuts, cuts[1:]):
            if a["tx"]["end"] > b["tx"]["start"]:
                warn.append("windows overlap at cuts %d/%d: shorten beats or pick a sparser pattern" % (a["i"], b["i"]))
        out["warnings"] = warn
    return out


def section_cuts(bpm, fps, plan, offset=0.0, snap=False):
    sec, beat, cuts, segs = PATTERNS["sections"][plan], 0.0, [], []
    for s in sec["segments"]:
        r = beat_cuts(bpm, fps, s["pattern"], s["bars"], offset=offset, snap=snap, start_beat=beat)
        segs.append({"pattern": s["pattern"], "bars": s["bars"], "from_beat": beat, "cuts": len(r["cuts"])})
        cuts += r["cuts"]
        beat += s["bars"] * 4
    used = snap_bpm(bpm, fps) if snap else float(bpm)
    hero_t = offset + beat * 60.0 / used
    for i, c in enumerate(cuts):
        c["i"] = i
    return {"plan": plan, "bpm_used": round(used, 6), "fps": fps, "segments": segs, "cuts": cuts,
            "hero": {"beat": beat, "time_s": round(hero_t, 6), "frame": frame_of(hero_t, fps), "note": sec.get("then", "")}}


def split(mode, cut_frame, fps, ms=None, sr=48000):
    p = PATTERNS["split"][mode]
    lead = ms if ms is not None else p.get("audio_lead_ms", p.get("audio_tail_ms"))
    sign = -1 if mode in ("J", "film_J", "broll_lead") else 1          # J: audio edit BEFORE the picture cut
    audio_t = cut_frame / fps + sign * lead / 1000.0
    if mode == "broll_lead":                                         # picture leads the VO: move the picture, not the audio
        return {"mode": mode, "vo_frame": cut_frame, "picture_cut_frame": frame_of(cut_frame / fps - abs(lead) / 1000.0, fps),
                "note": p["use"]}
    xf = int(round(p["crossfade_ms"] / 1000.0 * sr))
    a_samp = int(round(audio_t * sr))
    return {"mode": mode, "picture_cut_frame": cut_frame, "audio_cut_s": round(audio_t, 6), "audio_cut_sample": a_samp,
            "audio_cut_frame": frame_of(audio_t, fps), "crossfade_samples": xf, "crossfade": [a_samp - xf // 2, a_samp + xf - xf // 2],
            "ambience_bridge_ms": p.get("ambience_bridge_ms", 0), "sr": sr, "note": p["use"]}


def talking(cut_frames, fps, end_frame=None, claims=()):
    th = PATTERNS["talking_head"]
    scales, pi, push = th["reframe_alternate"]["scales"], th["punch_in"], th["slow_push"]
    edges = list(cut_frames) + [end_frame if end_frame is not None else cut_frames[-1] + int(3 * fps)]
    segs, last_punch = [], -1e9
    for i in range(len(edges) - 1):
        a, b = edges[i], edges[i + 1]
        seg = {"i": i, "start": a, "end": b, "scale": scales[i % len(scales)], "anchor": th["reframe_alternate"]["anchor"],
               "sfx": [{"sfx": th["cut_tick"]["sfx"], "anchor_frame": a + 1, "gain_db": th["cut_tick"]["gain_db"]}] if i else []}
        claim = next((c for c in claims if a <= c < b), None)
        if claim is not None and (claim - last_punch) / fps >= pi["min_gap_s"]:
            seg["punch_in"] = {"frame": claim, "scale_to": round(seg["scale"] * pi["scale_to"], 4), "in_frames": max(1, frame_of(pi["in_ms"] / 1000.0, fps)), "ease": pi["ease"]}
            seg["sfx"].append({"sfx": pi["sfx"], "anchor_frame": claim + 1, "gain_db": 3})
            last_punch = claim
        elif claim is not None:
            seg["punch_in_skipped"] = "within %.1f s of the previous punch-in" % pi["min_gap_s"]
        if (b - a) / fps > push["when_shot_longer_than_s"] and "punch_in" not in seg:
            seg["slow_push"] = {"from": seg["scale"], "to": round(seg["scale"] * push["to"], 4), "ease": push["ease"]}
        segs.append(seg)
    return {"fps": fps, "segments": segs}


def smash(cut_frame, fps, sr=48000):
    s = PATTERNS["smash"]
    t = cut_frame / fps
    return {"cut_frame": cut_frame, "silence_start_s": round(t - s["pre_silence_ms"] / 1000.0, 6),
            "silence_start_sample": int(round((t - s["pre_silence_ms"] / 1000.0) * sr)), "ramp_samples": int(round(s["ramp_ms"] / 1000.0 * sr)),
            "impact": {"sfx": s["sfx"][0], "alt": s["sfx"][1], "anchor_frame": cut_frame + 1, "anchor_sample": int(round((cut_frame + 1) * sr / fps))},
            "lint": {"min_loudness_jump_db": s["contrast_loudness_db"], "min_luma_delta": s["contrast_luma"]}}


def interrupts(duration, fps, seed=1):
    """Deterministic ladder (LCG jitter): returns events by level; majors keep major_min_gap_s."""
    cfg, st, ev = PATTERNS["interrupts"], [seed & 0x7FFFFFFF or 1], []

    def rnd():
        st[0] = (st[0] * 1103515245 + 12345) & 0x7FFFFFFF
        return st[0] / 0x7FFFFFFF

    for lvl, every in ((3, cfg["major_every_s"]), (2, cfg["medium_every_s"]), (1, cfg["minor_every_s"])):
        t = every * (0.5 + 0.5 * rnd())
        while t < duration - 0.3:
            ev.append({"level": lvl, "time_s": round(t, 4), "frame": frame_of(t, fps)})
            t += every * (1 + cfg["jitter"] * (2 * rnd() - 1))
    ev.sort(key=lambda e: (e["time_s"], -e["level"]))
    kept, last = [], {}
    for e in ev:                                    # a higher level absorbs a lower one within 0.6 s
        if kept and e["time_s"] - kept[-1]["time_s"] < 0.6:
            continue
        if e["level"] == 3 and e["time_s"] - last.get(3, -1e9) < cfg["major_min_gap_s"]:
            continue
        kept.append(e)
        last[e["level"]] = e["time_s"]
    return {"duration_s": duration, "fps": fps, "seed": seed, "events": kept, "menu": cfg["levels"]}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("beats"); b.add_argument("--bpm", type=float, required=True); b.add_argument("--fps", type=float, default=30)
    b.add_argument("--pattern", default="every_2", choices=sorted(PATTERNS["beat"])); b.add_argument("--bars", type=int, default=8)
    b.add_argument("--offset", type=float, default=0.0); b.add_argument("--snap", action="store_true"); b.add_argument("--tx")
    s = sub.add_parser("section"); s.add_argument("--bpm", type=float, required=True); s.add_argument("--fps", type=float, default=30)
    s.add_argument("--plan", required=True, choices=sorted(PATTERNS["sections"])); s.add_argument("--offset", type=float, default=0.0); s.add_argument("--snap", action="store_true")
    sp = sub.add_parser("split"); sp.add_argument("--mode", required=True, choices=sorted(PATTERNS["split"])); sp.add_argument("--cut-frame", type=int, required=True)
    sp.add_argument("--fps", type=float, default=30); sp.add_argument("--ms", type=float); sp.add_argument("--sr", type=int, default=48000)
    t = sub.add_parser("talking"); t.add_argument("--cuts", required=True); t.add_argument("--fps", type=float, default=30)
    t.add_argument("--end-frame", type=int); t.add_argument("--claims", default="")
    m = sub.add_parser("smash"); m.add_argument("--cut-frame", type=int, required=True); m.add_argument("--fps", type=float, default=30); m.add_argument("--sr", type=int, default=48000)
    i = sub.add_parser("interrupts"); i.add_argument("--duration", type=float, required=True); i.add_argument("--fps", type=float, default=30); i.add_argument("--seed", type=int, default=1)
    a = ap.parse_args(argv)
    ints = lambda s: [int(x) for x in s.split(",") if x.strip()]
    if a.cmd == "beats":
        r = beat_cuts(a.bpm, a.fps, a.pattern, a.bars, a.offset, a.snap, a.tx)
    elif a.cmd == "section":
        r = section_cuts(a.bpm, a.fps, a.plan, a.offset, a.snap)
    elif a.cmd == "split":
        r = split(a.mode, a.cut_frame, a.fps, a.ms, a.sr)
    elif a.cmd == "talking":
        r = talking(ints(a.cuts), a.fps, a.end_frame, ints(a.claims))
    elif a.cmd == "smash":
        r = smash(a.cut_frame, a.fps, a.sr)
    else:
        r = interrupts(a.duration, a.fps, a.seed)
    json.dump(r, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
