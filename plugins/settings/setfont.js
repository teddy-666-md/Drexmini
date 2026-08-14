// ============================================================
//  TELEXWA — by Trashcore
//  plugins/settings/setfont.js  |  Font Management Command
// ============================================================

const { getFontList, FONTS } = require('../../utils/fontConverter');

// ─── helper: preview text in a given font ───────────────────
function previewFont(fontName, text) {
  if (fontName === 'normal' || !FONTS[fontName]) return text;
  const font    = FONTS[fontName];
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits  = '0123456789';
  let result = '';
  for (const ch of text) {
    const l = lower.indexOf(ch);  if (l !== -1) { result += [...font.lower][l]  || ch; continue; }
    const u = upper.indexOf(ch);  if (u !== -1) { result += [...font.upper][u]  || ch; continue; }
    const d = digits.indexOf(ch); if (d !== -1) { result += [...font.digits][d] || ch; continue; }
    result += ch;
  }
  return result;
}

// ─── setfont ────────────────────────────────────────────────

const setfont = {
  command:  ['setfont', 'font', 'botfont'],
  desc:     'Set bot reply font style. Owner only.',
  category: 'Settings',
  isOwner:  true,
  usage:    '.setfont <name> | .setfont list | .setfont normal (to reset)',

  run: async ({ xreply, args, isSelf, getSetting, setSetting }) => {
    if (!isSelf) return xreply('❌ Owner only command.');

    const fonts   = getFontList();
    const current = getSetting('font', 'normal');
    const input   = (args[0] || '').toLowerCase();

    // ── list all fonts ───────────────────────────────────────
    if (!input || input === 'list') {
      let text = `🖋️ Bot Font Styles\n${'─'.repeat(20)}\n\nCurrent: ${current}\n\n`;
      fonts.forEach((name, i) => {
        const preview = previewFont(name, 'Hello 123');
        const tick    = name === current ? ' ✅' : '';
        text += `${i + 1}. ${name} — ${preview}${tick}\n`;
      });
      text += `\n${'─'.repeat(20)}\nUsage: .setfont <name>\nExample: .setfont gothic\nReset: .setfont normal`;
      return xreply(text);
    }

    // ── pick by number ───────────────────────────────────────
    let fontName = input;
    if (/^\d+$/.test(input)) {
      const idx = parseInt(input) - 1;
      if (idx < 0 || idx >= fonts.length)
        return xreply(`❌ Pick a number between 1 and ${fonts.length}.`);
      fontName = fonts[idx];
    }

    if (!FONTS[fontName])
      return xreply(`❌ Font "${fontName}" not found.\n\nUse .setfont list to see all options.`);

    setSetting('font', fontName);

    const preview = previewFont(fontName, 'Bot font updated!');
    return xreply(
      fontName === 'normal'
        ? `✅ Font reset to normal.`
        : `✅ Font set to ${fontName}\n\nPreview: ${preview}`
    );
  }
};

// ─── exports ────────────────────────────────────────────────

module.exports = [setfont];
