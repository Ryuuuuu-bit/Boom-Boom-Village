/* Boom Boom Village — หน้าจอเมนู แถบสถานะ หน้าต่างต่าง ๆ (HTML) */
'use strict';
const $ = (id) => document.getElementById(id);
const IMG = (k, cls = 'icb') => (A.images[k] ? `<img class="${cls}${A.hd && A.hd[k] ? ' hd' : ''}" src="${A.images[k]}" alt="">` : '');
const costHTML = (c) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `<span style="color:${have(k) >= v ? 'inherit' : '#d4573b'}">${iconHTML(k)}${v}</span>`).join(' ');
const fmtNum = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n));
let TOOL = 'hand';
const JOY = { active: false, x: 0, y: 0 };
function getTool() { return TOOL; }
function setTool(t) {
  if (t === 'seed' && TOOL === 'seed') { openPanel('seeds'); return; }
  TOOL = t; document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  if (t === 'move') toast('✋ คลิกสิ่งก่อสร้างหรือของแต่งที่ต้องการย้าย');
  if (t === 'hoe') toast('⛏️ คลิก/ลากบนหญ้าเพื่อไถดิน · คลิกแปลงว่างเพื่อถมคืน');
  if (t === 'can') toast(`💧 คลิก/ลากบนแปลงเพื่อรดน้ำ (เหลือ ${canLeft()}/${CFG.CAN_MAX}) · น้ำหมดให้คลิกแม่น้ำหรือบ่อน้ำเพื่อเติม · ฝนตกจะรดให้ทุกแปลง`);
  if (t === 'seed') toast(`🌱 คลิกแปลงว่างเพื่อปลูก${CROPS[S.seedPick].n} · เก็บแล้วปลูกต่ออัตโนมัติ · กดปุ่มเมล็ดอีกครั้งเพื่อเปลี่ยนชนิด`);
}
function uiBlocking() { return !$('modal').classList.contains('hidden') || !$('talk').classList.contains('hidden') || !$('loading').classList.contains('hidden'); }
function isTyping() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }

// ---------- ข้อความเด้ง ----------
function toast(msg, cls = '') {
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.innerHTML = msg; $('toasts').appendChild(el);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
}
function flyToHud(sx, sy, iconKey) {
  const img = document.createElement('img'); img.src = A.images[iconKey]; img.style.left = sx - 14 + 'px'; img.style.top = sy - 14 + 'px'; $('flyer').appendChild(img);
  const tgt = $('r-store').getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => { img.style.left = tgt.left + 'px'; img.style.top = tgt.top + 'px'; img.style.opacity = '0.2'; }));
  setTimeout(() => { img.remove(); bumpRes('store'); }, 720);
}
// ----- juice: เหรียญพุ่งจากตัวละครเข้าแถบเงิน + ตัวเลขวิ่งขึ้น -----
const RES_IC = { shells: 'ic_shell', amber: 'ic_amber', feathers: 'ic_feather', coins: 'ic_coin_krathong' };
const COUNT = {};
function worldToScreen(x, y) { const c = SCENE.cameras.main; return [(x - c.worldView.x) * c.zoom, (y - c.worldView.y) * c.zoom]; }
function burstFrom() { return SCENE && SCENE.player && SCENE.cameras ? worldToScreen(SCENE.player.x, SCENE.player.y - 30) : [innerWidth / 2, innerHeight / 2]; }
function flyIcons(icon, target, n, onEach) {
  if (!target || !A.images[icon]) return;
  const t = target.getBoundingClientRect(), [sx, sy] = burstFrom(), tx = t.left + t.width / 2 - 15, ty = t.top + t.height / 2 - 15;
  for (let i = 0; i < n; i++) {
    const img = document.createElement('img'); img.className = 'coinfly'; img.src = A.images[icon]; img.style.left = '0'; img.style.top = '0'; img.style.opacity = '0'; document.body.appendChild(img);
    const ox = sx + rnd(-46, 46), oy = sy + rnd(-44, 6);
    const an = img.animate([
      { transform: `translate(${sx - 15}px,${sy - 15}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${ox - 15}px,${oy - 15}px) scale(1.15)`, opacity: 1, offset: 0.28 },
      { transform: `translate(${ox - 15}px,${oy - 9}px) scale(1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${tx}px,${ty}px) scale(.75)`, opacity: 1 }], { duration: 820, delay: i * 55, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
    an.onfinish = () => { img.remove(); onEach && onEach(i); };
  }
}
function coinBurst(k, delta) {
  const tgt = document.querySelector(`#res .r[data-k="${k}"] img`); if (!tgt || !RES_IC[k] || $('hud').classList.contains('hidden')) return;
  const n = Math.min(9, Math.max(2, Math.round(Math.log2(delta + 1) * 1.6)));
  flyIcons(RES_IC[k], tgt, n, (i) => { bumpRes(k); if (i % 2 === 0) sfx('coin', 0.35); });
}
function countTo(k, from, to) {
  const el = $('r-' + k); if (!el) return;
  const cur = COUNT[k] ? COUNT[k].shown : from; const st = { from: cur, to, shown: cur, t0: performance.now() + 450 }; COUNT[k] = st;
  const step = (now) => {
    if (COUNT[k] !== st) return;
    const p = Math.min(1, Math.max(0, (now - st.t0) / 650)), e = 1 - Math.pow(1 - p, 3);
    st.shown = Math.round(st.from + (st.to - st.from) * e); el.textContent = fmtNum(st.shown);
    if (p < 1) requestAnimationFrame(step); else { delete COUNT[k]; el.textContent = fmtNum(lastRes[k]); }
  };
  requestAnimationFrame(step);
}
function xpSpark() { flyIcons('ic_star', $('lvl'), 3, () => { const l = $('lvl'); l.classList.remove('bump'); void l.offsetWidth; l.classList.add('bump'); }); }
function lvBurst(lv) { const d = document.createElement('div'); d.className = 'lvup-burst'; d.innerHTML = `<div>เลเวล ${lv}!</div>`; document.body.appendChild(d); setTimeout(() => d.remove(), 1700); confetti(90); }
function bumpRes(k) { const el = document.querySelector(`#res .r[data-k="${k}"]`); if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function setHint(t) { if ($('hint').textContent !== t) $('hint').textContent = t || ''; }
function placeBar(on, name, move) { $('placebar').classList.toggle('hidden', !on); if (on) $('pl-text').innerHTML = (move ? '✋ ย้าย' : '🔨 วาง') + ` <b>${name}</b>: คลิกที่หญ้าว่าง (กรอบสีเขียว)`; }
function confetti(n = 70) {
  const c = $('confetti'); const cols = ['#ffd27a', '#f2a03b', '#8fd05a', '#e7765a', '#a67ad8', '#7fc4ff'];
  for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.style.left = Math.random() * 100 + 'vw'; e.style.background = pick(cols); e.style.animationDelay = Math.random() * 0.6 + 's'; e.style.animationDuration = 1.8 + Math.random() * 1.4 + 's'; c.appendChild(e); setTimeout(() => e.remove(), 3600); }
}

// ---------- แถบสถานะ ----------
let lastRes = {};
function hud() {
  if (!S) return;
  $('lvl').textContent = S.level;
  $('pname').textContent = (S.title ? `「${S.title}」 ` : '') + ((typeof AUTH !== 'undefined' && AUTH.user && AUTH.user.name) || 'หัวหน้าเผ่า') + ' · ' + ERAS[S.era - 1].n;
  const need = XP_NEED(S.level); $('xpfill').style.width = Math.min(100, (S.xp / need) * 100) + '%';
  $('xptxt').textContent = S.level >= maxLevel() ? 'เลเวลสูงสุดของยุค' : `${S.xp}/${need} XP`;
  const vals = { shells: S.shells, amber: S.amber, feathers: S.feathers, coins: S.event.coins };
  for (const [k, v] of Object.entries(vals)) {
    if (lastRes[k] !== undefined && v > lastRes[k]) { coinBurst(k, v - lastRes[k]); countTo(k, lastRes[k], v); }
    else if (!COUNT[k]) $('r-' + k).textContent = fmtNum(v);
    else COUNT[k].to = v;
    lastRes[k] = v;
  }
  if (lastRes.xp !== undefined && (S.xp > lastRes.xp || S.level > lastRes.lv)) xpSpark();
  lastRes.xp = S.xp; lastRes.lv = S.level;
  $('r-store').textContent = storageUsed() + '/' + storageCap();
  $('r-store').style.color = storageFree() <= 5 ? '#ff9a7a' : '';
  $('r-stars').textContent = '★'.repeat(villageStars());
  const ev = eventActive(); document.querySelector('#res .ev').classList.toggle('hidden', !ev); $('btn-event').classList.toggle('hidden', !ev);
  // ภารกิจ
  const sp = storyProgress();
  if (sp) { $('q-ch').textContent = '🎯 ' + STORY[S.story.ch].ch; $('q-text').innerHTML = sp.st.t + ` <b>(${sp.v}/${sp.st.n})</b><div class="muted">รางวัล: ${Object.entries(sp.st.r).map(([k, v]) => iconHTML(k) + v).join(' ')}</div>`; $('q-fill').style.width = (sp.v / sp.st.n) * 100 + '%'; }
  else { $('q-ch').textContent = '🎯 เนื้อเรื่องจบแล้ว'; $('q-text').textContent = 'ยอดเยี่ยม! ทำภารกิจรายวันและแต่งหมู่บ้านต่อได้เลย'; $('q-fill').style.width = '100%'; }
  dailyReset();
  $('q-daily').innerHTML = '<b>📅 วันนี้</b>' + S.daily.quests.map((q) => `<div class="${q.done ? 'done' : ''}"><span>${q.t}</span><span>${q.prog}/${q.n}</span></div>`).join('');
  // ป้าย
  const chips = [];
  if (rainNow()) chips.push(`<div class="chip rain" title="ฝนตก! รดน้ำให้ทุกแปลงและเติมบัวให้เต็มแล้ว">🌧️ ฝนตก อีก ${fmtDur(rainEnds() - now())}</div>`);
  else { const nr = nextRain(); chips.push(`<div class="chip" title="พยากรณ์อากาศ: ฝนจะตกครั้งหน้า (รดน้ำให้ทุกแปลงฟรี)">☀️ ฝนครั้งหน้า ${nr ? fmtDur(nr - now()) : '-'}</div>`); }
  const wb = weekendInfo(); if (wb) chips.push(`<div class="chip" data-p="help" title="${wb.n}: ${wb.d}">🎉 ${wb.n}</div>`);
  if (ev) chips.push(`<div class="chip ev" data-p="event" title="เทศกาล${ev.n}">🛶 ถึง ${new Date(ev.end).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>`);
  if (shielded()) chips.push(`<div class="chip sh" data-p="settings" title="${S.peaceful ? 'โหมดหมู่บ้านสงบ' : 'มีโล่กันแกล้ง'}">🛡️ ${S.peaceful ? 'สงบ' : fmtDur(S.counters.shieldUntil - now())}</div>`);
  if (S.pranksOnMe.length) chips.push(`<div class="chip" style="background:#ffd0c0" title="มีรอยแกล้งในหมู่บ้าน กวาดเพื่อรับรางวัล!">😈 รอยแกล้ง ${S.pranksOnMe.length}</div>`);
  $('chips').innerHTML = chips.join('');
  // ป้ายแจ้งเตือน
  const unread = S.log.filter((e) => !e.read).length; badge('b-log', unread);
  const dq = S.daily.quests.every((q) => q.done) && !S.daily.chest ? '🎁' : 0; badge('b-daily', dq);
  badge('b-login', loginStatus().claimable ? '!' : 0);
  ordersTick(); badge('b-orders', S.orders.filter((o) => !o.readyAt && canAfford(o.items)).length);
  badge('b-friends', BOTS.filter((b) => helpLeft(b) > 0 && S.bots[b.id].giftDay !== dayKey()).length);
  // บัวรดน้ำ
  const cw = canLeft(); $('can-n').textContent = `บัว ${cw}/${CFG.CAN_MAX}`; $('canbtn').classList.toggle('low', cw <= 3);
  // เมล็ด
  const c = CROPS[S.seedPick] || CROPS.pumpkin; $('seed-ic').innerHTML = IMG(ITEMS[S.seedPick].icon, '') || '🌱'; $('seed-n').textContent = c.n + ((S.seeds[S.seedPick] || 0) ? ` (${S.seeds[S.seedPick]})` : '');
  // กลางคืน
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const dark = h >= 19.5 || h < 5 ? 0.42 : h >= 18 ? (h - 18) / 1.5 * 0.42 : h < 6.5 ? (6.5 - h) / 1.5 * 0.42 : 0;
  $('night').style.opacity = dark.toFixed(2);
}
function badge(id, v) { const el = $(id); if (!el) return; el.classList.toggle('hidden', !v); el.textContent = v || ''; }
function hudPlace() {
  const home = !SCENE || SCENE.home;
  $('place-t').textContent = home ? 'หมู่บ้านของฉัน' : `หมู่บ้าน${SCENE.bot.n}`;
  $('bottom').classList.toggle('hidden', !home); $('fbar').classList.toggle('hidden', home);
  $('quest').classList.toggle('hidden', false);
}

// ---------- แถบหมู่บ้านเพื่อน ----------
function friendBar(b) {
  const bs = S.bots[b.id];
  $('fb-face').src = A.images[b.img]; $('fb-name').textContent = `${b.e} ${b.n} ${'★'.repeat(b.stars)}`;
  $('fb-info').innerHTML = `${b.d}<br>ช่วยได้อีก <b>${helpLeft(b)}</b> ครั้ง · แกล้งได้อีก <b>${bs.revengeFree > 0 ? 'แกล้งคืนฟรี ' + bs.revengeFree : prankLeft(b)}</b> ครั้ง`;
  $('fb-pranks').innerHTML = Object.entries(PRANKS).map(([k, p]) => `<button class="btn purple" data-prank="${k}" ${p.lv > S.level ? 'disabled' : ''} title="${p.d}">${p.e} ${p.n}${p.lv > S.level ? ` (Lv${p.lv})` : ''}</button>`).join('');
  $('fb-gift').disabled = bs.giftDay === dayKey(); $('fb-gift').textContent = bs.giftDay === dayKey() ? '🎁 รับของขวัญแล้ว' : '🎁 รับของขวัญ (หมุดหิน)';
}

// ---------- หน้าต่าง ----------
let PANEL = null;
function openPanel(name, arg, tab) {
  if (!PANELS[name]) return;
  audioInit(); sfx('ui');
  PANEL = { name, arg, tab: tab || (PANEL && PANEL.name === name ? PANEL.tab : null) };
  renderPanel(true);
}
function closePanel() { if ($('modal').classList.contains('hidden')) return; $('modal').classList.add('hidden'); const p = PANEL; PANEL = null; if (p && p.onClose) p.onClose(); hud(); }
function renderPanel(first) {
  if (!PANEL) return;
  const r = PANELS[PANEL.name](PANEL.arg, PANEL);
  if (!r) { closePanel(); return; }
  const body = $('m-body'); const sc = $('m-box').scrollTop;
  const pic = PANEL_IC[PANEL.name]; const mic = $('m-ic');
  if (pic && A.images[pic]) { mic.src = A.images[pic]; mic.classList.remove('hidden'); } else mic.classList.add('hidden');
  $('m-title').innerHTML = pic ? String(r.title).replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '') : r.title; body.innerHTML = r.html; PANEL.acts = r.acts || {}; PANEL.live = r.live; PANEL.onClose = r.onClose;
  $('m-box').classList.toggle('narrow', !!r.narrow);
  $('modal').classList.remove('hidden');
  if (!first) $('m-box').scrollTop = sc;
}
function tabsHTML(list, cur) { return `<div class="tabs">${list.map(([k, n]) => `<button data-tab="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>`; }

const PANELS = {};
const PANEL_IC = { build: 'ui_build', market: 'ui_market', orders: 'ui_orders', storage: 'ui_storage', friends: 'ui_friends', log: 'ui_log', daily: 'ui_daily', login: 'ui_gift', ach: 'ui_trophy', event: 'ui_raft', settings: 'ui_gear', account: 'ui_friends', help: 'ui_help', expand: 'ui_flag', chief: 'ui_crown', bonfire: 'ui_fire', hut: 'ui_home', seeds: 'ui_seed' };
// --- สร้าง ---
PANELS.build = (arg, P) => {
  const tab = P.tab || 'building';
  const tabs = [['building', '🏠 อาคาร'], ['tree', '🌴 ต้นไม้'], ['deco', '🌸 ของแต่ง'], ['kind', '🌟 ขนนกทอง'], ['bag', '🎒 กระเป๋า']]; if (eventActive()) tabs.push(['event', '🛶 เทศกาล']);
  let html = tabsHTML(tabs, tab) + '<div class="grid">';
  if (tab === 'bag') {
    const items = Object.entries(S.bag).filter(([, n]) => n > 0);
    if (!items.length) html += '<div class="muted">ยังไม่มีของในกระเป๋า (ได้จากวงล้อรายวันหรือรางวัลต่าง ๆ)</div>';
    for (const [k, n] of items) html += `<div class="card"><span class="cnt">x${n}</span><div class="pic">${IMG(BUILDS[k].img, '')}</div><div class="nm">${BUILDS[k].n}</div><button class="btn green sm" data-a="bag" data-v="${k}">วาง</button></div>`;
  } else {
    for (const [k, b] of Object.entries(BUILDS)) {
      if (b.cat !== tab) continue;
      const lock = (b.lv || 1) > S.level; const cost = buildCost(k);
      const count = S.objects.filter((o) => o.type === k).length;
      let ds = b.d || (b.fruit ? `ออก${ITEMS[b.fruit].n}ทุก ${fmtDur(b.ms)}` : b.beauty ? `ความสวย +${b.beauty}` : '');
      if (b.factory) ds = 'ผลิต ' + FACTORIES[b.factory].recipes.map((r) => ITEMS[r.out].n).join(', ');
      const limit = b.factory && count >= 1;
      html += `<div class="card ${lock ? 'lock' : ''}">${count ? `<span class="cnt">มี ${count}</span>` : ''}<div class="pic">${b.img ? IMG(b.img, '') : '<span style="font-size:36px">🐾</span>'}</div><div class="nm">${b.n}</div><div class="ds">${ds}</div>
        ${lock ? `<div class="muted">🔒 ปลดที่ Lv ${b.lv}</div>` : limit ? '<div class="muted">สร้างได้ 1 หลัง</div>' : `<button class="btn ${canAfford(cost) ? 'green' : ''} sm" data-a="buy" data-v="${k}">${costHTML(cost)}</button>`}</div>`;
    }
  }
  html += '</div>';
  if (tab === 'building') { const e = nextExpansion(); html += `<div class="section">🚩 ขยายที่ดิน</div><div class="row"><div class="grow">ที่ดินตอนนี้ ${S.owned.w}×${S.owned.h} ช่อง</div>${e ? `<button class="btn gold sm" data-a="expand">ขยาย ${costHTML(e.cost)}</button>` : '<span class="muted">ขยายเต็มแล้ว</span>'}</div>`; }
  return { title: '🔨 สร้างและแต่งหมู่บ้าน', html, acts: {
    buy: (k) => { const c = buildCost(k); if (!canAfford(c)) { toast('ของไม่พอ: ' + missingText(c), 'bad'); sfx('error'); return; } closePanel(); SCENE.startPlacing(k); },
    bag: (k) => { closePanel(); SCENE.startPlacing(k, true); },
    expand: () => openPanel('expand'),
  } };
};
PANELS.expand = () => {
  const e = nextExpansion();
  if (!e) return { title: '🚩 ขยายที่ดิน', narrow: true, html: '<p>ที่ดินขยายเต็มพื้นที่ของยุคนี้แล้ว!</p>' };
  return { title: '🚩 ขยายที่ดิน', narrow: true, html: `<p>ขยายที่ดินไปทาง${e.dir === 'east' ? 'ตะวันออก (ขวา)' : 'ใต้ (ล่าง)'} อีก 4 ช่อง จะได้พื้นที่ปลูก/สร้างเพิ่ม และเศษไม้หินให้เก็บกวาด</p>
    <p>ราคา: ${costHTML(e.cost)}</p>${e.cost.pin ? `<p class="muted">${iconHTML('pin')}หมุดหิน ได้จากของขวัญเพื่อน (รับวันละ 1 ชิ้นต่อคน) และคำสั่งซื้อบางใบ</p>` : ''}
    <div class="center"><button class="btn gold" data-a="go" ${canAfford(e.cost) ? '' : 'disabled'}>ขยายเลย!</button></div>`,
    acts: { go: () => { const d = expandLand(); if (!d) { sfx('error'); return; } sfx('boom'); confetti(40); closePanel(); toast('🎉 ขยายที่ดินแล้ว!', 'good'); SCENE.scene.restart({ loc: 'home' }); } } };
};
// --- เลือกเมล็ด ---
PANELS.seeds = () => {
  let html = '<div class="grid">';
  for (const [k, c] of Object.entries(CROPS)) {
    const lock = c.lv > S.level;
    html += `<div class="card ${lock ? 'lock' : ''}" ${S.seedPick === k ? 'style="border-color:#f2b84b"' : ''}><div class="pic">${IMG(ITEMS[k].icon)}</div><div class="nm">${c.n}${c.regrow ? ' 🌿' : ''}</div>
      <div class="ds">โต ${fmtDur(c.ms)} · ได้ ${c.yield}${c.regrow ? ` x${c.regrow} รอบ` : ''} · ขาย ${iconHTML('shells')}${ITEMS[k].price}</div>
      ${lock ? `<div class="muted">🔒 Lv ${c.lv}</div>` : `<button class="btn green sm" data-a="pick" data-v="${k}">${(S.seeds[k] || 0) ? `เมล็ดฟรี ${S.seeds[k]}` : `${iconHTML('shells')}${c.seed}/แปลง`}</button>`}</div>`;
  }
  return { title: '🌱 เลือกเมล็ดที่จะปลูก', html: html + '</div><p class="muted">💡 หยอดเมล็ดแล้วต้องรดน้ำถึงจะงอก · ดินชุ่มโตเต็มสปีด ดินแห้งโตช้าลง (แต่ไม่ตาย) · 🌿 = เก็บซ้ำได้</p>', acts: { pick: (k) => { S.seedPick = k; mark(); closePanel(); hud(); setTool('seed'); } } };
};
// --- ข้อมูลแปลงที่กำลังโต ---
PANELS.plot = (key) => {
  const p = S.plots[key]; if (!p || plotState(p) !== 'grow') return null;
  const t = now(); const c = CROPS[p.crop]; const ra = plotReadyAt(p, t); const left = ra - t; const cost = speedCost(left); const f = plotFrac(p, t);
  const fl = plotFlags(p, t); const q = plotQuality(p, t); const Q = QUALITY[q];
  const stages = [0, 1, 2, 3, 4].map((i) => `<img src="${A.images['stg_' + p.crop + '_' + i]}" style="width:40px;height:40px;object-fit:contain;${i === plotStage(p, t) ? 'background:#ffe9a8;border-radius:8px;outline:2px solid #f2b84b' : 'opacity:.45'}">`).join('');
  const wet = fl.wet ? `💧 ดินชุ่ม อีก <b>${fmtDur(p.wetUntil - t)}</b> จะแห้ง` : `🏜️ <b>ดินแห้ง!</b> โตช้าลงเหลือ ${Math.round(CFG.DRY_RATE * 100)}% · รดน้ำด่วน`;
  const regrow = c.regrow ? `<div class="muted">🌿 ผักเก็บซ้ำได้ ${c.regrow} ครั้ง (เก็บไปแล้ว ${p.h || 0})</div>` : '';
  return { title: `${IMG(ITEMS[p.crop].icon)} ${c.n}`, narrow: true, live: true, html: `<div style="display:flex;justify-content:center;gap:2px;margin-bottom:6px">${stages}</div>
    <div class="pbar"><div style="width:${f * 100}%"></div></div><p>อีกประมาณ <b>${fmtDur(left)}</b> จะสุก ${p.bonus ? `· ไล่หนอนแล้ว ได้เพิ่ม +${p.bonus}` : ''}</p>
    <p style="margin:4px 0">${wet}</p>
    <p style="margin:4px 0">คุณภาพตอนนี้: <b>${Q.star || '▫️'} ${Q.n}</b> <span class="muted">(ดูแลดี ไม่ปล่อยดินแห้ง = เกรดทอง ได้ผลผลิต/XP มากขึ้น)</span></p>${regrow}
    <div class="center" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
    ${!fl.wet ? `<button class="btn blue" data-a="water">💧 รดน้ำ (บัว ${canLeft()}/${CFG.CAN_MAX})</button>` : ''}
    <button class="btn gold" data-a="speed">${cost ? `⚡ เร่งให้สุกเลย ${iconHTML('amber')}${cost}` : '⚡ เร่งฟรี!'}</button>
    ${S.inv.compost ? `<button class="btn green" data-a="compost">🍂 ใส่ปุ๋ย (ลดเวลาครึ่งหนึ่ง +เกรด) มี ${S.inv.compost}</button>` : ''}</div>`,
    acts: { speed: () => { if (!speedPlot(key)) { toast('อำพันไม่พอ', 'bad'); sfx('error'); return; } sfx('amber'); closePanel(); },
      compost: () => { useCompost(key); sfx('plant'); renderPanel(); },
      water: () => { closePanel(); if (SCENE) SCENE.clickCell(...key.split(',').map(Number)); } } };
};
// --- ตลาด ---
PANELS.market = (arg, P) => {
  const tab = P.tab || 'sell';
  let html = `<div class="row" style="border:none"><img src="${A.images.npc_teng}" style="height:56px;image-rendering:auto"><div class="grow"><b>ลุงเท่ง พ่อค้าเร่:</b> ${weekendBuff() === 'market' ? 'สุดสัปดาห์นี้รับซื้อแพงขึ้น 20% นะหลานเอ๊ย!' : pick(['ของดีราคาถูก มาดูก่อนได้!', 'ขายของให้ลุงหน่อย ลุงจ่ายเป็นเปลือกหอยสวย ๆ', 'ระวังยุ้งฉางเต็มนะ ขายบ้างก็ดี'])}</div></div>`;
  html += tabsHTML([['sell', '💰 ขายของ'], ['seeds', '🌱 เมล็ดพันธุ์'], ['animals', '🐾 สัตว์'], ['mat', '🌲 วัสดุ'], ['amber', '🟠 แลกอำพัน']], tab);
  const acts = {};
  if (tab === 'sell') {
    const items = Object.entries(S.inv).filter(([k, n]) => n > 0 && ITEMS[k] && !ITEMS[k].nosell);
    if (!items.length) html += '<p class="muted">ยุ้งฉางว่าง ไปเก็บผลผลิตมาขายกันเถอะ!</p>';
    html += '<div class="grid">' + items.map(([k, n]) => `<div class="card"><span class="cnt">x${n}</span><div class="pic">${IMG(ITEMS[k].icon)}</div><div class="nm">${ITEMS[k].n}</div><div class="ds">${iconHTML('shells')}${sellPrice(k)} /ชิ้น</div>
      <div style="display:flex;gap:4px"><button class="btn sm" data-a="sell1" data-v="${k}">ขาย 1</button><button class="btn green sm" data-a="sellall" data-v="${k}">ขายหมด ${iconHTML('shells')}${sellPrice(k) * n}</button></div></div>`).join('') + '</div>';
    const sell = (k, n) => { n = Math.min(n, S.inv[k] || 0); if (!n) return; S.inv[k] -= n; if (!S.inv[k]) delete S.inv[k]; S.shells += sellPrice(k) * n; stat('sell', n); sfx('coin'); toast(`💰 ขาย${ITEMS[k].n} ${n} ชิ้น ได้ ${iconHTML('shells')}${sellPrice(k) * n}`, 'good'); mark(); hud(); renderPanel(); };
    acts.sell1 = (k) => sell(k, 1); acts.sellall = (k) => sell(k, S.inv[k]);
  } else if (tab === 'seeds') {
    html += '<p class="muted">ปลูกโดยไม่มีเมล็ดก็ได้ ระบบจะหักเปลือกหอยอัตโนมัติ ซื้อเป็นถุง 10 เมล็ดได้ส่วนลด 10%</p><div class="grid">';
    for (const [k, c] of Object.entries(CROPS)) { const lock = c.lv > S.level; const pr = Math.round(c.seed * 10 * 0.9);
      html += `<div class="card ${lock ? 'lock' : ''}">${S.seeds[k] ? `<span class="cnt">มี ${S.seeds[k]}</span>` : ''}<div class="pic">${IMG(ITEMS[k].icon)}</div><div class="nm">เมล็ด${c.n}</div>${lock ? `<div class="muted">🔒 Lv ${c.lv}</div>` : `<button class="btn green sm" data-a="seed" data-v="${k}">10 เมล็ด ${iconHTML('shells')}${pr}</button>`}</div>`; }
    html += '</div>';
    acts.seed = (k) => { const pr = Math.round(CROPS[k].seed * 10 * 0.9); if (!pay({ shells: pr })) { toast('เปลือกหอยไม่พอ', 'bad'); sfx('error'); return; } S.seeds[k] = (S.seeds[k] || 0) + 10; sfx('coin'); renderPanel(); hud(); };
  } else if (tab === 'animals') {
    const pens = S.objects.filter((o) => o.type === 'pen');
    html += `<p class="muted">คอกสัตว์ ${pens.length} คอก · ช่องว่าง ${pens.reduce((s, p) => s + penCap(p) - S.animals.filter((a) => a.pen === p.id).length, 0)} ตัว (สร้างคอกเพิ่มที่เมนู 🔨)</p><div class="grid">`;
    for (const [k, a] of Object.entries(ANIMALS)) { const lock = a.lv > S.level;
      html += `<div class="card ${lock ? 'lock' : ''}"><div class="pic">${IMG(a.img, '')}</div><div class="nm">${a.n}</div><div class="ds">กิน ${Object.entries(a.eat).map(([f, n]) => iconHTML(f) + n).join(' ')} → ${iconHTML(a.give)}${ITEMS[a.give].n} ทุก ${fmtDur(a.ms)}</div>${lock ? `<div class="muted">🔒 Lv ${a.lv}</div>` : `<button class="btn green sm" data-a="animal" data-v="${k}">${iconHTML('shells')}${a.price}</button>`}</div>`; }
    html += '</div>';
    acts.animal = (k) => { const pen = penWithSpace(); if (!pen) { toast('คอกเต็มแล้ว สร้างหรืออัปเกรดคอกก่อนนะ', 'bad'); sfx('error'); return; } if (!pay({ shells: ANIMALS[k].price })) { toast('เปลือกหอยไม่พอ', 'bad'); sfx('error'); return; }
      const a = { id: uid('a'), kind: k, pen: pen.id, fedAt: null, readyAt: null }; S.animals.push(a); SCENE.addAnimal(a); sfx(k === 'boar' ? 'boar' : 'dino'); stat('buy_animal'); toast(`🐾 ${ANIMALS[k].n}มาอยู่ในคอกแล้ว!`, 'good'); renderPanel(); hud(); };
  } else if (tab === 'mat') {
    html += '<p class="muted">วัสดุใช้อัปเกรดยุ้งฉางและคอกสัตว์ ปกติได้จากการเก็บกวาดเศษไม้หินและของขวัญเพื่อน</p><div class="grid">';
    for (const k of ['wood', 'stone', 'vine']) html += `<div class="card"><span class="cnt">มี ${have(k)}</span><div class="pic">${IMG(ITEMS[k].icon)}</div><div class="nm">${ITEMS[k].n}</div><button class="btn green sm" data-a="mat" data-v="${k}">1 ชิ้น ${iconHTML('shells')}25</button><button class="btn gold sm" data-a="matA" data-v="${k}">5 ชิ้น ${iconHTML('amber')}3</button></div>`;
    html += '</div>';
    acts.mat = (k) => { if (!pay({ shells: 25 })) { sfx('error'); return toast('เปลือกหอยไม่พอ', 'bad'); } grant({ [k]: 1 }); sfx('coin'); renderPanel(); };
    acts.matA = (k) => { if (!pay({ amber: 3 })) { sfx('error'); return toast('อำพันไม่พอ', 'bad'); } grant({ [k]: 5 }); sfx('amber'); renderPanel(); };
  } else if (tab === 'amber') {
    html += `<p>อำพันได้จากเลเวลอัป ความสำเร็จ ภารกิจ และวงล้อรายวัน · เกมนี้เป็นเวอร์ชันทดลองเล่น ไม่มีการเติมเงินจริง</p>
      <div class="row"><div class="grow">${iconHTML('shells')}500 → ${iconHTML('amber')}5</div><button class="btn gold sm" data-a="ex">แลก</button></div>
      <div class="row"><div class="grow">${iconHTML('feathers')}10 → ${iconHTML('amber')}3</div><button class="btn gold sm" data-a="exf">แลก</button></div>`;
    acts.ex = () => { if (!pay({ shells: 500 })) { sfx('error'); return toast('เปลือกหอยไม่พอ', 'bad'); } grant({ amber: 5 }); sfx('amber'); renderPanel(); };
    acts.exf = () => { if (!pay({ feathers: 10 })) { sfx('error'); return toast('ขนนกทองไม่พอ', 'bad'); } grant({ amber: 3 }); sfx('amber'); renderPanel(); };
  }
  return { title: '🛒 ตลาดกลางหมู่บ้าน', html, acts };
};
// --- ยุ้งฉาง ---
PANELS.storage = () => {
  const cap = storageCap(), used = storageUsed(); const up = STORAGE_UPGRADE(S.storageLvl);
  let html = `<div class="pbar" style="height:16px"><div style="width:${(used / cap) * 100}%;${used / cap > 0.9 ? 'background:#e7765a' : ''}"></div></div><p>ใช้ไป <b>${used}/${cap}</b> ช่อง · ขั้น ${S.storageLvl + 1}</p>`;
  const cats = [['crop', '🌾 พืชผล'], ['animal', '🥚 ผลผลิตสัตว์'], ['fruit', '🍌 ผลไม้'], ['goods', '🥧 สินค้า'], ['material', '🌲 วัสดุ (ไม่กินที่)'], ['special', '✨ พิเศษ (ไม่กินที่)']];
  for (const [c, n] of cats) {
    const items = Object.entries(S.inv).filter(([k, v]) => v > 0 && ITEMS[k] && ITEMS[k].cat === c); if (!items.length) continue;
    html += `<div class="section">${n}</div><div class="grid">` + items.map(([k, v]) => `<div class="card"><span class="cnt">x${v}</span><div class="pic">${IMG(ITEMS[k].icon)}</div><div class="nm">${ITEMS[k].n}</div></div>`).join('') + '</div>';
  }
  const seeds = Object.entries(S.seeds).filter(([, v]) => v > 0);
  if (seeds.length) html += '<div class="section">🌱 เมล็ด</div><div class="muted">' + seeds.map(([k, v]) => `${iconHTML(k)}${CROPS[k].n} ${v}`).join(' · ') + '</div>';
  html += `<div class="section">⬆️ อัปเกรดยุ้งฉาง (+${CFG.STORAGE_STEP} ช่อง)</div><div class="row"><div class="grow">${costHTML(up)}</div><button class="btn green" data-a="up" ${canAfford(up) ? '' : 'disabled'}>อัปเกรด</button></div>`;
  return { title: '🏚️ ยุ้งฉาง', html, acts: { up: () => { if (!pay(up)) return; S.storageLvl++; stat('storage_up'); sfx('build'); confetti(30); toast('🏚️ ยุ้งฉางใหญ่ขึ้นแล้ว!', 'good'); renderPanel(); hud(); }, sell: () => openPanel('market') } };
};
// --- คำสั่งซื้อ ---
PANELS.orders = () => {
  ordersTick();
  let html = '<p class="muted">ส่งของตามคำขอได้เปลือกหอยมากกว่าขายที่ตลาด! ทิ้งใบที่ไม่อยากทำได้ (ใบใหม่มาใน 15 นาที)</p><div class="grid">';
  S.orders.forEach((o, i) => {
    if (o.readyAt) { html += `<div class="ord center"><div style="font-size:30px">🍃</div><div class="muted">ใบใหม่มาใน ${fmtDur(o.readyAt - now())}</div><button class="btn sm gold" data-a="skip" data-v="${i}">เรียกเลย ${iconHTML('amber')}1</button></div>`; return; }
    const ok = canAfford(o.items);
    html += `<div class="ord ${ok ? 'ok' : ''}"><b>📜 ${o.who}</b>${Object.entries(o.items).map(([k, n]) => `<div class="it ${have(k) >= n ? '' : 'miss'}">${iconHTML(k)} ${ITEMS[k].n} <span style="margin-left:auto">${Math.min(have(k), n)}/${n}</span></div>`).join('')}
      <div class="muted">รางวัล: ${Object.entries(o.reward).map(([k, v]) => iconHTML(k) + v).join(' ')}</div>
      <div style="display:flex;gap:4px"><button class="btn green sm" style="flex:1" data-a="go" data-v="${i}" ${ok ? '' : 'disabled'}>ส่งของ</button><button class="btn red sm" data-a="del" data-v="${i}">ทิ้ง</button></div></div>`;
  });
  html += '</div>';
  return { title: '📋 ต้นไม้คำขอ', html, live: true, acts: {
    go: (i) => { const t = deliverOrder(+i); if (!t) return; toast('📦 ส่งของสำเร็จ! ได้ ' + t, 'good'); confetti(20); renderPanel(); hud(); },
    del: (i) => { discardOrder(+i); renderPanel(); hud(); },
    skip: (i) => { if (!pay({ amber: 1 })) return toast('อำพันไม่พอ', 'bad'); S.orders[+i] = makeOrder(); renderPanel(); },
  } };
};
// --- โรงผลิต ---
PANELS.factory = (o) => {
  const f = FACTORIES[BUILDS[o.type].factory]; const q = o.data.queue || (o.data.queue = []); const slots = o.data.slots || 2; const t = now();
  let html = '<div class="section">สูตร</div>';
  f.recipes.forEach((r, i) => { const ok = canAfford(r.in);
    html += `<div class="row">${IMG(ITEMS[r.out].icon)}<div class="grow"><b>${ITEMS[r.out].n}</b> <span class="muted">(${fmtDur(r.ms)} · ขาย ${iconHTML('shells')}${ITEMS[r.out].price})</span><br>${Object.entries(r.in).map(([k, n]) => `<span style="color:${have(k) >= n ? 'inherit' : '#d4573b'}">${iconHTML(k)}${ITEMS[k].n} ${have(k)}/${n}</span>`).join(' + ')}</div><button class="btn green sm" data-a="make" data-v="${i}" ${ok && q.length < slots ? '' : 'disabled'}>ผลิต</button></div>`; });
  html += `<div class="section">คิวผลิต (${q.length}/${slots})</div>`;
  if (!q.length) html += '<div class="muted">ยังไม่มีงาน เลือกสูตรด้านบนเลย</div>';
  q.forEach((j) => { const done = j.end <= t; const f2 = Math.min(1, Math.max(0, (t - j.start) / (j.end - j.start)));
    html += `<div class="row">${IMG(ITEMS[j.out].icon)}<div class="grow">${ITEMS[j.out].n}<div class="pbar"><div style="width:${f2 * 100}%"></div></div></div><span class="muted">${done ? '✅ เสร็จแล้ว' : j.start > t ? 'รอคิว' : fmtDur(j.end - t)}</span></div>`; });
  const ready = q.filter((j) => j.end <= t).length;
  const nextSlot = QUEUE_SLOT_PRICE[slots];
  html += `<div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">${ready ? `<button class="btn gold" data-a="collect">เก็บของ ${ready} ชิ้น</button>` : ''}${q.length && !ready ? `<button class="btn gold" data-a="rush">⚡ เร่งงานแรก ${iconHTML('amber')}${speedCost(q[0].end - t)}</button>` : ''}${nextSlot !== undefined ? `<button class="btn sm" data-a="slot">+1 ช่องคิว ${iconHTML('shells')}${nextSlot}</button>` : ''}</div>`;
  return { title: `${IMG(BUILDS[o.type].img)} ${f.n}`, html, live: true, acts: {
    make: (i) => { const r = factoryAdd(o, +i); if (r === 'items') { toast('วัตถุดิบไม่พอ', 'bad'); sfx('error'); } else if (r === 'full') toast('คิวเต็ม', 'bad'); renderPanel(); hud(); },
    collect: () => { const g = factoryCollect(o); if (g === 'full') storageFullMsg(); else toast(`📦 เก็บของ ${g} ชิ้น`, 'good'); renderPanel(); hud(); },
    rush: () => { const c = speedCost(q[0].end - now()); if (!pay({ amber: c })) return toast('อำพันไม่พอ', 'bad'); const d = q[0].end - now(); q.forEach((j) => { j.start -= d; j.end -= d; }); sfx('amber'); renderPanel(); },
    slot: () => { if (!pay({ shells: nextSlot })) return toast('เปลือกหอยไม่พอ', 'bad'); o.data.slots = slots + 1; sfx('build'); renderPanel(); },
  } };
};
// --- คอกสัตว์ ---
PANELS.pen = (o) => {
  const lvl = (o.data && o.data.lvl) || 0; const list = S.animals.filter((a) => a.pen === o.id); const up = PEN_UPGRADE[lvl];
  let html = `<p>สัตว์ในคอก ${list.length}/${penCap(o)} ตัว · คลิกสัตว์ในฉากเพื่อให้อาหาร/เก็บผลผลิต</p>`;
  for (const a of list) { const d = ANIMALS[a.kind]; const st = animalState(a);
    html += `<div class="row">${IMG(d.img)}<div class="grow"><b>${d.n}</b><br><span class="muted">${st === 'hungry' ? `หิว อยากกิน ${Object.entries(d.eat).map(([k, n]) => iconHTML(k) + n).join(' ')}` : st === 'ready' ? `✨ ได้${ITEMS[d.give].n}แล้ว!` : `กำลังย่อย อีก ${fmtDur(a.readyAt - now())}`}</span></div></div>`; }
  if (!list.length) html += '<p class="muted">ยังไม่มีสัตว์ ซื้อได้ที่ตลาด แท็บ 🐾 สัตว์</p>';
  html += `<div style="display:flex;gap:8px;justify-content:center;margin-top:8px;flex-wrap:wrap"><button class="btn green" data-a="buy">🛒 ซื้อสัตว์</button>${up ? `<button class="btn" data-a="up" ${canAfford(up) ? '' : 'disabled'}>⬆️ ขยายคอกเป็น ${PEN_CAP[lvl + 1]} ตัว ${costHTML(up)}</button>` : ''}</div>`;
  return { title: '🐾 คอกสัตว์', html, live: true, acts: { buy: () => openPanel('market', null, 'animals'), up: () => { if (!pay(up)) return; o.data.lvl = lvl + 1; sfx('build'); toast('คอกใหญ่ขึ้นแล้ว!', 'good'); renderPanel(); } } };
};
PANELS.hut = () => ({ title: '🏡 กระท่อมชาวบ้าน', narrow: true, html: `<p>มีกระท่อม ${S.objects.filter((o) => o.type === 'hut').length} หลัง ชาวบ้านช่วยรดน้ำแปลงที่ดินแห้งให้อัตโนมัติ</p><p>วันนี้ช่วยไปแล้ว <b>${S.villagerWater.used}/${CFG.VILLAGER_WATER_PER_DAY * S.objects.filter((o) => o.type === 'hut').length}</b> ครั้ง</p>` });
// --- กระท่อมหัวหน้าเผ่า (โปรไฟล์) ---
PANELS.chief = () => {
  const st = S.stats; const b = beauty(); const ns = STARS[villageStars() + 1];
  let html = `<div class="row" style="border:none">${IMG('npc_grandma')}<div class="grow"><b>ยายหมอบูม:</b> ${pick(['หมู่บ้านเราน่าอยู่ขึ้นทุกวันนะหลาน', 'อย่าลืมไปช่วยเพื่อนบ้านด้วยล่ะ', 'โดนแกล้งก็กวาดซะ ได้ของดีกว่าเดิมอีก', 'ปลูกถั่วยักษ์ก่อนนอน ตื่นมาได้เก็บพอดี'])}</div></div>`;
  html += `<div class="kv"><span>เลเวล</span><b>${S.level} (${ERAS[S.era - 1].n})</b><span>ฉายา</span><b>${S.title || '—'}</b><span>ความสวยหมู่บ้าน</span><b>${b} คะแนน · ${'★'.repeat(villageStars())}${ns ? ` (ดาวถัดไปที่ ${ns})` : ''}</b>
    <span>เก็บผลผลิต</span><b>${st.harvest || 0}</b><span>ขายของ</span><b>${st.sell || 0}</b><span>ช่วยเพื่อน</span><b>${st.help || 0}</b><span>แกล้งเพื่อน</span><b>${st.prank || 0}</b><span>กวาดรอยแกล้ง</span><b>${st.clean || 0}</b><span>ส่งคำสั่งซื้อ</span><b>${st.order || 0}</b></div>`;
  const ls = loginStatus();
  html += `<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">${ls.claimable ? '<button class="btn gold" data-a="login">🎁 รับของขวัญวันนี้</button>' : ''}<button class="btn" data-a="ach">🏆 ความสำเร็จ</button><button class="btn" data-a="settings">⚙️ ตั้งค่า / โหมดสงบ</button></div>`;
  return { title: '🏡 กระท่อมหัวหน้าเผ่า', html, acts: { login: () => openPanel('login'), ach: () => openPanel('ach'), settings: () => openPanel('settings') } };
};
// --- กองไฟกลาง (พิธีเลื่อนยุค / เทศกาล) ---
PANELS.bonfire = () => {
  let html = `<p>กองไฟศักดิ์สิทธิ์ของเผ่า ที่นี่ใช้ทำ <b>พิธีเลื่อนยุค</b> เมื่อถึงเลเวล ${MAX_LEVEL_ERA1}</p>`;
  if (S.era >= 2) html += '<p>🔥 หมู่บ้านของคุณเข้าสู่ <b>ยุคไฟและดินเผา</b> แล้ว! (เลเวลสูงสุดเพิ่มเป็น 34 · เนื้อหายุค 2 จะตามมาในเวอร์ชันถัดไป)</p>';
  else {
    html += '<div class="section">ของที่ต้องส่งเข้าพิธี</div>';
    for (const [k, n] of Object.entries(ERA_CEREMONY)) { const d = S.eraDelivered[k] || 0;
      html += `<div class="row">${iconHTML(k)}<div class="grow">${nameOf(k)} ${d}/${n}</div>${d < n ? `<button class="btn sm green" data-a="give" data-v="${k}" ${have(k) > 0 ? '' : 'disabled'}>ส่ง</button>` : '✅'}</div>`; }
    const all = Object.entries(ERA_CEREMONY).every(([k, n]) => (S.eraDelivered[k] || 0) >= n);
    html += `<div class="center" style="margin-top:10px"><button class="btn gold" data-a="era" ${all && S.level >= MAX_LEVEL_ERA1 ? '' : 'disabled'}>🔥 เริ่มพิธีเลื่อนยุค ${S.level < MAX_LEVEL_ERA1 ? `(ต้อง Lv ${MAX_LEVEL_ERA1})` : ''}</button></div>`;
  }
  if (eventActive()) html += '<div class="center" style="margin-top:10px"><button class="btn purple" data-a="ev">🛶 ร้านเทศกาล</button></div>';
  return { title: '🔥 กองไฟกลางเผ่า', html, acts: {
    give: (k) => { const need = ERA_CEREMONY[k] - (S.eraDelivered[k] || 0); const n = Math.min(need, have(k)); if (!pay({ [k]: n })) return; S.eraDelivered[k] = (S.eraDelivered[k] || 0) + n; sfx('build'); renderPanel(); },
    era: () => { S.era = 2; stat('era', 0); checkStory(); sfx('levelup'); confetti(140); closePanel(); talk([[ 'npc_grandma', 'ยายหมอบูม', 'ไฟศักดิ์สิทธิ์ลุกโชนแล้ว! เผ่าของเราเข้าสู่ยุคไฟและดินเผา! 🔥' ]]); hud(); },
    ev: () => openPanel('event'),
  } };
};
// --- เพื่อน ---
PANELS.friends = (arg, P) => {
  if (!P.loaded && realOn()) { P.loaded = true; loadFriends().then(() => { if (PANEL === P) renderPanel(); }); }
  let html = '<p class="muted">ไปเยี่ยมหมู่บ้านเพื่อนเพื่อช่วยรดน้ำ ไล่หนอน ให้อาหารสัตว์ (ได้ขนนกทอง) หรือจะแกล้งก็ได้ แต่ระวังโดนแกล้งคืน! 😈</p>' + realFriendsHTML() + '<div class="section">🏕️ เพื่อนบ้าน (ชาวเผ่า NPC)</div>';
  for (const b of BOTS) { const bs = S.bots[b.id];
    html += `<div class="row"><img src="${A.images[b.img]}" style="height:56px;image-rendering:auto"><div class="grow"><b>${b.e} ${b.n}</b> ${'★'.repeat(b.stars)}${bs.blocked ? ' <span class="muted">(บล็อกอยู่)</span>' : ''}<br><span class="muted">${b.d}</span><br>ช่วยได้อีก ${helpLeft(b)} · แกล้งได้อีก ${prankLeft(b)} · ${bs.giftDay === dayKey() ? 'รับของขวัญแล้ว' : '🎁 มีของขวัญรออยู่'}</div>
      <div style="display:flex;flex-direction:column;gap:4px"><button class="btn green" data-a="go" data-v="${b.id}">🚶 ไปเยี่ยม</button><button class="btn sm" data-a="block" data-v="${b.id}">${bs.blocked ? 'เลิกบล็อก' : '🚫 บล็อก'}</button></div></div>`; }
  html += `<p class="muted">วันนี้ช่วยไปแล้ว ${S.counters.helps}/${CFG.HELP_PER_DAY} · แกล้งไปแล้ว ${S.counters.pranks}/${prankQuota()} · โดนแกล้ง ${S.counters.pranked}/${CFG.BOT_PRANKS_TO_SHIELD} (ครบแล้วได้โล่ถึงเที่ยงคืน)</p>`;
  return { title: '👥 เพื่อนบ้าน', html, acts: { ...realFriendActs,
    go: (id) => { closePanel(); travel(id); },
    block: (id) => { S.bots[id].blocked = !S.bots[id].blocked; mark(); toast(S.bots[id].blocked ? `บล็อก${botById(id).n}แล้ว จะไม่มาแกล้งอีก` : 'เลิกบล็อกแล้ว'); renderPanel(); },
  } };
};
// --- บันทึก ---
PANELS.log = () => {
  let html = '';
  if (!S.log.length) html = '<p class="muted">ยังไม่มีเหตุการณ์ เพื่อน ๆ จะแวะมาช่วยหรือแกล้งเร็ว ๆ นี้</p>';
  for (const e of S.log.slice(0, 50)) {
    const b = e.bot && botById(e.bot);
    const canRev = e.kind === 'prank' && !e.replied && !e.noRevenge && now() - e.t < CFG.REVENGE_WINDOW_MS && !S.peaceful;
    const canHelp = (e.kind === 'help' || e.kind === 'gift') && !e.replied;
    html += `<div class="log-e ${e.read ? '' : 'new'}">${b ? `<img class="face" src="${A.images[b.img]}">` : '<span style="font-size:22px">📌</span>'}<div class="grow" style="flex:1">${e.msg}<div class="t">${fmtAgo(e.t)}${e.replied ? ' · ตอบกลับแล้ว ✓' : ''}</div></div>
      ${canRev ? `<button class="btn purple sm" data-a="rev" data-v="${e.id}">😈 แกล้งคืน</button>` : ''}${canHelp ? `<button class="btn green sm" data-a="thx" data-v="${e.id}">💛 ช่วยกลับ</button>` : ''}</div>`;
  }
  return { title: '📜 บันทึกหมู่บ้าน', html, onClose: () => { S.log.forEach((e) => (e.read = true)); mark(); hud(); }, acts: {
    rev: (id) => { const e = S.log.find((x) => x.id === id); if (replyLog(e, 'revenge')) { closePanel(); toast(`😈 ไปแกล้งคืน${botById(e.bot).n}กัน! (ฟรี ไม่นับโควตา)`, 'good'); travel(e.bot); } },
    thx: (id) => { const e = S.log.find((x) => x.id === id); if (replyLog(e, 'help')) { closePanel(); toast(`💛 ไปช่วย${botById(e.bot).n}กลับ ครั้งแรกได้รางวัล x2!`, 'good'); travel(e.bot); } },
  } };
};
function fmtAgo(t) { const d = now() - t; if (d < MIN) return 'เมื่อสักครู่'; if (d < HOUR) return Math.floor(d / MIN) + ' นาทีที่แล้ว'; if (d < DAY) return Math.floor(d / HOUR) + ' ชม.ที่แล้ว'; return Math.floor(d / DAY) + ' วันที่แล้ว'; }
// --- รายวัน ---
PANELS.daily = () => {
  dailyReset();
  let html = '<p class="muted">ทำครบ 3 ข้อรับหีบสมบัติ! เปลี่ยนภารกิจได้วันละ 1 ครั้ง · รีเซ็ตเที่ยงคืน</p>';
  S.daily.quests.forEach((q, i) => {
    html += `<div class="row"><span style="font-size:22px">${['🌾', '🔨', '💛'][i]}</span><div class="grow">${q.t}<div class="pbar"><div style="width:${(q.prog / q.n) * 100}%"></div></div></div><b>${q.done ? '✅' : q.prog + '/' + q.n}</b>${!q.done && !S.daily.reroll ? `<button class="btn sm" data-a="re" data-v="${i}">🔄</button>` : ''}</div>`;
  });
  const all = S.daily.quests.every((q) => q.done);
  html += `<div class="center" style="margin-top:12px;font-size:46px">${S.daily.chest ? '📭' : '🧰'}</div><div class="center"><button class="btn gold" data-a="chest" ${all && !S.daily.chest ? '' : 'disabled'}>${S.daily.chest ? 'รับหีบแล้ว พรุ่งนี้มาใหม่' : 'เปิดหีบสมบัติ'}</button></div>`;
  return { title: '📅 ภารกิจรายวัน', html, narrow: true, acts: { re: (i) => { rerollDaily(+i); renderPanel(); hud(); }, chest: () => { const t = claimDailyChest(); if (t) { sfx('chest'); confetti(60); toast('🧰 ได้ ' + t, 'good'); renderPanel(); hud(); } } } };
};
// --- วงล้อรายวัน ---
PANELS.login = () => {
  const st = loginStatus();
  let html = '<p class="muted">เข้าเกมทุกวันรับของขวัญ ครบ 7 วันได้รางวัลใหญ่ (หยุดเล่นไม่รีเซ็ต แค่หยุดนับ)</p><div class="wheel">';
  LOGIN_WHEEL.forEach((r, i) => { const got = i < st.step || (i === st.step - 1); const today = i === st.step && st.claimable;
    html += `<div class="${today ? 'today' : i < st.step ? 'got' : ''}"><b>วัน ${i + 1}</b><br>${Object.entries(r).map(([k, v]) => k === 'deco' ? '🥁' + BUILDS[v].n : iconHTML(k) + v).join('<br>')}${i < st.step ? '<br>✅' : ''}</div>`; });
  html += `</div><div class="center" style="margin-top:12px"><button class="btn gold" data-a="go" ${st.claimable ? '' : 'disabled'}>${st.claimable ? '🎁 รับของขวัญวันนี้' : 'รับแล้ว พรุ่งนี้มาใหม่นะ'}</button></div>`;
  return { title: '🎡 ของขวัญเข้าเกมรายวัน', html, acts: { go: () => { const t = claimLogin(); if (t) { sfx('chest'); confetti(50); toast('🎁 ได้ ' + t, 'good'); renderPanel(); hud(); } } } };
};
// --- ความสำเร็จ ---
PANELS.ach = () => {
  let html = '<div class="grid">';
  for (const a of ACHIEVEMENTS) { const tier = S.ach[a.k] || 0; const v = S.stats[a.k] || 0; const nx = a.tiers[Math.min(tier, 2)];
    html += `<div class="card"><div style="font-size:26px">${['🥉', '🥈', '🥇', '🏆'][tier]}</div><div class="nm">${a.n}</div><div class="ds">${tier >= 3 ? 'ครบทุกขั้นแล้ว!' : `ขั้น ${tier + 1}: ${v}/${nx}`}</div><div class="pbar" style="width:100%"><div style="width:${Math.min(100, (v / nx) * 100)}%"></div></div><div class="muted">${tier ? 'ฉายา: ' + a.title[tier - 1] : ''}</div></div>`; }
  return { title: '🏆 ความสำเร็จ', html: html + '</div>' };
};
// --- เทศกาล ---
PANELS.event = () => {
  const ev = eventActive(); if (!ev) return { title: 'เทศกาล', html: '<p>ตอนนี้ยังไม่มีเทศกาล</p>' };
  let html = `<p>${ev.d}</p><p>มี ${iconHTML('coins')}<b>${S.event.coins}</b> ${ev.coin} · หมดเขต ${new Date(ev.end).toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })}</p><div class="grid">`;
  ev.shop.forEach((s, i) => { const nm = s.b ? BUILDS[s.b].n : s.amber ? `อำพัน ${s.amber}` : `ขนนกทอง ${s.feathers}`;
    html += `<div class="card"><div class="pic">${s.b ? IMG(BUILDS[s.b].img, '') : IMG(s.amber ? 'ic_amber' : 'ic_feather')}</div><div class="nm">${nm}</div>${s.b ? `<div class="ds">ความสวย +${BUILDS[s.b].beauty}</div>` : ''}<button class="btn purple sm" data-a="buy" data-v="${i}" ${S.event.coins >= s.cost ? '' : 'disabled'}>${iconHTML('coins')}${s.cost}</button></div>`; });
  return { title: `🛶 เทศกาล${ev.n}`, html: html + '</div>', acts: { buy: (i) => { const s = ev.shop[+i]; if (!pay({ coins: s.cost })) return; if (s.b) { S.bag[s.b] = (S.bag[s.b] || 0) + 1; toast(`ได้${BUILDS[s.b].n} อยู่ในกระเป๋า (เมนู 🔨 › 🎒)`, 'good'); } else grant(s.amber ? { amber: s.amber } : { feathers: s.feathers }); sfx('chest'); renderPanel(); hud(); } } };
};
// --- ตั้งค่า ---
PANELS.settings = () => {
  const canPeace = S.peacefulDay !== dayKey();
  const html = accountRows() + `<div class="row"><div class="grow">🧑 ตัวละคร: ${esc(lookName())}<div class="muted">เปลี่ยนเพศ สีผม สีผิว ชุด และชื่อ</div></div><button class="btn sm gold" data-a="look">แต่งตัว</button></div>
    <div class="row"><div class="grow">🎵 ดนตรีประกอบ</div><button class="btn sm" data-a="mus">${S.settings.music ? 'เปิดอยู่' : 'ปิดอยู่'}</button></div>
    <div class="row"><div class="grow">🔊 เสียงเอฟเฟกต์</div><button class="btn sm" data-a="sfx">${S.settings.sfx ? 'เปิดอยู่' : 'ปิดอยู่'}</button></div>
    <div class="row"><div class="grow">🕊️ โหมดหมู่บ้านสงบ<div class="muted">เปิดแล้วไม่มีใครแกล้งเรา และเราก็แกล้งใครไม่ได้ (สลับได้วันละ 1 ครั้ง)</div></div><button class="btn sm ${S.peaceful ? 'green' : ''}" data-a="peace" ${canPeace ? '' : 'disabled'}>${S.peaceful ? 'เปิดอยู่' : 'ปิดอยู่'}</button></div>
    <div class="row"><div class="grow">💾 บันทึกเกมอัตโนมัติ${AUTH.online ? ' (เซฟขึ้นเซิร์ฟเวอร์)' : 'ในเบราว์เซอร์นี้'}</div><button class="btn sm" data-a="save">บันทึกตอนนี้</button></div>
    <div class="row"><div class="grow">🧪 โหมดทดสอบ: ข้ามเวลา 1 ชั่วโมง<div class="muted">สำหรับลองเล่น ให้ผัก/สัตว์/โรงงานโตเร็ว</div></div><button class="btn sm" data-a="skip">⏩ +1 ชม.</button></div>
    <div class="row"><div class="grow">🗑️ เริ่มเกมใหม่ทั้งหมด</div><button class="btn red sm" data-a="reset">ลบเซฟ</button></div>`;
  return { title: '⚙️ ตั้งค่า', html, narrow: true, acts: {
    mus: () => { S.settings.music = !S.settings.music; mark(); renderPanel(); }, sfx: () => { S.settings.sfx = !S.settings.sfx; mark(); renderPanel(); },
    peace: () => { S.peaceful = !S.peaceful; S.peacefulDay = dayKey(); mark(); toast(S.peaceful ? '🕊️ เปิดโหมดหมู่บ้านสงบแล้ว' : 'ปิดโหมดสงบ เพื่อน ๆ แกล้งได้แล้ว 😈'); renderPanel(); hud(); },
    save: async () => { save(); if (AUTH.online) { clearTimeout(AUTH.timer); AUTH.timer = null; await authPush(); } toast('💾 บันทึกแล้ว', 'good'); },
    account: () => openPanel('account'), look: () => openLook(),
    skip: () => { timeSkip(HOUR); toast('⏩ ข้ามเวลาไป 1 ชั่วโมง', 'good'); },
    reset: () => { if (PANEL.confirmReset) { authResetSave(); } else { PANEL.confirmReset = true; toast('กด "ลบเซฟ" อีกครั้งเพื่อยืนยัน', 'bad'); } },
  } };
};
// --- วิธีเล่น ---
PANELS.help = () => ({ title: '❓ วิธีเล่น Boom Boom Village', html: `
  <div class="section">🎮 การควบคุม</div>
  <div class="kv"><span>เดิน</span><b>WASD / ลูกศร หรือคลิกที่พื้น</b><span>ใช้งาน (ไถ ปลูก รดน้ำ เก็บ)</span><b>Space / E หรือคลิกที่ของ</b><span>ทำหลายแปลงรวด</span><b>กดเมาส์ค้างแล้วลากผ่านแปลง</b><span>เปลี่ยนเครื่องมือ</span><b>1 มือ · 2 จอบ · 3 บัวรดน้ำ · 4 เมล็ด · 5 ย้าย</b><span>ซูม</span><b>ลูกกลิ้งเมาส์</b><span>หมุนของตอนวาง</span><b>R</b><span>ยกเลิก / ปิดหน้าต่าง</span><b>Esc</b></div>
  <div class="section">🌾 ปลูกผัก</div><p>ไถดิน → หยอดเมล็ด → <b>รดน้ำให้เมล็ดงอก</b> → ต้นโต 5 ขั้น (เมล็ด ต้นอ่อน ต้นเล็ก ต้นโต สุก) → เก็บ</p>
  <ul><li>💧 <b>ดินชุ่ม</b> (สีเข้ม) ผักโตเต็มสปีด พอดินแห้ง (มีรอยแตก) ผักโตช้าลงเหลือ 30% รดน้ำใหม่ได้เลย ผักส่วนใหญ่ต้องรด 2 รอบ</li>
  <li>🪣 <b>บัวรดน้ำ</b> จุ ${CFG.CAN_MAX} ครั้ง หมดแล้วเดินไปคลิกที่แม่น้ำหรือบ่อน้ำเพื่อเติม</li>
  <li>🌧️ <b>ฝนตก</b> (ทุกคนเห็นพร้อมกัน) รดน้ำให้ทุกแปลงและเติมบัวให้ฟรี ดูพยากรณ์ได้ที่ป้ายซ้ายบน</li>
  <li>⭐ <b>คุณภาพ</b>: ดูแลดีไม่ปล่อยดินแห้ง ไล่หนอน ใส่ปุ๋ย ได้เกรดเงิน/ทอง ผลผลิตและ XP เพิ่ม</li>
  <li>🌿 ข้าวโพด พริก ถั่ว <b>เก็บซ้ำได้</b> ต้นไม่ต้องปลูกใหม่</li>
  <li>ผักไม่มีวันเหี่ยวตาย ปล่อยไว้ก็แค่โตช้าลง</li></ul>
  <div class="section">🐾 สัตว์และโรงผลิต</div><p>ให้อาหารสัตว์ในคอก รอแล้วเก็บผลผลิต เอาไปเข้าเตาหิน/ครก/กี่ทอผ้า ทำของราคาแพงขึ้น</p>
  <div class="section">📋 หาเงิน</div><p>ขายที่ตลาด หรือส่งคำสั่งซื้อที่ต้นไม้คำขอ (ได้มากกว่า) ทำภารกิจรายวันรับหีบสมบัติ</p>
  <div class="section">👥 เพื่อนบ้าน ช่วยหรือแกล้ง</div><p>ปูปู้ น้องมะลิ และพี่โต จะแวะมาช่วยหรือแกล้งเป็นระยะ เราไปเยี่ยมช่วยได้ขนนกทอง หรือแกล้งได้วันละ 3 ครั้ง รอยแกล้งไม่ทำให้ของเสียหาย <b>กวาดแล้วได้รางวัลเสมอ</b> โดนครบ 3 ครั้งได้โล่ถึงเที่ยงคืน และมีห่านยามช่วยจับ</p>
  <div class="section">💡 เคล็ดลับ</div><ul>${TIPS.map((t) => `<li>${t}</li>`).join('')}</ul>` });

// ---------- เลเวลอัป ----------
function showLevelUp(lv, unlocks) {
  sfx('levelup'); confetti(110);
  PANEL = { name: 'lv' };
  $('m-title').innerHTML = '🎉 เลเวลอัป!'; $('m-box').classList.add('narrow');
  $('m-body').innerHTML = `<div class="lvup"><div class="big">${lv}</div><p>ได้ ${iconHTML('amber')}3 เป็นของขวัญ!</p><b>ปลดล็อกใหม่</b><br><ul>${unlocks.map((u) => `<li>${u}</li>`).join('')}</ul><br><button class="btn gold" data-a="ok">เย้!</button></div>`;
  PANEL.acts = { ok: () => closePanel() }; $('modal').classList.remove('hidden');
}

// ---------- บทสนทนา ----------
let TALKQ = [];
function talk(lines, done) { TALKQ = lines.slice(); TALKQ.done = done; nextTalk(); }
function nextTalk() {
  const l = TALKQ.shift();
  if (!l) { $('talk').classList.add('hidden'); const d = TALKQ.done; TALKQ = []; if (d) d(); return; }
  $('talk').classList.remove('hidden'); $('talk-face').src = A.images[l[0]]; $('talk-name').textContent = l[1]; $('talk-text').innerHTML = l[2];
  $('talk-next').textContent = TALKQ.length ? 'ต่อไป ▶' : 'โอเค!'; sfx('ui');
}
const CHAPTER_TALK = [
  [['npc_grandma', 'ยายหมอบูม', 'โอ้! หัวหน้าเผ่าคนใหม่มาถึงแล้ว ยินดีต้อนรับสู่หมู่บ้าน <b>Boom Boom</b> จ้ะหลาน'], ['npc_grandma', 'ยายหมอบูม', 'เผ่าเรายังเล็กนัก ลองไถดิน ปลูกฟักทอง แล้วรดน้ำดูนะ ยายจะคอยบอกทางเอง (ดูกล่อง 🎯 ด้านซ้าย)'], ['npc_pupu', 'ปูปู้', 'เฮ้! ข้าปูปู้ หัวหน้าเผ่าข้างบ้าน ถ้าหมู่บ้านเจ้าน่าแกล้งเมื่อไหร่... ฮิฮิ 😈']],
  [['npc_grandma', 'ยายหมอบูม', 'เก่งมากหลาน! ต่อไปเราจะจุดไฟแรกของเผ่า ขยายที่ดิน สร้างเตาหิน แล้วอบพายฟักทองกัน 🔥']],
  [['npc_teng', 'ลุงเท่ง', 'หมู่บ้านคึกคักขึ้นเยอะเลย! สร้างกระท่อมให้ชาวบ้านมาอยู่ แล้วแต่งหมู่บ้านให้สวย ลุงจะได้แวะบ่อย ๆ']],
  [['npc_mali', 'น้องมะลิ', 'สวัสดีค่ะ 🌸 เพื่อนบ้านที่ดีต้องช่วยกันนะคะ แวะมาช่วยรดน้ำให้มะลิบ้างนะ'], ['npc_to', 'พี่โต', 'ถ้าโดนปูปู้แกล้งก็อย่าโกรธนะ กวาดแล้วได้ของดีกว่าเดิมอีก ฮ่า ๆ 💪']],
  [['npc_grandma', 'ยายหมอบูม', 'ถึงเวลาเตรียมพิธีเลื่อนยุคแล้ว! เมื่อหลานถึงเลเวล 19 ให้นำของมาถวายที่กองไฟกลางเผ่า']],
];

// ---------- ผูกปุ่ม ----------
function bindUI() {
  document.querySelectorAll('img[data-ic]').forEach((im) => (im.src = A.images[im.dataset.ic] || ''));
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const pb = t.closest('[data-p]'); if (pb && !t.closest('#m-body')) { openPanel(pb.dataset.p); return; }
    const tb = t.closest('[data-tool]'); if (tb) { sfx('ui'); setTool(tb.dataset.tool); return; }
    const tab = t.closest('[data-tab]'); if (tab && PANEL) { PANEL.tab = tab.dataset.tab; sfx('ui'); renderPanel(true); return; }
    const a = t.closest('[data-a]'); if (a && PANEL && PANEL.acts && PANEL.acts[a.dataset.a]) { if (a.disabled) return; PANEL.acts[a.dataset.a](a.dataset.v); return; }
    const pr = t.closest('[data-prank]'); if (pr && SCENE && !SCENE.home) { SCENE.friendPrank(pr.dataset.prank); return; }
  });
  $('m-close').onclick = () => { sfx('ui'); closePanel(); };
  $('modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal') closePanel(); });
  $('prof').onclick = () => openPanel('chief');
  $('q-toggle').onclick = () => { $('quest').classList.toggle('min'); $('q-toggle').textContent = $('quest').classList.contains('min') ? '+' : '–'; };
  $('talk-next').onclick = nextTalk;
  $('pl-cancel').onclick = () => SCENE && SCENE.stopPlacing();
  $('fb-home').onclick = () => travel('home');
  $('fb-gift').onclick = () => { const b = SCENE.bot; const t = claimGift(b); if (t) { sfx('chest'); toast(`🎁 ${b.n}ให้ ${t}`, 'good'); friendBar(b); hud(); } };
  $('fb-msg').onclick = () => { const b = SCENE.bot; const m = pick(QUICK_MSG); SCENE.say(SCENE.player, m); SCENE.time.delayedCall(1200, () => SCENE.say(SCENE.owner, pick(['555 โอเค!', 'จ้า 💛', 'รอดูเลย 😏', 'ขอบใจ!']))); };
  $('act-btn').onclick = () => SCENE && SCENE.spaceAct();
  // จอยสติ๊กบนมือถือ
  const joy = $('joy'), knob = $('joy-knob');
  const jm = (e) => { const r = joy.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; let x = (t.clientX - r.left - 55) / 45, y = (t.clientY - r.top - 55) / 45; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } JOY.x = x; JOY.y = y; JOY.active = l > 0.2; knob.style.left = 35 + x * 35 + 'px'; knob.style.top = 35 + y * 35 + 'px'; e.preventDefault(); };
  const je = () => { JOY.active = false; knob.style.left = '35px'; knob.style.top = '35px'; };
  joy.addEventListener('touchstart', jm, { passive: false }); joy.addEventListener('touchmove', jm, { passive: false }); joy.addEventListener('touchend', je);
  if ('ontouchstart' in window) { joy.classList.remove('hidden'); $('act-btn').classList.remove('hidden'); }
  setInterval(() => { if (PANEL && PANEL.live && !$('modal').classList.contains('hidden')) renderPanel(); }, 1000);
}
