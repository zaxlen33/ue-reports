async function initRankings() {
  const container = document.getElementById('rankings-container');
  if (!container) return;

  setLoading(container, 'Loading rankings…');

  try {
    const growth = await loadJSON('growth.json');
    const members = growth.members || [];
    
    // Sort logic
    const topPower = [...members].sort((a,b) => {
      const aPower = a.snapshots && a.snapshots.length ? a.snapshots[a.snapshots.length-1].might : 0;
      const bPower = b.snapshots && b.snapshots.length ? b.snapshots[b.snapshots.length-1].might : 0;
      return bPower - aPower;
    }).slice(0, 10);
    
    const topKills = [...members].sort((a,b) => {
      const aKills = a.snapshots && a.snapshots.length ? a.snapshots[a.snapshots.length-1].kills : 0;
      const bKills = b.snapshots && b.snapshots.length ? b.snapshots[b.snapshots.length-1].kills : 0;
      return bKills - aKills;
    }).slice(0, 10);
    
    const nameChanges = members.filter(m => m.name_history && m.name_history.length > 0);
    
    container.innerHTML = `
      <div class="leaderboard-container" style="margin-bottom:2rem;">
        ${renderLeaderboard('🏰 Top 10 Power', topPower, 'might', 'var(--accent-blue)')}
        ${renderLeaderboard('⚔️ Top 10 Kills', topKills, 'kills', 'var(--accent-yellow)')}
      </div>
      
      ${renderNameChanges(nameChanges)}
    `;
  } catch (err) {
    setError(container, 'Could not load rankings data. ' + err.message);
  }
}

function renderLeaderboard(title, topList, metric, color) {
  if (!topList.length) return `<div class="card"><div class="card-header"><h2>${title}</h2></div><div class="card-body">No data available.</div></div>`;
  
  return `
    <div class="card" style="border-top: 3px solid ${color};">
      <div class="card-header">
        <h2>${title}</h2>
      </div>
      <div class="card-body" style="padding:0;">
        ${topList.map((m, i) => {
          const val = m.snapshots && m.snapshots.length ? m.snapshots[m.snapshots.length-1][metric] : 0;
          let rankClass = '';
          if (i === 0) rankClass = 'top-1';
          if (i === 1) rankClass = 'top-2';
          if (i === 2) rankClass = 'top-3';
          
          return `
            <div class="leaderboard-row">
              <span class="leaderboard-rank ${rankClass}">${i + 1}</span>
              <a href="player.html?id=${encodeURIComponent(m.name)}" class="leaderboard-name">${m.name}</a>
              <span class="leaderboard-value" style="color:${color};">${fmtNum(val)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderNameChanges(membersList) {
  if (!membersList.length) return '';
  
  return `
    <div class="card">
      <div class="card-header">
        <h2>📝 Recent Name Changes</h2>
        <span class="badge-count">${membersList.length} members</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Current Name</th>
              <th>Previous Names History (Oldest → Newest)</th>
            </tr>
          </thead>
          <tbody>
            ${membersList.map(m => `
              <tr style="transition:background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <td style="font-weight:600;"><a href="player.html?id=${encodeURIComponent(m.name)}" style="color:var(--text-primary);text-decoration:none;">${m.name}</a></td>
                <td style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.9rem;">
                  ${m.name_history.join(' <span style="color:var(--accent-blue);">→</span> ')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  if (page === 'rankings.html') {
    initRankings();
  }
});
