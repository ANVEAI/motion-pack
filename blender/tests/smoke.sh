#!/bin/bash
# motion-pack/blender smoke test: py_compile on every file, then 3 frames (first, middle, last) at 480p per recipe in
# EEVEE, plus two Cycles recipes (turntable, cableTangle), plus the post tools. Exit 1 on any failure.
#   bash blender/tests/smoke.sh [--blender PATH] [--out DIR]
# Blender: --blender > $BLENDER > blender on PATH > /Applications > ~/Applications.
set -u
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/tests/out"
while [ $# -gt 0 ]; do case "$1" in --blender) BLENDER="$2"; shift 2;; --out) OUT="$2"; shift 2;; *) echo "unknown $1"; exit 2;; esac; done
for c in "${BLENDER:-}" "$(command -v blender || true)" /Applications/Blender.app/Contents/MacOS/Blender "$HOME/Applications/Blender.app/Contents/MacOS/Blender"; do
  if [ -n "$c" ] && [ -x "$c" ]; then BLENDER="$c"; break; fi; done
[ -x "${BLENDER:-}" ] || { echo "NEEDS BLENDER: set BLENDER=/path/to/Blender"; exit 2; }
FREE=$(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1048576)}'); FREE=${FREE:-999}
[ "$FREE" -ge 10 ] || { echo "disk: only ${FREE} GiB free (< 10): stop"; exit 3; }
TO=$(command -v timeout || command -v gtimeout || echo "")
fail=0
echo "== py_compile"
while IFS= read -r f; do python3 -m py_compile "$f" || { echo "FAIL compile $f"; fail=1; }; done < <(find "$HERE" -name "*.py" -not -path "*/.cache/*" -not -path "*/tests/out/*")
run() {   # id engine extra...
  local id="$1" eng="$2"; shift 2
  local d="$OUT/${id//\//-}-$eng${SUFFIX:+-$SUFFIX}"; mkdir -p "$d"
  local t0=$(date +%s)
  ${TO:+$TO 900} "$BLENDER" -b --factory-startup -P "$HERE/run.py" -- --recipe "$id" --size 854x480 --engine "$eng" \
      --samples 8 --frames smoke --out "$d" --force "$@" > "$d/log.txt" 2>&1
  local rc=$?
  local n=$(ls "$d/frames" 2>/dev/null | wc -l | tr -d ' ')
  local ok=$(grep -c "MPB_DONE" "$d/log.txt")
  if [ $rc -ne 0 ] || [ "$n" -lt 3 ] || [ "$ok" -lt 1 ] || grep -q "Traceback" "$d/log.txt"; then
    echo "FAIL $id ($eng) rc=$rc frames=$n  (see $d/log.txt)"; grep -A3 "Traceback\|Error" "$d/log.txt" | head -12; fail=1
  else echo "ok   $id ($eng) frames=$n $(( $(date +%s) - t0 ))s"; fi
}
echo "== recipes (EEVEE, 854x480, 3 frames each)"
for id in blender/turntable blender/macroSweep blender/explode blender/title3d blender/art.liquidChrome blender/art.voxelWave blender/art.particleSwirl \
          blender/passReveal blender/knolling blender/cloudFlight blender/diorama; do
  run "$id" eevee
done
BEATS="$HERE/../music/library/beds/bed_tech_pulse_loop8.json"                    # inside the pack
[ -f "$BEATS" ] || BEATS="$HOME/Developer/motion-pack/music/library/beds/bed_tech_pulse_loop8.json"   # staging
[ -f "$BEATS" ] && SUFFIX=beats run blender/art.voxelWave eevee --beats "$BEATS" --param beat_gain=1.2
for ps in xray clay; do SUFFIX=$ps run blender/passReveal eevee --param pass=$ps; done                # one-pass plates
for sc in campfire island; do SUFFIX=$sc run blender/diorama eevee --param scene=$sc; done              # the other two vignettes
echo "== Cycles (key-art path)"
run blender/turntable cycles
run blender/cableTangle cycles                                                                     # the metaphor plate is a Cycles recipe (transparent glass, point-light bulbs)
echo "== post tools"
python3 "$HERE/tools/post.py" compare "$OUT/blender-turntable-eevee/frames/f0000.png" "$OUT/blender-turntable-eevee/frames/f0000.png" | grep -q '"pixel_equal": true' \
  && echo "ok   post.py compare" || { echo "FAIL post.py compare"; fail=1; }
[ $fail -eq 0 ] && echo "SMOKE PASS" || echo "SMOKE FAIL"
exit $fail
