/**
 * auth.js - Handles user authentication
 * 
 * This module provides functions for user login, registration, and session management.
 */
import { CONFIG } from './config.js';
// Key for storing user data in localStorage
const USER_STORAGE_KEY = 'linguistfeed_user';

/**
 * Checks if a user is currently logged in
 * @returns {boolean} True if a user is logged in, false otherwise
 */
function isLoggedIn() {
    return !!getUser();
}

/**
 * Gets the current logged in user
 * @returns {Object|null} User object if logged in, null otherwise
 */
function getUser() {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!userJson) return null;
    
    try {
        return JSON.parse(userJson);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

/**
 * Logs in a user (placeholder implementation)
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} Promise that resolves to the user data
 */
/**
 * Logs in a user (Real implementation)
 */
async function login(email, password) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // ✅ Guardamos el Token Real
            localStorage.setItem('token', data.token);
            // ✅ Guardamos los datos del usuario
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
            
            return data.user;
        } else {
            throw new Error(data.error || 'Error en el login');
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        throw error;
    }
}

/**
 * Registers a new user (placeholder implementation)
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's name
 * @returns {Promise} Promise that resolves to the user data
 */
async function register(email, password, name) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username: name })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
            return data.user;
        } else {
            throw new Error(data.error || 'Error en el registro');
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        throw error;
    }
}

/**
 * Logs out the current user
 */
function logout() {
    localStorage.removeItem(USER_STORAGE_KEY);
    // Redirect to home page
    window.location.href = 'index.html';
}

/**
 * Redirects to login page if user is not logged in
 * Use this function on pages that require authentication
 */
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    }
}

// Export the functions so they can be imported in other files
export {
    isLoggedIn,
    getUser,
    login,
    register,
    logout,
    requireAuth
};
// frontend/js/auth.js

async function handleOnboarding(event) {
    event.preventDefault();
    
    const age = document.getElementById('user-age').value;
    const level = document.getElementById('user-level').value;
    
    // Capturar los intereses seleccionados
    const selectedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked'))
                                   .map(cb => cb.value);
  
    if (selectedInterests.length < 2) {
      alert("Por favor, elige al menos 2 temas de tu interés.");
      return;
    }
  
    const token = localStorage.getItem('token');
  
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // Enviamos también los intereses como un string (separados por comas)
        body: JSON.stringify({ age, level, interests: selectedInterests.join(',') })
      });
  
      if (response.ok) {
        localStorage.setItem('userLevel', level);
        localStorage.setItem('userAge', age);
        document.getElementById('onboarding-modal').style.display = 'none';
        alert('¡Perfil actualizado!');
      } else {
        const errorData = await response.json();
        console.error("❌ Error del servidor:", errorData);
      }
    } catch (error) {
      console.error('🔥 Error en el fetch:', error);
    }
  }
  
  // Estos sí funcionan aquí porque el navegador sí tiene 'document'
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('onboarding-modal');
    const form = document.getElementById('onboarding-form');
    const ageInput = document.getElementById('user-age');
    const interestsSection = document.getElementById('interests-section');
    const interestsGrid = document.getElementById('interests-grid');
    
    if (form) form.addEventListener('submit', handleOnboarding);
    
    if (!localStorage.getItem('userLevel')) {
      if (modal) modal.style.display = 'flex';
    }
    const themes = {
        young: [
          { id: 'gaming', name: 'Video Juegos & Deportes' },
          { id: 'tech', name: 'Tecnología' },
          { id: 'trends', name: 'Cultura Pop' },
          { id: 'edu', name: 'Estudios/Carrera' },
          { id: 'travel', name: 'Aventura' },
          { id: 'movies', name: 'Cine y Series' }
        ],
        adult: [
          { id: 'business', name: 'Negocios y Economía' },
          { id: 'news', name: 'Noticias Globales' },
          { id: 'health', name: 'Salud y Bienestar' },
          { id: 'science', name: 'Ciencia' },
          { id: 'history', name: 'Historia y Filo' },
          { id: 'lifestyle', name: 'Estilo de Vida' }
        ]
      };
      
      function updateInterests(age) {
          interestsGrid.innerHTML = ''; 
          
          if (age >= 15 && age <= 60) {
              const group = age <= 25 ? themes.young : themes.adult;
              
              group.forEach(theme => {
                  const card = document.createElement('label');
                  card.className = 'interest-card-item'; // Usaremos esta clase para el CSS
                  card.innerHTML = `
                      <input type="checkbox" name="interest" value="${theme.id}" style="display:none">
                      <div class="card-content">
                          <span class="icon">${theme.icon}</span>
                          <span class="name">${theme.name}</span>
                      </div>
                  `;
                  
                  // Efecto visual al hacer clic
                  card.addEventListener('change', (e) => {
                      card.classList.toggle('selected', e.target.checked);
                  });
      
                  interestsGrid.appendChild(card);
              });
              
              interestsSection.style.display = 'block';
          }
      }
      
      // Escuchamos cada vez que el usuario escribe en el campo edad
      ageInput?.addEventListener('input', (e) => {
        const age = parseInt(e.target.value);
        updateInterests(age);
      });
  });