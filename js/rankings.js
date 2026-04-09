// website/js/rankings.js — Guild Rankings
// Top 5 power growth (30d), Top 5 kills (30d), Top 5 hunt (latest 7d week)

async function initRankings() {
  const container = document.getElementById('rankings-container');
  if (!container) return;

  setLoading(container, t('loading_rankings'));

  try {
    const [warsRes, huntsRes, festRes] = await Promise.allSettled([
      loadJSON('wars.json'),
      loadJSON('hunts.json'),
      loadJSON('festival.json'),
    ]);

    const wars  = warsRes.status  === 'fulfilled' ? warsRes.value  : [];
    const hunts = huntsRes.status === 'fulfilled' ? huntsRes.value : [];
    const fests = festRes.status  === 'fulfilled' ? festRes.value  : [];

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

    // ── Festival: latest event ────────────────────────────────
    const latestFest = fests.length ? fests[fests.length - 1] : null;
    const festPlayers = latestFest ? (latestFest.players || []) : [];

    const top5Fest = [...festPlayers]
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    const warMonth   = latestWar  ? latestWar.label  : '—';
    const huntWeek   = latestHunt ? latestHunt.date   : '—';
    const festDate   = latestFest ? latestFest.date   : '—';
    const warMonthId = latestWar  ? latestWar.month   : '';
    const huntWeekId = latestHunt ? latestHunt.id     : '';

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;margin-bottom:2rem;">
        ${renderWarLeaderboard(t('rank_power_growth'), top5MightGrowth, 'might_diff', 'var(--accent-blue)', warMonth, warMonthId)}
        ${renderWarLeaderboard(t('rank_kills_growth'), top5KillsGrowth, 'kills_diff', 'var(--accent-yellow)', warMonth, warMonthId)}
        ${renderHuntLeaderboard(t('rank_hunt_pts'), top5Hunt, huntWeek, huntWeekId)}
        ${renderFestivalLeaderboard(t('rank_festival_pts'), top5Fest, festDate)}
      </div>`;

  } catch (err) {
    setError(container, t('error_loading') + ': ' + err.message);
  }
}

function renderWarLeaderboard(title, members, metric, color, monthLabel, monthId) {
  if (!members.length) {
    return `<div class="card" style="border-top:3px solid ${color};">
      <div class="card-header"><h2>${title}</h2></div>
      <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:1.5rem;">${t('no_war_data')}</p></div>
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
      <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:1.5rem;">${t('no_hunt_data')}</p></div>
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
  if (window.location.pathname.split('/').pop() !== 'rankings.html') return;
  // Wait for i18n to be ready before first render
  const checkI18n = setInterval(() => {
    if (window.i18n && Object.keys(window.i18n.data).length > 0) {
      clearInterval(checkI18n);
      initRankings();
    }
  }, 50);
});

window.addEventListener('languageChanged', () => {
  if (window.location.pathname.split('/').pop() === 'rankings.html') initRankings();
});

function renderFestivalLeaderboard(title, players, dateLabel) {
  if (!players.length) {
    return `<div class="card" style="border-top:3px solid #a855f7;">
      <div class="card-header"><h2>${title}</h2></div>
      <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:1.5rem;">${t('no_fest_data')}</p></div>
    </div>`;
  }

  const ranks = ['🥇', '🥈', '🥉', '4', '5'];
  const minReq = 3100;

  return `
    <div class="card" style="border-top:3px solid #a855f7;">
      <div class="card-header">
        <h2>${title}</h2>
        <span style="font-size:0.8rem;color:var(--text-muted);">${dateLabel}</span>
      </div>
      <div class="card-body" style="padding:0;">
        ${players.map((p, i) => {
          const pts = p.score || 0;
          const met = pts >= minReq;
          const statusColor = met ? 'var(--accent-green)' : 'var(--text-muted)';
          return `
            <div class="leaderboard-row">
              <span class="leaderboard-rank${i < 3 ? ' top-' + (i+1) : ''}">${ranks[i]}</span>
              <a href="player.html?view=festival&id=${encodeURIComponent(p.name)}"
                 class="leaderboard-name">${p.name}</a>
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="leaderboard-value" style="color:${statusColor};">${fmtNum(pts)}</span>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}
