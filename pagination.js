// Lightweight pagination layer for Shobi Perfume Inspiration.
// Keeps filtering/searching on the full dataset while rendering only one page at a time.

state.currentPage = 1;
state.pageSize = 50;

function buildPaginationUi() {
    const resultsCountEl = document.getElementById('results-count');
    const resultsContainer = document.getElementById('resultsContainer');
    if (!resultsCountEl || !resultsContainer) return;

    if (!document.getElementById('results-toolbar')) {
        const toolbar = document.createElement('div');
        toolbar.id = 'results-toolbar';
        toolbar.className = 'mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';

        resultsCountEl.classList.remove('mb-4');
        resultsCountEl.parentNode.insertBefore(toolbar, resultsCountEl);
        toolbar.appendChild(resultsCountEl);

        const sizeControl = document.createElement('label');
        sizeControl.className = 'flex items-center gap-2 text-sm text-secondary';
        sizeControl.innerHTML = `
            <span>Per page</span>
            <select id="page-size-select" class="border-base rounded-md bg-surface text-primary px-3 py-2 focus-ring">
                <option value="50" selected>50</option>
                <option value="75">75</option>
                <option value="100">100</option>
            </select>
        `;
        toolbar.appendChild(sizeControl);

        sizeControl.querySelector('#page-size-select').addEventListener('change', event => {
            state.pageSize = Number(event.target.value) || 50;
            state.currentPage = 1;
            applyFiltersAndRender();
        });
    }

    if (!document.getElementById('pagination-controls')) {
        const controls = document.createElement('nav');
        controls.id = 'pagination-controls';
        controls.className = 'mt-8 flex flex-wrap items-center justify-center gap-2';
        controls.setAttribute('aria-label', 'Perfume result pages');
        resultsContainer.insertAdjacentElement('afterend', controls);
    }
}

function getPageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('ellipsis-start');
    for (let page = start; page <= end; page++) pages.push(page);
    if (end < totalPages - 1) pages.push('ellipsis-end');

    pages.push(totalPages);
    return pages;
}

function renderPaginationControls(totalResults) {
    buildPaginationUi();

    const controls = document.getElementById('pagination-controls');
    if (!controls) return;

    const totalPages = Math.max(1, Math.ceil(totalResults / state.pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

    if (totalResults <= state.pageSize) {
        controls.innerHTML = '';
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');
    controls.innerHTML = '';

    const buttonBase = 'min-w-10 px-3 py-2 rounded-md border border-base bg-surface text-secondary text-sm hover:bg-base disabled:opacity-40 disabled:cursor-not-allowed';

    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = buttonBase;
    previous.textContent = 'Previous';
    previous.disabled = state.currentPage === 1;
    previous.addEventListener('click', () => {
        if (state.currentPage <= 1) return;
        state.currentPage -= 1;
        applyFiltersAndRender();
        document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    controls.appendChild(previous);

    getPageNumbers(state.currentPage, totalPages).forEach(page => {
        if (typeof page !== 'number') {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'px-1 text-tertiary';
            ellipsis.textContent = '…';
            controls.appendChild(ellipsis);
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${buttonBase}${page === state.currentPage ? ' font-bold bg-blue-600 text-white border-transparent' : ''}`;
        button.textContent = String(page);
        button.setAttribute('aria-current', page === state.currentPage ? 'page' : 'false');
        button.addEventListener('click', () => {
            state.currentPage = page;
            applyFiltersAndRender();
            document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        controls.appendChild(button);
    });

    const next = document.createElement('button');
    next.type = 'button';
    next.className = buttonBase;
    next.textContent = 'Next';
    next.disabled = state.currentPage === totalPages;
    next.addEventListener('click', () => {
        if (state.currentPage >= totalPages) return;
        state.currentPage += 1;
        applyFiltersAndRender();
        document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    controls.appendChild(next);
}

function displayPerfumes(perfumes) {
    buildPaginationUi();

    const container = document.getElementById('resultsContainer');
    const template = document.getElementById('perfume-card-template');
    const resultsCountEl = document.getElementById('results-count');

    container.innerHTML = '';

    const totalResults = perfumes.length;
    const totalPages = Math.max(1, Math.ceil(totalResults / state.pageSize));
    state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

    const startIndex = totalResults ? (state.currentPage - 1) * state.pageSize : 0;
    const endIndex = Math.min(startIndex + state.pageSize, totalResults);
    const pagePerfumes = perfumes.slice(startIndex, endIndex);

    let countText = totalResults
        ? `Showing ${startIndex + 1}–${endIndex} of ${totalResults}`
        : 'Showing 0';

    if (state.selectedBrand) {
        countText += ` result(s) for "${state.selectedBrand}"`;
    } else if (state.showingFavorites) {
        countText += ' favorite(s)';
    } else {
        countText += ' results';
    }
    resultsCountEl.textContent = `${countText}.`;

    if (totalResults === 0) {
        container.innerHTML = '<p class="text-secondary col-span-full">No perfumes matched your selection.</p>';
        renderPaginationControls(0);
        return;
    }

    pagePerfumes.forEach(p => {
        const card = template.content.cloneNode(true);
        const isFavorite = state.favorites.includes(p.code);

        card.querySelector('[data-field="code"]').textContent = p.code;
        card.querySelector('[data-field="inspiredBy"]').textContent = p.inspiredBy;
        card.querySelector('[data-field="brand"]').textContent = p.brand;
        card.querySelector('[data-field="description"]').textContent = p.description || '';

        card.querySelector('[data-field="shobiLink"]').href =
            p.shobiUrl || `https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;

        const favButton = card.querySelector('.favorite-btn');
        favButton.dataset.code = p.code;
        favButton.innerHTML = isFavorite
            ? '<i class="fa-solid fa-heart"></i>'
            : '<i class="fa-regular fa-heart"></i>';
        if (isFavorite) favButton.classList.add('is-favorite');

        card.querySelector('[data-field="audience-icons"]').innerHTML = getAudienceIcons(p.genderAffinity);
        card.querySelector('[data-field="type-icons"]').innerHTML = getTypeIcons(p.mainAccords);

        card.querySelector('[data-action="show-details"]').dataset.code = p.code;
        card.querySelector('[data-action="filter-brand"]').dataset.brand = p.brand;

        container.appendChild(card);
    });

    container.querySelectorAll('.favorite-btn').forEach(btn =>
        btn.addEventListener('click', toggleFavorite)
    );

    container.querySelectorAll('[data-action="show-details"]').forEach(el =>
        el.addEventListener('click', e => showPerfumeModal(e.currentTarget.dataset.code))
    );

    container.querySelectorAll('[data-action="filter-brand"]').forEach(btn =>
        btn.addEventListener('click', e => handleBrandFilterClick(e.currentTarget.dataset.brand))
    );

    renderPaginationControls(totalResults);
}

function applyFiltersAndRender() {
    displayBrandInfo();
    displayPerfumes(getFilteredPerfumes());
    displayActiveFilterTokens();
}

function resetPaginationToFirstPage() {
    state.currentPage = 1;
}

document.addEventListener('DOMContentLoaded', () => {
    buildPaginationUi();

    document.getElementById('search-input')?.addEventListener('input', resetPaginationToFirstPage, true);
    document.getElementById('filter-sidebar')?.addEventListener('change', resetPaginationToFirstPage, true);
    document.getElementById('favorites-btn')?.addEventListener('click', resetPaginationToFirstPage, true);
    document.getElementById('clear-brand-filter')?.addEventListener('click', resetPaginationToFirstPage, true);
    document.getElementById('reset-all-filters-btn-desktop')?.addEventListener('click', resetPaginationToFirstPage, true);
    document.getElementById('reset-all-filters-btn-mobile')?.addEventListener('click', resetPaginationToFirstPage, true);

    document.getElementById('resultsContainer')?.addEventListener('click', event => {
        if (event.target.closest('[data-action="filter-brand"]')) resetPaginationToFirstPage();
    }, true);
});
