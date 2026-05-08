// script.js - Visor de Reinos y Reportes
let kingdomsData = null;
let currentKingdomIndex = 0;
let allKingdoms = [];

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

// Helper: Formatear números grandes con M/B
function formatNumber(numStr) {
    if (!numStr) return numStr;
    return numStr;
}

// Renderizar estadísticas del reino activo
function renderKingdomStats(kingdom) {
    if (!kingdom) return '<div class="skeleton-loader">Reino no disponible</div>';
    const stats = kingdom.stats || {};
    const carto = stats["View on Cartography"] || null;
    
    return `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-flag-checkered"></i> REINO</div>
                <div class="stat-value">${kingdom.kingdom_name} (ID ${kingdom.kingdom_id})</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-chart-simple"></i> RALLIES (Últ. semana)</div>
                <div class="stat-value">${stats["Rallies last week"] || '—'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-skull"></i> TROPAS PERDIDAS</div>
                <div class="stat-value">${stats["Troops loss last week"] || '—'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label"><i class="fas fa-tower-broadcast"></i> MIGHT PERDIDO</div>
                <div class="stat-value">${stats["Might loss last week"] || '—'}</div>
            </div>
            ${carto ? `<div class="stat-item">
                <div class="stat-label"><i class="fas fa-map"></i> CARTOGRAFÍA</div>
                <div class="stat-value"><a href="${carto.href || '#'}" target="_blank" rel="noopener noreferrer" class="cartography-link"><i class="fas fa-external-link-alt"></i> ${carto.text || 'Ver Mapa'}</a></div>
            </div>` : ''}
        </div>
    `;
}

// Renderizar la tabla de batallas (reportes)
function renderBattles(kingdom) {
    const battles = kingdom?.battles || [];
    if (!battles.length) {
        return `<div class="skeleton-loader" style="background: none;"><i class="fas fa-ban"></i> No hay reportes de combate registrados para este reino.</div>`;
    }
    
    let tableHtml = `
        <table class="battle-table">
            <thead>
                <tr><th>Fecha/Hora</th><th>Resultado</th><th>Pérdida Might</th><th>Pérdida Tropas</th><th>Atacante (Gremio)</th><th>Defensor (Gremio)</th><th>ID Batalla</th></tr>
            </thead>
            <tbody>
    `;
    
    battles.forEach(b => {
        const outcomeClass = b.outcome === 'burned' ? '🔥 Quemado' : (b.outcome || '—');
        const attackerText = `${b.attacker?.name || '?'} <span class="guild-name">[${b.attacker?.guild || '?'}]</span>`;
        const defenderText = `${b.defender?.name || '?'} <span class="guild-name">[${b.defender?.guild || '?'}]</span>`;
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

// Actualizar toda la interfaz según el índice actual
function updateUI() {
    if (!allKingdoms.length) return;
    const kingdom = allKingdoms[currentKingdomIndex];
    if (!kingdom) return;
    
    // Actualizar contador y navegación
    kingdomCounterSpan.innerHTML = `<i class="fas fa-crown"></i> Reino ${currentKingdomIndex+1} de ${allKingdoms.length} · ID ${kingdom.kingdom_id}`;
    
    // Render stats
    statsArea.innerHTML = renderKingdomStats(kingdom);
    // Render battles
    const battlesHtml = renderBattles(kingdom);
    battlesContainer.innerHTML = battlesHtml;
    battleCountBadge.innerText = `${kingdom.battles?.length || 0} batallas`;
    
    // Habilitar/deshabilitar botones visualmente
    prevBtn.disabled = (currentKingdomIndex === 0);
    nextBtn.disabled = (currentKingdomIndex === allKingdoms.length - 1);
    prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
    nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
}

// Buscar reino por ID numérico
function goToKingdomById(id) {
    const targetId = Number(id);
    if (isNaN(targetId)) {
        alert("Ingresa un número de reino válido (ej: 1400)");
        return false;
    }
    const foundIndex = allKingdoms.findIndex(k => k.kingdom_id === targetId);
    if (foundIndex === -1) {
        alert(`Reino con ID ${targetId} no encontrado en los datos.`);
        return false;
    }
    currentKingdomIndex = foundIndex;
    updateUI();
    return true;
}

// Cargar datos desde kingdoms.json
async function loadData() {
    try {
        metaInfoSpan.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Cargando reportes...';
        const response = await fetch('kingdoms.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        kingdomsData = data;
        allKingdoms = data.kingdoms || [];
        
        if (!allKingdoms.length) {
            statsArea.innerHTML = '<div class="skeleton-loader">⚠️ No hay reinos disponibles en el archivo JSON.</div>';
            battlesContainer.innerHTML = '<div class="skeleton-loader">Sin datos</div>';
            return;
        }
        
        // Configurar metadatos
        if (data.scraped_at) scrapedDateSpan.innerText = new Date(data.scraped_at).toLocaleString();
        if (data.range) rangeInfoSpan.innerText = data.range;
        metaInfoSpan.innerHTML = `<i class="fas fa-database"></i> ${data.total_success || 0} reinos activos · Escaneado: ${data.scraped_at ? data.scraped_at.split('T')[0] : '—'}`;
        
        // Inicializar primer reino
        currentKingdomIndex = 0;
        updateUI();
    } catch (error) {
        console.error("Error cargando JSON:", error);
        statsArea.innerHTML = `<div class="skeleton-loader" style="color:#ff9f7c;"><i class="fas fa-exclamation-triangle"></i> Error al cargar kingdoms.json. Asegúrate de que el archivo exista y sea válido.</div>`;
        battlesContainer.innerHTML = '<div class="skeleton-loader">No se pudieron obtener los reportes.</div>';
        metaInfoSpan.innerHTML = 'Error de conexión con los datos';
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

// Iniciar aplicación
loadData();