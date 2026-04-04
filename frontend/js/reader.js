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
let savedWordsSet = new Set(); // Aquí guardaremos tus palabras "tesoro"

export async function initReader() {
    const container = document.getElementById('articles-container');
    const loadingDiv = document.getElementById('loading');
    // Definimos el contenedor del quiz que está en tu HTML
    const quizContainer = document.getElementById('quiz-container');
    
    // 1. Recuperar preferencias
    const userMode = localStorage.getItem('userMode') || 'read'; 
    const currentLevel = localStorage.getItem('selectedLevel') || 'A2'; 

    // 2. Analizar la URL (Hash)
    const hash = window.location.hash.substring(1); 
    const params = new URLSearchParams(hash);
    const articleId = params.get('id');
    const topic = params.get('topic');

    if (!container) return;

    try {
        if (articleId) {
            // Caso A: Mostrar el artículo completo
            await loadFullArticle(articleId, currentLevel);
            renderLevelSelector(articleId, currentLevel);

            // --- ESTE ES EL CAMBIO QUE ME PREGUNTASTE ---
            if (userMode === 'listen') {
                // 1. Escondemos el texto del artículo
                if (container) container.style.display = 'none';

                // 2. Aseguramos que el Quiz SI esté visible
                if (quizContainer) {
                    quizContainer.style.display = 'block';
                }

                // 3. Mostramos los controles de audio
                window.renderAudioControls();

                console.log("📢 Iniciando voz...");
                setTimeout(() => {
                    window.speakArticle();
                }, 500);
            } else {
                // Si es modo Read, nos aseguramos que el texto se vea
                if (container) container.style.display = 'block';
                // Y si el quiz estaba abierto de antes, lo dejamos ahí
                if (quizContainer) quizContainer.style.display = 'block';
            }
            // --------------------------------------------

        } else if (topic) {
            // Caso B: Mostrar lista de artículos de un tema
            await loadDailyArticlesList(topic);
        } else {
            // Caso C: No hay nada, mostrar iconos de temas
            displayTopicSelection();
        }
    } catch (error) {
        console.error("❌ Error en initReader:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Error de conexión.</p>`;
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}

/**
 * Muestra la cuadrícula de temas inicial
 */
function displayTopicSelection() {
    const container = document.getElementById('articles-container');
    const levels = document.getElementById('level-selector-container');
    if (levels) levels.innerHTML = ''; 
    
    // CAMBIO IMPORTANTE: Los IDs ahora coinciden con la consola ['culture', 'world', 'science', 'technology']
    const topics = [
        { id: 'science', icon: '🔬', label: 'Science', color: '#e2f2ff' },
        { id: 'technology', icon: '💻', label: 'Tech', color: '#e6fffa' },
        { id: 'world', icon: '📜', label: 'History', color: '#fffaf0' }, // 'world' es el ID real
        { id: 'culture', icon: '🎨', label: 'Culture', color: '#f5f5f5' }
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
/**
 * Carga la lista de artículos obtenidos por el scraper real
 */
async function loadDailyArticlesList(filterTopic = null) {
    const container = document.getElementById('articles-container');
    const levels = document.getElementById('level-selector-container');
    if (levels) levels.innerHTML = '';

    try {
        const data = await fetchDailyArticles(); 
        const articlesArray = data.articles || data;

        // --- DIAGNÓSTICO EN VIVO ---
        // Vamos a ver qué temas existen realmente en esos 20 artículos
        const temasExistentes = [...new Set(articlesArray.map(a => a.topic))];
        console.log("🔍 Temas reales encontrados en el servidor:", temasExistentes);
        // ---------------------------

        if (articlesArray.length === 0) {
            container.innerHTML = "<p>No hay artículos hoy.</p>";
            return;
        }

        // Filtro ultra-flexible: quitamos espacios y pasamos a minúsculas
        const filtered = filterTopic 
            ? articlesArray.filter(a => {
                const temaArticulo = a.topic.trim().toLowerCase();
                const temaBuscado = filterTopic.trim().toLowerCase();
                
                // 1. Coincidencia exacta o parcial (ej: "tech" en "technology")
                const isMatch = temaArticulo.includes(temaBuscado) || temaBuscado.includes(temaArticulo);
                
                // 2. Regla especial para Culture (por si el scraper devuelve "art")
                const isArtCulture = (temaBuscado === 'culture' && temaArticulo.includes('art'));

                return isMatch || isArtCulture;
            })
            : articlesArray;
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:50px;">
                    <p>No articles found for: <b>${filterTopic}</b></p>
                    <p style="font-size:0.8rem; color:gray;">I found these topics instead: ${temasExistentes.join(', ')}</p>
                    <a href="#" onclick="window.location.hash=''; return false;" style="color:#007bff; font-weight:bold;">← Back to Topics</a>
                </div>`;
            return;
        }

        // El resto del renderizado (el container.innerHTML con el .map) sigue igual...
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <a href="#" onclick="window.location.hash=''; return false;" style="text-decoration:none; color:#007bff; font-weight:bold;">← Back to Topics</a>
                <h2 style="margin-top:10px; text-transform: capitalize;">${filterTopic} Articles</h2>
            </div>
            <div class="articles-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                ${filtered.map(article => `
                    <div class="card" style="padding:15px; border:1px solid #eee; border-radius:10px; display: flex; flex-direction: column; justify-content: space-between; background: white;">
                        <div>
                            <span class="badge" style="background:#007bff; color:white; padding:2px 8px; border-radius:5px; font-size:0.7rem; text-transform: uppercase;">${article.topic}</span>
                            <h3 style="margin:10px 0; font-size: 1.1rem; line-height: 1.3;">${article.title}</h3>
                            <p style="font-size: 0.85rem; color: #555;">${article.content.substring(0, 100)}...</p>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <a href="#" onclick="localStorage.setItem('userMode', 'read'); window.location.href='reader.html#id=${article.id}'; return false;"
                               style="flex: 1; padding: 10px; background: #007bff; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">Read</a>
                            <a href="#" onclick="localStorage.setItem('userMode', 'listen'); window.location.href='reader.html#id=${article.id}'; return false;"
                               style="flex: 1; padding: 10px; background: #28a745; color: white; text-align: center; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">Listen 🔊</a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

    } catch (error) {
        console.error("Error:", error);
    }
}

/**
 * Carga y renderiza un artículo completo con niveles CEFR
 */
/**
 * Carga y renderiza un artículo completo con niveles CEFR
 */
export async function loadFullArticle(id, level = null) {
    if (typeof refreshSavedWords === 'function') await refreshSavedWords();
    const container = document.getElementById('articles-container');
    const quizContainer = document.getElementById('quiz-container'); // Contenedor exterior
    const loadingDiv = document.getElementById('loading');
    
    if (!container) return;

    const currentLevel = level || localStorage.getItem('user-level') || 'B1';
    if (level) localStorage.setItem('user-level', level); 

    if (loadingDiv) loadingDiv.style.display = 'block';
    
    // Limpieza total antes de cargar
    container.innerHTML = ""; 
    if (quizContainer) {
        quizContainer.innerHTML = ""; 
        quizContainer.style.display = 'none';
    }

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/articles/${id}?level=${currentLevel}`);
        if (!response.ok) throw new Error(`Article not found`);
        const article = await response.json();

        if (loadingDiv) loadingDiv.style.display = 'none';

        // --- 1. RENDERIZADO DEL ARTÍCULO (Solo texto) ---
        container.innerHTML = `
            <div class="article-full animate__animated animate__fadeIn">
                <button onclick="window.location.hash=''" class="btn btn-outline-secondary mb-4">
                    ← Back to Articles
                </button>
                <h1 id="interactive-title" class="mb-3">${article.title}</h1>
                <div class="article-meta mb-4">
                    <span class="badge bg-primary">${article.level}</span>
                    <span class="text-muted ms-2">Topic: ${article.topic || 'General'}</span>
                </div>
                <div id="interactive-text" class="article-body-text">
                    ${article.content}
                </div>
            </div>
        `;

        // --- 2. RENDERIZADO DEL BOTÓN DEL QUIZ (En el contenedor exterior) ---
        if (quizContainer) {
            quizContainer.style.display = 'block'; // Lo hacemos visible
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

        // --- INTERACTIVIDAD (Flashcards, etc.) ---
        const interactiveContainer = document.getElementById('interactive-text');
        if (interactiveContainer && typeof applyHighlights === 'function') {
            applyHighlights(interactiveContainer);
        }
        if (typeof setupTextInteractivity === 'function') {
            setupTextInteractivity(); 
        }

        // --- LÓGICA DEL BOTÓN DEL QUIZ ---
        const quizBtn = document.getElementById('generate-quiz-btn');
        if (quizBtn) {
            quizBtn.onclick = async () => {
                const resultsArea = document.getElementById('quiz-results-area');
                quizBtn.disabled = true;
                quizBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
                
                try {
                    const res = await fetch(`${CONFIG.API_BASE_URL}/generate-quiz-only`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: article.content, level: article.level })
                    });
                    const data = await res.json();
                    
                    if (data.quizzes) {
                        quizBtn.style.display = 'none'; // Escondemos el botón
                        resultsArea.style.display = 'block'; // Mostramos la zona de resultados
                        // Dibujamos el quiz en la zona de resultados
                        displayQuiz(data.quizzes, 'quiz-results-area'); 
                    }
                } catch (e) {
                    console.error("Quiz error:", e);
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
    
    levelContainer.innerHTML = levels.map(level => `
        <button 
            class="level-btn ${level === activeLevel ? 'active' : ''}" 
            onclick="changeArticleLevel('${currentArticleId}', '${level}')"
            style="margin-right: 8px; padding: 5px 15px; cursor: pointer; border-radius: 15px; border: 1px solid #007bff; 
                   background: ${level === activeLevel ? '#007bff' : 'white'}; 
                   color: ${level === activeLevel ? 'white' : '#007bff'};"
        >
            ${level}
        </button>
    `).join('');
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
    // --- NUEVO: Capturamos la traducción para no perderla ---
    const translationElement = document.getElementById('flashcard-translation'); 
    
    if (!wordElement) return;
    
    const word = wordElement.textContent;
    const example = exampleElement ? exampleElement.textContent : "";
    const translation = translationElement ? translationElement.textContent : "";
    const currentLevel = localStorage.getItem('user-level') || 'B1';

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/flashcards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // MODIFICACIÓN: Guardamos la traducción dentro del campo 'context' 
            // para que quepa en tu base de datos actual sin errores.
            body: JSON.stringify({ 
                word, 
                context: `[${translation}] - ${example}`, 
                level: currentLevel 
            })
        });

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
        // Añadimos el /api/ que faltaba y corregimos la sintaxis
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/flashcards`);
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
window.changeArticleLevel = async (id, lvl) => {
    console.log(`Cambiando artículo ${id} al nivel ${lvl}...`);
    
    // 1. Guardamos la preferencia en el navegador
    localStorage.setItem('selectedLevel', lvl);
    
    // 2. Recargamos el contenido con el nuevo nivel
    await loadFullArticle(id, lvl);
    
    // 3. Volvemos a dibujar los botones para que el nuevo nivel salga resaltado
    renderLevelSelector(id, lvl);
};

window.speakArticle = () => {
    window.speechSynthesis.cancel(); // Limpia cualquier audio anterior

    const text = document.getElementById('articles-container').innerText;
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;

    // Guardamos referencia para que el navegador no lo interrumpa
    window.currentUtterance = utterance; 
    window.speechSynthesis.speak(utterance);
};
// 2. Función para mostrar/ocultar el texto
window.toggleTranscript = () => {
    const c = document.getElementById('articles-container');
    c.style.display = (c.style.display === 'none') ? 'block' : 'none';
};

function renderAudioControls() {
    const selector = document.getElementById('level-selector-container');
    if (!selector) return;

    let panel = document.getElementById('audio-controls-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'audio-controls-panel';
        panel.style = "background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; border: 1px solid #e9ecef;";
        selector.parentNode.insertBefore(panel, selector.nextSibling);
    }

    panel.innerHTML = `
        <div style="flex: 1;">
            <span style="font-weight: bold;">Audio Mode 🎧</span>
            <div style="display: flex; gap: 10px; margin-top:5px;">
                <button onclick="window.speechSynthesis.pause()">Pause</button>
                <button onclick="window.speechSynthesis.resume()">Resume</button>
                <button onclick="window.speechSynthesis.cancel()">Stop</button>
            </div>
        </div>
        <button onclick="window.toggleTranscript()" style="padding:10px; background:white; border:1px solid #007bff; color:#007bff; border-radius:5px;">Show/Hide Text</button>
    `;
}

// También es buena idea detenerlo cuando se hace logout o se cambia de sección
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

// --- SISTEMA DE AUDIO Y CONTROLES (NUEVO) ---

/**
 * Función que hace hablar al navegador.
 */
window.speakArticle = () => {
    // 🔇 Detenemos cualquier voz anterior para que no se solapen
    window.speechSynthesis.cancel(); 

    const container = document.getElementById('articles-container');
    if (!container) return;

    // Obtenemos el texto limpio de tags HTML
    const text = container.innerText.trim();

    if (text.length === 0) {
        console.error("❌ No articles-container not found or empty");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // Voz en inglés
    utterance.rate = 0.9;      // Velocidad un poco más lenta para estudiantes

    // TRUCO: Guardamos la referencia global para que el navegador no corte el audio en textos largos
    window.currentUtterance = utterance; 

    window.speechSynthesis.speak(utterance);
    console.log("📢 Lectura iniciada.");
};

/**
 * Dibuja el panel gris con Pause/Stop justo debajo de los niveles.
 */
window.renderAudioControls = () => {
    // Buscamos donde ponerlo (debajo de A1-C2)
    const selectorContainer = document.getElementById('level-selector-container');
    if (!selectorContainer) return;

    // Si ya existe, no lo dibujamos otra vez
    if (document.getElementById('audio-controls-panel')) return;

    const audioPanel = document.createElement('div');
    audioPanel.id = 'audio-controls-panel';
    // Estilo elegante en gris
    audioPanel.style = "background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 15px; border: 1px solid #e9ecef;";

    audioPanel.innerHTML = `
        <div style="flex: 1;">
            <span style="font-weight: bold; color: #4a5568; display: block; margin-bottom: 5px;">Audio Mode 🎧</span>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.speechSynthesis.pause()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">⏸ Pause</button>
                <button onclick="window.speechSynthesis.resume()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">▶ Resume</button>
                <button onclick="window.speechSynthesis.cancel()" style="cursor:pointer; padding: 5px 10px; border-radius: 4px; border: 1px solid #ccc; background: white;">Stop</button>
            </div>
        </div>
        <button onclick="window.toggleTranscript()" style="cursor:pointer; padding: 10px; background: white; border: 1px solid #007bff; color: #007bff; border-radius: 5px; font-weight: bold;">
            Show/Hide Text
        </button>
    `;

    // Lo insertamos justo después de los botones de nivel
    selectorContainer.parentNode.insertBefore(audioPanel, selectorContainer.nextSibling);
};

/**
 * Función para el botón "Show/Hide Text"
 */
window.toggleTranscript = () => {
    const content = document.getElementById('articles-container');
    const btn = event.target;
    if (!content) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        btn.innerText = 'Hide Text';
    } else {
        content.style.display = 'none';
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


window.saveFlashcardToStorage = saveFlashcardToStorage;
window.showFlashcardPopup = showFlashcardPopup; // Añade esta línea
window.closeFlashcardPopup = closeFlashcardPopup; // Añade esta línea

// ESCUCHAR CAMBIOS DE NAVEGACIÓN
window.addEventListener('hashchange', initReader);