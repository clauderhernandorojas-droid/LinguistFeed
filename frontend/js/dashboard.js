/**
 * dashboard.js - Handles dashboard functionality
 * 
 * This module provides functions for displaying user progress and dashboard information.
 */

import { getUser, requireAuth, logout } from './auth.js';
import { API_BASE_URL } from './config.js';
import { handleLogout } from './reader.js';

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

/**
 * Initializes the dashboard page
 * Fetches user progress and displays dashboard information
 */
async function initDashboard() {
    requireAuth();
    const sessionUser = await getUser();
    displayUserInfo(sessionUser);

    try {
        if (!sessionUser?.id) return;

        const res = await fetch(`${API_BASE_URL}/users/${sessionUser.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const user = await res.json();

        displayUserInfo(user);
        displayUserProgress(user);

        const vocabEl = document.getElementById('vocabulary-learned');
        if (vocabEl) {
            vocabEl.textContent = user.vocabularyLearned != null ? String(user.vocabularyLearned) : '0';
        }

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

            const ageInput = document.getElementById('user-age');
            const levelSelect = document.getElementById('user-level');
            if (ageInput) ageInput.value = age;
            if (levelSelect) levelSelect.value = level;

            document.querySelectorAll('input[name="interest"]').forEach(cb => {
                cb.checked = interests.includes(cb.value);
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    handleLogout(logout);
    initDashboard();
});

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
                <h3 style="font-size: 16px; margin: 0 0 10px 0;">${article.title}</h3>
                <p style="font-size: 14px; color: #666; font-weight: normal; margin-bottom: 15px;">
                    ${preview}
                </p>
                <a href="reader.html?id=${article.id}" class="btn-read">Read Article</a>
            </div>
        `;
        articlesContainer.innerHTML += articleCard;
    });
}