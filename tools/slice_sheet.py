"""Slice a ChatGPT chibi sprite sheet (transparent PNG, grid layout) into assets/hd/<key>.png.
usage: python3 tools/slice_sheet.py SHEET COLS ROWS key1,key2,...  (keys in reading order, '-' to skip)"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
src, cols, rows, keys = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(',')
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'hd')
im = Image.open(src).convert('RGBA'); a = np.array(im)
alpha = a[:, :, 3]
lab, n = ndimage.label(alpha > 24)
H, W = alpha.shape
cells = {}
for i, sl in enumerate(ndimage.find_objects(lab)):
    area = (lab[sl] == i + 1).sum()
    if area < 150: continue
    cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
    c = min(cols - 1, int(cx / W * cols)); r = min(rows - 1, int(cy / H * rows))
    cells.setdefault(r * cols + c, []).append(i + 1)
for idx, key in enumerate(keys):
    if key == '-' or idx not in cells: 
        if key != '-': print('MISSING', key)
        continue
    m = np.isin(lab, cells[idx])
    # keep soft edges: dilate mask by 2px and use original alpha
    m = ndimage.binary_dilation(m, iterations=2)
    ys, xs = np.where(m)
    b = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    part = a[b[1]:b[3], b[0]:b[2]].copy()
    part[:, :, 3] = np.where(m[b[1]:b[3], b[0]:b[2]], part[:, :, 3], 0)
    Image.fromarray(part).save(os.path.join(OUT, key + '.png'))
    print(key, b[2] - b[0], b[3] - b[1])
