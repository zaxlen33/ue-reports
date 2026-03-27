async function initTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  setLoading(container, 'Loading missions…');

  try {
    const tasks = await loadJSON('tasks.json');
    
    const t200 = tasks['200_percent_bonus_missions'] || [];
    const t120 = tasks['120_percent_bonus_missions'] || [];
    
    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:1.5rem;">
        <div class="stat-card orange">
          <div class="stat-icon">🔥</div>
          <div class="stat-value">${t200.length}</div>
          <div class="stat-label">200% Bonus Missions</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon">🌟</div>
          <div class="stat-value">${t120.length}</div>
          <div class="stat-label">120% Bonus Missions</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🎯</div>
          <div class="stat-value">${t200.length + t120.length}</div>
          <div class="stat-label">Total Missions Tracked</div>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem;">
        ${renderTaskTable('🔥 200% Bonus Missions', t200, 'orange')}
        ${renderTaskTable('🌟 120% Bonus Missions', t120, 'blue')}
      </div>
    `;
  } catch (err) {
    setError(container, 'Could not load tasks.json. ' + err.message);
  }
}

function renderTaskTable(title, tasksList, colorClass) {
  if (!tasksList.length) {
    return `
      <div class="card">
        <div class="card-header"><h2>${title}</h2></div>
        <div class="empty-state" style="padding:2rem;"><p>No missions available in this tier.</p></div>
      </div>
    `;
  }
  
  return `
    <div class="card" style="border-top:3px solid var(--accent-${colorClass});">
      <div class="card-header">
        <h2>${title}</h2>
        <span class="badge-count">${tasksList.length}</span>
      </div>
      <div class="table-wrapper">
        <table style="font-size:0.9rem;">
          <thead>
            <tr>
              <th class="right" style="width:70px;">Points</th>
              <th>Mission</th>
              <th>Qty / Time Limit</th>
            </tr>
          </thead>
          <tbody>
            ${tasksList.map(t => `
              <tr style="transition:background 0.15s;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
                <td class="right mono" style="font-weight:700;color:var(--accent-${colorClass});font-size:0.95rem;">${t.required_points}</td>
                <td style="font-weight:600;color:var(--text-primary);">${t.mission}</td>
                <td>
                  <div style="color:var(--text-secondary);font-weight:500;">${t.quantity}</div>
                  <div style="color:var(--text-muted);font-size:0.8rem;margin-top:2px;">⏳ ${t.time_limit}</div>
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
  if (page === 'tasks.html') {
    initTasks();
  }
});
