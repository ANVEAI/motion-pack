#!/bin/bash
# Build a HyperFrames project from the pack's modules (copies into <outdir>; the pack itself never vendors a library) and lint or render it.
# usage: layers/demo/hf/make.sh <outdir> [lint|render]
# GSAP comes from GSAP_JS, else node_modules/gsap (npm i --no-save gsap@3.14.2 in the repo root). HyperFrames runs through npx, pinned to 0.8.142.
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; OUT="$1"; MODE="${2:-lint}"
[ -n "$OUT" ] || { echo "usage: $0 <outdir> [lint|render]"; exit 64; }
GSAP="${GSAP_JS:-$ROOT/node_modules/gsap/dist/gsap.min.js}"
[ -f "$GSAP" ] || { echo "gsap.min.js not found: run 'npm i --no-save gsap@3.14.2' in $ROOT or set GSAP_JS"; exit 65; }
mkdir -p "$OUT/mp/layers" "$OUT/mp/type" "$OUT/mp/camera"
cp -R "$ROOT/layers/lib" "$ROOT/layers/presets" "$ROOT"/layers/*.js "$OUT/mp/layers/"; cp "$ROOT"/type/*.js "$OUT/mp/type/"; cp "$ROOT"/camera/*.js "$OUT/mp/camera/"
cp "$GSAP" "$OUT/gsap.min.js"; cp "$ROOT/layers/demo/hf/index.html" "$OUT/index.html"; cp "$ROOT/objects/kit/fonts/Manrope-Variable.ttf" "$OUT/Manrope-Variable.ttf"
cd "$OUT"
if [ "$MODE" = "lint" ]; then npx --yes hyperframes@0.8.142 lint . 2>&1 | tail -30; else npx --yes hyperframes@0.8.142 render . -o out.mp4 --fps 30 2>&1 | tail -30; fi
