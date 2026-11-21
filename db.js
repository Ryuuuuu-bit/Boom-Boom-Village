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
  `);
  await p.query('DELETE FROM sessions WHERE expires_at < now()');
  pool = p;
  console.log('[db] ready');
  return true;
}

const q = (text, params) => pool.query(text, params);
module.exports = { init, enabled, q };
