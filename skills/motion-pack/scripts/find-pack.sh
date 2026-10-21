#!/bin/sh
# motion-pack / skills / motion-pack / scripts / find-pack.sh: print PACK=<folder> for an agent working in ANY folder.
#   1. $MOTION_PACK_HOME (a clone or an unpacked release)
#   2. the clone this skill sits in (a git checkout; never the plugin cache under ~/.claude/plugins)
#   3. ~/.motion-pack/<version>
#   4. else `mp init`: the tagged release tarball, checked against its SHA256SUMS, unpacked into ~/.motion-pack/<version>
# Then use "$PACK/tools/mp" for every command (mp doctor, mp plan, mp render ...). Projects live where the user works, never in the pack.
# Exit 0 with PACK=..., 2 when nothing could be found or fetched (the message says what to do).
set -u
SKILL_DIR=$(cd "$(dirname "$0")/.." && pwd -P)
ROOT=$(cd "$SKILL_DIR/../.." 2>/dev/null && pwd -P)
VERSION=$(sed -n 's/^ *"version": *"\([0-9][0-9.]*\)".*/\1/p' "$ROOT/.claude-plugin/plugin.json" 2>/dev/null | head -1)
[ -n "$VERSION" ] || VERSION=0.6.0   # a skill copied on its own: the release it ships with
is_pack() { [ -d "$1/templates" ] && [ -d "$1/playbook" ] && [ -f "$1/tools/mp.mjs" ]; }
say() { echo "PACK=$1"; echo "how: $2" >&2; exit 0; }

if [ -n "${MOTION_PACK_HOME:-}" ]; then
  is_pack "$MOTION_PACK_HOME" && say "$(cd "$MOTION_PACK_HOME" && pwd -P)" "MOTION_PACK_HOME"
  echo "find-pack: MOTION_PACK_HOME=$MOTION_PACK_HOME is not a pack (no templates/, playbook/ or tools/mp.mjs): fix or unset it" >&2; exit 2
fi
case "$ROOT" in
  */.claude/plugins/*) ;;   # the plugin cache is replaced on every update: renders and sound builds never go there
  *) if is_pack "$ROOT" && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then say "$ROOT" "the clone this skill sits in"; fi ;;
esac
H="$HOME/.motion-pack/$VERSION"
is_pack "$H" && say "$H" "~/.motion-pack/$VERSION"
if [ -f "$ROOT/tools/mp.mjs" ] && command -v node >/dev/null 2>&1; then
  node "$ROOT/tools/mp.mjs" init "$VERSION" >&2 && is_pack "$H" && say "$H" "mp init (release v$VERSION, sha256 checked)"
  echo "find-pack: mp init could not fetch release v$VERSION; clone https://github.com/ANVEAI/motion-pack and set MOTION_PACK_HOME to it" >&2; exit 2
fi
echo "find-pack: no pack and no node to fetch one: install Node 22+, then run this again (or clone https://github.com/ANVEAI/motion-pack and set MOTION_PACK_HOME)" >&2
exit 2
