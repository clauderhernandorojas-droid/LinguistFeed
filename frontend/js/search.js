// frontend/js/search.js
/**
 * initSearch(searchBarId, listSelectors, itemSelector)
 * - Lee h3, strong y p dentro de cada tarjeta; solo cambia style.display.
 * - Idempotente: evita duplicar listeners usando data-lf-search-bound.
 */
(function () {
  function initSearch(searchBarId, listSelectors = [], itemSelector) {
    const input = document.getElementById(searchBarId);
    if (!input) return;

    if (input.dataset.lfSearchBound === '1') {
      input.dispatchEvent(new Event('input'));
      return;
    }
    input.dataset.lfSearchBound = '1';

    function getAllItems() {
      const items = [];
      listSelectors.forEach((sel) => {
        const container = document.querySelector(sel);
        if (!container) return;
        container.querySelectorAll(itemSelector).forEach((it) => items.push(it));
      });
      return items;
    }

    function applyFilter() {
      const q = (input.value || '').trim().toLowerCase();
      const items = getAllItems();

      items.forEach((item) => {
        const h3 = (item.querySelector('h3')?.textContent || '').toLowerCase();
        const strong = (item.querySelector('strong')?.textContent || '').toLowerCase();
        const preview = (item.querySelector('p')?.textContent || '').toLowerCase();
        const combined = `${h3} ${strong} ${preview}`.trim();

        if (!q || combined.includes(q)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    }

    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(applyFilter, 120);
    });

    applyFilter();
  }

  window.initSearch = initSearch;
})();
