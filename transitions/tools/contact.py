"""motion-pack / transitions / tools / contact.py
Contact sheet of the 3 QA stills per transition (before cut / on cut / after cut) with labels.
usage: python3 tools/contact.py [out.png] [suffix]   (run from transitions/; suffix '' or '_9x16')"""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1] if len(sys.argv) > 1 else "renders/contact.png"
sfx = sys.argv[2] if len(sys.argv) > 2 else ""
dirs = sorted(d for d in glob.glob("renders/stills/*") if os.path.isdir(d) and d.endswith(sfx) and (sfx or "_9x16" not in d))
tw = 240 if not sfx else 135
rows = []
for d in dirs:
    fs = sorted(glob.glob(d + "/f*.png"))[:3]
    if fs:
        rows.append((os.path.basename(d), [Image.open(f).convert("RGB") for f in fs]))
if not rows:
    sys.exit("no stills")
w0, h0 = rows[0][1][0].size
th = round(tw * h0 / w0)
lab = 150
cols = 2 if not sfx else 1
per = lab + 3 * (tw + 4)
nr = (len(rows) + cols - 1) // cols
sheet = Image.new("RGB", (cols * per + 8, nr * (th + 6) + 8), (18, 18, 22))
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
except OSError:
    font = ImageFont.load_default()
for i, (name, ims) in enumerate(rows):
    x, y = 4 + (i % cols) * per, 4 + (i // cols) * (th + 6)
    dr.text((x + 4, y + th // 2 - 8), name, fill=(235, 235, 240), font=font)
    for j, im in enumerate(ims):
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x + lab + j * (tw + 4), y))
sheet.save(out)
print(out, sheet.size, len(rows), "rows")
