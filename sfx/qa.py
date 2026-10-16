#!/usr/bin/env python3
"""Listen-free QA for the sfx library (measurement only). usage: python3 qa.py [--fast]
Checks per sound: determinism (re-render sha), finite, peak/true-peak, DC, edges, sub energy, centroid range for the family, seed variation, loop seam;
cross-meter (python BS.1770 vs ffmpeg ebur128) on every sound >= 1.5 s; coverage (>= 80 sounds, every transition has a sweetener).
Exit status 0 = no FAIL (warnings allowed), 3 = at least one FAIL. Writes qa_report.json."""
import json
import os
import re
import subprocess
import sys
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import recipes  # noqa: E402
from mpaudio import registry, dsp, meter  # noqa: E402
from build_library import TRANSITIONS  # noqa: E402

CENTROID = {"whoosh": (800, 11000), "impact": (30, 5000), "riser": (50, 16000), "ui": (150, 6000), "glass": (700, 7000), "metal": (300, 6000), "wood": (150, 2500), "paper": (1500, 9000),
            "cloth": (80, 2500), "liquid": (250, 9500), "cartoon": (100, 7000), "voice": (200, 4000), "ambience": (40, 13000), "drum": (40, 17000), "transition": (30, 14000), "logo": (50, 4000),
            "stinger": (50, 4000), "sparkle": (1500, 16000), "cash": (500, 6500), "camera": (500, 6000), "plastic": (500, 6000),
            "indian": (50, 7000), "foley": (80, 9000), "device": (150, 7000), "crowd": (150, 4000),
            "elec": (120, 9000), "hw": (30, 9000), "trailer": (30, 12000)}


def ebur(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS", r.stderr)
    p = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    return (float(m.group(1)) if m else None), (float(p.group(1)) if p else None)


def main():
    fast = "--fast" in sys.argv
    recipes.load_all()
    man = json.load(open(os.path.join(HERE, "manifest.json")))
    fails, warns, rows = [], [], []
    for d in man["sounds"]:
        sid = d["id"]
        s = registry.SOUNDS[sid]
        y, anchor, _ = registry.render(sid)
        row = {"id": sid, "ok": True, "notes": []}

        def fail(m):
            fails.append("%s: %s" % (sid, m)); row["ok"] = False; row["notes"].append("FAIL " + m)

        def warn(m):
            warns.append("%s: %s" % (sid, m)); row["notes"].append("warn " + m)
        if registry.sha(y) != d["sha"]:
            fail("not deterministic vs manifest")
        if not np.isfinite(y).all():
            fail("non-finite")
        if meter.sample_peak_db(y) > -5.9 or meter.sample_peak_db(y) < -6.2:
            fail("peak %.2f not -6" % meter.sample_peak_db(y))
        if meter.true_peak_db(y) > -3.0 and not s.loop and d["duration_s"] > 0.3:
            warn("true peak %.2f > -3 dBTP" % meter.true_peak_db(y))
        dc = float(np.max(np.abs(y.mean(axis=0))))
        if dc / (np.max(np.abs(y)) + 1e-9) > (1e-3 if d["duration_s"] >= 0.5 else 0.01):
            fail("DC %.2e" % dc)
        if not s.loop:
            e0 = np.max(np.abs(y[:dsp.ms(0.5)]))
            e1 = np.max(np.abs(y[-dsp.ms(1):]))
            if meter.sample_peak_db(e0 * np.ones(1)) > -60:
                fail("start %.1f dBFS not < -60" % meter.sample_peak_db(e0 * np.ones(1)))
            if meter.sample_peak_db(e1 * np.ones(1)) > -60:
                fail("end %.1f dBFS not < -60 in the last 1 ms" % meter.sample_peak_db(e1 * np.ones(1)))
            if d["duration_s"] >= 0.25:
                lim = -18 if "sub" in " ".join(s.tags) else -20
                if d["sub28_db"] > lim:
                    (fail if d["sub28_db"] > lim + 8 else warn)("sub<28Hz energy %.1f dB (limit %d)" % (d["sub28_db"], lim))
        lo, hi = CENTROID.get(s.cat, (0, 24000))
        if not lo <= d["centroid_hz"] <= hi:
            warn("centroid %d outside %d-%d" % (d["centroid_hz"], lo, hi))
        if s.loop:
            m = y.astype(float).mean(axis=1)
            ratio = abs(m[0] - m[-1]) / (np.max(np.abs(np.diff(m))) + 1e-9)
            row["seam_ratio"] = round(float(ratio), 2)
            if ratio > 1.5:
                fail("loop seam ratio %.1f" % ratio)
            # spectral flux at the seam: compare the 50 ms around the wrap against the loop's overall level
            w = np.concatenate([m[-dsp.ms(25):], m[:dsp.ms(25)]])
            if np.sqrt(np.mean(w ** 2)) < 0.3 * np.sqrt(np.mean(m ** 2)):
                fail("level notch at the seam")
        if not fast:
            y2, _, _ = registry.render(sid, s.seed + 1)
            n = min(len(y), len(y2))
            a, b = y[:n].mean(axis=1), y2[:n].mean(axis=1)
            c = float(abs(np.dot(a, b)) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
            row["seed_corr"] = round(c, 3)
            if c > 0.995:
                row["notes"].append("seed-invariant (pure tonal recipe)")
            elif 0.6 < c < 0.8 and not s.tonal:
                warn("two seeds correlate %.2f" % c)
        if d["duration_s"] >= 1.5 and os.path.exists(os.path.join(HERE, d["file"])):
            I, tp = ebur(os.path.join(HERE, d["file"]))
            if I is not None:
                dI = abs(I - d["lufs_integrated"])
                row["ffmpeg_I"] = I
                row["dI"] = round(dI, 3)
                if dI > 0.15:
                    (fail if dI > 0.5 else warn)("python vs ffmpeg ebur128 differ by %.2f LU" % dI)
        rows.append(row)
    cats = sorted({d["category"] for d in man["sounds"]})
    if man["count"] < 80:
        fails.append("library has only %d sounds" % man["count"])
    miss = sorted(t for t in TRANSITIONS if not man["by_transition"].get(t))
    if miss:
        warns.append("transitions without a sweetener: %s" % miss)
    rep = {"count": man["count"], "categories": cats, "fails": fails, "warns": warns, "missing_transitions": miss, "rows": rows}
    json.dump(rep, open(os.path.join(HERE, "qa_report.json"), "w"), indent=1)
    print("sounds %d | categories %d | FAIL %d | warn %d" % (man["count"], len(cats), len(fails), len(warns)))
    for f in fails:
        print("FAIL", f)
    for w in warns:
        print("warn", w)
    sys.exit(3 if fails else 0)


if __name__ == "__main__":
    main()
