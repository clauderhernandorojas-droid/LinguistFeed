import { API_BASE_URL } from './config.js';
import { mountNavbar } from './navbar.js';
import { requireAuth, logout } from './auth.js';

function escHtml(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  // Route Guard: Solo teacher o admin pueden acceder al Teacher Portal
  let role = 'student';
  try {
    const rawUser = localStorage.getItem('linguistfeed_user') || localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u?.role) role = String(u.role).toLowerCase();
    }
  } catch (_) {}
  if (role === 'student') {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))));
          if (payload?.role) role = String(payload.role).toLowerCase();
        }
      }
    } catch (_) {}
  }
  if (role !== 'teacher' && role !== 'admin') {
    sessionStorage.setItem('access_denied_message', '⚠️ Acceso restringido: Esta sección es exclusiva para docentes y administradores.');
    window.location.replace('./dashboard.html?denied=teacher');
    return;
  }

  mountNavbar('./');

  // Estado global de la vista
  let activeClassId = null;
  let activeClassData = null;
  let teacherClasses = [];
  let activeClassStudents = [];
  let allTeacherArticles = [];
  let activeClassPerformance = null;

  // Elementos principales del DOM
  const classSelect = document.getElementById('teacher-class-select');
  const activeClassTitle = document.getElementById('active-class-title');
  const activeInviteBadge = document.getElementById('active-invite-badge');
  const activeInviteCodeEl = document.getElementById('active-invite-code');
  const activeClassSummaryText = document.getElementById('active-class-summary-text');
  const deckSuggestedTarget = document.getElementById('deck-suggested-target');
  const copyToast = document.getElementById('copy-toast');

  // Elementos de la Tarjeta 1 (Estudiantes)
  const deckStudentsCount = document.getElementById('deck-students-count');
  const deckStudentsPreview = document.getElementById('deck-students-preview');
  const modalStudentsTitle = document.getElementById('modal-students-title');
  const modalStudentsCountSubtitle = document.getElementById('modal-students-count-subtitle');
  const modalStudentsTableContainer = document.getElementById('modal-students-table-container');
  const modalStudentsSearchFilter = document.getElementById('modal-students-search-filter');

  // Elementos de la Tarjeta 2 (Lecturas)
  const deckReadingsCount = document.getElementById('deck-readings-count');
  const deckReadingsPreview = document.getElementById('deck-readings-preview');
  const publishedArticlesList = document.getElementById('published-articles-list');
  const articlesCountBadge = document.getElementById('articles-count-badge');
  const selectAllArticlesCb = document.getElementById('selectAllArticles');
  const batchDeleteBtn = document.getElementById('batchDeleteBtn');
  const selectedCountSpan = document.getElementById('selected-count');

  // Elementos de la Tarjeta 3 (Crear Lectura)
  const modalReadingTarget = document.getElementById('modal-reading-target');
  const modalReadingTitle = document.getElementById('modal-reading-title');
  const modalReadingTopic = document.getElementById('modal-reading-topic');
  const modalReadingContent = document.getElementById('modal-reading-content');
  const modalReadingStatus = document.getElementById('modal-reading-status');
  const btnSubmitModalReading = document.getElementById('btn-submit-modal-reading');

  // Elementos de la Tarjeta 4 (Rendimiento)
  const deckAvgAccuracy = document.getElementById('deck-avg-accuracy');
  const deckTotalMinutes = document.getElementById('deck-total-minutes');
  const deckAvgStreak = document.getElementById('deck-avg-streak');
  const modalPerformanceClassName = document.getElementById('modal-performance-class-name');
  const reportAvgAccuracy = document.getElementById('report-avg-accuracy');
  const reportTotalMinutes = document.getElementById('report-total-minutes');
  const reportAvgStreak = document.getElementById('report-avg-streak');
  const reportStudentsTableContainer = document.getElementById('report-students-table-container');

  /**
   * Helper para peticiones autenticadas relativas
   */
  async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    let relativeUrl = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (!relativeUrl.startsWith('/api')) {
      relativeUrl = `/api${relativeUrl}`;
    }

    let res;
    let finalUrl = relativeUrl;

    try {
      res = await fetch(relativeUrl, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';
      if (
        res.status === 404 &&
        contentType.includes('text/html') &&
        typeof API_BASE_URL !== 'undefined' &&
        API_BASE_URL &&
        !API_BASE_URL.startsWith('/api')
      ) {
        finalUrl = `${API_BASE_URL}${relativeUrl.replace(/^\/api/, '')}`;
        res = await fetch(finalUrl, { ...options, headers });
      }
    } catch (netErr) {
      if (typeof API_BASE_URL !== 'undefined' && API_BASE_URL && !API_BASE_URL.startsWith('/api')) {
        finalUrl = `${API_BASE_URL}${relativeUrl.replace(/^\/api/, '')}`;
        res = await fetch(finalUrl, { ...options, headers });
      } else {
        throw netErr;
      }
    }

    if (!res.ok) {
      const errClone = res.clone();
      const errText = await errClone.text().catch(() => '');
      console.error(
        `❌ [apiFetch] Petición a "${finalUrl}" falló con código HTTP ${res.status} (${res.statusText}):`,
        errText
      );
    }

    return res;
  }

  // ==========================================================================
  // GESTOR DE MODALES CENTRALIZADO
  // ==========================================================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      const openModals = document.querySelectorAll('.teacher-modal-overlay[style*="display: flex"]');
      if (openModals.length === 0) {
        document.body.style.overflow = '';
      }
    }
  }

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-modal');
      closeModal(targetId);
    });
  });

  document.querySelectorAll('.teacher-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.teacher-modal-overlay[style*="display: flex"]');
      openModals.forEach((m) => closeModal(m.id));
    }
  });

  function showCopyToast(msg = '✅ Código copiado al portapapeles') {
    if (!copyToast) return;
    copyToast.textContent = msg;
    copyToast.style.display = 'block';
    setTimeout(() => {
      copyToast.style.display = 'none';
    }, 2400);
  }

  if (activeInviteBadge) {
    activeInviteBadge.addEventListener('click', () => {
      if (!activeClassData?.inviteCode) return;
      navigator.clipboard.writeText(activeClassData.inviteCode).then(() => {
        showCopyToast(`📋 Código ${activeClassData.inviteCode} copiado`);
      }).catch(() => {
        showCopyToast(`Código: ${activeClassData.inviteCode}`);
      });
    });
  }

  // ==========================================================================
  // CARGA Y CAMBIO DE AULA ACTIVA
  // ==========================================================================
  async function loadTeacherClasses(preselectId = null) {
    if (!classSelect) return;
    classSelect.innerHTML = '<option value="">Cargando clases...</option>';

    try {
      const res = await apiFetch('/classes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      teacherClasses = Array.isArray(data?.classes) ? data.classes : [];

      classSelect.innerHTML = '';
      if (modalReadingTarget) {
        modalReadingTarget.innerHTML = '<option value="">Pública / Todos los estudiantes</option>';
      }

      if (teacherClasses.length === 0) {
        classSelect.innerHTML = '<option value="">Sin clases creadas</option>';
        activeClassId = null;
        activeClassData = null;
        updateHeaderInfoEmpty();
        renderEmptyDeck();
        return;
      }

      const currentUserRole = (() => {
        try {
          const raw = localStorage.getItem('linguistfeed_user') || localStorage.getItem('user');
          return String(JSON.parse(raw)?.role || '').toLowerCase();
        } catch (_) { return ''; }
      })();
      const isAdmin = currentUserRole === 'admin';

      teacherClasses.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        const count = c.studentsCount != null ? ` (${c.studentsCount} alumnos)` : '';
        const teacherTag = isAdmin && c.teacherName ? ` - Prof. ${c.teacherName}` : '';
        opt.textContent = `${c.name}${teacherTag} · ${c.inviteCode}${count}`;
        classSelect.appendChild(opt);

        if (modalReadingTarget) {
          const optTarget = document.createElement('option');
          optTarget.value = String(c.id);
          optTarget.textContent = `Grupo: ${c.name}${teacherTag} (${c.inviteCode})`;
          modalReadingTarget.appendChild(optTarget);
        }
      });

      let targetId = preselectId;
      if (!targetId) {
        const stored = localStorage.getItem('teacher_active_class_id');
        if (stored && teacherClasses.some((c) => String(c.id) === String(stored))) {
          targetId = parseInt(stored, 10);
        } else {
          targetId = teacherClasses[0].id;
        }
      }

      classSelect.value = String(targetId);
      await selectClass(targetId);
    } catch (err) {
      console.error('Error al listar clases:', err);
      classSelect.innerHTML = '<option value="">Error al cargar clases</option>';
    }
  }

  function updateHeaderInfoEmpty() {
    if (activeClassTitle) activeClassTitle.textContent = 'No tienes clases activas';
    if (activeInviteBadge) activeInviteBadge.style.display = 'none';
    if (activeClassSummaryText) activeClassSummaryText.textContent = 'Crea una clase para comenzar a gestionar alumnos';
    if (deckSuggestedTarget) deckSuggestedTarget.textContent = 'Ninguno';
  }

  function renderEmptyDeck() {
    if (deckStudentsCount) deckStudentsCount.textContent = '0 Alumnos';
    if (deckStudentsPreview) deckStudentsPreview.innerHTML = '<p style="color:#64748b;font-size:0.88rem;">Crea tu primera clase usando el botón "+ Nueva Clase".</p>';
    if (deckReadingsCount) deckReadingsCount.textContent = '0 Lecturas';
    if (deckReadingsPreview) deckReadingsPreview.innerHTML = '<p style="color:#64748b;font-size:0.88rem;">Sin lecturas asignadas.</p>';
    if (deckAvgAccuracy) deckAvgAccuracy.textContent = '--%';
    if (deckTotalMinutes) deckTotalMinutes.textContent = '--';
    if (deckAvgStreak) deckAvgStreak.textContent = '-- d';
  }

  async function selectClass(classId) {
    activeClassId = classId;
    localStorage.setItem('teacher_active_class_id', String(classId));
    activeClassData = teacherClasses.find((c) => Number(c.id) === Number(classId)) || null;

    if (!activeClassData) return;

    if (activeClassTitle) {
      const isRoleAdmin = (() => {
        try {
          const raw = localStorage.getItem('linguistfeed_user') || localStorage.getItem('user');
          return String(JSON.parse(raw)?.role || '').toLowerCase() === 'admin';
        } catch (_) { return false; }
      })();
      const teacherSuffix = isRoleAdmin && activeClassData.teacherName ? ` - Prof. ${activeClassData.teacherName}` : '';
      activeClassTitle.textContent = `${activeClassData.name}${teacherSuffix}`;
    }
    if (activeInviteBadge && activeInviteCodeEl) {
      activeInviteCodeEl.textContent = activeClassData.inviteCode;
      activeInviteBadge.style.display = 'inline-flex';
    }
    if (deckSuggestedTarget) {
      deckSuggestedTarget.textContent = `Aula: ${activeClassData.name}`;
    }

    if (modalReadingTarget) {
      modalReadingTarget.value = String(activeClassId);
    }

    await Promise.all([
      loadClassStudents(activeClassId),
      loadTeacherArticles(),
      loadClassPerformance(activeClassId)
    ]);

    updateClassSummaryPill();
  }

  function updateClassSummaryPill() {
    if (!activeClassSummaryText) return;
    const sCount = activeClassStudents.length;
    const rCount = allTeacherArticles.filter((a) => Number(a.class_id) === Number(activeClassId)).length;
    activeClassSummaryText.textContent = `${sCount} ${sCount === 1 ? 'Estudiante inscrito' : 'Estudiantes inscritos'} • ${rCount} ${rCount === 1 ? 'Lectura asignada' : 'Lecturas asignadas'}`;
  }

  if (classSelect) {
    classSelect.addEventListener('change', () => {
      const cid = parseInt(classSelect.value, 10);
      if (cid) selectClass(cid);
    });
  }

  const btnRefreshDashboard = document.getElementById('btn-refresh-dashboard');
  if (btnRefreshDashboard) {
    btnRefreshDashboard.addEventListener('click', async () => {
      btnRefreshDashboard.disabled = true;
      btnRefreshDashboard.textContent = 'Cargando...';
      await loadTeacherClasses(activeClassId);
      btnRefreshDashboard.disabled = false;
      btnRefreshDashboard.textContent = '🔄 Actualizar';
    });
  }

  // ==========================================================================
  // CREACIÓN DE NUEVA CLASE
  // ==========================================================================
  const btnOpenCreateClassModal = document.getElementById('btn-open-create-class-modal');
  const btnConfirmCreateClass = document.getElementById('btn-confirm-create-class');
  const newClassNameInput = document.getElementById('newClassNameInput');
  const createClassModalStatus = document.getElementById('create-class-modal-status');

  if (btnOpenCreateClassModal) {
    btnOpenCreateClassModal.addEventListener('click', () => {
      if (newClassNameInput) newClassNameInput.value = '';
      if (createClassModalStatus) createClassModalStatus.textContent = '';
      openModal('modal-create-class');
      setTimeout(() => newClassNameInput?.focus(), 100);
    });
  }

  if (btnConfirmCreateClass && newClassNameInput) {
    btnConfirmCreateClass.addEventListener('click', async () => {
      const name = newClassNameInput.value.trim();
      if (!name) {
        if (createClassModalStatus) {
          createClassModalStatus.style.color = '#dc2626';
          createClassModalStatus.textContent = 'Por favor ingresa un nombre para la clase.';
        }
        return;
      }

      btnConfirmCreateClass.disabled = true;
      btnConfirmCreateClass.textContent = 'Creando...';
      try {
        const res = await apiFetch('/classes', {
          method: 'POST',
          body: JSON.stringify({ name })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Error al crear la clase');

        const createdId = data.class?.id;
        showCopyToast(`🎉 Clase "${name}" creada con código ${data.class?.inviteCode}`);
        closeModal('modal-create-class');
        await loadTeacherClasses(createdId);
      } catch (err) {
        if (createClassModalStatus) {
          createClassModalStatus.style.color = '#dc2626';
          createClassModalStatus.textContent = err.message || 'No se pudo crear la clase.';
        }
      } finally {
        btnConfirmCreateClass.disabled = false;
        btnConfirmCreateClass.textContent = 'Guardar y Crear Clase';
      }
    });
  }

  // ==========================================================================
  // ELIMINACIÓN DE CLASE ACTIVA
  // ==========================================================================
  const btnDeleteClass = document.getElementById('btn-delete-class');
  const btnConfirmDeleteClass = document.getElementById('btn-confirm-delete-class');
  const deleteClassModalTargetName = document.getElementById('delete-class-modal-target-name');
  const deleteClassModalTargetCode = document.getElementById('delete-class-modal-target-code');
  const deleteClassModalStatus = document.getElementById('delete-class-modal-status');

  if (btnDeleteClass) {
    btnDeleteClass.addEventListener('click', () => {
      if (!activeClassId || !activeClassData) {
        showCopyToast('⚠️ No hay ninguna clase activa para eliminar');
        return;
      }
      if (deleteClassModalTargetName) {
        deleteClassModalTargetName.textContent = activeClassData.name || 'Clase';
      }
      if (deleteClassModalTargetCode) {
        deleteClassModalTargetCode.textContent = `Código: ${activeClassData.inviteCode || '------'}`;
      }
      if (deleteClassModalStatus) {
        deleteClassModalStatus.textContent = '';
        deleteClassModalStatus.style.color = '';
      }
      if (btnConfirmDeleteClass) {
        btnConfirmDeleteClass.disabled = false;
        btnConfirmDeleteClass.textContent = 'Sí, Eliminar Clase';
      }
      openModal('modal-delete-class');
    });
  }

  if (btnConfirmDeleteClass) {
    btnConfirmDeleteClass.addEventListener('click', async () => {
      if (!activeClassId) return;

      btnConfirmDeleteClass.disabled = true;
      btnConfirmDeleteClass.textContent = '⏳ Eliminando clase...';
      if (deleteClassModalStatus) {
        deleteClassModalStatus.style.color = '#38bdf8';
        deleteClassModalStatus.textContent = 'Desvinculando estudiantes y eliminando aula...';
      }

      try {
        const res = await apiFetch(`/classes/${activeClassId}`, {
          method: 'DELETE'
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Error al eliminar la clase');
        }

        closeModal('modal-delete-class');
        showCopyToast('🗑️ Clase eliminada con éxito');
        localStorage.removeItem('teacher_active_class_id');

        await loadTeacherClasses();
      } catch (err) {
        console.error('Error al eliminar clase:', err);
        if (deleteClassModalStatus) {
          deleteClassModalStatus.style.color = '#f87171';
          deleteClassModalStatus.textContent = `❌ ${err.message}`;
        }
        btnConfirmDeleteClass.disabled = false;
        btnConfirmDeleteClass.textContent = 'Reintentar Eliminación';
      }
    });
  }

  // ==========================================================================
  // TARJETA 1 & MODAL: ESTUDIANTES DEL GRUPO & MATRICULACIÓN
  // ==========================================================================
  async function loadClassStudents(classId) {
    if (!classId) return;
    try {
      const res = await apiFetch(`/classes/${classId}/students`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      activeClassStudents = Array.isArray(data?.students) ? data.students : [];

      renderDeckStudentsPreview();
      renderModalStudentsTable(activeClassStudents);
      updateClassSummaryPill();
    } catch (err) {
      console.error('Error cargando alumnos de la clase:', err);
      if (deckStudentsPreview) {
        deckStudentsPreview.innerHTML = '<p style="color:#dc2626; font-size:0.85rem;">Error al cargar estudiantes.</p>';
      }
    }
  }

  function renderDeckStudentsPreview() {
    if (!deckStudentsPreview || !deckStudentsCount) return;
    const count = activeClassStudents.length;
    deckStudentsCount.textContent = `${count} ${count === 1 ? 'Alumno' : 'Alumnos'}`;

    if (count === 0) {
      deckStudentsPreview.innerHTML = `
        <div style="text-align:center; padding:18px 10px; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">
          <p style="margin:0 0 6px; font-weight:600; font-size:0.9rem;">Sin estudiantes en esta clase aún.</p>
          <p style="margin:0; font-size:0.82rem;">Comparte el código o matricula con el botón inferior.</p>
        </div>
      `;
      return;
    }

    const previewList = activeClassStudents.slice(0, 4);
    deckStudentsPreview.innerHTML = previewList.map((st) => {
      const initials = (st.username || 'E').slice(0, 2).toUpperCase();
      const level = (st.level || 'B1').toUpperCase();
      const levelClass = `level-${level.toLowerCase()}`;
      return `
        <div class="deck-preview-item">
          <div class="deck-preview-item-left">
            <div class="student-avatar-circle">${escHtml(initials)}</div>
            <div style="overflow:hidden; text-overflow:ellipsis;">
              <strong style="color:#ffffff; display:block; font-size:0.88rem; line-height:1.2;">${escHtml(st.username)}</strong>
              <span style="color:#94a3b8; font-size:0.78rem;">${escHtml(st.email || 'sin email')}</span>
            </div>
          </div>
          <span class="level-chip ${levelClass}">${escHtml(level)}</span>
        </div>
      `;
    }).join('');

    if (count > 4) {
      deckStudentsPreview.innerHTML += `
        <div style="text-align:center; padding-top:4px;">
          <small style="color:#64748b; font-weight:600;">+ ${count - 4} alumnos más</small>
        </div>
      `;
    }
  }

  function renderModalStudentsTable(students) {
    if (!modalStudentsTableContainer) return;
    if (modalStudentsTitle) {
      modalStudentsTitle.textContent = `👥 Alumnos de ${activeClassData?.name || 'la clase'}`;
    }
    if (modalStudentsCountSubtitle) {
      modalStudentsCountSubtitle.textContent = `${students.length} ${students.length === 1 ? 'estudiante matriculado' : 'estudiantes matriculados'}`;
    }

    if (!Array.isArray(students) || students.length === 0) {
      modalStudentsTableContainer.innerHTML = `
        <div style="text-align:center; padding:24px; color:#64748b;">
          <p style="margin:0; font-size:0.95rem;">No se encontraron estudiantes para este filtro.</p>
        </div>
      `;
      return;
    }

    const rowsHtml = students.map((st) => {
      const joined = st.joinedAt ? new Date(st.joinedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Reciente';
      const level = (st.level || 'B1').toUpperCase();
      const levelClass = `level-${level.toLowerCase()}`;
      return `
        <tr id="student-row-${st.id}">
          <td>
            <strong style="color:#ffffff;">${escHtml(st.username)}</strong>
            <div style="font-size:0.8rem; color:#94a3b8;">${escHtml(st.email || '-')}</div>
          </td>
          <td><span class="level-chip ${levelClass}">${escHtml(level)}</span></td>
          <td><span style="font-size:0.85rem; color:#94a3b8;">${escHtml(joined)}</span></td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:6px;">
              <button type="button" class="btn-secondary-deck btn-view-student-stats" data-student-id="${st.id}" data-student-name="${escHtml(st.username)}" style="padding:5px 10px; font-size:0.8rem;">
                📊 Progreso
              </button>
              <button type="button" class="btn-outline-danger btn-unenroll-student" data-student-id="${st.id}" data-student-name="${escHtml(st.username)}" style="padding:5px 10px; font-size:0.8rem;">
                ❌ Desvincular
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    modalStudentsTableContainer.innerHTML = `
      <table class="deck-table">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Nivel</th>
            <th>Ingreso</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    modalStudentsTableContainer.querySelectorAll('.btn-view-student-stats').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-student-id');
        const sname = btn.getAttribute('data-student-name');
        showStudentStatsModal(sid, sname);
      });
    });

    modalStudentsTableContainer.querySelectorAll('.btn-unenroll-student').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const sid = btn.getAttribute('data-student-id');
        const sname = btn.getAttribute('data-student-name');
        const confirmed = confirm(`¿Estás seguro de desvincular a "${sname}" de esta clase? El estudiante perderá acceso a las lecturas asignadas a este grupo.`);
        if (!confirmed) return;

        try {
          const res = await apiFetch(`/classes/${activeClassId}/students/${sid}`, {
            method: 'DELETE'
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok) {
            showCopyToast(`Alumno "${sname}" desvinculado de la clase`);
            await loadClassStudents(activeClassId);
            await loadClassPerformance(activeClassId);
          } else {
            alert(data.error || 'No se pudo desvincular al estudiante.');
          }
        } catch (err) {
          console.error(err);
          alert('Error de red al intentar desvincular.');
        }
      });
    });
  }

  if (modalStudentsSearchFilter) {
    modalStudentsSearchFilter.addEventListener('input', () => {
      const q = modalStudentsSearchFilter.value.trim().toLowerCase();
      if (!q) {
        renderModalStudentsTable(activeClassStudents);
        return;
      }
      const filtered = activeClassStudents.filter((s) => {
        const name = String(s.username || '').toLowerCase();
        const email = String(s.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
      renderModalStudentsTable(filtered);
    });
  }

  const btnOpenStudentsListModal = document.getElementById('btn-open-students-list-modal');
  if (btnOpenStudentsListModal) {
    btnOpenStudentsListModal.addEventListener('click', () => {
      if (!activeClassId) {
        alert('Selecciona una clase primero.');
        return;
      }
      if (modalStudentsSearchFilter) modalStudentsSearchFilter.value = '';
      renderModalStudentsTable(activeClassStudents);
      openModal('modal-students-list');
    });
  }

  const btnOpenEnrollModal = document.getElementById('btn-open-enroll-modal');
  const btnModalOpenEnroll = document.getElementById('btn-modal-open-enroll');
  const enrollModalSubtitle = document.getElementById('enroll-modal-subtitle');

  function prepareEnrollModal() {
    if (!activeClassId) {
      alert('Selecciona una clase primero.');
      return;
    }
    if (enrollModalSubtitle) {
      enrollModalSubtitle.textContent = `Matriculando en: ${activeClassData?.name || 'Aula actual'}`;
    }
    const enrollNewStatus = document.getElementById('enroll-new-status');
    const enrollSearchStatus = document.getElementById('enroll-search-status');
    if (enrollNewStatus) enrollNewStatus.textContent = '';
    if (enrollSearchStatus) enrollSearchStatus.textContent = '';
    openModal('modal-enroll-student');
  }

  if (btnOpenEnrollModal) btnOpenEnrollModal.addEventListener('click', prepareEnrollModal);
  if (btnModalOpenEnroll) btnModalOpenEnroll.addEventListener('click', prepareEnrollModal);

  const tabBtnCreateStudent = document.getElementById('tab-btn-create-student');
  const tabBtnSearchStudent = document.getElementById('tab-btn-search-student');
  const tabContentCreateStudent = document.getElementById('tab-content-create-student');
  const tabContentSearchStudent = document.getElementById('tab-content-search-student');
  const btnSubmitQuickEnroll = document.getElementById('btn-submit-quick-enroll');

  let activeEnrollTab = 'create';

  if (tabBtnCreateStudent && tabBtnSearchStudent && tabContentCreateStudent && tabContentSearchStudent) {
    tabBtnCreateStudent.addEventListener('click', () => {
      activeEnrollTab = 'create';
      tabBtnCreateStudent.classList.add('active');
      tabBtnSearchStudent.classList.remove('active');
      tabContentCreateStudent.style.display = 'block';
      tabContentSearchStudent.style.display = 'none';
      if (btnSubmitQuickEnroll) btnSubmitQuickEnroll.style.display = 'inline-flex';
    });

    tabBtnSearchStudent.addEventListener('click', () => {
      activeEnrollTab = 'search';
      tabBtnSearchStudent.classList.add('active');
      tabBtnCreateStudent.classList.remove('active');
      tabContentSearchStudent.style.display = 'block';
      tabContentCreateStudent.style.display = 'none';
      if (btnSubmitQuickEnroll) btnSubmitQuickEnroll.style.display = 'none';
    });
  }

  if (btnSubmitQuickEnroll) {
    btnSubmitQuickEnroll.addEventListener('click', async () => {
      if (activeEnrollTab !== 'create') return;
      const fullName = document.getElementById('enroll-new-name')?.value.trim() || '';
      const email = document.getElementById('enroll-new-email')?.value.trim().toLowerCase() || '';
      const level = document.getElementById('enroll-new-level')?.value || 'B1';
      const password = document.getElementById('enroll-new-pass')?.value.trim() || 'Linguist123!';
      const statusEl = document.getElementById('enroll-new-status');

      if (!email) {
        if (statusEl) {
          statusEl.style.color = '#dc2626';
          statusEl.textContent = 'El correo electrónico es obligatorio.';
        }
        return;
      }

      btnSubmitQuickEnroll.disabled = true;
      btnSubmitQuickEnroll.textContent = 'Matriculando...';

      try {
        const res = await apiFetch(`/classes/${activeClassId}/students/quick-enroll`, {
          method: 'POST',
          body: JSON.stringify({ fullName, email, level, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'No se pudo inscribir');

        showCopyToast(data.message || '✅ Alumno matriculado');
        closeModal('modal-enroll-student');

        const nameInput = document.getElementById('enroll-new-name');
        const emailInput = document.getElementById('enroll-new-email');
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';

        await loadClassStudents(activeClassId);
        await loadClassPerformance(activeClassId);
      } catch (err) {
        if (statusEl) {
          statusEl.style.color = '#dc2626';
          statusEl.textContent = err.message || 'Error al matricular.';
        }
      } finally {
        btnSubmitQuickEnroll.disabled = false;
        btnSubmitQuickEnroll.textContent = 'Inscribir Alumno';
      }
    });
  }

  const btnRunStudentSearch = document.getElementById('btn-run-student-search');
  const enrollSearchInput = document.getElementById('enroll-search-input');
  const enrollSearchResults = document.getElementById('enroll-search-results');
  const enrollSearchStatus = document.getElementById('enroll-search-status');

  async function executeStudentSearch() {
    const q = enrollSearchInput?.value.trim().toLowerCase() || '';
    if (!enrollSearchResults) return;
    if (!q) {
      enrollSearchResults.innerHTML = '<p style="color:#64748b; font-size:0.88rem;">Escribe un nombre o correo para buscar.</p>';
      return;
    }

    enrollSearchResults.innerHTML = '<p style="color:#64748b; font-size:0.88rem;">Buscando estudiantes...</p>';
    if (enrollSearchStatus) enrollSearchStatus.textContent = '';

    try {
      const res = await apiFetch(`/users?q=${encodeURIComponent(q)}`);
      const users = await res.json();

      if (!Array.isArray(users) || users.length === 0) {
        enrollSearchResults.innerHTML = '<p style="color:#64748b; font-size:0.88rem;">No se encontraron usuarios con ese criterio.</p>';
        return;
      }

      const studentCandidates = users.filter((u) => String(u.role || 'student').toLowerCase() === 'student');

      if (studentCandidates.length === 0) {
        enrollSearchResults.innerHTML = '<p style="color:#64748b; font-size:0.88rem;">No se encontraron cuentas de estudiantes con ese correo/nombre.</p>';
        return;
      }

      const enrolledIds = new Set(activeClassStudents.map((s) => Number(s.id)));

      enrollSearchResults.innerHTML = studentCandidates.map((u) => {
        const isAlreadyEnrolled = enrolledIds.has(Number(u.id));
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:#0f172a; border:1px solid #334155; border-radius:8px; margin-bottom:8px;">
            <div>
              <strong style="color:#ffffff; font-size:0.9rem;">${escHtml(u.username)}</strong>
              <div style="font-size:0.8rem; color:#94a3b8;">${escHtml(u.email || 'sin email')}</div>
            </div>
            <div>
              ${
                isAlreadyEnrolled
                  ? '<span style="font-size:0.8rem; color:#4ade80; font-weight:700;">✓ Ya inscrito</span>'
                  : `<button type="button" class="btn-primary-deck btn-enroll-existing-candidate" data-user-id="${u.id}" data-user-name="${escHtml(u.username)}" style="padding:5px 12px; font-size:0.82rem;">Matricular</button>`
              }
            </div>
          </div>
        `;
      }).join('');

      enrollSearchResults.querySelectorAll('.btn-enroll-existing-candidate').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const uid = btn.getAttribute('data-user-id');
          const uname = btn.getAttribute('data-user-name');
          btn.disabled = true;
          btn.textContent = 'Matriculando...';

          try {
            const enrollRes = await apiFetch(`/classes/${activeClassId}/students/quick-enroll`, {
              method: 'POST',
              body: JSON.stringify({ studentId: uid })
            });
            const enrollData = await enrollRes.json().catch(() => ({}));
            if (!enrollRes.ok) throw new Error(enrollData.error || 'Fallo al matricular');

            showCopyToast(`✅ ${uname} matriculado en la clase`);
            closeModal('modal-enroll-student');
            await loadClassStudents(activeClassId);
            await loadClassPerformance(activeClassId);
          } catch (err) {
            alert(err.message || 'Error al matricular');
            btn.disabled = false;
            btn.textContent = 'Matricular';
          }
        });
      });
    } catch (err) {
      enrollSearchResults.innerHTML = '<p style="color:#dc2626; font-size:0.88rem;">Error de red al buscar.</p>';
    }
  }

  if (btnRunStudentSearch) btnRunStudentSearch.addEventListener('click', executeStudentSearch);
  if (enrollSearchInput) {
    enrollSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeStudentSearch();
      }
    });
  }

  // ==========================================================================
  // TARJETA 2 & MODAL: LECTURAS ASIGNADAS (GESTIONAR / BORRAR)
  // ==========================================================================
  async function loadTeacherArticles() {
    try {
      const res = await apiFetch('/articles/manual/mine');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allTeacherArticles = Array.isArray(data?.articles) ? data.articles : [];

      renderDeckReadingsPreview();
      renderManageArticlesList(allTeacherArticles);
      updateClassSummaryPill();
    } catch (err) {
      console.error('Error cargando lecturas manuales:', err);
      if (deckReadingsPreview) {
        deckReadingsPreview.innerHTML = '<p style="color:#dc2626; font-size:0.85rem;">Error al cargar lecturas.</p>';
      }
    }
  }

  function renderDeckReadingsPreview() {
    if (!deckReadingsPreview || !deckReadingsCount) return;

    const classArticles = allTeacherArticles.filter((a) => {
      if (!activeClassId) return true;
      return Number(a.class_id) === Number(activeClassId);
    });

    const count = classArticles.length;
    deckReadingsCount.textContent = `${count} ${count === 1 ? 'Lectura' : 'Lecturas'}`;

    if (count === 0) {
      deckReadingsPreview.innerHTML = `
        <div style="text-align:center; padding:18px 10px; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px;">
          <p style="margin:0 0 6px; font-weight:600; font-size:0.9rem;">Sin lecturas asignadas a este grupo.</p>
          <p style="margin:0; font-size:0.82rem;">Haz clic en "Redactar Nueva Lectura" para asignar material.</p>
        </div>
      `;
      return;
    }

    const previewItems = classArticles.slice(0, 4);
    deckReadingsPreview.innerHTML = previewItems.map((art) => {
      const artId = art.id != null ? String(art.id) : String(art.external_id || '');
      const createdDate = art.created_at
        ? new Date(art.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        : 'Reciente';

      return `
        <div class="deck-preview-item">
          <div class="deck-preview-item-left">
            <span style="font-size:1.1rem;">📖</span>
            <div style="overflow:hidden; text-overflow:ellipsis;">
              <a href="reader.html?id=${encodeURIComponent(artId)}" target="_blank" style="font-weight:700; color:#38bdf8; text-decoration:none; font-size:0.88rem; display:block; line-height:1.2;">
                ${escHtml(art.title || 'Sin título')}
              </a>
              <span style="font-size:0.75rem; color:#94a3b8;">📅 ${escHtml(createdDate)}</span>
            </div>
          </div>
          <span class="reading-badge reading-badge-class" style="font-size:0.7rem; padding:2px 6px;">${escHtml(art.class_name || 'Clase')}</span>
        </div>
      `;
    }).join('');

    if (count > 4) {
      deckReadingsPreview.innerHTML += `
        <div style="text-align:center; padding-top:4px;">
          <small style="color:#64748b; font-weight:600;">+ ${count - 4} lecturas más</small>
        </div>
      `;
    }
  }

  function updateBatchDeleteToolbar() {
    if (!publishedArticlesList) return;
    const checked = publishedArticlesList.querySelectorAll('.article-select-cb:checked');
    const count = checked.length;
    if (selectedCountSpan) selectedCountSpan.textContent = count;
    if (batchDeleteBtn) {
      batchDeleteBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (selectAllArticlesCb) {
      const allCbs = publishedArticlesList.querySelectorAll('.article-select-cb');
      if (allCbs.length > 0 && count === allCbs.length) {
        selectAllArticlesCb.checked = true;
        selectAllArticlesCb.indeterminate = false;
      } else if (count > 0) {
        selectAllArticlesCb.checked = false;
        selectAllArticlesCb.indeterminate = true;
      } else {
        selectAllArticlesCb.checked = false;
        selectAllArticlesCb.indeterminate = false;
      }
    }
  }

  function renderManageArticlesList(articles) {
    if (!publishedArticlesList) return;
    publishedArticlesList.innerHTML = '';
    if (articlesCountBadge) {
      articlesCountBadge.textContent = `${articles.length} ${articles.length === 1 ? 'lectura publicada' : 'lecturas publicadas'}`;
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      publishedArticlesList.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; color: #64748b; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
          <p style="font-size: 1.05rem; margin: 0 0 6px; font-weight: 500;">No tienes lecturas publicadas en este momento.</p>
          <p style="font-size: 0.88rem; margin: 0;">Usa la tarjeta "Crear / Asignar Lectura" para publicar material.</p>
        </div>
      `;
      updateBatchDeleteToolbar();
      return;
    }

    articles.forEach((art) => {
      const artId = art.id != null ? String(art.id) : String(art.external_id || '');
      const card = document.createElement('div');
      card.className = 'reading-card';
      card.id = `manage-article-card-${artId}`;

      const createdDate = art.created_at
        ? new Date(art.created_at).toLocaleString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Fecha no registrada';

      const targetBadge = art.assigned_to_user_id
        ? `<span class="reading-badge reading-badge-targeted">👤 Asignado a: ${escHtml(art.assigned_student_name || 'Estudiante #' + art.assigned_to_user_id)}</span>`
        : `<span class="reading-badge reading-badge-public">👥 General</span>`;

      const classBadge = art.class_name
        ? `<span class="reading-badge reading-badge-class">🏷️ ${escHtml(art.class_name)}</span>`
        : '';

      const rawContent = String(art.content || '').trim();
      const excerpt = rawContent.length > 130 ? rawContent.substring(0, 130) + '…' : rawContent;

      card.innerHTML = `
        <div class="reading-card-header">
          <div class="reading-card-title-group">
            <input type="checkbox" class="article-select-cb" data-article-id="${escHtml(artId)}" style="margin-top: 4px; cursor: pointer; width: 18px; height: 18px;">
            <div>
              <h3 class="reading-card-title">
                <a href="reader.html?id=${encodeURIComponent(artId)}" target="_blank" title="Abrir en el Lector">${escHtml(art.title || 'Sin título')}</a>
              </h3>
              <div class="reading-card-meta">
                ${classBadge}
                ${targetBadge}
                <span>📅 ${escHtml(createdDate)}</span>
              </div>
            </div>
          </div>
        </div>
        ${excerpt ? `<p class="reading-excerpt">${escHtml(excerpt)}</p>` : ''}
        <div class="reading-card-actions">
          <a href="reader.html?id=${encodeURIComponent(artId)}" target="_blank" class="btn-secondary-deck" style="padding: 5px 12px; font-size: 0.82rem; text-decoration: none;">📖 Leer</a>
          <button type="button" class="btn-outline-danger btn-delete-single-art" data-article-id="${escHtml(artId)}" data-article-title="${escHtml(art.title || 'esta lectura')}" style="padding: 5px 12px; font-size: 0.82rem;">
            🗑️ Eliminar
          </button>
        </div>
      `;

      card.querySelector('.article-select-cb')?.addEventListener('change', updateBatchDeleteToolbar);

      card.querySelector('.btn-delete-single-art')?.addEventListener('click', async () => {
        const title = art.title || 'esta lectura';
        const confirmed = confirm(`¿Estás seguro de eliminar el artículo "${title}"?`);
        if (!confirmed) return;

        try {
          const res = await apiFetch(`/articles/${encodeURIComponent(artId)}`, { method: 'DELETE' });
          const resData = await res.json().catch(() => ({}));
          if (res.ok && resData.success) {
            showCopyToast(`Artículo "${title}" eliminado`);
            await loadTeacherArticles();
          } else {
            alert(resData.error || 'No se pudo eliminar el artículo.');
          }
        } catch (err) {
          alert('Error de red al intentar eliminar.');
        }
      });

      publishedArticlesList.appendChild(card);
    });

    updateBatchDeleteToolbar();
  }

  if (selectAllArticlesCb) {
    selectAllArticlesCb.addEventListener('change', () => {
      const isChecked = selectAllArticlesCb.checked;
      const cbs = publishedArticlesList?.querySelectorAll('.article-select-cb') || [];
      cbs.forEach((cb) => (cb.checked = isChecked));
      updateBatchDeleteToolbar();
    });
  }

  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', async () => {
      const checked = publishedArticlesList?.querySelectorAll('.article-select-cb:checked') || [];
      const ids = Array.from(checked).map((cb) => cb.getAttribute('data-article-id')).filter(Boolean);
      if (ids.length === 0) return;

      const confirmed = confirm(`¿Estás seguro de eliminar las ${ids.length} lecturas seleccionadas? Esta acción no se puede deshacer.`);
      if (!confirmed) return;

      batchDeleteBtn.disabled = true;
      batchDeleteBtn.textContent = 'Eliminando...';

      try {
        const res = await apiFetch('/articles/batch-delete', {
          method: 'POST',
          body: JSON.stringify({ ids })
        });
        const resData = await res.json().catch(() => ({}));
        if (res.ok && resData.success) {
          showCopyToast(`Se eliminaron ${resData.deletedCount || ids.length} lecturas`);
          await loadTeacherArticles();
        } else {
          alert(resData.error || 'No se pudieron eliminar todas las lecturas.');
        }
      } catch (err) {
        alert('Error de red al eliminar en bloque.');
      } finally {
        batchDeleteBtn.disabled = false;
        batchDeleteBtn.textContent = `🗑️ Eliminar seleccionadas (${selectedCountSpan?.textContent || '0'})`;
      }
    });
  }

  const refreshArticlesBtn = document.getElementById('refreshArticlesBtn');
  if (refreshArticlesBtn) {
    refreshArticlesBtn.addEventListener('click', () => loadTeacherArticles());
  }

  const btnOpenManageReadingsModal = document.getElementById('btn-open-manage-readings-modal');
  if (btnOpenManageReadingsModal) {
    btnOpenManageReadingsModal.addEventListener('click', () => {
      renderManageArticlesList(allTeacherArticles);
      openModal('modal-manage-readings');
    });
  }

  // ==========================================================================
  // TARJETA 3 & MODAL: CREAR / ASIGNAR LECTURA
  // ==========================================================================
  const btnOpenCreateReadingModal = document.getElementById('btn-open-create-reading-modal');
  if (btnOpenCreateReadingModal) {
    btnOpenCreateReadingModal.addEventListener('click', () => {
      if (modalReadingTarget && activeClassId) {
        modalReadingTarget.value = String(activeClassId);
      }
      if (modalReadingStatus) modalReadingStatus.textContent = '';
      openModal('modal-create-reading');
    });
  }

  if (btnSubmitModalReading) {
    btnSubmitModalReading.addEventListener('click', async () => {
      const title = modalReadingTitle?.value.trim() || '';
      const topic = modalReadingTopic?.value.trim() || 'classroom';
      const content = modalReadingContent?.value.trim() || '';
      const classId = modalReadingTarget?.value ? modalReadingTarget.value : undefined;

      if (!title || !content) {
        if (modalReadingStatus) {
          modalReadingStatus.style.color = '#dc2626';
          modalReadingStatus.textContent = 'El título y el contenido son obligatorios.';
        }
        return;
      }

      btnSubmitModalReading.disabled = true;
      btnSubmitModalReading.textContent = 'Publicando...';

      try {
        const res = await apiFetch('/articles/manual-upload', {
          method: 'POST',
          body: JSON.stringify({ title, topic, content, classId })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Error al publicar lectura');

        showCopyToast('✅ Lectura publicada exitosamente');
        closeModal('modal-create-reading');

        if (modalReadingTitle) modalReadingTitle.value = '';
        if (modalReadingContent) modalReadingContent.value = '';

        await loadTeacherArticles();
      } catch (err) {
        if (modalReadingStatus) {
          modalReadingStatus.style.color = '#dc2626';
          modalReadingStatus.textContent = err.message || 'Error al publicar.';
        }
      } finally {
        btnSubmitModalReading.disabled = false;
        btnSubmitModalReading.textContent = 'Publicar y Asignar Lectura';
      }
    });
  }

  // ==========================================================================
  // TARJETA 4 & MODAL: RENDIMIENTO DEL AULA Y SEMÁFORO PEDAGÓGICO
  // ==========================================================================
  async function loadClassPerformance(classId) {
    if (!classId) return;
    try {
      const res = await apiFetch(`/classes/${classId}/performance`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      activeClassPerformance = data;

      const summary = data?.summary || {};
      if (deckAvgAccuracy) deckAvgAccuracy.textContent = `${summary.averageAccuracy || 0}%`;
      if (deckTotalMinutes) deckTotalMinutes.textContent = `${summary.totalReadingMinutes || 0} min`;
      if (deckAvgStreak) deckAvgStreak.textContent = `${summary.averageStreak || 0} d`;

      renderPerformanceModalContent(data);
    } catch (err) {
      console.error('Error calculando rendimiento del aula:', err);
      if (deckAvgAccuracy) deckAvgAccuracy.textContent = '--%';
      if (deckTotalMinutes) deckTotalMinutes.textContent = '--';
      if (deckAvgStreak) deckAvgStreak.textContent = '-- d';
    }
  }

  function renderPerformanceModalContent(data) {
    if (!reportStudentsTableContainer) return;
    const summary = data?.summary || {};
    const students = Array.isArray(data?.students) ? data.students : [];

    if (modalPerformanceClassName) {
      modalPerformanceClassName.textContent = `📈 Reporte de Rendimiento: ${data?.class?.name || activeClassData?.name || 'Aula'}`;
    }
    if (reportAvgAccuracy) reportAvgAccuracy.textContent = `${summary.averageAccuracy || 0}%`;
    if (reportTotalMinutes) reportTotalMinutes.textContent = `${summary.totalReadingMinutes || 0} min`;
    if (reportAvgStreak) reportAvgStreak.textContent = `${summary.averageStreak || 0} d`;

    if (students.length === 0) {
      reportStudentsTableContainer.innerHTML = `
        <div style="text-align:center; padding:24px; color:#64748b;">
          <p style="margin:0; font-size:0.95rem;">Esta aula aún no tiene estudiantes inscritos.</p>
        </div>
      `;
      return;
    }

    const rowsHtml = students.map((st) => {
      let trafficBadge = '<span class="traffic-pill traffic-inactive">⚪ Sin Actividad</span>';
      if (st.performanceStatus === 'good') {
        trafficBadge = '<span class="traffic-pill traffic-good">🟢 Buen Desempeño</span>';
      } else if (st.performanceStatus === 'improving') {
        trafficBadge = '<span class="traffic-pill traffic-improving">🟡 En Progreso</span>';
      } else if (st.performanceStatus === 'needs_help') {
        trafficBadge = '<span class="traffic-pill traffic-help">🔴 Requiere Apoyo</span>';
      }

      return `
        <tr>
          <td>
            <strong style="color:#ffffff;">${escHtml(st.username)}</strong>
            <div style="font-size:0.8rem; color:#94a3b8;">${escHtml(st.email || '-')}</div>
          </td>
          <td><span class="level-chip level-${(st.level || 'b1').toLowerCase()}">${escHtml(st.level || 'B1')}</span></td>
          <td><strong>${st.accuracy}%</strong></td>
          <td>${st.quizzesTaken}</td>
          <td>${st.readingMinutes} min</td>
          <td>${st.streak} d</td>
          <td>${trafficBadge}</td>
          <td style="text-align:right;">
            <button type="button" class="btn-secondary-deck btn-modal-report-stats" data-student-id="${st.id}" data-student-name="${escHtml(st.username)}" style="padding:4px 10px; font-size:0.8rem;">
              Ver Detalle
            </button>
          </td>
        </tr>
      `;
    }).join('');

    reportStudentsTableContainer.innerHTML = `
      <table class="deck-table">
        <thead>
          <tr>
            <th>Estudiante</th>
            <th>Nivel</th>
            <th>Precisión</th>
            <th>Intentos</th>
            <th>Lectura</th>
            <th>Racha</th>
            <th>Estado</th>
            <th style="text-align:right;">Acción</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    reportStudentsTableContainer.querySelectorAll('.btn-modal-report-stats').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-student-id');
        const sname = btn.getAttribute('data-student-name');
        showStudentStatsModal(sid, sname);
      });
    });
  }

  const btnOpenPerformanceModal = document.getElementById('btn-open-performance-modal');
  if (btnOpenPerformanceModal) {
    btnOpenPerformanceModal.addEventListener('click', () => {
      if (!activeClassId) {
        alert('Selecciona una clase primero.');
        return;
      }
      if (activeClassPerformance) {
        renderPerformanceModalContent(activeClassPerformance);
      } else {
        loadClassPerformance(activeClassId);
      }
      openModal('modal-performance-report');
    });
  }

  // ==========================================================================
  // MODAL: DETALLE INDIVIDUAL DEL ESTUDIANTE (ESTADÍSTICAS)
  // ==========================================================================
  async function showStudentStatsModal(studentId, studentName) {
    const titleEl = document.getElementById('modal-student-stats-name');
    const contentEl = document.getElementById('modal-student-stats-content');
    if (titleEl) titleEl.textContent = `Estadísticas de ${studentName}`;
    if (contentEl) contentEl.innerHTML = '<p style="color:#64748b;">Cargando estadísticas...</p>';

    openModal('modal-student-detail-stats');

    try {
      const res = await apiFetch(`/progress/teacher/student/${studentId}/stats-v2`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stats = await res.json();

      const d = stats.dashboard || {};
      const sc = stats.scores || {};
      const win = stats.windowDays != null ? stats.windowDays : 30;

      contentEl.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:14px;">
          <p style="margin:0 0 10px; font-size:0.85rem; color:#64748b;">
            Basado en actividad real del lector interactivo (últimos <strong>${escHtml(win)}</strong> días):
          </p>
          <div class="deck-metric-grid" style="margin-bottom:14px;">
            <div class="deck-metric-box">
              <span class="deck-metric-label">Precisión</span>
              <span class="deck-metric-value" style="color:#4f46e5;">${escHtml(sc.accuracy)}%</span>
            </div>
            <div class="deck-metric-box">
              <span class="deck-metric-label">Puntaje</span>
              <span class="deck-metric-value" style="color:#059669;">${escHtml(sc.overallScore)}</span>
            </div>
            <div class="deck-metric-box">
              <span class="deck-metric-label">Racha</span>
              <span class="deck-metric-value" style="color:#d97706;">${escHtml(d.streak)} días</span>
            </div>
          </div>
          <ul style="margin:0; padding-left:20px; font-size:0.9rem; color:#334155; line-height:1.7;">
            <li><strong>Artículos leídos y completados:</strong> ${escHtml(d.articlesRead)}</li>
            <li><strong>Quizzes / Intentos calificados:</strong> ${escHtml(d.quizzesTaken)}</li>
            <li><strong>Vocabulario guardado (Flashcards):</strong> ${escHtml(d.vocabularyLearned)}</li>
          </ul>
        </div>
      `;
    } catch (err) {
      console.error(err);
      if (contentEl) {
        contentEl.innerHTML = '<p style="color:#dc2626;">No se pudieron cargar las estadísticas del estudiante.</p>';
      }
    }
  }

  // Arranque inicial
  loadTeacherClasses();
});
