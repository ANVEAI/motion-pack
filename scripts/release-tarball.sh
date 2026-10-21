#!/bin/sh
# motion-pack / scripts / release-tarball.sh: the release asset `mp init` downloads.
#   scripts/release-tarball.sh v0.6.0 [OUT_DIR]   ->  OUT_DIR/motion-pack-v0.6.0.tar.gz (git archive of the TAG, one top folder) and its SHA256SUMS line
# Attach the tarball to the GitHub release of that tag and add the printed line to the release's SHA256SUMS (with the WAV zips): mp init refuses a
# tarball that SHA256SUMS does not list or whose sha256 differs (tools/pack_home.mjs).
set -eu
TAG=${1:?usage: scripts/release-tarball.sh vX.Y.Z [out_dir]}
OUT=${2:-.}
V=${TAG#v}
NAME="motion-pack-v$V"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "no tag $TAG (tag the release commit first)" >&2; exit 2; }
mkdir -p "$OUT"
git archive --format=tar.gz --prefix="$NAME/" -o "$OUT/$NAME.tar.gz" "$TAG"
( cd "$OUT" && { command -v sha256sum >/dev/null 2>&1 && sha256sum "$NAME.tar.gz" || shasum -a 256 "$NAME.tar.gz"; } )
