#!/bin/bash
# render a three.js (objects/kit) template end to end:  render3d.sh <template-dir> <page.html> <wide|tall> [crf]
#   1 plan + cue sheet (cues.mjs)  2 picture (tools/render.mjs, GPU-verified, 4..16 subframes)  3 SFX mix (audio.py, sfx module)
#   4 mux (AAC 192k; picture copied)  5 contact sheet + measured loudness from the DELIVERED file. Disk guard: stops under 10 GiB free.
set -e
D="$(cd "$1" && pwd)"; PAGE="$2"; A="${3:-wide}"; CRF="${4:-20}"; SH="$(cd "$(dirname "$0")" && pwd)"
df -h . | tail -1
node "$SH/cues.mjs" "$D"
SEC=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$D/out/plan.json','utf8')).seconds)")
N=$(basename "$D")
if [ "$AUDIO_ONLY" = 1 ] && [ -f "$D/out/$N-$A.mp4" ]; then ffmpeg -v error -y -i "$D/out/$N-$A.mp4" -map 0:v -c copy "$D/out/$N-$A-picture.mp4"; echo "AUDIO_ONLY: reusing the picture"   # sound-only change: keep the picture
else node "$SH/../../tools/render.mjs" "$D/$PAGE" "$D/out/$N-$A-picture.mp4" "$SEC" 30 --query "aspect=$A" --crf "$CRF" --min-free-gib 10 2>&1 | grep -E "GPU|encoded|console|error" | head -5; fi
python3 "$SH/audio.py" "$D/out/plan.json" "$D/out/$N-mix.wav"
ffmpeg -v error -y -i "$D/out/$N-$A-picture.mp4" -i "$D/out/$N-mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$D/out/$N-$A.mp4"
rm -f "$D/out/$N-$A-picture.mp4" "$D/out/$N-$A-picture.frames.json"
ls -la "$D/out/$N-$A.mp4"
TS=$(node -e "const p=JSON.parse(require('fs').readFileSync('$D/out/plan.json','utf8'));console.log(p.shots.flatMap(s=>[s.start+0.15,s.start+s.dur*0.6]).map(x=>x.toFixed(2)).join(','))")
python3 "$SH/sheet.py" "$D/out/$N-$A.mp4" "$D/out/$N-$A-sheet.jpg" "$TS"
