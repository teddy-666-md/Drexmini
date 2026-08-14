// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/group/group2.js  |  Extended Group Commands
// ============================================================

// ─── open ────────────────────────────────────────────────────

const open = {
  command: ['open'],
  desc:    'Open group chat (allow all members to message)',
  category: 'Group',
  run: async ({ trashcore, chat, isOwner, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup)   return xreply('⚠️ Group only.');
    if (!isOwner)   return xreply('❌ Owner only.');
    await trashcore.groupSettingUpdate(chat, 'not_announcement');
    xreply('✅ Group opened — all members can now send messages.');
  }
};

// ─── close ───────────────────────────────────────────────────

const close = {
  command: ['close'],
  desc:    'Close group chat (only admins can message)',
  category: 'Group',
  run: async ({ trashcore, chat, isOwner, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('⚠️ Group only.');
    if (!isOwner) return xreply('❌ Owner only.');
    await trashcore.groupSettingUpdate(chat, 'announcement');
    xreply('✅ Group closed — only admins can send messages now.');
  }
};

// ─── welcome ─────────────────────────────────────────────────

const welcome = {
  command: ['welcome'],
  desc:    'Toggle welcome message for new members',
  category: 'Group',
  usage:   '.welcome on/off',
  run: async ({ args, isOwner, isGroup, chat, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('⚠️ Group only.');
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .welcome on/off');
    // setSetting from context
    const val = args[0] === 'on';
    await setSetting(`welcome_${chat}`, val);
    xreply(`✅ Welcome message is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── goodbye ─────────────────────────────────────────────────

const goodbye = {
  command: ['goodbye'],
  desc:    'Toggle goodbye message when members leave',
  category: 'Group',
  usage:   '.goodbye on/off',
  run: async ({ args, isOwner, isGroup, chat, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('⚠️ Group only.');
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .goodbye on/off');
    // setSetting from context
    const val = args[0] === 'on';
    await setSetting(`goodbye_${chat}`, val);
    xreply(`✅ Goodbye message is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── antilink ────────────────────────────────────────────────

const antilink = {
  command: ['antilink'],
  desc:    'Toggle anti-link (deletes http/https links)',
  category: 'Group',
  usage:   '.antilink on/off',
  run: async ({ args, isOwner, isAdmin, isGroup, chat, xreply, getSetting, setSetting }) => {
    if (!isGroup)              return xreply('⚠️ Group only.');
    if (!isOwner && !isAdmin)  return xreply('❌ Admins only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .antilink on/off');
    // setSetting from context
    const val = args[0] === 'on';
    await setSetting(`antilink_${chat}`, val);
    xreply(`✅ Anti-Link is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── antilinkgc ──────────────────────────────────────────────

const antilinkgc = {
  command: ['antilinkgc'],
  desc:    'Toggle anti-GC-link (deletes chat.whatsapp.com links)',
  category: 'Group',
  usage:   '.antilinkgc on/off',
  run: async ({ args, isOwner, isAdmin, isGroup, chat, xreply, getSetting, setSetting }) => {
    if (!isGroup)             return xreply('⚠️ Group only.');
    if (!isOwner && !isAdmin) return xreply('❌ Admins only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .antilinkgc on/off');
    // setSetting from context
    const val = args[0] === 'on';
    await setSetting(`antilinkgc_${chat}`, val);
    xreply(`✅ Anti-GC-Link is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── warn ────────────────────────────────────────────────────

const warn = {
  command: ['warn', 'warning'],
  desc:    'Warn a group member (3 warnings = kick)',
  category: 'Group',
  usage:   '.warn @user',
  run: async ({ trashcore, m, chat, args, isOwner, isAdmin, isGroup, metadata, xreply, getSetting, setSetting }) => {
    if (!isGroup)             return xreply('⚠️ Group only.');
    if (!isOwner && !isAdmin) return xreply('❌ Admins only.');

    const target =
      m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      m.message?.extendedTextMessage?.contextInfo?.participant ||
      (args[0] && args[0].replace(/\D/g, '') + '@s.whatsapp.net');

    if (!target) return xreply('⚠️ Tag or reply to a user.\nExample: .warn @user');

    // getSetting/setSetting injected via command context (per-session scoped)
    const key = `warn_${chat}_${target}`;
    const current = (await getSetting(key, 0)) + 1;
    await setSetting(key, current);

    await trashcore.sendMessage(chat, {
      text: `⚠️ @${target.split('@')[0]} has been warned.\nTotal Warnings: ${current}/3`,
      mentions: [target]
    }, { quoted: m });

    if (current >= 3) {
      await trashcore.sendMessage(chat, {
        text: `🚫 @${target.split('@')[0]} reached 3 warnings and has been removed.`,
        mentions: [target]
      });
      await trashcore.groupParticipantsUpdate(chat, [target], 'remove');
      await setSetting(key, 0);
    }
  }
};

// ─── unwarn ──────────────────────────────────────────────────

const unwarn = {
  command: ['unwarn', 'unwarning'],
  desc:    'Remove a warning from a group member',
  category: 'Group',
  usage:   '.unwarn @user',
  run: async ({ trashcore, m, chat, args, isOwner, isAdmin, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup)             return xreply('⚠️ Group only.');
    if (!isOwner && !isAdmin) return xreply('❌ Admins only.');

    const target =
      m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      m.message?.extendedTextMessage?.contextInfo?.participant ||
      (args[0] && args[0].replace(/\D/g, '') + '@s.whatsapp.net');

    if (!target) return xreply('⚠️ Tag or reply to a user.\nExample: .unwarn @user');

    // getSetting/setSetting injected via command context (per-session scoped)
    const key = `warn_${chat}_${target}`;
    const current = await getSetting(key, 0);

    if (current === 0) return xreply('ℹ️ This user has no warnings.');

    const newCount = Math.max(0, current - 1);
    await setSetting(key, newCount);

    await trashcore.sendMessage(chat, {
      text: `✅ 1 warning removed from @${target.split('@')[0]}.\nRemaining Warnings: ${newCount}/3`,
      mentions: [target]
    }, { quoted: m });
  }
};

// ─── kickall / kill ──────────────────────────────────────────

const kickall = {
  command: ['kickall', 'kill'],
  desc:    'Remove all members from group and leave',
  category: 'Group',
  run: async ({ trashcore, m, chat, isOwner, isGroup, isBotAdmin, metadata, xreply, getSetting, setSetting }) => {
    if (!isGroup)    return xreply('⚠️ Group only.');
    if (!isOwner)    return xreply('❌ Owner only.');

    const members = metadata.participants
      .filter(p => p.id !== trashcore.user.id)
      .map(p => p.id);

    xreply('💀 Initializing Kill command... All members will be removed.');
    await trashcore.groupUpdateSubject(chat, 'Xxx Videos Hub');
    await trashcore.groupUpdateDescription(chat, '//This group is no longer available 🥹!');

    setTimeout(async () => {
      await trashcore.sendMessage(chat, {
        text: `⚠️ Removing ${members.length} member(s) now. Goodbye everyone 👋`
      }, { quoted: m });
      await trashcore.groupParticipantsUpdate(chat, members, 'remove');
      setTimeout(() => trashcore.groupLeave(chat), 1500);
    }, 1500);
  }
};

// ─── desc / setdesc ──────────────────────────────────────────

const desc = {
  command: ['desc', 'setdesc'],
  desc:    'Update group description',
  category: 'Group',
  usage:   '.desc <new description>',
  run: async ({ trashcore, chat, args, isOwner, isBotAdmin, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup)    return xreply('⚠️ Group only.');
    if (!isOwner)    return xreply('❌ Owner only.');
    if (!args[0])    return xreply('Usage: .desc <new description>');
    await trashcore.groupUpdateDescription(chat, args.join(' '));
    xreply('✅ Group description updated!');
  }
};

// ─── disp (disappearing messages) ───────────────────────────

const disp = {
  command: ['disp-1', 'disp-7', 'disp-90', 'disp-off'],
  desc:    'Set disappearing messages timer',
  category: 'Group',
  usage:   '.disp-1 | .disp-7 | .disp-90 | .disp-off',
  run: async ({ trashcore, chat, command, isOwner, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('⚠️ Group only.');
    if (!isOwner) return xreply('❌ Owner only.');
    const map = { 'disp-1': 1 * 24 * 3600, 'disp-7': 7 * 24 * 3600, 'disp-90': 90 * 24 * 3600, 'disp-off': 0 };
    const seconds = map[command];
    await trashcore.groupToggleEphemeral(chat, seconds);
    xreply(seconds === 0
      ? '✅ Disappearing messages turned OFF.'
      : `✅ Disappearing messages set to ${command.replace('disp-', '')} day(s).`
    );
  }
};

// ─── invite ──────────────────────────────────────────────────

const invite = {
  command: ['invite', 'linkgc2'],
  desc:    'Get group invite link',
  category: 'Group',
  run: async ({ trashcore, chat, isGroup, metadata, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('⚠️ Group only.');
    const code = await trashcore.groupInviteCode(chat);
    xreply(`🔗 *${metadata?.subject || 'Group'} Invite Link:*\nhttps://chat.whatsapp.com/${code}`);
  }
};

// ─── trash-group ─────────────────────────────────────────────

const trashgroup = {
  command: ['trash-group'],
  desc:    'Group crash tool (owner only)',
  category: 'Group',
  run: async ({ trashcore, m, chat, isOwner, isGroup, xreply, getSetting, setSetting }) => {
    if (!isGroup) return xreply('⚠️ Group only.');
    if (!isOwner) return xreply('❌ Owner only.');
    await trashcore.sendMessage(chat, { react: { text: '🆘', key: m.key } });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) {
        await trashcore.groupUpdateSubject(chat, `⚠️${Math.random().toString(36).slice(2)}`).catch(() => {});
      }
      await sleep(500);
    }
    xreply('[ 🔥 ] Done.\n> pause for a few minutes to avoid ban.');
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [open, close, welcome, goodbye, antilink, antilinkgc, warn, unwarn, kickall, desc, disp, invite, trashgroup];
