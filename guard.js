// Boom Boom Village — ตรวจเซฟกันโกง (ฝั่งเซิร์ฟเวอร์)
// แนวคิด: เกมยังคำนวณบนเครื่องผู้เล่น แต่ทุกครั้งที่ส่งเซฟขึ้นมา เซิร์ฟเวอร์เทียบกับเซฟก่อนหน้า
// แล้วจำกัดว่า "มูลค่า" (เงินทุกชนิดรวมกัน) และ XP เพิ่มได้ไม่เกินถังโควตาที่เติมขึ้นตามเวลาจริง
// ถ้าเกิน: ตัดส่วนเกินทิ้ง บันทึกลง cheat_log และบอกเครื่องผู้เล่นให้ปรับตัวเลขตาม
'use strict';

// มูลค่าของเงินแต่ละชนิด (หน่วย = เปลือกหอย)
const VALUE = { shells: 1, amber: 100, feathers: 30, coins: 10 };
// ถังมูลค่า: เต็มได้สูงสุด CAP และเติม RATE ต่อวินาที (โตตามเลเวล)
const vCap = (lv) => 5000 + 600 * lv;               // lv1 = 5,600 · lv19 = 16,400
const vRate = (lv) => 2 + lv;                       // lv1 = 10,800/ชม. · lv19 = 75,600/ชม.
// XP: ขึ้นได้ประมาณ 1 เลเวลต่อ 30 นาที สะสมได้สูงสุด 1 เลเวล
const XP_NEED = (lv) => Math.round((20 * Math.pow(lv, 1.6)) / 5) * 5;
const xCap = (lv) => XP_NEED(lv) + 50;
const xRate = (lv) => XP_NEED(lv) / 1800;
const MAX_LEVEL = (era) => (era >= 2 ? 34 : 19);
const totalXp = (lv, xp) => { let t = 0; for (let i = 1; i < lv; i++) t += XP_NEED(i); return t + xp; };
// เซฟใหม่ (ยังไม่มีบนเซิร์ฟเวอร์) เทียบกับค่าตั้งต้นของเกม
const FRESH = { shells: 30, amber: 10, feathers: 0, event: { coins: 0 }, level: 1, xp: 0, era: 1, storageLvl: 0 };

const int = (v) => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : null);
const val = (d) => VALUE.shells * (int(d.shells) || 0) + VALUE.amber * (int(d.amber) || 0) + VALUE.feathers * (int(d.feathers) || 0) + VALUE.coins * (int(d.event && d.event.coins) || 0);

// ตรวจและแก้ data (แก้ในตัว) คืน { guard, fixed, notes }
function check(data, prev, prevGuard, nowMs) {
  const notes = []; const fixed = {};
  const base = prev || FRESH;
  const g = prevGuard && prevGuard.t ? { ...prevGuard } : { t: nowMs, v: vCap(int(base.level) || 1), x: xCap(int(base.level) || 1) };
  const lvPrev = Math.max(1, int(base.level) || 1);
  const dt = Math.max(0, Math.min(30 * 86400, (nowMs - g.t) / 1000));
  g.v = Math.min(vCap(lvPrev), g.v + vRate(lvPrev) * dt);
  g.x = Math.min(xCap(lvPrev), g.x + xRate(lvPrev) * dt);
  g.t = nowMs;

  // 1) ค่าที่ไม่ใช่ตัวเลข/ติดลบ ใช้ค่าเดิม
  for (const k of ['shells', 'amber', 'feathers', 'xp', 'level', 'era', 'storageLvl']) {
    const n = int(data[k]);
    if (n === null) {
      const missing = data[k] === undefined || data[k] === null;
      data[k] = int(base[k]) || (k === 'level' || k === 'era' ? 1 : 0);
      if (!missing) { fixed[k] = data[k]; notes.push('bad_' + k); }
    } else data[k] = n;
  }
  data.event = data.event && typeof data.event === 'object' ? data.event : { coins: 0 };
  const c = int(data.event.coins); data.event.coins = c === null ? int(base.event && base.event.coins) || 0 : c;
  if (data.inv && typeof data.inv === 'object') for (const [k, v] of Object.entries(data.inv)) { const n = int(v); if (n === null || n > 9999) { data.inv[k] = Math.min(9999, n || 0); notes.push('inv_' + k); fixed.inv = data.inv; } }

  // 2) ยุค/ยุ้งฉาง ขึ้นทีละนิด
  const eraPrev = int(base.era) || 1;
  if (data.era > Math.min(2, eraPrev + 1)) { data.era = eraPrev; fixed.era = eraPrev; notes.push('era'); }
  const stPrev = int(base.storageLvl) || 0;
  if (data.storageLvl > stPrev + 2) { data.storageLvl = stPrev; fixed.storageLvl = stPrev; notes.push('storage'); }

  // 3) เลเวล/XP
  if (data.level < 1) data.level = 1;
  if (data.level > MAX_LEVEL(data.era)) { data.level = MAX_LEVEL(data.era); fixed.level = data.level; notes.push('level_max'); }
  if (data.xp > XP_NEED(data.level) + 5) { data.xp = XP_NEED(data.level); fixed.xp = data.xp; notes.push('xp_over'); }
  const dx = totalXp(data.level, data.xp) - totalXp(lvPrev, int(base.xp) || 0);
  if (dx > g.x) {
    data.level = lvPrev; data.xp = int(base.xp) || 0; fixed.level = data.level; fixed.xp = data.xp; notes.push(`xp+${dx}>${Math.round(g.x)}`);
  } else if (dx > 0) g.x -= dx;

  // 4) มูลค่าเงินรวม
  const dv = val(data) - val(base);
  if (dv > g.v) {
    let excess = dv - Math.floor(g.v); notes.push(`value+${dv}>${Math.round(g.v)}`);
    // ตัดส่วนที่เพิ่มขึ้นผิดปกติ เริ่มจากอำพัน (เงินพรีเมียม) ก่อน
    const cut = (key, get, set) => {
      if (excess <= 0) return;
      const gain = get(data) - (get(base) || 0); if (gain <= 0) return;
      const units = Math.min(gain, Math.ceil(excess / VALUE[key]));
      set(data, get(data) - units); excess -= units * VALUE[key];
      fixed[key === 'coins' ? 'coins' : key] = get(data);
    };
    cut('amber', (d) => int(d.amber) || 0, (d, v) => (d.amber = v));
    cut('feathers', (d) => int(d.feathers) || 0, (d, v) => (d.feathers = v));
    cut('coins', (d) => int(d.event && d.event.coins) || 0, (d, v) => (d.event.coins = v));
    cut('shells', (d) => int(d.shells) || 0, (d, v) => (d.shells = v));
    g.v = 0;
  } else if (dv > 0) g.v -= dv;

  return { guard: g, fixed: Object.keys(fixed).length ? fixed : null, notes };
}

module.exports = { check };
