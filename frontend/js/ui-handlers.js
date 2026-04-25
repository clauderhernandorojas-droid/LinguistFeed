// Delegación de eventos para level buttons en Reader y Topics
(function () {
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.level-btn');
    if (!btn) return;

    // Encontrar el contenedor de la tarjeta donde están los botones
    const card = btn.closest('.card') || btn.closest('.topic-card') || btn.closest('.article-card');
    if (!card) return;

    // Desactivar todos los level-btn dentro de la misma tarjeta
    const siblings = card.querySelectorAll('.level-btn');
    siblings.forEach(s => s.classList.remove('active'));

    // Activar el clicado
    btn.classList.add('active');

    // Lógica adicional: disparar evento o llamar función existente si aplica
    const selectedLevel = btn.dataset.level || (btn.textContent && btn.textContent.trim()) || '';
    // Emitir evento custom para que la app lo capture si tiene listeners
    const ev = new CustomEvent('level:selected', { detail: { level: selectedLevel, cardId: card.dataset.id || null } });
    document.dispatchEvent(ev);

    // Si existe función global para aplicar selección, llamarla
    if (typeof window.applyLevelSelection === 'function') {
      try { window.applyLevelSelection(selectedLevel, card); } catch (err) { /* no bloquear */ }
    }
  });
})();
