// ===== ตัวสร้างตัวละคร: เลือกเพศ สีผม สีผิว สีชุด ชื่อ =====
// ภาพตัวละครมี "แผนที่ส่วน" (rg_m / rg_f) บอกว่าพิกเซลไหนคือ ผม(1) ผิว(2) ชุดใบไม้(3) ผ้าคลุม(4)
// ตอนเข้าเกมจะเปลี่ยนสีเฉพาะส่วนนั้นแล้วสร้างเป็นภาพตัวผู้เล่น (texture 'player') ให้ท่าเดินทุกเฟรมเปลี่ยนตามกัน
// ค่าที่เลือกเก็บไว้ใน S.look จึงขึ้นเซฟบนคลาวด์ไปพร้อมเซฟเกมโดยอัตโนมัติ
const LOOK_OPTS = {
  // h = สี (0-360), s = ความสด, l = ความสว่างหลัก (null = สีเดิมของภาพ)
  hair: [
    { id: 'brown', n: 'น้ำตาล', c: '#8a4a2c', h: null },
    { id: 'black', n: 'ดำ', c: '#2b2a33', h: 230, s: 0.14, l: 0.16 },
    { id: 'blonde', n: 'ทอง', c: '#e8b94a', h: 42, s: 0.78, l: 0.58 },
    { id: 'red', n: 'แดง', c: '#c2402a', h: 8, s: 0.68, l: 0.42 },
    { id: 'silver', n: 'เงิน', c: '#c9ccd6', h: 225, s: 0.12, l: 0.72 },
    { id: 'pink', n: 'ชมพู', c: '#f08cb4', h: 335, s: 0.70, l: 0.66 },
    { id: 'blue', n: 'ฟ้า', c: '#4f8fe0', h: 213, s: 0.66, l: 0.52 },
    { id: 'green', n: 'เขียว', c: '#55a85a', h: 125, s: 0.40, l: 0.45 },
  ],
  skin: [
    { id: 'fair', n: 'ขาว', c: '#ffd9bd', h: 24, s: 0.95, l: 0.82 },
    { id: 'peach', n: 'พีช', c: '#f3a777', h: null },
    { id: 'tan', n: 'แทน', c: '#c98656', h: 24, s: 0.48, l: 0.58 },
    { id: 'brown', n: 'น้ำตาล', c: '#9a6440', h: 22, s: 0.42, l: 0.45 },
    { id: 'deep', n: 'เข้ม', c: '#6a4029', h: 20, s: 0.42, l: 0.32 },
  ],
  outfit: [ // ชุดใบไม้
    { id: 'leaf', n: 'ใบไม้', c: '#8c8a24', h: null },
    { id: 'jade', n: 'หยก', c: '#2f9a6a', dh: 100 },
    { id: 'sky', n: 'ฟ้า', c: '#3c7fc4', dh: 160 },
    { id: 'grape', n: 'องุ่น', c: '#8b4fc0', dh: 225 },
    { id: 'rose', n: 'กุหลาบ', c: '#c44a5c', dh: 300 },
    { id: 'sand', n: 'ทราย', c: '#c9a76a', dh: -15, sm: 0.55, lm: 1.5 },
  ],
  cape: [ // ผ้าคลุม/กระโปรง
    { id: 'ember', n: 'ส้มไฟ', c: '#c4492a', h: null },
    { id: 'sea', n: 'ทะเล', c: '#2f6fc0', dh: 205 },
    { id: 'forest', n: 'ป่า', c: '#3c8f45', dh: 115 },
    { id: 'violet', n: 'ม่วง', c: '#8048b8', dh: 270 },
    { id: 'sun', n: 'ทอง', c: '#d9a12a', dh: 30, lm: 1.1 },
    { id: 'night', n: 'ราตรี', c: '#3a3a52', dh: 230, sm: 0.25, lm: 0.7 },
  ],
};
const LOOK_BASE = { hair: 0.36, skin: 0.70 }; // ความสว่างหลักของภาพเดิม
function defaultLook() { return { g: 'm', hair: 'brown', skin: 'peach', outfit: 'leaf', cape: 'ember', name: '' }; }
function lookOpt(part, id) { return LOOK_OPTS[part].find((o) => o.id === id) || LOOK_OPTS[part][0]; }
function lookName() { return (S && S.look && S.look.name) || (typeof AUTH !== 'undefined' && AUTH.user && !AUTH.user.guest && AUTH.user.name) || 'คุณ'; }

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
// ปรับความสว่างแบบคงเงา/ไฮไลต์: ค่าหลัก base -> target, 0 และ 1 อยู่ที่เดิม
function remapL(l, base, target) { return l <= base ? l * target / base : target + (l - base) * (1 - target) / (1 - base); }
const _cl = (v, a, b) => Math.max(a, Math.min(b, v));

const LOOK_CACHE = {};
function lookSources(g) {
  // คืน {img, ids} ของชีตตัวละครแต่ละเพศ (ids = เลขส่วนของแต่ละพิกเซล)
  if (LOOK_CACHE[g]) return LOOK_CACHE[g];
  const key = g === 'f' ? 'villager_f' : 'villager';
  const tex = SCENE && SCENE.textures.exists(key) ? SCENE.textures.get(key) : null;
  const rtex = SCENE && SCENE.textures.exists('rg_' + g) ? SCENE.textures.get('rg_' + g) : null;
  if (!tex || !rtex) return null;
  const img = tex.getSourceImage(), rimg = rtex.getSourceImage();
  const c = document.createElement('canvas'); c.width = rimg.width; c.height = rimg.height;
  const x = c.getContext('2d'); x.drawImage(rimg, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, ids = new Uint8Array(c.width * c.height);
  for (let i = 0; i < ids.length; i++) ids[i] = Math.round(d[i * 4] / 60);
  return (LOOK_CACHE[g] = { img, ids });
}
function buildLookCanvas(look) {
  const src = lookSources(look.g); if (!src) return null;
  const { img, ids } = src;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
  const T = [null, lookOpt('hair', look.hair), lookOpt('skin', look.skin), lookOpt('outfit', look.outfit), lookOpt('cape', look.cape)];
  const sameSize = ids.length === c.width * c.height;
  for (let i = 0, n = c.width * c.height; i < n; i++) {
    const r = sameSize ? ids[i] : 0; if (!r) continue;
    const t = T[r]; if (!t || (t.h == null && t.dh == null)) continue;
    const p = i * 4; if (!d[p + 3]) continue;
    let [h, s, l] = rgb2hsl(d[p], d[p + 1], d[p + 2]);
    if (r === 1 || r === 2) { // ผม/ผิว: ตั้งสีใหม่ คงเงาเดิม
      const base = r === 1 ? LOOK_BASE.hair : LOOK_BASE.skin;
      const ref = r === 1 ? 0.5 : 0.85;
      h = t.h + (h - (r === 1 ? 17 : 22)) * 0.5; s = _cl(s * t.s / ref, 0, 1);
      // ผิว/ผมที่เข้มกว่าภาพเดิม: ลดความสว่างทั้งช่วงเท่า ๆ กัน (เดิมไฮไลต์ถูกขยายจนหน้าดูด่าง)
      l = _cl(r === 2 && t.l < base ? l * t.l / base : remapL(l, base, t.l), 0, 1);
    } else { // ชุด/ผ้าคลุม: หมุนสี
      h = (h + t.dh + 360) % 360; s = _cl(s * (t.sm || 1), 0, 1); l = _cl(t.lm ? remapL(l, 0.4, _cl(0.4 * t.lm, 0.05, 0.9)) : l, 0, 1);
    }
    h = (h + 360) % 360;
    const [R, G, B] = hsl2rgb(h, s, l); d[p] = R; d[p + 1] = G; d[p + 2] = B;
  }
  x.putImageData(id, 0, 0);
  return c;
}

// สร้าง/อัปเดต texture 'player' + ท่าทาง แล้วสลับให้ตัวผู้เล่นใช้
function applyLook(scene) {
  scene = scene || SCENE; if (!scene) return false;
  const look = Object.assign(defaultLook(), (S && S.look) || {});
  const sig = JSON.stringify([look.g, look.hair, look.skin, look.outfit, look.cape]);
  const pl = scene.player && scene.player.scene ? scene.player : null;
  if (scene.nameTag && scene.nameTag.scene) scene.nameTag.setText(lookName());
  if (scene.textures.exists('player') && scene.textures.get('player')._sig === sig && scene.anims.exists('walk-south')) return true;
  const cv = buildLookCanvas(look);
  const sh = A.sheets[look.g === 'f' ? 'villager_f' : 'villager'] || A.sheets.villager;
  if (pl) pl.anims.stop();
  if (pl) pl.setTexture('villager', 30);
  for (const a of ['idle', 'walk']) for (const d of ['south', 'west', 'east', 'north']) if (scene.anims.exists(`${a}-${d}`)) scene.anims.remove(`${a}-${d}`);
  addLookTexture(scene, 'player', cv, sh); scene.textures.get('player')._sig = cv ? sig : '';
  const rows = { idle: { south: 1, west: 2, east: 3, north: 4 }, walk: { south: 5, west: 6, east: 7, north: 8 } };
  const wn = sh.walk || 6;
  for (const [a, dirs] of Object.entries(rows)) for (const [d, r] of Object.entries(dirs)) {
    const n = a === 'idle' ? 4 : wn;
    scene.anims.create({ key: `${a}-${d}`, frames: scene.anims.generateFrameNumbers('player', { start: r * 6, end: r * 6 + n - 1 }), frameRate: a === 'idle' ? 5 : wn === 4 ? 7 : 10, repeat: -1 });
  }
  if (pl) { pl.setTexture('player', 6); pl.play('idle-' + (scene.dir || 'south')); }
  return true;
}

function addLookTexture(scene, key, cv, sh) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addSpriteSheet(key, cv || scene.textures.get('villager').getSourceImage(), { frameWidth: sh.w, frameHeight: sh.h });
  // ภาพละเอียด 2 เท่า: ย่อขนาดเฟรมให้เท่าเดิม (เหมือน applyHD)
  const k = sh.hd || 1, tex = scene.textures.get(key);
  if (k > 1) {
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR); tex._hd = k;
    for (const name of tex.getFrameNames(true)) { const f = tex.get(name); const uv = [f.u0, f.v0, f.u1, f.v1]; f.setSize(f.cutWidth / k, f.cutHeight / k, f.cutX / k, f.cutY / k); f.u0 = uv[0]; f.v0 = uv[1]; f.u1 = uv[2]; f.v1 = uv[3]; }
  }
}
// ตัวละครของเพื่อนจริง (ยืนในหมู่บ้านเพื่อน) ใช้หน้าตาที่เพื่อนแต่งไว้
function ownerLookKey(scene, look) {
  if (!look) return null;
  const L = Object.assign(defaultLook(), look), cv = buildLookCanvas(L); if (!cv) return null;
  addLookTexture(scene, 'ownerlook', cv, A.sheets[L.g === 'f' ? 'villager_f' : 'villager'] || A.sheets.villager);
  return 'ownerlook';
}

// ---------- หน้าต่างสร้างตัวละคร ----------
let LOOK_DRAFT = null, LOOK_PREV = null, LOOK_AFTER = null;
PANEL_IC.look = 'ui_friends';
PANELS.look = (arg, P) => {
  if (!LOOK_DRAFT) LOOK_DRAFT = Object.assign(defaultLook(), S.look || {}, { name: (S.look && S.look.name) || lookName().replace(/^คุณ$/, '') });
  const L = LOOK_DRAFT, first = !S.look;
  const sw = (part) => `<div class="lk-row"><div class="lk-lab">${{ hair: '💇 สีผม', skin: '✋ สีผิว', outfit: '🌿 ชุด', cape: '🧣 ผ้าคลุม' }[part]}</div><div class="lk-sw">${LOOK_OPTS[part].map((o) => `<button class="sw ${L[part] === o.id ? 'on' : ''}" data-a="pick" data-v="${part}:${o.id}" title="${o.n}" style="background:${o.c}"></button>`).join('')}</div></div>`;
  const html = `<div class="lk">
    <div class="lk-prev"><canvas id="lk-cv" width="192" height="192"></canvas>
      <div class="lk-turn"><button class="btn sm" data-a="turn" data-v="-1">⟲</button><button class="btn sm" data-a="turn" data-v="1">⟳</button></div></div>
    <div class="lk-opts">
      <div class="lk-row"><div class="lk-lab">🧑 เพศ</div><div class="lk-g"><button class="btn sm ${L.g === 'm' ? 'gold' : ''}" data-a="g" data-v="m">👦 ชาย</button><button class="btn sm ${L.g === 'f' ? 'gold' : ''}" data-a="g" data-v="f">👧 หญิง</button></div></div>
      ${sw('hair')}${sw('skin')}${sw('outfit')}${sw('cape')}
      <div class="lk-row"><div class="lk-lab">✏️ ชื่อ</div><input id="lk-name" maxlength="16" placeholder="ตั้งชื่อตัวละคร" value="${esc(L.name || '')}"></div>
      <div class="lk-act"><button class="btn sm" data-a="rand">🎲 สุ่ม</button><button class="btn gold" data-a="ok">${first ? '✔ เริ่มผจญภัย!' : '✔ บันทึก'}</button></div>
    </div></div>`;
  setTimeout(lookPreview, 0);
  const sync = () => { const el = $('lk-name'); if (el) L.name = el.value.replace(/[\u0000-\u001f<>"'&`]/g, '').trim().slice(0, 16); };
  return {
    title: first ? '🧑 สร้างตัวละครของคุณ' : '🧑 แต่งตัวละคร', html,
    onClose: () => { LOOK_DRAFT = null; if (LOOK_PREV) { cancelAnimationFrame(LOOK_PREV.raf); LOOK_PREV = null; } if (!S.look) { S.look = defaultLook(); mark(); save(); } const f = LOOK_AFTER; LOOK_AFTER = null; if (f) setTimeout(f, 50); },
    acts: {
      g: (v) => { sync(); L.g = v; sfx('ui'); renderPanel(); },
      pick: (v) => { sync(); const [p, id] = v.split(':'); L[p] = id; sfx('ui'); renderPanel(); },
      turn: (v) => { if (LOOK_PREV) LOOK_PREV.dir = (LOOK_PREV.dir + Number(v) + 4) % 4; },
      rand: () => { sync(); const r = (a) => a[Math.floor(Math.random() * a.length)].id; L.g = Math.random() < 0.5 ? 'm' : 'f'; for (const p of ['hair', 'skin', 'outfit', 'cape']) L[p] = r(LOOK_OPTS[p]); sfx('ui'); renderPanel(); },
      ok: () => { sync(); S.look = { g: L.g, hair: L.hair, skin: L.skin, outfit: L.outfit, cape: L.cape, name: L.name }; mark(); save(); applyLook(); syncLookName(); sfx('coin'); toast('✨ แต่งตัวเสร็จแล้ว ' + esc(lookName()) + '!', 'good'); closePanel(); },
    },
  };
};
// ตัวอย่างเดินวนในหน้าต่าง (หมุนดูได้ 4 ทิศ)
function lookPreview() {
  const cv = $('lk-cv'); if (!cv || !LOOK_DRAFT) return;
  const sheet = buildLookCanvas(LOOK_DRAFT); if (!sheet) return;
  const dir = LOOK_PREV ? LOOK_PREV.dir : 0;
  if (LOOK_PREV) cancelAnimationFrame(LOOK_PREV.raf);
  LOOK_PREV = { dir, sheet, t0: performance.now(), raf: 0 };
  const rows = [5, 6, 8, 7]; // ใต้ ซ้าย หลัง ขวา
  const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high';
  const draw = (t) => {
    if (!LOOK_PREV || !document.body.contains(cv)) return;
    const f = Math.floor((t - LOOK_PREV.t0) / 140) % 4, r = rows[LOOK_PREV.dir];
    x.clearRect(0, 0, 192, 192);
    x.fillStyle = 'rgba(40,30,20,.22)'; x.beginPath(); x.ellipse(96, 180, 34, 9, 0, 0, Math.PI * 2); x.fill();
    x.drawImage(LOOK_PREV.sheet, f * 96, r * 96, 96, 96, 0, 0, 192, 192);
    LOOK_PREV.raf = requestAnimationFrame(draw);
  };
  LOOK_PREV.raf = requestAnimationFrame(draw);
}
// ชื่อตัวละครที่ตั้งในหน้าแต่งตัว = ชื่อบัญชี (เพื่อนเห็นชื่อนี้ในรายชื่อเพื่อน/บันทึกหมู่บ้าน และแถบบนสุด)
async function syncLookName() {
  const n = S && S.look && S.look.name;
  if (!n || typeof AUTH === 'undefined' || !AUTH.online || !AUTH.user || AUTH.user.name === n) return;
  try { const r = await api('POST', '/api/me', { name: n }); AUTH.user = r.user; hud(); } catch (e) {}
}
function openLook() { LOOK_DRAFT = null; openPanel('look'); }
