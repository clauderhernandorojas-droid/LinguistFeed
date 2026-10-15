import { API_BASE_URL } from './config.js';

/**
 * Extrae la información y rol del usuario actual desde localStorage o payload JWT.
 */
function getAuthUserInfo() {
  let user = null;
  let role = 'student';

  // 1. Intentar leer desde 'linguistfeed_user' o 'user'
  try {
    const raw = localStorage.getItem('linguistfeed_user') || localStorage.getItem('user');
    if (raw) {
      user = JSON.parse(raw);
      if (user?.role) {
        role = String(user.role).toLowerCase();
      }
    }
  } catch (_) {}

  // 2. Extraer o complementar desde el JWT en 'token'
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        if (decoded?.role) {
          role = String(decoded.role).toLowerCase();
        }
        if (!user && decoded) {
          user = decoded;
        }
      }
    }
  } catch (_) {}

  return { user, role };
}

function escHtml(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

/**
 * Monta el navbar en el primer `nav.navbar` (innerHTML).
 * @param {string} [basePathOrRole=''] Prefijo de rutas o rol legacy
 * @param {string} [secondParam='']
 */
export function mountNavbar(basePathOrRole = '', secondParam = '') {
  const nav = document.querySelector('nav.navbar');
  if (!nav) return;

  // Manejar retrocompatibilidad si se llamaba como mountNavbar('teacher', '../../')
  let basePath = basePathOrRole;
  if (basePathOrRole === 'teacher' || basePathOrRole === 'student' || basePathOrRole === 'admin') {
    basePath = secondParam || '';
  }

  const { user, role: detectedRole } = getAuthUserInfo();
  // El rol de la sesión autenticada manda
  const effectiveRole = (detectedRole || 'student').toLowerCase();
  const p = (path) => `${basePath}${path}`;

  // 1. Control de acceso: Teacher Portal SOLO se renderiza si es teacher o admin.
  // Si es student, NO se agrega al DOM.
  const isTeacherOrAdmin = effectiveRole === 'teacher' || effectiveRole === 'admin';
  const teacherExtra = isTeacherOrAdmin
    ? `<li class="nav-item"><a href="${p('features/teacher/teacher.html')}" class="nav-link" id="teacher-portal-link">Teacher Portal</a></li>`
    : '';

  // 2. Configuración de texto e ícono de cada rol
  let badgeLabel = '🎓 Estudiante';
  let badgeClass = 'role-student';

  if (effectiveRole === 'teacher') {
    badgeLabel = '👨‍🏫 Profesor';
    badgeClass = 'role-teacher';
  } else if (effectiveRole === 'admin') {
    badgeLabel = '⚡ Admin';
    badgeClass = 'role-admin';
  }

  // Nombre del usuario para mostrar junto al badge
  const userDisplayName = user?.username || (user?.email ? user.email.split('@')[0] : '');

  // Detección de entorno local/dev para switcher interactivo
  const isDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port !== '';

  const tooltipAttr = isDev
    ? 'title="Modo Dev: Haz clic para cambiar tu rol de prueba"'
    : '';
  const devClickClass = isDev ? 'dev-clickable' : '';

  nav.innerHTML = `
        <div class="container">
            <a href="${p('dashboard.html')}" class="navbar-brand">LinguistFeed</a>
            <ul class="navbar-nav">
                <li class="nav-item"><a href="${p('dashboard.html')}" class="nav-link">Dashboard</a></li>
                <li class="nav-item"><a href="${p('topics.html')}" class="nav-link" id="topics-link">Topics</a></li>
                <li class="nav-item"><a href="${p('my-flashcards.html')}" class="nav-link">My Flashcards</a></li>
                ${teacherExtra}
                <li class="nav-item nav-user-info" id="nav-role-container">
                    ${userDisplayName ? `<span class="nav-username">👤 ${escHtml(userDisplayName)}</span>` : ''}
                    <span class="user-role-badge ${badgeClass} ${devClickClass}" id="navbar-role-badge" ${tooltipAttr}>
                        ${badgeLabel}
                    </span>
                    <div class="dev-role-menu" id="dev-role-menu" style="display: none;">
                        <div class="dev-role-menu-header">🔧 Rol Activo (Dev)</div>
                        <button type="button" class="dev-role-btn ${effectiveRole === 'student' ? 'active' : ''}" data-target-role="student">
                            🎓 Estudiante
                        </button>
                        <button type="button" class="dev-role-btn ${effectiveRole === 'teacher' ? 'active' : ''}" data-target-role="teacher">
                            👨‍🏫 Profesor
                        </button>
                        <button type="button" class="dev-role-btn ${effectiveRole === 'admin' ? 'active' : ''}" data-target-role="admin">
                            ⚡ Admin
                        </button>
                    </div>
                </li>
                <li class="nav-item"><a href="#" id="logout-link" class="nav-link">Logout</a></li>
            </ul>
        </div>
    `;

  // Listener para Topics (reset de contexto)
  const topicsLink = nav.querySelector('#topics-link');
  if (topicsLink) {
    topicsLink.addEventListener('click', () => {
      try {
        localStorage.removeItem('selectedTopic');
        localStorage.removeItem('selectedArticleId');
      } catch (_) {}
    });
  }

  // Listener para Logout
  const logoutLink = nav.querySelector('#logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('linguistfeed_user');
        localStorage.removeItem('user');
      } catch (_) {}
      window.location.href = p('login.html');
    });
  }

  // Menú Dev para cambiar de rol rápidamente si estamos en desarrollo
  if (isDev) {
    setupDevRoleSwitcher(user, effectiveRole, basePath);
  }
}

/**
 * Configura la lógica interactiva del menú para alternar rol en desarrollo.
 */
function setupDevRoleSwitcher(currentUser, currentRole, basePath) {
  const badge = document.getElementById('navbar-role-badge');
  const menu = document.getElementById('dev-role-menu');
  const container = document.getElementById('nav-role-container');
  if (!badge || !menu || !container) return;

  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.style.display === 'none';
    menu.style.display = isHidden ? 'flex' : 'none';
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  const buttons = menu.querySelectorAll('.dev-role-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const targetRole = btn.getAttribute('data-target-role');
      if (!targetRole || targetRole === currentRole) {
        menu.style.display = 'none';
        return;
      }

      btn.textContent = `⏳ Cambiando...`;
      btn.style.opacity = '0.7';

      try {
        const userId = currentUser?.id || currentUser?.userId;
        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        // 1. Intentar actualizar en backend SQLite (ruta relativa /api/users/:id/role)
        if (userId) {
          try {
            const res = await fetch(`/api/users/${userId}/role`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({ role: targetRole })
            }).catch(() => null);

            if (res && res.ok) {
              const data = await res.json();
              if (data.token) {
                localStorage.setItem('token', data.token);
              }
              if (data.user) {
                localStorage.setItem('linguistfeed_user', JSON.stringify(data.user));
              }
            } else if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) {
              // Fallback si la ruta relativa devolvió error
              const fallbackRes = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ role: targetRole })
              }).catch(() => null);

              if (fallbackRes && fallbackRes.ok) {
                const data = await fallbackRes.json();
                if (data.token) localStorage.setItem('token', data.token);
                if (data.user) localStorage.setItem('linguistfeed_user', JSON.stringify(data.user));
              }
            }
          } catch (netErr) {
            console.warn('⚠️ No se pudo persistir en backend, actualizando sesión local:', netErr);
          }
        }

        // 2. Asegurar actualización en localStorage
        const storedUser = JSON.parse(
          localStorage.getItem('linguistfeed_user') || localStorage.getItem('user') || '{}'
        );
        storedUser.role = targetRole;
        localStorage.setItem('linguistfeed_user', JSON.stringify(storedUser));
        localStorage.setItem('user', JSON.stringify(storedUser));

        menu.style.display = 'none';

        // 3. Recargar para refrescar vistas dependientes del rol
        window.location.reload();
      } catch (err) {
        console.error('Error al cambiar rol en dev:', err);
        menu.style.display = 'none';
      }
    });
  });
}

/**
 * Monta el navbar según el rol guardado en sesión.
 * Si el usuario es teacher/admin, muestra acceso a Teacher Portal.
 * @param {string} [basePath='']
 */
export function mountNavbarForCurrentUser(basePath = '') {
  const { role } = getAuthUserInfo();
  mountNavbar(role, basePath);
}
