#!/bin/bash
# render a three.js (objects/kit) template end to end:  render3d.sh <template-dir> <page.html> <wide|tall> [crf]
#   1 plan + cue sheet (cues.mjs)  2 picture (tools/render.mjs, GPU-verified, 4..16 subframes)  3 SFX mix (audio.py, sfx module)
#   4 mux (AAC 192k; picture copied)  5 contact sheet + measured loudness from the DELIVERED file. Disk guard: stops under 10 GiB free.
set -e -o pipefail
D="$(cd "$1" && pwd)"; PAGE="$2"; A="${3:-wide}"; CRF="${4:-20}"; SH="$(cd "$(dirname "$0")" && pwd)"
# prerequisites first (puppeteer-core + Chrome): a missing one used to be swallowed by the log filter below and surface later as an ffmpeg 'No such file'
if [ "$AUDIO_ONLY" != 1 ]; then node "$SH/../../tools/chrome.mjs" --check >/dev/null || exit 1; fi
df -h . | tail -1
node "$SH/cues.mjs" "$D"
SEC=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$D/out/plan.json','utf8')).seconds)")
N=$(basename "$D")
if [ "$AUDIO_ONLY" = 1 ] && [ -f "$D/out/$N-$A.mp4" ]; then ffmpeg -v error -y -i "$D/out/$N-$A.mp4" -map 0:v -c copy "$D/out/$N-$A-picture.mp4"; echo "AUDIO_ONLY: reusing the picture"   # sound-only change: keep the picture
else LOG="$D/out/render-$A.log"   # the full renderer log (gitignored); the console shows the key lines, and the whole tail when the render fails
  if node "$SH/../../tools/render.mjs" "$D/$PAGE" "$D/out/$N-$A-picture.mp4" "$SEC" 30 --query "aspect=$A" --crf "$CRF" --min-free-gib 10 > "$LOG" 2>&1; then grep -Ei "gpu|encoded|console|error|warn" "$LOG" | head -5 || true
  else echo "render failed (tools/render.mjs exit $?); last lines of $LOG:" >&2; tail -20 "$LOG" >&2; exit 1; fi; fi
python3 "$SH/audio.py" "$D/out/plan.json" "$D/out/$N-mix.wav"
ffmpeg -v error -y -i "$D/out/$N-$A-picture.mp4" -i "$D/out/$N-mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$D/out/$N-$A.mp4"
rm -f "$D/out/$N-$A-picture.mp4" "$D/out/$N-$A-picture.frames.json"
ls -la "$D/out/$N-$A.mp4"
TS=$(node -e "const p=JSON.parse(require('fs').readFileSync('$D/out/plan.json','utf8'));console.log(p.shots.flatMap(s=>[s.start+0.15,s.start+s.dur*0.6]).map(x=>x.toFixed(2)).join(','))")
python3 "$SH/sheet.py" "$D/out/$N-$A.mp4" "$D/out/$N-$A-sheet.jpg" "$TS"
