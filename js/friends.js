/* Boom Boom Village — เพื่อนจริง: เพิ่มเพื่อนด้วยรหัส ไปเยี่ยม ช่วย แกล้ง และรับสิ่งที่เพื่อนทำกับหมู่บ้านเรา */
'use strict';
let FRIENDS = [];          // [{ id, name, level, lastActive, helps, pranks }]
let MY_CODE = null;
let REAL_VISIT = null;     // ข้อมูลหมู่บ้านเพื่อนที่กำลังไปเยี่ยม
const realOn = () => typeof AUTH !== 'undefined' && AUTH.online && !AUTH.blocked;

// เพื่อนจริงในรูปแบบเดียวกับเพื่อนบอท (ใช้ระบบโควตา/รางวัลเดิมได้)
function realBotById(id) {
  if (!id || !String(id).startsWith('u:')) return undefined;
  const uid = String(id).slice(2);
  const f = FRIENDS.find((x) => x.id === uid);
  const name = (f && f.name) || (S && S.friendNames && S.friendNames[uid]) || 'เพื่อน';
  const lv = (f && f.level) || 1;
  if (S && S.bots && !S.bots[id]) S.bots[id] = { helps: 0, pranks: 0, day: dayKey(), giftDay: null, blocked: false, village: null, myPranks: [], x2: false, revengeFree: 0 };
  return { id, uid, real: true, n: name, e: '🏡', img: 'ui_friends', d: `หัวหน้าเผ่าเลเวล ${lv}`, stars: Math.min(3, 1 + Math.floor(lv / 10)), prankRate: 0, seed: +uid || 7 };
}
function rememberFriend(id, name) { if (!S) return; S.friendNames = S.friendNames || {}; if (name && S.friendNames[id] !== name) { S.friendNames[id] = name; mark(); } }

async function loadFriends() {
  if (!realOn()) return;
  try { const r = await api('GET', '/api/friends'); MY_CODE = r.code; FRIENDS = r.friends; FRIENDS.forEach((f) => rememberFriend(f.id, f.name)); } catch (e) {}
}
async function addFriend(code) {
  try {
    const r = await api('POST', '/api/friends/add', { code });
    rememberFriend(r.friend.id, r.friend.name);
    toast(`🤝 เป็นเพื่อนกับ ${esc(r.friend.name)} แล้ว!`, 'good'); sfx('chest');
    await loadFriends(); return true;
  } catch (e) { toast(e.message, 'bad'); return false; }
}
const inviteLink = () => `${location.origin}/?f=${MY_CODE}`;

// ---------- ไปเยี่ยมเพื่อนจริง ----------
async function visitReal(loc) {
  const b = botById(loc);
  try {
    const r = await api('GET', '/api/village?id=' + b.uid);
    rememberFriend(r.user.id, r.user.name);
    if (!r.village) { toast(`${esc(r.user.name)} ยังไม่ได้เริ่มสร้างหมู่บ้านเลย`, 'bad'); return false; }
    const t = Date.now();
    r.village.pranksOnMe = r.village.pranksOnMe.concat(r.pending).filter((p) => t < (p.at || 0) + CFG.PRANK_EXPIRE_MS);
    REAL_VISIT = r;
    const bs = S.bots[loc]; bs.helps = Math.max(bs.helps, r.today.helps); bs.pranks = Math.max(bs.pranks, Math.min(CFG.PRANK_PER_FRIEND, r.today.pranks));
    return true;
  } catch (e) { toast(e.message || 'ไปเยี่ยมไม่ได้', 'bad'); return false; }
}
async function realAct(b, kind, what, payload) {
  try { return await api('POST', '/api/village/act', { id: b.uid, kind, what, payload }); } catch (e) { toast(e.message, 'bad'); sfx('error'); return null; }
}
// สร้างรอยแกล้งให้เข้ากับหมู่บ้านจริงของเพื่อน
function realPrankOpts(kind, v) {
  const W = v.owned.w, H = v.owned.h;
  const objAt = (x, y) => v.objects.some((o) => { const d = BUILDS[o.type]; return d && x >= o.x && x < o.x + d.w && y >= o.y && y < o.y + d.h; });
  const free = (x, y) => !objAt(x, y) && !v.plots[x + ',' + y];
  const take = (cells, n) => { const out = []; while (out.length < n && cells.length) out.push(cells.splice(Math.floor(Math.random() * cells.length), 1)[0]); return out; };
  const o = {};
  if (kind === 'mud') { const c = []; for (let y = 8; y <= 9; y++) for (let x = 1; x < W - 1; x++) if (free(x, y)) c.push([x, y]); o.cells = take(c, rint(3, 5)); }
  if (kind === 'leaves') { const c = []; for (let y = 10; y <= 13; y++) for (let x = 7; x <= 14; x++) if (x < W && y < H && free(x, y)) c.push([x, y]); o.cells = take(c, 6); }
  if (kind === 'sticker') { const t = v.objects.find((x) => x.type === 'statue') || v.objects.find((x) => x.type === 'chief'); if (t) o.target = t.id; o.face = pick(STICKERS); }
  if (kind === 'rooster') { const t = v.objects.find((x) => x.type === 'chief'); if (t) o.target = t.id; }
  if (kind === 'boar') o.pos = [rint(3, Math.max(4, W - 4)), rint(9, Math.max(10, H - 3))];
  if (kind === 'monkey') {
    const trees = v.objects.filter((x) => BUILDS[x.type] && BUILDS[x.type].fruit);
    if (!trees.length) return null;
    trees.forEach((x) => { x.data = x.data || {}; treeTick(x); });
    const tr = trees.find((x) => x.data.n >= 2) || trees[0];
    o.target = tr.id; o.stolen = tr.data.n >= 2 ? 1 : 0; o.fruit = BUILDS[tr.type].fruit;
  }
  if ((kind === 'mud' || kind === 'leaves') && !o.cells.length) return null;
  if ((kind === 'sticker' || kind === 'rooster') && !o.target) return null;
  return o;
}

// ---------- รับสิ่งที่เพื่อนทำกับหมู่บ้านเรา ----------
let evBusy = false;
async function pollEvents() {
  if (!realOn() || !S || evBusy) return;
  evBusy = true;
  try {
    const r = await api('GET', '/api/events');
    if (!r.events.length) return;
    S.evDone = S.evDone || [];
    const ids = [];
    for (const ev of r.events) {
      ids.push(ev.id);
      if (S.evDone.includes(ev.id)) continue;
      rememberFriend(ev.actor.id, ev.actor.name);
      try { applyEvent(ev); } catch (e) { console.error(e); }
      S.evDone.push(ev.id);
    }
    if (S.evDone.length > 300) S.evDone = S.evDone.slice(-300);
    save(); clearTimeout(AUTH.timer); AUTH.timer = null; await authPush();
    if (!AUTH.blocked) await api('POST', '/api/events/ack', { ids });
    BUS.emit('refresh'); BUS.emit('pranks'); hud();
  } catch (e) {} finally { evBusy = false; }
}
function applyEvent(ev) {
  const id = 'u:' + ev.actor.id; const nm = esc(ev.actor.name); const P = ev.payload || {}; const t = ev.at;
  if (ev.kind === 'help') {
    let msg = `💛 ${nm} แวะมาช่วยหมู่บ้านเรา`;
    if (P.what === 'water' && S.plots[P.key]) { waterPlot(P.key, id); msg = `💧 ${nm} แวะมารดน้ำแปลงดินแห้งให้ ผักโตเร็วขึ้น`; }
    else if (P.what === 'pest' && S.plots[P.key]) { shooPest(P.key, id); msg = `🐛 ${nm} มาไล่หนอนให้ ได้ผลผลิตเพิ่ม +1`; }
    else if (P.what === 'feed') { const a = S.animals.find((x) => x.id === P.animal); if (a) { feedAnimal(a, id); msg = `🍖 ${nm} มาให้อาหาร${ANIMALS[a.kind].n}ให้ เริ่มผลิตทันที`; } }
    addLog({ kind: 'help', bot: id, msg, t });
    BUS.emit('botvisit', id, 'help');
  } else if (ev.kind === 'caught') {
    S.shells += 10; mark();
    addLog({ kind: 'catch', bot: id, msg: `🦢 ห่านยามจับ ${nm} ได้คาหนังคาเขาตอนจะ${PRANKS[P.kind] ? PRANKS[P.kind].n : 'แกล้ง'}! ได้ค่าปรับ ${iconHTML('shells')}10`, t });
    BUS.emit('goose');
  } else if (ev.kind === 'prank' && PRANKS[P.kind]) {
    const kind = P.kind;
    const p = { id: ev.id, bot: id, kind, at: t, revenge: false };
    const inOwned = (c) => Array.isArray(c) && c[0] >= 0 && c[1] >= 0 && c[0] < S.owned.w && c[1] < S.owned.h;
    if (kind === 'mud' || kind === 'leaves') p.cells = (P.cells || []).filter(inOwned).slice(0, 8);
    if (kind === 'sticker' || kind === 'rooster') { p.target = P.target; p.face = STICKERS.includes(P.face) ? P.face : '🤪'; if (!S.objects.find((o) => o.id === p.target)) { const c = S.objects.find((o) => o.type === (kind === 'sticker' ? 'statue' : 'chief')) || S.objects.find((o) => o.type === 'chief'); p.target = c && c.id; } }
    if (kind === 'boar') p.pos = inOwned(P.pos) ? P.pos : [5, 10];
    let stole = '';
    if (kind === 'monkey') {
      const tr = S.objects.find((o) => o.id === P.target && BUILDS[o.type].fruit) || S.objects.find((o) => BUILDS[o.type].fruit);
      if (tr) { treeTick(tr); p.target = tr.id; p.fruit = BUILDS[tr.type].fruit; p.stolen = P.stolen && tr.data.n >= 1 ? 1 : 0; tr.data.n -= p.stolen; if (p.stolen) stole = ' ไป 1 ลูก'; }
    }
    const ok = (p.cells ? p.cells.length : true) && (kind !== 'sticker' && kind !== 'rooster' && kind !== 'monkey' || p.target);
    if (ok && Date.now() < t + CFG.PRANK_EXPIRE_MS) S.pranksOnMe.push(p);
    S.counters.pranked++;
    if (S.counters.pranked >= CFG.BOT_PRANKS_TO_SHIELD && !(S.counters.shieldUntil > Date.now())) { S.counters.shieldUntil = midnight(); addLog({ kind: 'info', msg: '🛡️ วันนี้โดนแกล้งครบ 3 ครั้งแล้ว หมู่บ้านได้โล่กันแกล้งถึงเที่ยงคืน', t }); }
    const what = { mud: 'สาดโคลนใส่ทางเดิน', sticker: `แปะสติกเกอร์ ${p.face} บนรูปปั้น`, monkey: `ส่งลิงมาแอบกินผลไม้${stole}`, boar: 'ปล่อยหมูป่ามาวิ่งเล่นในหมู่บ้าน', leaves: 'โปรยใบไม้เต็มลาน', rooster: 'เอาไก่ป่ามาเกาะหลังคาขันเสียงดัง' }[kind];
    addLog({ kind: 'prank', bot: id, prank: kind, prankId: p.id, msg: `${PRANKS[kind].e} ${nm} ${what}! กวาดเพื่อรับรางวัล`, t });
    mark(); BUS.emit('botvisit', id, 'prank');
  }
}

// ---------- แผงเพื่อน (ส่วนเพื่อนจริง) ----------
function realFriendsHTML() {
  if (!realOn()) return `<div class="section">👥 เพื่อนจริง</div><p class="muted">เข้าสู่ระบบแบบออนไลน์ก่อน ถึงจะเพิ่มเพื่อนจริงได้</p>`;
  let html = `<div class="section">👥 เพื่อนจริง</div>
    <div class="row"><div class="grow">รหัสเพื่อนของฉัน <b class="fcode">${MY_CODE || '…'}</b><div class="muted">ส่งรหัสหรือลิงก์ให้เพื่อน เพื่อนกดแล้วเป็นเพื่อนกันทันที</div></div><button class="btn sm gold" data-a="copy" ${MY_CODE ? '' : 'disabled'}>📋 คัดลอกลิงก์ชวนเพื่อน</button></div>
    <div class="row"><input id="fr-code" class="au-in grow" maxlength="8" placeholder="ใส่รหัสเพื่อน เช่น AB12CD" style="text-transform:uppercase"><button class="btn sm green" data-a="add">➕ เพิ่มเพื่อน</button></div>`;
  if (!FRIENDS.length) html += `<p class="muted">ยังไม่มีเพื่อนจริง ชวนเพื่อนมาเล่นแล้วไปช่วยรดน้ำ ไล่หนอน หรือแกล้งกันได้เลย 😈</p>`;
  for (const f of FRIENDS) {
    const b = botById('u:' + f.id);
    const ago = f.lastActive ? fmtDur(Math.max(0, Date.now() - new Date(f.lastActive).getTime())) : null;
    html += `<div class="row"><div class="fr-av">${esc(f.name.slice(0, 1))}</div><div class="grow"><b>${esc(f.name)}</b> · Lv ${f.level}<br><span class="muted">${ago ? 'เล่นล่าสุด ' + ago + 'ที่แล้ว' : 'ยังไม่เคยเล่น'}</span><br>ช่วยได้อีก ${helpLeft(b)} · แกล้งได้อีก ${prankLeft(b)}</div>
      <div style="display:flex;flex-direction:column;gap:4px"><button class="btn green" data-a="goreal" data-v="${f.id}">🚶 ไปเยี่ยม</button><button class="btn sm" data-a="unfriend" data-v="${f.id}">เลิกเป็นเพื่อน</button></div></div>`;
  }
  return html;
}
const realFriendActs = {
  copy: () => { const l = inviteLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => toast('📋 คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย', 'good'), () => toast('ลิงก์ชวนเพื่อน: ' + l)); },
  add: async () => { const c = $('fr-code').value; if (!c.trim()) return; if (await addFriend(c)) renderPanel(); },
  goreal: (id) => { closePanel(); travel('u:' + id); },
  unfriend: async (id) => { const P = PANEL;
    if (P.confirmUn !== id) { P.confirmUn = id; toast('กด "เลิกเป็นเพื่อน" อีกครั้งเพื่อยืนยัน', 'bad'); return; }
    try { await api('POST', '/api/friends/remove', { id }); FRIENDS = FRIENDS.filter((f) => f.id !== id); renderPanel(); } catch (e) { toast(e.message, 'bad'); }
  },
};

// ---------- เริ่มทำงานหลังเข้าสู่ระบบ ----------
async function friendsBoot() {
  if (!realOn()) return;
  await loadFriends();
  const code = new URLSearchParams(location.search).get('f');
  if (code) { history.replaceState(null, '', location.pathname); if (code.toUpperCase() !== MY_CODE) await addFriend(code); }
  await pollEvents();
  setInterval(pollEvents, 30000);
  setInterval(loadFriends, 120000);
}
