/* Boom Boom Village — ระบบบัญชีผู้เล่น: เล่นเลย (Guest) / อีเมล / Facebook + เซฟเกมบนเซิร์ฟเวอร์ */
'use strict';
const AUTH = {
  online: false, token: null, user: null, rev: 0, fbAppId: null,
  blocked: false, inflight: false, pending: false, timer: null,
};
const TOKEN_KEY = 'bbv_token';
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };

// รหัสเบราว์เซอร์นี้ (ใช้แยกว่าเซฟที่ทับมาเป็นของเราเองจากการรีเฟรช หรือมาจากเครื่องอื่น)
const DEVICE = LS.get('bbv_device') || (() => { const d = Math.random().toString(36).slice(2) + Date.now().toString(36); LS.set('bbv_device', d); return d; })();
// เปิดหลายแท็บในเบราว์เซอร์เดียวกัน: แท็บใหม่ล่าสุดได้เล่น แท็บเก่าหยุด
const BC = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bbv') : null;
if (BC) BC.onmessage = (ev) => { const m = ev.data || {}; if (m.t === 'hello' && AUTH.online && AUTH.user && m.uid === AUTH.user.id && !AUTH.blocked) { save(); AUTH.blocked = true; authStopped('เปิดเกมในอีกแท็บแล้ว', 'เล่นในแท็บนี้แทน'); } };

async function api(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH.token) headers.Authorization = 'Bearer ' + AUTH.token;
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), opts.timeout || 15000);
  try {
    const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, keepalive: !!opts.keepalive, signal: ctl.signal });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error(j.message || 'เชื่อมต่อไม่สำเร็จ'); e.status = r.status; e.body = j; throw e; }
    return j;
  } finally { clearTimeout(to); }
}

// ---------- เริ่มต้น: คืนค่า Promise ที่จบเมื่อได้ S แล้ว ----------
function authBoot() {
  return new Promise(async (resolve) => {
    AUTH._resolve = resolve;
    if (location.protocol === 'file:') return authOffline();
    let cfg = null;
    try { cfg = await api('GET', '/api/config', null, { timeout: 6000 }); } catch (e) {}
    if (!cfg || !cfg.accounts) return authOffline();
    AUTH.fbAppId = cfg.facebookAppId;
    AUTH.token = LS.get(TOKEN_KEY);
    if (AUTH.token) {
      try { const r = await api('GET', '/api/me'); return authEnter(r.user, true); } catch (e) {
        if (e.status !== 401 && e.status !== 403) return authOffline('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ เล่นแบบออฟไลน์ไปก่อน');
        AUTH.token = null; LS.del(TOKEN_KEY);
      }
    }
    authShowForm();
  });
}

function authOffline(msg) {
  AUTH.online = false; SAVE_KEY = LEGACY_SAVE_KEY;
  S = load() || newSave();
  $('au-who').innerHTML = msg || '💾 โหมดออฟไลน์: เซฟไว้ในเบราว์เซอร์นี้';
  $('au-who').classList.remove('hidden');
  AUTH._resolve();
}

async function authEnter(user, returning) {
  AUTH.user = user; AUTH.online = true;
  SAVE_KEY = LEGACY_SAVE_KEY + '_u' + user.id;
  const revKey = 'bbv_rev_u' + user.id;
  authBusy('กำลังโหลดหมู่บ้าน…');
  let srv;
  try { srv = await api('GET', '/api/save'); } catch (e) { authBusy(null); return authError(e.message || 'โหลดเซฟไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  const local = load(); const localRev = +LS.get(revKey) || 0;
  let push = false;
  if (srv.data && srv.data.v === 2) {
    // เซฟในเครื่องใหม่กว่าและยังไม่ได้ส่งขึ้น (เน็ตหลุด) ใช้ของในเครื่อง
    if (local && localRev === srv.rev && (local.lastSeen || 0) > (srv.data.lastSeen || 0)) { S = local; push = true; } else S = srv.data;
    AUTH.rev = srv.rev;
  } else {
    AUTH.rev = 0; push = true;
    const legacy = LS.get(LEGACY_SAVE_KEY);
    if (local) S = local;
    else if (legacy && !LS.get('bbv_legacy_owner')) {
      try { const s = JSON.parse(legacy); if (s && s.v === 2) { S = s; LS.set('bbv_legacy_owner', user.id); AUTH.migrated = true; } } catch (e) {}
    }
    if (!S) S = newSave();
  }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  if (BC) BC.postMessage({ t: 'hello', uid: user.id });
  if (push) await authPush();
  authBusy(null);
  $('auth').classList.add('hidden'); $('loading').classList.remove('authing');
  $('au-who').innerHTML = `👤 ${esc(user.name)}${user.guest ? ' · ผู้เล่นทั่วไป' : ''} · <a href="#" id="au-switch">เปลี่ยนบัญชี</a>`;
  $('au-who').classList.remove('hidden');
  $('au-switch').onclick = (ev) => { ev.preventDefault(); authLogout(); };
  AUTH._resolve();
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- ซิงก์เซฟขึ้นเซิร์ฟเวอร์ ----------
AUTH.queueSync = () => {
  if (!AUTH.online || AUTH.blocked || AUTH.timer) return;
  AUTH.timer = setTimeout(() => { AUTH.timer = null; authPush(); }, 8000);
};
async function authPush(keepalive, retried) {
  if (!AUTH.online || AUTH.blocked || !S) return;
  if (AUTH.inflight) { AUTH.pending = true; return; }
  AUTH.inflight = true;
  let retry = false;
  try {
    S._dev = DEVICE;
    const r = await api('PUT', '/api/save', { data: S, rev: AUTH.rev }, { keepalive: keepalive && JSON.stringify(S).length < 60000 });
    AUTH.rev = r.rev; LS.set('bbv_rev_u' + AUTH.user.id, String(r.rev)); AUTH.failCount = 0;
  } catch (e) {
    // ชนกับเซฟของเบราว์เซอร์เดียวกัน (เช่นตอนรีเฟรช) ใช้ต่อได้ ถ้ามาจากเครื่องอื่นให้หยุด
    let own = false;
    if (e.status === 409 && !retried) { try { const srv = await api('GET', '/api/save'); if (srv.data && srv.data._dev === DEVICE) { AUTH.rev = srv.rev; own = true; } } catch (e2) {} }
    if (own) retry = true;
    else if (e.status === 409) { AUTH.blocked = true; authStopped('เกมนี้ถูกเปิดเล่นจากอีกแท็บหรืออีกเครื่อง', 'โหลดหมู่บ้านล่าสุด'); }
    else if (e.status === 401 || e.status === 403) { AUTH.blocked = true; authStopped(e.message || 'กรุณาเข้าสู่ระบบใหม่', 'เข้าสู่ระบบใหม่'); }
    else { AUTH.failCount = (AUTH.failCount || 0) + 1; if (AUTH.failCount === 3) toast('📶 เน็ตหลุด เกมเซฟไว้ในเครื่องก่อน จะส่งขึ้นเซิร์ฟเวอร์เมื่อเน็ตกลับมา', 'bad'); setTimeout(() => AUTH.queueSync(), 15000); }
  } finally {
    AUTH.inflight = false;
    if (retry) return authPush(keepalive, true);
    if (AUTH.pending) { AUTH.pending = false; AUTH.queueSync(); }
  }
}
function authStopped(msg, btn) {
  if ($('au-stop')) return;
  const d = document.createElement('div'); d.id = 'au-stop';
  d.innerHTML = `<div class="au-card"><h3>⏸️ หยุดเกมไว้ก่อน</h3><p>${esc(msg)}<br>เพื่อไม่ให้เซฟทับกัน</p><button class="btn gold">${btn}</button></div>`;
  d.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(d);
}
window.addEventListener('pagehide', () => { if (AUTH.online && S) { if (typeof save === 'function') { S.lastSeen = now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} } authPush(true); } });

async function authLogout() {
  if (AUTH.online && S && !AUTH.blocked) { save(); clearTimeout(AUTH.timer); AUTH.timer = null; await authPush(); }
  try { await api('POST', '/api/auth/logout'); } catch (e) {}
  LS.del(TOKEN_KEY); location.reload();
}
async function authResetSave() {
  AUTH.blocked = true;
  if (AUTH.online) { try { await api('DELETE', '/api/save'); } catch (e) { toast(e.message, 'bad'); AUTH.blocked = false; return; } LS.del('bbv_rev_u' + AUTH.user.id); }
  LS.del(SAVE_KEY); location.reload();
}

// ---------- หน้าเข้าสู่ระบบ ----------
let auMode = 'login';
function authShowForm() {
  $('auth').classList.remove('hidden'); $('loading').classList.add('authing');
  $('au-fb').classList.toggle('hidden', !AUTH.fbAppId);
  if (AUTH.fbAppId) fbSdk().catch(() => {});
}
function authBusy(msg) {
  $('au-busy').textContent = msg || ''; $('au-busy').classList.toggle('hidden', !msg);
  document.querySelectorAll('#auth button').forEach((b) => (b.disabled = !!msg));
}
function authError(msg) { $('au-err').textContent = msg; $('au-err').classList.remove('hidden'); $('auth').classList.remove('hidden'); }
async function authCall(path, body) {
  $('au-err').classList.add('hidden'); authBusy('กำลังเข้าสู่ระบบ…');
  try {
    const r = await api('POST', path, body);
    AUTH.token = r.token; LS.set(TOKEN_KEY, r.token);
    await authEnter(r.user);
  } catch (e) { authBusy(null); authError(e.message || 'เชื่อมต่อไม่สำเร็จ'); }
}
function authSetMode(m) {
  auMode = m;
  $('au-tab-login').classList.toggle('on', m === 'login'); $('au-tab-reg').classList.toggle('on', m === 'register');
  $('au-name-row').classList.toggle('hidden', m !== 'register');
  $('au-submit').textContent = m === 'login' ? 'เข้าสู่ระบบ' : 'สมัครและเริ่มเล่น';
  $('au-pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('au-err').classList.add('hidden');
}
function bindAuthUI() {
  $('au-guest').onclick = () => authCall('/api/auth/guest', {});
  $('au-email').onclick = () => { $('au-main').classList.add('hidden'); $('au-form').classList.remove('hidden'); authSetMode('login'); $('au-mail').focus(); };
  $('au-back').onclick = (e) => { e.preventDefault(); $('au-form').classList.add('hidden'); $('au-main').classList.remove('hidden'); $('au-err').classList.add('hidden'); };
  $('au-tab-login').onclick = (e) => { e.preventDefault(); authSetMode('login'); };
  $('au-tab-reg').onclick = (e) => { e.preventDefault(); authSetMode('register'); };
  $('au-form').onsubmit = (e) => {
    e.preventDefault();
    const body = { email: $('au-mail').value, password: $('au-pass').value };
    if (auMode === 'register') body.name = $('au-name').value;
    authCall(auMode === 'login' ? '/api/auth/login' : '/api/auth/register', body);
  };
  $('au-fb').onclick = () => fbLogin((tok) => authCall('/api/auth/facebook', { accessToken: tok }));
}

// ---------- Facebook ----------
let fbReady = null;
function fbSdk() {
  if (fbReady) return fbReady;
  fbReady = new Promise((res, rej) => {
    window.fbAsyncInit = () => { FB.init({ appId: AUTH.fbAppId, cookie: false, xfbml: false, version: 'v21.0' }); res(window.FB); };
    const s = document.createElement('script'); s.src = 'https://connect.facebook.net/th_TH/sdk.js'; s.async = true; s.crossOrigin = 'anonymous';
    s.onerror = () => { fbReady = null; rej(new Error('fb')); }; document.head.appendChild(s);
  });
  return fbReady;
}
function fbLogin(done) {
  if (!window.FB) { authError('กำลังโหลด Facebook… ลองกดอีกครั้งในอีกสักครู่'); fbSdk().catch(() => authError('โหลด Facebook ไม่ได้ (อาจถูกตัวบล็อกโฆษณาปิดไว้)')); return; }
  FB.login((r) => { if (r && r.authResponse) done(r.authResponse.accessToken); else authError('ยกเลิกการเข้าสู่ระบบด้วย Facebook'); }, { scope: 'public_profile' });
}

// ---------- แผงบัญชีในเกม ----------
function accountRows() {
  if (!AUTH.online) return `<div class="row"><div class="grow">👤 บัญชี<div class="muted">โหมดออฟไลน์ เซฟอยู่ในเบราว์เซอร์นี้เท่านั้น</div></div></div>`;
  const u = AUTH.user;
  const kind = u.guest ? 'ผู้เล่นทั่วไป (ยังไม่ผูกบัญชี)' : [u.email ? 'อีเมล ' + esc(u.email) : '', u.facebook ? 'Facebook' : ''].filter(Boolean).join(' + ');
  return `<div class="row"><div class="grow">👤 ${esc(u.name)}<div class="muted">${kind} · เซฟบนเซิร์ฟเวอร์ เล่นต่อเครื่องไหนก็ได้</div></div><button class="btn sm ${u.guest ? 'gold' : ''}" data-a="account">${u.guest ? 'ผูกบัญชี' : 'บัญชี'}</button></div>`;
}
PANELS.account = (arg, P) => {
  const u = AUTH.user;
  let html = `<div class="section">ชื่อหัวหน้าเผ่า</div><div class="row"><input id="ac-name" class="au-in grow" maxlength="24" value="${esc(u.name)}"><button class="btn sm" data-a="rename">บันทึกชื่อ</button></div>`;
  if (u.guest) html += `<div class="section">ผูกบัญชี (กันเซฟหาย)</div><p class="muted">ตอนนี้เป็นผู้เล่นทั่วไป ถ้าล้างเบราว์เซอร์หรือเปลี่ยนเครื่องจะเข้าหมู่บ้านนี้ไม่ได้ ผูกอีเมลไว้ก่อนนะ</p>`;
  if (!u.email) html += `<div class="au-stack"><input id="ac-mail" class="au-in" type="email" placeholder="อีเมล" autocomplete="email"><input id="ac-pass" class="au-in" type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)" autocomplete="new-password"><button class="btn green" data-a="link">ผูกอีเมลกับหมู่บ้านนี้</button></div>`;
  if (!u.facebook && AUTH.fbAppId) html += `<div class="au-stack"><button class="btn blue" data-a="fb">ผูก Facebook</button></div>`;
  html += `<div class="row" style="margin-top:14px"><div class="grow muted">${u.guest ? 'ถ้าออกตอนยังไม่ผูกบัญชี จะกลับเข้าหมู่บ้านนี้ไม่ได้อีก' : 'ออกจากระบบในเครื่องนี้'}</div><button class="btn red sm" data-a="logout">ออกจากระบบ</button></div>`;
  if (AUTH.fbAppId && !u.facebook) fbSdk().catch(() => {});
  const linked = (r) => { AUTH.user = r.user; toast('✅ ผูกบัญชีเรียบร้อย เซฟปลอดภัยแล้ว', 'good'); renderPanel(); hud(); };
  return { title: '👤 บัญชีของฉัน', narrow: true, html, acts: {
    rename: async () => { try { const r = await api('POST', '/api/me', { name: $('ac-name').value }); AUTH.user = r.user; toast('บันทึกชื่อแล้ว', 'good'); hud(); } catch (e) { toast(e.message, 'bad'); } },
    link: async () => { try { linked(await api('POST', '/api/auth/register', { email: $('ac-mail').value, password: $('ac-pass').value })); } catch (e) { toast(e.message, 'bad'); } },
    fb: () => fbLogin(async (tok) => { try { const r = await api('POST', '/api/auth/facebook', { accessToken: tok }); if (r.linked) linked(r); else { toast('Facebook นี้มีหมู่บ้านอื่นอยู่แล้ว กำลังสลับไป…'); LS.set(TOKEN_KEY, r.token); location.reload(); } } catch (e) { toast(e.message, 'bad'); } }),
    logout: () => { if (u.guest && !P.confirmOut) { P.confirmOut = true; toast('ยังไม่ได้ผูกบัญชี! กด "ออกจากระบบ" อีกครั้งถ้าแน่ใจ', 'bad'); return; } authLogout(); },
  } };
};
