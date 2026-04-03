let flashcards = JSON.parse(localStorage.getItem("linguistfeed_flashcards")) || [];
let currentIndex = 0;

// 1. Esta función configura el clic en la tarjeta
function setupFlashcardInteractions() {
    const cardInner = document.getElementById("flashcard-inner");

    if (cardInner) {
        cardInner.onclick = function() {
            this.classList.toggle("is-flipped");
        };
    }
}

// 2. Esta es tu función principal de inicio
export function initFlashcards() {
    console.log("🎴 Iniciando Flashcards...");

    // 1. Cargar datos del LocalStorage
    const storedData = localStorage.getItem("linguistfeed_flashcards");
    flashcards = JSON.parse(storedData) || [];
    console.log("Datos cargados:", flashcards.length);

    // 2. Mostrar la primera tarjeta
    if (typeof loadFlashcards === 'function') loadFlashcards();

    // 3. --- EL "SÚPER" ESCUCHADOR DE CLICS ---
    // Buscamos el contenedor por ID
    const card = document.getElementById("flashcard-inner");
    
    if (card) {
        console.log("✅ Elemento 'flashcard-inner' encontrado. Asignando clic...");
        
        // Usamos addEventListener que es más robusto que .onclick
        card.addEventListener('click', function(e) {
            console.log("🎯 ¡Clic detectado en la tarjeta!");
            this.classList.toggle("is-flipped");
        });
    } else {
        console.error("❌ ERROR: No se encontró el elemento con ID 'flashcard-inner'. Revisa tu HTML.");
    }

    // 4. Configurar botones
    if (typeof setupEventListeners === 'function') setupEventListeners();
}

function loadFlashcards() {
    const noFlashcards = document.getElementById("no-flashcards");
    const container = document.getElementById("flashcard-container");

    if (flashcards.length === 0) {
        if (noFlashcards) noFlashcards.style.display = "block";
        if (container) container.style.display = "none";
        return;
    }

    if (noFlashcards) noFlashcards.style.display = "none";
    if (container) container.style.display = "block";

    showFlashcard();
}

function showFlashcard() {
    if (flashcards.length === 0) return;
    const card = flashcards[currentIndex];

    // Usamos una función auxiliar para evitar el error de "null"
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text || "";
    };

    setText("flashcard-word", card.word);
    setText("flashcard-definition", card.definition || "No definition");
    setText("flashcard-translation", card.translation);
    setText("flashcard-example", card.example);

    // RESET DEL GIRO: Cada vez que cambias de carta, vuelve al frente
    const inner = document.getElementById("flashcard-inner");
    if (inner) inner.classList.remove("is-flipped");
}

function setupEventListeners() {
    // Evitamos duplicar eventos limpiando el botón antes de asignar
    const nextBtn = document.getElementById("next-button");
    const prevBtn = document.getElementById("prev-button");
    const flipBtn = document.getElementById("flip-button");
    const deleteBtn = document.getElementById("delete-button");

    if (nextBtn) {
        nextBtn.onclick = () => {
            currentIndex = (currentIndex + 1) % flashcards.length;
            showFlashcard();
        };
    }

    if (prevBtn) {
        prevBtn.onclick = () => {
            currentIndex = (currentIndex - 1 + flashcards.length) % flashcards.length;
            showFlashcard();
        };
    }

    if (flipBtn) {
        flipBtn.onclick = function() {
            const inner = document.getElementById("flashcard-inner");
            if (inner) {
                console.log("Btn: Girando tarjeta...");
                inner.classList.toggle("is-flipped");
            }
        };
    } else {
        console.error("❌ No se encontró el botón con ID 'flip-button'");
    }

    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (confirm("Delete this card?")) {
                flashcards.splice(currentIndex, 1);
                localStorage.setItem("linguistfeed_flashcards", JSON.stringify(flashcards));
                if (currentIndex >= flashcards.length) currentIndex = 0;
                loadFlashcards();
            }
        };
    }
}