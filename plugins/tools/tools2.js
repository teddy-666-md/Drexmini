// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/tools/tools2.js  |  Extended Tools & Utility Commands
// ============================================================

const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const { downloadContentFromMessage } = require('@trashcore/baileys');
const { imageToWebp, writeExifImg } = require('../../library/exif');

const KEITH  = 'https://apiskeith.top';
const NEXRAY = 'https://api.nexray.web.id';

// ─── helper: react ───────────────────────────────────────────

async function react(trashcore, m, emoji) {
  try { await trashcore.sendMessage(m.key.remoteJid, { react: { text: emoji, key: m.key } }); } catch (_) {}
}

// ─── weather ─────────────────────────────────────────────────

const weather = {
  command: ['weather', 'clima', 'hali'],
  desc:    'Get weather info for any city',
  category: 'Tools',
  usage:   '.weather <city name>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const city = args.join(' ').trim();
    if (!city) return xreply('Usage: .weather <city>\nExample: .weather Nairobi');
    await react(trashcore, m, '🌤️');
    try {
      const { data } = await axios.get(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { headers: { 'User-Agent': 'TrashcoreBot' }, timeout: 10000 }
      );
      const cur = data.current_condition[0];
      const area = data.nearest_area[0];
      const name = area.areaName[0].value;
      const country = area.country[0].value;
      const tempC  = cur.temp_C;
      const tempF  = cur.temp_F;
      const feels  = cur.FeelsLikeC;
      const humid  = cur.humidity;
      const wind   = cur.windspeedKmph;
      const desc   = cur.weatherDesc[0].value;
      const vis    = cur.visibility;
      const uv     = cur.uvIndex;
      const pressure = cur.pressure;

      await trashcore.sendMessage(chat, {
        text:
          `🌍 *Weather Report*\n` +
          `📍 Location: *${name}, ${country}*\n` +
          `─────────────────\n` +
          `🌡️ Temperature: *${tempC}°C / ${tempF}°F*\n` +
          `🤔 Feels Like: *${feels}°C*\n` +
          `☁️ Condition: *${desc}*\n` +
          `💧 Humidity: *${humid}%*\n` +
          `💨 Wind Speed: *${wind} km/h*\n` +
          `👁️ Visibility: *${vis} km*\n` +
          `☀️ UV Index: *${uv}*\n` +
          `🔴 Pressure: *${pressure} hPa*`
      }, { quoted: m });
    } catch (err) {
      console.error('WEATHER:', err.message);
      xreply('❌ Could not fetch weather. Check the city name and try again.');
    }
  }
};

// ─── shazam ──────────────────────────────────────────────────

const shazam = {
  command: ['shazam', 'musicid'],
  desc:    'Identify a song from an audio/voice message',
  category: 'Tools',
  usage:   '.shazam (reply to audio/voice note)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const audioMsg =
        (quotedMsg && (quotedMsg.audioMessage || quotedMsg.videoMessage)) ||
        m.message?.audioMessage || m.message?.videoMessage;
      if (!audioMsg) return xreply('⚠️ Reply to an *audio* or *voice note* to identify the song.');

      await react(trashcore, m, '🎵');
      await xreply('🎵 Identifying song...');

      const type   = audioMsg.audioMessage ? 'audio' : 'video';
      const stream = await downloadContentFromMessage(audioMsg, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });

      const { data } = await axios.post(
        `${NEXRAY}/search/shazam`,
        form,
        { headers: { ...form.getHeaders() }, timeout: 30000 }
      );

      if (!data?.status || !data.result) return xreply('❌ Song not recognized. Try a clearer audio.');
      const r = data.result;
      await react(trashcore, m, '✅');
      await trashcore.sendMessage(chat, {
        image:   r.coverart ? { url: r.coverart } : undefined,
        text:    !r.coverart ? `🎵 *Song Identified!*\n\n🎶 Title: *${r.title}*\n🎤 Artist: *${r.subtitle}*\n🔗 More: ${r.url || 'N/A'}` : undefined,
        caption: r.coverart ? `🎵 *Song Identified!*\n\n🎶 Title: *${r.title}*\n🎤 Artist: *${r.subtitle}*\n🔗 More: ${r.url || 'N/A'}` : undefined
      }, { quoted: m });
    } catch (err) {
      console.error('SHAZAM:', err.message);
      xreply('❌ Failed to identify song: ' + err.message);
    }
  }
};

// ─── removebg ────────────────────────────────────────────────

const removebg = {
  command: ['removebg', 'rembg', 'nobg'],
  desc:    'Remove background from an image',
  category: 'Tools',
  usage:   '.removebg (reply to an image)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const imgMsg = (quotedMsg && quotedMsg.imageMessage) || m.message?.imageMessage;
      if (!imgMsg) return xreply('⚠️ Reply to or send an *image* with .removebg');

      await react(trashcore, m, '⌛');
      await xreply('✂️ Removing background...');

      const stream = await downloadContentFromMessage(imgMsg, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      const base64 = buffer.toString('base64');

      const { data } = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        { image_base64: base64, size: 'auto' },
        {
          headers: { 'X-Api-Key': 'DEMO', 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      if (!data) throw new Error('No result');
      await react(trashcore, m, '✅');
      const resultBuf = Buffer.from(data, 'base64');
      await trashcore.sendMessage(chat, { image: resultBuf, caption: '✅ Background removed!' }, { quoted: m });
    } catch (err) {
      console.error('REMOVEBG:', err.message);
      try {
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imgMsg = (quotedMsg && quotedMsg.imageMessage) || m.message?.imageMessage;
        const urlToUse = imgMsg?.url || imgMsg?.directPath;
        if (urlToUse) {
          const { data: d2 } = await axios.get(
            `https://api.siputzx.my.id/api/tools/removebg?url=${encodeURIComponent(imgMsg.url || '')}`,
            { responseType: 'arraybuffer', timeout: 30000 }
          );
          if (d2) {
            await react(trashcore, m, '✅');
            return await trashcore.sendMessage(chat, { image: Buffer.from(d2), caption: '✅ Background removed!' }, { quoted: m });
          }
        }
      } catch (_) {}
      await react(trashcore, m, '❌');
      xreply('❌ Remove background failed. Try again with a clearer image.');
    }
  }
};

// ─── lyrics ──────────────────────────────────────────────────
const lyrics = {
  command: ['lyrics', 'lyric'],
  desc:    'Get song lyrics',
  category:'Tools',
  usage:   '.lyrics <song name>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    try {
      const query = args.join(' ').trim();
      if (!query)
        return xreply('Usage: .lyrics <song name>\nExample: .lyrics Faded');

      await react(trashcore, m, '🎵');
      await xreply('🔍 Fetching lyrics...');

      const { data } = await axios.get(
        `https://apiskeith.top/search/lyrics2?query=${encodeURIComponent(query)}`,
        { timeout: 20000 }
      );

      if (!data?.status || !data.result)
        return xreply('❌ Lyrics not found.');

      const text =
        `🎵 *Lyrics: ${query}*\n` +
        `─────────────────\n\n${data.result}`;

      // split if too long (VERY IMPORTANT)
      if (text.length > 4000) {
        const chunks = text.match(/[\s\S]{1,4000}/g) || [];
        for (const chunk of chunks) {
          await trashcore.sendMessage(chat, { text: chunk }, { quoted: m });
        }
      } else {
        await trashcore.sendMessage(chat, { text }, { quoted: m });
      }

      await react(trashcore, m, '✅');

    } catch (err) {
      console.error('LYRICS2 ERROR:', err?.response?.data || err.message);
      xreply('❌ Failed to fetch lyrics.');
    }
  }
};
// ─── movie ───────────────────────────────────────────────────

const movie = {
  command: ['movie', 'film'],
  desc:    'Search for movie information',
  category: 'Tools',
  usage:   '.movie <movie name>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const query = args.join(' ').trim();
    if (!query) return xreply('Usage: .movie <movie name>\nExample: .movie Inception');
    await react(trashcore, m, '🎬');
    try {
      const { data } = await axios.get(
        `http://www.omdbapi.com/?apikey=trilogy&t=${encodeURIComponent(query)}&plot=full`,
        { timeout: 10000 }
      );
      if (data.Response === 'False') return xreply(`❌ Movie not found: *${query}*`);
      const r = data;
      const text =
        `🎬 *${r.Title}* (${r.Year})\n` +
        `─────────────────\n` +
        `📋 Type: *${r.Type}*\n` +
        `🎭 Genre: *${r.Genre}*\n` +
        `🌍 Country: *${r.Country}*\n` +
        `🗣️ Language: *${r.Language}*\n` +
        `⏱️ Runtime: *${r.Runtime}*\n` +
        `🎥 Director: *${r.Director}*\n` +
        `🎭 Actors: *${r.Actors}*\n` +
        `⭐ Rating: *${r.imdbRating}/10* (${r.imdbVotes} votes)\n` +
        `🏆 Awards: *${r.Awards}*\n\n` +
        `📖 *Plot:*\n${r.Plot}`;
      if (r.Poster && r.Poster !== 'N/A') {
        await trashcore.sendMessage(chat, { image: { url: r.Poster }, caption: text }, { quoted: m });
      } else {
        await trashcore.sendMessage(chat, { text }, { quoted: m });
      }
    } catch (err) {
      console.error('MOVIE:', err.message);
      xreply('❌ Failed to fetch movie info.');
    }
  }
};

// ─── emojimix ────────────────────────────────────────────────

const emojimix = {
  command: ['emojimix', 'mixemoji'],
  desc:    'Mix two emojis together into a sticker',
  category: 'Fun',
  usage:   '.emojimix 😂+😭',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const input = args.join(' ').trim();
    if (!input || !input.includes('+')) return xreply('Usage: .emojimix <emoji1>+<emoji2>\nExample: .emojimix 😂+😭');
    const [e1, e2] = input.split('+').map(e => e.trim());
    if (!e1 || !e2) return xreply('⚠️ Provide two emojis separated by +');
    try {
      const toCode = e => [...e].map(c => c.codePointAt(0).toString(16).padStart(4, '0')).join('-');
      const c1 = toCode(e1);
      const c2 = toCode(e2);
      const url = `https://www.gstatic.com/android/keyboard/emojikitchen/20201001/u${c1}/u${c1}_u${c2}.png`;
      const { data: buf } = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
      const { Sticker, StickerTypes } = require('wa-sticker-formatter');
      const sticker = new Sticker(Buffer.from(buf), {
        pack:    'TrashCore Ultra',
        author:  'TrashX',
        type:    StickerTypes.FULL,
        quality: 70
      });
      await trashcore.sendMessage(chat, { sticker: await sticker.toBuffer() }, { quoted: m });
    } catch (err) {
      console.error('EMOJIMIX:', err.message);
      xreply('❌ Could not mix those emojis. Try a different combination!');
    }
  }
};

// ─── attp (animated text sticker) ────────────────────────────

const attp = {
  command: ['attp', 'animatedtext'],
  desc:    'Create an animated text sticker',
  category: 'Fun',
  usage:   '.attp <text>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const text = args.join(' ').trim();
    if (!text) return xreply('Usage: .attp <your text>\nExample: .attp TRASHCORE');
    await xreply('⏳ Creating animated sticker...');
    try {
      const { data } = await axios.get(
        `https://api.siputzx.my.id/api/stiker/attp?text=${encodeURIComponent(text)}`,
        { responseType: 'arraybuffer', timeout: 20000 }
      );
      if (!data || data.byteLength < 100) throw new Error('No data returned');
      const { Sticker, StickerTypes } = require('wa-sticker-formatter');
      const sticker = new Sticker(Buffer.from(data), {
        pack:    'TrashCore Ultra',
        author:  'TrashX',
        type:    StickerTypes.FULL,
        quality: 80
      });
      await trashcore.sendMessage(chat, { sticker: await sticker.toBuffer() }, { quoted: m });
    } catch (err) {
      console.error('ATTP:', err.message);
      xreply('❌ Failed to create animated sticker. Try shorter text.');
    }
  }
};

// ─── stickercrop ─────────────────────────────────────────────

const stickercrop = {
  command: ['stickerq', 'stickercrop', 'sqr'],
  desc:    'Create a square/cropped sticker from image',
  category: 'Fun',
  usage:   '.stickerq (reply to image)',
  run: async ({ m, trashcore, xreply, chat }) => {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const imgMsg = (quotedMsg && quotedMsg.imageMessage) || m.message?.imageMessage;
      if (!imgMsg) return xreply('⚠️ Reply to an *image* to create a square sticker.');

      await xreply('🪄 Creating square sticker...');
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const { Sticker, StickerTypes } = require('wa-sticker-formatter');
      const sticker = new Sticker(buffer, {
        pack:    'TrashCore Ultra',
        author:  'TrashX',
        type:    StickerTypes.CROPPED,
        quality: 75
      });
      await trashcore.sendMessage(chat, { sticker: await sticker.toBuffer() }, { quoted: m });
    } catch (err) {
      console.error('STICKERCROP:', err.message);
      xreply('❌ Failed to create sticker: ' + err.message);
    }
  }
};

// ─── getpp ───────────────────────────────────────────────────

const getpp = {
  command: ['getpp', 'pfp', 'profilepic'],
  desc:    'Get profile picture of a user',
  category: 'Tools',
  usage:   '.getpp @user or reply to message',
  run: async ({ trashcore, m, chat, args, xreply, sender }) => {
    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted   = m.message?.extendedTextMessage?.contextInfo?.participant;
    const target   = mentions[0] || quoted || sender;
    try {
      const pp = await trashcore.profilePictureUrl(target, 'image');
      await trashcore.sendMessage(chat, {
        image:   { url: pp },
        caption: `📸 Profile picture of @${target.split('@')[0]}`,
        mentions: [target]
      }, { quoted: m });
    } catch (_) {
      xreply(`❌ No profile picture found for @${target.split('@')[0]}\n_(Private or not set)_`);
    }
  }
};

// ─── toaudio ─────────────────────────────────────────────────

const toaudio = {
  command: ['toaudio', 'tomp3', 'tovoice'],
  desc:    'Convert video/sticker to audio',
  category: 'Tools',
  usage:   '.toaudio (reply to video/sticker)',
  run: async ({ m, trashcore, xreply, chat, command }) => {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const vidMsg = (quotedMsg && (quotedMsg.videoMessage || quotedMsg.stickerMessage)) ||
                     m.message?.videoMessage || m.message?.stickerMessage;
      if (!vidMsg) return xreply(`⚠️ Reply to a *video* or *sticker* with .${command}`);

      await xreply('🎵 Converting to audio...');
      const type   = vidMsg.videoMessage ? 'video' : 'sticker';
      const stream = await downloadContentFromMessage(vidMsg, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const tmpDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const inPath  = path.join(tmpDir, `conv_${Date.now()}.mp4`);
      const outPath = path.join(tmpDir, `conv_${Date.now()}.mp3`);
      fs.writeFileSync(inPath, buffer);

      await new Promise((resolve, reject) => {
        const { exec } = require('child_process');
        exec(`ffmpeg -i "${inPath}" -vn -acodec libmp3lame -q:a 2 "${outPath}"`, (err) => {
          fs.unlink(inPath, () => {});
          if (err) reject(err); else resolve();
        });
      });

      const audioBuffer = fs.readFileSync(outPath);
      fs.unlink(outPath, () => {});

      const isPtt = command === 'tovoice';
      await trashcore.sendMessage(chat, {
        audio:    audioBuffer,
        mimetype: isPtt ? 'audio/ogg; codecs=opus' : 'audio/mpeg',
        ptt:      isPtt
      }, { quoted: m });
    } catch (err) {
      console.error('TOAUDIO:', err.message);
      xreply('❌ Conversion failed. Make sure ffmpeg is installed.');
    }
  }
};

// ─── apkdl ───────────────────────────────────────────────────

const apkdl = {
  command: ['apk', 'apkdl'],
  desc:    'Download APK by app name using Keith API',
  category: 'Downloader',
  usage:   '.apk <app name>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const query = args.join(' ').trim();
    if (!query) return xreply('Usage: .apk <app name>\nExample: .apk WhatsApp');
    await react(trashcore, m, '⏳');
    try {
      // Build apk4all slug from query (lowercase, hyphens)
      const slug   = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const apkUrl = `https://apk4all.com.im/apps/${slug}`;
      const apiUrl = `https://apiskeith.top/download/apk?url=${encodeURIComponent(apkUrl)}`;

      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data?.status || !data.result)
        return xreply(`❌ APK not found for: *${query}*\n\nTip: use exact app name e.g. .apk xender share music transfer`);

      const r     = data.result;
      const dlUrl = r.downloadLink || r.redirectLink;
      if (!dlUrl) return xreply(`❌ No download link returned for: *${query}*`);

      await react(trashcore, m, '✅');

      const caption =
        `📦 *APK Downloader*\n\n` +
        `📛 App: ${query}\n` +
        `🔖 Version: ${r.version || 'N/A'}\n` +
        `📁 Size: ${r.fileSize || 'N/A'}\n` +
        `🗂️ Category: ${r.categories || 'N/A'}\n` +
        `📅 Updated: ${r.update || 'N/A'}\n` +
        `🔓 License: ${r.license || 'Free'}\n` +
        `📥 Downloads: ${r.downloads || 'N/A'}`;

      await trashcore.sendMessage(chat, {
        document: { url: dlUrl },
        fileName: `${query.replace(/\s+/g, '_')}.apk`,
        mimetype: 'application/vnd.android.package-archive',
        caption
      }, { quoted: m });

    } catch (err) {
      console.error('APK:', err.message);
      xreply('❌ Failed to fetch APK: ' + err.message);
    }
  }
};

// ─── mediafire ───────────────────────────────────────────────

const mfdl = {
  command: ['mf', 'mediafire'],
  desc:    'Download file from MediaFire',
  category: 'Downloader',
  usage:   '.mf <mediafire link>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const url = args[0];
    if (!url) return xreply('Usage: .mf <mediafire link>');
    if (!url.includes('mediafire.com')) return xreply('❌ Please provide a valid MediaFire link.');
    await react(trashcore, m, '⏳');
    try {
      const cheerio = require('cheerio');
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000
      });
      const $ = cheerio.load(data);
      const dlUrl  = $('a#downloadButton').attr('href');
      const name   = $('div.filename').text().trim() || $('a#downloadButton').text().replace('Download', '').trim();
      const size   = $('ul.details li span').eq(1).text().trim();
      if (!dlUrl) return xreply('❌ Could not extract download link. The file may be private.');
      await react(trashcore, m, '✅');
      await trashcore.sendMessage(chat, {
        document: { url: dlUrl },
        fileName: name || 'mediafire_file',
        mimetype: 'application/octet-stream',
        caption:  `📁 *MediaFire Download*\n📛 File: ${name}\n📦 Size: ${size || 'N/A'}`
      }, { quoted: m });
    } catch (err) {
      console.error('MEDIAFIRE:', err.message);
      xreply('❌ Failed to download from MediaFire: ' + err.message);
    }
  }
};

// ─── fancy text ──────────────────────────────────────────────

const FANCY_STYLES = {
  bold:   t => t.split('').map(c => { const o = c.codePointAt(0); return (o >= 65 && o <= 90) ? String.fromCodePoint(o + 0x1D400 - 65) : (o >= 97 && o <= 122) ? String.fromCodePoint(o + 0x1D41A - 97) : c; }).join(''),
  italic: t => t.split('').map(c => { const o = c.codePointAt(0); return (o >= 65 && o <= 90) ? String.fromCodePoint(o + 0x1D434 - 65) : (o >= 97 && o <= 122) ? String.fromCodePoint(o + 0x1D44E - 97) : c; }).join(''),
  bubble: t => t.split('').map(c => { const o = c.codePointAt(0); return (o >= 65 && o <= 90) ? String.fromCodePoint(o + 0x24B6 - 65) : (o >= 97 && o <= 122) ? String.fromCodePoint(o + 0x24D0 - 97) : (o >= 48 && o <= 57) ? String.fromCodePoint(o + 0x245F - 48) : c; }).join(''),
  square: t => t.split('').map(c => { const o = c.codePointAt(0); return (o >= 65 && o <= 90) ? String.fromCodePoint(o + 0x1F130 - 65) : (o >= 97 && o <= 122) ? String.fromCodePoint(o + 0x1F130 - 97) : c; }).join(''),
  small:  t => t.toLowerCase().split('').map(c => 'abcdefghijklmnopqrstuvwxyz'.includes(c) ? 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖᵠʳˢᵗᵘᵛʷˣʸᶻ'['abcdefghijklmnopqrstuvwxyz'.indexOf(c)] : c).join('')
};

const fancytext = {
  command: ['fancy', 'fancytext'],
  desc:    'Convert text to fancy unicode styles',
  category: 'Fun',
  usage:   '.fancy <text>',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    const text = args.join(' ').trim();
    if (!text) return xreply('Usage: .fancy <text>\nExample: .fancy TrashCore Ultra');
    const out = Object.entries(FANCY_STYLES)
      .map(([name, fn]) => `*${name}:* ${fn(text)}`)
      .join('\n');
    await trashcore.sendMessage(chat, { text: `✨ *Fancy Text Styles*\n\n${out}` }, { quoted: m });
  }
};

// ─── tourl (upload to catbox) ────────────────────────────────
// Ported from Trashcore Ultra

const tourl = {
  command: ['tourl', 'catbox', 'upload'],
  desc:    'Upload a media file and get a direct URL via Catbox',
  category: 'Tools',
  usage:   '.tourl (reply to image/video/audio/document)',
  run: async ({ trashcore, m, chat, xreply }) => {
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      const imgMsg  = (quotedMsg?.imageMessage)    || m.message?.imageMessage;
      const vidMsg  = (quotedMsg?.videoMessage)    || m.message?.videoMessage;
      const audMsg  = (quotedMsg?.audioMessage)    || m.message?.audioMessage;
      const docMsg  = (quotedMsg?.documentMessage) || m.message?.documentMessage;

      const mediaMsg = imgMsg || vidMsg || audMsg || docMsg;
      if (!mediaMsg) return xreply('⚠️ Reply to an *image*, *video*, *audio*, or *document* with .tourl');

      await react(trashcore, m, '⏳');
      await xreply('📤 Uploading to Catbox...');

      let mediaType, mimeType, ext;
      if (imgMsg)  { mediaType = 'image';    mimeType = imgMsg.mimetype  || 'image/jpeg';                ext = 'jpg';  }
      if (vidMsg)  { mediaType = 'video';    mimeType = vidMsg.mimetype  || 'video/mp4';                 ext = 'mp4';  }
      if (audMsg)  { mediaType = 'audio';    mimeType = audMsg.mimetype  || 'audio/mpeg';                ext = 'mp3';  }
      if (docMsg)  { mediaType = 'document'; mimeType = docMsg.mimetype  || 'application/octet-stream';  ext = docMsg.fileName?.split('.').pop() || 'bin'; }

      const cleanMime = mimeType.split(';')[0].trim();

      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', buffer, {
        filename:    `upload_${Date.now()}.${ext}`,
        contentType: cleanMime
      });

      const { data } = await axios.post(
        'https://api.fvckers.my.id/api/uploader/catbox',
        form,
        { headers: { ...form.getHeaders() }, timeout: 60000 }
      );

      if (!data?.success || !data?.output?.url)
        return xreply('❌ Upload failed. The API did not return a URL.');

      await react(trashcore, m, '✅');

      const sizeKb = (buffer.length / 1024).toFixed(1);
      const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
      const displaySize = buffer.length >= 1048576 ? `${sizeMb} MB` : `${sizeKb} KB`;

      await trashcore.sendMessage(chat, {
        text:
          `✅ *Uploaded to Catbox!*\n\n` +
          `🔗 *URL:* ${data.output.url}\n` +
          `📁 *Name:* ${data.file?.name || 'N/A'}\n` +
          `📦 *Size:* ${displaySize}\n` +
          `🗂️ *Type:* ${cleanMime}`
      }, { quoted: m });

    } catch (err) {
      console.error('TOURL:', err.message);
      xreply('❌ Upload failed: ' + err.message);
    }
  }
};

// ─── exports ─────────────────────────────────────────────────

module.exports = [weather, shazam, removebg, lyrics, movie, emojimix, attp, stickercrop, getpp, toaudio, apkdl, mfdl, fancytext, tourl];
