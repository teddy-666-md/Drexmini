// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/utility/antiviewonce.js  |  AntiViewOnce Toggle
// ============================================================

const antiviewonce = {
  command: ['antiviewonce', 'avv'],
  desc:    'Toggle automatic view-once media capture',
  category: 'Utility',
  usage:   '.antiviewonce on/off',
  run: async ({ args, isOwner, xreply, getSetting, setSetting }) => {
    if (!isOwner) return xreply('❌ Owner only.');

    const current = global.antiViewOnceEnabled ? 'ON ✅' : 'OFF ❌';

    if (!args[0] || args[0] === 'status') {
      return xreply(
        `👁️ *Anti-ViewOnce*\n\n` +
        `Status  : *${current}*\n\n` +
        `• \`.antiviewonce on\`  — enable\n` +
        `• \`.antiviewonce off\` — disable\n` +
        `• \`.avv on/off\`       — shorthand`
      );
    }

    const val    = args[0].toLowerCase();
    const enable = val === 'on';

    // Use the global controller if available
    if (global._antiViewOnce) {
      enable ? global._antiViewOnce.enable() : global._antiViewOnce.disable();
    } else {
      global.antiViewOnceEnabled = enable;
    }

    xreply(
      `👁️ *Anti-ViewOnce* is now: *${enable ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      `${enable
        ? '_Every view-once message received will be forwarded to your DM._'
        : '_View-once messages will no longer be captured._'}`
    );
  }
};

module.exports = [antiviewonce];
