#!/usr/bin/env python3
"""motion-pack / cuts / story6.py: the round-6 story shape (2026-10-15), stdlib only, deterministic. Registered as a cutgen.py subcommand (same frame maths as story45.py).

  problem-pivot   [--sentence S --accent W --problem "a|b|c" --brand B --value "a|b|c" --command C --url U] [--duration 30] [--fps 30]     problemPivot

problemPivot is a CONTINUOUS typographic film (zero cuts; sync it by motion events, not cuts): a sentence typed with an accent-word punchline, a three-beat problem
ladder (about 2-2.5 s a beat), a 1.5-2 s audio gap (the bed thins to a hum, then true silence) that starts inside the last problem beat, the PIVOT (colour, bass and the brand
line arrive together: the bed is back on the pivot frame, a bass hit lands on it, the ribbon / colour follows by `lead` s), a three-beat value ladder, a typed command CTA with
the address after it, and a quiet hold of at least 2 s. Craft only: the shape of a studied reference (docs/research/reference-round6-2026-10.md), no copy, no names.

It returns, in frames: the sections, every caption with its in / out / swap frames (a blur-through swap), the gap (`audio.quiet` kind gap) and the hold (kind hold) in the form
templates paste into plan.audio, the pivot frame, the bed automation (-> plan.bedAutomation), the sound cues (-> plan.cues; visual_frame + anchor_frame = visual + 1), the motion
events that carry a sound (-> plan.audio.events), and `checks`: gap 1.5-2 s with at least 1 s of true silence, the bed and a bass hit back ON the pivot frame, three problem beats
of 2-2.5 s, three value beats, the hold >= 2 s, no sound inside the silence or the hold. check_problem_pivot(result) re-derives every check from the emitted data alone
(templates and tests call it; a hand-edited plan fails it).

Typing time mirrors type/presets.js `typewriter`: 2 frames at 30 fps per non-space character, +6 frames after each . , ? !, the last character fully shown 1 frame after it
starts (typewriter_s). Numbers: cuts/patterns.json story.problemPivot (house starting values from one tier-B reference plus the proof films' quiet open / hold, tunable)."""
import json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story45  # noqa: E402  (frame_of, the cue row shape and patterns.json story block)

STORY = story45.STORY
frame_of = story45.frame_of
_cue = story45._cue


def typewriter_s(text):
    """seconds for type/presets.js typewriter to show `text` completely: per non-space char 2 frames at 30 fps plus 6 frames after . , ? !; the last char is shown 1 frame after its start"""
    chars = [c for c in str(text) if not c.isspace()]
    if not chars:
        return 0.0
    f = 0
    for k in range(len(chars) - 1):
        f += 2 + (6 if chars[k] in ".,?!" else 0)
    return (f + 1) / 30.0


MAX_TEXT = 200          # characters of one caption: a typed line longer than this is not a caption (and would run the typing time up without bound)
MAX_FILM_S = 600.0      # longest film the generator will lay out


def _num(name, v, lo, hi):
    """a numeric parameter must be a real, finite number inside [lo, hi]: NaN, inf, a string, a bool or an out-of-range value raises a ValueError that names it (no value can hang the layout or build an unbounded list)"""
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise ValueError("problem-pivot: %s must be a finite number, got %r" % (name, v))
    if not lo <= v <= hi:
        raise ValueError("problem-pivot: %s must be between %g and %g, got %g" % (name, lo, hi, v))
    return v


def _text(name, v):
    if not isinstance(v, str) or not v.strip():
        raise ValueError("problem-pivot: %s must be a non-empty string, got %r" % (name, v))
    if len(v) > MAX_TEXT:
        raise ValueError("problem-pivot: %s is %d characters, the limit is %d" % (name, len(v), MAX_TEXT))
    return v


def _caption(cid, role, text, start, end=None, **kw):
    c = {"id": cid, "role": role, "text": text, "in": int(start), "out": None if end is None else int(end)}
    c.update(kw)
    return c


def problem_pivot(fps=30, sentence=None, accent=None, problem=None, brand=None, value=None, command=None, url=None, duration_s=None,
                  rung_s=None, gap_s=None, hold_s=None, value_s=None, lead_s=None):
    p = STORY["problemPivot"]
    sentence = p["defaults"]["sentence"] if sentence is None else sentence
    accent = p["defaults"]["accent"] if accent is None else accent
    problem = list(p["defaults"]["problem"] if problem is None else problem)
    value = list(p["defaults"]["value"] if value is None else value)
    brand = p["defaults"]["brand"] if brand is None else brand
    command = p["defaults"]["command"] if command is None else command
    url = p["defaults"]["url"] if url is None else url
    rung_s = p["rung_s"] if rung_s is None else rung_s
    gap_s = p["gap_s"] if gap_s is None else gap_s
    hold_s = p["hold_s"] if hold_s is None else hold_s
    value_s = p["value_rung_s"] if value_s is None else value_s
    lead_s = p["lead_s"] if lead_s is None else lead_s
    warn = []
    fps = _num("fps", fps, 1, 240)
    for what, v in (("sentence", sentence), ("accent", accent), ("brand", brand), ("command", command), ("url", url)):
        _text(what, v)
    if not isinstance(problem, (list, tuple)) or not isinstance(value, (list, tuple)):
        raise ValueError("problem-pivot: problem and value are lists of three captions")
    for k, v in enumerate(problem):
        _text("problem[%d]" % k, v)
    for k, v in enumerate(value):
        _text("value[%d]" % k, v)
    rung_s = _num("rung_s", rung_s, 0.1, 30)
    gap_s = _num("gap_s", gap_s, 0.1, 30)
    hold_s = _num("hold_s", hold_s, 0.1, 60)
    value_s = _num("value_rung_s", value_s, 0.1, 30)
    lead_s = _num("lead_s", lead_s, 0, 5)
    if duration_s is not None:
        duration_s = _num("duration", duration_s, 1, MAX_FILM_S)
    if len(problem) != p["rungs"]:
        raise ValueError("a problem ladder has exactly %d beats, got %d" % (p["rungs"], len(problem)))
    if len(value) != p["value_rungs"]:
        raise ValueError("a value ladder has exactly %d beats, got %d" % (p["value_rungs"], len(value)))
    for what, v, rng in (("rung_s", rung_s, p["rung_range_s"]), ("gap_s", gap_s, p["gap_range_s"]), ("hold_s", hold_s, p["hold_range_s"]), ("value_rung_s", value_s, p["value_range_s"])):
        if not rng[0] <= v <= rng[1]:
            warn.append("%s %.2f s is outside the studied range %g-%g s" % (what, v, rng[0], rng[1]))
    fr = lambda s: frame_of(s, fps)
    sec = lambda f: f / float(fps)

    # ---- the opening: sentence typed, then the accent word as the punchline
    s0 = 0
    type_end = fr(typewriter_s(sentence))
    acc0 = type_end + fr(p["accent_delay_s"])
    acc_end = acc0 + fr(p["accent_s"])
    # ---- the problem ladder
    r0 = acc_end
    rung = fr(rung_s)
    rungs = [r0 + k * rung for k in range(p["rungs"])]
    ladder_end = r0 + p["rungs"] * rung
    # ---- the gap starts inside the last beat: the bed thins to a hum, then true silence; it ends ON the pivot frame (bass + bed back)
    gap0 = rungs[-1] + fr(p["gap_into_last_rung_s"])
    gap_f = fr(gap_s)
    pivot = gap0 + gap_f                                                    # bass + bed back on this frame; the gap window is [gap0, pivot)
    gap1 = pivot
    sil_min = fr(p["silence_min_s"])
    hum = min(fr(p["hum_s"]), gap_f - sil_min - 1)                          # the hum gives way so that at least silence_min_s of true silence is left (ears reads a 1 s quiet run)
    if hum < 3:
        hum = 3
        warn.append("gap %.2f s leaves under %g s of true silence after a hum: lengthen the gap" % (gap_s, p["silence_min_s"]))
    sil0 = gap0 + hum                                                       # true silence starts here
    lead_f = max(0, fr(lead_s))
    vis = pivot + lead_f                                                    # colour + brand line arrive (the sound leads the picture by lead_f frames)
    intro = max(ladder_end + 1, pivot - fr(p["intro_lead_s"]))              # the lead word blurs in on the silence
    # ---- value ladder, CTA, hold (lengths may be stretched by `duration_s`, see below)
    brand_f = fr(p["brand_s"])
    vrung = fr(value_s)
    cmd_f = fr(typewriter_s(command))
    url_delay = fr(p["url_delay_s"])
    url_f = fr(p["url_s"])
    hold = fr(hold_s)

    def total(bf, vr, hf):
        return vis + bf + 3 * vr + cmd_f + url_delay + url_f + hf

    slack = None
    if duration_s is not None:                                              # spread the slack: value beats first (to their max), then the brand beat, then the hold (to its max)
        slack = fr(duration_s) - total(brand_f, vrung, hold)
        if slack > 0:
            take = min(slack // 3, fr(p["value_range_s"][1]) - vrung)
            if take > 0:
                vrung += take
                slack -= 3 * take
            take = min(slack, fr(p["brand_max_s"]) - brand_f)
            if take > 0:
                brand_f += take
                slack -= take
            take = min(slack, fr(p["hold_range_s"][1]) - hold)
            if take > 0:
                hold += take
                slack -= take
        if total(brand_f, vrung, hold) != fr(duration_s):
            warn.append("duration %.2f s asked, %.2f s made: the beats are at their maximum (or the opening already runs longer)" % (duration_s, sec(total(brand_f, vrung, hold))))
    val0 = vis + brand_f
    vals = [val0 + k * vrung for k in range(p["value_rungs"])]
    cta0 = val0 + 3 * vrung
    cmd_end = cta0 + cmd_f
    url0 = cmd_end + url_delay
    hold0 = url0 + url_f
    end = hold0 + hold

    # ---- captions (every one swaps by a blur-through: the old line blurs out over swap_out frames starting swap_pre frames before the next one blurs in)
    swap_pre, swap_out = fr(p["swap_pre_s"]), fr(p["swap_out_s"])
    caps = [_caption("sentence", "sentence", sentence, s0, r0 - swap_pre, kind="typewriter", type_end=type_end, preset="type/typewriter"),
            _caption("accent", "accent", accent, acc0, r0 - swap_pre, kind="blurIn", preset="type/blurIn", note="the one-word punchline in the accent colour")]
    for k, txt in enumerate(problem):
        nxt = rungs[k + 1] if k + 1 < len(rungs) else None
        out = (nxt - swap_pre) if nxt is not None else ladder_end
        caps.append(_caption("problem%d" % (k + 1), "problem", txt, rungs[k], out, beat=k + 1, worse=k, note="the diagram gets worse each beat (0 = calm, 2 = broken)"))
    caps.append(_caption("lead", "lead", p["defaults"]["lead"], intro, val0 - swap_pre, kind="blurIn", note="the light lead word, on the silence; it stays over the brand line"))
    caps.append(_caption("brand", "brand", brand, vis, val0 - swap_pre, kind="blurIn", note="the brand line: the colour arrives with it"))
    for k, txt in enumerate(value):
        nxt = vals[k + 1] if k + 1 < len(vals) else None
        caps.append(_caption("value%d" % (k + 1), "value", txt, vals[k], (nxt - swap_pre) if nxt is not None else cta0, beat=k + 1))
    caps.append(_caption("command", "command", command, cta0, None, kind="typewriter", type_end=cmd_end, preset="type/typewriter", note="the typed command pill"))
    caps.append(_caption("url", "url", url, url0, None, kind="blurIn", note="the address; the path word may take the accent colour"))
    for c in caps:
        c["swap_out_frames"] = swap_out
        c["in_s"], c["out_s"] = round(sec(c["in"]), 4), (None if c["out"] is None else round(sec(c["out"]), 4))

    # ---- sound: one cue per motion event that carries a sound; none in the silence or the hold
    cues = [_cue(p["type_sfx"], s0, -6.0, cap="sentence"), _cue(p["accent_sfx"], acc0, -4.0, cap="accent")]
    for k in range(p["rungs"]):
        cues.append(_cue(p["rung_sfx"][min(k, len(p["rung_sfx"]) - 1)], rungs[k], -4.0 - (0 if k < 2 else 2.0), cap="problem%d" % (k + 1), worse=k))
    cues.append(_cue(p["pivot_sfx"], pivot, p["pivot_gain_db"], cap="brand", why="the bass returns on the pivot frame; the colour follows %d frames later" % lead_f))
    for k in range(p["value_rungs"]):
        cues.append(_cue(p["value_sfx"], vals[k], -4.0, cap="value%d" % (k + 1)))
    cues += [_cue(p["command_sfx"], cta0, -6.0, cap="command"), _cue(p["url_sfx"], url0, -6.0, cap="url")]
    cues.sort(key=lambda c: (c["anchor_frame"], c["sfx"]))

    # ---- bed automation: thinned under the problem, a hum, silence, back on the pivot frame, away for the hold
    hum_fade = max(1, fr(p["hum_fade_s"]))
    sil_fade = max(1, fr(p["silence_fade_s"]))
    hold_fade = max(1, fr(p["hold_fade_s"]))
    bed = [{"frame": 0, "gain_db": float(p["bed_problem_db"])}, {"frame": gap0, "gain_db": float(p["bed_problem_db"])}, {"frame": gap0 + hum_fade, "gain_db": float(p["hum_db"])},
           {"frame": sil0 - sil_fade, "gain_db": float(p["hum_db"])}, {"frame": sil0, "gain_db": float(p["silence_db"])},
           {"frame": pivot - 1, "gain_db": float(p["silence_db"])}, {"frame": pivot, "gain_db": 0.0},
           {"frame": hold0, "gain_db": 0.0}, {"frame": hold0 + hold_fade, "gain_db": float(p["silence_db"])}, {"frame": end, "gain_db": float(p["silence_db"])}]

    # ---- what ears is told
    quiet = [{"t": [round(sec(gap0), 4), round(sec(gap1), 4)], "kind": "gap", "why": "the bed thins to a hum, then true silence, just before the brand line (planned: problemPivot)"},
             {"t": [round(sec(hold0), 4), round(sec(end), 4)], "kind": "hold", "why": "end card on near-silence: no stinger, the address holds (planned: problemPivot)"}]
    events = sorted({c["visual_frame"] for c in cues})
    audio = {"mode": "continuous", "role": "brand_launch", "quiet": quiet, "events": [round(sec(f), 4) for f in events]}
    sections = [{"role": "sentence", "start": s0, "end": acc0, "text": sentence}, {"role": "accent", "start": acc0, "end": r0, "text": accent},
                {"role": "problem", "start": r0, "end": ladder_end, "beats": [{"start": rungs[k], "end": rungs[k] + rung, "text": problem[k], "worse": k} for k in range(len(rungs))]},
                {"role": "gap", "start": gap0, "end": gap1, "hum_end": sil0, "silence_s": round(sec(pivot - 1 - sil0), 4), "audio": "bed %g dB (a hum) then %g dB (silence)" % (p["hum_db"], p["silence_db"])},
                {"role": "pivot", "start": pivot, "visual": vis, "end": val0, "text": brand},
                {"role": "value", "start": val0, "end": cta0, "beats": [{"start": vals[k], "end": vals[k] + vrung, "text": value[k]} for k in range(len(vals))]},
                {"role": "cta", "start": cta0, "end": hold0, "command": command, "type_end": cmd_end, "url": url, "url_start": url0},
                {"role": "hold", "start": hold0, "end": end, "audio": "near-silence; the last frames hold"}]
    r = {"pattern": "problemPivot", "fps": fps, "frames": end, "seconds": round(sec(end), 4), "sections": sections, "captions": caps,
         "typed": {"sentence_s": round(typewriter_s(sentence), 4), "command_s": round(typewriter_s(command), 4)},
         "gap": {"start": gap0, "end": gap1, "seconds": round(sec(gap_f), 4), "hum_end": sil0, "silence_frames": pivot - 1 - sil0, "silence_s": round(sec(pivot - 1 - sil0), 4), "plan_quiet": quiet[0]},
         "pivot": {"frame": pivot, "visual_frame": vis, "lead_frames": lead_f, "lead_ms": round(1000.0 * lead_f / fps, 2), "ribbon_rise_s": round(sec(vis), 4), "sound": p["pivot_sfx"], "lead_word_frame": intro},
         "hold": {"start": hold0, "end": end, "seconds": round(sec(end - hold0), 4), "plan_quiet": quiet[1]},
         "audio": audio, "bed_automation": bed, "sfx": cues, "motion_events": events, "duration_slack_frames": slack, "warnings": warn}
    r["checks"] = check_problem_pivot(r)
    for c in r["checks"]:
        if not c["ok"]:
            warn.append("check failed: %s (%s)" % (c["check"], c["detail"]))
    return r


def _bed_at(bed, frame):
    """linear-in-dB bed gain at a frame, held outside the breakpoints (the mixer's rule)"""
    pts = sorted((b["frame"], b["gain_db"]) for b in bed)
    if frame <= pts[0][0]:
        return pts[0][1]
    for (f0, g0), (f1, g1) in zip(pts, pts[1:]):
        if f0 <= frame <= f1:
            return g0 if f1 == f0 else g0 + (g1 - g0) * (frame - f0) / float(f1 - f0)
    return pts[-1][1]


def check_problem_pivot(r):
    """re-derive the shape's rules from the emitted data alone -> [{check, ok, detail}]. Fails on a hand-edited plan: a gap that is too short or long, a bed that does not come back on the
    pivot frame, a bass hit that is not on it, a hold under 2 s, a sound inside the silence or the hold, ladders that are not three beats, frames that are not whole numbers."""
    p = STORY["problemPivot"]
    fps, out = r["fps"], []
    ok = lambda name, good, detail: out.append({"check": name, "ok": bool(good), "detail": detail})
    g, pv, h = r["gap"], r["pivot"], r["hold"]
    gs = (g["end"] - g["start"]) / float(fps)
    ok("gap 1.5-2 s", p["gap_range_s"][0] - 1e-9 <= gs <= p["gap_range_s"][1] + 1e-9, "%.3f s" % gs)
    ok("gap has >= 1 s of true silence (ears reads a quiet run of 1 s)", g["silence_frames"] / float(fps) >= 1.0 - 1e-9, "%.3f s" % (g["silence_frames"] / float(fps)))
    sil = _bed_at(r["bed_automation"], pv["frame"] - 1)
    ok("bed is silent the frame before the pivot", sil <= p["silence_db"] + 1e-9, "%.1f dB" % sil)
    ok("bass returns on the pivot frame: the bed is back at 0 dB ON it", abs(_bed_at(r["bed_automation"], pv["frame"])) < 1e-9, "%.1f dB" % _bed_at(r["bed_automation"], pv["frame"]))
    bass = [c for c in r["sfx"] if c["sfx"] == p["pivot_sfx"]]
    ok("one bass hit, its visual frame is the pivot frame, its anchor is +1", len(bass) == 1 and bass[0]["visual_frame"] == pv["frame"] and bass[0]["anchor_frame"] == pv["frame"] + 1, str([c["visual_frame"] for c in bass]))
    ok("colour and brand line follow the sound by lead_frames (never before it)", pv["visual_frame"] - pv["frame"] == pv["lead_frames"] >= 0, "%d frames" % (pv["visual_frame"] - pv["frame"]))
    hs = (h["end"] - h["start"]) / float(fps)
    ok("end hold >= 2 s", hs >= p["hold_range_s"][0] - 1e-9 and hs <= p["hold_range_s"][1] + 1e-9, "%.3f s" % hs)
    ok("the film ends with the hold (hold end = last frame)", h["end"] == r["frames"], "%d vs %d" % (h["end"], r["frames"]))
    pr = [s for s in r["sections"] if s["role"] == "problem"][0]["beats"]
    ok("three problem beats of 2-2.5 s", len(pr) == 3 and all(p["rung_range_s"][0] - 1e-9 <= (b["end"] - b["start"]) / float(fps) <= p["rung_range_s"][1] + 1e-9 for b in pr), str([round((b["end"] - b["start"]) / float(fps), 3) for b in pr]))
    va = [s for s in r["sections"] if s["role"] == "value"][0]["beats"]
    ok("three value beats", len(va) == 3 and all(p["value_range_s"][0] - 1e-9 <= (b["end"] - b["start"]) / float(fps) <= p["value_range_s"][1] + 1e-9 for b in va), str([round((b["end"] - b["start"]) / float(fps), 3) for b in va]))
    ok("the gap starts inside the last problem beat", pr[-1]["start"] < g["start"] < pr[-1]["end"] + 1, "gap %d, beat %d-%d" % (g["start"], pr[-1]["start"], pr[-1]["end"]))
    inside = [c["visual_frame"] for c in r["sfx"] if g["start"] <= c["anchor_frame"] < pv["frame"] or h["start"] <= c["anchor_frame"] < r["frames"]]
    ok("no sound cue inside the gap (before the pivot) or the hold", not inside, str(inside))
    q = r["audio"]["quiet"]
    ok("plan.audio.quiet = the gap (kind gap) then the hold (kind hold), in seconds, matching the frames",
       len(q) == 2 and q[0]["kind"] == "gap" and q[1]["kind"] == "hold" and abs(q[0]["t"][0] - g["start"] / float(fps)) < 1e-3 and abs(q[0]["t"][1] - g["end"] / float(fps)) < 1e-3
       and abs(q[1]["t"][0] - h["start"] / float(fps)) < 1e-3 and abs(q[1]["t"][1] - r["frames"] / float(fps)) < 1e-3, json.dumps(q))
    ok("mode continuous, role brand_launch", r["audio"]["mode"] == "continuous" and r["audio"]["role"] == "brand_launch", r["audio"]["mode"] + "/" + r["audio"]["role"])
    ev = r["motion_events"]
    ok("every sound is on a motion event: cue anchors are visual + 1, events sorted and unique", all(c["anchor_frame"] == c["visual_frame"] + 1 for c in r["sfx"]) and ev == sorted(set(ev)) and set(ev) == {c["visual_frame"] for c in r["sfx"]}, "%d events" % len(ev))
    frames = [c["in"] for c in r["captions"]] + [c["out"] for c in r["captions"] if c["out"] is not None] + [b["frame"] for b in r["bed_automation"]] + [c["visual_frame"] for c in r["sfx"]]
    ok("every frame is a whole number inside the film", all(isinstance(f, int) and 0 <= f <= r["frames"] for f in frames), "%d frames checked" % len(frames))
    cs = [c for c in r["captions"] if c["out"] is not None]
    ok("every caption goes out after it comes in", all(c["out"] > c["in"] for c in cs), "%d captions" % len(cs))
    ok("zero cuts: one continuous film (no cut list)", "cuts" not in r and r["audio"]["mode"] == "continuous", "")
    return out


def add_parsers(sub):
    q = sub.add_parser("problem-pivot")
    q.add_argument("--fps", type=float, default=30)
    q.add_argument("--sentence"); q.add_argument("--accent"); q.add_argument("--problem", help="three captions separated by |"); q.add_argument("--brand")
    q.add_argument("--value", help="three captions separated by |"); q.add_argument("--command"); q.add_argument("--url")
    q.add_argument("--duration", type=float, help="total seconds: the slack goes to the value beats, then the brand beat, then the hold")
    q.add_argument("--rung-s", type=float); q.add_argument("--gap-s", type=float); q.add_argument("--hold-s", type=float); q.add_argument("--value-s", type=float); q.add_argument("--lead-s", type=float)
    return {"problem-pivot"}


def run(a):
    fps = int(a.fps) if float(a.fps).is_integer() else a.fps
    lst = lambda s: [x.strip() for x in s.split("|") if x.strip()] if s else None
    return problem_pivot(fps, a.sentence, a.accent, lst(a.problem), a.brand, lst(a.value), a.command, a.url, a.duration, a.rung_s, a.gap_s, a.hold_s, a.value_s, a.lead_s)
