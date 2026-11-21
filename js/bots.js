/* Boom Boom Village — เพื่อนบอท: มาช่วย มาแกล้ง ส่งของขวัญ และหมู่บ้านของพวกเขา */
'use strict';
const botById = (id) => BOTS.find((b) => b.id === id) || (typeof realBotById === 'function' ? realBotById(id) : undefined);

// ---------- พื้นที่ทางเดินของเรา (ใช้วางโคลน/ใบไม้) ----------
function homePathCells() {
  const cells = [];
  for (let y = 8; y <= 9; y++) for (let x = 1; x < S.owned.w - 1; x++) cells.push([x, y]);
  return cells.filter(([x, y]) => !S.pranksOnMe.some((p) => (p.cells || []).some((c) => c[0] === x && c[1] === y)));
}
function plazaCells() {
  const cells = [];
  for (let y = 10; y <= 13; y++) for (let x = 7; x <= 14; x++) if (!objAtCell(x, y) && !S.plots[x + ',' + y]) cells.push([x, y]);
  return cells;
}
function objAtCell(x, y) { return S.objects.find((o) => { const b = BUILDS[o.type]; return x >= o.x && x < o.x + b.w && y >= o.y && y < o.y + b.h; }); }

// ---------- บอทมาที่หมู่บ้านเรา ----------
function botTick(t = now()) {
  dailyReset();
  // รอยแกล้งหมดอายุเอง 6 ชม.
  const before = S.pranksOnMe.length;
  S.pranksOnMe = S.pranksOnMe.filter((p) => t < p.at + CFG.PRANK_EXPIRE_MS);
  if (S.pranksOnMe.length !== before) { mark(); BUS.emit('pranks'); }
  // บทสอน: ปูปู้มาเอาคืนทันทีหลังเราแกล้ง (ข้อ 10)
  const st = storyStep();
  if (st && st.k === 'clean' && S.story.ch === 0 && !S.tutorialPrankDone) { S.tutorialPrankDone = true; doBotPrank(BOTS[0], 'mud', true, true); }
  if (S.story.ch === 0 && S.story.step < 9) return;
  let guard = 0;
  while (t >= S.botNextAt && guard++ < 6) {
    botAct(S.botNextAt);
    S.botNextAt += rnd(CFG.BOT_ACT_MIN_MS, CFG.BOT_ACT_MAX_MS);
    if (S.botNextAt < t - 2 * DAY) S.botNextAt = t + 10 * MIN;
  }
}
function botAct(t) {
  const b = pick(BOTS); const bs = S.bots[b.id];
  // มีโอกาสแกล้งตามนิสัย ถ้าไม่ติดโล่ / หมู่บ้านสงบ / บล็อก
  const canPrank = !shielded() && !bs.blocked && S.counters.pranked < CFG.BOT_PRANKS_TO_SHIELD && S.pranksOnMe.length < 6;
  if (canPrank && Math.random() < b.prankRate) { doBotPrank(b, null, false, false, t); return; }
  if (Math.random() < 0.75) botHelp(b, t); else botGift(b, t);
}
function botHelp(b, t) {
  const opts = [];
  for (const [k, p] of Object.entries(S.plots)) { const f = plotFlags(p, now()); if (f.dry) opts.push(['water', k]); if (f.pest) opts.push(['pest', k]); }
  for (const a of S.animals) if (animalState(a) === 'hungry') opts.push(['feed', a]);
  if (!opts.length) { botGift(b, t); return; }
  const [kind, target] = pick(opts);
  let msg = '';
  if (kind === 'water') { waterPlot(target, b.id); msg = `💧 ${b.n} แวะมารดน้ำแปลงดินแห้งให้ ผักโตเร็วขึ้น`; }
  else if (kind === 'pest') { shooPest(target, b.id); msg = `🐛 ${b.n} มาไล่หนอนให้ ได้ผลผลิตเพิ่ม +1`; }
  else { feedAnimal(target, b.id); msg = `🍖 ${b.n} มาให้อาหาร${ANIMALS[target.kind].n}ให้ เริ่มผลิตทันที`; }
  addLog({ kind: 'help', bot: b.id, msg, t });
  BUS.emit('botvisit', b.id, 'help'); BUS.emit('refresh');
}
function botGift(b, t) {
  const r = pick([{ wood: 2 }, { stone: 2 }, { vine: 2 }, { shells: 15 }]);
  grant(r, true);
  addLog({ kind: 'gift', bot: b.id, msg: `🎁 ${b.n} ฝากของขวัญไว้ให้: ${Object.entries(r).map(([k, v]) => iconHTML(k) + v).join(' ')}`, t });
}
// สร้างรอยแกล้งบนหมู่บ้านเรา
function doBotPrank(b, kind, isRevenge, scripted, t = now()) {
  const allowed = Object.keys(PRANKS).filter((k) => PRANKS[k].lv <= Math.max(3, S.level));
  kind = kind || pick(allowed);
  // ห่านยามจับได้
  const goose = S.objects.some((o) => o.type === 'goose');
  if (!scripted && goose && Math.random() < CFG.GOOSE_CATCH) {
    S.shells += 10; mark();
    addLog({ kind: 'catch', bot: b.id, msg: `🦢 ห่านยามจับ ${b.n} ได้คาหนังคาเขา! ไล่จิกจนวิ่งหนีแทบไม่ทัน ${b.n} จ่ายค่าปรับ ${iconHTML('shells')}10`, t });
    BUS.emit('goose'); return;
  }
  const p = { id: uid('pr'), bot: b.id, kind, at: t, revenge: !!isRevenge };
  if (kind === 'mud') { const cells = homePathCells(); p.cells = []; for (let i = 0; i < rint(3, 5) && cells.length; i++) p.cells.push(cells.splice(Math.floor(Math.random() * cells.length), 1)[0]); }
  else if (kind === 'sticker') { const tgt = S.objects.find((o) => o.type === 'statue') || S.objects.find((o) => o.type === 'chief'); p.target = tgt.id; p.face = pick(STICKERS); }
  else if (kind === 'monkey') {
    const trees = S.objects.filter((o) => BUILDS[o.type].fruit); trees.forEach((o) => treeTick(o));
    const tr = trees.find((o) => o.data.n >= 2) || trees[0];
    if (!tr) return doBotPrank(b, 'mud', isRevenge, scripted, t);
    p.target = tr.id; p.stolen = tr.data.n >= 2 ? 1 : 0; tr.data.n -= p.stolen; p.fruit = BUILDS[tr.type].fruit;
  }
  else if (kind === 'boar') { p.pos = [rint(3, S.owned.w - 4), rint(9, S.owned.h - 3)]; }
  else if (kind === 'leaves') { const cells = plazaCells(); p.cells = []; for (let i = 0; i < 6 && cells.length; i++) p.cells.push(cells.splice(Math.floor(Math.random() * cells.length), 1)[0]); }
  else if (kind === 'rooster') { p.target = S.objects.find((o) => o.type === 'chief').id; }
  S.pranksOnMe.push(p);
  if (!scripted) { S.counters.pranked++; if (S.counters.pranked >= CFG.BOT_PRANKS_TO_SHIELD) { S.counters.shieldUntil = midnight(); addLog({ kind: 'info', msg: '🛡️ วันนี้โดนแกล้งครบ 3 ครั้งแล้ว หมู่บ้านได้โล่กันแกล้งถึงเที่ยงคืน', t }); } }
  const what = { mud: 'สาดโคลนใส่ทางเดิน', sticker: `แปะสติกเกอร์ ${p.face} บนรูปปั้น`, monkey: `ส่งลิงมาแอบกินผลไม้${p.stolen ? ' ไป 1 ลูก' : ''}`, boar: 'ปล่อยหมูป่ามาวิ่งเล่นในหมู่บ้าน', leaves: 'โปรยใบไม้เต็มลาน', rooster: 'เอาไก่ป่ามาเกาะหลังคาขันเสียงดัง' }[kind];
  addLog({ kind: 'prank', bot: b.id, prank: kind, prankId: p.id, noRevenge: !!isRevenge, msg: `${PRANKS[kind].e} ${b.n}${isRevenge ? 'แกล้งคืน: ' : ''}${what}! กวาดเพื่อรับรางวัล`, t });
  mark(); BUS.emit('pranks'); BUS.emit('botvisit', b.id, 'prank');
}
// เก็บกวาดรอยแกล้ง (คืนค่ารางวัลเป็นข้อความ)
function cleanPrank(p, part) {
  let r = {};
  if (p.kind === 'mud') {
    p.cells = p.cells.filter((c) => !(c[0] === part[0] && c[1] === part[1]));
    r = { shells: 3 }; if (!p.cells.length) r.feathers = 1;
  } else if (p.kind === 'leaves') {
    p.cells = p.cells.filter((c) => !(c[0] === part[0] && c[1] === part[1]));
    r = { shells: 2 }; if (!p.cells.length) { r.compost = 5; r.feathers = 1; }
  } else if (p.kind === 'sticker') r = { shells: 15, feathers: 2 };
  else if (p.kind === 'monkey') { r = { shells: 20, feathers: 2 }; if (p.stolen) r[p.fruit] = p.stolen + 1; }
  else if (p.kind === 'boar') r = { shells: 15, truffle: 1, feathers: 1 };
  else if (p.kind === 'rooster') r = { egg: 1, shells: 10, feathers: 1 };
  if (weekendBuff() === 'kind' && r.feathers) r.feathers *= 2;
  const done = !(p.cells && p.cells.length);
  if (done) { S.pranksOnMe = S.pranksOnMe.filter((q) => q.id !== p.id); stat('clean'); addXP(2); }
  const txt = grant(r); sfx('clean'); mark(); BUS.emit('pranks');
  return { txt, done };
}

// ---------- หมู่บ้านของเพื่อนบอท ----------
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function botVillage(b) {
  const bs = S.bots[b.id]; const t = now();
  if (!bs.village || t - bs.village.at > 30 * MIN) {
    const r = Math.random;
    const plots = [];
    for (let y = 12; y < 14; y++) for (let x = 4; x < 10; x++) {
      const crop = pick(['pumpkin', 'corn', 'millet', 'taro']);
      const q = r(); plots.push({ x, y, crop, stage: 1 + Math.floor(r() * 3), need: q < 0.4 ? 'water' : q < 0.65 ? 'pest' : null });
    }
    const animals = [{ kind: 'dino', hungry: r() < 0.6 }, { kind: 'boar', hungry: r() < 0.5 }, { kind: 'goat', hungry: r() < 0.5 }];
    const old = bs.village;
    bs.village = { at: t, plots, animals, fruit: old ? old.fruit : 3 };
  }
  // ปูปู้/เพื่อนเก็บกวาดรอยที่เราแกล้งไว้เองหลัง 6 ชม.
  const keep = bs.myPranks.filter((p) => t < p.at + CFG.PRANK_EXPIRE_MS);
  if (keep.length !== bs.myPranks.length) { bs.myPranks = keep; bs.village.fruit = 3; }
  mark();
  return bs.village;
}
function helpLeft(b) { const bs = S.bots[b.id]; return Math.max(0, Math.min(CFG.HELP_PER_FRIEND - bs.helps, CFG.HELP_PER_DAY - S.counters.helps)); }
function prankLeft(b) {
  const bs = S.bots[b.id]; if (S.peaceful) return 0;
  return Math.max(0, Math.min(CFG.PRANK_PER_FRIEND - bs.pranks, prankQuota() - S.counters.pranks));
}
function doHelp(b, kind) {
  const bs = S.bots[b.id];
  if (helpLeft(b) <= 0) return null;
  bs.helps++; S.counters.helps++;
  const starBonus = 1 + 0.05 * b.stars;
  const r = kind === 'feed' ? { shells: Math.round(10 * starBonus), xp: CFG.XP_FEED_HELP, feathers: 1 } : { shells: Math.round(5 * starBonus), xp: CFG.XP_HELP, feathers: 1 };
  if (bs.x2) { r.shells *= 2; r.feathers *= 2; bs.x2 = false; }
  if (weekendBuff() === 'kind') r.feathers *= 2;
  stat('help'); if (kind === 'feed') stat('help_feed');
  return grant(r);
}
function doMyPrank(b, kind, opts = {}) {
  const bs = S.bots[b.id];
  const free = bs.revengeFree > 0;
  if (!free && prankLeft(b) <= 0) return null;
  if (free) bs.revengeFree--; else { bs.pranks++; S.counters.pranks++; }
  const p = { id: uid('mp'), kind, at: now(), ...opts };
  bs.myPranks.push(p);
  let got = {};
  if (kind === 'monkey' && b.real) { if (opts.stolen) got = { [opts.fruit || 'banana']: 1 }; }
  else if (kind === 'monkey' && bs.village.fruit > 1) { bs.village.fruit--; got = { banana: 1 }; }
  stat('prank'); addXP(2);
  addLog({ kind: 'mine', bot: b.id, msg: `😈 คุณแกล้ง${b.n}: ${PRANKS[kind].n}${free ? ' (แกล้งคืน)' : ''}` });
  // บอทเอาคืน (ถ้าไม่ใช่การแกล้งคืนของเรา และไม่ติดโล่)
  if (!b.real && !free && !shielded() && !bs.blocked && Math.random() < 0.6 && !(S.story.ch === 0)) {
    setTimeout(() => {}, 0);
    S.botRevenge = S.botRevenge || [];
    S.botRevenge.push({ bot: b.id, at: now() + rnd(10, 30) * MIN });
  }
  mark();
  return grant(got) || 'ok';
}
function revengeTick() {
  if (!S.botRevenge) return;
  const t = now();
  const due = S.botRevenge.filter((r) => r.at <= t); S.botRevenge = S.botRevenge.filter((r) => r.at > t);
  for (const r of due) { const b = botById(r.bot); if (!shielded() && !S.bots[b.id].blocked && S.counters.pranked < CFG.BOT_PRANKS_TO_SHIELD) doBotPrank(b, null, true, false, r.at); }
}
function claimGift(b) {
  const bs = S.bots[b.id]; if (bs.giftDay === dayKey()) return null;
  bs.giftDay = dayKey(); stat('gift');
  return grant({ pin: 1, [pick(['wood', 'stone', 'vine'])]: 1 });
}
// ปุ่มในบันทึก: ช่วยกลับ / แกล้งคืน
function replyLog(entry, mode) {
  if (entry.replied) return false;
  const b = botById(entry.bot); const bs = S.bots[b.id];
  if (mode === 'revenge') {
    if (entry.noRevenge || now() - entry.t > CFG.REVENGE_WINDOW_MS || S.peaceful) return false;
    bs.revengeFree = (bs.revengeFree || 0) + 1;
  } else bs.x2 = true;
  entry.replied = mode; stat('reply'); mark(); return true;
}
function bannerBotsNeedingHelp() { return BOTS.filter((b) => helpLeft(b) > 0).length; }
