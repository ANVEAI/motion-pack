#!/usr/bin/env python3
"""Contact sheet: tile stills with captions so variants can be judged side by side.
usage: python3 sheet.py OUT.jpg [--cols 4] [--width 360] [--title "text"] [--font FILE.ttf] IMG [IMG ...]
Each IMG may be written LABEL=path to set its caption; otherwise the caption is <parent folder>/<file stem>. Needs Pillow."""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = [os.path.join(HERE, "..", "..", "..", "templates", "_shared", "fonts", "Manrope-Variable.ttf"),
         "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:\\Windows\\Fonts\\arial.ttf"]


def font(size):
    for f in FONTS:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 64
    out, cols, width, title, imgs = argv[0], 4, 360, None, []
    rest = argv[1:]
    while rest:
        a = rest.pop(0)
        if a == "--cols":
            cols = int(rest.pop(0))
        elif a == "--width":
            width = int(rest.pop(0))
        elif a == "--title":
            title = rest.pop(0)
        elif a == "--font":
            FONTS.insert(0, rest.pop(0))
        else:
            imgs.append(a)
    items = []
    for s in imgs:
        label, p = (s.split("=", 1) if ("=" in s and not os.path.exists(s)) else (None, s))
        im = Image.open(p).convert("RGB")
        im = im.resize((width, max(1, round(im.height * width / im.width))), Image.LANCZOS)
        items.append((label or f"{os.path.basename(os.path.dirname(p))}/{os.path.splitext(os.path.basename(p))[0]}", im))
    if not items:
        print("no images")
        return 64
    cap, pad, head = 30, 10, (56 if title else 0)
    cell_h = max(im.height for _, im in items) + cap
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (pad + cols * (width + pad), head + pad + rows * (cell_h + pad)), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    if title:
        d.text((pad, 14), title, fill=(235, 235, 240), font=font(26))
    for i, (label, im) in enumerate(items):
        x, y = pad + (i % cols) * (width + pad), head + pad + (i // cols) * (cell_h + pad)
        sheet.paste(im, (x, y))
        d.text((x + 4, y + im.height + 6), label[:48], fill=(200, 200, 210), font=font(16))
    sheet.save(out, quality=88)
    print(f"{out}: {len(items)} images, {sheet.width}x{sheet.height}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
