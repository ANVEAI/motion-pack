#!/bin/bash
# motion-pack/blender cableTangle test (480p, Cycles, a few minutes). Three checks, each a measurement on the rendered PNGs, not a look:
#   1. TIMING   mode=off and mode=on render frames 30..90 (every bulb's change frame is inside) and the test finds, per bulb, the frame its
#               brightness really changes at (from render.json bulb_px: where each bulb is on screen per frame) and compares it with the plan
#               frames in render.json: off = the first frame from which the bulb stays dimmer than 95% of its lit level for 5 frames (the 2-frame
#               flicker before it recovers, so it does not count); on = the first frame from which it stays above the midpoint.
#   2. PLAN     an explicit --param schedule=... is honoured (render.json plan.change_frames, source "schedule"), and a bad order is refused.
#   3. HASHES   two separate Blender processes, Cycles on the CPU (--device cpu), the same frame: the same PNG file hash (the GPU is only visually
#               identical, DETERMINISM.md), and run.py --determinism in one process agrees.
# Writes tests/out/cable_tangle.json. Exit 1 on any failure.
#   bash blender/tests/cable_tangle.sh [--blender PATH] [--out DIR] [--samples 12]
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/tests/out/cable_tangle"
SAMPLES=12
while [ $# -gt 0 ]; do case "$1" in --blender) BLENDER="$2"; shift 2;; --out) OUT="$2"; shift 2;; --samples) SAMPLES="$2"; shift 2;; *) echo "unknown $1"; exit 2;; esac; done
for c in "${BLENDER:-}" "$(command -v blender || true)" /Applications/Blender.app/Contents/MacOS/Blender "$HOME/Applications/Blender.app/Contents/MacOS/Blender"; do
  if [ -n "$c" ] && [ -x "$c" ]; then BLENDER="$c"; break; fi; done
[ -x "${BLENDER:-}" ] || { echo "NEEDS BLENDER: set BLENDER=/path/to/Blender"; exit 2; }
FREE=$(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1048576)}'); FREE=${FREE:-999}
[ "$FREE" -ge 10 ] || { echo "disk: only ${FREE} GiB free (< 10): stop"; exit 3; }
mkdir -p "$OUT"
R() {   # name args...   (one Blender process; the log goes next to the output)
  local name="$1"; shift
  "$BLENDER" -b --factory-startup -P "$HERE/run.py" -- --recipe blender/cableTangle --size 854x480 --engine cycles --samples "$SAMPLES" \
      --out "$OUT/$name" --force --no-mp4 "$@" > "$OUT/$name.log" 2>&1 || { echo "FAIL render $name (see $OUT/$name.log)"; return 1; }
}
fail=0
echo "== timing: mode off and on, frames 30:91"
R off --frames 30:91 || fail=1
R on --frames 30:91 --param mode=on || fail=1
echo "== plan: explicit schedule, bad order"
R sched --frames 40 --param schedule=40,52,64,76,88 || fail=1
"$BLENDER" -b --factory-startup -P "$HERE/run.py" -- --recipe blender/cableTangle --size 320x180 --frames 0 --param order=sideways --out "$OUT/bad" --force --no-mp4 > "$OUT/bad.log" 2>&1
grep -q "order must be" "$OUT/bad.log" && echo "ok   bad order refused" || { echo "FAIL bad order was not refused"; fail=1; }
echo "== hashes: Cycles CPU, frame 48, two processes"
R cpu1 --frames 48 --device cpu --samples 16 --determinism 48 || fail=1
R cpu2 --frames 48 --device cpu --samples 16 || fail=1
python3 - "$OUT" "$HERE/tests/out/cable_tangle.json" <<'PY' || fail=1
import json, os, sys
import numpy as np
from PIL import Image
out, dst = sys.argv[1], sys.argv[2]
ok = True
res = {}
rj = lambda n: json.load(open(os.path.join(out, n, "render.json")))


def level_of(name, f, px, win=0.6):
    """mean 8-bit luma in a window on each bulb's glass (render.json bulb_px: x, y, radius in pixels at frame f)"""
    im = np.asarray(Image.open(os.path.join(out, name, "frames", "f%04d.png" % f)).convert("L"), float)
    o = []
    for x, y, r in px[f]:
        r = max(3, int(r * win))
        o.append(float(im[int(y) - r:int(y) + r + 1, int(x) - r:int(x) + r + 1].mean()))
    return o


for mode in ("off", "on"):
    rep = rj(mode)["recipe_report"]
    plan, px = rep["plan"]["change_frames"], rep["bulb_px"]
    fr = list(range(30, 91))
    L = {f: level_of(mode, f, px) for f in fr}
    got = []
    for b, f0 in enumerate(plan):
        v = {f: L[f][b] for f in fr}
        med = lambda a, z: float(np.median([v[f] for f in range(a, z) if f in v]))
        before = med(f0 - 6, f0 - 3)                                  # the three frames before the 2-frame flicker (f0 - 3 and f0 - 1)
        after = med(f0 + 5, f0 + 9)
        lit, dark = (before, after) if mode == "off" else (after, before)
        found = None
        for f in range(max(30, f0 - 6), min(86, f0 + 6)):
            seq = [v[g] for g in range(f, f + 5)]
            if mode == "off" and all(s < lit - 0.05 * lit for s in seq):
                found = f; break
            if mode == "on" and all(s > dark + 0.5 * (lit - dark) for s in seq):
                found = f; break
        got.append(found)
        print("%-3s bulb %d plan %3d measured %s  (lit %.1f, dark %.1f)" % (mode, b, f0, found, lit, dark))
    good = all(g == p for g, p in zip(got, plan))
    ok &= good
    res[mode] = {"plan": plan, "measured": got, "match": good}
    print("%s: %s" % (mode, "TIMING MATCH" if good else "TIMING MISMATCH"))
sc = rj("sched")["recipe_report"]["plan"]
good = sc["change_frames"] == [40, 52, 64, 76, 88] and sc["source"] == "schedule"
ok &= good; res["schedule"] = {"change_frames": sc["change_frames"], "source": sc["source"], "match": good}
print("schedule honoured:", good)
h = [json.load(open(os.path.join(out, n, "render.json")))["hashes"]["f0048"] for n in ("cpu1", "cpu2")]
d1 = rj("cpu1").get("determinism") or {}
good = h[0] == h[1] and d1.get("pixel_equal") is True
ok &= good; res["hashes"] = {"cpu_cross_process": h, "equal": h[0] == h[1], "same_process": d1}
print("cpu hashes cross-process %s (%s vs %s); same process pixel_equal=%s file_hash_equal=%s" % ("EQUAL" if h[0] == h[1] else "DIFFER", h[0], h[1], d1.get("pixel_equal"), d1.get("file_hash_equal")))
json.dump(res, open(dst, "w"), indent=1)
sys.exit(0 if ok else 1)
PY
[ $fail -eq 0 ] && echo "CABLE TANGLE PASS" || echo "CABLE TANGLE FAIL"
exit $fail
