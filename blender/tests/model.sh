#!/bin/bash
# blender/tests/model.sh (xp-hardware): YOUR model in the studio recipes. Exports the pack's own procedural device as a GLB (export_device_glb.py), then renders
# 3 frames at 480p of blender/turntable, blender/macroSweep and blender/explode with --param model=<that GLB>; each must finish, write 3 frames and differ
# between its first and last frame (the turn / the sweep / the explode moved). Runs through $MP_RENDER_PREFIX when set (an optional render-lock wrapper, as in tools/mp.mjs).
#   bash blender/tests/model.sh [--blender PATH]
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$HERE/tests/out/model"; mkdir -p "$OUT"
while [ $# -gt 0 ]; do case "$1" in --blender) BLENDER="$2"; shift 2;; *) echo "unknown $1"; exit 2;; esac; done
for c in "${BLENDER:-}" "$(command -v blender || true)" /Applications/Blender.app/Contents/MacOS/Blender "$HOME/Applications/Blender.app/Contents/MacOS/Blender" "$HOME/Developer/tools/Blender.app/Contents/MacOS/Blender"; do
  if [ -n "$c" ] && [ -x "$c" ]; then BLENDER="$c"; break; fi; done
[ -x "${BLENDER:-}" ] || { echo "NEEDS BLENDER"; exit 2; }
LOCK="${MP_RENDER_PREFIX:-}"
GLB="$OUT/device.glb"; fail=0
$LOCK "$BLENDER" -b --factory-startup -P "$HERE/tests/export_device_glb.py" -- "$GLB" > "$OUT/export.log" 2>&1 || { echo "FAIL export (see $OUT/export.log)"; exit 1; }
for id in blender/turntable blender/macroSweep blender/explode; do
  d="$OUT/${id//\//-}"; mkdir -p "$d"
  $LOCK "$BLENDER" -b --factory-startup -P "$HERE/run.py" -- --recipe "$id" --size 854x480 --engine eevee --samples 8 --frames smoke --out "$d" --force --param model="$GLB" --param model_size=0.3 > "$d/log.txt" 2>&1
  n=$(ls "$d/frames" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n" -lt 3 ] || grep -q "Traceback" "$d/log.txt" || ! grep -q MPB_DONE "$d/log.txt"; then echo "FAIL $id (see $d/log.txt)"; grep -A4 Traceback "$d/log.txt" | head; fail=1; continue; fi
  first=$(ls "$d/frames" | head -1); last=$(ls "$d/frames" | tail -1)
  if cmp -s "$d/frames/$first" "$d/frames/$last"; then echo "FAIL $id: first and last frame identical (nothing moved)"; fail=1; else echo "ok   $id with your model: $n frames"; fi
done
exit $fail
