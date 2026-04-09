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
  .chart-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;margin-bottom:1.5rem;}
  .chart-box{position:relative;height:270px;}
  .profile-header{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;background:var(--bg-card);padding:1.4rem;border-radius:12px;border:1px solid var(--border);}
  .profile-avatar{width:68px;height:68px;border-radius:50%;background:var(--accent-blue);display:flex;align-items:center;justify-content:center;font-size:1.9rem;font-weight:700;color:#fff;flex-shrink:0;}
  .profile-info h1{margin:0 0 4px;font-size:1.7rem;color:var(--text-primary); display:flex; align-items:center;}
  .profile-info p{margin:0;color:var(--text-secondary);font-family:var(--font-mono);font-size:.88rem;}
  .section-label{color:var(--text-secondary);margin:1.5rem 0 .6rem;font-size:.8rem;text-transform:uppercase;letter-spacing:1px;font-weight:600;}
  @media(max-width:520px){ 
    .chart-grid{grid-template-columns:1fr;} 
    .ph-top, .ph-bottom { justify-content:center !important; } 
    .profile-info { text-align:center; }
  }
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
function _noData(title, msg) {
  const message = msg || t('not_enough_data');
  return `<div class="card"><div class="card-header"><h2>${title}</h2></div>
    <div class="card-body"><p style="color:var(--text-muted);text-align:center;padding:2rem;">${message}</p></div></div>`;
}

function _quotaBadge(killsDiff) {
  const met = killsDiff >= 1_000_000;
  const pct = Math.min(100, Math.round(killsDiff / 10_000));
  const col = met ? 'var(--accent-green)' : pct >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  return `<div class="card" style="border-top:3px solid ${col};margin-bottom:1.5rem;">
    <div class="card-header"><h2>⚔️ ${t('quota_title')}</h2></div>
    <div class="card-body" style="display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;">
      <div style="font-size:2.2rem;">${met?'✅':'❌'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:1rem;color:${col};">${met ? t('quota_met') : t('quota_not_met')}</div>
        <div style="color:var(--text-secondary);margin-top:3px;">${fmtCompact(killsDiff)} / 1M ${t('kills_this_month')}</div>
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
      ${c.delta!==undefined ? `<div class="stat-delta ${c.delta>0?'positive':c.delta<0?'negative':'neutral'}">${fmtDelta(c.delta,false)}${c.deltaLabel ? `<span style="opacity:0.5; margin-left:6px; font-weight:500;">• ${c.deltaLabel}</span>` : ''}</div>` : ''}
    </div>`).join('')}</div>`;
}

function _profileHeader(name, growth, view, telegram) {
  const snaps   = growth ? (growth.snapshots||[]) : [];
  const last    = snaps.length ? snaps[snaps.length-1] : null;
  const initial = name.charAt(0).toUpperCase();
  const uid     = growth && growth.uid ? growth.uid : 'N/A';

  let backLink, backText;
  if      (view==='war')    { backLink='./war.html';     backText=t('nav_war'); }
  else if (view==='hunt')   { backLink='./hunt.html';    backText=t('nav_hunt'); }
  else if (view==='all')    { backLink='./history.html'; backText=t('nav_history') || '📈 History'; }
  else                      { backLink='./members.html'; backText=t('nav_members'); }

  const badgeStyle = 'font-size:0.8rem;padding:4px 8px;display:inline-flex;align-items:center;line-height:1;margin:0;';
  const tgBadge   = telegram ? `<span class="tg-badge" style="${badgeStyle}">💬 ${telegram}</span>` : '';
  const uidBadge  = `<span class="uid-badge" style="${badgeStyle}">🔐 ${uid}</span>`;
  let rBadge = '';
  if (last && last.rank) {
    rBadge = rankBadge(last.rank).replace('class="rank-badge', `style="${badgeStyle}" class="rank-badge`);
  }

  const firstSeen = growth && growth.first_seen ? growth.first_seen : '—';
  const lastSeen  = last ? last.date : '—';

  return `
    <div class="breadcrumb" style="margin-bottom:1.5rem;">
      <a href="${backLink}">${backText}</a><span class="sep">›</span><span class="current">${name}</span>
    </div>
    <div class="profile-header">
      <div class="profile-avatar">${initial}</div>
      <div class="profile-info" style="width:100%;">
        <div class="ph-top" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
          <h1 style="margin:0;">${name}</h1>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
            ${uidBadge}
            ${rBadge}
            ${tgBadge}
          </div>
        </div>
        <div class="ph-bottom" style="margin-top:12px;display:inline-flex;align-items:center;flex-wrap:wrap;gap:12px;color:var(--text-secondary);font-size:0.85rem;background:rgba(255,255,255,0.03);padding:7px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
          <div><span style="opacity:0.6;">${t('first_seen_label') || t('first_seen') || 'First seen'}:</span> <strong style="color:var(--text-primary);letter-spacing:0.5px;">${firstSeen}</strong></div>
          <div style="width:1px;height:12px;background:rgba(255,255,255,0.1);"></div>
          <div><span style="opacity:0.6;">${t('last_seen_label') || 'Last seen'}:</span> <strong style="color:var(--text-primary);letter-spacing:0.5px;">${lastSeen}</strong></div>
        </div>
      </div>
    </div>`;
}

// ─── Build war section HTML + mount charts ───────────────────────────────────

function buildWarSection(name, month, warDailyData, growth, warsData) {
  const allDays  = (warDailyData[name] || []);
  // Chart always shows last 30 days of available daily data
  const chartDays = allDays.slice(-31);

  const last30   = chartDays.length ? chartDays[chartDays.length - 1] : null;
  const first30  = chartDays.length ? chartDays[0] : null;

  // For kills/might diff: use wars.json when a specific month is selected.
  // wars.json has the full month delta (first→last snapshot of the month) for
  // any historical month — no daily data window limitation.
  let mightDiff, killsDiff;
  if (month && warsData) {
    const warMonth  = warsData.find(w => w.month === month);
    const warMember = warMonth ? (warMonth.members || []).find(m => m.name === name) : null;
    mightDiff = warMember ? (warMember.might_diff || 0) : ((last30 && first30) ? last30.might - first30.might : 0);
    killsDiff = warMember ? (warMember.kills_diff || 0) : ((last30 && first30) ? Math.max(0, last30.kills - first30.kills) : 0);
  } else {
    // General "last 30 days" view — use daily delta
    mightDiff = (last30 && first30) ? last30.might - first30.might : 0;
    killsDiff = (last30 && first30) ? Math.max(0, last30.kills - first30.kills) : 0;
  }

  let html = '';
  html += _statCards([
    { icon:'🏰', value: last30 ? fmtCompact(last30.might) : '—', label: t('current_might'), color:'blue',   delta: mightDiff, deltaLabel: month ? t('latest') : t('last_30_days') },
    { icon:'⚔️', value: last30 ? fmtCompact(last30.kills) : '—', label: t('current_kills'), color:'yellow', delta: killsDiff, deltaLabel: month ? t('latest') : t('last_30_days') },
  ]);

  let quotaKillsDiff = killsDiff;
  if (warsData && warsData.length > 0) {
    const targetMonth = month || warsData[warsData.length - 1].month;
    const warMonth = warsData.find(w => w.month === targetMonth);
    const warMember = warMonth ? (warMonth.members || []).find(m => m.name === name) : null;
    quotaKillsDiff = warMember ? (warMember.kills_diff || 0) : 0;
  }
  html += _quotaBadge(quotaKillsDiff);

  // Chart section — always shows last 30 days of daily snapshots
  html += `<div class="section-label">📅 ${t('last_30_days')}</div>`;
  html += `<div class="chart-grid">`;
  html += chartDays.length >= 2 ? _card('🏰 ' + t('power_30d'), 'chart-war-might-30d') : _noData(t('power_30d'));
  html += chartDays.length >= 2 ? _card('⚔️ ' + t('kills_30d'), 'chart-war-kills-30d') : _noData(t('kills_30d'));
  html += `</div>`;

  html += `<div class="section-label">📊 ${t('yearly_history')}</div>`;
  const snaps52  = growth ? (growth.snapshots || []) : [];
  html += `<div class="chart-grid">`;
  html += snaps52.length >= 2 ? _card('🏰 ' + t('war_history'), 'chart-war-might-52w') : _noData(t('war_history'));
  html += snaps52.length >= 2 ? _card('⚔️ ' + t('war_history'), 'chart-war-kills-52w') : _noData(t('war_history'));
  html += `</div>`;

  return { html, mount() {
    if (chartDays.length >= 2) {
      const dates = chartDays.map(s => s.date.slice(5));
      _lineChart('chart-war-might-30d', t('might'), dates, chartDays.map(s=>s.might), '#58a6ff');
      _lineChart('chart-war-kills-30d', t('kills'), dates, chartDays.map(s=>s.kills), '#f85149');
    }
    if (snaps52.length >= 2) {
      const dates = snaps52.map(s => s.date);
      _lineChart('chart-war-might-52w', t('might'), dates, snaps52.map(s=>s.might), '#58a6ff');
      _lineChart('chart-war-kills-52w', t('kills'), dates, snaps52.map(s=>s.kills), '#f85149');
    }
  }};
}

// ─── Build hunt section HTML + mount charts ──────────────────────────────────

function buildHuntSection(name, weekId, huntDailyData, playerHunts52) {
  const playerWeeks = huntDailyData[name] || {};
  const available = Object.keys(playerWeeks).sort();
  const latestWeekId  = available.length ? available[available.length - 1] : null;
  let statWeekId = weekId;

  if (!statWeekId || !playerWeeks[statWeekId]) {
    statWeekId = latestWeekId;
  }

  // ── 1. Calculate quota/stats for the SPECIFIED week (statWeekId) ──
  const statDays = statWeekId ? (playerWeeks[statWeekId] || []) : [];
  let weekTotal = 0;
  for (const d of statDays) weekTotal += d.pts_total;
  
  const met      = weekTotal >= 56;
  const pct      = Math.min(100, Math.round((weekTotal / 56) * 100));
  const pctColor = met ? 'var(--accent-green)' : pct >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  let statWeekLabel = '';
  if (statWeekId) {
    try {
      const mon = new Date(statWeekId + 'T00:00:00');
      const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
      statWeekLabel = `${mon.toLocaleDateString(window.i18n?.currentLang || 'en',{month:'short',day:'numeric'})} – ${sun.toLocaleDateString(window.i18n?.currentLang || 'en',{month:'short',day:'numeric',year:'numeric'})}`;
    } catch { statWeekLabel = statWeekId; }
  }

  // ── 2. Calculate daily cumulative for the LATEST week (latestWeekId) ──
  const chartDays = latestWeekId ? (playerWeeks[latestWeekId] || []) : [];
  const sortedChartDays = [...chartDays].sort((a, b) => a.date.localeCompare(b.date));
  
  let cumPts = 0;
  const cumDates = [], cumVals = [], cumMon = {}, cumPurch = {};
  for (const d of sortedChartDays) {
    cumPts += d.pts_total;
    cumDates.push(d.date.slice(5));
    cumVals.push(cumPts);
    for (let i = 1; i <= 5; i++) {
      cumMon[`lvl${i}`]   = (cumMon[`lvl${i}`]   || 0) + (d.monsters?.[`lvl${i}`]   || 0);
      cumPurch[`lvl${i}`] = (cumPurch[`lvl${i}`] || 0) + (d.purchases?.[`lvl${i}`] || 0);
    }
  }

  let html = '';

  html += `<div class="card" style="border-top:3px solid ${pctColor};margin-bottom:1.5rem;">
    <div class="card-header"><h2>🎯 ${t('goal_title')} — ${statWeekLabel}</h2></div>
    <div class="card-body" style="display:flex;align-items:center;gap:1.2rem;flex-wrap:wrap;">
      <div style="font-size:2.2rem;">${met?'✅':'❌'}</div>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:1rem;color:${pctColor};">${met ? t('goal_met') : t('goal_not_met')}</div>
        <div style="color:var(--text-secondary);margin-top:3px;">${fmtNum(weekTotal)} / 56 ${t('pts_accumulated')}</div>
        <div style="margin-top:8px;">
          <div class="progress-bar" style="width:100%;max-width:280px;"><div class="progress-fill" style="width:${pct}%;background:${pctColor};"></div></div>
          <span style="font-family:var(--font-mono);font-size:.83rem;color:${pctColor};">${pct}%</span>
        </div>
      </div>
    </div>
  </div>`;

  html += `<div class="section-label">🗓️ ${t('last_30_days')}</div>`;
  html += `<div class="chart-grid">`;
  html += sortedChartDays.length >= 1 ? _card(t('hunt_history'), 'chart-hunt-pts-7d') : _noData(t('hunt_history'));
  html += sortedChartDays.length >= 1 ? _card('📦 ' + t('monsters_hunted') + ' & ' + t('chests_purchased'), 'chart-hunt-bar-7d') : _noData(t('monsters_hunted'));
  html += `</div>`;

  html += `<div class="section-label">📊 ${t('hunt_history_title') || '52-Week History — Hunt Data'}</div>`;
  html += `<div class="chart-grid">`;
  html += playerHunts52.length >= 2 ? _card(t('hunt_history'), 'chart-hunt-pts-52w') : _noData(t('hunt_history'));
  html += playerHunts52.length >= 1 ? _card('📦 ' + t('monsters_hunted') + ' & ' + t('chests_purchased'), 'chart-hunt-bar-52w') : _noData(t('chests_purchased'));
  html += `</div>`;

  return { html, mount() {
    if (sortedChartDays.length >= 1) {
      _lineChart('chart-hunt-pts-7d', t('cumulative_points'), cumDates, cumVals, '#3fb950');
      const lvls = ['Lvl 1','Lvl 2','Lvl 3','Lvl 4','Lvl 5'];
      _barChart('chart-hunt-bar-7d', lvls, [
        { label: t('monsters'),  data:[cumMon.lvl1,cumMon.lvl2,cumMon.lvl3,cumMon.lvl4,cumMon.lvl5],   backgroundColor:'#a371f7' },
        { label: t('chests'), data:[cumPurch.lvl1,cumPurch.lvl2,cumPurch.lvl3,cumPurch.lvl4,cumPurch.lvl5], backgroundColor:'#e3b341' }
      ]);
    }
    if (playerHunts52.length >= 2) {
      const hd = playerHunts52.map((h, i) => {
        let d = h.date.split(' to ')[0];
        return i === playerHunts52.length - 1 ? d + ' ⟳' : d;
      });
      _lineChart('chart-hunt-pts-52w', t('hunt_history'), hd, playerHunts52.map(h=>h.pts_total), '#3fb950');
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
        { label: t('monsters'),  data:[monsters.lvl1||0,monsters.lvl2||0,monsters.lvl3||0,monsters.lvl4||0,monsters.lvl5||0],   backgroundColor:'#a371f7' },
        { label: t('chests'), data:[purchases.lvl1||0,purchases.lvl2||0,purchases.lvl3||0,purchases.lvl4||0,purchases.lvl5||0], backgroundColor:'#e3b341' }
      ]);
    }
  }};
}

// ─── Build festival section HTML + mount charts ──────────────────────────────

function buildFestivalSection(name, growth, rawFestivalData) {
  let html = '';
  if (!rawFestivalData || !rawFestivalData.length) return { html: _noData('🎪 Festival History'), mount(){} };

  const uid = growth ? (growth.uid || 'N/A') : 'N/A';
  const festHist = [];
  rawFestivalData.forEach(fest => {
    // Find player by UID or current Name
    const p = fest.players.find(x => x.uid === uid || x.name === name);
    if (p) {
      let dateSpan = fest.date;
      try {
        const dEnd = new Date(fest.date + 'T00:00:00');
        const dStart = new Date(dEnd);
        dStart.setDate(dStart.getDate() - 7);
        dateSpan = `${dStart.toLocaleDateString(window.i18n?.currentLang || 'en-US',{month:'short',day:'numeric'})} – ${dEnd.toLocaleDateString(window.i18n?.currentLang || 'en-US',{month:'short',day:'numeric'})}`;
      } catch (e) {}
      festHist.push({
        date: fest.date,
        dateSpan,
        score: p ? p.score : 0,
        participated: !!p,
        min: fest.summary.festival_min_score || 3100
      });
    }
  });

  const last12 = festHist.slice(-12);
  
  html += `<div class="section-label">📊 ${t('festival_history')} — Last 12 Events</div>`;
  html += `<div class="chart-grid">`;
  html += last12.length > 0 ? _card('🎪 ' + t('score') + ' (Line)', 'chart-player-fest-line') : _noData('🎪 Festival Line');
  html += last12.length > 0 ? _card('🎪 ' + t('score') + ' (Bar)', 'chart-player-fest-bar') : _noData('🎪 Festival Bar');
  html += `</div>`;
  
  html += `<div class="card table-wrapper" style="margin-top:1.5rem">
    <table>
      <thead><tr><th>${t('date')}</th><th class="right">${t('score')}</th></tr></thead>
      <tbody>
        ${last12.slice().reverse().map(f => `<tr style="transition:background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''"><td class="card-main">${f.dateSpan}</td><td data-label="${t('score')}" class="right mono">${f.participated ? Number(f.score).toLocaleString() : '—'}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>`;

  return {
    html,
    mount() {
      if (last12.length > 0) {
        _barChart('chart-player-fest-bar', last12.map(f => f.dateSpan), [
          { label: t('score'), data: last12.map(f => f.score), backgroundColor: '#a371f7' }
        ]);
        _lineChart('chart-player-fest-line', t('score'), last12.map(f => f.dateSpan), last12.map(f => f.score), '#a371f7');
      }
    }
  };
}

// ─── Build "All History" section (52w only) ──────────────────────────────────

function buildAllHistorySection(name, growth, playerHunts52, rawFestivalData) {
  const snaps52 = growth ? (growth.snapshots||[]) : [];
  const last52  = snaps52.length ? snaps52[snaps52.length-1] : null;
  const lastH52 = playerHunts52.length ? playerHunts52[playerHunts52.length-1] : null;

  let html = _statCards([
    { icon:'🏰', value: last52 ? fmtCompact(last52.might) : '—', label: t('current_might'), color:'blue' },
    { icon:'⚔️', value: last52 ? fmtCompact(last52.kills) : '—', label: t('current_kills'), color:'yellow' },
    { icon:'🎯', value: lastH52 ? fmtNum(lastH52.pts_total) : '—', label: t('points'), color:'green' },
    { icon:'📊', value: snaps52.length, label: t('snapshots_label'), color:'purple' },
  ]);

  html += `<div class="section-label">📊 ${t('all_history_52w')}</div>`;
  html += `<div class="chart-grid">`;
  html += snaps52.length >= 2 ? _card('🏰 ' + t('power_52w'), 'chart-all-might') : _noData(t('power_52w'));
  html += snaps52.length >= 2 ? _card('⚔️ ' + t('kills_52w'), 'chart-all-kills') : _noData(t('kills_52w'));
  html += `</div><div class="chart-grid">`;
  html += playerHunts52.length >= 2 ? _card(t('hunt_pts_52w'), 'chart-all-hunt-pts') : _noData(t('hunt_pts_52w'));
  html += lastH52 ? _card('📦 ' + t('monsters_chests_52w'), 'chart-all-hunt-bar') : _noData(t('monsters_chests_52w'));
  html += `</div>`;
  
  const uid = growth ? (growth.uid || 'N/A') : 'N/A';
  const festHist = [];
  if (rawFestivalData) {
    rawFestivalData.forEach(fest => {
      const p = fest.players.find(x => x.uid === uid || x.name === name);
      if (p) {
        let dateSpan = fest.date;
        try {
          const dEnd = new Date(fest.date + 'T00:00:00');
          const dStart = new Date(dEnd);
          dStart.setDate(dStart.getDate() - 7);
          dateSpan = `${dStart.toLocaleDateString(window.i18n?.currentLang || 'en-US', {month:'short',day:'numeric'})} – ${dEnd.toLocaleDateString(window.i18n?.currentLang || 'en-US', {month:'short',day:'numeric'})}`;
        } catch(e) {}
        festHist.push({ dateSpan, score: p ? p.score : 0, participated: !!p });
      }
    });
  }
  const last12Fest = festHist.slice(-12);

  html += `<div class="section-label">🎪 ${t('festival_last_12')}</div>`;
  html += `<div class="chart-grid">`;
  html += last12Fest.length > 0 ? _card('🎪 ' + t('festival_scores_line'), 'chart-all-fest-line') : _noData(t('festival_scores_line'));
  html += last12Fest.length > 0 ? _card('🎪 ' + t('festival_scores_bar'), 'chart-all-fest-bar') : _noData(t('festival_scores_bar'));
  html += `</div>`;

  return { html, mount() {
    if (snaps52.length >= 2) {
      const dates = snaps52.map(s=>s.date);
      _lineChart('chart-all-might', t('might'), dates, snaps52.map(s=>s.might), '#58a6ff');
      _lineChart('chart-all-kills', t('kills'), dates, snaps52.map(s=>s.kills), '#f85149');
    }
    if (playerHunts52.length >= 2) {
      const hd = playerHunts52.map((h, i) => {
        let d = h.date.split(' to ')[0];
        return i === playerHunts52.length - 1 ? d + ' ⟳' : d;
      });
      _lineChart('chart-all-hunt-pts', t('points'), hd, playerHunts52.map(h => h.pts_total), '#3fb950');
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
        { label: t('monsters'), data:[monsters.lvl1||0,monsters.lvl2||0,monsters.lvl3||0,monsters.lvl4||0,monsters.lvl5||0],backgroundColor:'#a371f7'},
        { label: t('chests'), data:[purchases.lvl1||0,purchases.lvl2||0,purchases.lvl3||0,purchases.lvl4||0,purchases.lvl5||0],backgroundColor:'#e3b341'}
      ]);
    }
    if (last12Fest.length > 0) {
      _barChart('chart-all-fest-bar', last12Fest.map(f => f.dateSpan), [
        { label: t('score'), data: last12Fest.map(f => f.score), backgroundColor: '#a371f7' }
      ]);
      _lineChart('chart-all-fest-line', t('score'), last12Fest.map(f => f.dateSpan), last12Fest.map(f => f.score), '#a371f7');
    }
  }};
}

// ─── VIEWS ───────────────────────────────────────────────────────────────────

async function renderWarView(container, name, month, growth, warDailyData, telegram, warsData) {
  const sec = buildWarSection(name, month, warDailyData, growth, warsData);
  container.innerHTML = _profileHeader(name, growth, 'war', telegram) + sec.html;
  sec.mount();
}

async function renderHuntView(container, name, week, huntDailyData, playerHunts52, telegram, growth) {
  const initial  = name.charAt(0).toUpperCase();
  const uid      = growth && growth.uid ? growth.uid : null;
  const tgBadge  = telegram ? `<span class="tg-badge" style="margin-left:8px;vertical-align:middle;">💬 ${telegram}</span>` : '';
  const uidBadge = uid ? `<span class="uid-badge" style="margin-left:8px;vertical-align:middle;">🔐 ${uid}</span>` : '';

  const breadcrumb = `<div class="breadcrumb" style="margin-bottom:1.5rem;">
    <a href="./hunt.html">${t('nav_hunt')}</a><span class="sep">›</span><span class="current">${name}</span>
  </div>
  <div class="profile-header">
    <div class="profile-avatar">${initial}</div>
    <div class="profile-info"><h1>${name}${uidBadge}${tgBadge}</h1><p>${t('hunt_player_dashboard')}</p></div>
  </div>`;
  const sec = buildHuntSection(name, week, huntDailyData, playerHunts52);
  container.innerHTML = breadcrumb + sec.html;
  sec.mount();
}

async function renderAllHistoryView(container, name, growth, playerHunts52, festivalData, telegram) {
  const sec = buildAllHistorySection(name, growth, playerHunts52, festivalData);
  container.innerHTML = _profileHeader(name, growth, 'all', telegram) + sec.html;
  sec.mount();
}

async function renderMemberView(container, name, growth, warDailyData, huntDailyData, playerHunts52, festivalData, telegram, warsData) {
  let nameChangesHtml = '';
  if (growth && growth.name_history && growth.name_history.length > 0) {
    nameChangesHtml = `<div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header" style="cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <h2 style="font-size:1.1rem; color:var(--text-primary);"><span style="margin-right:8px;">📝</span>${t('identity_tracker')} (${growth.name_history.length} ${t('previous_names')}) <span style="font-size:0.8rem;float:right;color:var(--text-secondary);font-weight:normal;">${t('view_all')} ▾</span></h2>
      </div>
      <div class="card-body" style="display:none; padding:0; border-top:1px solid var(--border);">
        <table style="border:none;margin:0;">
          <thead><tr><th>${t('old_name_new_name')}</th><th class="right">${t('until_date')}</th></tr></thead>
          <tbody>
            ${growth.name_history.map(nh => `<tr style="transition:background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''"><td class="card-main" style="color:var(--text-secondary);text-decoration:line-through">${nh.name}</td><td class="right mono" data-label="${t('until_date')}">${nh.until}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  container.innerHTML = `
    ${_profileHeader(name, growth, 'member', telegram)}
    ${nameChangesHtml}
    <div style="display:flex;gap:.5rem;margin:1.2rem 0;flex-wrap:wrap;">
      <button id="btn-war"  class="player-tab active" onclick="switchMemberTab('war')">${t('nav_war')}</button>
      <button id="btn-hunt" class="player-tab" onclick="switchMemberTab('hunt')">${t('nav_hunt')}</button>
      <button id="btn-fest" class="player-tab" onclick="switchMemberTab('fest')">${t('nav_festival')}</button>
      <button id="btn-all"  class="player-tab" onclick="switchMemberTab('all')">${t('nav_history')}</button>
    </div>
    <div id="tab-war"></div>
    <div id="tab-hunt" style="display:none;"></div>
    <div id="tab-fest" style="display:none;"></div>
    <div id="tab-all"  style="display:none;"></div>`;

  const mounted = { war: false, hunt: false, fest: false, all: false };

  function mountTab(tab) {
    if (mounted[tab]) return;
    mounted[tab] = true;
    const el  = document.getElementById(`tab-${tab}`);
    const urlMonth = new URLSearchParams(window.location.search).get('month') || '';
    const urlWeek  = new URLSearchParams(window.location.search).get('week')  || '';
    let   sec;
    if      (tab === 'war')  sec = buildWarSection(name, urlMonth, warDailyData, growth, warsData);
    else if (tab === 'hunt') sec = buildHuntSection(name, urlWeek, huntDailyData, playerHunts52);
    else if (tab === 'fest') sec = buildFestivalSection(name, growth, festivalData);
    else                     sec = buildAllHistorySection(name, growth, playerHunts52, festivalData);
    el.innerHTML = sec.html;
    sec.mount();
  }

  mountTab('war');

  window.switchMemberTab = function(tab) {
    ['war','hunt','fest','all'].forEach(t => {
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

  if (!name) { setError(container, t('not_found')); return; }
  setLoading(container, t('loading_player_param').replace('{name}', name));

  try {
    const [histRes, mhuntsRes, warDailyRes, huntDailyRes, festRes, membersRes, warsRes] = await Promise.allSettled([
      loadJSON('history.json'),
      loadJSON('member_hunts.json'),
      loadJSON('member_war_daily.json'),
      loadJSON('member_hunt_daily.json'),
      loadJSON('festival.json'),
      loadJSON('members.json'),
      loadJSON('wars.json'),       // full monthly war data — used for accurate kills/might delta
    ]);

    const histData      = histRes.status      === 'fulfilled' ? histRes.value      : { members: [] };
    const mhunts        = mhuntsRes.status    === 'fulfilled' ? mhuntsRes.value    : {};
    const warDailyData  = warDailyRes.status  === 'fulfilled' ? warDailyRes.value  : {};
    const huntDailyData = huntDailyRes.status === 'fulfilled' ? huntDailyRes.value : {};
    const festivalData  = festRes.status      === 'fulfilled' ? festRes.value      : [];
    const membersData   = membersRes.status   === 'fulfilled' ? membersRes.value   : [];
    const warsData      = warsRes.status      === 'fulfilled' ? warsRes.value      : [];

    const growth        = (histData.members || []).find(m => m.name === name) || null;
    const playerHunts52 = mhunts[name] || [];

    // Resolve Telegram @username by matching name in the website members.json
    const memberEntry = membersData.find(m => (m.name || '').toLowerCase() === name.toLowerCase());
    const telegram    = memberEntry ? (memberEntry.telegram || '') : '';

    if      (view === 'war')    await renderWarView(container, name, month, growth, warDailyData, telegram, warsData);
    else if (view === 'hunt')   await renderHuntView(container, name, week, huntDailyData, playerHunts52, telegram, growth);
    else if (view === 'all')    await renderAllHistoryView(container, name, growth, playerHunts52, festivalData, telegram);
    else /* member */           await renderMemberView(container, name, growth, warDailyData, huntDailyData, playerHunts52, festivalData, telegram, warsData);

  } catch(err) {
    setError(container, t('error_loading') + ': ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.split('/').pop() !== 'player.html') return;
  // Wait for i18n to be ready before first render
  const checkI18n = setInterval(() => {
    if (window.i18n && Object.keys(window.i18n.data).length > 0) {
      clearInterval(checkI18n);
      initPlayer();
    }
  }, 50);
});

window.addEventListener('languageChanged', () => {
  if (window.location.pathname.split('/').pop() === 'player.html') initPlayer();
});
