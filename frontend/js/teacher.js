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
  const selectedStudentMsg = document.getElementById('selected-student-msg');
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

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

        if (students.length === 0) {
          resultsDiv.textContent = 'No hay estudiantes que coincidan.';
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
          statsBtn.addEventListener('click', async () => {
            selectedStudent = student;
            if (selectedStudentMsg) {
              selectedStudentMsg.textContent = `Asignando a: ${student.username} (id ${student.id})`;
            }
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
          });

          userDiv.appendChild(label);
          userDiv.appendChild(statsBtn);
          resultsDiv.appendChild(userDiv);
        });
      } catch (err) {
        console.error(err);
        resultsDiv.textContent = 'Error de red al buscar.';
      }
    });
  }

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
        topic: topic || undefined,
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
