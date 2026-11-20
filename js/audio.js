/* Boom Boom Village — เสียงเอฟเฟกต์ (ไฟล์จริงจาก ElevenLabs) + ดนตรีประกอบที่แต่งด้วยโค้ด */
'use strict';
const AUDIO = { ctx: null, bufs: {}, sfxGain: null, musGain: null, music: null, ready: false };
// ชื่อเสียงที่เกมเรียก -> ไฟล์เสียงจริง
const SFX_MAP = {
  quest: 'amber', chest: 'chest', plant: 'plant', water: 'water', pest: 'sweep', harvest: 'harvest', eat: 'dino', build: 'build',
  coin: 'coin', clean: 'sweep', till: 'dig', ui: 'click', error: 'error', levelup: 'levelup', mud: 'mud', monkey: 'monkey',
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
  musicStart();
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
