"""Slice a crop growth sheet (cols = stages 0..4, rows = crops) into assets/hd/stg_<crop>_<i>.png.
All stages of a crop share one square canvas, bottom-centred, so the mound stays put as the plant grows.
usage: python3 tools/slice_crops.py SHEET crop1,crop2,..."""
import sys, os
import numpy as np
from PIL import Image
src, crops = sys.argv[1], sys.argv[2].split(',')
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'hd')
im = Image.open(src).convert('RGBA'); W, H = im.size
COLS, ROWS = 5, len(crops)
cw, ch = W / COLS, H / ROWS
for r, crop in enumerate(crops):
    cells = [im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))) for c in range(COLS)]
    for c in cells:  # wipe faint noise
        a = np.array(c); a[a[:, :, 3] < 20] = 0; c.paste(Image.fromarray(a))
    boxes = [c.getbbox() for c in cells]
    top = min(b[1] for b in boxes); bot = max(b[3] for b in boxes)
    l = min(b[0] for b in boxes); rt = max(b[2] for b in boxes)
    side = max(bot - top, rt - l) + 4
    for i, c in enumerate(cells):
        canvas = Image.new('RGBA', (side, side))
        cx = (l + rt) // 2
        canvas.alpha_composite(c.crop((cx - side // 2, top, cx - side // 2 + side, bot)) if False else c.crop((l, top, rt, bot)), ((side - (rt - l)) // 2, side - (bot - top) - 2))
        canvas.save(os.path.join(OUT, 'stg_%s_%d.png' % (crop, i)))
    print(crop, side)
