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
  return Number(n).toLocaleString(window.i18n?.currentLang || 'en');
}

/** Format large numbers compactly for stat cards (1.23B, 456.7M, 12.3K) */
function fmtCompact(n) {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (Math.abs(num) >= 1e4) return (num / 1e3).toFixed(1) + 'K';
  return fmtNum(n);
}

/** Format a delta value (+X / -X / 0) */
function fmtDelta(n, html = true) {
  if (n === null || n === undefined || n === 0) return html ? '<span class="delta zero">0</span>' : '0';
  const cls = n > 0 ? 'pos' : 'neg';
  const sign = n > 0 ? '+' : '';
  return html ? `<span class="delta ${cls}">${sign}${fmtCompact(n)}</span>` : `${sign}${fmtCompact(n)}`;
}

/** Capitalise first letter */
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

/** Render a rank badge */
function rankBadge(rank) {
  const cleanRank = (rank || '').trim().replace(/[\r\n]+/g, '');
  let rTier = '';
  if (cleanRank.includes('5')) rTier = 'r5';
  else if (cleanRank.includes('4')) rTier = 'r4';
  else if (cleanRank.includes('3')) rTier = 'r3';
  else if (cleanRank.includes('2')) rTier = 'r2';
  else if (cleanRank.includes('1')) rTier = 'r1';
  
  const label = rTier ? rTier.toUpperCase() : (cap(cleanRank) || '—');
  const cls = rTier || 'r1';
  
  return `<span class="rank-badge rank-${cls}">${label}</span>`;
}

/** Get URL hash parameter */
function getHashParam() {
  const hash = window.location.hash.slice(1);
  return decodeURIComponent(hash);
}

/** Set loading state for a container */
function setLoading(el, msg) {
  const loadingMsg = msg || t('loading_data');
  if (el) el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>${loadingMsg}</p></div>`;
}

/** Set error state for a container */
function setError(el, msg) {
  if (el) el.innerHTML = `<div class="error-state">⚠️ ${msg}</div>`;
}

/** Set empty state for a container */
function setEmpty(el, title, msg) {
  const emptyTitle = title || t('not_found');
  const emptyMsg = msg || '';
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>${emptyTitle}</h3>
      ${emptyMsg ? `<p>${emptyMsg}</p>` : ''}
    </div>`;
}

/** Mobile menu toggle */
function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.navbar-nav');
  if (!toggle || !nav) return;
  
  // Close menu if route is called again (e.g. language change)
  nav.classList.remove('open');
  
  // Only add listener once
  if (!toggle.dataset.initialized) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
    toggle.dataset.initialized = 'true';
  }
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

  setLoading(container, t('loading_dashboard'));

  try {
    const [wars, hunts, history, weekly] = await Promise.allSettled([
      loadJSON('wars.json'),
      loadJSON('hunts.json'),
      loadJSON('history.json'),
      loadJSON('weekly.json'),
    ]);

    const warsData    = wars.status    === 'fulfilled' ? wars.value    : [];
    const huntsData   = hunts.status   === 'fulfilled' ? hunts.value   : [];
    const historyData = history.status === 'fulfilled' ? history.value : { members: [] };
    const weeklyData  = weekly.status  === 'fulfilled' ? weekly.value  : [];

    const latestWeek  = weeklyData.length ? weeklyData[weeklyData.length - 1] : null;
    const memberCount = historyData.members ? historyData.members.length : 0;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">🏰</div>
          <div class="stat-value">${fmtNum(warsData.length)}</div>
          <div class="stat-label">${t('war_reports')}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🦅</div>
          <div class="stat-value">${huntsData.length}</div>
          <div class="stat-label" data-i18n="hunt_reports">${t('hunt_reports')}</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${memberCount}</div>
          <div class="stat-label" data-i18n="tracked_members">${t('tracked_members')}</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${latestWeek ? fmtCompact(latestWeek.total_power) : '—'}</div>
          <div class="stat-label" data-i18n="guild_power">${t('guild_power')}</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon">⚔️</div>
          <div class="stat-value">${latestWeek ? fmtCompact(latestWeek.total_kills) : '—'}</div>
          <div class="stat-label" data-i18n="guild_kills">${t('guild_kills')}</div>
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

  // Hashchange handled by global router below
}

function renderWarList(container, weekly, wars) {
  // The list shows monthly reports; the chart uses weekly data.
  if (!wars || !wars.length) {
    setEmpty(container, 'No war reports yet', 'Upload a Guild List Excel file to start tracking war data.');
    return;
  }

  const sortedWars = [...wars].reverse(); // newest monthly first
  const latest = sortedWars[0];

  // Use the last weekly.json entry for headline stats (last actual GUILD_LIST report)
  const latestWeek = weekly && weekly.length ? weekly[weekly.length - 1] : null;
  const lrPower = latestWeek ? latestWeek.total_power : (latest ? latest.total_might : 0);
  const lrKills = latestWeek ? latestWeek.total_kills : (latest ? latest.total_kills : 0);
  const lrMembers = latestWeek ? latestWeek.member_count : (latest ? latest.total_members : 0);
  const lrAvg = lrMembers > 0 ? Math.floor(lrPower / lrMembers) : 0;

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
        <div class="stat-label">${t('monthly_reports')}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${lrMembers}</div>
        <div class="stat-label">${t('members_last')}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtCompact(lrPower)}</div>
        <div class="stat-label">${t('might_last')}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtCompact(lrKills)}</div>
        <div class="stat-label">${t('kills_last')}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">📊</div>
        <div class="stat-value">${fmtCompact(lrAvg)}</div>
        <div class="stat-label">${t('avg_might_last')}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>📈 ${t('yearly_history')}</h2>
      </div>
      <div class="card-body">
        <div class="chart-box" style="position:relative;height:250px;">
          <canvas id="chart-war-combined-guild"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📋 ${t('all_war_reports')}</h2>
        <span class="badge-count">${wars.length} ${wars.length !== 1 ? t('reports_suffix') : t('reports_suffix').replace(/s$/, '')}</span>
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
          <span>🏰 ${w.label}${i === 0 ? ` <span class="badge" style="font-size:0.7rem;margin-left:6px;">${t('latest')}</span>` : ''}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);">${w.snapshots_count} ${w.snapshots_count !== 1 ? t('snapshots_suffix') : t('snapshots_suffix').replace(/s$/, '')}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.5rem;font-size:0.85rem;color:var(--text-secondary);">
          <div>👥 ${t('players')}: <strong style="color:var(--text-primary);">${w.total_members}</strong></div>
          <div>⚔️ ${t('guild_kills')}: <strong style="color:var(--accent-yellow);">${fmtCompact(w.total_kills)}</strong></div>
          <div>🏰 ${t('average')} ${t('might')}: <strong style="color:var(--accent-blue);">${fmtCompact(w.avg_might)}</strong></div>
          <div>📈 ${t('kills_gained_title')}: <strong style="color:var(--accent-green);">${fmtCompact(w.total_kills_gained)}</strong></div>
        </div>
        <div style="margin-top:8px;font-size:0.8rem;color:var(--accent-blue);">${t('view_breakdown')}</div>
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
        { label: t('chart_guild_power'), data: chartPower, borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.08)', borderWidth: 2.5, tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: '#0d1117', pointBorderColor: '#58a6ff', pointBorderWidth: 2, yAxisID: 'y'  },
        { label: t('chart_total_kills'), data: chartKills, borderColor: '#f85149', backgroundColor: 'rgba(248,81,73,0.08)',  borderWidth: 2.5, tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: '#0d1117', pointBorderColor: '#f85149', pointBorderWidth: 2, yAxisID: 'y2' }
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
                const w = `${t('week_of')} ${chartLabels[i]}`;
                return rd ? `${w}  (${t('report_label')} ${rd}, ${mc} ${t('members_lower')})` : w;
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
      <a href="war.html">${t('nav_war')}</a>
      <span class="sep">›</span>
      <span class="current">${war.label}</span>
    </div>

    <div class="detail-header">
      <h2>🏰 ${war.label}</h2>
      <div class="meta-row">
        <div class="meta-item">📅 ${t('date')}: <strong>${war.month}</strong></div>
        <div class="meta-item">👥 ${t('players')}: <strong>${war.total_members}</strong></div>
        <div class="meta-item">⚔️ ${t('guild_kills')}: <strong>${fmtCompact(war.total_kills)}</strong></div>
        <div class="meta-item">🏰 ${t('average')} ${t('might')}: <strong>${fmtCompact(war.avg_might)}</strong></div>
        <div class="meta-item">📊 ${t('snapshots_suffix')}: <strong>${war.snapshots_count}</strong></div>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtCompact(war.total_might)}</div>
        <div class="stat-label">${t('guild_power_title')}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtCompact(war.total_kills)}</div>
        <div class="stat-label">${t('guild_kills_title')}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">📈</div>
        <div class="stat-value">${fmtCompact(war.total_might_gained)}</div>
        <div class="stat-label">${t('might_gained_title')}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon">🗡️</div>
        <div class="stat-value">${fmtCompact(war.total_kills_gained)}</div>
        <div class="stat-label">${t('kills_gained_title')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>👥 ${t('members_rankings')}</h2>
        <span class="badge-count">${members.length} ${t('players')}</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="war-search" placeholder="${t('search_placeholder')}" autocomplete="off">
          </div>
          <select class="select-box" id="war-sort">
            <option value="might">${t('sort_might')}</option>
            <option value="kills">${t('sort_kills')}</option>
            <option value="name">${t('sort_name')}</option>
            <option value="rank">${t('sort_rank')}</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table id="war-members-table">
            <thead>
              <tr>
                <th>#</th>
                <th>${t('table_player')}</th>
                <th class="center">${t('table_rank')}</th>
                <th class="right">${t('table_might')}</th>
                <th class="right hide-mobile">${t('table_might_gained')}</th>
                <th class="right">${t('table_kills')}</th>
                <th class="right hide-mobile">${t('table_kills_gained')}</th>
                <th class="right">${t('table_goal')}</th>
                <th class="center">${t('table_status')}</th>
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
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state" style="padding:2rem;"><p>${t('no_filter_match')}</p></div></td></tr>`;
      return;
    }
    const KILL_GOAL = 1_000_000;
    tbody.innerHTML = currentMembers.map((m, i) => {
      const gained  = Math.max(0, m.kills_diff || 0);
      const killPct = Math.min(100, Math.round((gained / KILL_GOAL) * 100));
      const pctColor = killPct >= 100 ? 'var(--accent-green)' : killPct >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)';
      const met = gained >= KILL_GOAL;
      return `
      <tr data-searchable="${(m.name || '').toLowerCase()} ${(m.rank || '').toLowerCase()}">
        <td class="mono" data-label="#" style="color:var(--text-muted);">${i + 1}</td>
        <td data-label="${t('table_player')}" style="font-weight:500;"><a href="player.html?view=war&id=${encodeURIComponent(m.name||'')}&month=${war.month}" class="member-link">${m.name || '—'}</a></td>
        <td class="center" data-label="${t('table_rank')}">${rankBadge(m.rank)}</td>
        <td class="right mono" data-label="${t('table_might')}">${fmtCompact(m.might)}</td>
        <td class="right hide-mobile" data-label="${t('table_might_gained')}">${fmtDelta(m.might_diff)}</td>
        <td class="right mono" data-label="${t('table_kills')}" style="color:var(--accent-yellow);">${fmtCompact(m.kills)}</td>
        <td class="right hide-mobile" data-label="${t('table_kills_gained')}">${fmtDelta(m.kills_diff)}</td>
        <td class="right" data-label="${t('table_goal')}">
          <span class="mono" style="font-weight:700;">${fmtCompact(gained)} <span style="font-size:0.75rem;color:var(--text-muted);">/ 1M</span></span>
          <div style="display:flex;align-items:center;gap:5px;margin-top:3px;justify-content:flex-end;">
            <div class="progress-bar" style="width:55px;">
              <div class="progress-fill" style="width:${killPct}%;background:${pctColor};"></div>
            </div>
            <span class="pct-label" style="color:${pctColor};">${killPct}%</span>
          </div>
        </td>
        <td class="center" data-label="${t('table_status')}">${met
          ? `<span class="badge-met">✅ ${t('status_met')}</span>`
          : `<span class="badge-not-met">❌ ${t('status_miss')}</span>`}
        </td>
      </tr>`;
    }).join('');
  }

  renderRows();

  // Search and Sort
  let _search = '';
  document.getElementById('war-search').addEventListener('input', e => { 
    _search = e.target.value.trim().toLowerCase(); 
    applyAll(); 
  });
  
  document.getElementById('war-sort').addEventListener('change', () => { 
    applyAll(); 
  });

  function applyAll() {
    const sKey = document.getElementById('war-sort').value;
    currentMembers = members.filter(m => !_search || (m.name || '').toLowerCase().includes(_search));
    currentMembers.sort((a, b) => {
      if (sKey === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sKey === 'rank') {
        const _r = x => { const v=(x||''); return v.includes('5')?5:v.includes('4')?4:v.includes('3')?3:v.includes('2')?2:v.includes('1')?1:0; };
        return _r(b.rank) - _r(a.rank);
      }
      return (b[sKey] || 0) - (a[sKey] || 0);
    });
    renderRows();
  }
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

  // Hashchange handled by global router below
}

function renderHuntList(container, hunts) {
  if (!hunts.length) {
    setEmpty(container, t('no_hunt_reports'), t('upload_gift_stats_help'));
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
        <div class="stat-label">${t('total_hunt_reports')}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${avgMet}%</div>
        <div class="stat-label">${t('avg_goal_met_rate')}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${sorted[0]?.summary?.total_players || '—'}</div>
        <div class="stat-label">${t('players_latest')}</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">${sorted[0]?.summary?.min_required || '—'}</div>
        <div class="stat-label">${t('min_required_pts')}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>📈 ${t('hunt_history_title')}</h2>
      </div>
      <div class="card-body">
        <div class="chart-box" style="position:relative;height:250px;">
          <canvas id="chart-hunt-pts-guild"></canvas>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div class="card-header">
        <h2>📦 ${t('hunt_box_history_title')}</h2>
      </div>
      <div class="card-body">
        <div class="chart-box" style="position:relative;height:250px;">
          <canvas id="chart-hunt-box-guild"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📋 ${t('all_hunt_reports')}</h2>
        <span class="badge-count">${hunts.length} ${hunts.length !== 1 ? t('reports_suffix') : t('reports_suffix').replace(/s$/, '')}</span>
      </div>
      <div style="padding: 10px 15px; background: rgba(88,166,255,0.05); border-bottom: 1px solid var(--border); font-size: 0.85rem; color: var(--text-secondary); display:flex; gap:8px; align-items:center;">
        <span>ℹ️</span> <span>${t('latest_report_note')}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${t('date')}</th>
              <th class="right">${t('players')}</th>
              <th class="right">${t('met_goal')}</th>
              <th class="right">${t('not_met')}</th>
              <th class="right">${t('min_required')}</th>
              <th class="center">${t('goal_rate')}</th>
              <th class="center">${t('table_action')}</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((h, i) => {
              const pct = h.summary.total_players > 0
                ? Math.round((h.summary.met_minimum / h.summary.total_players) * 100) : 0;
              const color = pct >= 80 ? 'var(--accent-green)' : pct >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)';
              return `
              <tr>
                <td class="mono" data-label="#" style="color:var(--text-muted);">${i + 1}</td>
                <td data-label="${t('date')}" style="font-weight:500;">${h.date}</td>
                <td class="right mono" data-label="${t('players')}">${h.summary.total_players}</td>
                <td class="right" data-label="${t('met_goal')}"><span class="badge-met">✅ ${h.summary.met_minimum}</span></td>
                <td class="right" data-label="${t('not_met')}"><span class="badge-not-met">❌ ${h.summary.not_met}</span></td>
                <td class="right mono" data-label="${t('min_required')}">${h.summary.min_required}</td>
                <td class="center" data-label="${t('goal_rate')}">
                  <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
                    <div class="progress-bar" style="width:80px;">
                      <div class="progress-fill" style="width:${pct}%;background:${color};"></div>
                    </div>
                    <span style="font-weight:700;color:${color};font-family:var(--font-mono);font-size:0.85rem;">${pct}%</span>
                  </div>
                </td>
                <td class="center" data-label="${t('table_action')}">
                  <a href="hunt.html#${h.id}" class="btn btn-primary action-btn">
                    ${t('view_arrow')}
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
        label: t('hunt_history_title'), data: chartTotalPts,
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
        { label: t('monsters_hunted_all'), data: chartMonsters, backgroundColor: '#a371f7', borderRadius: 4 },
        { label: t('chests_purchased_all'), data: chartChests, backgroundColor: '#e3b341', borderRadius: 4 }
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
      <a href="hunt.html">${t('nav_hunt')}</a>
      <span class="sep">›</span>
      <span class="current">${hunt.date}</span>
    </div>

    <div class="detail-header">
      <h2>🦅 ${hunt.date}</h2>

    </div>

    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${hunt.summary.total_players}</div>
        <div class="stat-label">${t('players')}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${hunt.summary.met_minimum}</div>
        <div class="stat-label">${t('met_goal_label')} (≥${minReq} pts)</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">❌</div>
        <div class="stat-value">${hunt.summary.not_met}</div>
        <div class="stat-label">${t('did_not_meet_goal')}</div>
      </div>
      <div class="stat-card ${pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red'}">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">${pct}%</div>
        <div class="stat-label">${t('goal_met_rate')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🏆 ${t('player_rankings_title')}</h2>
        <span class="badge-count">${players.length} ${t('players_suffix')}</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="hunt-search" placeholder="${t('search_player_placeholder')}" autocomplete="off">
          </div>
          <select class="select-box" id="hunt-filter">
            <option value="">${t('all_players_filter')}</option>
            <option value="met">✅ ${t('status_met')}</option>
            <option value="not_met">❌ ${t('status_miss')}</option>
          </select>
          <select class="select-box" id="hunt-sort">
            <option value="name">${t('sort_name')}</option>
            <option value="pts_total">${t('sort_total_pts')}</option>
            <option value="rank">${t('sort_rank')}</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table id="hunt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>${t('table_player')}</th>
                <th class="center">${t('table_rank')}</th>
                <th class="right">${t('total_score')}</th>
                <th class="center">${t('table_goal')}</th>
                <th class="center">${t('table_status')}</th>
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
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state" style="padding:1.5rem;"><p>${t('no_players_match')}</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = currentPlayers.map((p, i) => {
      const goalPct = minReq > 0 ? Math.min(100, Math.round((p.pts_total / minReq) * 100)) : 0;
      const pctColor = p.met_minimum ? 'var(--accent-green)' : goalPct >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';
      return `
        <tr data-searchable="${(p.name || '').toLowerCase()} ${(p.rank || '').toLowerCase()}">
          <td class="mono" data-label="#" style="color:var(--text-muted);">${i + 1}</td>
          <td data-label="${t('table_player')}" style="font-weight:500;"><a href="player.html?view=hunt&id=${encodeURIComponent(p.name||'')}&week=${encodeURIComponent(hunt.id)}" class="member-link">${p.name || '—'}</a></td>
          <td class="center" data-label="${t('table_rank')}">${rankBadge(p.rank || '')}</td>
          <td class="right mono" data-label="${t('points')}" style="font-weight:700;"><span>${fmtCompact(p.pts_total)} <span style="font-size:0.75rem;color:var(--text-muted);">/ ${fmtCompact(minReq)}</span></span></td>
          <td class="center" data-label="${t('goal_rate')}">
            <div style="display:flex;align-items:center;gap:6px;justify-content:center;min-width:100px;">
              <div class="progress-bar" style="width:55px;">
                <div class="progress-fill" style="width:${goalPct}%;background:${pctColor};"></div>
              </div>
              <span class="pct-label" style="color:${pctColor};">${goalPct}%</span>
            </div>
          </td>
          <td class="center" data-label="${t('table_status')}">
            ${p.met_minimum
              ? `<span class="badge-met">✅ ${t('status_met')}</span>`
              : `<span class="badge-not-met">❌ ${t('status_miss')}</span>`}
          </td>
        </tr>`;
    }).join('');
  }

  renderHuntRows();

  let _search = '', _filter = '', _sortKey = 'name';
  function applyHuntAll() {
    currentPlayers = players.filter(p => {
      const nameOk = !_search || (p.name || '').toLowerCase().includes(_search);
      const filterOk = !_filter || (_filter === 'met' ? p.met_minimum : !p.met_minimum);
      return nameOk && filterOk;
    });
    currentPlayers.sort((a, b) => {
      if (_sortKey === 'name') return (a.name||'').localeCompare(b.name||'');
      if (_sortKey === 'rank') {
        const _r = x => { const v=(x||''); return v.includes('5')?5:v.includes('4')?4:v.includes('3')?3:v.includes('2')?2:v.includes('1')?1:0; };
        return _r(b.rank) - _r(a.rank);
      }
      return (b[_sortKey]||0) - (a[_sortKey]||0);
    });
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

  setLoading(container, t('loading_history'));

  let data;
  try {
    data = await loadJSON('history.json');
  } catch (err) {
    setError(container, 'Could not load history.json. ' + err.message);
    return;
  }

  const members = data.members || [];
  if (!members.length) {
    setEmpty(container, t('not_found'), t('not_enough_data'));
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
        <div class="stat-label">${t('tracked_members')}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtCompact(totalMight)}</div>
        <div class="stat-label">${t('total_guild_might_label')}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtCompact(totalKills)}</div>
        <div class="stat-label">${t('total_guild_kills_label')}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${lastUpdated || '—'}</div>
        <div class="stat-label">${t('last_updated_label')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📈 ${t('member_history_overview')}</h2>
        <span class="badge-count">${members.length} ${t('players')}</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="history-search" placeholder="${t('search_member_placeholder')}" autocomplete="off">
          </div>
          <select class="select-box" id="history-sort">
            <option value="might">${t('sort_might')}</option>
            <option value="kills">${t('sort_kills')}</option>
            <option value="might_diff">${t('sort_might_diff')}</option>
            <option value="kills_diff">${t('sort_kills_diff')}</option>
            <option value="name">${t('sort_name')}</option>
          </select>
          <select class="select-box" id="history-rank-filter">
            <option value="">${t('all_ranks')}</option>
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
                <th>${t('player')}</th>
                <th class="center">${t('rank_label')}</th>
                <th class="right">${t('current_might')}</th>
                <th class="right">${t('might_gained_label')}</th>
                <th class="right">${t('current_kills')}</th>
                <th class="right">${t('kills_gained_label')}</th>
                <th class="right">${t('snapshots_label')}</th>
                <th class="center">${t('detail_label')}</th>
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
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state" style="padding:1.5rem;"><p>${t('no_members_match')}</p></div></td></tr>`;
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
          <td class="mono" data-label="#" style="color:var(--text-muted);">${i + 1}</td>
          <td data-label="${t('table_player')}" style="font-weight:500;"><a href="player.html?view=all&id=${encodeURIComponent(m.name||'')}" class="member-link">${m.name || '—'}</a></td>
          <td class="center" data-label="${t('table_rank')}">${rankBadge(lastRank)}</td>
          <td class="right mono" data-label="${t('table_might')}">${fmtCompact(might)}</td>
          <td class="right hide-mobile" data-label="${t('table_might_gained')}">${fmtDelta(might_diff)}</td>
          <td class="right mono" data-label="${t('table_kills')}" style="color:var(--accent-yellow);">${fmtCompact(kills)}</td>
          <td class="right hide-mobile" data-label="${t('table_kills_gained')}">${fmtDelta(kills_diff)}</td>
          <td class="right mono" data-label="${t('snapshots_label')}">${snaps.length}</td>
          <td class="center" data-label="${t('table_action')}">
            <a href="player.html?view=all&id=${encodeURIComponent(m.name||'')}" class="btn btn-primary action-btn">${t('view_arrow')}</a>
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
      <a href="history.html">📈 ${t('member_history_overview')}</a>
      <span class="sep">›</span>
      <span class="current">${member.name}</span>
    </div>

    <div class="detail-header">
      <h2>📈 ${member.name}</h2>
      <div class="meta-row">
        <div class="meta-item">📅 ${t('first_seen_label')}: <strong>${member.first_seen || '—'}</strong></div>
        <div class="meta-item">🔄 ${t('last_seen_label')}: <strong>${member.last_seen || '—'}</strong></div>
        <div class="meta-item">📊 ${t('snapshots_label')}: <strong>${snaps.length}</strong></div>
        ${member.name_history && member.name_history.length ? `<div class="meta-item">📝 ${t('name_changes_label')}: <strong>${member.name_history.length}</strong></div>` : ''}
      </div>
    </div>

    ${last ? `
    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${fmtCompact(last.might)}</div>
        <div class="stat-label">${t('current_might')}</div>
        <div class="stat-delta ${last.might_diff > 0 ? 'positive' : last.might_diff < 0 ? 'negative' : 'neutral'}">
          ${fmtDelta(last.might_diff, false)} ${t('this_period_label')}
        </div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${fmtCompact(last.kills)}</div>
        <div class="stat-label">${t('current_kills')}</div>
        <div class="stat-delta ${last.kills_diff > 0 ? 'positive' : last.kills_diff < 0 ? 'negative' : 'neutral'}">
          ${fmtDelta(last.kills_diff, false)} ${t('this_period_label')}
        </div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon">🎖️</div>
        <div class="stat-value">${(last.rank || '—').toUpperCase()}</div>
        <div class="stat-label">${t('current_rank_label')}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${last.date || '—'}</div>
        <div class="stat-label">${t('latest_snapshot_label')}</div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header">
        <h2>📊 ${t('snapshot_history_label')}</h2>
        <span class="badge-count">${snaps.length} ${t('snapshots_label')}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${t('date')}</th>
              <th>${t('file_label')}</th>
              <th class="center">${t('rank_label')}</th>
              <th class="right">${t('might')}</th>
              <th class="right">${t('might_gained_label')}</th>
              <th class="right">${t('kills')}</th>
              <th class="right">${t('kills_gained_label')}</th>
            </tr>
          </thead>
          <tbody>
            ${[...snaps].reverse().map((s, i) => `
              <tr>
                <td class="mono" data-label="#" style="color:var(--text-muted);">${i + 1}</td>
                <td data-label="${t('date')}" style="font-weight:500;">${s.date || '—'}</td>
                <td class="mono" data-label="${t('file_label')}" style="font-size:0.78rem;color:var(--text-muted);">${(s.filename || '').replace(/\.[^/.]+$/, '')}</td>
                <td class="center" data-label="${t('rank_label')}">${rankBadge(s.rank)}</td>
                <td class="right mono" data-label="${t('might')}">${fmtCompact(s.might)}</td>
                <td class="right" data-label="${t('might_gained_label')}">${fmtDelta(s.might_diff)}</td>
                <td class="right mono" data-label="${t('kills')}" style="color:var(--accent-yellow);">${fmtCompact(s.kills)}</td>
                <td class="right" data-label="${t('kills_gained_label')}">${fmtDelta(s.kills_diff)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${member.name_history && member.name_history.length ? `
    <div class="card">
      <div class="card-header"><h2>📝 ${t('name_history_title')}</h2></div>
      <div class="card-body">
        ${member.name_history.map(n => `<div style="padding:4px 0;font-family:var(--font-mono);font-size:0.88rem;color:var(--text-secondary);">${n}</div>`).join('')}
      </div>
    </div>` : ''}`;
}

// ══════════════════════════════════════════════════════════
//  ROUTER — detect current page and init
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  ROUTER — detect current page and init
// ══════════════════════════════════════════════════════════

function route() {
  initMobileMenu();
  setActiveNav();

  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'index.html' || page === '') initIndex();
  else if (page === 'war.html')              initWar();
  else if (page === 'hunt.html')             initHunt();
  else if (page === 'history.html')          initHistory();
  else if (page === 'members.html')          initMembers();
  
  window.scrollTo(0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  // Wait for i18n to be ready before first render
  const checkI18n = setInterval(() => {
    if (window.i18n && Object.keys(window.i18n.data).length > 0) {
      clearInterval(checkI18n);
      route();
    }
  }, 50);

  // Re-render when language changes
  window.addEventListener('languageChanged', () => route());
  // Handle back/forward and anchor navigation
  window.addEventListener('hashchange', () => route());
});

// ══════════════════════════════════════════════════════════
//  CHECK MEMBER PAGE  (members.html)
// ══════════════════════════════════════════════════════════
async function initMembers() {
  const container = document.getElementById('members-container');
  if (!container) return;

  setLoading(container, t('loading_members'));

  let data;
  try {
    data = await loadJSON('members.json');
  } catch (err) {
    setError(container, t('error_loading') + ': ' + err.message);
    return;
  }

  if (!data.length) {
    setEmpty(container, t('no_members_match'), t('no_tracker_data')); // Use generic no data msg if file empty
    return;
  }

  container.classList.add('members-container');
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>👥 ${t('active_members')}</h2>
        <span class="badge-count">${data.length} ${t('players')}</span>
      </div>
      <div class="card-body" style="padding:0.5rem;">
        <div class="toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="members-search" placeholder="${t('search_members_placeholder')}" autocomplete="off">
          </div>
          <select class="select-box" id="members-sort">
            <option value="kills">${t('sort_kills')}</option>
            <option value="might">${t('sort_might')}</option>
            <option value="name">${t('sort_name')}</option>
            <option value="rank">${t('sort_rank')}</option>
          </select>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>${t('player')}</th>
                <th class="center">${t('rank_label')}</th>
                <th class="center">${t('telegram')}</th>
                <th class="right">${t('might')}</th>
                <th class="right">${t('kills')}</th>
                <th class="center">${t('table_action')}</th>
              </tr>
            </thead>
            <tbody id="members-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>`;

  const tbody = document.getElementById('members-tbody');
  let currentMembers = [...data];

  function _tgBadge(tg) {
    if (!tg) return '<span style="color:var(--text-muted);font-size:0.9rem;">—</span>';
    return `<span class="tg-badge">💬 ${tg}</span>`;
  }

  function renderRows() {
    if (!currentMembers.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:1.5rem;"><p>${t('no_members_match')}</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = currentMembers.map((m, i) => `
      <tr data-searchable="${(m.name || '').toLowerCase()} ${(m.rank || '').toLowerCase()} ${(m.telegram || '').toLowerCase()}">
        <td class="mono" data-label="#" style="color:var(--text-muted);">${i + 1}</td>
        <td class="card-main" data-label="${t('table_player')}"><strong>${m.name || '—'}</strong></td>
        <td class="center" data-label="${t('rank_label')}">${rankBadge(m.rank)}</td>
        <td class="center td-telegram" data-label="${t('telegram')}">${_tgBadge(m.telegram)}</td>
        <td class="right mono" data-label="${t('might')}">${fmtCompact(m.might)}</td>
        <td class="right mono" data-label="${t('kills')}" style="color:var(--accent-yellow);">${fmtCompact(m.kills)}</td>
        <td class="center" data-label="${t('table_action')}">
          <a href="player.html?view=member&id=${encodeURIComponent(m.name||'')}" class="btn btn-primary action-btn">${t('view_profile')}</a>
        </td>
      </tr>`).join('');
  }

  renderRows();

  let _search = '', _sortKey = 'kills';
  function applyFilters() {
    function _r(x) {
      if (!x) return 0;
      if (x.includes('5')) return 5;
      if (x.includes('4')) return 4;
      if (x.includes('3')) return 3;
      if (x.includes('2')) return 2;
      if (x.includes('1')) return 1;
      return 0;
    }
    currentMembers = data.filter(m => !_search || (m.name || '').toLowerCase().includes(_search));
    currentMembers.sort((a, b) => {
      if (_sortKey === 'name') return (a.name||'').localeCompare(b.name||'');
      if (_sortKey === 'rank') {
        const ra = _r(a.rank), rb = _r(b.rank);
        if (ra !== rb) return rb - ra;
        return (b.might||0) - (a.might||0);
      }
      return (b[_sortKey]||0) - (a[_sortKey]||0);
    });
    renderRows();
  }

  document.getElementById('members-search').addEventListener('input', e => { _search = e.target.value.trim().toLowerCase(); applyFilters(); });
  document.getElementById('members-sort').addEventListener('change', e => { _sortKey = e.target.value; applyFilters(); });
}
