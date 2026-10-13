#!/usr/bin/env bash
# motion-pack / scripts / fetch-external.sh
# Download the pinned third-party sets that motion-pack can use but never vendors, and verify every byte.
#
#   scripts/fetch-external.sh                     # all sets into ./external (gitignored)
#   scripts/fetch-external.sh --dest DIR          # somewhere else (or set MP_EXTERNAL)
#   scripts/fetch-external.sh --only lucide --only kenney/ui-audio
#   scripts/fetch-external.sh --list              # list the sets, their licence and source, then exit
#
# Sets (pins, URLs and SHA-256 sums live in scripts/external.lock):
#   lucide                         ISC (Feather-derived icons MIT)  icon subset, GitHub at a pinned commit
#   phosphor                       MIT                              icon subset (regular weight), pinned commit
#   fluentui-emoji                 MIT                              Flat SVG + 3D PNG subset, pinned commit
#   kenney/<pack> (7 packs)        CC0-1.0                          audio zips from kenney.nl
#   owlishmedia-sound-effects-pack CC0-1.0                          foley zip from opengameart.org (142 MB)
#
# Each set gets an ORIGIN.txt (url, author, licence, licence_snapshot, date, zip_sha256), the format that
# sfx/tools/check_origin.py reads. Audio then enters the catalogue only through:
#   python3 sfx/tools/check_origin.py external/kenney/ui-audio
#   python3 sfx/tools/catalog_import.py external/kenney/ui-audio --category kenney_ui     (writes sfx/library_ext/, gitignored)
# Category names used by the maintainers: kenney_interface, kenney_ui, kenney_digital, kenney_impact, kenney_scifi,
# kenney_rpg, kenney_jingles, owlish_foley.
# Optional, icon sets only: clean the SVGs for draw-on animation (keeps one drawable element per stroke):
#   npx svgo@4.1.0 --config scripts/svgo.config.mjs -r -f external/<set>/svg -o external/<set>/optimized
# Needs: bash, curl, unzip, and sha256sum or shasum. Exit status 1 on any download or checksum failure.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"; LOCK="$HERE/external.lock"
DEST="${MP_EXTERNAL:-$REPO/external}"; ONLY=(); LIST=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --only) ONLY+=("$2"); shift 2 ;;
    --list) LIST=1; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done

if command -v sha256sum >/dev/null 2>&1; then SHA() { sha256sum "$1" | cut -d' ' -f1; }; else SHA() { shasum -a 256 "$1" | cut -d' ' -f1; }; fi
for t in curl unzip; do command -v "$t" >/dev/null 2>&1 || { echo "missing tool: $t" >&2; exit 65; }; done

SETS=($(awk -F'\t' '$1=="meta"{print $2}' "$LOCK" | awk '!seen[$0]++'))
if [ "$LIST" = 1 ]; then
  for s in "${SETS[@]}"; do
    printf '%-32s %-10s %s\n' "$s" "$(awk -F'\t' -v s="$s" '$1=="meta"&&$2==s&&$3=="licence"{print $4}' "$LOCK")" "$(awk -F'\t' -v s="$s" '$1=="meta"&&$2==s&&$3=="url"{print $4}' "$LOCK")"
  done; exit 0
fi
want() { [ ${#ONLY[@]} -eq 0 ] && return 0; for o in "${ONLY[@]}"; do [ "$o" = "$1" ] || [[ "$1" == "$o"/* ]] && return 0; done; return 1; }
fetch() {  # url dest -> 0 on success (retries 3 times)
  mkdir -p "$(dirname "$2")"; curl -fsSL --retry 3 --retry-delay 2 -o "$2.part" "$1" && mv "$2.part" "$2"
}

FAIL=0; TODAY="$(date +%F)"
for s in "${SETS[@]}"; do
  want "$s" || continue
  D="$DEST/$s"; mkdir -p "$D"; n=0; bad=0
  meta() { awk -F'\t' -v s="$s" -v k="$1" '$1=="meta"&&$2==s&&$3==k{print $4}' "$LOCK"; }
  ZIPLINE="$(awk -F'\t' -v s="$s" '$1=="zip"&&$2==s' "$LOCK")"
  if [ -z "$ZIPLINE" ]; then
    # single files from GitHub at a pinned commit
    while IFS=$'\t' read -r kind set rel url sum; do
      [ "$kind" = file ] && [ "$set" = "$s" ] || continue
      f="$D/$rel"
      if [ ! -f "$f" ] || [ "$(SHA "$f")" != "$sum" ]; then fetch "$url" "$f" || { echo "  download failed: $url" >&2; bad=$((bad+1)); continue; }; fi
      if [ "$(SHA "$f")" = "$sum" ]; then n=$((n+1)); else echo "  CHECKSUM MISMATCH: $s/$rel" >&2; bad=$((bad+1)); fi
    done < "$LOCK"
    awk -F'\t' -v s="$s" '$1=="file"&&$2==s&&$3!="LICENSE"{print $5"  "$3}' "$LOCK" > "$D/SHA256SUMS"
    ZSUM=none
  else
    IFS=$'\t' read -r kind set zname url zsum <<< "$ZIPLINE"
    z="$D/$zname"
    if [ ! -f "$z" ] || [ "$(SHA "$z")" != "$zsum" ]; then echo "  downloading $zname ..."; fetch "$url" "$z" || { echo "  download failed: $url" >&2; bad=$((bad+1)); }; fi
    if [ -f "$z" ] && [ "$(SHA "$z")" = "$zsum" ]; then
      mkdir -p "$D/files"; unzip -q -o "$z" -d "$D/files"
      while IFS=$'\t' read -r kind set rel sum; do
        [ "$kind" = xsum ] && [ "$set" = "$s" ] || continue
        if [ -f "$D/$rel" ] && [ "$(SHA "$D/$rel")" = "$sum" ]; then n=$((n+1)); else echo "  CHECKSUM MISMATCH (extracted): $s/$rel" >&2; bad=$((bad+1)); fi
      done < "$LOCK"
    else
      echo "  CHECKSUM MISMATCH (zip): $s/$zname" >&2; bad=$((bad+1))
    fi
    snap="$(meta licence_snapshot)"
    if [ "$snap" = page.html ] && [ ! -f "$D/page.html" ]; then fetch "$(meta url)" "$D/page.html" || echo "  (licence page snapshot not saved; save $(meta url) by hand)" >&2; fi
    ZSUM="$zsum"
  fi
  {
    echo "url: $(meta url)"; echo "author: $(meta author)"; echo "licence: $(meta licence)"; echo "licence_snapshot: $(meta licence_snapshot)"
    echo "date: $TODAY"; echo "zip_sha256: $ZSUM"
    c="$(meta commit)"; [ -n "$c" ] && echo "commit: $c"
    nt="$(meta note)"; [ -n "$nt" ] && echo "note: $nt"
    echo "fetched_by: scripts/fetch-external.sh (pins in scripts/external.lock)"
  } > "$D/ORIGIN.txt"
  if [ "$bad" -eq 0 ]; then echo "ok    $s ($n files verified)"; else echo "FAIL  $s ($n ok, $bad failed)"; FAIL=1; fi
done
exit $FAIL
