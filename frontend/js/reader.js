let correctAnswersCount = 0;

let totalQuestionsInQuiz = 0;

let questionsAnswered = 0;



import { fetchDailyArticles, fetchArticleById } from './api.js';



export async function initReader() {

    const container = document.getElementById('articles-container');

    const loadingDiv = document.getElementById('loading');

    if (!container) return;



    const params = new URLSearchParams(window.location.search);

    const articleId = params.get('id');

    const topic = params.get('topic');



    console.log("🕵️ Parámetros extraídos -> ID:", articleId, "| TOPIC:", topic);



    try {

        if (articleId) {

            await loadFullArticle(articleId);

        } else if (topic) {

            await loadArticlesByTopic(topic);

        } else {

            displayTopicSelection();

        }

    } catch (error) {

        console.error("❌ Error en initReader:", error);

    } finally {

        if (loadingDiv) loadingDiv.style.display = 'none';

    }

}



export function displayTopicSelection() {

    const container = document.getElementById('articles-container');

   

    // Obtenemos el nivel actual guardado (por defecto B1)

    const currentLevel = localStorage.getItem('user-level') || 'B1';

   

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

    const topics = [

        { id: 'homework', name: 'Reading Homework', icon: '📚' }, // Nueva categoría

        { id: 'technology', name: 'Technology', icon: '💻' },

        { id: 'science', name: 'Science', icon: '🔬' },

        { id: 'world', name: 'World News', icon: '🌍' },

        { id: 'culture', name: 'Culture', icon: '🎨' }

    ];



    container.innerHTML = `

        <div style="max-width: 1000px; margin: 0 auto; padding: 20px; font-family: sans-serif;">

            <div style="text-align: center; margin-bottom: 40px; background: #f0f4f8; padding: 20px; border-radius: 12px;">

                <h3 style="margin-top:0; color: #334e68;">Select your English Level:</h3>

                <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">

                    ${levels.map(lvl => `

                        <button

                            onclick="changeUserLevel('${lvl}')"

                            style="padding: 10px 20px; border: 2px solid ${lvl === currentLevel ? '#007bff' : '#cbd5e0'};

                                   background: ${lvl === currentLevel ? '#007bff' : 'white'};

                                   color: ${lvl === currentLevel ? 'white' : '#4a5568'};

                                   border-radius: 25px; cursor: pointer; font-weight: bold; transition: 0.3s;"

                        >

                            ${lvl}

                        </button>

                    `).join('')}

                </div>

            </div>



            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">

                ${topics.map(t => `

                    <a href="?topic=${t.id}" style="text-decoration: none; color: inherit;">

                        <div class="topic-card" style="padding: 30px; border: 1px solid #ddd; border-radius: 12px; text-align: center; cursor: pointer; background: white; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

                            <div style="font-size: 3rem; margin-bottom: 10px;">${t.icon}</div>

                            <h3 style="margin: 0;">${t.name}</h3>

                        </div>

                    </a>

                `).join('')}

            </div>

        </div>

    `;

}



async function loadArticlesByTopic(topic) {

    const container = document.getElementById('articles-container');

    container.innerHTML = `<div style="text-align:center; padding:20px;">Searching latest ${topic} articles...</div>`;



    try {

        // 1. OBTENER EL NIVEL: Leemos lo que guardó el selector de botones (por defecto B1)

        const currentLevel = localStorage.getItem('user-level') || 'B1';

        console.log(`📡 Solicitando artículos de ${topic} para nivel: ${currentLevel}`);



        // 2. LLAMADA A LA API: Ahora le pasamos el nivel como argumento

        const data = await fetchDailyArticles(currentLevel);

        const allArticles = data.articles || [];



        // 3. FILTRADO: Buscamos los que coincidan con el tema (Culture, World, etc.)

        const filtered = allArticles.filter(a =>

            a.topic && a.topic.toLowerCase().trim() === topic.toLowerCase().trim()

        );



        if (filtered.length === 0) {

            container.innerHTML = `

                <div style="text-align:center; padding: 50px; font-family: sans-serif;">

                    <h3>No articles found for "${topic}" in level ${currentLevel}.</h3>

                    <p>Try clicking <b>World News</b> or <b>Culture</b>.</p>

                    <a href="?" style="color: #007bff; text-decoration: none; font-weight: bold;">← Back to Topics</a>

                </div>`;

            return;

        }



        // 4. RENDERIZADO: Generamos las tarjetas de los artículos

        let html = `<h2 style="margin: 20px; font-family: sans-serif;">Latest in ${topic.toUpperCase()} (${currentLevel})</h2>`;

        html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px;">`;



        filtered.forEach(article => {

            html += `

                <a href="?id=${article.id}" style="text-decoration: none; color: inherit;">

                    <div style="border: 1px solid #eee; padding: 20px; border-radius: 10px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); height: 100%; transition: transform 0.2s;">

                        <h3 style="margin: 0 0 10px 0; font-family: sans-serif;">${article.title}</h3>

                        <p style="color: #666; font-size: 0.9rem; font-family: sans-serif;">${article.content.substring(0, 150)}...</p>

                        <span style="color: #007bff; font-weight: bold; font-size: 0.8rem;">Read Full Story →</span>

                    </div>

                </a>`;

        });

       

        html += `</div>`;

        container.innerHTML = html;



    } catch (error) {

        console.error("❌ Error en loadArticlesByTopic:", error);

        container.innerHTML = "<p style='text-align:center; color:red;'>Error loading articles. Please check your connection.</p>";

    }

}

// ... mantén tus funciones de loadFullArticle, handleLogout y saveFlashcardToStorage al final



/**

 * 4. ARTÍCULO COMPLETO

 */

async function loadFullArticle(id) {

    const container = document.getElementById('articles-container');

    if (!container) return;

   

    container.innerHTML = "<div style='text-align:center; padding:50px;'>Loading article and quiz...</div>";



    try {

        // 1. OBTENEMOS EL NIVEL ACTUAL DEL USUARIO

        const currentLevel = localStorage.getItem('user-level') || 'B1';



        // 2. PEDIMOS LOS ARTÍCULOS PASANDO EL NIVEL

        const data = await fetchDailyArticles(currentLevel);

       

        // 3. BUSCAMOS EL ARTÍCULO

        // Primero intentamos con la simulación global, si no, buscamos en la data devuelta

        let article = (window.currentSimulationArticle && String(window.currentSimulationArticle.id) === String(id))

                      ? window.currentSimulationArticle

                      : data.articles.find(a => String(a.id) === String(id));



        if (!article) {

            container.innerHTML = `<h3>Article not found.</h3><p>ID: ${id} | Level: ${currentLevel}</p><a href="?">Return home</a>`;

            return;

        }



        // GENERACIÓN DEL HTML (Artículo + Espacio para el Quiz)

        container.innerHTML = `

            <article style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif;">

                <a href="?topic=${article.topic.toLowerCase()}" style="text-decoration:none; color:#007bff; font-weight:bold;">← Back to ${article.topic}</a>

               

                <h1 style="font-size: 2.2rem; margin: 25px 0 15px 0; line-height: 1.2;">${article.title}</h1>

               

                <div id="interactive-text" style="font-size: 1.25rem; line-height: 1.8; color: #333; cursor: pointer; user-select: text; margin-bottom: 50px;">

                    ${article.content}

                </div>



                <hr style="border:0; border-top: 2px solid #eee; margin: 40px 0;">

                <div id="quiz-section" style="background: #f9f9f9; padding: 30px; border-radius: 15px; border: 1px solid #ddd; margin-bottom: 50px;">

                    <h2 style="margin-top:0;">📝 Quick Check: Comprehension</h2>

                    <div id="quiz-container">

                        <p style="color: #666;">Loading questions...</p>

                    </div>

                </div>

            </article>

        `;



        // --- 1. ACTIVAR EL QUIZ ---

        if (typeof displayQuiz === 'function') {

            displayQuiz(article);

        }



        // --- 2. ACTIVAR INTERACTIVIDAD DEL TEXTO ---

        const textContainer = document.getElementById('interactive-text');



        // Escuchador para SELECCIÓN (Arrastrar)

        textContainer.addEventListener('mouseup', () => {

            const selection = window.getSelection();

            const selectedText = selection.toString().trim();

            if (selectedText.length > 0) {

                showFlashcardPopup(selectedText);

            }

        });



        // Escuchador para CLIC (Palabra única)

        textContainer.addEventListener('click', (e) => {

            const selection = window.getSelection();

            if (selection.toString().trim().length === 0) {

                let range;

                if (document.caretRangeFromPoint) {

                    range = document.caretRangeFromPoint(e.clientX, e.clientY);

                }

                if (range) {

                    selection.removeAllRanges();

                    selection.addRange(range);

                    selection.modify('move', 'backward', 'word');

                    selection.modify('extend', 'forward', 'word');

                    let word = selection.toString().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");

                    if (word.length > 0) {

                        showFlashcardPopup(word);

                    }

                    selection.removeAllRanges();

                }

            }

        });



    } catch (error) {

        console.error("❌ Error en loadFullArticle:", error);

        container.innerHTML = "<p style='color:red; text-align:center;'>Error loading the article content.</p>";

    }

}



/**

 * Función auxiliar para mostrar el popup de la flashcard

 */
async function showFlashcardPopup(text) {
    let popup = document.getElementById('dict-popup');

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'dict-popup';
        Object.assign(popup.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '320px',
            backgroundColor: 'white',
            padding: '20px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            borderRadius: '15px',
            zIndex: '1000',
            fontFamily: 'sans-serif'
        });
        document.body.appendChild(popup);
    }

    const isSingleWord = text.trim().split(/\s+/).length === 1;

    // 1. ESTRUCTURA BASE
    popup.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #333; font-size: 1.1rem;">${isSingleWord ? 'Word' : 'Selection'}</h3>
            <button onclick="this.parentElement.parentElement.style.display='none'" style="border:none; background:none; cursor:pointer; font-size:1.5rem; color:#999;">&times;</button>
        </div>

        <p id="flashcard-word" style="font-size: 1.2rem; font-weight: bold; margin-bottom: 5px; color: #007bff;">${text}</p>

        <div id="translation-content" style="margin-bottom: 10px; color: #d9534f; font-style: italic; font-size: 1rem;">
            Translating...
        </div>

        <div id="api-content"></div>

        <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
            <div style="display: flex; gap: 10px;">
                <button onclick="window.speakWord('${text.replace(/'/g, "\\'")}')" 
                        style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #007bff; background: #f0f7ff; color: #007bff; cursor: pointer; font-weight: bold;">
                    🔊 Listen
                
                <button onclick="window.saveFlashcardToStorage('${text.replace(/'/g, "\\'")}')" 
                        style="flex: 1.5; padding: 12px; border-radius: 8px; border: none; background: #28a745; color: white; cursor: pointer; font-weight: bold;">
                    💾 Save Flashcard
                </button>
            </div>
        </div>
    `;

    popup.style.display = 'block';

    // 2. TRADUCCIÓN
    const translationDiv = document.getElementById('translation-content');
    try {
        const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`);
        const transData = await transRes.json();
        const translation = transData.responseData.translatedText;
        translationDiv.innerHTML = `🇪🇸 ${translation}`;
    } catch (e) {
        translationDiv.innerHTML = "Translation unavailable.";
    }

    // 3. DICCIONARIO (Solo si es una palabra)
    if (isSingleWord) {
        const apiContent = document.getElementById('api-content');
        apiContent.innerHTML = `<p style="color: #888; font-size: 0.8rem;">Searching English definition...</p>`;

        try {
            const cleanWord = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
            if (!response.ok) throw new Error();
            const data = await response.json();
            const definition = data[0].meanings[0].definitions[0].definition;
            apiContent.innerHTML = `
                <div style="margin-top: 8px; padding: 10px; background: #e7f3ff; border-left: 4px solid #007bff; border-radius: 4px;">
                    <strong style="display:block; font-size:0.7rem; color:#007bff; margin-bottom:3px;">ENGLISH DEFINITION:</strong>
                    <p style="margin: 0; font-size: 0.9rem; line-height: 1.4;">${definition}</p>
                </div>
            `;
        } catch (e) {
            apiContent.innerHTML = "";
        }
    }
}

/**

 * 5. UTILIDADES (Logout, Flashcards, etc.)

 */

export function handleLogout(logoutFn) {

    const logoutLink = document.getElementById('logout-link');

    if (logoutLink) {

        logoutLink.addEventListener('click', (e) => {

            e.preventDefault();

            logoutFn();

        });

    }

}



// Escuchador global para cerrar popups si los hay

document.addEventListener('click', (e) => {

    if (e.target && e.target.id === 'close-flashcard-btn') {

        const popup = document.getElementById('flashcard-popup');

        if (popup) popup.style.display = 'none';

    }

});

/**

 * 6. SISTEMA DE FLASHCARDS

 * Esta función debe estar exportada para que el HTML la reconozca.

 */
window.saveFlashcardToStorage = saveFlashcardToStorage;

export async function saveFlashcardToStorage(injectedWord = null) {
    // 1. Prioridad: ¿Viene la palabra desde el botón? 
    // Si no, la buscamos en el ID o en la selección (como antes)
    let word = injectedWord;

    if (!word) {
        const wordElement = document.getElementById('flashcard-word');
        word = wordElement ? wordElement.innerText.trim() : window.getSelection().toString().trim();
    }

    // 2. Si después de todo sigue vacío, abortamos
    if (!word || word === "") {
        console.error("❌ No se encontró palabra para guardar.");
        return;
    }

    console.log(`🚀 Guardando palabra confirmada: "${word}"`);

    // --- LÓGICA DE LOCALSTORAGE (Esta parte ya te funcionaba) ---
    let existingCards = [];
    try {
        existingCards = JSON.parse(localStorage.getItem('linguistfeed_flashcards')) || [];
    } catch (e) { existingCards = []; }

    const isDuplicate = existingCards.some(card => card.word.toLowerCase() === word.toLowerCase());

    if (isDuplicate) {
        alert(`💡 "${word}" is already in your list.`);
    } else {
        existingCards.push({
            id: Date.now(),
            word: word,
            date: new Date().toLocaleDateString()
        });
        localStorage.setItem('linguistfeed_flashcards', JSON.stringify(existingCards));
        alert(`✅ "${word}" saved!`);
    }

    // Cerrar popup
    const popup = document.getElementById('dict-popup');
    if (popup) popup.style.display = 'none';

    // Intento de servidor (ignorando el 404)
    fetch('http://localhost:3001/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word })
    }).catch(() => console.log("Servidor offline, pero guardado local OK."));
}

window.saveFlashcardToStorage = saveFlashcardToStorage;

// 4. EXPOSICIÓN GLOBAL (Obligatorio para que el onclick del popup funcione)
window.saveFlashcardToStorage = saveFlashcardToStorage;

/**

 * GENERADOR DE QUIZ DINÁMICO

 * Se encarga de llenar el div #quiz-container con preguntas del artículo

 */

function displayQuiz(article) {

    const quizContainer = document.getElementById('quiz-container');

    if (!quizContainer || !article.quiz) return;



    // Reiniciar contadores globales

    correctAnswersCount = 0;

    questionsAnswered = 0;

    totalQuestionsInQuiz = article.quiz.length;



    quizContainer.innerHTML = ''; // Limpiar contenido previo



    article.quiz.forEach((q, qIndex) => {

        const questionDiv = document.createElement('div');

        questionDiv.style.marginBottom = '30px';

       

        // Título de la pregunta

        const qTitle = document.createElement('p');

        qTitle.style.fontWeight = 'bold';

        qTitle.innerHTML = `${qIndex + 1}. ${q.question}`;

        questionDiv.appendChild(qTitle);



        const interactionDiv = document.createElement('div');

        interactionDiv.id = `interaction-q${qIndex}`;



        // --- CASO 1: OPCIÓN MÚLTIPLE ---

        if (q.type === "multiple") {

            interactionDiv.style.display = 'flex';

            interactionDiv.style.flexDirection = 'column';

            interactionDiv.style.gap = '8px';



            q.options.forEach((opt, oIndex) => {

                const btn = document.createElement('button');

                btn.innerText = opt;

                Object.assign(btn.style, {

                    padding: '12px', borderRadius: '8px', border: '1px solid #ccc',

                    backgroundColor: 'white', cursor: 'pointer', textAlign: 'left'

                });

                // Evento de clic directo (sin strings)

                btn.onclick = () => checkAnswer(qIndex, oIndex, q.answer, interactionDiv);

                interactionDiv.appendChild(btn);

            });

        }

        // --- CASO 2: VERDADERO / FALSO ---

        else if (q.type === "true-false") {

            interactionDiv.style.display = 'flex';

            interactionDiv.style.gap = '10px';

            [true, false].forEach(val => {

                const btn = document.createElement('button');

                btn.innerText = val ? "True" : "False";

                btn.style.flex = "1";

                btn.style.padding = "10px";

                btn.style.borderRadius = "8px";

                btn.style.cursor = "pointer";

                btn.onclick = (e) => window.checkTrueFalse(qIndex, val, q.answer, e.target);

                interactionDiv.appendChild(btn);

            });

        }

        // --- CASO 3: COMPLETAR ---

        else if (q.type === "fill-blank") {

            interactionDiv.style.display = 'flex';

            interactionDiv.style.gap = '10px';

            interactionDiv.innerHTML = `

                <input type="text" id="input-q${qIndex}" placeholder="Type here..." style="flex:1; padding:10px; border-radius:8px; border:1px solid #ccc;">

                <button onclick="window.checkBlank(${qIndex}, '${q.answer}')" style="padding:10px 20px; border-radius:8px; background:#007bff; color:white; border:none; cursor:pointer;">Check</button>

            `;

        }



        questionDiv.appendChild(interactionDiv);



        // Espacio para el feedback

        const feedbackDiv = document.createElement('div');

        feedbackDiv.id = `feedback-q${qIndex}`;

        feedbackDiv.style.marginTop = '10px';

        feedbackDiv.style.fontWeight = 'bold';

        feedbackDiv.style.display = 'none';

        questionDiv.appendChild(feedbackDiv);



        quizContainer.appendChild(questionDiv);

    });

}



function checkAnswer(qIndex, selectedIndex, correctIndex, optionsDiv) {

    if (!optionsDiv) return;

    const buttons = optionsDiv.querySelectorAll('button');

    const feedback = document.getElementById(`feedback-q${qIndex}`);



    // 1. DESHABILITAR Y COLOREAR BOTONES

    buttons.forEach((btn, index) => {

        btn.disabled = true; // No permite cambiar la respuesta

        if (index === correctIndex) {

            btn.style.backgroundColor = '#d4edda'; // Verde para la correcta

            btn.style.borderColor = '#28a745';

        }

        if (index === selectedIndex && selectedIndex !== correctIndex) {

            btn.style.backgroundColor = '#f8d7da'; // Rojo para el error

            btn.style.borderColor = '#dc3545';

        }

    });



    // 2. LÓGICA DE PUNTAJE

    questionsAnswered++;

    if (selectedIndex === correctIndex) {

        correctAnswersCount++;

        feedback.innerText = "Correct! 🌟";

        feedback.style.color = "#28a745";

    } else {

        feedback.innerText = "Not quite. The correct one is in green.";

        feedback.style.color = "#dc3545";

    }

    feedback.style.display = 'block';



    // 3. REVISAR SI TERMINÓ EL QUIZ

    if (typeof showFinalScore === 'function') {

        showFinalScore();

    }

}



/**

 * FUNCIÓN AUXILIAR PARA VALIDAR RESPUESTAS

 * Esta debe ser global para que el 'onclick' del HTML la encuentre

 */

window.checkAnswer = function(button, isCorrect) {

    const feedback = button.parentElement.nextElementSibling;

   

    // Resetear colores de los botones hermanos

    const buttons = button.parentElement.querySelectorAll('button');

    buttons.forEach(btn => {

        btn.style.background = 'white';

        btn.style.borderColor = '#ddd';

    });



    if (isCorrect) {

        button.style.background = '#d4edda'; // Verde clarito

        button.style.borderColor = '#28a745';

        feedback.innerText = "Correct! Well done. 🎉";

        feedback.style.color = "#28a745";

    } else {

        button.style.background = '#f8d7da'; // Rojo clarito

        button.style.borderColor = '#dc3545';

        feedback.innerText = "Not quite. Try reading that part again! 🔍";

        feedback.style.color = "#dc3545";

    }

    feedback.style.display = 'block';

};

window.changeUserLevel = function(newLevel) {

    localStorage.setItem('user-level', newLevel);

    console.log("🚀 Nivel cambiado a:", newLevel);

    // Recargamos la selección de temas para mostrar visualmente el cambio

    displayTopicSelection();

};

/**

 * MOTOR DE VOZ (TTS)

 * Esta función debe ser global para que el atributo 'onclick' del botón la encuentre.

 */

window.speakWord = function(text) {

    // 1. Cancelamos cualquier audio previo para evitar que se amontonen las voces

    if (window.speechSynthesis.speaking) {

        window.speechSynthesis.cancel();

    }



    // 2. Creamos el objeto de lectura

    const utterance = new SpeechSynthesisUtterance(text);

   

    // 3. CAPTURAMOS LA VELOCIDAD

    // Buscamos el selector que pusimos en el popup. Si no existe, usamos 1.0 (normal)

    const speedInput = document.getElementById('tts-speed');

    const speed = speedInput ? parseFloat(speedInput.value) : 1.0;



    utterance.rate = speed; // Ajustamos la velocidad (0.5 lento, 1.0 normal)

    utterance.lang = 'en-US'; // Idioma: Inglés Americano

    utterance.pitch = 1;      // Tono de voz normal



    // 4. ¡A hablar!

    window.speechSynthesis.speak(utterance);

   

    console.log(`🔊 Reproduciendo: "${text}" a velocidad ${speed}x`);

};

// Para Verdadero/Falso

window.checkTrueFalse = function(qIndex, userSelection, correctAnswer, btn) {

    const feedback = document.getElementById(`feedback-q${qIndex}`);

    feedback.style.display = 'block';

   

    // LÓGICA DE PUNTAJE

    questionsAnswered++;

    if (userSelection === correctAnswer) {

        correctAnswersCount++;

        btn.style.background = "#d4edda";

        feedback.innerText = "Correct! Well spotted. ✔️";

        feedback.style.color = "#28a745";

    } else {

        btn.style.background = "#f8d7da";

        feedback.innerText = "Incorrect. Try re-reading that section.";

        feedback.style.color = "#dc3545";

    }



    btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = true);

   

    // REVISAR SI TERMINÓ EL QUIZ

    showFinalScore();

};



// Para el Espacio en Blanco

window.checkBlank = function(qIndex, correctAnswer) {

    const input = document.getElementById(`input-q${qIndex}`);

    const feedback = document.getElementById(`feedback-q${qIndex}`);

    const userGuess = input.value.trim().toLowerCase();

   

    feedback.style.display = 'block';

   

    // LÓGICA DE PUNTAJE

    questionsAnswered++;

    if (userGuess === correctAnswer.toLowerCase()) {

        correctAnswersCount++;

        input.style.borderColor = "#28a745";

        input.style.backgroundColor = "#d4edda";

        feedback.innerText = "Exactly! Great vocabulary. 🌟";

        feedback.style.color = "#28a745";

    } else {

        input.style.borderColor = "#dc3545";

        feedback.innerHTML = `Not quite. The word was: <b>${correctAnswer}</b>`;

        feedback.style.color = "#dc3545";

    }



    // Deshabilitar input y botón para que no cambie la respuesta

    input.disabled = true;

    event.target.disabled = true;



    // REVISAR SI TERMINÓ EL QUIZ

    showFinalScore();

};

function showFinalScore() {

    if (questionsAnswered === totalQuestionsInQuiz) {

        const quizContainer = document.getElementById('quiz-container');

        const scoreDiv = document.createElement('div');

       

        const percentage = Math.round((correctAnswersCount / totalQuestionsInQuiz) * 100);

        let message = percentage >= 70 ? "Excellent job! 🌟" : "Good effort! Keep practicing. 📚";



        Object.assign(scoreDiv.style, {

            marginTop: '30px',

            padding: '20px',

            backgroundColor: '#fff',

            border: '2px solid #007bff',

            borderRadius: '12px',

            textAlign: 'center',

            animation: 'fadeIn 0.5s'

        });



        scoreDiv.innerHTML = `

            <h3 style="margin:0; color:#007bff;">Quiz Completed!</h3>

            <p style="font-size: 1.5rem; font-weight: bold; margin: 10px 0;">Your Score: ${correctAnswersCount} / ${totalQuestionsInQuiz}</p>

            <p style="margin:0; color:#666;">${message} (${percentage}%)</p>

            <button onclick="location.reload()" style="margin-top:15px; padding:10px 20px; border-radius:8px; border:none; background:#007bff; color:white; cursor:pointer;">Try another article</button>

        `;

        quizContainer.appendChild(scoreDiv);

    }

}

// Al final de reader.js

document.addEventListener('DOMContentLoaded', () => {

    const saveBtn = document.getElementById('save-flashcard-btn');

    if (saveBtn) {

        saveBtn.addEventListener('click', saveFlashcardToStorage);

        console.log("✅ Botón de guardado vinculado correctamente");

    }

});