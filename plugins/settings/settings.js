// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/settings/settings.js  |  Bot Settings Commands
// ============================================================

// getSetting/setSetting injected via command context (per-session scoped)

// ─── autotyping ──────────────────────────────────────────────

const autotyping = {
  command: ['autotyping'],
  desc:    'Toggle auto typing indicator',
  category: 'Settings',
  usage:   '.autotyping on/off',
  run: async ({ args, isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .autotyping on/off');
    const val = args[0] === 'on';
    await setSetting('autoTyping', val);
    xreply(`✅ Auto Typing is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── autorecord ──────────────────────────────────────────────

const autorecord = {
  command: ['autorecord'],
  desc:    'Toggle auto recording indicator',
  category: 'Settings',
  usage:   '.autorecord on/off',
  run: async ({ args, isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .autorecord on/off');
    const val = args[0] === 'on';
    await setSetting('autoRecord', val);
    xreply(`✅ Auto Record is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── autobio ─────────────────────────────────────────────────

const autobio = {
  command: ['autobio'],
  desc:    'Toggle auto bio updater (shows uptime in bio)',
  category: 'Settings',
  usage:   '.autobio on/off',
  run: async ({ args, isOwner, trashcore, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .autobio on/off');
    const val = args[0] === 'on';
    await setSetting('autoBio', val);
    if (val) {
      const uptime = process.uptime();
      const d = Math.floor(uptime / 86400), h = Math.floor((uptime % 86400) / 3600),
            m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
      await trashcore.updateProfileStatus(`✳️ TRASHCORE BOT || ✅ Runtime: ${d}d ${h}h ${m}m ${s}s`);
    }
    xreply(`✅ Auto Bio is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── onlygroup ───────────────────────────────────────────────

const onlygroup = {
  command: ['onlygroup', 'onlygc'],
  desc:    'Restrict bot to groups only',
  category: 'Settings',
  usage:   '.onlygroup on/off',
  run: async ({ args, isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .onlygroup on/off');
    const val = args[0] === 'on';
    await setSetting('onlyGroup', val);
    xreply(`✅ Only Group mode is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── onlypc ──────────────────────────────────────────────────

const onlypc = {
  command: ['onlypc'],
  desc:    'Restrict bot to private chats only',
  category: 'Settings',
  usage:   '.onlypc on/off',
  run: async ({ args, isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .onlypc on/off');
    const val = args[0] === 'on';
    await setSetting('onlyPC', val);
    xreply(`✅ Only Private Chat mode is now: ${val ? 'ON' : 'OFF'}`);
  }
};

// ─── unavailable ─────────────────────────────────────────────

const unavailable = {
  command: ['unavailable'],
  desc:    'Toggle bot online/unavailable presence',
  category: 'Settings',
  usage:   '.unavailable on/off',
  run: async ({ args, isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    if (!args[0] || !['on','off'].includes(args[0])) return xreply('Usage: .unavailable on/off');
    const val = args[0] === 'on';
    await setSetting('unavailable', val);
    xreply(`✅ Unavailable mode is now: ${val ? 'ON (bot appears offline)' : 'OFF (bot appears online)'}`);
  }
};

// ─── script / repo info ──────────────────────────────────────

const script = {
  command: ['script', 'botinfo'],
  desc:    'Show bot info and repository',
  category: 'Settings',
  run: async ({ trashcore, xreply, getSetting, setSetting }) => {
    const uptime = process.uptime();
    const d = Math.floor(uptime / 86400), h = Math.floor((uptime % 86400) / 3600),
          m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
    xreply(
      `╭─ ⌬ Bot Info\n` +
      `│ • Name    : TRASHCORE ULTRA\n` +
      `│ • Owner   : Trashcore Devs\n` +
      `│ • Repo    : github.com/Tennor-modz/trashcore-ultra\n` +
      `│ • Runtime : ${d}d ${h}h ${m}m ${s}s\n` +
      `╰─────────────`
    );
  }
};

// ─── update / redeploy ───────────────────────────────────────

const update = {
  command: ['update', 'redeploy'],
  desc:    'Trigger Heroku redeploy',
  category: 'Settings',
  usage:   '.update',
  run: async ({ isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    const axios = require('axios');
    const appname  = process.env.APP_NAME;
    const herokuapi = process.env.HEROKU_API;
    if (!appname || !herokuapi)
      return xreply('⚠️ Set APP_NAME and HEROKU_API environment variables first.');
    try {
      await axios.post(
        `https://api.heroku.com/apps/${appname}/builds`,
        { source_blob: { url: 'https://github.com/Tennor-modz/trashcore-ultra/tarball/main' } },
        { headers: { Authorization: `Bearer ${herokuapi}`, Accept: 'application/vnd.heroku+json; version=3' } }
      );
      xreply('🔄 Redeploy triggered! Bot will restart in ~2 minutes with the latest version.');
    } catch (err) {
      xreply('❌ Redeploy failed. Check your HEROKU_API and APP_NAME.');
    }
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [autotyping, autorecord, autobio, onlygroup, onlypc, unavailable, script, update];
