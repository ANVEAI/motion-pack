#!/bin/bash
# motion-pack/blender: run a recipe with the Blender binary resolved, a disk guard and a timeout.
#   bash blender/render.sh [--blender PATH] [--timeout SEC] --recipe blender/turntable --size 1920x1080 --out out/tt ...
# Blender: --blender > $BLENDER > blender on PATH > /Applications > ~/Applications. Stops under 10 GiB free.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
TOUT=7200; ARGS=()
while [ $# -gt 0 ]; do case "$1" in --blender) BLENDER="$2"; shift 2;; --timeout) TOUT="$2"; shift 2;; *) ARGS+=("$1"); shift;; esac; done
for c in "${BLENDER:-}" "$(command -v blender || true)" /Applications/Blender.app/Contents/MacOS/Blender "$HOME/Applications/Blender.app/Contents/MacOS/Blender"; do
  if [ -n "$c" ] && [ -x "$c" ]; then BLENDER="$c"; break; fi; done
[ -x "${BLENDER:-}" ] || { echo "NEEDS BLENDER: install Blender 5.2.x or set BLENDER=/path/to/Blender"; exit 2; }
FREE=$(df -Pk . 2>/dev/null | awk 'NR==2{print int($4/1048576)}'); FREE=${FREE:-999}
[ "$FREE" -ge 10 ] || { echo "disk: only ${FREE} GiB free (< 10): not rendering"; exit 3; }
TO=$(command -v timeout || command -v gtimeout || echo "")
exec ${TO:+$TO $TOUT} "$BLENDER" -b --factory-startup -P "$HERE/run.py" -- "${ARGS[@]}"
