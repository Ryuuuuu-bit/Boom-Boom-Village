# สร้างไฟล์ assets.js (รวมภาพทั้งหมดเป็นข้อความ) เพื่อให้ index.html เปิดด้วยดับเบิลคลิกได้
import base64, io, json, os, glob, sys
from PIL import Image
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(G, 'assets')

def uri(img):
    # เลือกแบบที่ไฟล์เล็กกว่า: WebP (ย่อแบบเสียคุณภาพน้อยมาก) หรือ PNG
    b = io.BytesIO(); img.save(b, 'PNG', optimize=True)
    w = io.BytesIO(); img.save(w, 'WEBP', quality=86, method=6, alpha_quality=90)
    if w.tell() < b.tell() * 0.9: return 'data:image/webp;base64,' + base64.b64encode(w.getvalue()).decode()
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
import math
def chibi_sheet(files, CH_H=84, FW=96, walk_prefix=None):
    poses = {}
    walk = None
    if walk_prefix and os.path.exists(os.path.join(A, 'hd', walk_prefix + 'south_0.png')):
        walk = {}
        raw = {d: [Image.open(os.path.join(A, 'hd', '%s%s_%d.png' % (walk_prefix, d, i))).convert('RGBA') for i in range(4)] for d in ['south', 'north', 'west', 'east']}
        for d, frs in raw.items():
            frs = [f.crop(f.getbbox()) for f in frs]
            sc = CH_H / sorted(f.height for f in frs)[1]  # ขนาดเท่ากันทุกเฟรมในทิศเดียวกัน
            walk[d] = [f.resize((round(f.width * sc), round(f.height * sc)), Image.LANCZOS) for f in frs]
    for d, fn in files.items():
        im = Image.open(os.path.join(A, 'hd', fn)).convert('RGBA'); im = im.crop(im.getbbox())
        poses[d] = im.resize((round(im.width * CH_H / im.height), CH_H), Image.LANCZOS)
    rows = {1: 'south', 2: 'west', 3: 'east', 4: 'north', 5: 'south', 6: 'west', 7: 'east', 8: 'north'}
    hd = Image.new('RGBA', (FW * 6, FW * 9))
    for r, d in rows.items():
        if r > 4 and walk and d in walk:  # มีภาพท่าเดินจริง 4 เฟรม: ใช้แทนท่าเด้ง
            for c, fr in enumerate(walk[d]): hd.alpha_composite(fr, (c * FW + (FW - fr.width) // 2, r * FW + 92 - fr.height))
            continue
        for c in range(6):
            im = poses[d]
            if r <= 4:  # idle: หายใจ
                sy = 1 - 0.025 * math.sin(c / 4 * 2 * math.pi); sx = 1 + 0.012 * math.sin(c / 4 * 2 * math.pi); bob = 0; rot = 0
            else:  # walk: เด้ง + เอียง
                ph = c / 6 * 2 * math.pi; bob = -abs(math.sin(ph)) * 6; sy = 1 - 0.03 * abs(math.cos(ph)); sx = 1; rot = 4 * math.sin(ph) if d in ('south', 'north') else 2.5 * math.sin(ph)
            fr = im.resize((round(im.width * sx), round(im.height * sy)), Image.LANCZOS)
            if rot: fr = fr.rotate(rot, resample=Image.BICUBIC, expand=True)
            hd.alpha_composite(fr, (c * FW + (FW - fr.width) // 2, r * FW + 92 - fr.height + round(bob)))
    return {'uri': uri(hd), 'w': FW, 'h': FW, 'hd': 2, 'walk': 4 if walk else 6}
def player_sheet(prefix, CH_H=84, FW=96):
    """ชีตตัวผู้เล่นจากท่าเดิน 4 ทิศ x 4 เฟรม: แถว 1-4 ยืนหายใจ (ใช้เฟรมที่ขาชิดที่สุด), แถว 5-8 เดิน
    คืนค่า (ชีต, แผนที่ส่วน) แผนที่ส่วนใช้เปลี่ยนสีผม/ผิว/ชุดในเกม (ตัวสร้างตัวละคร)"""
    import numpy as np
    sys.path.insert(0, os.path.dirname(__file__)); from regions import region_mask, downsample
    walk, masks = {}, {}
    for d in ['south', 'north', 'west', 'east']:
        frs = [Image.open(os.path.join(A, 'hd', '%s%s_%d.png' % (prefix, d, i))).convert('RGBA') for i in range(4)]
        frs = [f.crop(f.getbbox()) for f in frs]
        ms = [region_mask(np.array(f), d) for f in frs]
        sc = CH_H / sorted(f.height for f in frs)[1]
        walk[d] = [f.resize((round(f.width * sc), round(f.height * sc)), Image.LANCZOS) for f in frs]
        masks[d] = [downsample(m, f.size) for m, f in zip(ms, walk[d])]
    rows = {1: 'south', 2: 'west', 3: 'east', 4: 'north', 5: 'south', 6: 'west', 7: 'east', 8: 'north'}
    hd = Image.new('RGBA', (FW * 6, FW * 9)); rm = Image.new('L', hd.size)
    for r, d in rows.items():
        if r > 4:
            for c, (fr, m) in enumerate(zip(walk[d], masks[d])):
                pos = (c * FW + (FW - fr.width) // 2, r * FW + 92 - fr.height)
                hd.alpha_composite(fr, pos); rm.paste(m, pos, fr.split()[3].point(lambda v: 255 if v > 0 else 0))
            continue
        k = min(range(4), key=lambda i: walk[d][i].width)
        for c in range(4):
            sy = 1 - 0.025 * math.sin(c / 4 * 2 * math.pi); sx = 1 + 0.012 * math.sin(c / 4 * 2 * math.pi)
            sz = (round(walk[d][k].width * sx), round(walk[d][k].height * sy))
            fr = walk[d][k].resize(sz, Image.LANCZOS); m = masks[d][k].resize(sz, Image.NEAREST)
            pos = (c * FW + (FW - fr.width) // 2, r * FW + 92 - fr.height)
            hd.alpha_composite(fr, pos); rm.paste(m, pos, fr.split()[3].point(lambda v: 255 if v > 0 else 0))
    return hd, rm
# ตัวผู้เล่น ชาย (villager) / หญิง (villager_f) + แผนที่ส่วนสำหรับเปลี่ยนสี (rg_m / rg_f)
for g, pre in [('m', 'ch_wk_'), ('f', 'ch_wkf_')]:
    if not os.path.exists(os.path.join(A, 'hd', pre + 'south_0.png')): continue
    hd, rm = player_sheet(pre)
    hd.save('/tmp/bbv_sheet_%s.png' % g); rm.save('/tmp/bbv_rg_%s.png' % g)
    b = io.BytesIO(); rm.save(b, 'PNG', optimize=True)
    out['sheets']['villager' if g == 'm' else 'villager_f'] = {'uri': uri(hd), 'w': 96, 'h': 96, 'hd': 2, 'walk': 4}
    out['images']['rg_' + g] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
for v in ['vm', 'vw']:  # ชาวบ้านชาย/หญิง (มีแค่ท่าหน้าตรง ใช้ทุกทิศ)
    if os.path.exists(os.path.join(A, 'hd', 'ch_%s.png' % v)):
        out['sheets']['vil_' + v] = chibi_sheet({d: 'ch_%s.png' % v for d in ['south', 'west', 'east', 'north']}, CH_H=78)
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
