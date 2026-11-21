# สร้างไฟล์ assets.js (รวมภาพทั้งหมดเป็นข้อความ) เพื่อให้ index.html เปิดด้วยดับเบิลคลิกได้
import base64, io, json, os, glob
from PIL import Image
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(G, 'assets')

def uri(img):
    b = io.BytesIO(); img.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

out = {'images': {}, 'sheets': {}, 'wang': {}, 'sounds': {}}
# ตัดขอบใสออกทุกภาพ (ให้ฐานของวัตถุแตะพื้นพอดี) ยกเว้นภาพพืชที่ต้องอยู่กึ่งกลางช่อง
KEEP = {'crop_pumpkin_0_soil', 'crop_pumpkin_1_sprout', 'crop_pumpkin_2_growing'}
for f in sorted(glob.glob(os.path.join(A, 'sprites', '*.png'))):
    k = os.path.basename(f)[:-4]
    if k.startswith('crop_'): continue  # ภาพพืช pixel เก่า เลิกใช้แล้ว (ใช้ stg_*_4 แทน)
    im = Image.open(f).convert('RGBA')
    if k not in KEEP and not k.startswith('stg_') and k != 'soil_dry':
        bb = im.getbbox()
        if bb: im = im.crop(bb)
    out['images'][k] = uri(im)
for f in sorted(glob.glob(os.path.join(A, 'icons', '*.png'))):
    out['images'][os.path.basename(f)[:-4]] = uri(Image.open(f).convert('RGBA'))
# ภาพ chibi ความละเอียดสูง (assets/hd/<key>.png) แทนภาพเดิมชื่อเดียวกัน
# แสดงขนาดเท่าภาพเดิม (หรือกว้างตาม hd/sizes.json) แต่เก็บภาพจริงไว้ HD_MUL เท่า
HD_MUL = 2
out['hd'] = {}
sizes = {}
if os.path.exists(os.path.join(A, 'hd', 'sizes.json')): sizes = json.load(open(os.path.join(A, 'hd', 'sizes.json')))
for f in sorted(glob.glob(os.path.join(A, 'hd', '*.png'))):
    k = os.path.basename(f)[:-4]
    if k.endswith('_sheet') or k.startswith('ch_'): continue
    im = Image.open(f).convert('RGBA')
    keep = k.startswith('stg_') or k in KEEP or k == 'soil_dry'
    if not keep:
        bb = im.getbbox()
        if bb: im = im.crop(bb)
    if k.startswith(('ic_', 'ui_')):  # ไอคอน: วางกลางผืนสี่เหลี่ยมจัตุรัส (เท่าไอคอนเดิม 32px แต่เก็บละเอียด)
        side = max(im.size) + 8; sq = Image.new('RGBA', (side, side)); sq.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2)); im = sq
        tw = 32; mul = 3  # แสดง 32px ในฉาก (เก็บ 96px ให้คมในหน้าต่าง HTML)
    else: mul = HD_MUL
    if k.startswith(('ic_', 'ui_')): pass
    elif k in sizes: tw = sizes[k]
    elif k in out['images']:
        old = Image.open(io.BytesIO(base64.b64decode(out['images'][k].split(',')[1]))); tw = old.width
    else: raise SystemExit('no size for hd image ' + k)
    w = tw * mul; h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    out['images'][k] = uri(im); out['hd'][k] = mul
for f in sorted(glob.glob(os.path.join(A, 'ground', '*.png'))):
    out['images'][os.path.basename(f)[:-4]] = uri(Image.open(f).convert('RGBA'))
# เสียง (mp3 ที่ย่อขนาดแล้ว)
for f in sorted(glob.glob(os.path.join(A, 'sfx', '*.mp3'))):
    out['sounds'][os.path.basename(f)[:-4]] = 'data:audio/mpeg;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
# จัดเท้าตัวละครทุกเฟรมให้อยู่ระดับเดียวกัน (y=46) เพราะภาพต้นฉบับแต่ละแถววางไม่ตรงกัน
src = Image.open(os.path.join(A, 'villager_sheet.png')).convert('RGBA')
sheet = Image.new('RGBA', src.size, (0, 0, 0, 0))
for r in range(src.height // 48):
    for c in range(src.width // 48):
        cell = src.crop((c * 48, r * 48, c * 48 + 48, r * 48 + 48))
        bb = cell.getbbox()
        if not bb: continue
        sheet.alpha_composite(cell, (c * 48, r * 48 + (46 - bb[3])))
out['sheets']['villager'] = {'uri': uri(sheet), 'w': 48, 'h': 48}
# ตัวละคร chibi: สร้างสไปรต์ชีตเลย์เอาต์เดียวกับ villager (แถวละ 6 เฟรม) จากภาพนิ่ง 4 ทิศ + ขยับเด้งเป็นท่าเดิน/หายใจ
if os.path.exists(os.path.join(A, 'hd', 'ch_south.png')):
    import math
    FW = 96; CH_H = 84  # เฟรม 96x96 (แสดง 48x48), ตัวสูง ~42px บนจอ
    poses = {}
    for d in ['south', 'west', 'east', 'north']:
        im = Image.open(os.path.join(A, 'hd', 'ch_%s.png' % d)).convert('RGBA'); im = im.crop(im.getbbox())
        poses[d] = im.resize((round(im.width * CH_H / im.height), CH_H), Image.LANCZOS)
    rows = {1: 'south', 2: 'west', 3: 'east', 4: 'north', 5: 'south', 6: 'west', 7: 'east', 8: 'north'}
    hd = Image.new('RGBA', (FW * 6, FW * 9))
    for r, d in rows.items():
        for c in range(6):
            im = poses[d]
            if r <= 4:  # idle: หายใจ
                sy = 1 - 0.025 * math.sin(c / 4 * 2 * math.pi); sx = 1 + 0.012 * math.sin(c / 4 * 2 * math.pi); bob = 0; rot = 0
            else:  # walk: เด้ง + เอียง
                ph = c / 6 * 2 * math.pi; bob = -abs(math.sin(ph)) * 6; sy = 1 - 0.03 * abs(math.cos(ph)); sx = 1; rot = 4 * math.sin(ph) if d in ('south', 'north') else 2.5 * math.sin(ph)
            fr = im.resize((round(im.width * sx), round(im.height * sy)), Image.LANCZOS)
            if rot: fr = fr.rotate(rot, resample=Image.BICUBIC, expand=True)
            x = c * FW + (FW - fr.width) // 2; y = r * FW + 92 - fr.height + round(bob)
            hd.alpha_composite(fr, (x, y))
    out['sheets']['villager'] = {'uri': uri(hd), 'w': FW, 'h': FW, 'hd': 2}
for n in ['dirt', 'soil', 'water']:
    out['sheets']['ts_' + n] = {'uri': uri(Image.open(os.path.join(A, 'tileset_grass_%s.png' % n)).convert('RGBA')), 'w': 32, 'h': 32}
    d = json.load(open(os.path.join(A, 'tileset_grass_%s.json' % n)))
    m = {}
    for t in d['tileset_data']['tiles']:
        c = t['corners']; bb = t['bounding_box']
        key = ''.join('1' if c[k] == 'lower' else '0' for k in ['NW', 'NE', 'SW', 'SE'])
        m[key] = (bb['y'] // 32) * 4 + bb['x'] // 32
    out['wang'][n] = m
with open(os.path.join(G, 'assets.js'), 'w') as fh:
    fh.write('// ไฟล์นี้สร้างอัตโนมัติจาก tools/build_assets.py ห้ามแก้ด้วยมือ\nwindow.GAME_ASSETS = ' + json.dumps(out) + ';\n')
print('ok', os.path.getsize(os.path.join(G, 'assets.js')))
