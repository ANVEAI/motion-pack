#!/usr/bin/env bash
# motion-pack / terminal / fetch-cbirds.sh
# Download cbirds (MIT, C99, no dependencies) at a pinned commit, verify the source tarball, and build the binary.
# Nothing is vendored: the tarball, the source and the binary live in external/cbirds/ (gitignored), like every fetched set.
#
#   terminal/fetch-cbirds.sh                  # -> external/cbirds/bin/cbirds
#   terminal/fetch-cbirds.sh --dest DIR       # somewhere else (or set MP_EXTERNAL)
#   terminal/fetch-cbirds.sh --list           # print the pin and its licence, then exit
#
# Pin: github.com/clainstone/cbirds @ fe6f9f183cd5548c9403d0859ce49856850229ed (cbirds 1.7.0), source tarball SHA-256 below.
# The build runs only `make cbirds`: never `make install`, `make asset` or `make test` (two upstream tests write under /tmp).
# It pins CFLAGS (-O2 -ffp-contract=off) because the flock is chaotic: every build-flag change (-O0, -O3, FMA contraction)
# gave a different, equally deterministic flock in the lab, and so did x86_64 vs arm64. Same pin + same CPU architecture
# = same pixels; across architectures, keep the baked MP4 (its SHA-256 is in the plate's .json) rather than re-baking.
# Needs: bash, curl, tar, make, a C99 compiler (cc), and sha256sum or shasum. Exit status 1 on any download, checksum or build failure.
set -euo pipefail

COMMIT=fe6f9f183cd5548c9403d0859ce49856850229ed
VERSION="cbirds 1.7.0"
TAR_SHA256=593a371da5541c59cd076954fb9d83a313f36454c2e6b36e147f6ab81ab3b640
URL="https://github.com/clainstone/cbirds/archive/$COMMIT.tar.gz"
AUTHOR="Alessandro Palliccia (clainstone)"
LICENCE=MIT

HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
DEST="${MP_EXTERNAL:-$REPO/external}"; LIST=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    --list) LIST=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done
if [ "$LIST" = 1 ]; then printf '%-32s %-10s %s\n' cbirds "$LICENCE" "https://github.com/clainstone/cbirds/tree/$COMMIT"; exit 0; fi

if command -v sha256sum >/dev/null 2>&1; then SHA() { sha256sum "$1" | cut -d' ' -f1; }; else SHA() { shasum -a 256 "$1" | cut -d' ' -f1; }; fi
for t in curl tar make "${CC:-cc}"; do command -v "$t" >/dev/null 2>&1 || { echo "missing tool: $t" >&2; exit 65; }; done
fetch() {  # url dest -> 0 on success (retries 3 times)
  mkdir -p "$(dirname "$2")"; curl -fsSL --retry 3 --retry-delay 2 -o "$2.part" "$1" && mv "$2.part" "$2"
}

D="$DEST/cbirds"; TAR="$D/cbirds-$COMMIT.tar.gz"; SRC="$D/src/cbirds-$COMMIT"
mkdir -p "$D/bin" "$D/src"
if [ ! -f "$TAR" ] || [ "$(SHA "$TAR")" != "$TAR_SHA256" ]; then
  echo "  downloading cbirds @ ${COMMIT:0:7} ..."
  fetch "$URL" "$TAR" || { echo "  download failed: $URL" >&2; exit 1; }
fi
if [ "$(SHA "$TAR")" != "$TAR_SHA256" ]; then
  # GitHub promises stable archive bytes, but if it ever re-packs them this fails closed; re-verify by commit with
  #   git clone https://github.com/clainstone/cbirds && git -C cbirds checkout $COMMIT   and update the pin after a review.
  echo "  CHECKSUM MISMATCH: $TAR (want $TAR_SHA256, got $(SHA "$TAR"))" >&2; exit 1
fi
[ -f "$SRC/makefile" ] || tar -xzf "$TAR" -C "$D/src"
( cd "$SRC" && make CC="${CC:-cc}" CFLAGS="-O2 -ffp-contract=off" cbirds ) > "$D/build.log" 2>&1 || { echo "  build failed, see $D/build.log" >&2; exit 1; }
cp "$SRC/cbirds" "$D/bin/cbirds"
got="$("$D/bin/cbirds" --version)"
[ "$got" = "$VERSION" ] || { echo "  unexpected version: $got (want $VERSION)" >&2; exit 1; }
{
  echo "url: https://github.com/clainstone/cbirds/tree/$COMMIT"; echo "author: $AUTHOR"; echo "licence: $LICENCE"
  echo "licence_snapshot: src/cbirds-$COMMIT/LICENSE"; echo "date: $(date +%F)"; echo "tar_sha256: $TAR_SHA256"
  echo "commit: $COMMIT"; echo "note: built locally with make cbirds (CFLAGS=-O2 -ffp-contract=off); build-time tool only, never shipped"
  echo "fetched_by: terminal/fetch-cbirds.sh"
} > "$D/ORIGIN.txt"
echo "ok    cbirds ($got, ${COMMIT:0:7}) -> $D/bin/cbirds"
