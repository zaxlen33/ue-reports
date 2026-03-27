// website/js/player.js

// Configure global Chart.js defaults to match dark UI
Chart.defaults.color = '#8b949e';
Chart.defaults.borderColor = '#30363d';
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";

async function initPlayer() {
  const container = document.getElementById('player-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const playerName = urlParams.get('id');

  if (!playerName) {
    setError(container, 'No player specified. Go back to Rankings or Growth to select a player.');
    return;
  }

  setLoading(container, `Loading data for ${playerName}…`);

  try {
    const [growthRes, huntsRes] = await Promise.allSettled([
      loadJSON('growth.json'),
      loadJSON('member_hunts.json')
    ]);

    const growthData = growthRes.status === 'fulfilled' ? growthRes.value : { members: [] };
    const allHunts   = huntsRes.status === 'fulfilled' ? huntsRes.value : {};

    const playerGrowth = growthData.members.find(m => m.name === playerName);
    const playerHunts  = allHunts[playerName] || [];

    if (!playerGrowth && !playerHunts.length) {
      setError(container, `Player "${playerName}" not found in current records.`);
      return;
    }

    renderPlayerDashboard(container, playerName, playerGrowth, playerHunts);

  } catch (err) {
    setError(container, 'Could not load player data. ' + err.message);
  }
}

function renderPlayerDashboard(container, name, growth, hunts) {
  const snaps = growth ? growth.snapshots || [] : [];
  const latestSnap = snaps.length ? snaps[snaps.length - 1] : null;
  const latestHunt = hunts.length ? hunts[hunts.length - 1] : null;

  // Header and summary cards
  const avatarLetter = name.charAt(0).toUpperCase();

  let html = `
    <div class="breadcrumb" style="margin-bottom: 2rem;">
      <a href="./rankings.html">🏆 Rankings</a>
      <span class="sep">›</span>
      <span class="current">${name}</span>
    </div>

    <div class="profile-header">
      <div class="profile-avatar">${avatarLetter}</div>
      <div class="profile-info">
        <h1>${name}</h1>
        <p>IGG ID: ${growth ? growth.igg_id : 'Unknown'} | Rank: ${latestSnap ? latestSnap.rank : '—'}</p>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:2rem;">
      <div class="stat-card blue">
        <div class="stat-icon">🏰</div>
        <div class="stat-value">${latestSnap ? fmtNum(latestSnap.might) : '—'}</div>
        <div class="stat-label">Current Might</div>
      </div>
      <div class="stat-card red">
        <div class="stat-icon">⚔️</div>
        <div class="stat-value">${latestSnap ? fmtNum(latestSnap.kills) : '—'}</div>
        <div class="stat-label">Current Kills</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon">🎯</div>
        <div class="stat-value">${latestHunt ? fmtNum(latestHunt.pts_total) : '—'}</div>
        <div class="stat-label">Latest Hunt Points</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-icon">💎</div>
        <div class="stat-value">${latestHunt ? fmtNum(latestHunt.pts_purchase) : '—'}</div>
        <div class="stat-label">Latest Purchase Points</div>
      </div>
    </div>
  `;

  // Charts layout
  html += `
    <div class="charts-grid" style="margin-bottom:2rem;">
      <div class="card">
        <div class="card-header"><h2>📈 Might Growth</h2></div>
        <div class="card-body"><div class="chart-container"><canvas id="chart-might"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h2>⚔️ Kills Growth</h2></div>
        <div class="card-body"><div class="chart-container"><canvas id="chart-kills"></canvas></div></div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h2>🦅 Hunt Point Progression</h2></div>
        <div class="card-body"><div class="chart-container"><canvas id="chart-hunt-pts"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h2>📦 Latest Monsters & Chests</h2></div>
        <div class="card-body"><div class="chart-container"><canvas id="chart-hunt-bar"></canvas></div></div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Mount Charts
  if (snaps.length > 0) {
    const dates = snaps.map(s => s.date);
    const mightData = snaps.map(s => s.might);
    const killsData = snaps.map(s => s.kills);

    createLineChart('chart-might', 'Might', dates, mightData, '#58a6ff');
    createLineChart('chart-kills', 'Kills', dates, killsData, '#f85149');
  } else {
    document.getElementById('chart-might').parentNode.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">No growth data available.</p>';
    document.getElementById('chart-kills').parentNode.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">No growth data available.</p>';
  }

  if (hunts.length > 0) {
    const dates = hunts.map(h => h.date);
    const huntPts = hunts.map(h => h.pts_hunt);
    
    createLineChart('chart-hunt-pts', 'Hunt Points', dates, huntPts, '#3fb950');

    // Bar chart for latest hunt monsters/purchases
    const { monsters, purchases } = latestHunt;
    const labels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
    const mData = [monsters.lvl1||0, monsters.lvl2||0, monsters.lvl3||0, monsters.lvl4||0, monsters.lvl5||0];
    const pData = [purchases.lvl1||0, purchases.lvl2||0, purchases.lvl3||0, purchases.lvl4||0, purchases.lvl5||0];

    createDoubleBarChart('chart-hunt-bar', labels, 'Monsters Hunted', mData, '#a371f7', 'Chests Purchased', pData, '#e3b341');
  } else {
    document.getElementById('chart-hunt-pts').parentNode.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">No hunt data available.</p>';
    document.getElementById('chart-hunt-bar').parentNode.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px;">No hunt data available.</p>';
  }
}

function createLineChart(canvasId, label, labels, data, color) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color + '66'); // 40% opacity
  gradient.addColorStop(1, color + '00'); // 0% opacity

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
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
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(13, 17, 23, 0.9)',
          titleColor: '#c9d1d9',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { 
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
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
      labels: labels,
      datasets: [
        {
          label: label1,
          data: data1,
          backgroundColor: color1,
          borderRadius: 4
        },
        {
          label: label2,
          data: data2,
          backgroundColor: color2,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'top',
          labels: { boxWidth: 12, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(13, 17, 23, 0.9)',
          titleColor: '#c9d1d9',
          bodyColor: '#c9d1d9',
          borderColor: '#30363d',
          borderWidth: 1
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
