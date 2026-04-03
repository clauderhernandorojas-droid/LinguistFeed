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
    await refreshSavedWords();
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

        // --- RENDERIZADO DEL ARTÍCULO ---
        // IMPORTANTE: Usamos id="interactive-text" para que funcionen las flashcards
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
                
                <div id="quiz-section" class="text-center mt-5 p-4 border-top">
                    <h4>Ready to test your knowledge?</h4>
                    <button id="generate-quiz-btn" class="btn btn-primary btn-lg shadow-sm">
                        🧠 Generate AI Quiz
                    </button>
                    <div id="quiz-container" class="mt-4 text-start" style="display:none;"></div>
                </div>
            </div>
        `;

        // --- RESALTADO DE PALABRAS GUARDADAS ---
        const interactiveContainer = document.getElementById('interactive-text');
        if (interactiveContainer) {
            applyHighlights(interactiveContainer);
        }

        if (loadingDiv) loadingDiv.style.display = 'none';

        // --- 1. ACTIVAR FLASHCARDS (Vital) ---
        if (typeof setupTextInteractivity === 'function') {
            setupTextInteractivity(); 
        }

        // --- 2. LÓGICA DEL BOTÓN DEL QUIZ ---
        const quizBtn = document.getElementById('generate-quiz-btn');
        if (quizBtn) {
            quizBtn.onclick = async () => {
                const qContainer = document.getElementById('quiz-container');
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
                        quizBtn.style.display = 'none';
                        displayQuiz(data.quizzes);
                    } else {
                        qContainer.style.display = 'block';
                        qContainer.innerHTML = '<p class="text-warning">No quizzes returned by server.</p>';
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

// Función para renderizar el quiz de forma segura (usando textContent)
function displayQuiz(questions) {
    // Buscamos el contenedor específico dentro de la sección del artículo
    const container = document.querySelector('#quiz-section #quiz-container') || 
                      document.getElementById('quiz-container');
    
    if (!container) return;

    container.innerHTML = '<h3 class="mt-4 mb-3">Reading Comprehension</h3>';
    container.style.display = 'block';

    questions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm border-0';
        card.style.background = '#f8fafc';

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        // Pregunta segura
        const questionText = document.createElement('p');
        questionText.className = 'fw-bold mb-3';
        questionText.textContent = `${index + 1}. ${q.question}`;
        cardBody.appendChild(questionText);

        // Opciones seguras
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'd-grid gap-2';

        q.options.forEach((opt, optIndex) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-primary text-start btn-sm py-2 px-3';
            btn.textContent = opt;
            
            btn.onclick = () => {
                // Deshabilitar todos los botones de esta pregunta
                const allBtns = optionsDiv.querySelectorAll('button');
                allBtns.forEach(b => b.disabled = true);

                if (optIndex === q.correct_index) {
                    btn.className = 'btn btn-success text-start btn-sm py-2 px-3';
                    showFeedback(cardBody, '✅ Correct! Well done.', 'text-success');
                } else {
                    btn.className = 'btn btn-danger text-start btn-sm py-2 px-3';
                    showFeedback(cardBody, `❌ Incorrect. The right answer was: ${q.options[q.correct_index]}`, 'text-danger');
                }
            };
            optionsDiv.appendChild(btn);
        });

        cardBody.appendChild(optionsDiv);
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
window.changeArticleLevel = (id, lvl) => loadFullArticle(id, lvl);
window.saveFlashcardToStorage = saveFlashcardToStorage;
window.showFlashcardPopup = showFlashcardPopup; // Añade esta línea
window.closeFlashcardPopup = closeFlashcardPopup; // Añade esta línea

// ESCUCHAR CAMBIOS DE NAVEGACIÓN
window.addEventListener('hashchange', initReader);