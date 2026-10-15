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
#   refstudy/           tools/refstudy.py on the delivered file: loudness, onsets, cuts and the share of cuts within 2 frames of an onset,
#                       motion events (continuous films), quiet open / tail and the ending shape
#   ears/               ears/listen.py on the delivered file: ears.md (what a listener would notice, sound scores, every check with fixes) + ears.json;
#                       with composition_dir it reads <dir>/out/plan.json (cuts, cue anchors) and <dir>/words.json (transcript) when they exist
#   eyes/               eyes/look.py on the delivered file: eyes.md (what a viewer would notice, picture scores, every check with fixes) + eyes.json;
#                       with composition_dir it reads <dir>/out/plan.json (texts, holds, paceRule, platform)
#   det/                (only with composition_dir) two HyperFrames png-sequence renders and a frame-hash comparison (det/report.txt)
#   critic.json         the numbers above in one place
#   review.md           the rubric to fill in (skills/motion-pack/references/critic.md)
#
# Environment: FFMPEG, FFPROBE (default: on PATH), PYTHON (default python3, needs numpy + matplotlib for refstudy, numpy + scipy for ears and eyes),
#              EARS_MODE (music | vo | continuous: what ears scores the edit on; default plan.audio.mode, else music),
#              EYES_PLATFORM (a plan.mjs preset or type/safezones.js id for eyes; default the plan's, else by aspect), EYES_FORMAT (a cuts/patterns.json pace format),
#              EYES_DRAFT=1 (an animatic: waive the resolution and bit-rate rules),
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
mkdir -p "$OUT/phone" "$OUT/ears" "$OUT/eyes"
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

# ---- 2b. ears: the sound judged check by check (loudness, clipping, tone, speech, sync, structure, repetition, stereo)
EARS_ARGS=()
if [ -n "$COMP" ] && [ -f "$COMP/out/plan.json" ]; then EARS_ARGS+=(--plan "$COMP/out/plan.json")
elif [ -f "$OUT/refstudy/study.json" ]; then EARS_ARGS+=(--cuts "$OUT/refstudy/study.json"); fi
[ -n "$COMP" ] && [ -f "$COMP/words.json" ] && EARS_ARGS+=(--transcript "$COMP/words.json")
# motion events for a continuous film (plan.audio.mode "continuous" or EARS_MODE=continuous); ears ignores them in the other modes
[ -f "$OUT/refstudy/study.json" ] && EARS_ARGS+=(--events "$OUT/refstudy/study.json")
[ -n "${EARS_MODE:-}" ] && EARS_ARGS+=(--mode "$EARS_MODE")
"$PYTHON" "$PACK/ears/listen.py" "$IN" ${EARS_ARGS[@]+"${EARS_ARGS[@]}"} --json "$OUT/ears/ears.json" --md "$OUT/ears/ears.md" > "$OUT/ears.txt" 2>&1 \
  || echo "ears failed: see $OUT/ears.txt" >&2

# ---- 2c. eyes: the picture judged check by check (frame 0, black / frozen frames, flashes, banding, safe zones, text, pacing, composition, encode)
EYES_ARGS=()
[ -n "$COMP" ] && [ -f "$COMP/out/plan.json" ] && EYES_ARGS+=(--plan "$COMP/out/plan.json")
[ -n "${EYES_PLATFORM:-}" ] && EYES_ARGS+=(--platform "$EYES_PLATFORM")
[ -n "${EYES_FORMAT:-}" ] && EYES_ARGS+=(--format "$EYES_FORMAT")
[ -n "${EYES_DRAFT:-}" ] && EYES_ARGS+=(--draft)
"$PYTHON" "$PACK/eyes/look.py" "$IN" ${EYES_ARGS[@]+"${EYES_ARGS[@]}"} --json "$OUT/eyes/eyes.json" --md "$OUT/eyes/eyes.md" > "$OUT/eyes.txt" 2>&1 \
  || echo "eyes failed: see $OUT/eyes.txt" >&2

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
ep = os.path.join(out, "ears", "ears.json")
ears = json.load(open(ep)) if os.path.exists(ep) else None
if ears:
    summary["ears"] = {"scores": ears["scores"], "top_issues": ears["top_issues"], "status": {c["id"]: c["status"] for c in ears["checks"]},
                       "mood": ears["mood"]["text"]}
yp = os.path.join(out, "eyes", "eyes.json")
eyes = json.load(open(yp)) if os.path.exists(yp) else None
if eyes:
    summary["eyes"] = {"scores": eyes["scores"], "top_issues": eyes["top_issues"], "status": {c["id"]: c["status"] for c in eyes["checks"]}, "platform": eyes["platform"]}
json.dump(summary, open(os.path.join(out, "critic.json"), "w"), indent=1)
sync = (a.get("sync") or {}).get("share_on_onset")
lo = (st.get("loudness") or {})
rows = ["hook in 2 s", "phone readability", "motion", "variety", "sound sync", "brand accuracy"]
eyes_row = {"hook in 2 s": "critic_hook_2s", "phone readability": "critic_phone_readability", "motion": "critic_motion", "variety": "critic_variety"}
md = ["# Critic review: " + os.path.basename(src), "",
      "Evidence: `sheet_2fps.jpg` (+ `sheet_index.txt`), `motion_strip.jpg` (`motion.txt`), `phone/`, `loop2x.mp4` + `seam.jpg`, `refstudy/timeline.png`, `ears/ears.md`, `eyes/eyes.md`, `critic.json`.",
      "Rubric and fix loop: `skills/motion-pack/references/critic.md`. Iterate until every score is >= 8.", "",
      "Measured: %s s at %s fps; LUFS-I %s, peak %s dBFS; cuts on an onset (+-2 frames): %s; loop seam PSNR %s dB; determinism: %s" % (
          round(float(dur), 2), fps, lo.get("integrated_lufs"), lo.get("peak_dbfs"), "n/a" if sync is None else "%d%%" % round(sync * 100), seam,
          "not run" if det == "null" else det), "",
      "| criterion | score 1-10 | evidence (file, timestamp) |", "|---|---|---|"] + [
      "| %s | %s | %s |" % (r, ("ears suggests %s" % ears["scores"]["critic_sound_sync"]) if (r == "sound sync" and ears and ears["scores"].get("critic_sound_sync") is not None) else
                            ("eyes suggests %s (ceiling)" % eyes["scores"][eyes_row[r]]) if (r in eyes_row and eyes and eyes["scores"].get(eyes_row[r]) is not None) else "",
                            "`ears/ears.md`; then listen once at phone size" if (r == "sound sync" and ears) else
                            ("`eyes/eyes.md`; then look at `phone/` once" if (r in eyes_row and eyes) else "")) for r in rows] + [
      "", "## 3 worst defects", "", "| # | timestamp | defect | local fix |", "|---|---|---|---|", "| 1 |  |  |  |", "| 2 |  |  |  |", "| 3 |  |  |  |"]
if ears:
    ts = lambda t: "whole mix" if not t else ("%.2f s" % t[0] if abs(t[1] - t[0]) < 1e-3 else "%.2f-%.2f s" % tuple(t))
    md += ["", "## Ears: what a listener would notice (`ears/ears.md`)", ""]
    md += ["%d. %s (%s, %s) Fix: %s" % (k, i["listener"], i["severity"], ts(i["t"]), i["fix"]) for k, i in enumerate(ears["top_issues"], 1)] or ["Nothing measurable stands out; still listen once."]
    md += ["", "Sound scores: " + ", ".join("%s %s" % (k, "n/a" if v is None else v) for k, v in ears["scores"].items())]
if eyes:
    ts = lambda t: "whole clip" if not t else ("%.2f s" % t[0] if abs(t[1] - t[0]) < 1e-3 else "%.2f-%.2f s" % tuple(t))
    md += ["", "## Eyes: what a viewer would notice (`eyes/eyes.md`)", ""]
    md += ["%d. %s (%s, %s) Fix: %s" % (k, i["viewer"], i["severity"], ts(i["t"]), i["fix"]) for k, i in enumerate(eyes["top_issues"], 1)] or ["Nothing measurable stands out; still look at `phone/` once."]
    md += ["", "Picture scores: " + ", ".join("%s %s" % (k, "n/a" if v is None else v) for k, v in eyes["scores"].items())]
open(os.path.join(out, "review.md"), "w").write("\n".join(md) + "\n")
print(json.dumps({k: summary.get(k) for k in ("duration_s", "fastest_motion", "loop_seam_psnr_db", "loudness", "sound_sync", "determinism")} | ({"ears_scores": ears["scores"]} if ears else {}) | ({"eyes_scores": eyes["scores"]} if eyes else {}), indent=1))
PY
echo "critic pack: $OUT (fill in $OUT/review.md)"
