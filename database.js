const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

let db;

function initDatabase() {
  const dbFolder = path.join(__dirname, "database");
  if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder);

  const dbPath = path.join(dbFolder, "trashbot.db");
  db = new Database(dbPath);

  // Settings are now scoped per phone number
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      phone TEXT NOT NULL,
      key   TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (phone, key)
    )
  `).run();

  // Migrate old global settings table if it exists (one-time)
  try {
    const oldRows = db.prepare("SELECT key, value FROM settings WHERE phone IS NULL OR phone = ''").all();
    if (oldRows.length > 0) {
      // Old table has no phone column — skip, will be recreated
    }
  } catch(e) {}

  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id       TEXT PRIMARY KEY,
      phone    TEXT,
      chatId   TEXT,
      senderId TEXT,
      body     TEXT,
      timestamp INTEGER
    )
  `).run();

  return db;
}

// phone = bot's WhatsApp number e.g. "254788460896"
function setSetting(phone, key, value) {
  db.prepare(`
    INSERT INTO settings (phone, key, value) VALUES (?, ?, ?)
    ON CONFLICT(phone, key) DO UPDATE SET value=excluded.value
  `).run(phone, key, JSON.stringify(value));
}

function getSetting(phone, key, defaultValue = null) {
  const row = db.prepare("SELECT value FROM settings WHERE phone=? AND key=?").get(phone, key);
  return row ? JSON.parse(row.value) : defaultValue;
}

function cleanupOldMessages(hours = 24) {
  if (!db) return 0;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return db.prepare("DELETE FROM messages WHERE timestamp < ?").run(cutoff).changes || 0;
}

module.exports = {
  initDatabase,
  setSetting,
  getSetting,
  cleanupOldMessages,
  db
};
