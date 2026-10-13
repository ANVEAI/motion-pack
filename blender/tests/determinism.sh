#!/bin/bash
# motion-pack/blender determinism test. For each case: render frame F in two SEPARATE Blender processes and compare
# (file hash, then pixels / PSNR), and inside one process (render F, render another frame, render F again: run.py
# --determinism). Writes tests/out/determinism.json. One GPU job at a time.
#   bash blender/tests/determinism.sh [--blender PATH] [--size 960x540]
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/tests/out/determinism"
SIZE=960x540
while [ $# -gt 0 ]; do case "$1" in --blender) BLENDER="$2"; shift 2;; --size) SIZE="$2"; shift 2;; *) echo "unknown $1"; exit 2;; esac; done
for c in "${BLENDER:-}" "$(command -v blender || true)" /Applications/Blender.app/Contents/MacOS/Blender "$HOME/Applications/Blender.app/Contents/MacOS/Blender"; do
  if [ -n "$c" ] && [ -x "$c" ]; then BLENDER="$c"; break; fi; done
[ -x "${BLENDER:-}" ] || { echo "NEEDS BLENDER"; exit 2; }
mkdir -p "$OUT"
RES="$OUT/results.jsonl"; [ -n "${ONLY:-}" ] || : > "$RES"
case_run() {   # name frame args...   (ONLY=a,b runs a subset)
  local name="$1" f="$2"; shift 2
  if [ -n "${ONLY:-}" ] && [[ ",$ONLY," != *",$name,"* ]]; then return 0; fi
  for k in 1 2; do
    "$BLENDER" -b --factory-startup -P "$HERE/run.py" -- --size "$SIZE" --frames "$f" --out "$OUT/$name-p$k" --force --no-mp4 \
      $( [ $k = 1 ] && echo "--determinism $f" ) "$@" > "$OUT/$name-p$k.log" 2>&1
  done
  local A="$OUT/$name-p1/frames/f$(printf %04d "$f").png" B="$OUT/$name-p2/frames/f$(printf %04d "$f").png"
  local X=$(python3 "$HERE/tools/post.py" compare "$A" "$B")
  local IN=$(python3 -c "import json;d=json.load(open('$OUT/$name-p1/render.json'));print(json.dumps(d.get('determinism')))")
  echo "{\"case\": \"$name\", \"frame\": $f, \"cross_process\": $X, \"same_process\": $IN}" | tee -a "$RES"
}
case_run eevee-turntable   90 --recipe blender/turntable --engine eevee --samples 32
case_run eevee-title       100 --recipe blender/title3d --engine eevee --samples 32
case_run eevee-voxel       30 --recipe blender/art.voxelWave --engine eevee --samples 32
case_run cycles-gpu-cpu-oidn 90 --recipe blender/turntable --engine cycles --samples 128
case_run cycles-gpu-gpu-oidn 90 --recipe blender/turntable --engine cycles --samples 128 --denoise-gpu
# isolating cases: the title without its alpha-blended halo card; Cycles GPU path tracing with no denoiser
case_run eevee-title-noglow 100 --recipe blender/title3d --engine eevee --samples 32 --param glow=0
case_run cycles-gpu-raw      90 --recipe blender/turntable --engine cycles --samples 128 --no-denoise
python3 - "$RES" "$OUT/../determinism.json" <<'PY'
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
json.dump(rows, open(sys.argv[2], "w"), indent=1)
for r in rows:
    c, s = r["cross_process"], r["same_process"] or {}
    print("%-22s cross-process: equal=%s psnr=%s | same-process: equal=%s psnr=%s" % (
        r["case"], c.get("pixel_equal"), c.get("psnr_db"), s.get("pixel_equal"), s.get("psnr_db")))
PY
