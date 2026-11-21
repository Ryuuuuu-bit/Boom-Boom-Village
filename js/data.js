/* Boom Boom Village — ข้อมูลเกมทั้งหมด (ปรับตัวเลขที่นี่ได้โดยไม่ต้องแก้โค้ดส่วนอื่น) */
'use strict';
const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

const CFG = {
  TILE: 32, ZOOM: 2, SPEED: 100,
  MAP_W: 48, MAP_H: 32,           // ขนาดที่ดินสูงสุดในยุค 1
  START_W: 24, START_H: 16,       // ที่ดินเริ่มต้น
  START: { shells: 30, amber: 10, feathers: 0, seeds: { pumpkin: 5 } },
  TUTORIAL_GROW_MS: 30 * 1000,    // พืชในบทสอนโตใน 30 วินาที
  PEST_CHANCE: 0.2, DRY_MIN_MS: 10 * MIN, // หนอน เกิดกับพืชที่โต >= 10 นาที
  // ---- ระบบดินชื้น (แบบเกมฟาร์มจริงจัง) ----
  WET_FRAC: 0.55,                 // รดน้ำ 1 ครั้ง ดินชุ่มนาน 55% ของเวลาโตทั้งหมด (พืชส่วนใหญ่ต้องรด 2 รอบ)
  WET_MIN_MS: 90 * 1000, WET_MAX_MS: 8 * HOUR, WET_EMPTY_MS: 30 * MIN,
  DRY_RATE: 0.3,                  // ดินแห้ง พืชโตช้าลงเหลือ 30% (ไม่ตาย ไม่เหี่ยว)
  CAN_MAX: 20,                    // บัวรดน้ำจุ 20 ครั้ง เติมที่บ่อน้ำ/แม่น้ำ/ตอนฝนตก
  RAIN_BLOCK_MS: 3 * HOUR, RAIN_CHANCE: 0.2, // ทุก 3 ชม. มีโอกาสฝนตก 20% (ทุกคนเห็นฝนตกพร้อมกัน)
  REGROW_FRAC: 0.45,              // ผักเก็บซ้ำได้ โตรอบใหม่ใช้เวลา 45%
  SPEEDUP_PER_AMBER_MS: 15 * MIN, FREE_SPEEDUP_MS: 2 * MIN,
  STORAGE_BASE: 50, STORAGE_STEP: 25,
  HELP_PER_FRIEND: 5, HELP_PER_DAY: 20,
  PRANK_PER_FRIEND: 1, PRANK_PER_DAY: 3, PRANK_PER_DAY_LV15: 5,
  PRANK_EXPIRE_MS: 6 * HOUR, REVENGE_WINDOW_MS: 12 * HOUR,
  BOT_PRANKS_TO_SHIELD: 3,        // โดนแกล้งครบ 3 ครั้ง/วัน ได้โล่ถึงเที่ยงคืน
  NEWBIE_SHIELD_MS: 1 * DAY,      // GDD ตั้งไว้ 3 วัน ต้นแบบเล่นคนเดียวลดเหลือ 1 วันเพื่อให้เห็นระบบ
  BOT_ACT_MIN_MS: 20 * MIN, BOT_ACT_MAX_MS: 50 * MIN, // เพื่อนบอทมาที่หมู่บ้านเราทุก ๆ 20-50 นาที
  GOOSE_CATCH: 0.25,
  ORDER_NEW_MS: 5 * MIN, ORDER_DISCARD_MS: 15 * MIN,
  VILLAGER_WATER_PER_DAY: 3, MAX_VILLAGERS: 12,
  RETURN_GIFT_DAYS: 3,
  XP_HELP: 2, XP_FEED_HELP: 4,
};
const XP_NEED = (lv) => Math.round((20 * Math.pow(lv, 1.6)) / 5) * 5;
const MAX_LEVEL_ERA1 = 19;

// ---------- ของทั้งหมด ----------
// cat: crop / animal / fruit / goods / material / special
const ITEMS = {
  millet:   { n: 'ข้าวฟ่าง', cat: 'crop', price: 3, icon: 'ic_millet' },
  pumpkin:  { n: 'ฟักทอง', cat: 'crop', price: 20, icon: 'ic_pumpkin' },
  corn:     { n: 'ข้าวโพดป่า', cat: 'crop', price: 18, icon: 'ic_corn' },
  taro:     { n: 'มันเผือกยักษ์', cat: 'crop', price: 30, icon: 'ic_taro' },
  melon:    { n: 'แตงโมลายหิน', cat: 'crop', price: 75, icon: 'ic_melon' },
  chili:    { n: 'พริกไฟ', cat: 'crop', price: 30, icon: 'ic_chili' },
  bean:     { n: 'ถั่วยักษ์', cat: 'crop', price: 90, icon: 'ic_bean' },
  rice:     { n: 'ข้าวเหนียวโบราณ', cat: 'crop', price: 100, icon: 'ic_rice' },
  egg:      { n: 'ไข่ไดโน', cat: 'animal', price: 35, icon: 'ic_egg' },
  truffle:  { n: 'เห็ดหอม', cat: 'animal', price: 55, icon: 'ic_truffle' },
  wool:     { n: 'ขนฟู', cat: 'animal', price: 70, icon: 'ic_wool' },
  plume:    { n: 'ขนนกสีรุ้ง', cat: 'animal', price: 110, icon: 'ic_plume' },
  milk:     { n: 'นมแมมมอธ', cat: 'animal', price: 200, icon: 'ic_milk' },
  banana:   { n: 'กล้วย', cat: 'fruit', price: 8, icon: 'ic_banana' },
  coconut:  { n: 'มะพร้าว', cat: 'fruit', price: 20, icon: 'ic_coconut' },
  mango:    { n: 'มะม่วง', cat: 'fruit', price: 30, icon: 'ic_mango' },
  pie:      { n: 'พายฟักทอง', cat: 'goods', price: 120, icon: 'ic_pie' },
  popcorn:  { n: 'ข้าวโพดคั่ว', cat: 'goods', price: 75, icon: 'ic_popcorn' },
  flour:    { n: 'แป้ง', cat: 'goods', price: 25, icon: 'ic_flour' },
  bread:    { n: 'ขนมปังหิน', cat: 'goods', price: 95, icon: 'ic_bread' },
  scarf:    { n: 'ผ้าพันคอ', cat: 'goods', price: 260, icon: 'ic_scarf' },
  hat:      { n: 'หมวกขนนก', cat: 'goods', price: 320, icon: 'ic_hat' },
  wood:     { n: 'ไม้', cat: 'material', price: 5, icon: 'ic_wood' },
  stone:    { n: 'หิน', cat: 'material', price: 5, icon: 'ic_stone' },
  vine:     { n: 'เชือกเถาวัลย์', cat: 'material', price: 5, icon: 'ic_vine' },
  pin:      { n: 'หมุดหิน', cat: 'material', price: 0, icon: 'ic_pin', nosell: true },
  compost:  { n: 'ปุ๋ยใบไม้', cat: 'special', price: 0, icon: 'ic_compost', nosell: true },
};
const STORED_CATS = ['crop', 'animal', 'fruit', 'goods']; // นับรวมในยุ้งฉาง

// ---------- พืช (GDD 3.1) ----------
const CROPS = {
  millet:  { n: 'ข้าวฟ่าง', lv: 1, ms: 2 * MIN, seed: 2, yield: 2, xp: 1, img: 'crop_millet' },
  pumpkin: { n: 'ฟักทอง', lv: 1, ms: 10 * MIN, seed: 5, yield: 1, xp: 3, img: 'crop_pumpkin_3_ripe' },
  corn:    { n: 'ข้าวโพดป่า', lv: 3, ms: 30 * MIN, seed: 8, yield: 2, xp: 5, img: 'crop_corn', regrow: 2 },
  taro:    { n: 'มันเผือกยักษ์', lv: 5, ms: 1 * HOUR, seed: 12, yield: 2, xp: 8, img: 'crop_taro' },
  melon:   { n: 'แตงโมลายหิน', lv: 8, ms: 4 * HOUR, seed: 25, yield: 2, xp: 20, img: 'crop_watermelon' },
  chili:   { n: 'พริกไฟ', lv: 11, ms: 2 * HOUR, seed: 20, yield: 3, xp: 14, img: 'crop_chili', regrow: 3 },
  bean:    { n: 'ถั่วยักษ์', lv: 14, ms: 8 * HOUR, seed: 40, yield: 3, xp: 40, img: 'crop_bean', regrow: 3 },
  rice:    { n: 'ข้าวเหนียวโบราณ', lv: 18, ms: 12 * HOUR, seed: 60, yield: 4, xp: 60, img: 'crop_rice' },
};
const QUALITY = [{ n: 'ธรรมดา', star: '' }, { n: 'เกรดเงิน', star: '⭐', bonus: 0.25, xp: 1.5 }, { n: 'เกรดทอง', star: '🌟', bonus: 0.5, xp: 2 }];
const PLOTS_BY_LEVEL = (lv) => Math.min(60, 6 + (lv - 1) * 3);

// ---------- สัตว์ (GDD 3.2) ----------
const ANIMALS = {
  dino:    { n: 'ไดโนน้อย', lv: 2, price: 80, eat: { pumpkin: 1 }, ms: 30 * MIN, give: 'egg', img: 'animal_dino' },
  boar:    { n: 'หมูป่า', lv: 4, price: 120, eat: { corn: 2 }, ms: 1 * HOUR, give: 'truffle', img: 'animal_boar' },
  goat:    { n: 'แพะขนฟู', lv: 7, price: 200, eat: { millet: 4 }, ms: 2 * HOUR, give: 'wool', img: 'animal_goat' },
  bird:    { n: 'นกหงอนยักษ์', lv: 10, price: 320, eat: { taro: 1 }, ms: 3 * HOUR, give: 'plume', img: 'animal_bird' },
  mammoth: { n: 'แมมมอธแคระ', lv: 15, price: 600, eat: { melon: 1 }, ms: 6 * HOUR, give: 'milk', img: 'animal_mammoth' },
};
const PEN_CAP = [4, 6, 8];
const PEN_UPGRADE = [{ shells: 300, wood: 10, stone: 5 }, { shells: 800, wood: 20, stone: 15, vine: 10 }];

// ---------- โรงผลิต (GDD 3.3) ----------
const FACTORIES = {
  oven:   { n: 'เตาหิน', lv: 3, price: 150, recipes: [
    { out: 'pie', in: { pumpkin: 2, egg: 1 }, ms: 20 * MIN, xp: 15 },
    { out: 'popcorn', in: { corn: 3 }, ms: 10 * MIN, xp: 8 },
    { out: 'bread', in: { flour: 2, egg: 1 }, ms: 30 * MIN, xp: 12 } ] },
  mortar: { n: 'ครกหิน', lv: 6, price: 250, recipes: [
    { out: 'flour', in: { millet: 5 }, ms: 15 * MIN, xp: 5 } ] },
  loom:   { n: 'กี่ทอผ้า', lv: 9, price: 400, recipes: [
    { out: 'scarf', in: { wool: 3 }, ms: 1 * HOUR, xp: 30 },
    { out: 'hat', in: { plume: 2, wool: 1 }, ms: 2 * HOUR, xp: 40 } ] },
};
const QUEUE_SLOT_PRICE = [0, 0, 100, 250, 500]; // ช่องที่ 3,4,5

// ---------- สิ่งก่อสร้าง / ของแต่ง ----------
// w,h = ฐานกินพื้น (ช่อง)  beauty = คะแนนความสวย
const BUILDS = {
  chief:    { n: 'กระท่อมหัวหน้าเผ่า', w: 3, h: 2, img: 'building_chief', fixed: true },
  market:   { n: 'ตลาดกลางหมู่บ้าน', w: 3, h: 2, img: 'building_market', fixed: true },
  storage:  { n: 'ยุ้งฉาง', w: 3, h: 2, img: 'building_storage', fixed: true },
  ordertree:{ n: 'ต้นไม้คำขอ', w: 2, h: 1, img: 'building_ordertree', fixed: true },
  bonfire:  { n: 'กองไฟกลางเผ่า', w: 1, h: 1, img: 'deco_campfire', fixed: true },
  pen:      { n: 'คอกสัตว์', w: 5, h: 4, img: null, lv: 2, price: 100, cat: 'building', d: 'คอกละ 4 ตัว อัปเกรดได้' },
  hut:      { n: 'กระท่อมชาวบ้าน', w: 3, h: 2, img: 'building_hut', lv: 2, price: 150, cat: 'building', d: 'ได้ชาวบ้าน 1 คน ช่วยรดน้ำดินแห้งวันละ 3 ครั้ง', beauty: 5 },
  oven:     { n: 'เตาหิน', w: 2, h: 1, img: 'building_oven', lv: 3, price: 150, cat: 'building', factory: 'oven' },
  mortar:   { n: 'ครกหิน', w: 2, h: 1, img: 'building_mortar', lv: 6, price: 250, cat: 'building', factory: 'mortar' },
  loom:     { n: 'กี่ทอผ้า', w: 2, h: 1, img: 'building_loom', lv: 9, price: 400, cat: 'building', factory: 'loom' },
  t_banana: { n: 'ต้นกล้วย', w: 1, h: 1, img: 'tree_banana', lv: 1, price: 60, cat: 'tree', fruit: 'banana', ms: 20 * MIN, beauty: 2 },
  t_coconut:{ n: 'ต้นมะพร้าว', w: 1, h: 1, img: 'tree_coconut', lv: 4, price: 120, cat: 'tree', fruit: 'coconut', ms: 45 * MIN, beauty: 3 },
  t_mango:  { n: 'ต้นมะม่วง', w: 1, h: 1, img: 'tree_mango', lv: 7, price: 200, cat: 'tree', fruit: 'mango', ms: 90 * MIN, beauty: 3 },
  fence:    { n: 'รั้วไม้', w: 3, h: 1, img: 'deco_fence', lv: 1, price: 10, cat: 'deco', beauty: 1 },
  campfire: { n: 'กองไฟ', w: 1, h: 1, img: 'deco_campfire', lv: 1, price: 25, cat: 'deco', beauty: 3 },
  flowers:  { n: 'ดอกไม้ป่า', w: 1, h: 1, img: 'deco_flowers', lv: 1, price: 15, cat: 'deco', beauty: 2 },
  torch:    { n: 'คบไฟไม้ไผ่', w: 1, h: 1, img: 'deco_torch', lv: 2, price: 30, cat: 'deco', beauty: 3 },
  statue:   { n: 'รูปปั้นหิน', w: 1, h: 1, img: 'deco_statue', lv: 3, price: 80, cat: 'deco', beauty: 8 },
  drum:     { n: 'กลองเผ่า', w: 1, h: 1, img: 'deco_drum', lv: 4, price: 120, cat: 'deco', beauty: 5 },
  flag:     { n: 'ธงเผ่า', w: 1, h: 1, img: 'deco_flag', lv: 5, price: 90, cat: 'deco', beauty: 4 },
  arch:     { n: 'ซุ้มกระดูก', w: 2, h: 1, img: 'deco_arch', lv: 8, price: 300, cat: 'deco', beauty: 10 },
  totem:    { n: 'เสาโทเท็มใหญ่', w: 1, h: 1, img: 'deco_totem', lv: 10, price: 600, cat: 'deco', beauty: 15 },
  d_bed_r:  { n: 'แปลงดอกไม้แดง', w: 1, h: 1, img: 'vp_bed_red', lv: 1, price: 20, cat: 'deco', beauty: 2 },
  d_bed_y:  { n: 'แปลงดอกไม้เหลือง', w: 1, h: 1, img: 'vp_bed_yellow', lv: 1, price: 20, cat: 'deco', beauty: 2 },
  d_bed_p:  { n: 'แปลงดอกไม้ม่วง', w: 1, h: 1, img: 'vp_bed_purple', lv: 2, price: 25, cat: 'deco', beauty: 2 },
  d_pot:    { n: 'กระถางดอกไม้', w: 1, h: 1, img: 'vp_flowerpot', lv: 1, price: 15, cat: 'deco', beauty: 2 },
  d_bench:  { n: 'ม้านั่งไม้', w: 1, h: 1, img: 'vp_bench', lv: 2, price: 35, cat: 'deco', beauty: 3 },
  d_lamp:   { n: 'เสาตะเกียง', w: 1, h: 1, img: 'vp_lamppost', lv: 2, price: 40, cat: 'deco', beauty: 3 },
  d_topiary:{ n: 'พุ่มไม้ตัดแต่ง', w: 1, h: 1, img: 'vp_topiary', lv: 3, price: 50, cat: 'deco', beauty: 4 },
  d_scare:  { n: 'หุ่นไล่กา', w: 1, h: 1, img: 'vp_scarecrow', lv: 3, price: 60, cat: 'deco', beauty: 4 },
  d_slant:  { n: 'โคมหิน', w: 1, h: 1, img: 'vp_stonelantern', lv: 4, price: 90, cat: 'deco', beauty: 5 },
  d_hive:   { n: 'รังผึ้ง', w: 1, h: 1, img: 'vp_beehive', lv: 5, price: 110, cat: 'deco', beauty: 5 },
  d_well:   { n: 'บ่อน้ำ', w: 1, h: 1, img: 'vp_well', lv: 6, price: 180, cat: 'deco', beauty: 7 },
  d_palm:   { n: 'ปาล์มกระถาง', w: 1, h: 1, img: 'vp_pottedpalm', lv: 6, price: 120, cat: 'deco', beauty: 5 },
  d_arch:   { n: 'ซุ้มดอกไม้', w: 1, h: 1, img: 'vp_arch', lv: 7, price: 220, cat: 'deco', beauty: 8 },
  d_bunt:   { n: 'เสาธงราว', w: 1, h: 1, img: 'vp_bunting', lv: 8, price: 160, cat: 'deco', beauty: 6 },
  bigstatue:{ n: 'รูปปั้นหัวหน้าเผ่ายักษ์', w: 2, h: 2, img: 'deco_bigstatue', lv: 12, price: 3000, cat: 'deco', beauty: 50 },
  krathong: { n: 'แพใบตอง', w: 1, h: 1, img: 'deco_krathong', lv: 1, price: 0, cat: 'event', beauty: 12, coin: 30 },
  lantern:  { n: 'โคมใบตาล', w: 1, h: 1, img: 'deco_lantern', lv: 1, price: 0, cat: 'event', beauty: 8, coin: 18 },
  goose:    { n: 'ห่านยาม', w: 1, h: 1, img: 'animal_goose', lv: 9, price: 0, feathers: 25, cat: 'kind', d: 'มีโอกาส 25% จับคนที่มาแกล้ง', beauty: 2 },
  rock:     { n: 'ก้อนหิน', w: 1, h: 1, img: 'debris_rock', debris: { stone: 2 } },
  bush:     { n: 'พุ่มไม้', w: 1, h: 1, img: 'debris_bush', debris: { vine: 2 } },
  log:      { n: 'ขอนไม้', w: 1, h: 1, img: 'debris_log', debris: { wood: 2 } },
};
const STARS = [0, 20, 60, 150, 300, 600]; // คะแนนความสวยที่ได้ดาว 1..5
const EXPAND_COST = (n) => (n === 0 ? { shells: 50, pin: 0 } : { shells: Math.round(500 * Math.pow(1.6, n - 1) / 10) * 10, pin: n });
const STORAGE_UPGRADE = (n) => ({ shells: 200 * (n + 1), wood: 5 + 5 * n, stone: 5 + 5 * n, vine: 3 + 3 * n });

// ---------- การแกล้ง (GDD 7.3) ----------
const PRANKS = {
  mud:     { n: 'โคลนสาด', lv: 1, e: '🟤', d: 'คราบโคลนบนทางเดิน' },
  sticker: { n: 'แปะสติกเกอร์หน้าตลก', lv: 1, e: '🤪', d: 'สติกเกอร์บนรูปปั้นหรือบ้าน' },
  monkey:  { n: 'ลิงขโมยผลไม้', lv: 3, e: '🐒', d: 'ลิงนั่งกินผลไม้บนต้น (เอาไป 1 ลูก)' },
  boar:    { n: 'ปล่อยหมูป่า', lv: 5, e: '🐗', d: 'หมูป่าวิ่งเล่นทั่วหมู่บ้าน' },
  leaves:  { n: 'โปรยใบไม้', lv: 7, e: '🍂', d: 'ใบไม้เต็มลาน กวาดแล้วได้ปุ๋ย' },
  rooster: { n: 'ไก่ขันปลุก', lv: 12, e: '🐓', d: 'ไก่ป่าเกาะหลังคาขันเสียงดัง' },
};
const STICKERS = ['😜', '🤪', '😝', '😎', '🤡', '😹', '👻'];

// ---------- เพื่อนบอท ----------
const BOTS = [
  { id: 'pupu', n: 'ปูปู้', e: '😈', img: 'npc_pupu', d: 'หัวหน้าเผ่าข้างบ้าน ขี้แกล้งสุด ๆ', prankRate: 0.65, seed: 11, tint: 0xffd0a0, stars: 2 },
  { id: 'mali', n: 'น้องมะลิ', e: '🌸', img: 'npc_mali', d: 'ชอบดอกไม้ ใจดี นาน ๆ แกล้งที', prankRate: 0.2, seed: 23, tint: 0xffc8e8, stars: 3 },
  { id: 'to',   n: 'พี่โต', e: '💪', img: 'npc_to', d: 'ตัวใหญ่ใจดี ชอบมาช่วย', prankRate: 0.35, seed: 37, tint: 0xc8e0ff, stars: 1 },
];
const QUICK_MSG = ['ขอบใจนะ! 🙏', 'เจอกันแน่! 😤', 'ฮ่า ๆ ขำมาก 😂', 'ไว้ไปช่วยคืนนะ 💛'];

// ---------- ภารกิจ ----------
// บทสอน (11 ข้อ ตาม GDD) + เนื้อเรื่องหลัก (บท 2-5)
const STORY = [
  { ch: 'บทที่ 1 · หัวหน้าเผ่าคนใหม่', steps: [
    { t: 'ไถดิน 1 ช่อง (เดินไปที่หญ้าว่าง แล้วกด Space)', k: 'till', n: 1, r: { shells: 5 } },
    { t: 'ปลูกเมล็ดฟักทอง 1 แปลง', k: 'plant', n: 1, r: { shells: 5 } },
    { t: 'รดน้ำต้นที่เพิ่งปลูก', k: 'water', n: 1, r: { shells: 5 } },
    { t: 'รอฟักทองสุกแล้วเก็บ (บทสอนโตใน 30 วินาที)', k: 'harvest', n: 1, r: { shells: 10, xp: 5 } },
    { t: 'ขายของที่ตลาดกลางหมู่บ้าน 1 ชิ้น', k: 'sell', n: 1, r: { shells: 10 } },
    { t: 'ให้อาหารไดโนน้อยในคอก', k: 'feed', n: 1, r: { shells: 10 } },
    { t: 'ไปเยี่ยมหมู่บ้านปูปู้ (ปุ่ม 👥 เพื่อน)', k: 'visit', n: 1, r: { shells: 10 } },
    { t: 'ช่วยปูปู้ 1 ครั้ง (รดน้ำ ไล่หนอน หรือให้อาหารสัตว์)', k: 'help', n: 1, r: { shells: 10, feathers: 1 } },
    { t: 'ลองแกล้งปูปู้ 1 ครั้งจากแถบสีม่วง', k: 'prank', n: 1, r: { shells: 5 } },
    { t: 'กลับบ้านแล้วกวาดรอยแกล้งที่ปูปู้มาเอาคืน', k: 'clean', n: 1, r: { shells: 15, feathers: 2 } },
    { t: 'สร้างหรือวางของแต่งชิ้นแรก (ปุ่ม 🔨 สร้าง)', k: 'build', n: 1, r: { shells: 20, amber: 5 } },
  ] },
  { ch: 'บทที่ 2 · ไฟแรกของเผ่า', steps: [
    { t: 'ขยายที่ดินครั้งแรก (ราคาพิเศษ 🐚50)', k: 'expand', n: 1, r: { shells: 30 } },
    { t: 'ส่งคำสั่งซื้อที่ต้นไม้คำขอ 2 ใบ', k: 'order', n: 2, r: { shells: 40, xp: 10 } },
    { t: 'สร้างเตาหิน (ปลดที่ Lv 3)', k: 'build_oven', n: 1, r: { shells: 40 } },
    { t: 'อบพายฟักทอง 1 ชิ้น', k: 'make_pie', n: 1, r: { shells: 50, xp: 10 } },
    { t: 'เก็บไข่ไดโน 3 ฟอง', k: 'collect_egg', n: 3, r: { amber: 5 } },
  ] },
  { ch: 'บทที่ 3 · เผ่าขยายตัว', steps: [
    { t: 'สร้างกระท่อมชาวบ้าน 1 หลัง', k: 'build_hut', n: 1, r: { shells: 60 } },
    { t: 'ปลูกข้าวโพดป่า 5 แปลง', k: 'plant_corn', n: 5, r: { shells: 50 } },
    { t: 'เก็บกวาดก้อนหิน/พุ่มไม้/ขอนไม้ 5 ชิ้น', k: 'clear', n: 5, r: { shells: 40, xp: 10 } },
    { t: 'อัปเกรดยุ้งฉาง 1 ขั้น', k: 'storage_up', n: 1, r: { amber: 5 } },
    { t: 'ทำให้หมู่บ้านได้ 2 ดาว (คะแนนความสวย 20)', k: 'stars', n: 2, r: { shells: 80, amber: 5 } },
  ] },
  { ch: 'บทที่ 4 · เพื่อนบ้านที่ดี', steps: [
    { t: 'ช่วยเพื่อน 10 ครั้ง', k: 'help', n: 10, r: { shells: 80, feathers: 3 } },
    { t: 'เยี่ยมเพื่อนครบทั้ง 3 คน', k: 'visit_all', n: 3, r: { shells: 50 } },
    { t: 'กวาดรอยแกล้ง 5 ครั้ง', k: 'clean', n: 5, r: { feathers: 5 } },
    { t: 'แกล้งคืนหรือช่วยกลับจากบันทึก 1 ครั้ง', k: 'reply', n: 1, r: { shells: 50 } },
    { t: 'รับของขวัญหมุดหินจากเพื่อน 3 ชิ้น', k: 'gift', n: 3, r: { amber: 5 } },
  ] },
  { ch: 'บทที่ 5 · เตรียมพิธีเลื่อนยุค', steps: [
    { t: 'ถึงเลเวล 10', k: 'level', n: 10, r: { amber: 10 } },
    { t: 'ทอผ้าพันคอ 1 ผืน', k: 'make_scarf', n: 1, r: { shells: 200 } },
    { t: 'หมู่บ้านได้ 4 ดาว', k: 'stars', n: 4, r: { amber: 10 } },
    { t: 'ถึงเลเวล 19 แล้วทำพิธีเลื่อนยุคที่กองไฟกลาง', k: 'era', n: 2, r: { amber: 50 } },
  ] },
];

const DAILY_POOL = {
  easy: [
    { t: 'เก็บผลผลิต 10 ครั้ง', k: 'harvest', n: 10 },
    { t: 'ปลูกพืช 8 แปลง', k: 'plant', n: 8 },
    { t: 'ขายของ 10 ชิ้น', k: 'sell', n: 10 },
    { t: 'เก็บผลไม้ 3 ครั้ง', k: 'fruit', n: 3 },
  ],
  mid: [
    { t: 'ส่งคำสั่งซื้อ 2 ใบ', k: 'order', n: 2 },
    { t: 'ให้อาหารสัตว์ 4 ครั้ง', k: 'feed', n: 4 },
    { t: 'ผลิตของในโรงผลิต 2 ชิ้น', k: 'make', n: 2 },
    { t: 'เก็บกวาดหิน/พุ่มไม้/ขอนไม้ 3 ชิ้น', k: 'clear', n: 3 },
  ],
  social: [
    { t: 'ช่วยเพื่อน 3 ครั้ง', k: 'help', n: 3 },
    { t: 'เยี่ยมเพื่อน 2 คน', k: 'visit_uniq', n: 2 },
    { t: 'กวาดรอยแกล้ง 2 ครั้ง', k: 'clean', n: 2 },
    { t: 'ให้อาหารสัตว์ของเพื่อน 1 ครั้ง', k: 'help_feed', n: 1 },
  ],
};

const LOGIN_WHEEL = [
  { shells: 30 }, { amber: 2 }, { shells: 60, wood: 3 }, { feathers: 2 }, { shells: 100, stone: 3 }, { amber: 5 },
  { amber: 10, deco: 'drum' },
];

// ความสำเร็จ 3 ขั้น
const ACHIEVEMENTS = [
  { k: 'harvest', n: 'ชาวนาตัวจริง', tiers: [50, 500, 5000], title: ['มือใหม่หัดปลูก', 'ชาวนาขยัน', 'เจ้าแห่งทุ่ง'] },
  { k: 'sell', n: 'พ่อค้าเปลือกหอย', tiers: [50, 500, 5000], title: ['แม่ค้าน้อย', 'เถ้าแก่ตลาด', 'เศรษฐีเปลือกหอย'] },
  { k: 'help', n: 'เพื่อนแท้', tiers: [20, 200, 2000], title: ['ใจดี', 'ที่พึ่งของเพื่อน', 'นางฟ้าประจำเผ่า'] },
  { k: 'prank', n: 'จอมป่วน', tiers: [10, 100, 1000], title: ['ขี้แกล้ง', 'ตัวป่วน', 'ราชาแห่งความป่วน'] },
  { k: 'clean', n: 'สายกวาด', tiers: [10, 100, 1000], title: ['มือไว', 'แม่บ้านดีเด่น', 'ไม่กลัวโคลน'] },
  { k: 'order', n: 'ส่งของตรงเวลา', tiers: [10, 100, 1000], title: ['คนส่งของ', 'พ่อค้าเร่', 'ราชาโลจิสติกส์'] },
  { k: 'collect', n: 'คนรักสัตว์', tiers: [20, 200, 2000], title: ['คนเลี้ยงสัตว์', 'หมอสัตว์ป่า', 'เจ้าแห่งคอก'] },
  { k: 'make', n: 'ช่างฝีมือ', tiers: [10, 100, 1000], title: ['ลูกมือ', 'ช่างใหญ่', 'ปรมาจารย์'] },
  { k: 'build', n: 'สถาปนิกยุคหิน', tiers: [10, 50, 200], title: ['ช่างไม้', 'นักสร้าง', 'สถาปนิกเผ่า'] },
  { k: 'clear', n: 'นักบุกเบิก', tiers: [10, 100, 500], title: ['คนถางป่า', 'นักบุกเบิก', 'ผู้พิชิตป่า'] },
];

// ---------- อีเวนต์ ----------
const EVENTS = [
  { id: 'loykrathong2026', n: 'ลอยแพใบตอง', coin: 'แพจิ๋ว', coinIcon: 'ic_coin_krathong', start: '2026-11-15', end: '2026-12-01',
    d: 'เก็บผลผลิต ส่งคำสั่งซื้อ และช่วยเพื่อน จะได้ "แพจิ๋ว" เอาไปแลกของแต่งเทศกาลได้',
    shop: [{ b: 'krathong', cost: 30 }, { b: 'lantern', cost: 18 }, { amber: 5, cost: 25 }, { feathers: 3, cost: 15 }] },
];
const WEEKEND_BUFFS = [
  { id: 'x2', n: 'เทศกาลผลผลิต x2', d: 'เก็บพืชได้ผลผลิต 2 เท่า' },
  { id: 'market', n: 'ตลาดนัดสุดสัปดาห์', d: 'ขายของที่ตลาดได้ราคา +20%' },
  { id: 'kind', n: 'สุดสัปดาห์แห่งน้ำใจ', d: 'ช่วยเพื่อนได้ขนนกทอง x2' },
];

// ---------- ยุค ----------
const ERAS = [
  { n: 'ยุคหินเริ่มต้น', lv: 1 },
  { n: 'ยุคไฟและดินเผา', lv: 20 },
];
const ERA_CEREMONY = { pumpkin: 30, pie: 10, wool: 10, scarf: 3, corn: 30, shells: 3000 };

const TIPS = [
  'กดค้างแล้วลากผ่านแปลงผัก เพื่อทำหลายช่องรวดเดียว',
  'ผักไม่มีวันเหี่ยว หายไปหลายวันกลับมาก็ยังอยู่ครบ',
  'โดนแกล้งไม่ต้องเครียด กวาดแล้วได้รางวัลมากกว่าที่เสียไปเสมอ',
  'ปลูกพืชให้ตรงกับเวลาที่จะกลับมา ก่อนนอนลองปลูกถั่วยักษ์ 8 ชั่วโมง',
  'ช่วยเพื่อนได้ขนนกทอง เอาไปแลกห่านยามไว้จับคนแกล้ง',
  'ของแต่งเพิ่มความสวย หมู่บ้านยิ่งสวย เพื่อนมาเยี่ยมยิ่งได้รางวัลมาก',
];
