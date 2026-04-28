/**
 * Monta el navbar en el primer `nav.navbar` (innerHTML).
 * @param {'student' | 'teacher'} role
 * @param {string} basePath Prefijo ('' desde la raíz del frontend, '../../' desde features/teacher/)
 */
export function mountNavbar(role, basePath) {
  const nav = document.querySelector('nav.navbar');
  if (!nav) return;

  const p = (path) => `${basePath}${path}`;

  const teacherExtra =
    role === 'teacher'
      ? `<li class="nav-item"><a href="${p('features/teacher/teacher.html')}" class="nav-link">Teacher Portal</a></li>`
      : '';

  nav.innerHTML = `
        <div class="container">
            <a href="${p('dashboard.html')}" class="navbar-brand">LinguistFeed</a>
            <ul class="navbar-nav">
                <li class="nav-item"><a href="${p('dashboard.html')}" class="nav-link">Dashboard</a></li>
                <li class="nav-item"><a href="${p('topics.html')}" class="nav-link" id="topics-link">Topics</a></li>
                <li class="nav-item"><a href="${p('my-flashcards.html')}" class="nav-link">My Flashcards</a></li>
                ${teacherExtra}
                <li class="nav-item"><a href="#" id="logout-link" class="nav-link">Logout</a></li>
            </ul>
        </div>
    `;

  const topicsLink = nav.querySelector('#topics-link');
  if (topicsLink) {
    topicsLink.addEventListener('click', () => {
      try {
        localStorage.removeItem('selectedTopic');
        localStorage.removeItem('selectedArticleId');
      } catch (_) {
        /* ignore */
      }
    });
  }
}

/**
 * Monta el navbar según el rol guardado en sesión.
 * Si el usuario es teacher/admin, muestra acceso a Teacher Portal.
 * @param {string} basePath
 */
export function mountNavbarForCurrentUser(basePath) {
  let role = 'student';
  try {
    const raw = localStorage.getItem('linguistfeed_user');
    if (raw) {
      const user = JSON.parse(raw);
      const r = String(user?.role || '').toLowerCase();
      if (r === 'teacher' || r === 'admin') {
        role = 'teacher';
      }
    }
  } catch (_) {
    // Fallback a student si hay JSON inválido.
  }
  mountNavbar(role, basePath);
}
