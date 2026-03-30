// website/js/player.js — Player Detail Dashboard
// Views driven by ?view=war|hunt|all|member&id=NAME[&month=YYYY-MM][&week=WEEK_ID]

Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#30363d';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

// ─── Injected styles ─────────────────────────────────────────────────────────
const _style = document.createElement('style');
_style.textContent = `
  .player-tab{padding:.5rem 1.1rem;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text-secondary);border-radius:8px;cursor:pointer;font-size:.88rem;font-weight:600;transition:all .2s;}
  .player-tab:hover{border-color:var(--accent-blue);color:var(--accent-blue);}
  .player-tab.active{background:var(--accent-blue);border-color:var(--accent-blue);color:#fff;}
  .chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:1.5rem;margin-bottom:1.5rem;}
  .chart-box{position:relative;height:270px;}
  .profile-header{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;background:var(--bg-card);padding:1.4rem;border-radius:12px;border:1px solid var(--border);}
  .profile-avatar{width:68px;height:68px;border-radius:50%;background:var(--accent-blue);display:flex;align-items:center;justify-content:center;font-size:1.9rem;font-weight:700;color:#fff;flex-shrink:0;}
  .profile-info h1{margin:0 0 4px;font-size:1.7rem;color:var(--text-primary);}
  .profile-info p{margin:0;color:var(--text-secondary);font-family:var(--font-mono);font-size:.88rem;}
  .section-label{color:var(--text-secondary);margin:1.5rem 0 .6rem;font-size:.8rem;text-transform:uppercase;letter-spacing:1px;font-weight:600;}
  @media(max-width:520px){.chart-grid{grid-template-columns:1fr;}}
`;
document.head.appendChild(_style);

// ─── Chart helpers ───────────────────────────────────────────────────────────

function _lineChart(id, label, labels, data, color, dashed = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const ctx = el.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, color + '50'); g.addColorStop(1, color + '00');
  new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: g,
      borderWidth: 2, fill: true, tension: 0.3,
      pointBackgroundColor: '#0d1117', pointBorderColor: color,
      pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
      ...(dashed ? { borderDash: [5,5] } : {})
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          backgroundColor: 'rgba(13,17,23,.95)',
          titleColor: '#c9d1d9', bodyColor: '#c9d1d9',
          borderColor: '#30363d', borderWidth: 1,
          callbacks: { label: c => { const v=c.raw; return ` ${label}: ${v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'k':v}`; } }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 11 } } },
        y: { beginAtZero: false, ticks: { callback: v => v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'k':v } }
      }
    }
  });
}

function _barChart(id, labels, datasets) {
  const el = document.getElementById(id);
  if (!el) return;
  new Chart(el.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: datasets.map(d => ({ ...d, borderRadius: 4 })) },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(13,17,23,.95)', titleColor: '#c9d1d9', bodyColor: '#c9d1d9', borderColor:'#30363d', borderWidth:1 }
      },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
    }
  });
}

// ─── DOM builders ────────────────────────────────────────────────────────────

function _card(title, canvasId) {
  return `<div class="card"><div class="card-header"><h2>${title}</h2></div>
    <div class="card-body"><div class="chart-box"><canvas id="${canvasId}"></canvas></div></div></div>`;
}
function _noData(title, msg='Not enough data yet.') {
  return `<div class="card"><div class="card-header"><h2>${title}</h2></div>
    <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:2rem;">${msg}</p></div></div>`;
}

function _quotaBadge(killsDiff) {
  const met = killsDiff >= 1_000_000;
  const pct = Math.min(100, Math.round(killsDiff / 10_000));
  const col = met ? 'var(--accent-green)' : pct >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  return `<div class="card" style="border-top:3px solid ${col};margin-bottom:1.5rem;">
    <div class="card-header"><h2>⚔️ Monthly Kill Quota (1,000,000)</h2></div>
    <div class="card-body" style="display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;">
      <div style="font-size:2.2rem;">${met?'✅':'❌'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:1rem;color:${col};">${met?'QUOTA MET':'QUOTA NOT MET'}</div>
        <div style="color:var(--text-secondary);margin-top:3px;">${fmtNum(killsDiff)} / 1,000,000 kills this month</div>
        <div style="margin-top:8px;">
          <div class="progress-bar" style="width:100%;max-width:280px;"><div class="progress-fill" style="width:${pct}%;background:${col};"></div></div>
          <span style="font-family:var(--font-mono);font-size:.83rem;color:${col};">${pct}%</span>
        </div>
      </div>
    </div>
  </div>`;
}

function _statCards(cards) {
  return `<div class="stats-grid" style="margin-bottom:1.5rem;">${cards.map(c=>`
    <div class="stat-card ${c.color||'blue'}">
      <div class="stat-icon">${c.icon}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
      ${c.delta!==undefined ? `<div class="stat-delta ${c.delta>0?'positive':c.delta<0?'negative':'neutral'}">${fmtDelta(c.delta,false)} ${c.deltaLabel||''}</div>` : ''}
    </div>`).join('')}</div>`;
}

function _profileHeader(name, growth, view) {
  const snaps   = growth ? (growth.snapshots||[]) : [];
  const last    = snaps.length ? snaps[snaps.length-1] : null;
  const initial = name.charAt(0).toUpperCase();
  let backLink, backText;
  if      (view==='war')    { backLink='./war.html';     backText='🏰 War Reports'; }
  else if (view==='hunt')   { backLink='./hunt.html';    backText='🦅 Hunt Reports'; }
  else if (view==='all')    { backLink='./history.html'; backText='📈 All History'; }
  else                      { backLink='./members.html'; backText='👥 Check Member'; }
  return `
    <div class="breadcrumb" style="margin-bottom:1.5rem;">
      <a href="${backLink}">${backText}</a><span class="sep">›</span><span class="current">${name}</span>
    </div>
    <div class="profile-header">
      <div class="profile-avatar">${initial}</div>
      <div class="profile-info">
        <h1>${name}</h1>
        <p>Rank: ${last?last.rank:'—'} &nbsp;|&nbsp; First seen: ${growth?growth.first_seen||'—':'—'}</p>
      </div>
    </div>`;
}

// ─── Build war section HTML + mount charts ───────────────────────────────────

function buildWarSection(name, month, warDailyData, growth) {
  // Filter daily snapshots to the selected month
  const allDays  = (warDailyData[name] || []);
  const monthDays = month
    ? allDays.filter(s => s.date.startsWith(month))
    : allDays.slice(-31); // fallback: last 31 days

  const snaps52  = growth ? (growth.snapshots || []) : [];

  // Latest values from daily data for stat cards
  const last30   = monthDays.length ? monthDays[monthDays.length - 1] : null;
  const first30  = monthDays.length ? monthDays[0] : null;
  const mightDiff = (last30 && first30) ? last30.might - first30.might : 0;
  const killsDiff = (last30 && first30) ? Math.max(0, last30.kills - first30.kills) : 0;

  let html = '';
  html += _statCards([
    { icon:'🏰', value: last30 ? fmtNum(last30.might) : '—', label:'Current Might', color:'blue', delta: mightDiff, deltaLabel:'this month' },
    { icon:'⚔️', value: last30 ? fmtNum(last30.kills) : '—', label:'Current Kills', color:'yellow', delta: killsDiff, deltaLabel:'this month' },
  ]);

  html += _quotaBadge(killsDiff);

  // 30-day per-day charts
  const monthLabel = month ? (() => { try { return new Date(month+'-02').toLocaleDateString('en',{month:'long',year:'numeric'}); } catch{ return month; } })() : 'Last 30 days';
  html += `<div class="section-label">📅 ${monthLabel} — Daily snapshots</div>`;
  html += `<div class="chart-grid">`;
  html += monthDays.length >= 2 ? _card('🏰 Power — Each Day of the Month', 'chart-war-might-30d') : _noData('🏰 Power (30 days)', 'At least 2 snapshots needed for this month.');
  html += monthDays.length >= 2 ? _card('⚔️ Kills — Each Day of the Month', 'chart-war-kills-30d') : _noData('⚔️ Kills (30 days)', 'At least 2 snapshots needed.');
  html += `</div>`;

  // 52-week charts
  html += `<div class="section-label">📊 All History — 52 Weeks</div>`;
  html += `<div class="chart-grid">`;
  html += snaps52.length >= 2 ? _card('🏰 Power — 52 Weeks', 'chart-war-might-52w') : _noData('🏰 Power — 52 Weeks');
  html += snaps52.length >= 2 ? _card('⚔️ Kills — 52 Weeks', 'chart-war-kills-52w') : _noData('⚔️ Kills — 52 Weeks');
  html += `</div>`;

  return { html, mount() {
    if (monthDays.length >= 2) {
      const dates  = monthDays.map(s => s.date.slice(5)); // MM-DD
      _lineChart('chart-war-might-30d', 'Might', dates, monthDays.map(s=>s.might), '#58a6ff');
      _lineChart('chart-war-kills-30d', 'Kills', dates, monthDays.map(s=>s.kills), '#f85149');
    }
    if (snaps52.length >= 2) {
      const dates = snaps52.map(s => s.date);
      _lineChart('chart-war-might-52w', 'Might', dates, snaps52.map(s=>s.might), '#58a6ff');
      _lineChart('chart-war-kills-52w', 'Kills', dates, snaps52.map(s=>s.kills), '#f85149');
    }
  }};
}

// ─── Build hunt section HTML + mount charts ──────────────────────────────────

function buildHuntSection(name, weekId, huntDailyData, playerHunts52) {
  // Get this player's data for the selected week (or latest week if none)
  const playerWeeks = huntDailyData[name] || {};
  let targetWeekId  = weekId;

  if (!targetWeekId || !playerWeeks[targetWeekId]) {
    // Fall back to the latest available week for this player
    const available = Object.keys(playerWeeks).sort();
    targetWeekId = available.length ? available[available.length - 1] : null;
  }

  const weekDays   = targetWeekId ? (playerWeeks[targetWeekId] || []) : [];
  const sortedDays = [...weekDays].sort((a, b) => a.date.localeCompare(b.date));

  // Build cumulative daily pts array
  let cumPts = 0;
  const cumDates = [], cumVals = [], cumMon = {}, cumPurch = {};
  for (const d of sortedDays) {
    cumPts += d.pts_total;
    cumDates.push(d.date.slice(5)); // MM-DD
    cumVals.push(cumPts);
    for (let i = 1; i <= 5; i++) {
      cumMon[`lvl${i}`]   = (cumMon[`lvl${i}`]   || 0) + (d.monsters?.[`lvl${i}`]   || 0);
      cumPurch[`lvl${i}`] = (cumPurch[`lvl${i}`] || 0) + (d.purchases?.[`lvl${i}`] || 0);
    }
  }

  const latestDay  = sortedDays.length ? sortedDays[sortedDays.length - 1] : null;
  const weekTotal  = latestDay ? cumVals[cumVals.length - 1] : 0;
  const met        = weekTotal >= 56;
  const pct        = Math.min(100, Math.round((weekTotal / 56) * 100));
  const pctColor   = met ? 'var(--accent-green)' : pct >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  // Week date label
  let weekLabel = '';
  if (targetWeekId) {
    try {
      const mon = new Date(targetWeekId + 'T00:00:00');
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
      weekLabel = `${mon.toLocaleDateString('en',{month:'short',day:'numeric'})} – ${sun.toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}`;
    } catch { weekLabel = targetWeekId; }
  }

  let html = '';

  // Goal badge
  html += `<div class="card" style="border-top:3px solid ${pctColor};margin-bottom:1.5rem;">
    <div class="card-header"><h2>🎯 Weekly Hunt Goal — ${weekLabel}</h2></div>
    <div class="card-body" style="display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;">
      <div style="font-size:2.2rem;">${met?'✅':'❌'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:1rem;color:${pctColor};">${met?'GOAL MET':'GOAL NOT MET'}</div>
        <div style="color:var(--text-secondary);margin-top:3px;">${fmtNum(weekTotal)} / 56 pts accumulated</div>
        <div style="margin-top:8px;">
          <div class="progress-bar" style="width:100%;max-width:280px;"><div class="progress-fill" style="width:${pct}%;background:${pctColor};"></div></div>
          <span style="font-family:var(--font-mono);font-size:.83rem;color:${pctColor};">${pct}%</span>
        </div>
      </div>
    </div>
  </div>`;

  // 7-day charts
  html += `<div class="section-label">🗓️ This Week — Cumulative daily progress</div>`;
  html += `<div class="chart-grid">`;
  html += sortedDays.length >= 1 ? _card('📈 Hunt Points — Cumulative by Day', 'chart-hunt-pts-7d') : _noData('📈 Hunt Points (7 days)', 'No daily hunt data for this week.');
  html += sortedDays.length >= 1 ? _card('📦 Monsters & Chests — Week Total (Accumulated)', 'chart-hunt-bar-7d') : _noData('📦 Monsters & Chests (week)');
  html += `</div>`;

  // 52-week history
  html += `<div class="section-label">📊 All History — 52 Weeks</div>`;
  html += `<div class="chart-grid">`;
  html += playerHunts52.length >= 2 ? _card('🦅 Hunt Points — 52 Weeks', 'chart-hunt-pts-52w') : _noData('🦅 Hunt Points — 52 Weeks', 'At least 2 weeks of data needed.');
  html += playerHunts52.length >= 1 ? _card('📦 Monsters & Chests — 52-Week Total', 'chart-hunt-bar-52w') : _noData('📦 Monsters & Chests (52-week)');
  html += `</div>`;

  return { html, mount() {
    if (sortedDays.length >= 1) {
      _lineChart('chart-hunt-pts-7d', 'Cumulative Points', cumDates, cumVals, '#3fb950');
      const lvls = ['Lvl 1','Lvl 2','Lvl 3','Lvl 4','Lvl 5'];
      _barChart('chart-hunt-bar-7d', lvls, [
        { label:'Monsters Hunted',  data:[cumMon.lvl1,cumMon.lvl2,cumMon.lvl3,cumMon.lvl4,cumMon.lvl5],   backgroundColor:'#a371f7' },
        { label:'Chests Purchased', data:[cumPurch.lvl1,cumPurch.lvl2,cumPurch.lvl3,cumPurch.lvl4,cumPurch.lvl5], backgroundColor:'#e3b341' }
      ]);
    }
    if (playerHunts52.length >= 2) {
      const hd = playerHunts52.map((h,i) => i===playerHunts52.length-1 ? h.date+' ⟳' : h.date);
      _lineChart('chart-hunt-pts-52w', 'Total Points', hd, playerHunts52.map(h=>h.pts_total), '#3fb950');
    }
    if (playerHunts52.length >= 1) {
      const monsters = {lvl1:0,lvl2:0,lvl3:0,lvl4:0,lvl5:0}, purchases = {lvl1:0,lvl2:0,lvl3:0,lvl4:0,lvl5:0};
      playerHunts52.forEach(h => {
        for(let i=1; i<=5; i++) {
          monsters[`lvl${i}`] += (h.monsters?.[`lvl${i}`] || 0);
          purchases[`lvl${i}`] += (h.purchases?.[`lvl${i}`] || 0);
        }
      });
      const lvls = ['Lvl 1','Lvl 2','Lvl 3','Lvl 4','Lvl 5'];
      _barChart('chart-hunt-bar-52w', lvls, [
        { label:'Monsters Hunted',  data:[monsters.lvl1||0,monsters.lvl2||0,monsters.lvl3||0,monsters.lvl4||0,monsters.lvl5||0],   backgroundColor:'#a371f7' },
        { label:'Chests Purchased', data:[purchases.lvl1||0,purchases.lvl2||0,purchases.lvl3||0,purchases.lvl4||0,purchases.lvl5||0], backgroundColor:'#e3b341' }
      ]);
    }
  }};
}

// ─── Build "All History" section (52w only) ──────────────────────────────────

function buildAllHistorySection(name, growth, playerHunts52) {
  const snaps52 = growth ? (growth.snapshots||[]) : [];
  const last52  = snaps52.length ? snaps52[snaps52.length-1] : null;
  const lastH52 = playerHunts52.length ? playerHunts52[playerHunts52.length-1] : null;

  let html = _statCards([
    { icon:'🏰', value: last52 ? fmtNum(last52.might) : '—', label:'Current Might', color:'blue' },
    { icon:'⚔️', value: last52 ? fmtNum(last52.kills) : '—', label:'Current Kills', color:'yellow' },
    { icon:'🎯', value: lastH52 ? fmtNum(lastH52.pts_total) : '—', label:'Latest Hunt Pts', color:'green' },
    { icon:'📊', value: snaps52.length, label:'Weekly Snapshots', color:'purple' },
  ]);

  html += `<div class="section-label">📊 All History — 52 Weeks</div>`;
  html += `<div class="chart-grid">`;
  html += snaps52.length >= 2 ? _card('🏰 Power — 52 Weeks', 'chart-all-might') : _noData('🏰 Power — 52 Weeks');
  html += snaps52.length >= 2 ? _card('⚔️ Kills — 52 Weeks', 'chart-all-kills') : _noData('⚔️ Kills — 52 Weeks');
  html += `</div><div class="chart-grid">`;
  html += playerHunts52.length >= 2 ? _card('🦅 Hunt Points — 52 Weeks', 'chart-all-hunt-pts') : _noData('🦅 Hunt Points — 52 Weeks');
  html += lastH52 ? _card('📦 Monsters & Chests — 52-Week Total', 'chart-all-hunt-bar') : _noData('📦 Monsters & Chests');
  html += `</div>`;

  return { html, mount() {
    if (snaps52.length >= 2) {
      const dates = snaps52.map(s=>s.date);
      _lineChart('chart-all-might', 'Might', dates, snaps52.map(s=>s.might), '#58a6ff');
      _lineChart('chart-all-kills', 'Kills', dates, snaps52.map(s=>s.kills), '#f85149');
    }
    if (playerHunts52.length >= 2) {
      const hd = playerHunts52.map((h,i)=>i===playerHunts52.length-1?h.date+' ⟳':h.date);
      _lineChart('chart-all-hunt-pts','Hunt Points',hd,playerHunts52.map(h=>h.pts_total),'#3fb950');
    }
    if (lastH52) {
      const monsters = {lvl1:0,lvl2:0,lvl3:0,lvl4:0,lvl5:0}, purchases = {lvl1:0,lvl2:0,lvl3:0,lvl4:0,lvl5:0};
      playerHunts52.forEach(h => {
        for(let i=1; i<=5; i++) {
          monsters[`lvl${i}`] += (h.monsters?.[`lvl${i}`] || 0);
          purchases[`lvl${i}`] += (h.purchases?.[`lvl${i}`] || 0);
        }
      });
      const lvls = ['Lvl 1','Lvl 2','Lvl 3','Lvl 4','Lvl 5'];
      _barChart('chart-all-hunt-bar', lvls, [
        { label:'Monsters',data:[monsters.lvl1||0,monsters.lvl2||0,monsters.lvl3||0,monsters.lvl4||0,monsters.lvl5||0],backgroundColor:'#a371f7'},
        { label:'Chests',data:[purchases.lvl1||0,purchases.lvl2||0,purchases.lvl3||0,purchases.lvl4||0,purchases.lvl5||0],backgroundColor:'#e3b341'}
      ]);
    }
  }};
}

// ─── VIEW: WAR ───────────────────────────────────────────────────────────────

async function renderWarView(container, name, month, growth, warDailyData) {
  const sec = buildWarSection(name, month, warDailyData, growth);
  container.innerHTML = _profileHeader(name, growth, 'war') + sec.html;
  sec.mount();
}

// ─── VIEW: HUNT ──────────────────────────────────────────────────────────────

async function renderHuntView(container, name, week, huntDailyData, playerHunts52) {
  const breadcrumb = `<div class="breadcrumb" style="margin-bottom:1.5rem;">
    <a href="./hunt.html">🦅 Hunt Reports</a><span class="sep">›</span><span class="current">${name}</span>
  </div>
  <div class="profile-header">
    <div class="profile-avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="profile-info"><h1>${name}</h1><p>Hunt Player Dashboard</p></div>
  </div>`;
  const sec = buildHuntSection(name, week, huntDailyData, playerHunts52);
  container.innerHTML = breadcrumb + sec.html;
  sec.mount();
}

// ─── VIEW: ALL HISTORY ───────────────────────────────────────────────────────

async function renderAllHistoryView(container, name, growth, playerHunts52) {
  const sec = buildAllHistorySection(name, growth, playerHunts52);
  container.innerHTML = _profileHeader(name, growth, 'all') + sec.html;
  sec.mount();
}

// ─── VIEW: MEMBER (3-tab hub) ────────────────────────────────────────────────

async function renderMemberView(container, name, growth, warDailyData, huntDailyData, playerHunts52) {
  container.innerHTML = `
    ${_profileHeader(name, growth, 'member')}
    <div style="display:flex;gap:.5rem;margin:1.2rem 0;flex-wrap:wrap;">
      <button id="btn-war"  class="player-tab active" onclick="switchMemberTab('war')">🏰 War</button>
      <button id="btn-hunt" class="player-tab" onclick="switchMemberTab('hunt')">🦅 Hunt</button>
      <button id="btn-all"  class="player-tab" onclick="switchMemberTab('all')">📊 All History</button>
    </div>
    <div id="tab-war"></div>
    <div id="tab-hunt" style="display:none;"></div>
    <div id="tab-all"  style="display:none;"></div>`;

  const mounted = { war: false, hunt: false, all: false };

  function mountTab(tab) {
    if (mounted[tab]) return;
    mounted[tab] = true;
    const el  = document.getElementById(`tab-${tab}`);
    const urlMonth = new URLSearchParams(window.location.search).get('month') || '';
    const urlWeek  = new URLSearchParams(window.location.search).get('week')  || '';
    let   sec;
    if      (tab === 'war')  sec = buildWarSection(name, urlMonth, warDailyData, growth);
    else if (tab === 'hunt') sec = buildHuntSection(name, urlWeek, huntDailyData, playerHunts52);
    else                     sec = buildAllHistorySection(name, growth, playerHunts52);
    el.innerHTML = sec.html;
    sec.mount();
  }

  // Mount War immediately (default tab)
  mountTab('war');

  window.switchMemberTab = function(tab) {
    ['war','hunt','all'].forEach(t => {
      document.getElementById(`tab-${t}`).style.display  = t === tab ? '' : 'none';
      document.getElementById(`btn-${t}`).classList.toggle('active', t === tab);
    });
    mountTab(tab);
  };
}

// ─── Main entry ──────────────────────────────────────────────────────────────

async function initPlayer() {
  const container = document.getElementById('player-container');
  if (!container) return;

  const p     = new URLSearchParams(window.location.search);
  const name  = p.get('id');
  const view  = p.get('view') || 'all';
  const month = p.get('month') || '';
  const week  = p.get('week')  || '';

  if (!name) { setError(container, 'No player specified.'); return; }
  setLoading(container, `Loading ${name}…`);

  try {
    const [histRes, mhuntsRes, warDailyRes, huntDailyRes] = await Promise.allSettled([
      loadJSON('history.json'),
      loadJSON('member_hunts.json'),
      loadJSON('member_war_daily.json'),
      loadJSON('member_hunt_daily.json'),
    ]);

    const histData      = histRes.status      === 'fulfilled' ? histRes.value      : { members: [] };
    const mhunts        = mhuntsRes.status    === 'fulfilled' ? mhuntsRes.value    : {};
    const warDailyData  = warDailyRes.status  === 'fulfilled' ? warDailyRes.value  : {};
    const huntDailyData = huntDailyRes.status === 'fulfilled' ? huntDailyRes.value : {};

    const growth       = (histData.members || []).find(m => m.name === name) || null;
    const playerHunts52 = mhunts[name] || [];

    if      (view === 'war')    await renderWarView(container, name, month, growth, warDailyData);
    else if (view === 'hunt')   await renderHuntView(container, name, week, huntDailyData, playerHunts52);
    else if (view === 'all')    await renderAllHistoryView(container, name, growth, playerHunts52);
    else /* member */           await renderMemberView(container, name, growth, warDailyData, huntDailyData, playerHunts52);

  } catch(err) {
    setError(container, 'Could not load player data: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.split('/').pop() === 'player.html') initPlayer();
});
