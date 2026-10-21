#!/bin/sh
# motion-pack / scripts / release-tarball.sh: the release asset `mp init` downloads.
#   scripts/release-tarball.sh v0.6.0 [OUT_DIR] [REF]   ->  OUT_DIR/motion-pack-v0.6.0.tar.gz (git archive of the TAG, one top folder) and its SHA256SUMS line
#   REF (optional): archive another commit under the release name (a dry run before the tag exists); the release itself is built from the tag
# Attach the tarball to the GitHub release of that tag and add the printed line to the release's SHA256SUMS (with the WAV zips): mp init refuses a
# tarball that SHA256SUMS does not list or whose sha256 differs (tools/pack_home.mjs).
set -eu
TAG=${1:?usage: scripts/release-tarball.sh vX.Y.Z [out_dir]}
OUT=${2:-.}
REF=${3:-$TAG}
V=${TAG#v}
NAME="motion-pack-v$V"
if [ "$REF" = "$TAG" ]; then git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "no tag $TAG (tag the release commit first, or pass a REF for a dry run)" >&2; exit 2; }; fi
git rev-parse -q --verify "$REF^{commit}" >/dev/null || { echo "no commit $REF" >&2; exit 2; }
mkdir -p "$OUT"
git archive --format=tar.gz --prefix="$NAME/" -o "$OUT/$NAME.tar.gz" "$REF"
( cd "$OUT" && { command -v sha256sum >/dev/null 2>&1 && sha256sum "$NAME.tar.gz" || shasum -a 256 "$NAME.tar.gz"; } )
