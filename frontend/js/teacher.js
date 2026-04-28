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
  mountNavbar('teacher', '../../');
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      logout();
    });
  }
  let selectedStudent = null;
  let activeClassroom = null;
  let activeClassStudents = [];
  const selectedStudentMsg = document.getElementById('selected-student-msg');
  const activeClassMsg = document.getElementById('active-class-msg');
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const classSelect = document.getElementById('classSelect');
  const classMeta = document.getElementById('class-meta');
  const classStudentsResults = document.getElementById('class-students-results');
  const classStudentFilter = document.getElementById('classStudentFilter');

  const setSelectedStudent = (student) => {
    selectedStudent = student;
    if (selectedStudentMsg) {
      const cls = activeClassroom?.name ? ` · Clase activa: ${activeClassroom.name}` : '';
      selectedStudentMsg.textContent = `Asignando a: ${student.username} (id ${student.id})${cls}`;
    }
  };

  const setActiveClassroom = (classroom) => {
    activeClassroom = classroom || null;
    if (activeClassMsg) {
      if (activeClassroom?.name) {
        activeClassMsg.textContent = `Clase activa: ${activeClassroom.name} (${activeClassroom.inviteCode || '-'})`;
      } else {
        activeClassMsg.textContent = 'Clase activa: ninguna';
      }
    }
  };

  async function showStudentStats(student) {
    setSelectedStudent(student);
    try {
      const res = await fetch(
        `${API_BASE_URL}/progress/teacher/student/${student.id}/stats-v2`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stats = await res.json();

      const statsDiv = document.getElementById('student-stats');
      if (!statsDiv) return;

      const d = stats.dashboard || {};
      const sc = stats.scores || {};
      const win = stats.windowDays != null ? stats.windowDays : 30;

      statsDiv.innerHTML = `
        <h4>Estadísticas de ${escHtml(student.username)}</h4>
        <p style="font-size:0.9rem;color:#4a5568;margin:8px 0;">
          Basado en actividad del lector (answer_events), últimos <strong>${escHtml(win)}</strong> días.
        </p>
        <ul>
          <li>Artículos completados: ${escHtml(d.articlesRead)}</li>
          <li>Respuestas / intentos contados: ${escHtml(d.quizzesTaken)}</li>
          <li>Precisión: ${escHtml(sc.accuracy)}%</li>
          <li>Puntuación general: ${escHtml(sc.overallScore)}</li>
          <li>Vocabulario guardado (total): ${escHtml(d.vocabularyLearned)}</li>
          <li>Racha (días seguidos con actividad): ${escHtml(d.streak)}</li>
        </ul>
      `;
    } catch (err) {
      console.error('Error al obtener estadísticas', err);
      const statsDiv = document.getElementById('student-stats');
      if (statsDiv) {
        statsDiv.innerHTML =
          '<p style="color:#c00;">No se pudieron cargar las estadísticas.</p>';
      }
    }
  }

  function renderStudentPicker(students, container, emptyMessage, options = {}) {
    const { includeSelectButton = false } = options;
    container.innerHTML = '';
    if (!Array.isArray(students) || students.length === 0) {
      container.textContent = emptyMessage;
      return;
    }

    students.forEach((student) => {
      const userDiv = document.createElement('div');
      userDiv.style.marginTop = '8px';
      userDiv.style.display = 'flex';
      userDiv.style.alignItems = 'center';
      userDiv.style.gap = '8px';
      userDiv.style.flexWrap = 'wrap';

      const label = document.createElement('span');
      label.textContent = `${student.username} (${student.email || 'sin email'}) — id: ${student.id}`;

      const statsBtn = document.createElement('button');
      statsBtn.type = 'button';
      statsBtn.textContent = 'Ver Estadísticas';
      statsBtn.className = 'btn-search';
      statsBtn.addEventListener('click', () => showStudentStats(student));

      if (includeSelectButton) {
        const selectBtn = document.createElement('button');
        selectBtn.type = 'button';
        selectBtn.textContent = 'Seleccionar';
        selectBtn.className = 'btn-search';
        selectBtn.addEventListener('click', () => setSelectedStudent(student));
        userDiv.appendChild(selectBtn);
      }

      userDiv.appendChild(label);
      userDiv.appendChild(statsBtn);
      container.appendChild(userDiv);
    });
  }

  function renderActiveClassStudents() {
    if (!classStudentsResults) return;
    const q = String(classStudentFilter?.value || '').trim().toLowerCase();
    const filtered = q
      ? activeClassStudents.filter((s) => {
          const name = String(s.username || '').toLowerCase();
          const email = String(s.email || '').toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : activeClassStudents;
    const emptyMsg = q
      ? 'No hay alumnos en esta clase que coincidan con el filtro.'
      : 'Esta clase aún no tiene alumnos.';
    renderStudentPicker(filtered, classStudentsResults, emptyMsg, { includeSelectButton: true });
  }

  async function loadStudentsForClass(classId) {
    if (!Number.isInteger(classId) || classId <= 0) {
      setActiveClassroom(null);
      activeClassStudents = [];
      renderActiveClassStudents();
      if (classMeta) classMeta.textContent = 'Selecciona una clase primero.';
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/classes/${classId}/students`, {
        headers: authHeaders
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const classroom = data?.class || null;
      const students = Array.isArray(data?.students) ? data.students : [];
      setActiveClassroom(classroom);
      activeClassStudents = students;
      if (classMeta) {
        classMeta.textContent = `Clase: ${classroom?.name || '-'} · Código: ${classroom?.inviteCode || '-'} · Alumnos: ${students.length}`;
      }
      renderActiveClassStudents();
    } catch (err) {
      console.error(err);
      if (classMeta) classMeta.textContent = `Error al cargar alumnos: ${err.message || 'error'}`;
    }
  }

  async function loadTeacherClasses() {
    if (!classSelect || !classMeta) return;
    classSelect.innerHTML = '<option value="">Selecciona una clase</option>';
    classMeta.textContent = '';
    try {
      const res = await fetch(`${API_BASE_URL}/classes/my`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const classes = Array.isArray(data?.classes) ? data.classes : [];
      classes.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        const count = c.studentsCount != null ? ` · ${c.studentsCount} alumnos` : '';
        opt.textContent = `${c.name} (${c.inviteCode})${count}`;
        classSelect.appendChild(opt);
      });
      if (classes.length === 0) {
        classMeta.textContent = 'Aún no tienes clases. Crea una para generar código de invitación.';
        setActiveClassroom(null);
        activeClassStudents = [];
        renderActiveClassStudents();
      } else if (classSelect) {
        classSelect.value = String(classes[0].id);
        await loadStudentsForClass(parseInt(classSelect.value, 10));
      }
    } catch (err) {
      console.error('Error al listar clases', err);
      classMeta.textContent = 'No se pudieron cargar las clases.';
    }
  }

  const searchBtn = document.getElementById('searchButton');
  const resultsDiv = document.getElementById('results');
  if (searchBtn && resultsDiv) {
    searchBtn.addEventListener('click', async () => {
      const q = document.getElementById('searchInput')?.value.trim() || '';
      resultsDiv.innerHTML = '';

      if (!q) {
        resultsDiv.textContent = 'Escribe un nombre o email para buscar.';
        return;
      }

      try {
        const url = `${API_BASE_URL}/users?username=${encodeURIComponent(q)}`;
        const response = await fetch(url, { headers: authHeaders });
        if (!response.ok) {
          resultsDiv.textContent = 'Error al obtener usuarios.';
          return;
        }

        const users = await response.json();
        const students = Array.isArray(users)
          ? users.filter((u) => u.role === 'student')
          : [];
        renderStudentPicker(students, resultsDiv, 'No hay estudiantes que coincidan.');
      } catch (err) {
        console.error(err);
        resultsDiv.textContent = 'Error de red al buscar.';
      }
    });
  }

  const createClassButton = document.getElementById('createClassButton');
  const classNameInput = document.getElementById('classNameInput');
  const classCreateStatus = document.getElementById('class-create-status');
  if (createClassButton && classNameInput && classCreateStatus) {
    createClassButton.addEventListener('click', async () => {
      const name = classNameInput.value.trim();
      classCreateStatus.textContent = '';
      if (!name) {
        classCreateStatus.style.color = '#c00';
        classCreateStatus.textContent = 'Escribe un nombre para la clase.';
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/classes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({ name })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        classCreateStatus.style.color = 'green';
        classCreateStatus.textContent = `Clase creada. Código de invitación: ${data?.class?.inviteCode || '-'}`;
        classNameInput.value = '';
        await loadTeacherClasses();
      } catch (err) {
        classCreateStatus.style.color = '#c00';
        classCreateStatus.textContent = `No se pudo crear la clase: ${err.message || 'error'}`;
      }
    });
  }

  const loadClassStudentsButton = document.getElementById('loadClassStudentsButton');
  if (loadClassStudentsButton && classSelect && classStudentsResults && classMeta) {
    loadClassStudentsButton.addEventListener('click', async () => {
      const classId = parseInt(classSelect.value, 10);
      await loadStudentsForClass(classId);
    });
  }

  if (classSelect) {
    classSelect.addEventListener('change', async () => {
      const classId = parseInt(classSelect.value, 10);
      await loadStudentsForClass(classId);
    });
  }

  if (classStudentFilter) {
    classStudentFilter.addEventListener('input', () => {
      renderActiveClassStudents();
    });
  }

  loadTeacherClasses();

  const submitBtn = document.getElementById('submitTaskButton');
  const statusMsg = document.getElementById('status-msg');
  if (submitBtn && statusMsg) {
    submitBtn.addEventListener('click', async () => {
      const title = document.getElementById('title')?.value.trim() || '';
      const topic = document.getElementById('topic')?.value.trim() || '';
      const content = document.getElementById('content')?.value.trim() || '';

      const headers = {
        'Content-Type': 'application/json',
        ...authHeaders
      };

      const body = {
        title: title || undefined,
        topic: 'classroom',
        content: content || undefined,
        studentId: selectedStudent ? selectedStudent.id : undefined
      };

      try {
        const res = await fetch(`${API_BASE_URL}/articles/manual-upload`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          statusMsg.style.color = 'green';
          if (selectedStudent) {
            statusMsg.textContent = (data.message || '✅ Artículo publicado correctamente.') + ` → ${selectedStudent.username}`;
          } else {
            statusMsg.textContent = (data.message || '✅ Artículo publicado correctamente.') + ' (Classroom general)';
          }
        } else {
          statusMsg.style.color = 'red';
          statusMsg.textContent = data.error || '❌ Error al publicar.';
        }
      } catch (e) {
        console.error(e);
        statusMsg.style.color = 'red';
        statusMsg.textContent = '❌ Error de red.';
      }
    });
  }
});
