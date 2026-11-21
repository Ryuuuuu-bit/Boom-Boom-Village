"""Region map for chibi character frames, used for in-game recolouring (character creator).
0 = keep, 1 = hair, 2 = skin, 3 = outfit (leaves), 4 = cape/cloth."""
import numpy as np
from PIL import Image
from scipy import ndimage


def hsl(a):
    rgb = a[:, :, :3].astype(float) / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(2), rgb.min(2); d = mx - mn; l = (mx + mn) / 2
    s = np.where(d == 0, 0, d / (1 - abs(2 * l - 1) + 1e-6))
    h = np.where(mx == r, ((g - b) / (d + 1e-9)) % 6, np.where(mx == g, (b - r) / (d + 1e-9) + 2, (r - g) / (d + 1e-9) + 4)) * 60
    return np.where(d > 0, h, 0), s, l


def region_mask(a, view='south'):
    """a: HxWx4 uint8 array of ONE character cell. Returns HxW uint8 region ids."""
    h, s, l = hsl(a)
    op = a[:, :, 3] > 40
    H = a.shape[0]
    ys = np.where(op.any(1))[0]
    if not len(ys): return np.zeros(a.shape[:2], np.uint8)
    top, bot = ys.min(), ys.max()
    yrel = np.broadcast_to((np.arange(H)[:, None] - top) / max(1, bot - top), op.shape)
    m = np.zeros(a.shape[:2], np.uint8)
    # ผม: กลุ่มพิกเซลสีน้ำตาลเข้มที่ต่อกันจากด้านบนของหัว (ไม่รวมรองเท้า/เข็มขัดด้านล่าง)
    brown = op & (h >= 6) & (h <= 34) & (s > 0.2) & (s < 0.62) & (l > 0.12) & (l < 0.52)
    lab, n = ndimage.label(brown)
    hair = np.zeros_like(brown)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        comp = lab[sl] == i + 1
        if comp.sum() < 30: continue
        if yrel[sl][comp].min() < 0.30 and yrel[sl][comp].mean() < 0.62: hair[sl] |= comp
    hair = ndimage.binary_closing(hair, iterations=1) & brown
    m[hair] = 1
    # ผิว: สีพีช (ไม่รวมขนสัตว์ที่สว่างมาก) + เงาผิวที่ติดกัน
    skin = op & ~hair & (h >= 8) & (h <= 28) & (s > 0.7) & (l >= 0.55) & (l < 0.84) & (yrel > 0.18)
    skin &= ~((l > 0.74) & ((h > 27.5) | (s < 0.85)))
    near = ndimage.binary_dilation(skin, iterations=2)
    skin |= near & op & ~hair & (h >= 14) & (h <= 28) & (s > 0.7) & (l >= 0.45) & (l < 0.55)
    # หน้า: พิกเซลพีชสว่างช่วงหัวเป็นผิวทั้งหมด (ขนสัตว์อยู่ต่ำกว่า) + อุดรูในผิว ไม่ให้เป็นจุดด่างตอนเปลี่ยนสีผิว
    peach = op & ~hair & (h >= 5) & (h <= 34) & (s > 0.4) & (l > 0.42) & (l < 0.93)
    skin |= peach & (yrel > 0.18) & (yrel < 0.5) & (l < 0.9)
    skin = (ndimage.binary_closing(skin, iterations=2) | ndimage.binary_fill_holes(skin)) & peach
    m[skin] = 2
    # ชุดใบไม้ (ใต้หัว)
    m[op & (m == 0) & (h > 44) & (h < 150) & (s > 0.18) & (l > 0.12) & (yrel > 0.38)] = 3
    # ผ้าคลุม/กระโปรงสีส้มแดง (ใต้หัว)
    m[op & (m == 0) & ((h < 22) | (h > 340)) & (s > 0.5) & (l > 0.22) & (l < 0.66) & (yrel > 0.36)] = 4
    return m


def region_sheet(sheet, fw, views):
    """sheet: PIL RGBA. views: dict row -> view. Returns region image (L mode, value = id*60 for preview-friendly)."""
    a = np.array(sheet); out = np.zeros(a.shape[:2], np.uint8)
    for r, v in views.items():
        for c in range(a.shape[1] // fw):
            cell = a[r * fw:(r + 1) * fw, c * fw:(c + 1) * fw]
            out[r * fw:(r + 1) * fw, c * fw:(c + 1) * fw] = region_mask(cell, v)
    return out
