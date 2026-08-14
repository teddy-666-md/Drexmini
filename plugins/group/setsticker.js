// ============================================================
//  TELEXWA — by Trashcore
//  plugins/group/setsticker.js  |  Sticker-triggered commands
//  Ported from Trashcore Ultra — adapted to TelexWa structure
// ============================================================

const { getSetting, setSetting, db } = require('../../database');

// Commands that can be sticker-triggered
const ALLOWED_COMMANDS = ['kick', 'promote', 'demote', 'warn', 'mute'];

// ─── setsticker ──────────────────────────────────────────────

const setsticker = {
  command: ['setsticker'],
  desc:    'Bind a sticker to a group command (kick, promote, demote, warn, mute)',
  category: 'Group',
  usage:   '.setsticker <command> — reply to a sticker',
  run: async ({ trashcore, m, chat, isOwner, isAdmin, args, xreply, getSetting: gS, setSetting: sS }) => {
    const _get = gS || getSetting;
    const _set = sS || setSetting;

    if (!chat.endsWith('@g.us')) return xreply('⚠️ Groups only.');
    if (!isOwner && !isAdmin) return xreply('⚠️ Admins only.');

    const cmdArg = args[0]?.toLowerCase();
    if (!cmdArg || !ALLOWED_COMMANDS.includes(cmdArg)) {
      return xreply(
        `⚠️ *Usage:* .setsticker <command>\n\n` +
        `*Available commands:*\n${ALLOWED_COMMANDS.map(c => `• ${c}`).join('\n')}\n\n` +
        `_Reply to a sticker while using this command._`
      );
    }

    const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const sticker = quoted?.stickerMessage;
    if (!sticker) return xreply('⚠️ Reply to a sticker to bind it to a command.');

    const sha = sticker.fileSha256
      ? Buffer.from(sticker.fileSha256).toString('hex')
      : sticker.fileEncSha256
        ? Buffer.from(sticker.fileEncSha256).toString('hex')
        : null;

    if (!sha) return xreply('❌ Could not read sticker ID. Try a different sticker.');

    const key = `stickerCmd_${chat}_${sha}`;
    _set(key, cmdArg);

    xreply(
      `✅ *Sticker bound!*\n\n` +
      `• Command : \`.${cmdArg}\`\n` +
      `• Group   : This group\n\n` +
      `_Reply to any member with that sticker to trigger \`.${cmdArg}\`._`
    );
  }
};

// ─── delsticker ──────────────────────────────────────────────

const delsticker = {
  command: ['delsticker'],
  desc:    'Remove a sticker binding — reply to the bound sticker',
  category: 'Group',
  usage:   '.delsticker — reply to the bound sticker',
  run: async ({ m, chat, isOwner, isAdmin, xreply, getSetting: gS, setSetting: sS }) => {
    const _get = gS || getSetting;
    const _set = sS || setSetting;

    if (!chat.endsWith('@g.us')) return xreply('⚠️ Groups only.');
    if (!isOwner && !isAdmin) return xreply('⚠️ Admins only.');

    const quoted  = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const sticker = quoted?.stickerMessage;
    if (!sticker) return xreply('⚠️ Reply to the sticker you want to unbind.');

    const sha = sticker.fileSha256
      ? Buffer.from(sticker.fileSha256).toString('hex')
      : sticker.fileEncSha256
        ? Buffer.from(sticker.fileEncSha256).toString('hex')
        : null;

    if (!sha) return xreply('❌ Could not read sticker ID.');

    const key = `stickerCmd_${chat}_${sha}`;
    const existing = _get(key, null);
    if (!existing) return xreply('❌ No command is bound to that sticker in this group.');

    _set(key, null);
    xreply(`✅ Sticker unbound from \`.${existing}\`.`);
  }
};

// ─── liststickers ────────────────────────────────────────────

const liststickers = {
  command: ['liststickers', 'stickerlist'],
  desc:    'List all sticker-command bindings in this group',
  category: 'Group',
  usage:   '.liststickers',
  run: async ({ chat, isOwner, isAdmin, xreply }) => {
    if (!chat.endsWith('@g.us')) return xreply('⚠️ Groups only.');
    if (!isOwner && !isAdmin) return xreply('⚠️ Admins only.');

    const prefix = `stickerCmd_${chat}_`;
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key LIKE ?`).all(prefix + '%');
    const active = rows.filter(r => {
      try { return JSON.parse(r.value) !== null; } catch { return false; }
    });

    if (!active.length) return xreply('📭 No sticker bindings set for this group.');

    let text = `🎭 *Sticker Bindings — This Group*\n\n`;
    active.forEach((r, i) => {
      const sha     = r.key.replace(prefix, '').slice(0, 8) + '...';
      const cmdName = JSON.parse(r.value);
      text += `${i + 1}. \`.${cmdName}\` → \`${sha}\`\n`;
    });
    xreply(text.trim());
  }
};

module.exports = [setsticker, delsticker, liststickers];
