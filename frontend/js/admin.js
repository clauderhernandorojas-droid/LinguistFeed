import { API_BASE_URL } from './config.js';
import { mountNavbar } from './navbar.js';

let allUsers = [];
let currentAdminId = null;

function escHtml(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function getAuthUser() {
  try {
    const raw = localStorage.getItem('linguistfeed_user') || localStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}

  try {
    const token = localStorage.getItem('token');
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
          atob(b64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(json);
      }
    }
  } catch (_) {}

  return null;
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
  return fetch(url, { ...options, headers });
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `admin-toast ${type} show`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.className = 'admin-toast';
  }, 3500);
}

function updateStats(users) {
  const totalEl = document.getElementById('stat-total-users');
  const studentsEl = document.getElementById('stat-students');
  const teachersEl = document.getElementById('stat-teachers');
  const adminsEl = document.getElementById('stat-admins');

  let students = 0;
  let teachers = 0;
  let admins = 0;

  users.forEach((u) => {
    const role = String(u.role || 'student').toLowerCase();
    if (role === 'admin') admins++;
    else if (role === 'teacher') teachers++;
    else students++;
  });

  if (totalEl) totalEl.textContent = users.length;
  if (studentsEl) studentsEl.textContent = students;
  if (teachersEl) teachersEl.textContent = teachers;
  if (adminsEl) adminsEl.textContent = admins;
}

function renderUsersTable(usersToRender) {
  const tbody = document.getElementById('admin-users-tbody');
  const countBadge = document.getElementById('results-count-badge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.textContent = `${usersToRender.length} ${usersToRender.length === 1 ? 'usuario' : 'usuarios'}`;
  }

  if (usersToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-empty-cell">
          <div class="admin-empty-state">
            <span style="font-size: 2rem;">🔍</span>
            <p style="margin: 8px 0 0; font-weight: 600; color: #f8fafc;">No se encontraron usuarios</p>
            <small style="color: #94a3b8;">Prueba cambiando el criterio de búsqueda o el filtro de rol.</small>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = usersToRender
    .map((u) => {
      const isSelf = currentAdminId && Number(u.id) === Number(currentAdminId);
      const role = String(u.role || 'student').toLowerCase();
      const level = (u.level || 'B1').toUpperCase();
      const initials = (u.username || 'U').slice(0, 2).toUpperCase();
      const joined = u.created_at
        ? new Date(u.created_at).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })
        : 'Reciente';

      const levelChipClass = `level-${level.toLowerCase()}`;

      return `
        <tr id="user-row-${u.id}" class="admin-user-row">
          <td class="col-id">
            <span class="user-id-badge">#${u.id}</span>
          </td>
          <td class="col-name">
            <div class="user-profile-cell">
              <div class="user-avatar-circle">${escHtml(initials)}</div>
              <div>
                <strong class="user-name-text">${escHtml(u.username)}</strong>
                ${isSelf ? '<span class="self-badge">Tú (Actual)</span>' : ''}
              </div>
            </div>
          </td>
          <td class="col-email">
            <span class="user-email-text">${escHtml(u.email || 'Sin correo')}</span>
          </td>
          <td class="col-role">
            <select class="admin-role-select role-${role}" data-user-id="${u.id}" title="Cambiar rol">
              <option value="student" ${role === 'student' ? 'selected' : ''}>🎓 Estudiante</option>
              <option value="teacher" ${role === 'teacher' ? 'selected' : ''}>👨‍🏫 Profesor</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>⚡ Admin</option>
            </select>
          </td>
          <td class="col-level">
            <span class="level-chip ${levelChipClass}">${escHtml(level)}</span>
          </td>
          <td class="col-date">
            <span class="user-date-text">📅 ${escHtml(joined)}</span>
          </td>
          <td class="col-actions">
            <div class="user-actions-cluster">
              <button type="button" class="btn btn-sm btn-outline-secondary btn-edit-user" data-id="${u.id}" data-user-id="${u.id}" title="Editar datos y contraseña">
                ✏️ Editar
              </button>
              ${
                isSelf
                  ? `<button type="button" class="btn-delete-disabled" title="No puedes eliminar tu propia cuenta" disabled>
                       🔒 Protegido
                     </button>`
                  : `<button type="button" class="btn-delete-user" data-user-id="${u.id}" data-username="${escHtml(u.username)}" title="Eliminar usuario permanentemente">
                       🗑️ Eliminar
                     </button>`
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  attachRowListeners();
}

function attachRowListeners() {
  // 1. Selector rápido de roles
  document.querySelectorAll('.admin-role-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const userId = e.target.getAttribute('data-user-id');
      const newRole = e.target.value;
      const prevRole = e.target.getAttribute('data-prev-role') || 'student';

      e.target.disabled = true;

      try {
        const res = await apiFetch(`/users/${userId}/role`, {
          method: 'PUT',
          body: JSON.stringify({ role: newRole })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'No se pudo actualizar el rol');
        }

        const data = await res.json();

        // Actualizar en memoria local
        const userObj = allUsers.find((u) => String(u.id) === String(userId));
        if (userObj) {
          userObj.role = newRole;
        }

        // Si es el usuario actual, actualizar localStorage
        if (currentAdminId && Number(userId) === Number(currentAdminId)) {
          if (data.token) localStorage.setItem('token', data.token);
          if (data.user) localStorage.setItem('linguistfeed_user', JSON.stringify(data.user));
        }

        e.target.className = `admin-role-select role-${newRole}`;
        e.target.setAttribute('data-prev-role', newRole);
        updateStats(allUsers);
        showToast(`Rol de usuario actualizado a "${newRole}" con éxito`, 'success');
      } catch (err) {
        console.error('Error al cambiar rol:', err);
        e.target.value = prevRole;
        showToast(`❌ Error: ${err.message}`, 'error');
      } finally {
        e.target.disabled = false;
      }
    });

    // Guardar rol previo para rollback si falla
    select.setAttribute('data-prev-role', select.value);
  });

  // 2. Botón editar usuario
  document.querySelectorAll('.btn-edit-user').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id') || btn.getAttribute('data-user-id');
      openEditUserModal(userId);
    });
  });

  // 3. Botón eliminar
  document.querySelectorAll('.btn-delete-user').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-user-id');
      const username = btn.getAttribute('data-username');
      openDeleteModal(userId, username);
    });
  });
}

function filterAndRender() {
  const searchInput = document.getElementById('admin-search-input');
  const roleFilter = document.getElementById('admin-role-filter');

  const query = (searchInput?.value || '').trim().toLowerCase();
  const selectedRole = roleFilter?.value || 'all';

  let filtered = allUsers;

  if (selectedRole !== 'all') {
    filtered = filtered.filter(
      (u) => String(u.role || 'student').toLowerCase() === selectedRole
    );
  }

  if (query) {
    filtered = filtered.filter((u) => {
      const name = String(u.username || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const id = String(u.id || '');
      return name.includes(query) || email.includes(query) || id === query;
    });
  }

  renderUsersTable(filtered);
}

// Modal de confirmación de eliminación
let pendingDeleteUserId = null;

function openDeleteModal(userId, username) {
  pendingDeleteUserId = userId;
  const modal = document.getElementById('delete-confirm-modal');
  const userText = document.getElementById('delete-modal-user-target');
  const statusEl = document.getElementById('delete-modal-status');
  const confirmBtn = document.getElementById('btn-confirm-delete');

  if (userText) userText.textContent = `${username} (ID: #${userId})`;
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = '';
  }
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Sí, Eliminar Usuario';
  }
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-confirm-modal');
  if (modal) modal.style.display = 'none';
  pendingDeleteUserId = null;
}

async function executeUserDeletion() {
  if (!pendingDeleteUserId) return;
  const confirmBtn = document.getElementById('btn-confirm-delete');
  const statusEl = document.getElementById('delete-modal-status');

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '⏳ Eliminando en cascada...';
  }
  if (statusEl) {
    statusEl.textContent = 'Borrando registros vinculados en la base de datos...';
    statusEl.className = 'status-info';
  }

  try {
    const res = await apiFetch(`/users/${pendingDeleteUserId}`, {
      method: 'DELETE'
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Error al eliminar usuario');
    }

    const deletedId = pendingDeleteUserId;

    // Eliminar de allUsers
    allUsers = allUsers.filter((u) => String(u.id) !== String(deletedId));
    updateStats(allUsers);

    // Animación suave de salida en la fila
    const row = document.getElementById(`user-row-${deletedId}`);
    if (row) {
      row.style.transition = 'all 0.3s ease';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';
      setTimeout(() => {
        row.remove();
        filterAndRender();
      }, 300);
    } else {
      filterAndRender();
    }

    closeDeleteModal();
    showToast(data.message || `Usuario #${deletedId} eliminado exitosamente`, 'success');
  } catch (err) {
    console.error('Error eliminando usuario:', err);
    if (statusEl) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = 'status-error';
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Reintentar Eliminación';
    }
  }
}

async function fetchUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-empty-cell">
          <div class="admin-loading-state">
            <div class="admin-spinner"></div>
            <p style="margin: 10px 0 0; color: #94a3b8;">Cargando usuarios desde la base de datos...</p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await apiFetch('/users');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener usuarios');
    }

    const data = await res.json();
    allUsers = Array.isArray(data) ? data : [];
    updateStats(allUsers);
    filterAndRender();
  } catch (err) {
    console.error('Error fetching users:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="admin-empty-cell">
            <div class="admin-empty-state">
              <span style="font-size: 2rem;">⚠️</span>
              <p style="margin: 8px 0 0; color: #f87171; font-weight: 600;">Error al cargar usuarios</p>
              <small style="color: #94a3b8;">${escHtml(err.message)}</small>
            </div>
          </td>
        </tr>
      `;
    }
    showToast(`❌ Error: ${err.message}`, 'error');
  }
}

// Modal de creación de nuevo usuario
function openCreateUserModal() {
  const modal = document.getElementById('create-user-modal');
  const form = document.getElementById('create-user-form');
  const statusEl = document.getElementById('create-user-modal-status');
  const submitBtn = document.getElementById('btn-confirm-create-user');
  const levelGroup = document.getElementById('group-new-user-level');
  const roleSelect = document.getElementById('new-user-role');

  if (form) form.reset();
  if (roleSelect) roleSelect.value = 'student';
  if (levelGroup) levelGroup.style.display = 'block';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = '';
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Crear Usuario';
  }
  if (modal) modal.style.display = 'flex';

  setTimeout(() => {
    const nameInput = document.getElementById('new-user-name');
    if (nameInput) nameInput.focus();
  }, 100);
}

function closeCreateUserModal() {
  const modal = document.getElementById('create-user-modal');
  if (modal) modal.style.display = 'none';
}

async function handleCreateUserSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('new-user-name');
  const emailInput = document.getElementById('new-user-email');
  const roleSelect = document.getElementById('new-user-role');
  const levelSelect = document.getElementById('new-user-level');
  const passwordInput = document.getElementById('new-user-password');
  const statusEl = document.getElementById('create-user-modal-status');
  const submitBtn = document.getElementById('btn-confirm-create-user');

  const username = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : 'student';
  const level = levelSelect ? levelSelect.value : 'B1';
  const password = passwordInput && passwordInput.value.trim() ? passwordInput.value.trim() : undefined;

  if (!username || !email) {
    if (statusEl) {
      statusEl.textContent = '⚠️ Nombre y correo electrónico son obligatorios.';
      statusEl.className = 'status-error';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Creando usuario...';
  }
  if (statusEl) {
    statusEl.textContent = 'Guardando usuario en la base de datos...';
    statusEl.className = 'status-info';
  }

  try {
    const res = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        email,
        role,
        level: role === 'student' ? level : 'B1',
        password
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Error al crear usuario');
    }

    if (data.user) {
      allUsers.unshift(data.user);
    } else {
      await fetchUsers();
      closeCreateUserModal();
      showToast(`Usuario "${username}" creado exitosamente`, 'success');
      return;
    }

    updateStats(allUsers);
    filterAndRender();
    closeCreateUserModal();
    showToast(`Usuario "${username}" creado exitosamente`, 'success');
  } catch (err) {
    console.error('Error creando usuario:', err);
    if (statusEl) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = 'status-error';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear Usuario';
    }
  }
}

// Modal de edición de usuario y reseteo de contraseña
function openEditUserModal(userId) {
  const user = allUsers.find((u) => String(u.id) === String(userId));
  if (!user) {
    showToast('⚠️ No se encontró la información del usuario', 'error');
    return;
  }

  const modal = document.getElementById('edit-user-modal');
  const form = document.getElementById('edit-user-form');
  const idInput = document.getElementById('edit-user-id');
  const nameInput = document.getElementById('edit-user-name');
  const emailInput = document.getElementById('edit-user-email');
  const roleSelect = document.getElementById('edit-user-role');
  const levelSelect = document.getElementById('edit-user-level');
  const passInput = document.getElementById('edit-user-password');
  const statusEl = document.getElementById('edit-user-modal-status');
  const submitBtn = document.getElementById('btn-confirm-edit-user');

  if (form) form.reset();
  if (idInput) idInput.value = user.id;
  if (nameInput) nameInput.value = user.username || '';
  if (emailInput) emailInput.value = user.email || '';
  if (roleSelect) roleSelect.value = String(user.role || 'student').toLowerCase();
  if (levelSelect) levelSelect.value = String(user.level || 'B1').toUpperCase();
  if (passInput) passInput.value = '';

  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = '';
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar Cambios';
  }

  if (modal) modal.style.display = 'flex';
  setTimeout(() => nameInput?.focus(), 100);
}

function closeEditUserModal() {
  const modal = document.getElementById('edit-user-modal');
  if (modal) modal.style.display = 'none';
}

async function handleEditUserSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById('edit-user-id');
  const nameInput = document.getElementById('edit-user-name');
  const emailInput = document.getElementById('edit-user-email');
  const roleSelect = document.getElementById('edit-user-role');
  const levelSelect = document.getElementById('edit-user-level');
  const passInput = document.getElementById('edit-user-password');
  const statusEl = document.getElementById('edit-user-modal-status');
  const submitBtn = document.getElementById('btn-confirm-edit-user');

  const userId = idInput ? idInput.value : null;
  if (!userId) return;

  const username = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : 'student';
  const level = levelSelect ? levelSelect.value : 'B1';
  const rawPass = passInput ? passInput.value.trim() : '';

  if (!username || !email) {
    if (statusEl) {
      statusEl.textContent = '⚠️ Nombre y correo electrónico son obligatorios.';
      statusEl.className = 'status-error';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando cambios...';
  }
  if (statusEl) {
    statusEl.textContent = 'Actualizando datos en la base de datos...';
    statusEl.className = 'status-info';
  }

  const payload = {
    username,
    email,
    role,
    level
  };

  if (rawPass.length > 0) {
    payload.password = rawPass;
  }

  try {
    const res = await apiFetch(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Error al actualizar usuario');
    }

    // Actualizar usuario en allUsers
    const targetIdx = allUsers.findIndex((u) => String(u.id) === String(userId));
    if (targetIdx !== -1) {
      allUsers[targetIdx] = {
        ...allUsers[targetIdx],
        username: data.user?.username || username,
        email: data.user?.email || email,
        role: data.user?.role || role,
        level: data.user?.level || level
      };
    }

    // Si es el usuario actual autenticado, actualizar localStorage
    if (currentAdminId && Number(userId) === Number(currentAdminId)) {
      const rawUser = localStorage.getItem('linguistfeed_user') || localStorage.getItem('user');
      if (rawUser) {
        try {
          const u = JSON.parse(rawUser);
          u.username = username;
          u.email = email;
          u.role = role;
          u.level = level;
          localStorage.setItem('linguistfeed_user', JSON.stringify(u));
        } catch (_) {}
      }
    }

    updateStats(allUsers);
    filterAndRender();
    closeEditUserModal();
    showToast(`Usuario "${username}" actualizado correctamente`, 'success');
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    if (statusEl) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = 'status-error';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar Cambios';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Montar Navbar común
  mountNavbar();

  // Detectar ID del usuario actual en sesión
  const authUser = getAuthUser();
  if (authUser) {
    currentAdminId = authUser.id || authUser.userId;
  }

  // Event Listeners de Búsqueda y Filtros
  const searchInput = document.getElementById('admin-search-input');
  const roleFilter = document.getElementById('admin-role-filter');
  const refreshBtn = document.getElementById('btn-refresh-users');

  if (searchInput) {
    searchInput.addEventListener('input', filterAndRender);
  }
  if (roleFilter) {
    roleFilter.addEventListener('change', filterAndRender);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchUsers();
      showToast('🔄 Lista de usuarios actualizada');
    });
  }

  // Modal de creación de usuario
  const openCreateBtn = document.getElementById('btn-open-create-user-modal');
  const cancelCreateBtn = document.getElementById('btn-cancel-create');
  const closeCreateBtn = document.getElementById('create-modal-close-x');
  const createModalOverlay = document.getElementById('create-user-modal');
  const createForm = document.getElementById('create-user-form');
  const newUserRole = document.getElementById('new-user-role');
  const groupNewUserLevel = document.getElementById('group-new-user-level');

  if (openCreateBtn) openCreateBtn.addEventListener('click', openCreateUserModal);
  if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', closeCreateUserModal);
  if (closeCreateBtn) closeCreateBtn.addEventListener('click', closeCreateUserModal);

  if (createModalOverlay) {
    createModalOverlay.addEventListener('click', (e) => {
      if (e.target === createModalOverlay) closeCreateUserModal();
    });
  }

  if (newUserRole && groupNewUserLevel) {
    newUserRole.addEventListener('change', () => {
      if (newUserRole.value === 'student') {
        groupNewUserLevel.style.display = 'block';
      } else {
        groupNewUserLevel.style.display = 'none';
      }
    });
  }

  if (createForm) {
    createForm.addEventListener('submit', handleCreateUserSubmit);
  }

  // Modal de edición de usuario
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const closeEditBtn = document.getElementById('edit-modal-close-x');
  const editModalOverlay = document.getElementById('edit-user-modal');
  const editForm = document.getElementById('edit-user-form');
  const btnQuickResetPass = document.getElementById('btn-quick-reset-pass');

  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditUserModal);
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditUserModal);

  if (editModalOverlay) {
    editModalOverlay.addEventListener('click', (e) => {
      if (e.target === editModalOverlay) closeEditUserModal();
    });
  }

  if (btnQuickResetPass) {
    btnQuickResetPass.addEventListener('click', () => {
      const passInput = document.getElementById('edit-user-password');
      if (passInput) {
        passInput.value = 'Linguist123!';
        passInput.focus();
        showToast('🔑 Clave reseteada a "Linguist123!" en el campo', 'success');
      }
    });
  }

  if (editForm) {
    editForm.addEventListener('submit', handleEditUserSubmit);
  }

  // Modal de confirmación de eliminación
  const cancelBtn = document.getElementById('btn-cancel-delete');
  const closeBtn = document.getElementById('modal-close-x');
  const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
  const modalOverlay = document.getElementById('delete-confirm-modal');

  if (cancelBtn) cancelBtn.addEventListener('click', closeDeleteModal);
  if (closeBtn) closeBtn.addEventListener('click', closeDeleteModal);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', executeUserDeletion);

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeDeleteModal();
    });
  }

  // Carga inicial
  fetchUsers();
});
