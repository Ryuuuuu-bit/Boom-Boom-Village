/* Boom Boom Village — เริ่มเกม วนเวลา และเชื่อมทุกส่วนเข้าด้วยกัน */
'use strict';
// S ถูกตั้งหลังเข้าสู่ระบบ (ดู js/auth.js)
let firstRun = false, awaySince = 0;
const authReady = authBoot().then(() => { firstRun = !S.welcomed; awaySince = S.lastSeen; migratePlots(S); applyRain(); dailyReset(); if (AUTH.migrated) setTimeout(() => toast('☁️ ย้ายหมู่บ้านเดิมในเครื่องนี้ขึ้นบัญชีแล้ว', 'good'), 1500); });

// ---------- เหตุการณ์ ----------
let pendingLevel = [];
BUS.on('res', () => hud());
BUS.on('quests', () => hud());
BUS.on('log', () => hud());
BUS.on('toast', (m, c) => toast(m, c));
BUS.on('float', (m) => { if (SCENE) SCENE.floatText(SCENE.player.x, SCENE.player.y - 40, m.replace(/<[^>]+>/g, '🛶')); });
BUS.on('levelup', (lv, u) => { lvBurst(lv); pendingLevel.push([lv, u]); setTimeout(flushLevel, 1400); });
BUS.on('chapter', (name) => { toast(`📖 จบ${name}! เก่งมาก`, 'good'); confetti(60); setTimeout(() => { const t = CHAPTER_TALK[S.story.ch]; if (t) talk(t); }, 900); });
BUS.on('pranks', () => { if (SCENE && SCENE.home) SCENE.refreshPranks(); hud(); });
BUS.on('botvisit', (id, kind) => { if (SCENE) SCENE.botVisit(id, kind); });
BUS.on('goose', () => { sfx('goose'); toast('🦢 ห่านยามจับคนแอบมาแกล้งได้! ได้ค่าปรับ 🐚10', 'good'); hud(); });
BUS.on('refresh', () => { if (SCENE && SCENE.home) SCENE.refreshPlots(); });
function flushLevel() { if (!pendingLevel.length) return; if (uiBlocking()) { setTimeout(flushLevel, 1500); return; } const [lv, u] = pendingLevel.pop(); pendingLevel = []; showLevelUp(lv, u); }

// ---------- เดินทาง ----------
function travel(loc) {
  if (!SCENE || SCENE.loc === loc) return;
  closePanel(); SCENE.stopPlacing(true); sfx('ui');
  SCENE.cameras.main.fadeOut(250);
  SCENE.time.delayedCall(260, () => SCENE.scene.restart({ loc }));
}

// ---------- ข้ามเวลา (โหมดทดสอบ) ----------
function timeSkip(ms) {
  const sh = (o, ks) => ks.forEach((k) => { if (o && o[k]) o[k] -= ms; });
  for (const p of Object.values(S.plots)) sh(p, ['at', 'wetUntil', 'pestAt']);
  for (const a of S.animals) sh(a, ['fedAt', 'readyAt']);
  for (const o of S.objects) { if (o.data && o.data.queue) o.data.queue.forEach((j) => sh(j, ['start', 'end'])); if (o.data && o.data.at) o.data.at -= ms; }
  for (const o of S.orders) if (o.readyAt) o.readyAt -= ms;
  S.botNextAt -= ms; (S.botRevenge || []).forEach((r) => (r.at -= ms)); S.pranksOnMe.forEach((p) => (p.at -= ms));
  for (const b of Object.values(S.bots)) { (b.myPranks || []).forEach((p) => (p.at -= ms)); if (b.village) b.village.at -= ms; }
  mark(); gameTick(); if (SCENE && SCENE.home) SCENE.refreshPlots();
}

// ---------- วนเวลาเกม ----------
function gameTick() {
  if (!S) return;
  dailyReset();
  if (S.welcomed && (!SCENE || !SCENE.placing)) { botTick(); revengeTick(); }
  ordersTick();
  if (S.plots) { migratePlots(S); if (applyRain() && SCENE && SCENE.home) SCENE.refreshPlots(); }
  // ชาวบ้านช่วยรดน้ำดินแห้ง
  const huts = S.objects.filter((o) => o.type === 'hut').length;
  if (huts && S.villagerWater.used < huts * CFG.VILLAGER_WATER_PER_DAY) {
    const k = Object.keys(S.plots).find((k) => plotFlags(S.plots[k]).dry);
    if (k) { waterPlot(k, 'villager'); S.villagerWater.used++; addLog({ kind: 'info', msg: '👨‍🌾 ชาวบ้านช่วยรดน้ำแปลงที่ดินแห้งให้แล้ว' }); }
  }
  if (dirty) save();
}
setInterval(gameTick, 2000);
setInterval(() => hud(), 1000);
window.addEventListener('beforeunload', () => save());
document.addEventListener('visibilitychange', () => { if (document.hidden && S) { save(); if (typeof AUTH !== 'undefined') authPush(true); } });

// ---------- เปิดเกม ----------
bindUI();
bindAuthUI();
// รอฟอนต์โหลดก่อน (ข้อความในฉากวาดเป็นภาพ ถ้าฟอนต์ยังไม่มาจะได้ฟอนต์สำรองแทน)
const fontsReady = document.fonts ? Promise.race([Promise.all(['500 12px "BBV Sans"', '600 12px "BBV Sans"', '700 12px "BBV Sans"'].map((f) => document.fonts.load(f, 'กขAa1'))), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
let game = null;
Promise.all([fontsReady.catch(() => {}), authReady]).then(() => { game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#1a1816', pixelArt: true, roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [World],
}); });
let started = false;
const waitReady = setInterval(() => {
  if (!SCENE || !SCENE.player) return;
  clearInterval(waitReady);
  $('load-bar').style.width = '100%';
  $('start-btn').classList.remove('hidden');
}, 100);
$('start-btn').onclick = () => {
  if (started) return; started = true;
  audioInit(); sfx('boom');
  $('loading').classList.add('hidden');
  ['hud', 'quest', 'side'].forEach((id) => $(id).classList.remove('hidden'));
  hudPlace(); hud();
  if (window.innerWidth < 760) { $('quest').classList.add('min'); $('q-toggle').textContent = '+'; }
  if (firstRun) {
    talk(CHAPTER_TALK[0], () => { S.welcomed = true; mark(); save(); toast('🎯 เริ่มจากไถดิน: เดินไปที่หญ้าว่างแล้วกด Space (หรือใช้จอบ ⛏️ คลิกที่หญ้า)'); });
  } else {
    const missed = S.log.filter((e) => e.t > awaySince && !e.read);
    const after = () => { if (loginStatus().claimable) openPanel('login'); };
    if (missed.length) talk([['npc_grandma', 'ยายหมอบูม', `ระหว่างที่หลานไม่อยู่ ${fmtDur(now() - awaySince)} มีเรื่องเกิดขึ้น ${missed.length} เรื่องนะ:<br>` + missed.slice(0, 4).map((e) => '• ' + e.msg).join('<br>') + (missed.length > 4 ? '<br>…ดูต่อในบันทึก 📜' : '')]], after);
    else after();
  }
};
// ทดสอบอัตโนมัติ: เปิดด้วย index.html#auto จะข้ามหน้าโหลด
if (location.hash === '#auto') { const iv = setInterval(() => { if (!$('start-btn').classList.contains('hidden')) { clearInterval(iv); $('start-btn').click(); } }, 100); }
