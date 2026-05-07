/**
 * firstseen.js — "First Seen" module
 *
 * Reads history.json and renders all members ordered by first_seen (newest first).
 * Highlights members seen within the last 7 / 14 / 30 days as potential new joins.
 *
 * Styling: all visual styles are in styles.css under the "FIRST SEEN MODULE" section.
 * No inline styles are used in this file.
 */

/* ─── Bootstrap ─────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.includes('firstseen')) return;

  // Wait for i18n to finish loading translations
  const checkI18n = setInterval(() => {
    if (window.i18n && Object.keys(window.i18n.data).length > 0) {
      clearInterval(checkI18n);
      initFirstSeen();
    }
  }, 50);
});

// Re-render when the user switches language
window.addEventListener('languageChanged', () => {
  if (window.location.pathname.includes('firstseen')) initFirstSeen();
});

/* ─── Main initialiser ──────────────────────────────────── */

async function initFirstSeen() {
  const container = document.getElementById('firstseen-container');
  if (!container) return;

  try {
    const resp = await fetch('./data/history.json?v=' + Date.now());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Build normalised member list ──────────────────────
    const members = (data.members || []).map(m => {
      const snaps     = m.snapshots || [];
      const lastSnap  = snaps.length ? snaps[snaps.length - 1] : {};
      const firstSeen = m.first_seen || '';

      return {
        uid:         m.uid         || '—',
        name:        m.name        || '—',
        first_seen:  firstSeen,
        last_seen:   m.last_seen   || '',
        daysAgo:     firstSeen ? daysDiff(today, firstSeen) : 9999,
        might:       lastSnap.might || 0,
        kills:       lastSnap.kills || 0,
        rank:        lastSnap.rank  || '',
        nameChanges: (m.name_history || []).length,
      };
    });

    // Newest first
    members.sort((a, b) => b.first_seen.localeCompare(a.first_seen));

    // ── Retention split: active = ≤180 days, archived = >180 days ──
    const ARCHIVE_AFTER_DAYS = 180;
    const activeMembers   = members.filter(m => m.daysAgo <= ARCHIVE_AFTER_DAYS);
    const archivedMembers = members.filter(m => m.daysAgo >  ARCHIVE_AFTER_DAYS);
    // Pre-compute counts for summary cards (never change after load)
    const new7  = members.filter(m => m.daysAgo <= 7).length;
    const new14 = members.filter(m => m.daysAgo <= 14).length;
    const new30 = members.filter(m => m.daysAgo <= 30).length;

    // ── View state (synced to module-level vars for wireControls) ──
    _currentFilter = 'all';
    _currentSearch = '';

    /* ── Render ────────────────────────────────────────── */
    function render() {
      // Only filter over active records; archived are always at the bottom
      const filtered = activeMembers.filter(m => {
        const matchSearch = !_currentSearch
          || m.name.toLowerCase().includes(_currentSearch)
          || m.uid.toLowerCase().includes(_currentSearch);

        const matchFilter =
          _currentFilter === '7'  ? m.daysAgo <= 7  :
          _currentFilter === '14' ? m.daysAgo <= 14 :
          _currentFilter === '30' ? m.daysAgo <= 30 : true;

        return matchSearch && matchFilter;
      });

      // Archive section only shown when filter is 'all' and no active search
      const showArchive = _currentFilter === 'all' && !_currentSearch && archivedMembers.length > 0;

      container.innerHTML = [
        buildAlert(new7),
        buildHeroBanner(),
        buildSummary(new7, new14, new30, activeMembers.length),
        buildControls(_currentFilter, _currentSearch),
        buildResultCount(filtered.length, activeMembers.length),
        filtered.length === 0 ? buildEmpty() : buildGrid(filtered),
        showArchive ? buildArchivedSection(archivedMembers) : '',
      ].join('');

      wireControls();
    }

    // Expose render so wireControls can call it
    _rerender = render;
    render();

  } catch (err) {
    const container = document.getElementById('firstseen-container');
    if (container) {
      container.innerHTML = `<div class="error-state">⚠️ ${t('error_loading')}: ${escHtml(err.message)}</div>`;
    }
  }
}

/* ─── Component builders ────────────────────────────────── */

/**
 * Red alert bar — only shown when ≥1 member joined in the last 7 days.
 */
function buildAlert(new7) {
  if (new7 === 0) return '';
  return `
    <div class="fs-alert" role="alert">
      <span aria-hidden="true">🚨</span>
      <span>${t('fs_alert_prefix')} <strong>${new7} ${t('fs_alert_members')}</strong> ${t('fs_alert_suffix')}</span>
    </div>`;
}

/**
 * How-to-use tip banner.
 */
function buildHeroBanner() {
  return `
    <div class="fs-hero-banner">
      <div class="fs-hero-icon" aria-hidden="true">🛡️</div>
      <div class="fs-hero-text">
        <h2>${t('fs_tip_title')}</h2>
        <p>${t('fs_tip_body')}</p>
      </div>
    </div>`;
}

/**
 * Four stat cards: 7d / 14d / 30d / total.
 */
function buildSummary(new7, new14, new30, total) {
  return `
    <div class="fs-summary" role="region" aria-label="Summary">
      <div class="stat-card red">
        <div class="stat-icon" aria-hidden="true">🆕</div>
        <div class="stat-value">${new7}</div>
        <div class="stat-label">${t('fs_last_7d')}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon" aria-hidden="true">📅</div>
        <div class="stat-value">${new14}</div>
        <div class="stat-label">${t('fs_last_14d')}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon" aria-hidden="true">📆</div>
        <div class="stat-value">${new30}</div>
        <div class="stat-label">${t('fs_last_30d')}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon" aria-hidden="true">👥</div>
        <div class="stat-value">${total}</div>
        <div class="stat-label">${t('tracked_members')}</div>
      </div>
    </div>`;
}

/**
 * Search input + filter pill buttons.
 */
function buildControls(activeFilter, searchValue) {
  const pill = (f, label) =>
    `<button class="fs-filter-btn${activeFilter === f ? ' active' : ''}"
       data-f="${f}" aria-pressed="${activeFilter === f}">${label}</button>`;

  return `
    <div class="fs-controls">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="search" class="fs-search" id="fs-search"
          placeholder="${t('fs_search_placeholder')}"
          value="${escHtml(searchValue)}"
          autocomplete="off"
          aria-label="${t('fs_search_placeholder')}">
      </div>
      <div class="fs-filter-btns" role="group" aria-label="Filter by recency">
        ${pill('all', t('fs_filter_all'))}
        ${pill('7',   '🔴 ' + t('fs_filter_7d'))}
        ${pill('14',  '🟠 ' + t('fs_filter_14d'))}
        ${pill('30',  '🟡 ' + t('fs_filter_30d'))}
      </div>
    </div>`;
}

/**
 * Small "X of Y" result count line.
 */
function buildResultCount(shown, total) {
  return `<p class="fs-result-count">${shown} ${t('fs_showing_of')} ${total} ${t('fs_total_members')}</p>`;
}

/**
 * Empty state when no members match the current filter/search.
 */
function buildEmpty() {
  return `
    <div class="fs-empty">
      <div class="fs-empty-icon" aria-hidden="true">🔍</div>
      <p>${t('fs_no_results')}</p>
    </div>`;
}

/**
 * Collapsible section for members first seen more than 6 months ago.
 * These are deprioritized — still accessible but not shown by default.
 */
function buildArchivedSection(archivedMembers) {
  return `
    <details class="fs-archive-section">
      <summary class="fs-archive-summary">
        <span class="fs-archive-icon" aria-hidden="true">🗃️</span>
        <span>${t('fs_archive_title')} <span class="fs-archive-count">(${archivedMembers.length})</span></span>
        <span class="fs-archive-hint">${t('fs_archive_hint')}</span>
      </summary>
      <div class="fs-archive-body">
        <div class="fs-grid">${archivedMembers.map(buildCard).join('')}</div>
      </div>
    </details>`;
}

/**
 * The main list of member cards.
 */
function buildGrid(members) {
  return `<div class="fs-grid" role="list">${members.map(buildCard).join('')}</div>`;
}

/**
 * Single member card.
 */
function buildCard(m, index) {
  const urgencyClass = m.daysAgo <= 7 ? 'new-7' : m.daysAgo <= 14 ? 'new-14' : m.daysAgo <= 30 ? 'new-30' : '';

  const recencyBadge =
    m.daysAgo <= 7  ? `<span class="fs-badge-new danger"  aria-label="${t('fs_new_7d')}">🔴 ${t('fs_new_7d')}</span>`  :
    m.daysAgo <= 14 ? `<span class="fs-badge-new warning" aria-label="${t('fs_new_14d')}">🟠 ${t('fs_new_14d')}</span>` :
    m.daysAgo <= 30 ? `<span class="fs-badge-new caution" aria-label="${t('fs_new_30d')}">🟡 ${t('fs_new_30d')}</span>` :
    '';

  const nameChangeBadge = m.nameChanges > 0
    ? `<span class="fs-badge-new caution" title="${t('fs_name_changes')}">🔄 ${m.nameChanges} ${t('fs_name_changes')}</span>`
    : '';

  const daysLabel =
    m.daysAgo === 0    ? t('fs_today') :
    m.daysAgo === 1    ? `1 ${t('fs_day_ago')}` :
    m.daysAgo < 9999   ? `${m.daysAgo} ${t('fs_days_ago')}` :
    '—';

  const lastSeenChip = m.last_seen
    ? `<span class="fs-stat-chip">${t('last_seen_label')}: <span>${m.last_seen}</span></span>`
    : '';

  return `
    <div class="fs-card${urgencyClass ? ' ' + urgencyClass : ''}" role="listitem">
      <div class="fs-rank-num" aria-hidden="true">${index + 1}</div>

      <div class="fs-card-body">
        <div class="fs-card-name">${escHtml(m.name)}</div>
        <div class="fs-card-meta">
          <span class="fs-uid">🔐 ${m.uid}</span>
          ${recencyBadge}
          ${nameChangeBadge}
        </div>
        <div class="fs-stats">
          <span class="fs-stat-chip">⚔️ <span>${fmtCompact(m.kills)}</span></span>
          <span class="fs-stat-chip">🏰 <span>${fmtCompact(m.might)}</span></span>
          ${lastSeenChip}
        </div>
      </div>

      <div class="fs-card-right">
        <span class="fs-date">${m.first_seen || '—'}</span>
        <span class="fs-days-ago">${daysLabel}</span>
        <a href="./player.html?view=member&id=${encodeURIComponent(m.name)}"
           class="btn btn-secondary fs-profile-btn"
           aria-label="${t('view_profile')}: ${escHtml(m.name)}">${t('view_profile')}</a>
      </div>
    </div>`;
}

/* ─── Event wiring ──────────────────────────────────────── */

/**
 * Attach search and filter listeners using event delegation on the container.
 * This is more robust than re-attaching listeners after every render.
 */
function wireControls() {
  const container = document.getElementById('firstseen-container');
  if (!container || container.dataset.wired === 'true') return;

  // 1. Search Input (Input events bubble)
  container.addEventListener('input', e => {
    if (e.target && e.target.id === 'fs-search') {
      _currentSearch = e.target.value.trim().toLowerCase();
      _rerender();
      
      // Maintain focus and cursor position after re-render
      const newSearch = document.getElementById('fs-search');
      if (newSearch) {
        newSearch.focus();
        const val = newSearch.value;
        newSearch.setSelectionRange(val.length, val.length);
      }
    }
  });

  // 2. Filter Buttons (Click events bubble)
  container.addEventListener('click', e => {
    const btn = e.target.closest('.fs-filter-btn');
    if (btn && btn.dataset.f) {
      _currentFilter = btn.dataset.f;
      _rerender();
    }
  });

  // Mark as wired so we don't attach multiple times if init is called again
  container.dataset.wired = 'true';
}

// Module-level state refs so wireControls can trigger re-renders
// without re-fetching data (render() closes over these via initFirstSeen).
let _currentFilter = 'all';
let _currentSearch = '';
let _rerender = () => {};

/* ─── Utility helpers ───────────────────────────────────── */

/**
 * Difference in whole days between today (Date) and a YYYY-MM-DD string.
 */
function daysDiff(today, dateStr) {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((today - d) / 86400000);
}

/**
 * Minimal HTML-escape for user-supplied strings rendered via innerHTML.
 */
function escHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
