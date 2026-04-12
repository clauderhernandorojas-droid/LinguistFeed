/**
 * dashboard.js - Handles dashboard functionality
 * 
 * This module provides functions for displaying user progress and dashboard information.
 */

import { fetchUserProgress } from './api.js';
import { getUser, requireAuth } from './auth.js';

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
    
    // Update vocabulary learned count
    const vocabularyLearnedElement = document.getElementById('vocabulary-learned');
    if (vocabularyLearnedElement) {
        vocabularyLearnedElement.textContent = progressData.vocabularyLearned;
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
function displayUserInfo() {
    const user = getUser();
    
    // Update user name
    const userNameElement = document.getElementById('user-name');
    if (userNameElement && user) {
        userNameElement.textContent = user.name;
    }
}

/**
 * Initializes the dashboard page
 * Fetches user progress and displays dashboard information
 */
async function initDashboard() {
    requireAuth();
    displayUserInfo();
    
    try {
        const user = getUser();
        if (user) {
            // 1. Cargamos las estadísticas (lo que ya tenías)
            const progressData = await fetchUserProgress(user.id);
            displayUserProgress(progressData);

            // 2. 🚀 NUEVO: Cargamos el Feed Personalizado
            await loadPersonalizedFeed(); 
        }
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

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