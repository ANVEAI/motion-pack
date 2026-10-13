#!/usr/bin/env bash
# spec-to-loop mux: (a) a single-loop MP4 with the faded loop (2 ms raised cosine on the first/last 96 samples only: AAC pads to
# 1024-sample frames, so a 6 s loop's audio runs ~16 ms past the video and a looping player would start and stop on a hard step),
# and (b) a two-loop MP4 from the seamless master (the video read twice by stream copy, the master tiled twice, no fades: the
# internal seam is sample-continuous). AAC 256k via aac_at (Apple AudioToolbox) when this ffmpeg lists it, else ffmpeg's aac.
# usage: mux.sh <video.mp4> <out_dir> [name]
#   expects <out_dir>/audio/loop_faded.wav, two_loops.wav and meta.json (from score.mjs + measure_audio.py --write)
#   env: AAC_ENCODER=aac|aac_at (force one), MIN_FREE_GIB (default 6), FFMPEG / FFPROBE / PYTHON (binaries)
# Exit status: 0 = both files written and probed, 3 = low disk, 65 = a missing input; ffmpeg failures stop the script (set -e).
set -euo pipefail
USAGE="usage: mux.sh <video.mp4> <out_dir> [name]"
V="${1:?$USAGE}"; D="${2:?$USAGE}"; A="$D/audio"
FF="${FFMPEG:-ffmpeg}"; FP="${FFPROBE:-ffprobe}"; PY="${PYTHON:-python3}"
for f in "$V" "$A/loop_faded.wav" "$A/two_loops.wav" "$A/meta.json"; do [ -f "$f" ] || { echo "missing $f" >&2; exit 65; }; done
NAME="${3:-$("$PY" -c "import json,sys;print(json.load(open(sys.argv[1])).get('name','loop'))" "$A/meta.json")}"

FREE=$(df -Pk "$D" | awk 'NR==2 {print int($4/1048576)}'); MIN="${MIN_FREE_GIB:-6}"
echo "disk free ${FREE} GiB"
[ "${FREE:-0}" -ge "$MIN" ] || { echo "under $MIN GiB free: stopping" >&2; exit 3; }

ENCODERS=$("$FF" -hide_banner -encoders 2>/dev/null || true)          # captured first: grep -q on a live pipe + pipefail misreports
if [ -n "${AAC_ENCODER:-}" ]; then AAC="$AAC_ENCODER"
elif grep -qE '^ *A[^ ]* +aac_at ' <<< "$ENCODERS"; then AAC=aac_at
else AAC=aac; fi
echo "audio encoder: $AAC"

"$FF" -y -hide_banner -loglevel error -i "$V" -i "$A/loop_faded.wav" -map 0:v -map 1:a -c:v copy -c:a "$AAC" -b:a 256k -ar 48000 -ac 2 -movflags +faststart "$D/$NAME.mp4"
"$FF" -y -hide_banner -loglevel error -stream_loop 1 -i "$V" -i "$A/two_loops.wav" -map 0:v -map 1:a -c:v copy -c:a "$AAC" -b:a 256k -ar 48000 -ac 2 -movflags +faststart "$D/$NAME-x2.mp4"

for f in "$D/$NAME.mp4" "$D/$NAME-x2.mp4"; do
  VD=$("$FP" -v error -select_streams v:0 -show_entries stream=r_frame_rate,nb_frames,duration -of default=nw=1 "$f" | tr '\n' ' ')
  AD=$("$FP" -v error -select_streams a:0 -show_entries stream=sample_rate,duration_ts,duration -of default=nw=1 "$f" | tr '\n' ' ')
  echo "$(basename "$f"): video: $VD| audio: $AD | $(wc -c < "$f" | tr -d ' ') bytes"
done
