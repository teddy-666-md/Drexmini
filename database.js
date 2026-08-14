const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let dbReady = false;

async function initDatabase() {
  // Settings are now scoped per phone number
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

  dbReady = true;
  console.log('[DB] Postgres tables ready');
}

// phone = bot's WhatsApp number e.g. "254788460896"
async function setSetting(phone, key, value) {
  const val = JSON.stringify(value);
  await pool.query(`
    INSERT INTO settings (phone, key, value) VALUES ($1, $2, $3)
    ON CONFLICT(phone, key) DO UPDATE SET value = $3
  `, [phone, key, val]);
}

async function getSetting(phone, key, defaultValue = null) {
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
  if (!dbReady) return 0;
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
