// website/js/rankings.js — Guild Rankings
// Top 5 power growth (30d), Top 5 kills (30d), Top 5 hunt (latest 7d week)

async function initRankings() {
  const container = document.getElementById('rankings-container');
  if (!container) return;

  setLoading(container, 'Loading rankings…');

  try {
    const [warsRes, huntsRes] = await Promise.allSettled([
      loadJSON('wars.json'),
      loadJSON('hunts.json'),
    ]);

    const wars  = warsRes.status  === 'fulfilled' ? warsRes.value  : [];
    const hunts = huntsRes.status === 'fulfilled' ? huntsRes.value : [];

    // ── 30-day data: latest war month ────────────────────────────────
    const latestWar = wars.length ? wars[wars.length - 1] : null;
    const warMembers = latestWar ? (latestWar.members || []) : [];

    const top5MightGrowth = [...warMembers]
      .sort((a, b) => (b.might_diff || 0) - (a.might_diff || 0))
      .slice(0, 5);

    const top5KillsGrowth = [...warMembers]
      .sort((a, b) => (b.kills_diff || 0) - (a.kills_diff || 0))
      .slice(0, 5);

    // ── 7-day hunt: latest weekly hunt ──────────────────────────────
    const latestHunt = hunts.length ? hunts[hunts.length - 1] : null;
    const huntPlayers = latestHunt
      ? [...(latestHunt.players || [])].filter(p => !p.is_anonymous)
      : [];

    const top5Hunt = [...huntPlayers]
      .sort((a, b) => (b.pts_total || 0) - (a.pts_total || 0))
      .slice(0, 5);

    const warMonth   = latestWar  ? latestWar.label  : '—';
    const huntWeek   = latestHunt ? latestHunt.date   : '—';
    const warMonthId = latestWar  ? latestWar.month   : '';
    const huntWeekId = latestHunt ? latestHunt.id     : '';

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;margin-bottom:2rem;">
        ${renderWarLeaderboard('📈 Top 5 — Power Growth (30d)', top5MightGrowth, 'might_diff', 'var(--accent-blue)', warMonth, warMonthId)}
        ${renderWarLeaderboard('⚔️ Top 5 — Kills Growth (30d)', top5KillsGrowth, 'kills_diff', 'var(--accent-yellow)', warMonth, warMonthId)}
        ${renderHuntLeaderboard('🦅 Top 5 — Hunt Points (7d)', top5Hunt, huntWeek, huntWeekId)}
      </div>`;

  } catch (err) {
    setError(container, 'Could not load rankings: ' + err.message);
  }
}

function renderWarLeaderboard(title, members, metric, color, monthLabel, monthId) {
  if (!members.length) {
    return `<div class="card" style="border-top:3px solid ${color};">
      <div class="card-header"><h2>${title}</h2></div>
      <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:1.5rem;">No war data yet.</p></div>
    </div>`;
  }

  const ranks = ['🥇', '🥈', '🥉', '4', '5'];

  return `
    <div class="card" style="border-top:3px solid ${color};">
      <div class="card-header">
        <h2>${title}</h2>
        <span style="font-size:0.8rem;color:var(--text-muted);">${monthLabel}</span>
      </div>
      <div class="card-body" style="padding:0;">
        ${members.map((m, i) => {
          const val = m[metric] || 0;
          const sign = val > 0 ? '+' : '';
          const valColor = val > 0 ? 'var(--accent-green)' : val < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
          return `
            <div class="leaderboard-row">
              <span class="leaderboard-rank${i < 3 ? ' top-' + (i+1) : ''}">${ranks[i]}</span>
              <a href="player.html?view=war&id=${encodeURIComponent(m.name)}&month=${monthId}"
                 class="leaderboard-name">${m.name}</a>
              <span class="leaderboard-value" style="color:${valColor};">${sign}${fmtNum(val)}</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderHuntLeaderboard(title, players, weekLabel, weekId) {
  if (!players.length) {
    return `<div class="card" style="border-top:3px solid var(--accent-green);">
      <div class="card-header"><h2>${title}</h2></div>
      <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:1.5rem;">No hunt data yet.</p></div>
    </div>`;
  }

  const ranks = ['🥇', '🥈', '🥉', '4', '5'];
  const minReq = 56;

  return `
    <div class="card" style="border-top:3px solid var(--accent-green);">
      <div class="card-header">
        <h2>${title}</h2>
        <span style="font-size:0.8rem;color:var(--text-muted);">${weekLabel}</span>
      </div>
      <div class="card-body" style="padding:0;">
        ${players.map((p, i) => {
          const pts = p.pts_total || 0;
          const met = p.met_minimum || false;
          const pct = Math.min(100, Math.round((pts / minReq) * 100));
          const statusColor = met ? 'var(--accent-green)' : 'var(--accent-red)';
          return `
            <div class="leaderboard-row">
              <span class="leaderboard-rank${i < 3 ? ' top-' + (i+1) : ''}">${ranks[i]}</span>
              <a href="player.html?view=hunt&id=${encodeURIComponent(p.name)}&week=${encodeURIComponent(weekId)}"
                 class="leaderboard-name">${p.name}</a>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="leaderboard-value" style="color:var(--accent-green);">${fmtNum(pts)}</span>
                <span style="font-size:0.75rem;">${met ? '✅' : '❌'}</span>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.split('/').pop() === 'rankings.html') initRankings();
});
