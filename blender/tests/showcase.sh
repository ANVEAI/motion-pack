#!/bin/bash
# motion-pack/blender showcase plate set (1920x1080 + 1080x1920, 30 fps, EEVEE plates), the set previewed in blender/previews/.
# One GPU render at a time; stops when free disk < 10 GiB; each plate in its own folder with render.json.
#   bash blender/tests/showcase.sh [OUT_DIR] [only-id-substring]
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$HERE/../showcase}"; ONLY="${2:-}"
B="${BLENDER:-$(command -v blender || echo /Applications/Blender.app/Contents/MacOS/Blender)}"
BEATS="$HERE/../music/library/beds/bed_tech_pulse_loop8.json"   # beat-grid sidecar: python3 music/build_music.py
TO=$(command -v timeout || echo "")
plate() {   # name args...
  local name="$1"; shift
  [ -n "$ONLY" ] && [[ "$name" != *"$ONLY"* ]] && return 0
  local FREE=$(df -Pk . | awk 'NR==2{print int($4/1048576)}')
  if [ "$FREE" -lt 10 ]; then echo "STOP disk ${FREE} GiB free"; exit 3; fi
  mkdir -p "$OUT/$name"
  echo "== $name $(date +%H:%M:%S) free=${FREE}GiB"
  ${TO:+$TO 3600} "$B" -b --factory-startup -P "$HERE/run.py" -- --out "$OUT/$name" --force "$@" > "$OUT/$name/log.txt" 2>&1
  grep -E "MPB_DONE|Traceback|Error" "$OUT/$name/log.txt" | tail -3
}
plate 01-turntable-16x9   --recipe blender/turntable --preset matte-copper --size 1920x1080 --seconds 6 --exposure 0.25 --post lens
plate 02-macro-16x9       --recipe blender/macroSweep --preset matte-copper --size 1920x1080 --seconds 4 --post lens
plate 03-explode-16x9     --recipe blender/explode --preset matte-copper --size 1920x1080 --seconds 5 --exposure 0.25 --post lens
plate 04-title-16x9       --recipe blender/title3d --size 1920x1080 --seconds 4 --param text=motion-pack --post lens
plate 05-liquid-16x9      --recipe blender/art.liquidChrome --size 1920x1080 --seconds 4 --post lens --loop-check
plate 06-voxel-16x9       --recipe blender/art.voxelWave --size 1920x1080 --seconds 4 --beats "$BEATS" --post lens --loop-check
plate 07-turntable-9x16   --recipe blender/turntable --preset matte-copper --size 1080x1920 --seconds 6 --exposure 0.25 --post lens
plate 08-title-9x16       --recipe blender/title3d --size 1080x1920 --seconds 4 --param text=motion-pack --post lens
echo "SHOWCASE DONE $(date +%H:%M:%S)"
