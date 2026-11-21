"""Region map v2 for chibi character frames (character creator recolouring).
0 = keep, 1 = hair, 2 = skin, 3 = outfit (leaves), 4 = cape/cloth.
v2: wider skin detection (arms/legs), cape/outfit kept only as large connected areas (no speckles),
and masks are downscaled by majority vote instead of nearest-pixel sampling."""
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


def keep_big(mask, min_px):
    lab, n = ndimage.label(mask)
    if not n: return mask
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= min_px])


def region_mask(a, view='south'):
    h, s, l = hsl(a)
    op = a[:, :, 3] > 40
    H = a.shape[0]
    ys = np.where(op.any(1))[0]
    if not len(ys): return np.zeros(a.shape[:2], np.uint8)
    top, bot = ys.min(), ys.max()
    yrel = np.broadcast_to((np.arange(H)[:, None] - top) / max(1, bot - top), op.shape)
    area = op.sum()
    m = np.zeros(a.shape[:2], np.uint8)
    # ผม (เหมือนเดิม)
    brown = op & (h >= 6) & (h <= 34) & (s > 0.2) & (s < 0.62) & (l > 0.12) & (l < 0.52)
    lab, n = ndimage.label(brown)
    hair = np.zeros_like(brown)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        comp = lab[sl] == i + 1
        if comp.sum() < 30: continue
        if yrel[sl][comp].min() < 0.30 and yrel[sl][comp].mean() < 0.62: hair[sl] |= comp
    hair = ndimage.binary_closing(hair, iterations=1) & brown
    m[hair] = 1
    # ผ้าคลุม/กระโปรงส้มแดง (หาก่อนผิว เพราะสีใกล้กัน: ผ้าแดงกว่าและเข้มกว่าผิว) เฉพาะก้อนใหญ่
    cape = op & ~hair & ((h <= 17) | (h > 340)) & (s > 0.45) & (l > 0.22) & (l < 0.64) & (yrel > 0.36)
    cape = keep_big(ndimage.binary_closing(cape, iterations=1) & op & ~hair, max(40, area * 0.012))
    m[cape] = 4
    # ผิว: พีชสว่าง (หน้า แขน ขา) ไม่รวมขนสัตว์สีครีมจาง ๆ และผ้าคลุม
    peach = op & ~hair & ~cape & (h >= 6) & (h <= 32) & (l > 0.40) & (l < 0.90)
    fur = (s < 0.55) & (l > 0.70)
    core = peach & ~fur & (h >= 15) & (s > 0.6) & (l >= 0.56) & (yrel > 0.16)
    core = keep_big(core, max(12, area * 0.002))
    grow = peach & ~fur & (s > 0.45) & (yrel > 0.16)
    skin = core.copy()
    for _ in range(3): skin |= ndimage.binary_dilation(skin) & grow
    skin = (ndimage.binary_closing(skin, iterations=2) | ndimage.binary_fill_holes(skin)) & peach & ~fur
    if view == 'north' and cape.any():  # ด้านหลัง: ลายขอบผ้าคลุมสีครีมไม่ใช่ผิว (ผิวมีแค่ใบหูกับขาใต้ผ้า)
        cy = np.where(cape.any(1))[0]; cx = np.where(cape.any(0))[0]
        band = np.zeros_like(skin); band[cy.min():cy.max() + max(3, (bot - top) // 25), cx.min():cx.max() + 1] = True
        skin &= ~band
    m[skin] = 2
    # ชุดใบไม้: เขียว/เขียวเหลือง ใต้หัว เฉพาะก้อนใหญ่
    leaf = op & (m == 0) & (h > 40) & (h < 150) & (s > 0.18) & (l > 0.12) & (yrel > 0.38)
    leaf = keep_big(ndimage.binary_closing(leaf, iterations=1) & op & (m == 0), max(20, area * 0.006))
    m[leaf] = 3
    return m


def downsample(mask, size):
    """ย่อแผนที่ส่วนแบบเสียงข้างมาก (ไม่ใช่สุ่มพิกเซล) ให้ขอบเรียบ ไม่เป็นจุดด่าง"""
    cov = np.stack([np.asarray(Image.fromarray(((mask == k) * 255).astype(np.uint8)).resize(size, Image.BOX), float) for k in range(5)])
    out = cov.argmax(0).astype(np.uint8)
    out[cov.max(0) < 90] = 0
    return Image.fromarray(out * 60)
