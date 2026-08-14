// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/utility/utility.js  |  All Utility Commands
// ============================================================

const os = require('os');
const { plugins }   = require('../../pluginStore');

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

function detectPlatform() {
  if (process.env.TRASHBOTS)   return 'TrashBots';
  if (process.env.DYNO)        return 'Heroku';
  if (process.env.RENDER)      return 'Render';
  if (process.env.P_SERVER_UUID) return 'Panel';
  if (process.env.LXC)         return 'Linux Container (LXC)';
  switch (os.platform()) {
    case 'win32':  return 'Windows';
    case 'darwin': return 'macOS';
    case 'linux':  return 'Linux';
    default:       return 'Unknown';
  }
}

function groupByCategory(plugins) {
  const categories = {};
  for (const plugin of plugins.values()) {
    const category = plugin.category || 'Uncategorized';
    if (!categories[category]) categories[category] = [];
    const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
    for (const cmd of cmds) {
      const display = plugin.isOwner ? `${cmd} (owner)` : cmd;
      if (!categories[category].includes(display)) categories[category].push(display);
    }
  }
  return categories;
}

// ─── menu loader ─────────────────────────────────────────────

async function runMenuLoader(trashcore, chat) {
  const sent = await trashcore.sendMessage(chat, {
    text: '_cloning ultra x menu..._'
  });
  return sent.key;
}

// ─── menu ────────────────────────────────────────────────────

const menu = {
  command: ['menu', 'help'],
  desc:    'Show command list and bot status',
  run: async ({ trashcore, m, chat, botStartTime, getSetting, setSetting, applyFont }) => {
    const startTime     = botStartTime || global.botStartTime || Date.now();
    const uptimeSeconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const uptime        = formatUptime(uptimeSeconds);

    const prefix      = getSetting('prefix', '.');
    const privateMode = getSetting('privateMode', false);
    const mode        = privateMode ? 'PRIVATE' : 'PUBLIC';
    const totalCmds   = plugins.size;
    const ramMB       = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const platform    = detectPlatform();
    const ownerName   = getSetting('ownerName', 'Trashcore');
    const grouped     = groupByCategory(plugins);

    // ── Show loader first ──────────────────────────────────
    const loaderKey = await runMenuLoader(trashcore, chat);

    let commandsText = '';
    for (const [category, cmds] of Object.entries(grouped)) {
      commandsText += `\n┏━━━━ 📂 *${category}*\n`;
      cmds.sort();
      commandsText += cmds.map(cmd => `┃⭔ ${prefix}${cmd}`).join('\n') + '\n';
      commandsText += `┗━━━━━━━━━━━━━━━━━\n`;
    }

    const header =
      `╔══════════════════════╗\n` +
      `║   🥷 *TRASHCORE BOT*   ║\n` +
      `╚══════════════════════╝\n\n` +
      `✦ Owner  : ${ownerName}\n` +
      `✦ Prefix : ${prefix}\n` +
      `✦ Mode   : ${mode}\n` +
      `✦ Cmds   : ${totalCmds}\n` +
      `✦ Uptime : ${uptime}\n` +
      `✦ RAM    : ${ramMB} MB\n` +
      `✦ WEB    : www.drexapp.space\n` +
      `✦ Host   : ${platform}\n`;

    const fullText = applyFont ? applyFont(header + commandsText) : (header + commandsText);

    // ── Delete loader then send interactive menu ───────────
    await trashcore.sendMessage(chat, { delete: loaderKey }).catch(() => {});

    const { generateWAMessageFromContent } = require('@trashcore/baileys');

    const msgContent = generateWAMessageFromContent(chat, {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: {
            body: {
              text: fullText
            },
            footer: {
              text: `📦 Trashcore • ${totalCmds} commands loaded`
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "🌐 Visit Website",
                    url: "https://api.drexapp.space",
                    merchant_url: "https://api.drexapp.space"
                  })
                },
                {
                  name: "cta_url",
                  buttonParamsJson: JSON.stringify({
                    display_text: "📤 Media Uploader",
                    url: "https://uploader.drexapp.space",
                    merchant_url: "https://uploader.drexapp.space"
                  })
                },
                {
                  name: "cta_copy",
                  buttonParamsJson: JSON.stringify({
                    display_text: "📋 Copy Prefix",
                    copy_code: prefix
                  })
                }
              ]
            }
          }
        }
      }
    }, { quoted: m });

    await trashcore.relayMessage(chat, msgContent.message, { messageId: msgContent.key.id });
  }
};
// ─── ping ────────────────────────────────────────────────────

const ping = {
  command: ['ping', 'p'],
  desc:    'Check bot latency',
  category: 'Utility',
  usage:   '.ping',
  run: async ({ m, xreply }) => {
    const start = Date.now();
    await xreply('Pinging...');
    await xreply(`📍 Pong: ${Date.now() - start} ms`);
  }
};

// ─── runtime ─────────────────────────────────────────────────

const runtime = {
  command: ['runtime', 'uptime', 'host'],
  desc:    'Check bot runtime and hosting platform',
  category: 'Utility',
  usage:   '.runtime',
  run: async ({ m, xreply }) => {
    const host   = detectPlatform();
    const uptime = formatUptime(process.uptime());
    await xreply(
      `*🤖 TRASHCORE ULTRA*\n\n📡 *Platform:* ${host}\n⏱️ *Runtime:* ${uptime}\n🔄 *Status:* Active\n\n> Bot is running smoothly on ${host}`
    );
  }
};

// ─── exports ────────────────────────────────────────────────

module.exports = [menu, ping, runtime];
