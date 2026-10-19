/**
 * auth.js - Handles user authentication
 *
 * ES module: exporta login, registro, sesión y utilidades de usuario.
 */
import { API_BASE_URL } from './config.js';

const USER_STORAGE_KEY = 'linguistfeed_user';

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function readStoredUser() {
  const token = localStorage.getItem('token');
  if (token && isTokenExpired(token)) {
    console.warn('⚠️ Sesión expirada (token JWT caducó).');
    localStorage.removeItem('token');
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }

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
  const token = localStorage.getItem('token');
  if (!token || isTokenExpired(token)) return false;
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

  const age = document.getElementById('user-age')?.value || localStorage.getItem('userAge') || '25';
  const level = document.getElementById('user-level')?.value || localStorage.getItem('userLevel') || 'B1';

  const selectedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked'))
    .map(cb => cb.value);

  const dailyGoalInput = document.getElementById('daily-goal-input');
  const dailyGoalMinutes = parseInt(dailyGoalInput?.value || localStorage.getItem('daily_goal_minutes') || '15', 10) || 15;
  const weeklyReadingGoalMinutes = dailyGoalMinutes * 7;

  if (selectedInterests.length < 2) {
    alert("Por favor, elige al menos 2 temas de tu interés.");
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
      const dailyGoalInput = document.getElementById('daily-goal-input');
      const dailyGoalMinutes = parseInt(dailyGoalInput?.value || '15', 10) || 15;

      await fetch(`${API_BASE_URL}/users/me/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weeklyReadingGoalMinutes,
          dailyGoalMinutes,
          daily_goal_minutes: dailyGoalMinutes
        })
      }).catch((err) => {
        console.warn('No se pudo guardar la meta semanal/diaria:', err?.message || err);
      });

      localStorage.setItem('userLevel', level);
      localStorage.setItem('userAge', age);
      localStorage.setItem('user-interests', selectedInterests.join(','));
      localStorage.setItem('weeklyReadingGoalMinutes', String(weeklyReadingGoalMinutes));
      localStorage.setItem('daily_goal_minutes', String(dailyGoalMinutes));
      const stored = readStoredUser();
      if (stored) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
          ...stored,
          age: Number(age),
          level,
          interests: selectedInterests.join(','),
          daily_goal_minutes: dailyGoalMinutes,
          onboardingCompleted: true
        }));
      }
      document.getElementById('onboarding-modal').style.display = 'none';
      alert('¡Perfil actualizado con tu meta de lectura!');
    } else {
      const errorData = await profileResponse.json();
      console.error("❌ Error del servidor:", errorData);
    }
  } catch (error) {
    console.error('🔥 Error en el fetch:', error);
  }
}

export const OFFICIAL_TOPICS = [
  { id: 'science', name: 'Science', icon: '🔬' },
  { id: 'tech', name: 'Technology', icon: '💻' },
  { id: 'history', name: 'History', icon: '📜' },
  { id: 'culture', name: 'Culture', icon: '🎨' },
  { id: 'trends', name: 'Pop Culture', icon: '✨' },
  { id: 'movies', name: 'Movies & Series', icon: '🎬' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'lifestyle', name: 'Lifestyle', icon: '🏡' },
  { id: 'health', name: 'Health', icon: '🏥' },
  { id: 'edu', name: 'Education', icon: '📚' },
  { id: 'classroom', name: 'Classroom', icon: '🧑‍🏫' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'news', name: 'Global News', icon: '🌍' }
];

export function normalizeTopicId(t) {
  const map = {
    technology: 'tech',
    pop_culture: 'trends',
    'pop-culture': 'trends',
    movies_series: 'movies',
    'movies-series': 'movies',
    education: 'edu',
    global_news: 'news',
    'global-news': 'news',
    world: 'news'
  };
  return map[t] || t;
}

export function updateInterests(savedInterests = null) {
  const interestsGrid = document.getElementById('interests-grid');
  const interestsSection = document.getElementById('interests-section');
  if (!interestsGrid) return;
  interestsGrid.innerHTML = '';

  const currentSavedRaw = savedInterests !== null
    ? savedInterests
    : (localStorage.getItem('user-interests') || '');

  const currentSavedList = (Array.isArray(currentSavedRaw) ? currentSavedRaw : currentSavedRaw.split(','))
    .map(s => normalizeTopicId(String(s).trim().toLowerCase()))
    .filter(Boolean);

  OFFICIAL_TOPICS.forEach(topic => {
    const card = document.createElement('label');
    card.className = 'interest-card-item';
    const isChecked = currentSavedList.includes(topic.id.toLowerCase());
    if (isChecked) card.classList.add('selected');

    card.innerHTML = `
      <input type="checkbox" name="interest" value="${topic.id}" style="display:none" ${isChecked ? 'checked' : ''}>
      <div class="card-content">
          <span class="icon">${topic.icon}</span>
          <span class="name">${topic.name}</span>
      </div>
    `;

    card.addEventListener('change', (e) => {
      card.classList.toggle('selected', e.target.checked);
    });

    interestsGrid.appendChild(card);
  });

  if (interestsSection) interestsSection.style.display = 'block';
}

function initOnboarding() {
  const modal = document.getElementById('onboarding-modal');
  const form = document.getElementById('onboarding-form');
  const ageInput = document.getElementById('user-age');
  const interestsSection = document.getElementById('interests-section');
  const interestsGrid = document.getElementById('interests-grid');

  if (form) form.addEventListener('submit', handleOnboarding);

  const maybeShowOnboarding = async () => {
    if (!modal) return;
    const token = localStorage.getItem('token');
    const stored = readStoredUser();
    if (!token) return;

    // Si localmente ya detectamos que no ha completado el onboarding, mostramos el modal inmediatamente
    if (stored && !hasCompletedOnboarding(stored)) {
      modal.style.display = 'flex';
    }

    if (!stored?.id) return;

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
        if (fullUser.interests != null) {
          localStorage.setItem('user-interests', String(fullUser.interests));
          updateInterests(fullUser.interests);
        }
      } else {
        modal.style.display = 'none';
        if (fullUser.level) localStorage.setItem('userLevel', String(fullUser.level));
        if (fullUser.age != null) localStorage.setItem('userAge', String(fullUser.age));
        if (fullUser.interests != null) {
          localStorage.setItem('user-interests', String(fullUser.interests));
          updateInterests(fullUser.interests);
        }
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

  // Inicializar los 14 temas inmediatamente para que la lista esté completa y visible
  updateInterests();

  // Funciones de cierre del modal (Botón X, Botón Cancelar, Backdrop click y Escape)
  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  const closeBtn = document.getElementById('onboarding-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  const cancelBtn = document.getElementById('onboarding-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      closeModal();
    }
  });

  // Interacción de tarjetas para meta diaria (10, 15, 20, 30 min)
  const goalCards = document.querySelectorAll('.daily-goal-card');
  const goalInput = document.getElementById('daily-goal-input');
  if (goalCards.length > 0) {
    const savedGoal = localStorage.getItem('daily_goal_minutes') || '15';
    if (goalInput) goalInput.value = savedGoal;
    goalCards.forEach((card) => {
      if (card.dataset.minutes === savedGoal) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
      card.addEventListener('click', () => {
        goalCards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        if (goalInput) goalInput.value = card.dataset.minutes || '15';
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnboarding);
} else {
  initOnboarding();
}
