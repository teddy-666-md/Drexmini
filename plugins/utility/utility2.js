// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/utility/utility2.js  |  Extended Utility Commands
// ============================================================

const axios = require('axios');

// ─── weather ─────────────────────────────────────────────────

const weather = {
  command: ['weather'],
  desc:    'Get current weather for a city',
  category: 'Utility',
  usage:   '.weather <city>',
  run: async ({ args, xreply }) => {
    if (!args[0]) return xreply('Usage: .weather <city name>');
    try {
      const city = args.join(' ');
      const { data: d } = await axios.get(
        `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=1ad47ec6172f19dfaf89eb3307f74785`
      );
      if (d.cod !== 200) return xreply(`❌ City not found: ${city}`);
      const sunrise = new Date(d.sys.sunrise * 1000).toLocaleTimeString();
      const sunset  = new Date(d.sys.sunset  * 1000).toLocaleTimeString();
      xreply(
        `❄️ Weather in *${d.name}*\n\n` +
        `🌡️ Temperature : ${d.main.temp}°C (feels like ${d.main.feels_like}°C)\n` +
        `📝 Description : ${d.weather[0].description}\n` +
        `❄️ Humidity    : ${d.main.humidity}%\n` +
        `🌀 Wind Speed  : ${d.wind.speed} m/s\n` +
        `🌧️ Rain (1h)   : ${d.rain ? d.rain['1h'] : 0} mm\n` +
        `☁️ Cloudiness  : ${d.clouds.all}%\n` +
        `🌄 Sunrise     : ${sunrise}\n` +
        `🌅 Sunset      : ${sunset}`
      );
    } catch (e) {
      xreply('❌ Unable to fetch weather. Try again.');
    }
  }
};

// ─── save (status saver) ─────────────────────────────────────

const save = {
  command: ['save'],
  desc:    'Save a WhatsApp status (reply to a status)',
  category: 'Utility',
  usage:   '.save (reply to a status)',
  run: async ({ trashcore, m, senderJid, xreply }) => {
    try {
      const { downloadContentFromMessage } = require('@trashcore/baileys');
      const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMessage) return xreply('❌ Reply to a status message first.');

      const isStatus =
        m.quoted?.key?.remoteJid?.endsWith('@broadcast') ||
        m.message?.extendedTextMessage?.contextInfo?.remoteJid?.endsWith('@broadcast');
      if (!isStatus) return xreply('⚠️ That is not a status! Reply to a status message.');

      let mediaMsg, mediaType, mimetype, caption;

      if (quotedMessage.imageMessage) {
        mediaMsg  = quotedMessage.imageMessage;
        mediaType = 'image';
        mimetype  = 'image/jpeg';
        caption   = mediaMsg.caption || '📸 Saved status image';
      } else if (quotedMessage.videoMessage) {
        mediaMsg  = quotedMessage.videoMessage;
        mediaType = 'video';
        mimetype  = 'video/mp4';
        caption   = mediaMsg.caption || '🎥 Saved status video';
      } else {
        return xreply('❌ Only image and video statuses can be saved!');
      }

      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      if (!buffer || buffer.length === 0)
        return xreply('🚫 Could not download the status. It may have expired.');

      await trashcore.sendMessage(senderJid, { [mediaType]: buffer, caption, mimetype }, { quoted: m });
      xreply(`✅ ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} saved to your DM!`);
    } catch (err) {
      console.error('Save error:', err);
      xreply('❌ Failed to save status. Error: ' + err.message);
    }
  }
};

// ─── idch / cekidch ──────────────────────────────────────────

const idch = {
  command: ['idch', 'cekidch'],
  desc:    'Get info and ID of a WhatsApp channel',
  category: 'Utility',
  usage:   '.idch <channel link>',
  run: async ({ trashcore, args, xreply }) => {
    if (!args[0]) return xreply('Usage: .idch https://whatsapp.com/channel/...');
    if (!args[0].includes('https://whatsapp.com/channel/'))
      return xreply('❌ Must be a valid WhatsApp channel link.');
    try {
      const code = args[0].split('https://whatsapp.com/channel/')[1];
      const res  = await trashcore.newsletterMetadata('invite', code);
      xreply(
        `📢 *Channel Info*\n\n` +
        `• *ID*        : ${res.id}\n` +
        `• *Name*      : ${res.name}\n` +
        `• *Followers* : ${res.subscribers}\n` +
        `• *Status*    : ${res.state}\n` +
        `• *Verified*  : ${res.verification === 'VERIFIED' ? '✅ Yes' : '❌ No'}`
      );
    } catch (err) {
      xreply('❌ Failed to fetch channel info. Check the link.');
    }
  }
};

// ─── request / suggest ───────────────────────────────────────

const request = {
  command: ['request', 'suggest'],
  desc:    'Send a request or bug report to the dev',
  category: 'Utility',
  usage:   '.request <your message>',
  run: async ({ trashcore, m, senderJid, args, xreply }) => {
    if (!args[0]) return xreply('Usage: .request <your message or bug>');
    const text    = args.join(' ');
    const groupId = '120363400441291112@g.us';
    const header  = '*| REQUEST / SUGGESTION |*';
    const body    = `\n\n*User* : @${senderJid.split('@')[0]}\n*Message* : ${text}`;
    try {
      await trashcore.sendMessage(groupId, { text: header + body, mentions: [senderJid] }, { quoted: m });
    } catch (_) {}
    xreply(`${header}\n\n✅ Your request has been forwarded!\n\n*Your message:* ${text}`);
  }
};

// ─── tourl ───────────────────────────────────────────────────

const tourl = {
  command: ['tourl', 'imgurl'],
  desc:    'Upload a replied image and get its public URL',
  category: 'Utility',
  usage:   '.tourl (reply to image)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg?.imageMessage) return xreply('❌ Reply to an image first.');

      const { downloadContentFromMessage } = require('@trashcore/baileys');
      const stream = await downloadContentFromMessage(quotedMsg.imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, { filename: 'upload.png', contentType: 'image/png' });

      const { data } = await axios.post('https://telegra.ph/upload', form, {
        headers: form.getHeaders()
      });

      if (!data || !data[0]?.src) return xreply('❌ Upload failed. Try again.');
      xreply(`✅ *Image URL:*\nhttps://telegra.ph${data[0].src}`);
    } catch (err) {
      console.error('tourl error:', err);
      xreply('❌ Upload failed: ' + err.message);
    }
  }
};

// ─── encrypt / enc ───────────────────────────────────────────

const encrypt = {
  command: ['enc', 'encrypt'],
  desc:    'Obfuscate a .js file (reply to the file)',
  category: 'Utility',
  usage:   '.enc (reply to a .js document)',
  run: async ({ trashcore, m, chat, isOwner, xreply }) => {
    if (!isOwner) return xreply('❌ Owner only.');
    try {
      const JsConfuser = require('js-confuser');
      const quotedMsg  = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedDoc  = quotedMsg?.documentMessage;
      if (!quotedDoc || !quotedDoc.fileName?.endsWith('.js'))
        return xreply('❌ Reply to a .js file to encrypt it.');

      await trashcore.sendMessage(chat, { react: { text: '🕛', key: m.key } });

      const { downloadContentFromMessage } = require('@trashcore/baileys');
      const stream = await downloadContentFromMessage(quotedDoc, 'document');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const obfuscated = await JsConfuser.obfuscate(buffer.toString(), {
        target: 'node',
        preset: 'high',
        compact: true,
        minify: true,
        controlFlowFlattening: 1.0,
        stringConcealing: true,
        stringEncoding: true,
        renameVariables: true,
        renameGlobals: true,
        hexadecimalNumbers: true,
      });

      await trashcore.sendMessage(chat, {
        document: Buffer.from(obfuscated, 'utf-8'),
        mimetype: 'application/javascript',
        fileName: quotedDoc.fileName,
        caption:  `✅ Encrypted successfully\n📄 File: ${quotedDoc.fileName}\n⚙️ Type: High Obfuscation\n> @Tennormodz`
      }, { quoted: m });
    } catch (err) {
      console.error('Encrypt error:', err);
      xreply('❌ Encryption failed: ' + err.message);
    }
  }
};

// ─── take (sticker re-pack) ──────────────────────────────────

const take = {
  command: ['take'],
  desc:    'Re-pack a sticker/image/video with your username as watermark',
  category: 'Utility',
  usage:   '.take (reply to sticker or image)',
  run: async ({ trashcore, m, chat, senderJid, pushName, xreply }) => {
    try {
      const { Sticker, StickerTypes } = require('wa-sticker-formatter');
      const { downloadContentFromMessage } = require('@trashcore/baileys');
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg) return xreply('❌ Reply to an image, video, or sticker.');

      const mediaType = quotedMsg.imageMessage   ? 'image'
                      : quotedMsg.videoMessage   ? 'video'
                      : quotedMsg.stickerMessage ? 'sticker'
                      : null;
      if (!mediaType) return xreply('❌ Not a sticker, image, or video.');

      const stream = await downloadContentFromMessage(quotedMsg[`${mediaType}Message`], mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // Use sender's display name (pushName), fallback to number
      const senderName = pushName || m.pushName || senderJid.split('@')[0];
      const sticker = new Sticker(buffer, {
        pack:    senderName,
        author:  senderName,
        type:    StickerTypes.FULL,
        quality: 70,
        background: 'transparent'
      });

      await trashcore.sendMessage(chat, { sticker: await sticker.toBuffer() }, { quoted: m });
    } catch (err) {
      console.error('take error:', err);
      xreply('❌ Failed to create sticker: ' + err.message);
    }
  }
};

// ─── sponsor ─────────────────────────────────────────────────
// Ported from Trashcore Ultra

const sponsor = {
  command: ['sponsor', 'sponsors'],
  desc:    'Show the bot sponsors and contributors',
  category: 'Utility',
  usage:   '.sponsor',
  run: async ({ xreply }) => {
    xreply(
      `╔══════════════════════╗\n` +
      `║   🌟 *BOT SPONSORS* 🌟   ║\n` +
      `╚══════════════════════╝\n\n` +
      `👑 *Tennor-modz*\n` +
      `┗ The Trashcore company owner, @trashcore/baileys keeper and the bot creator\n\n` +
      `💡 *Supreme*\n` +
      `┗ Idea master, assistant in commands creation and addition\n\n` +
      `⚙️ *Apis*\n` +
      `┗ The Keith API and Nex Ray API are the co-apis that make our bot's requests work successfully\n\n` +
      `> _Without these hands, this bot is nothing_ 🙏`
    );
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [weather, save, idch, request, tourl, encrypt, take, sponsor];
