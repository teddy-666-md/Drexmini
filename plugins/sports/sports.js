// ============================================================
//  ULTRA X PROJECT — by TrashX
//  plugins/sports/sports.js  |  Football & Sports Commands
//  API: https://apiskeith.top
// ============================================================

const axios = require('axios');
const API   = 'https://apiskeith.top';

async function fetchJson(url) {
  const { data } = await axios.get(url, { timeout: 15000 });
  return data;
}

const eplfixtures = {
  command: ['eplfixtures', 'fixtures', 'matches'],
  desc: 'Upcoming EPL matches', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/epl/upcomingmatches`);
      const matches = data?.result?.upcomingMatches;
      if (!matches?.length) return xreply('❌ No upcoming EPL matches found.');
      let text = `⚽ *EPL UPCOMING MATCHES*\n\n`;
      matches.forEach((m, i) => {
        text += `*${i + 1}. Matchday ${m.matchday}*\n🏠 ${m.homeTeam}\n🔴 ${m.awayTeam}\n🗓️ ${m.date}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching EPL fixtures.'); }
  }
};

const eplstandings = {
  command: ['eplstandings', 'epl', 'epl-table'],
  desc: 'EPL league table', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/epl/standings`);
      const s = data?.result?.standings;
      if (!s?.length) return xreply('❌ EPL standings not found.');
      let text = `🏆 *PREMIER LEAGUE STANDINGS*\n\n`;
      s.forEach(t => { text += `*${t.position}. ${t.team}* — ${t.points} pts\n`; });
      xreply(text);
    } catch { xreply('❌ Error fetching EPL standings.'); }
  }
};

const epltopscorers = {
  command: ['epltopscorers'],
  desc: 'EPL top scorers', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/epl/scorers`);
      const sc = data?.result?.topScorers;
      if (!sc?.length) return xreply('❌ No top scorers found.');
      let text = `⚽ *EPL TOP SCORERS*\n\n`;
      sc.forEach(p => {
        text += `*${p.rank}. ${p.player}*\n🏟️ ${p.team} | ⚽ ${p.goals} | 🎯 ${p.assists ?? '-'} | ⚡ ${p.penalties ?? '-'}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching EPL top scorers.'); }
  }
};

const bundesliga = {
  command: ['bundesliga', 'bl-table'],
  desc: 'Bundesliga upcoming matches', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/bundesliga/upcomingmatches`);
      const matches = data?.result?.upcomingMatches;
      if (!matches?.length) return xreply('❌ No Bundesliga matches found.');
      let text = `⚽ *BUNDESLIGA UPCOMING MATCHES*\n\n`;
      matches.forEach((m, i) => {
        text += `*${i + 1}. Matchday ${m.matchday}*\n🏟️ ${m.homeTeam} vs ${m.awayTeam}\n📅 ${m.date}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching Bundesliga matches.'); }
  }
};

const bundesligastats = {
  command: ['bundesligastats', 'bundesligastandings'],
  desc: 'Bundesliga points table', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/bundesliga/standings`);
      const s = data?.result?.standings;
      if (!s?.length) return xreply('❌ Bundesliga standings not found.');
      let text = `⚽ *BUNDESLIGA POINTS TABLE*\n\n`;
      s.forEach(t => { text += `*${t.position}. ${t.team}* — ${t.points} pts\n`; });
      xreply(text);
    } catch { xreply('❌ Error fetching Bundesliga table.'); }
  }
};

const bundesligascores = {
  command: ['bundesligascores', 'bundesligascorers'],
  desc: 'Bundesliga top scorers', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/bundesliga/scorers`);
      const sc = data?.result?.topScorers;
      if (!sc?.length) return xreply('❌ Bundesliga top scorers not found.');
      let text = `⚽ *BUNDESLIGA TOP SCORERS*\n\n`;
      sc.slice(0, 10).forEach(p => {
        text += `*${p.rank}. ${p.player}*\n🏟️ ${p.team} | ⚽ ${p.goals} | 🎯 ${p.assists ?? '-'}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching Bundesliga top scorers.'); }
  }
};

const laligamatches = {
  command: ['laligamatches', 'pd-table'],
  desc: 'La Liga upcoming matches', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/laliga/upcomingmatches`);
      const matches = data?.result?.upcomingMatches;
      if (!matches?.length) return xreply('❌ No upcoming La Liga matches found.');
      let text = `⚽ *LA LIGA UPCOMING MATCHES*\n\n`;
      matches.forEach(m => {
        text += `🏟 Matchday: ${m.matchday}\n🏠 ${m.homeTeam} ⚡ ${m.awayTeam}\n🗓 ${m.date}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching La Liga matches.'); }
  }
};

const laligatable = {
  command: ['laligatable', 'laliga'],
  desc: 'La Liga points table', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/laliga/standings`);
      const s = data?.result?.standings;
      if (!s?.length) return xreply('❌ No La Liga standings found.');
      let text = `📊 *LA LIGA POINTS*\n\n`;
      s.forEach(t => { text += `${t.position}. ${t.team} — ${t.points} pts\n`; });
      xreply(text);
    } catch { xreply('❌ Error fetching La Liga points.'); }
  }
};

const laligascorers = {
  command: ['laligascorers'],
  desc: 'La Liga top scorers', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/laliga/scorers`);
      const sc = data?.result?.topScorers;
      if (!sc?.length) return xreply('❌ No La Liga top scorers found.');
      let text = `⚽ *LA LIGA TOP SCORERS*\n\n`;
      sc.forEach(p => {
        text += `*${p.rank}. ${p.player}* — ${p.team}\nGoals: ${p.goals}`;
        if (p.assists != null) text += ` | Assists: ${p.assists}`;
        text += `\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching La Liga top scorers.'); }
  }
};

const ligue1fixtures = {
  command: ['ligue-1', 'lg-1'],
  desc: 'Ligue 1 upcoming matches', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/ligue1/upcomingmatches`);
      const matches = data?.result?.upcomingMatches;
      if (!matches?.length) return xreply('❌ No upcoming Ligue 1 matches found.');
      let text = `⚽ *LIGUE 1 UPCOMING MATCHES*\n\n`;
      matches.forEach(m => {
        text += `*Matchday ${m.matchday}*\n${m.homeTeam} 🆚 ${m.awayTeam}\nDate: ${m.date}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching Ligue 1 matches.'); }
  }
};

const ligue1table = {
  command: ['ligue1table'],
  desc: 'Ligue 1 standings', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/ligue1/standings`);
      const s = data?.result?.standings;
      if (!s?.length) return xreply('❌ No Ligue 1 standings found.');
      let text = `📊 *LIGUE 1 STANDINGS*\n\n`;
      s.forEach(t => { text += `${t.position}. ${t.team} — ${t.points} pts\n`; });
      xreply(text);
    } catch { xreply('❌ Error fetching Ligue 1 standings.'); }
  }
};

const liguescorers = {
  command: ['liguescorers'],
  desc: 'Ligue 1 top scorers', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/ligue1/scorers`);
      const sc = data?.result?.topScorers;
      if (!sc?.length) return xreply('❌ No Ligue 1 top scorers found.');
      let text = `⚽ *LIGUE 1 TOP SCORERS*\n\n`;
      sc.slice(0, 10).forEach(p => {
        text += `*${p.rank}. ${p.player}* — ${p.team}\nGoals: ${p.goals}`;
        if (p.assists != null) text += ` | Assists: ${p.assists}`;
        text += `\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching Ligue 1 top scorers.'); }
  }
};

const serieamatches = {
  command: ['serieamatches', 'serie-a', 'sa-table'],
  desc: 'Serie A upcoming matches', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/seriea/upcomingmatches`);
      const matches = data?.result?.upcomingMatches;
      if (!matches?.length) return xreply('❌ No upcoming Serie A matches found.');
      let text = `⚽ *SERIE A UPCOMING MATCHES*\n\n`;
      matches.forEach((m, i) => {
        text += `*${i + 1}. Matchday ${m.matchday}*\n🏠 ${m.homeTeam} vs ${m.awayTeam}\n🗓 ${m.date}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching Serie A matches.'); }
  }
};

const serieastats = {
  command: ['serieastats', 'serieastandings'],
  desc: 'Serie A standings', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/seriea/standings`);
      const s = data?.result?.standings;
      if (!s?.length) return xreply('❌ No Serie A standings found.');
      let text = `📊 *SERIE A TABLE*\n\n`;
      s.forEach(t => { text += `${t.position}. ${t.team} – ${t.points} pts\n`; });
      xreply(text);
    } catch { xreply('❌ Error fetching Serie A standings.'); }
  }
};

const serieascorers = {
  command: ['serieascorers'],
  desc: 'Serie A top scorers', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/seriea/scorers`);
      const sc = data?.result?.topScorers;
      if (!sc?.length) return xreply('❌ No Serie A top scorers found.');
      let text = `⚽ *SERIE A TOP SCORERS*\n\n`;
      sc.slice(0, 10).forEach(p => {
        text += `*${p.rank}. ${p.player}* — ${p.team}\nGoals: ${p.goals}`;
        if (p.assists != null) text += ` | Assists: ${p.assists}`;
        text += `\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching Serie A top scorers.'); }
  }
};

const livescore = {
  command: ['livescore'],
  desc: 'Live football scores', category: 'Sports',
  run: async ({ xreply }) => {
    try {
      const data = await fetchJson(`${API}/livescore`);
      if (!data?.status || !data?.result?.response?.length)
        return xreply('⚠️ No live matches found right now.');
      let text = `🏆 *LIVE FOOTBALL SCORES*\n\n`;
      data.result.response.forEach((match, i) => {
        const league    = match.league?.name ?? 'Unknown League';
        const home      = match.teams?.home?.name ?? 'Home';
        const away      = match.teams?.away?.name ?? 'Away';
        const scoreHome = match.goals?.home ?? 0;
        const scoreAway = match.goals?.away ?? 0;
        const minute    = match.fixture?.status?.elapsed ?? 0;
        const status    = match.fixture?.status?.long ?? 'Unknown';
        text += `${i + 1}. ${league}\n🏟️ ${home} ${scoreHome} - ${scoreAway} ${away}\n⏱️ ${minute}' | 📡 ${status}\n──────────────\n`;
      });
      xreply(text);
    } catch { xreply('❌ Error fetching live scores.'); }
  }
};

const player = {
  command: ['player'],
  desc: 'Search for a football player', category: 'Sports',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    try {
      const q = args.join(' ');
      if (!q) return xreply('⚽ Usage: .player <name>\nExample: .player Ronaldo');
      const data = await fetchJson(`${API}/sport/playersearch?q=${encodeURIComponent(q)}`);
      if (!data?.result?.length) return xreply('❌ Player not found.');
      for (const p of data.result.slice(0, 3)) {
        const caption = `*${p.name}*\n🏟️ ${p.team}\n🌍 ${p.nationality}\n🎂 ${p.birthDate}\n⚡ ${p.status}\n🎯 ${p.position}`;
        if (p.thumbnail) {
          await trashcore.sendMessage(chat, { image: { url: p.thumbnail }, caption }, { quoted: m });
        } else {
          xreply(caption);
        }
      }
    } catch { xreply('❌ Error fetching player data.'); }
  }
};

const club = {
  command: ['club'],
  desc: 'Search for a football club', category: 'Sports',
  run: async ({ trashcore, m, chat, args, xreply }) => {
    try {
      const q = args.join(' ');
      if (!q) return xreply('⚽ Usage: .club <name>\nExample: .club Arsenal');
      const data = await fetchJson(`${API}/sport/teamsearch?q=${encodeURIComponent(q)}`);
      if (!data?.result?.length) return xreply('❌ Club not found.');
      const t = data.result[0];
      const text = `🏆 *${t.name}*\n📍 ${t.location ?? 'Unknown'} | 🌍 ${t.country ?? 'Unknown'}\n🏟️ ${t.stadium ?? 'Unknown'} | 🪙 Founded: ${t.formedYear ?? 'Unknown'}\n🔗 ${t.social?.website ?? 'N/A'}\n\n${(t.description ?? '').substring(0, 400)}`;
      const img = t.fanArt?.[0] || t.badges?.large;
      if (img) {
        await trashcore.sendMessage(chat, { image: { url: img }, caption: text }, { quoted: m });
      } else {
        xreply(text);
      }
    } catch { xreply('❌ Error fetching club data.'); }
  }
};

module.exports = [
  eplfixtures, eplstandings, epltopscorers,
  bundesliga, bundesligastats, bundesligascores,
  laligamatches, laligatable, laligascorers,
  ligue1fixtures, ligue1table, liguescorers,
  serieamatches, serieastats, serieascorers,
  livescore, player, club
];
