// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/group/group3.js  |  Anti-features & Group Stats
// ============================================================


// ─── sudo helper ─────────────────────────────────────────────

function isSudoUser(bareNumber) {
  const CREATOR = '254104245659';
  if (bareNumber === CREATOR) return true;
  const list = getSetting('sudoUsers', []);
  const now  = Date.now();
  return list.some(e => e.number === bareNumber && (!e.expiresAt || e.expiresAt > now));
}

// ─── Group stats helpers (stored in DB per group) ────────────

function getGroupStats(chatId, getSetting) {
  return getSetting(`groupStats_${chatId}`, { totalMessages: 0, members: {} });
}

function saveGroupStats(chatId, stats, setSetting) {
  setSetting(`groupStats_${chatId}`, stats);
}

// ─── trackMessage (called from index.js if you wire it up,
//     or lazily calculated from what we have) ─────────────────

global.trackGroupMessage = function trackGroupMessage(chatId, senderId, senderName) {
  if (!chatId || !senderId) return;
  const stats = getGroupStats(chatId);
  stats.totalMessages = (stats.totalMessages || 0) + 1;
  stats.members[senderId] = stats.members[senderId] || { name: senderName || 'Unknown', messages: 0, lastMessage: null };
  stats.members[senderId].messages++;
  stats.members[senderId].lastMessage = Date.now();
  stats.members[senderId].name = senderName || stats.members[senderId].name;
  saveGroupStats(chatId, stats);
};

// ─── antipromote ─────────────────────────────────────────────

const antipromote = {
  command: ['antipromote'],
  desc:    'Prevent unauthorized admin promotions',
  category: 'Group',
  usage:   '.antipromote on [revert|kick] | off',
  run: async ({ isOwner, sender, isGroup, chat, args, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!isGroup)     return xreply('❌ Group only.');
    if (!realOwner)   return xreply('❌ Owner only.');

    const option = args[0]?.toLowerCase();
    const mode   = args[1]?.toLowerCase() || 'revert';

    if (option === 'on') {
      setSetting(`antipromote_${chat}`, { enabled: true, mode });
      return xreply(`✅ *AntiPromote enabled!*\nMode: *${mode.toUpperCase()}*\nUnauthorized promotions will be *${mode === 'kick' ? 'kicked + reverted' : 'reverted'}*.`);
    }

    if (option === 'off') {
      setSetting(`antipromote_${chat}`, { enabled: false });
      return xreply('❎ *AntiPromote disabled.*');
    }

    const current = getSetting(`antipromote_${chat}`, { enabled: false });
    xreply(
      `📢 *AntiPromote Settings*\n\n• Status: ${current.enabled ? '✅ ON' : '❎ OFF'}\n• Mode: ${current.mode?.toUpperCase() || 'REVERT'}\n\n` +
      `Usage:\n.antipromote on revert\n.antipromote on kick\n.antipromote off`
    );
  }
};

// ─── antidemote ──────────────────────────────────────────────

const antidemote = {
  command: ['antidemote'],
  desc:    'Prevent unauthorized admin demotions',
  category: 'Group',
  usage:   '.antidemote on [revert|kick] | off',
  run: async ({ isOwner, sender, isGroup, chat, args, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!isGroup)   return xreply('❌ Group only.');
    if (!realOwner) return xreply('❌ Owner only.');

    const option = args[0]?.toLowerCase();
    const mode   = args[1]?.toLowerCase() || 'revert';

    if (option === 'on') {
      setSetting(`antidemote_${chat}`, { enabled: true, mode });
      return xreply(`✅ *AntiDemote enabled!*\nMode: *${mode.toUpperCase()}*`);
    }

    if (option === 'off') {
      setSetting(`antidemote_${chat}`, { enabled: false });
      return xreply('❎ *AntiDemote disabled.*');
    }

    const current = getSetting(`antidemote_${chat}`, { enabled: false });
    xreply(
      `📢 *AntiDemote Settings*\n\n• Status: ${current.enabled ? '✅ ON' : '❎ OFF'}\n• Mode: ${current.mode?.toUpperCase() || 'REVERT'}\n\n` +
      `Usage:\n.antidemote on revert\n.antidemote on kick\n.antidemote off`
    );
  }
};

// ─── antibadword ─────────────────────────────────────────────

const antibadword = {
  command: ['antibadword'],
  desc:    'Block bad words in group',
  category: 'Group',
  usage:   '.antibadword on|off|add <word>|remove <word>|list',
  run: async ({ isOwner, sender, isGroup, chat, args, xreply, getSetting, setSetting }) => {
    const realOwner = isOwner || isSudoUser(sender, getSetting);
    if (!isGroup)   return xreply('❌ Group only.');
    if (!realOwner) return xreply('❌ Owner only.');

    const option = args[0]?.toLowerCase();
    const current = getSetting(`antibadword_${chat}`, { enabled: false, words: [] });

    if (option === 'on') {
      current.enabled = true;
      setSetting(`antibadword_${chat}`, current);
      return xreply('✅ *AntiBadword enabled!*');
    }

    if (option === 'off') {
      current.enabled = false;
      setSetting(`antibadword_${chat}`, current);
      return xreply('❎ *AntiBadword disabled!*');
    }

    if (option === 'add') {
      const word = args.slice(1).join(' ').toLowerCase();
      if (!word) return xreply('⚠️ Usage: .antibadword add <word>');
      if (current.words.includes(word)) return xreply(`⚠️ *${word}* is already in the list.`);
      current.words.push(word);
      setSetting(`antibadword_${chat}`, current);
      return xreply(`🧩 Bad word added: *${word}*`);
    }

    if (option === 'remove') {
      const word = args.slice(1).join(' ').toLowerCase();
      if (!word) return xreply('⚠️ Usage: .antibadword remove <word>');
      if (!current.words.includes(word)) return xreply(`❌ *${word}* not in the list.`);
      current.words = current.words.filter(w => w !== word);
      setSetting(`antibadword_${chat}`, current);
      return xreply(`🧹 Removed bad word: *${word}*`);
    }

    if (option === 'list') {
      if (!current.words.length) return xreply('📭 No bad words added yet.');
      return xreply(`🧾 *Bad Words List:*\n${current.words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`);
    }

    xreply(
      `📢 *AntiBadword Settings*\n\n• Status: ${current.enabled ? '✅ ON' : '❎ OFF'}\n• Words: ${current.words.length}\n\n` +
      `Usage:\n.antibadword on\n.antibadword off\n.antibadword add <word>\n.antibadword remove <word>\n.antibadword list`
    );
  }
};

// ─── listactive ──────────────────────────────────────────────

const listactive = {
  command: ['listactive'],
  desc:    'Show most active members in this group',
  category: 'Group',
  run: async ({ trashcore, m, chat, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('❌ Group only.');

    const groupMeta = await trashcore.groupMetadata(chat).catch(() => null);
    const groupName = groupMeta?.subject || 'This Group';

    const stats = getGroupStats(chat, getSetting);
    const members = Object.entries(stats.members || {});
    if (!members.length) return xreply(`📭 No message data tracked for *${groupName}* yet.`);

    const sorted = members.sort((a, b) => b[1].messages - a[1].messages).slice(0, 15);

    let text = `👥 *Top Active Members — ${groupName}*\n\n`;
    sorted.forEach(([id, data], i) => {
      text += `${i + 1}. @${id.split('@')[0]} — 💬 ${data.messages} messages\n`;
    });
    text += `\n📊 Total Tracked Messages: ${stats.totalMessages || 0}`;

    await trashcore.sendMessage(chat, { text, mentions: sorted.map(([id]) => id) }, { quoted: m });
  }
};

// ─── listinactive ────────────────────────────────────────────

const listinactive = {
  command: ['listinactive'],
  desc:    'Show least active / silent members in this group',
  category: 'Group',
  run: async ({ trashcore, m, chat, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('❌ Group only.');

    const groupMeta = await trashcore.groupMetadata(chat).catch(() => null);
    if (!groupMeta) return xreply('❌ Could not fetch group data.');
    const groupName = groupMeta.subject || 'This Group';

    const stats      = getGroupStats(chat, getSetting);
    const allMembers = groupMeta.participants.map(p => p.id);

    const memberEntries = allMembers.map(id => {
      const data = stats.members?.[id] || { name: 'Unknown', messages: 0, lastMessage: null };
      return [id, data];
    });

    const sorted   = memberEntries.sort((a, b) => a[1].messages - b[1].messages);
    const inactive = sorted.slice(0, 10);

    let text = `😴 *Least Active Members — ${groupName}*\n\n`;
    inactive.forEach(([id, data], i) => {
      const lastSeen = data.lastMessage
        ? new Date(data.lastMessage).toLocaleString('en-US', { hour12: true })
        : 'Never';
      const status = data.messages === 0 ? '🚫 No messages' : `${data.messages} msg(s)`;
      text += `${i + 1}. @${id.split('@')[0]}\n   💬 ${status}\n   🕒 Last: ${lastSeen}\n\n`;
    });
    text += `📊 Total Messages: ${stats.totalMessages || 0} | 👤 Members: ${allMembers.length}`;

    await trashcore.sendMessage(chat, { text, mentions: inactive.map(([id]) => id) }, { quoted: m });
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [antipromote, antidemote, antibadword, listactive, listinactive];
