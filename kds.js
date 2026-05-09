// script.js - Kingdom and Report Viewer
let kingdomsData = null;
let currentKingdomIndex = 0;
let allKingdoms = [];
let currentFilterMode = 'all'; // 'all', 'leaders', 'defenders'
let firstSeenLeader = new Map();
let firstSeenDefender = new Map();

// DOM Elements
const prevBtn = document.getElementById('prevKingdomBtn');
const nextBtn = document.getElementById('nextKingdomBtn');
const goBtn = document.getElementById('goKingdomBtn');
const kingdomInput = document.getElementById('kingdomInput');
const kingdomCounterSpan = document.getElementById('kingdomCounter');
const statsArea = document.getElementById('kingdomStatsArea');
const battlesContainer = document.getElementById('battlesListContainer');
const battleCountBadge = document.getElementById('battleCountBadge');
const metaInfoSpan = document.getElementById('metaInfo');
const scrapedDateSpan = document.getElementById('scrapedDate');
const rangeInfoSpan = document.getElementById('rangeInfo');

// Filter Buttons
const filterAllBtn = document.getElementById('filterAllBtn');
const filterLeadersBtn = document.getElementById('filterLeadersBtn');
const filterDefendersBtn = document.getElementById('filterDefendersBtn');
const filterGuildsBtn = document.getElementById('filterGuildsBtn');
const globalUniqueCheckbox = document.getElementById('globalUniqueCheckbox');

// Helper: Escape HTML to prevent broken tags
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper: Format large numbers with M/B
function formatNumber(numStr) {
    if (!numStr) return numStr;
    return numStr;
}

// Render stats for the active kingdom
function renderKingdomStats(kingdom) {
    if (!kingdom) return '<div class="skeleton-loader">Kingdom not available</div>';
    const stats = kingdom.stats || {};
    const carto = stats["View on Cartography"] || null;

    return `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-flag-checkered"></i> KINGDOM</div>
                <div class="stat-value">${kingdom.kingdom_name} (ID ${kingdom.kingdom_id})</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-chart-simple"></i> RALLIES (Last week)</div>
                <div class="stat-value">${stats["Rallies last week"] || '—'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-skull"></i> TROOPS LOST</div>
                <div class="stat-value">${stats["Troops loss last week"] || '—'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-tower-broadcast"></i> MIGHT LOST</div>
                <div class="stat-value">${stats["Might loss last week"] || '—'}</div>
            </div>
            ${carto ? `<div class="stat-item">
                <div class="stat-label"><i class="fas fa-map"></i> CARTOGRAPHY</div>
                <div class="stat-value"><a href="${carto.href || '#'}" target="_blank" rel="noopener noreferrer" class="cartography-link"><i class="fas fa-external-link-alt"></i> ${carto.text || 'View Map'}</a></div>
            </div>` : ''}
        </div>
    `;
}

// List of exception guilds (family, allies, or non-recruitable)
const EXCEPTION_GUILDS = [
    "KCL", "CSK", "MOP", "CWS", "Sup", "KxQ", "VLY", "RR!", "AUF", "30B", "YES", "S:E", "YYP", "CCC", "YYY", "ZXX", "XMY", "SVF", "FEM", "Rzr",
    "PBB", "HrP", "Ich", "Ash", "ZSU", "YwH", "BMG", "FFx", "SYP", "YYP", "Lhz", "AsT", "Tof", "NVQ", "ABX", "Q99", "FuN",
    "DC", "M/J", "SDV", "CHV", "DtC", "msy", "-p-", "YMT", "VWI", "R~V", "D'w", "U|E", "HxT", "IWG", "(W)", "FxA", "OoO",
    "-b-", "EMP", "BMW", "I:W", "SIS", "ggi", "~NB", "VFS", "Ph9",
    "OkM", "Egu", "ReJ",
    "#NE", "U$A", "D@w", "VSG", "=N=", "MYO", "=X=", "VxG"
];

let lastCopiedElement = null;
let lastCopiedOriginalColor = '';
let lastCopiedOriginalBorderColor = '';
let lastCopiedOriginalBg = '';

// Global function to copy text to clipboard
window.copyText = function (element, text) {
    if (!text || text === '?') return;
    navigator.clipboard.writeText(text).then(() => {
        // Restore previous element if it's different
        if (lastCopiedElement && lastCopiedElement !== element) {
            lastCopiedElement.style.color = lastCopiedOriginalColor;
            lastCopiedElement.style.borderColor = lastCopiedOriginalBorderColor;
            lastCopiedElement.style.background = lastCopiedOriginalBg;
        }

        // Save original styles of the new element
        if (lastCopiedElement !== element) {
            lastCopiedOriginalColor = element.style.color;
            lastCopiedOriginalBorderColor = element.style.borderColor;
            lastCopiedOriginalBg = element.style.background;
            lastCopiedElement = element;
        }

        // Apply active "copied" styling (permanently until another is clicked)
        element.style.color = '#4CAF50';
        element.style.borderColor = '#4CAF50';
        if (element.classList.contains('guild-badge')) {
            element.style.background = 'rgba(76, 175, 80, 0.1)';
        }
    }).catch(err => console.error('Error copying: ', err));
};

// Render the battles (reports) table
function renderBattles(battles) {
    if (!battles || !battles.length) {
        return `<div class="skeleton-loader" style="background: none;"><i class="fas fa-ban"></i> No battle reports to show.</div>`;
    }

    let tableHtml = `
        <table class="battle-table">
            <thead>
                <tr><th>Date/Time</th><th>Outcome</th><th>Might Loss</th><th>Troops Loss</th><th>Attacker (Guild)</th><th>Defender (Guild)</th><th>Battle ID</th></tr>
            </thead>
            <tbody>
    `;

    battles.forEach(b => {
        const outcomeClass = b.outcome === 'burned' ? '🔥 Burned' : (b.outcome || '—');

        const cleanAttackerGuild = b.attacker?.guild || '?';
        const cleanDefenderGuild = b.defender?.guild || '?';
        const attackerName = b.attacker?.name || '?';
        const defenderName = b.defender?.name || '?';

        const displayAttackerGuild = cleanAttackerGuild !== '?' ? `[${escapeHtml(cleanAttackerGuild)}]` : '?';
        const displayDefenderGuild = cleanDefenderGuild !== '?' ? `[${escapeHtml(cleanDefenderGuild)}]` : '?';

        const attackerGuildHtml = EXCEPTION_GUILDS.includes(cleanAttackerGuild)
            ? `<span class="guild-name" onclick="copyText(this, '${cleanAttackerGuild.replace(/'/g, "\\'")}')" style="color: #ff4d4d; font-weight: bold; cursor: pointer;" title="Exception Guild - Click to copy">${displayAttackerGuild}</span>`
            : `<span class="guild-name" onclick="copyText(this, '${cleanAttackerGuild.replace(/'/g, "\\'")}')" style="cursor: pointer;" title="Click to copy">${displayAttackerGuild}</span>`;

        const defenderGuildHtml = EXCEPTION_GUILDS.includes(cleanDefenderGuild)
            ? `<span class="guild-name" onclick="copyText(this, '${cleanDefenderGuild.replace(/'/g, "\\'")}')" style="color: #ff4d4d; font-weight: bold; cursor: pointer;" title="Exception Guild - Click to copy">${displayDefenderGuild}</span>`
            : `<span class="guild-name" onclick="copyText(this, '${cleanDefenderGuild.replace(/'/g, "\\'")}')" style="cursor: pointer;" title="Click to copy">${displayDefenderGuild}</span>`;

        const attackerNameHtml = `<span onclick="copyText(this, '${attackerName.replace(/'/g, "\\'")}')" style="cursor: pointer;" title="Click to copy name">${escapeHtml(attackerName)}</span>`;
        const defenderNameHtml = `<span onclick="copyText(this, '${defenderName.replace(/'/g, "\\'")}')" style="cursor: pointer;" title="Click to copy name">${escapeHtml(defenderName)}</span>`;

        const attackerText = `${attackerNameHtml} ${attackerGuildHtml}`;
        const defenderText = `${defenderNameHtml} ${defenderGuildHtml}`;
        tableHtml += `
            <tr>
                <td>${b.timestamp || '—'}</td>
                <td><span class="outcome-badge">${outcomeClass}</span></td>
                <td>${b.might_loss || '—'}</td>
                <td>${b.troops_loss || '—'}</td>
                <td>${attackerText}</td>
                <td>${defenderText}</td>
                <td style="font-family: monospace;">${b.battle_id || '—'}</td>
            </tr>
        `;
    });
    tableHtml += `</tbody></table>`;
    return tableHtml;
}

// Update the entire UI based on the current index
function updateUI() {
    if (!allKingdoms.length) return;
    const kingdom = allKingdoms[currentKingdomIndex];
    if (!kingdom) return;

    // Update counter and navigation
    kingdomCounterSpan.innerHTML = `<i class="fas fa-crown"></i> Kingdom ${currentKingdomIndex + 1} of ${allKingdoms.length} · ID ${kingdom.kingdom_id}`;

    // Render stats
    statsArea.innerHTML = renderKingdomStats(kingdom);

    // Apply filters
    let battlesToRender = kingdom.battles || [];
    const isGlobal = globalUniqueCheckbox ? globalUniqueCheckbox.checked : false;

    if (currentFilterMode === 'leaders') {
        const seenLeaders = new Set();
        battlesToRender = battlesToRender.filter(b => {
            const leaderName = b.attacker?.name;
            if (!leaderName || leaderName === '?') return true; // Keep if unknown
            if (seenLeaders.has(leaderName)) return false;

            // If global unique is enabled, only show them in their very first appearance kingdom
            if (isGlobal && firstSeenLeader.get(leaderName) !== kingdom.kingdom_id) return false;

            seenLeaders.add(leaderName);
            return true;
        });
    } else if (currentFilterMode === 'defenders') {
        const seenDefenders = new Set();
        battlesToRender = battlesToRender.filter(b => {
            const defenderName = b.defender?.name;
            if (!defenderName || defenderName === '?') return true; // Keep if unknown
            if (seenDefenders.has(defenderName)) return false;

            // If global unique is enabled, only show them in their very first appearance kingdom
            if (isGlobal && firstSeenDefender.get(defenderName) !== kingdom.kingdom_id) return false;

            seenDefenders.add(defenderName);
            return true;
        });
    } else if (currentFilterMode === 'guilds') {
        const seenGuilds = new Set();
        const uniqueGuilds = [];

        // Loop through ALL kingdoms, not just the active one
        allKingdoms.forEach(k => {
            let battlesToProcess = k.battles || [];
            battlesToProcess.forEach(b => {
                let attackerGuild = b.attacker?.guild;
                let defenderGuild = b.defender?.guild;

                if (attackerGuild === '?') attackerGuild = null;
                if (defenderGuild === '?') defenderGuild = null;

                if (attackerGuild && !seenGuilds.has(attackerGuild)) {
                    seenGuilds.add(attackerGuild);
                    uniqueGuilds.push(attackerGuild);
                }
                if (defenderGuild && !seenGuilds.has(defenderGuild)) {
                    seenGuilds.add(defenderGuild);
                    uniqueGuilds.push(defenderGuild);
                }
            });
        });

        let guildsHtml = '<div class="guilds-grid" style="padding: 15px; text-align: left; line-height: 2;">';
        if (uniqueGuilds.length === 0) {
            guildsHtml += `<div class="skeleton-loader" style="background: none; width: 100%;"><i class="fas fa-ban"></i> No unique guilds found.</div>`;
        } else {
            // Sort guilds alphabetically
            uniqueGuilds.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            // Group by first character
            const grouped = {};
            uniqueGuilds.forEach(guild => {
                const firstChar = guild.charAt(0).toUpperCase();
                let group = '#'; // Default for symbols
                if (/[A-Z]/.test(firstChar)) {
                    group = firstChar;
                } else if (/[0-9]/.test(firstChar)) {
                    group = firstChar; // Separate section for each number
                }

                if (!grouped[group]) grouped[group] = [];
                grouped[group].push(guild);
            });

            // Render groups in order: 0-9 individually, A-Z, #
            const groupsOrder = [
                ...Array.from({ length: 10 }, (_, i) => i.toString()),
                ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
                '#'
            ];

            groupsOrder.forEach(group => {
                if (grouped[group] && grouped[group].length > 0) {
                    // Group separator header
                    guildsHtml += `<div style="width: 100%; display: block; border-bottom: 2px solid rgba(76, 175, 80, 0.3); margin-top: 25px; margin-bottom: 15px; padding-bottom: 5px; font-weight: bold; color: #4CAF50; font-size: 1.3em; letter-spacing: 2px;"><i class="fas fa-folder" style="margin-right: 8px; font-size: 0.8em;"></i>${group}</div>`;

                    // Guild badges for this group
                    grouped[group].forEach(guild => {
                        const isException = EXCEPTION_GUILDS.includes(guild);
                        const baseBg = isException ? 'rgba(255,77,77,0.1)' : 'rgba(0,0,0,0.3)';
                        const baseColor = isException ? '#ff4d4d' : '#ffffff';
                        const baseBorder = isException ? '1px solid #ff4d4d' : '1px solid rgba(255,255,255,0.2)';
                        const title = isException ? 'Exception Guild - Click to copy' : 'Click to copy';

                        guildsHtml += `<span class="guild-badge" onclick="copyText(this, '${guild.replace(/'/g, "\\'")}')" style="display: inline-block; cursor: pointer; padding: 6px 14px; margin: 4px; background: ${baseBg}; border-radius: 6px; border: ${baseBorder}; color: ${baseColor}; font-family: monospace; font-size: 1.1em; transition: all 0.2s; vertical-align: middle;" title="${title}">[${escapeHtml(guild)}]</span>`;
                    });
                }
            });
        }
        guildsHtml += '</div>';

        battlesContainer.innerHTML = guildsHtml;
        battleCountBadge.innerText = `${uniqueGuilds.length} unique guilds`;

        // Return early since we already rendered
        // Update filter buttons styling
        if (filterAllBtn) filterAllBtn.style.opacity = currentFilterMode === 'all' ? '1' : '0.6';
        if (filterLeadersBtn) filterLeadersBtn.style.opacity = currentFilterMode === 'leaders' ? '1' : '0.6';
        if (filterDefendersBtn) filterDefendersBtn.style.opacity = currentFilterMode === 'defenders' ? '1' : '0.6';
        if (filterGuildsBtn) filterGuildsBtn.style.opacity = currentFilterMode === 'guilds' ? '1' : '0.6';

        // Enable/disable buttons visually
        prevBtn.disabled = (currentKingdomIndex === 0);
        nextBtn.disabled = (currentKingdomIndex === allKingdoms.length - 1);
        prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';

        return;
    }

    // Render battles (for all, leaders, defenders)
    const battlesHtml = renderBattles(battlesToRender);
    battlesContainer.innerHTML = battlesHtml;
    battleCountBadge.innerText = `${battlesToRender.length} battles`;

    // Update filter buttons styling
    if (filterAllBtn) filterAllBtn.style.opacity = currentFilterMode === 'all' ? '1' : '0.6';
    if (filterLeadersBtn) filterLeadersBtn.style.opacity = currentFilterMode === 'leaders' ? '1' : '0.6';
    if (filterDefendersBtn) filterDefendersBtn.style.opacity = currentFilterMode === 'defenders' ? '1' : '0.6';
    if (filterGuildsBtn) filterGuildsBtn.style.opacity = currentFilterMode === 'guilds' ? '1' : '0.6';

    // Enable/disable buttons visually
    prevBtn.disabled = (currentKingdomIndex === 0);
    nextBtn.disabled = (currentKingdomIndex === allKingdoms.length - 1);
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
    nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
}

// Search kingdom by numeric ID
function goToKingdomById(id) {
    const targetId = Number(id);
    if (isNaN(targetId)) {
        alert("Enter a valid kingdom ID (e.g. 1400)");
        return false;
    }
    const foundIndex = allKingdoms.findIndex(k => k.kingdom_id === targetId);
    if (foundIndex === -1) {
        alert(`Kingdom with ID ${targetId} not found in the data.`);
        return false;
    }
    currentKingdomIndex = foundIndex;
    updateUI();
    return true;
}

// Load data from kingdoms.json
async function loadData() {
    try {
        metaInfoSpan.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Loading reports...';
        const response = await fetch('kingdoms.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        kingdomsData = data;
        allKingdoms = data.kingdoms || [];


        if (!allKingdoms.length) {
            statsArea.innerHTML = '<div class="skeleton-loader">⚠️ No kingdoms available in the JSON file.</div>';
            battlesContainer.innerHTML = '<div class="skeleton-loader">No data</div>';
            return;
        }

        // Pre-clean data and compute global first appearances
        allKingdoms.forEach(k => {
            if (!k.battles) return;
            k.battles.forEach(b => {
                let rawAttackerGuild = b.attacker?.guild || '?';
                let rawDefenderGuild = b.defender?.guild || '?';
                let attackerName = b.attacker?.name || '?';
                let defenderName = b.defender?.name || '?';

                let cleanAttackerGuild = rawAttackerGuild.replace(/[\[\]]/g, '');
                let cleanDefenderGuild = rawDefenderGuild.replace(/[\[\]]/g, '');

                if (cleanAttackerGuild !== '?' && cleanAttackerGuild.length !== 3) {
                    if (attackerName === '?' || attackerName === '') b.attacker.name = cleanAttackerGuild;
                    b.attacker.guild = '?';
                } else {
                    b.attacker.guild = cleanAttackerGuild;
                }

                if (cleanDefenderGuild !== '?' && cleanDefenderGuild.length !== 3) {
                    if (defenderName === '?' || defenderName === '') b.defender.name = cleanDefenderGuild;
                    b.defender.guild = '?';
                } else {
                    b.defender.guild = cleanDefenderGuild;
                }

                const finalAttackerName = b.attacker?.name;
                const finalDefenderName = b.defender?.name;

                if (finalAttackerName && finalAttackerName !== '?' && !firstSeenLeader.has(finalAttackerName)) {
                    firstSeenLeader.set(finalAttackerName, k.kingdom_id);
                }
                if (finalDefenderName && finalDefenderName !== '?' && !firstSeenDefender.has(finalDefenderName)) {
                    firstSeenDefender.set(finalDefenderName, k.kingdom_id);
                }
            });
        });

        // Configure metadata
        if (data.scraped_at) scrapedDateSpan.innerText = new Date(data.scraped_at).toLocaleString();
        if (data.range) rangeInfoSpan.innerText = data.range;
        metaInfoSpan.innerHTML = `<i class="fas fa-database"></i> ${data.total_success || 0} active kingdoms · Scanned: ${data.scraped_at ? data.scraped_at.split('T')[0] : '—'}`;

        // Initialize first kingdom
        currentKingdomIndex = 0;
        updateUI();
    } catch (error) {
        console.error("Error loading JSON:", error);
        statsArea.innerHTML = `<div class="skeleton-loader" style="color:#ff9f7c;"><i class="fas fa-exclamation-triangle"></i> Error loading kingdoms.json. Make sure the file exists and is valid.</div>`;
        battlesContainer.innerHTML = '<div class="skeleton-loader">Could not fetch reports.</div>';
        metaInfoSpan.innerHTML = 'Data connection error';
    }
}

// Event Listeners
prevBtn.addEventListener('click', () => {
    if (currentKingdomIndex > 0) {
        currentKingdomIndex--;
        updateUI();
    }
});
nextBtn.addEventListener('click', () => {
    if (currentKingdomIndex < allKingdoms.length - 1) {
        currentKingdomIndex++;
        updateUI();
    }
});
goBtn.addEventListener('click', () => {
    const rawId = kingdomInput.value.trim();
    if (rawId === "") return;
    goToKingdomById(rawId);
});
kingdomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') goBtn.click();
});

if (filterAllBtn) {
    filterAllBtn.addEventListener('click', () => {
        currentFilterMode = 'all';
        updateUI();
    });
}
if (filterLeadersBtn) {
    filterLeadersBtn.addEventListener('click', () => {
        currentFilterMode = 'leaders';
        updateUI();
    });
}
if (filterDefendersBtn) {
    filterDefendersBtn.addEventListener('click', () => {
        currentFilterMode = 'defenders';
        updateUI();
    });
}
if (filterGuildsBtn) {
    filterGuildsBtn.addEventListener('click', () => {
        currentFilterMode = 'guilds';
        updateUI();
    });
}
if (globalUniqueCheckbox) {
    globalUniqueCheckbox.addEventListener('change', () => {
        updateUI();
    });
}

// Start application
loadData();