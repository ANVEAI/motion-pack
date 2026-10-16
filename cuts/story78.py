#!/usr/bin/env python3
"""motion-pack / cuts / story78.py: the xp-r78 story shape (2026-10-16), stdlib only, deterministic. Registered as cutgen.py subcommands (same frame maths as story45.py / story6.py).

  ab-replay       --clip-s 6 [--fps 30] [--mode replay|flip] [--gap-frames 0] [--flip-share 0.42] [--kind chip|wipe|slider] [--src-in 0]
                  [--lufs-a X --lufs-b Y] [--tol-db 1.0] [--xfade-ms 0] [--labels before,after]                                    abReplay
  verify-picture  --video v.mp4 --plan ab.json [--crop w:h:x:y] [--min-psnr 45]       the replayed picture is frame-identical (ffmpeg)

abReplay is the before / after audio swap: ONE clip is heard twice, first with the "before" stem, then with the "after" stem, and the swap happens on the SAME frame as the picture
flip (a corner chip, a wipe or a slider handle). The only thing that changes is the claim: the two halves are LEVEL-MATCHED (within `tol_db`, 1 dB by default), so the difference reads as
content, not loudness. Two modes:
  replay  the clip plays twice back to back (pass A, `gap_frames` of nothing, pass B). The flip frame is the first frame of pass B; both passes read the SAME source frames
          (`src_in`), so the picture is frame-identical across the two passes (verify-picture checks it on a rendered file).
  flip    the clip plays once and the flip lands at `flip_share` of it (the studied pieces flip at about 40-45 % of the runtime): picture and sound change on the flip frame while the
          shot (and the dialogue) keeps going. The two stems are time-aligned copies of one take.
The audio switch is on the flip frame: `switch_frame` = `flip.frame` and `switch_sample` = round(flip * 48000 / fps), a hard switch by default (`xfade_ms` 0: both stems change ON that
frame); a crossfade, when asked for, is centred on the flip sample, never before the picture. The loudness correction is a gain on stem B (`audio.tracks[1].gain_db`) = LUFS(A) - LUFS(B)
when `--lufs-a` and `--lufs-b` are given (measure them with ears: `python3 ears/listen.py`, or ears/checks_ab.py on the rendered file), clamped to +-12 dB; without the two numbers the gain is 0
and `warnings` says the level was not measured (ears/checks_ab.py then judges it on the file). The result carries `plan_audio`, the block to paste at plan.audio.abReplay, which ears reads.
check_ab_replay(result) re-derives every rule from the emitted data alone (templates and tests call it; a hand-edited plan fails it). Craft only: the shape of studied references
(docs/research/reference-mirelo-2026-10.md), no copy, no names. Numbers: cuts/patterns.json story.abReplay."""
import json, math, os, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import story45  # noqa: E402  (frame_of, the cue row shape and patterns.json story block)

STORY = story45.STORY
frame_of = story45.frame_of
_cue = story45._cue
SR = 48000
MAX_CLIP_S = 600.0


def _num(name, v, lo, hi):
    """a numeric parameter must be a real, finite number inside [lo, hi]: NaN, inf, a string, a bool or an out-of-range value raises a ValueError that names it"""
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        raise ValueError("ab-replay: %s must be a finite number, got %r" % (name, v))
    if not lo <= v <= hi:
        raise ValueError("ab-replay: %s must be between %g and %g, got %g" % (name, lo, hi, v))
    return v


def ab_replay(clip_s=6.0, fps=30, mode="replay", gap_frames=None, flip_share=None, kind="chip", src_in=0, lufs_a=None, lufs_b=None, tol_db=None, xfade_ms=None, labels=("before", "after")):
    p = STORY["abReplay"]
    fps = _num("fps", fps, 1, 240)
    clip_s = _num("clip_s", clip_s, 0.5, MAX_CLIP_S)
    if mode not in ("replay", "flip"):
        raise ValueError("ab-replay: mode must be replay or flip, got %r" % (mode,))
    if kind not in p["flip_kinds"]:
        raise ValueError("ab-replay: kind must be one of %s, got %r" % (", ".join(p["flip_kinds"]), kind))
    gap = int(_num("gap_frames", p["gap_frames"] if gap_frames is None else gap_frames, 0, 240))
    share = _num("flip_share", p["flip_share"] if flip_share is None else flip_share, 0.05, 0.95)
    tol = _num("tol_db", p["tol_db"] if tol_db is None else tol_db, 0.1, 6.0)
    xf = _num("xfade_ms", p["xfade_ms"] if xfade_ms is None else xfade_ms, 0, 500)
    src = int(_num("src_in", src_in, 0, 10 ** 7))
    for nm, v in (("lufs_a", lufs_a), ("lufs_b", lufs_b)):
        if v is not None:
            _num(nm, v, -70.0, 0.0)
    if not (isinstance(labels, (tuple, list)) and len(labels) == 2 and all(isinstance(x, str) and 0 < len(x.strip()) <= 24 for x in labels)):
        raise ValueError("ab-replay: labels must be two short non-empty strings, got %r" % (labels,))
    n = frame_of(clip_s, fps)
    if n < 2:
        raise ValueError("ab-replay: the clip is under 2 frames")
    warnings = []
    if not p["clip_range_s"][0] <= clip_s <= p["clip_range_s"][1]:
        warnings.append("clip is %.2f s: the studied replays use %g-%g s per pass" % (clip_s, p["clip_range_s"][0], p["clip_range_s"][1]))
    if mode == "replay":
        a0, a1 = 0, n
        b0 = n + gap
        b1 = b0 + n
        frames = b1
        flip = b0
        passes = [{"id": "A", "label": labels[0], "start": a0, "end": a1, "src_in": src}, {"id": "B", "label": labels[1], "start": b0, "end": b1, "src_in": src}]
        tracks = [{"id": "A", "start": a0, "end": a1, "gain_db": 0.0}, {"id": "B", "start": b0, "end": b1, "gain_db": 0.0}]
        sh = flip / float(frames)
        if gap:
            warnings.append("gap_frames %d: the picture holds the last frame of pass A for %d frames before pass B (a beat); the flip stays on the first frame of pass B" % (gap, gap))
    else:
        frames = n
        flip = max(1, min(n - 1, frame_of(share * clip_s, fps)))
        passes = [{"id": "A", "label": labels[0], "start": 0, "end": flip, "src_in": src}, {"id": "B", "label": labels[1], "start": flip, "end": n, "src_in": src + flip}]
        tracks = [{"id": "A", "start": 0, "end": flip, "gain_db": 0.0}, {"id": "B", "start": flip, "end": n, "gain_db": 0.0}]
        sh = flip / float(frames)
    if not p["flip_share_range"][0] <= sh <= p["flip_share_range"][1]:
        warnings.append("the flip lands at %.0f %% of the runtime: the studied pieces flip at %.0f-%.0f %%" % (100 * sh, 100 * p["flip_share_range"][0], 100 * p["flip_share_range"][1]))
    level = {"lufs_a": lufs_a, "lufs_b": lufs_b, "tol_db": tol, "measured": lufs_a is not None and lufs_b is not None, "diff_db": None, "gain_b_db": 0.0, "matched": None}
    if level["measured"]:
        want = lufs_a - lufs_b
        g = max(-p["max_gain_db"], min(p["max_gain_db"], want))
        level.update({"diff_db": round(lufs_a - lufs_b, 3), "gain_b_db": round(g, 3), "matched": abs(lufs_a - (lufs_b + g)) <= tol + 1e-9})
        tracks[1]["gain_db"] = round(g, 3)
        if abs(want) > p["max_gain_db"]:
            warnings.append("stems differ by %.1f dB: more than the %g dB the shape will correct; the halves are NOT level-matched (re-render the stems)" % (want, p["max_gain_db"]))
        elif abs(want) > 3.0:
            warnings.append("stems differ by %.1f dB before matching: a large correction; check that stem B is not simply quieter or louder by design" % want)
    else:
        warnings.append("level not measured: pass --lufs-a and --lufs-b (or run ears/checks_ab.py on the rendered file); the gain on stem B stays 0 until then")
    switch_sample = int(math.floor(flip * SR / float(fps) + 0.5))
    xs = int(round(xf * SR / 1000.0))
    r = {"pattern": "abReplay", "fps": fps, "mode": mode, "frames": frames, "seconds": round(frames / float(fps), 4),
         "clip": {"frames": n, "src_in": src}, "passes": passes,
         "flip": {"frame": flip, "t": round(flip / float(fps), 4), "kind": kind, "share": round(sh, 4), "picture": p["picture"][kind]},
         "audio": {"tracks": tracks, "switch_frame": flip, "switch_sample": switch_sample, "crossfade_samples": xs, "level": level, "sample_rate": SR},
         "sfx": [_cue(p["flip_sfx"], flip, p["flip_gain_db"], why="the %s flips on the swap frame (the cue lands on the picture flip, anchor = flip + 1)" % kind)],
         "plan_audio": {"abReplay": {"fps": fps, "mode": mode, "flip_frame": flip, "a": [passes[0]["start"], passes[0]["end"]], "b": [passes[1]["start"], passes[1]["end"]], "tol_db": tol,
                                     "gain_b_db": tracks[1]["gain_db"]}},
         "warnings": warnings}
    r["checks"] = check_ab_replay(r)
    return r


def check_ab_replay(r):
    """re-derive the shape's rules from the emitted data alone -> [{check, ok, detail}]. Fails on a hand-edited plan: passes that are not the same length, a source in-frame that
    differs (the picture would not be identical), a swap that is not on the flip frame, a switch sample that is not the flip's, a stem gain that leaves the halves more than tol apart."""
    p = STORY["abReplay"]
    fps, out = r["fps"], []
    ok = lambda name, good, detail: out.append({"check": name, "ok": bool(good), "detail": detail})
    A, B = r["passes"]
    fl, au = r["flip"], r["audio"]
    ok("two passes, ids A and B, labelled", [A["id"], B["id"]] == ["A", "B"] and all(x["label"] for x in r["passes"]), "%s / %s" % (A["label"], B["label"]))
    ok("the swap is on the flip frame: stem B starts on it", au["switch_frame"] == fl["frame"] == B["start"] == au["tracks"][1]["start"], "%d / %d / %d" % (au["switch_frame"], fl["frame"], B["start"]))
    ok("stem A ends where its pass ends; in flip mode stem B begins right there, in replay mode after the gap", au["tracks"][0]["end"] == A["end"] and B["start"] >= A["end"] and (r["mode"] != "flip" or B["start"] == A["end"]),
       "A ends %d, B starts %d" % (A["end"], B["start"]))
    ok("the switch sample is the flip frame's: round(frame * 48000 / fps)", au["switch_sample"] == int(math.floor(fl["frame"] * au["sample_rate"] / float(fps) + 0.5)), str(au["switch_sample"]))
    ok("no crossfade reaches back before the picture flip", au["crossfade_samples"] / 2.0 <= au["switch_sample"] and au["crossfade_samples"] >= 0, "%d samples" % au["crossfade_samples"])
    if r["mode"] == "replay":
        ok("both passes are the same length", A["end"] - A["start"] == B["end"] - B["start"] == r["clip"]["frames"], "%d / %d frames" % (A["end"] - A["start"], B["end"] - B["start"]))
        ok("both passes read the SAME source frames (src_in equal): the replayed picture is frame-identical", A["src_in"] == B["src_in"] == r["clip"]["src_in"], "%d / %d" % (A["src_in"], B["src_in"]))
        ok("the film is pass A, the gap, pass B and nothing else", r["frames"] == B["end"] and A["start"] == 0, "%d frames" % r["frames"])
    else:
        ok("one shot: pass B continues the source where pass A stopped", B["src_in"] == A["src_in"] + (A["end"] - A["start"]) and B["end"] == r["frames"] == r["clip"]["frames"], "%d" % B["src_in"])
    lv = au["level"]
    if lv["measured"]:
        g = au["tracks"][1]["gain_db"]
        ok("the halves are level-matched within tol_db after the gain on stem B", abs(lv["lufs_a"] - (lv["lufs_b"] + g)) <= lv["tol_db"] + 1e-9 and lv["tol_db"] <= p["tol_db_max"], "%.2f dB apart after %+.2f dB" % (lv["lufs_a"] - (lv["lufs_b"] + g), g))
        ok("the gain is within the correction limit", abs(g) <= p["max_gain_db"] + 1e-9, "%+.2f dB" % g)
    else:
        ok("level not measured: the gain stays 0 and the plan says so", au["tracks"][1]["gain_db"] == 0 and any("level not measured" in w for w in r["warnings"]), "")
    ok("the flip cue is on the flip frame, anchor +1", len(r["sfx"]) == 1 and r["sfx"][0]["visual_frame"] == fl["frame"] and r["sfx"][0]["anchor_frame"] == fl["frame"] + 1, str([c["visual_frame"] for c in r["sfx"]]))
    pa = r["plan_audio"]["abReplay"]
    ok("plan.audio.abReplay (what ears reads) repeats the frames of the passes and the flip", pa["flip_frame"] == fl["frame"] and pa["a"] == [A["start"], A["end"]] and pa["b"] == [B["start"], B["end"]] and pa["fps"] == fps, json.dumps(pa))
    fr = [A["start"], A["end"], B["start"], B["end"], fl["frame"], au["switch_frame"]]
    ok("every frame is a whole number inside the film", all(isinstance(f, int) and 0 <= f <= r["frames"] for f in fr), str(fr))
    return out


def picture_identical(video, plan, crop=None, min_psnr=45.0):
    """the replayed picture is frame-identical: pass A's source frames against pass B's in a RENDERED file (ffmpeg psnr between the two ranges). A final render carries different overlay
    text in the two passes (the label chip): pass `crop` w:h:x:y of a region with no overlay, or a plate render (no overlays). -> {identical, min_psnr, frames}; identical when every frame pair is
    bit-equal or at least min_psnr dB (a lossy encode of the same frames at different GOP positions differs by a few hundredths of a dB at most, a different picture by tens)"""
    if plan.get("mode") != "replay":
        raise ValueError("verify-picture: only the replay mode plays one picture twice")
    A, B = plan["passes"]
    n = A["end"] - A["start"]
    cr = ("crop=%s," % crop) if crop else ""
    fg = ("[0:v]%strim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS[x];[0:v]%strim=start_frame=%d:end_frame=%d,setpts=PTS-STARTPTS[y];[x][y]psnr=stats_file=-"
          % (cr, A["start"], A["end"], cr, B["start"], B["end"]))
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", video, "-filter_complex", fg, "-f", "null", "-"], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("verify-picture: ffmpeg failed: " + r.stderr.strip()[-300:])
    vals = []
    for ln in r.stdout.splitlines():
        for tok in ln.split():
            if tok.startswith("psnr_avg:"):
                v = tok.split(":", 1)[1]
                vals.append(float("inf") if v == "inf" else float(v))
    if len(vals) != n:
        raise RuntimeError("verify-picture: expected %d frame pairs, ffmpeg compared %d (does the file have the frames of both passes?)" % (n, len(vals)))
    lo = min(vals)
    return {"identical": lo >= min_psnr, "min_psnr": None if math.isinf(lo) else round(lo, 3), "bit_equal": math.isinf(lo), "frames": n, "min_psnr_required": min_psnr}


def add_parsers(sub):
    q = sub.add_parser("ab-replay")
    q.add_argument("--clip-s", type=float, default=6.0); q.add_argument("--fps", type=float, default=30); q.add_argument("--mode", choices=["replay", "flip"], default="replay")
    q.add_argument("--gap-frames", type=int); q.add_argument("--flip-share", type=float); q.add_argument("--kind", choices=["chip", "wipe", "slider"], default="chip")
    q.add_argument("--src-in", type=int, default=0); q.add_argument("--lufs-a", type=float); q.add_argument("--lufs-b", type=float); q.add_argument("--tol-db", type=float)
    q.add_argument("--xfade-ms", type=float); q.add_argument("--labels", default="before,after")
    v = sub.add_parser("verify-picture")
    v.add_argument("--video", required=True); v.add_argument("--plan", required=True); v.add_argument("--crop"); v.add_argument("--min-psnr", type=float, default=45.0)
    return {"ab-replay", "verify-picture"}


def run(a):
    if a.cmd == "verify-picture":
        with open(a.plan) as f:
            plan = json.load(f)
        return picture_identical(a.video, plan, a.crop, a.min_psnr)
    fps = int(a.fps) if float(a.fps).is_integer() else a.fps
    return ab_replay(a.clip_s, fps, a.mode, a.gap_frames, a.flip_share, a.kind, a.src_in, a.lufs_a, a.lufs_b, a.tol_db, a.xfade_ms, tuple(x.strip() for x in a.labels.split(",")))
