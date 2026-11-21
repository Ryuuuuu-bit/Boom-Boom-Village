"""Generate the pixel-art GUI skin (9-slice textures) for Boom Boom Village.
Style follows the approved mockup A: carved wood frames, parchment, green tabs/buttons.
Output: assets/ui/skin/*.png at native pixel size (CSS scales them x3 with border-image)."""
import random, os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ui', 'skin')
os.makedirs(OUT, exist_ok=True)
T = (0, 0, 0, 0)
OL = (52, 27, 14, 255)
WOOD = [(96, 52, 26), (128, 72, 36), (156, 94, 48), (184, 122, 66), (212, 156, 96)]
PAP = [(226, 196, 146), (238, 216, 170), (246, 230, 194), (252, 242, 216)]
TAN = [(150, 100, 52), (190, 142, 84), (214, 176, 116)]

def rgba(c): return c if len(c) == 4 else c + (255,)

def img(w, h): return Image.new('RGBA', (w, h), T)

def rect(im, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            im.putpixel((x, y), rgba(c))

def cut(im, r):
    """remove pixels outside a corner radius r (pixel-art rounded corners)"""
    w, h = im.size
    pat = {1: [1], 2: [2, 1], 3: [3, 1, 1], 4: [4, 2, 1, 1]}[r]
    for i, n in enumerate(pat):
        for x in range(n):
            for (px, py) in ((x, i), (w - 1 - x, i), (x, h - 1 - i), (w - 1 - x, h - 1 - i)):
                im.putpixel((px, py), T)
    return pat

def outline_round(im, r):
    """after cut(), paint an outline along the new rounded border"""
    w, h = im.size
    px = im.load()
    out = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0: continue
            edge = x in (0, w - 1) or y in (0, h - 1)
            if not edge:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if px[x + dx, y + dy][3] == 0: edge = True
            if edge: out.append((x, y))
    for p in out: px[p] = OL

def wood_fill(im, x0, y0, x1, y1, vertical, seed, shades=WOOD, period=None):
    rnd = random.Random(seed)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    L = h if not vertical else w
    # base bands across the plank thickness: light top -> dark bottom
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            t = ((y - y0) / max(1, h - 1)) if not vertical else ((x - x0) / max(1, w - 1))
            k = 3 if t < .18 else 2 if t < .7 else 1
            im.putpixel((x, y), rgba(shades[k]))
    # grain streaks along plank length (tiles with given period)
    n = (w if not vertical else h)
    per = period or n
    for i in range(max(2, per // 4)):
        a = rnd.randrange(per); ln = rnd.randint(3, 7); row = rnd.randrange(1, max(2, L - 1))
        c = shades[rnd.choice([1, 1, 2, 3])]
        for j in range(ln):
            s = (a + j) % per
            for rep in range(0, n, per):
                if s + rep >= n: continue
                if not vertical: im.putpixel((x0 + s + rep, y0 + row), rgba(c))
                else: im.putpixel((x0 + row, y0 + s + rep), rgba(c))

def frame():
    """big modal frame 48x48, slice 16: wood planks + parchment centre"""
    S, B = 48, 15
    im = img(S, S)
    rect(im, 0, 0, S - 1, S - 1, OL)
    wood_fill(im, 1, 1, S - 2, B - 1, False, 1, period=16)            # top
    wood_fill(im, 1, S - B, S - 2, S - 2, False, 2, period=16)        # bottom
    wood_fill(im, 1, B, B - 1, S - B - 1, True, 3, period=16)         # left
    wood_fill(im, S - B, B, S - 2, S - B - 1, True, 4, period=16)     # right
    # plank seams in the middle of each edge segment
    # corner blocks
    for cx, cy in ((1, 1), (S - B, 1), (1, S - B), (S - B, S - B)):
        rect(im, cx, cy, cx + B - 2, cy + B - 2, WOOD[2])
        rect(im, cx, cy, cx + B - 2, cy, WOOD[4]); rect(im, cx, cy, cx, cy + B - 2, WOOD[3])
        rect(im, cx, cy + B - 2, cx + B - 2, cy + B - 2, WOOD[0]); rect(im, cx + B - 2, cy, cx + B - 2, cy + B - 2, WOOD[0])
        # carved X
        for d in range(3, B - 4):
            im.putpixel((cx + d, cy + d), rgba(WOOD[1])); im.putpixel((cx + B - 2 - d, cy + d), rgba(WOOD[1]))
        # nail
        mx, my = cx + (B - 1) // 2, cy + (B - 1) // 2
        rect(im, mx - 1, my - 1, mx + 1, my + 1, (70, 60, 56)); im.putpixel((mx - 1, my - 1), rgba((190, 180, 170)))
    # inner groove + parchment centre
    rect(im, B - 1, B - 1, S - B, S - B, OL)
    rect(im, B, B, S - B - 1, S - B - 1, PAP[2])
    rect(im, B, B, S - B - 1, B, (200, 160, 104)); rect(im, B, B, B, S - B - 1, (214, 178, 124))
    cut(im, 2); outline_round(im, 2)
    im.save(os.path.join(OUT, 'frame.png'))

def zigzag():
    """tribal woven band (tile 24x9) for the frame bottom"""
    W, H = 24, 9
    im = img(W, H)
    cols = [(150, 62, 34), (196, 98, 44), (230, 156, 64), (120, 46, 28)]
    for y in range(H):
        for x in range(W):
            im.putpixel((x, y), rgba(cols[0]))
    for x in range(W):
        p = x % 12; hgt = p if p <= 6 else 12 - p
        for y in range(H):
            d = abs((H - 2 - y) - hgt)
            if d == 0: im.putpixel((x, y), rgba(cols[2]))
            elif d == 1: im.putpixel((x, y), rgba(cols[1]))
    # turquoise diamonds
    for cx in (6, 18):
        cy = 6 if cx == 6 else 2
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= cy + dy < H: im.putpixel((cx + dx, cy + dy), rgba((64, 170, 170)))
    rect(im, 0, 0, W - 1, 0, OL); rect(im, 0, H - 1, W - 1, H - 1, OL)
    im.save(os.path.join(OUT, 'zigzag.png'))

def plaque():
    """title plaque 30x22 slice 10: light carved wood with inner bevel"""
    W, H = 30, 22
    im = img(W, H)
    rect(im, 0, 0, W - 1, H - 1, OL)
    wood_fill(im, 1, 1, W - 2, H - 2, False, 9, shades=[(150, 92, 46), (186, 124, 66), (210, 154, 92), (228, 182, 120), (244, 208, 150)])
    rect(im, 4, 4, W - 5, H - 5, (120, 70, 34))
    rect(im, 5, 5, W - 6, H - 6, (238, 206, 150))
    rect(im, 5, 5, W - 6, 5, (250, 226, 180))
    rect(im, 5, H - 6, W - 6, H - 6, (220, 182, 122))
    cut(im, 2); outline_round(im, 2)
    im.save(os.path.join(OUT, 'plaque.png'))

def ornament():
    """small carved diamond ornament 13x13 used beside titles"""
    im = img(13, 13); c1, c2 = (150, 84, 40), (110, 60, 28)
    for y in range(13):
        for x in range(13):
            d = abs(x - 6) + abs(y - 6)
            if d in (6,): im.putpixel((x, y), rgba(c2))
            elif d in (4,): im.putpixel((x, y), rgba(c1))
            elif d <= 1: im.putpixel((x, y), rgba(c2))
    for x, y in ((6, 0), (6, 12), (0, 6), (12, 6)):
        im.putpixel((x, y), rgba(c1))
    im.save(os.path.join(OUT, 'ornament.png'))

def button(name, c, r=2, W=16, H=16, inner=None):
    """c = (light, mid, dark). Glossy pixel button with dark outline and bottom lip."""
    lt, md, dk = c
    im = img(W, H)
    rect(im, 0, 0, W - 1, H - 1, OL)
    rect(im, 1, 1, W - 2, H - 2, md)
    rect(im, 1, H - 4, W - 2, H - 2, dk)               # bottom lip (3D)
    rect(im, 1, 1, W - 2, 2, lt)                        # top shine
    rect(im, 2, 3, 2, H - 5, lt)                        # left shine
    hi = tuple(min(255, v + 40) for v in lt)
    rect(im, 3, 1, 6, 1, hi)
    if inner: rect(im, 3, 3, W - 4, H - 5, inner)
    cut(im, r); outline_round(im, r)
    im.save(os.path.join(OUT, name + '.png'))

def card():
    """item card 24x24 slice 8: parchment, tan double border, rounded"""
    W = 24; im = img(W, W)
    rect(im, 0, 0, W - 1, W - 1, TAN[0])
    rect(im, 1, 1, W - 2, W - 2, TAN[2])
    rect(im, 2, 2, W - 3, W - 3, TAN[1])
    rect(im, 3, 3, W - 4, W - 4, PAP[3])
    rect(im, 3, W - 5, W - 4, W - 4, PAP[1])
    rect(im, 3, 3, W - 4, 3, (255, 250, 232))
    pat = cut(im, 3)
    px = im.load()
    for y in range(W):
        for x in range(W):
            if px[x, y][3] == 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < W) or px[nx, ny][3] == 0:
                    px[x, y] = rgba(TAN[0]); break
    # little corner flourish
    for (x, y) in ((4, 4), (5, 4), (4, 5), (W - 5, 4), (W - 6, 4), (W - 5, 5), (4, W - 5), (5, W - 5), (4, W - 6), (W - 5, W - 5), (W - 6, W - 5), (W - 5, W - 6)):
        px[x, y] = rgba(TAN[2])
    im.save(os.path.join(OUT, 'card.png'))

def inset():
    """recessed parchment box 12x12 slice 4 (price box, inputs, bars)"""
    W = 12; im = img(W, W)
    rect(im, 0, 0, W - 1, W - 1, TAN[0])
    rect(im, 1, 1, W - 2, W - 2, PAP[2])
    rect(im, 1, 1, W - 2, 1, TAN[1]); rect(im, 1, 1, 1, W - 2, PAP[1])
    cut(im, 1)
    im.save(os.path.join(OUT, 'inset.png'))

def hudbox():
    """dark wooden HUD frame 24x24 slice 8"""
    W = 24; im = img(W, W)
    rect(im, 0, 0, W - 1, W - 1, OL)
    wood_fill(im, 1, 1, W - 2, 6, False, 21, period=8)
    wood_fill(im, 1, W - 7, W - 2, W - 2, False, 22, period=8)
    wood_fill(im, 1, 7, 6, W - 8, True, 23, period=8)
    wood_fill(im, W - 7, 7, W - 2, W - 8, True, 24, period=8)
    rect(im, 6, 6, W - 7, W - 7, OL)
    rect(im, 7, 7, W - 8, W - 8, (62, 36, 20))
    rect(im, 7, 7, W - 8, 7, (44, 24, 12))
    cut(im, 2); outline_round(im, 2)
    im.save(os.path.join(OUT, 'hud.png'))

def slot(name, face, rim):
    """tool slot 24x24 slice 8: wood rim + face"""
    W = 24; im = img(W, W)
    rect(im, 0, 0, W - 1, W - 1, OL)
    wood_fill(im, 1, 1, W - 2, W - 2, False, 31, shades=rim, period=8)
    rect(im, 4, 4, W - 5, W - 5, rim[0])
    rect(im, 5, 5, W - 6, W - 6, face[1])
    rect(im, 5, 5, W - 6, 6, face[2]); rect(im, 5, W - 7, W - 6, W - 6, face[0])
    cut(im, 2); outline_round(im, 2)
    im.save(os.path.join(OUT, name + '.png'))

def bar():
    """progress bar trough 12x10 slice 4 + fills"""
    im = img(12, 10)
    rect(im, 0, 0, 11, 9, OL); rect(im, 1, 1, 10, 8, (54, 32, 18)); rect(im, 1, 1, 10, 2, (36, 20, 10))
    cut(im, 1); im.save(os.path.join(OUT, 'bar.png'))
    for name, c in (('fill_green', ((176, 236, 104), (110, 190, 60), (64, 140, 36))), ('fill_gold', ((255, 232, 120), (246, 182, 46), (196, 120, 20)))):
        f = img(4, 8)
        for y in range(8):
            k = 0 if y < 2 else 1 if y < 6 else 2
            for x in range(4): f.putpixel((x, y), rgba(c[k]))
        f.save(os.path.join(OUT, name + '.png'))

frame(); zigzag(); plaque(); ornament(); card(); inset(); hudbox(); bar()
button('btn_green', ((150, 214, 86), (92, 164, 50), (52, 112, 30)))
button('btn_gold', ((255, 226, 110), (240, 170, 40), (182, 108, 18)))
button('btn_red', ((246, 120, 96), (210, 62, 44), (140, 32, 22)))
button('btn_blue', ((128, 204, 246), (60, 138, 214), (32, 84, 152)))
button('btn_purple', ((196, 160, 252), (134, 94, 214), (84, 52, 152)))
button('btn_wood', ((224, 170, 106), (178, 116, 62), (120, 70, 34)))
button('tab_on', ((150, 214, 86), (92, 164, 50), (66, 130, 38)), r=2, W=18, H=18)
button('tab_off', ((248, 230, 190), (232, 204, 150), (196, 156, 96)), r=2, W=18, H=18)
slot('slot', ((214, 180, 120), (236, 210, 160), (248, 230, 192)), [(96, 52, 26), (128, 72, 36), (156, 94, 48), (184, 122, 66), (212, 156, 96)])
slot('slot_on', ((230, 170, 40), (255, 210, 80), (255, 236, 150)), [(110, 66, 20), (170, 110, 30), (214, 150, 46), (240, 190, 70), (255, 222, 120)])
slot('slot_blue', ((150, 196, 226), (190, 224, 246), (222, 242, 255)), [(96, 52, 26), (128, 72, 36), (156, 94, 48), (184, 122, 66), (212, 156, 96)])
print('ok', sorted(os.listdir(OUT)))
