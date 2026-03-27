// website/js/player.js — Player Detail Dashboard
// Views driven by ?view=war|hunt|all|member&id=NAME[&month=YYYY-MM][&week=WEEK_ID]

Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#30363d';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

// ─── Chart helpers ───────────────────────────────────────────────────────────

function makeLineChart(canvasId, label, labels, data, color, dashed = false) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '00');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label, data, borderColor: color, backgroundColor: grad,
        borderWidth: 2, fill: true, tension: 0.3,
        pointBackgroundColor: '#0d1117', pointBorderColor: color,
        pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
        ...(dashed ? { borderDash: [5, 5] } : {})
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          backgroundColor: 'rgba(13,17,23,0.95)',
          titleColor: '#c9d1d9', bodyColor: '#c9d1d9',
          borderColor: '#30363d', borderWidth: 1,
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              if (v >= 1e6) return ` ${label}: ${(v/1e6).toFixed(2)}M`;
              if (v >= 1e3) return ` ${label}: ${(v/1e3).toFixed(1)}k`;
              return ` ${label}: ${v}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45 } },
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v
          }
        }
      }
    }
  });
}

function makeBarChart(canvasId, labels, datasets) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: datasets.map(d => ({ ...d, borderRadius: 4 })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          backgroundColor: 'rgba(13,17,23,0.95)',
          titleColor: '#c9d1d9', bodyColor: '#c9d1d9',
          borderColor: '#30363d', borderWidth: 1
        }
      },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
    }
  });
}

// ─── Reusable card builders ──────────────────────────────────────────────────

function chartCard(title, canvasId, height = 280) {
  return `<div class="card">
    <div class="card-header"><h2>${title}</h2></div>
    <div class="card-body"><div style="position:relative;height:${height}px;"><canvas id="${canvasId}"></canvas></div></div>
  </div>`;
}

function noDataCard(title, msg = 'Not enough data yet.') {
  return `<div class="card">
    <div class="card-header"><h2>${title}</h2></div>
    <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:2rem;">${msg}</p></div>
  </div>`;
}

function quotaBadge(killsDiff) {
  const met = killsDiff >= 1_000_000;
  const pct = Math.min(100, Math.round((killsDiff / 1_000_000) * 100));
  const color = met ? 'var(--accent-green)' : pct >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  return `
    <div class="card" style="border-top:3px solid ${color};">
      <div class="card-header"><h2>⚔️ Monthly Kill Quota (1M)</h2></div>
      <div class="card-body" style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">
        <div style="font-size:2.5rem;">${met ? '✅' : '❌'}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:1.1rem;color:${color};">
            ${met ? 'GOAL MET' : 'GOAL NOT MET'}
          </div>
          <div style="color:var(--text-secondary);margin-top:4px;">
            ${fmtNum(killsDiff)} / 1,000,000 kills gained this month
          </div>
          <div style="margin-top:10px;">
            <div class="progress-bar" style="width:100%;max-width:300px;">
              <div class="progress-fill" style="width:${pct}%;background:${color};"></div>
            </div>
            <span style="font-family:var(--font-mono);font-size:0.85rem;color:${color};">${pct}%</span>
          </div>
        </div>
      </div>
    </div>`;
}

function profileHeader(name, growth, view) {
  const snaps     = growth ? growth.snapshots || [] : [];
  const lastSnap  = snaps.length ? snaps[snaps.length - 1] : null;
  const initial   = name.charAt(0).toUpperCase();

  let backLink, backText;
  if      (view === 'war')    { backLink = './war.html';     backText = '🏰 War Reports'; }
  else if (view === 'hunt')   { backLink = './hunt.html';    backText = '🦅 Hunt Reports'; }
  else if (view === 'all')    { backLink = './history.html'; backText = '📈 All History'; }
  else                        { backLink = './members.html'; backText = '👥 Check Member'; }

  return `
    <div class="breadcrumb" style="margin-bottom:1.5rem;">
      <a href="${backLink}">${backText}</a>
      <span class="sep">›</span>
      <span class="current">${name}</span>
    </div>
    <div class="profile-header">
      <div class="profile-avatar">${initial}</div>
      <div class="profile-info">
        <h1>${name}</h1>
        <p>
          IGG ID: ${growth ? growth.igg_id : '—'} &nbsp;|&nbsp;
          Rank: ${lastSnap ? lastSnap.rank : '—'} &nbsp;|&nbsp;
          First seen: ${growth ? growth.first_seen || '—' : '—'}
        </p>
      </div>
    </div>`;
}

// ─── VIEW: WAR ───────────────────────────────────────────────────────────────
// Shows: 30-day power, 30-day kills, 52w power history, 52w kills history + quota badge

async function renderWarView(container, name, month, growth) {
  // Load wars.json for 30-day monthly data
  let warMonthData = null;
  try {
    const wars = await loadJSON('wars.json');
    const warMonth = wars.find(w => w.month === month);
    if (warMonth) {
      warMonthData = (warMonth.members || []).find(m => m.name === name);
    }
  } catch {}

  const snaps52 = growth ? (growth.snapshots || []) : [];

  // Build 30-day single-value bar (first vs last in month)
  const mightDiff = warMonthData ? warMonthData.might_diff : 0;
  const killsDiff = warMonthData ? warMonthData.kills_diff : 0;
  const monthLabel = month || 'Latest Month';

  let html = profileHeader(name, growth, 'war');

  // Stat cards for this month
  html += `<div class="stats-grid" style="margin-bottom:1.5rem;">
    <div class="stat-card blue">
      <div class="stat-icon">🏰</div>
      <div class="stat-value">${warMonthData ? fmtNum(warMonthData.might) : '—'}</div>
      <div class="stat-label">Current Might</div>
      <div class="stat-delta ${mightDiff > 0 ? 'positive' : mightDiff < 0 ? 'negative' : 'neutral'}">${fmtDelta(mightDiff, false)} this month</div>
    </div>
    <div class="stat-card yellow">
      <div class="stat-icon">⚔️</div>
      <div class="stat-value">${warMonthData ? fmtNum(warMonthData.kills) : '—'}</div>
      <div class="stat-label">Current Kills</div>
      <div class="stat-delta ${killsDiff > 0 ? 'positive' : 'neutral'}">${fmtDelta(killsDiff, false)} this month</div>
    </div>
  </div>`;

  // Quota badge
  html += `<div style="margin-bottom:1.5rem;">${quotaBadge(killsDiff)}</div>`;

  // 30-day charts (single bar comparing first vs last)
  html += `<h3 style="color:var(--text-secondary);margin:1.5rem 0 0.75rem;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">📅 This Month — ${monthLabel}</h3>`;
  html += `<div class="charts-grid" style="margin-bottom:1.5rem;">`;
  if (warMonthData) {
    html += chartCard('📈 Power Gained (30 days)', 'chart-war-might-30d');
    html += chartCard('⚔️ Kills Gained (30 days)', 'chart-war-kills-30d');
  } else {
    html += noDataCard('📈 Power Gained (30 days)', 'No war data for this month.');
    html += noDataCard('⚔️ Kills Gained (30 days)', 'No war data for this month.');
  }
  html += `</div>`;

  // 52-week history
  html += `<h3 style="color:var(--text-secondary);margin:1.5rem 0 0.75rem;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">📊 All History — 52 Weeks</h3>`;
  html += `<div class="charts-grid" style="margin-bottom:1.5rem;">`;
  if (snaps52.length >= 2) {
    html += chartCard('🏰 Power Over Time (52w)', 'chart-war-might-52w');
    html += chartCard('⚔️ Kills Over Time (52w)', 'chart-war-kills-52w');
  } else {
    html += noDataCard('🏰 Power Over Time (52w)', 'At least 2 weekly snapshots needed.');
    html += noDataCard('⚔️ Kills Over Time (52w)', 'At least 2 weekly snapshots needed.');
  }
  html += `</div>`;

  container.innerHTML = html;

  // Mount 30-day charts (bar: before vs after)
  if (warMonthData) {
    makeBarChart('chart-war-might-30d',
      ['Start of Month', 'End of Month'],
      [{ label: 'Power', data: [warMonthData.might - mightDiff, warMonthData.might], backgroundColor: ['#30363d', '#58a6ff'] }]
    );
    makeBarChart('chart-war-kills-30d',
      ['Start of Month', 'End of Month'],
      [{ label: 'Kills', data: [warMonthData.kills - killsDiff, warMonthData.kills], backgroundColor: ['#30363d', '#f0883e'] }]
    );
  }

  // Mount 52w line charts
  if (snaps52.length >= 2) {
    const dates     = snaps52.map(s => s.date);
    const mightVals = snaps52.map(s => s.might);
    const killsVals = snaps52.map(s => s.kills);
    makeLineChart('chart-war-might-52w', 'Might', dates, mightVals, '#58a6ff');
    makeLineChart('chart-war-kills-52w', 'Kills', dates, killsVals, '#f85149');
  }
}

// ─── VIEW: HUNT ──────────────────────────────────────────────────────────────
// Shows: that week's point total + goal badge, hunt pts line chart, monsters/purchases bar

async function renderHuntView(container, name, weekId, allHunts) {
  // Find the specific week's data for this player
  let weekEntry = null;
  let playerInWeek = null;

  if (weekId) {
    weekEntry = allHunts.find(h => h.id === weekId || h.date === weekId);
  } else {
    weekEntry = allHunts.length ? allHunts[allHunts.length - 1] : null;
  }

  if (weekEntry) {
    playerInWeek = (weekEntry.players || []).find(p => p.name === name);
  }

  // Also build per-player weekly progression from member_hunts.json
  let playerHistory = [];
  try {
    const mhunts = await loadJSON('member_hunts.json');
    playerHistory = mhunts[name] || [];
  } catch {}

  const minReq = weekEntry ? (weekEntry.summary.min_required || 56) : 56;
  const pts    = playerInWeek ? playerInWeek.pts_total : 0;
  const met    = playerInWeek ? playerInWeek.met_minimum : false;
  const pct    = Math.min(100, Math.round((pts / minReq) * 100));
  const pctColor = met ? 'var(--accent-green)' : pct >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  let html = `
    <div class="breadcrumb" style="margin-bottom:1.5rem;">
      <a href="./hunt.html">🦅 Hunt Reports</a>
      <span class="sep">›</span>
      <span class="current">${name}</span>
    </div>
    <div class="profile-header">
      <div class="profile-avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="profile-info">
        <h1>${name}</h1>
        <p>Week: ${weekEntry ? weekEntry.date : '—'}</p>
      </div>
    </div>`;

  // Goal status card
  html += `<div class="card" style="border-top:3px solid ${pctColor};margin-bottom:1.5rem;">
    <div class="card-header"><h2>🎯 Weekly Hunt Goal (${minReq} pts required)</h2></div>
    <div class="card-body" style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">
      <div style="font-size:2.5rem;">${met ? '✅' : '❌'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:1.1rem;color:${pctColor};">${met ? 'GOAL MET' : 'GOAL NOT MET'}</div>
        <div style="color:var(--text-secondary);margin-top:4px;">${fmtNum(pts)} / ${minReq} points</div>
        <div style="margin-top:10px;">
          <div class="progress-bar" style="width:100%;max-width:300px;">
            <div class="progress-fill" style="width:${pct}%;background:${pctColor};"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:0.85rem;color:${pctColor};">${pct}%</span>
        </div>
      </div>
      ${playerInWeek ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.85rem;min-width:180px;">
        <div style="color:var(--text-secondary);">Hunt Pts:</div><div style="font-weight:700;">${fmtNum(playerInWeek.pts_hunt)}</div>
        <div style="color:var(--text-secondary);">Purchase Pts:</div><div style="font-weight:700;">${fmtNum(playerInWeek.pts_purchase)}</div>
      </div>` : ''}
    </div>
  </div>`;

  // Charts
  html += `<div class="charts-grid">`;
  if (playerHistory.length > 0) {
    html += chartCard('📈 Hunt Points Progression (all weeks)', 'chart-hunt-pts');
  } else {
    html += noDataCard('📈 Hunt Points Progression', 'No weekly hunt history yet.');
  }
  if (playerInWeek) {
    html += chartCard('📦 This Week: Monsters & Chests', 'chart-hunt-bar');
  } else {
    html += noDataCard('📦 This Week: Monsters & Chests', 'No data for this week.');
  }
  html += `</div>`;

  container.innerHTML = html;

  // Mount points line chart
  if (playerHistory.length > 0) {
    const dates   = playerHistory.map((h, i) => i === playerHistory.length - 1 ? h.date + ' ⟳' : h.date);
    const ptsData = playerHistory.map(h => h.pts_total);
    makeLineChart('chart-hunt-pts', 'Total Points', dates, ptsData, '#3fb950');
  }

  // Mount bar chart for this week
  if (playerInWeek) {
    const { monsters = {}, purchases = {} } = playerInWeek;
    makeBarChart('chart-hunt-bar',
      ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4', 'Lvl 5'],
      [
        { label: 'Monsters Hunted', data: [monsters.lvl1||0, monsters.lvl2||0, monsters.lvl3||0, monsters.lvl4||0, monsters.lvl5||0], backgroundColor: '#a371f7' },
        { label: 'Chests Purchased', data: [purchases.lvl1||0, purchases.lvl2||0, purchases.lvl3||0, purchases.lvl4||0, purchases.lvl5||0], backgroundColor: '#e3b341' }
      ]
    );
  }
}

// ─── VIEW: ALL HISTORY ───────────────────────────────────────────────────────
// Shows: 52w power, 52w kills, 52w hunt pts, 52w total monsters bar

async function renderAllHistoryView(container, name, growth) {
  const snaps52 = growth ? (growth.snapshots || []) : [];
  let playerHunts = [];
  try {
    const mhunts = await loadJSON('member_hunts.json');
    playerHunts = mhunts[name] || [];
  } catch {}

  let html = profileHeader(name, growth, 'all');

  const lastSnap = snaps52.length ? snaps52[snaps52.length - 1] : null;
  const lastHunt = playerHunts.length ? playerHunts[playerHunts.length - 1] : null;

  html += `<div class="stats-grid" style="margin-bottom:1.5rem;">
    <div class="stat-card blue">
      <div class="stat-icon">🏰</div>
      <div class="stat-value">${lastSnap ? fmtNum(lastSnap.might) : '—'}</div>
      <div class="stat-label">Current Might</div>
    </div>
    <div class="stat-card yellow">
      <div class="stat-icon">⚔️</div>
      <div class="stat-value">${lastSnap ? fmtNum(lastSnap.kills) : '—'}</div>
      <div class="stat-label">Current Kills</div>
    </div>
    <div class="stat-card green">
      <div class="stat-icon">🎯</div>
      <div class="stat-value">${lastHunt ? fmtNum(lastHunt.pts_total) : '—'}</div>
      <div class="stat-label">Latest Hunt Pts</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-icon">📊</div>
      <div class="stat-value">${snaps52.length}</div>
      <div class="stat-label">Weekly Snapshots</div>
    </div>
  </div>`;

  html += `<div class="charts-grid" style="margin-bottom:1.5rem;">`;
  html += snaps52.length >= 2 ? chartCard('🏰 Power — 52 Weeks', 'chart-all-might') : noDataCard('🏰 Power — 52 Weeks');
  html += snaps52.length >= 2 ? chartCard('⚔️ Kills — 52 Weeks', 'chart-all-kills') : noDataCard('⚔️ Kills — 52 Weeks');
  html += `</div><div class="charts-grid">`;
  html += playerHunts.length >= 2 ? chartCard('🦅 Hunt Points — 52 Weeks', 'chart-all-hunt-pts') : noDataCard('🦅 Hunt Points — 52 Weeks', 'At least 2 weeks of hunt data needed.');
  html += lastHunt ? chartCard('📦 Cumulative Monsters & Chests (latest week)', 'chart-all-hunt-bar') : noDataCard('📦 Cumulative Monsters & Chests');
  html += `</div>`;

  container.innerHTML = html;

  if (snaps52.length >= 2) {
    const dates = snaps52.map(s => s.date);
    makeLineChart('chart-all-might', 'Might', dates, snaps52.map(s => s.might), '#58a6ff');
    makeLineChart('chart-all-kills', 'Kills', dates, snaps52.map(s => s.kills), '#f85149');
  }

  if (playerHunts.length >= 2) {
    const hdates = playerHunts.map((h, i) => i === playerHunts.length - 1 ? h.date + ' ⟳' : h.date);
    makeLineChart('chart-all-hunt-pts', 'Hunt Points', hdates, playerHunts.map(h => h.pts_total), '#3fb950');
  }

  if (lastHunt) {
    const { monsters = {}, purchases = {} } = lastHunt;
    makeBarChart('chart-all-hunt-bar',
      ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4', 'Lvl 5'],
      [
        { label: 'Monsters Hunted', data: [monsters.lvl1||0, monsters.lvl2||0, monsters.lvl3||0, monsters.lvl4||0, monsters.lvl5||0], backgroundColor: '#a371f7' },
        { label: 'Chests Purchased', data: [purchases.lvl1||0, purchases.lvl2||0, purchases.lvl3||0, purchases.lvl4||0, purchases.lvl5||0], backgroundColor: '#e3b341' }
      ]
    );
  }
}

// ─── VIEW: MEMBER (tabbed hub) ───────────────────────────────────────────────
// 3 tabs: War | Hunt | All History — all on the same page

async function renderMemberView(container, name, growth, wars, allHunts, playerHunts) {
  const snaps52 = growth ? (growth.snapshots || []) : [];
  const lastSnap = snaps52.length ? snaps52[snaps52.length - 1] : null;

  // Latest war entry for this member
  let latestWarMember = null;
  let latestWarMonth  = null;
  if (wars && wars.length) {
    const latestWar = wars[wars.length - 1];
    latestWarMember = (latestWar.members || []).find(m => m.name === name);
    latestWarMonth  = latestWar.month;
  }

  const latestHuntWeek = allHunts.length ? allHunts[allHunts.length - 1] : null;
  const latestHuntPlayer = latestHuntWeek
    ? (latestHuntWeek.players || []).find(p => p.name === name)
    : null;

  // Build each tab's content
  const tabWarId  = 'tab-war';
  const tabHuntId = 'tab-hunt';
  const tabAllId  = 'tab-all';

  let html = `
    <div class="breadcrumb" style="margin-bottom:1.5rem;">
      <a href="./members.html">👥 Check Member</a>
      <span class="sep">›</span>
      <span class="current">${name}</span>
    </div>
    <div class="profile-header">
      <div class="profile-avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="profile-info">
        <h1>${name}</h1>
        <p>
          IGG ID: ${growth ? growth.igg_id : '—'} &nbsp;|&nbsp;
          Rank: ${lastSnap ? lastSnap.rank : '—'}
        </p>
      </div>
    </div>

    <!-- Tab buttons -->
    <div style="display:flex;gap:0.5rem;margin:1.5rem 0;flex-wrap:wrap;">
      <button id="btn-war" class="player-tab active" onclick="switchTab('war')">🏰 War</button>
      <button id="btn-hunt" class="player-tab" onclick="switchTab('hunt')">🦅 Hunt</button>
      <button id="btn-all" class="player-tab" onclick="switchTab('all')">📈 All History</button>
    </div>

    <!-- WAR TAB -->
    <div id="${tabWarId}">
      ${latestWarMember ? `
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card blue"><div class="stat-icon">🏰</div>
          <div class="stat-value">${fmtNum(latestWarMember.might)}</div>
          <div class="stat-label">Might</div>
          <div class="stat-delta ${latestWarMember.might_diff > 0 ? 'positive' : latestWarMember.might_diff < 0 ? 'negative' : 'neutral'}">${fmtDelta(latestWarMember.might_diff, false)} this month</div>
        </div>
        <div class="stat-card yellow"><div class="stat-icon">⚔️</div>
          <div class="stat-value">${fmtNum(latestWarMember.kills)}</div>
          <div class="stat-label">Kills</div>
          <div class="stat-delta ${latestWarMember.kills_diff > 0 ? 'positive' : 'neutral'}">${fmtDelta(latestWarMember.kills_diff, false)} this month</div>
        </div>
      </div>
      <div style="margin-bottom:1.5rem;">${quotaBadge(latestWarMember.kills_diff)}</div>
      <div class="charts-grid" style="margin-bottom:1.5rem;">
        ${chartCard('📈 Power Gained (30 days)', 'chart-m-might-30d')}
        ${chartCard('⚔️ Kills Gained (30 days)', 'chart-m-kills-30d')}
      </div>` : `<div class="card"><div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:2rem;">No war data available for this member.</p></div></div>`}
      <div class="charts-grid">
        ${snaps52.length >= 2 ? chartCard('🏰 Power History (52w)', 'chart-m-might-52w') : noDataCard('🏰 Power History (52w)')}
        ${snaps52.length >= 2 ? chartCard('⚔️ Kills History (52w)', 'chart-m-kills-52w') : noDataCard('⚔️ Kills History (52w)')}
      </div>
    </div>

    <!-- HUNT TAB (hidden) -->
    <div id="${tabHuntId}" style="display:none;">
      ${latestHuntPlayer ? `
      <div style="margin-bottom:1.5rem;">
        ${(() => {
          const minReq = latestHuntWeek ? (latestHuntWeek.summary.min_required || 56) : 56;
          const pts = latestHuntPlayer.pts_total;
          const met = latestHuntPlayer.met_minimum;
          const pct = Math.min(100, Math.round((pts / minReq) * 100));
          const pctColor = met ? 'var(--accent-green)' : pct >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';
          return `<div class="card" style="border-top:3px solid ${pctColor};">
            <div class="card-header"><h2>🎯 Latest Hunt Week (${latestHuntWeek.date})</h2></div>
            <div class="card-body" style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">
              <div style="font-size:2.5rem;">${met ? '✅' : '❌'}</div>
              <div style="flex:1;">
                <div style="font-weight:700;font-size:1.1rem;color:${pctColor};">${met ? 'GOAL MET' : 'GOAL NOT MET'}</div>
                <div style="color:var(--text-secondary);margin-top:4px;">${fmtNum(pts)} / ${minReq} pts</div>
                <div style="margin-top:8px;">
                  <div class="progress-bar" style="width:100%;max-width:280px;"><div class="progress-fill" style="width:${pct}%;background:${pctColor};"></div></div>
                  <span style="font-family:var(--font-mono);font-size:0.85rem;color:${pctColor};">${pct}%</span>
                </div>
              </div>
            </div>
          </div>`;
        })()}
      </div>` : ''}
      <div class="charts-grid">
        ${playerHunts.length > 0 ? chartCard('📈 Hunt Points Progression', 'chart-m-hunt-pts') : noDataCard('📈 Hunt Points Progression')}
        ${latestHuntPlayer ? chartCard('📦 Latest Week Monsters & Chests', 'chart-m-hunt-bar') : noDataCard('📦 Latest Week Monsters & Chests')}
      </div>
    </div>

    <!-- ALL HISTORY TAB (hidden) -->
    <div id="${tabAllId}" style="display:none;">
      <div class="charts-grid" style="margin-bottom:1.5rem;">
        ${snaps52.length >= 2 ? chartCard('🏰 Power — 52 Weeks', 'chart-m-all-might') : noDataCard('🏰 Power — 52 Weeks')}
        ${snaps52.length >= 2 ? chartCard('⚔️ Kills — 52 Weeks', 'chart-m-all-kills') : noDataCard('⚔️ Kills — 52 Weeks')}
      </div>
      <div class="charts-grid">
        ${playerHunts.length >= 2 ? chartCard('🦅 Hunt Points — 52 Weeks', 'chart-m-all-hunt-pts') : noDataCard('🦅 Hunt Points — 52 Weeks')}
        ${latestHuntPlayer ? chartCard('📦 Cumulative Monsters & Chests', 'chart-m-all-hunt-bar') : noDataCard('📦 Cumulative Monsters & Chests')}
      </div>
    </div>`;

  container.innerHTML = html;

  // Tab switching function (scoped globally so onclick can see it)
  window.switchTab = function(tab) {
    ['war', 'hunt', 'all'].forEach(t => {
      document.getElementById(`tab-${t}`).style.display = t === tab ? '' : 'none';
      document.getElementById(`btn-${t}`).classList.toggle('active', t === tab);
    });
    // Lazy mount charts when tab is first shown
    if (tab === 'war') mountWarCharts();
    else if (tab === 'hunt') mountHuntCharts();
    else if (tab === 'all') mountAllCharts();
  };

  // Mount war tab charts immediately (visible by default)
  mountWarCharts();

  function mountWarCharts() {
    if (!document.getElementById('chart-m-might-30d')) return; // already mounted or not in DOM
    if (latestWarMember) {
      const mDiff = latestWarMember.might_diff || 0;
      const kDiff = latestWarMember.kills_diff || 0;
      makeBarChart('chart-m-might-30d',
        ['Start of Month', 'End of Month'],
        [{ label: 'Power', data: [latestWarMember.might - mDiff, latestWarMember.might], backgroundColor: ['#30363d', '#58a6ff'] }]
      );
      makeBarChart('chart-m-kills-30d',
        ['Start of Month', 'End of Month'],
        [{ label: 'Kills', data: [latestWarMember.kills - kDiff, latestWarMember.kills], backgroundColor: ['#30363d', '#f0883e'] }]
      );
    }
    if (snaps52.length >= 2) {
      const dates = snaps52.map(s => s.date);
      makeLineChart('chart-m-might-52w', 'Might', dates, snaps52.map(s => s.might), '#58a6ff');
      makeLineChart('chart-m-kills-52w', 'Kills', dates, snaps52.map(s => s.kills), '#f85149');
    }
    // Remove onclick to prevent re-mount
    if (document.getElementById('chart-m-might-30d'))
      document.getElementById('chart-m-might-30d').removeAttribute('id');
  }

  let huntMounted = false;
  function mountHuntCharts() {
    if (huntMounted) return;
    huntMounted = true;
    if (playerHunts.length > 0) {
      const hdates = playerHunts.map((h, i) => i === playerHunts.length - 1 ? h.date + ' ⟳' : h.date);
      makeLineChart('chart-m-hunt-pts', 'Hunt Points', hdates, playerHunts.map(h => h.pts_total), '#3fb950');
    }
    if (latestHuntPlayer) {
      const { monsters = {}, purchases = {} } = latestHuntPlayer;
      makeBarChart('chart-m-hunt-bar',
        ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4', 'Lvl 5'],
        [
          { label: 'Monsters', data: [monsters.lvl1||0, monsters.lvl2||0, monsters.lvl3||0, monsters.lvl4||0, monsters.lvl5||0], backgroundColor: '#a371f7' },
          { label: 'Chests', data: [purchases.lvl1||0, purchases.lvl2||0, purchases.lvl3||0, purchases.lvl4||0, purchases.lvl5||0], backgroundColor: '#e3b341' }
        ]
      );
    }
  }

  let allMounted = false;
  function mountAllCharts() {
    if (allMounted) return;
    allMounted = true;
    if (snaps52.length >= 2) {
      const dates = snaps52.map(s => s.date);
      makeLineChart('chart-m-all-might', 'Might', dates, snaps52.map(s => s.might), '#58a6ff');
      makeLineChart('chart-m-all-kills', 'Kills', dates, snaps52.map(s => s.kills), '#f85149');
    }
    if (playerHunts.length >= 2) {
      const hdates = playerHunts.map((h, i) => i === playerHunts.length - 1 ? h.date + ' ⟳' : h.date);
      makeLineChart('chart-m-all-hunt-pts', 'Hunt Points', hdates, playerHunts.map(h => h.pts_total), '#3fb950');
    }
    if (latestHuntPlayer) {
      const { monsters = {}, purchases = {} } = latestHuntPlayer;
      makeBarChart('chart-m-all-hunt-bar',
        ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4', 'Lvl 5'],
        [
          { label: 'Monsters', data: [monsters.lvl1||0, monsters.lvl2||0, monsters.lvl3||0, monsters.lvl4||0, monsters.lvl5||0], backgroundColor: '#a371f7' },
          { label: 'Chests', data: [purchases.lvl1||0, purchases.lvl2||0, purchases.lvl3||0, purchases.lvl4||0, purchases.lvl5||0], backgroundColor: '#e3b341' }
        ]
      );
    }
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

async function initPlayer() {
  const container = document.getElementById('player-container');
  if (!container) return;

  const p    = new URLSearchParams(window.location.search);
  const name = p.get('id');
  const view = p.get('view') || 'all';
  const month = p.get('month') || '';
  const week  = p.get('week')  || '';

  if (!name) {
    setError(container, 'No player specified. Go back and select a player.');
    return;
  }

  setLoading(container, `Loading ${name}…`);

  try {
    const [histRes, huntsListRes, mhuntsRes, warsRes] = await Promise.allSettled([
      loadJSON('history.json'),
      loadJSON('hunts.json'),
      loadJSON('member_hunts.json'),
      loadJSON('wars.json')
    ]);

    const histData   = histRes.status   === 'fulfilled' ? histRes.value   : { members: [] };
    const huntsList  = huntsListRes.status === 'fulfilled' ? huntsListRes.value : [];
    const mhunts     = mhuntsRes.status === 'fulfilled' ? mhuntsRes.value : {};
    const wars       = warsRes.status   === 'fulfilled' ? warsRes.value   : [];

    const growth      = (histData.members || []).find(m => m.name === name);
    const playerHunts = mhunts[name] || [];

    if (view === 'war') {
      await renderWarView(container, name, month, growth);
    } else if (view === 'hunt') {
      await renderHuntView(container, name, week, huntsList);
    } else if (view === 'all') {
      await renderAllHistoryView(container, name, growth);
    } else {
      // view === 'member' — tabbed hub
      await renderMemberView(container, name, growth, wars, huntsList, playerHunts);
    }

  } catch (err) {
    setError(container, 'Could not load player data: ' + err.message);
  }
}

// ─── CSS for tab buttons (injected) ──────────────────────────────────────────

const tabStyle = document.createElement('style');
tabStyle.textContent = `
  .player-tab {
    padding: 0.55rem 1.2rem;
    border: 1.5px solid var(--border);
    background: var(--bg-card);
    color: var(--text-secondary);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }
  .player-tab:hover { border-color: var(--accent-blue); color: var(--accent-blue); }
  .player-tab.active {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
    color: #fff;
  }
  .chart-container { position: relative; height: 280px; width: 100%; }
  .profile-header { display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;background:var(--bg-card);padding:1.5rem;border-radius:12px;border:1px solid var(--border);}
  .profile-avatar { width:72px;height:72px;border-radius:50%;background:var(--accent-blue);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:700;color:#fff;flex-shrink:0;}
  .profile-info h1 { margin:0 0 4px;font-size:1.8rem;color:var(--text-primary);}
  .profile-info p { margin:0;color:var(--text-secondary);font-family:var(--font-mono);font-size:0.9rem;}
  .charts-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:1.5rem;}
  @media(max-width:500px){.charts-grid{grid-template-columns:1fr;}}
`;
document.head.appendChild(tabStyle);

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.split('/').pop() === 'player.html') initPlayer();
});
