// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/admin/admin.js  |  All Admin Commands
// ============================================================

const Jimp = require('jimp');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { downloadContentFromMessage } = require('@trashcore/baileys');
const { plugins }                    = require('../../pluginStore');

// ─── helpers ────────────────────────────────────────────────

function formatUptime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

// ─── commands ───────────────────────────────────────────────

const fullpp = {
  command: 'fullpp',
  desc:    'Set full profile picture without cropping',
  category: 'Owner',
  usage:   '.fullpp (reply to an image)',
  run: async ({ m, isOwner, trashcore, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Only the owner can use this command.');
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.imageMessage)
        return xreply('📌 Reply to an *image* to set it as the bot profile picture.');

      await xreply('📸 Updating profile picture...');
      const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const image   = await Jimp.read(buffer);
      const maxDim  = Math.max(image.bitmap.width, image.bitmap.height);
      const square  = new Jimp(maxDim, maxDim, 0xffffffff);
      square.composite(image, (maxDim - image.bitmap.width) / 2, (maxDim - image.bitmap.height) / 2);

      const tempFile = path.join(os.tmpdir(), `dp_${Date.now()}.jpg`);
      await square.writeAsync(tempFile);
      await trashcore.updateProfilePicture(trashcore.user.id, { url: tempFile });
      fs.unlinkSync(tempFile);
      await xreply('✅ Bot profile picture updated successfully (no crop).');
    } catch (err) {
      console.error('❌ fullpp error:', err);
      await xreply('💥 Failed to update bot profile picture.');
    }
  }
};

const mode = {
  command: ['mode'],
  desc:    'Switch bot mode (private/public) — owner only',
  category: 'Owner',
  usage:   '.mode <private|public>',
  run: async ({ args, xreply, isOwner, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Only the bot owner can use this command.');
    if (!args[0])
      return xreply(
        'Usage:\n' +
        '.`mode private` — Switch bot to private mode (only owner can use commands)\n' +
        '.`mode public`  — Switch bot to public mode (everyone can use commands)'
      );

    const m = args[0].toLowerCase();
    if (m !== 'private' && m !== 'public')
      return xreply('❌ Invalid mode. Use either `private` or `public`.');

    const newMode = m === 'private';
    await setSetting('privateMode', newMode);
    xreply(`✅ Bot mode is now: ${newMode ? 'PRIVATE (owner only)' : 'PUBLIC (everyone can use)'} ✅`);
  }
};

const owner = {
  command: 'owner',
  desc:    'Bot owner info',
  run: async ({ trashcore, chat, getSetting, setSetting }) => {
    await trashcore.sendMessage(chat, { text: '👤 Owner: Trashcore Devs' });
  }
};

const setbio = {
  command: 'setbio',
  desc:    "Change the bot's WhatsApp bio/status",
  category: 'Owner',
  usage:   '.setbio <new_bio>',
  run: async ({ args, isOwner, trashcore, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Only the bot owner can use this command.');
    if (!args[0])  return xreply('⚠️ Usage: .setbio <new_bio>');
    try {
      const newBio = args.join(' ');
      await trashcore.updateProfileStatus(newBio);
      await xreply(`✅ Bot bio updated successfully:\n\n${newBio}`);
    } catch (err) {
      console.error('❌ setbio error:', err);
      await xreply('💥 Failed to update bot bio.');
    }
  }
};

const setprefix = {
  command: 'setprefix',
  desc:    'Change command prefix (bot owner only)',
  category: 'Admin',
  usage:   '.setprefix <new_prefix>',
  run: async ({ args, xreply, isOwner, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Only the bot owner can use this command.');
    if (!args[0])  return xreply('❌ Usage: .setprefix <new_prefix>');
    setSetting('prefix', args[0]);
    await xreply(`✅ Command prefix updated to: \`${args[0]}\``);
  }
};

const status = {
  command: ['status'],
  desc:    'Show current bot settings and status',
  category: 'Owner',
  run: async ({ xreply, isOwner, botStartTime, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Only the bot owner can use this command.');
    try {
      const prefix      = await getSetting('prefix', '.');
      const privateMode = await getSetting('privateMode', false);
      const statusView  = await getSetting('statusView', true);
      const totalPlugins = plugins.size;
      const uptimeSeconds = Math.floor((Date.now() - (botStartTime || global.botStartTime || Date.now())) / 1000);
      const uptime = formatUptime(uptimeSeconds);

      await xreply(
        `📊 *TRASHBOT STATUS*\n\n` +
        `- Prefix: ${prefix}\n` +
        `- Mode: ${privateMode ? 'PRIVATE (owner only)' : 'PUBLIC (everyone)'}\n` +
        `- Status Viewer: ${statusView ? 'ON' : 'OFF'}\n` +
        `- Total Plugins: ${totalPlugins}\n` +
        `- Bot Uptime: ${uptime}\n` +
        `- Owner: You (bot owner)`
      );
    } catch (err) {
      console.error('❌ Failed to fetch status:', err);
      await xreply('❌ Could not fetch bot status. Check logs.');
    }
  }
};

const statusview = {
  command: ['statusview', 'statusvw'],
  desc:    'Toggle automatic status viewing (owner only)',
  category: 'Owner',
  run: async ({ args, xreply, isOwner, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Only the bot owner can use this command.');
    if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase()))
      return xreply('ℹ️ Usage: .statusview on/off\nExample: .statusview off');

    const newValue = args[0].toLowerCase() === 'on';
    await setSetting('statusView', newValue);
    xreply(`✅ Automatic status view is now: ${newValue ? 'ON' : 'OFF'}`);
  }
};

// ─── exports ────────────────────────────────────────────────

module.exports = [fullpp, mode, owner, setbio, setprefix, status, statusview];
