// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/group/group.js  |  All Group Commands
// ============================================================

const {
  downloadContentFromMessage,
  generateWAMessageFromContent,
  generateWAMessageContent
} = require('@trashcore/baileys');
const crypto = require('crypto');

// ─── demote ──────────────────────────────────────────────────

const demote = {
  command: ['demote'],
  desc:    'Demote a member from admin (owner only)',
  category: 'Group',
  run: async ({ trashcore, chat, m, args, xreply, isOwner, getSetting, setSetting }) => {
    try {
      if (!isOwner) return xreply('⚠️ Only the bot owner can use .demote');
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');

      const group        = await trashcore.groupMetadata(chat);
      const participants = group.participants;

      let target =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        (args[0] && args[0].replace(/\D/g, ''));

      if (!target)
        return xreply('⚠️ Mention, reply, or provide a number.\nExample:\n.demote @user\n.demote (reply)');

      if (/^\d+$/.test(target) && !target.includes('@')) {
        const participant = participants.find(p => p.id.endsWith(target + '@s.whatsapp.net'));
        target = participant ? participant.id : `${target}@s.whatsapp.net`;
      }

      const isTargetAdmin = participants.find(p => p.id === target && (p.admin === 'admin' || p.admin === 'superadmin'));
      if (!isTargetAdmin) return xreply('⚠️ This user is not an admin.');

      await trashcore.groupParticipantsUpdate(chat, [target], 'demote');
      await xreply(`✅ Demoted @${target.split('@')[0]} from admin.`, { mentions: [target] });
    } catch (err) {
      console.error('Demote Command Error:', err);
      return xreply('❌ Failed to demote member. Check bot permissions.');
    }
  }
};

// ─── getsw ───────────────────────────────────────────────────

function deepUnwrap(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  let m = msg;
  for (let i = 0; i < 15; i++) {
    if (m?.ephemeralMessage?.message)          { m = m.ephemeralMessage.message; continue; }
    if (m?.viewOnceMessage?.message)           { m = m.viewOnceMessage.message; continue; }
    if (m?.viewOnceMessageV2?.message)         { m = m.viewOnceMessageV2.message; continue; }
    if (m?.viewOnceMessageV2Extension?.message){ m = m.viewOnceMessageV2Extension.message; continue; }
    if (m?.documentWithCaptionMessage?.message){ m = m.documentWithCaptionMessage.message; continue; }
    if (m?.editedMessage?.message)             { m = m.editedMessage.message; continue; }
    break;
  }
  return m;
}

function resolveToPhone(jid, participants = []) {
  if (!jid) return jid;
  const num = jid.replace(/@.*$/, '').replace(/[^0-9]/g, '');
  for (const p of participants) {
    const ids   = [p.id, p.jid, p.lid].filter(Boolean);
    const match = ids.some(id => id.replace(/[^0-9]/g, '') === num);
    if (match) {
      const phone = ids.find(id => id.endsWith('@s.whatsapp.net') && !id.includes(':'));
      if (phone) return phone;
    }
  }
  if (jid.endsWith('@lid')) return jid.replace('@lid', '@s.whatsapp.net');
  return jid;
}

async function downloadMedia(mediaNode, type) {
  const streamType = type.replace('Message', '').toLowerCase();
  const stream = await downloadContentFromMessage(mediaNode, streamType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

const getsw = {
  command: ['getsw'],
  desc:    'Retrieve media from status that mentioned/tagged the group',
  category: 'Group',
  run: async ({ trashcore, chat, m, xreply, participants, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      if (!m.quoted)
        return xreply(
          `❌ *REPLY TO NOTIFICATION MESSAGE!*\n\n📋 *How to Use:*\n1. Wait for someone to tag the group in their status\n2. WhatsApp will send a notification to the group\n3. Reply to that notification with this command\n\n💡 *Example:*\n[Notification: "Status from user @ Group name"]\n└─ Reply: .getsw`
        );

      const rawSender   = m.quoted?.sender || m.msg?.contextInfo?.participant;
      if (!rawSender) return xreply('❌ Cannot detect status sender!');

      const statusSender = resolveToPhone(rawSender, participants);
      const senderNum    = statusSender.replace(/[^0-9]/g, '');

      if (!global.statusStore) return xreply('❌ *STATUS STORE NOT ACTIVE!*\n\n💡 Make sure `index.js` has been updated with status@broadcast listener.');

      let userStatuses = global.statusStore.get(rawSender) || [];
      if (userStatuses.length === 0) {
        for (const [key, val] of global.statusStore.entries()) {
          if (key.replace(/[^0-9]/g, '') === senderNum) { userStatuses = val; break; }
        }
      }

      if (userStatuses.length === 0)
        return xreply(`❌ *STATUS NOT FOUND IN STORE!*\n\n👤 User: @${senderNum}\n\n💡 Bot just restarted or status was deleted.`, { mentions: [statusSender] });

      const latestMsg    = userStatuses[userStatuses.length - 1];
      const statusContent = deepUnwrap(latestMsg?.message);
      if (!statusContent) return xreply('❌ Status content is empty!');

      const supportedTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'extendedTextMessage', 'conversation'];
      const type = Object.keys(statusContent).find(k => supportedTypes.includes(k));
      if (!type) return xreply(`❌ *STATUS TYPE NOT SUPPORTED!*\n\n📋 Type: ${Object.keys(statusContent).join(', ')}\n\n💡 Only supports: image, video, audio, text`);

      const node    = statusContent[type];
      const caption = node?.caption || statusContent?.extendedTextMessage?.text || (typeof statusContent?.conversation === 'string' ? statusContent.conversation : '') || '';

      if (type === 'imageMessage') {
        const buf = await downloadMedia(node, type);
        await trashcore.sendMessage(chat, { image: buf, caption: `✅ *STATUS RETRIEVED!*\n\n👤 From: @${senderNum}\n📷 Type: Image${caption ? `\n📝 Caption: ${caption}` : ''}`, mentions: [statusSender] }, { quoted: m });
      } else if (type === 'videoMessage') {
        const buf = await downloadMedia(node, type);
        await trashcore.sendMessage(chat, { video: buf, caption: `✅ *STATUS RETRIEVED!*\n\n👤 From: @${senderNum}\n🎥 Type: Video${caption ? `\n📝 Caption: ${caption}` : ''}`, mentions: [statusSender], mimetype: 'video/mp4' }, { quoted: m });
      } else if (type === 'audioMessage') {
        const buf = await downloadMedia(node, type);
        await trashcore.sendMessage(chat, { audio: buf, mimetype: node.mimetype || 'audio/mp4', ptt: node.ptt || false }, { quoted: m });
        await xreply(`✅ *STATUS RETRIEVED!*\n\n👤 From: @${senderNum}\n🎤 Type: ${node.ptt ? 'Voice Note' : 'Audio'}`, { mentions: [statusSender] });
      } else {
        await xreply(`✅ *STATUS RETRIEVED!*\n\n👤 From: @${senderNum}\n📝 Type: Text\n\n💬 Status:\n${caption || 'No text'}`, { mentions: [statusSender] });
      }
    } catch (err) {
      console.error('[GETSW ERROR]', err);
      let errorMsg = '❌ *FAILED TO RETRIEVE STATUS!*\n\n';
      if (err.message?.includes('not-authorized')) errorMsg += '🔒 Bot does not have access.';
      else if (err.message?.includes('rate-overlimit')) errorMsg += '⏱️ Too many requests. Wait and try again.';
      else errorMsg += `🔧 Error: ${err.message}`;
      await xreply(errorMsg);
    }
  }
};

// ─── hidetag ─────────────────────────────────────────────────

const hidetag = {
  command: ['hidetag'],
  desc:    'Send a message to all members without visible mentions',
  category: 'Group',
  run: async ({ trashcore, chat, xreply, isOwner, text, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      if (!isOwner) return xreply('⚠️ Only the bot owner can use .hidetag');
      const group = await trashcore.groupMetadata(chat);
      if (!group.participants?.length) return xreply('⚠️ Could not fetch group members.');
      if (!text) return xreply('⚠️ Provide a message to send.');
      await trashcore.sendMessage(chat, { text, mentions: group.participants.map(p => p.id) });
    } catch (err) {
      console.error('Hidetag Error:', err);
      return xreply('❌ Failed to send hidetag message.');
    }
  }
};

// ─── kick ────────────────────────────────────────────────────

const kick = {
  command: ['kick'],
  desc:    'Kick a user from the group',
  category: 'Group',
  run: async ({ trashcore, chat, isOwner, m, xreply, args, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      if (!isOwner) return xreply('⚠️ Only the bot owner can use .kick');
      const group        = await trashcore.groupMetadata(chat);
      const participants = group.participants;

      let target =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        (args[0] && args[0].replace(/\D/g, ''));

      if (!target)
        return xreply('⚠️ Mention, reply, or provide a number.\nExample:\n.kick @user\n.kick (reply)\n.kick 2547xxxxxxx');

      if (/^\d+$/.test(target) && !target.includes('@')) {
        const participant = participants.find(p => p.id.endsWith(target + '@s.whatsapp.net'));
        target = participant ? participant.id : `${target}@s.whatsapp.net`;
      }

      if (participants.some(p => p.id === target && p.admin)) return xreply("🚫 I can't kick a group admin.");
      await trashcore.groupParticipantsUpdate(chat, [target], 'remove');
      return xreply(`👢 Removed @${target.split('@')[0]}`, { mentions: [target] });
    } catch (err) {
      console.error('Kick Error:', err);
      return xreply('❌ Failed to kick. Check bot permissions or ID.');
    }
  }
};

// ─── linkgc ──────────────────────────────────────────────────

const linkgc = {
  command: ['linkgc'],
  desc:    'Get group link, name, member count, admin count, and profile picture',
  category: 'Group',
  run: async ({ trashcore, chat, m, xreply, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      const group       = await trashcore.groupMetadata(chat);
      const groupName   = group.subject || 'N/A';
      const memberCount = group.participants.length;
      const adminCount  = group.participants.filter(p => p.admin || p.admin === 'superadmin').length;

      let groupLink;
      try {
        const code = await trashcore.groupInviteCode(chat);
        groupLink = code ? `https://chat.whatsapp.com/${code}` : 'No invite link available';
      } catch { groupLink = 'No invite link available'; }

      let profilePicUrl;
      try { profilePicUrl = await trashcore.profilePictureUrl(chat, 'image'); } catch { profilePicUrl = null; }

      const text =
        `📊 *Group Info*\n\n👥 Name: ${groupName}\n🔗 Link: ${groupLink}\n👤 Members: ${memberCount}\n🛡️ Admins: ${adminCount}`;

      if (profilePicUrl)
        await trashcore.sendMessage(chat, { image: { url: profilePicUrl }, caption: text }, { quoted: m });
      else
        await xreply(text);
    } catch (err) {
      console.error('linkgc Error:', err);
      await xreply('❌ Failed to fetch group info.');
    }
  }
};

// ─── promote ─────────────────────────────────────────────────

const promote = {
  command: ['promote'],
  desc:    'Promote a member to admin',
  category: 'Group',
  run: async ({ trashcore, chat, m, args, xreply, isOwner, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      if (!isOwner) return xreply('⚠️ Only bot owners can promote members.');
      const group        = await trashcore.groupMetadata(chat);
      const participants = group.participants;

      let target =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        m.message?.extendedTextMessage?.contextInfo?.participant ||
        (args[0] && args[0].replace(/\D/g, ''));

      if (!target)
        return xreply('⚠️ Mention, reply, or provide a number.\nExample:\n.promote @user\n.promote (reply)');

      if (/^\d+$/.test(target) && !target.includes('@')) {
        const participant = participants.find(p => p.id.endsWith(target + '@s.whatsapp.net'));
        target = participant ? participant.id : `${target}@s.whatsapp.net`;
      }

      const isTargetAdmin = participants.find(p => p.id === target && (p.admin === 'admin' || p.admin === 'superadmin'));
      if (isTargetAdmin) return xreply('⚠️ This user is already an admin.');

      await trashcore.groupParticipantsUpdate(chat, [target], 'promote');
      await xreply(`✅ Promoted @${target.split('@')[0]} to admin.`, { mentions: [target] });
    } catch (err) {
      console.error('Promote Command Error:', err);
      return xreply('❌ Failed to promote member. Check bot permissions.');
    }
  }
};

// ─── swgc ────────────────────────────────────────────────────

const swgc = {
  command: ['upswgc', 'swgc'],
  desc:    'Upload media/text/link to WhatsApp group status',
  category: 'Group',
  run: async ({ trashcore, chat, m, xreply, isOwner, text, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      if (!isOwner) return xreply('⚠️ Only the bot owner can use this command');

      function unwrapMsg(msg) {
        let m = msg || {};
        for (let i = 0; i < 10; i++) {
          if (m?.ephemeralMessage?.message)          { m = m.ephemeralMessage.message; continue; }
          if (m?.viewOnceMessage?.message)           { m = m.viewOnceMessage.message; continue; }
          if (m?.viewOnceMessageV2?.message)         { m = m.viewOnceMessageV2.message; continue; }
          if (m?.viewOnceMessageV2Extension?.message){ m = m.viewOnceMessageV2Extension.message; continue; }
          if (m?.documentWithCaptionMessage?.message){ m = m.documentWithCaptionMessage.message; continue; }
          break;
        }
        return m;
      }

      const MEDIA_TYPES = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
      const TEXT_TYPES  = ['extendedTextMessage', 'conversation'];

      function pickNode(raw) {
        if (!raw) return null;
        const u = unwrapMsg(raw);
        for (const t of MEDIA_TYPES) if (u?.[t]) return { node: u[t], type: t };
        for (const t of TEXT_TYPES)  if (u?.[t]) return { node: u[t], type: t };
        return null;
      }

      function getQuotedRaw(m) {
        if (m.quoted?.message) return m.quoted.message;
        const raw = m.message;
        if (!raw) return null;
        const u  = unwrapMsg(raw);
        const ci = u?.extendedTextMessage?.contextInfo || u?.imageMessage?.contextInfo || u?.videoMessage?.contextInfo || null;
        return ci?.quotedMessage || null;
      }

      async function dlMedia(node, type) {
        const streamType = type.replace('Message', '');
        const stream = await downloadContentFromMessage(node, streamType);
        let buf = Buffer.from([]);
        for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
        return buf;
      }

      const BG_COLORS = [0xFF8A2BE2, 0xFFFF69B4, 0xFFFFA500, 0xFF00BFFF, 0xFF32CD32];
      const randomBg  = () => BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
      const isUrl     = str => /^https?:\/\//i.test(str.trim());
      const getDomain = url => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } };

      let picked  = null;
      let caption = text || '';

      const quotedRaw = getQuotedRaw(m);
      if (quotedRaw) picked = pickNode(quotedRaw);

      if (!picked && m.message) {
        const selfPicked = pickNode(m.message);
        if (selfPicked && MEDIA_TYPES.includes(selfPicked.type)) picked = selfPicked;
      }

      if (!picked) {
        const statusText = caption || (() => { const u = unwrapMsg(m.message); return u?.extendedTextMessage?.text || u?.conversation || ''; })();
        if (!statusText)
          return xreply(`> ❌ *NO CONTENT!*\n\n> 📋 *How to Use:*\n> 1️⃣ *Image/Video:* Send/reply media → \`.swgc\`\n> 2️⃣ *Plain text:* \`.swgc Hello everyone!\`\n> 3️⃣ *Link:* \`.swgc https://youtu.be/xxx\`\n> ✅ *Support:* Image • Video • Audio • Text • Link`);
        picked  = { node: statusText, type: 'text' };
        caption = '';
      }

      let contentPayload = {};
      let typeLabel      = '';

      if (picked.type === 'imageMessage') {
        const buf = await dlMedia(picked.node, 'imageMessage');
        contentPayload = { image: buf, caption: caption || picked.node?.caption || '' };
        typeLabel = '📷 Image';
      } else if (picked.type === 'videoMessage') {
        const buf = await dlMedia(picked.node, 'videoMessage');
        contentPayload = { video: buf, caption: caption || picked.node?.caption || '', gifPlayback: false };
        typeLabel = '🎥 Video';
      } else if (picked.type === 'audioMessage') {
        const buf = await dlMedia(picked.node, 'audioMessage');
        const isPtt = picked.node?.ptt === true;
        contentPayload = { audio: buf, mimetype: isPtt ? 'audio/ogg; codecs=opus' : 'audio/mp4', ptt: isPtt };
        typeLabel = isPtt ? '🎤 Voice Note' : '🎵 Audio';
      } else if (picked.type === 'stickerMessage') {
        const buf = await dlMedia(picked.node, 'stickerMessage');
        contentPayload = { image: buf, caption: caption || '' };
        typeLabel = '🖼️ Sticker (as image)';
      } else if (picked.type === 'documentMessage') {
        contentPayload = { text: `📄 *${picked.node?.fileName || 'Document'}*\n${caption || ''}`, linkPreview: null };
        typeLabel = '📄 Document (as text)';
      } else {
        const rawText = typeof picked.node === 'string' ? picked.node : caption;
        if (isUrl(rawText)) {
          contentPayload = { text: rawText, linkPreview: { url: rawText, title: getDomain(rawText), description: caption || rawText, thumbnail: null } };
          typeLabel = `🔗 Link — ${getDomain(rawText)}`;
        } else {
          contentPayload = { text: rawText, backgroundArgb: randomBg(), textArgb: 0xFFFFFFFF, font: Math.floor(Math.random() * 5) + 1 };
          typeLabel = '📝 Text';
        }
      }

      let waContent;
      try {
        waContent = await generateWAMessageContent(contentPayload, { upload: trashcore.waUploadToServer });
      } catch {
        const fallback = caption || (typeof picked.node === 'string' ? picked.node : '') || typeLabel;
        waContent = await generateWAMessageContent({ text: fallback || '(status)', backgroundArgb: randomBg(), textArgb: 0xFFFFFFFF, font: 1 }, { upload: trashcore.waUploadToServer });
        typeLabel += ' (fallback text)';
      }

      const messageSecret = crypto.randomBytes(32);
      const finalMsg = generateWAMessageFromContent(chat, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...waContent, messageContextInfo: { messageSecret } } }
      }, { userJid: trashcore.user.id });

      await trashcore.relayMessage(chat, finalMsg.message, { messageId: finalMsg.key.id });
      await xreply(`> ✅ *GROUP STATUS SUCCESSFUL!*\n\n> 📌 Type: ${typeLabel}\n> 💡 Status published to the group`);
    } catch (e) {
      console.error('[UPSWGC ERROR]', e);
      let errorMsg = '> ❌ *UPLOAD STATUS FAILED*\n\n';
      if (e.message?.includes('not-authorized'))  errorMsg += '> 🔒 Bot is not authorized to upload status';
      else if (e.message?.includes('rate-overlimit')) errorMsg += '> ⏱️ Too many requests. Wait and retry.';
      else if (e.message?.includes('Invalid media')) errorMsg += '> ⚠️ Media format not supported';
      else errorMsg += `> 🔧 Error: ${e.message}`;
      await xreply(errorMsg);
    }
  }
};

// ─── tagall ──────────────────────────────────────────────────

const tagall = {
  command: ['tagall'],
  desc:    'Mention all group members',
  category: 'Group',
  run: async ({ trashcore, chat, xreply, isOwner, text, getSetting, setSetting }) => {
    try {
      if (!chat.endsWith('@g.us')) return xreply('⚠️ This command is only for groups.');
      if (!isOwner) return xreply('⚠️ Only the bot owner can use .tagall');
      const group = await trashcore.groupMetadata(chat);
      if (!group.participants?.length) return xreply('⚠️ Could not fetch group members.');
      const mentionText = text ? text + '\n\n' : '';
      const message     = mentionText + group.participants.map(p => `@${p.id.split('@')[0]}`).join(' ');
      await trashcore.sendMessage(chat, { text: message, mentions: group.participants.map(p => p.id) });
    } catch (err) {
      console.error('TagAll Error:', err);
      return xreply('❌ Failed to mention all members.');
    }
  }
};

// ─── exports ────────────────────────────────────────────────

module.exports = [demote, getsw, hidetag, kick, linkgc, promote, swgc, tagall];
