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

        let result = {};
        try {
            result = await response.json();
        } catch {
            result = {};
        }

        if (!response.ok) {
            const errMsg = result.message || result.error || `Error del servidor (${response.status})`;
            if (typeof window.showTranslationPopup === 'function') {
                window.showTranslationPopup(text, errMsg, event.pageX, event.pageY);
            } else {
                renderMiniPopup(text, errMsg, event);
            }
            return;
        }

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

/** Palabras analizadas en esta sesión (palabra + definición EN) para el ejercicio matching */
const MAX_SESSION_VOCAB = 24;
let sessionVocabPairs = [];
const quizAnswerAttempts = new Map();

function recordSessionVocabPair(word, definition) {
    const w = String(word || '').trim();
    const d = String(definition || '').trim();
    if (!w || !d) return;
    const key = w.toLowerCase();
    if (sessionVocabPairs.some((p) => p.word.toLowerCase() === key)) return;
    sessionVocabPairs.push({ word: w, definition: d });
    if (sessionVocabPairs.length > MAX_SESSION_VOCAB) sessionVocabPairs.shift();
}

function mergeQuizWithMatching(aiQuizzes) {
    const out = [...(aiQuizzes || [])];
    const hasMatching = out.some((q) => String(q.type || '').toLowerCase() === 'matching');
    if (!hasMatching && sessionVocabPairs.length >= 2) {
        const pairs = sessionVocabPairs.slice(-8).map((p) => ({ word: p.word, definition: p.definition }));
        out.push({ type: 'matching', pairs });
    }
    return out;
}

function formatArticleIntoParagraphs(rawContent) {
    const content = String(rawContent || '').trim();
    if (!content) return '';

    // Si ya viene con HTML estructurado, no lo re-formateamos.
    if (/<(p|div|article|section|h[1-6]|ul|ol|li|br)\b/i.test(content)) {
        return content;
    }

    const blocks = content
        .split(/\r?\n\s*\r?\n/)
        .map((block) => block.trim())
        .filter(Boolean);

    if (blocks.length > 1) {
        return blocks
            .map((block) => `<p>${block.replace(/\r?\n/g, '<br>')}</p>`)
            .join('');
    }

    // Fallback robusto: cuando llega como una sola línea larga, partimos por oraciones.
    const normalized = content.replace(/\s+/g, ' ').trim();
    const sentences = normalized
        .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (sentences.length <= 1) {
        return `<p>${normalized}</p>`;
    }

    const paragraphSize = 2;
    const paragraphChunks = [];
    for (let i = 0; i < sentences.length; i += paragraphSize) {
        paragraphChunks.push(sentences.slice(i, i + paragraphSize).join(' '));
    }
    return paragraphChunks.map((chunk) => `<p>${chunk}</p>`).join('');
}

function getQuestionAttemptKey(question) {
    const qid = String(question?._lfQuestionId || question?.id || question?.question || question?.statement || 'q').trim();
    const articleId = String(question?._lfArticleId || 'article').trim();
    return `${articleId}::${qid}`;
}

function nextQuestionAttempt(question) {
    const key = getQuestionAttemptKey(question);
    const curr = quizAnswerAttempts.get(key) || 0;
    const next = curr + 1;
    quizAnswerAttempts.set(key, next);
    return next;
}

async function trackQuizAnswerEvent(question, payload) {
    try {
        const token = localStorage.getItem('token');
        if (!token || !question) return;

        const body = {
            sessionId: question._lfSessionId || null,
            articleId: Number(question._lfArticleId),
            quizSource: question._lfSource || 'reader_ai',
            questionId: question._lfQuestionId || `q-${Date.now()}`,
            questionType: String(question.type || '').toLowerCase() || 'unknown',
            attemptIndex: payload.attemptIndex,
            selected: payload.selected,
            isCorrect: !!payload.isCorrect,
            responseTimeMs: payload.responseTimeMs,
            answeredAt: new Date().toISOString(),
            meta: { level: question._lfLevel || null }
        };

        await fetch(`${API_BASE_URL}/progress/answer-event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.warn('No se pudo registrar answer-event:', e?.message || e);
    }
}

async function initReader() {
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    await refreshSavedWords();
    
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
                            <span class="badge" style="background: transparent; border: 1px solid #7a91ff; color: #eef2ff; padding: 2px 7px; font-size: 0.7rem; border-radius: 999px;">Subtopic: ${article.topic}</span>
                            <h3 style="cursor:pointer;" class="article-title">${article.title}</h3>
                            <p style="font-size: 0.85rem;">${article.content.substring(0, 80)}...</p>
                        </div>
                        <div class="level-selector-inline" style="display: flex; gap: 4px; margin: 10px 0; justify-content: center;">
                            ${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => `
                                <button onclick="setArticleLevel('${identifier}', '${lvl}')" 
                                        id="btn-${article.id}-${lvl}"
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

        // --- initSearch for reader list (safe; después de pintar tarjetas) ---
        if (typeof window.initSearch === 'function') {
            window.initSearch('searchBarCategory', ['#articles-container'], '.card');
            const sb = document.getElementById('searchBarCategory');
            if (sb) sb.dispatchEvent(new Event('input'));
        }
        // --- end initSearch snippet ---

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
    sessionVocabPairs = [];
    quizAnswerAttempts.clear();
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

        // --- PASO 4: PINTAR TODO EL CONTENIDO ---
        const safeArticleId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
        const selectorContainerId = `level-selector-container-${safeArticleId}`;
        container.innerHTML = `
            <div class="article-full">
                <div id="nav-and-title-area" style="margin-bottom: 20px;">
                    <button onclick="window.location.hash='topic=${article.topic}'; return false;" 
                            style="background:none; border:none; color:#007bff; font-weight:bold; cursor:pointer; padding:0;">
                        ← Back to Articles
                    </button>
                    <h1 id="interactive-title" style="margin-top:10px;">${article.title}</h1>
                </div>

                <div id="audio-controls-panel" style="background: rgba(16, 23, 58, 0.35); padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; border: 1px solid #2a356a;">
                    <div style="flex: 1;">
                        <span style="font-weight: bold; color: #eef2ff; display: block; margin-bottom: 5px;">Audio Mode 🎧</span>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                                <button type="button" id="btn-play-article" class="audio-toolbar-btn audio-toolbar-btn--primary">Listen / Play</button>
                                <button type="button" id="btn-pause" class="audio-toolbar-btn">Pause</button>
                                <button type="button" id="btn-resume" class="audio-toolbar-btn">Resume</button>
                                <button type="button" id="btn-stop" class="audio-toolbar-btn">Stop</button>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input type="range" id="article-audio-progress" value="0" min="0" max="100" style="flex: 1; cursor: pointer;">
                                <span id="article-audio-percentage" style="font-size: 12px; color: #c6d1ff; min-width: 35px;">0%</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="window.toggleTranscript()" id="toggle-text-btn" style="cursor:pointer; padding: 10px; background: transparent; border: 1px solid #7a91ff; color: #eef2ff; border-radius: 8px; font-weight: 700;">
                        Show Text
                    </button>
                </div>

                <div id="${selectorContainerId}" style="margin-bottom: 25px; padding: 10px; background: rgba(16, 23, 58, 0.35); border: 1px solid #2a356a; border-radius: 10px;">
                    </div>

                <div id="article-body-wrapper">
                    <div class="article-meta mb-3" style="color: #666; font-size: 0.9rem;">
                        <span class="badge bg-primary" style="padding: 5px 10px;">Current Level: ${activeLevel}</span>
                    </div>
                    <div id="interactive-text" class="article-body-text" style="line-height: 1.8; font-size: 1.1rem;">
                        ${formatArticleIntoParagraphs(article.content)}
                    </div>
                </div>
            </div>
        `;

        // 🦾 PASO 5: Ahora que el contenedor existe arriba, llamamos a la función para llenarlo
        renderLevelSelector(selectorContainerId, id, activeLevel);
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

        attachReadModeArticleAudio();

        // Lógica del Quiz... (se mantiene igual que tu código)
        const quizBtn = document.getElementById('generate-quiz-btn');
        if (quizBtn) {
            quizBtn.onclick = async () => {
                const resultsArea = document.getElementById('quiz-results-area');
                quizBtn.disabled = true;
                quizBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Loading...';
                resultsArea.style.display = 'none';
                resultsArea.innerHTML = '';
                try {
                    const res = await fetch(`${API_BASE_URL}/articles/generate-quiz-only`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: article.content,
                            level: article.level || activeLevel,
                            articleId: String(id)
                        })
                    });
                    let data = {};
                    try {
                        data = await res.json();
                    } catch {
                        data = {};
                    }

                    if (!res.ok) {
                        const msg = data.message || data.error || `Error ${res.status}`;
                        resultsArea.style.display = 'block';
                        resultsArea.innerHTML = `<p class="text-danger">${msg}</p>`;
                        quizBtn.disabled = false;
                        quizBtn.innerHTML = '🧠 Generate AI Quiz';
                        return;
                    }

                    if (data.quizzes && data.quizzes.length > 0) {
                        quizBtn.style.display = 'none';
                        resultsArea.style.display = 'block';
                        const baseQuiz = mergeQuizWithMatching(data.quizzes);
                        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                        const enrichedQuiz = baseQuiz.map((q, idx) => ({
                            ...q,
                            _lfQuestionId: `${id}_${idx}_${String(q.type || 'q').toLowerCase()}`,
                            _lfArticleId: String(id),
                            _lfLevel: article.level || activeLevel,
                            _lfSource: data.mock ? 'reader_mock' : 'reader_ai',
                            _lfSessionId: sessionId
                        }));
                        displayQuiz(enrichedQuiz, 'quiz-results-area');
                        if (data.cached) {
                            const note = document.createElement('p');
                            note.className = 'small text-muted text-center mb-2';
                            note.textContent = 'Quiz recuperado de caché (sin nueva llamada a la IA).';
                            const h3 = resultsArea.querySelector('h3');
                            if (h3) h3.insertAdjacentElement('afterend', note);
                            else resultsArea.prepend(note);
                        } else if (data.mock) {
                            const note = document.createElement('p');
                            note.className = 'small text-info text-center mb-2';
                            note.textContent =
                                'Modo demo: quiz fijo en el servidor (MOCK_READER_QUIZ). Desactívalo y añade créditos para usar la IA.';
                            const h3 = resultsArea.querySelector('h3');
                            if (h3) h3.insertAdjacentElement('afterend', note);
                            else resultsArea.prepend(note);
                        }
                    } else {
                        resultsArea.style.display = 'block';
                        resultsArea.innerHTML = '<p class="text-warning">No se recibieron preguntas. Inténtalo de nuevo.</p>';
                        quizBtn.disabled = false;
                        quizBtn.innerHTML = '🧠 Generate AI Quiz';
                    }
                } catch (e) {
                    console.error(e);
                    quizBtn.disabled = false;
                    quizBtn.innerHTML = '❌ Error — reintentar';
                }
            };
        }

    } catch (error) {
        if (loadingDiv) loadingDiv.style.display = 'none';
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function renderLevelSelector(containerOrArticleId, maybeArticleId, maybeActiveLevel) {
    let levelContainer = null;
    let currentArticleId = null;
    let activeLevel = null;

    // Nueva firma: renderLevelSelector(containerOrId, articleId, level)
    if (maybeActiveLevel !== undefined) {
        currentArticleId = maybeArticleId;
        activeLevel = maybeActiveLevel;

        if (containerOrArticleId && containerOrArticleId.nodeType === 1) {
            levelContainer = containerOrArticleId;
        } else if (typeof containerOrArticleId === 'string') {
            levelContainer = document.getElementById(containerOrArticleId);
        }
    } else {
        // Compatibilidad: renderLevelSelector(articleId, level)
        currentArticleId = containerOrArticleId;
        activeLevel = maybeArticleId;
        const safeArticleId = String(currentArticleId).replace(/[^a-zA-Z0-9_-]/g, '_');
        levelContainer = document.getElementById(`level-selector-container-${safeArticleId}`);
    }

    // Fallback legacy para no romper flujos existentes.
    if (!levelContainer) {
        levelContainer = document.getElementById('level-selector-container');
    }

    if (!levelContainer) return;

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    levelContainer.innerHTML = ''; // Limpiamos antes de pintar
    
    levelContainer.innerHTML = levels.map(level => {
        // Comparación robusta: A1 === A1 o a1 === A1
        const isThisActive = (level.toUpperCase() === activeLevel.toUpperCase());
        
        return `
        <button 
            class="level-btn ${isThisActive ? 'active' : ''}" 
            onclick="changeArticleLevel('${currentArticleId}', '${level}')"
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
            const progressBar = document.getElementById('article-audio-progress')
                || document.getElementById('audio-progress');
            const progressLabel = document.getElementById('article-audio-percentage')
                || document.getElementById('audio-percentage');

            // 3. 🧠 EL TRUCO: Mientras la IA habla, mueve la barra
            utterance.onboundary = (event) => {
                if (event.name === 'word' && progressBar) {
                    const charIndex = event.charIndex;
                    const totalChars = text.length;
                    const percentage = Math.floor((charIndex / totalChars) * 100);

                    progressBar.value = percentage;
                    if (progressLabel) progressLabel.textContent = percentage + '%';
                }
            };

            // No asignamos progressBar.oninput aquí: reemplazaría el seek del artículo (attachReadModeArticleAudio).

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

        let data = {};
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            const msg = data.message || data.error || `Error del servidor (${response.status})`;
            document.getElementById('flashcard-definition').textContent = 'No disponible';
            document.getElementById('flashcard-translation').textContent = msg;
            const exElemErr = document.getElementById('flashcard-example');
            if (exElemErr) {
                exElemErr.textContent = 'Revisa OPENROUTER_API_KEY en backend/.env y los logs del servidor Node.';
            }
            return;
        }

        document.getElementById('flashcard-definition').textContent = data.definition || 'No definition found';
        document.getElementById('flashcard-translation').textContent = data.translation || 'No translation found';

        const exElem = document.getElementById('flashcard-example');
        if (exElem) {
            exElem.textContent = data.example || `Context: "${text}"`;
        }

        recordSessionVocabPair(text, data.definition);
    } catch (error) {
        console.error("Error al analizar texto:", error);
        document.getElementById('flashcard-definition').textContent = 'Service error. Please try again.';
        document.getElementById('flashcard-translation').textContent = error.message || 'Network or parse error';
        const exCatch = document.getElementById('flashcard-example');
        if (exCatch) exCatch.textContent = '';
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

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function renderMcqCard(cardBody, q, index) {
    const renderTs = Date.now();
    const questionText = document.createElement('p');
    questionText.className = 'fw-bold mb-3';
    questionText.style.color = '#2d3748';
    questionText.textContent = `${index + 1}. ${q.question}`;
    cardBody.appendChild(questionText);

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'd-grid gap-2';

    q.options.forEach((opt, optIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-primary text-start btn-sm py-2 px-3';
        btn.style.borderRadius = '6px';
        btn.textContent = opt;

        btn.onclick = () => {
            const allBtns = optionsDiv.querySelectorAll('button');
            allBtns.forEach((b) => { b.disabled = true; });
            const isCorrect = optIndex === q.correct_index;
            const attemptIndex = nextQuestionAttempt(q);
            const responseTimeMs = Date.now() - renderTs;

            if (isCorrect) {
                btn.className = 'btn btn-success text-start btn-sm py-2 px-3 text-white';
                showFeedback(cardBody, '✅ Correct! Well done.', 'text-success');
            } else {
                btn.className = 'btn btn-danger text-start btn-sm py-2 px-3 text-white';
                showFeedback(cardBody, `❌ Incorrect. Right answer: ${q.options[q.correct_index]}`, 'text-danger');
            }
            trackQuizAnswerEvent(q, {
                selected: { optionIndex: optIndex, value: opt },
                isCorrect,
                attemptIndex,
                responseTimeMs
            });
        };
        optionsDiv.appendChild(btn);
    });

    cardBody.appendChild(optionsDiv);
}

function renderTfCard(cardBody, q, index) {
    const renderTs = Date.now();
    const p = document.createElement('p');
    p.className = 'fw-bold mb-3';
    p.style.color = '#2d3748';
    p.textContent = `${index + 1}. True or false: ${q.statement}`;
    cardBody.appendChild(p);

    const row = document.createElement('div');
    row.className = 'd-flex gap-2 flex-wrap';

    [true, false].forEach((val) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-primary btn-sm px-4';
        btn.textContent = val ? 'True' : 'False';
        btn.onclick = () => {
            row.querySelectorAll('button').forEach((b) => { b.disabled = true; });
            const ok = val === q.correct;
            const attemptIndex = nextQuestionAttempt(q);
            const responseTimeMs = Date.now() - renderTs;
            if (ok) {
                btn.className = 'btn btn-success btn-sm px-4 text-white';
                showFeedback(cardBody, '✅ Correct!', 'text-success');
            } else {
                btn.className = 'btn btn-danger btn-sm px-4 text-white';
                showFeedback(cardBody, `❌ Incorrect. Answer: ${q.correct ? 'True' : 'False'}`, 'text-danger');
            }
            trackQuizAnswerEvent(q, {
                selected: { value: val ? 'True' : 'False' },
                isCorrect: ok,
                attemptIndex,
                responseTimeMs
            });
        };
        row.appendChild(btn);
    });
    cardBody.appendChild(row);
}

function renderMatchingCard(cardBody, q, index) {
    const renderTs = Date.now();
    const pairs = q.pairs || [];
    if (pairs.length < 2) return;

    const title = document.createElement('p');
    title.className = 'fw-bold mb-2';
    title.style.color = '#2d3748';
    title.textContent = `${index + 1}. Match each word with its definition (English). Click a word, then its definition.`;
    cardBody.appendChild(title);

    const words = shuffleArray(pairs.map((p) => ({ word: p.word, definition: p.definition })));
    const defTexts = shuffleArray(pairs.map((p) => p.definition));

    let selectedWordBtn = null;
    let matched = 0;

    const hint = document.createElement('p');
    hint.className = 'small text-muted mt-2 mb-0';
    hint.textContent = 'Uses words you looked up in this article (this session).';
    cardBody.appendChild(hint);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '12px';
    grid.className = 'mt-3';

    const left = document.createElement('div');
    const right = document.createElement('div');
    const lh = document.createElement('div');
    lh.className = 'small text-muted mb-1';
    lh.textContent = 'Words';
    const rh = document.createElement('div');
    rh.className = 'small text-muted mb-1';
    rh.textContent = 'Definitions';
    left.appendChild(lh);
    right.appendChild(rh);

    words.forEach(({ word, definition }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-secondary btn-sm w-100 mb-1 text-start';
        btn.textContent = word;
        btn.dataset.correctDef = definition;

        btn.onclick = () => {
            if (btn.disabled) return;
            left.querySelectorAll('button').forEach((b) => {
                if (!b.disabled) b.classList.remove('border-primary', 'border-2');
            });
            selectedWordBtn = btn;
            btn.classList.add('border-primary', 'border-2');
        };
        left.appendChild(btn);
    });

    defTexts.forEach((defText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-secondary btn-sm w-100 mb-1 text-start';
        btn.textContent = defText;
        if (defText.length > 90) btn.title = defText;

        btn.onclick = () => {
            if (btn.disabled || !selectedWordBtn) return;
            const correctDef = selectedWordBtn.dataset.correctDef;
            const attemptIndex = nextQuestionAttempt(q);
            const responseTimeMs = Date.now() - renderTs;
            const chosenWord = selectedWordBtn.textContent;
            if (correctDef === defText) {
                selectedWordBtn.disabled = true;
                btn.disabled = true;
                selectedWordBtn.classList.remove('border-primary');
                selectedWordBtn.className = 'btn btn-success btn-sm w-100 mb-1 text-start text-white';
                btn.className = 'btn btn-success btn-sm w-100 mb-1 text-start text-white';
                const good = document.createElement('div');
                good.className = 'small text-success mt-1';
                good.textContent = `✅ Correct pair: ${chosenWord}`;
                cardBody.appendChild(good);
                setTimeout(() => good.remove(), 1800);
                matched++;
                selectedWordBtn = null;
                if (matched === pairs.length) {
                    showFeedback(cardBody, '✅ All pairs matched!', 'text-success');
                }
                trackQuizAnswerEvent(q, {
                    selected: { word: chosenWord, definition: defText },
                    isCorrect: true,
                    attemptIndex,
                    responseTimeMs
                });
            } else {
                const bad = document.createElement('div');
                bad.className = 'small text-danger mt-1';
                bad.textContent = '❌ Not a pair — try another definition.';
                cardBody.appendChild(bad);
                setTimeout(() => bad.remove(), 2000);
                trackQuizAnswerEvent(q, {
                    selected: { word: chosenWord, definition: defText },
                    isCorrect: false,
                    attemptIndex,
                    responseTimeMs
                });
            }
        };
        right.appendChild(btn);
    });

    grid.appendChild(left);
    grid.appendChild(right);
    cardBody.appendChild(grid);
}

function displayQuiz(questions, targetId = 'quiz-container') {
    const container = document.getElementById(targetId);
    if (!container) return;

    container.innerHTML = '<h3 class="mt-4 mb-3 text-center">Reading Comprehension</h3>';
    container.style.display = 'block';

    (questions || []).forEach((q, index) => {
        const t = (q.type || '').toLowerCase();
        const isMcq = t === 'mcq' || t === 'multiple' || (!t && Array.isArray(q.options));

        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm border-0';
        card.style.background = '#f8fafc';
        card.style.border = '1px solid #ebebeb';
        card.style.borderRadius = '10px';

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        if (t === 'matching' && Array.isArray(q.pairs) && q.pairs.length >= 2) {
            renderMatchingCard(cardBody, q, index);
        } else if (t === 'tf' || t === 'true_false') {
            renderTfCard(cardBody, q, index);
        } else if (isMcq && q.options && q.options.length >= 3) {
            renderMcqCard(cardBody, q, index);
        } else {
            const skip = document.createElement('p');
            skip.className = 'text-muted small';
            skip.textContent = `(${index + 1}) Skipped unsupported question format.`;
            cardBody.appendChild(skip);
        }

        card.appendChild(cardBody);
        container.appendChild(card);
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

/** Texto plano para TTS (título + cuerpo), alineado con lo que ve el usuario */
function getArticleSpeechPlainText() {
    const titleEl = document.getElementById('interactive-title');
    const textEl = document.getElementById('interactive-text');
    const titleText = titleEl ? titleEl.innerText.trim() : '';
    const bodyText = textEl ? textEl.innerText.trim() : '';
    return `${titleText}. ${bodyText}`.trim();
}

/**
 * Enlaza Listen/Play, Pause, Resume, Stop y la barra al Speech Synthesis del artículo (modo Read y panel de Listen).
 */
function attachReadModeArticleAudio() {
    const panel = document.getElementById('audio-controls-panel');
    if (!panel) return;

    const progressBar = document.getElementById('article-audio-progress')
        || panel.querySelector('input[type="range"]');
    const progressLabel = document.getElementById('article-audio-percentage')
        || document.getElementById('audio-percentage');
    const playBtn = document.getElementById('btn-play-article');
    const pauseBtn = document.getElementById('btn-pause');
    const resumeBtn = document.getElementById('btn-resume');
    const stopBtn = document.getElementById('btn-stop');

    if (!progressBar) return;

    const updateLabel = (pct) => {
        const n = Math.round(Math.min(100, Math.max(0, pct)));
        if (progressLabel) progressLabel.textContent = `${n}%`;
    };

    const speakFromPercent = (pctRaw) => {
        const fullText = getArticleSpeechPlainText();
        if (fullText.length < 5) return;

        window.speechSynthesis.cancel();
        const pct = Math.max(0, Math.min(100, Number(pctRaw) || 0));
        const startIndex = Math.floor((fullText.length * pct) / 100);
        const segment = fullText.substring(startIndex);

        progressBar.value = String(pct);
        updateLabel(pct);

        const utterance = new SpeechSynthesisUtterance(segment);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.currentUtterance = utterance;

        utterance.onboundary = (event) => {
            if (event.name !== 'word') return;
            const charInSegment = event.charIndex;
            const absolute = Math.min(fullText.length, startIndex + charInSegment);
            const currentPct = fullText.length ? (absolute / fullText.length) * 100 : 0;
            progressBar.value = String(Math.min(100, currentPct));
            updateLabel(Number(progressBar.value));
        };

        utterance.onend = () => {
            const endPos = startIndex + segment.length;
            if (endPos >= fullText.length - 2) {
                progressBar.value = '100';
                updateLabel(100);
            }
        };

        window.speechSynthesis.speak(utterance);
    };

    window._speakArticleFromPercent = speakFromPercent;

    if (playBtn) playBtn.onclick = () => speakFromPercent(parseFloat(progressBar.value) || 0);
    if (pauseBtn) pauseBtn.onclick = () => window.speechSynthesis.pause();
    if (resumeBtn) resumeBtn.onclick = () => window.speechSynthesis.resume();
    if (stopBtn) {
        stopBtn.onclick = () => {
            window.speechSynthesis.cancel();
            progressBar.value = '0';
            updateLabel(0);
        };
    }

    progressBar.oninput = () => {
        const p = parseFloat(progressBar.value) || 0;
        updateLabel(p);
        speakFromPercent(p);
    };
}

window.changeArticleLevel = async function(id, newLevel) {
    window.speechSynthesis.cancel();
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
    await loadFullArticle(id, newLevel);
};

window.speakArticle = () => {
    if (typeof window._speakArticleFromPercent === 'function') {
        window._speakArticleFromPercent(0);
        return;
    }
    window.speechSynthesis.cancel();
    const fullText = getArticleSpeechPlainText();
    if (fullText.length < 10) return;
    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
};

window.toggleTranscript = () => {
    const wrapper = document.getElementById('article-body-wrapper');
    const btn = document.getElementById('toggle-text-btn');

    if (!wrapper || !btn) return;

    const isHidden = wrapper.style.display === 'none' || window.getComputedStyle(wrapper).display === 'none';

    if (isHidden) {
        wrapper.style.setProperty('display', 'block', 'important');
        btn.innerText = 'Hide Text';
    } else {
        wrapper.style.setProperty('display', 'none', 'important');
        btn.innerText = 'Show Text';
    }
};

export function handleLogout(logoutFn) {
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

/**
 * Modo Listen: inserta el panel de audio bajo el selector de nivel (id dinámico o legacy).
 */
window.renderAudioControls = () => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const articleId = params.get('id');
    const safeId = articleId ? String(articleId).replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    const selectorContainer =
        (safeId && document.getElementById(`level-selector-container-${safeId}`)) ||
        document.getElementById('level-selector-container');
    if (!selectorContainer) return;

    const existingPanel = document.getElementById('audio-controls-panel');
    if (existingPanel) existingPanel.remove();

    const audioPanel = document.createElement('div');
    audioPanel.id = 'audio-controls-panel';
    audioPanel.style = 'background: rgba(16, 23, 58, 0.35); padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; border: 1px solid #2a356a;';

    audioPanel.innerHTML = `
        <div style="flex: 1;">
            <span style="font-weight: bold; color: #4a5568; display: block; margin-bottom: 5px;">Audio Mode 🎧</span>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                    <button type="button" id="btn-play-article" class="audio-toolbar-btn audio-toolbar-btn--primary">Listen / Play</button>
                    <button type="button" id="btn-pause" class="audio-toolbar-btn">Pause</button>
                    <button type="button" id="btn-resume" class="audio-toolbar-btn">Resume</button>
                    <button type="button" id="btn-stop" class="audio-toolbar-btn">Stop</button>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="range" id="article-audio-progress" value="0" min="0" max="100" style="flex: 1; cursor: pointer;">
                    <span id="article-audio-percentage" style="font-size: 12px; color: #718096; min-width: 35px;">0%</span>
                </div>
            </div>
        </div>
        <button type="button" onclick="window.toggleTranscript()" id="toggle-text-btn" style="cursor:pointer; padding: 10px; background: transparent; border: 1px solid #7a91ff; color: #eef2ff; border-radius: 8px; font-weight: 700;">
            Show Text
        </button>
    `;

    selectorContainer.parentNode.insertBefore(audioPanel, selectorContainer.nextSibling);
    attachReadModeArticleAudio();
};

// También al cambiar el hash (navegación interna)
window.addEventListener('hashchange', () => {
    window.speechSynthesis.cancel();
    // Limpieza extra del panel de audio si existe
    const panel = document.getElementById('audio-controls-panel');
    if (panel) panel.remove();
});
window.setArticleLevel = function(articleId, level) {
    console.log(`🎯 Nivel ${level} pre-seleccionado para la tarjeta ${articleId}`);
    
    // 1. Guardamos para que el sistema lo recuerde
    localStorage.setItem(`temp-level-${articleId}`, level);
    
    // 2. Buscamos la tarjeta en el DOM
    const card = document.querySelector(`.card h3[onclick*="'${articleId}'"]`)?.closest('.card') 
                 || document.querySelector(`button[id*="${articleId}"]`)?.closest('.card');

    if (card) {
        // Marcamos visualmente los botones de la tarjeta
        card.querySelectorAll('.level-btn').forEach(btn => {
            btn.style.background = 'white';
            btn.style.color = 'black';
        });
        const activeBtn = card.querySelector(`[id$="-${level}"]`);
        if (activeBtn) {
            activeBtn.style.background = '#007bff';
            activeBtn.style.color = 'white';
        }

        // ¡ESTO ES LO MÁS IMPORTANTE!: Actualizamos el botón "Read"
        const readBtn = card.querySelector('a[onclick*="userMode\', \'read\'"]');
        if (readBtn) {
            const topic = new URLSearchParams(window.location.hash.substring(1)).get('topic') || '';
            // Creamos la URL exacta con el nivel elegido
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

window.saveFlashcardToStorage = saveFlashcardToStorage;
window.showFlashcardPopup = showFlashcardPopup; // Añade esta línea
window.closeFlashcardPopup = closeFlashcardPopup; // Añade esta línea
window.initReader = initReader;
window.loadFullArticle = loadFullArticle;
window.handleLogout = handleLogout;

export { initReader, loadFullArticle, saveFlashcardToStorage, showFlashcardPopup, closeFlashcardPopup };

// ESCUCHAR CAMBIOS DE NAVEGACIÓN
window.addEventListener('hashchange', initReader);