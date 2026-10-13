#!/usr/bin/env bash
# motion-pack / terminal / bake-plate.sh
# Bake a cbirds flock into a frame-exact video plate: cbirds' headless recorder (fixed step, own seeded PRNG) -> GIF -> 30 fps H.264.
#
#   terminal/bake-plate.sh --out DIR/name.mp4 --seed N [--seconds 10] [--aspect 9:16|16:9|1:1] [--skip S]
#                          [--ground keep|black] [--png DIR] [--crf 14] [--cbirds PATH] -- <cbirds look options>
#
#   terminal/bake-plate.sh --out plates/ice.mp4   --seed 33 --skip 3.5 -- -n 900 -s 34 --color ice --hawks 2
#   terminal/bake-plate.sh --out plates/title.mp4 --seed 5             -- -n 900 --say "ORBIT" --color prism
#   terminal/bake-plate.sh --out plates/dusk.mp4  --seed 45 --aspect 16:9 -- --3d --color dusk --hawks 1
#   terminal/bake-plate.sh --out plates/code.mp4  --seed 5  --seconds 30  -- --text path/to/snippet.txt
#
# Why it is frame-exact (measured in the motion-stack lab, lane e-terminal):
#   - `cbirds --record` steps the simulation on the GIF's own clock (delay 3/100 s = 33.33 steps a second), never the wall
#     clock, and seeds its own PRNG; the same command gives the same GIF bytes, run after run and build after build.
#   - Every recorded frame becomes exactly one plate frame (trim, then setpts=N/30/TB): plate frame n is simulation frame
#     skip+n, nothing dropped or doubled. The flock therefore plays at 0.9x cbirds' own pace; pick --speed to taste.
#   - x264 runs on one thread, so the same inputs give the same MP4 bytes.
# --skip S drops the first S seconds of simulation: a plain flock (no --say/--clock/--picture/--text/--3d) opens by writing
#   the word BOIDS for 3 s; --skip 3.5 starts the plate after it.
# --ground black maps cbirds' picture ground (18,18,24) to pure black, so the plate can go over footage with a screen blend.
# Writes <out>, <out%.mp4>.gif (the lossless master), <out%.mp4>.json (inputs, pin, frame map, SHA-256s); --png DIR also
# writes the plate as lossless PNGs. Needs: the cbirds binary from terminal/fetch-cbirds.sh, ffmpeg with libx264, awk.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
CBIRDS="${MP_EXTERNAL:-$REPO/external}/cbirds/bin/cbirds"
OUT=""; SEED=""; SECONDS_OUT=10; ASPECT=9:16; SKIP=0; GROUND=keep; PNG=""; CRF=14
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="$2"; shift 2 ;;
    --seed) SEED="$2"; shift 2 ;;
    --seconds) SECONDS_OUT="$2"; shift 2 ;;
    --aspect) ASPECT="$2"; shift 2 ;;
    --skip) SKIP="$2"; shift 2 ;;
    --ground) GROUND="$2"; shift 2 ;;
    --png) PNG="$2"; shift 2 ;;
    --crf) CRF="$2"; shift 2 ;;
    --cbirds) CBIRDS="$2"; shift 2 ;;
    --) shift; break ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "unknown option: $1 (cbirds options go after --)" >&2; exit 64 ;;
  esac
done
LOOK=("$@")
[ -n "$OUT" ] && [ -n "$SEED" ] || { echo "usage: bake-plate.sh --out FILE.mp4 --seed N [...] -- <cbirds options>" >&2; exit 64; }
[ -x "$CBIRDS" ] || { echo "no cbirds binary at $CBIRDS: run terminal/fetch-cbirds.sh first" >&2; exit 65; }
for a in ${LOOK[@]+"${LOOK[@]}"}; do case "$a" in --record*|--link|--seed|--snapshot|--bench) echo "bake-plate.sh sets $a itself" >&2; exit 64 ;; esac; done
if command -v sha256sum >/dev/null 2>&1; then SHA() { sha256sum "$1" | cut -d' ' -f1; }; else SHA() { shasum -a 256 "$1" | cut -d' ' -f1; }; fi
now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }

# Cells: sprites and braille paint 8x16 px a cell, text (--text) 12x20. Pick the record size that covers the aspect, then crop.
TEXT=0; for a in ${LOOK[@]+"${LOOK[@]}"}; do [ "$a" = --text ] && TEXT=1; done
case "$ASPECT:$TEXT" in
  9:16:0) CELLS=135x120; W=1080; H=1920; CROP="" ;;
  16:9:0) CELLS=240x68;  W=1920; H=1080; CROP="crop=1920:1080:0:4," ;;
  1:1:0)  CELLS=135x68;  W=1080; H=1080; CROP="crop=1080:1080:0:4," ;;
  9:16:1) CELLS=90x96;   W=1080; H=1920; CROP="" ;;
  16:9:1) CELLS=160x54;  W=1920; H=1080; CROP="" ;;
  1:1:1)  CELLS=90x54;   W=1080; H=1080; CROP="" ;;
  *) echo "--aspect is 9:16, 16:9 or 1:1" >&2; exit 64 ;;
esac

# Frames: the GIF clock is 100/3 frames a second; the plate takes F of them after skipping S, and plays them at 30 fps.
F=$(awk -v s="$SECONDS_OUT" 'BEGIN{printf "%d", s*30 + 0.5}')
S=$(awk -v s="$SKIP" 'BEGIN{printf "%d", s*100/3 + 0.5}')
R=1; while [ "$(awk -v r="$R" 'BEGIN{printf "%d", 100/3*r + 0.5}')" -lt $((S + F)) ]; do R=$((R + 1)); done
[ "$R" -le 120 ] || { echo "too long: cbirds records at most 120 s (asked for $((S + F)) frames)" >&2; exit 64; }

BASE="${OUT%.mp4}"; GIF="$BASE.gif"; mkdir -p "$(dirname "$OUT")"
t0=$(now)
"$CBIRDS" --record "$GIF" --record-fps 33 --record-seconds "$R" --record-size "$CELLS" --seed "$SEED" ${LOOK[@]+"${LOOK[@]}"} < /dev/null > "$BASE.record.log"
t1=$(now)

VF="trim=start_frame=$S:end_frame=$((S + F)),setpts=N/(30*TB),$CROP"
if [ "$GROUND" = black ]; then
  read -r GR GG GB < <(ffmpeg -v error -i "$GIF" -frames:v 1 -vf crop=1:1:0:0 -f rawvideo -pix_fmt rgb24 - | od -An -tu1)
  VF="${VF}lutrgb=r='clip((val-$GR)*255/(255-$GR),0,255)':g='clip((val-$GG)*255/(255-$GG),0,255)':b='clip((val-$GB)*255/(255-$GB),0,255)',"
fi
if [ -n "$PNG" ]; then mkdir -p "$PNG"; ffmpeg -v error -y -i "$GIF" -vf "${VF%,}" -fps_mode passthrough "$PNG/%05d.png"; fi
ffmpeg -v error -y -i "$GIF" -vf "${VF}scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv" \
  -fps_mode cfr -r 30 -c:v libx264 -preset slow -tune animation -crf "$CRF" -threads 1 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart -an "$OUT"
t2=$(now)

GOT=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT")
[ "$GOT" = "$F" ] || { echo "frame count $GOT, wanted $F" >&2; exit 1; }
REC_MS=$(awk -v a="$t0" -v b="$t1" -v n="$((S + F))" 'BEGIN{printf "%.1f", (b-a)*1000/n}')
ENC_MS=$(awk -v a="$t1" -v b="$t2" -v n="$F" 'BEGIN{printf "%.1f", (b-a)*1000/n}')
LOOK_JSON=$(printf '%s\n' ${LOOK[@]+"${LOOK[@]}"} | awk 'BEGIN{ORS=""} {gsub(/\\/,"\\\\"); gsub(/"/,"\\\""); printf "%s\"%s\"", (NR>1?", ":""), $0}')
cat > "$BASE.json" <<EOF
{ "format": "anve-cbirds-plate/1", "cbirds": "$("$CBIRDS" --version)", "commit": "fe6f9f183cd5548c9403d0859ce49856850229ed",
  "seed": $SEED, "look": [$LOOK_JSON], "aspect": "$ASPECT", "size": [$W, $H], "record_size": "$CELLS",
  "fps": 30, "sim_steps_per_second": 33.333, "pace_vs_cbirds": 0.9, "skip_frames": $S, "frames": $F, "record_seconds": $R,
  "frame_map": "plate frame n = cbirds frame $S + n", "ground": "$GROUND",
  "gif_sha256": "$(SHA "$GIF")", "mp4_sha256": "$(SHA "$OUT")", "record_ms_per_frame": $REC_MS, "encode_ms_per_frame": $ENC_MS }
EOF
echo "ok    $OUT  ${W}x${H}  $F frames @ 30 fps  (cbirds frames $S..$((S + F - 1)))  record ${REC_MS} ms/frame, encode ${ENC_MS} ms/frame"
