// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/settings/settings2.js  |  Extended Settings & Media Tools
// ============================================================

const { downloadContentFromMessage } = require('@trashcore/baileys');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── sudo helper (shared with admin2) ────────────────────────

function isSudoUser(bareNumber, getSetting) {
  const CREATOR = '254104245659';
  if (bareNumber === CREATOR) return true;
  const list = getSetting('sudoUsers', []);
  const now  = Date.now();
  return list.some(e => e.number === bareNumber && (!e.expiresAt || e.expiresAt > now));
}

// ─── setmenu ─────────────────────────────────────────────────

const setmenu = {
  command: ['setmenu'],
  desc:    'Set menu display mode: text | image | video',
  category: 'Settings',
  usage:   '.setmenu text|image|video',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    if (!isOwner && !isSudoUser(sender, getSetting)) return xreply('❌ Owner only.');
    const type = args[0]?.toLowerCase();
    if (!type || !['text', 'image', 'video'].includes(type)) {
      return xreply(`⚙️ Usage: .setmenu text|image|video\n\n• text  = plain text menu\n• image = menu with photo\n• video = menu with looping gif`);
    }
    const settings = getSetting('menuSettings', {});
    settings.mode = type;
    setSetting('menuSettings', settings);
    xreply(`✅ Menu mode updated to: *${type.toUpperCase()}*`);
  }
};

// ─── setmenuimage ────────────────────────────────────────────

const setmenuimage = {
  command: ['setmenuimage'],
  desc:    'Set the image URL used when menu mode is "image"',
  category: 'Settings',
  usage:   '.setmenuimage <image_url>',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    if (!isOwner && !isSudoUser(sender, getSetting)) return xreply('❌ Owner only.');
    const url = args[0];
    if (!url) return xreply('⚙️ Usage: .setmenuimage <image_url>\nExample: .setmenuimage https://files.catbox.moe/xxx.jpg');
    if (!/^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url))
      return xreply('❌ Invalid image URL. Must end with .jpg, .png, .gif, or .webp');
    const settings = getSetting('menuSettings', {});
    settings.imageUrl = url;
    setSetting('menuSettings', settings);
    xreply(`✅ Menu image updated!\n🖼️ ${url}`);
  }
};

// ─── setmenuvideo ────────────────────────────────────────────

const setmenuvideo = {
  command: ['setmenuvideo'],
  desc:    'Set the video URL used when menu mode is "video"',
  category: 'Settings',
  usage:   '.setmenuvideo <video_url>',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    if (!isOwner && !isSudoUser(sender, getSetting)) return xreply('❌ Owner only.');
    const url = args[0];
    if (!url) return xreply('⚙️ Usage: .setmenuvideo <video_url>\nExample: .setmenuvideo https://files.catbox.moe/xxx.mp4');
    if (!/^https?:\/\/\S+\.(mp4|mov|webm)(\?.*)?$/i.test(url))
      return xreply('❌ Invalid video URL. Must end with .mp4, .mov, or .webm');
    const settings = getSetting('menuSettings', {});
    settings.videoUrl = url;
    setSetting('menuSettings', settings);
    xreply(`✅ Menu video updated!\n🎞️ ${url}`);
  }
};

// ─── autoread ────────────────────────────────────────────────

const autoread = {
  command: ['autoread'],
  desc:    'Toggle auto-read (mark messages as seen automatically)',
  category: 'Settings',
  usage:   '.autoread on/off',
  run: async ({ isOwner, sender, args, xreply, getSetting, setSetting }) => {
    if (!isOwner && !isSudoUser(sender, getSetting)) return xreply('❌ Owner only.');
    const option = args[0]?.toLowerCase();
    if (!option || !['on', 'off'].includes(option)) {
      const current = getSetting('autoRead', false);
      return xreply(`📢 *Autoread Settings*\n• Status: ${current ? '✅ ON' : '❎ OFF'}\n\nUsage: .autoread on/off`);
    }
    const val = option === 'on';
    setSetting('autoRead', val);
    xreply(`${val ? '✅' : '❎'} Autoread is now: *${val ? 'ON' : 'OFF'}*`);
  }
};

// ─── checksettings ───────────────────────────────────────────

const checksettings = {
  command: ['checksettings'],
  desc:    'View all current bot settings',
  category: 'Settings',
  run: async ({ isOwner, sender, xreply, getSetting, setSetting }) => {
    if (!isOwner && !isSudoUser(sender, getSetting)) return xreply('❌ Owner only.');

    const autoTyping  = getSetting('autoTyping',  false);
    const autoRecord  = getSetting('autoRecord',  false);
    const autoRead    = getSetting('autoRead',     false);
    const autoBio     = getSetting('autoBio',      false);
    const onlyGroup   = getSetting('onlyGroup',    false);
    const onlyPC      = getSetting('onlyPC',       false);
    const privateMode = getSetting('privateMode',  false);
    const prefix      = getSetting('prefix',       '.');
    const ownerName   = getSetting('ownerName',    'Not set');
    const menuSettings = getSetting('menuSettings', { mode: 'text' });
    const antilink    = getSetting('antilink',     {});
    const antilinkgc  = getSetting('antilinkgc',   false);
    const sudoUsers   = getSetting('sudoUsers',    []).filter(e => !e.expiresAt || e.expiresAt > Date.now());

    const detectPlatform = () => {
      if (process.env.TRASHBOTS)     return 'TrashBots';
      if (process.env.DYNO)          return 'Heroku';
      if (process.env.RENDER)        return 'Render';
      if (process.env.P_SERVER_UUID) return 'Panel';
      if (process.env.LXC)           return 'Linux Container';
      switch (os.platform()) {
        case 'win32':  return 'Windows';
        case 'darwin': return 'macOS';
        case 'linux':  return 'Linux';
        default:       return 'Unknown';
      }
    };

    const summary = `📋 *BOT SETTINGS STATUS* ⚙️

🤖 *Bot Info:*
• Prefix: ${prefix}
• Owner Name: ${ownerName}
• Platform: ${detectPlatform()}
• RAM: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB

💬 *Presence Settings:*
• Autotyping: ${autoTyping ? '✅ ON' : '❎ OFF'}
• Autorecord: ${autoRecord ? '✅ ON' : '❎ OFF'}
• Autoread:   ${autoRead   ? '✅ ON' : '❎ OFF'}
• Autobio:    ${autoBio    ? '✅ ON' : '❎ OFF'}

🔒 *Mode Settings:*
• Private Mode: ${privateMode ? '✅ ON' : '❎ OFF'}
• Only Group:   ${onlyGroup  ? '✅ ON' : '❎ OFF'}
• Only PC:      ${onlyPC     ? '✅ ON' : '❎ OFF'}

🎨 *Menu Settings:*
• Mode: ${menuSettings.mode || 'text'}
• Image URL: ${menuSettings.imageUrl || 'Not set'}
• Video URL: ${menuSettings.videoUrl || 'Not set'}

🛡️ *Antilink:*
• Antilink (groups): ${Object.keys(antilink).length} group(s)
• Antilink GC links: ${antilinkgc ? '✅ ON' : '❎ OFF'}

👑 *Sudo Users:* ${sudoUsers.length}
${sudoUsers.map(e => `• +${e.number} (${e.expiresAt ? 'expires ' + new Date(e.expiresAt).toLocaleDateString() : 'permanent'})`).join('\n') || '• None'}`;

    xreply(summary.trim());
  }
};

// ─── checktime ───────────────────────────────────────────────

const checktime = {
  command: ['checktime', 'time'],
  desc:    'Check local time for any city/country',
  category: 'Tools',
  usage:   '.checktime <city>',
  run: async ({ args, text, xreply }) => {
    const query = args.join(' ').trim() || text.trim();
    if (!query) return xreply('🌍 Usage: .checktime <city>\nExample: .checktime Nairobi');

    xreply(`⏳ Checking local time for *${query}*...`);
    try {
      const axios = require('axios');
      const tzRes = await axios.get('https://worldtimeapi.org/api/timezone', { timeout: 10000 });
      const timezones = tzRes.data;
      const match = timezones.find(tz => tz.toLowerCase().includes(query.toLowerCase()));
      if (!match) return xreply(`❌ Could not find timezone for *${query}*.`);

      const res = await axios.get(`https://worldtimeapi.org/api/timezone/${match}`, { timeout: 10000 });
      const data = res.data;
      const datetime = new Date(data.datetime);
      const hours = datetime.getHours();
      const greeting = hours < 12 ? '🌅 Good Morning' : hours < 18 ? '🌞 Good Afternoon' : '🌙 Good Evening';

      xreply(`🕒 *Local Time — ${query}*\n\n${greeting} 👋\n📍 Timezone: ${data.timezone}\n⏰ Time: ${datetime.toLocaleTimeString()}\n📆 Date: ${datetime.toDateString()}`);
    } catch (e) {
      xreply('❌ Unable to fetch time for that city/country.');
    }
  }
};

// ─── slow / fast / deep / bass audio effects ─────────────────

const audioEffects = {
  command: ['slow', 'fast', 'deep', 'bass'],
  desc:    'Apply audio effects to a voice note / audio message',
  category: 'Tools',
  usage:   '.slow | .fast | .deep | .bass (reply to audio)',
  run: async ({ trashcore, m, chat, command, xreply }) => {
    try {
      const ffmpeg = require('fluent-ffmpeg');

      const contextInfo = m.message?.extendedTextMessage?.contextInfo;
      const quotedMsg   = m.quoted?.message || contextInfo?.quotedMessage;
      if (!quotedMsg) return xreply('⚠️ Reply to an *audio message* or *voice note*.');

      const msgType = Object.keys(quotedMsg).find(k => /audio|voice/i.test(k));
      if (!msgType) return xreply('⚠️ The replied message is not an audio or voice note.');

      const msg  = quotedMsg[msgType];
      const mime = msg.mimetype || '';
      if (!/audio/.test(mime)) return xreply('⚠️ The replied message is not an audio or voice note.');

      xreply('⏳ Processing audio...');

      const stream = await downloadContentFromMessage(msg, 'audio');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const inputPath  = path.join(os.tmpdir(), `input_${Date.now()}.mp3`);
      const outputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp3`);
      fs.writeFileSync(inputPath, buffer);

      const filterMap = {
        slow: 'atempo=0.7',
        fast: 'atempo=1.5',
        deep: 'asetrate=44100*0.8,aresample=44100',
        bass: 'bass=g=10'
      };

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters(filterMap[command])
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      const audioBuffer = fs.readFileSync(outputPath);
      await trashcore.sendMessage(chat, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('audioEffects error:', err);
      xreply('❌ Failed to process audio. Make sure it is a valid audio or voice note and ffmpeg is installed.');
    }
  }
};

// ─── toaudio ─────────────────────────────────────────────────

const toaudio = {
  command: ['toaudio', 'tomp3'],
  desc:    'Convert video/audio to MP3',
  category: 'Tools',
  usage:   '.toaudio (reply to video or audio)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const ffmpeg = require('fluent-ffmpeg');

      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const msg = (quotedMsg && (quotedMsg.videoMessage || quotedMsg.audioMessage))
                  || m.message?.videoMessage
                  || m.message?.audioMessage;

      if (!msg) return xreply('🎧 Reply to a *video* or *audio* to convert it to MP3!');

      const mime = msg.mimetype || '';
      if (!/video|audio/.test(mime)) return xreply('⚠️ Only works on video or audio messages!');

      xreply('🎶 Converting to audio...');

      const stream = await downloadContentFromMessage(msg, mime.split('/')[0]);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const inputPath  = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
      const outputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp3`);
      fs.writeFileSync(inputPath, buffer);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath).toFormat('mp3').on('end', resolve).on('error', reject).save(outputPath);
      });

      await trashcore.sendMessage(chat, {
        audio: fs.readFileSync(outputPath), mimetype: 'audio/mpeg', ptt: false
      }, { quoted: m });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('toaudio error:', err);
      xreply('💥 Failed to convert. Make sure ffmpeg is installed.');
    }
  }
};

// ─── tovoicenote ─────────────────────────────────────────────

const tovoicenote = {
  command: ['tovoicenote', 'toptt'],
  desc:    'Convert video/audio to voice note (PTT)',
  category: 'Tools',
  usage:   '.tovoicenote (reply to video or audio)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const ffmpeg = require('fluent-ffmpeg');

      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const msg = (quotedMsg && (quotedMsg.videoMessage || quotedMsg.audioMessage))
                  || m.message?.videoMessage
                  || m.message?.audioMessage;

      if (!msg) return xreply('🎧 Reply to a *video* or *audio* to convert it to a voice note!');

      const mime = msg.mimetype || '';
      if (!/video|audio/.test(mime)) return xreply('⚠️ Only works on video or audio messages!');

      xreply('🔊 Converting to voice note...');

      const stream = await downloadContentFromMessage(msg, mime.split('/')[0]);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const inputPath  = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
      const outputPath = path.join(os.tmpdir(), `output_${Date.now()}.ogg`);
      fs.writeFileSync(inputPath, buffer);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .inputOptions('-t 59')
          .toFormat('opus')
          .outputOptions(['-c:a libopus', '-b:a 64k'])
          .on('end', resolve).on('error', reject)
          .save(outputPath);
      });

      await trashcore.sendMessage(chat, {
        audio: fs.readFileSync(outputPath), mimetype: 'audio/ogg', ptt: true
      }, { quoted: m });

      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (err) {
      console.error('tovoicenote error:', err);
      xreply('💥 Failed to convert. Make sure ffmpeg is installed.');
    }
  }
};

// ─── tovideo ─────────────────────────────────────────────────

const tovideo = {
  command: ['tovideo', 'tovid'],
  desc:    'Convert audio to MP4 video (static image + audio)',
  category: 'Tools',
  usage:   '.tovideo (reply to audio)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const ffmpeg  = require('fluent-ffmpeg');
      const axios   = require('axios');

      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const msg = (quotedMsg && quotedMsg.audioMessage)
                  || m.message?.audioMessage;

      if (!msg) return xreply('🎵 Reply to an *audio message* to convert it to a video!');

      xreply('🎬 Converting audio to video...');

      const stream = await downloadContentFromMessage(msg, 'audio');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const inputPath  = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`);
      const imgPath    = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);
      const outputPath = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
      fs.writeFileSync(inputPath, buffer);

      // Download a placeholder thumbnail
      try {
        const imgRes = await axios.get('https://files.catbox.moe/en2v4a.jpg', { responseType: 'arraybuffer', timeout: 8000 });
        fs.writeFileSync(imgPath, imgRes.data);
      } catch {
        // Create a black frame if image download fails
        fs.writeFileSync(imgPath, Buffer.alloc(0));
      }

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(fs.existsSync(imgPath) && fs.statSync(imgPath).size > 0 ? imgPath : 'color=c=black:s=640x480:r=1')
          .inputOptions(fs.existsSync(imgPath) && fs.statSync(imgPath).size > 0 ? ['-loop 1'] : ['-f lavfi'])
          .input(inputPath)
          .outputOptions(['-c:v libx264', '-c:a aac', '-shortest', '-pix_fmt yuv420p'])
          .toFormat('mp4')
          .on('end', resolve).on('error', reject)
          .save(outputPath);
      });

      await trashcore.sendMessage(chat, {
        video: fs.readFileSync(outputPath), mimetype: 'video/mp4', caption: '🎬 Here\'s your video!'
      }, { quoted: m });

      [inputPath, imgPath, outputPath].forEach(f => { try { fs.unlinkSync(f); } catch {} });
    } catch (err) {
      console.error('tovideo error:', err);
      xreply('💥 Failed to convert audio to video. Make sure ffmpeg is installed.');
    }
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [
  setmenu, setmenuimage, setmenuvideo,
  autoread, checksettings, checktime,
  audioEffects, toaudio, tovoicenote, tovideo
];
