#!/usr/bin/env python3
"""Normalise APPROVED external WAVs into the sfx catalogue format (no downloads here: it only reads files already on disk that passed check_origin.py).
usage: python3 tools/catalog_import.py SRC_DIR --category foley_ext [--out library_ext] [--dry]
For every audio file under SRC_DIR (refused outright unless tools/check_origin.py passes for it): resample to 48 kHz stereo, remove DC, trim silence (-66 dB),
1 ms / 12-40 ms edge fades, peak-normalise to -6 dBFS, write 24-bit WAV to sfx/<out>/<category>/<id>.wav and measure exactly the fields the synthesised
library has (LUFS integrated / momentary max / short-term max, true peak, centroid, crest, sub28, phone drop, anchor = loudest sample) into
sfx/<out>/manifest_ext.json with tags source:ext, licence:<id>, origin:<url>. The synthesised manifest.json is never touched; the catalog can read
manifest_ext.json separately."""
import json
import os
import sys
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpaudio import dsp, meter, phone  # noqa: E402
from mpaudio.registry import sha  # noqa: E402
import check_origin as CO  # noqa: E402

SR = dsp.SR


def normalise(y, sr):
    y = np.asarray(y, float)
    if y.ndim == 1:
        y = np.stack([y, y], 1)
    y = y[:, :2] if y.shape[1] >= 2 else np.repeat(y, 2, 1)
    if sr != SR:
        g = np.gcd(int(sr), SR)
        y = np.stack([resample_poly(y[:, c], SR // g, int(sr) // g) for c in range(2)], 1)
    y = y - y.mean(axis=0)
    env = np.max(np.abs(y), axis=1)
    pk = env.max() + 1e-12
    idx = np.nonzero(env > pk * dsp.db(-66.0))[0]
    y = y[max(0, idx[0] - dsp.ms(1.5)):idx[-1] + 1]
    y = dsp.fade_out(dsp.fade_in(y, dsp.ms(1.0)), min(len(y) // 2, dsp.ms(12)))
    return (y * (dsp.db(-6.0) / (np.max(np.abs(y)) + 1e-12))).astype(np.float32)


def describe(y, sid, cat, info):
    n = len(y)
    d = {"id": sid, "category": cat, "tags": ["source:ext", "licence:" + info["licence"], "family:" + cat] + (["attr:required"] if info["attribution"] else []),
         "origin": info["url"], "credit": info.get("credit"), "duration_s": round(n / SR, 4), "anchor_sample": int(np.argmax(np.max(np.abs(y), axis=1))),
         "peak_dbfs": round(meter.sample_peak_db(y), 2), "true_peak_dbtp": round(meter.true_peak_db(y), 2), "lufs_integrated": round(meter.lufs_integrated(y), 2),
         "lufs_m_max": round(meter.lufs_momentary_max(y), 2), "lufs_s_max": round(meter.lufs_short_max(y), 2), "centroid_hz": round(meter.centroid_hz(y)),
         "crest_db": round(meter.crest_db(y), 1), "sub28_db": round(meter.band_energy_ratio_db(y, 28.0), 1), "sha": sha(y), "loop": False, "tier": 3}
    d["anchor_ms"] = round(d["anchor_sample"] / SR * 1000, 2)
    if n >= dsp.ms(50):
        pv = phone.phone_voice(y.astype(float))
        d["phone_drop_db"] = round(meter.k_level(pv, 0, min(n, SR)) - meter.k_level(y.astype(float), 0, min(n, SR)), 1)
        d["phone_safe"] = bool(d["phone_drop_db"] > -6.0)
    return d


def main():
    a = sys.argv[1:]
    if not a or "--category" not in a:
        raise SystemExit(__doc__)
    src = a[0]
    cat = a[a.index("--category") + 1]
    out = a[a.index("--out") + 1] if "--out" in a else "library_ext"
    dry = "--dry" in a
    ok, bad = CO.scan([src])
    for p, why in bad:
        print("REFUSED", p, "; ".join(why))
    man_p = os.path.join(HERE, out, "manifest_ext.json")
    man = json.load(open(man_p)) if os.path.exists(man_p) else {"version": 1, "note": "imported, provenance-checked audio (source:ext)", "sounds": []}
    have = {d["id"] for d in man["sounds"]}
    for p, info in ok:
        y, sr = sf.read(p, always_2d=True)
        y = normalise(y, sr)
        sid = "ext.%s.%s" % (cat, os.path.splitext(os.path.basename(p))[0].lower().replace(" ", "_").replace("-", "_"))
        if sid in have:
            print("skip (exists)", sid)
            continue
        d = describe(y, sid, cat, info)
        d["file"] = os.path.join(out, cat, sid + ".wav")
        print(("would add" if dry else "add"), sid, d["lufs_integrated"], "LUFS", d["true_peak_dbtp"], "dBTP", d["centroid_hz"], "Hz")
        if not dry:
            os.makedirs(os.path.join(HERE, out, cat), exist_ok=True)
            sf.write(os.path.join(HERE, d["file"]), y, SR, subtype="PCM_24")
            man["sounds"].append(d)
    if not dry and ok:
        os.makedirs(os.path.dirname(man_p), exist_ok=True)
        json.dump(man, open(man_p, "w"), indent=1)
    sys.exit(2 if bad else 0)


if __name__ == "__main__":
    main()
