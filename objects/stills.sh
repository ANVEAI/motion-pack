#!/bin/bash
# objects stills: ./stills.sh <page.html> <outdir> "<frames>" "<query>"   (GPU-verified tools/render.mjs, 4 subframes, PNGs + contact sheet)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; PAGE="$1"; OUT="$2"; FR="$3"; Q="$4"
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"; cd "$(dirname "$PAGE")"
node "$ROOT/tools/render.mjs" "$(basename "$PAGE")" "$OUT/dev.mp4" 0 30 --stills-only --stills "$FR" --stills-dir "$OUT" --query "$Q" --min-free-gib 10 > "$OUT/log.txt" 2>&1 || { tail -25 "$OUT/log.txt"; exit 1; }
grep -iE "GPU|error|warn" "$OUT/log.txt" | head -8
python3 - "$OUT" "$FR" <<'PY'
import sys
from PIL import Image
d, fr = sys.argv[1], sys.argv[2].split(',')
ims = [Image.open(f'{d}/f{int(f):04d}.png').convert('RGB') for f in fr]; w, h = ims[0].size; tw = 640 if w > h else 360; th = round(h * tw / w)
cols = min(3, len(ims)) if w > h else min(4, len(ims)); rows = (len(ims) + cols - 1) // cols; S = Image.new('RGB', (tw * cols, th * rows), 'white')
for i, im in enumerate(ims): S.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
S.save(f'{d}/sheet.jpg', quality=88); print('sheet', f'{d}/sheet.jpg', S.size)
PY
