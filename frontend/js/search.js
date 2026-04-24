/**
 * Inicializa filtrado por texto en una o más listas.
 * Expuesta como window.initSearch para usarla desde script clásico en el HTML.
 *
 * @param {string} searchBarId - id del input de búsqueda
 * @param {string[]} listSelectors - selectores de contenedores (ej. '#favorites-grid')
 * @param {string} itemSelector - selector de cada ítem (ej. '.topic-card')
 */
function initSearch(searchBarId, listSelectors, itemSelector) {
  const bar = document.getElementById(searchBarId);
  if (!bar) return;

  const applyFilter = () => {
    const q = (bar.value || '').trim().toLowerCase();
    listSelectors.forEach((sel) => {
      const root = document.querySelector(sel);
      if (!root) return;
      root.querySelectorAll(itemSelector).forEach((el) => {
        const text = (el.textContent || '').toLowerCase();
        el.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });
  };

  bar.addEventListener('input', applyFilter);
  applyFilter();
}

window.initSearch = initSearch;
