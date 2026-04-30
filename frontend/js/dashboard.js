/**
 * dashboard.js - Handles dashboard functionality
 * 
 * This module provides functions for displaying user progress and dashboard information.
 */

import { getUser, requireAuth, logout } from './auth.js';
import { API_BASE_URL } from './config.js';

/**
 * Displays user progress on the dashboard
 * @param {Object} progressData - The user progress data
 */
function displayUserProgress(progressData) {
    // Update articles read count
    const articlesReadElement = document.getElementById('articles-read');
    if (articlesReadElement) {
        articlesReadElement.textContent = progressData.articlesRead;
    }
    
    // Update quizzes taken count
    const quizzesTakenElement = document.getElementById('quizzes-taken');
    if (quizzesTakenElement) {
        quizzesTakenElement.textContent = progressData.quizzesTaken;
    }
    
    // Update vocabulary learned count (valor real desde GET /api/users/:id)
    const vocabularyLearnedElement = document.getElementById('vocabulary-learned');
    if (vocabularyLearnedElement) {
        const n = progressData.vocabularyLearned;
        vocabularyLearnedElement.textContent = n != null ? String(n) : '0';
    }
    
    // Update streak count
    const streakElement = document.getElementById('streak');
    if (streakElement) {
        streakElement.textContent = progressData.streak;
    }

    const accuracyElement = document.getElementById('accuracy');
    if (accuracyElement) {
        const n = progressData.accuracy;
        accuracyElement.textContent = n != null ? `${Number(n).toFixed(1)}%` : '0.0%';
    }

    const overallScoreElement = document.getElementById('overall-score');
    if (overallScoreElement) {
        const n = progressData.overallScore;
        overallScoreElement.textContent = n != null ? String(Number(n).toFixed(1)) : '0.0';
    }

    const weeklyCard = document.getElementById('weekly-goal-card');
    const weeklyLabel = document.getElementById('weekly-goal-label');
    const weeklyFill = document.getElementById('weekly-goal-fill');
    const weeklyNote = document.getElementById('weekly-goal-note');
    const weeklyGoal = progressData.weeklyGoal || {
        goal: 60,
        current: 0,
        progressPct: 0,
        remaining: 60
    };
    if (weeklyCard && weeklyLabel && weeklyFill && weeklyNote) {
        const goal = Number(weeklyGoal.goal || 60);
        const current = Number(weeklyGoal.current || 0);
        const progressPct = Math.max(0, Math.min(Number(weeklyGoal.progressPct || 0), 100));
        const remainingBase = weeklyGoal.remaining ?? (goal - current) ?? 0;
        const remaining = Math.max(Number(remainingBase), 0);

        weeklyCard.style.display = 'block';
        weeklyLabel.textContent = `${current.toFixed(1)} / ${goal} min`;
        weeklyFill.style.width = `${progressPct}%`;
        weeklyNote.textContent = remaining > 0
            ? `Te faltan ${remaining.toFixed(1)} min para cumplir tu meta semanal.`
            : 'Meta semanal cumplida. ¡Excelente trabajo!';
    }
}

/**
 * Displays user information on the dashboard
 */
function displayUserInfo(user) {
    const userNameElement = document.getElementById('user-name');
    if (userNameElement && user) {
        userNameElement.textContent = user.username || user.name || '';
    }
}

function renderStudentClasses(classes) {
    const list = document.getElementById('student-classes-list');
    if (!list) return;
    if (!Array.isArray(classes) || classes.length === 0) {
        list.innerHTML = '<p style="margin:0;">Aún no estás en ninguna clase.</p>';
        return;
    }

    const items = classes.map((c) => {
        const teacher = c.teacherName ? ` · Profesor: ${c.teacherName}` : '';
        return `<li><strong>${c.name || 'Clase'}</strong> (${c.inviteCode || '-'})${teacher}</li>`;
    }).join('');
    list.innerHTML = `<ul style="margin:0; padding-left:18px;">${items}</ul>`;
}

async function loadStudentClasses(headers) {
    try {
        const res = await fetch(`${API_BASE_URL}/classes/my`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderStudentClasses(Array.isArray(data?.classes) ? data.classes : []);
    } catch (error) {
        const list = document.getElementById('student-classes-list');
        if (list) list.textContent = 'No se pudieron cargar tus clases.';
    }
}

function bindJoinClass(sessionUser, headers) {
    const card = document.getElementById('student-classes-card');
    const codeInput = document.getElementById('join-class-code');
    const joinBtn = document.getElementById('join-class-btn');
    const status = document.getElementById('join-class-status');

    if (!card || !codeInput || !joinBtn || !status) return;

    const role = String(sessionUser?.role || '').toLowerCase();
    if (role && role !== 'student') {
        card.style.display = 'none';
        return;
    }

    joinBtn.addEventListener('click', async () => {
        const code = String(codeInput.value || '').trim().toUpperCase();
        status.textContent = '';
        if (!code) {
            status.style.color = '#c00';
            status.textContent = 'Escribe un código de clase.';
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/classes/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify({ code })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            status.style.color = 'green';
            status.textContent = `Te uniste a la clase: ${data?.class?.name || 'OK'}.`;
            codeInput.value = '';
            await loadStudentClasses(headers);
        } catch (error) {
            status.style.color = '#c00';
            status.textContent = `No se pudo unir a la clase: ${error.message || 'error'}`;
        }
    });
}

function inferExportFilename(response) {
    const header = response.headers.get('Content-Disposition') || '';
    const match = header.match(/filename="([^"]+)"/i);
    if (match && match[1]) return match[1];
    return `linguistfeed-export-${new Date().toISOString().slice(0, 10)}.json`;
}

function bindPrivacyAccountControls(headers) {
    const exportBtn = document.getElementById('export-account-data-btn');
    const deleteBtn = document.getElementById('delete-account-btn');
    const status = document.getElementById('privacy-account-status');
    const deleteModal = document.getElementById('delete-account-modal');
    const deleteInput = document.getElementById('delete-account-confirm-input');
    const deleteConfirmBtn = document.getElementById('delete-account-confirm-btn');
    const deleteCancelBtn = document.getElementById('delete-account-cancel-btn');
    const deleteModalStatus = document.getElementById('delete-account-modal-status');
    if (!exportBtn || !deleteBtn || !status) return;

    exportBtn.addEventListener('click', async () => {
        status.textContent = '';
        try {
            const res = await fetch(`${API_BASE_URL}/users/me/export`, { headers });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            const blob = await res.blob();
            const fileName = inferExportFilename(res);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            status.style.color = 'green';
            status.textContent = 'Exportación completada.';
        } catch (error) {
            status.style.color = '#b91c1c';
            status.textContent = `No se pudo exportar: ${error.message || 'error'}`;
        }
    });

    const closeDeleteModal = () => {
        if (deleteModal) deleteModal.style.display = 'none';
        if (deleteInput) deleteInput.value = '';
        if (deleteModalStatus) deleteModalStatus.textContent = '';
    };

    deleteBtn.addEventListener('click', () => {
        status.textContent = '';
        if (deleteModal) deleteModal.style.display = 'flex';
        if (deleteInput) deleteInput.focus();
    });

    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener('click', () => closeDeleteModal());
    }

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', async () => {
            const confirmText = String(deleteInput?.value || '').trim().toUpperCase();
            if (confirmText !== 'DELETE') {
                if (deleteModalStatus) {
                    deleteModalStatus.style.color = '#b91c1c';
                    deleteModalStatus.textContent = 'Confirmación inválida. Debe ser DELETE.';
                }
                return;
            }
            try {
                const res = await fetch(`${API_BASE_URL}/users/me`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        ...headers
                    },
                    body: JSON.stringify({ confirmText })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }
                alert('Tu cuenta fue borrada correctamente.');
                closeDeleteModal();
                logout();
            } catch (error) {
                if (deleteModalStatus) {
                    deleteModalStatus.style.color = '#b91c1c';
                    deleteModalStatus.textContent = `No se pudo borrar la cuenta: ${error.message || 'error'}`;
                }
            }
        });
    }
}

/**
 * Initializes the dashboard page
 * Fetches user progress and displays dashboard information
 */
async function initDashboard() {
    requireAuth();
    const sessionUser = await getUser();
    displayUserInfo(sessionUser);
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    bindPrivacyAccountControls(headers);

    try {
        if (!sessionUser?.id) return;

        const [userRes, statsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/users/${sessionUser.id}`),
            fetch(`${API_BASE_URL}/progress/stats-v2`, { headers })
        ]);
        if (!userRes.ok) throw new Error(`HTTP ${userRes.status}`);

        const user = await userRes.json();
        const roleUser = {
            ...sessionUser,
            role: user?.role || sessionUser?.role || 'student'
        };
        let statsV2 = null;
        if (statsRes.ok) statsV2 = await statsRes.json();

        const progressData = {
            articlesRead: statsV2?.dashboard?.articlesRead ?? user.articlesRead ?? 0,
            quizzesTaken: statsV2?.dashboard?.quizzesTaken ?? user.quizzesTaken ?? 0,
            vocabularyLearned: statsV2?.dashboard?.vocabularyLearned ?? user.vocabularyLearned ?? 0,
            streak: user.streak ?? 0,
            accuracy: statsV2?.scores?.accuracy ?? 0,
            overallScore: statsV2?.scores?.overallScore ?? 0,
            weeklyGoal: statsV2?.weeklyGoals?.readingMinutes ?? {
                goal: 60,
                current: 0,
                progressPct: 0,
                remaining: 60
            }
        };

        displayUserInfo(user);
        displayUserProgress(progressData);
        bindJoinClass(roleUser, headers);
        await loadStudentClasses(headers);

        await loadPersonalizedFeed();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

export function bindEditProfileButton() {
    const btn = document.getElementById('edit-profile-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        // Abrir el modal de onboarding ya existente
        const modal = document.getElementById('onboarding-modal');
        if (modal) {
            modal.style.display = 'block';
            // Precargar valores actuales desde localStorage
            const age = localStorage.getItem('userAge') || '';
            const level = localStorage.getItem('userLevel') || '';
            const interests = (localStorage.getItem('user-interests') || '').split(',');
            const weeklyGoal = localStorage.getItem('weeklyReadingGoalMinutes') || '60';

            const ageInput = document.getElementById('user-age');
            const levelSelect = document.getElementById('user-level');
            const weeklyGoalSelect = document.getElementById('weekly-goal-select');
            const weeklyGoalCustom = document.getElementById('weekly-goal-custom');
            if (ageInput) ageInput.value = age;
            if (levelSelect) levelSelect.value = level;
            if (weeklyGoalSelect && weeklyGoalCustom) {
                const allowed = ['30', '45', '60', '90', '120', '180'];
                if (allowed.includes(weeklyGoal)) {
                    weeklyGoalSelect.value = weeklyGoal;
                    weeklyGoalCustom.style.display = 'none';
                    weeklyGoalCustom.value = '';
                } else {
                    weeklyGoalSelect.value = 'custom';
                    weeklyGoalCustom.style.display = 'block';
                    weeklyGoalCustom.value = weeklyGoal;
                }
            }

            document.querySelectorAll('input[name="interest"]').forEach(cb => {
                cb.checked = interests.includes(cb.value);
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', initDashboard);

// Export the functions so they can be imported in other files
export {
    displayUserProgress,
    displayUserInfo,
    initDashboard
};
/**
 * Busca y muestra artículos basados en los intereses del usuario
 */
async function loadPersonalizedFeed() {
    const token = localStorage.getItem('token');
    const articlesContainer = document.getElementById('articles-grid'); // Asegúrate de que este ID exista en tu HTML

    if (!articlesContainer) return;

    try {
        // Mostramos un mensaje de "Cargando..."
        articlesContainer.innerHTML = '<p>Buscando las mejores lecturas para ti...</p>';

        const response = await fetch('http://localhost:3001/api/articles/personalized-feed', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();

        if (data.articles && data.articles.length > 0) {
            renderArticles(data.articles);
        } else {
            articlesContainer.innerHTML = '<p>No encontramos artículos de tus temas favoritos hoy. ¡Explora otros temas!</p>';
        }
    } catch (error) {
        console.error("Error cargando el feed:", error);
        articlesContainer.innerHTML = '<p>Hubo un error al cargar tus artículos.</p>';
    }
}

/**
 * Dibuja los artículos en el contenedor de forma bonita
 */
function renderArticles(articles) {
    const articlesContainer = document.getElementById('articles-grid');
    if (!articlesContainer) return;

    articlesContainer.innerHTML = ''; // Borramos el "Buscando..."

    articles.forEach(article => {
        // Creamos un resumen corto del contenido
        const preview = article.content ? article.content.substring(0, 100) + '...' : 'No content available';

        const articleCard = `
            <div class="article-card">
                <span class="topic-tag">${article.topic || 'General'}</span>
                <h3 style="font-size: 16px; margin: 0 0 10px 0;" class="article-title">${article.title}</h3>
                <p style="font-size: 14px; color: #666; font-weight: normal; margin-bottom: 15px;">
                    ${preview}
                </p>
                <a href="reader.html?id=${article.id}" class="btn-read">Read Article</a>
            </div>
        `;
        articlesContainer.innerHTML += articleCard;
    });
}