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
  interrupt-open --fps 30 [--setup 3.0] [--freeze-ms 300]                           cliche setup -> stop sound + freeze -> new format
  verbs      --verbs "Build it all.,Expand.,Automate.,Multiply." --bpm 120 --fps 30 [--start-beat 0] [--snap]   one verb per beat
  mockumentary --lines 0:75,90:160,170:260 --fps 30 [--payoff -1]                  interview lines (start:end frames) -> reaction inserts -> payoff hold
  sentence   --words "Your clients dream big" --bpm 120 --fps 30 [--start-beat 0] [--snap]   word-by-word build, hold, result on the next downbeat
  snap       --cuts 0,44,91 --fps 30 (--onsets 1.5,3.0 | --study study.json [--use onsets|beats]) [--tol 2]   snap cuts to sound onsets
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


# ---------------------------------------------------------------------------------------------------------- story shapes (2026-10-14)
def _cue(sfx, visual_frame, gain_db=0.0, **kw):
    """anchor_frame = visual frame + 1 (the pack's hit contract), like the other cue lists in this file"""
    c = {"sfx": sfx, "visual_frame": int(visual_frame), "anchor_frame": int(visual_frame) + 1, "gain_db": gain_db}
    c.update(kw)
    return c


def interrupt_open(fps, setup_s=None, freeze_ms=None, start=0):
    """cliche setup -> hard stop sound + a short freeze -> hard cut to the new format (story.interruptOpen)"""
    p = PATTERNS["story"]["interruptOpen"]
    setup_s = p["setup_s"] if setup_s is None else setup_s
    lo, hi = p["setup_range_s"]
    warn = [] if lo <= setup_s <= hi else ["setup %.1f s is outside %.1f-%.1f s: break the cliche before the viewer leaves" % (setup_s, lo, hi)]
    stop = start + frame_of(setup_s, fps)
    fr = max(1, frame_of((p["freeze_ms"] if freeze_ms is None else freeze_ms) / 1000.0, fps))
    return {"pattern": "interruptOpen", "fps": fps,
            "shots": [{"role": "setup", "start": start, "end": stop}, {"role": "freeze", "start": stop, "end": stop + fr, "hold_frame": stop - 1},
                      {"role": "new_format", "start": stop + fr}],
            "sfx": [_cue(p["stop_sfx"], stop, 0.0, alt=p["stop_alt"])],
            "bed": {"stop_frame": stop, "ramp_ms": 4, "note": p["bed"]}, "warnings": warn, "note": p["after"]}


def verb_ladder(verbs, bpm, fps, start_beat=0.0, snap=False, beats_per_verb=None, offset=0.0):
    """one verb per beat-grid step (story.verbLadder); the last verb lands with a heavier sound and holds"""
    p = PATTERNS["story"]["verbLadder"]
    used = snap_bpm(bpm, fps) if snap else float(bpm)
    step = p["beats_per_verb"] if beats_per_verb is None else beats_per_verb
    spb = 60.0 / used
    warn = []
    while step * spb * 1000.0 < p["min_hold_ms"]:
        step *= 2                                                   # too fast to read: one verb every 2 (then 4) beats
    if step != (p["beats_per_verb"] if beats_per_verb is None else beats_per_verb):
        warn.append("beat too short to read a word: %g beats per verb" % step)
    if len(verbs) > p["max_verbs"]:
        warn.append("%d verbs: more than %d reads as a list, not a ladder" % (len(verbs), p["max_verbs"]))
    fr = lambda b: frame_of(offset + b * spb, fps)
    shots, sfx = [], []
    for i, v in enumerate(verbs):
        b0 = start_beat + i * step
        last = i == len(verbs) - 1
        b1 = b0 + (p["last_hold_beats"] if last else step)
        shots.append({"i": i, "verb": v, "beat": b0, "start": fr(b0), "end": fr(b1)})
        sfx.append(_cue(p["last_sfx"] if last else p["word_sfx"], fr(b0), 3.0 if last else 0.0))
    return {"pattern": "verbLadder", "bpm_used": round(used, 6), "fps": fps, "beats_per_verb": step, "shots": shots, "sfx": sfx, "warnings": warn}


def mockumentary(lines, fps, payoff=-1, end_frame=None):
    """interview lines [(start, end) frames] -> a 0.3-0.5 s reaction insert after each line (picture only: the interview's room tone, and the
    start of the next line, run under it) -> back to the interview. The payoff line gets a beat of silence before it, a deadpan hold after it and
    the stinger on the cut out (story.mockumentaryReaction). Reaction lengths cycle deterministically through the allowed range."""
    p = PATTERNS["story"]["mockumentaryReaction"]
    lo, hi = p["reaction_range_ms"]
    fracs = (0.5, 0.15, 0.85, 0.35, 0.65)
    lag = frame_of(p["lag_ms"] / 1000.0, fps)
    hold = frame_of(p["payoff_hold_ms"] / 1000.0, fps)
    sil = frame_of(p["pre_punch_silence_ms"] / 1000.0, fps)
    payoff = payoff % len(lines)
    shots, sfx, warn, silence = [], [], [], None
    pos = lines[0][0]
    for i, (a, b) in enumerate(lines):
        if i == payoff:
            if pos > a:
                warn.append("the reaction before the payoff line runs into it: start line %d later" % i)
            silence = {"start": a - sil, "end": a, "note": "bed and stingers out; room tone only"}
            shots.append({"i": i, "role": "interview", "start": pos, "end": b + hold, "payoff": True, "deadpan_hold_from": b})
            sfx.append(_cue(p["stinger"], b + hold, 0.0, note="on the cut out of the deadpan hold, never over the line"))
            pos = b + hold
            continue
        r = frame_of((lo + (hi - lo) * fracs[i % len(fracs)]) / 1000.0, fps)
        cut = b + lag
        nxt_end = lines[i + 1][1] if i + 1 < len(lines) else None
        if nxt_end is not None and cut + r >= nxt_end:
            warn.append("no room for a reaction after line %d" % i)
            continue
        shots.append({"i": i, "role": "interview", "start": pos, "end": cut})
        shots.append({"i": i, "role": "reaction", "start": cut, "end": cut + r, "audio": "interview room tone continues (L-split); the next line may start under it"})
        pos = cut + r
    if end_frame is not None and pos > end_frame:
        warn.append("the edit runs past end_frame")
    return {"pattern": "mockumentaryReaction", "fps": fps, "shots": shots, "sfx": sfx, "silence": silence, "room_tone": p["room_tone"], "warnings": warn}


def sentence_led(words, bpm, fps, start_beat=0.0, snap=False, offset=0.0):
    """word-by-word build on the beat grid (<= max_words_per_s), full-sentence hold, result shot on the next downbeat (story.sentenceLed)"""
    p = PATTERNS["story"]["sentenceLed"]
    used = snap_bpm(bpm, fps) if snap else float(bpm)
    spb = 60.0 / used
    step = p["word_every_beats"]
    while 1.0 / (step * spb) > p["max_words_per_s"]:
        step *= 2
    warn = [] if len(words) <= p["max_words"] else ["%d words: a hook sentence carries at most %d" % (len(words), p["max_words"])]
    fr = lambda b: frame_of(offset + b * spb, fps)
    build = [{"i": i, "word": w, "beat": start_beat + i * step, "frame": fr(start_beat + i * step)} for i, w in enumerate(words)]
    full = build[-1]["beat"] if build else start_beat                 # the sentence is complete when its last word lands
    hold_end = full + p["full_hold_beats"]
    result = math.ceil(hold_end / 4.0 - 1e-9) * 4.0
    res_end = result + max(1, round(p["result_hold_s"] / spb))
    sfx = [_cue(p["word_sfx"], b["frame"], -3.0) for b in build] + [_cue(p["result_sfx"], fr(result), 0.0)]
    return {"pattern": "sentenceLed", "bpm_used": round(used, 6), "fps": fps, "word_every_beats": step, "words": build,
            "full_sentence": {"beat": full, "frame": fr(full), "hold_until_frame": fr(hold_end)},
            "result": {"beat": result, "start": fr(result), "end": fr(res_end), "note": p["result_on"]}, "sfx": sfx, "warnings": warn}


def snap_cuts_to_onsets(cut_frames, onsets_s, fps, tol_frames=None):
    """move each cut to the nearest onset frame within +-tol frames (onset_snap.tolerance_frames, default 2). A snap that would collide with or
    cross a neighbouring cut is refused. Returns per-cut rows and the shares on an onset before and after."""
    tol = PATTERNS["onset_snap"]["tolerance_frames"] if tol_frames is None else tol_frames
    of = sorted({frame_of(t, fps) for t in onsets_s})
    rows, out = [], []
    for i, c in enumerate(cut_frames):
        near = min(of, key=lambda o: (abs(o - c), o)) if of else None
        d = (near - c) if near is not None else None
        row = {"i": i, "frame": c, "nearest_onset_frame": near, "delta_frames": d, "snapped": False, "frame_out": c}
        if d is not None and abs(d) <= tol:
            prev = out[-1] if out else None
            nxt = cut_frames[i + 1] if i + 1 < len(cut_frames) else None
            if (prev is not None and near <= prev) or (nxt is not None and near >= nxt):
                row["refused"] = "would collide with a neighbouring cut"
            else:
                row["snapped"], row["frame_out"] = True, near
        out.append(row["frame_out"])
        rows.append(row)
    n = len(cut_frames)
    on_before = sum(1 for r in rows if r["delta_frames"] is not None and abs(r["delta_frames"]) <= tol)
    on_after = sum(1 for r in rows if r["snapped"])
    tgt = PATTERNS["onset_snap"]["target_share"]
    return {"fps": fps, "tolerance_frames": tol, "cuts": rows, "frames_out": out, "moved": sum(1 for r in rows if r["snapped"] and r["delta_frames"]),
            "share_snapped": round(on_after / n, 3) if n else None, "share_within_tol_before": round(on_before / n, 3) if n else None,
            "target_share": tgt, "meets_target": bool(n) and on_after / n >= tgt}


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
    io = sub.add_parser("interrupt-open"); io.add_argument("--fps", type=float, default=30); io.add_argument("--setup", type=float); io.add_argument("--freeze-ms", type=float)
    v = sub.add_parser("verbs"); v.add_argument("--verbs", required=True); v.add_argument("--bpm", type=float, required=True); v.add_argument("--fps", type=float, default=30)
    v.add_argument("--start-beat", type=float, default=0.0); v.add_argument("--snap", action="store_true")
    mk = sub.add_parser("mockumentary"); mk.add_argument("--lines", required=True); mk.add_argument("--fps", type=float, default=30); mk.add_argument("--payoff", type=int, default=-1)
    se = sub.add_parser("sentence"); se.add_argument("--words", required=True); se.add_argument("--bpm", type=float, required=True); se.add_argument("--fps", type=float, default=30)
    se.add_argument("--start-beat", type=float, default=0.0); se.add_argument("--snap", action="store_true")
    sn = sub.add_parser("snap"); sn.add_argument("--cuts", required=True); sn.add_argument("--fps", type=float, default=30); sn.add_argument("--onsets", default="")
    sn.add_argument("--study"); sn.add_argument("--use", default="onsets", choices=["onsets", "beats", "hits_top10pct"]); sn.add_argument("--tol", type=int)
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
    elif a.cmd == "interrupts":
        r = interrupts(a.duration, a.fps, a.seed)
    elif a.cmd == "interrupt-open":
        r = interrupt_open(a.fps, a.setup, a.freeze_ms)
    elif a.cmd == "verbs":
        r = verb_ladder([x.strip() for x in a.verbs.split(",") if x.strip()], a.bpm, a.fps, a.start_beat, a.snap)
    elif a.cmd == "mockumentary":
        r = mockumentary([tuple(int(y) for y in x.split(":")) for x in a.lines.split(",") if x.strip()], a.fps, a.payoff)
    elif a.cmd == "sentence":
        r = sentence_led(a.words.split(), a.bpm, a.fps, a.start_beat, a.snap)
    else:
        if a.study:
            with open(a.study) as f:
                st = json.load(f)
            ons = (st.get("audio") or {}).get(a.use) or []
        else:
            ons = [float(x) for x in a.onsets.split(",") if x.strip()]
        r = snap_cuts_to_onsets(ints(a.cuts), ons, a.fps, a.tol)
    json.dump(r, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
