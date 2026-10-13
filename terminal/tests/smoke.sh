#!/usr/bin/env bash
# motion-pack / terminal / tests / smoke.sh
# Bakes the same 1 s plate twice and checks: the frame count, the bt709 tags, and that both bakes are byte-identical (G1).
# Needs the binary from terminal/fetch-cbirds.sh (or --cbirds PATH). Writes only under terminal/tests/out/ (gitignored).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; OUT="$HERE/out"; mkdir -p "$OUT"
EXTRA=(); [ "${1:-}" = --cbirds ] && EXTRA=(--cbirds "$2")
for r in a b; do
  bash "$HERE/../bake-plate.sh" ${EXTRA[@]+"${EXTRA[@]}"} --out "$OUT/smoke-$r.mp4" --seed 7 --seconds 1 --aspect 1:1 --skip 3.5 \
    -- -n 300 -s 30 --color ember --hawks 1 --shape arrow > "$OUT/smoke-$r.log"
done
if command -v sha256sum >/dev/null 2>&1; then SHA() { sha256sum "$1" | cut -d' ' -f1; }; else SHA() { shasum -a 256 "$1" | cut -d' ' -f1; }; fi
fail=0
n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/smoke-a.mp4")
[ "$n" = 30 ] && echo "ok    30 frames" || { echo "FAIL  frame count $n (want 30)"; fail=1; }
tags=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_space,color_transfer,color_primaries -of csv=p=0 "$OUT/smoke-a.mp4")
[ "$tags" = "bt709,bt709,bt709" ] && echo "ok    bt709 tags" || { echo "FAIL  colour tags $tags"; fail=1; }
for x in gif mp4; do
  if [ "$(SHA "$OUT/smoke-a.$x")" = "$(SHA "$OUT/smoke-b.$x")" ]; then echo "ok    two bakes, identical $x"; else echo "FAIL  two bakes differ ($x)"; fail=1; fi
done
[ "$fail" = 0 ] && echo "ALL PASS" || { echo "SMOKE FAILED"; exit 1; }
