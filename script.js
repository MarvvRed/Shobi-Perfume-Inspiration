console.log("Shobi Perfume Inspiration loaded.");

let allPerfumes = [];
let allBrands = new Map();

const state = {
    searchQuery: '',
    favorites: [],
    showingFavorites: false,
    selectedBrand: null,
    activeFilters: {
        gender: [],
        brands: [],
        season: []
    }
};

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                field += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push(field);
            field = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && text[i + 1] === '\n') i++;
            row.push(field);
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }

    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(values => {
        const item = {};
        headers.forEach((header, index) => {
            item[header] = (values[index] || '').trim();
        });
        return item;
    });
}

function splitPipe(value) {
    return String(value || '')
        .split('|')
        .map(v => v.trim())
        .filter(Boolean);
}

function normalizeGender(value) {
    const gender = String(value || '').trim().toLowerCase();
    if (['men', 'man', 'male', 'masculine', 'm'].includes(gender)) return 'male';
    if (['women', 'woman', 'female', 'feminine', 'f'].includes(gender)) return 'female';
    if (['unisex', 'u', 'men & women', 'women & men', 'male & female', 'female & male'].includes(gender)) return 'unisex';
    return gender;
}

function mapCsvRow(row) {
    return {
        code: row.shobi_code,
        shobiName: row.shobi_name,
        inspiredBy: row.inspired_by || row.shobi_name,
        brand: row.brand || 'Unknown Brand',
        genderAffinity: normalizeGender(row.gender),
        status: row.status || '',
        isNew: row.new === '1',
        shobiUrl: row.shobi_url || '',
        fragranticaUrl: row.fragrantica_url || '',
        description: row.description || '',
        image: row.image || '',
        seasons: splitPipe(row.season).map(v => v.toLowerCase()),
        occasions: [],
        mainAccords: [],
        notes: {
            top: splitPipe(row.top_notes),
            heart: splitPipe(row.heart_notes),
            base: splitPipe(row.base_notes)
        }
    };
}

async function loadCsvDatabase() {
    const response = await fetch('shobi-master.csv', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`CSV not available: ${response.status}`);

    const text = await response.text();
    const rows = parseCSV(text);

    allPerfumes = rows
        .map(mapCsvRow)
        .filter(p => p.code && p.inspiredBy);

    allBrands.clear();
    allPerfumes.forEach(p => {
        if (!allBrands.has(p.brand)) allBrands.set(p.brand, { name: p.brand });
    });
}

async function loadLegacyDatabase() {
    const response = await fetch('database_complete.json');
    if (!response.ok) throw new Error(`Legacy database not available: ${response.status}`);
    const rawData = await response.json();
    allBrands.clear();

    if (rawData.length > 0 && Array.isArray(rawData[0].perfumes)) {
        allPerfumes = rawData.flatMap(brandObject => {
            if (!brandObject || !Array.isArray(brandObject.perfumes)) return [];
            const brandName = brandObject.brandInfo?.name || 'Unknown Brand';
            allBrands.set(brandName, brandObject.brandInfo || { name: brandName });
            return brandObject.perfumes.map(perfume => ({ ...perfume, brand: brandName, seasons: perfume.seasons || [], occasions: perfume.occasions || [] }));
        });
    } else {
        allPerfumes = rawData.map(p => ({ ...p, brand: p.brand || 'Unknown Brand', seasons: p.seasons || [], occasions: p.occasions || [] }));
        allPerfumes.forEach(p => { if (!allBrands.has(p.brand)) allBrands.set(p.brand, { name: p.brand }); });
    }

    allPerfumes = allPerfumes.filter(p => p && p.code && p.inspiredBy).map(p => ({
        ...p,
        genderAffinity: normalizeGender(p.genderAffinity),
        mainAccords: (p.mainAccords || []).map(a => String(a).toLowerCase()),
        seasons: (p.seasons || []).map(s => String(s).toLowerCase()).filter(Boolean),
        occasions: (p.occasions || []).map(o => String(o).toLowerCase()).filter(Boolean),
        notes: p.notes || { top: [], heart: [], base: [] },
        shobiUrl: p.shobiUrl || `https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`
    }));
}

function displayPerfumes(perfumes) {
    const container = document.getElementById('resultsContainer');
    const template = document.getElementById('perfume-card-template');
    const resultsCountEl = document.getElementById('results-count');
    container.innerHTML = '';
    let countText = `Showing ${perfumes.length}`;
    if (state.selectedBrand) countText += ` result(s) for "${state.selectedBrand}"`;
    else if (state.showingFavorites) countText += ' favorite(s)';
    else countText += ` of ${allPerfumes.length} results`;
    resultsCountEl.textContent = `${countText}.`;
    if (!perfumes.length) { container.innerHTML = '<p class="text-secondary col-span-full">No perfumes matched your selection.</p>'; return; }
    perfumes.forEach(p => {
        const card = template.content.cloneNode(true);
        const isFavorite = state.favorites.includes(p.code);
        card.querySelector('[data-field="code"]').textContent = p.code;
        card.querySelector('[data-field="inspiredBy"]').textContent = p.inspiredBy;
        card.querySelector('[data-field="brand"]').textContent = p.brand;
        card.querySelector('[data-field="description"]').textContent = p.description || '';
        card.querySelector('[data-field="shobiLink"]').href = p.shobiUrl || `https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;
        const favButton = card.querySelector('.favorite-btn');
        favButton.dataset.code = p.code;
        favButton.innerHTML = isFavorite ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        if (isFavorite) favButton.classList.add('is-favorite');
        card.querySelector('[data-field="audience-icons"]').innerHTML = getAudienceIcons(p.genderAffinity);
        card.querySelector('[data-field="type-icons"]').innerHTML = getTypeIcons(p.mainAccords);
        card.querySelector('[data-action="show-details"]').dataset.code = p.code;
        card.querySelector('[data-action="filter-brand"]').dataset.brand = p.brand;
        container.appendChild(card);
    });
    container.querySelectorAll('.favorite-btn').forEach(btn => btn.addEventListener('click', toggleFavorite));
    container.querySelectorAll('[data-action="show-details"]').forEach(el => el.addEventListener('click', e => showPerfumeModal(e.currentTarget.dataset.code)));
    container.querySelectorAll('[data-action="filter-brand"]').forEach(btn => btn.addEventListener('click', e => handleBrandFilterClick(e.currentTarget.dataset.brand)));
}

function getFilteredPerfumes() {
    let filtered = [...allPerfumes];
    if (state.selectedBrand) filtered = filtered.filter(p => p.brand === state.selectedBrand);
    else if (state.activeFilters.brands.length) filtered = filtered.filter(p => state.activeFilters.brands.includes(p.brand));
    else if (state.showingFavorites) filtered = filtered.filter(p => state.favorites.includes(p.code));
    if (state.activeFilters.gender.length) filtered = filtered.filter(p => state.activeFilters.gender.includes(p.genderAffinity));
    if (state.activeFilters.season.length) filtered = filtered.filter(p => state.activeFilters.season.some(season => p.seasons.includes(season)));
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(p => String(p.inspiredBy || '').toLowerCase().includes(query) || String(p.shobiName || '').toLowerCase().includes(query) || String(p.brand || '').toLowerCase().includes(query) || String(p.code || '').toLowerCase().includes(query));
    }
    return filtered;
}

function applyFiltersAndRender() { displayBrandInfo(); displayPerfumes(getFilteredPerfumes()); displayActiveFilterTokens(); }

function displayActiveFilterTokens() {
    const container = document.getElementById('active-filters-display');
    container.innerHTML = '';
    const tokenClasses = { gender: 'token-gender', brands: 'token-brand', season: 'token-season' };
    Object.entries(state.activeFilters).forEach(([type, values]) => values.forEach(value => {
        const token = document.createElement('span');
        token.className = `filter-token ${tokenClasses[type] || ''}`;
        token.innerHTML = `${value.charAt(0).toUpperCase() + value.slice(1)} <button type="button" data-filter-type="${type}" data-filter-value="${value}">&times;</button>`;
        container.appendChild(token);
    }));
    container.style.display = container.children.length ? 'flex' : 'none';
    container.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        const type = button.dataset.filterType, value = button.dataset.filterValue;
        state.activeFilters[type] = state.activeFilters[type].filter(v => v !== value);
        const checkboxName = type === 'brands' ? 'brand' : type;
        const checkbox = [...document.querySelectorAll(`#filter-sidebar input[name="${checkboxName}"]`)].find(cb => cb.value === value);
        if (checkbox) checkbox.checked = false;
        applyFiltersAndRender();
    }));
}

function displayBrandInfo() {
    const container = document.getElementById('brand-info-container');
    const contentEl = document.getElementById('brand-info-content');
    if (!state.selectedBrand) { container.classList.add('hidden'); return; }
    contentEl.innerHTML = `<h2 class="text-2xl font-bold text-primary">${state.selectedBrand}</h2>`;
    container.classList.remove('hidden');
}

function handleBrandFilterClick(brandName) {
    state.selectedBrand = brandName; state.showingFavorites = false; state.activeFilters.brands = [];
    document.querySelectorAll('#brand-filters input[type="checkbox"]').forEach(cb => { cb.checked = false; });
    document.getElementById('favorites-btn').classList.remove('bg-red-800');
    applyFiltersAndRender();
}

function getAudienceIcons(audience) {
    const map = {
        male: '<i class="fas fa-mars text-blue-600" title="Male"></i>',
        female: '<i class="fas fa-venus text-red-600" title="Female"></i>',
        unisex: '<i class="fas fa-venus-mars text-green-600" title="Unisex"></i>'
    };
    return map[audience] || '';
}

const SCENT_ICON_MAP = {
    citrus: '<i class="fas fa-lemon text-yellow-500" title="Citrus"></i>', woody: '<i class="fas fa-tree text-amber-700" title="Woody"></i>', floral: '<i class="fas fa-fan text-pink-400" title="Floral"></i>', aromatic: '<i class="fas fa-seedling text-lime-600" title="Aromatic"></i>', spicy: '<i class="fas fa-pepper-hot text-orange-600" title="Spicy"></i>', amber: '<i class="fas fa-feather text-purple-500" title="Amber"></i>', fresh: '<i class="fas fa-wind text-sky-500" title="Fresh"></i>', aquatic: '<i class="fas fa-water text-cyan-500" title="Aquatic"></i>', leather: '<i class="fas fa-layer-group text-stone-600" title="Leather"></i>'
};
function getTypeIcons(accords) { if (!Array.isArray(accords)) return ''; return accords.map(a => SCENT_ICON_MAP[String(a).toLowerCase()] || '').filter(Boolean).join(' '); }

function toggleFavorite(event) {
    event.stopPropagation(); const code = event.currentTarget.dataset.code; const index = state.favorites.indexOf(code);
    if (index >= 0) state.favorites.splice(index, 1); else state.favorites.push(code);
    localStorage.setItem('shobi-favorites', JSON.stringify(state.favorites)); document.getElementById('favorites-count').textContent = state.favorites.length; applyFiltersAndRender();
}
function loadFavorites() { try { state.favorites = JSON.parse(localStorage.getItem('shobi-favorites') || '[]'); } catch { state.favorites = []; } document.getElementById('favorites-count').textContent = state.favorites.length; }

const modal = document.getElementById('perfume-modal'); const modalContent = document.getElementById('modal-content');
function showPerfumeModal(code) {
    const perfume = allPerfumes.find(p => p.code === code); if (!perfume) return;
    document.getElementById('modal-inspiredBy').textContent = perfume.inspiredBy; document.getElementById('modal-brand').textContent = perfume.brand; document.getElementById('modal-code').textContent = perfume.code; document.getElementById('modal-description').textContent = perfume.description || 'No description available.';
    const notes = document.getElementById('modal-notes'); const parts = [];
    if (perfume.notes.top.length) parts.push(`<p><strong class="text-primary">Top:</strong> ${perfume.notes.top.join(', ')}</p>`); if (perfume.notes.heart.length) parts.push(`<p><strong class="text-primary">Heart:</strong> ${perfume.notes.heart.join(', ')}</p>`); if (perfume.notes.base.length) parts.push(`<p><strong class="text-primary">Base:</strong> ${perfume.notes.base.join(', ')}</p>`); notes.innerHTML = parts.length ? parts.join('') : '<p>No note details available.</p>';
    const boostGuide = document.getElementById('modal-boost-guide'); if (boostGuide) boostGuide.innerHTML = '<p class="text-sm text-secondary">Essence Boost data not available in the current database.</p>';
    document.getElementById('modal-shobiLink').href = perfume.shobiUrl || `https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(perfume.code)}`;
    modal.classList.remove('invisible'); requestAnimationFrame(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('opacity-0', '-translate-y-10'); });
}
function hidePerfumeModal() { modal.classList.add('opacity-0'); modalContent.classList.add('opacity-0', '-translate-y-10'); setTimeout(() => modal.classList.add('invisible'), 300); }

function buildCheckboxes(container, name, values, labels = {}) {
    const sorted = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (!sorted.length) { container.closest('.filter-group')?.classList.add('hidden'); return; }
    container.closest('.filter-group')?.classList.remove('hidden');
    container.innerHTML = sorted.map(value => `<label><input type="checkbox" name="${name}" value="${value}"> ${labels[value] || value.charAt(0).toUpperCase() + value.slice(1)}</label>`).join('');
}

function populateFilters() {
    const genderContainer = document.getElementById('gender-filters'), brandContainer = document.getElementById('brand-filters'), seasonContainer = document.getElementById('season-filters'), occasionContainer = document.getElementById('occasion-filters'), accordContainer = document.getElementById('accord-filters');
    buildCheckboxes(genderContainer, 'gender', ['male', 'female', 'unisex'], { male: 'Male', female: 'Female', unisex: 'Unisex' });
    buildCheckboxes(brandContainer, 'brand', allPerfumes.map(p => p.brand));
    buildCheckboxes(seasonContainer, 'season', allPerfumes.flatMap(p => p.seasons));
    occasionContainer.closest('.filter-group')?.classList.add('hidden'); accordContainer.closest('.filter-group')?.classList.add('hidden');
    document.querySelectorAll('#filter-sidebar input[type="checkbox"]').forEach(checkbox => checkbox.addEventListener('change', e => {
        const type = e.target.name === 'brand' ? 'brands' : e.target.name, value = e.target.value;
        if (e.target.checked) { if (!state.activeFilters[type].includes(value)) state.activeFilters[type].push(value); if (type === 'brands') state.selectedBrand = null; }
        else state.activeFilters[type] = state.activeFilters[type].filter(v => v !== value);
        applyFiltersAndRender();
    }));
}

function resetAllFilters() {
    state.searchQuery = ''; state.showingFavorites = false; state.selectedBrand = null; state.activeFilters = { gender: [], brands: [], season: [] };
    document.getElementById('search-input').value = ''; document.getElementById('favorites-btn').classList.remove('bg-red-800'); document.querySelectorAll('#filter-sidebar input[type="checkbox"]').forEach(cb => { cb.checked = false; }); applyFiltersAndRender();
}
function toggleMobileFilters() { document.getElementById('filters-content').classList.toggle('hidden'); document.getElementById('filters-toggle-icon').classList.toggle('rotate-180'); }
function setTheme(theme) { const html = document.getElementById('html-tag'); if (theme === 'light') { html.removeAttribute('data-theme'); localStorage.removeItem('shobi-theme'); } else { html.setAttribute('data-theme', theme); localStorage.setItem('shobi-theme', theme); } }
function initTheme() { const saved = localStorage.getItem('shobi-theme'); if (saved) setTheme(saved); const button = document.getElementById('theme-menu-btn'), menu = document.getElementById('theme-menu-dropdown'); button.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); }); document.querySelectorAll('.theme-btn').forEach(btn => btn.addEventListener('click', e => { setTheme(e.currentTarget.dataset.theme); menu.classList.add('hidden'); })); window.addEventListener('click', () => menu.classList.add('hidden')); }

async function init() {
    try {
        try { await loadCsvDatabase(); console.log(`Loaded ${allPerfumes.length} perfumes from shobi-master.csv`); }
        catch (csvError) { console.warn('shobi-master.csv not found yet. Using temporary legacy database.', csvError); await loadLegacyDatabase(); }
        loadFavorites(); populateFilters(); applyFiltersAndRender();
    } catch (error) { console.error(error); document.getElementById('results-count').textContent = 'Error: Could not load data.'; }
}

document.addEventListener('DOMContentLoaded', () => {
    init(); initTheme();
    document.getElementById('filters-toggle-btn').addEventListener('click', toggleMobileFilters);
    document.getElementById('reset-all-filters-btn-desktop').addEventListener('click', resetAllFilters);
    document.getElementById('reset-all-filters-btn-mobile').addEventListener('click', resetAllFilters);
    document.getElementById('search-input').addEventListener('input', e => { state.searchQuery = e.target.value.trim(); applyFiltersAndRender(); });
    document.getElementById('favorites-btn').addEventListener('click', () => { state.showingFavorites = !state.showingFavorites; state.selectedBrand = null; document.getElementById('favorites-btn').classList.toggle('bg-red-800', state.showingFavorites); applyFiltersAndRender(); });
    document.getElementById('clear-brand-filter').addEventListener('click', () => { state.selectedBrand = null; applyFiltersAndRender(); });
    document.getElementById('modal-close-btn').addEventListener('click', hidePerfumeModal); document.getElementById('modal-overlay').addEventListener('click', hidePerfumeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('invisible')) hidePerfumeModal(); });
});