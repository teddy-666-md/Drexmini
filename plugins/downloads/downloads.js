// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/downloads/downloads.js  |  All Download Commands
// ============================================================

const axios   = require('axios');
const cheerio = require('cheerio');
const fg      = require('api-dylux');

const API = 'https://api.nexray.web.id';

// ─── facebook / instagram ────────────────────────────────────

const facebook = {
  command: ['fb', 'facebook', 'instagram', 'igdl'],
  desc:    'Download Facebook or Instagram media',
  category: 'Downloader',
  run: async ({ trashcore, m, args, text, xreply, chat, prefix }) => {
    try {
      if (!args[0]) {
        const cmd = text.split(' ')[0] || `${prefix}fb`;
        return xreply(`🔗 Provide a Facebook or Instagram link!\nExample: ${cmd} <link>`);
      }
      const url = args[0];
      await xreply('⏳ Fetching media... Please wait!');

      async function fetchMedia(url) {
        try {
          const form = new URLSearchParams();
          form.append('q', url);
          form.append('vt', 'home');
          const { data } = await axios.post('https://yt5s.io/api/ajaxSearch', form, {
            headers: {
              Accept: 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          if (data.status !== 'ok') throw new Error('Provide a valid link.');
          const $ = cheerio.load(data.data);
          if (/^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/.+/i.test(url)) {
            const thumb = $('img').attr('src');
            let links = [];
            $('table tbody tr').each((_, el) => {
              const quality = $(el).find('.video-quality').text().trim();
              const link    = $(el).find('a.download-link-fb').attr('href');
              if (quality && link) links.push({ quality, link });
            });
            if (links.length > 0) return { platform: 'Facebook', type: 'video', thumb, media: links[0].link };
            if (thumb)            return { platform: 'Facebook', type: 'image', media: thumb };
            throw new Error('Media is invalid.');
          }
          if (/^(https?:\/\/)?(www\.)?(instagram\.com\/(p|reel)\/).+/i.test(url)) {
            const video = $('a[title="Download Video"]').attr('href');
            const image = $('img').attr('src');
            if (video) return { platform: 'Instagram', type: 'video', media: video };
            if (image) return { platform: 'Instagram', type: 'image', media: image };
            throw new Error('Media is invalid.');
          }
          throw new Error('Provide a valid Facebook or Instagram URL.');
        } catch (err) { return { error: err.message }; }
      }

      const res = await fetchMedia(url);
      if (res.error) return xreply(`⚠️ Error: ${res.error}`);
      await xreply('⏳ Media found! Downloading...');
      if (res.type === 'video')
        await trashcore.sendMessage(chat, { video: { url: res.media }, caption: `✅ Downloaded video from ${res.platform}!` }, { quoted: m });
      else if (res.type === 'image')
        await trashcore.sendMessage(chat, { image: { url: res.media }, caption: `✅ Downloaded photo from ${res.platform}!` }, { quoted: m });
      await xreply('✅ Done!');
    } catch (err) {
      console.error('FB/IG plugin error:', err);
      await xreply('❌ Failed to get media.');
    }
  }
};

// ─── gitclone ────────────────────────────────────────────────

const gitclone = {
  command: ['gitclone'],
  desc:    'Download GitHub repository as ZIP',
  category: 'Downloader',
  usage:   '.gitclone <github repo link>',
  run: async ({ trashcore, chat, m, args, xreply, prefix }) => {
    try {
      const urlInput = args[0];
      if (!urlInput) return xreply(`Example:\n${prefix}gitclone https://github.com/user/repo`);

      const isUrl = (url) =>
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi.test(url);

      if (!isUrl(urlInput) && !urlInput.includes('github.com'))
        return xreply('❌ Invalid GitHub URL');

      const regex = /(?:https|git)(?:\/\/|@)github\.com[/:]([\w-]+)\/([\w.-]+)/i;
      let [, user, repo] = urlInput.match(regex) || [];
      if (!user || !repo) return xreply('❌ Invalid repository format');
      repo = repo.replace(/\.git$/, '');

      await trashcore.sendMessage(chat, {
        document: { url: `https://api.github.com/repos/${user}/${repo}/zipball` },
        fileName: `${encodeURIComponent(repo)}.zip`,
        mimetype: 'application/zip',
        caption:  `📦 *GitHub Clone*\n🔗 ${urlInput}`
      }, { quoted: m });
    } catch (e) {
      console.error('GITCLONE ERROR:', e);
      xreply('❌ Failed to fetch repository.');
    }
  }
};

// ─── github ──────────────────────────────────────────────────

const github = {
  command: ['github', 'ghdl'],
  desc:    'Download GitHub repository as ZIP (via API)',
  category: 'Downloader',
  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const url = args[0];
      if (!url) return xreply(`Usage: ${prefix}github <repo url>`);
      await xreply('🔍 Fetching GitHub repo...');
      const { data } = await axios.get(`${API}/downloader/github?url=${encodeURIComponent(url)}`);
      if (!data.status) return xreply('❌ Repository not found');
      const res = data.result;
      await trashcore.sendMessage(chat, {
        document: { url: res.url },
        fileName: res.filename,
        mimetype: 'application/zip',
        caption:  `📦 *GITHUB REPOSITORY*\n\n📛 Repo: ${res.repo}\n🌿 Branch: ${res.branch}\n📁 Filename: ${res.filename}\n🔗 Download URL: ${res.url}`
      }, { quoted: m });
    } catch (err) {
      console.error(err);
      xreply('❌ Failed to fetch GitHub repository');
    }
  }
};

// ─── npm ─────────────────────────────────────────────────────

const npmdl = {
  command: ['npmdl', 'npm'],
  desc:    'Download npm package as .tgz',
  category: 'Downloader',
  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const query = args.join(' ');
      if (!query) return xreply(`Usage: ${prefix}npmdl <package name>`);
      await xreply('📦 Fetching package...');
      const { data } = await axios.get(`${API}/downloader/npm?q=${encodeURIComponent(query)}`);
      if (!data.status) return xreply('❌ Package not found');
      const res = data.result;
      await trashcore.sendMessage(chat, {
        document: { url: res.download_url },
        fileName: `${res.name.replace('/', '_')}.tgz`,
        mimetype: 'application/gzip',
        caption:
          `📦 *NPM PACKAGE*\n\n📛 Name: ${res.name}\n📝 Description: ${res.description}\n` +
          `🔖 Version: ${res.version}\n👨‍💻 Author: ${res.author}\n⚖️ License: ${res.license}\n` +
          `📦 Size: ${(res.size / 1024 / 1024).toFixed(2)} MB\n\n🔗 Homepage:\n${res.homepage}`
      }, { quoted: m });
    } catch (err) {
      console.error(err);
      xreply('❌ Failed to fetch npm package');
    }
  }
};

// ─── pindl ───────────────────────────────────────────────────

const pindl = {
  command: ['pindl'],
  desc:    'Download Pinterest video or image',
  category: 'Downloader',
  run: async ({ trashcore, chat, args, text, xreply, prefix }) => {
    try {
      if (!args[0]) {
        const cmd = text?.split(' ')[0] || `${prefix}pindl`;
        return xreply(`🔗 *Example:*\n${cmd} https://pin.it/57IghwKl0`);
      }
      const url = args[0];
      await xreply('⏳ Fetching from Pinterest...');

      async function fetchPinterest(url) {
        try {
          const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15' },
            maxRedirects: 5
          });
          const video  = data.match(/"contentUrl":"(https:\/\/v1\.pinimg\.com\/videos\/[^\"]+\.mp4)"/);
          const image  = data.match(/"imageSpec_736x":\{"url":"(https:\/\/i\.pinimg\.com\/736x\/[^\"]+\.(jpg|jpeg|png|webp))"/) ||
                         data.match(/"imageSpec_564x":\{"url":"(https:\/\/i\.pinimg\.com\/564x\/[^\"]+\.(jpg|jpeg|png|webp))"/);
          const title  = data.match(/"name":"([^"]+)"/);
          const author = data.match(/"fullName":"([^"]+)".+?"username":"([^"]+)"/);
          const date   = data.match(/"uploadDate":"([^"]+)"/);
          const keyword = data.match(/"keywords":"([^"]+)"/);
          return {
            type:       video ? 'video' : 'image',
            title:      title  ? title[1]  : 'Unknown Title',
            author:     author ? author[1] : 'Unknown',
            username:   author ? author[2] : 'Unknown',
            media:      video  ? video[1]  : image ? image[1] : null,
            uploadDate: date   ? date[1]   : 'N/A',
            keywords:   keyword ? keyword[1].split(',').map(x => x.trim()) : []
          };
        } catch (err) { return { error: err.message }; }
      }

      const res = await fetchPinterest(url);
      if (res.error) return xreply(`❌ Error: ${res.error}`);
      if (!res.media) return xreply('⚠️ Could not find media from that link.');

      const caption =
        `📍 *Pinterest Downloader*\n📝 Title: ${res.title}\n👤 Author: ${res.author} (@${res.username})\n` +
        `📅 Uploaded: ${res.uploadDate}\n🔑 Keywords: ${res.keywords.join(', ') || 'None'}`;

      if (res.type === 'video')
        await trashcore.sendMessage(chat, { video: { url: res.media }, caption });
      else
        await trashcore.sendMessage(chat, { image: { url: res.media }, caption });
      await xreply('✅ Done!');
    } catch (err) {
      console.error('Pinterest Plugin Error:', err);
      return xreply('❌ Failed to fetch Pinterest media.');
    }
  }
};

// ─── play (DREX API) ───────────────────────────────────────
const play = {
  command: ['play'],
  desc: 'Download music using YTPlay V2 API',
  category: 'Downloader',
  usage: '.play <song name>',

  run: async ({ trashcore, m, prefix, args, xreply, chat }) => {
    try {
      const query = args.join(' ');

      if (!query) {
        return xreply(
          `🎵 *Play Downloader*\n\n` +
          `Usage: ${prefix}play <song name>\n` +
          `Example: ${prefix}play Faded Alan Walker`
        );
      }

      await xreply('🔎 Searching song...\nPowered by Trashcore');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/ytplayv2?q=${encodeURIComponent(query)}`
      );

      if (!data?.status || !data?.result?.success) {
        return xreply('❌ No results found.');
      }

      const result = data.result;

      if (!result.downloadUrl) {
        return xreply('❌ Download link not available.');
      }

      const caption = `╭━━━〔 🎵 PLAY V2 〕━━━⬣
┃ 🎶 *Title:* ${result.title}
┃ 🎼 *Format:* ${result.format.toUpperCase()}
┃ 🆔 *ID:* ${result.id}
╰━━━━━━━━━━━━━━━━⬣`;

      await trashcore.sendMessage(
        chat,
        {
          image: { url: result.thumbnail },
          caption
        },
        { quoted: m }
      );

      await trashcore.sendMessage(
        chat,
        {
          audio: { url: result.downloadUrl },
          mimetype: 'audio/mpeg',
          fileName: `${result.title}.mp3`,
          ptt: false
        },
        { quoted: m }
      );

    } catch (err) {
      console.error('play error:', err);

      if (err.response) {
        console.log(err.response.data);
      }

      xreply(`❌ Error: ${err.message}\nPowered by Trashcore`);
    }
  }
};
// ─── play2 (Drex api— old play) ──────────────────────────
const play2 = {
  name: 'play2',
  command: ['play2'],
  category: 'Downloader',
  desc: 'Search and download YouTube audio',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const query = args.join(' ');

      if (!query) {
        return xreply(`Usage: ${prefix}play2 Faded Alan Walker`);
      }

      await trashcore.sendMessage(chat, {
        react: { text: '🔍', key: m.key }
      });

      const api = `https://api.drexapp.space/downloader/ytplay?q=${encodeURIComponent(query)}`;

      const { data } = await axios.get(api);

      if (!data.status || !data.result) {
        return xreply('Song not found.');
      }

      const res = data.result;

      const caption = `
*YOUTUBE PLAY RESULT*

*Title:* ${res.title}
*Channel:* ${res.channel}
*Duration:* ${res.duration}
*Views:* ${Number(res.views).toLocaleString()}
*Published:* ${res.published}
*Format:* ${res.format}

> Powered by DrexApp
      `.trim();

      await trashcore.sendMessage(
        chat,
        {
          image: { url: res.thumbnail },
          caption
        },
        { quoted: m }
      );

      await trashcore.sendMessage(
        chat,
        {
          audio: { url: res.download_url },
          mimetype: 'audio/mpeg',
          fileName: `${res.title}.mp3`
        },
        { quoted: m }
      );

      await trashcore.sendMessage(chat, {
        react: { text: '✅', key: m.key }
      });

    } catch (err) {
      console.error(err);
      xreply('Failed to fetch song.');
    }
  }
};

// ─── play3 (Trashcore API) ──────────────────────────────────────
const play3 = {
  name: 'play3',
  command: ['play3'],
  category: 'Downloader',
  desc: 'Search and download YouTube audio',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const query = args.join(' ');

      if (!query) {
        return xreply(`Usage: ${prefix}play3 <song name>`);
      }

      await xreply('🎵 Searching song...');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/ytplayv2?q=${encodeURIComponent(query)}`
      );

      if (!data.status || !data.result?.downloadURL) {
        return xreply('❌ Failed to fetch audio');
      }

      const res = data.result;

      await trashcore.sendMessage(chat, {
        text:
`🎵 *${res.title}*

⬇️ Downloading audio...`
      }, { quoted: m });

      await trashcore.sendMessage(chat, {
        audio: { url: res.downloadURL },
        mimetype: 'audio/mpeg',
        fileName: `${res.title}.mp3`
      }, { quoted: m });

    } catch (err) {
      console.error('PLAY Error:', err);
      xreply('❌ Error downloading audio');
    }
  }
};

// ─── playdoc (nexray.eu.cc) ───────────────────────────────────

const playdoc = {
  command: ['playdoc'],
  desc:    'Search and send a song as document',
  category: 'Music',
  usage:   '.playdoc <song name>',
  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      if (!args.length) return xreply(`🎵 Please provide a song name\nExample: ${prefix}playdoc Faded`);
      const query = args.join(' ').slice(0, 100);
      await xreply('🎵 Searching...');

      // Step 1: Search YouTube for video ID
      const searchRes = await axios.get(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const videoIdMatch = searchRes.data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (!videoIdMatch) return xreply('❌ No results found for that song.');
      const videoUrl = `https://youtube.com/watch?v=${videoIdMatch[1]}`;

      await xreply('⏳ Fetching audio...');

      // Step 2: Fetch audio via apiskeith
      const { data } = await axios.get(
        `https://apiskeith.top/download/audio?url=${encodeURIComponent(videoUrl)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 }
      );
      if (!data?.status || !data?.result) return xreply('❌ Failed to fetch audio.');

      // Step 3: Get metadata via oEmbed
      let title = query, thumbnail = null;
      try {
        const oEmbed = await axios.get(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
        );
        title     = oEmbed.data.title         || query;
        thumbnail = oEmbed.data.thumbnail_url || null;
      } catch (_) {}

      if (thumbnail) {
        await trashcore.sendMessage(chat, {
          image:   { url: thumbnail },
          caption: `📄 *Song Document*\n\n🎵 *Title:* ${title}\n🔗 ${videoUrl}`
        }, { quoted: m });
      }

      await trashcore.sendMessage(chat, {
        document: { url: data.result },
        mimetype: 'audio/mpeg',
        fileName: `${title.slice(0, 50)}.mp3`
      }, { quoted: m });

    } catch (err) {
      console.error('❌ playdoc error:', err?.response?.data || err.message);
      xreply('⚠️ An error occurred while sending the song.');
    }
  }
};

// ─── playdoc2 (Trashcore api) ───────────────────────────────────
const playdoc2 = {
  name: 'playdoc2',
  command: ['playdoc2'],
  category: 'Downloader',
  desc: 'Search and download YouTube audio as document',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const query = args.join(' ');

      if (!query) {
        return xreply(`Usage: ${prefix}playdoc2 Faded Alan Walker`);
      }

      await trashcore.sendMessage(chat, {
        react: { text: '🔍', key: m.key }
      });

      const api = `https://api.drexapp.space/downloader/ytplay?q=${encodeURIComponent(query)}`;

      const { data } = await axios.get(api);

      if (!data.status || !data.result) {
        return xreply('Song not found.');
      }

      const res = data.result;

      const caption = `
*YOUTUBE PLAY RESULT*

*Title:* ${res.title}
*Channel:* ${res.channel}
*Duration:* ${res.duration}
*Views:* ${Number(res.views).toLocaleString()}
*Published:* ${res.published}
*Format:* ${res.format}

> Powered by DrexApp
      `.trim();

      await trashcore.sendMessage(
        chat,
        {
          image: { url: res.thumbnail },
          caption
        },
        { quoted: m }
      );

      await trashcore.sendMessage(
        chat,
        {
          document: { url: res.download_url },
          mimetype: 'audio/mpeg',
          fileName: `${res.title}.mp3`
        },
        { quoted: m }
      );

      await trashcore.sendMessage(chat, {
        react: { text: '✅', key: m.key }
      });

    } catch (err) {
      console.error(err);
      xreply('Failed to fetch song.');
    }
  }
};

// ─── soundcloud ─────────────────────────────────────────────

const soundcloud = {
  name: 'soundcloud',
  command: ['soundcloud', 'sc'],
  category: 'Downloader',
  desc: 'Search and download SoundCloud music',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const query = args.join(' ');

      if (!query) {
        return xreply(`Usage: ${prefix}soundcloud <song name>`);
      }

      await xreply('🎵 Searching SoundCloud...');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/soundcloud?q=${encodeURIComponent(query)}&limit=2`
      );

      if (
        !data.status ||
        !data.result?.results ||
        !data.result.results.length
      ) {
        return xreply('❌ No results found');
      }

      const res =
        data.result.results.find(v => v.download_url) ||
        data.result.results[0];

      await trashcore.sendMessage(chat, {
        image: { url: res.thumbnail },
        caption:
`🎵 *${res.title}*

👤 Artist: ${res.artist}
⏱ Duration: ${res.duration}
▶️ Plays: ${res.plays}
❤️ Likes: ${res.likes}
🎼 Genre: ${res.genre}`
      }, { quoted: m });

      if (res.download_url) {
        await trashcore.sendMessage(chat, {
          audio: { url: res.download_url },
          mimetype: 'audio/mpeg',
          fileName: `${res.title}.mp3`
        }, { quoted: m });
      } else {
        await xreply('⚠️ This track has no downloadable audio.');
      }

    } catch (err) {
      console.error('SOUNDCLOUD Error:', err);
      xreply('❌ Error fetching SoundCloud music');
    }
  }
};

// ─── spotify ─────────────────────────────────────────────────

const spotify = {
  command: ['spotify', 'sp'],
  desc:    'Download song from Spotify',
  category: 'Music',
  usage:   '.spotify <song name>',
  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      if (!args.length) return xreply(`🎧 Please provide a song name\nExample: ${prefix}spotify Faded`);
      const query = args.join(' ').slice(0, 100);
      await xreply('🎧 Fetching Spotify track...');
      const { data } = await axios.get(
        `${API}/downloader/spotifyplay?q=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }
      );
      if (!data?.status || !data.result) return xreply('❌ Failed to fetch track.');
      const r = data.result;
      await trashcore.sendMessage(chat, {
        image: { url: r.thumbnail },
        caption:
          `🎧 *Spotify Download*\n\n🎵 *Title:* ${r.title}\n🎤 *Artist:* ${r.artist}\n` +
          `💿 *Album:* ${r.album}\n⏱ *Duration:* ${r.duration}\n🔥 *Popularity:* ${r.popularity}\n📅 *Released:* ${r.release_at}`
      }, { quoted: m });
      await trashcore.sendMessage(chat, {
        audio: { url: r.download_url }, mimetype: 'audio/mpeg', fileName: `${r.title.slice(0, 50)}.mp3`
      }, { quoted: m });
    } catch (err) {
      console.error('❌ spotify error:', err?.response?.data || err.message);
      xreply('⚠️ An error occurred while fetching the track.');
    }
  }
};

// ─── song ────────────────────────────────────────────────────

const song = {
  command: ['song'],
  desc:    'Play song from YouTube',
  category: 'Music',
  usage:   '.song <song name>',
  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      if (!args.length) return xreply(`🎵 Please provide a song name\nExample: ${prefix}song Faded`);
      const query = args.join(' ');
      const { data } = await axios.get(
        `https://api.nexray.web.id/downloader/ytplay?q=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }
      );
      if (!data?.status || !data.result) return xreply('❌ Song not found.');
      const r = data.result;
      await trashcore.sendMessage(chat, {
        image: { url: r.thumbnail },
        caption: `🎶 *Now Playing*\n\n🎵 Title: ${r.title}\n🎤 Artist: ${r.channel}\n⏱ Duration: ${r.duration}\n👀 Views: ${r.views}`
      }, { quoted: m });
      await trashcore.sendMessage(chat, {
        audio: { url: r.download_url }, mimetype: 'audio/mpeg', fileName: `${r.title.slice(0, 50)}.mp3`
      }, { quoted: m });
    } catch (err) {
      console.log('SONG ERROR:', err?.response?.data || err.message);
      xreply('⚠️ Failed to fetch the song.');
    }
  }
};

// ─── tiktok ──────────────────────────────────────────────────

const tiktok = {
  command: ['tiktok', 'tt'],
  desc:    'Download TikTok video or audio',
  category: 'Downloader',
  run: async ({ trashcore, m, args, xreply, prefix }) => {
    try {
      if (!args[0]) return xreply(`⚠️ Provide a TikTok link.\nExample: ${prefix}tiktok <url>`);
      await xreply('⏳ Fetching TikTok data...');
      const data = await fg.tiktok(args[0]);
      const json = data.result;
      let caption = `🎵 [TIKTOK DOWNLOAD]\n\n`;
      caption += `◦ Id: ${json.id}\n◦ Username: ${json.author.nickname}\n◦ Title: ${json.title}\n`;
      caption += `◦ Likes: ${json.digg_count}\n◦ Comments: ${json.comment_count}\n◦ Shares: ${json.share_count}\n`;
      caption += `◦ Plays: ${json.play_count}\n◦ Created: ${json.create_time}\n◦ Size: ${json.size}\n◦ Duration: ${json.duration}`;
      if (json.images?.length > 0) {
        for (const imgUrl of json.images)
          await trashcore.sendMessage(m.key.remoteJid, { image: { url: imgUrl } }, { quoted: m });
      } else {
        await trashcore.sendMessage(m.key.remoteJid, { video: { url: json.play }, mimetype: 'video/mp4', caption }, { quoted: m });
        setTimeout(async () => {
          if (json.music)
            await trashcore.sendMessage(m.key.remoteJid, { audio: { url: json.music }, mimetype: 'audio/mpeg' }, { quoted: m });
        }, 3000);
      }
    } catch (err) {
      console.error('TikTok plugin error:', err);
      await xreply('❌ Failed to fetch TikTok data. Make sure the link is valid.');
    }
  }
};

// ─── tt2 (Trashcore API) ──────────────────────────────────────

const tt2 = {
  command: ['tt2'],
  desc:    'Download TikTok video (Trashcore API)',
  category: 'Downloader',
  usage:   '.tt2 <tiktok url>',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      if (!args[0]) return xreply(`⚠️ Provide a TikTok link.\nExample: ${prefix}tt2 https://vt.tiktok.com/xxx`);

      await xreply('⏳ Fetching TikTok data...');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/tiktok?url=${encodeURIComponent(args[0])}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 30000 }
      );

      if (!data?.status || !data?.result?.result) {
        return xreply('❌ Failed to fetch TikTok data. Make sure the link is valid.');
      }

      const json = data.result.result;

      const title    = json.title         || 'No caption';
      const author   = json.author?.nickname || 'Unknown';
      const username = json.author?.unique_id || 'unknown';
      const duration = json.duration      || 0;
      const size     = json.size          ? `${(json.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown';
      const plays    = json.play_count    ? json.play_count.toLocaleString()    : '0';
      const likes    = json.digg_count    ? json.digg_count.toLocaleString()    : '0';
      const comments = json.comment_count ? json.comment_count.toLocaleString() : '0';
      const shares   = json.share_count   ? json.share_count.toLocaleString()   : '0';

      const caption =
`🎵 *TikTok Downloader*

📝 *Caption:* ${title.slice(0, 200)}
👤 *Author:* ${author} (@${username})
⏱ *Duration:* ${duration}s
📦 *Size:* ${size}

▶️ *Plays:* ${plays}
❤️ *Likes:* ${likes}
💬 *Comments:* ${comments}
🔗 *Shares:* ${shares}

> ©By Trashcore`;

      if (json.cover) {
        await trashcore.sendMessage(chat, {
          image:   { url: json.cover },
          caption
        }, { quoted: m });
      }

      await trashcore.sendMessage(chat, {
        video:    { url: json.play },
        mimetype: 'video/mp4',
        caption:  `🎬 ${author} — TikTok`
      }, { quoted: m });

      if (json.music) {
        await trashcore.sendMessage(chat, {
          audio:    { url: json.music },
          mimetype: 'audio/mpeg'
        }, { quoted: m });
      }

    } catch (err) {
      console.error('TT2 ERROR:', err?.response?.data || err.message);
      xreply('❌ Failed to fetch TikTok data.');
    }
  }
};

// ─── imagesearch ─────────────────────────────────────────────

const imagesearch = {
  name: 'imagesearch',
  command: ['imagesearch', 'gimage', 'img'],
  category: 'Search',
  desc: 'Search images from Google',

  run: async ({ trashcore, m, args, xreply, prefix, chat }) => {
    try {
      const query = args.join(' ');

      if (!query) {
        return xreply(`Usage: ${prefix}imagesearch Ronaldo`);
      }

      const api = `https://api.drexapp.space/search/gimage?q=${encodeURIComponent(query)}`;

      const { data } = await axios.get(api);

      if (!data.status || !data.result.images.length) {
        return xreply('No images found.');
      }

      const img = data.result.images[
        Math.floor(Math.random() * data.result.images.length)
      ];

      const caption = `
*IMAGE SEARCH RESULT*

*Query:* ${data.result.query}
*Title:* ${img.title}

*Source:* ${img.source}
      `.trim();

      await trashcore.sendMessage(
        chat,
        {
          image: { url: img.url },
          caption
        },
        { quoted: m }
      );

    } catch (err) {
      console.error(err);
      xreply('Failed to fetch images.');
    }
  }
};

// ─── capcut ──────────────────────────────────────────────────
const capcut = {
  name: 'capcut',
  command: ['capcut', 'cc'],
  category: 'Downloader',
  desc: 'Download CapCut videos',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      const url = args[0];

      if (!url) {
        return xreply(`Usage: ${prefix}capcut <capcut_url>`);
      }

      await xreply('⏳ Downloading CapCut video...');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/capcut?url=${encodeURIComponent(url)}`
      );

      if (!data.status || !data.result) {
        return xreply('❌ Failed to fetch CapCut video');
      }

      const res = data.result;

      await trashcore.sendMessage(chat, {
        video: { url: res.no_watermark || res.best_video },
        caption: `🎬 *CapCut Downloader*\n\n` +
                 `📌 Title: ${res.title || 'Unknown'}\n` +
                 `🏷️ Source: ${res.source || 'CapCut'}`
      }, { quoted: m });

    } catch (err) {
      console.error('CapCut Error:', err);
      xreply('❌ Error downloading CapCut video');
    }
  }
};

// ─── videodoc ────────────────────────────────────────────────
const videodoc = {
  command: ['videodoc'],
  desc: 'Search and download a video as document',
  category: 'Media',
  usage: '.videodoc <video name>',

  run: async ({ trashcore, m, prefix, args, xreply, chat }) => {
    try {
      if (!args.length) {
        return xreply(
          `🎬 Please provide a video name\nExample: ${prefix}videodoc Faded`
        );
      }

      const query = args.join(' ').trim();

      await xreply('⏳ Searching and downloading video...');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/ytvideo?q=${encodeURIComponent(query)}`
      );

      if (!data.status || !data.result) {
        return xreply('❌ No results found.');
      }

      const result = data.result;

      // Send thumbnail
      if (result.thumbnail) {
        await trashcore.sendMessage(chat, {
          image: { url: result.thumbnail },
          caption: `📄 *Video Document*

🎬 *Title:* ${result.title}
📺 *Channel:* ${result.channel || 'Unknown'}
⏱ *Duration:* ${result.duration || 'Unknown'}

© > made by Trashcore`
        }, { quoted: m });
      }

      // Send video as document
      await trashcore.sendMessage(chat, {
        document: { url: result.download_url },
        mimetype: 'video/mp4',
        fileName: `${result.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 50)}.mp4`
      }, { quoted: m });

    } catch (err) {
      console.error('VIDEODOC Error:', err?.response?.data || err.message);
      xreply('❌ Failed to download video.');
    }
  }
};
// ─── video ───────────────────────────────────────────────────
const video = {
  command: ['video'],
  desc: 'Search and download a video',
  category: 'Media',
  usage: '.video <video name>',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      if (!args.length) {
        return xreply(
          `🎬 Please provide a video name\nExample: ${prefix}video Faded`
        );
      }

      const query = args.join(' ').trim();

      await xreply('⏳ Searching and downloading video...');

      const { data } = await axios.get(
        `https://api.drexapp.space/downloader/ytvideo?q=${encodeURIComponent(query)}`
      );

      if (!data.status || !data.result) {
        return xreply('❌ No results found.');
      }

      const result = data.result;

      // Thumbnail card
      if (result.thumbnail) {
        await trashcore.sendMessage(chat, {
          image: { url: result.thumbnail },
          caption: `📄 *Video Mp4*

🎬 *Title:* ${result.title}
📺 *Channel:* ${result.channel || 'Unknown'}
⏱ *Duration:* ${result.duration || 'Unknown'}

© > made by trashcore`
        }, { quoted: m });
      }

      // Send video
      await trashcore.sendMessage(chat, {
        video: { url: result.download_url },
        mimetype: 'video/mp4',
        fileName: `${result.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 50)}.mp4`,
        caption: `🎬 ${result.title}`
      }, { quoted: m });

    } catch (err) {
      console.error('VIDEO Error:', err?.response?.data || err.message);
      xreply('❌ Failed to download video.');
    }
  }
};

// ─── ytmp3 ───────────────────────────────────────────────────
const ytmp3 = {
  command: ['ytmp3'],
  desc: 'Download YouTube audio',
  category: 'Media',
  usage: '.ytmp3 <youtube link>',

  run: async ({ trashcore, chat, m, args, xreply, prefix }) => {
    try {
      const url = args[0];

      if (!url) {
        return xreply(
          `⚠️ Provide a YouTube link.\nExample:\n${prefix}ytmp3 https://youtu.be/xxxxx`
        );
      }

      await xreply('⏳ Processing audio...');

      const api = `https://api.drexapp.space/downloader/ytmp3v1?url=${encodeURIComponent(url)}`;

      const { data } = await axios.get(api);

      if (!data.status || !data.result) {
        return xreply('❌ Failed to fetch audio.');
      }

      const result = data.result;

      await trashcore.sendMessage(
        chat,
        {
          audio: { url: result.download_url },
          mimetype: 'audio/mpeg',
          fileName: `${result.title}.mp3`,
          ptt: false
        },
        { quoted: m }
      );

    } catch (err) {
      console.error('YTMP3 Error:', err);
      xreply('❌ Failed to download audio.');
    }
  }
};
// ─── ytmp4 ───────────────────────────────────────────────────
const ytmp4 = {
  command: ['ytmp4'],
  desc: 'Download YouTube video',
  category: 'Media',
  usage: '.ytmp4 <youtube link>',

  run: async ({ trashcore, chat, m, args, xreply, prefix }) => {
    try {
      const url = args[0];

      if (!url) {
        return xreply(
          `⚠️ Provide a YouTube link.\nExample:\n${prefix}ytmp4 https://youtu.be/xxxxx`
        );
      }

      await xreply('⏳ Downloading video...');

      const api = `https://api.drexapp.space/downloader/ytmp4v1?url=${encodeURIComponent(url)}`;

      const { data } = await axios.get(api);

      if (!data.status || !data.result) {
        return xreply('❌ Failed to fetch video.');
      }

      const result = data.result;

      // Send thumbnail & details first
      await trashcore.sendMessage(chat, {
        image: { url: result.thumbnail },
        caption: `🎬 *${result.title}*

📺 Channel: ${result.channel}
⏱ Duration: ${result.duration}
👁 Views: ${result.views}
📅 Published: ${result.published}`
      }, { quoted: m });

      // Send video
      await trashcore.sendMessage(chat, {
        video: { url: result.download_url },
        mimetype: 'video/mp4',
        caption: `🎬 *${result.title}*`,
        fileName: `${result.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 50)}.mp4`
      }, { quoted: m });

    } catch (err) {
      console.error('YTMP4 Error:', err?.response?.data || err.message);
      xreply('❌ Failed to download video.');
    }
  }
};

// ─── yts ─────────────────────────────────────────────────────

const yts = {
  command: ['yts'],
  desc: 'Search YouTube videos',
  category: 'Search',
  usage: '.yts <query>',

  run: async ({ trashcore, m, args, xreply, chat, prefix }) => {
    try {
      if (!args.length) {
        return xreply(
          `🔎 Please provide a search query\nExample: ${prefix}yts Faded`
        );
      }

      const query = args.join(' ').trim();

      await xreply('🔍 Searching YouTube...');

      const { data } = await axios.get(
        `https://api.drexapp.space/search/youtube?q=${encodeURIComponent(query)}`
      );

      if (
        !data.status ||
        !data.result ||
        !Array.isArray(data.result.results) ||
        data.result.results.length === 0
      ) {
        return xreply('❌ No results found.');
      }

      const results = data.result.results.slice(0, 10);

      let text = `🎥 *YouTube Search Results*\n`;
      text += `🔎 Query: *${data.result.query}*\n`;
      text += `📊 Found: *${data.result.total}* results\n\n`;

      results.forEach((v, i) => {
        text += `*${i + 1}. ${v.title}*\n`;
        text += `📺 Channel: ${v.channel}\n`;
        text += `⏱ Duration: ${v.duration}\n`;
        text += `🔗 ${v.url}\n\n`;
      });

      await trashcore.sendMessage(
        chat,
        {
          image: { url: results[0].thumbnail },
          caption: text
        },
        { quoted: m }
      );

    } catch (err) {
      console.error('YTS Error:', err?.response?.data || err.message);
      xreply('❌ Failed to fetch YouTube search results.');
    }
  }
};
// ─── exports ─────────────────────────────────────────────────

module.exports = [facebook, gitclone, github, npmdl, pindl, play, play2, play3, playdoc, playdoc2, spotify, song, tiktok, tt2, imagesearch, videodoc, video, ytmp3, ytmp4, yts, soundcloud, capcut];
