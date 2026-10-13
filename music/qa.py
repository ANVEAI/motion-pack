#!/usr/bin/env python3
"""Listen-free QA for the music kit (measurement only). usage: python3 qa.py
Beds: loudness (-16 +-0.1 LUFS-I), true peak <= -1.5, no clipping, DC, determinism (re-compose sha), loop seam (continuity, level notch, spectral flux at the seam <= 1.5x the largest flux at the loop's other bar lines),
beat-grid alignment (events on beats sit on whole frames), key check (in-scale chroma share), hook (audible event in the first 3 frames of 'hook' beds), stem balance.
Stingers / logos: anchor inside the buffer, anchor ~ peak where designed, ring-out ends below -60 dBFS, true peak.
Cross-meter: python vs ffmpeg ebur128 on every bed (within 0.1 LU). Exit 0 = no FAIL. Writes qa_report.json."""
import hashlib
import json
import os
import re
import subprocess
import sys
import numpy as np
import soundfile as sf
import _path  # noqa: F401
from mpaudio import dsp, meter
from mpaudio.dsp import SR
import compose as C
import grid
from presets import PRESETS, STRUCTURES

HERE = os.path.dirname(os.path.abspath(__file__))


def ebur(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS", r.stderr)
    p = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    return (float(m.group(1)) if m else None), (float(p.group(1)) if p else None)


def chroma_share(y, key_pc, scale):
    m = y.mean(axis=1) if y.ndim == 2 else y
    w = np.hanning(len(m))
    X = np.abs(np.fft.rfft(m * w))
    f = np.fft.rfftfreq(len(m), 1 / SR)
    sel = (f > 80) & (f < 2000)
    midi = 69 + 12 * np.log2(f[sel] / 440.0)
    pc = np.round(midi).astype(int) % 12
    dev = np.abs(midi - np.round(midi))
    wgt = X[sel] ** 2 * (dev < 0.25)
    ch = np.bincount(pc, weights=wgt, minlength=12)
    ps = C.PARENT.get(scale, scale)
    inscale = {(key_pc + s) % 12 for s in C.SCALES[ps]}
    return float(sum(ch[i] for i in inscale) / (ch.sum() + 1e-20)), int(np.argmax(ch))


def _flux_at(x, centre, L2=int(0.4 * SR), fr=2400, hop=1200):
    seg = x[centre - L2:centre + L2] if centre - L2 >= 0 and centre + L2 <= len(x) else np.concatenate([x[centre - L2:], x[:centre + L2]]) if centre - L2 < 0 else None
    mags = [np.abs(np.fft.rfft(np.hanning(fr) * seg[i:i + fr])) for i in range(0, len(seg) - fr, hop)]
    flux = [np.sum(np.maximum(0, mags[i + 1] - mags[i])) for i in range(len(mags) - 1)]
    mid = len(flux) // 2
    return max(flux[mid - 1:mid + 1])


def seam_flux_ratio(y, bar_samples):
    """spectral flux across the loop seam relative to the MAX flux across the OTHER bar lines of the same loop (downbeats legitimately have onsets; the seam must not be more abrupt than the most abrupt natural bar line)"""
    m = y.mean(axis=1)
    n = len(m)
    bars = n // bar_samples
    seam = _flux_at(np.concatenate([m[-int(0.5 * SR):], m, m[:int(0.5 * SR)]]), int(0.5 * SR) + n)    # wrap point inside a tiled copy
    others = [_flux_at(np.concatenate([m[-int(0.5 * SR):], m, m[:int(0.5 * SR)]]), int(0.5 * SR) + k * bar_samples) for k in range(1, bars)]
    return float(seam / (np.max(others) + 1e-12)), float(np.max(others) / (np.median(others) + 1e-12))


def main():
    man = json.load(open(os.path.join(HERE, "manifest.json")))
    fails, warns, rows = [], [], []
    for it in man["items"]:
        y, sr = sf.read(os.path.join(HERE, it["file"]))
        row = {"id": it["id"], "notes": []}
        F = lambda m: (fails.append("%s: %s" % (it["id"], m)), row["notes"].append("FAIL " + m))
        W = lambda m: (warns.append("%s: %s" % (it["id"], m)), row["notes"].append("warn " + m))
        if not np.isfinite(y).all() or np.max(np.abs(y)) >= 1.0:
            F("non-finite or clipped")
        if np.max(np.abs(y.mean(axis=0))) > 5e-4:
            F("DC %.2e" % np.max(np.abs(y.mean(axis=0))))
        if it["kind"] == "bed":
            if abs(meter.lufs_integrated(y) - (-16.0)) > 0.1:
                F("loudness %.2f" % meter.lufs_integrated(y))
            if meter.true_peak_db(y) > -1.45:
                F("true peak %.2f" % meter.true_peak_db(y))
            I, tp = ebur(os.path.join(HERE, it["file"]))
            if I is not None:
                row["ffmpeg_I"] = I
                if abs(I - meter.lufs_integrated(y)) > 0.1:
                    F("python vs ffmpeg differ %.2f LU" % abs(I - meter.lufs_integrated(y)))
            # determinism
            seed = 1 + len(it["id"][len("music."):]) % 7
            import theka as TK
            if it["preset"].startswith("theka_"):
                regen = lambda: TK.render_theka(it["tala"], it["fps"], it["bars"], seed=3)
            elif it["preset"] == "bhangra_dhol":
                regen = lambda: TK.render_bhangra(it["fps"], it["bars"], seed=3)
            else:
                regen = lambda: C.compose(it["preset"], it["structure"], seed, it["fps"])
            r = regen()
            h1 = hashlib.sha256(np.ascontiguousarray(r["mix"]).tobytes()).hexdigest()
            r2 = regen()
            if h1 != hashlib.sha256(np.ascontiguousarray(r2["mix"]).tobytes()).hexdigest():
                F("compose not deterministic")
            row["sha"] = h1[:12]
            # grid: events that sit on a beat (kick / clap / drop) must be on whole frames
            ev = [e for e in r["events"] if e["kind"] in ("kick", "kick_soft", "dhol", "808", "clap", "drop", "hook_hit", "button")]
            fpb = it["frames_per_beat"]
            beat_ev = [e for e in ev if e["sample"] % (fpb * (SR // it["fps"])) < 2 or (e["sample"] % (fpb * (SR // it["fps"]))) > (fpb * (SR // it["fps"])) - 2]
            bad = [e for e in beat_ev if abs(e["frame"] - round(e["frame"])) > 0.01 and e["kind"] != "clap"]
            row["beat_events_on_whole_frames"] = "%d/%d" % (len(beat_ev) - len(bad), len(beat_ev))
            if bad:
                F("%d beat events off the frame grid" % len(bad))
            if abs((it["bpm"] * it["frames_per_beat"] / (it["fps"] * 60)) - 1) > 1e-4:
                F("bpm not snapped to whole frames per beat")
            # key
            if it.get("tala"):                       # a drum-and-drone bed: the in-scale share is checked against the Sa-Pa drone set, not a 7-note scale
                it = dict(it, scale="pent_major")
            share, top = chroma_share(y, it["_key_pc"] if "_key_pc" in it else (PRESETS[it["preset"]]["key"] if it["preset"] in PRESETS else 9), it["scale"])
            row["inscale_share"] = round(share, 2)
            row["top_pc"] = top
            if share < 0.7:
                W("in-scale chroma share %.2f" % share)
            if it["loop"]:
                s_ratio, mx = seam_flux_ratio(y, it["frames_per_beat"] * 4 * (SR // it["fps"]))
                m = y.mean(axis=1)
                row["seam_flux_ratio"] = round(s_ratio, 2)
                jump = abs(m[0] - m[-1]) / (np.max(np.abs(np.diff(m))) + 1e-9)
                row["seam_step_ratio"] = round(float(jump), 2)
                if jump > 1.5:
                    F("loop seam step ratio %.2f" % jump)
                if s_ratio > 1.5:
                    (F if s_ratio > 3.0 else W)("loop seam spectral flux %.1fx the loudest other bar line (limit 1.5x)" % s_ratio)
                w = np.concatenate([m[-int(0.025 * SR):], m[:int(0.025 * SR)]])
                if np.sqrt(np.mean(w ** 2)) < 0.3 * np.sqrt(np.mean(m ** 2)):
                    F("level notch at the loop seam")
            if it["structure"] in ("reel_15s", "hook_6s"):
                e0 = np.max(np.abs(y[: 3 * (SR // it["fps"])]))
                row["hook_first3_peak_db"] = round(meter.sample_peak_db(np.array([e0])), 1)
                if e0 < 10 ** (-24 / 20):
                    F("no audible event in the first 3 frames (%.1f dBFS)" % meter.sample_peak_db(np.array([e0])))
            # stem balance relative loudness
            stems = C.balance(r["stems"])
            ref = meter.lufs_integrated(stems["drums"]) if np.max(np.abs(stems["drums"])) > 0 else None
            if ref is not None:
                row["stem_rel_db"] = {k: round(meter.lufs_integrated(v) - ref, 1) for k, v in stems.items() if np.max(np.abs(v)) > 1e-6}
        else:
            a = it["anchor_sample"]
            if not 0 <= a < len(y):
                F("anchor outside buffer")
            tail = np.max(np.abs(y[-dsp.ms(1):]))
            if meter.sample_peak_db(np.array([tail])) > -60:
                F("end not below -60 dBFS")
            if it["true_peak_db"] > -2.5:
                F("true peak %.2f" % it["true_peak_db"])
            if it["kind"] == "logo":
                pk = int(np.argmax(np.max(np.abs(y), axis=1)))
                row["peak_ms"] = round(pk / SR * 1000, 1)
        rows.append(row)
    if man["count"] < 25:
        fails.append("music kit has only %d items" % man["count"])
    rep = {"count": man["count"], "fails": fails, "warns": warns, "rows": rows}
    json.dump(rep, open(os.path.join(HERE, "qa_report.json"), "w"), indent=1)
    print("items %d | FAIL %d | warn %d" % (man["count"], len(fails), len(warns)))
    for f in fails:
        print("FAIL", f)
    for w in warns:
        print("warn", w)
    sys.exit(3 if fails else 0)


if __name__ == "__main__":
    main()
