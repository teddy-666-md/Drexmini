const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.warn('[DB] DATABASE_URL not set. DB functions will fail until you set it.');
}

async function initDatabase() {
  if (!pool) throw new Error("DATABASE_URL not set");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      phone TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (phone, key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      phone TEXT,
      chatId TEXT,
      senderId TEXT,
      body TEXT,
      timestamp BIGINT
    )
  `);

  console.log('[DB] Postgres tables ready');
}

async function setSetting(phone, key, value) {
  if (!pool) throw new Error("DATABASE_URL not set");
  const val = JSON.stringify(value);
  await pool.query(`
    INSERT INTO settings (phone, key, value) VALUES ($1, $2, $3)
    ON CONFLICT(phone, key) DO UPDATE SET value = $3
  `, [phone, key, val]);
}

async function getSetting(phone, key, defaultValue = null) {
  if (!pool) return defaultValue;
  const res = await pool.query(
    "SELECT value FROM settings WHERE phone = $1 AND key = $2",
    [phone, key]
  );
  if (!res.rows[0]) return defaultValue;
  try {
    return JSON.parse(res.rows[0].value);
  } catch {
    return res.rows[0].value;
  }
}

async function cleanupOldMessages(hours = 24) {
  if (!pool) return 0;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const res = await pool.query("DELETE FROM messages WHERE timestamp < $1", [cutoff]);
  return res.rowCount || 0;
}

module.exports = {
  initDatabase,
  setSetting,
  getSetting,
  cleanupOldMessages,
  pool
};
