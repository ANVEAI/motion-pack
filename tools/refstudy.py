#!/usr/bin/env python3
"""refstudy: measure a reference video's picture, edit and sound, so a person or an agent can learn its craft.

Usage:
  refstudy.py <x-status-url | mp4-url | file.mp4> <out_dir> [--whisper base|small|none] [--tiers tiers.json] [--tier A|A-|B|B'|R|C|D]
  refstudy.py grade <study_dir> [<study_dir> ...] [--tiers tiers.json] [--write] [--json]
      grade existing study folders from their meta.json (and the quiet open / tail from study.json's 4 Hz curve) without
      re-downloading anything; --write adds "evidence" (and "quiet" when missing) to each study.json

Writes into out_dir:
  meta.json      post metadata (X posts, via the public fxtwitter API), duration, size
  sheet.jpg      contact sheet (2 fps up to 30 s, 1 fps up to 120 s, else 0.5 fps)
  timeline.png   loudness, low/mid/high energy, onsets, beats, cuts and speech on one time axis
  study.json     every measurement, ready to paste into a study document

What it measures:
- **edit:** hard cuts (scene score), shot lengths, cuts per minute.
- **sound:** integrated LUFS and true peak; a 4 Hz loudness curve; low (<150 Hz), mid and high (>4 kHz) energy; onsets and their strongest "hits"; tempo and beats (an estimate, often wrong on dialogue); silences; spectral brightness.
- **sync:** the share of cuts within 2 frames of an onset or a beat.
- **speech:** an optional Whisper transcript with timestamps, giving voiceover presence and words per minute.
- **motion:** visual events for continuous (few-cut) pieces: frame-difference / colour-change peaks and new-text appearance (edge-density
  jumps) from a fixed 30 fps, 96x54 pass, peak-picked against the median absolute deviation; their share within 2 frames of an audio
  onset (`motion.sync.share_on_onset`, the continuous-film version of the cut sync) and, with a transcript, the share inside speech gaps.
- **quiet:** the quiet open (first 2 s, by seconds) and the quiet tail (last 2 s; last 3 s too) against the body median, in dB, and the ending shape.
- **evidence:** the reach tier from meta.json (A, A-, B boosted, B', R, C, D) with its reasons, the auto `boosted` flag and the
  `claim_driven` flag; thresholds in tools/refstudy_tiers.json (override with --tiers, or force one with --tier / meta tier_override).

Nothing here listens like a person. Treat tempo and hits as hints and check them against the frames.
A remote video is downloaded ONCE to a temporary file (curl with retries, a 10-minute cap and a minimum-speed abort), every
analysis reads that local copy, and the temporary folder is deleted at the end; only the stills and the JSON stay.
(Streaming the URL into each ffmpeg pass used to hang for an hour on a stalled CDN read, with no timeout.)

Environment:
  FFMPEG       the ffmpeg binary (default: `ffmpeg` on PATH)
  WHISPER_BIN  the openai-whisper CLI used for --whisper base|small (default: `whisper` on PATH); --whisper none skips speech
Python deps: numpy and matplotlib only. A post URL is fetched over the network; a local file needs none.
Learning from a reference is craft, not copying: see skills/motion-pack/references/reference-intake.md.
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TIERS = os.path.join(HERE, "refstudy_tiers.json")

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
WHISPER_BIN = os.environ.get("WHISPER_BIN", "whisper")


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def resolve(src):
    meta = {"source": src}
    m = re.search(r"x\.com/([^/]+)/status/(\d+)|twitter\.com/([^/]+)/status/(\d+)", src)
    if m:
        user = m.group(1) or m.group(3); sid = m.group(2) or m.group(4)
        with urllib.request.urlopen(f"https://api.fxtwitter.com/{user}/status/{sid}", timeout=30) as r:
            t = json.load(r)["tweet"]
        vids = (t.get("media") or {}).get("videos") or ((t.get("quote") or {}).get("media") or {}).get("videos") or []
        if not vids:
            raise SystemExit("no video on that post")
        v = vids[0]
        meta.update(author=t["author"]["screen_name"], followers=t["author"].get("followers"), date=t.get("created_at"),
                    views=t.get("views"), likes=t.get("likes"), reposts=t.get("retweets"), bookmarks=t.get("bookmarks"),
                    replies=t.get("replies"), text=t.get("text"), width=v.get("width"), height=v.get("height"),
                    duration=v.get("duration"))
        return v["url"], meta
    return src, meta


def fetch(url, tmpdir):
    """download a remote video once (bounded in time); a local path is returned unchanged"""
    if not re.match(r"https?://", url):
        return url
    dst = os.path.join(tmpdir, "reference.mp4")
    r = subprocess.run(["curl", "-sSL", "--fail", "--retry", "3", "--retry-delay", "3", "--connect-timeout", "20",
                        "--max-time", "600", "--speed-limit", "20000", "--speed-time", "60", "-o", dst, url],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(dst) or os.path.getsize(dst) == 0:
        raise SystemExit(f"download failed (curl exit {r.returncode}): {r.stderr.strip()[:200]}")
    return dst


def duration_of(url):
    out = sh([FFMPEG, "-hide_banner", "-i", url]).stderr
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", out)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else None


def contact_sheet(url, dur, out):
    fps = 2 if dur <= 30 else (1 if dur <= 120 else 0.5)
    n = int(dur * fps) + 1
    cols = 6 if n <= 48 else 8
    rows = max(1, -(-n // cols))
    sh([FFMPEG, "-v", "error", "-y", "-i", url, "-vf", f"fps={fps},scale=360:-1,tile={cols}x{rows}", "-frames:v", "1", out])
    return fps


def cuts(url, thr=0.3):
    out = sh([FFMPEG, "-hide_banner", "-i", url, "-an", "-vf",
              f"scale=320:-1,select='gt(scene,{thr})',metadata=print:file=-", "-f", "null", "-"]).stdout
    return [round(float(x), 3) for x in re.findall(r"pts_time:([\d.]+)", out)]


def loudness(url):
    err = sh([FFMPEG, "-hide_banner", "-nostats", "-i", url, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", err); tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)
    return (float(i[-1]) if i else None), (float(tp[-1]) if tp else None)


def _read_audio(url, sr):
    import numpy as np
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", url, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype="<i2").astype("float32") / 32768.0


def audio_analysis(url, cut_times, fps_video=30.0):
    """numpy-only: STFT, spectral-flux onsets, autocorrelation tempo, a phase-fitted beat grid."""
    import numpy as np
    sr, n_fft, hop = 22050, 2048, 512
    y = _read_audio(url, sr)
    if y.size < n_fft:
        return {"error": "no audio track"}
    nfr = 1 + (len(y) - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(nfr)[:, None]
    frames = y[idx] * np.hanning(n_fft)[None, :]
    S = np.abs(np.fft.rfft(frames, axis=1)) ** 2            # (frames, bins)
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    t = (np.arange(nfr) * hop + n_fft / 2) / sr
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    db = 20 * np.log10(np.maximum(rms, 1e-6)) + 3.0          # +3 dB for the Hann window, roughly
    tot = S.sum(axis=1) + 1e-12
    low = S[:, freqs < 150].sum(axis=1) / tot; high = S[:, freqs > 4000].sum(axis=1) / tot; mid = 1 - low - high
    centroid = (S * freqs[None, :]).sum(axis=1) / tot
    logS = np.log1p(1000 * S)
    flux = np.maximum(0, np.diff(logS, axis=0)).sum(axis=1); flux = np.concatenate([[0], flux])
    k = 3; env = np.convolve(flux, np.ones(k) / k, mode="same")
    # onsets: local maxima above a moving median + margin, at least 60 ms apart
    w = int(0.5 * sr / hop); med = np.array([np.median(env[max(0, i - w):i + w + 1]) for i in range(len(env))])
    thr = med + 0.6 * np.std(env)
    cand = [i for i in range(1, len(env) - 1) if env[i] > thr[i] and env[i] >= env[i - 1] and env[i] >= env[i + 1]]
    gap = int(0.06 * sr / hop); onsets_i = []
    for i in cand:
        if not onsets_i or i - onsets_i[-1] >= gap: onsets_i.append(i)
        elif env[i] > env[onsets_i[-1]]: onsets_i[-1] = i
    onsets = t[onsets_i] if onsets_i else np.array([])
    strengths = env[onsets_i] if onsets_i else np.array([])
    hthr = np.percentile(strengths, 90) if len(strengths) else 0
    hits = [round(float(a), 3) for a, b in zip(onsets, strengths) if b >= hthr]
    # tempo: autocorrelation of the onset envelope, 60-180 BPM
    e = env - env.mean(); ac = np.correlate(e, e, mode="full")[len(e) - 1:]
    fr_per_s = sr / hop; lags = np.arange(len(ac)); bpm = 60 * fr_per_s / np.maximum(lags, 1)
    ok = (bpm >= 60) & (bpm <= 180)
    lag = int(lags[ok][np.argmax(ac[ok])]) if ok.any() else 0
    tempo = float(60 * fr_per_s / lag) if lag else 0.0
    conf = float(ac[lag] / ac[0]) if lag and ac[0] > 0 else 0.0
    beats = np.array([])
    if lag:
        phases = [env[p::lag].sum() for p in range(lag)]; ph = int(np.argmax(phases))
        beats = t[np.arange(ph, len(env), lag)]
    sil, start = [], None
    for tt, d in zip(t, db):
        if d < -45 and start is None: start = tt
        if d >= -45 and start is not None:
            if tt - start >= 0.3: sil.append([round(float(start), 2), round(float(tt), 2)])
            start = None
    step = 0.25; grid = np.arange(0, t[-1], step)
    curve = []
    for g in grid:
        m = (t >= g) & (t < g + step)
        curve.append(round(float(db[m].mean()), 1) if m.any() else None)
    tol = 2.0 / fps_video
    def near(ts, ref):
        ref = np.asarray(ref)
        return sum(1 for c in ts if ref.size and np.min(np.abs(ref - c)) <= tol)
    nc = len(cut_times)
    sync = {"cuts": nc, "cuts_on_onset": near(cut_times, onsets), "cuts_on_beat": near(cut_times, beats),
            "share_on_onset": round(near(cut_times, onsets) / nc, 2) if nc else None,
            "share_on_beat": round(near(cut_times, beats) / nc, 2) if nc else None,
            "onsets_per_s": round(len(onsets) / max(t[-1], 1e-6), 2), "tolerance_s": round(tol, 3)}
    return {
        "loudness_curve_4hz_dbfs": curve,
        "band_share_mean": {"low_<150Hz": round(float(low.mean()), 3), "mid": round(float(mid.mean()), 3), "high_>4kHz": round(float(high.mean()), 3)},
        "brightness_hz_mean": round(float(centroid.mean()), 0),
        "onsets": [round(float(x), 3) for x in onsets], "hits_top10pct": hits,
        "tempo_bpm_estimate": round(tempo, 1), "tempo_confidence": round(conf, 2), "beats": [round(float(x), 3) for x in beats],
        "silences": sil, "sync": sync,
        "_plot": {"t": t.tolist(), "db": db.tolist(), "low": low.tolist(), "high": high.tolist()},
    }


MOTION_FPS, MOTION_W, MOTION_H = 30, 96, 54


def _frames(url, fps=MOTION_FPS, w=MOTION_W, h=MOTION_H):
    """the whole video as small RGB frames at a fixed rate: (n, h, w, 3) uint8 (aspect is ignored; only change matters)"""
    import numpy as np
    raw = subprocess.run([FFMPEG, "-v", "error", "-nostdin", "-i", url, "-an", "-vf", f"fps={fps},scale={w}:{h}:flags=area",
                          "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
    n = len(raw) // (w * h * 3)
    return np.frombuffer(raw[:n * w * h * 3], dtype=np.uint8).reshape(n, h, w, 3)


def _peaks(curve, k, floor, gap):
    """local maxima of curve over median + k * 1.4826 * MAD and over an absolute floor, at least `gap` samples apart (stronger wins)"""
    import numpy as np
    if len(curve) < 3:
        return []
    med = float(np.median(curve)); mad = float(np.median(np.abs(curve - med))) * 1.4826
    thr = max(med + k * mad, floor)
    out = []
    for i in range(1, len(curve) - 1):
        if curve[i] > thr and curve[i] >= curve[i - 1] and curve[i] >= curve[i + 1]:
            if out and i - out[-1] < gap:
                if curve[i] > curve[out[-1]]: out[-1] = i
            else:
                out.append(i)
    return out


def motion_events(url, cut_times=(), fps=MOTION_FPS, k=6.0):
    """visual events of a continuous piece. Two curves on the 30 fps, 96x54 frames:
      change  mean absolute RGB difference to the previous frame (0-255): flashes, large-area luma or colour changes, things appearing
      text    the jump in edge density (share of pixels with a luma gradient > 24) to the previous frame: type or UI appearing
    Peaks over median + k * MAD (and an absolute floor) are events; a frame-pair i-1 -> i is reported at the time of frame i.
    Steady camera moves raise the median, so only the accents of a moving shot count. Deterministic on the same file."""
    import numpy as np
    F = _frames(url, fps)
    if len(F) < 3:
        return {"error": "no video frames", "events": []}
    X = F.astype(np.float32)
    change = np.concatenate([[0.0], np.abs(np.diff(X, axis=0)).mean(axis=(1, 2, 3))])
    Y = X @ np.array([0.299, 0.587, 0.114], np.float32)
    gx = np.abs(np.diff(Y, axis=2))[:, :-1, :]; gy = np.abs(np.diff(Y, axis=1))[:, :, :-1]
    edges = ((gx + gy) > 24).mean(axis=(1, 2))
    text = np.concatenate([[0.0], np.abs(np.diff(edges))]) * 100.0          # percentage points of the frame
    pc = _peaks(change, k, 2.0, 3); pt = _peaks(text, k, 0.5, 3)
    idx = sorted(set(pc) | set(pt)); ev = []
    for i in idx:                                                            # merge a change and a text peak 1-2 frames apart
        if ev and i - ev[-1] <= 2:
            if change[i] > change[ev[-1]]: ev[-1] = i
        else:
            ev.append(i)
    t = [round(i / fps, 3) for i in ev]
    tol = 2.0 / fps
    cut_like = [x for x in t if any(abs(x - c) <= tol for c in cut_times)]
    return {"fps": fps, "size": [MOTION_W, MOTION_H], "k_mad": k, "events": t,
            "kinds": ["change+text" if (i in pc and i in pt) else ("change" if i in pc else "text") for i in ev],
            "strength": [round(float(change[i]), 2) for i in ev], "events_not_cuts": [x for x in t if x not in cut_like],
            "events_per_min": round(len(t) / (len(F) / fps) * 60, 1), "motion_energy_median": round(float(np.median(change)), 2),
            "_curve": {"t": (np.arange(len(F)) / fps).tolist(), "change": change.tolist()}}


def motion_sync(motion, onsets, speech=None, fps_video=30.0):
    """share of visual events within 2 video frames of an audio onset; with speech segments, the share that fall in speech gaps"""
    import numpy as np
    ev = motion.get("events") or []
    on = np.asarray(onsets or [], float)
    tol = 2.0 / fps_video
    n_on = sum(1 for e in ev if on.size and np.min(np.abs(on - e)) <= tol)
    out = {"events": len(ev), "events_on_onset": n_on, "share_on_onset": round(n_on / len(ev), 2) if ev else None, "tolerance_s": round(tol, 3)}
    segs = (speech or {}).get("segments") or []
    if ev and segs:
        inside = sum(1 for e in ev if any(s["s"] <= e <= s["e"] for s in segs))
        out["share_in_speech_gaps"] = round((len(ev) - inside) / len(ev), 2)
    return out


def quiet_shape(curve, step=0.25):
    """quiet open and quiet tail from a loudness curve (dBFS per `step` s, e.g. study audio.loudness_curve_4hz_dbfs), in dB against the
    median of the body (from 2 s in to 3 s before the end; negative = under the body):
      open_vs_body_db     the quieter of the first and the second second (medians): the sound may enter 1-2 s after a moving frame 0
      open_2s_vs_body_db  the median of the first 2 s
      tail_2s / tail_3s   the median of the last 2 s and of the last 3 s
    quiet_open: open_vs_body_db <= -6; quiet_tail: tail_2s <= -10 (on the round 4/5 intake these reproduce the hand counts, 13 and 17 of 28).
    end_shape: slam (the last second within 6 dB of the body), quiet hold (the last 2 s >= 10 dB under and flat within
    8 dB), decay (falling into the end) or level. sound_enters_s: the first quarter-second within 20 dB of the body."""
    import numpy as np
    c = np.asarray([v if v is not None else -90.0 for v in (curve or [])], float)
    n = len(c); q = lambda s_: int(round(s_ / step))
    if n < q(6.0):
        return None
    c = np.maximum(c, -90.0)
    body = float(np.median(c[q(2.0):n - q(3.0)]))
    med = lambda x: round(float(np.median(x)) - body, 1)
    out = {"body_median_dbfs": round(body, 1), "open_vs_body_db": min(med(c[:q(1.0)]), med(c[q(1.0):q(2.0)])), "open_2s_vs_body_db": med(c[:q(2.0)]),
           "tail_2s_vs_body_db": med(c[n - q(2.0):]), "tail_3s_vs_body_db": med(c[n - q(3.0):])}
    out["quiet_open"] = out["open_vs_body_db"] <= -6.0
    out["quiet_tail"] = out["tail_2s_vs_body_db"] <= -10.0
    last1, seg = med(c[n - q(1.0):]), c[n - q(2.0):]
    if last1 >= -6.0:
        shape = "slam"
    elif out["quiet_tail"] and float(np.percentile(seg, 90) - np.percentile(seg, 10)) <= 8.0:
        shape = "quiet hold"
    elif last1 < -6.0:
        shape = "decay"
    else:
        shape = "level"
    out["end_shape"] = shape
    live = np.where(c >= body - 20.0)[0]
    out["sound_enters_s"] = round(float(live[0]) * step, 2) if live.size else None
    out["duration_s"] = round(n * step, 2)
    return out


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def grade(meta, rules=None, override=None):
    """evidence tier from post reach (meta.json): views/followers (v/f), like %, bookmark %, reply % of views.
    Rules (tools/refstudy_tiers.json) run in order: D no data; B boosted-looking (like <= 0.05 %, or v/f >= 100 with like <= 0.15 %,
    or reach without likes); A proven organic (v/f >= 1.5 or bm >= 1.5 %, at a like rate >= 0.2 %); A- saves-strong (bm >= 1.3 %);
    B' solid for a big account (>= 1M followers, v/f >= 1); R account-size reach (>= 500K views at v/f < 1); else C.
    claim_driven flags an A whose reach is high (v/f >= 10) at a like rate under 0.4 %: some of that reach is debate."""
    R = rules or json.load(open(TIERS))
    v, fo = _f(meta.get("views")), _f(meta.get("followers"))
    pct = lambda k: (100.0 * (_f(meta.get(k)) or 0.0) / v) if v else None
    like, bm, rep = pct("likes"), pct("bookmarks"), pct("replies")
    vf = (v / fo) if (v and fo) else None
    nums = {"views": v and int(v), "followers": fo and int(fo), "v_per_f": None if vf is None else round(vf, 2),
            "like_pct": None if like is None else round(like, 3), "bm_pct": None if bm is None else round(bm, 3),
            "reply_pct": None if rep is None else round(rep, 3)}
    why = []
    B, A, Am, Bp, Rr, C = R["boosted"], R["A"], R["A-"], R["B'"], R["R"], R["claim_driven"]
    if not v or not fo:
        tier = "D"; why.append("no views or follower count in meta.json")
    elif like <= B["like_max_pct"]:
        tier = "B"; why.append("like rate %.3f%% <= %.2f%%: boosted-looking" % (like, B["like_max_pct"]))
    elif vf >= B["vf_min"] and like <= B["vf_like_max_pct"]:
        tier = "B"; why.append("v/f %.0fx >= %.0f with like rate %.2f%% <= %.2f%%: boosted-looking" % (vf, B["vf_min"], like, B["vf_like_max_pct"]))
    elif (vf >= A["vf_min"] or bm >= A["bm_min_pct"]) and like < A["like_min_pct"]:
        tier = "B"; why.append("reach (v/f %.2f, bm %.2f%%) without likes (%.2f%% < %.2f%%): boosted-looking" % (vf, bm, like, A["like_min_pct"]))
    elif vf >= A["vf_min"] or bm >= A["bm_min_pct"]:
        tier = "A"; why.append(("v/f %.2f >= %.1f" % (vf, A["vf_min"])) if vf >= A["vf_min"] else ("bm %.2f%% >= %.1f%%" % (bm, A["bm_min_pct"])))
    elif bm >= Am["bm_min_pct"]:
        tier = "A-"; why.append("bm %.2f%% >= %.1f%% at v/f %.2f: saves-strong" % (bm, Am["bm_min_pct"], vf))
    elif fo >= Bp["followers_min"] and vf >= Bp["vf_min"]:
        tier = "B'"; why.append("v/f %.2f >= %.1f on %d followers" % (vf, Bp["vf_min"], fo))
    elif v >= Rr["views_min"] and vf < Rr["vf_max"]:
        tier = "R"; why.append("%d views at v/f %.2f < %.1f: the reach is the account's" % (v, vf, Rr["vf_max"]))
    else:
        tier = "C"; why.append("v/f %.2f, like %.2f%%, bm %.2f%%: no tier rule met" % (vf, like, bm))
    claim = bool(tier == "A" and vf >= C["vf_min"] and like < C["like_max_pct"])
    if claim:
        why.append("claim-driven: v/f %.0fx with a like rate of %.2f%% < %.1f%%" % (vf, like, C["like_max_pct"]))
    ov = override or meta.get("tier_override")
    if ov:
        ov = ov if isinstance(ov, dict) else {"tier": ov, "why": "set by hand (--tier)"}
        why.append("override: %s -> %s (%s)" % (tier, ov["tier"], ov.get("why", "")))
        tier = ov["tier"]
    return {"tier": tier, "display": tier + ("*" if claim else ""), "label": R["labels"].get(tier, ""), "boosted": tier == "B",
            "claim_driven": claim, "reasons": why, "numbers": nums}


def grade_cli(argv):
    dirs = [a for a in argv if not a.startswith("--") and (os.path.isdir(a))]
    rules = json.load(open(argv[argv.index("--tiers") + 1])) if "--tiers" in argv else None
    rows = []
    for d in dirs:
        mp, sp = os.path.join(d, "meta.json"), os.path.join(d, "study.json")
        if not os.path.exists(mp):
            print("refstudy grade: no meta.json in %s" % d, file=sys.stderr); continue
        meta = json.load(open(mp)); ev = grade(meta, rules)
        st = json.load(open(sp)) if os.path.exists(sp) else None
        q = (st or {}).get("quiet") or quiet_shape(((st or {}).get("audio") or {}).get("loudness_curve_4hz_dbfs"))
        rows.append({"study": os.path.basename(os.path.normpath(d)), "evidence": ev, "quiet": q})
        if "--write" in argv and st is not None:
            st["evidence"] = ev
            if q and not st.get("quiet"): st["quiet"] = q
            json.dump(st, open(sp, "w"), indent=1, ensure_ascii=False)
    if "--json" in argv:
        print(json.dumps(rows, indent=1)); return rows
    print("%-18s %-4s %9s %9s %6s %6s  %-7s %-7s %s" % ("study", "tier", "views", "v/f", "like%", "bm%", "open dB", "tail dB", "end"))
    for r in rows:
        e, n, q = r["evidence"], r["evidence"]["numbers"], r["quiet"] or {}
        fm = lambda x, f: "-" if x is None else f % x
        print("%-18s %-4s %9s %9s %6s %6s  %-7s %-7s %s" % (r["study"][:18], e["display"], fm(n["views"], "%d"), fm(n["v_per_f"], "%.2f"), fm(n["like_pct"], "%.2f"),
                                                       fm(n["bm_pct"], "%.2f"), fm(q.get("open_vs_body_db"), "%+.1f"), fm(q.get("tail_2s_vs_body_db"), "%+.1f"), q.get("end_shape", "-")))
    return rows


def transcribe(url, model):
    exe = shutil.which(WHISPER_BIN) or (WHISPER_BIN if os.path.exists(WHISPER_BIN) else None)
    if not exe:
        print("refstudy: whisper not found (set WHISPER_BIN, or pass --whisper none); skipping speech", file=sys.stderr)
        return None
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "s.wav")
        sh([FFMPEG, "-v", "error", "-y", "-i", url, "-vn", "-ac", "1", "-ar", "16000", wav])
        sh([exe, wav, "--model", model, "--language", "en", "--output_format", "json", "--output_dir", td, "--fp16", "False"])
        p = os.path.join(td, "s.json")
        if not os.path.exists(p):
            return None
        d = json.load(open(p))
    raw = d.get("segments", [])
    # Whisper hallucinates on music: drop segments it marks as probably-not-speech or low-confidence,
    # and flag the whole transcript when one text repeats across most segments.
    keep = [s for s in raw if s.get("no_speech_prob", 0) < 0.6 and s.get("avg_logprob", 0) > -1.0 and s.get("compression_ratio", 0) < 2.4]
    texts = [s["text"].strip().lower() for s in keep]
    top = max((texts.count(x) for x in set(texts)), default=0)
    hallucinated = len(texts) >= 3 and top / len(texts) > 0.5
    segs = [] if hallucinated else [{"s": round(s["start"], 2), "e": round(s["end"], 2), "text": s["text"].strip()} for s in keep]
    words = sum(len(s["text"].split()) for s in segs)
    spoken = sum(s["e"] - s["s"] for s in segs)
    return {"segments": segs, "words": words, "speech_seconds": round(spoken, 1),
            "dropped_segments": len(raw) - len(segs), "likely_music_hallucination": hallucinated,
            "words_per_min_spoken": round(words / spoken * 60, 0) if spoken else 0}


def plot(study, out):
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt, numpy as np
    a = study.get("audio", {}); p = a.get("_plot")
    fig, ax = plt.subplots(2, 1, figsize=(16, 6), sharex=True, gridspec_kw={"height_ratios": [2, 1]})
    if p:
        ax[0].plot(p["t"], p["db"], lw=0.6, color="#4A18ED"); ax[0].set_ylim(-60, 0); ax[0].set_ylabel("RMS dBFS")
        ax[1].plot(p["t"], p["low"], lw=0.6, label="low <150 Hz", color="#8A5A12")
        ax[1].plot(p["t"], p["high"], lw=0.6, label="high >4 kHz", color="#33517E"); ax[1].legend(loc="upper right", fontsize=8)
    for c in study.get("cuts", []): ax[0].axvline(c, color="#9B3A34", lw=0.8, alpha=0.7)
    for h in a.get("hits_top10pct", []): ax[0].plot([h], [-3], marker="v", color="#2F6B4F", ms=5)
    for b in a.get("beats", [])[::1]: ax[1].axvline(b, color="#999", lw=0.3, alpha=0.5)
    for s in (study.get("speech") or {}).get("segments", []): ax[0].axvspan(s["s"], s["e"], color="#E8B662", alpha=0.18)
    for e in (study.get("motion") or {}).get("events", []): ax[0].plot([e], [-57], marker="^", color="#1F6FB2", ms=4)
    ax[0].set_title("loudness (purple), cuts (red), hits (green ▼), motion events (blue ▲), speech (amber); bottom: band energy and beats (grey)", fontsize=9)
    ax[1].set_xlabel("seconds"); fig.tight_layout(); fig.savefig(out, dpi=110); plt.close(fig)


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "grade":
        grade_cli(sys.argv[2:]); return
    if len(sys.argv) < 3: raise SystemExit(__doc__)
    src, out = sys.argv[1], sys.argv[2]
    opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    wmodel = opt("--whisper") or "base"
    rules = json.load(open(opt("--tiers"))) if opt("--tiers") else None
    os.makedirs(out, exist_ok=True)
    url, meta = resolve(src)
    with tempfile.TemporaryDirectory(prefix="refstudy-") as td:
        run(fetch(url, td), meta, out, wmodel, rules, opt("--tier"))


def run(url, meta, out, wmodel, rules=None, tier=None):
    dur = meta.get("duration") or duration_of(url); meta["duration"] = dur
    study = {"meta": meta}
    study["sheet_fps"] = contact_sheet(url, dur, os.path.join(out, "sheet.jpg"))
    c = cuts(url); study["cuts"] = c
    shots = [round(b - a, 2) for a, b in zip([0] + c, c + [dur])]
    study["edit"] = {"cuts_per_min": round(len(c) / dur * 60, 1) if dur else None, "shot_len_median_s": sorted(shots)[len(shots) // 2] if shots else None,
                     "shot_len_min_s": min(shots) if shots else None, "shot_len_max_s": max(shots) if shots else None}
    lufs, tp = loudness(url); study["loudness"] = {"integrated_lufs": lufs, "peak_dbfs": tp}
    study["audio"] = audio_analysis(url, c)
    study["speech"] = None if wmodel == "none" else transcribe(url, wmodel)
    study["motion"] = motion_events(url, c)
    study["motion"]["sync"] = motion_sync(study["motion"], study["audio"].get("onsets"), study["speech"])
    study["quiet"] = quiet_shape(study["audio"].get("loudness_curve_4hz_dbfs"))
    study["evidence"] = grade(meta, rules, tier)
    plot(study, os.path.join(out, "timeline.png"))
    study["audio"].pop("_plot", None); study["motion"].pop("_curve", None)
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), indent=1, ensure_ascii=False)
    json.dump(study, open(os.path.join(out, "study.json"), "w"), indent=1, ensure_ascii=False)
    a = study["audio"]
    print(json.dumps({"dur": dur, "edit": study["edit"], "loudness": study["loudness"], "tempo": a.get("tempo_bpm_estimate"), "tempo_conf": a.get("tempo_confidence"),
                      "bands": a.get("band_share_mean"), "brightness": a.get("brightness_hz_mean"), "hits": len(a.get("hits_top10pct", [])),
                      "silences": a.get("silences"), "sync": a.get("sync"),
                      "motion": {k: study["motion"].get(k) for k in ("events_per_min", "sync")}, "quiet": study["quiet"],
                      "evidence": {k: study["evidence"][k] for k in ("display", "label", "boosted", "claim_driven", "reasons")},
                      "speech": None if not study["speech"] else {k: study["speech"][k] for k in ("words", "speech_seconds", "words_per_min_spoken")}}, indent=1))


if __name__ == "__main__":
    main()
