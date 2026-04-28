/**
 * auth.js - Handles user authentication
 *
 * ES module: exporta login, registro, sesión y utilidades de usuario.
 */
import { API_BASE_URL } from './config.js';

const USER_STORAGE_KEY = 'linguistfeed_user';

function readStoredUser() {
  const userJson = localStorage.getItem(USER_STORAGE_KEY);
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
}

function hasCompletedOnboarding(user) {
  if (!user) return false;
  if (typeof user.onboardingCompleted === 'boolean') return user.onboardingCompleted;
  if (user.onboarding_completed != null) return Number(user.onboarding_completed) === 1;
  const level = String(user.level || '').trim();
  const ageNum = Number(user.age);
  const interests = String(user.interests || '').trim();
  return (
    !!level &&
    Number.isFinite(ageNum) &&
    ageNum >= 15 &&
    interests.length > 0
  );
}

export async function getUser() {
  return readStoredUser();
}

export function isLoggedIn() {
  return !!readStoredUser();
}

export async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('token', data.token);
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

export async function register(email, password, name) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
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

export function logout() {
  const keysToRemove = [
    USER_STORAGE_KEY,
    'token',
    'userLevel',
    'user-level',
    'userAge',
    'user-interests',
    'weeklyReadingGoalMinutes',
    'selectedTopic',
    'selectedArticleId'
  ];
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith('temp-level-')) localStorage.removeItem(k);
  });
  window.location.href = '/login.html';
}

export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href =
      '/login.html?redirect=' + encodeURIComponent(window.location.href);
  }
}

async function handleOnboarding(event) {
  event.preventDefault();

  const age = document.getElementById('user-age').value;
  const level = document.getElementById('user-level').value;
  const weeklyGoalSelect = document.getElementById('weekly-goal-select');
  const weeklyGoalCustom = document.getElementById('weekly-goal-custom');

  const selectedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked'))
    .map(cb => cb.value);

  const selectedGoal = weeklyGoalSelect ? weeklyGoalSelect.value : '60';
  const goalRaw = selectedGoal === 'custom'
    ? (weeklyGoalCustom ? weeklyGoalCustom.value : '')
    : selectedGoal;
  const weeklyReadingGoalMinutes = parseInt(String(goalRaw), 10);

  if (selectedInterests.length < 2) {
    alert("Por favor, elige al menos 2 temas de tu interés.");
    return;
  }
  if (!Number.isInteger(weeklyReadingGoalMinutes) || weeklyReadingGoalMinutes < 15 || weeklyReadingGoalMinutes > 600) {
    alert("La meta semanal debe ser un número entre 15 y 600 minutos.");
    return;
  }

  const token = localStorage.getItem('token');

  try {
    const profileResponse = await fetch(`${API_BASE_URL}/auth/update-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ age, level, interests: selectedInterests.join(',') })
    });

    if (profileResponse.ok) {
      await fetch(`${API_BASE_URL}/users/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ weeklyReadingGoalMinutes })
      }).catch((err) => {
        console.warn('No se pudo guardar la meta semanal:', err?.message || err);
      });

      localStorage.setItem('userLevel', level);
      localStorage.setItem('userAge', age);
      localStorage.setItem('user-interests', selectedInterests.join(','));
      localStorage.setItem('weeklyReadingGoalMinutes', String(weeklyReadingGoalMinutes));
      const stored = readStoredUser();
      if (stored) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
          ...stored,
          age: Number(age),
          level,
          interests: selectedInterests.join(','),
          onboardingCompleted: true
        }));
      }
      document.getElementById('onboarding-modal').style.display = 'none';
      alert('¡Perfil actualizado!');
    } else {
      const errorData = await profileResponse.json();
      console.error("❌ Error del servidor:", errorData);
    }
  } catch (error) {
    console.error('🔥 Error en el fetch:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('onboarding-modal');
  const form = document.getElementById('onboarding-form');
  const ageInput = document.getElementById('user-age');
  const weeklyGoalSelect = document.getElementById('weekly-goal-select');
  const weeklyGoalCustom = document.getElementById('weekly-goal-custom');
  const interestsSection = document.getElementById('interests-section');
  const interestsGrid = document.getElementById('interests-grid');

  if (form) form.addEventListener('submit', handleOnboarding);

  const maybeShowOnboarding = async () => {
    if (!modal) return;
    const token = localStorage.getItem('token');
    const stored = readStoredUser();
    if (!token || !stored?.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${stored.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        modal.style.display = 'flex';
        return;
      }
      const fullUser = await response.json();
      if (!hasCompletedOnboarding(fullUser)) {
        modal.style.display = 'flex';
      } else {
        if (fullUser.level) localStorage.setItem('userLevel', String(fullUser.level));
        if (fullUser.age != null) localStorage.setItem('userAge', String(fullUser.age));
        if (fullUser.interests != null) localStorage.setItem('user-interests', String(fullUser.interests));
        const storedUser = readStoredUser();
        if (storedUser) {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
            ...storedUser,
            age: fullUser.age,
            level: fullUser.level,
            interests: fullUser.interests,
            onboardingCompleted: true
          }));
        }
      }
    } catch (_) {
      // no bloquear flujo por error de red
    }
  };
  maybeShowOnboarding();
  const themes = {
    young: [
      { id: 'gaming', name: 'Video Juegos & Deportes', icon: '🎮' },
      { id: 'tech', name: 'Tecnología', icon: '💻' },
      { id: 'trends', name: 'Cultura Pop', icon: '✨' },
      { id: 'edu', name: 'Estudios/Carrera', icon: '📚' },
      { id: 'travel', name: 'Aventura', icon: '✈️' },
      { id: 'movies', name: 'Cine y Series', icon: '🎬' }
    ],
    adult: [
      { id: 'business', name: 'Negocios y Economía', icon: '💼' },
      { id: 'news', name: 'Noticias Globales', icon: '🌎' },
      { id: 'health', name: 'Salud y Bienestar', icon: '🏥' },
      { id: 'science', name: 'Ciencia', icon: '🔬' },
      { id: 'history', name: 'Historia y Filo', icon: '📜' },
      { id: 'lifestyle', name: 'Estilo de Vida', icon: '🏠' }
    ]
  };

  function updateInterests(age) {
    if (!interestsGrid) return;
    interestsGrid.innerHTML = '';

    if (age >= 15 && age <= 60) {
      const group = age <= 25 ? themes.young : themes.adult;

      group.forEach(theme => {
        const card = document.createElement('label');
        card.className = 'interest-card-item';
        card.innerHTML = `
                      <input type="checkbox" name="interest" value="${theme.id}" style="display:none">
                      <div class="card-content">
                          <span class="icon">${theme.icon}</span>
                          <span class="name">${theme.name}</span>
                      </div>
                  `;

        card.addEventListener('change', (e) => {
          card.classList.toggle('selected', e.target.checked);
        });

        interestsGrid.appendChild(card);
      });

      if (interestsSection) interestsSection.style.display = 'block';
    }
  }

  ageInput?.addEventListener('input', (e) => {
    const age = parseInt(e.target.value, 10);
    updateInterests(age);
  });

  if (weeklyGoalSelect && weeklyGoalCustom) {
    const toggleCustomGoalInput = () => {
      const isCustom = weeklyGoalSelect.value === 'custom';
      weeklyGoalCustom.style.display = isCustom ? 'block' : 'none';
      if (!isCustom) {
        weeklyGoalCustom.value = '';
      }
    };
    weeklyGoalSelect.addEventListener('change', toggleCustomGoalInput);
    toggleCustomGoalInput();
  }
});
