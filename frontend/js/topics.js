// Definimos la lista maestra de temas (alineada con onboarding joven/adulto y RssService.js)
const allTopics = [
    { id: 'science', name: 'Science', icon: '🔬', color: '#e0f2f1' },
    { id: 'tech', name: 'Technology', icon: '💻', color: '#e8f5e9' },
    { id: 'history', name: 'History', icon: '📜', color: '#fff8e1' },
    { id: 'culture', name: 'Culture', icon: '🎨', color: '#fce4ec' },
    { id: 'trends', name: 'Pop Culture', icon: '✨', color: '#fff3e0' },
    { id: 'movies', name: 'Movies & Series', icon: '🎬', color: '#d1c4e9' },
    { id: 'gaming', name: 'Gaming', icon: '🎮', color: '#ede7f6' },
    { id: 'travel', name: 'Travel', icon: '✈️', color: '#ffe0b2' },
    { id: 'lifestyle', name: 'Lifestyle', icon: '🏡', color: '#efebe9' },
    { id: 'health', name: 'Health', icon: '🏥', color: '#f1f8e9' },
    { id: 'edu', name: 'Education', icon: '📚', color: '#f0f4c3' },
    { id: 'classroom', name: 'Classroom', icon: '🧑‍🏫', color: '#fff9c4', special: true },
    { id: 'business', name: 'Business', icon: '💼', color: '#f3e5f5' },
    { id: 'news', name: 'Global News', icon: '🌍', color: '#e3f2fd' }
];

export function getSavedStudentLevel() {
    let storedUser = null;
    try {
        storedUser = JSON.parse(localStorage.getItem('linguistfeed_user') || localStorage.getItem('user') || '{}');
    } catch (_) {}

    const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    // 1. Prioridad: nivel del perfil oficial del estudiante en DB / localStorage
    const rawProfile = storedUser?.level || storedUser?.cefr_level || storedUser?.current_level;
    const profileLevel = rawProfile ? String(rawProfile).toUpperCase().trim() : null;
    if (profileLevel && validLevels.includes(profileLevel)) {
        localStorage.setItem('user_level', profileLevel);
        localStorage.setItem('user-level', profileLevel);
        return profileLevel;
    }

    // 2. Preferencias del usuario (user_level o cefr_level) - NUNCA C2 como preferencia por defecto
    const rawPref = localStorage.getItem('user_level') || localStorage.getItem('cefr_level');
    const prefLevel = rawPref ? String(rawPref).toUpperCase().trim() : null;
    if (prefLevel && validLevels.includes(prefLevel) && prefLevel !== 'C2') {
        localStorage.setItem('user-level', prefLevel);
        return prefLevel;
    }

    // 3. Claves secundarias (userLevel / user-level) - NUNCA C2
    const rawSecondary = localStorage.getItem('userLevel') || localStorage.getItem('user-level');
    const secondaryLevel = rawSecondary ? String(rawSecondary).toUpperCase().trim() : null;
    if (secondaryLevel && validLevels.includes(secondaryLevel) && secondaryLevel !== 'C2') {
        localStorage.setItem('user_level', secondaryLevel);
        return secondaryLevel;
    }

    // 4. Fallback absoluto seguro: B1 (NUNCA C2)
    localStorage.setItem('user_level', 'B1');
    localStorage.setItem('user-level', 'B1');
    return 'B1';
}

export const getStudentLevel = getSavedStudentLevel;
if (typeof window !== 'undefined') {
    window.getSavedStudentLevel = getSavedStudentLevel;
    window.getStudentLevel = getSavedStudentLevel;
}

export function renderTopics() {
    const favoritesGrid = document.getElementById('favorites-grid');
    const othersGrid = document.getElementById('others-grid');
    
    if (!favoritesGrid || !othersGrid) return;

    // 1. Obtener intereses (ej: "tech,gaming"); mismo fallback que topics.html anterior
    const normalizeTopicId = (t) => {
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
    };

    const userInterestsRaw = localStorage.getItem('user-interests') || "tech,science";
    const userInterests = userInterestsRaw.split(',').map(i => normalizeTopicId(i.trim().toLowerCase()));

    favoritesGrid.innerHTML = '';
    othersGrid.innerHTML = '';

    // 2. Dividir los temas en dos grupos
    const favorites = [];
    const others = [];

    allTopics.forEach(topic => {
        if (topic.special || userInterests.includes(topic.id)) {
            favorites.push(topic);
        } else {
            others.push(topic);
        }
    });

    // 3. Asegurar que Classroom es SIEMPRE el primero de los favoritos
    favorites.sort((a, b) => (b.special ? 1 : -1));

    // 4. Función auxiliar para crear la tarjeta (computa el nivel real al hacer clic)
    const createCard = (topic) => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">${topic.icon}</div>
            <strong style="font-size: 1.2rem; color: #eef2ff;">${topic.name}</strong>
        `;
        card.onclick = () => {
            const currentLevel = getSavedStudentLevel();
            window.location.href = `reader.html#topic=${encodeURIComponent(topic.id)}&level=${encodeURIComponent(currentLevel)}`;
        };
        return card;
    };

    // 5. Dibujar en sus respectivos contenedores
    favorites.forEach(t => favoritesGrid.appendChild(createCard(t)));
    others.forEach(t => othersGrid.appendChild(createCard(t)));
}
