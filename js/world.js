/* Boom Boom Village — ฉากในเกม (หมู่บ้านเรา และหมู่บ้านเพื่อน) วาดด้วย Phaser */
'use strict';
const A = window.GAME_ASSETS;
const T = CFG.TILE;
let SCENE = null;
const TXT = (size = 9, color = '#fff') => ({ fontSize: size + 'px', fontFamily: '"BBV Sans", "Segoe UI", "Leelawadee UI", Tahoma, sans-serif', fontStyle: '600', color, stroke: '#2a1d14', strokeThickness: 3 });

// ---------- ผังหมู่บ้านเพื่อน ----------
const FRIEND_W = 30, FRIEND_H = 22;
// สุ่มแบบคงที่ (ตำแหน่งเดิมได้ผลเดิมทุกครั้ง) ใช้วางหญ้า/ดอกไม้/ต้นไม้ตกแต่ง
function hsh(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const POOL = (pre) => Object.keys(A.images).filter((k) => k.startsWith(pre)).sort();
function friendLayout(b) {
  const objs = [
    { type: 'chief', x: 3, y: 4 }, { type: 'hut', x: 22, y: 4 }, { type: 'statue', x: 10, y: 11, id: 'statue' },
    { type: 'campfire', x: 13, y: 12 }, { type: 't_banana', x: 25, y: 13, id: 'tree' }, { type: 'pen', x: 15, y: 11 },
    { type: 'fence', x: 4, y: 15 }, { type: 'flowers', x: 2, y: 12 }, { type: 'torch', x: 8, y: 6 }, { type: 'torch', x: 14, y: 6 },
  ];
  if (b.stars >= 2) objs.push({ type: 'drum', x: 12, y: 6 }, { type: 'flag', x: 20, y: 7 });
  if (b.stars >= 3) objs.push({ type: 'totem', x: 27, y: 10 }, { type: 'flowers', x: 26, y: 16 }, { type: 'flowers', x: 1, y: 16 }, { type: 'arch', x: 17, y: 6 });
  if (b.id === 'mali') objs.push({ type: 'flowers', x: 6, y: 11 }, { type: 'flowers', x: 23, y: 16 }, { type: 'lantern', x: 9, y: 6 });
  if (b.id === 'to') objs.push({ type: 'oven', x: 26, y: 6 }, { type: 'log', x: 28, y: 16 });
  if (b.id === 'pupu') objs.push({ type: 'rock', x: 27, y: 16 }, { type: 'bush', x: 1, y: 14 });
  return objs;
}

class World extends Phaser.Scene {
  constructor() { super('World'); }
  init(data) { this.loc = (data && data.loc) || 'home'; }
  preload() {
    if (this.textures.exists('villager')) return;
    for (const [k, u] of Object.entries(A.images)) this.load.image(k, u);
    for (const [k, s] of Object.entries(A.sheets)) this.load.spritesheet(k, s.uri, { frameWidth: s.w, frameHeight: s.h });
    this.load.on('progress', (v) => { const el = document.getElementById('load-bar'); if (el) el.style.width = Math.round(v * 100) + '%'; });
  }
  create() {
    SCENE = this;
    this.home = this.loc === 'home';
    this.bot = this.home ? null : botById(this.loc);
    this.W = this.home ? CFG.MAP_W : FRIEND_W; this.H = this.home ? CFG.MAP_H : FRIEND_H;
    this.cameras.main.setBackgroundColor('#3f7a2c').fadeIn(300);
    this.makeAnims();
    this.buildGrid();
    this.tiles = [];
    for (let y = 0; y < this.H; y++) { this.tiles.push([]); for (let x = 0; x < this.W; x++) this.tiles[y].push(this.add.image(x * T, y * T, 'ts_dirt', 0).setOrigin(0).setDepth(0)); }
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) this.paintTile(x, y);
    this.bakeGround(0, 0, this.W - 1, this.H - 1);
    this.seed = this.home ? 1 : (this.loc.charCodeAt(0) || 3);
    this.deco = {}; this.forest = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) this.scatterAt(x, y);
    this.water = this.add.graphics().setDepth(0.5); this.waterT = 0;
    this.fx = this.add.graphics().setDepth(1);         // ดินชื้น/แตก
    this.landG = this.add.graphics().setDepth(8000);   // พื้นที่ยังไม่ได้ซื้อ
    this.hl = this.add.graphics().setDepth(8500);      // กรอบไฮไลต์
    this.osprites = {}; this.crops = {}; this.ents = []; this.prankSpr = []; this.bubbles = {};
    this.queue = []; this.path = null; this.placing = null; this.moving = null;

    if (this.home) {
      for (const o of S.objects) this.addObj(o);
      this.drawLand();
      this.refreshPlots(true);
      S.animals.forEach((a) => this.addAnimal(a));
      this.refreshPranks();
      this.spawnVillagers();
    } else this.setupFriend();
    this.buildForest();
    if (this.home) this.dressVillage();
    this.lookFX();
    this.ambience();

    // ผู้เล่น
    const sp = this.home ? { x: 12.5 * T, y: 9.2 * T } : { x: 1.5 * T, y: 9.2 * T };
    this.player = this.add.sprite(sp.x, sp.y, 'villager', 30).setOrigin(0.5, 46 / 48);
    this.shadow = this.add.ellipse(0, 0, 16, 6, 0x1a1816, 0.28).setDepth(2);
    this.dir = 'south'; this.player.play('idle-south');
    this.nameTag = this.add.text(0, 0, 'คุณ', TXT(7, '#ffe9a8')).setOrigin(0.5, 1).setResolution(4).setDepth(9500);

    const cam = this.cameras.main;
    this.zoom = window.innerWidth < 700 ? 1.6 : CFG.ZOOM;
    cam.setZoom(this.zoom).setBounds(0, 0, this.W * T, this.H * T).startFollow(this.player, true, 0.12, 0.12).setRoundPixels(true);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.input.keyboard.on('keydown-SPACE', () => !uiBlocking() && this.spaceAct());
    this.input.keyboard.on('keydown-E', () => !uiBlocking() && this.spaceAct());
    this.input.keyboard.on('keydown-ESC', () => { if (this.placing || this.moving) this.stopPlacing(); else closePanel(); });
    this.input.keyboard.on('keydown-R', () => { if (this.placing) { this.placing.flip = !this.placing.flip; this.ghost && this.ghost.setFlipX(this.placing.flip); } });
    for (const [i, k] of ['ONE', 'TWO', 'THREE', 'FOUR'].entries()) this.input.keyboard.on('keydown-' + k, () => this.home && setTool(['hand', 'hoe', 'seed', 'move'][i]));
    this.input.mouse && this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (p, over) => this.onDown(p, over));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', () => { this.dragging = false; this.dragSeen = null; });
    this.input.on('wheel', (p, o, dx, dy) => { this.zoom = Phaser.Math.Clamp(this.zoom - dy * 0.0015, 1.2, 3.2); cam.setZoom(this.zoom); });

    this.tickAcc = 0; this.refreshAcc = 0;
    this.events.once('shutdown', () => { BUS.fns.sceneLocal = []; });
    hudPlace(); hud(); musicSetMood();
    if (!this.home) this.friendArrive();
  }

  // ===== พื้น =====
  buildGrid() {
    const g = (this.grid = []);
    for (let y = 0; y < this.H; y++) g.push(new Array(this.W).fill('g'));
    const rect = (x, y, w, h, v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < this.W) g[j][i] = v; };
    rect(0, 0, this.W, 2, 'w');           // แม่น้ำด้านบน
    // ทางเดินดินเส้นเล็กคดเคี้ยว (ช่องเดียว แต่พื้นวาดออกมากว้างราว 2 ช่อง)
    const pathY = (x) => (this.home ? (x < 13 ? 8 : x < 25 ? 9 : 8) : (x < 10 ? 8 : x < 18 ? 9 : 8));
    for (let x = 0; x < this.W; x++) { const y = pathY(x); g[y][x] = 'p'; if (x > 0 && pathY(x - 1) !== y) g[pathY(x - 1)][x] = 'p'; }
    if (this.home) {
      rect(3, 6, 1, 2, 'p'); rect(10, 7, 1, 1, 'p'); rect(16, 7, 1, 2, 'p'); rect(19, 7, 1, 2, 'p');
      rect(11, 9, 1, 2, 'p'); rect(10, 11, 3, 2, 'p'); rect(11, 10, 1, 4, 'p'); rect(9, 12, 5, 1, 'p'); // ลานรอบกองไฟ (ทรงกลม)
      rect(30, 2, 5, 2, 'w'); rect(31, 4, 3, 1, 'w'); // บึง
      for (const o of S.objects) if (o.type === 'pen') rect(o.x, o.y, 5, 4, 'd');
      for (const key of Object.keys(S.plots)) { const [x, y] = key.split(',').map(Number); g[y][x] = 's'; }
    } else {
      rect(4, 6, 1, 2, 'p'); rect(9, 10, 8, 4, 'p'); rect(15, 11, 5, 4, 'd'); rect(4, 12, 6, 2, 's'); rect(23, 6, 1, 2, 'p');
    }
  }
  cell(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? null : this.grid[y][x]; }
  corner(i, j) {
    const c = {}; let best = 'g', bn = 0;
    for (const [x, y] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) { const t = this.cell(x, y); if (t && t !== 'g' && t !== 'p') c[t] = (c[t] || 0) + 1; }
    if (!c.w && !c.s && !c.d && this.cell(i, j) === 'p') return 'd'; // ทางเดิน: ใช้จุดมุมเดียว ทางจึงแคบเหลือ ~1 ช่อง
    for (const t of ['w', 'd', 's']) if ((c[t] || 0) > bn) { best = t; bn = c[t]; }
    return best;
  }
  paintTile(x, y) {
    const cs = [this.corner(x, y), this.corner(x + 1, y), this.corner(x, y + 1), this.corner(x + 1, y + 1)];
    const cnt = {}; cs.forEach((t) => t !== 'g' && (cnt[t] = (cnt[t] || 0) + 1));
    let type = null, n = 0; for (const [t, k] of Object.entries(cnt)) if (k > n) { type = t; n = k; }
    const name = { w: 'water', d: 'dirt', s: 'soil' }[type] || 'dirt';
    const key = cs.map((t) => (type && t === type ? '1' : '0')).join('');
    this.tiles[y][x].setTexture('ts_' + name, A.wang[name][key]);
  }
  setCell(x, y, v) { if (!this.cell(x, y)) return; this.grid[y][x] = v; for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) if (this.cell(i, j)) this.paintTile(i, j); this.scatterAt(x, y); if (this.groundTex) this.bakeGround(x - 2, y - 2, x + 2, y + 2); }
  // ===== พื้นแบบอบภาพ: รวมกระเบื้องเป็นภาพเดียว แล้วเติมใบหญ้า ขอบทาง เงา ก้อนกรวด ทีละพิกเซล =====
  bakeGround(x0, y0, x1, y1) {
    const W = this.W * T, H = this.H * T;
    if (!this.groundTex) {
      this.groundTex = this.textures.exists('ground_' + this.loc) ? this.textures.get('ground_' + this.loc) : this.textures.createCanvas('ground_' + this.loc, W, H);
      this.groundImg = this.add.image(0, 0, this.groundTex.key).setOrigin(0).setDepth(0.4);
      for (const row of this.tiles) for (const t of row) t.setVisible(false);
    }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(this.W - 1, x1); y1 = Math.min(this.H - 1, y1);
    const ctx = this.groundTex.getContext(), px0 = x0 * T, py0 = y0 * T, pw = (x1 - x0 + 1) * T, ph = (y1 - y0 + 1) * T;
    ctx.imageSmoothingEnabled = false;
    // ขยายขอบเขตอ่าน 3px เพื่อดูเพื่อนบ้าน
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const f = this.tiles[y][x].frame; ctx.drawImage(f.source.image, f.cutX, f.cutY, T, T, x * T, y * T, T, T); }
    const id = ctx.getImageData(px0, py0, pw, ph), d = id.data, n = pw * ph;
    const cls = new Uint8Array(n); // 0 หญ้า 1 ดิน 2 น้ำ
    for (let i = 0; i < n; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; cls[i] = b > r + 10 && b > g - 30 ? 2 : g > r + 12 ? 0 : 1; }
    const C = (x, y) => (x < 0 || y < 0 || x >= pw || y >= ph ? -1 : cls[y * pw + x]);
    const H2 = (x, y, s) => hsh(x + px0, y + py0, s);
    const noise = (x, y) => { // value noise ช่วง ~40px
      const gx = (x + px0) / 40, gy = (y + py0) / 40, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const a = hsh(ix, iy, 71), b = hsh(ix + 1, iy, 71), c = hsh(ix, iy + 1, 71), e = hsh(ix + 1, iy + 1, 71);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + e * sx) * sy;
    };
    const set = (i, r, g, b) => { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; };
    const mul = (i, k) => { d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; };
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const i = y * pw + x, c = cls[i];
      if (c === 0) {
        // หญ้าเข้มขึ้น อิ่มสีขึ้น + โทนอ่อนแก่เป็นหย่อม ๆ (dither)
        d[i * 4] *= 0.84; d[i * 4 + 1] *= 0.93; d[i * 4 + 2] *= 0.72;
        const t = noise(x, y), chk = ((x + y + px0 + py0) & 1) === 0;
        if (t > 0.66) mul(i, chk ? 0.86 : 0.93); else if (t > 0.58 && chk) mul(i, 0.92);
        else if (t < 0.28 && chk) { d[i * 4] += 14; d[i * 4 + 1] += 14; d[i * 4 + 2] += 4; }
      } else if (c === 1) {
        d[i * 4 + 2] *= 0.86; d[i * 4] *= 1.0; d[i * 4 + 1] *= 0.96;
        // ขอบทางเป็นร่องเงา: ใกล้หญ้า 1px เข้ม, 2-3px เข้มนิด
        let near = 9; for (let k = 1; k <= 3 && near === 9; k++) if (C(x, y - k) === 0 || C(x - k, y) === 0 || C(x + k, y) === 0 || C(x, y + k) === 0) near = k;
        if (near === 1) { if (C(x, y - 1) === 0 && H2(x, y, 5) < 0.45) set(i, 64, 124, 40); else mul(i, 0.74); }
        else if (near === 2) mul(i, 0.86); else if (near === 3) mul(i, 0.94);
        else { const h = H2(x, y, 6); if (h < 0.025) mul(i, 0.85); else if (h < 0.032) { d[i * 4] += 16; d[i * 4 + 1] += 14; d[i * 4 + 2] += 10; } }
      }
    }
    // ใบหญ้า + ก้อนกรวด
    const blade = (x, y, len) => {
      const cols = [[48, 104, 30], [70, 138, 44], [140, 196, 92]];
      for (let k = 0; k < len; k++) { const yy = y - k; if (yy < 0 || C(x, yy) !== 0) break; const c = k === 0 ? cols[0] : k === len - 1 ? cols[2] : cols[1]; set(yy * pw + x, ...c); }
    };
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const c = cls[y * pw + x];
      if (c === 0) {
        const h = H2(x, y, 7), edge = C(x, y + 1) === 1 || C(x, y + 2) === 1;
        if (h < (edge ? 0.22 : 0.012)) blade(x, y, edge ? 3 : 2 + (H2(x, y, 8) < 0.5 ? 1 : 0));
      } else if (c === 1 && H2(x, y, 9) < 0.0022 && C(x + 1, y) === 1 && C(x, y + 1) === 1 && C(x + 2, y) === 1 && C(x, y - 2) === 1 && C(x, y + 3) === 1) {
        const i = y * pw + x; set(i, 214, 200, 176); set(i + 1, 190, 174, 150); set(i + pw, 150, 128, 104); set(i + pw + 1, 120, 98, 76);
      }
    }
    ctx.putImageData(id, px0, py0); this.groundTex.refresh();
  }
  nearPath(x, y) { for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) if (this.cell(x + i, y + j) === 'p') return true; return false; }
  // ===== ของตกแต่งธรรมชาติ (ไม่มีผลกับการเล่น) =====
  scatterAt(x, y) {
    const k = x + ',' + y; if (this.deco[k]) { this.deco[k].destroy(); delete this.deco[k]; }
    const c = this.cell(x, y), r = hsh(x, y, this.seed), r2 = hsh(x, y, this.seed + 1);
    const pick = (pre, v) => { const p = POOL(pre); return p.length ? p[Math.floor(v * p.length) % p.length] : null; };
    let key = null, ox = 0.2 + hsh(x, y, 3) * 0.6, oy = 0.6 + hsh(x, y, 4) * 0.35;
    if (c === 'g') {
      if (r > 0.16 || this.nearPath(x, y)) return;
      if (this.home && (objAtCell(x, y) || objAtCell(x, y + 1) || objAtCell(x, y + 2))) return;
      key = r2 < 0.42 ? pick('sc_tuft', r2 / 0.42) : r2 < 0.8 ? pick('sc_flower', (r2 - 0.42) / 0.38) : r2 < 0.88 ? pick('sc_stone', (r2 - 0.8) / 0.08) : r2 < 0.93 ? pick('sc_mush', (r2 - 0.88) / 0.05) : pick('sc_leafy', (r2 - 0.93) / 0.07);
    } else if (c === 'w') {
      if (this.cell(x, y + 1) === 'g' && r < 0.3) { key = pick('sc_reed', r2); oy = 1.05; }
      else if (this.cell(x, y + 1) === 'w' && this.cell(x, y - 1) !== 'g' && r < 0.09) { key = pick('sc_lily', r2); oy = 0.8; }
    }
    if (!key) return;
    const img = this.deco[k] = this.add.image((x + ox) * T, (y + oy) * T, key).setOrigin(0.5, 1).setDepth(1.5).setFlipX(hsh(x, y, 5) < 0.5);
    if (/tuft|flower|reed|leafy/.test(key)) this.sway(img, 3 + hsh(x, y, 6) * 3, 1300 + hsh(x, y, 7) * 1200);
    else if (/lily/.test(key)) this.tweens.add({ targets: img, y: img.y + 1.5, duration: 1600 + hsh(x, y, 7) * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: hsh(x, y, 8) * 1500 });
  }
  forestZone(x, y) {
    if (this.home) {
      if (this.owned(x, y)) return false;
      if (x < S.owned.w && y < S.owned.h + 1) return false;
      if (this.signCells && this.signCells.some(([sx, sy]) => Math.abs(sx - x) <= 2 && Math.abs(sy - y) <= 1)) return false;
      return !objAtCell(x, y) && !objAtCell(x, y - 1);
    }
    return y >= FRIEND_H - 3;
  }
  buildForest() {
    this.forest.forEach((s) => s.destroy()); this.forest = [];
    for (let y = 2; y < this.H + 1; y++) for (let x = 0; x < this.W; x++) {
      if (this.cell(x, Math.min(y, this.H - 1)) !== 'g' || this.nearPath(x, Math.min(y, this.H - 1)) || !this.forestZone(x, Math.min(y, this.H - 1))) continue;
      const r = hsh(x, y, this.seed + 9); if (r > 0.42) continue;
      const v = hsh(x, y, this.seed + 10);
      const pre = r < 0.27 ? 'nat_tree' : r < 0.35 ? 'nat_bush' : r < 0.38 ? 'nat_rock' : r < 0.40 ? 'nat_stump' : 'sc_fd';
      const p = POOL(pre); if (!p.length) continue;
      let pk = p[Math.floor(v * p.length) % p.length];
      if (pre === 'nat_tree') { const W = [30, 20, 14, 7, 19, 10]; let acc = 0, t = v * 100; pk = p[0]; for (let i = 0; i < W.length && i < p.length; i++) { acc += W[i]; if (t < acc) { pk = p[i]; break; } } }
      const px = (x + 0.5 + (hsh(x, y, 11) - 0.5) * 0.6) * T, py = (y + 0.9) * T;
      const img = this.add.image(px, py, pk).setOrigin(0.5, 1).setDepth(py).setFlipX(hsh(x, y, 12) < 0.5);
      const sh = this.add.ellipse(px, py - 2, img.width * 0.75, 9, 0x10200a, 0.25).setDepth(2);
      if (/tree|bush|palm|fd/.test(pk)) this.sway(img, /tree|palm/.test(pk) ? 1.2 + hsh(x, y, 13) : 2, 2200 + hsh(x, y, 14) * 1600);
      this.forest.push(img, sh);
    }
  }
  // ของแต่งหมู่บ้าน (ถัง ลัง ฟาง ตะเกียง ฯลฯ) ไม่มีผลกับการเล่น ซ่อนเองถ้ามีของจริงมาวางทับ
  dressVillage() {
    const L = [
      ['firewood', 0, 5], ['jar', 1, 6], ['signpost', 1, 7], ['drum', 5, 6], ['hiderack', 6, 4], ['lamppost', 7, 6],
      ['crates', 8, 5], ['fruitbasket', 8, 6], ['pumpkinbasket', 12, 6], ['sacks', 13, 6], ['bed_yellow', 8, 3], ['bed_red', 12, 3],
      ['barrel', 14, 5], ['barrels', 14, 6], ['haybale', 18, 6], ['wheelbarrow', 17, 7], ['lamppost', 14, 7], ['bench', 21, 7], ['lamppost', 22, 7],
      ['boat', 7, 2], ['fishrack', 10, 2], ['fishrod', 13, 2], ['bucket', 14, 2], ['laundry', 23, 2], ['bed_purple', 17, 3],
      ['logseat', 13, 11], ['logseat', 9, 11, 1], ['spears', 14, 11], ['drum', 10, 13], ['soup', 12, 13],
      ['scarecrow', 6, 10], ['wateringcan', 2, 12], ['pumpkins', 6, 12], ['well', 7, 14], ['corn', 0, 13],
      ['haybale', 14, 13], ['haypile', 15, 14], ['beehive', 23, 11], ['coop', 22, 14], ['birdhouse', 0, 10],
      ['flowerbush', 12, 15], ['topiary', 10, 15], ['bed_purple', 17, 15], ['stonelantern', 5, 9], ['mossrock', 23, 6], ['shells', 4, 2],
    ];
    this.props = [];
    for (const [k, x, y, fl] of L) {
      if (!A.images['vp_' + k] || !this.owned(x, y)) continue;
      const px = (x + 0.5) * T + (hsh(x, y, 31) - 0.5) * 8, py = (y + 0.92) * T;
      const img = this.add.image(px, py, 'vp_' + k).setOrigin(0.5, 1).setDepth(py).setFlipX(!!fl);
      const sh = this.add.ellipse(px, py - 2, img.width * 0.8, 6, 0x10200a, 0.22).setDepth(2);
      this.props.push({ x, y, img, sh });
    }
    this.propCheck();
  }
  propCheck() {
    if (!this.props) return;
    for (const p of this.props) { const free = !objAtCell(p.x, p.y) && !S.plots[p.x + ',' + p.y] && !(this.ents || []).some((e) => e.blocking && e.x === p.x && e.y === p.y); p.img.setVisible(free); p.sh.setVisible(free); }
  }
  // ขอบเรืองแสงรอบของที่เมาส์ชี้ (แบบเกมมือถือ)
  setGlow(spr) {
    if (this.glowSpr === spr) return;
    if (this.glowSpr && this.glowSpr.active && this.glowFx) { this.glowSpr.preFX.remove(this.glowFx); this.glowTw && this.glowTw.remove(); }
    this.glowSpr = spr; this.glowFx = null; this.glowTw = null;
    if (!spr) return;
    spr.preFX.setPadding(6); this.glowFx = spr.preFX.addGlow(0xfff4b0, 2, 0, false, 0.1, 6);
    this.glowTw = this.tweens.add({ targets: this.glowFx, outerStrength: 4, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
  brackets(x, y, w, h) {
    const g = this.hl, k = 6; g.lineStyle(2, 0xffffff, 0.75);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.beginPath(); g.moveTo(cx, cy + sy * k); g.lineTo(cx, cy); g.lineTo(cx + sx * k, cy); g.strokePath(); }
  }
  // โยกตามลม (หมุนรอบโคน)
  sway(img, deg, dur) {
    img.setAngle(-deg * 0.5);
    this.tweens.add({ targets: img, angle: deg * 0.5, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: Math.random() * dur });
  }
  // พื้นผิวนุ่ม, น้ำไหล, เงาเมฆ, ละอองแสง, ผีเสื้อ
  makeTex() {
    const tx = this.textures;
    const canvasTex = (key, w, h, draw) => { if (tx.exists(key)) return; const c = tx.createCanvas(key, w, h); draw(c.getContext(), w, h); c.refresh(); };
    canvasTex('soft', 128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    canvasTex('mote', 8, 8, (g) => { const gr = g.createRadialGradient(4, 4, 0, 4, 4, 4); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 8); });
    canvasTex('ripple', 64, 64, (g) => {
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
      for (let i = 0; i < 7; i++) { const y = 4 + i * 9 + (i % 2) * 3, x0 = (i * 23) % 64, len = 8 + (i * 7) % 12; g.beginPath(); for (let k = 0; k <= len; k++) g.lineTo((x0 + k) % 64, y + Math.round(Math.sin(k / 2.5) * 1)); g.stroke(); }
    });
    canvasTex('glint', 4, 1, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 4, 1); });
    canvasTex('bfly', 14, 7, (g) => {
      const wing = (ox, col) => { g.fillStyle = col; g.fillRect(ox + 0, 1, 3, 3); g.fillRect(ox + 3, 0, 3, 3); g.fillRect(ox + 1, 4, 2, 2); g.fillStyle = '#3a2214'; g.fillRect(ox + 6, 1, 1, 5); };
      wing(0, '#ffd23f'); g.fillStyle = '#ffd23f'; g.fillRect(8, 1, 3, 3); g.fillRect(7, 0, 3, 3); g.fillRect(10, 4, 2, 2);
    });
    canvasTex('smoke', 16, 16, (g) => { const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, 'rgba(235,230,220,.9)'); gr.addColorStop(1, 'rgba(235,230,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 16, 16); });
  }
  ambience() {
    this.makeTex();
    const W = this.W * T, H = this.H * T;
    // 1) แสงเงาบนพื้นให้ดูนุ่ม ไม่เป็นตาราง
    //    (ย้ายไปอบลงพื้นแบบพิกเซลใน bakeGround แล้ว)
    // 2) น้ำ: ลายคลื่นเลื่อนช้า ๆ บนช่องน้ำที่ล้อมด้วยน้ำ
    this.waves = [];
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.cell(x, y) !== 'w') continue;
      let inner = true; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = this.cell(x + i, y + j); if (c && c !== 'w') inner = false; }
      if (!inner) continue;
      this.waves.push(this.add.tileSprite(x * T, y * T, T, T, 'ripple').setOrigin(0).setDepth(0.55).setAlpha(0.35).setTilePosition(x * T, y * T));
    }
    this.waveT = 0;
    // 3) เงาเมฆ
    this.clouds = [];
    const nc = Math.max(1, Math.round((W * H) / 520000));
    for (let i = 0; i < nc; i++) {
      const c = this.add.image(((i + Math.random() * 0.6) / nc) * W, Math.random() * H, 'soft').setDepth(9050).setTint(0x0a1a2a).setAlpha(0.09).setScale(4 + Math.random() * 2, 2.6 + Math.random() * 1.2);
      c.vx = 7 + Math.random() * 5; this.clouds.push(c);
    }
    // 4) ละอองแสงลอยในอากาศ
    this.moteZone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
    this.motes = this.add.particles(0, 0, 'mote', {
      emitZone: { type: 'random', source: this.moteZone }, lifespan: { min: 4000, max: 7000 }, frequency: 220, quantity: 1,
      speedX: { min: -6, max: 6 }, speedY: { min: -14, max: -4 }, scale: { min: 0.25, max: 0.6 },
      alpha: { values: [0, 0.85, 0.85, 0] }, tint: [0xfff3b0, 0xffffff, 0xd8ffb0], blendMode: 'ADD',
    }).setDepth(9060);
    // 5) ผีเสื้อ
    if (this.home || true) {
      this.bflies = [];
      const ow = (this.home ? S.owned.w : this.W) * T, oh = (this.home ? S.owned.h : this.H) * T;
      const cols = [0xffffff, 0xffb3e0, 0x9fd8ff, 0xffffff, 0xc8f59a];
      for (let i = 0; i < 5; i++) {
        const b = this.add.image(Math.random() * ow, 3 * T + Math.random() * (oh - 4 * T), 'bfly').setDepth(9040).setScale(0.9).setTint(cols[i]);
        this.tweens.add({ targets: b, scaleX: 0.25, duration: 110 + Math.random() * 40, yoyo: true, repeat: -1 });
        b.home = { w: ow, h: oh }; this.bflies.push(b); this.bflyMove(b);
      }
    }
  }
  bflyMove(b) {
    const tx = Phaser.Math.Clamp(b.x + rnd(-90, 90), 8, b.home.w - 8), ty = Phaser.Math.Clamp(b.y + rnd(-60, 60), 2.5 * T, b.home.h - 8);
    this.tweens.add({ targets: b, x: tx, y: ty, duration: rnd(1800, 3600), ease: 'Sine.inOut', onComplete: () => b.active && this.bflyMove(b) });
    this.tweens.add({ targets: b, angle: { from: -10, to: 10 }, duration: 500, yoyo: true, repeat: 2, ease: 'Sine.inOut' });
  }
  fireFX(x, y, big) {
    this.makeTex();
    const smoke = this.add.particles(x, y - 6, 'smoke', { lifespan: big ? 2600 : 1800, frequency: big ? 160 : 260, speedY: { min: -22, max: -12 }, speedX: { min: -4, max: 6 },
      scale: { start: 0.4, end: big ? 1.8 : 1.2 }, alpha: { start: 0.45, end: 0 } }).setDepth(9020);
    const sparks = this.add.particles(x, y - 4, 'mote', { lifespan: 900, frequency: big ? 120 : 220, speedY: { min: -40, max: -18 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.45, end: 0 }, tint: [0xffd060, 0xff8a30, 0xfff0a0], blendMode: 'ADD' }).setDepth(9021);
    return [smoke, sparks];
  }
  lookFX() {
    const cam = this.cameras.main;
    if (!cam.postFX || this.game.renderer.type !== Phaser.WEBGL) return;
    cam.postFX.clear();
    const cm = cam.postFX.addColorMatrix(); cm.saturate(0.18); cm.brightness(1.03, true);
    cam.postFX.addVignette(0.5, 0.5, 0.95, 0.22);
  }
  owned(x, y) { return !this.home || (x >= 0 && y >= 0 && x < S.owned.w && y < S.owned.h); }
  drawLand() {
    const g = this.landG.clear(); const W = this.W * T, H = this.H * T, ow = S.owned.w * T, oh = S.owned.h * T;
    g.fillStyle(0x0e1a10, 0.3); g.fillRect(ow, 0, W - ow, H); g.fillRect(0, oh, ow, H - oh);
    g.lineStyle(2, 0xffe08a, 0.55); g.strokeRect(1, 1, ow - 2, oh - 2);
    if (this.signs) this.signs.forEach((s) => s.destroy());
    this.signs = []; this.signCells = [];
    const e = nextExpansion();
    if (e) {
      const sx = e.dir === 'east' ? ow + 2 * T : ow / 2, sy = e.dir === 'east' ? oh / 2 + 2 * T : oh + 2 * T;
      const t = this.add.text(sx, sy, '🚩 ขยายที่ดิน\n(คลิก)', TXT(9, '#ffe08a')).setOrigin(0.5).setResolution(4).setDepth(8100).setAlign('center');
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.uiClick = true; openPanel('expand'); });
      this.signs.push(t); this.signCells.push([Math.floor(sx / T), Math.floor(sy / T)]);
      if (this.forest) this.buildForest();
    }
  }

  // ===== วัตถุ =====
  objSize(type) { const b = BUILDS[type]; return { w: b.w, h: b.h }; }
  addObj(o) {
    const b = BUILDS[o.type]; if (!b) return;
    const rec = { o, spr: null, extra: [] };
    const cx = (o.x + b.w / 2) * T, by = (o.y + b.h) * T;
    if (o.type === 'pen') {
      const g = this.add.graphics().setDepth(by - 2);
      this.drawPen(g, o); rec.spr = g;
      const back = this.add.graphics().setDepth(o.y * T + 4); this.drawPenBack(back, o); rec.extra.push(back);
    } else {
      const img = this.add.image(cx, by + (b.debris ? -2 : 0), b.img).setOrigin(0.5, 1).setDepth(by).setFlipX(!!o.flip);
      if (img.width > (b.w + 1.2) * T) img.setScale(((b.w + 1.2) * T) / img.width);
      rec.spr = img;
      if (this.home && !this.owned(o.x, o.y)) img.setAlpha(0.75);
      const shw = Math.min(img.displayWidth * 0.8, (b.w + 0.4) * T);
      rec.extra.push(this.add.ellipse(cx, by - 3, shw, Math.max(7, Math.min(16, shw * 0.28)), 0x10200a, 0.24).setDepth(2));
      if (o.type === 'campfire' || o.type === 'bonfire' || o.type === 'torch') {
        const glow = this.add.circle(cx, by - 14, 20, 0xffc060, 0.1).setDepth(by + 1).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.08, duration: 600 + Math.random() * 300, yoyo: true, repeat: -1 });
        rec.extra.push(glow, ...this.fireFX(cx, by - (o.type === 'torch' ? 44 : 10), o.type === 'bonfire'));
      }
      if (o.type === 'bonfire') { const t = this.add.text(cx, by - 30, 'กองไฟกลางเผ่า', TXT(7, '#ffd27a')).setOrigin(0.5, 1).setResolution(4).setDepth(9000).setAlpha(0.85); rec.extra.push(t); }
    }
    if (b.factory || b.fruit || o.type === 'pen' || o.type === 'ordertree' || o.type === 'market' || o.type === 'storage' || o.type === 'chief') {
      rec.bub = this.makeBubble(cx, o.y * T - (o.type === 'pen' ? -4 : b.img && A.images[b.img] ? 0 : 0));
      rec.extra.push(rec.bub.c);
    }
    this.osprites[o.id || o.type + o.x + ',' + o.y] = rec;
    return rec;
  }
  removeObj(o) { const r = this.osprites[o.id]; if (!r) return; r.spr.destroy(); r.extra.forEach((e) => e.destroy()); delete this.osprites[o.id]; }
  drawPenBack(g, o) {
    g.clear(); const x = o.x * T, y = o.y * T, w = 5 * T;
    g.fillStyle(0x6b4a2b, 1);
    for (let i = 0; i <= 5; i++) g.fillRect(x + i * T - (i === 5 ? 4 : 0), y + 2, 4, 14);
    g.fillStyle(0x8a6239, 1); g.fillRect(x, y + 5, w, 3); g.fillRect(x, y + 11, w, 3);
  }
  drawPen(g, o) {
    g.clear(); const x = o.x * T, y = o.y * T, w = 5 * T, h = 4 * T;
    g.fillStyle(0x6b4a2b, 1);
    for (let i = 0; i <= 5; i++) if (i !== 2) g.fillRect(x + i * T - (i === 5 ? 4 : 0), y + h - 14, 4, 14);
    for (let j = 0; j <= 4; j++) { g.fillRect(x, y + j * T - (j === 4 ? 14 : 0), 4, 14); g.fillRect(x + w - 4, y + j * T - (j === 4 ? 14 : 0), 4, 14); }
    g.fillStyle(0x8a6239, 1);
    g.fillRect(x, y + h - 11, 2 * T, 3); g.fillRect(x + 3 * T, y + h - 11, 2 * T, 3);
    g.fillRect(x, y + h - 5, 2 * T, 3); g.fillRect(x + 3 * T, y + h - 5, 2 * T, 3);
    g.fillRect(x, y + 4, 3, h - 6); g.fillRect(x + w - 3, y + 4, 3, h - 6);
  }
  makeBubble(x, y) {
    const c = this.add.container(x, y).setDepth(9100).setVisible(false);
    const bg = this.add.graphics(); const icon = this.add.image(0, -11, 'ic_star').setDisplaySize(14, 14);
    const txt = this.add.text(0, -11, '', TXT(8)).setOrigin(0.5).setResolution(4);
    c.add([bg, icon, txt]); c.bg = bg; c.icon = icon; c.txt = txt; c.key = '';
    this.tweens.add({ targets: c, y: y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return { c, set: (key, iconKey, text, color = 0xfff4dc) => {
      if (c.key === key) return; c.key = key;
      if (!key) { c.setVisible(false); return; }
      c.setVisible(true); bg.clear();
      const w = iconKey && text ? 34 : 20;
      bg.fillStyle(0x2a1d14, 0.35).fillRoundedRect(-w / 2 + 1, -20, w, 18, 6);
      bg.fillStyle(color, 1).fillRoundedRect(-w / 2, -21, w, 18, 6).fillTriangle(-3, -4, 3, -4, 0, 1);
      bg.lineStyle(1, 0x4f3d36, 1).strokeRoundedRect(-w / 2, -21, w, 18, 6);
      icon.setVisible(!!iconKey); if (iconKey) icon.setTexture(iconKey).setDisplaySize(14, 14).setX(text ? -8 : 0);
      txt.setText(text || '').setX(iconKey ? 7 : 0).setColor('#4f3d36').setStroke('#fff', 0);
    } };
  }
  objAtCell(x, y) {
    if (!this.home) return this.fobjs.find((o) => { const b = BUILDS[o.type]; return x >= o.x && x < o.x + b.w && y >= o.y && y < o.y + b.h; });
    return objAtCell(x, y);
  }
  isBlockedCell(x, y) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return true;
    if (!this.owned(x, y)) return true;
    if (this.grid[y][x] === 'w') return true;
    const o = this.objAtCell(x, y); if (!o) return false;
    if (o.type === 'pen') return true;
    return !(o.type === 'flowers' || o.type === 'arch' || o.type === 'krathong');
  }

  // ===== พืช =====
  refreshPlots(force) {
    const t = now();
    this.fx.clear();
    for (const [key, p] of Object.entries(S.plots)) {
      const [x, y] = key.split(',').map(Number);
      if (this.grid[y][x] !== 's') this.setCell(x, y, 's');
      const st = plotState(p, t); const fl = plotFlags(p, t); const stage = plotStage(p, t);
      if (st === 'grow' && !fl.dry) { this.fx.fillStyle(0x2b1a0c, 0.28); this.fx.fillRect(x * T + 3, y * T + 3, T - 6, T - 6); }
      if (fl.dry) { this.fx.lineStyle(1, 0xd9b77c, 0.9); this.fx.lineBetween(x * T + 8, y * T + 10, x * T + 16, y * T + 18); this.fx.lineBetween(x * T + 16, y * T + 18, x * T + 24, y * T + 12); this.fx.lineBetween(x * T + 16, y * T + 18, x * T + 14, y * T + 26); }
      const sig = [p.crop, stage, fl.dry, fl.pest, st].join('|');
      let c = this.crops[key];
      if (!p.crop) { if (c) { c.spr.destroy(); c.pest.destroy(); c.bub.c.destroy(); delete this.crops[key]; } continue; }
      if (!c) {
        const spr = this.add.image((x + 0.5) * T, (y + 1) * T - 3, 'crop_pumpkin_0_soil').setOrigin(0.5, 1).setDepth((y + 1) * T - 3);
        const pest = this.add.image((x + 0.7) * T, (y + 0.75) * T, 'pest_caterpillar').setScale(0.55).setDepth((y + 1) * T).setVisible(false);
        this.tweens.add({ targets: pest, x: pest.x - 6, duration: 900, yoyo: true, repeat: -1 });
        c = this.crops[key] = { spr, pest, bub: this.makeBubble((x + 0.5) * T, y * T + 4), sig: '' };
      }
      if (c.sig === sig && !force) continue;
      const wasRipe = c.sig.endsWith('ripe'); c.sig = sig;
      const ripeImg = CROPS[p.crop].img;
      c.spr.clearTint().setScale(1).setAngle(0);
      if (stage === 0) c.spr.setTexture('crop_pumpkin_0_soil');
      else if (stage === 1) c.spr.setTexture('crop_pumpkin_1_sprout');
      else if (stage === 2) { if (p.crop === 'pumpkin') c.spr.setTexture('crop_pumpkin_2_growing'); else c.spr.setTexture(ripeImg).setScale(0.62).setTint(0xb8d890); }
      else { c.spr.setTexture(ripeImg); c.spr.setScale(p.crop === 'pumpkin' ? 1 : 0.95); if (!wasRipe && !force) { this.sparkle(c.spr.x, c.spr.y - 10); this.tweens.add({ targets: c.spr, scaleY: c.spr.scaleY * 1.15, duration: 120, yoyo: true }); } }
      c.pest.setVisible(fl.pest);
      if (st === 'dry0') c.bub.set('w', null, '💧', 0xd8f0ff);
      else if (fl.dry) c.bub.set('d', null, '💧', 0xffe0b0);
      else if (fl.pest) c.bub.set('p', null, '🐛', 0xffe0b0);
      else if (st === 'ripe') c.bub.set('r', ITEMS[p.crop].icon, null, 0xfff4dc);
      else c.bub.set('', null, null);
    }
  }
  sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const s = this.add.text(x, y, '✦', TXT(8, pick(['#fff3a0', '#ffffff', '#ffd27a']))).setOrigin(0.5).setResolution(4).setDepth(9600);
      const a = Math.random() * Math.PI * 2, d = rnd(10, 22);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 6, alpha: 0, duration: rnd(450, 750), onComplete: () => s.destroy() });
    }
  }
  dust(x, y) {
    for (let i = 0; i < 6; i++) {
      const s = this.add.circle(x + rnd(-8, 8), y + rnd(-3, 3), rnd(2, 4), 0xc9a873, 0.8).setDepth(9000);
      this.tweens.add({ targets: s, y: s.y - rnd(4, 12), x: s.x + rnd(-8, 8), alpha: 0, scale: 1.8, duration: rnd(350, 600), onComplete: () => s.destroy() });
    }
  }
  floatText(x, y, s, color) {
    const el = this.add.text(x, y, s, TXT(9, color || '#fff8c8')).setOrigin(0.5, 1).setResolution(4).setDepth(9700);
    this.tweens.add({ targets: el, y: y - 26, alpha: 0, duration: 1300, ease: 'Cubic.out', onComplete: () => el.destroy() });
  }
  flyIcon(x, y, iconKey) { // ไอคอนลอยขึ้นไปที่แถบด้านบน
    if (!A.images[iconKey]) return;
    const cam = this.cameras.main; const sx = (x - cam.worldView.x) * cam.zoom, sy = (y - cam.worldView.y) * cam.zoom;
    flyToHud(sx, sy, iconKey);
  }

  // ===== สัตว์ =====
  penRect(pen) { return { x1: pen.x * T + 10, y1: pen.y * T + 26, x2: (pen.x + 5) * T - 10, y2: (pen.y + 4) * T - 16 }; }
  addAnimal(a) {
    const pen = penOf(a.pen); if (!pen) return;
    const r = this.penRect(pen); const d = ANIMALS[a.kind];
    const spr = this.add.image(rnd(r.x1, r.x2), rnd(r.y1, r.y2), d.img).setOrigin(0.5, 0.95).setInteractive({ useHandCursor: true });
    const e = { kind: 'animal', a, spr, pen, tx: spr.x, ty: spr.y, wait: rnd(0.5, 2), bub: this.makeBubble(spr.x, spr.y - 26) };
    spr.on('pointerdown', () => { this.uiClick = true; this.enqueue(Math.floor(spr.x / T), Math.floor(spr.y / T), () => this.useAnimal(e)); });
    this.ents.push(e); return e;
  }
  useAnimal(e) {
    const a = e.a; const d = ANIMALS[a.kind]; const st = animalState(a);
    if (st === 'ready') { const r = collectAnimal(a); if (r === 'full') return storageFullMsg(); this.floatText(e.spr.x, e.spr.y - 24, '+1 ' + ITEMS[d.give].n); this.flyIcon(e.spr.x, e.spr.y - 20, ITEMS[d.give].icon); this.sparkle(e.spr.x, e.spr.y - 12); }
    else if (st === 'hungry') { const r = feedAnimal(a); if (r === 'food') { toast(`${d.n}อยากกิน ${Object.entries(d.eat).map(([k, v]) => iconHTML(k) + nameOf(k) + ' ' + v).join(' ')} — ยังไม่มีในยุ้งฉาง`, 'bad'); sfx('error'); return; } this.floatText(e.spr.x, e.spr.y - 24, '😋 ง่ำ ๆ'); this.tweens.add({ targets: e.spr, scaleY: 0.85, duration: 90, yoyo: true, repeat: 2 }); }
    else { const left = a.readyAt - now(); toast(`${d.n} กำลังย่อยอาหาร อีก ${fmtDur(left)} จะได้ ${iconHTML(d.give)}${ITEMS[d.give].n}`); }
    hud();
  }
  animalBubbles() {
    for (const e of this.ents) {
      if (e.kind !== 'animal') continue; const st = animalState(e.a); const d = ANIMALS[e.a.kind];
      if (st === 'hungry') e.bub.set('h' + Object.keys(d.eat)[0], ITEMS[Object.keys(d.eat)[0]].icon, '?', 0xffe0b0);
      else if (st === 'ready') e.bub.set('r', ITEMS[d.give].icon, null);
      else e.bub.set('', null, null);
    }
  }

  // ===== ชาวบ้าน (จากกระท่อม) =====
  spawnVillagers() {
    const huts = S.objects.filter((o) => o.type === 'hut').slice(0, CFG.MAX_VILLAGERS);
    const tints = [0xffd8b0, 0xd0f0c0, 0xc8d8ff, 0xffc8d8, 0xf0e0a0];
    huts.forEach((h, i) => {
      const spr = this.add.sprite((h.x + 1.5) * T, (h.y + 2.6) * T, 'villager', 30).setOrigin(0.5, 46 / 48).setTint(tints[i % tints.length]).setScale(0.85);
      spr.play('idle-south');
      this.ents.push({ kind: 'villager', spr, home: h, tx: spr.x, ty: spr.y, wait: rnd(1, 4), dir: 'south' });
    });
  }

  // ===== รอยแกล้ง =====
  refreshPranks() {
    this.prankSpr.forEach((s) => s.destroy()); this.prankSpr = [];
    this.ents.forEach((e) => e.kind === 'boar' && e.sh && e.sh.destroy());
    this.ents = this.ents.filter((e) => e.kind !== 'boar');
    const list = this.home ? S.pranksOnMe : (S.bots[this.bot.id].myPranks || []);
    for (const p of list) this.drawPrank(p);
  }
  drawPrank(p) {
    const clickable = this.home;
    const reg = (s, part) => { this.prankSpr.push(s); if (clickable) { s.setInteractive({ useHandCursor: true }); s.on('pointerdown', () => { this.uiClick = true; this.enqueue(Math.floor(s.x / T), Math.floor((s.y - 2) / T), () => this.doClean(p, part, s)); }); } return s; };
    const objById = (id) => (this.home ? S.objects.find((o) => o.id === id) : this.fobjs.find((o) => o.id === id));
    if (p.kind === 'mud' || p.kind === 'leaves') {
      for (const c of p.cells || []) {
        const s = this.add.image((c[0] + 0.5) * T, (c[1] + 0.5) * T, p.kind === 'mud' ? 'prank_mud' : 'prank_leaves').setDepth(3).setAngle(rint(0, 3) * 90);
        reg(s, c);
      }
    } else if (p.kind === 'sticker') {
      const o = objById(p.target); if (!o) return; const b = BUILDS[o.type];
      const rec = this.osprites[o.id]; const top = rec ? rec.spr.y - rec.spr.displayHeight * 0.72 : o.y * T;
      const s = this.add.text((o.x + b.w / 2) * T, top, p.face || '🤪', { fontSize: '14px' }).setOrigin(0.5).setResolution(4).setDepth(9000);
      this.tweens.add({ targets: s, angle: 8, duration: 500, yoyo: true, repeat: -1 });
      reg(s, null);
    } else if (p.kind === 'monkey') {
      const o = objById(p.target); if (!o) return;
      const s = this.add.image((o.x + 0.5) * T + 6, (o.y + 1) * T - 34, 'animal_monkey').setOrigin(0.5, 1).setDepth((o.y + 1) * T + 2);
      this.tweens.add({ targets: s, y: s.y - 3, duration: 300, yoyo: true, repeat: -1 });
      reg(s, null);
    } else if (p.kind === 'boar') {
      const s = this.add.image((p.pos[0] + 0.5) * T, (p.pos[1] + 0.5) * T, 'animal_boar').setOrigin(0.5, 0.9);
      reg(s, null); this.ents.push({ kind: 'boar', spr: s, tx: s.x, ty: s.y, wait: 0, cx: s.x, cy: s.y });
    } else if (p.kind === 'rooster') {
      const o = objById(p.target); if (!o) return; const b = BUILDS[o.type]; const rec = this.osprites[o.id];
      const top = rec ? rec.spr.y - rec.spr.displayHeight + 10 : o.y * T;
      const s = this.add.image((o.x + b.w / 2) * T + 8, top, 'animal_rooster').setOrigin(0.5, 1).setDepth(9000);
      this.tweens.add({ targets: s, angle: -10, duration: 250, yoyo: true, repeat: -1, repeatDelay: 2200 });
      reg(s, null);
    }
  }
  doClean(p, part, spr) {
    if (!S.pranksOnMe.includes(p)) return;
    const { txt, done } = cleanPrank(p, part);
    this.dust(spr.x, spr.y); this.floatText(spr.x, spr.y - 12, '✨ สะอาด!');
    if (p.kind === 'boar') sfx('boar'); else if (p.kind === 'monkey') sfx('monkey'); else if (p.kind === 'rooster') sfx('rooster');
    toast(`🧹 กวาดรอยแกล้งของ${botById(p.bot).n} ได้ ${txt}${done ? '' : ''}`, 'good');
    this.refreshPranks(); hud();
  }

  // ===== หมู่บ้านเพื่อน =====
  setupFriend() {
    const b = this.bot; const v = botVillage(b);
    this.fobjs = friendLayout(b).map((o, i) => ({ ...o, id: o.id || 'f' + i, data: {} }));
    for (const o of this.fobjs) this.addObj(o);
    this.fplots = {};
    for (const p of v.plots) {
      const s = this.add.image((p.x + 0.5) * T, (p.y + 1) * T - 3, p.stage >= 3 ? CROPS[p.crop].img : p.stage === 2 ? CROPS[p.crop].img : 'crop_pumpkin_1_sprout').setOrigin(0.5, 1).setDepth((p.y + 1) * T - 3);
      if (p.stage === 2) s.setScale(0.62).setTint(0xb8d890);
      const pest = this.add.image((p.x + 0.7) * T, (p.y + 0.75) * T, 'pest_caterpillar').setScale(0.55).setDepth((p.y + 1) * T).setVisible(p.need === 'pest');
      const bub = this.makeBubble((p.x + 0.5) * T, p.y * T + 4);
      if (p.need === 'water') bub.set('w', null, '💧', 0xffe0b0); else if (p.need === 'pest') bub.set('p', null, '🐛', 0xffe0b0);
      this.fplots[p.x + ',' + p.y] = { p, s, pest, bub };
    }
    const pen = this.fobjs.find((o) => o.type === 'pen');
    for (const fa of v.animals) {
      const e = this.addAnimal({ kind: fa.kind, pen: null, fake: fa }); // จะคืน undefined เพราะไม่มีคอกจริง
      if (e) continue;
      const r = this.penRect(pen); const d = ANIMALS[fa.kind];
      const spr = this.add.image(rnd(r.x1, r.x2), rnd(r.y1, r.y2), d.img).setOrigin(0.5, 0.95).setInteractive({ useHandCursor: true });
      const ent = { kind: 'fanimal', fa, spr, pen, tx: spr.x, ty: spr.y, wait: rnd(0.5, 2), bub: this.makeBubble(spr.x, spr.y - 26) };
      if (fa.hungry) ent.bub.set('h', ITEMS[Object.keys(d.eat)[0]].icon, '?', 0xffe0b0);
      spr.on('pointerdown', () => { this.uiClick = true; this.enqueue(Math.floor(spr.x / T), Math.floor(spr.y / T), () => this.friendFeed(ent)); });
      this.ents.push(ent);
    }
    // เจ้าของหมู่บ้าน
    const chief = this.fobjs.find((o) => o.type === 'chief');
    this.owner = this.add.image((chief.x + 1.5) * T + 30, (chief.y + 2.7) * T, b.img).setOrigin(0.5, 1).setDepth((chief.y + 2.7) * T).setInteractive({ useHandCursor: true });
    this.ownerTag = this.add.text(this.owner.x, this.owner.y - 50, b.n, TXT(8, '#ffe9a8')).setOrigin(0.5, 1).setResolution(4).setDepth(9500);
    this.owner.on('pointerdown', () => { this.uiClick = true; this.say(this.owner, pick(['สวัสดี! มาเที่ยวเหรอ', 'อย่าแกล้งเยอะนะ 😤', 'ช่วยรดน้ำให้หน่อยสิ 💧', 'ฮิฮิ'])); });
    this.tweens.add({ targets: this.owner, scaleY: 1.04, duration: 900, yoyo: true, repeat: -1 });
    this.refreshPranks();
  }
  friendArrive() {
    const b = this.bot; const bs = S.bots[b.id];
    S.visited[b.id] = 1; stat('visit');
    if (bs.visitDay !== dayKey()) { bs.visitDay = dayKey(); stat('visit_uniq'); }
    this.time.delayedCall(700, () => this.say(this.owner, b.id === 'pupu' ? 'โย่! มาทำไมเนี่ย จะมาแกล้งใช่มั้ย 😏' : b.id === 'mali' ? 'ยินดีต้อนรับค่ะ 🌸' : 'มาแล้วเหรอ! นั่งก่อนสิ 💪'));
    friendBar(b);
  }
  friendPlot(key) {
    const fp = this.fplots[key]; if (!fp || !fp.p.need) return false;
    const b = this.bot;
    if (helpLeft(b) <= 0) { toast(`วันนี้ช่วย${b.n}ครบโควตาแล้ว (${CFG.HELP_PER_FRIEND} ครั้ง/คน)`, 'bad'); sfx('error'); return true; }
    const kind = fp.p.need; const r = doHelp(b, kind);
    fp.p.need = null; fp.bub.set('', null, null); fp.pest.setVisible(false); mark();
    sfx(kind === 'water' ? 'water' : 'pest'); this.floatText(fp.s.x, fp.s.y - 18, kind === 'water' ? '💧 รดน้ำแล้ว' : '🐛 ไล่หนอนแล้ว');
    toast(`💛 ช่วย${b.n}แล้ว ได้ ${r}`, 'good'); friendBar(b); hud();
    if (Math.random() < 0.3) this.say(this.owner, pick(['ขอบใจนะ!', 'น่ารักที่สุด 💛', 'เดี๋ยวไปช่วยคืนนะ']));
    return true;
  }
  friendFeed(ent) {
    const b = this.bot;
    if (!ent.fa.hungry) { toast(`${ANIMALS[ent.fa.kind].n}ของ${b.n}อิ่มแล้ว`); return; }
    if (helpLeft(b) <= 0) { toast(`วันนี้ช่วย${b.n}ครบโควตาแล้ว`, 'bad'); sfx('error'); return; }
    const r = doHelp(b, 'feed'); ent.fa.hungry = false; mark(); ent.bub.set('', null, null); sfx('eat');
    this.floatText(ent.spr.x, ent.spr.y - 24, '😋 ง่ำ ๆ'); toast(`🍖 ให้อาหารสัตว์ของ${b.n} ได้ ${r}`, 'good'); friendBar(b); hud();
  }
  friendPrank(kind) {
    const b = this.bot; const bs = S.bots[b.id];
    if (S.peaceful) { toast('เปิดโหมดหมู่บ้านสงบอยู่ แกล้งใครไม่ได้ (ปิดได้ที่กระท่อมหัวหน้าเผ่า)', 'bad'); return; }
    if (!(bs.revengeFree > 0) && prankLeft(b) <= 0) { toast(S.counters.pranks >= prankQuota() ? `วันนี้แกล้งครบ ${prankQuota()} ครั้งแล้ว พรุ่งนี้มาใหม่นะ` : `แกล้ง${b.n}ได้วันละ 1 ครั้ง`, 'bad'); sfx('error'); return; }
    if (PRANKS[kind].lv > S.level) { toast(`ปลดล็อกที่เลเวล ${PRANKS[kind].lv}`, 'bad'); return; }
    const opts = {};
    if (kind === 'mud') { opts.cells = []; for (let i = 0; i < 4; i++) opts.cells.push([rint(2, FRIEND_W - 3), rint(8, 9)]); sfx('mud'); }
    if (kind === 'leaves') { opts.cells = []; for (let i = 0; i < 6; i++) opts.cells.push([rint(9, 16), rint(10, 13)]); sfx('sweep'); }
    if (kind === 'sticker') { opts.target = 'statue'; opts.face = pick(STICKERS); sfx('boom'); }
    if (kind === 'monkey') { opts.target = 'tree'; sfx('monkey'); }
    if (kind === 'boar') { opts.pos = [rint(10, 15), rint(10, 13)]; sfx('boar'); }
    if (kind === 'rooster') { opts.target = 'f0'; sfx('rooster'); }
    const r = doMyPrank(b, kind, opts);
    if (!r) return;
    this.refreshPranks(); this.cameras.main.shake(180, 0.004);
    this.say(this.owner, pick({ pupu: ['เฮ้ย! เดี๋ยวเจอดี 😤', 'จำไว้เลยนะ!!', 'ฮ่า ๆ เก่งนี่'], mali: ['ว้าย! 😳', 'แกล้งกันทำไมคะ~', 'ฮึ่ม 🌸'], to: ['ฮ่า ๆ ๆ ขำดี', 'เดี๋ยวพี่เอาคืน 💪', 'ซนจริง ๆ'] }[b.id]));
    toast(`😈 แกล้ง${b.n}สำเร็จ: ${PRANKS[kind].n}${r !== 'ok' ? ' ได้ ' + r : ''}`, 'good'); friendBar(b); hud();
  }
  say(spr, text) {
    if (!spr) return; if (spr.sayT) spr.sayT.destroy();
    const t = this.add.text(spr.x, spr.y - (spr.displayHeight || 40) - 4, text, { ...TXT(8, '#4f3d36'), stroke: '#fff', strokeThickness: 0, backgroundColor: '#fff8e8', padding: { x: 5, y: 3 } }).setOrigin(0.5, 1).setResolution(4).setDepth(9800);
    spr.sayT = t; this.time.delayedCall(2600, () => { if (spr.sayT === t) spr.sayT = null; t.destroy(); });
    return t;
  }

  // ===== เพื่อนบอทแวะมาที่หมู่บ้านเรา =====
  botVisit(id, kind) {
    if (!this.home) return; const b = botById(id);
    const sx = (S.owned.w - 0.5) * T, sy = 9 * T;
    const tx = rnd(6, Math.min(S.owned.w - 4, 20)) * T;
    const s = this.add.image(sx, sy, b.img).setOrigin(0.5, 1).setDepth(sy);
    const tag = this.add.text(sx, sy - 50, b.n, TXT(7, '#ffe9a8')).setOrigin(0.5, 1).setResolution(4).setDepth(9500);
    this.tweens.add({ targets: [s], x: tx, duration: 2600, ease: 'Sine.inOut', onUpdate: () => { tag.x = s.x; },
      onComplete: () => {
        this.say(s, kind === 'prank' ? pick(['ฮิฮิ แกล้งหน่อยนะ 😜', 'เซอร์ไพรส์!', 'จับไม่ได้หรอก~']) : pick(['มาช่วยแล้ว! 💛', 'รดน้ำให้นะ 💧', 'ฝากของขวัญไว้ 🎁']));
        if (kind === 'prank') { sfx('boom'); this.cameras.main.shake(150, 0.003); }
        this.time.delayedCall(1800, () => this.tweens.add({ targets: s, x: sx + T, alpha: 0, duration: 2200, onUpdate: () => { tag.x = s.x; tag.alpha = s.alpha; }, onComplete: () => { s.destroy(); tag.destroy(); } }));
      } });
  }

  // ===== วางของ / ย้ายของ =====
  startPlacing(type, fromBag, moveObj) {
    this.stopPlacing(true);
    const b = BUILDS[type];
    this.placing = { type, fromBag, moveObj, flip: moveObj ? moveObj.flip : false };
    if (b.img) this.ghost = this.add.image(0, 0, b.img).setOrigin(0.5, 1).setAlpha(0.75).setDepth(9900);
    else { this.ghost = this.add.graphics().setDepth(9900); this.ghost.fillStyle(0x8a6239, 0.6).fillRect(0, -4 * T, 5 * T, 4 * T); this.ghost.setFlipX = () => this.ghost; }
    if (b.img && this.ghost.width > (b.w + 1.2) * T) this.ghost.setScale(((b.w + 1.2) * T) / this.ghost.width);
    if (moveObj) { const r = this.osprites[moveObj.id]; if (r) { r.spr.setAlpha(0.3); } }
    placeBar(true, b.n, !!moveObj);
  }
  stopPlacing(silent) {
    if (this.ghost) this.ghost.destroy(); this.ghost = null;
    if (this.placing && this.placing.moveObj) { const r = this.osprites[this.placing.moveObj.id]; if (r && r.spr.setAlpha) r.spr.setAlpha(1); }
    this.placing = null; this.hl.clear(); if (!silent) placeBar(false);
    if (getTool() === 'move' && !silent) setTool('hand');
  }
  canPlace(type, x, y, ignore) {
    const b = BUILDS[type];
    for (let j = y; j < y + b.h; j++) for (let i = x; i < x + b.w; i++) {
      if (!this.owned(i, j) || i < 0 || j < 2 || i >= this.W || j >= this.H) return false;
      const c = this.grid[j][i]; if (c === 'w' || c === 's') return false;
      if (type !== 'pen' && (j === 8 || j === 9)) return false; // ห้ามวางทับถนนหลัก
      const o = objAtCell(i, j); if (o && o !== ignore) return false;
    }
    if (type === 'pen') { for (let j = y; j < y + 4; j++) for (let i = x; i < x + 5; i++) if (j === 8 || j === 9) return false; }
    return true;
  }
  tryPlace(cx, cy) {
    const pl = this.placing; const b = BUILDS[pl.type];
    const x = cx - Math.floor((b.w - 1) / 2), y = cy - (b.h - 1);
    if (!this.canPlace(pl.type, x, y, pl.moveObj)) { sfx('error'); toast('วางตรงนี้ไม่ได้ ลองที่หญ้าว่างในเขตที่ดิน', 'bad'); return; }
    if (pl.moveObj) {
      const o = pl.moveObj; const oldPen = o.type === 'pen';
      if (oldPen) { for (let j = o.y; j < o.y + 4; j++) for (let i = o.x; i < o.x + 5; i++) this.setCell(i, j, 'g'); }
      o.x = x; o.y = y; o.flip = pl.flip; mark(); sfx('build');
      this.placing = null; if (this.ghost) this.ghost.destroy(); this.ghost = null; placeBar(false); setTool('hand');
      this.scene.restart({ loc: 'home' }); return;
    }
    if (pl.fromBag) { S.bag[pl.type]--; if (!S.bag[pl.type]) delete S.bag[pl.type]; }
    else {
      const cost = buildCost(pl.type);
      if (!pay(cost)) { sfx('error'); toast('ของไม่พอ: ' + missingText(cost), 'bad'); return; }
    }
    const o = { id: uid(), type: pl.type, x, y, flip: pl.flip, data: {} };
    if (b.fruit) o.data = { n: 0, at: now() };
    if (pl.type === 'pen') o.data = { lvl: 0 };
    if (b.factory) o.data = { queue: [], slots: 2 };
    S.objects.push(o);
    if (pl.type === 'pen') for (let j = y; j < y + 4; j++) for (let i = x; i < x + 5; i++) this.setCell(i, j, 'd');
    this.addObj(o); this.dust((x + b.w / 2) * T, (y + b.h) * T); sfx('build');
    stat('build'); stat('build_' + pl.type); addXP(Math.max(1, Math.round((b.price || 20) / 30)));
    if (pl.type === 'hut') this.spawnVillagers();
    toast(`🔨 สร้าง${b.n}แล้ว!`, 'good'); hud();
    const again = pl.fromBag ? (S.bag[pl.type] || 0) > 0 : b.cat === 'deco' && canAfford(buildCost(pl.type));
    if (!again) this.stopPlacing();
  }

  // ===== การคลิก =====
  worldCell(p) { const wp = this.cameras.main.getWorldPoint(p.x, p.y); return [Math.floor(wp.x / T), Math.floor(wp.y / T), wp]; }
  onDown(p, over) {
    if (this.uiClick) { this.uiClick = false; return; }
    if (uiBlocking()) return;
    audioInit();
    const [cx, cy] = this.worldCell(p);
    if (p.rightButtonDown()) { if (this.placing) this.stopPlacing(); return; }
    if (this.placing) { this.tryPlace(cx, cy); return; }
    if (over && over.length) return;
    this.dragging = true; this.dragSeen = new Set([cx + ',' + cy]);
    this.clickCell(cx, cy, false);
  }
  onMove(p) {
    const [cx, cy] = this.worldCell(p);
    this.hover = [cx, cy];
    if (this.placing && this.ghost) {
      const b = BUILDS[this.placing.type]; const x = cx - Math.floor((b.w - 1) / 2), y = cy - (b.h - 1);
      if (this.placing.type === 'pen') this.ghost.setPosition(x * T, (y + 4) * T); else this.ghost.setPosition((x + b.w / 2) * T, (y + b.h) * T);
      const ok = this.canPlace(this.placing.type, x, y, this.placing.moveObj);
      this.ghost.setAlpha(ok ? 0.8 : 0.35); if (this.ghost.setTint) ok ? this.ghost.clearTint() : this.ghost.setTint(0xff6060);
      this.hl.clear().lineStyle(2, ok ? 0x88ff88 : 0xff5050, 0.9).strokeRect(x * T, y * T, b.w * T, b.h * T);
      return;
    }
    if (this.dragging && p.isDown && this.home) {
      const k = cx + ',' + cy; if (this.dragSeen.has(k)) return; this.dragSeen.add(k);
      if (S.plots[k] || (getTool() === 'hoe' && this.cell(cx, cy) === 'g')) this.clickCell(cx, cy, true);
    }
  }
  clickCell(cx, cy, drag) {
    if (!this.cell(cx, cy)) return;
    if (!this.home) {
      if (this.fplots[cx + ',' + cy]) { this.enqueue(cx, cy, () => this.friendPlot(cx + ',' + cy)); return; }
      const o = this.objAtCell(cx, cy);
      if (o && o.type === 'chief') { this.say(this.owner, pick(['บ้านฉันสวยมั้ย?', 'อย่าเข้าไปนะ! 😤'])); return; }
      this.walkTo(cx, cy); return;
    }
    const tool = getTool(); const key = cx + ',' + cy;
    if (!this.owned(cx, cy)) { if (!drag) { if (cx >= S.owned.w || cy >= S.owned.h) openPanel('expand'); } return; }
    if (tool === 'move') { const o = objAtCell(cx, cy); if (o && !BUILDS[o.type].debris) { this.startPlacing(o.type, false, o); } else toast('คลิกที่สิ่งก่อสร้างหรือของแต่งที่จะย้าย'); return; }
    if (tool === 'hoe') {
      if (this.cell(cx, cy) === 'g' && !objAtCell(cx, cy) && !S.plots[key]) { this.enqueue(cx, cy, () => this.till(cx, cy)); return; }
      if (S.plots[key] && !S.plots[key].crop && !drag) { this.enqueue(cx, cy, () => this.untill(cx, cy)); return; }
    }
    if (S.plots[key]) { this.enqueue(cx, cy, () => this.usePlot(key, tool)); return; }
    const o = objAtCell(cx, cy);
    if (o && !drag) { this.enqueue(cx, cy, () => this.useObj(o), BUILDS[o.type]); return; }
    if (!drag) this.walkTo(cx, cy);
  }
  spaceAct() {
    if (this.placing) return;
    const [fx, fy] = this.frontCell();
    // ของแกล้งใกล้ตัว
    for (const s of this.prankSpr) if (Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y - 8) < 26 && s.input) { s.emit('pointerdown'); this.uiClick = false; return; }
    for (const e of this.ents) if ((e.kind === 'animal' || e.kind === 'fanimal') && Phaser.Math.Distance.Between(e.spr.x, e.spr.y, this.player.x, this.player.y) < 28) { e.kind === 'animal' ? this.useAnimal(e) : this.friendFeed(e); return; }
    if (!this.home) { if (this.fplots[fx + ',' + fy]) this.friendPlot(fx + ',' + fy); return; }
    const key = fx + ',' + fy;
    if (S.plots[key]) { this.usePlot(key, getTool()); return; }
    const o = objAtCell(fx, fy); if (o) { this.useObj(o); return; }
    if (this.owned(fx, fy) && this.cell(fx, fy) === 'g') this.till(fx, fy);
  }
  frontCell() {
    const px = Math.floor(this.player.x / T), py = Math.floor((this.player.y - 4) / T);
    const d = { south: [0, 1], north: [0, -1], west: [-1, 0], east: [1, 0] }[this.dir];
    return [px + d[0], py + d[1]];
  }

  // ===== การกระทำ =====
  till(x, y) {
    const key = x + ',' + y;
    if (S.plots[key] || this.cell(x, y) !== 'g' || objAtCell(x, y)) return;
    if (y === 8 || y === 9 || y < 2) { toast('ไถถนนหรือริมน้ำไม่ได้นะ', 'bad'); return; }
    if (plotCount() >= PLOTS_BY_LEVEL(S.level)) { toast(`แปลงผักเต็มแล้ว (${plotCount()}/${PLOTS_BY_LEVEL(S.level)}) เลเวลขึ้นจะได้เพิ่ม`, 'bad'); sfx('error'); return; }
    S.plots[key] = { crop: null }; this.setCell(x, y, 's'); stat('till'); sfx('till'); this.dust((x + 0.5) * T, (y + 0.8) * T); mark();
    this.refreshPlots();
  }
  untill(x, y) { const key = x + ',' + y; if (!S.plots[key] || S.plots[key].crop) return; delete S.plots[key]; this.setCell(x, y, 'g'); mark(); this.refreshPlots(); toast('ถมแปลงคืนเป็นหญ้าแล้ว'); }
  usePlot(key, tool) {
    const p = S.plots[key]; const st = plotState(p); const fl = plotFlags(p); const [x, y] = key.split(',').map(Number);
    const wx = (x + 0.5) * T, wy = y * T + 8;
    if (st === 'empty') {
      const c = S.seedPick && cropUnlocked(S.seedPick) ? S.seedPick : 'pumpkin';
      const r = plantPlot(key, c);
      if (r === 'money') { toast(`เปลือกหอยไม่พอซื้อเมล็ด${CROPS[c].n} (${CROPS[c].seed} 🐚)`, 'bad'); sfx('error'); return; }
      if (r === 'ok') this.floatText(wx, wy, '🌱 ' + CROPS[c].n);
    } else if (st === 'dry0') { waterPlot(key); this.floatText(wx, wy, '💧'); this.splash(wx, wy + 10); }
    else if (fl.dry) { waterPlot(key); this.floatText(wx, wy, '💧 เร็วขึ้น 10%'); this.splash(wx, wy + 10); }
    else if (fl.pest) { shooPest(key); this.floatText(wx, wy, '🐛 ไล่แล้ว +1 ผลผลิต'); this.dust(wx, wy + 10); }
    else if (st === 'ripe') {
      const r = harvestPlot(key);
      if (r === 'full') return storageFullMsg();
      if (r) { this.floatText(wx, wy, `+${r.n} ${ITEMS[r.crop].n}`); this.flyIcon(wx, wy, ITEMS[r.crop].icon); this.sparkle(wx, wy + 6); }
      // ปลูกต่อทันทีถ้าถือเมล็ด
      if (tool === 'seed') this.usePlot(key, 'none');
    } else if (st === 'grow') { if (tool !== 'drag') openPanel('plot', key); }
    this.refreshPlots(); hud();
  }
  splash(x, y) { for (let i = 0; i < 7; i++) { const d = this.add.circle(x + rnd(-6, 6), y, 2, 0x8fd0ff, 0.9).setDepth(9000); this.tweens.add({ targets: d, y: y - rnd(6, 14), x: d.x + rnd(-8, 8), alpha: 0, duration: rnd(300, 500), onComplete: () => d.destroy() }); } }
  useObj(o) {
    const b = BUILDS[o.type];
    if (b.debris) {
      const r = this.osprites[o.id]; if (r) this.dust(r.spr.x, r.spr.y - 6);
      S.objects = S.objects.filter((q) => q !== o); this.removeObj(o);
      const txt = grant(b.debris); addXP(2); stat('clear'); sfx(o.type === 'rock' ? 'dig' : 'sweep');
      toast(`🌲 เก็บกวาด${b.n} ได้ ${txt}`, 'good'); hud(); return;
    }
    if (b.fruit) {
      treeTick(o); const n = o.data.n;
      if (n > 0) {
        const fr = b.fruit; if (!store(fr, n)) return storageFullMsg();
        o.data.n = 0; o.data.at = now(); stat('fruit', n); addXP(n); sfx('harvest');
        const r = this.osprites[o.id]; this.floatText(r.spr.x, r.spr.y - 50, `+${n} ${ITEMS[fr].n}`); this.flyIcon(r.spr.x, r.spr.y - 40, ITEMS[fr].icon);
        this.tweens.add({ targets: r.spr, angle: 4, duration: 70, yoyo: true, repeat: 3 });
      } else toast(`${b.n} ยังไม่มีลูก อีก ${fmtDur(b.ms - (now() - o.data.at))} จะออกลูกใหม่`);
      hud(); return;
    }
    if (b.factory) { const got = factoryCollect(o); if (got === 'full') return storageFullMsg(); if (got > 0) { const r = this.osprites[o.id]; this.floatText(r.spr.x, r.spr.y - 40, `+${got} สินค้า`); this.sparkle(r.spr.x, r.spr.y - 30); hud(); return; } openPanel('factory', o); return; }
    if (o.type === 'pen') {
      const ents = this.ents.filter((e) => e.kind === 'animal' && e.a.pen === o.id);
      const ready = ents.filter((e) => animalState(e.a) === 'ready'); const hungry = ents.filter((e) => animalState(e.a) === 'hungry');
      if (ready.length) { ready.forEach((e) => this.useAnimal(e)); return; }
      if (hungry.length && hungry.some((e) => canAfford(ANIMALS[e.a.kind].eat))) { hungry.filter((e) => canAfford(ANIMALS[e.a.kind].eat)).forEach((e) => this.useAnimal(e)); return; }
      openPanel('pen', o); return;
    }
    const panels = { chief: 'chief', market: 'market', storage: 'storage', ordertree: 'orders', bonfire: 'bonfire', hut: 'hut' };
    if (panels[o.type]) { openPanel(panels[o.type], o); return; }
    if (o.type === 'goose') { sfx('goose'); this.say(this.osprites[o.id].spr, 'ก๊าบ! เฝ้ายามอยู่ 🦢'); return; }
    const r = this.osprites[o.id]; if (r && r.spr.setScale) this.tweens.add({ targets: r.spr, scaleY: r.spr.scaleY * 1.08, duration: 100, yoyo: true });
    toast(`${b.n} · ความสวย +${b.beauty || 0}`);
  }

  // ===== เดิน (หาเส้นทาง) =====
  enqueue(x, y, fn, big) {
    this.queue.push({ x, y, fn, big });
    if (this.queue.length === 1) this.processQueue();
  }
  processQueue() {
    while (this.queue.length) {
      const q = this.queue[0];
      if (this.inReach(q.x, q.y, q.big)) { this.queue.shift(); this.face(q.x, q.y); q.fn(); continue; }
      const path = this.findPath(q.x, q.y, q.big);
      if (!path) { this.queue.shift(); toast('เดินไปตรงนั้นไม่ได้', 'bad'); continue; }
      this.path = path; return;
    }
  }
  inReach(x, y, big) {
    const px = this.player.x / T, py = (this.player.y - 6) / T;
    if (big) { const o = this.objAtCell(x, y); if (o) { const b = BUILDS[o.type]; const nx = Phaser.Math.Clamp(px, o.x, o.x + b.w), ny = Phaser.Math.Clamp(py, o.y, o.y + b.h); return Math.hypot(nx - px, ny - py) < 2.3; } }
    return Math.hypot(x + 0.5 - px, y + 0.5 - py) < 2.6;
  }
  face(x, y) { const dx = (x + 0.5) * T - this.player.x, dy = (y + 0.5) * T - this.player.y; this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north'; this.player.play('idle-' + this.dir, true); }
  walkTo(x, y) { this.queue = []; const p = this.findPath(x, y, false, true); if (p) this.path = p; }
  findPath(tx, ty, big, exact) {
    const sx = Math.floor(this.player.x / T), sy = Math.floor((this.player.y - 4) / T);
    const goal = (x, y) => {
      if (exact) return x === tx && y === ty;
      if (big) { const o = this.objAtCell(tx, ty); if (o) { const b = BUILDS[o.type]; const nx = Phaser.Math.Clamp(x, o.x, o.x + b.w - 1), ny = Phaser.Math.Clamp(y, o.y, o.y + b.h - 1); return Math.max(Math.abs(nx - x), Math.abs(ny - y)) <= 1; } }
      return Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1;
    };
    if (exact && this.isBlockedCell(tx, ty)) return this.findPath(tx, ty, false, false);
    const W = this.W, prev = new Map(); const start = sx + ',' + sy; prev.set(start, null);
    const qq = [[sx, sy]]; let found = null; let it = 0;
    while (qq.length && it++ < 4000) {
      const [x, y] = qq.shift();
      if (goal(x, y)) { found = [x, y]; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (prev.has(k) || this.isBlockedCell(nx, ny)) continue;
        prev.set(k, x + ',' + y); qq.push([nx, ny]);
      }
    }
    if (!found) return null;
    const out = []; let k = found[0] + ',' + found[1];
    while (k && k !== start) { const [x, y] = k.split(',').map(Number); out.unshift([(x + 0.5) * T, (y + 0.75) * T]); k = prev.get(k); }
    return out;
  }

  makeAnims() {
    if (this.anims.exists('walk-south')) return;
    const rows = { idle: { south: 1, west: 2, east: 3, north: 4 }, walk: { south: 5, west: 6, east: 7, north: 8 } };
    for (const [a, dirs] of Object.entries(rows)) for (const [d, r] of Object.entries(dirs)) {
      const n = a === 'idle' ? 4 : 6;
      this.anims.create({ key: `${a}-${d}`, frames: this.anims.generateFrameNumbers('villager', { start: r * 6, end: r * 6 + n - 1 }), frameRate: a === 'idle' ? 5 : 10, repeat: -1 });
    }
  }

  // ===== ทุกเฟรม =====
  update(time, dtMs) {
    const dt = Math.min(dtMs, 50) / 1000; const p = this.player;
    let vx = 0, vy = 0; const k = this.keys;
    if (!uiBlocking() && !isTyping()) {
      if (k.A.isDown || k.LEFT.isDown) vx -= 1; if (k.D.isDown || k.RIGHT.isDown) vx += 1;
      if (k.W.isDown || k.UP.isDown) vy -= 1; if (k.S.isDown || k.DOWN.isDown) vy += 1;
      if (JOY.active) { vx = JOY.x; vy = JOY.y; }
    }
    if (vx || vy) { this.path = null; this.queue = []; }
    if (!vx && !vy && this.path && this.path.length) {
      const [tx, ty] = this.path[0]; const dx = tx - p.x, dy = ty - p.y; const d = Math.hypot(dx, dy);
      if (d < 3) { this.path.shift(); if (!this.path.length) { this.path = null; this.processQueue(); } }
      else { vx = dx / d; vy = dy / d; }
    }
    const moving = vx || vy;
    if (moving) {
      const len = Math.hypot(vx, vy) || 1; const sp = CFG.SPEED * dt * (this.path ? 1.15 : 1);
      const nx = p.x + (vx / len) * sp, ny = p.y + (vy / len) * sp;
      const blocked = (x, y) => this.isBlockedCell(Math.floor(x / T), Math.floor((y - 4) / T));
      if (!blocked(nx, p.y)) p.x = nx; if (!blocked(p.x, ny)) p.y = ny;
      this.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'east' : 'west') : vy > 0 ? 'south' : 'north';
      p.play('walk-' + this.dir, true);
    } else p.play('idle-' + this.dir, true);
    p.setDepth(p.y); this.shadow.setPosition(p.x, p.y - 1); this.nameTag.setPosition(p.x, p.y - 42);

    // สัตว์ / หมูป่า / ชาวบ้าน เดินเล่น
    for (const e of this.ents) {
      e.wait -= dt;
      if (e.wait <= 0) {
        e.wait = rnd(1.5, 4);
        if (e.kind === 'animal' || e.kind === 'fanimal') { const r = this.penRect(e.pen); e.tx = rnd(r.x1, r.x2); e.ty = rnd(r.y1, r.y2); }
        else if (e.kind === 'boar') { e.tx = e.cx + rnd(-60, 60); e.ty = e.cy + rnd(-30, 30); e.wait = rnd(0.6, 1.4); }
        else if (e.kind === 'villager') { e.tx = (e.home.x + 1.5) * T + rnd(-50, 50); e.ty = Phaser.Math.Clamp((e.home.y + 2.6) * T + rnd(-10, 40), 2.5 * T, (S.owned.h - 0.5) * T); }
      }
      const dx = e.tx - e.spr.x, dy = e.ty - e.spr.y, d = Math.hypot(dx, dy);
      const sp = e.kind === 'boar' ? 70 : e.kind === 'villager' ? 30 : 18;
      if (d > 1.5) { e.spr.x += (dx / d) * Math.min(d, sp * dt); e.spr.y += (dy / d) * Math.min(d, sp * dt); if (e.kind !== 'villager' && Math.abs(dx) > 1) e.spr.setFlipX(dx > 0); }
      if (e.kind === 'villager') { const dir = d > 1.5 ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north') : e.dir; e.dir = dir; e.spr.play((d > 1.5 ? 'walk-' : 'idle-') + dir, true); }
      e.spr.setDepth(e.spr.y);
      if (!e.sh) e.sh = this.add.ellipse(0, 0, Math.min(22, e.spr.displayWidth * 0.7), 5, 0x10200a, 0.25).setDepth(2);
      e.sh.setPosition(e.spr.x, e.spr.y - 1).setVisible(e.spr.visible);
      if (e.bub) { e.bub.c.x = e.spr.x; e.bub.c.y = e.spr.y - 26 + Math.sin(time / 300) * 2; }
    }

    // ไฮไลต์ช่องที่เมาส์ชี้
    if (!this.placing && this.hover && !uiBlocking()) {
      const [hx, hy] = this.hover; this.hl.clear();
      if (this.cell(hx, hy) && this.owned(hx, hy)) {
        const o = this.objAtCell(hx, hy), r = o && this.osprites[o.id];
        if (r && r.spr && r.spr.preFX) this.setGlow(r.spr);
        else if (o) { this.setGlow(null); const b = BUILDS[o.type]; this.brackets(o.x * T, o.y * T, b.w * T, b.h * T); }
        else { this.setGlow(null); this.brackets(hx * T, hy * T, T, T); }
      } else this.setGlow(null);
    } else if (this.glowSpr) this.setGlow(null);
    if (this.home && (this.propT = (this.propT || 0) + dt) > 0.5) { this.propT = 0; this.propCheck(); }

    // น้ำ: ลายคลื่นไหล + ประกายแสงค่อย ๆ ลอยผ่าน
    const cam = this.cameras.main.worldView;
    this.waveT += dt;
    if (this.waves) { const ox = this.waveT * 6, oy = Math.sin(this.waveT * 0.8) * 3; for (const w of this.waves) w.setTilePosition(w.x + ox, w.y + oy); }
    this.waterT += dt;
    if (this.waterT > 0.12) {
      this.waterT = 0;
      for (let i = 0; i < 3; i++) {
        const x = rnd(cam.x, cam.right), y = rnd(cam.y, cam.bottom), cx = Math.floor(x / T), cy = Math.floor(y / T);
        if (this.cell(cx, cy) !== 'w' || this.cell(cx, cy + 1) === 'g' || this.cell(cx, cy - 1) === 'g') continue;
        const gl = this.add.image(Math.floor(x), Math.floor(y), 'glint').setDepth(0.7).setAlpha(0).setScale(rnd(1, 2), 1);
        this.tweens.add({ targets: gl, alpha: { from: 0, to: 0.8 }, x: gl.x + rnd(4, 10), duration: rnd(500, 800), yoyo: true, ease: 'Sine.inOut', onComplete: () => gl.destroy() });
      }
    }
    // เงาเมฆลอยผ่าน + ละอองแสงตามกล้อง
    if (this.clouds) { const W = this.W * T; for (const c of this.clouds) { c.x += c.vx * dt; if (c.x - c.displayWidth / 2 > W) { c.x = -c.displayWidth / 2; c.y = Math.random() * this.H * T; } } }
    if (this.moteZone) this.moteZone.setTo(cam.x, cam.y, cam.width, cam.height);

    this.refreshAcc += dtMs;
    if (this.refreshAcc > 400) { this.refreshAcc = 0; if (this.home) { this.refreshPlots(); this.animalBubbles(); this.objBubbles(); } setHint(this.hintText()); }
  }
  objBubbles() {
    const t = now();
    for (const o of S.objects) {
      const r = this.osprites[o.id]; if (!r || !r.bub) continue; const b = BUILDS[o.type];
      if (b.fruit) { treeTick(o, t); r.bub.set(o.data.n ? 'f' + o.data.n : '', ITEMS[b.fruit].icon, o.data.n ? 'x' + o.data.n : null); r.bub.c.y = r.spr.y - r.spr.displayHeight + 6; }
      else if (b.factory) {
        const q = o.data.queue || []; const ready = q.filter((j) => j.end <= t).length;
        if (ready) r.bub.set('r' + ready, ITEMS[q[0].out].icon, 'x' + ready); else if (q.length) r.bub.set('w', null, '⏳', 0xe8e0d0); else r.bub.set('i', null, '💤', 0xe8e0d0);
        r.bub.c.y = r.spr.y - r.spr.displayHeight + 2;
      } else if (o.type === 'ordertree') { ordersTick(); const can = S.orders.filter((x) => !x.readyAt && canAfford(x.items)).length; r.bub.set(can ? 'o' + can : '', null, can ? '📋' + can : null, 0xd8ffc8); r.bub.c.y = r.spr.y - r.spr.displayHeight + 6; }
      else if (o.type === 'storage') { const full = storageFree() <= 5; r.bub.set(full ? 'full' : '', null, full ? '⚠️เต็ม' : null, 0xffd0c0); r.bub.c.y = r.spr.y - r.spr.displayHeight + 6; }
      else if (o.type === 'chief') { const st = loginStatus(); r.bub.set(st.claimable ? 'l' : '', null, st.claimable ? '🎁' : null, 0xfff0a0); r.bub.c.y = r.spr.y - r.spr.displayHeight + 6; }
      else if (o.type === 'pen') { r.bub.set('', null, null); }
      if (r.bub && !r.bub.c.visible) continue;
    }
  }
  hintText() {
    if (this.placing) return '';
    if (!this.home) return `หมู่บ้าน${this.bot.n} · คลิกแปลงที่มี 💧/🐛 หรือสัตว์ที่หิวเพื่อช่วย · ใช้แถบด้านล่างเพื่อแกล้ง`;
    const [fx, fy] = this.frontCell(); const key = fx + ',' + fy; const p = S.plots[key];
    if (p) { const st = plotState(p), fl = plotFlags(p); if (st === 'empty') return `Space: ปลูก${CROPS[S.seedPick || 'pumpkin'].n}`; if (st === 'dry0' || fl.dry) return 'Space: รดน้ำ'; if (fl.pest) return 'Space: ไล่หนอน'; if (st === 'ripe') return 'Space: เก็บผลผลิต'; return `${CROPS[p.crop].n} · อีก ${fmtDur(p.readyAt - now())} สุก`; }
    const o = objAtCell(fx, fy); if (o) return `Space: ใช้${BUILDS[o.type].n}`;
    if (this.owned(fx, fy) && this.cell(fx, fy) === 'g') return 'Space: ไถดินทำแปลงผัก';
    return '';
  }
}

function buildCost(type) { const b = BUILDS[type]; if (b.feathers) return { feathers: b.feathers }; if (b.coin) return { coins: b.coin }; return { shells: b.price || 0 }; }
function storageFullMsg() { toast('ยุ้งฉางเต็ม! ขายของที่ตลาดหรืออัปเกรดยุ้งฉางก่อนนะ', 'bad'); sfx('error'); }
function fmtDur(ms) {
  ms = Math.max(0, ms); const s = Math.ceil(ms / 1000);
  if (s < 60) return s + ' วิ'; const m = Math.ceil(s / 60); if (m < 60) return m + ' นาที';
  const h = Math.floor(m / 60), mm = m % 60; return h + ' ชม.' + (mm ? ' ' + mm + ' นาที' : '');
}
