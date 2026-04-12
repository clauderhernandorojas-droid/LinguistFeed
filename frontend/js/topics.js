// Definimos la lista maestra de 10 temas (Coincide con RssService.js)
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
    { id: 'lifestyle', name: 'Lifestyle', icon: '🏠', color: '#efebe9' }
];

export function renderTopics() {
    const favoritesGrid = document.getElementById('favorites-grid');
    const othersGrid = document.getElementById('others-grid');
    
    if (!favoritesGrid || !othersGrid) return;

    // 1. Obtener intereses (ej: "tech,gaming")
    const userInterestsRaw = localStorage.getItem('user-interests') || "";
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
        card.style.backgroundColor = topic.color;
        card.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">${topic.icon}</div>
            <strong style="font-size: 1.2rem; color: #2d3748;">${topic.name}</strong>
        `;
        card.onclick = () => window.location.href = `reader.html#topic=${topic.id}`;
        return card;
    };

    // 5. Dibujar en sus respectivos contenedores
    favorites.forEach(t => favoritesGrid.appendChild(createCard(t)));
    others.forEach(t => othersGrid.appendChild(createCard(t)));
}

document.addEventListener('DOMContentLoaded', renderTopics);

export function renderTopics() {
    const grid = document.getElementById('topics-grid');
    if (!grid) return;

    grid.innerHTML = ''; 

    allTopics.forEach(topic => {
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.style.backgroundColor = topic.color;
        card.setAttribute('data-topic', topic.id);
        
        card.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">${topic.icon}</div>
            <strong style="font-size: 1.2rem; color: #2d3748;">${topic.name}</strong>
        `;

        card.onclick = () => {
            // Guardamos la elección y vamos al lector usando el HASH (#)
            // que es lo que tu reader.js entiende
            window.location.href = `reader.html#topic=${topic.id}`;
        };

        grid.appendChild(card);
    });
}

// Ejecutar al cargar
document.addEventListener('DOMContentLoaded', renderTopics);