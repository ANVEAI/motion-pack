#!/usr/bin/env bash
# Parity test of tx-three.js against tx-gl.js using a three.js build already on disk (no download).
# usage: THREE_BUILD=/path/to/node_modules/three/build tools/three-parity.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; TB="${THREE_BUILD:?set THREE_BUILD to a local three/build folder}"
T="$(mktemp -d "${TMPDIR:-/tmp}/mp-three.XXXXXX")"; ln -s "$HERE/lib" "$T/lib"; ln -s "$TB" "$T/three"; cp "$HERE/tests/three-parity.html" "$T/index.html"
OUT="$(node "$HERE/../tools/render.mjs" "$T/index.html" "$T/x.mp4" 0 0 --stills-only --stills 0 --stills-dir "$T/s" --allow-software 2>&1 || true)"
rm -rf "$T"
echo "$OUT" | grep -E "PARITY|page error" | sed 's/ \([a-zA-Z]*@0:\)/\n  \1/g'
echo "$OUT" | grep -q "page error" && exit 1
echo "$OUT" | grep -q "PARITY" || exit 1
