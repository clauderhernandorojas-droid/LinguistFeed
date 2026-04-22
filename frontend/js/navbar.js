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
      ? `<li class="nav-item"><a href="${p('upload.html')}" class="nav-link">Teacher Portal</a></li>`
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
