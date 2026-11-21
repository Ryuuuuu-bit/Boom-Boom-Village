/* Boom Boom Village — ข้อมูลผู้เล่น เศรษฐกิจ และกติกาทั้งหมด (ไม่เกี่ยวกับการวาดภาพ) */
'use strict';
let SAVE_KEY = 'boomboom_save_v2';
const LEGACY_SAVE_KEY = 'boomboom_save_v2';
let S = null;
const now = () => Date.now();
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dayKey = (t = now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const midnight = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); };
let uidN = 0; const uid = (p = 'o') => p + now().toString(36) + (uidN++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

// ตัวรับเหตุการณ์ (ส่วน UI/ฉาก ลงทะเบียนไว้)
const BUS = { fns: {}, on(e, f) { (this.fns[e] = this.fns[e] || []).push(f); }, emit(e, ...a) { (this.fns[e] || []).forEach((f) => { try { f(...a); } catch (err) { console.error(err); } }); } };

// ---------- สร้างหมู่บ้านใหม่ ----------
function newSave() {
  const t = now();
  const s = {
    v: 2, created: t, lastSeen: t, shells: CFG.START.shells, amber: CFG.START.amber, feathers: 0, xp: 0, level: 1, era: 1,
    inv: {}, seeds: Object.assign({}, CFG.START.seeds), bag: {},
    owned: { w: CFG.START_W, h: CFG.START_H }, expansions: 0, storageLvl: 0,
    plots: {}, objects: [], animals: [], orders: [],
    daily: null, login: { lastDay: null, step: 0 }, story: { ch: 0, step: 0, prog: 0 },
    stats: {}, ach: {}, title: '', log: [], pranksOnMe: [],
    bots: {}, counters: { day: dayKey(), helps: 0, pranks: 0, pranked: 0, shieldUntil: t + CFG.NEWBIE_SHIELD_MS },
    peaceful: false, peacefulDay: null, botNextAt: t + 3 * MIN, settings: { music: true, sfx: true },
    event: { coins: 0 }, villagerWater: { day: dayKey(), used: 0 }, visited: {}, eraDelivered: {}, seedPick: 'pumpkin',
    tutorialPrankDone: false, welcomed: false, lastSummaryAt: t,
  };
  const add = (type, x, y, data) => s.objects.push({ id: uid(), type, x, y, flip: false, data: data || {} });
  // แผนผังเริ่มต้น (แม่น้ำอยู่แถวบนสุด ถนนกลางหมู่บ้านแถว 8-9)
  add('chief', 2, 4);
  add('market', 9, 5);
  add('storage', 15, 5);
  add('ordertree', 19, 6);
  add('bonfire', 11, 11);
  add('statue', 8, 11);
  add('pen', 16, 11, { lvl: 0 });
  add('t_banana', 21, 12, { n: 2, at: t });
  add('fence', 2, 14);
  // เศษไม้หินรอเก็บกวาด (ทั้งในและนอกเขตที่ดิน)
  const deb = [['rock', 6, 14], ['bush', 13, 14], ['log', 22, 3], ['rock', 1, 11], ['bush', 20, 9],
    ['rock', 27, 5], ['log', 30, 12], ['bush', 26, 14], ['rock', 34, 9], ['log', 38, 4], ['bush', 42, 13], ['rock', 45, 6],
    ['log', 5, 19], ['rock', 12, 22], ['bush', 18, 25], ['log', 9, 28], ['rock', 25, 20], ['bush', 33, 24], ['log', 40, 27], ['rock', 44, 19]];
  for (const [ty, x, y] of deb) add(ty, x, y);
  s.animals.push({ id: uid('a'), kind: 'dino', pen: s.objects.find((o) => o.type === 'pen').id, fedAt: null, readyAt: null });
  // แปลงเริ่มต้น 3 แปลงที่ไถแล้ว
  for (const x of [3, 4, 5]) s.plots[x + ',11'] = { crop: null };
  for (const b of BOTS) s.bots[b.id] = newBotState(b);
  return s;
}
function newBotState(b) { return { helps: 0, pranks: 0, day: dayKey(), giftDay: null, blocked: false, village: null, myPranks: [], x2: false, revengeFree: 0 }; }

function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 2) return s; } } catch (e) {}
  return null;
}
let dirty = false;
function save() { if (!S) return; S.lastSeen = now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} dirty = false; if (typeof AUTH !== 'undefined') AUTH.queueSync(); }
function mark() { dirty = true; }

// ---------- ของและเงิน ----------
const have = (k) => (k === 'shells' ? S.shells : k === 'amber' ? S.amber : k === 'feathers' ? S.feathers : k === 'coins' ? S.event.coins : S.inv[k] || 0);
function storageCap() { return CFG.STORAGE_BASE + CFG.STORAGE_STEP * S.storageLvl; }
function storageUsed() { let n = 0; for (const [k, v] of Object.entries(S.inv)) if (ITEMS[k] && STORED_CATS.includes(ITEMS[k].cat)) n += v; return n; }
function storageFree() { return storageCap() - storageUsed(); }
function canAfford(cost) { for (const [k, v] of Object.entries(cost || {})) if (v > 0 && have(k) < v) return false; return true; }
function missingText(cost) {
  const m = []; for (const [k, v] of Object.entries(cost || {})) if (v > 0 && have(k) < v) m.push(`${nameOf(k)} ขาด ${v - have(k)}`);
  return m.join(', ');
}
function pay(cost) {
  if (!canAfford(cost)) return false;
  for (const [k, v] of Object.entries(cost || {})) {
    if (!v) continue;
    if (k === 'shells') S.shells -= v; else if (k === 'amber') S.amber -= v; else if (k === 'feathers') S.feathers -= v;
    else if (k === 'coins') S.event.coins -= v; else { S.inv[k] -= v; if (S.inv[k] <= 0) delete S.inv[k]; }
  }
  mark(); BUS.emit('res'); return true;
}
function nameOf(k) { return { shells: 'เปลือกหอย', amber: 'อำพัน', feathers: 'ขนนกทอง', coins: 'แพจิ๋ว', xp: 'XP' }[k] || (ITEMS[k] && ITEMS[k].n) || k; }
// ให้ของ (ไม่เช็คยุ้งฉาง ใช้กับรางวัล) คืนค่าข้อความสรุป
function grant(r, silent) {
  const parts = [];
  for (const [k, v] of Object.entries(r || {})) {
    if (!v) continue;
    if (k === 'shells') S.shells += v; else if (k === 'amber') S.amber += v; else if (k === 'feathers') S.feathers += v;
    else if (k === 'coins') S.event.coins += v; else if (k === 'xp') { addXP(v); }
    else if (k === 'deco') { S.bag[v] = (S.bag[v] || 0) + 1; parts.push(`${BUILDS[v].n} (ในกระเป๋า)`); continue; }
    else S.inv[k] = (S.inv[k] || 0) + v;
    parts.push(`${iconHTML(k)}${v}`);
  }
  mark(); BUS.emit('res');
  return parts.join(' ');
}
// เพิ่มของเข้ายุ้งฉาง (ถ้าเต็มคืน false)
function store(k, n) {
  if (ITEMS[k] && STORED_CATS.includes(ITEMS[k].cat) && storageFree() < n) return false;
  S.inv[k] = (S.inv[k] || 0) + n; mark(); BUS.emit('res'); return true;
}

// ---------- XP และเลเวล ----------
function addXP(n) {
  if (S.level >= maxLevel()) { S.xp = Math.min(S.xp + n, XP_NEED(S.level)); return; }
  S.xp += n;
  while (S.level < maxLevel() && S.xp >= XP_NEED(S.level)) {
    S.xp -= XP_NEED(S.level); S.level++; S.amber += 3;
    stat('level', 0); BUS.emit('levelup', S.level, unlocksAt(S.level));
  }
  mark(); BUS.emit('res');
}
function maxLevel() { return S.era >= 2 ? 34 : MAX_LEVEL_ERA1; }
function unlocksAt(lv) {
  const u = [];
  for (const [k, c] of Object.entries(CROPS)) if (c.lv === lv) u.push('🌱 ' + c.n);
  for (const [k, a] of Object.entries(ANIMALS)) if (a.lv === lv) u.push('🐾 ' + a.n);
  for (const [k, b] of Object.entries(BUILDS)) if (b.lv === lv && b.cat && b.cat !== 'event') u.push('🔨 ' + b.n);
  for (const [k, p] of Object.entries(PRANKS)) if (p.lv === lv) u.push('😈 แกล้งแบบ' + p.n);
  if (lv === 8) u.push('🏡 เผ่าพันธมิตร (เร็ว ๆ นี้)');
  u.push(`🌾 แปลงผักสูงสุด ${PLOTS_BY_LEVEL(lv)} แปลง`);
  return u;
}
const prankQuota = () => (S.level >= 15 ? CFG.PRANK_PER_DAY_LV15 : CFG.PRANK_PER_DAY);

// ---------- สถิติ / ภารกิจ / ความสำเร็จ ----------
function stat(k, n = 1) {
  if (n) { S.stats[k] = (S.stats[k] || 0) + n; }
  dailyReset();
  if (n) for (const q of S.daily.quests) if (q.k === k && !q.done) { q.prog = Math.min(q.n, q.prog + n); if (q.prog >= q.n) { q.done = true; BUS.emit('toast', `📅 ภารกิจรายวันสำเร็จ: ${q.t}`, 'good'); sfx('quest'); } }
  checkStory(); checkAch(k);
  if (['harvest', 'order', 'help'].includes(k) && eventActive() && Math.random() < 0.35) { S.event.coins += 1; BUS.emit('float', '+' + iconHTML('coins') + '1'); }
  mark(); BUS.emit('quests');
}
function storyStep() { const ch = STORY[S.story.ch]; return ch ? ch.steps[S.story.step] : null; }
function storyValue(k) {
  if (k === 'level') return S.level;
  if (k === 'stars') return villageStars();
  if (k === 'era') return S.era;
  if (k === 'visit_all') return Object.keys(S.visited).length;
  return (S.stats[k] || 0) - (S.story.base || 0);
}
function checkStory() {
  let guard = 0;
  while (guard++ < 20) {
    const st = storyStep(); if (!st) return;
    const v = ['level', 'stars', 'era', 'visit_all'].includes(st.k) ? storyValue(st.k) : (S.stats[st.k] || 0) - (S.story.base || 0);
    if (v < st.n) return;
    const txt = grant(st.r);
    BUS.emit('toast', `🎯 ภารกิจสำเร็จ! ${txt}`, 'good'); sfx('quest');
    S.story.step++;
    if (S.story.step >= STORY[S.story.ch].steps.length) {
      BUS.emit('chapter', STORY[S.story.ch].ch);
      S.story.ch++; S.story.step = 0;
    }
    const nx = storyStep(); S.story.base = nx && !['level', 'stars', 'era', 'visit_all'].includes(nx.k) ? (S.stats[nx.k] || 0) : 0;
    mark();
  }
}
function storyProgress() { const st = storyStep(); if (!st) return null; const v = ['level', 'stars', 'era', 'visit_all'].includes(st.k) ? storyValue(st.k) : (S.stats[st.k] || 0) - (S.story.base || 0); return { st, v: Math.min(v, st.n) }; }
function checkAch(k) {
  const a = ACHIEVEMENTS.find((x) => x.k === k); if (!a) return;
  const tier = S.ach[k] || 0; if (tier >= 3) return;
  if ((S.stats[k] || 0) >= a.tiers[tier]) {
    S.ach[k] = tier + 1; const am = [5, 15, 50][tier]; S.amber += am;
    if (!S.title || tier >= 1) S.title = a.title[tier];
    BUS.emit('toast', `🏆 ความสำเร็จ "${a.n}" ขั้น ${tier + 1}! ได้ ${iconHTML('amber')}${am} และฉายา "${a.title[tier]}"`, 'good'); sfx('chest');
  }
}

// ---------- รายวัน ----------
function dailyReset() {
  const d = dayKey();
  if (!S.daily || S.daily.day !== d) {
    const mk = (tier) => { const q = pick(DAILY_POOL[tier]); return { tier, t: q.t, k: q.k, n: q.n, prog: 0, done: false }; };
    S.daily = { day: d, quests: [mk('easy'), mk('mid'), mk('social')], chest: false, reroll: false };
  }
  if (S.counters.day !== d) { S.counters = { day: d, helps: 0, pranks: 0, pranked: 0, shieldUntil: S.counters.shieldUntil }; }
  for (const b of BOTS) { const st = S.bots[b.id] || (S.bots[b.id] = newBotState(b)); if (st.day !== d) { st.day = d; st.helps = 0; st.pranks = 0; } }
  if (S.villagerWater.day !== d) S.villagerWater = { day: d, used: 0 };
}
function rerollDaily(i) {
  if (S.daily.reroll) return false;
  const q = S.daily.quests[i]; if (q.done) return false;
  const pool = DAILY_POOL[q.tier].filter((x) => x.k !== q.k); const n = pick(pool);
  S.daily.quests[i] = { tier: q.tier, t: n.t, k: n.k, n: n.n, prog: 0, done: false }; S.daily.reroll = true; mark(); return true;
}
function claimDailyChest() {
  if (S.daily.chest || !S.daily.quests.every((q) => q.done)) return null;
  S.daily.chest = true;
  return grant({ shells: 50 + S.level * 10, amber: 2, wood: rint(1, 3), stone: rint(1, 3), vine: rint(1, 2), xp: 10 });
}
function loginStatus() { const d = dayKey(); return { claimable: S.login.lastDay !== d, step: S.login.step % 7 }; }
function claimLogin() {
  const st = loginStatus(); if (!st.claimable) return null;
  const r = LOGIN_WHEEL[st.step]; S.login.lastDay = dayKey(); S.login.step++;
  return grant(r);
}

// ---------- ฟาร์ม ----------
function plotCount() { return Object.keys(S.plots).length; }
function cropUnlocked(c) { return CROPS[c].lv <= S.level; }
function plotState(p, t = now()) {
  if (!p || !p.crop) return 'empty';
  if (!p.readyAt) return 'dry0';            // ปลูกแล้วยังไม่รดน้ำ
  if (t >= p.readyAt) return 'ripe';
  return 'grow';
}
function plotFlags(p, t = now()) {
  const st = plotState(p, t);
  return { dry: st === 'grow' && p.dryAt && t >= p.dryAt && !p.dryDone, pest: st === 'grow' && p.pestAt && t >= p.pestAt && !p.pestDone };
}
function plotStage(p, t = now()) { // 0..3 สำหรับภาพ
  const st = plotState(p, t); if (st === 'empty') return -1; if (st === 'dry0') return 0; if (st === 'ripe') return 3;
  const f = (t - p.startAt) / (p.readyAt - p.startAt); return f < 0.35 ? 1 : 2;
}
function plantPlot(key, crop) {
  const p = S.plots[key]; if (!p || p.crop) return 'no';
  const c = CROPS[crop];
  if ((S.seeds[crop] || 0) > 0) S.seeds[crop]--;
  else if (!pay({ shells: c.seed })) return 'money';
  const tut = S.story.ch === 0 && S.story.step <= 4;
  S.plots[key] = { crop, dur: tut ? CFG.TUTORIAL_GROW_MS : c.ms, bonus: 0 };
  stat('plant'); if (crop === 'corn') stat('plant_corn'); sfx('plant'); mark(); return 'ok';
}
function waterPlot(key, who) {
  const p = S.plots[key]; const t = now();
  if (plotState(p) === 'dry0') {
    p.startAt = t; p.readyAt = t + p.dur;
    if (p.dur >= CFG.DRY_MIN_MS) {
      if (Math.random() < CFG.DRY_CHANCE) p.dryAt = t + p.dur * rnd(0.3, 0.7);
      if (Math.random() < CFG.PEST_CHANCE) p.pestAt = t + p.dur * rnd(0.25, 0.75);
    }
    if (!who) { stat('water'); sfx('water'); }
    mark(); return true;
  }
  if (plotFlags(p).dry) { p.readyAt -= (p.readyAt - t) * CFG.DRY_CUT; p.dryDone = true; if (!who) { stat('water'); sfx('water'); addXP(1); } mark(); return true; }
  return false;
}
function shooPest(key, who) { const p = S.plots[key]; if (!plotFlags(p).pest) return false; p.pestDone = true; p.bonus = (p.bonus || 0) + 1; if (!who) { addXP(1); sfx('pest'); } mark(); return true; }
function harvestPlot(key) {
  const p = S.plots[key]; if (plotState(p) !== 'ripe') return null;
  const c = CROPS[p.crop]; let n = c.yield + (p.bonus || 0); if (weekendBuff() === 'x2') n *= 2;
  if (!store(p.crop, n)) return 'full';
  addXP(c.xp); stat('harvest'); sfx('harvest');
  const crop = p.crop; S.plots[key] = { crop: null }; mark();
  return { crop, n };
}
function speedCost(ms) { return ms <= CFG.FREE_SPEEDUP_MS ? 0 : Math.ceil(ms / CFG.SPEEDUP_PER_AMBER_MS); }
function speedPlot(key) {
  const p = S.plots[key]; if (plotState(p) !== 'grow') return false;
  const cost = speedCost(p.readyAt - now()); if (!pay({ amber: cost })) return false;
  p.readyAt = now(); mark(); return true;
}
function useCompost(key) {
  const p = S.plots[key]; if (plotState(p) !== 'grow' || !(S.inv.compost > 0)) return false;
  S.inv.compost--; if (!S.inv.compost) delete S.inv.compost; p.readyAt -= (p.readyAt - now()) * 0.5; mark(); return true;
}

// ---------- สัตว์ ----------
function animalState(a, t = now()) { if (!a.fedAt) return 'hungry'; return t >= a.readyAt ? 'ready' : 'eating'; }
function feedAnimal(a, helper) {
  const d = ANIMALS[a.kind]; if (animalState(a) !== 'hungry') return false;
  if (!helper) { if (!canAfford(d.eat)) return 'food'; pay(d.eat); }
  a.fedAt = now(); a.readyAt = a.fedAt + d.ms; if (!helper) { stat('feed'); sfx('eat'); } mark(); return true;
}
function collectAnimal(a) {
  const d = ANIMALS[a.kind]; if (animalState(a) !== 'ready') return false;
  if (!store(d.give, 1)) return 'full';
  a.fedAt = null; a.readyAt = null; addXP(2); stat('collect'); if (d.give === 'egg') stat('collect_egg'); sfx('harvest'); mark(); return true;
}
function penOf(id) { return S.objects.find((o) => o.id === id); }
function penCap(pen) { return PEN_CAP[(pen.data && pen.data.lvl) || 0]; }
function penWithSpace() { return S.objects.filter((o) => o.type === 'pen').find((p) => S.animals.filter((a) => a.pen === p.id).length < penCap(p)); }

// ---------- โรงผลิต ----------
function factoryTick(o, t = now()) {
  const q = o.data.queue || (o.data.queue = []);
  let tPrev = null;
  for (const job of q) { if (!job.start) { job.start = tPrev && tPrev > t ? tPrev : Math.max(tPrev || 0, job.addedAt); job.end = job.start + job.ms; } tPrev = job.end; }
}
function factoryAdd(o, ri) {
  const f = FACTORIES[BUILDS[o.type].factory]; const r = f.recipes[ri];
  const slots = o.data.slots || 2; const q = o.data.queue || (o.data.queue = []);
  if (q.length >= slots) return 'full';
  if (!pay(r.in)) return 'items';
  const last = q.length ? q[q.length - 1].end : now();
  q.push({ ri, out: r.out, ms: r.ms, start: Math.max(now(), last), end: Math.max(now(), last) + r.ms, xp: r.xp }); sfx('build'); mark(); return 'ok';
}
function factoryCollect(o) {
  const q = o.data.queue || []; const t = now(); let got = 0;
  while (q.length && q[0].end <= t) {
    if (!store(q[0].out, 1)) { if (!got) return 'full'; break; }
    addXP(q[0].xp); stat('make'); stat('make_' + q[0].out); got++; q.shift();
  }
  if (got) sfx('harvest'); mark(); return got;
}

// ---------- ต้นไม้ผล ----------
function treeTick(o, t = now()) {
  const b = BUILDS[o.type]; const d = o.data; if (d.n == null) { d.n = 0; d.at = t; }
  while (d.n < 3 && t - d.at >= b.ms) { d.n++; d.at += b.ms; }
  if (d.n >= 3) d.at = t;
}

// ---------- คำสั่งซื้อ ----------
const ORDER_PEOPLE = ['ลุงเท่ง', 'ยายหมอบูม', 'ป้าหินอ่อน', 'น้าไม้ไผ่', 'เจ้าตูบ', 'หมอดูขนนก'];
function orderableItems() {
  const list = Object.keys(CROPS).filter(cropUnlocked);
  for (const a of S.animals) list.push(ANIMALS[a.kind].give);
  for (const o of S.objects) if (BUILDS[o.type] && BUILDS[o.type].factory) for (const r of FACTORIES[BUILDS[o.type].factory].recipes) list.push(r.out);
  if (S.objects.some((o) => o.type === 't_banana')) list.push('banana');
  if (S.objects.some((o) => o.type === 't_coconut')) list.push('coconut');
  return [...new Set(list)];
}
function makeOrder() {
  const opts = orderableItems(); const n = Math.min(opts.length, rint(1, Math.min(3, 1 + Math.floor(S.level / 3))));
  const items = {}; let value = 0;
  const pool = opts.slice().sort(() => Math.random() - 0.5).slice(0, n);
  for (const k of pool) { const p = ITEMS[k].price; const q = Math.max(1, Math.min(8, Math.round(rnd(30, 90 + S.level * 15) / p))); items[k] = q; value += p * q; }
  const reward = { shells: Math.round(value * rnd(1.3, 1.6)), xp: Math.max(2, Math.round(value / 12)) };
  if (Math.random() < 0.25) reward[pick(['wood', 'stone', 'vine'])] = rint(1, 3);
  if (Math.random() < 0.12) reward.pin = 1;
  return { id: uid('ord'), who: pick(ORDER_PEOPLE), items, reward, readyAt: 0 };
}
function ordersTick() {
  while (S.orders.length < 6) S.orders.push(makeOrder());
  for (let i = 0; i < 6; i++) { const o = S.orders[i]; if (o.readyAt && now() >= o.readyAt) S.orders[i] = makeOrder(); }
}
function deliverOrder(i) {
  const o = S.orders[i]; if (!o || o.readyAt) return false;
  if (!pay(o.items)) return false;
  const txt = grant(o.reward); stat('order'); sfx('coin');
  S.orders[i] = { id: uid('ord'), readyAt: now() + CFG.ORDER_NEW_MS, empty: true }; mark(); return txt;
}
function discardOrder(i) { S.orders[i] = { id: uid('ord'), readyAt: now() + CFG.ORDER_DISCARD_MS, empty: true }; mark(); }

// ---------- ความสวย / ดาว ----------
function beauty() { let b = 0; for (const o of S.objects) b += (BUILDS[o.type] && BUILDS[o.type].beauty) || 0; return b; }
function villageStars() { const b = beauty(); let s = 0; for (let i = 0; i < STARS.length; i++) if (b >= STARS[i]) s = i; return Math.max(1, s); }

// ---------- ขยายที่ดิน ----------
function nextExpansion() {
  const n = S.expansions; if (S.owned.w >= CFG.MAP_W && S.owned.h >= CFG.MAP_H) return null;
  const dir = (n % 2 === 0 && S.owned.w < CFG.MAP_W) || S.owned.h >= CFG.MAP_H ? 'east' : 'south';
  const c = EXPAND_COST(n); const cost = { shells: c.shells }; if (c.pin) cost.pin = c.pin;
  return { dir, cost };
}
function expandLand() {
  const e = nextExpansion(); if (!e || !pay(e.cost)) return false;
  if (e.dir === 'east') S.owned.w += 4; else S.owned.h += 4;
  S.expansions++; stat('expand'); addXP(10); mark(); return e.dir;
}

// ---------- สัปดาห์ / อีเวนต์ ----------
function weekendBuff() { const d = new Date(); const wd = d.getDay(); if (!(wd === 5 || wd === 6 || wd === 0)) return null; const wk = Math.floor(d.getTime() / (7 * DAY)); return WEEKEND_BUFFS[wk % WEEKEND_BUFFS.length].id; }
function weekendInfo() { const id = weekendBuff(); return id ? WEEKEND_BUFFS.find((w) => w.id === id) : null; }
function eventActive() { const d = dayKey(); return EVENTS.find((e) => d >= e.start && d < e.end) || null; }
function sellPrice(k) { let p = ITEMS[k].price; if (weekendBuff() === 'market') p = Math.round(p * 1.2); return p; }

// ---------- บันทึกเหตุการณ์ ----------
function addLog(e) { e.id = uid('log'); e.t = e.t || now(); e.read = false; S.log.unshift(e); if (S.log.length > 80) S.log.length = 80; mark(); BUS.emit('log'); }

// ---------- โล่ ----------
function shielded() { return now() < (S.counters.shieldUntil || 0) || S.peaceful; }

// ---------- ไอคอน (HTML) ----------
function iconHTML(k, cls = 'ic') {
  const key = { shells: 'ic_shell', amber: 'ic_amber', feathers: 'ic_feather', coins: 'ic_coin_krathong', xp: 'ic_star' }[k] || (ITEMS[k] && ITEMS[k].icon);
  if (key && A.images[key]) return `<img class="${cls}" src="${A.images[key]}" alt="">`;
  return { shells: '🐚', amber: '🟠', feathers: '🌟', coins: '🛶', xp: '⭐' }[k] || '•';
}
