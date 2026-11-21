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
    if k.endswith('_sheet'): continue
    im = Image.open(f).convert('RGBA')
    keep = k.startswith('stg_') or k in KEEP or k == 'soil_dry'
    if not keep:
        bb = im.getbbox()
        if bb: im = im.crop(bb)
    if k in sizes: tw = sizes[k]
    elif k in out['images']:
        old = Image.open(io.BytesIO(base64.b64decode(out['images'][k].split(',')[1]))); tw = old.width
    else: raise SystemExit('no size for hd image ' + k)
    w = tw * HD_MUL; h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    out['images'][k] = uri(im); out['hd'][k] = HD_MUL
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
