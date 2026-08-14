// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/downloads/downloads.js  |  All Download Commands
// ============================================================

const axios   = require('axios');

// ─── movie/drama────────────────────────────────────

const movie = {
  command: ['movie', 'drama'],
  desc:    'Search movies/dramas',
  category: 'Search',
  usage:   '.movie <title>',
  run: async ({ trashcore, m, args, xreply, chat, getSetting, setSetting }) => {
    try {
      if (!args.length) 
        return xreply('🎬 Please provide a movie name\nExample: `.movie love`');

      const query = args.join(' ').slice(0, 100);
      await xreply('🔍 Searching movies...');

      const { data } = await axios.get(
        `https://your-api-url.com/search?query=${encodeURIComponent(query)}`,
        { timeout: 20000 }
      );

      if (!data?.status || !Array.isArray(data.result) || data.result.length === 0)
        return xreply('❌ No movies found.');

      const results = data.result.slice(0, 5); // limit results

      let text = `🎬 *Movie Results*\n📌 Query: *${query}*\n\n`;

      results.forEach((v, i) => {
        text += `*${i + 1}. ${v.title}*\n`;
        text += `👀 Views: ${v.views.toLocaleString()}\n`;
        text += `🆔 ID: ${v.book_id}\n\n`;
      });

      // send list
      await trashcore.sendMessage(chat, { text }, { quoted: m });

      // send first result image preview
      const first = results[0];
      if (first?.image) {
        await trashcore.sendMessage(chat, {
          image: { url: first.image },
          caption: `🎬 *${first.title}*\n👀 Views: ${first.views}\n🆔 ID: ${first.book_id}`
        }, { quoted: m });
      }

    } catch (err) {
      console.error('❌ movie error:', err?.response?.data || err.message);
      xreply('⚠️ Failed to fetch movies.');
    }
  }
};

module.exports = [movie];