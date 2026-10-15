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
  late-drop  --duration 30 --fps 30 [--turn-frame 240 | --share 0.25 --bpm 120] [--gap-ms 700] [--ticks 30,60] [--riser auto|on|off] [--riser-end F]
  pre-sting  --lockup-frame 600 --fps 30 [--hold 1.5] [--silence 2.0] [--sting-hold 1.0]     lockup -> bed out -> 1-3 s near-silence -> final sting
  handoff    --line 0:75:180 --fps 30 [--exit 1.5] [--consent] [--demo-frame 200]          presenter -> synthetic voice handoff, caption tags, label
  pipeline   --duration 45 --fps 30 [--bpm 120] [--steps prompt,plan,passes,teardown,file,world,title] [--breakdown 3]
  snap       --cuts 0,44,91 --fps 30 (--onsets 1.5,3.0 | --study study.json [--use onsets|beats]) [--tol 2]   snap cuts to sound onsets
  round-4/5 story shapes (story45.py): walkthrough, query-ladder, fidelity-ladder, voices-open, command-burst, anaphora, trailer, style-ladder
  round-6 story shape (story6.py): problem-pivot (a continuous typographic film: problem ladder, audio gap, pivot, value ladder, typed command CTA, quiet hold)
Library use: import cutgen; cutgen.beat_cuts(...)."""
import argparse, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story45  # noqa: E402  (round-4/5 story shapes, same frame maths)
import story6  # noqa: E402  (round-6 story shape: problem-pivot)

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
    kept = _relieve_fatigue(kept, duration)         # the schedule never fails its own lint
    return {"duration_s": duration, "fps": fps, "seed": seed, "events": kept, "menu": cfg["levels"], "lint": lint_interrupts(kept, duration)}


def _window_totals(events, duration, w):
    """summed levels (L1 = 1, L2 = 2, L3 = 3) in each FULL window of w seconds from 0; a trailing partial window is not judged"""
    tot = [0] * int(duration // w + 1e-9)
    for e in events:
        k = int(e["time_s"] // w)
        if k < len(tot):
            tot[k] += e["level"]
    return tot


def _fatigue_run(totals, k):
    """index of the last window of the first run of k consecutive windows that each rise over the one before, or None"""
    run = 1
    for i in range(1, len(totals)):
        run = run + 1 if totals[i] > totals[i - 1] else 1
        if run >= k:
            return i
    return None


def _relieve_fatigue(events, duration):
    """drop the lowest-level event (the latest of them) from the last window of a fatigue run until none is left: the run stops rising"""
    cfg, ev = PATTERNS["interrupts"], list(events)
    w, k = cfg["fatigue_window_s"], cfg["fatigue_rising_windows"]
    while True:
        i = _fatigue_run(_window_totals(ev, duration, w), k)
        if i is None:
            return ev
        inside = [e for e in ev if int(e["time_s"] // w) == i]
        ev.remove(min(inside, key=lambda e: (e["level"], -e["time_s"])))


def lint_interrupts(events, duration=None):
    """the interrupt ladder's lint (references/virality.md 2). `events` is [{level, time_s}] (the `events` of interrupts()). Returns {"fail": [messages], "windows": per-window totals};
    exit code 1 from `cutgen.py lint-interrupts` when `fail` is not empty. Two checks, both tunable in patterns.json `interrupts`:
      major_pair  two level-3 events closer than major_pair_min_gap_s (1.5 s)
      fatigue     fatigue_rising_windows (4) consecutive full windows of fatigue_window_s (5 s) whose summed levels each rise over the one before (the cadence only ever escalates)"""
    cfg, ev = PATTERNS["interrupts"], sorted(events, key=lambda e: e["time_s"])
    fail = []
    maj = [e["time_s"] for e in ev if e["level"] == 3]
    for a, b in zip(maj, maj[1:]):
        if b - a < cfg["major_pair_min_gap_s"] - 1e-9:
            fail.append("major_pair: two level-3 interrupts %.2f s apart (at %.2f s and %.2f s), under %.1f s" % (b - a, a, b, cfg["major_pair_min_gap_s"]))
    dur = duration if duration is not None else (ev[-1]["time_s"] if ev else 0.0)
    tot = _window_totals(ev, dur, cfg["fatigue_window_s"])
    i = _fatigue_run(tot, cfg["fatigue_rising_windows"])
    if i is not None:
        k, w = cfg["fatigue_rising_windows"], cfg["fatigue_window_s"]
        fail.append("fatigue: %d windows of %.1f s in a row rise in intensity (%s, from %.1f s to %.1f s): ease off, or break the climb with a quiet window" % (k, w, " < ".join(str(x) for x in tot[i - k + 1:i + 1]), (i - k + 1) * w, (i + 1) * w))
    return {"fail": fail, "windows": tot}


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


# ---------------------------------------------------------------------------------------------------------- story shapes, round 3 (2026-10-14)
def _bar_snap(t, bpm):
    bar = 4 * 60.0 / bpm
    return round(t / bar) * bar


def late_drop(duration_s, fps, turn_frame=None, share=None, bpm=None, gap_ms=None, ticks=(), riser=None, riser_end_frame=None):
    """story.lateDrop: the problem runs on UI ticks + texture only, an optional 0.5-1 s speech gap, then the beat drops on the turn line.
    turn_frame (the first frame of the turn line / product name) wins; otherwise the drop sits at share x duration, on a bar line when bpm is given.
    riser: None = the pattern default (a riser only when there is no gap). riser_end_frame: the anchor frame your plan gives the riser's end, checked
    against the rule (it must land ONE frame before the hit anchor, i.e. on the drop frame itself). Cues: texture loop, ticks, riser, drop hit."""
    p = PATTERNS["story"]["lateDrop"]
    n = frame_of(duration_s, fps)
    warn = []
    if turn_frame is None:
        t = (p["drop_share"] if share is None else share) * duration_s
        drop = frame_of(_bar_snap(t, bpm) if bpm else t, fps)
    else:
        drop = int(turn_frame)
    sh = drop / float(n) if n else 0.0
    lo, hi = p["drop_share_range"]
    if not lo <= sh <= hi:
        warn.append("drop at %.0f%% of the runtime: the studied late drops sit at %d-%d%%" % (sh * 100, lo * 100, hi * 100))
    if bpm and turn_frame is not None:
        bar_f = 4 * 60.0 / bpm * fps
        off = (drop % bar_f) if bar_f else 0
        if min(off, bar_f - off) > 0.5:
            warn.append("start the bed %.2f s early (or late) so a bar line lands on the drop frame" % (off / fps))
    g = frame_of((p["speech_gap_ms"] if gap_ms is None else gap_ms) / 1000.0, fps)
    if g:
        glo, ghi = p["speech_gap_range_ms"]
        if not glo <= g * 1000.0 / fps <= ghi + 1000.0 / fps:
            warn.append("speech gap %d ms: the studied gaps run %d-%d ms" % (round(g * 1000.0 / fps), glo, ghi))
    pre_end = drop - g
    if pre_end / float(fps) < p["min_pre_s"]:
        warn.append("only %.1f s before the drop: under %.1f s the drop is not late, it is the opening" % (pre_end / float(fps), p["min_pre_s"]))
    use_riser = (not g or p["riser_with_gap"]) if riser is None else bool(riser)
    if use_riser and g:
        warn.append("a riser fills the speech gap: keep one of the two (the silence is the tension)")
    sfx = [_cue(p["texture_sfx"], 0, -6.0, until_frame=pre_end, note="the problem bed: texture only, no beat")]
    kept = [int(f) for f in ticks if int(f) < pre_end]
    if len(kept) < len(list(ticks)):
        dropped = [int(f) for f in ticks if pre_end <= int(f) < drop]
        if dropped:
            warn.append("%d tick(s) fall inside the speech gap: removed" % len(dropped))
    sfx += [_cue(p["tick_sfx"], f, -3.0) for f in kept]
    sfx += [_cue(p["tick_sfx"], int(f), -3.0) for f in ticks if int(f) >= drop]
    check = None
    if use_riser:
        c = _cue(p["riser_sfx"], drop, 0.0, note="riser: the mixer applies the manifest anchor_frame_offset -1, so its end lands on the drop frame")
        c["anchor_frame"] = drop
        sfx.append(c)
    if riser_end_frame is not None:
        check = {"riser_end_frame": int(riser_end_frame), "required": drop, "ok": int(riser_end_frame) == drop,
                 "rule": "riser end anchor = drop frame = one frame before the hit anchor (drop + 1)"}
        if not check["ok"]:
            warn.append("riser ends on frame %d: it must end on frame %d (one frame before the hit)" % (riser_end_frame, drop))
    sfx.append(_cue(p["drop_sfx"], drop, 0.0, note="the drop hit; the bed's downbeat lands here too"))
    sfx.sort(key=lambda c: c["anchor_frame"])
    sections = [{"role": "problem", "start": 0, "end": pre_end, "audio": p["pre_bed"]}]
    if g:
        sections.append({"role": "speech_gap", "start": pre_end, "end": drop, "audio": "near-silence: texture and ticks out, room tone at most"})
    sections.append({"role": "drop", "start": drop, "end": n, "audio": "full bed from its drop downbeat"})
    return {"pattern": "lateDrop", "fps": fps, "frames": n, "drop_frame": drop, "drop_share": round(sh, 4), "sections": sections,
            "bed": {"enter_frame": drop, "downbeat_frame": drop, "note": "start the music (or its drop section) so a downbeat lands on drop_frame"},
            "sfx": sfx, "riser_check": check, "warnings": warn, "note": p["drop_on"]}


def pre_sting_silence(lockup_frame, fps, hold_s=None, silence_s=None, sting_hold_s=None, sr=48000):
    """story.preStingSilence: lockup holds with the bed, the bed fades out, 1-3 s of near-silence (room tone at most) while the picture holds, then one
    sting cuts to the giant cropped mark / end card. The last tail_zero_s of the film is digital zero (the master rule)."""
    p = PATTERNS["story"]["preStingSilence"]
    L = int(lockup_frame)
    sil_s = p["silence_s"] if silence_s is None else silence_s
    s0 = L + frame_of(p["lockup_hold_s"] if hold_s is None else hold_s, fps)
    sting = s0 + frame_of(sil_s, fps)
    end = sting + frame_of(p["sting_hold_s"] if sting_hold_s is None else sting_hold_s, fps)
    warn = []
    lo, hi = p["silence_range_s"]
    if sil_s < lo:
        warn.append("%.2f s of silence is a gag pause: use cuts smash (200 ms) for that, or give the end 1-3 s" % sil_s)
    elif sil_s > hi:
        warn.append("%.1f s of silence: past 3 s the viewer scrolls before the sting" % sil_s)
    fade = int(round(p["bed_fade_ms"] / 1000.0 * sr))
    a = int(round(s0 * sr / fps))
    b = int(round((sting + 1) * sr / fps))
    sfx = [_cue(p["room_tone"], s0, -12.0, until_frame=sting, note="room tone at most (<= %d dBFS); never digital zero mid-film" % p["room_tone_max_dbfs"]),
           _cue(p["sting_sfx"], sting, 0.0, alt=p["sting_alt"], note="the only sound after the silence")]
    return {"pattern": "preStingSilence", "fps": fps,
            "shots": [{"role": "lockup", "start": L, "end": sting, "hold_still_from": s0, "note": p["picture"]}, {"role": "sting", "start": sting, "end": end}],
            "bed": {"fade_out_samples": [a - fade, a], "out_frame": s0},
            "silence": {"start": s0, "end": sting, "start_sample": a, "end_sample": b, "seconds": round((sting - s0) / float(fps), 4)},
            "tail_zero": {"start_frame": end - frame_of(p["tail_zero_s"], fps), "end_frame": end, "note": "digital zero (house master rule)"},
            "sfx": sfx, "warnings": warn}


def voice_handoff(line_start, handoff, line_end, fps, exit_s=None, consent=False, demo_frame=None, sr=48000):
    """story.voiceHandoff: presenter speaks [line_start, handoff), the synthetic voice continues [handoff, line_end] while the presenter walks out;
    captions flip their speaker tag on the handoff frame and the honesty label is on screen for every synthetic frame. consent must be True."""
    p = PATTERNS["story"]["voiceHandoff"]
    a, h, e = int(line_start), int(handoff), int(line_end)
    warn = []
    if not consent:
        warn.append("no recorded consent for the cloned voice: get it in writing before any render (%s)" % "; ".join(p["requires"]))
    if not a < h < e:
        raise ValueError("need line_start < handoff < line_end")
    if (h - a) / float(fps) < p["min_presenter_s"]:
        warn.append("the presenter speaks %.1f s: under %.1f s the viewer never registers the real voice" % ((h - a) / float(fps), p["min_presenter_s"]))
    ex = h + frame_of(p["exit_s"] if exit_s is None else exit_s, fps)
    if ex > e:
        warn.append("the presenter is still leaving when the line ends: shorten exit_s or lengthen the line")
    xf = int(round(p["crossfade_ms"] / 1000.0 * sr))
    hs = int(round(h * sr / fps))
    demo = e if demo_frame is None else int(demo_frame)
    return {"pattern": "voiceHandoff", "fps": fps,
            "audio": {"presenter": {"start": a, "end": h}, "synthetic": {"start": h, "end": e}, "crossfade_samples": [hs - xf // 2, hs + xf - xf // 2],
                      "room_tone": {"sfx": p["room_tone"], "start": a, "end": e, "note": "one room tone under both voices so the handoff has no room change"}},
            "captions": [{"speaker": "presenter", "tag": p["tag_human"], "start": a, "end": h}, {"speaker": "synthetic", "tag": p["tag_synthetic"], "start": h, "end": e}],
            "label": {"text": p["label"], "start": h, "end": e, "rule": p["label_rule"]},
            "picture": {"presenter_exit": [h, ex], "demo_start": demo},
            "sfx": [_cue(p["room_tone"], a, -12.0, until_frame=e)], "warnings": warn}


def pipeline_reveal(duration_s, fps, bpm=None, steps=None, breakdown_s=None):
    """story.pipelineReveal: shots per step from their weights (on bar lines when bpm is given), one cue per step, and the music breakdown before the
    world shot with a riser that ends one frame before it (the drop back in)."""
    p = PATTERNS["story"]["pipelineReveal"]
    st = p["steps"] if steps is None else [s if isinstance(s, dict) else next(x for x in p["steps"] if x["role"] == s) for s in steps]
    n = frame_of(duration_s, fps)
    tot = sum(s["weight"] for s in st)
    edges, acc = [0.0], 0.0
    for s in st:
        acc += s["weight"] / tot * duration_s
        edges.append(acc)
    if bpm:
        edges = [0.0] + [_bar_snap(t, bpm) for t in edges[1:-1]] + [duration_s]
    fr = [frame_of(t, fps) for t in edges]
    warn = []
    shots = []
    for i, s in enumerate(st):
        a, b = fr[i], fr[i + 1]
        if b <= a:
            raise ValueError("step %r has no frames left: lengthen the film or drop a step" % s["role"])
        if (b - a) / float(fps) < p["min_shot_s"] - 1e-9:
            warn.append("%s holds %.2f s: under %.1f s a pipeline step does not read" % (s["role"], (b - a) / float(fps), p["min_shot_s"]))
        shots.append({"i": i, "role": s["role"], "start": a, "end": b, "part": s["part"], **({"alt": s["alt"]} if s.get("alt") else {})})
    sfx = [_cue(s["sfx"], sh["start"], 0.0, role=s["role"]) for s, sh in zip(st, shots)]
    world = next((sh for sh in shots if sh["role"] == p["breakdown_before"]), None)
    bed = [{"state": "full", "start": 0, "end": n}]
    if world is not None:
        bd = frame_of(p["breakdown_s"] if breakdown_s is None else breakdown_s, fps)
        b0 = max(0, world["start"] - bd)
        bed = [{"state": "full", "start": 0, "end": b0}, {"state": "breakdown: drums and bass out, pad or texture only", "start": b0, "end": world["start"]},
               {"state": "full: the drop", "start": world["start"], "end": n}]
        c = _cue(p["riser_sfx"], world["start"], 0.0, note="ends one frame before the world hit (mixer applies anchor_frame_offset -1)")
        c["anchor_frame"] = world["start"]
        sfx.append(c)
    else:
        warn.append("no %r step: the breakdown has nowhere to land" % p["breakdown_before"])
    sfx.sort(key=lambda c: c["anchor_frame"])
    return {"pattern": "pipelineReveal", "fps": fps, "frames": n, "shots": shots, "bed": bed, "sfx": sfx, "warnings": warn}


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
    li = sub.add_parser("lint-interrupts", help="lint an interrupt schedule: two level-3 within 1.5 s, or 4 rising windows (fatigue); exit 1 on a failure")
    li.add_argument("events", help="JSON: the output of `interrupts`, or a list of {level, time_s}"); li.add_argument("--duration", type=float)
    io = sub.add_parser("interrupt-open"); io.add_argument("--fps", type=float, default=30); io.add_argument("--setup", type=float); io.add_argument("--freeze-ms", type=float)
    v = sub.add_parser("verbs"); v.add_argument("--verbs", required=True); v.add_argument("--bpm", type=float, required=True); v.add_argument("--fps", type=float, default=30)
    v.add_argument("--start-beat", type=float, default=0.0); v.add_argument("--snap", action="store_true")
    mk = sub.add_parser("mockumentary"); mk.add_argument("--lines", required=True); mk.add_argument("--fps", type=float, default=30); mk.add_argument("--payoff", type=int, default=-1)
    se = sub.add_parser("sentence"); se.add_argument("--words", required=True); se.add_argument("--bpm", type=float, required=True); se.add_argument("--fps", type=float, default=30)
    se.add_argument("--start-beat", type=float, default=0.0); se.add_argument("--snap", action="store_true")
    ld = sub.add_parser("late-drop"); ld.add_argument("--duration", type=float, required=True); ld.add_argument("--fps", type=float, default=30)
    ld.add_argument("--turn-frame", type=int); ld.add_argument("--share", type=float); ld.add_argument("--bpm", type=float); ld.add_argument("--gap-ms", type=float)
    ld.add_argument("--ticks", default=""); ld.add_argument("--riser", choices=["auto", "on", "off"], default="auto"); ld.add_argument("--riser-end", type=int)
    ps = sub.add_parser("pre-sting"); ps.add_argument("--lockup-frame", type=int, required=True); ps.add_argument("--fps", type=float, default=30)
    ps.add_argument("--hold", type=float); ps.add_argument("--silence", type=float); ps.add_argument("--sting-hold", type=float)
    vh = sub.add_parser("handoff"); vh.add_argument("--line", required=True, help="start:handoff:end frames"); vh.add_argument("--fps", type=float, default=30)
    vh.add_argument("--exit", type=float); vh.add_argument("--consent", action="store_true"); vh.add_argument("--demo-frame", type=int)
    pr = sub.add_parser("pipeline"); pr.add_argument("--duration", type=float, required=True); pr.add_argument("--fps", type=float, default=30)
    pr.add_argument("--bpm", type=float); pr.add_argument("--steps", default=""); pr.add_argument("--breakdown", type=float)
    sn = sub.add_parser("snap"); sn.add_argument("--cuts", required=True); sn.add_argument("--fps", type=float, default=30); sn.add_argument("--onsets", default="")
    sn.add_argument("--study"); sn.add_argument("--use", default="onsets", choices=["onsets", "beats", "hits_top10pct"]); sn.add_argument("--tol", type=int)
    s45 = story45.add_parsers(sub)
    s6 = story6.add_parsers(sub)
    a = ap.parse_args(argv)
    ints = lambda s: [int(x) for x in s.split(",") if x.strip()]
    if a.cmd in s45:
        r = story45.run(a)
    elif a.cmd in s6:
        r = story6.run(a)
    elif a.cmd == "beats":
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
    elif a.cmd == "lint-interrupts":
        with open(a.events) as f:
            doc = json.load(f)
        r = lint_interrupts(doc["events"] if isinstance(doc, dict) else doc, a.duration if a.duration is not None else (doc.get("duration_s") if isinstance(doc, dict) else None))
    elif a.cmd == "interrupt-open":
        r = interrupt_open(a.fps, a.setup, a.freeze_ms)
    elif a.cmd == "verbs":
        r = verb_ladder([x.strip() for x in a.verbs.split(",") if x.strip()], a.bpm, a.fps, a.start_beat, a.snap)
    elif a.cmd == "mockumentary":
        r = mockumentary([tuple(int(y) for y in x.split(":")) for x in a.lines.split(",") if x.strip()], a.fps, a.payoff)
    elif a.cmd == "sentence":
        r = sentence_led(a.words.split(), a.bpm, a.fps, a.start_beat, a.snap)
    elif a.cmd == "late-drop":
        r = late_drop(a.duration, a.fps, a.turn_frame, a.share, a.bpm, a.gap_ms, ints(a.ticks), {"auto": None, "on": True, "off": False}[a.riser], a.riser_end)
    elif a.cmd == "pre-sting":
        r = pre_sting_silence(a.lockup_frame, a.fps, a.hold, a.silence, a.sting_hold)
    elif a.cmd == "handoff":
        x, y, z = (int(v) for v in a.line.split(":"))
        r = voice_handoff(x, y, z, a.fps, a.exit, a.consent, a.demo_frame)
    elif a.cmd == "pipeline":
        r = pipeline_reveal(a.duration, a.fps, a.bpm, [x.strip() for x in a.steps.split(",") if x.strip()] or None, a.breakdown)
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
    if a.cmd == "lint-interrupts" and r["fail"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
