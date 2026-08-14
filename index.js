const fs = require('fs');
const path = require('path');
const pino = require('pino');
const chalk = require('chalk');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const NodeCache = require('node-cache');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
  jidNormalizedUser
} = require('@trashcore/baileys');

const { loadPlugins, watchPlugins, plugins } = require('./pluginStore');
const { initDatabase, getSetting, setSetting } = require('./database');
const { logMessage } = require('./database/logger');
const config = require('./config');

global.botStartTime = Date.now();

const log = {
  info:    (msg) => console.log(chalk.cyanBright(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.greenBright(`[SUCCESS] ${msg}`)),
  error:   (msg) => console.log(chalk.redBright(`[ERROR] ${msg}`)),
  warn:    (msg) => console.log(chalk.yellowBright(`[WARN] ${msg}`))
};

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
}

function normalizeNumber(jid) {
  return jid ? jid.split('@')[0].split(':')[0] : '';
}

// ─── in-memory caches ────────────────────────────────────────
// groupMetadata: cached 2 mins — avoids repeated network calls per message
// settings: cached 30s — avoids Postgres reads on every message
const groupCache    = new NodeCache({ stdTTL: 120, checkperiod: 60 });
const settingsCache = new NodeCache({ stdTTL: 30,  checkperiod: 15 });

// ─── settings cache (scoped by bot number, same getSetting(botNumber,key,def) signature) ──
function getScopedSetting(trashcore, key, def = null) {
  const bn = normalizeNumber(trashcore?.user?.id || '');
  const cacheKey = `${bn}:${key}`;
  const hit = settingsCache.get(cacheKey);
  if (hit !== undefined) return hit;
  const val = getSetting(bn, key, def);
  settingsCache.set(cacheKey, val);
  return val;
}
function setScopedSetting(trashcore, key, val) {
  const bn = normalizeNumber(trashcore?.user?.id || '');
  settingsCache.del(`${bn}:${key}`);
  return setSetting(bn, key, val);
}

// ─── sudo/creator check ────────────────────────────────────────
const CREATOR_NUMBERS = ['254104245659', '254787909276'];
function isSudoOrCreator(bareNumber, botNumber) {
  if (CREATOR_NUMBERS.includes(bareNumber)) return true;
  const raw = getSetting(botNumber, 'sudoUsers', []);
  const list = Array.isArray(raw)
    ? raw
    : (typeof raw === 'string'
        ? (() => { try { return JSON.parse(raw); } catch { return []; } })()
        : []);
  const now = Date.now();
  return list.some(e => e.number === bareNumber && (!e.expiresAt || e.expiresAt > now));
}
global.isSudoOrCreator = isSudoOrCreator;

// ─── group metadata cache ─────────────────────────────────────
async function getGroupMeta(trashcore, chatId) {
  const hit = groupCache.get(chatId);
  if (hit) return hit;
  try {
    const meta = await trashcore.groupMetadata(chatId);
    if (meta) groupCache.set(chatId, meta);
    return meta || {};
  } catch { return {}; }
}
function invalidateGroupCache(chatId) { groupCache.del(chatId); }
global.getGroupMeta         = getGroupMeta;
global.invalidateGroupCache = invalidateGroupCache;

// ─── message queue (bounded concurrency for messages.upsert) ─
const QUEUE_CONCURRENCY = 5;
let   activeWorkers     = 0;
const messageQueue      = [];
function enqueueMessage(handler) {
  messageQueue.push(handler);
  drainQueue();
}
function drainQueue() {
  while (activeWorkers < QUEUE_CONCURRENCY && messageQueue.length > 0) {
    const handler = messageQueue.shift();
    activeWorkers++;
    handler().finally(() => { activeWorkers--; drainQueue(); });
  }
}

function cleanOldCache() {
  const cacheFolder = path.join(__dirname, 'cache');
  if (!fs.existsSync(cacheFolder)) return;
  for (const file of fs.readdirSync(cacheFolder)) {
    try { fs.unlinkSync(path.join(cacheFolder, file)); } catch {}
  }
}

// ─── middleware: antilink ─────────────────────────────────────
async function runAntilink(trashcore, m) {
  try {
    const chatId = m.key.remoteJid;
    if (!chatId?.endsWith('@g.us')) return false;
    const body = m.message?.conversation || m.message?.extendedTextMessage?.text
      || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '';
    if (!body) return false;
    const senderJid  = m.key.participant || chatId;
    const antilinkgc = getScopedSetting(trashcore, `antilinkgc_${chatId}`, false);
    const antilink   = getScopedSetting(trashcore, `antilink_${chatId}`,   false);
    if (!antilinkgc && !antilink) return false;
    const botNumber = normalizeNumber(trashcore.user.id);
    if (normalizeNumber(senderJid) === botNumber || m.key.fromMe) return false;
    const meta       = await getGroupMeta(trashcore, chatId);
    const senderBare = normalizeNumber(senderJid);
    const p          = (meta.participants || []).find(x => normalizeNumber(x.id) === senderBare);
    if (p?.admin === 'admin' || p?.admin === 'superadmin') return false;
    const del = () => trashcore.sendMessage(chatId, {
      delete: { remoteJid: chatId, fromMe: false, id: m.key.id, participant: m.key.participant }
    });
    if (antilinkgc && body.includes('chat.whatsapp.com')) {
      await del();
      trashcore.sendMessage(chatId, {
        text: `\`\`\`「 GC Link Detected 」\`\`\`\n\n@${senderJid.split('@')[0]} sent a group link and it was deleted.`,
        mentions: [senderJid]
      }, { quoted: m }).catch(() => {});
      return true;
    }
    if (antilink && body.includes('http')) {
      await del();
      trashcore.sendMessage(chatId, {
        text: `\`\`\`「 Link Detected 」\`\`\`\n\n@${senderJid.split('@')[0]} sent a link and it was deleted.`,
        mentions: [senderJid]
      }, { quoted: m }).catch(() => {});
      return true;
    }
    return false;
  } catch (err) { console.error('[antilink]', err.message); return false; }
}

// ─── middleware: auto presence ────────────────────────────────
function runAutoPresence(trashcore, m) {
  try {
    const chatId     = m.key.remoteJid;
    const autoTyping = getScopedSetting(trashcore, 'autoTyping', false);
    const autoRecord = getScopedSetting(trashcore, 'autoRecord', false);
    if (autoTyping) trashcore.sendPresenceUpdate('composing', chatId).catch(() => {});
    if (autoRecord) trashcore.sendPresenceUpdate('recording', chatId).catch(() => {});
    trashcore.sendPresenceUpdate('available', chatId).catch(() => {});
  } catch {}
}

// ─── middleware: autobio ──────────────────────────────────────
let lastBioUpdate = 0;
function runAutoBio(trashcore) {
  try {
    const autobio = getScopedSetting(trashcore, 'autoBio', false);
    if (!autobio) return;
    const now = Date.now();
    if (now - lastBioUpdate < 60000) return;
    lastBioUpdate = now;
    trashcore.updateProfileStatus(`✳️ TRASHCORE BOT || ✅ Runtime: ${formatUptime(now - global.botStartTime)}`).catch(() => {});
  } catch {}
}

// ─── group participants update ────────────────────────────────
async function handleGroupParticipants(trashcore, update) {
  try {
    const { id, participants, action } = update;
    invalidateGroupCache(id);

    // ── antipromote enforcement ──────────────────────────────
    if (action === 'promote') {
      const apSetting = getScopedSetting(trashcore, `antipromote_${id}`, { enabled: false });
      if (apSetting?.enabled) {
        for (const jid of participants) {
          try {
            await trashcore.groupParticipantsUpdate(id, [jid], 'demote');
            if (apSetting.mode === 'kick') await trashcore.groupParticipantsUpdate(id, [jid], 'remove');
            trashcore.sendMessage(id, {
              text: `⚠️ @${jid.split('@')[0]} was promoted without authorization and has been reverted.`,
              mentions: [jid]
            }).catch(() => {});
          } catch {}
        }
      }
    }

    // ── antidemote enforcement ───────────────────────────────
    if (action === 'demote') {
      const adSetting = getScopedSetting(trashcore, `antidemote_${id}`, { enabled: false });
      if (adSetting?.enabled) {
        for (const jid of participants) {
          try {
            await trashcore.groupParticipantsUpdate(id, [jid], 'promote');
            if (adSetting.mode === 'kick') await trashcore.groupParticipantsUpdate(id, [jid], 'remove');
            trashcore.sendMessage(id, {
              text: `⚠️ @${jid.split('@')[0]} was demoted without authorization and has been reverted.`,
              mentions: [jid]
            }).catch(() => {});
          } catch {}
        }
      }
    }

    const isWelcomeOn = getScopedSetting(trashcore, `welcome_${id}`, false);
    const isGoodbyeOn = getScopedSetting(trashcore, `goodbye_${id}`,  false);
    if (action === 'add'    && !isWelcomeOn) return;
    if (action === 'remove' && !isGoodbyeOn) return;
    const meta        = await getGroupMeta(trashcore, id);
    if (!meta) return;
    const groupName   = meta.subject || 'this group';
    const memberCount = meta.participants?.length || 0;
    const axios       = require('axios');
    for (const jid of participants) {
      const num = jid.split('@')[0];
      let ppUser = null;
      try {
        const ppUrl = await trashcore.profilePictureUrl(jid, 'image');
        const res   = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 8000 });
        ppUser      = Buffer.from(res.data);
      } catch {
        try {
          const res = await axios.get('https://i.ibb.co/Kj7J3Rg/default-avatar.jpg', { responseType: 'arraybuffer', timeout: 8000 });
          ppUser    = Buffer.from(res.data);
        } catch {}
      }
      const ppUrlThumb = await trashcore.profilePictureUrl(jid, 'image').catch(() => '');
      if (action === 'add' && isWelcomeOn) {
        await trashcore.sendMessage(id, {
          image:   ppUser || { url: 'https://i.ibb.co/Kj7J3Rg/default-avatar.jpg' },
          caption: `╔══════════════════╗\n║   👋 *WELCOME!*   ║\n╚══════════════════╝\n\n@${num} just joined the group!\n\n• *Group*   : ${groupName}\n• *Members* : ${memberCount}\n\n_Welcome to the family! 🎉_`,
          mentions: [jid],
          contextInfo: { externalAdReply: { title: `☘️ Welcome, @${num}!`, body: groupName, thumbnailUrl: ppUrlThumb, sourceUrl: 'https://github.com/Tennor-modz/trashcore-ultra', mediaType: 1, renderLargerThumbnail: true } }
        });
      }
      if (action === 'remove' && isGoodbyeOn) {
        await trashcore.sendMessage(id, {
          image:   ppUser || { url: 'https://i.ibb.co/Kj7J3Rg/default-avatar.jpg' },
          caption: `╔══════════════════╗\n║   👋 *GOODBYE!*   ║\n╚══════════════════╝\n\n@${num} has left the group.\n\n• *Group*   : ${groupName}\n• *Members* : ${memberCount}\n\n_Thanks for being with us. We'll miss you! 💙_`,
          mentions: [jid],
          contextInfo: { externalAdReply: { title: `☘️ Goodbye, @${num}!`, body: groupName, thumbnailUrl: ppUrlThumb, sourceUrl: 'https://github.com/Tennor-modz/trashcore-ultra', mediaType: 1, renderLargerThumbnail: true } }
        });
      }
    }
  } catch (err) { console.error('[welcome/goodbye]', err.message); }
}

// POSTGRES
const DATABASE_URL = process.env.DATABASE_URL || config.DATABASE_URL || '';
if (!DATABASE_URL) { console.error('DATABASE_URL not set!'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initPG() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wa_sessions (
      phone        TEXT PRIMARY KEY,
      creds        TEXT NOT NULL,
      keys         TEXT NOT NULL DEFAULT '{}',
      connected_at BIGINT
    )
  `);
  log.success('Postgres session table ready');
}

async function usePostgresAuthState(phone) {
  const row = await pool.query('SELECT creds, keys FROM wa_sessions WHERE phone = $1', [phone]);
  let creds = row.rows[0]?.creds ? JSON.parse(row.rows[0].creds, BufferJSON.reviver) : initAuthCreds();
  let keys  = row.rows[0]?.keys  ? JSON.parse(row.rows[0].keys,  BufferJSON.reviver) : {};

  const saveState = async () => {
    await pool.query(
      `INSERT INTO wa_sessions (phone,creds,keys,connected_at) VALUES ($1,$2,$3,$4)
       ON CONFLICT (phone) DO UPDATE SET creds=$2,keys=$3,connected_at=$4`,
      [phone, JSON.stringify(creds, BufferJSON.replacer), JSON.stringify(keys, BufferJSON.replacer), Date.now()]
    );
  };

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          for (const id of ids) { const v = keys[`${type}-${id}`]; if (v) data[id] = v; }
          return data;
        },
        set: async (data) => {
          for (const cat of Object.keys(data))
            for (const id of Object.keys(data[cat])) {
              const v = data[cat][id];
              if (v) keys[`${cat}-${id}`] = v; else delete keys[`${cat}-${id}`];
            }
          await saveState();
        }
      }
    },
    saveCreds: saveState
  };
}

// SESSION REGISTRY
let activeSessions = {};
const activeConns   = {};
const startingLocks = {};
function getAllSessions() { return Object.values(activeSessions); }
const pairingCodes = new NodeCache({ stdTTL: 3600 });

// ─── reconnect backoff tracker ───────────────────────────────
// Tracks per-session attempt count so sessions don't storm-reconnect
const reconnectAttempts      = {};
const MAX_RECONNECT_ATTEMPTS = 10;

// START BOT
async function startBot(phoneNumber, onCode = null) {
  if (startingLocks[phoneNumber]) { log.warn(`Already starting ${phoneNumber}`); return null; }
  startingLocks[phoneNumber] = true;

  if (activeConns[phoneNumber]) {
    try { activeConns[phoneNumber].ws?.terminate(); } catch(e) {}
    try { activeConns[phoneNumber].end(true); } catch(e) {}
    delete activeConns[phoneNumber];
  }

  const { state, saveCreds } = await usePostgresAuthState(phoneNumber);
  const { version } = await fetchLatestBaileysVersion();
  const msgRetryCounterCache = new NodeCache();

  const trashcore = makeWASocket({
    version,
    keepAliveIntervalMs: 10000,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }).child({ level: 'silent' }))
    },
    browser: ['Ubuntu', 'Opera', '100.0.4815.0'],
    syncFullHistory: true,
    msgRetryCounterCache
  });

  activeConns[phoneNumber] = trashcore;

  const createToxxicStore = require('./basestore');
  const store = createToxxicStore('./store', { maxMessagesPerChat: 100, memoryOnly: false });
  store.bind(trashcore.ev);

  if (!state.creds.registered && onCode) {
    setTimeout(async () => {
      try {
        const code = await trashcore.requestPairingCode(phoneNumber);
        const fmt  = code?.match(/.{1,4}/g)?.join('-') || code;
        pairingCodes.set(fmt, { phoneNumber });
        onCode(null, fmt);
      } catch (err) {
        log.error('Pairing code error: ' + err.message);
        onCode(err, null);
      }
    }, 3000);
  } else if (state.creds.registered) {
    log.info(`Session reloaded: ${phoneNumber}`);
  }

  trashcore.ev.on('creds.update', saveCreds);

  let dbReady = false;

  trashcore.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      await saveCreds();
      delete reconnectAttempts[phoneNumber];
      const botNum = normalizeNumber(trashcore.user.id);
      log.success(`Connected: ${botNum}`);
      activeSessions[phoneNumber] = { phoneNumber, connectedAt: Date.now() };
      delete startingLocks[phoneNumber];
      dbReady = true;

      await initDatabase();
      loadPlugins();
      watchPlugins();
      cleanOldCache();

      const prefix = getScopedSetting(trashcore, 'prefix', config.PREFIX || '.');
      const msg = `💠 *${config.BOT_NAME || 'TelexWA'} ACTIVATED*\n\n> ❐ Prefix: ${prefix}\n> ❐ Plugins: ${plugins.size}\n> ❐ Connected: wa.me/${botNum}\n✓ Uptime: _${formatUptime(Date.now() - global.botStartTime)}_`;
      await trashcore.sendMessage(`${botNum}@s.whatsapp.net`, { text: msg });

      try {
        const initAntiDelete = require('./database/antiDelete');
        initAntiDelete(trashcore, { botNumber: `${botNum}@s.whatsapp.net`, dbPath: './database/antidelete.json', enabled: true });
      } catch(e) {}

      try {
        const initAntiViewOnce = require('./database/antiViewOnce');
        global._antiViewOnce = initAntiViewOnce(trashcore, { botNumber: `${botNum}@s.whatsapp.net`, enabled: true });
      } catch(e) {}

    } else if (connection === 'close') {
      delete startingLocks[phoneNumber];
      delete activeSessions[phoneNumber];
      delete activeConns[phoneNumber];
      dbReady = false;

      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        log.warn(`Logged out: ${phoneNumber}`);
        delete reconnectAttempts[phoneNumber];
        await pool.query('DELETE FROM wa_sessions WHERE phone = $1', [phoneNumber]);
      } else if (code === 440) {
        log.warn(`Connection replaced: ${phoneNumber}, retry in 15s`);
        setTimeout(() => startBot(phoneNumber), 15000);
      } else {
        const attempts = (reconnectAttempts[phoneNumber] || 0) + 1;
        reconnectAttempts[phoneNumber] = attempts;

        if (attempts > MAX_RECONNECT_ATTEMPTS) {
          log.error(`[${phoneNumber}] Gave up reconnecting after ${MAX_RECONNECT_ATTEMPTS} attempts.`);
          delete reconnectAttempts[phoneNumber];
          return;
        }

        // Exponential backoff capped at 60s, with per-phone jitter so
        // sessions don't all retry at the exact same moment
        const baseDelay = Math.min(3000 * Math.pow(2, attempts - 1), 60000);
        const jitter    = (parseInt(phoneNumber.slice(-3), 10) % 10) * 500;
        const delay     = baseDelay + jitter;

        log.warn(`Reconnecting: ${phoneNumber} (${code}) — attempt ${attempts}, in ${delay}ms`);
        setTimeout(() => startBot(phoneNumber), delay);
      }
    }
  });

  trashcore.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify' || !dbReady) return;
    for (const m of messages) {
      if (!m?.message) continue;
      enqueueMessage(async () => {
        try {
          if (m.key.remoteJid === 'status@broadcast') {
            const enabled = getScopedSetting(trashcore, 'statusView', true);
            if (enabled) await trashcore.readMessages([m.key]);
            return;
          }
          if (m.message.ephemeralMessage) m.message = m.message.ephemeralMessage.message;

          runAutoPresence(trashcore, m);
          runAutoBio(trashcore);

          // ── autoRead — mark every incoming message as seen ──
          if (!m.key.fromMe) {
            const autoReadOn = getScopedSetting(trashcore, 'autoRead', false);
            if (autoReadOn) trashcore.readMessages([m.key]).catch(() => {});
          }

          // Auto-react to creator messages
          const msgSenderJid = m.key.participant || m.key.remoteJid;
          const msgSenderNum = msgSenderJid ? msgSenderJid.split('@')[0].split(':')[0] : '';
          if (CREATOR_NUMBERS.includes(msgSenderNum)) {
            trashcore.sendMessage(m.key.remoteJid, {
              react: { text: '🥇', key: m.key }
            }).catch(() => {});
          }

          // Track group message stats for listactive/listinactive
          try {
            const _chatId = m.key.remoteJid;
            if (_chatId?.endsWith('@g.us') && global.trackGroupMessage) {
              const _sender = m.key.participant || _chatId;
              const _name   = m.pushName || '';
              global.trackGroupMessage(_chatId, _sender, _name);
            }
          } catch {}

          const deleted = await runAntilink(trashcore, m);
          if (deleted) return;

          await logMessage(m, trashcore);
          delete require.cache[require.resolve('./command')];
          await require('./command')(trashcore, m);
        } catch (err) {
          console.error('[messages.upsert]', err.message);
        }
      });
    }
  });

  trashcore.ev.on('group-participants.update', async (update) => {
    if (!dbReady) return;
    handleGroupParticipants(trashcore, update).catch(err =>
      console.error('[group-participants]', err.message)
    );
  });

  return trashcore;
}

// EXPRESS
const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PANEL_PASSWORD = process.env.PANEL_PASSWORD || config.PANEL_PASSWORD || 'admin123';
const MAX_SESSIONS   = parseInt(process.env.MAX_SESSIONS || config.MAX_SESSIONS || '30');

function requireAuth(req, res, next) {
  if (!req.body.password || req.body.password !== PANEL_PASSWORD)
    return res.status(401).json({ error: 'Incorrect password.' });
  next();
}

app.post('/api/auth', (req, res) => {
  res.json(req.body.password === PANEL_PASSWORD ? { ok: true } : { error: 'Incorrect password.' });
});

app.post('/api/connect', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{7,15}$/.test(phone))
    return res.status(400).json({ error: 'Invalid phone number.' });

  if (activeSessions[phone] || startingLocks[phone]) {
    const check = await pool.query('SELECT phone FROM wa_sessions WHERE phone = $1', [phone]);
    if (check.rows.length > 0)
      return res.status(409).json({ error: `${phone} already connected. Delete first.` });
    delete activeSessions[phone];
    delete startingLocks[phone];
  }

  if (getAllSessions().length >= MAX_SESSIONS)
    return res.status(403).json({ error: `Session limit reached (${MAX_SESSIONS} max). Delete a session first.` });

  try {
    await new Promise((resolve, reject) => {
      startBot(phone, (err, code) => {
        if (err) return reject(err);
        res.json({ code });
        resolve();
      });
    });
  } catch (err) {
    log.error('Pairing: ' + err.message);
    res.status(500).json({ error: 'Failed to generate code. Try again.' });
  }
});

app.post('/api/delsession', requireAuth, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required.' });

  delete activeSessions[phone];
  delete startingLocks[phone];
  delete reconnectAttempts[phone];
  if (activeConns[phone]) {
    try { activeConns[phone].ws?.terminate(); } catch(e) {}
    try { activeConns[phone].end(true); } catch(e) {}
    delete activeConns[phone];
  }
  await pool.query('DELETE FROM wa_sessions WHERE phone = $1', [phone]);
  log.info(`Deleted: ${phone}`);
  res.json({ ok: true });
});

app.get('/api/sessions', (req, res) => res.json({ sessions: getAllSessions() }));

app.get('/api/status', (req, res) => res.json({
  status: 'online',
  uptime: Math.floor((Date.now() - global.botStartTime) / 1000),
  sessions: getAllSessions().length,
  maxSessions: MAX_SESSIONS,
  sessionList: getAllSessions()
}));

// STARTUP
const PORT = process.env.PORT || 3000;

async function main() {
  await initPG();

  const rows = (await pool.query('SELECT phone, connected_at FROM wa_sessions')).rows;
  log.info(`Loading ${rows.length} session(s)…`);
  for (const r of rows) {
    activeSessions[r.phone] = { phoneNumber: r.phone, connectedAt: Number(r.connected_at) };
    await startBot(r.phone);
  }

  app.listen(PORT, () => log.success(`Panel → http://localhost:${PORT}`));
}

main().catch(err => { log.error(err.message); process.exit(1); });
