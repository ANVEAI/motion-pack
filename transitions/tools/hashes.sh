#!/usr/bin/env bash
# Cross-launch determinism on the frames that matter: re-render the 3 QA stills of every demo (before cut / ON the cut /
# after cut, 8-subframe supersampled) in a fresh Chrome and compare their bytes with the stills tools/demos.sh wrote
# during the video render. Also keeps the render QA hash (renders/qa/<key>.json). Writes renders/hashes.json.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"; R="$HERE/../tools/render.mjs"; cd "$HERE"
T="$(mktemp -d "${TMPDIR:-/tmp}/mp-hash.XXXXXX")"
ONLY=" $* "   # optional keys: re-hash only these demos and merge into renders/hashes.json
for d in renders/stills/*/; do
  k=$(basename "$d"); base=${k%_9x16}; [ "$k" = match_guides ] && continue
  if [ $# -gt 0 ] && [[ "$ONLY" != *" $base "* ]]; then continue; fi
  if [ "$k" != "$base" ]; then Q="tx=$base&w=540&h=960"; else Q="tx=$k&w=960&h=540"; fi
  S=$(ls "$d" | sed -n 's/^f0*\([0-9][0-9]*\)\.png$/\1/p' | paste -sd, -); [ -z "$S" ] && S=0
  node "$R" demo.html "$T/x.mp4" 0 0 --stills-only --stills "$S" --stills-dir "$T/$k" --query "$Q" --min-free-gib 10 > /dev/null || true
done
node -e '
const fs=require("fs"),path=require("path"),crypto=require("crypto"),T=process.argv[1],only=process.argv.slice(2),out=only.length&&fs.existsSync("renders/hashes.json")?JSON.parse(fs.readFileSync("renders/hashes.json")):{},md5=f=>crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex").slice(0,16);
for (const k of fs.readdirSync("renders/stills")) { if (k==="match_guides") continue; if (only.length && !only.includes(k.replace(/_9x16$/,""))) continue; const d="renders/stills/"+k, fr={};
  for (const f of fs.readdirSync(d).filter(f=>f.endsWith(".png"))) { const b=path.join(T,k,f); fr[f]={run1:md5(path.join(d,f)), run2:fs.existsSync(b)?md5(b):null}; }
  const qa=fs.existsSync("renders/qa/"+k+".json")?JSON.parse(fs.readFileSync("renders/qa/"+k+".json")):null;
  out[k]={stills:fr, same:Object.values(fr).every(v=>v.run1===v.run2), qa_hash:qa?qa.same_frame_twice.a:null, qa_pass:qa?qa.pass:null}; }
fs.writeFileSync("renders/hashes.json", JSON.stringify(out,null,1)+"\n");
const bad=Object.entries(out).filter(([,v])=>!v.same); console.log(Object.keys(out).length+" demos, "+Object.values(out).reduce((s,v)=>s+Object.keys(v.stills).length,0)+" stills re-rendered in a fresh Chrome, "+bad.length+" differ"+(bad.length?": "+bad.map(x=>x[0]).join(", "):""));
process.exit(bad.length?1:0);' "$T" "$@"
mkdir -p "$HOME/.Trash/motion-pack-scratch-$(date +%F)"; mv "$T" "$HOME/.Trash/motion-pack-scratch-$(date +%F)/"   # moved, never deleted
