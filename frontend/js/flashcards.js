let flashcards = JSON.parse(localStorage.getItem("linguistfeed_flashcards")) || [];
let currentIndex = 0;

export function initFlashcards() {
    // Actualizamos la lista por si hubo cambios en reader.js
    flashcards = JSON.parse(localStorage.getItem("linguistfeed_flashcards")) || [];
    loadFlashcards();
    setupEventListeners();
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

    document.getElementById("flashcard-word").textContent = card.word;
    document.getElementById("flashcard-definition").textContent = card.definition || "No definition yet";
    document.getElementById("flashcard-example").textContent = card.example || "";
    document.getElementById("flashcard-translation").textContent = card.translation || "";

    document.getElementById("card-front").style.display = "block";
    document.getElementById("card-back").style.display = "none";
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
        flipBtn.onclick = () => {
            const front = document.getElementById("card-front");
            const back = document.getElementById("card-back");
            if (front.style.display === "none") {
                front.style.display = "block";
                back.style.display = "none";
            } else {
                front.style.display = "none";
                back.style.display = "block";
            }
        };
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