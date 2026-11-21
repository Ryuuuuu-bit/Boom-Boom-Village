// Boom Boom Village — ฐานข้อมูล PostgreSQL (บัญชีผู้เล่น, session, เซฟเกม)
'use strict';
const { Pool } = require('pg');

let pool = null;
const enabled = () => !!pool;

async function init() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.warn('[db] DATABASE_URL not set: accounts/cloud save are disabled'); return false; }
  const local = /@(localhost|127\.0\.0\.1|[^/]*\.railway\.internal)[:/]/.test(url) || /sslmode=disable/.test(url);
  const p = new Pool({ connectionString: url, max: 10, ssl: local ? false : { rejectUnauthorized: false } });
  p.on('error', (e) => console.error('[db] pool error', e.message));
  // ตารางทั้งหมด (สร้างครั้งแรกอัตโนมัติ)
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      pass_hash TEXT,
      fb_id TEXT UNIQUE,
      banned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_login TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS saves (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      rev INTEGER NOT NULL DEFAULT 1,
      level INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE;
    CREATE TABLE IF NOT EXISTS friendships (
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, friend_id)
    );
    -- สิ่งที่เพื่อนทำกับหมู่บ้านเรา (ช่วย/แกล้ง) รอให้เกมของเจ้าของหมู่บ้านดึงไปใช้
    CREATE TABLE IF NOT EXISTS village_events (
      id BIGSERIAL PRIMARY KEY,
      target_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      day TEXT NOT NULL,
      applied BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ve_target ON village_events(target_id, applied);
    CREATE INDEX IF NOT EXISTS ve_actor_day ON village_events(actor_id, day);
    -- กันโกง: ถังโควตาของแต่ละเซฟ + บันทึกเซฟที่ถูกตัดตัวเลข
    ALTER TABLE saves ADD COLUMN IF NOT EXISTS guard JSONB;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tester BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS cheat_log (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notes TEXT NOT NULL,
      fixed JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS cheat_log_user ON cheat_log(user_id);
  `);
  await p.query('DELETE FROM sessions WHERE expires_at < now()');
  await p.query("DELETE FROM village_events WHERE applied AND created_at < now() - interval '14 days'");
  pool = p;
  console.log('[db] ready');
  cleanup().catch((e) => console.error('[db] cleanup', e.message));
  setInterval(() => cleanup().catch((e) => console.error('[db] cleanup', e.message)), 24 * 3600e3).unref();
  return true;
}

// ลบบัญชี Guest ที่ทิ้งไว้ (ไม่ผูกอีเมล/Facebook และไม่ใช่ผู้ทดสอบ)
//  - ไม่เคยเริ่มเล่นเลย (ไม่มีเซฟ) และไม่ได้เข้าเกิน 7 วัน
//  - เลเวลต่ำกว่า 5 และไม่ได้เข้าเกิน 60 วัน
// บัญชีที่เลเวล 5 ขึ้นไปเก็บไว้เสมอ เพื่อนที่เคยเพิ่มไว้จะหายไปพร้อมบัญชีที่ถูกลบ
async function cleanup() {
  const r = await pool.query(`DELETE FROM users u WHERE u.email IS NULL AND u.fb_id IS NULL AND NOT u.tester AND (
      (NOT EXISTS (SELECT 1 FROM saves s WHERE s.user_id = u.id) AND u.last_login < now() - interval '7 days')
      OR EXISTS (SELECT 1 FROM saves s WHERE s.user_id = u.id AND COALESCE(s.level, 1) < 5 AND GREATEST(s.updated_at, u.last_login) < now() - interval '60 days'))`);
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  await pool.query("DELETE FROM cheat_log WHERE created_at < now() - interval '90 days'");
  if (r.rowCount) console.log(`[db] cleanup: removed ${r.rowCount} abandoned guest accounts`);
  return r.rowCount;
}

const q = (text, params) => pool.query(text, params);
module.exports = { init, enabled, q, cleanup };
