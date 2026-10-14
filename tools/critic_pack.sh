#!/usr/bin/env bash
# motion-pack / tools / critic_pack.sh: build the evidence a critic (a person or an agent) scores a rendered video from.
#
#   bash tools/critic_pack.sh <video.mp4> <out_dir> [composition_dir]
#
# Writes into out_dir:
#   sheet_2fps.jpg      contact sheet, 2 frames per second, 6 across (tile i = i / 2 s, row-major; times in sheet_index.txt)
#   motion_strip.jpg    12 consecutive frames (6 x 2) around the fastest motion (largest mean frame difference); motion.txt names them
#   phone/*.png         360 px wide frames (hook, quarters, end): read every word at this size or it fails phone readability
#   loop2x.mp4          the video played twice (watch the wrap); seam.jpg = last frame | first frame, seam PSNR in critic.json
#   refstudy/           tools/refstudy.py on the delivered file: loudness, onsets, cuts and the share of cuts within 2 frames of an onset
#   det/                (only with composition_dir) two HyperFrames png-sequence renders and a frame-hash comparison (det/report.txt)
#   critic.json         the numbers above in one place
#   review.md           the rubric to fill in (skills/motion-pack/references/critic.md)
#
# Environment: FFMPEG, FFPROBE (default: on PATH), PYTHON (default python3, needs numpy + matplotlib for refstudy),
#              HF (default "npx -y hyperframes@0.8.142") for the determinism renders.
set -euo pipefail

if [ $# -lt 2 ]; then sed -n '2,20p' "$0"; exit 2; fi
IN=$1
OUT=$2
COMP=${3:-}
FFMPEG=${FFMPEG:-ffmpeg}
FFPROBE=${FFPROBE:-ffprobe}
PYTHON=${PYTHON:-python3}
HF=${HF:-npx -y hyperframes@0.8.142}
PACK=$(cd "$(dirname "$0")/.." && pwd)
[ -f "$IN" ] || { echo "no such video: $IN" >&2; exit 2; }
mkdir -p "$OUT/phone"
ff() { "$FFMPEG" -v error -nostdin -y "$@"; }

# ---- probe
DUR=$("$FFPROBE" -v error -show_entries format=duration -of default=nw=1:nk=1 "$IN")
read -r W H RATE <<<"$("$FFPROBE" -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$IN" | tr ',' ' ')"
FPS=$(awk -v r="$RATE" 'BEGIN{split(r,a,"/"); printf "%.4f", (a[2] ? a[1]/a[2] : a[1])}')
NFR=$(awk -v d="$DUR" -v f="$FPS" 'BEGIN{printf "%d", d*f + 0.5}')
echo "video ${W}x${H} @ ${FPS} fps, ${DUR} s, ~${NFR} frames"

# ---- 1. contact sheet at 2 fps, 6 across
N2=$(awk -v d="$DUR" 'BEGIN{n=int(d*2); if (n < d*2) n++; if (n < 1) n=1; print n}')
ROWS=$(( (N2 + 5) / 6 ))
TW=$([ "$W" -ge "$H" ] && echo 320 || echo 180)
ff -i "$IN" -vf "fps=2,scale=${TW}:-2,tile=6x${ROWS}:padding=2:color=white" -frames:v 1 "$OUT/sheet_2fps.jpg"
awk -v n="$N2" 'BEGIN{for (i = 0; i < n; i++) printf "tile %d (row %d, col %d) = %.1f s\n", i, int(i/6) + 1, i%6 + 1, i/2}' > "$OUT/sheet_index.txt"

# ---- 2. sound and edit first (its cut list keeps hard cuts out of the motion pick): loudness, onsets, cuts on onsets
"$PYTHON" "$PACK/tools/refstudy.py" "$IN" "$OUT/refstudy" --whisper none > "$OUT/refstudy.txt" 2>&1 || echo "refstudy failed: see $OUT/refstudy.txt" >&2

# ---- 3. 12 consecutive frames around the fastest motion (largest mean frame difference that is not a hard cut)
"$FFMPEG" -v error -nostdin -i "$IN" -an -vf "scale=160:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
  | awk '/^frame:/{split($1,a,":"); n=a[2]} /YAVG=/{split($0,b,"="); print n, b[2]}' > "$OUT/motion_scores.txt" || true
read -r PEAK SCORE <<<"$("$PYTHON" - "$OUT" "$FPS" <<'PY'
import json, os, sys
out, fps = sys.argv[1], float(sys.argv[2])
rows = [(int(a), float(b)) for a, b in (l.split() for l in open(os.path.join(out, "motion_scores.txt")) if len(l.split()) == 2)]
p = os.path.join(out, "refstudy", "study.json")
cuts = [round(c * fps) for c in json.load(open(p)).get("cuts", [])] if os.path.exists(p) else []
keep = [r for r in rows if all(abs(r[0] + 1 - c) > 1 for c in cuts)] or rows     # diff n compares frames n and n+1
print(*(max(keep, key=lambda r: r[1]) if keep else (0, 0)))
PY
)"
PEAK=${PEAK:-0}; SCORE=${SCORE:-0}
A=$(( PEAK - 5 )); [ "$A" -lt 0 ] && A=0
LAST=$(( NFR - 12 )); [ "$LAST" -lt 0 ] && LAST=0; [ "$A" -gt "$LAST" ] && A=$LAST
B=$(( A + 11 ))
SW=$([ "$W" -ge "$H" ] && echo 480 || echo 270)
ff -i "$IN" -vf "select='between(n\,${A}\,${B})',scale=${SW}:-2,tile=6x2:padding=2:color=white" -fps_mode passthrough -frames:v 1 "$OUT/motion_strip.jpg"
awk -v a="$A" -v b="$B" -v p="$PEAK" -v f="$FPS" -v s="$SCORE" 'BEGIN{printf "fastest motion (hard cuts excluded): largest difference between frames %d and %d (%.2f s, mean |diff| %s)\n", p, p+1, p/f, s; printf "strip = frames %d-%d (%.2f-%.2f s), row-major\n", a, b, a/f, b/f}' > "$OUT/motion.txt"

# ---- 4. phone frames at 360 px
for T in 0 1.0 2.0 $(awk -v d="$DUR" 'BEGIN{printf "%.2f %.2f %.2f %.2f", d*0.25, d*0.5, d*0.75, (d > 0.2 ? d-0.1 : 0)}'); do
  awk -v t="$T" -v d="$DUR" 'BEGIN{exit !(t < d)}' || continue
  ff -ss "$T" -i "$IN" -frames:v 1 -vf "scale=360:-2" "$OUT/phone/phone_$(printf '%06.2f' "$T")s.png"
done

# ---- 5. loop check: played twice + the seam
ff -stream_loop 1 -i "$IN" -c copy "$OUT/loop2x.mp4"
ff -sseof -0.2 -i "$IN" -update 1 -vf "scale=${SW}:-2" "$OUT/seam_last.png"
ff -i "$IN" -frames:v 1 -vf "scale=${SW}:-2" "$OUT/seam_first.png"
ff -i "$OUT/seam_last.png" -i "$OUT/seam_first.png" -filter_complex "[0][1]hstack" "$OUT/seam.jpg"
SEAM=$("$FFMPEG" -v info -nostdin -i "$OUT/seam_last.png" -i "$OUT/seam_first.png" -lavfi psnr -f null - 2>&1 | sed -n 's/.*average:\([^ ]*\).*/\1/p' | tail -1)
SEAM=${SEAM:-nan}

# ---- 6. determinism (optional): two png-sequence renders of the composition, frame hashes compared
DET=null
if [ -n "$COMP" ]; then
  mkdir -p "$OUT/det"
  for k in 1 2; do $HF render "$COMP" --format png-sequence -o "$OUT/det/r$k" --quiet; done
  ( cd "$OUT/det/r1" && find . -name '*.png' -type f | sort | xargs shasum -a 256 ) > "$OUT/det/r1.sha"
  ( cd "$OUT/det/r2" && find . -name '*.png' -type f | sort | xargs shasum -a 256 ) > "$OUT/det/r2.sha"
  TOT=$(wc -l < "$OUT/det/r1.sha" | tr -d ' ')
  DIFF=$(diff "$OUT/det/r1.sha" "$OUT/det/r2.sha" | grep -c '^<' || true)
  { echo "frames: $TOT, differing: $DIFF"; diff "$OUT/det/r1.sha" "$OUT/det/r2.sha" | grep '^<' | head -20 || true; } > "$OUT/det/report.txt"
  FIRST=$(diff "$OUT/det/r1.sha" "$OUT/det/r2.sha" | sed -n 's/^< [0-9a-f]*  \.\///p' | head -1 || true)
  PSNR=null
  if [ -n "$FIRST" ]; then
    PSNR=$("$FFMPEG" -v info -nostdin -i "$OUT/det/r1/$FIRST" -i "$OUT/det/r2/$FIRST" -lavfi psnr -f null - 2>&1 | sed -n 's/.*average:\([^ ]*\).*/\1/p' | tail -1)
    echo "first differing frame $FIRST: PSNR $PSNR dB (>= 60 dB = GPU blur noise, below = a real seek bug)" >> "$OUT/det/report.txt"
    PSNR="\"$PSNR\""
  fi
  DET="{\"frames\": $TOT, \"differing\": $DIFF, \"first_diff_psnr_db\": $PSNR}"
fi

# ---- summary + rubric
"$PYTHON" - "$OUT" "$IN" "$W" "$H" "$FPS" "$DUR" "$PEAK" "$SCORE" "$SEAM" "$DET" <<'PY'
import json, os, sys
out, src, w, h, fps, dur, peak, score, seam, det = sys.argv[1:11]
st = {}
p = os.path.join(out, "refstudy", "study.json")
if os.path.exists(p):
    st = json.load(open(p))
a = st.get("audio") or {}
summary = {"video": src, "size": [int(w), int(h)], "fps": float(fps), "duration_s": round(float(dur), 3),
           "fastest_motion": {"frame": int(peak), "time_s": round(int(peak) / float(fps), 3), "mean_abs_diff": float(score)},
           "loop_seam_psnr_db": seam, "loudness": st.get("loudness"), "cuts": st.get("cuts"), "edit": st.get("edit"),
           "sound_sync": a.get("sync"), "onsets": len(a.get("onsets") or []), "determinism": json.loads(det)}
json.dump(summary, open(os.path.join(out, "critic.json"), "w"), indent=1)
sync = (a.get("sync") or {}).get("share_on_onset")
lo = (st.get("loudness") or {})
rows = ["hook in 2 s", "phone readability", "motion", "variety", "sound sync", "brand accuracy"]
md = ["# Critic review: " + os.path.basename(src), "",
      "Evidence: `sheet_2fps.jpg` (+ `sheet_index.txt`), `motion_strip.jpg` (`motion.txt`), `phone/`, `loop2x.mp4` + `seam.jpg`, `refstudy/timeline.png`, `critic.json`.",
      "Rubric and fix loop: `skills/motion-pack/references/critic.md`. Iterate until every score is >= 8.", "",
      "Measured: %s s at %s fps; LUFS-I %s, peak %s dBFS; cuts on an onset (+-2 frames): %s; loop seam PSNR %s dB; determinism: %s" % (
          round(float(dur), 2), fps, lo.get("integrated_lufs"), lo.get("peak_dbfs"), "n/a" if sync is None else "%d%%" % round(sync * 100), seam,
          "not run" if det == "null" else det), "",
      "| criterion | score 1-10 | evidence (file, timestamp) |", "|---|---|---|"] + ["| %s |  |  |" % r for r in rows] + [
      "", "## 3 worst defects", "", "| # | timestamp | defect | local fix |", "|---|---|---|---|", "| 1 |  |  |  |", "| 2 |  |  |  |", "| 3 |  |  |  |"]
open(os.path.join(out, "review.md"), "w").write("\n".join(md) + "\n")
print(json.dumps({k: summary[k] for k in ("duration_s", "fastest_motion", "loop_seam_psnr_db", "loudness", "sound_sync", "determinism")}, indent=1))
PY
echo "critic pack: $OUT (fill in $OUT/review.md)"
