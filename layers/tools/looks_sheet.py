"""motion-pack / layers / tools / looks_sheet.py: contact sheet of every look cube, rendered by ffmpeg lut3d (so it also proves each .cube parses).
    python3 layers/tools/looks_sheet.py [source.png] [out.jpg]     defaults: layers/demo/out/plate-test.png (the layers test plate: skin ramp, primaries, greys, sky) -> layers/demo/out/looks-sheet.jpg
Same tiling approach as templates/_shared/sheet.py (PIL), labels burnt in; temp tiles live in a temporary folder that is removed afterwards."""
import os, sys, json, shutil, subprocess, tempfile
from PIL import Image, ImageDraw
PACK = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PACK, 'layers/demo/out/plate-test.png')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(PACK, 'layers/demo/out/looks-sheet.jpg')
looks = json.load(open(os.path.join(PACK, 'layers/looks/looks.json')))['looks']
cubes = [('source', None)] + [(l['id'], os.path.join(PACK, l['file'])) for l in looks] + [('neutral.rolloff-709', os.path.join(PACK, 'layers/looks/neutral.rolloff-709.cube'))]
tmp = tempfile.mkdtemp(prefix='mp-looks-'); tw, th, cols = 384, 216, 6; tiles = []
for i, (name, cube) in enumerate(cubes):
    f = os.path.join(tmp, f'{i}.png'); vf = f"scale={tw}:{th}" + (f",lut3d=file='{cube}'" if cube else '')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-frames:v', '1', f], capture_output=True, text=True)
    if r.returncode: sys.exit(f'ffmpeg failed on {name}: {r.stderr[:300]}')
    tiles.append((name, f))
rows = (len(tiles) + cols - 1) // cols; S = Image.new('RGB', (tw * cols, th * rows), (24, 24, 24)); d = ImageDraw.Draw(S)
for i, (n, f) in enumerate(tiles):
    x, y = (i % cols) * tw, (i // cols) * th; S.paste(Image.open(f).convert('RGB'), (x, y)); d.rectangle((x, y, x + 7 * len(n) + 8, y + 16), fill=(0, 0, 0)); d.text((x + 4, y + 2), n, fill=(255, 255, 255))
S.save(out, quality=88); shutil.rmtree(tmp, ignore_errors=True)
print('looks sheet', out, S.size, len(tiles), 'tiles (every cube parsed by ffmpeg lut3d)')
