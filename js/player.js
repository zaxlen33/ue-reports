// website/js/player.js
// Player Dashboard — renders charts based on ?view= parameter.
// Views:
//   hunt   → hunt charts only  (from hunt.html)
//   war    → might + kills history charts  (from war.html)
//   all    → all charts  (from history.html)
//   member → all charts  (from members.html / Check Member)

// Configure global Chart.js defaults to match dark UI
Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#30363d';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

async function initPlayer() {
  const container = document.getElementById('player-container');
  if (!container) return;

  const urlParams   = new URLSearchParams(window.location.search);
  const playerName  = urlParams.get('id');
  const view        = urlParams.get('view') || 'all';  // declared early — used in breadcrumb

  if (!playerName) {
    setError(container, 'No player specified. Go back and select a player.');
    return;
  }

  setLoading(container, `Loading data for ${playerName}…`);

  try {
    const [historyRes, huntsRes] = await Promise.allSettled([
      loadJSON('history.json'),
      loadJSON('member_hunts.json')
    ]);

    const historyData = historyRes.status === 'fulfilled' ? historyRes.value : { members: [] };
    const allHunts    = huntsRes.status  === 'fulfilled' ? huntsRes.value  : {};

    const playerGrowth = (historyData.members || []).find(m => m.name === playerName);
    const playerHunts  = allHunts[playerName] || [];

    if (!playerGrowth && !playerHunts.length) {
      setError(container, `Player "${playerName}" not found in current records.`);
      return;
    }

    renderPlayerDashboard(container, playerName, view, playerGrowth, playerHunts);

  } catch (err) {
    setError(container, 'Could not load player data. ' + err.message);
  }
}

function renderPlayerDashboard(container, name, view, growth, hunts) {
  const snaps      = growth ? growth.snapshots || [] : [];
  const latestSnap = snaps.length ? snaps[snaps.length - 1] : null;
  const latestHunt = hunts.length  ? hunts[hunts.length - 1]  : null;

  // ── Back breadcrumb depends on view ──────────────────────────────
  let backLink, backText;
  if      (view === 'war')    { backLink = './war.html';     backText = '🏰 War Reports'; }
  else if (view === 'hunt')   { backLink = './hunt.html';    backText = '🦅 Hunt Reports'; }
  else if (view === 'member') { backLink = './members.html'; backText = '👥 Check Member'; }
  else                        { backLink = './history.html'; backText = '📈 All History'; }

  const avatarLetter = name.charAt(0).toUpperCase();

  // ── Summary stat cards ────────────────────────────────────────────
  // Hunt-only view: show hunt stats. War/all: show might+kills.
  const showWarStats  = (view !== 'hunt');
  const showHuntStats = (view !== 'war');

  let statCards = '';
  if (showWarStats && latestSnap) {
    statCards += `
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtNum(latestSnap.might)}</div>
        <div class="stat-label">Current Might</div>
        ${latestSnap.might_diff ? `<div class="stat-delta ${latestSnap.might_diff > 0 ? 'positive' : latestSnap.might_diff < 0 ? 'negative' : 'neutral'}">${fmtDelta(latestSnap.might_diff, false)} this week</div>` : ''}
      </div>
      <div class="stat-card red">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtNum(latestSnap.kills)}</div>
        <div class="stat-label">Current Kills</div>
        ${latestSnap.kills_diff ? `<div class="stat-delta ${latestSnap.kills_diff > 0 ? 'positive' : 'neutral'}">${fmtDelta(latestSnap.kills_diff, false)} this week</div>` : ''}
      </div>`;
  }
  if (showHuntStats && latestHunt) {
    statCards += `
      <div class="stat-card green">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">${fmtNum(latestHunt.pts_total)}</div>
        <div class="stat-label">Latest Hunt Pts</div>
        <div class="stat-delta ${latestHunt.met_minimum ? 'positive' : 'negative'}">${latestHunt.met_minimum ? '✅ Goal Met' : '❌ Goal Missed'}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">💎</div>
        <div class="stat-value">${fmtNum(latestHunt.pts_purchase)}</div>
        <div class="stat-label">Purchase Pts</div>
      </div>`;
  }

  let html = `
    <div class="breadcrumb" style="margin-bottom: 2rem;">
      <a href="${backLink}">${backText}</a>
      <span class="sep">›</span>
      <span class="current">${name}</span>
    </div>

    <div class="profile-header">
      <div class="profile-avatar">${avatarLetter}</div>
      <div class="profile-info">
        <h1>${name}</h1>
        <p>IGG ID: ${growth ? growth.igg_id : 'Unknown'} &nbsp;|&nbsp; Rank: ${latestSnap ? latestSnap.rank : '—'}</p>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:2rem;">
      ${statCards || '<div style="color:var(--text-muted);padding:0.5rem;">No snapshot data available yet.</div>'}
    </div>
  `;

  // ── War / All / Member: Might + Kills history charts ─────────────
  if (view === 'war' || view === 'all' || view === 'member') {
    html += `
      <div class="charts-grid" style="margin-bottom:2rem;">
        <div class="card">
          <div class="card-header"><h2>📈 Power History (Weekly, up to 52w)</h2></div>
          <div class="card-body"><div class="chart-container"><canvas id="chart-might"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h2>⚔️ Kills History (Weekly, up to 52w)</h2></div>
          <div class="card-body"><div class="chart-container"><canvas id="chart-kills"></canvas></div></div>
        </div>
      </div>
    `;
  }

  // ── Hunt / All / Member: Hunt point progression + bar chart ──────
  if (view === 'hunt' || view === 'all' || view === 'member') {
    html += `
      <div class="charts-grid">
        <div class="card">
          <div class="card-header"><h2>🦅 Hunt Point Progression</h2></div>
          <div class="card-body"><div class="chart-container"><canvas id="chart-hunt-pts"></canvas></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h2>📦 Latest Monsters &amp; Chests</h2></div>
          <div class="card-body"><div class="chart-container"><canvas id="chart-hunt-bar"></canvas></div></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // ── Mount War/History charts ──────────────────────────────────────
  if (view === 'war' || view === 'all' || view === 'member') {
    if (snaps.length > 0) {
      const dates     = snaps.map(s => s.date);
      const mightData = snaps.map(s => s.might);
      const killsData = snaps.map(s => s.kills);
      createLineChart('chart-might', 'Might', dates, mightData, '#58a6ff');
      createLineChart('chart-kills', 'Kills', dates, killsData, '#f85149');
    } else {
      const noData = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">No history data available yet.</p>';
      if (document.getElementById('chart-might')) document.getElementById('chart-might').parentNode.innerHTML = noData;
      if (document.getElementById('chart-kills')) document.getElementById('chart-kills').parentNode.innerHTML = noData;
    }
  }

  // ── Mount Hunt charts ─────────────────────────────────────────────
  if (view === 'hunt' || view === 'all' || view === 'member') {
    if (hunts.length > 0) {
      // Mark last week as potentially incomplete
      const dates   = hunts.map((h, i) => i === hunts.length - 1 ? h.date + ' (Ongoing)' : h.date);
      const huntPts = hunts.map(h => h.pts_hunt);
      createLineChart('chart-hunt-pts', 'Hunt Points', dates, huntPts, '#3fb950', true);

      const { monsters, purchases } = latestHunt;
      const labels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
      const mData  = [monsters.lvl1||0, monsters.lvl2||0, monsters.lvl3||0, monsters.lvl4||0, monsters.lvl5||0];
      const pData  = [purchases.lvl1||0, purchases.lvl2||0, purchases.lvl3||0, purchases.lvl4||0, purchases.lvl5||0];
      createDoubleBarChart('chart-hunt-bar', labels, 'Monsters Hunted', mData, '#a371f7', 'Chests Purchased', pData, '#e3b341');
    } else {
      const noData = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">No hunt data available yet.</p>';
      if (document.getElementById('chart-hunt-pts')) document.getElementById('chart-hunt-pts').parentNode.innerHTML = noData;
      if (document.getElementById('chart-hunt-bar')) document.getElementById('chart-hunt-bar').parentNode.innerHTML = noData;
    }
  }
}

function createLineChart(canvasId, label, labels, data, color, isHunt = false) {
  const ctx = document.getElementById(canvasId).getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color + '66');
  gradient.addColorStop(1, color + '00');

  const dataset = {
    label,
    data,
    borderColor: color,
    backgroundColor: gradient,
    borderWidth: 2,
    pointBackgroundColor: '#0d1117',
    pointBorderColor: color,
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    fill: true,
    tension: 0.3
  };

  if (isHunt && data.length > 1) {
    dataset.segment = {
      borderDash: ctx => ctx.p0DataIndex === data.length - 2 ? [5, 5] : undefined,
    };
  }

  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [dataset] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          backgroundColor: 'rgba(13,17,23,0.9)',
          titleColor: '#c9d1d9', bodyColor: '#c9d1d9',
          borderColor: '#30363d', borderWidth: 1
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: false,
          ticks: {
            callback: value => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000)    return (value / 1000).toFixed(1) + 'k';
              return value;
            }
          }
        }
      }
    }
  });
}

function createDoubleBarChart(canvasId, labels, label1, data1, color1, label2, data2, color2) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: label1, data: data1, backgroundColor: color1, borderRadius: 4 },
        { label: label2, data: data2, backgroundColor: color2, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          backgroundColor: 'rgba(13,17,23,0.9)',
          titleColor: '#c9d1d9', bodyColor: '#c9d1d9',
          borderColor: '#30363d', borderWidth: 1
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  if (page === 'player.html') {
    initPlayer();
  }
});
