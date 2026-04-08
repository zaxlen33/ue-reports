/**
 * UE Guild Dashboard — app.js
 * Handles dynamic data loading for all pages.
 * Data is always fetched from ./data/*.json using the Fetch API.
 * Individual views are driven by the URL hash (e.g., war.html#2026-03).
 */

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════

const DATA_BASE = './data/';

/**
 * Fetch a JSON file relative to the page root.
 * Always uses relative paths so it works on GitHub Pages.
 */
async function loadJSON(filename) {
  const url = DATA_BASE + filename + '?v=' + Date.now(); // cache-bust
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    throw new Error(`Failed to load ${filename}: ${err.message}`);
  }
}

/** Format a large number with commas */
function fmtNum(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

/** Format a delta value (+X / -X / 0) */
function fmtDelta(n, html = true) {
  if (n === null || n === undefined || n === 0) return html ? '<span class="delta zero">0</span>' : '0';
  const cls = n > 0 ? 'pos' : 'neg';
  const sign = n > 0 ? '+' : '';
  return html ? `<span class="delta ${cls}">${sign}${fmtNum(n)}</span>` : `${sign}${fmtNum(n)}`;
}

/** Capitalise first letter */
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/** Render a rank badge */
function rankBadge(rank) {
  const r = (rank || '').toLowerCase().replace(/\s+/g, '');
  const labels = { r5: 'R5', r4: 'R4', r3: 'R3', r2: 'R2', r1: 'R1' };
  const label = labels[r] || cap(rank) || '—';
  return `<span class="rank-badge rank-${r || 'r1'}">${label}</span>`;
}

/** Get URL hash parameter */
function getHashParam() {
  const hash = window.location.hash.slice(1);
  return decodeURIComponent(hash);
}

/** Set loading state for a container */
function setLoading(el, msg = 'Loading data…') {
  if (el) el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${msg}</p></div>`;
}

/** Set error state for a container */
function setError(el, msg) {
  if (el) el.innerHTML = `<div class="error-state">⚠️ ${msg}</div>`;
}

/** Set empty state for a container */
function setEmpty(el, title = 'No data yet', msg = '') {
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>${title}</h3>
      ${msg ? `<p>${msg}</p>` : ''}
    </div>`;
}

/** Mobile menu toggle */
function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.navbar-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
}

/** Filter table rows by search text */
function filterTable(inputEl, tableEl, colIndexes = null) {
  const q = inputEl.value.trim().toLowerCase();
  const rows = tableEl.querySelectorAll('tbody tr[data-searchable]');
  rows.forEach(row => {
    const text = (row.dataset.searchable || row.textContent).toLowerCase();
    row.style.display = text.includes(q) ? '' : 'none';
  });
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION ACTIVE STATE
// ══════════════════════════════════════════════════════════
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ══════════════════════════════════════════════════════════
//  INDEX PAGE  (index.html)
// ══════════════════════════════════════════════════════════
async function initIndex() {
  const container = document.getElementById('dashboard');
  if (!container) return;

  setLoading(container, 'Loading dashboard…');

  try {
    const [wars, hunts, history] = await Promise.allSettled([
      loadJSON('wars.json'),
      loadJSON('hunts.json'),
      loadJSON('history.json'),
    ]);

    const warsData   = wars.status   === 'fulfilled' ? wars.value   : [];
    const huntsData  = hunts.status  === 'fulfilled' ? hunts.value  : [];
    const historyData = history.status === 'fulfilled' ? history.value : { members: [] };

    const latestWar   = warsData.length   ? warsData[warsData.length - 1]   : null;
    const latestHunt  = huntsData.length  ? huntsData[huntsData.length - 1] : null;
    const memberCount = historyData.members ? historyData.members.length : 0;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">🏰</div>
          <div class="stat-value">${warsData.length}</div>
          <div class="stat-label">War Reports Uploaded</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🦅</div>
          <div class="stat-value">${huntsData.length}</div>
          <div class="stat-label">Hunt Reports Uploaded</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label">Tracked Members</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${latestWar ? fmtNum(latestWar.total_might) : '—'}</div>
          <div class="stat-label">Current Guild Power</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon">⚔️</div>
          <div class="stat-value">${latestWar ? fmtNum(latestWar.total_kills) : '—'}</div>
          <div class="stat-label">Current Guild Kills</div>
        </div>
      </div>`;

  } catch (err) {
    setError(container, 'Could not load dashboard data. ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════
//  WAR PAGE  (war.html)
// ══════════════════════════════════════════════════════════
async function initWar() {
  const listView   = document.getElementById('war-list-view');
  const detailView = document.getElementById('war-detail-view');
  if (!listView && !detailView) return;

  // Load both data sources:
  // - weekly.json → weekly overview list + 52-week chart
  // - wars.json   → member detail view (unchanged)
  let wars, weekly;
  try {
    [wars, weekly] = await Promise.all([
      loadJSON('wars.json'),
      loadJSON('weekly.json'),
    ]);
  } catch (err) {
    if (listView) setError(listView, 'Could not load war data. ' + err.message);
    return;
  }

  const hash = getHashParam();

  if (hash) {
    // ── Detail view ── (month hash e.g. #2026-03)
    if (listView)   listView.style.display   = 'none';
    if (detailView) detailView.style.display = '';

    const war = wars.find(w => w.month === hash);
    if (!war) {
      setError(detailView, `No data found for "${hash}". The report may not exist yet.`);
      return;
    }
    renderWarDetail(detailView, war);
  } else {
    // ── List view ──
    if (listView)   listView.style.display   = '';
    if (detailView) detailView.style.display = 'none';
    renderWarList(listView, weekly, wars);
  }

  // React to hash changes without full reload
  window.addEventListener('hashchange', () => {
    const h = getHashParam();
    if (h) {
      if (listView)   listView.style.display   = 'none';
      if (detailView) detailView.style.display = '';
      const w = wars.find(x => x.month === h);
      if (!w) { setError(detailView, `No data for "${h}".`); return; }
      renderWarDetail(detailView, w);
      window.scrollTo(0, 0);
    } else {
      if (listView)   listView.style.display   = '';
      if (detailView) detailView.style.display = 'none';
      renderWarList(listView, weekly, wars);
      window.scrollTo(0, 0);
    }
  });
}

function renderWarList(container, weekly, wars) {
  // The list shows monthly reports; the chart uses weekly data.
  if (!wars || !wars.length) {
    setEmpty(container, 'No war reports yet', 'Upload a Guild List Excel file to start tracking war data.');
    return;
  }

  const sortedWars = [...wars].reverse(); // newest monthly first
  const latest = sortedWars[0];

  // Chart data from weekly.json (weekly granularity, up to 52 weeks)
  // Each entry uses the LAST GUILD_LIST report of that week as the single source of truth.
  const chartWeeks  = weekly ? [...weekly].slice(-52) : [];
  const chartLabels = chartWeeks.map(w => w.chart_label || w.label);
  const chartPower  = chartWeeks.map(w => w.total_power);
  const chartKills  = chartWeeks.map(w => w.total_kills);
  // report_date: the exact GUILD_LIST day used for that week's totals
  const chartReportDates  = chartWeeks.map(w => w.report_date || '');
  const chartMemberCounts = chartWeeks.map(w => w.member_count || 0);

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${wars.length}</div>
        <div class="stat-label">Monthly Reports</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${latest.total_members}</div>
        <div class="stat-label">Members (Latest)</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtNum(latest.total_kills)}</div>
        <div class="stat-label">Total Kills (Latest)</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtNum(latest.avg_might)}</div>
        <div class="stat-label">Avg. Might (Latest)</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>📈 52-Week History — Guild Power &amp; Kills</h2>
      </div>
      <div class="card-body">
        <div class="chart-box" style="position:relative;height:250px;">
          <canvas id="chart-war-combined-guild"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📋 All War Reports</h2>
        <span class="badge-count">${wars.length} report${wars.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div id="war-month-list"></div>
      </div>
    </div>`;

  // Render monthly report list
  const list = document.getElementById('war-month-list');
  list.innerHTML = sortedWars.map((w, i) => `
    <a href="war.html#${w.month}" style="text-decoration:none;">
      <div class="session-card" style="border-radius:0;border-left:none;border-right:none;border-top:none;margin:0;cursor:pointer;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
        <div class="session-title">
          <span>🏰 ${w.label}${i === 0 ? ' <span class="badge" style="font-size:0.7rem;margin-left:6px;">Latest</span>' : ''}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);">${w.snapshots_count} snapshot${w.snapshots_count !== 1 ? 's' : ''}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.5rem;font-size:0.85rem;color:var(--text-secondary);">
          <div>👥 Members: <strong style="color:var(--text-primary);">${w.total_members}</strong></div>
          <div>⚔️ Total Kills: <strong style="color:var(--accent-yellow);">${fmtNum(w.total_kills)}</strong></div>
          <div>🏰 Avg. Might: <strong style="color:var(--accent-blue);">${fmtNum(w.avg_might)}</strong></div>
          <div>📈 Kills Gained: <strong style="color:var(--accent-green);">${fmtNum(w.total_kills_gained)}</strong></div>
        </div>
        <div style="margin-top:8px;font-size:0.8rem;color:var(--accent-blue);">View member breakdown →</div>
      </div>
    </a>`).join('');

  // Render the 52-week chart using weekly data
  if (chartWeeks.length >= 1 && window.Chart) {
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';

    const _tickFmt = v => v>=1e9?(v/1e9).toFixed(1)+'B':v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'k':v;

    new Chart(document.getElementById('chart-war-combined-guild'), {
      type: 'line',
      data: { labels: chartLabels, datasets: [
        { label: 'Guild Power', data: chartPower, borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.08)', borderWidth: 2.5, tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: '#0d1117', pointBorderColor: '#58a6ff', pointBorderWidth: 2, yAxisID: 'y'  },
        { label: 'Total Kills', data: chartKills, borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.08)',  borderWidth: 2.5, tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: '#0d1117', pointBorderColor: '#f85149', pointBorderWidth: 2, yAxisID: 'y2' }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 10, usePointStyle: true, color: '#8b949e', padding: 14 } },
          tooltip: {
            backgroundColor: 'rgba(13,17,23,.95)', titleColor: '#c9d1d9', bodyColor: '#c9d1d9', borderColor: '#30363d', borderWidth: 1,
            callbacks: {
              title: (items) => {
                const i = items[0]?.dataIndex ?? 0;
                const rd = chartReportDates[i];
                const mc = chartMemberCounts[i];
                return rd ? `Week of ${chartLabels[i]}  (Report: ${rd}, ${mc} members)` : `Week of ${chartLabels[i]}`;
              },
              label: (item) => {
                const val = item.raw;
                return ` ${item.dataset.label}: ${_tickFmt(val)}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y:  { beginAtZero: false, ticks: { callback: _tickFmt }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y2: { position: 'right', beginAtZero: false, ticks: { callback: _tickFmt }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }
}

function renderWarDetail(container, war) {
  // Sort members: by kills desc
  const members = [...(war.members || [])].sort((a, b) => (b.kills || 0) - (a.kills || 0));

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="war.html">🏰 War Reports</a>
      <span class="sep">›</span>
      <span class="current">${war.label}</span>
    </div>

    <div class="detail-header">
      <h2>🏰 ${war.label}</h2>
      <div class="meta-row">
        <div class="meta-item">📅 Month: <strong>${war.month}</strong></div>
        <div class="meta-item">👥 Members: <strong>${war.total_members}</strong></div>
        <div class="meta-item">⚔️ Total Kills: <strong>${fmtNum(war.total_kills)}</strong></div>
        <div class="meta-item">🏰 Avg. Might: <strong>${fmtNum(war.avg_might)}</strong></div>
        <div class="meta-item">📊 Snapshots: <strong>${war.snapshots_count}</strong></div>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtNum(war.total_might)}</div>
        <div class="stat-label">Total Guild Might</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtNum(war.total_kills)}</div>
        <div class="stat-label">Total Guild Kills</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">📈</div>
        <div class="stat-value">${fmtNum(war.total_might_gained)}</div>
        <div class="stat-label">Total Might Gained</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">🗡️</div>
        <div class="stat-value">${fmtNum(war.total_kills_gained)}</div>
        <div class="stat-label">Total Kills Gained</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>👥 Member Rankings</h2>
        <span class="badge-count">${members.length} members</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="war-search" placeholder="Search by name…" autocomplete="off">
          </div>
          <select class="select-box" id="war-sort">
            <option value="kills">Sort by Kills</option>
            <option value="kills_diff">Sort by Kills Gained</option>
            <option value="might">Sort by Might</option>
            <option value="might_diff">Sort by Might Gained</option>
            <option value="name">Sort by Name</option>
          </select>
          <select class="select-box" id="war-rank-filter">
            <option value="">All Ranks</option>
            <option value="r5">R5</option>
            <option value="r4">R4</option>
            <option value="r3">R3</option>
            <option value="r2">R2</option>
            <option value="r1">R1</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table id="war-members-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th class="center">Rank</th>
                <th class="right">Might</th>
                <th class="right">Might Gained</th>
                <th class="right">Kills</th>
                <th class="right">Kills Gained</th>
                <th class="center">1M Kill Quota</th>
              </tr>
            </thead>
            <tbody id="war-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const tbody = document.getElementById('war-tbody');
  let currentMembers = [...members];

  function renderRows() {
    if (!currentMembers.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state" style="padding:2rem;"><p>No members match the filter.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = currentMembers.map((m, i) => `
      <tr data-searchable="${(m.name || '').toLowerCase()} ${(m.rank || '').toLowerCase()}">
        <td class="mono" style="color:var(--text-muted);">${i + 1}</td>
        <td style="font-weight:500;"><a href="player.html?view=war&id=${encodeURIComponent(m.name||'')}&month=${war.month}" class="member-link">${m.name || '—'}</a></td>
        <td class="center">${rankBadge(m.rank)}</td>
        <td class="right mono">${fmtNum(m.might)}</td>
        <td class="right">${fmtDelta(m.might_diff)}</td>
        <td class="right mono" style="color:var(--accent-yellow);">${fmtNum(m.kills)}</td>
        <td class="right">${fmtDelta(m.kills_diff)}</td>
        <td class="center">${m.kills_diff >= 1000000
          ? '<span class="badge-met">✅ MET</span>'
          : `<span class="badge-not-met" title="${fmtNum(1000000 - Math.max(0,m.kills_diff))} remaining">❌ ${fmtNum(Math.max(0,m.kills_diff))}/${fmtNum(1000000)}</span>`
        }</td>
      </tr>`).join('');
  }

  renderRows();

  // Search
  document.getElementById('war-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    currentMembers = members.filter(m => (m.name || '').toLowerCase().includes(q));
    applyRankFilter();
    renderRows();
  });

  // Sort
  document.getElementById('war-sort').addEventListener('change', e => {
    sortMembers(e.target.value);
    renderRows();
  });

  // Rank filter
  document.getElementById('war-rank-filter').addEventListener('change', e => {
    applyRankFilter();
    renderRows();
  });

  let _search = '', _rank = '';
  document.getElementById('war-search').addEventListener('input', e => { _search = e.target.value.trim().toLowerCase(); applyAll(); });
  document.getElementById('war-rank-filter').addEventListener('change', e => { _rank = e.target.value.toLowerCase(); applyAll(); });
  document.getElementById('war-sort').addEventListener('change', e => { applyAll(e.target.value); });

  function applyAll(sortKey) {
    const sKey = sortKey || document.getElementById('war-sort').value;
    currentMembers = members.filter(m => {
      const nameOk = !_search || (m.name || '').toLowerCase().includes(_search);
      const rankOk = !_rank || (m.rank || '').toLowerCase().replace(/\s+/g, '') === _rank;
      return nameOk && rankOk;
    });
    currentMembers.sort((a, b) => {
      if (sKey === 'name') return (a.name || '').localeCompare(b.name || '');
      return (b[sKey] || 0) - (a[sKey] || 0);
    });
    renderRows();
  }

  function applyRankFilter() {} // handled in applyAll
  function sortMembers() {}     // handled in applyAll
}

// ══════════════════════════════════════════════════════════
//  HUNT PAGE  (hunt.html)
// ══════════════════════════════════════════════════════════
async function initHunt() {
  const listView   = document.getElementById('hunt-list-view');
  const detailView = document.getElementById('hunt-detail-view');
  if (!listView && !detailView) return;

  let hunts;
  try {
    hunts = await loadJSON('hunts.json');
  } catch (err) {
    if (listView) setError(listView, 'Could not load hunts.json. ' + err.message);
    return;
  }

  const hash = getHashParam();

  if (hash) {
    if (listView)   listView.style.display   = 'none';
    if (detailView) detailView.style.display = '';
    const hunt = hunts.find(h => h.id === hash || h.date === hash);
    if (!hunt) { setError(detailView, `No data found for "${hash}".`); return; }
    renderHuntDetail(detailView, hunt);
  } else {
    if (listView)   listView.style.display   = '';
    if (detailView) detailView.style.display = 'none';
    renderHuntList(listView, hunts);
  }

  window.addEventListener('hashchange', () => {
    const h = getHashParam();
    if (h) {
      if (listView)   listView.style.display   = 'none';
      if (detailView) detailView.style.display = '';
      const hunt = hunts.find(x => x.id === h || x.date === h);
      if (!hunt) { setError(detailView, `No data for "${h}".`); return; }
      renderHuntDetail(detailView, hunt);
      window.scrollTo(0, 0);
    } else {
      if (listView)   listView.style.display   = '';
      if (detailView) detailView.style.display = 'none';
      renderHuntList(listView, hunts);
      window.scrollTo(0, 0);
    }
  });
}

function renderHuntList(container, hunts) {
  if (!hunts.length) {
    setEmpty(container, 'No hunt reports yet', 'Upload a GIFT_STATS Excel file to start tracking hunt data.');
    return;
  }

  const sorted = [...hunts].reverse();
  const chartHunts = [...hunts].slice(-52);
  const chartLabels = chartHunts.map(h => h.chart_label || h.id || h.date);
  const chartTotalPts = [];
  const chartMonsters = [0,0,0,0,0];
  const chartChests = [0,0,0,0,0];
  
  chartHunts.forEach(h => {
    let wTot = 0;
    (h.players || []).forEach(p => {
      wTot += (p.pts_total || 0);
      for(let i=1; i<=5; i++) {
        chartMonsters[i-1] += (p.monsters?.[`lvl${i}`] || 0);
        chartChests[i-1] += (p.purchases?.[`lvl${i}`] || 0);
      }
    });
    chartTotalPts.push(wTot);
  });

  const totalPlayers = hunts.reduce((s, h) => s + (h.summary.total_players || 0), 0);
  const avgMet = hunts.length
    ? Math.round(hunts.reduce((s, h) => {
        return s + (h.summary.total_players > 0 ? (h.summary.met_minimum / h.summary.total_players) : 0);
      }, 0) / hunts.length * 100) : 0;

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${hunts.length}</div>
        <div class="stat-label">Total Hunt Reports</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${avgMet}%</div>
        <div class="stat-label">Avg. Goal Met Rate</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${sorted[0]?.summary?.total_players || '—'}</div>
        <div class="stat-label">Players (Latest)</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">${sorted[0]?.summary?.min_required || '—'}</div>
        <div class="stat-label">Min. Required Points</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>📈 52-Week History — Guild Hunt Points</h2>
      </div>
      <div class="card-body">
        <div class="chart-box" style="position:relative;height:250px;">
          <canvas id="chart-hunt-pts-guild"></canvas>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>📦 52-Week History — Guild Monsters & Chests</h2>
      </div>
      <div class="card-body">
        <div class="chart-box" style="position:relative;height:250px;">
          <canvas id="chart-hunt-box-guild"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📋 All Hunt Reports</h2>
        <span class="badge-count">${hunts.length} report${hunts.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="padding: 10px 15px; background: rgba(88,166,255,0.05); border-bottom: 1px solid var(--border); font-size: 0.85rem; color: var(--text-secondary); display:flex; gap:8px; align-items:center;">
        <span>ℹ️</span> <span><strong>Note:</strong> The most recent report may represent an ongoing week and could be incomplete.</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th class="right">Players</th>
              <th class="right">Met Goal</th>
              <th class="right">Not Met</th>
              <th class="right">Min. Required</th>
              <th class="center">Goal Rate</th>
              <th class="center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((h, i) => {
              const pct = h.summary.total_players > 0
                ? Math.round((h.summary.met_minimum / h.summary.total_players) * 100) : 0;
              const color = pct >= 80 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)';
              return `
              <tr>
                <td class="mono" style="color:var(--text-muted);">${i + 1}</td>
                <td style="font-weight:500;">${h.date}</td>
                <td class="right mono">${h.summary.total_players}</td>
                <td class="right"><span class="badge-met">✅ ${h.summary.met_minimum}</span></td>
                <td class="right"><span class="badge-not-met">❌ ${h.summary.not_met}</span></td>
                <td class="right mono">${h.summary.min_required}</td>
                <td class="center">
                  <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
                    <div class="progress-bar" style="width:80px;">
                      <div class="progress-fill" style="width:${pct}%;background:${color};"></div>
                    </div>
                    <span style="font-weight:700;color:${color};font-family:var(--font-mono);font-size:0.85rem;">${pct}%</span>
                  </div>
                </td>
                <td class="center">
                  <a href="hunt.html#${h.id}" class="btn btn-primary" style="font-size:0.78rem;padding:4px 10px;">
                    View →
                  </a>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  if (chartHunts.length >= 1 && window.Chart) {
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';
    
    new Chart(document.getElementById('chart-hunt-pts-guild'), {
      type: 'line',
      data: { labels: chartLabels, datasets: [{
        label: 'Guild Hunt Points', data: chartTotalPts,
        borderColor: '#3fb950', backgroundColor: 'rgba(63,185,80,0.1)',
        borderWidth: 2.5, tension: 0.3, fill: true,
        pointRadius: 3, pointBackgroundColor: '#0d1117', pointBorderColor: '#3fb950', pointBorderWidth: 2
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { boxWidth: 10, usePointStyle: true, color: '#8b949e', padding: 14 } },
          tooltip: { backgroundColor: 'rgba(13,17,23,.95)', titleColor: '#c9d1d9', bodyColor: '#c9d1d9', borderColor: '#30363d', borderWidth: 1 }
        },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: false, ticks: { callback: v => v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'k':v } } }
      }
    });

    const lvls = ['Lvl 1','Lvl 2','Lvl 3','Lvl 4','Lvl 5'];
    new Chart(document.getElementById('chart-hunt-box-guild'), {
      type: 'bar',
      data: { labels: lvls, datasets: [
        { label: 'Monsters Hunted (All)', data: chartMonsters, backgroundColor: '#a371f7', borderRadius: 4 },
        { label: 'Chests Purchased (All)', data: chartChests, backgroundColor: '#e3b341', borderRadius: 4 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }
      }
    });
  }
}

function renderHuntDetail(container, hunt) {
  const players = [...(hunt.players || [])].sort((a, b) => (b.pts_total || 0) - (a.pts_total || 0));
  const minReq  = hunt.summary.min_required || 0;
  const pct     = hunt.summary.total_players > 0
    ? Math.round((hunt.summary.met_minimum / hunt.summary.total_players) * 100) : 0;

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="hunt.html">🦅 Hunt Reports</a>
      <span class="sep">›</span>
      <span class="current">${hunt.date}</span>
    </div>

    <div class="detail-header">
      <h2>🦅 Hunt Report — ${hunt.date}</h2>
      <div class="meta-row">
        <div class="meta-item">📅 Date: <strong>${hunt.date}</strong></div>
        <div class="meta-item">📁 File: <strong>${hunt.filename || '—'}</strong></div>
        <div class="meta-item">🕐 Recorded: <strong>${hunt.recorded_at || '—'}</strong></div>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${hunt.summary.total_players}</div>
        <div class="stat-label">Total Players</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${hunt.summary.met_minimum}</div>
        <div class="stat-label">Met Goal (≥${minReq} pts)</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">❌</div>
        <div class="stat-value">${hunt.summary.not_met}</div>
        <div class="stat-label">Did Not Meet Goal</div>
      </div>
      <div class="stat-card ${pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'}">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">${pct}%</div>
        <div class="stat-label">Goal Met Rate</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🏆 Player Rankings</h2>
        <span class="badge-count">${players.length} players</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="hunt-search" placeholder="Search player…" autocomplete="off">
          </div>
          <select class="select-box" id="hunt-filter">
            <option value="">All Players</option>
            <option value="met">✅ Met Goal</option>
            <option value="not_met">❌ Not Met</option>
          </select>
          <select class="select-box" id="hunt-sort">
            <option value="pts_total">Sort by Total Points</option>
            <option value="pts_hunt">Sort by Hunt Points</option>
            <option value="pts_purchase">Sort by Purchase Points</option>
            <option value="total_kills">Sort by Total Kills</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table id="hunt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th class="right">Total Pts</th>
                <th class="center">Goal %</th>
                <th class="center">Status</th>
              </tr>
            </thead>
            <tbody id="hunt-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const tbody = document.getElementById('hunt-tbody');
  let currentPlayers = [...players];

  function renderHuntRows() {
    if (!currentPlayers.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:1.5rem;"><p>No players match.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = currentPlayers.map((p, i) => {
      const goalPct = minReq > 0 ? Math.min(100, Math.round((p.pts_total / minReq) * 100)) : 0;
      const pctColor = p.met_minimum ? 'var(--accent-green)' : goalPct >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';
      return `
        <tr data-searchable="${(p.name || '').toLowerCase()}">
          <td class="mono" style="color:var(--text-muted);">${i + 1}</td>
          <td style="font-weight:500;"><a href="player.html?view=hunt&id=${encodeURIComponent(p.name||'')}&week=${encodeURIComponent(hunt.id)}" class="member-link">${p.name || '—'}</a></td>
          <td class="right mono" style="font-weight:700;">${fmtNum(p.pts_total)}
            <span style="font-size:0.75rem;color:var(--text-muted);"> / ${minReq}</span></td>
          <td class="center">
            <div style="display:flex;align-items:center;gap:6px;justify-content:center;min-width:100px;">
              <div class="progress-bar" style="width:55px;">
                <div class="progress-fill" style="width:${goalPct}%;background:${pctColor};"></div>
              </div>
              <span class="pct-label" style="color:${pctColor};">${goalPct}%</span>
            </div>
          </td>
          <td class="center">
            ${p.met_minimum
              ? '<span class="badge-met">✅ MET</span>'
              : '<span class="badge-not-met">❌ MISS</span>'}
          </td>
        </tr>`;
    }).join('');
  }

  renderHuntRows();

  let _search = '', _filter = '', _sortKey = 'pts_total';
  function applyHuntAll() {
    currentPlayers = players.filter(p => {
      const nameOk = !_search || (p.name || '').toLowerCase().includes(_search);
      const filterOk = !_filter || (_filter === 'met' ? p.met_minimum : !p.met_minimum);
      return nameOk && filterOk;
    });
    currentPlayers.sort((a, b) => _sortKey === 'name' ? (a.name||'').localeCompare(b.name||'') : (b[_sortKey]||0) - (a[_sortKey]||0));
    renderHuntRows();
  }

  document.getElementById('hunt-search').addEventListener('input', e => { _search = e.target.value.trim().toLowerCase(); applyHuntAll(); });
  document.getElementById('hunt-filter').addEventListener('change', e => { _filter = e.target.value; applyHuntAll(); });
  document.getElementById('hunt-sort').addEventListener('change', e => { _sortKey = e.target.value; applyHuntAll(); });
}

// ══════════════════════════════════════════════════════════
//  GROWTH PAGE  (history.html)
// ══════════════════════════════════════════════════════════
async function initHistory() {
  const container = document.getElementById('history-container');
  if (!container) return;

  setLoading(container, 'Loading history data…');

  let data;
  try {
    data = await loadJSON('history.json');
  } catch (err) {
    setError(container, 'Could not load history.json. ' + err.message);
    return;
  }

  const members = data.members || [];
  if (!members.length) {
    setEmpty(container, 'No history data yet', 'History tracking starts after the second Excel upload.');
    return;
  }

  const hash = getHashParam();
  if (hash) {
    const member = members.find(m => m.name === hash);
    if (member) {
      // Redirect to player dashboard with all charts
      window.location.replace(`./player.html?view=all&id=${encodeURIComponent(member.name)}`);
      return;
    }
  }

  renderHistoryList(container, members, data.last_updated);

  window.addEventListener('hashchange', () => {
    const h = getHashParam();
    if (h) {
      const m = members.find(x => x.name === h);
      if (m) {
        window.location.replace(`./player.html?view=all&id=${encodeURIComponent(m.name)}`);
        return;
      }
    }
    renderHistoryList(container, members, data.last_updated);
  });
}

function renderHistoryList(container, members, lastUpdated) {
  // Sort by latest might desc
  const sorted = [...members].sort((a, b) => {
    const aS = a.snapshots || [];
    const bS = b.snapshots || [];
    const aM = aS.length ? aS[aS.length - 1].might || 0 : 0;
    const bM = bS.length ? bS[bS.length - 1].might || 0 : 0;
    return bM - aM;
  });

  const totalMight = sorted.reduce((s, m) => {
    const snaps = m.snapshots || [];
    return s + (snaps.length ? snaps[snaps.length - 1].might || 0 : 0);
  }, 0);

  const totalKills = sorted.reduce((s, m) => {
    const snaps = m.snapshots || [];
    return s + (snaps.length ? snaps[snaps.length - 1].kills || 0 : 0);
  }, 0);

  container.innerHTML = `
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card purple">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${members.length}</div>
        <div class="stat-label">Tracked Members</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtNum(totalMight)}</div>
        <div class="stat-label">Total Guild Might</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtNum(totalKills)}</div>
        <div class="stat-label">Total Guild Kills</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${lastUpdated || '—'}</div>
        <div class="stat-label">Last Updated</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📈 Member History Overview</h2>
        <span class="badge-count">${members.length} members</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="history-search" placeholder="Search member…" autocomplete="off">
          </div>
          <select class="select-box" id="history-sort">
            <option value="might">Sort by Might</option>
            <option value="kills">Sort by Kills</option>
            <option value="might_diff">Sort by Might Gained</option>
            <option value="kills_diff">Sort by Kills Gained</option>
            <option value="name">Sort by Name</option>
          </select>
          <select class="select-box" id="history-rank-filter">
            <option value="">All Ranks</option>
            <option value="r5">R5</option>
            <option value="r4">R4</option>
            <option value="r3">R3</option>
            <option value="r2">R2</option>
            <option value="r1">R1</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th class="center">Rank</th>
                <th class="right">Current Might</th>
                <th class="right">Might Gained</th>
                <th class="right">Current Kills</th>
                <th class="right">Kills Gained</th>
                <th class="right">Snapshots</th>
                <th class="center">Detail</th>
              </tr>
            </thead>
            <tbody id="history-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const tbody = document.getElementById('history-tbody');
  let currentMembers = [...sorted];

  function renderHistoryRows() {
    if (!currentMembers.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state" style="padding:1.5rem;"><p>No members match.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = currentMembers.map((m, i) => {
      const snaps = m.snapshots || [];
      const last  = snaps.length ? snaps[snaps.length - 1] : null;
      const might      = last ? last.might      || 0 : 0;
      const might_diff = last ? last.might_diff || 0 : 0;
      const kills      = last ? last.kills      || 0 : 0;
      const kills_diff = last ? last.kills_diff || 0 : 0;
      const lastRank   = last ? last.rank || '' : '';
      return `
        <tr data-searchable="${(m.name || '').toLowerCase()} ${lastRank.toLowerCase()}">
          <td class="mono" style="color:var(--text-muted);">${i + 1}</td>
          <td style="font-weight:500;"><a href="player.html?view=all&id=${encodeURIComponent(m.name||'')}" class="member-link">${m.name || '—'}</a></td>
          <td class="center">${rankBadge(lastRank)}</td>
          <td class="right mono">${fmtNum(might)}</td>
          <td class="right">${fmtDelta(might_diff)}</td>
          <td class="right mono" style="color:var(--accent-yellow);">${fmtNum(kills)}</td>
          <td class="right">${fmtDelta(kills_diff)}</td>
          <td class="right mono">${snaps.length}</td>
          <td class="center">
            <a href="player.html?view=all&id=${encodeURIComponent(m.name||'')}" class="btn btn-primary" style="font-size:0.78rem;padding:4px 10px;">View →</a>
          </td>
        </tr>`;
    }).join('');
  }

  renderHistoryRows();

  let _search = '', _rank = '', _sort = 'might';
  function applyHistoryAll() {
    currentMembers = sorted.filter(m => {
      const snaps = m.snapshots || [];
      const last = snaps.length ? snaps[snaps.length - 1] : {};
      const nameOk = !_search || (m.name || '').toLowerCase().includes(_search);
      const rankOk = !_rank || (last.rank || '').toLowerCase().replace(/\s+/g, '') === _rank;
      return nameOk && rankOk;
    });
    currentMembers.sort((a, b) => {
      if (_sort === 'name') return (a.name||'').localeCompare(b.name||'');
      const getVal = (x) => {
        const snaps = x.snapshots || [];
        const last = snaps.length ? snaps[snaps.length - 1] : {};
        return last[_sort] || 0;
      };
      return getVal(b) - getVal(a);
    });
    renderHistoryRows();
  }

  document.getElementById('history-search').addEventListener('input', e => { _search = e.target.value.trim().toLowerCase(); applyHistoryAll(); });
  document.getElementById('history-sort').addEventListener('change', e => { _sort = e.target.value; applyHistoryAll(); });
  document.getElementById('history-rank-filter').addEventListener('change', e => { _rank = e.target.value; applyHistoryAll(); });
}

function renderHistoryDetail(container, member, lastUpdated) {
  const snaps = [...(member.snapshots || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const last  = snaps.length ? snaps[snaps.length - 1] : null;

  container.innerHTML = `
    <div class="breadcrumb">
      <a href="history.html">📈 Member History</a>
      <span class="sep">›</span>
      <span class="current">${member.name}</span>
    </div>

    <div class="detail-header">
      <h2>📈 ${member.name}</h2>
      <div class="meta-row">

        <div class="meta-item">📅 First Seen: <strong>${member.first_seen || '—'}</strong></div>
        <div class="meta-item">🔄 Last Seen: <strong>${member.last_seen || '—'}</strong></div>
        <div class="meta-item">📊 Snapshots: <strong>${snaps.length}</strong></div>
        ${member.name_history && member.name_history.length ? `<div class="meta-item">📝 Name Changes: <strong>${member.name_history.length}</strong></div>` : ''}
      </div>
    </div>

    ${last ? `
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtNum(last.might)}</div>
        <div class="stat-label">Current Might</div>
        <div class="stat-delta ${last.might_diff > 0 ? 'positive' : last.might_diff < 0 ? 'negative' : 'neutral'}">
          ${fmtDelta(last.might_diff, false)} this period
        </div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtNum(last.kills)}</div>
        <div class="stat-label">Current Kills</div>
        <div class="stat-delta ${last.kills_diff > 0 ? 'positive' : last.kills_diff < 0 ? 'negative' : 'neutral'}">
          ${fmtDelta(last.kills_diff, false)} this period
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">🎖️</div>
        <div class="stat-value">${(last.rank || '—').toUpperCase()}</div>
        <div class="stat-label">Current Rank</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${last.date || '—'}</div>
        <div class="stat-label">Latest Snapshot</div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header">
        <h2>📊 Snapshot History</h2>
        <span class="badge-count">${snaps.length} snapshot${snaps.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>File</th>
              <th class="center">Rank</th>
              <th class="right">Might</th>
              <th class="right">Might Gained</th>
              <th class="right">Kills</th>
              <th class="right">Kills Gained</th>
            </tr>
          </thead>
          <tbody>
            ${[...snaps].reverse().map((s, i) => `
              <tr>
                <td class="mono" style="color:var(--text-muted);">${i + 1}</td>
                <td style="font-weight:500;">${s.date || '—'}</td>
                <td class="mono" style="font-size:0.78rem;color:var(--text-muted);">${(s.filename || '').replace(/\.[^/.]+$/, '')}</td>
                <td class="center">${rankBadge(s.rank)}</td>
                <td class="right mono">${fmtNum(s.might)}</td>
                <td class="right">${fmtDelta(s.might_diff)}</td>
                <td class="right mono" style="color:var(--accent-yellow);">${fmtNum(s.kills)}</td>
                <td class="right">${fmtDelta(s.kills_diff)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${member.name_history && member.name_history.length ? `
    <div class="card">
      <div class="card-header"><h2>📝 Name History</h2></div>
      <div class="card-body">
        ${member.name_history.map(n => `<div style="padding:4px 0;font-family:var(--font-mono);font-size:0.88rem;color:var(--text-secondary);">${n}</div>`).join('')}
      </div>
    </div>` : ''}`;
}

// ══════════════════════════════════════════════════════════
//  ROUTER — detect current page and init
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  setActiveNav();

  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '') initIndex();
  else if (page === 'war.html')              initWar();
  else if (page === 'hunt.html')             initHunt();
  else if (page === 'history.html')          initHistory();
  else if (page === 'members.html')          initMembers();
});

// ══════════════════════════════════════════════════════════
//  CHECK MEMBER PAGE  (members.html)
// ══════════════════════════════════════════════════════════
async function initMembers() {
  const container = document.getElementById('members-container');
  if (!container) return;

  setLoading(container, 'Loading members…');

  let data;
  try {
    data = await loadJSON('members.json');
  } catch (err) {
    setError(container, 'Could not load members.json. ' + err.message);
    return;
  }

  if (!data.length) {
    setEmpty(container, 'No members found', 'The guild directory is currently empty.');
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>👥 Active Members</h2>
        <span class="badge-count">${data.length} members</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="members-search" placeholder="Search member…" autocomplete="off">
          </div>
          <select class="select-box" id="members-sort">
            <option value="kills">Sort by Kills</option>
            <option value="might">Sort by Might</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th class="center">Rank</th>
                <th class="right">Might</th>
                <th class="right">Kills</th>
                <th class="center">Action</th>
              </tr>
            </thead>
            <tbody id="members-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const tbody = document.getElementById('members-tbody');
  let currentMembers = [...data];

  function renderRows() {
    if (!currentMembers.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="padding:1.5rem;"><p>No members match.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = currentMembers.map((m, i) => `
      <tr data-searchable="${(m.name || '').toLowerCase()} ${(m.rank || '').toLowerCase()}">
        <td class="mono" style="color:var(--text-muted);">${i + 1}</td>
        <td style="font-weight:500;">${m.name || '—'}</td>
        <td class="center">${rankBadge(m.rank)}</td>
        <td class="right mono">${fmtNum(m.might)}</td>
        <td class="right mono" style="color:var(--accent-yellow);">${fmtNum(m.kills)}</td>
        <td class="center">
          <a href="player.html?view=member&id=${encodeURIComponent(m.name||'')}" class="btn btn-primary" style="font-size:0.75rem;padding:4px 8px;">View Profile</a>
        </td>
      </tr>`).join('');
  }

  renderRows();

  let _search = '', _sortKey = 'kills';
  function applyFilters() {
    currentMembers = data.filter(m => !_search || (m.name || '').toLowerCase().includes(_search));
    currentMembers.sort((a, b) => {
      if (_sortKey === 'name') return (a.name||'').localeCompare(b.name||'');
      return (b[_sortKey]||0) - (a[_sortKey]||0);
    });
    renderRows();
  }

  document.getElementById('members-search').addEventListener('input', e => { _search = e.target.value.trim().toLowerCase(); applyFilters(); });
  document.getElementById('members-sort').addEventListener('change', e => { _sortKey = e.target.value; applyFilters(); });
}
