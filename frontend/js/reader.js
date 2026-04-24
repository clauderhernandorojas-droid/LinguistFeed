/**
 * reader.js - Lógica principal del lector de artículos de LinguistFeed
 * Versión Unificada y Corregida (Navegación por Hash)
 */

import { fetchDailyArticles, fetchArticleById } from './api.js';
import { API_BASE_URL } from './config.js';

function getStoredUserId() {
    try {
        const raw = localStorage.getItem('linguistfeed_user');
        if (!raw) return null;
        const u = JSON.parse(raw);
        return u.id != null ? Number(u.id) : null;
    } catch {
        return null;
    }
}

// "Guardaespaldas" de navegación: 
// Si por alguna razón algo intenta recargar reader.html sin parámetros,
// o si detectamos que el usuario quiere volver, aseguramos que vaya a topics.html
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'A' && e.target.innerText.includes('Back to Topics')) {
        e.preventDefault();
        window.location.href = 'topics.html';
    }
});

// --- CAPTURADOR DE TRADUCCIÓN ORIGINAL ---
// --- FUNCIÓN GLOBAL DE TRADUCCIÓN PARA TÍTULOS ---
window.handleWordClick = async function(text, event) {
    if (!text) return;
    
    console.log("Traduciendo título con estilo real:", text);

    try {
        const response = await fetch(`${API_BASE_URL}/articles/analyze-text`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                text: text, 
                type: "translate"  // 🎯 Sello de TÍTULO (Correcto aquí)
            })
        });

        const result = await response.json();
        const translation = result.translation || result.text;

        if (translation) {
            // 1. Intentamos usar tu popup elegante
            // En tu proyecto, esta función suele estar en el objeto global 'window'
            if (typeof window.showTranslationPopup === 'function') {
                // Pasamos: (texto_original, traduccion, posicion_X, posicion_Y)
                window.showTranslationPopup(text, translation, event.pageX, event.pageY);
            } 
            // 2. Si por alguna razón no la encuentra, creamos uno rápido con tu estilo
            else {
                renderMiniPopup(text, translation, event);
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
};

// Función de respaldo por si 'showTranslationPopup' no está cargada en esta vista
function renderMiniPopup(original, translated, event) {
    // Si ya hay uno, lo quitamos
    const old = document.getElementById('temp-popup');
    if (old) old.remove();

    const popup = document.createElement('div');
    popup.id = 'temp-popup';
    // Estilo similar al de LinguistFeed
    popup.style = `
        position: absolute;
        left: ${event.pageX}px;
        top: ${event.pageY}px;
        background: white;
        border: 1px solid #ccc;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 150px;
        max-width: 250px;
    `;
    popup.innerHTML = `
        <div style="font-size:0.8rem; color:#666; margin-bottom:4px;">${original}</div>
        <div style="font-weight:bold; color:#007bff;">${translated}</div>
    `;
    document.body.appendChild(popup);

    // Se cierra al hacer clic en cualquier otro lado
    document.addEventListener('click', () => popup.remove(), { once: true });
}

/**
 * Función principal que arranca el lector.
 * Lee el Hash (#) para decidir qué mostrar sin recargar la página.
 */
let savedWordsSet = new Set(); // Aquí guardaremos tus palabras "tesoro"

async function initReader() {
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    
    // 1. Analizar la URL (Hash) - ESTO ES LO MÁS IMPORTANTE
    const hash = window.location.hash.substring(1); 
    const params = new URLSearchParams(hash);
    let articleId = params.get('id');
    if (articleId) {
        // Esto borra comillas, la palabra "id:", espacios y llaves si se colaron
        articleId = articleId.replace(/id|[:"{}\s]/g, '');
        console.log("🆔 ID Limpio y listo:", articleId);
    }
    const topic = params.get('topic');
    
    // Prioridad de nivel: 
    // 1. El que venga en la URL (?level=A1)
    // 2. El que tengamos guardado de antes
    // 3. B1 por defecto
    const levelFromUrl = params.get('level');
    const currentLevel = levelFromUrl || localStorage.getItem('user-level') || 'B1';

    if (!container) return;

    try {
        if (articleId) {
            // Caso A: Mostrar el artículo completo
            // Le pasamos el nivel que detectamos arriba
            await loadFullArticle(articleId, currentLevel);
            
            // Caso modo escucha/lectura
            const userMode = localStorage.getItem('userMode') || 'read';
            if (userMode === 'listen') {
                const wrapper = document.getElementById('article-body-wrapper');
                if (wrapper) wrapper.style.display = 'none';
                if (window.renderAudioControls) window.renderAudioControls();
                setTimeout(() => { if (window.speakArticle) window.speakArticle(); }, 500);
            }
        } else if (topic) {
            await loadDailyArticlesList(topic);
        } else {
            displayTopicSelection();
        }
    } catch (error) {
        console.error("❌ Error en initReader:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Error de conexión.</p>`;
    }
}

/**
 * Muestra la cuadrícula de temas inicial
 */
function displayTopicSelection() {
    const container = document.getElementById('articles-container');
    const levels = document.getElementById('level-selector-container');
    if (levels) levels.innerHTML = ''; 
    
    // Lista completa de 10 temas para que no se vea vacía
    const topics = [
        { id: 'news', icon: '🌎', label: 'News', color: '#e3f2fd' },
        { id: 'business', icon: '💼', label: 'Business', color: '#f3e5f5' },
        { id: 'tech', icon: '💻', label: 'Tech', color: '#e8f5e9' },
        { id: 'science', icon: '🔬', label: 'Science', color: '#e0f2f1' },
        { id: 'history', icon: '📜', label: 'History', color: '#fff8e1' },
        { id: 'culture', icon: '🎨', label: 'Culture', color: '#fce4ec' },
        { id: 'gaming', icon: '🎮', label: 'Gaming', color: '#ede7f6' },
        { id: 'trends', icon: '✨', label: 'Trends', color: '#fff3e0' },
        { id: 'health', icon: '🏥', label: 'Health', color: '#f1f8e9' },
        { id: 'lifestyle', icon: '🏠', label: 'Lifestyle', color: '#efebe9' }
    ];

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top: 30px;">
            ${topics.map(t => `
                <div onclick="window.location.hash = 'topic=${t.id}'" 
                     style="background:${t.color}; padding: 30px; border-radius: 15px; text-align: center; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">${t.icon}</div>
                    <strong style="font-size: 1.2rem; color: #2d3748;">${t.label}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Carga la lista de artículos obtenidos por el scraper real
 */
async function loadDailyArticlesList(filterTopic = null) {
    const container = document.getElementById('articles-container');
    const levels = document.getElementById('level-selector-container');
    const loadingDiv = document.getElementById('loading');

    // 1. Normalizamos el tópico para que no importe si es 'Science' o 'science'
    const urlParams = new URLSearchParams(window.location.hash.replace('#', '?'));
    const topic = (filterTopic || urlParams.get('topic') || 'news').toLowerCase().trim(); 

    console.log("🚀 Lector cargando para el tema:", topic);

    if (levels) levels.innerHTML = '';
    if (loadingDiv) loadingDiv.style.display = 'block';

    try {
        const data = await fetchDailyArticles(topic); 
        const allData = data.articles || data;

        // --- DIAGNÓSTICO MEJORADO ---
        // Miramos todos los temas que llegaron del servidor para ver si hay errores de escritura
        const todosLosTemas = [...new Set(allData.map(a => a.topic))];
        console.log("🔍 Temas disponibles en el servidor:", todosLosTemas);

        // 2. Filtramos ignorando mayúsculas/minúsculas
        const articlesArray = allData.filter(a => 
            a.topic && a.topic.toLowerCase().trim() === topic
        );

        if (loadingDiv) loadingDiv.style.display = 'none';

        if (articlesArray.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px;">No articles available for: <b>${topic}</b></p>`;
            return;
        }

        // 3. Filtro flexible (Mantenemos tu lógica para Culture/Art)
        const filtered = filterTopic 
            ? articlesArray.filter(a => {
                const temaArticulo = a.topic.trim().toLowerCase();
                const temaBuscado = filterTopic.trim().toLowerCase();
                const isMatch = temaArticulo.includes(temaBuscado) || temaBuscado.includes(temaArticulo);
                const isArtCulture = (temaBuscado === 'culture' && temaArticulo.includes('art'));
                return isMatch || isArtCulture;
            })
            : articlesArray;
        
        // Renderizado de la cuadrícula (Tu estructura original)
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <a href="#" onclick="window.location.hash=''; return false;" style="text-decoration:none; color:#007bff; font-weight:bold;">← Back to Topics</a>
                <h2 style="margin-top:10px; text-transform: capitalize;">${topic} Articles</h2>
            </div>
            <div class="articles-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                ${filtered.map(article => {
                    const identifier = article.id || encodeURIComponent(article.url);
                    return `
                    <div class="card" style="border: 1px solid #ddd; padding: 15px; border-radius: 10px;">
                        <div>
                            <span class="badge" style="background:#eee; padding:2px 5px; font-size:0.7rem;">Subtopic: ${article.topic}</span>
                            <h3 style="cursor:pointer;">${article.title}</h3>
                            <p style="font-size: 0.85rem;">${article.content.substring(0, 80)}...</p>
                        </div>
                        <div class="level-selector-inline" style="display: flex; gap: 4px; margin: 10px 0; justify-content: center;">
                            ${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => `
                                <button onclick="setArticleLevel('${identifier}', '${lvl}')" 
                                        id="btn-${identifier}-${lvl}"
                                        class="level-btn ${lvl === (localStorage.getItem('user-level') || 'B1') ? 'active' : ''}"
                                        style="font-size: 0.7rem; padding: 2px 6px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: white;">
                                    ${lvl}
                                </button>
                            `).join('')}
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <a href="#" onclick="goToArticle('${identifier}', 'read'); return false;" style="text-decoration:none; color:#007bff; font-weight:bold;">Read</a>
                            <a href="#" onclick="goToArticle('${identifier}', 'listen'); return false;" style="text-decoration:none; color:#007bff; font-weight:bold;">Listen 🔊</a>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;

        // --- ASIGNAR TRADUCCIÓN A TÍTULOS ---
        container.querySelectorAll('.card h3').forEach(title => {
            title.style.cursor = 'pointer';
            title.onclick = async function(e) {
                e.preventDefault();
                e.stopPropagation();
                const fullTitle = this.innerText.trim();
                if (window.handleWordClick) {
                    window.handleWordClick(fullTitle, e);
                } else {
                    showFlashcardPopup(fullTitle, e.clientX, e.clientY);
                }
            };
        });

    } catch (error) {
        console.error("❌ Error cargando lista:", error);
        if (loadingDiv) loadingDiv.style.display = 'none';
        container.innerHTML = `<p style="color:red; text-align:center;">Error connecting to server.</p>`;
    }
}

/**
 * Carga y renderiza un artículo completo con niveles CEFR
 */
async function loadFullArticle(id, level = null) {
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    const quizContainer = document.getElementById('quiz-container');
    
    if (!container) return;

    // --- PASO 1: LIMPIEZA INMEDIATA ---
    // Esto hace que el artículo viejo desaparezca al instante
    container.innerHTML = ""; 
    if (quizContainer) {
        quizContainer.innerHTML = "";
        quizContainer.style.display = 'none';
    }
    if (loadingDiv) loadingDiv.style.display = 'block';

    // --- PASO 2: DETERMINAR NIVEL ---
    const params = new URLSearchParams(window.location.hash.substring(1));
    const activeLevel = level || params.get('level') || localStorage.getItem('user-level') || 'B1';
    
    // Guardamos la preferencia
    localStorage.setItem('user-level', activeLevel);

    try {
        // --- PASO 3: PETICIÓN AL SERVIDOR ---
        const article = await fetchArticleById(id, activeLevel);
        if (!article) throw new Error('Article not found');

        // Ocultamos el cargando
        if (loadingDiv) loadingDiv.style.display = 'none';

        // --- PASO 4: PINTAR BOTONES Y CONTENIDO ---
        // Llamamos al selector para que el botón correcto se ponga azul
        renderLevelSelector(id, activeLevel);

        // --- PASO 4: PINTAR TODO EL CONTENIDO ---
        container.innerHTML = `
            <div class="article-full">
                <div id="nav-and-title-area" style="margin-bottom: 20px;">
                    <button onclick="window.location.hash='topic=${article.topic}'; return false;" 
                            style="background:none; border:none; color:#007bff; font-weight:bold; cursor:pointer; padding:0;">
                        ← Back to Articles
                    </button>
                    <h1 id="interactive-title" style="margin-top:10px;">${article.title}</h1>
                </div>

                <div id="audio-controls-panel" style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; border: 1px solid #e9ecef;">
                    <div style="flex: 1;">
                        <span style="font-weight: bold; color: #4a5568; display: block; margin-bottom: 5px;">Audio Mode 🎧</span>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; gap: 10px;">
                                <button id="btn-pause" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">⏸ Pause</button>
                                <button id="btn-resume" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">▶ Resume</button>
                                <button id="btn-stop" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">Stop</button>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="range" id="audio-progress" oninput="console.log('¡SOY LA BARRA 1!')" value="0" min="0" max="100" style="flex: 1; cursor: pointer;">
                                <span id="audio-percentage" style="font-size: 12px; color: #718096; min-width: 35px;">0%</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="window.toggleTranscript()" id="toggle-text-btn" style="cursor:pointer; padding: 10px; background: white; border: 1px solid #007bff; color: #007bff; border-radius: 5px; font-weight: bold;">
                        Show Text
                    </button>
                </div>

                <div id="level-selector-container" style="margin-bottom: 25px; padding: 10px; background: #f8fafc; border-radius: 10px;">
                    </div>

                <div id="article-body-wrapper">
                    <div class="article-meta mb-3" style="color: #666; font-size: 0.9rem;">
                        <span class="badge bg-primary" style="padding: 5px 10px;">Current Level: ${activeLevel}</span>
                    </div>
                    <div id="interactive-text" class="article-body-text" style="line-height: 1.8; font-size: 1.1rem;">
                        ${article.content}
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            setupAudioLogic(article.content);
        }, 100);

        // 🦾 PASO 5: Ahora que el contenedor existe arriba, llamamos a la función para llenarlo
        renderLevelSelector(id, activeLevel);
        const titleEl = document.getElementById('interactive-title');
        if (titleEl) {
            titleEl.style.cursor = 'pointer';
            titleEl.onclick = (e) => {
                // Usamos tu función global que ya definiste arriba en reader.js
                if (window.handleWordClick) {
                    window.handleWordClick(article.title, e);
                }
            };
        }
        if (quizContainer) {
            quizContainer.style.display = 'block';
            quizContainer.innerHTML = `
                <div id="quiz-section" class="text-center mt-5 p-4 border-top" style="background: white; border-radius: 10px; border: 1px solid #eaeaea;">
                    <h4>Ready to test your knowledge?</h4>
                    <p class="text-muted mb-3">Based on what you just read or heard.</p>
                    <button id="generate-quiz-btn" class="btn btn-primary btn-lg shadow-sm">
                        🧠 Generate AI Quiz
                    </button>
                    <div id="quiz-results-area" class="mt-4 text-start" style="display:none;"></div>
                </div>
            `;
        }

        // --- INTERACTIVIDAD ---
        const interactiveContainer = document.getElementById('interactive-text');
        if (interactiveContainer && typeof applyHighlights === 'function') {
            applyHighlights(interactiveContainer);
        }
        if (typeof setupTextInteractivity === 'function') {
            setupTextInteractivity(); 
        }

        // Lógica del Quiz... (se mantiene igual que tu código)
        const quizBtn = document.getElementById('generate-quiz-btn');
        if (quizBtn) {
            quizBtn.onclick = async () => {
                const resultsArea = document.getElementById('quiz-results-area');
                quizBtn.disabled = true;
                quizBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
                try {
                    const res = await fetch(`${API_BASE_URL}/generate-quiz-only`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: article.content, level: article.level })
                    });
                    const data = await res.json();
                    if (data.quizzes) {
                        quizBtn.style.display = 'none';
                        resultsArea.style.display = 'block';
                        displayQuiz(data.quizzes, 'quiz-results-area'); 
                    }
                } catch (e) {
                    quizBtn.disabled = false;
                    quizBtn.innerHTML = '❌ Error';
                }
            };
        }

    } catch (error) {
        if (loadingDiv) loadingDiv.style.display = 'none';
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderLevelSelector(currentArticleId, activeLevel) {
    const levelContainer = document.getElementById('level-selector-container');
    if (!levelContainer) return;

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    levelContainer.innerHTML = ''; // Limpiamos antes de pintar
    
    levelContainer.innerHTML = levels.map(level => {
        // Comparación robusta: A1 === A1 o a1 === A1
        const isThisActive = (level.toUpperCase() === activeLevel.toUpperCase());
        
        return `
        <button 
            class="level-btn ${isThisActive ? 'active' : ''}" 
            id="btn-${currentArticleId}-${level}"
            onclick="setArticleLevel('${currentArticleId}', '${level}')"
            style="margin-right: 8px; padding: 5px 15px; cursor: pointer; border-radius: 15px; 
                   border: 1px solid #007bff; 
                   background: ${isThisActive ? '#007bff' : 'white'}; 
                   color: ${isThisActive ? 'white' : '#007bff'};"
        >
            ${level}
        </button>
    `}).join('');
}
/**
 * Configura la interactividad de las palabras
 */
function setupTextInteractivity() {
    const textContainer = document.getElementById('interactive-text');
    if (!textContainer) return;

    textContainer.addEventListener('mouseup', (e) => {
        // Validamos que exista una selección válida como sugirió Cursor
        const selection = window.getSelection();
        
        // Si no hay selección o es un clic accidental sin rango, abortamos
        if (!selection || selection.rangeCount === 0) return;

        const selectedText = selection.toString().trim();

        // CASO A: Selección manual de frase o palabra
        if (selectedText.length > 0) {
            showFlashcardPopup(selectedText, e.clientX, e.clientY);
        } 
        // CASO B: Clic simple (intentamos capturar la palabra bajo el cursor)
        else {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
                selection.removeAllRanges();
                selection.addRange(range);
                selection.modify('move', 'backward', 'word');
                selection.modify('extend', 'forward', 'word');
                const word = selection.toString().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
                
                if (word.length > 2) {
                    showFlashcardPopup(word, e.clientX, e.clientY);
                }
                // Limpiamos la selección automática para no ensuciar la vista
                selection.removeAllRanges();
            }
        }
    });
}

/**
 * Guarda una flashcard en la base de datos real
 */
async function saveFlashcardToStorage() {
    const wordElement = document.getElementById('flashcard-word');
    const exampleElement = document.getElementById('flashcard-example');
    // --- NUEVO: Capturamos la traducción para no perderla ---
    const translationElement = document.getElementById('flashcard-translation'); 
    
    if (!wordElement) return;
    
    const word = wordElement.textContent;
    const example = exampleElement ? exampleElement.textContent : "";
    const translation = translationElement ? translationElement.textContent : "";
    const currentLevel = localStorage.getItem('user-level') || 'B1';

    try {
        const token = localStorage.getItem('token');
        const userId = getStoredUserId();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const payload = {
            word,
            context: `[${translation}] - ${example}`,
            level: currentLevel
        };
        if (userId != null && !Number.isNaN(userId)) payload.user_id = userId;

        console.log('Final URL:', `${API_BASE_URL}/flashcards`);
        const response = await fetch(`${API_BASE_URL}/flashcards`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            console.error("HTTP Error:", response.status, text);
            return;
        }

        if (response.ok) {
            console.log("✅ Flashcard guardada!");
            let localFlashcards = JSON.parse(localStorage.getItem("linguistfeed_flashcards")) || [];
            
            const newCard = {
                word: word,
                translation: translation, // Aquí sí guardamos la traducción limpia
                example: example,
                definition: "Saved from reader",
                date: new Date().toISOString()
            };

            localFlashcards.push(newCard);
            localStorage.setItem("linguistfeed_flashcards", JSON.stringify(localFlashcards));
            console.log("✅ Sincronizado con LocalStorage para Repaso");
            // ACTUALIZACIÓN CRÍTICA: Añadimos la palabra al Set para que se resalte de inmediato
            if (typeof savedWordsSet !== 'undefined') {
                savedWordsSet.add(word.toLowerCase().trim());
                // Opcional: Re-aplicar resaltado en el momento
                const textContainer = document.getElementById('interactive-text');
                if (textContainer) applyHighlights(textContainer);
            }
            
            // Feedback visual para el usuario
            const btn = document.getElementById('save-flashcard-btn');
            if (btn) {
                btn.innerHTML = "✅ Saved!";
                btn.classList.replace('btn-primary', 'btn-success');
                setTimeout(() => {
                    btn.innerHTML = "Save to Flashcards";
                    btn.classList.replace('btn-success', 'btn-primary');
                }, 2000);
            }
        }
    } catch (error) {
        console.error("❌ Error al guardar flashcard:", error);
    }
}
/**
 * Muestra el popup con la palabra, traducción y ejemplo
 */
async function showFlashcardPopup(text, mouseX, mouseY) {

const popup = document.getElementById('flashcard-popup');
const saveBtn = document.getElementById('save-flashcard-btn');
if (saveBtn) {
    saveBtn.onclick = () => window.saveFlashcardToStorage();
}
    if (!popup) return;

    // --- 1. RESETEO TOTAL DE POSICIÓN ---
    // Limpiamos rastros de clics anteriores para evitar conflictos top/bottom
    popup.style.top = 'auto';
    popup.style.bottom = 'auto';
    popup.style.left = 'auto';
    popup.style.display = 'flex'; 

    const viewportHeight = window.innerHeight;
    const popupWidth = 330;  // Coincide con tu CSS
    const margin = 30;

    // --- 2. POSICIONAMIENTO HORIZONTAL ---
    let leftPos = mouseX + 10;
    if (leftPos + popupWidth > window.innerWidth) {
        leftPos = window.innerWidth - popupWidth - 20;
    }
    popup.style.left = `${leftPos}px`;

    // --- 3. POSICIONAMIENTO VERTICAL INTELIGENTE ---
    if (mouseY > viewportHeight / 2) {
        // Mitad inferior: el popup crece hacia ARRIBA (anclado al bottom)
        popup.style.bottom = `${viewportHeight - mouseY + 20}px`;
    } else {
        // Mitad superior: el popup crece hacia ABAJO (anclado al top)
        // --- Lógica de Rebote (Pégalo reemplazando la línea 373) ---
        const popupHeight = 440; 
        const margin = 20;

        // Limpiamos estilos previos para evitar conflictos
        popup.style.top = 'auto';
        popup.style.bottom = 'auto';

        if (mouseY + popupHeight > window.innerHeight) {
            // Si no cabe abajo, lo pegamos al borde inferior con un margen
            popup.style.bottom = `${margin}px`; 
        } else {
            // Si cabe, usamos la posición normal
            popup.style.top = `${mouseY + margin}px`;
        }
    }

    // --- 4. PREPARACIÓN DE LA TARJETA (Limpieza de textos) ---
    document.getElementById('flashcard-word').textContent = text;
    document.getElementById('flashcard-definition').textContent = "Analyzing selection...";
    document.getElementById('flashcard-translation').textContent = "";
    document.getElementById('flashcard-example').textContent = "";

    // --- 5. CONFIGURACIÓN DEL BOTÓN DE AUDIO (TTS) ---
    const ttsBtn = document.getElementById('tts-btn');
    if (ttsBtn) {
        ttsBtn.onclick = (e) => {
            e.stopPropagation();
            
            // 1. Cancelamos cualquier lectura previa para que no se crucen las voces
            window.speechSynthesis.cancel();

            // 2. Creamos el "guion" (utterance)
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9; // Un poquito más lento para B1

            // 🎯 Buscamos la barra y el texto del porcentaje que pusimos en el panel
            const progressBar = document.getElementById('audio-progress');
            const progressLabel = document.getElementById('audio-percentage');

            // 3. 🧠 EL TRUCO: Mientras la IA habla, mueve la barra
            utterance.onboundary = (event) => {
                if (event.name === 'word' && progressBar) {
                    const charIndex = event.charIndex;
                    const totalChars = text.length;
                    const percentage = Math.floor((charIndex / totalChars) * 100);
                    
                    progressBar.value = percentage;
                    if (progressLabel) progressLabel.innerText = percentage + "%";
                }
            };

            // 4. 🚀 EL "SEEK": Si el estudiante mueve la barra, saltamos en el texto
            if (progressBar) {
                progressBar.oninput = () => {
                    window.speechSynthesis.cancel(); // Detenemos la lectura actual
                    
                    const percentage = progressBar.value;
                    const startIndex = Math.floor((text.length * percentage) / 100);
                    
                    // Creamos una nueva locución desde el punto elegido
                    const newStart = new SpeechSynthesisUtterance(text.substring(startIndex));
                    newStart.lang = 'en-US';
                    newStart.rate = 0.9;
                    
                    // Le pasamos el mismo truco de la barra a la nueva lectura
                    newStart.onboundary = utterance.onboundary; 
                    
                    window.speechSynthesis.speak(newStart);
                };
            }

            window.speechSynthesis.speak(utterance);
        };
    }

    // --- 6. LLAMADA A LA IA ---
    try {
        // Dentro de handleWordClick Y dentro de showFlashcardPopup:
        // En reader.js -> showFlashcardPopup
        const response = await fetch(`${API_BASE_URL}/articles/analyze-text`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                text: text, 
                type: "word"  // 🎯 Sello de PALABRA (Esto arregla el error)
            })
        });
        const data = await response.json();
        
        // Rellenamos con los datos finales
        document.getElementById('flashcard-definition').textContent = data.definition || "No definition found";
        document.getElementById('flashcard-translation').textContent = data.translation || "No translation found";
        
        const exElem = document.getElementById('flashcard-example');
        if (exElem) {
            // Si hay ejemplo, lo mostramos; si no, ponemos un contexto genérico
            exElem.textContent = data.example || `Context: "${text}"`;
        }
    } catch (error) {
        console.error("Error al analizar texto:", error);
        document.getElementById('flashcard-definition').textContent = "Service error. Please try again.";
    }
}

/**
 * Cierra el popup
 */
function closeFlashcardPopup() {
    const popup = document.getElementById('flashcard-popup');
    if (popup) popup.style.display = 'none';
}

/**
 * Agrega el escuchador de selección de texto a cualquier elemento
 */
function attachTranslationListener(element) {
    if (!element) return;

    element.addEventListener('mouseup', (e) => {
        const selection = window.getSelection();
        let selectedText = selection.toString().trim();

        // Si el usuario NO seleccionó nada manualmente (solo hizo clic)
        if (selectedText.length === 0) {
            // Seleccionamos todo el texto del elemento (el título completo)
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
            selectedText = selection.toString().trim();
        }

        // Si tenemos texto (ya sea por arrastre o por selección automática)
        if (selectedText.length > 0) {
            console.log("🎯 Traduciendo título completo:", selectedText);
            showFlashcardPopup(selectedText, e.clientX, e.clientY);
        }
    });
}
/**
 * Controla la lectura del artículo completo, limpiando HTML
 */
function toggleArticleAudio(htmlContent, btn) {
    // 1. Si ya está hablando, lo detenemos (botón de Stop)
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        btn.classList.remove('playing');
        btn.innerHTML = '<span>🔊</span> Listen to Article';
        return;
    }

    // 2. LIMPIEZA: Extraemos solo el texto para que la voz no lea etiquetas HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    if (!plainText.trim()) return;

    // 3. Configuración de la voz
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Velocidad cómoda para estudiantes

    // Cambios visuales en el botón durante la lectura
    utterance.onstart = () => {
        btn.classList.add('playing');
        btn.innerHTML = '<span>⏹️</span> Stop Listening';
    };

    utterance.onend = () => {
        btn.classList.remove('playing');
        btn.innerHTML = '<span>🔊</span> Listen to Article';
    };

    window.speechSynthesis.speak(utterance);
}

// Función para renderizar el quiz de forma segura (usando textContent)
// Añadimos el parámetro targetId para saber dónde dibujar
function displayQuiz(questions, targetId = 'quiz-container') {
    // Buscamos el contenedor específico
    const container = document.getElementById(targetId);
    if (!container) return;

    // Limpiamos y ponemos título
    container.innerHTML = '<h3 class="mt-4 mb-3 text-center">Reading Comprehension</h3>';
    container.style.display = 'block';

    questions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm border-0';
        card.style.background = '#f8fafc';
        card.style.border = '1px solid #ebebeb';
        card.style.borderRadius = '10px';

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        // Pregunta segura
        const questionText = document.createElement('p');
        questionText.className = 'fw-bold mb-3';
        questionText.style.color = '#2d3748';
        questionText.textContent = `${index + 1}. ${q.question}`;
        cardBody.appendChild(questionText);

        // Opciones seguras
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'd-grid gap-2';

        q.options.forEach((opt, optIndex) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-primary text-start btn-sm py-2 px-3';
            btn.style.borderRadius = '6px';
            btn.textContent = opt;
            
            btn.onclick = () => {
                // Deshabilitar botones
                const allBtns = optionsDiv.querySelectorAll('button');
                allBtns.forEach(b => b.disabled = true);

                if (optIndex === q.correct_index) {
                    btn.className = 'btn btn-success text-start btn-sm py-2 px-3 text-white';
                    showFeedback(cardBody, '✅ Correct! Well done.', 'text-success');
                } else {
                    btn.className = 'btn btn-danger text-start btn-sm py-2 px-3 text-white';
                    showFeedback(cardBody, `❌ Incorrect. Right answer: ${q.options[q.correct_index]}`, 'text-danger');
                }
            };
            optionsDiv.appendChild(btn);
        });

        cardBody.appendChild(optionsDiv);
        card.appendChild(cardBody);
        container.appendChild(cardBody); // Corregido: añadir card al container, no cardBody
        container.appendChild(card); // Añadimos la tarjeta completa
    });
}

function showFeedback(parent, message, textClass) {
    const feedback = document.createElement('div');
    feedback.className = `mt-3 fw-bold ${textClass}`;
    feedback.textContent = message;
    parent.appendChild(feedback);
}
async function refreshSavedWords() {
    try {
        const userId = getStoredUserId();
        if (userId == null || Number.isNaN(userId)) return;

        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/flashcards?user_id=${userId}`, { headers });
        const flashcards = await response.json();
        
        if (Array.isArray(flashcards)) {
            savedWordsSet = new Set(flashcards.map(f => f.word.toLowerCase().trim()));
            console.log("✅ Diccionario personal cargado:", savedWordsSet.size, "palabras.");
        }
    } catch (e) {
        console.error("Error cargando flashcards para resaltado:", e);
    }
}
function applyHighlights(container) {
    if (savedWordsSet.size === 0) return;

    // Usamos TreeWalker para tocar SOLO el texto, no las etiquetas HTML
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const nodesToReplace = [];

    while (node = walker.nextNode()) {
        const text = node.nodeValue;
        // Buscamos palabras individuales (ignorando puntuación)
        const newHtml = text.replace(/\b(\w+)\b/g, (match) => {
            if (savedWordsSet.has(match.toLowerCase())) {
                return `<span class="lf-saved-word word">${match}</span>`;
            }
            return match;
        });

        if (newHtml !== text) {
            nodesToReplace.push({ node, newHtml });
        }
    }

    // Aplicamos los cambios al final para no romper el bucle del Walker
    nodesToReplace.forEach(({ node, newHtml }) => {
        const span = document.createElement('span');
        span.innerHTML = newHtml;
        node.parentNode.replaceChild(span, node);
    });
}
// FUNCIONES GLOBALES PARA EL HTML
// Esta función debe existir en tu reader.js para manejar los clics dentro del artículo
window.changeArticleLevel = async function(id, newLevel) {
    console.log(`🎯 Nivel ${newLevel} solicitado para el artículo ${id}`);

    // 1. UI: Poner el botón azul inmediatamente (Feedback visual instantáneo)
    renderLevelSelector(id, newLevel); 

    // 2. UI: Hacer desaparecer el artículo actual y mostrar el Loading
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    
    if (container) container.innerHTML = ""; // Borramos el texto viejo para no confundir
    if (loadingDiv) loadingDiv.style.display = 'block'; // Mostramos el cargando

    // 3. Actualizar la URL (Hash) para que si el usuario refresca, se quede en este nivel
    const params = new URLSearchParams(window.location.hash.substring(1));
    params.set('level', newLevel);
    window.location.hash = params.toString();

    // 4. Ahora sí, llamar al servidor para traer el nuevo texto
    // (Como ya limpiamos arriba, loadFullArticle se encargará de pintar lo nuevo cuando llegue)
    await loadFullArticle(id, newLevel);
};

window.speakArticle = () => {
    window.speechSynthesis.cancel();
    
    // Buscamos los dos elementos por su ID
    const titleEl = document.getElementById('interactive-title');
    const textEl = document.getElementById('interactive-text');
    
    const titleText = titleEl ? titleEl.innerText : "";
    const bodyText = textEl ? textEl.innerText : "";
    
    // Concatenamos ambos. IMPORTANTE: Aunque el div esté oculto (display: none), 
    // .innerText o .textContent siguen funcionando.
    const fullText = `${titleText}. ${bodyText}`.trim();
    
    console.log("Texto detectado para leer:", fullText.substring(0, 50) + "...");

    if (fullText.length < 10) {
        console.warn("⚠️ No se encontró texto suficiente para leer.");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
};
// 2. Función para mostrar/ocultar el texto
window.toggleTranscript = () => {
    const wrapper = document.getElementById('article-body-wrapper');
    const btn = document.getElementById('toggle-text-btn'); // Usamos el ID para ir sobre seguro
    
    if (!wrapper || !btn) return;

    // Miramos la realidad: ¿Está escondido?
    const isHidden = wrapper.style.display === 'none';

    if (isHidden) {
        // Si está escondido, lo mostramos con fuerza
        wrapper.style.setProperty('display', 'block', 'important');
        btn.innerText = 'Hide Text';
    } else {
        // Si se ve, lo escondemos con fuerza
        wrapper.style.setProperty('display', 'none', 'important');
        btn.innerText = 'Show Text';
    }
};

function renderAudioControls() {
    const selector = document.getElementById('level-selector-container');
    if (!selector) return;

    let panel = document.getElementById('audio-controls-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'audio-controls-panel';
        panel.style = "background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; border: 1px solid #e9ecef; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
        selector.parentNode.insertBefore(panel, selector.nextSibling);
    }

    // --- EL FIX PARA EL BOTÓN BACK ---
    // Buscamos el tema en la URL actual (ej: #id=123&topic=science)
    const currentHash = window.location.hash.substring(1);
    const params = new URLSearchParams(currentHash);
    const topic = params.get('topic') || ''; 

    panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 5px;">
        <a href="#" onclick="window.location.hash='topic=${topic}'; return false;" 
           style="text-decoration:none; color:#007bff; font-weight:bold; font-size: 0.9rem;">
           ← Back to Articles
        </a>
        <span style="font-weight: bold; color: #4a5568; font-size: 0.9rem;">Audio Mode 🎧</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div style="display: flex; gap: 8px;">
            <button onclick="window.speechSynthesis.pause()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">⏸ Pause</button>
            <button onclick="window.speechSynthesis.resume()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">▶ Resume</button>
            <button onclick="window.speechSynthesis.cancel()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">Stop</button>
        </div>
        <button onclick="window.toggleTranscript()" 
                id="toggle-text-btn" 
                style="cursor:pointer; padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 5px; font-weight: bold;">
            Show Text
        </button>
    </div>
    `;
}

// También es buena idea detenerlo cuando se hace logout o se cambia de sección
function handleLogout(logoutFn) {
    const link = document.getElementById('logout-link');
    if (link) {
        link.onclick = (e) => {
            window.speechSynthesis.cancel();
            logoutFn();
        };
    }
}

window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
});

// --- SISTEMA DE AUDIO Y CONTROLES (NUEVO) ---

/**
 * Función que hace hablar al navegador.
 */
window.speakArticle = () => {
    window.speechSynthesis.cancel(); 

    const title = document.getElementById('interactive-title')?.innerText || "";
    const body = document.getElementById('interactive-text')?.innerText || "";
    
    // Al no incluir el 'back-nav-container', el TTS no dirá jamás "Back to articles"
    const fullText = `${title}. ${body}`.trim();

    if (fullText.length < 10) return;

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.currentUtterance = utterance; 
    window.speechSynthesis.speak(utterance);
};

/**
 * Dibuja el panel gris con Pause/Stop justo debajo de los niveles.
 */
window.renderAudioControls = () => {
    const selectorContainer = document.getElementById('level-selector-container');
    if (!selectorContainer) return;

    // Si ya existe el panel, lo borramos para recrearlo limpio
    const existingPanel = document.getElementById('audio-controls-panel');
    if (existingPanel) existingPanel.remove();

    const audioPanel = document.createElement('div');
    audioPanel.id = 'audio-controls-panel';
    audioPanel.style = "background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; border: 1px solid #e9ecef;";

    audioPanel.innerHTML = `
        <div style="flex: 1;">
            <span style="font-weight: bold; color: #4a5568; display: block; margin-bottom: 5px;">Audio Mode 🎧</span>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.speechSynthesis.pause()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">⏸ Pause</button>
                    <button onclick="window.speechSynthesis.resume()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">▶ Resume</button>
                    <button onclick="window.speechSynthesis.cancel()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">Stop</button>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="range" id="audio-progress-active" value="0" min="0" max="100" style="flex: 1; cursor: pointer;">
                    <span id="audio-percentage" style="font-size: 12px; color: #718096; min-width: 35px;">0%</span>
                </div>
            </div>
        </div>
        <button onclick="window.toggleTranscript()" id="toggle-text-btn" style="cursor:pointer; padding: 10px; background: white; border: 1px solid #007bff; color: #007bff; border-radius: 5px; font-weight: bold;">
            Show Text
        </button>
    `;

    selectorContainer.parentNode.insertBefore(audioPanel, selectorContainer.nextSibling);
};

/**
 * Función para el botón "Show/Hide Text"
 */
window.toggleTranscript = () => {
    const wrapper = document.getElementById('article-body-wrapper');
    const btn = document.getElementById('toggle-text-btn');
    
    if (!wrapper || !btn) return;

    // Comprobamos la realidad del elemento
    const isHidden = wrapper.style.display === 'none' || window.getComputedStyle(wrapper).display === 'none';

    if (isHidden) {
        wrapper.style.setProperty('display', 'block', 'important');
        btn.innerText = 'Hide Text';
    } else {
        wrapper.style.setProperty('display', 'none', 'important');
        btn.innerText = 'Show Text';
    }
};

/**
 * CRÍTICO: Detener audio al salir de la página
 */
window.addEventListener('beforeunload', () => {
    window.speechSynthesis.cancel();
});
// También al cambiar el hash (navegación interna)
window.addEventListener('hashchange', () => {
    window.speechSynthesis.cancel();
    // Limpieza extra del panel de audio si existe
    const panel = document.getElementById('audio-controls-panel');
    if (panel) panel.remove();
});
window.setArticleLevel = function(articleId, level) {
    level = String(level || '').toUpperCase().trim() || 'B1';
    console.log('[LinguistFeed-level] setArticleLevel', articleId, level);
    console.log(`🎯 Nivel ${level} pre-seleccionado para la tarjeta ${articleId}`);
    try {
        localStorage.setItem(`temp-level-${articleId}`, level);
    } catch (e) { /* ignore */ }
    try {
        localStorage.setItem('user-level', level);
    } catch (e) { /* ignore */ }

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashArticleId = hashParams.get('id');
    const inFullArticleView = !!document.querySelector('.article-full')
        && hashArticleId != null
        && String(hashArticleId) === String(articleId);

    if (inFullArticleView && typeof window.changeArticleLevel === 'function') {
        console.log('[LinguistFeed-level] full view → changeArticleLevel', articleId, level);
        void window.changeArticleLevel(articleId, level);
        return;
    }

    try {
        const selector = `[id^="btn-${articleId}-"]`;
        document.querySelectorAll(selector).forEach(btn => {
            btn.style.background = 'white';
            btn.style.color = '#007bff';
            btn.classList.remove('active');
        });
        const clicked = document.getElementById(`btn-${articleId}-${level}`);
        if (clicked) {
            clicked.style.background = '#007bff';
            clicked.style.color = 'white';
            clicked.classList.add('active');
        }
    } catch (e) {
        console.error('setArticleLevel error', e);
    }

    const card = document.getElementById(`btn-${articleId}-${level}`)?.closest('.card')
        || document.querySelector(`[id^="btn-${articleId}-"]`)?.closest('.card');

    if (card) {
        const readBtn = card.querySelector('a[onclick*="userMode\', \'read\'"]');
        if (readBtn) {
            const topic = new URLSearchParams(window.location.hash.substring(1)).get('topic') || '';
            const newUrl = `reader.html#id=${articleId}&level=${level}&topic=${topic}`;
            readBtn.setAttribute('onclick', `localStorage.setItem('userMode', 'read'); window.location.href='${newUrl}'; return false;`);
        }
    }
};

window.goToArticle = function(id, mode) {
    // Buscamos si eligió un nivel, si no, usamos el de su perfil o B1 por defecto
    const selectedLevel = localStorage.getItem(`temp-level-${id}`) || localStorage.getItem('user-level') || 'B1';
    
    localStorage.setItem('userMode', mode);
    
    // Obtenemos el tópico actual del hash para no perder la navegación
    const params = new URLSearchParams(window.location.hash.substring(1));
    const topic = params.get('topic') || '';

    // Redirigimos con el ID y el NIVEL elegido
    window.location.href = `reader.html#id=${id}&level=${selectedLevel}&topic=${topic}`;
};

let attempts = 0;

function setupAudioLogic(text) {
    const progressBar = document.getElementById('audio-progress-active');
    
    if (!progressBar) {
        attempts++;
        if (attempts > 50) { // Si después de 5 segundos no sale, paramos.
            console.log("⚠️ Desisto: La barra no apareció. ¿Cargó el artículo?");
            attempts = 0;
            return;
        }
        setTimeout(() => setupAudioLogic(text), 100);
        return;
    }

    attempts = 0; //
    console.log("🚀 ¡Barra encontrada!");

    // 3. Si la encuentra, procedemos con éxito
    console.log("🚀 ¡La función setupAudioLogic ha despertado y encontró la barra!");
    const progressLabel = document.getElementById('audio-percentage');

    progressBar.oninput = () => {
        const percentage = progressBar.value;
        console.log("🎯 Saltando al: " + percentage + "%");
        
        if (progressLabel) progressLabel.innerText = percentage + "%";

        window.speechSynthesis.cancel();
        const startIndex = Math.floor((text.length * percentage) / 100);
        const utterance = new SpeechSynthesisUtterance(text.substring(startIndex));
        utterance.lang = 'en-US';
        utterance.rate = 0.9;

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                const charIndex = event.charIndex + startIndex;
                const currentPct = Math.floor((charIndex / text.length) * 100);
                progressBar.value = currentPct;
                if (progressLabel) progressLabel.innerText = currentPct + "%";
            }
        };

        window.speechSynthesis.speak(utterance);
    };
}

window.saveFlashcardToStorage = saveFlashcardToStorage;
window.showFlashcardPopup = showFlashcardPopup; // Añade esta línea
window.closeFlashcardPopup = closeFlashcardPopup; // Añade esta línea
window.initReader = initReader;
window.loadFullArticle = loadFullArticle;
window.handleLogout = handleLogout;

export { initReader, loadFullArticle, saveFlashcardToStorage, showFlashcardPopup, closeFlashcardPopup, handleLogout };

// ESCUCHAR CAMBIOS DE NAVEGACIÓN
window.addEventListener('hashchange', initReader);