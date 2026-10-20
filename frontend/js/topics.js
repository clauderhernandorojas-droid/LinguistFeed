// Definimos la lista maestra de temas con íconos SVG vectoriales limpios (estilo Lucide/Feather)
const allTopics = [
    { 
        id: 'science', 
        name: 'Science', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.36 19.34A2 2 0 0 0 6.09 22h11.82a2 2 0 0 0 1.73-2.66L14 9.31V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>` 
    },
    { 
        id: 'tech', 
        name: 'Technology', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="m9 8-2 2 2 2"/><path d="m15 8 2 2-2 2"/></svg>` 
    },
    { 
        id: 'history', 
        name: 'History', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M6 18V9"/><path d="M10 18V9"/><path d="M14 18V9"/><path d="M18 18V9"/><path d="m2 9 10-6 10 6"/><path d="M4 18h16"/></svg>` 
    },
    { 
        id: 'culture', 
        name: 'Culture', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.992 6.301 17.491 2 12 2z"/></svg>` 
    },
    { 
        id: 'trends', 
        name: 'Pop Culture', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/></svg>` 
    },
    { 
        id: 'movies', 
        name: 'Movies & Series', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="2.18"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="2" x2="7" y1="7" y2="7"/><line x1="2" x2="7" y1="17" y2="17"/><line x1="17" x2="22" y1="17" y2="17"/><line x1="17" x2="22" y1="7" y2="7"/></svg>` 
    },
    { 
        id: 'gaming', 
        name: 'Gaming', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="6"/></svg>` 
    },
    { 
        id: 'travel', 
        name: 'Travel', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>` 
    },
    { 
        id: 'lifestyle', 
        name: 'Lifestyle', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>` 
    },
    { 
        id: 'health', 
        name: 'Health', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5v14"/><path d="M5 12h14"/></svg>` 
    },
    { 
        id: 'edu', 
        name: 'Education', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>` 
    },
    { 
        id: 'classroom', 
        name: 'Classroom', 
        special: true,
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` 
    },
    { 
        id: 'business', 
        name: 'Business', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>` 
    },
    { 
        id: 'news', 
        name: 'Global News', 
        svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>` 
    }
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
        card.className = `topic-card ${topic.special ? 'topic-special' : ''}`;
        card.innerHTML = `
            <div class="topic-icon-wrap">${topic.svg}</div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <span class="topic-name">${topic.name}</span>
                ${topic.special ? '<span class="topic-special-badge">Classroom</span>' : ''}
            </div>
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
