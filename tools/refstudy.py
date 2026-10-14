#!/usr/bin/env python3
"""refstudy: measure a reference video's picture, edit and sound, so a person or an agent can learn its craft.

Usage:
  refstudy.py <x-status-url | mp4-url | file.mp4> <out_dir> [--whisper base|small|none]

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

Nothing here listens like a person. Treat tempo and hits as hints and check them against the frames.
The video is streamed for analysis; only the stills and a temporary mono WAV are written, and the WAV is deleted.

Environment:
  FFMPEG       the ffmpeg binary (default: `ffmpeg` on PATH)
  WHISPER_BIN  the openai-whisper CLI used for --whisper base|small (default: `whisper` on PATH); --whisper none skips speech
Python deps: numpy and matplotlib only. A post URL is fetched over the network; a local file needs none.
Learning from a reference is craft, not copying: see skills/motion-pack/references/reference-intake.md.
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

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
    ax[0].set_title("loudness (purple), cuts (red), hits (green ▼), speech (amber); bottom: band energy and beats (grey)", fontsize=9)
    ax[1].set_xlabel("seconds"); fig.tight_layout(); fig.savefig(out, dpi=110); plt.close(fig)


def main():
    if len(sys.argv) < 3: raise SystemExit(__doc__)
    src, out = sys.argv[1], sys.argv[2]
    wmodel = sys.argv[sys.argv.index("--whisper") + 1] if "--whisper" in sys.argv else "base"
    os.makedirs(out, exist_ok=True)
    url, meta = resolve(src)
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
    plot(study, os.path.join(out, "timeline.png"))
    study["audio"].pop("_plot", None)
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"), indent=1, ensure_ascii=False)
    json.dump(study, open(os.path.join(out, "study.json"), "w"), indent=1, ensure_ascii=False)
    a = study["audio"]
    print(json.dumps({"dur": dur, "edit": study["edit"], "loudness": study["loudness"], "tempo": a.get("tempo_bpm_estimate"), "tempo_conf": a.get("tempo_confidence"),
                      "bands": a.get("band_share_mean"), "brightness": a.get("brightness_hz_mean"), "hits": len(a.get("hits_top10pct", [])),
                      "silences": a.get("silences"), "sync": a.get("sync"),
                      "speech": None if not study["speech"] else {k: study["speech"][k] for k in ("words", "speech_seconds", "words_per_min_spoken")}}, indent=1))


if __name__ == "__main__":
    main()
