/* Boom Boom Village — เสียงเอฟเฟกต์ + ดนตรีประกอบ (ไฟล์จริงจาก ElevenLabs) ; ถ้าโหลดเพลงไม่ได้จะใช้ดนตรีที่แต่งด้วยโค้ดแทน */
'use strict';
const AUDIO = { ctx: null, bufs: {}, sfxGain: null, musGain: null, music: null, ready: false };
// ชื่อเสียงที่เกมเรียก -> ไฟล์เสียงจริง
const SFX_MAP = {
  quest: 'quest', chest: 'chest', plant: 'plant', water: 'water', pest: 'sweep', harvest: 'harvest', eat: 'dino', build: 'build',
  coin: 'coin', clean: 'sweep', till: 'dig', ui: 'click', error: 'error_soft', levelup: 'levelup', mud: 'mud', monkey: 'monkey',
  rooster: 'rooster', goose: 'goose', boar: 'boar', boom: 'boom', amber: 'amber', dig: 'dig', dino: 'dino', sweep: 'sweep',
};
function audioInit() {
  if (AUDIO.ctx) { if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = (AUDIO.ctx = new AC());
  AUDIO.sfxGain = ctx.createGain(); AUDIO.sfxGain.gain.value = 0.55; AUDIO.sfxGain.connect(ctx.destination);
  AUDIO.musGain = ctx.createGain(); AUDIO.musGain.gain.value = 0.0; AUDIO.musGain.connect(ctx.destination);
  const snd = (window.GAME_ASSETS && window.GAME_ASSETS.sounds) || {};
  for (const [k, uri] of Object.entries(snd)) {
    const b64 = uri.split(',')[1]; const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    ctx.decodeAudioData(u8.buffer).then((buf) => { AUDIO.bufs[k] = buf; }).catch(() => {});
  }
  AUDIO.ready = true;
  bgmStart();
}

// ---------- เพลงประกอบจริง (ElevenLabs Music) ----------
// ไฟล์อยู่ที่ assets/music/<ชื่อ>.mp3 ; กลางวัน/ไปบ้านเพื่อน = day, กลางคืน = night (ค่อย ๆ เฟดข้ามกัน)
const BGM_FILES = { day: 'assets/music/day.mp3?v=1', night: 'assets/music/night.mp3?v=1' };
const BGM_VOL = { day: 0.42, night: 0.4 };
// หน้าแรก (ยังไม่มีเซฟ) ใช้ค่า titleOn ; เข้าเกมแล้วใช้ปุ่มในหน้าตั้งค่า
AUDIO.titleOn = (() => { try { return localStorage.getItem('bbv_title_music') !== '0'; } catch (e) { return true; } })();
function bgmWanted() { return (S ? S.settings.music : AUDIO.titleOn) && !document.hidden; }
// ปุ่มเปิด/ปิดเพลงที่หน้าแรก + เริ่มเพลงทันทีที่ผู้เล่นแตะหน้าจอครั้งแรก (เบราว์เซอร์ไม่ให้เล่นเสียงก่อนแตะ)
function titleSndLabel() {
  const b = document.getElementById('snd-btn'); if (!b) return;
  b.textContent = !AUDIO.ctx ? (AUDIO.titleOn ? '🔊 แตะเพื่อเปิดเพลง' : '🔇 เพลงปิดอยู่') : AUDIO.titleOn ? '🔊 เพลงเปิดอยู่' : '🔇 เพลงปิดอยู่';
}
window.addEventListener('DOMContentLoaded', () => {
  const L = document.getElementById('loading'); const b = document.getElementById('snd-btn'); if (!L || !b) return;
  titleSndLabel();
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    AUDIO.titleOn = !AUDIO.ctx ? true : !AUDIO.titleOn;
    try { localStorage.setItem('bbv_title_music', AUDIO.titleOn ? '1' : '0'); } catch (err) {}
    if (S) { S.settings.music = AUDIO.titleOn; }
    audioInit(); titleSndLabel();
  });
  L.addEventListener('pointerdown', () => { if (AUDIO.titleOn && !AUDIO.ctx) { audioInit(); titleSndLabel(); } }, true);
});
function bgmStart() {
  if (AUDIO.bgm) return;
  const c = AUDIO.ctx; const B = (AUDIO.bgm = { ok: false, tracks: {} });
  AUDIO.musGain.gain.value = 1;
  let pending = Object.keys(BGM_FILES).length; let anyOk = false;
  const done = (ok) => { if (ok) { anyOk = true; B.ok = true; } if (--pending === 0 && !anyOk) musicStart(); };
  for (const [k, url] of Object.entries(BGM_FILES)) {
    const T = (B.tracks[k] = { ok: false, el: null, gain: c.createGain() });
    T.gain.gain.value = 0; T.gain.connect(AUDIO.musGain);
    const fallbackEl = () => { // เปิดจากไฟล์ (file://) fetch ใช้ไม่ได้ -> ใช้ <audio>
      try {
        const el = new Audio(url); el.loop = true; el.volume = 0; // ไม่ต่อเข้า WebAudio เพราะ file:// จะเงียบ ; คุมเสียงด้วย el.volume
        el.addEventListener('canplaythrough', () => { if (!T.ok) { T.el = el; T.ok = true; done(true); } }, { once: true });
        el.addEventListener('error', () => { if (!T.ok) done(false); }, { once: true });
        el.load();
      } catch (e) { done(false); }
    };
    fetch(url).then((r) => { if (!r.ok) throw 0; return r.arrayBuffer(); }).then((ab) => c.decodeAudioData(ab)).then((buf) => {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(T.gain); src.start(); T.ok = true; done(true);
    }).catch(fallbackEl);
  }
  setInterval(bgmTick, 250);
}
function bgmTick() {
  const c = AUDIO.ctx; const B = AUDIO.bgm; if (!c || !B) return;
  const on = bgmWanted();
  if (B.ok) {
    const mood = musicMood(); const want = mood === 'night' && B.tracks.night.ok ? 'night' : 'day';
    for (const [k, T] of Object.entries(B.tracks)) {
      if (!T.ok) continue; const v = on && k === want ? BGM_VOL[k] : 0;
      if (T.el) { // โหมดเปิดจากไฟล์
        const ev = Math.max(0, Math.min(1, T.el.volume + (v - T.el.volume) * 0.15));
        T.el.volume = ev < 0.005 ? 0 : ev;
        if (v > 0 && T.el.paused) T.el.play().catch(() => {}); else if (v === 0 && T.el.volume === 0 && !T.el.paused) T.el.pause();
      } else T.gain.gain.setTargetAtTime(v, c.currentTime, 1.2);
    }
  }
  // เสียงฝนวนลูป ตอนฝนตกในหมู่บ้านเรา
  const t = performance.now(); if (t - rainChk < 1000) return; rainChk = t;
  const wantRain = !!(S && S.settings.sfx && !document.hidden && typeof rainNow === 'function' && rainNow() && musicMood() !== 'friend');
  ambRain(wantRain);
}
let rainChk = 0;
function ambRain(on) {
  const c = AUDIO.ctx; const buf = AUDIO.bufs.rain;
  if (on && !AUDIO.rain && buf) {
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const g = c.createGain(); g.gain.value = 0;
    s.connect(g).connect(AUDIO.sfxGain); s.start(); g.gain.setTargetAtTime(0.5, c.currentTime, 1.2); AUDIO.rain = { s, g };
  } else if (!on && AUDIO.rain) {
    const R = AUDIO.rain; AUDIO.rain = null; R.g.gain.setTargetAtTime(0, c.currentTime, 0.8); setTimeout(() => { try { R.s.stop(); } catch (e) {} }, 4000);
  }
}
const lastPlay = {};
function sfx(name, vol = 1) {
  if (!AUDIO.ctx || !S || !S.settings.sfx) return;
  const k = SFX_MAP[name] || name; const buf = AUDIO.bufs[k];
  const t = performance.now(); if (lastPlay[k] && t - lastPlay[k] < 60) return; lastPlay[k] = t;
  if (!buf) return;
  const src = AUDIO.ctx.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = name === 'ui' ? 1 : 0.94 + Math.random() * 0.12;
  const g = AUDIO.ctx.createGain(); g.gain.value = vol * (name === 'water' ? 0.6 : name === 'ui' ? 0.5 : 1);
  src.connect(g).connect(AUDIO.sfxGain); src.start();
}

// ---------- ดนตรีประกอบ (มาริมบา + กลองเผ่า สเกลเพนทาโทนิก) ----------
const SCALE = [0, 2, 4, 7, 9];
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MOODS = {
  day:    { bpm: 104, root: 60, prog: [0, 5, 3, 4], lead: 0.85, drum: true },
  night:  { bpm: 72, root: 57, prog: [0, 3, 5, 4], lead: 0.5, drum: false },
  friend: { bpm: 118, root: 62, prog: [0, 4, 5, 3], lead: 0.9, drum: true },
};
function musicMood() {
  if (typeof SCENE !== 'undefined' && SCENE && SCENE.loc && SCENE.loc !== 'home') return 'friend';
  const h = new Date().getHours(); return h >= 19 || h < 6 ? 'night' : 'day';
}
function marimba(t, hz, vol, dur = 0.5) {
  const c = AUDIO.ctx; const o = c.createOscillator(); const o2 = c.createOscillator(); const g = c.createGain();
  o.type = 'sine'; o.frequency.value = hz; o2.type = 'sine'; o2.frequency.value = hz * 4.01;
  const g2 = c.createGain(); g2.gain.value = 0.08;
  o.connect(g); o2.connect(g2).connect(g); g.connect(AUDIO.musGain);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function drum(t, low, vol) {
  const c = AUDIO.ctx; const o = c.createOscillator(); const g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(low ? 110 : 220, t); o.frequency.exponentialRampToValueAtTime(low ? 45 : 120, t + 0.18);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g).connect(AUDIO.musGain); o.start(t); o.stop(t + 0.3);
}
function shaker(t, vol) {
  const c = AUDIO.ctx; const len = 0.05; const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
  const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(AUDIO.musGain); s.start(t);
}
function musicStart() {
  if (!AUDIO.ctx || AUDIO.music) return;
  const M = (AUDIO.music = { step: 0, next: AUDIO.ctx.currentTime + 0.2, mood: musicMood(), melody: [] });
  const genMelody = () => { M.melody = []; let n = 2; for (let i = 0; i < 32; i++) { n = Math.max(0, Math.min(9, n + Math.floor(Math.random() * 5) - 2)); M.melody.push(Math.random() < 0.62 ? n : null); } };
  genMelody();
  setInterval(() => {
    const c = AUDIO.ctx; if (!c) return;
    const on = S && S.settings.music && !document.hidden;
    if (AUDIO.bgm && AUDIO.bgm.ok) { AUDIO.musGain.gain.value = 1; return; } // มีเพลงจริงแล้ว ไม่ต้องเล่นดนตรีโค้ด
    AUDIO.musGain.gain.setTargetAtTime(on ? 0.16 : 0, c.currentTime, 0.4);
    if (!on) { M.next = c.currentTime + 0.1; return; }
    const md = MOODS[M.mood]; const sp = 60 / md.bpm / 2; // 8th notes
    while (M.next < c.currentTime + 0.25) {
      const st = M.step % 32; const bar = Math.floor(M.step / 8) % 4; const chord = md.prog[bar];
      const deg = (i) => { const idx = chord + i; return md.root + SCALE[((idx % 5) + 5) % 5] + 12 * Math.floor(idx / 5); };
      if (st % 8 === 0) { marimba(M.next, midiHz(deg(0) - 24), 0.35, 1.2); marimba(M.next, midiHz(deg(2) - 12), 0.12, 1); }
      if (st % 8 === 4) marimba(M.next, midiHz(deg(1) - 12), 0.15, 0.8);
      const mn = M.melody[st]; if (mn != null && Math.random() < md.lead) marimba(M.next, midiHz(deg(mn)), 0.16, 0.45);
      if (md.drum) { if (st % 4 === 0) drum(M.next, true, 0.35); if (st % 8 === 6) drum(M.next, false, 0.18); if (st % 2 === 1) shaker(M.next, 0.05); }
      else if (st % 8 === 0) drum(M.next, true, 0.12);
      M.next += sp; M.step++;
      if (M.step % 64 === 0) { M.mood = musicMood(); genMelody(); }
    }
  }, 100);
}
function musicSetMood() { if (AUDIO.music) { const m = musicMood(); if (m !== AUDIO.music.mood) { AUDIO.music.mood = m; AUDIO.music.step = 0; } } }
