#!/usr/bin/env bash
# motion-pack / transitions / tools / demos.sh
# Render the 2 s demo (A->B cut on t=0.5, B->A cut on t=1.5) + 3 QA stills + the determinism/seam QA for each transition.
# usage: tools/demos.sh [key ...]        (no keys = every key in lib/registry.js)
#        TALL=1 tools/demos.sh whip       (9:16 540x960 variant, files suffixed _9x16)
#        STILLS_ONLY=1 tools/demos.sh     (only the 3 stills, no mp4/QA: fast look pass)
# Uses tools/render.mjs (GPU-verified, disk-guarded). Stops under 10 GiB free.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; R="$HERE/../tools/render.mjs"
cd "$HERE"
KEYS=("$@"); if [ ${#KEYS[@]} -eq 0 ]; then KEYS=($(node -e "import('./lib/registry.js').then(m=>console.log(m.KEYS.join(' ')))")); fi
if [ "${TALL:-0}" = 1 ]; then W=540; H=960; SFX=_9x16; else W=960; H=540; SFX=""; fi
for k in "${KEYS[@]}"; do
  free=$(df -k . | tail -1 | awk '{print int($4/1048576)}')
  if [ "$free" -lt 10 ]; then echo "STOP: under 10 GiB free ($free)"; exit 3; fi
  # stills: a quarter before the cut, the cut, a quarter after (frames at 30 fps; the cut is on frame 15)
  S=$(node -e "import('./lib/registry.js').then(m=>{const e=m.REGISTRY['$k'],d=Math.min(0.9,e.timing.ms/1000)*30,c=e.timing.cut;console.log([Math.min(13,Math.round(15-c*d*0.5)),15,Math.max(17,Math.round(15+(1-c)*d*0.5))].join(','))})")
  [ "$k" = speedRamp ] && S="24,30,36"
  Q="tx=$k&w=$W&h=$H"
  TRASH="$HOME/.Trash/motion-pack-scratch-$(date +%F)"; mkdir -p "$TRASH"
  if [ -d "renders/stills/$k$SFX" ]; then mv "renders/stills/$k$SFX" "$TRASH/stills-$k$SFX-$(date +%s)"; fi   # stale stills from earlier frame choices (moved, never deleted)
  if [ "${STILLS_ONLY:-0}" = 1 ]; then
    node "$R" demo.html renders/_tmp.mp4 0 0 --stills-only --stills "$S" --stills-dir "renders/stills/$k$SFX" --query "$Q" --min-free-gib 10 | tail -1
    continue
  fi
  node "$R" demo.html "renders/$k$SFX.mp4" 2 30 --stills "$S" --stills-dir "renders/stills/$k$SFX" --query "$Q" --crf 22 --min-free-gib 10 | grep -E "encoded|console" || true
  node "$R" demo.html --qa "renders/qa/$k$SFX.json" --query "$Q" --min-free-gib 10 > /dev/null || echo "QA FAIL $k$SFX"
  if [ -f "renders/$k$SFX.frames.json" ]; then mv "renders/$k$SFX.frames.json" "$TRASH/$k$SFX.frames-$(date +%s).json"; fi
done
