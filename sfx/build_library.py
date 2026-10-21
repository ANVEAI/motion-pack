#!/usr/bin/env python3
"""Render the whole sfx library: sfx/library/<category>/<id>.wav (48 kHz, 24-bit, stereo, peak-normalised -6 dBFS) + sfx/manifest.json.
usage:  python3 build_library.py [--only substring] [--no-wav]
Deterministic: same code + seeds => same samples (the manifest stores a SHA-256 prefix of every float32 buffer)."""
import json
import os
import sys
import time
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import recipes  # noqa: E402
from mpaudio import registry, dsp  # noqa: E402

TRANSITIONS = {"hardCut", "whip", "flash", "glitch", "scalePunch", "dissolve", "dipToBlack", "push", "blurCross", "freezeHold", "lightLeak", "filmBurn", "zoomThrough", "maskReveal",
               "iris", "lumaWipe", "match", "morph", "ink", "speedRamp", "smash", "jcut",
               "shutter", "swipeUp", "spin", "pagePeel", "pixelSort", "dip"}
PAIR_MAP = {"cut": "hardCut", "hardcut": "hardCut", "punchIn": "scalePunch", "shatter": "smash", "slide": "push", "pageTurn": "maskReveal", "reveal": "maskReveal", "smoke": "dissolve"}
# suggested level over the bed (K-weighted, 60 ms from the anchor) by class: house rules of docs/evidence/sound.md section 3
OVER_BED = {"impact": 4.5, "logo": 5.0, "stinger": 4.5, "whoosh": 2.0, "riser": 4.0, "ui": 4.0, "glass": 3.0, "metal": 3.0, "wood": 3.0, "paper": 3.0, "cloth": 2.0, "plastic": 3.0,
            "camera": 3.0, "cash": 3.5, "sparkle": 3.0, "liquid": 3.0, "cartoon": 4.0, "voice": 3.0, "drum": 4.0, "transition": 2.5, "ambience": None,
            "indian": 3.5, "foley": 3.0, "device": 4.0, "crowd": 2.0, "elec": 3.5, "hw": 4.0, "trailer": 4.5}
BED_LOOPS = {"ambience", "elec", "hw", "trailer"}          # categories whose LOOPS are beds-under-the-bed (elec: the crackle loop), not featured cues like ui.agent_working


def build(only=None, write_wav=True):
    recipes.load_all()
    out = []
    t0 = time.time()
    for sid in sorted(registry.SOUNDS):
        if only and only not in sid:
            continue
        y, anchor, s = registry.render(sid)
        d = registry.describe(y, anchor, s)
        pairs = []
        roles = []
        for p in d.pop("pairs_with"):
            p = PAIR_MAP.get(p, p)
            (pairs if p in TRANSITIONS else roles).append(p)
        d["pairs_with"] = sorted(set(pairs))
        d["roles"] = sorted(set(roles))
        d["anchor_frame_offset"] = -1 if "anchor:end" in s.tags and s.cat == "riser" and s.id.startswith("snd.riser") else 0
        d["place_rule"] = ("riser end lands ONE FRAME BEFORE the hit anchor; the hit itself lands on visual frame + 1" if d["anchor_frame_offset"] else
                           ("loop: starts at the cue frame and loops/crossfades" if s.loop else "anchor sample lands on (visual frame + 1) x SR / fps"))
        d["over_bed_db"] = None if (s.loop and s.cat in BED_LOOPS) else OVER_BED.get(s.cat)   # None = the mixer sits the loop 10 dB under the bed
        rel = os.path.join("library", s.cat, sid + ".wav")
        d["file"] = rel
        if write_wav:
            os.makedirs(os.path.join(HERE, "library", s.cat), exist_ok=True)
            sf.write(os.path.join(HERE, rel), y, dsp.SR, subtype="PCM_24")
        out.append(d)
    by_tx = {}
    by_tag = {}
    from mpaudio import sweeteners as SW          # every sweetener row counts as a pairing, so by_transition covers every kind the mixer can sweeten
    ids = {d["id"] for d in out}
    for kind, rows in SW.TABLE.items():
        for r in rows:
            if r[0] in ids:
                by_tx.setdefault(kind, []).append(r[0])
    for d in out:
        for p in d["pairs_with"]:
            if d["id"] not in by_tx.get(p, []):
                by_tx.setdefault(p, []).append(d["id"])
        for tg in d["tags"]:
            by_tag.setdefault(tg, []).append(d["id"])
    man = {"version": 1, "sample_rate": dsp.SR, "bit_depth": 24, "peak_dbfs_target": -6.0, "count": len(out), "built_s": round(time.time() - t0, 1),
           "notes": "All sounds synthesised in code (numpy/scipy). Library level is peak -6 dBFS; real levels are set by the mixer (over-bed rules). anchor_sample = the sample that must land on (visual frame + 1) x SR/fps.",
           "sounds": out, "by_transition": {k: sorted(v) for k, v in sorted(by_tx.items())}, "by_tag": {k: v for k, v in sorted(by_tag.items())}}
    if not only:
        json.dump({k: v for k, v in man.items() if k != "built_s"}, open(os.path.join(HERE, "manifest.json"), "w"), indent=1)   # no wall-clock field: a rebuild leaves the manifest byte-identical
    return man


if __name__ == "__main__":
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]
    m = build(only, "--no-wav" not in sys.argv)
    print("rendered", m["count"], "sounds in", m["built_s"], "s")
