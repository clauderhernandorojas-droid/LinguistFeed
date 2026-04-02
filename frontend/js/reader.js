/**
 * reader.js - Lógica principal del lector de artículos de LinguistFeed
 * Versión Unificada y Corregida (Navegación por Hash)
 */
import { CONFIG } from './config.js';
import { fetchDailyArticles, fetchArticleById } from './api.js';

/**
 * Función principal que arranca el lector.
 * Lee el Hash (#) para decidir qué mostrar sin recargar la página.
 */
export async function initReader() {
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    if (!container) return;

    // LEER DESDE EL HASH (#) para evitar redirecciones 301 del servidor
    const hash = window.location.hash.substring(1); 
    const params = new URLSearchParams(hash);
    
    const articleId = params.get('id');
    const topic = params.get('topic');

    console.log("🕵️ Analizando Hash:", hash, "-> ID:", articleId, "Topic:", topic);

    try {
        if (articleId) {
            // Caso A: Mostrar el artículo completo
            await loadFullArticle(articleId);
        } else if (topic) {
            // Caso B: Mostrar lista de artículos de un tema
            await loadDailyArticlesList(topic);
        } else {
            // Caso C: No hay nada, mostrar selección de temas
            displayTopicSelection();
        }
    } catch (error) {
        console.error("❌ Error en initReader:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Error de conexión con el servidor.</p>`;
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}

/**
 * Muestra la cuadrícula de temas inicial
 */
export function displayTopicSelection() {
    const container = document.getElementById('articles-container');
    const topics = [
        { id: 'technology', name: 'Technology', icon: '💻' },
        { id: 'science', name: 'Science', icon: '🔬' },
        { id: 'world', name: 'World', icon: '🌍' },
        { id: 'culture', name: 'Culture', icon: '🎨' }
    ];

    container.innerHTML = `
        <div style="text-align:center; margin-bottom:30px;">
            <h2 style="color: #334e68;">Select a Topic to Start Reading</h2>
        </div>
        <div class="topics-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
            ${topics.map(t => `
                <div onclick="window.location.hash='topic=${t.id}'" 
                     style="cursor:pointer; padding:30px; border:2px solid #eee; border-radius:15px; text-align:center; transition:0.3s; background: white;">
                    <div style="font-size:3rem;">${t.icon}</div>
                    <h3 style="margin-top:15px; color: #2d3748;">${t.name}</h3>
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
    const data = await fetchDailyArticles(); 

    if (!data.articles || data.articles.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding:50px;'>No hay artículos nuevos hoy.</div>";
        return;
    }

    const filtered = filterTopic 
        ? data.articles.filter(a => a.topic.toLowerCase() === filterTopic.toLowerCase())
        : data.articles;
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px;">
                <p>No articles found for the topic: <b>${filterTopic}</b></p>
                <a href="reader.html#" class="btn" style="text-decoration:none; color:#007bff; font-weight:bold;">← Back to topics</a>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <a href="reader.html#" style="text-decoration:none; color:#007bff; font-weight:bold;">← Back to Topics</a>
            <h2 style="margin-top:10px; text-transform: capitalize;">${filterTopic} Articles</h2>
        </div>
        <div class="articles-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${filtered.map(article => `
                <div class="card" style="padding:15px; border:1px solid #eee; border-radius:10px; display: flex; flex-direction: column; justify-content: space-between; background: white;">
                    <div>
                        <span class="badge" style="background:#007bff; color:white; padding:2px 8px; border-radius:5px; font-size:0.7rem; text-transform: uppercase;">
                            ${article.topic}
                        </span>
                        <h3 style="margin:10px 0; font-size: 1.1rem; line-height: 1.3;">${article.title}</h3>
                        <p style="font-size: 0.85rem; color: #555;">${article.content.substring(0, 100)}...</p>
                    </div>
                    <a href="reader.html#id=${article.id}" class="btn" style="display:block; margin-top:15px; padding: 10px; background: #007bff; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold;">Read More</a>
                </div>
            `).join('')}
        </div>
    `;
    const cardTitles = container.querySelectorAll('.card h3');
    cardTitles.forEach(title => attachTranslationListener(title));
}

/**
 * Carga y renderiza un artículo completo con niveles CEFR
 */
export async function loadFullArticle(id, level = null) {
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    if (!container) return;

    const currentLevel = level || localStorage.getItem('user-level') || 'B1';
    if (level) localStorage.setItem('user-level', level); 

    if (loadingDiv) loadingDiv.style.display = 'block';
    container.innerHTML = ""; 

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/articles/${id}?level=${currentLevel}`);
        if (!response.ok) throw new Error(`Artículo no encontrado`);
        const article = await response.json();

        const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
        const levelButtons = levels.map(lvl => `
            <button 
                onclick="window.changeArticleLevel('${id}', '${lvl}')"
                class="level-btn ${lvl === currentLevel ? 'active' : ''}"
                style="padding: 8px 16px; border-radius: 20px; cursor: pointer; font-weight: bold;
                       border: 2px solid ${lvl === currentLevel ? '#007bff' : '#cbd5e0'};
                       background: ${lvl === currentLevel ? '#007bff' : 'white'};
                       color: ${lvl === currentLevel ? 'white' : '#4a5568'};
                       margin-right: 5px; transition: 0.2s;">
                ${lvl}
            </button>
        `).join('');

        // --- EL CAMBIO ESTÁ AQUÍ ABAJO ---
        container.innerHTML = `
            <article class="article-reader" style="max-width: 800px; margin: 0 auto; padding: 20px;">
                <header>
                    <a href="reader.html#topic=${article.topic}" style="text-decoration:none; color:#007bff; font-weight:bold;">← Back to ${article.topic}</a>
                    <h1 style="font-size: 2.2rem; margin: 25px 0 10px; line-height: 1.2; color: #1a202c;">${article.title}</h1>
                </header>

                <div class="level-selector-container" style="background: #f0f4f8; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <span style="font-weight: bold; color: #334e68; display: block; margin-bottom: 10px;">Reading Level:</span>
                    ${levelButtons}
                </div>

                <button id="listen-full-article" class="listen-article-btn">
                    <span>🔊</span> Listen to Article
                </button>

                <div id="interactive-text" style="font-size: 1.25rem; line-height: 1.8; color: #2d3748; margin-top: 30px;">
                    ${article.content.split('\n').map(p => p.trim() ? `<p style="margin-bottom: 20px;">${p}</p>` : '').join('')}
                </div>

                <section id="quiz-section" style="margin-top: 50px; padding: 30px; background: #fff; border: 1px solid #e2e8f0; border-radius: 15px;">
                    <h2 style="margin-top:0;">📝 Comprehension Check</h2>
                    <div id="quiz-container"></div>
                </section>
            </article>
        `;

        // Ahora que el botón EXISTE en el DOM, podemos asignarle el evento
        const listenBtn = document.getElementById('listen-full-article');
        if (listenBtn) {
            listenBtn.onclick = () => {
                toggleArticleAudio(article.content, listenBtn);
            };
        }

        const mainTitle = container.querySelector('h1');
        attachTranslationListener(mainTitle);

        if (typeof displayQuiz === 'function' && article.quizzes) {
            displayQuiz(article);
        }
        setupTextInteractivity();

    } catch (error) {
        console.error("❌ Error cargando artículo:", error);
        container.innerHTML = `<div style="text-align:center; padding: 40px;"><h3 style="color:#e53e3e;">Content unavailable</h3><a href="reader.html#">Return to Topics</a></div>`;
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
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
export async function saveFlashcardToStorage() {
    const wordElement = document.getElementById('flashcard-word');
    const exampleElement = document.getElementById('flashcard-example');
    
    if (!wordElement) return;

    const word = wordElement.textContent;
    const example = exampleElement ? exampleElement.textContent : "";
    const currentLevel = localStorage.getItem('user-level') || 'B1';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/flashcards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, context: example, level: currentLevel })
        });

        if (response.ok) {
            alert("✨ Flashcard saved!");
            const popup = document.getElementById('flashcard-popup');
            if (popup) popup.style.display = 'none';
        } else {
            alert("❌ Could not save to server");
        }
    } catch (error) {
        console.error("Save error:", error);
        alert("Connection error");
    }
}

/**
 * Cierre de sesión
 */
export function handleLogout(logoutFn) {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.onclick = (e) => {
            e.preventDefault();
            logoutFn();
        };
    }
}

/**
 * Muestra el popup con la palabra, traducción y ejemplo
 */
export async function showFlashcardPopup(text, mouseX, mouseY) {
    const popup = document.getElementById('flashcard-popup');
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
        popup.style.top = `${mouseY + 20}px`;
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
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        };
    }

    // --- 6. LLAMADA A LA IA ---
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/analyze-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
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
export function closeFlashcardPopup() {
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

// FUNCIONES GLOBALES PARA EL HTML
window.changeArticleLevel = (id, lvl) => loadFullArticle(id, lvl);
window.saveFlashcardToStorage = saveFlashcardToStorage;
window.showFlashcardPopup = showFlashcardPopup; // Añade esta línea
window.closeFlashcardPopup = closeFlashcardPopup; // Añade esta línea

// ESCUCHAR CAMBIOS DE NAVEGACIÓN
window.addEventListener('hashchange', initReader);