// ============================================================
//  TELEXWA — by Trashcore
//  plugins/settings/extPlugins.js  |  External plugin manager commands
//  Commands: .plug install <id>, .plug remove <id>,
//            .plug list, .plug installed
//  Ported from Trashcore Ultra — adapted to TelexWa structure
// ============================================================

const path = require('path');

// Resolve manager from bot root — graceful fallback if not present
let installPlugin, removePlugin, listPlugins, listInstalled;
try {
  const managerPath = path.join(__dirname, '..', '..', 'extPluginManager.js');
  const manager = require(managerPath);
  installPlugin = manager.installPlugin;
  removePlugin  = manager.removePlugin;
  listPlugins   = manager.listPlugins;
  listInstalled = manager.listInstalled;
} catch {
  const notAvailable = () => '❌ extPluginManager.js not found. Place it in the bot root to enable plugin management.';
  installPlugin = async () => ({ msg: notAvailable() });
  removePlugin  = ()       => ({ msg: notAvailable() });
  listPlugins   = ()       => notAvailable();
  listInstalled = ()       => notAvailable();
}

// ──────────────────────────────────────────────────────────────

const plugCommand = {
  command:  ['plug', 'plugin', 'extplug'],
  desc:     'Manage optional external plugins',
  category: 'Settings',
  owner:    true,

  run: async ({ trashcore, m, args, text, xreply, isOwner }) => {

    if (!isOwner) {
      return xreply('❌ Only the bot owner can manage plugins.');
    }

    const sub = (args[0] || '').toLowerCase();

    // ── .plug list ─────────────────────────────────────
    if (sub === 'list' || sub === 'store') {
      const result = listPlugins();
      return xreply(result);
    }

    // ── .plug installed ────────────────────────────────
    if (sub === 'installed') {
      const result = listInstalled();
      return xreply(result);
    }

    // ── .plug install <id> ─────────────────────────────
    if (sub === 'install' || sub === 'add') {
      const plugId = args[1];
      if (!plugId) {
        return xreply(
          `📦 *Plugin Installer*\n\n` +
          `Usage: *.plug install <plugin-id>*\n` +
          `Example: *.plug install lyrics*\n\n` +
          `Run *.plug list* to see available plugins.`
        );
      }

      await xreply(`⏳ Installing plugin *${plugId}*...`);
      const result = await installPlugin(plugId);
      return xreply(result.msg);
    }

    // ── .plug remove <id> ──────────────────────────────
    if (sub === 'remove' || sub === 'uninstall' || sub === 'del') {
      const plugId = args[1];
      if (!plugId) {
        return xreply(
          `📦 *Plugin Remover*\n\n` +
          `Usage: *.plug remove <plugin-id>*\n` +
          `Example: *.plug remove lyrics*\n\n` +
          `Run *.plug installed* to see installed plugins.`
        );
      }

      const result = removePlugin(plugId);
      return xreply(result.msg);
    }

    // ── .plug (no sub) — help ──────────────────────────
    return xreply(
      `╔══════════════════════════╗\n` +
      `║   📦 PLUGIN MANAGER      ║\n` +
      `╚══════════════════════════╝\n\n` +
      `*.plug list*         — Browse available plugins\n` +
      `*.plug installed*    — See installed plugins\n` +
      `*.plug install <id>* — Install a plugin\n` +
      `*.plug remove <id>*  — Remove a plugin\n\n` +
      `_Example: .plug install lyrics_`
    );
  }
};

module.exports = [plugCommand];
