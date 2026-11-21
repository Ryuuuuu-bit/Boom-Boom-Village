// Boom Boom Village server: static files + account/login API + cloud save.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const FB_APP_ID = process.env.FB_APP_ID || '';
const FB_APP_SECRET = process.env.FB_APP_SECRET || '';
const SESSION_DAYS = 90;
const MAX_BODY = 2 * 1024 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const BLOCKED = new Set(['server.js', 'db.js', 'package.json', 'package-lock.json', 'tools', 'node_modules', 'test']);

// ---------- helpers ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
class HttpErr extends Error { constructor(code, error, msg) { super(msg || error); this.code = code; this.error = error; this.msg = msg; } }
const fail = (code, error, msg) => { throw new HttpErr(code, error, msg); };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(new HttpErr(413, 'too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpErr(400, 'bad_json')); }
    });
    req.on('error', reject);
  });
}

// password hashing (scrypt, built into Node)
function hashPass(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + h.toString('hex');
}
function checkPass(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hex] = stored.split('$');
  const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64);
  const want = Buffer.from(hex, 'hex');
  return want.length === h.length && crypto.timingSafeEqual(h, want);
}

// simple per-IP rate limit for login endpoints
const hits = new Map();
function rateLimit(req, key, max, windowMs) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
  const k = key + '|' + ip; const t = Date.now();
  const arr = (hits.get(k) || []).filter((x) => t - x < windowMs);
  arr.push(t); hits.set(k, arr);
  if (arr.length > max) fail(429, 'rate_limited', 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่นะ');
}
setInterval(() => { const t = Date.now(); for (const [k, a] of hits) if (!a.some((x) => t - x < 3600e3)) hits.delete(k); }, 600e3).unref();

const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>"'&`]/g, '').trim().slice(0, 24);
const cleanEmail = (s) => String(s || '').trim().toLowerCase().slice(0, 200);
const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const randomName = () => 'หัวหน้าเผ่า' + (1000 + Math.floor(Math.random() * 9000));
const pubUser = (u) => ({ id: String(u.id), name: u.name, email: u.email || null, facebook: !!u.fb_id, guest: !u.email && !u.fb_id });

async function newSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [sha(token), userId]);
  await db.q('UPDATE users SET last_login = now() WHERE id = $1', [userId]);
  return token;
}
async function userFromToken(token) {
  if (!token || token.length > 100) return null;
  const r = await db.q('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [sha(token)]);
  return r.rows[0] || null;
}
const bearer = (req) => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; };
async function needUser(req, body) {
  const u = await userFromToken(bearer(req) || (body && body.token));
  if (!u) fail(401, 'not_logged_in', 'กรุณาเข้าสู่ระบบใหม่');
  if (u.banned) fail(403, 'banned', 'บัญชีนี้ถูกระงับ');
  return u;
}
async function authed(res, u) { send(res, 200, { token: await newSession(u.id), user: pubUser(u) }); }

// verify a Facebook access token with Graph API
async function fbVerify(accessToken) {
  if (!FB_APP_ID || !FB_APP_SECRET) fail(400, 'fb_disabled', 'ยังไม่ได้เปิดใช้ Facebook Login');
  const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(FB_APP_ID + '|' + FB_APP_SECRET)}`).then((r) => r.json());
  const d = dbg && dbg.data;
  if (!d || !d.is_valid || String(d.app_id) !== String(FB_APP_ID)) fail(401, 'fb_invalid', 'ยืนยันตัวตนกับ Facebook ไม่สำเร็จ');
  const me = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`).then((r) => r.json());
  if (!me || !me.id || String(me.id) !== String(d.user_id)) fail(401, 'fb_invalid', 'ยืนยันตัวตนกับ Facebook ไม่สำเร็จ');
  return me;
}


// ---------- เพื่อน ----------
const RULES = { HELP_PER_FRIEND: 5, PRANK_PER_FRIEND: 2, PRANK_PER_DAY: 6, PRANKS_TO_SHIELD: 3, GOOSE_CATCH: 0.25, PRANKS: ['mud', 'sticker', 'monkey', 'boar', 'leaves', 'rooster'] };
const gameDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // วันตามเวลาไทย
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function ensureCode(u) {
  if (u.friend_code) return u.friend_code;
  for (let i = 0; i < 8; i++) {
    let c = ''; for (let j = 0; j < 6; j++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    try { const r = await db.q('UPDATE users SET friend_code = $1 WHERE id = $2 AND friend_code IS NULL RETURNING friend_code', [c, u.id]); if (r.rowCount) return c; const x = await db.q('SELECT friend_code FROM users WHERE id = $1', [u.id]); if (x.rows[0].friend_code) return x.rows[0].friend_code; } catch (e) { if (e.code !== '23505') throw e; }
  }
  fail(500, 'code_failed');
}
async function friendOf(uid, fid) {
  const r = await db.q('SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = $1 AND f.friend_id = $2', [uid, fid]);
  if (!r.rows[0]) fail(403, 'not_friend', 'ยังไม่ได้เป็นเพื่อนกัน');
  return r.rows[0];
}

// ---------- API ----------
const API = {
  'GET /api/config': async () => ({ accounts: db.enabled(), facebookAppId: FB_APP_ID && FB_APP_SECRET ? FB_APP_ID : null }),

  'POST /api/auth/guest': async (req, res, b) => {
    rateLimit(req, 'guest', 30, 3600e3);
    const r = await db.q('INSERT INTO users (name) VALUES ($1) RETURNING *', [cleanName(b.name) || randomName()]);
    return authed(res, r.rows[0]);
  },

  // สมัครด้วยอีเมล (ถ้าเป็น guest อยู่ จะผูกอีเมลเข้ากับบัญชีเดิม เซฟไม่หาย)
  'POST /api/auth/register': async (req, res, b) => {
    rateLimit(req, 'register', 10, 3600e3);
    const email = cleanEmail(b.email); const pw = String(b.password || '');
    if (!okEmail(email)) fail(400, 'bad_email', 'อีเมลไม่ถูกต้อง');
    if (pw.length < 6 || pw.length > 200) fail(400, 'weak_password', 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว');
    const exists = await db.q('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rowCount) fail(409, 'email_taken', 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน');
    const cur = await userFromToken(bearer(req));
    if (cur && !cur.email) {
      const r = await db.q('UPDATE users SET email = $1, pass_hash = $2, name = COALESCE(NULLIF($3, \'\'), name) WHERE id = $4 RETURNING *', [email, hashPass(pw), cleanName(b.name), cur.id]);
      return send(res, 200, { token: bearer(req), user: pubUser(r.rows[0]), linked: true });
    }
    const r = await db.q('INSERT INTO users (name, email, pass_hash) VALUES ($1, $2, $3) RETURNING *', [cleanName(b.name) || randomName(), email, hashPass(pw)]);
    return authed(res, r.rows[0]);
  },

  'POST /api/auth/login': async (req, res, b) => {
    rateLimit(req, 'login', 15, 15 * 60e3);
    const r = await db.q('SELECT * FROM users WHERE email = $1', [cleanEmail(b.email)]);
    const u = r.rows[0];
    if (!u || !checkPass(String(b.password || ''), u.pass_hash)) fail(401, 'bad_login', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    if (u.banned) fail(403, 'banned', 'บัญชีนี้ถูกระงับ');
    return authed(res, u);
  },

  'POST /api/auth/facebook': async (req, res, b) => {
    rateLimit(req, 'fb', 20, 15 * 60e3);
    const me = await fbVerify(String(b.accessToken || ''));
    const found = await db.q('SELECT * FROM users WHERE fb_id = $1', [me.id]);
    if (found.rows[0]) { if (found.rows[0].banned) fail(403, 'banned', 'บัญชีนี้ถูกระงับ'); return authed(res, found.rows[0]); }
    const cur = await userFromToken(bearer(req));
    if (cur && !cur.fb_id) {
      const r = await db.q('UPDATE users SET fb_id = $1 WHERE id = $2 RETURNING *', [me.id, cur.id]);
      return send(res, 200, { token: bearer(req), user: pubUser(r.rows[0]), linked: true });
    }
    const r = await db.q('INSERT INTO users (name, fb_id) VALUES ($1, $2) RETURNING *', [cleanName(me.name) || randomName(), me.id]);
    return authed(res, r.rows[0]);
  },

  'POST /api/auth/logout': async (req) => {
    const t = bearer(req); if (t) await db.q('DELETE FROM sessions WHERE token_hash = $1', [sha(t)]);
    return { ok: true };
  },

  'GET /api/me': async (req) => ({ user: pubUser(await needUser(req)) }),

  'POST /api/me': async (req, res, b) => {
    const u = await needUser(req); const name = cleanName(b.name);
    if (!name) fail(400, 'bad_name', 'ตั้งชื่อก่อนนะ');
    const r = await db.q('UPDATE users SET name = $1 WHERE id = $2 RETURNING *', [name, u.id]);
    return { user: pubUser(r.rows[0]) };
  },

  'GET /api/save': async (req) => {
    const u = await needUser(req);
    const r = await db.q('SELECT data, rev, updated_at FROM saves WHERE user_id = $1', [u.id]);
    return r.rows[0] ? { data: r.rows[0].data, rev: r.rows[0].rev, updatedAt: r.rows[0].updated_at } : { data: null, rev: 0 };
  },

  // บันทึกเกม: ต้องส่ง rev ล่าสุดที่รู้ ถ้าไม่ตรง (มีอีกเครื่อง/แท็บบันทึกทับ) จะตอบ 409
  'PUT /api/save': async (req, res, b) => {
    const u = await needUser(req, b);
    const data = b.data;
    if (!data || typeof data !== 'object' || data.v !== 2) fail(400, 'bad_save', 'ข้อมูลเซฟไม่ถูกต้อง');
    const rev = Number(b.rev) || 0;
    const level = Number.isFinite(+data.level) ? Math.floor(+data.level) : null;
    let r;
    if (rev === 0) {
      r = await db.q('INSERT INTO saves (user_id, data, rev, level) VALUES ($1, $2, 1, $3) ON CONFLICT (user_id) DO NOTHING RETURNING rev', [u.id, data, level]);
    } else {
      r = await db.q('UPDATE saves SET data = $2, rev = rev + 1, level = $4, updated_at = now() WHERE user_id = $1 AND rev = $3 RETURNING rev', [u.id, data, rev, level]);
    }
    if (!r.rowCount) {
      const cur = await db.q('SELECT rev FROM saves WHERE user_id = $1', [u.id]);
      return send(res, 409, { error: 'conflict', rev: cur.rows[0] ? cur.rows[0].rev : 0, message: 'เกมนี้ถูกเปิดเล่นจากอีกแท็บหรืออีกเครื่อง' });
    }
    return { ok: true, rev: r.rows[0].rev };
  },

  // เริ่มเกมใหม่ (ลบเซฟบนเซิร์ฟเวอร์)
  'DELETE /api/save': async (req) => { const u = await needUser(req); await db.q('DELETE FROM saves WHERE user_id = $1', [u.id]); return { ok: true }; },

  // ---------- เพื่อนจริง ----------
  'GET /api/friends': async (req) => {
    const u = await needUser(req);
    const code = await ensureCode(u);
    const r = await db.q(`SELECT u.id, u.name, s.level, s.updated_at,
        (SELECT count(*) FROM village_events e WHERE e.actor_id = $1 AND e.target_id = u.id AND e.day = $2 AND e.kind = 'help')::int AS helps,
        (SELECT count(*) FROM village_events e WHERE e.actor_id = $1 AND e.target_id = u.id AND e.day = $2 AND e.kind IN ('prank','caught'))::int AS pranks
      FROM friendships f JOIN users u ON u.id = f.friend_id LEFT JOIN saves s ON s.user_id = u.id
      WHERE f.user_id = $1 ORDER BY s.updated_at DESC NULLS LAST LIMIT 200`, [u.id, gameDay()]);
    return { code, friends: r.rows.map((f) => ({ id: String(f.id), name: f.name, level: f.level || 1, lastActive: f.updated_at, helps: f.helps, pranks: f.pranks })) };
  },
  'POST /api/friends/add': async (req, res, b) => {
    const u = await needUser(req);
    rateLimit(req, 'friendadd', 30, 3600e3);
    const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const r = await db.q('SELECT * FROM users WHERE friend_code = $1', [code]);
    const f = r.rows[0];
    if (!f) fail(404, 'no_code', 'ไม่พบรหัสเพื่อนนี้');
    if (String(f.id) === String(u.id)) fail(400, 'self', 'นี่คือรหัสของคุณเอง ส่งให้เพื่อนนะ');
    const n = await db.q('SELECT count(*)::int AS n FROM friendships WHERE user_id = $1', [u.id]);
    if (n.rows[0].n >= 200) fail(400, 'too_many', 'มีเพื่อนครบ 200 คนแล้ว');
    await db.q('INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING', [u.id, f.id]);
    return { friend: { id: String(f.id), name: f.name } };
  },
  'POST /api/friends/remove': async (req, res, b) => {
    const u = await needUser(req);
    await db.q('DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [u.id, Number(b.id) || 0]);
    return { ok: true };
  },
  // ดูหมู่บ้านเพื่อน (เฉพาะเพื่อน)
  'GET /api/village': async (req) => {
    const u = await needUser(req);
    const fid = Number(new URL(req.url, 'http://x').searchParams.get('id')) || 0;
    const f = await friendOf(u.id, fid);
    const sv = await db.q('SELECT data FROM saves WHERE user_id = $1', [fid]);
    const d = (sv.rows[0] && sv.rows[0].data) || null;
    const pend = await db.q("SELECT id, actor_id, kind, payload, created_at FROM village_events WHERE target_id = $1 AND NOT applied AND kind = 'prank' ORDER BY id LIMIT 50", [fid]);
    const today = await db.q(`SELECT
        count(*) FILTER (WHERE actor_id = $2 AND kind = 'help')::int AS helps,
        count(*) FILTER (WHERE actor_id = $2 AND kind IN ('prank','caught'))::int AS pranks,
        count(*) FILTER (WHERE kind IN ('prank','caught'))::int AS pranked
      FROM village_events WHERE target_id = $1 AND day = $3`, [fid, u.id, gameDay()]);
    const village = d ? {
      level: d.level || 1, era: d.era || 1, owned: d.owned, objects: d.objects || [], plots: d.plots || {}, animals: d.animals || [],
      pranksOnMe: d.pranksOnMe || [], peaceful: !!d.peaceful, shieldUntil: (d.counters && d.counters.shieldUntil) || 0, look: d.look || null,
    } : null;
    return { user: { id: String(f.id), name: f.name }, village, pending: pend.rows.map((e) => ({ ...e.payload, id: 'ev' + e.id, bot: 'u:' + e.actor_id, at: new Date(e.created_at).getTime() })), today: today.rows[0], now: Date.now() };
  },
  // ช่วย/แกล้งหมู่บ้านเพื่อน (บันทึกไว้ให้เจ้าของหมู่บ้านรับตอนเข้าเกม)
  'POST /api/village/act': async (req, res, b) => {
    const u = await needUser(req);
    rateLimit(req, 'act', 120, 3600e3);
    const fid = Number(b.id) || 0;
    await friendOf(u.id, fid);
    const kind = b.kind === 'prank' ? 'prank' : 'help';
    const what = String(b.what || '');
    const payload = b.payload && typeof b.payload === 'object' ? b.payload : {};
    if (JSON.stringify(payload).length > 2000) fail(400, 'bad_payload');
    const day = gameDay();
    const c = (await db.q(`SELECT
        count(*) FILTER (WHERE actor_id = $2 AND target_id = $1 AND kind = 'help')::int AS helps,
        count(*) FILTER (WHERE actor_id = $2 AND target_id = $1 AND kind IN ('prank','caught'))::int AS pranks,
        count(*) FILTER (WHERE actor_id = $2 AND kind IN ('prank','caught'))::int AS my_pranks,
        count(*) FILTER (WHERE target_id = $1 AND kind IN ('prank','caught'))::int AS pranked
      FROM village_events WHERE day = $3 AND (actor_id = $2 OR target_id = $1)`, [fid, u.id, day])).rows[0];
    if (kind === 'help') {
      if (!['water', 'pest', 'feed'].includes(what)) fail(400, 'bad_kind');
      if (c.helps >= RULES.HELP_PER_FRIEND) fail(429, 'help_limit', `วันนี้ช่วยเพื่อนคนนี้ครบ ${RULES.HELP_PER_FRIEND} ครั้งแล้ว`);
    } else {
      if (!RULES.PRANKS.includes(what)) fail(400, 'bad_kind');
      if (c.pranks >= RULES.PRANK_PER_FRIEND) fail(429, 'prank_limit', 'แกล้งเพื่อนคนนี้วันนี้ครบแล้ว พรุ่งนี้มาใหม่นะ');
      if (c.my_pranks >= RULES.PRANK_PER_DAY) fail(429, 'prank_day', 'วันนี้แกล้งครบโควตาแล้ว');
      if (c.pranked >= RULES.PRANKS_TO_SHIELD) fail(409, 'shielded', 'หมู่บ้านนี้โดนแกล้งครบแล้ววันนี้ มีโล่กันแกล้งอยู่');
      const sv = await db.q('SELECT data FROM saves WHERE user_id = $1', [fid]);
      const d = (sv.rows[0] && sv.rows[0].data) || {};
      if (d.peaceful) fail(409, 'peaceful', 'หมู่บ้านนี้เปิดโหมดสงบอยู่ แกล้งไม่ได้');
      if (d.counters && d.counters.shieldUntil > Date.now()) fail(409, 'shielded', 'หมู่บ้านนี้มีโล่กันแกล้งอยู่');
      // ห่านยามจับได้ 25%
      if ((d.objects || []).some((o) => o.type === 'goose') && Math.random() < RULES.GOOSE_CATCH) {
        await db.q('INSERT INTO village_events (target_id, actor_id, kind, payload, day) VALUES ($1, $2, $3, $4, $5)', [fid, u.id, 'caught', { kind: what }, day]);
        return { ok: true, caught: true };
      }
    }
    const r = await db.q('INSERT INTO village_events (target_id, actor_id, kind, payload, day) VALUES ($1, $2, $3, $4, $5) RETURNING id', [fid, u.id, kind, { ...payload, kind: kind === 'prank' ? what : undefined, what }, day]);
    return { ok: true, id: 'ev' + r.rows[0].id };
  },
  // เหตุการณ์ที่เพื่อนทำกับหมู่บ้านเรา (ยังไม่ได้รับ)
  'GET /api/events': async (req) => {
    const u = await needUser(req);
    const r = await db.q('SELECT e.id, e.actor_id, a.name, e.kind, e.payload, e.created_at FROM village_events e JOIN users a ON a.id = e.actor_id WHERE e.target_id = $1 AND NOT e.applied ORDER BY e.id LIMIT 100', [u.id]);
    return { events: r.rows.map((e) => ({ id: 'ev' + e.id, actor: { id: String(e.actor_id), name: e.name }, kind: e.kind, payload: e.payload, at: new Date(e.created_at).getTime() })) };
  },
  'POST /api/events/ack': async (req, res, b) => {
    const u = await needUser(req);
    const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 200).map((x) => Number(String(x).replace('ev', ''))).filter((x) => x > 0);
    if (ids.length) await db.q('UPDATE village_events SET applied = TRUE WHERE target_id = $1 AND id = ANY($2::bigint[])', [u.id, ids]);
    return { ok: true };
  },
};
API['POST /api/save'] = API['PUT /api/save']; // for navigator.sendBeacon / keepalive on page close

async function handleApi(req, res, urlPath) {
  const fn = API[req.method + ' ' + urlPath];
  if (!fn) return send(res, 404, { error: 'not_found' });
  try {
    if (urlPath !== '/api/config' && !db.enabled()) fail(503, 'no_db', 'ระบบบัญชียังไม่พร้อม');
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const out = await fn(req, res, body);
    if (out !== undefined && !res.headersSent) send(res, 200, out);
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpErr) return send(res, e.code, { error: e.error, message: e.msg || e.error });
    console.error('[api]', req.method, urlPath, e);
    send(res, 500, { error: 'server_error', message: 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' });
  }
}

// ---------- static files ----------
function serveStatic(req, res, urlPath) {
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  const top = path.relative(ROOT, file).split(path.sep)[0];
  if (!file.startsWith(ROOT + path.sep) || top.startsWith('.') || BLOCKED.has(top)) { res.writeHead(404); return res.end('Not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (urlPath === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (urlPath.startsWith('/api/')) return handleApi(req, res, urlPath);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, urlPath);
});

server.listen(PORT, () => console.log(`Boom Boom Village listening on ${PORT}`));
// ต่อฐานข้อมูล (ลองซ้ำถ้าฐานข้อมูลยังไม่พร้อม เช่นตอนเพิ่งเปิดเครื่อง)
(async function connectDb(attempt = 1) {
  try { await db.init(); } catch (e) {
    console.error(`[db] init failed (attempt ${attempt}):`, e.message);
    setTimeout(() => connectDb(attempt + 1), Math.min(60000, 3000 * attempt));
  }
})();
