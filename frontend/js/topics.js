// Definimos la lista maestra de temas (alineada con onboarding joven/adulto y RssService.js)
const allTopics = [
    { id: 'classroom', name: 'Classroom', icon: '👨‍🏫', color: '#fff9c4', special: true },
    { id: 'news', name: 'Global News', icon: '🌎', color: '#e3f2fd' },
    { id: 'business', name: 'Business', icon: '💼', color: '#f3e5f5' },
    { id: 'tech', name: 'Technology', icon: '💻', color: '#e8f5e9' },
    { id: 'science', name: 'Science', icon: '🔬', color: '#e0f2f1' },
    { id: 'history', name: 'History', icon: '📜', color: '#fff8e1' },
    { id: 'culture', name: 'Culture', icon: '🎨', color: '#fce4ec' },
    { id: 'gaming', name: 'Gaming', icon: '🎮', color: '#ede7f6' },
    { id: 'trends', name: 'Pop Culture', icon: '✨', color: '#fff3e0' },
    { id: 'health', name: 'Health', icon: '🏥', color: '#f1f8e9' },
    { id: 'lifestyle', name: 'Lifestyle', icon: '🏠', color: '#efebe9' },
    { id: 'edu', name: 'Education', icon: '📚', color: '#f0f4c3' },
    { id: 'travel', name: 'Travel', icon: '✈️', color: '#ffe0b2' },
    { id: 'movies', name: 'Movies & Series', icon: '🎬', color: '#d1c4e9' }
];

export function renderTopics() {
    const favoritesGrid = document.getElementById('favorites-grid');
    const othersGrid = document.getElementById('others-grid');
    
    if (!favoritesGrid || !othersGrid) return;

    // 1. Obtener intereses (ej: "tech,gaming"); mismo fallback que topics.html anterior
    const userInterestsRaw = localStorage.getItem('user-interests') || "tech,science";
    const userInterests = userInterestsRaw.split(',').map(i => i.trim().toLowerCase());

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

    // 4. Función auxiliar para crear la tarjeta (para no repetir código)
    const createCard = (topic) => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">${topic.icon}</div>
            <strong style="font-size: 1.2rem; color: #eef2ff;">${topic.name}</strong>
        `;
        card.onclick = () => window.location.href = `reader.html#topic=${topic.id}`;
        return card;
    };

    // 5. Dibujar en sus respectivos contenedores
    favorites.forEach(t => favoritesGrid.appendChild(createCard(t)));
    others.forEach(t => othersGrid.appendChild(createCard(t)));
}
