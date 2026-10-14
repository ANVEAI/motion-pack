#!/usr/bin/env python3
"""motion-pack / cuts / story45.py: the round-4/5 story shapes (2026-10-14), stdlib only, deterministic. Registered as cutgen.py subcommands.

VO-led shapes read word timings (words.json: [{w, s, e}] or {"words": [...]}, seconds) and never put a cut, a step or an advance inside a word
(a time t is inside a word when s < t < e). Frames are round-half-up (cutgen.frame_of). Cue rows: visual_frame + anchor_frame (= visual + 1).

  walkthrough     --words words.json [--steps N] [--regions a,b,c] [--end-hold 5]          diagramWalkthrough: advances in the speech gaps
  query-ladder    --dur 45 [--rungs 5 | --rungs "video:1,podcast:2,pdf:3"] [--bpm 120 | --sidecar bed.json] [--words words.json] [--intro 0]   queryLadder
  fidelity-ladder --bpm 99 [--steps 4 | --params 3,10,36,1024] [--bars-per-step 1] [--dropout-s 3]          fidelityLadder (+ bed automation)
  voices-open     --clips clips.json                                                         voicesColdOpen: mid-sentence faces, J audio, lead super
  command-burst   --words words.json [--burst-start S]                                       commandRapidFire: response on word_end frame + 1
  anaphora        --words words.json [--token here | --phrase "the"]                         anaphoraCut: a cut on each repetition (token start - 1 frame)
  trailer         --dur 60 [--dialogue lines.json] [--bpm 120]                                trailerArc: section plan + bed automation + card slots
  style-ladder    --looks look.bw-neutral,look.pastel,look.duotone --bpm 120 [--beats-per-style 1]   styleLadder: look swaps on hits

Bed automation (`bed_automation`): [{"frame": f, "gain_db": g}] breakpoints, linear in dB between them, held outside; music/mixer.py applies it
to the bed (cue sheet "bed": {"automation": [...]}) and templates/_shared/audio.py passes plan.bedAutomation through."""
import json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "patterns.json")) as _f:
    STORY = json.load(_f)["story"]


def frame_of(t, fps):
    return int(math.floor(t * fps + 0.5))


def _cue(sfx, visual_frame, gain_db=0.0, **kw):
    c = {"sfx": sfx, "visual_frame": int(visual_frame), "anchor_frame": int(visual_frame) + 1, "gain_db": gain_db}
    c.update(kw)
    return c


# ------------------------------------------------------------------------------------------------------------------------- words
def load_words(src):
    """path | list | {"words": [...]} -> [{w, s, e}] sorted by start (extra keys kept)"""
    if isinstance(src, str):
        with open(src) as f:
            src = json.load(f)
    if isinstance(src, dict):
        src = src.get("words", [])
    out = []
    for w in src:
        s, e = float(w["s"]), float(w["e"])
        if e < s:
            raise ValueError("word %r ends before it starts" % w.get("w"))
        out.append(dict(w, w=str(w.get("w", "")), s=s, e=e))
    return sorted(out, key=lambda x: (x["s"], x["e"]))


def inside_word(t, words, eps=1e-9):
    """the word a time falls strictly inside, or None (a cut exactly on a word's start or end is not inside it)"""
    for w in words:
        if w["s"] + eps < t < w["e"] - eps:
            return w
    return None


def _ends_sentence(w):
    return bool(re.search(r"[.?!…]['\")\]]*$", w["w"].strip()))


def sentences(words, split_gap=None):
    """split on terminal punctuation, and on any gap >= split_gap (when given). -> [{i, start, end, words, text}]"""
    out, cur = [], []
    for k, w in enumerate(words):
        cur.append(w)
        nxt = words[k + 1] if k + 1 < len(words) else None
        if nxt is None or _ends_sentence(w) or (split_gap is not None and nxt["s"] - w["e"] >= split_gap):
            out.append({"i": len(out), "start": cur[0]["s"], "end": cur[-1]["e"], "words": cur, "text": " ".join(x["w"] for x in cur)})
            cur = []
    return out


def _gap_frame(a, b, fps, offset):
    """a frame strictly after time a (a word end) and not after time b (the next word start): gap start + offset frames, else the latest frame in the gap"""
    f = int(math.ceil(a * fps - 1e-9)) + offset
    if f / float(fps) > b + 1e-9:
        f = int(math.floor(b * fps + 1e-9))
    if f / float(fps) < a - 1e-9:
        return None
    return f


def _check_cuts(frames, words, fps, what):
    return ["%s at frame %d (%.3f s) falls inside the word %r" % (what, f, f / float(fps), w["w"])
            for f in frames for w in [inside_word(f / float(fps), words)] if w is not None]


# -------------------------------------------------------------------------------------------------------- diagramWalkthrough
def walkthrough(words, fps=30, steps=None, regions=None, end_hold_s=None, min_gap_s=None):
    """story.diagramWalkthrough: step 0 at the first frame; each later step (diagram advance + camera re-frame) on a speech gap >= min_gap_s,
    at gap start + 2 frames. Sentence-end gaps first; mid-sentence pauses only when --steps asks for more advances than there are sentence ends.
    With steps=N the N-1 advances go to the gaps nearest to N even divisions of the speech (deterministic)."""
    p = STORY["diagramWalkthrough"]
    W = load_words(words)
    if not W:
        raise ValueError("no words")
    mg = p["min_gap_s"] if min_gap_s is None else min_gap_s
    warn, cand = [], []
    for k in range(len(W) - 1):
        a, b = W[k]["e"], W[k + 1]["s"]
        se = _ends_sentence(W[k])
        if b - a >= mg:
            cand.append({"k": k, "a": a, "b": b, "sentence_end": se})
        elif se:
            warn.append("no room for an advance after %r (%.2f s gap): leave a %.2f s pause between sentences" % (W[k]["w"], b - a, mg))
    t0, t1 = W[0]["s"], W[-1]["e"]
    if steps is None:
        pick = [c for c in cand if c["sentence_end"]]
    else:
        need = max(0, int(steps) - 1)
        pool = sorted(cand, key=lambda c: (not c["sentence_end"], c["k"]))
        pick, used = [], set()
        for j in range(1, need + 1):
            target = t0 + j * (t1 - t0) / float(need + 1)
            best = min((c for c in pool if c["k"] not in used), key=lambda c: (abs(c["a"] - target) + (0 if c["sentence_end"] else 2.0), c["k"]), default=None)
            if best is None:
                warn.append("only %d speech gaps >= %.2f s: %d steps planned, not %d" % (len(cand), mg, len(pick) + 1, steps))
                break
            used.add(best["k"])
            pick.append(best)
        pick.sort(key=lambda c: c["k"])
        if any(not c["sentence_end"] for c in pick):
            warn.append("some advances sit in mid-sentence pauses: re-record with one sentence per step if you can")
    S = sentences(W)
    for s in S:
        if s["end"] - s["start"] > p["max_sentence_s"]:
            warn.append("sentence %d runs %.1f s (> %.0f s): split it so the diagram keeps moving (%r...)" % (s["i"], s["end"] - s["start"], p["max_sentence_s"], s["text"][:40]))
    rows = [{"i": 0, "frame": 0, "time_s": 0.0, "gap": None, "sentence_end": True}]
    for c in pick:
        f = _gap_frame(c["a"], c["b"], fps, p["step_offset_frames"])
        if f is None:
            warn.append("gap after %r has no whole frame: skipped" % W[c["k"]]["w"])
            continue
        rows.append({"i": len(rows), "frame": f, "time_s": round(f / float(fps), 4), "gap": [round(c["a"], 4), round(c["b"], 4)], "sentence_end": c["sentence_end"]})
    regions = list(regions or [])
    end_start = int(math.ceil(t1 * fps - 1e-9)) + frame_of(p["end_gap_s"], fps)
    hold = p["end_hold_s"] if end_hold_s is None else end_hold_s
    lo, hi = p["end_hold_range_s"]
    if not lo <= hold <= hi:
        warn.append("end card holds %.1f s: the studied explainers hold %.0f-%.0f s on near-silence" % (hold, lo, hi))
    n = end_start + frame_of(hold, fps)
    camera, caps = [], []
    for i, r in enumerate(rows):
        nxt = rows[i + 1]["frame"] if i + 1 < len(rows) else end_start
        r["region"] = regions[i] if i < len(regions) else "region %d" % i
        r["until"] = nxt
        seg = [w for w in W if r["frame"] <= w["s"] * fps < nxt]
        r["caption"] = " ".join(w["w"] for w in seg)
        caps.append({"i": i, "text": r["caption"], "start": r["frame"], "end": nxt})
        if r["gap"]:
            camera.append({"step": i, "start": r["frame"], "end": max(r["frame"] + 1, int(math.floor(r["gap"][1] * fps + 1e-9))), "to_region": r["region"],
                           "note": "re-frame inside the gap, settled before the next word"})
    if regions and len(regions) != len(rows):
        warn.append("%d regions for %d steps" % (len(regions), len(rows)))
    iv = [(b["frame"] - a["frame"]) / float(fps) for a, b in zip(rows, rows[1:])]
    mean = round(sum(iv) / len(iv), 3) if iv else None
    elo, ehi = p["step_every_s"]
    if mean is not None and not elo <= mean <= ehi:
        warn.append("a step every %.1f s on average: the studied walkthrough advances about every 4 s (%g-%g s)" % (mean, elo, ehi))
    warn += _check_cuts([r["frame"] for r in rows[1:]], W, fps, "step")
    fade = frame_of(p["end_fade_ms"] / 1000.0, fps)
    bed = [{"frame": 0, "gain_db": 0.0}, {"frame": end_start, "gain_db": 0.0}, {"frame": end_start + fade, "gain_db": float(p["end_bed_db"])}]
    sfx = [_cue(p["step_sfx"], r["frame"], p["step_gain_db"], step=r["i"]) for r in rows[1:]]
    return {"pattern": "diagramWalkthrough", "fps": fps, "frames": n, "steps": rows, "captions": caps, "camera": camera,
            "end_card": {"start": end_start, "end": n, "hold_s": hold, "audio": "near-silence: bed %d dB, no VO" % p["end_bed_db"]},
            "bed_automation": bed, "sfx": sfx, "mean_step_s": mean, "warnings": warn, "note": p["picture"]}


# ------------------------------------------------------------------------------------------------------------- queryLadder
def _rungs_arg(rungs):
    if rungs is None:
        rungs = STORY["queryLadder"]["rungs"]
    if isinstance(rungs, int):
        return [{"label": "rung %d" % (i + 1), "difficulty": i + 1} for i in range(rungs)]
    out = []
    for i, r in enumerate(rungs):
        if isinstance(r, dict):
            out.append({"label": r.get("label", "rung %d" % (i + 1)), "difficulty": float(r.get("difficulty", i + 1))})
        else:
            lab, _, d = str(r).partition(":")
            out.append({"label": lab, "difficulty": float(d) if d else float(i + 1)})
    return out


def _downbeats(bpm, fps, n, offset=0.0):
    bar = 4 * 60.0 / bpm
    return [frame_of(offset + k * bar, fps) for k in range(int(n / fps / bar) + 2)]


def load_downbeats(src, fps=None):
    """a music bed sidecar (music/library/beds/<id>.json: bar_frames, real bar starts even through a tempo ramp), a list of frames, or a path to a JSON list"""
    if isinstance(src, str):
        with open(src) as f:
            src = json.load(f)
    if isinstance(src, dict):
        sf = (src.get("meta") or {}).get("fps")
        if fps is not None and sf is not None and abs(float(sf) - float(fps)) > 1e-9:
            raise ValueError("the sidecar is %s fps, the plan is %s fps" % (sf, fps))
        src = src.get("bar_frames", [])
    return sorted({int(round(x)) for x in src})


def query_ladder(duration_s, fps=30, rungs=None, bpm=None, words=None, intro_s=None, pullback_s=None, end_s=None, offset=0.0, downbeats=None):
    """story.queryLadder: [intro] -> N rungs (type <= 1.2 s, resolve 0.4 s, hit) -> pullback with chips -> URL. Sections are contiguous and sum to
    the duration. Rungs are sorted by difficulty (hardest last). With bpm, every rung starts on a downbeat (bar line). With words (one VO sentence per
    rung, in order), each rung starts in the speech gap before its line (a downbeat inside the gap when there is one) and never inside a word.
    downbeats: a list of real bar-start frames (a bed sidecar's bar_frames, or load_downbeats) instead of a constant bpm, so a tempo ramp still lands on bar lines."""
    p = STORY["queryLadder"]
    R = _rungs_arg(rungs)
    warn = []
    lo_n, hi_n = p["rungs_range"]
    if not lo_n <= len(R) <= hi_n:
        warn.append("%d rungs: the studied ladder climbs %d-%d" % (len(R), lo_n, hi_n))
    W = load_words(words) if words is not None else None
    order = [r["difficulty"] for r in R]
    if order != sorted(order):
        if W is not None:
            warn.append("rung difficulty is not ascending, but the VO fixes the order: re-record so the hardest query comes last")
        else:
            R = sorted(R, key=lambda r: r["difficulty"])                 # stable: equal difficulty keeps the given order
            warn.append("rungs re-ordered by difficulty: the hardest query comes last")
    n = frame_of(duration_s, fps)
    intro = frame_of(p["intro_s"] if intro_s is None else intro_s, fps)
    pb_s = p["pullback_s"] if pullback_s is None else pullback_s
    en_s = p["end_s"] if end_s is None else end_s
    DB = sorted(int(x) for x in downbeats) if downbeats else (_downbeats(bpm, fps, n, offset) if bpm else None)
    starts = []
    if W is None:
        body_end = duration_s - pb_s - en_s
        L = (body_end - intro / float(fps)) / len(R)
        for k in range(len(R) + 1):
            t = intro / float(fps) + k * L
            if downbeats and k > 0:
                starts.append(min(DB, key=lambda d: (abs(d - t * fps), d)))              # the nearest real bar line
                continue
            if bpm and k > 0:
                bar = 4 * 60.0 / bpm
                t = offset + round((t - offset) / bar) * bar
            starts.append(intro if k == 0 else frame_of(t, fps))
        if downbeats and any(b <= a for a, b in zip(starts, starts[1:])):
            raise ValueError("two rungs land on the same bar line: fewer rungs or a longer film")
    else:
        S = sentences(W)
        if len(S) < len(R):
            raise ValueError("%d VO sentences for %d rungs: one line per rung" % (len(S), len(R)))
        if len(S) > len(R):
            warn.append("%d VO sentences for %d rungs: the extra lines ride on the last rung" % (len(S), len(R)))
        for k in range(len(R) + 1):
            if k == 0:
                a, b = 0.0, S[0]["start"]
                lo_f = 0
            elif k < len(R):
                a, b = S[k - 1]["end"], S[k]["start"]
                lo_f = int(math.ceil(a * fps - 1e-9))
            else:
                a, b = S[-1]["end"], duration_s
                lo_f = int(math.ceil(a * fps - 1e-9))
            hi_f = int(math.floor(b * fps + 1e-9))
            pick = None
            if DB:
                inside = [d for d in DB if lo_f <= d <= hi_f and (k == 0 or d > (starts[-1] if starts else -1))]
                pick = inside[0] if inside else None
                if pick is None and k > 0:
                    warn.append("no downbeat in the gap before %s: move the bed or the VO so a bar line falls in the pause" % ("rung %d" % (k + 1) if k < len(R) else "the pullback"))
            if pick is None:
                pick = intro if k == 0 else _gap_frame(a, b, fps, 2)
            if pick is None:
                raise ValueError("no whole frame in the gap before rung %d" % (k + 1))
            starts.append(intro if k == 0 else pick)
        if S[0]["start"] * fps < intro:
            warn.append("the first VO line starts inside the intro: start the ladder before the line or move the line")
    pb = starts[-1]
    en = n - frame_of(en_s, fps)
    if pb >= en:
        raise ValueError("no room for the pullback: lengthen the film or shorten the rungs")
    sections = []
    if starts[0] > 0:
        sections.append({"role": "intro", "start": 0, "end": starts[0], "note": "the concept as a space, then the name"})
    rows, sfx = [], []
    for k, r in enumerate(R):
        a, b = starts[k], starts[k + 1]
        L = (b - a) / float(fps)
        rlo, rhi = p["rung_s"]
        if not rlo - 1e-9 <= L <= rhi + 1e-9:
            warn.append("rung %d (%s) holds %.2f s: the studied rungs run %g-%g s" % (k + 1, r["label"], L, rlo, rhi))
        ty = min(frame_of(p["type_max_s"], fps), max(1, (b - a) // 4))
        rs = frame_of(p["resolve_s"], fps)
        hit = (a + ty + rs, b)
        hs = (hit[1] - hit[0]) / float(fps)
        hlo, hhi = p["hit_s"]
        if hs < hlo:
            warn.append("rung %d leaves %.1f s for the hit: under %g s it does not land" % (k + 1, hs, hlo))
        row = {"i": k, "role": "rung", "label": r["label"], "difficulty": r["difficulty"], "start": a, "end": b,
               "type": [a, a + ty], "resolve": [a + ty, a + ty + rs], "hit": [hit[0], min(b, hit[0] + frame_of(hhi, fps))], "vo_slot": [a + ty, b - frame_of(0.25, fps)]}
        if W is not None:
            S = sentences(W)
            row["vo_line"] = S[k]["text"]
        if DB:
            d = min(DB, key=lambda x: abs(x - a))
            row["downbeat_delta_frames"] = a - d
            if abs(a - d) > p["downbeat_tol_frames"]:
                warn.append("rung %d starts %d frames off the nearest downbeat" % (k + 1, a - d))
        rows.append(row)
        sections.append(row)
        sfx += [_cue(p["type_sfx"], a, -6.0, rung=k), _cue(p["resolve_sfx"], a + ty, -4.0, rung=k), _cue(p["hit_sfx"], hit[0], -2.0, rung=k)]
    sections.append({"role": "pullback", "start": pb, "end": en, "part": p["parts"]["pullback"], "chips": p["chips_example"], "chips_part": p["parts"]["chips"],
                     "note": "pull back to where it runs; 2-3 benefit chips stack in"})
    sections.append({"role": "end", "start": en, "end": n, "part": p["parts"]["url"], "note": "the repo or URL; no spoken CTA"})
    sfx += [_cue(p["pullback_sfx"], pb, -2.0), _cue(p["end_sfx"], en, 0.0)]
    if W is not None:
        warn += _check_cuts([s["start"] for s in sections if s["start"] > 0], W, fps, "cut")
    return {"pattern": "queryLadder", "fps": fps, "frames": n, "bpm": bpm, "downbeats": "list" if downbeats else ("bpm" if bpm else None), "sections": sections, "rungs": rows, "sfx": sfx, "warnings": warn}


# ---------------------------------------------------------------------------------------------------------- fidelityLadder
def fidelity_ladder(bpm, fps=30, steps=None, params=None, bars_per_step=None, dropout_s=None, reveal_bars=None, title_s=None, start_bar=0, offset=0.0):
    """story.fidelityLadder: step k starts on bar start_bar + k * bars_per_step (a hit + a readout update); after the last step a dropout of at
    least dropout_s (bed automation dropout_db, >= 20 dB under the body), the new-dimension reveal on the next downbeat, then the title."""
    p = STORY["fidelityLadder"]
    vals = list(params) if params else None
    nst = len(vals) if vals else (p["steps"] if steps is None else int(steps))
    bps = p["bars_per_step"] if bars_per_step is None else bars_per_step
    ds = p["dropout_s"] if dropout_s is None else dropout_s
    warn = []
    lo, hi = p["steps_range"]
    if not lo <= nst <= hi:
        warn.append("%d steps: the ladder reads with %d-%d" % (nst, lo, hi))
    dlo, dhi = p["dropout_range_s"]
    if not dlo <= ds <= dhi:
        warn.append("dropout %.1f s: the studied dropouts run %g-%g s" % (ds, dlo, dhi))
    bar = 4 * 60.0 / bpm
    bt = lambda b: offset + b * bar
    fr = lambda b: frame_of(bt(b), fps)
    rows, sfx = [], []
    for k in range(nst):
        b0 = start_bar + k * bps
        rows.append({"i": k, "bar": b0, "start": fr(b0), "end": fr(b0 + bps), "readout": {"param": vals[k] if vals else None, "error": None},
                     "err_ms": round((fr(b0) / float(fps) - bt(b0)) * 1000.0, 3)})
        sfx.append(_cue(p["step_sfx"], fr(b0), -2.0, step=k))
    if vals and list(vals) != sorted(vals):
        warn.append("parameter values do not climb: a fidelity ladder only goes up")
    d0b = start_bar + nst * bps
    rb = math.ceil((bt(d0b) + ds - offset) / bar - 1e-9)                   # reveal on the first bar line at or after the dropout's end
    d0, rv = fr(d0b), fr(rb)
    rvb = p["reveal_bars"] if reveal_bars is None else reveal_bars
    te = fr(rb + rvb)
    n = te + frame_of(p["title_s"] if title_s is None else title_s, fps)
    fade = max(1, frame_of(p["dropout_fade_ms"] / 1000.0, fps))
    bed = [{"frame": 0, "gain_db": 0.0}, {"frame": d0 - fade, "gain_db": 0.0}, {"frame": d0, "gain_db": float(p["dropout_db"])},
           {"frame": rv - 0.12, "gain_db": float(p["dropout_db"])}, {"frame": rv, "gain_db": 0.0}]
    sfx += [_cue(p["reveal_sfx"], rv, 0.0), _cue(p["title_sfx"], te, 0.0)]
    sections = [{"role": "ladder", "start": rows[0]["start"] if rows else 0, "end": d0},
                {"role": "dropout", "start": d0, "end": rv, "seconds": round((rv - d0) / float(fps), 4), "audio": "bed %d dB (>= 20 dB under the body); the picture holds the resolved result" % p["dropout_db"]},
                {"role": "new_dimension", "start": rv, "end": te, "note": "the same result in a new dimension or format (2D -> 3D, still -> motion), on the downbeat"},
                {"role": "title", "start": te, "end": n}]
    if vals is None:
        warn.append("readout values are empty: fill each step's param and its MEASURED error, never invented")
    return {"pattern": "fidelityLadder", "fps": fps, "bpm": bpm, "bar_frames": round(bar * fps, 6), "frames": n, "steps": rows, "sections": sections,
            "bed_automation": bed, "sfx": sorted(sfx, key=lambda c: c["anchor_frame"]), "max_abs_err_ms": max([abs(r["err_ms"]) for r in rows] or [0]), "warnings": warn}


# ---------------------------------------------------------------------------------------------------------- voicesColdOpen
def _load_clips(src):
    if isinstance(src, str):
        base = os.path.dirname(os.path.abspath(src))
        with open(src) as f:
            src = json.load(f)
    else:
        base = "."
    clips = src.get("clips", src) if isinstance(src, dict) else src
    out = []
    for c in clips:
        w = c.get("words")
        if isinstance(w, str):
            w = load_words(w if os.path.isabs(w) else os.path.join(base, w))
        out.append(dict(c, words=load_words(w or [])))
    return out


def _window(W, lo, hi, target, mid=True):
    """the sentence-internal window [word j .. word k] whose length is closest to target within [lo, hi]; earliest wins ties"""
    best = None
    for s in sentences(W):
        ws = s["words"]
        js = range(1, len(ws)) if mid else range(len(ws))
        for j in js:
            for k in range(j, len(ws) - (1 if mid else 0)):
                d = ws[k]["e"] - ws[j]["s"]
                if d > hi:
                    break
                if d >= lo:
                    key = (abs(d - target), ws[j]["s"])
                    if best is None or key < best[0]:
                        best = (key, ws[j], ws[k])
    return None if best is None else (best[1], best[2])


def _audio_edges(W, a, b, pad_in, pad_out):
    """source in/out around words a..b, padded but never into a neighbouring word"""
    i, k = W.index(a), W.index(b)
    prev_e = W[i - 1]["e"] if i > 0 else -1e9
    next_s = W[k + 1]["s"] if k + 1 < len(W) else 1e9
    return max(a["s"] - pad_in, (prev_e + a["s"]) / 2.0, 0.0), min(b["e"] + pad_out, (b["e"] + next_s) / 2.0)


def voices_open(clips, fps=30, max_open_s=None, j_lead_ms=None):
    """story.voicesColdOpen: the montage clips (not lead) each give one mid-sentence window of 0.5-1.3 s; the audio runs end to end and every
    picture cut lags its audio by the J lead; then the lead's first full sentence with a name super about 0.5 s in. The montage stops before the
    opener passes max_open_s. Audio edit points sit between words in each source; returns timeline frames + source seconds."""
    p = STORY["voicesColdOpen"]
    C = _load_clips(clips)
    lead = next((c for c in C if c.get("lead")), None)
    if lead is None:
        raise ValueError("mark one clip as the lead ({\"lead\": true})")
    lo, hi = p["cut_s"]
    mo = p["max_open_s"] if max_open_s is None else max_open_s
    jl = frame_of((p["j_lead_ms"] if j_lead_ms is None else j_lead_ms) / 1000.0, fps)
    pin, pout = p["audio_pad_ms"][0] / 1000.0, p["audio_pad_ms"][1] / 1000.0
    warn, audio, shots, pos = [], [], [], 0
    for c in [x for x in C if not x.get("lead")]:
        win = _window(c["words"], lo, hi, p["target_cut_s"])
        if win is None:
            win = _window(c["words"], lo, hi, p["target_cut_s"], mid=False)
            if win is None:
                warn.append("%s: no %.1f-%.1f s run of words: skipped" % (c.get("id"), lo, hi))
                continue
            warn.append("%s: no mid-sentence window, so it starts or ends on a sentence edge" % c.get("id"))
        a, b = _audio_edges(c["words"], win[0], win[1], pin, pout)
        nf = max(1, frame_of(b - a, fps))
        if inside_word(a + nf / float(fps), c["words"]):
            nf -= 1
        if (pos + nf) / float(fps) > mo:
            warn.append("%s left out: the opener would pass %.1f s" % (c.get("id"), mo))
            continue
        audio.append({"clip": c.get("id"), "src": c.get("src"), "start": pos, "end": pos + nf, "src_in": round(a, 4), "src_out": round(a + nf / float(fps), 4),
                      "text": " ".join(w["w"] for w in c["words"][c["words"].index(win[0]):c["words"].index(win[1]) + 1])})
        pos += nf
    if not audio:
        raise ValueError("no montage clip fits: need 4-6 non-lead clips with words")
    S = [s for s in sentences(lead["words"]) if s["end"] - s["start"] >= p["lead_min_line_s"]]
    if not S:
        raise ValueError("the lead has no full sentence of %.1f s" % p["lead_min_line_s"])
    s0 = S[0]
    a, b = _audio_edges(lead["words"], s0["words"][0], s0["words"][-1], pin, pout)
    nf = frame_of(b - a, fps)
    if inside_word(a + nf / float(fps), lead["words"]):
        nf -= 1
    audio.append({"clip": lead.get("id"), "src": lead.get("src"), "start": pos, "end": pos + nf, "src_in": round(a, 4), "src_out": round(a + nf / float(fps), 4), "text": s0["text"], "lead": True})
    for i, au in enumerate(audio):
        pic = 0 if i == 0 else au["start"] + jl
        end = audio[i + 1]["start"] + jl if i + 1 < len(audio) else au["end"]
        shots.append({"i": i, "clip": au["clip"], "src": au["src"], "start": pic, "end": end, "media_start": round(au["src_in"] + (pic - au["start"]) / float(fps), 4),
                      "role": "lead" if au.get("lead") else "face", "j_lead_frames": 0 if i == 0 else jl})
    open_s = audio[-1]["start"] / float(fps)
    faces = len(audio) - 1
    flo, fhi = p["faces"]
    if not flo <= faces <= fhi:
        warn.append("%d faces before the lead: the studied opener uses %d-%d" % (faces, flo, fhi))
    sup_at = shots[-1]["start"] + frame_of(p["lead_super_delay_s"], fps)
    slo, shi = p["lead_super_at_s"]
    if not slo <= sup_at / float(fps) <= shi:
        warn.append("the lead's name super lands at %.1f s: aim for %g-%g s" % (sup_at / float(fps), slo, shi))
    supers = [{"clip": lead.get("id"), "name": lead.get("name", ""), "role": lead.get("role", ""), "tag": lead.get("tag", ""), "at": sup_at, "dur": frame_of(2.6, fps),
               "part": p["super_part"], "alt": p["super_alt"]}]
    edits = [{"clip": au["clip"], "src_in": au["src_in"], "src_out": au["src_out"]} for au in audio]
    for e, c in zip(edits, [next(x for x in C if x.get("id") == au["clip"]) for au in audio]):
        for t, nm in ((e["src_in"], "in"), (e["src_out"], "out")):
            w = inside_word(t, c["words"])
            if w:
                warn.append("%s %s point %.3f s falls inside %r" % (e["clip"], nm, t, w["w"]))
    return {"pattern": "voicesColdOpen", "fps": fps, "frames": audio[-1]["end"], "open_s": round(open_s, 4), "faces": faces, "shots": shots, "audio": audio,
            "audio_crossfade_ms": p["crossfade_ms"], "supers": supers, "room_tone": _cue(p["room_tone"], 0, -12.0, until_frame=audio[-1]["end"]), "warnings": warn, "rule": p["rule"]}


# -------------------------------------------------------------------------------------------------------- commandRapidFire
def command_burst(words, fps=30, burst_start=None, split_gap_s=None):
    """story.commandRapidFire: commands = sentences (punctuation, or a pause >= split_gap_s). Each response cut lands on floor(word_end * fps) + 1,
    the frame after the command's last word ends; a response that would land inside the next command's first word is merged into it."""
    p = STORY["commandRapidFire"]
    W = load_words(words)
    bs = W[0]["s"] if burst_start is None else burst_start
    setup = [w for w in W if w["s"] < bs]
    cmds = sentences([w for w in W if w["s"] >= bs], p["split_gap_s"] if split_gap_s is None else split_gap_s)
    warn, rows, sfx = [], [], []
    for k, c in enumerate(cmds):
        e = c["end"]
        f = int(math.floor(e * fps + 1e-9)) + 1
        d = e - c["start"]
        if d > p["max_command_s"]:
            warn.append("command %d runs %.2f s (> %.1f s): shorten it, a burst needs quick lines (%r)" % (k, d, p["max_command_s"], c["text"]))
        nxt = cmds[k + 1] if k + 1 < len(cmds) else None
        if nxt is not None and f / float(fps) > nxt["start"] + 1e-9:
            warn.append("no frame between command %d and %d: their responses merge" % (k, k + 1))
            continue
        rows.append({"i": len(rows), "command": c["text"], "word_end_s": round(e, 4), "response_frame": f, "part": p["response_part"]})
        sfx.append(_cue(p["response_sfx"], f, p["response_gain_db"], command=k))
    for i, r in enumerate(rows):
        r["state_until"] = rows[i + 1]["response_frame"] if i + 1 < len(rows) else r["response_frame"] + frame_of(p["reaction_delay_s"], fps)
    span = (cmds[-1]["end"] - cmds[0]["start"]) if cmds else 0.0
    rate = len(cmds) / span if span > 0 else 0.0
    if rate < p["min_rate_per_s"]:
        warn.append("%.2f commands per second: the studied burst runs about 1 per second (%s)" % (rate, p["target"]))
    slo, shi = p["silent_beat_s"]
    beats = [{"start": frame_of(a["e"], fps), "end": frame_of(b["s"], fps), "seconds": round(b["s"] - a["e"], 3)}
             for a, b in zip(setup, setup[1:] + ([cmds[0]["words"][0]] if setup and cmds else [])) if slo <= b["s"] - a["e"] <= shi]
    last = rows[-1]["response_frame"] if rows else 0
    react = {"start": last + frame_of(p["reaction_delay_s"], fps), "end": last + frame_of(p["reaction_delay_s"] + p["reaction_s"], fps), "note": "close on a reaction beat"}
    sfx.append(_cue(p["reaction_sfx"], react["start"], -6.0, note="optional: only a real reaction, never a canned laugh over a demo"))
    warn += _check_cuts([r["response_frame"] for r in rows], W, fps, "response cut")
    return {"pattern": "commandRapidFire", "fps": fps, "commands": len(cmds), "burst_s": round(span, 3), "rate_per_s": round(rate, 3), "responses": rows,
            "silent_beats": beats, "reaction": react, "transitions": "transitions/cut", "sfx": sfx, "warnings": warn, "rule": p["rule"]}


# ------------------------------------------------------------------------------------------------------------- anaphoraCut
_norm = lambda s: re.sub(r"[^\w']+", "", s.lower())


def anaphora(words, fps=30, token=None, phrase=None, end_frame=None):
    """story.anaphoraCut: a cut at (start of each repetition) - 1 frame, moved later to the previous word's end when that frame is still inside it.
    token: one word; phrase: several words matched in order; neither: the most repeated non-stop word (earliest wins ties)."""
    p = STORY["anaphoraCut"]
    W = load_words(words)
    toks = [_norm(w["w"]) for w in W]
    seq = [_norm(x) for x in (phrase.split() if phrase else [token] if token else [])]
    warn = []
    if not seq:
        cnt = {}
        for t in toks:
            if t and t not in p["stop"]:
                cnt[t] = cnt.get(t, 0) + 1
        if not cnt or max(cnt.values()) < 2:
            raise ValueError("no repeated word: pass --token or --phrase")
        top = max(cnt.values())
        seq = [next(t for t in toks if cnt.get(t) == top)]
        warn.append("no token given: cutting on %r (%d repeats)" % (seq[0], top))
    hits = [k for k in range(len(toks) - len(seq) + 1) if toks[k:k + len(seq)] == seq]
    if len(hits) < 2:
        raise ValueError("%r occurs %d time(s): nothing to cut on" % (" ".join(seq), len(hits)))
    if len(hits) < p["min_repeats"]:
        warn.append("%d repeats: a list reads as a montage from %d" % (len(hits), p["min_repeats"]))
    cuts = []
    for k in hits:
        s = W[k]["s"]
        f = frame_of(s, fps) - p["pre_frames"]
        if k > 0 and f / float(fps) < W[k - 1]["e"] - 1e-9:
            f2 = int(math.ceil(W[k - 1]["e"] * fps - 1e-9))
            if f2 / float(fps) > s + 1e-9:
                f2 = int(math.floor(s * fps + 1e-9))
                warn.append("repeat at %.2f s follows the previous word with no whole frame between: cut on its first frame" % s)
            f = f2
        f = max(0, f)
        if f / float(fps) > s + 1e-9:
            f = int(math.floor(s * fps + 1e-9))
        cuts.append({"i": len(cuts), "frame": f, "token_start_s": round(s, 4), "word_index": k,
                     "slot": W[k + len(seq)]["w"] if k + len(seq) < len(W) else "", "part": p["slot_part"]})
    last = hits[-1]
    tail = next((S for S in sentences(W) if S["start"] <= W[last]["s"] <= S["end"]), None)
    end = end_frame if end_frame is not None else frame_of((tail["end"] if tail else W[last]["e"]) + p["tail_s"], fps)
    shots = [{"i": c["i"], "start": c["frame"], "end": cuts[i + 1]["frame"] if i + 1 < len(cuts) else end, "slot": c["slot"]} for i, c in enumerate(cuts)]
    sfx = [_cue(p["shot_sfx"], c["frame"], p["shot_gain_db"], repeat=c["i"]) for c in cuts]
    warn += _check_cuts([c["frame"] for c in cuts], W, fps, "cut")
    return {"pattern": "anaphoraCut", "fps": fps, "token": " ".join(seq), "repeats": len(cuts), "cuts": cuts, "shots": shots, "sfx": sfx, "warnings": warn}


# -------------------------------------------------------------------------------------------------------------- trailerArc
def trailer(duration_s, fps=30, dialogue=None, bpm=None):
    """story.trailerArc: sections in the house proportions (the question clamped to 2-4 s, the difference taken from the build), dialogue lines
    with dips to black, title-card slots, a wall cut list (about 1 cut per second; every 2 beats when bpm is given), bed automation for the mixer."""
    p = STORY["trailerArc"]
    sh = p["shares"]
    qlo, qhi = p["question_s"]
    q = min(qhi, max(qlo, sh["question"] * duration_s))
    rest = {k: v for k, v in sh.items() if k != "question"}
    scale = (duration_s - q) / (duration_s * sum(rest.values()))
    secs = {k: v * duration_s * scale for k, v in rest.items()}
    secs["question"] = q
    warn = []
    if abs(q - sh["question"] * duration_s) > 1e-9:
        warn.append("the question line is clamped to %.1f s (%g-%g s): the other sections scale to fit" % (q, qlo, qhi))
    order = ["dialogue", "build", "wall", "question", "crescendo", "end"]
    edges, acc = [0], 0.0
    for k in order:
        acc += secs[k]
        edges.append(frame_of(acc, fps))
    n = edges[-1]
    S = {k: {"role": k, "start": edges[i], "end": edges[i + 1]} for i, k in enumerate(order)}
    lines = dialogue
    if isinstance(lines, str):
        with open(lines) as f:
            lines = json.load(f)
    if isinstance(lines, dict):
        lines = lines.get("lines", [])
    lines = lines or []
    dip = p["dip_frames"]
    rows, pos = [], S["dialogue"]["start"]
    for i, ln in enumerate(lines):
        d = frame_of(float(ln.get("dur", 2.5)), fps)
        if pos + d > S["dialogue"]["end"]:
            warn.append("dialogue line %d does not fit the %.1f s act: cut it or lengthen the trailer" % (i, secs["dialogue"]))
            break
        rows.append({"i": i, "text": ln.get("text", ""), "start": pos, "end": pos + d})
        pos += d
        if i + 1 < len(lines):
            rows.append({"i": i, "dip_to_black": [pos, pos + dip]})
            pos += dip
    S["dialogue"]["lines"] = rows
    b0, b1 = S["build"]["start"], S["build"]["end"]
    nc, cs = p["cards"], frame_of(p["card_s"], fps)
    span = (b1 - b0) // (nc + 1)
    S["build"]["cards"] = [{"i": i, "start": b0 + (i + 1) * span - cs // 2, "end": b0 + (i + 1) * span - cs // 2 + cs, "small": "", "large": "",
                            "note": "a small line over a large line, on a texture"} for i in range(nc)]
    w0, w1 = S["wall"]["start"], S["wall"]["end"]
    step = (2 * 60.0 / bpm) if bpm else p["wall_cut_s"]
    S["wall"]["cuts"] = [frame_of(w0 / float(fps) + k * step, fps) for k in range(int((w1 - w0) / float(fps) / step) + 1) if frame_of(w0 / float(fps) + k * step, fps) < w1]
    es = p["end_split"]
    e0, e1 = S["end"]["start"], S["end"]["end"]
    L = e1 - e0
    stop = max(frame_of(p["min_stop_s"], fps), int(round(L * es["stop"])))
    tl = int(round(L * es["title"]))
    dt = int(round(L * es["date"]))
    S["end"]["parts"] = {"title": [e0, e0 + tl], "stop": [e0 + tl, e0 + tl + stop], "date": [e0 + tl + stop, e0 + tl + stop + dt], "sting": [e0 + tl + stop + dt, e1]}
    D = p["bed_db"]
    ramp = frame_of(p["question_ramp_ms"] / 1000.0, fps)
    q0, q1 = S["question"]["start"], S["question"]["end"]
    E = S["end"]["parts"]
    bed = [{"frame": 0, "gain_db": D["dialogue"]}, {"frame": b0, "gain_db": D["build_from"]}, {"frame": w0, "gain_db": D["build_to"]},
           {"frame": w0 + 1, "gain_db": D["wall"]}, {"frame": q0 - ramp, "gain_db": D["wall"]}, {"frame": q0, "gain_db": D["question"]},
           {"frame": q1, "gain_db": D["question"]}, {"frame": q1 + 1, "gain_db": D["crescendo_from"]}, {"frame": S["crescendo"]["end"], "gain_db": D["end"]},
           {"frame": E["stop"][0] - 0.12, "gain_db": D["end"]}, {"frame": E["stop"][0], "gain_db": D["stop"]}, {"frame": E["stop"][1], "gain_db": D["stop"]},
           {"frame": E["stop"][1] + 0.12, "gain_db": D["date"]}]
    sfx = [_cue(p["card_sfx"], c["start"], -6.0, card=c["i"]) for c in S["build"]["cards"]]
    sfx += [_cue(p["wall_sfx"], f, -4.0) for f in S["wall"]["cuts"][::4]]
    sfx += [_cue(p["crescendo_sfx"], S["crescendo"]["end"], 0.0, note="riser ends on the title frame"), _cue(p["title_sfx"], E["title"][0], 0.0), _cue(p["sting_sfx"], E["sting"][0], 0.0)]
    sfx[-3]["anchor_frame"] = S["crescendo"]["end"]
    return {"pattern": "trailerArc", "fps": fps, "frames": n, "seconds": {k: round(v, 4) for k, v in secs.items()}, "sections": [S[k] for k in order],
            "bed_automation": bed, "question_duck_db": D["question"] - D["wall"], "sfx": sorted(sfx, key=lambda c: c["anchor_frame"]), "warnings": warn}


# ------------------------------------------------------------------------------------------------------------- styleLadder
def _look_ids():
    try:
        with open(os.path.join(HERE, "..", "layers", "manifest.json")) as f:
            return {c["id"] for c in json.load(f)["components"]}
    except (OSError, KeyError, ValueError):
        return set()


def style_ladder(looks, bpm, fps=30, beats_per_style=None, start_beat=0.0, offset=0.0):
    """story.styleLadder: one held composition; look k swaps in on beat start_beat + k * beats_per_style (doubled until a style holds >= 0.5 s),
    the last look holds 2 beats. Unknown look.* / grade.* ids warn (free names such as 'live' or 'pencil' are allowed: wire them yourself)."""
    p = STORY["styleLadder"]
    spb = 60.0 / bpm
    st = p["beats_per_style"] if beats_per_style is None else beats_per_style
    warn = []
    lo, hi = p["style_s"]
    while st * spb < lo - 1e-9:
        st *= 2
    if st * spb > hi + 1e-9:
        warn.append("each style holds %.2f s: over %.1f s the ladder stops reading as range" % (st * spb, hi))
    if len(looks) > p["max_styles"]:
        warn.append("%d styles: more than %d blur together" % (len(looks), p["max_styles"]))
    known = _look_ids()
    for l in looks:
        if l.startswith(("look.", "grade.")) and known and l not in known:
            warn.append("unknown look id %r (layers/manifest.json)" % l)
    fr = lambda b: frame_of(offset + b * spb, fps)
    rows = []
    for k, l in enumerate(looks):
        b0 = start_beat + k * st
        b1 = b0 + (p["last_hold_beats"] if k == len(looks) - 1 else st)
        rows.append({"i": k, "look": l, "beat": b0, "frame": fr(b0), "until": fr(b1), "err_ms": round((fr(b0) / float(fps) - (offset + b0 * spb)) * 1000.0, 3)})
    sfx = [_cue(p["swap_sfx"], r["frame"], p["swap_gain_db"], look=r["look"]) for r in rows[1:]]
    return {"pattern": "styleLadder", "fps": fps, "bpm": bpm, "beats_per_style": st, "swaps": rows, "frames": rows[-1]["until"] if rows else 0,
            "sfx": sfx, "warnings": warn, "note": p["renderer"]}


# ---------------------------------------------------------------------------------------------------------------- CLI glue
def add_parsers(sub):
    w = sub.add_parser("walkthrough"); w.add_argument("--words", required=True); w.add_argument("--fps", type=float, default=30); w.add_argument("--steps", type=int)
    w.add_argument("--regions", default=""); w.add_argument("--end-hold", type=float); w.add_argument("--min-gap", type=float)
    q = sub.add_parser("query-ladder"); q.add_argument("--dur", type=float, required=True); q.add_argument("--fps", type=float, default=30); q.add_argument("--rungs", default="")
    q.add_argument("--bpm", type=float); q.add_argument("--words"); q.add_argument("--intro", type=float); q.add_argument("--pullback", type=float); q.add_argument("--end", type=float)
    q.add_argument("--sidecar", help="a music bed sidecar JSON: rungs start on its real bar_frames (a tempo ramp included)"); q.add_argument("--downbeats", default="", help="bar-start frames, comma separated")
    f = sub.add_parser("fidelity-ladder"); f.add_argument("--bpm", type=float, required=True); f.add_argument("--fps", type=float, default=30); f.add_argument("--steps", type=int)
    f.add_argument("--params", default=""); f.add_argument("--bars-per-step", type=float); f.add_argument("--dropout-s", type=float); f.add_argument("--reveal-bars", type=float); f.add_argument("--start-bar", type=float, default=0)
    v = sub.add_parser("voices-open"); v.add_argument("--clips", required=True); v.add_argument("--fps", type=float, default=30); v.add_argument("--max-open", type=float); v.add_argument("--j-ms", type=float)
    c = sub.add_parser("command-burst"); c.add_argument("--words", required=True); c.add_argument("--fps", type=float, default=30); c.add_argument("--burst-start", type=float)
    a = sub.add_parser("anaphora"); a.add_argument("--words", required=True); a.add_argument("--fps", type=float, default=30); a.add_argument("--token"); a.add_argument("--phrase")
    t = sub.add_parser("trailer"); t.add_argument("--dur", type=float, required=True); t.add_argument("--fps", type=float, default=30); t.add_argument("--dialogue"); t.add_argument("--bpm", type=float)
    s = sub.add_parser("style-ladder"); s.add_argument("--looks", required=True); s.add_argument("--bpm", type=float, required=True); s.add_argument("--fps", type=float, default=30)
    s.add_argument("--beats-per-style", type=float); s.add_argument("--start-beat", type=float, default=0.0)
    return {"walkthrough", "query-ladder", "fidelity-ladder", "voices-open", "command-burst", "anaphora", "trailer", "style-ladder"}


def run(a):
    lst = lambda s: [x.strip() for x in (s or "").split(",") if x.strip()]
    fps = int(a.fps) if float(a.fps).is_integer() else a.fps
    if a.cmd == "walkthrough":
        return walkthrough(a.words, fps, a.steps, lst(a.regions), a.end_hold, a.min_gap)
    if a.cmd == "query-ladder":
        r = lst(a.rungs)
        rungs = int(r[0]) if len(r) == 1 and r[0].isdigit() else (r or None)
        db = load_downbeats(a.sidecar, fps) if a.sidecar else ([int(x) for x in lst(a.downbeats)] or None)
        return query_ladder(a.dur, fps, rungs, a.bpm, a.words, a.intro, a.pullback, a.end, downbeats=db)
    if a.cmd == "fidelity-ladder":
        return fidelity_ladder(a.bpm, fps, a.steps, [float(x) for x in lst(a.params)] or None, a.bars_per_step, a.dropout_s, a.reveal_bars, start_bar=a.start_bar)
    if a.cmd == "voices-open":
        return voices_open(a.clips, fps, a.max_open, a.j_ms)
    if a.cmd == "command-burst":
        return command_burst(a.words, fps, a.burst_start)
    if a.cmd == "anaphora":
        return anaphora(a.words, fps, a.token, a.phrase)
    if a.cmd == "trailer":
        return trailer(a.dur, fps, a.dialogue, a.bpm)
    return style_ladder(lst(a.looks), a.bpm, fps, a.beats_per_style, a.start_beat)
