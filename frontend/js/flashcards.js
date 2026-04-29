let flashcards = JSON.parse(localStorage.getItem("linguistfeed_flashcards")) || [];
let currentIndex = 0;

function speakCurrentWord() {
    if (flashcards.length === 0) return;
    const w = (flashcards[currentIndex].word || "").trim();
    if (!w) return;
    if (typeof window.speechSynthesis === "undefined") {
        return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
}

/** Lexispelling import CSV: un mazo por archivo; cabeceras fijas. */
function exportLexispellingCsv() {
    if (flashcards.length === 0) return;
    const headers = ["Palabra", "Frase", "Nota", "Traducción", "Traducción frase"];
    const lines = [headers.map(escapeCsvField).join(",")];
    for (const c of flashcards) {
        const def = c.definition && c.definition !== "Saved from reader" ? c.definition : "";
        const row = [
            c.word || "",
            c.example || "",
            def,
            c.translation || "",
            "",
        ];
        lines.push(row.map(escapeCsvField).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `linguistfeed-flashcards-${todayStamp()}.csv`);
}

function exportJsonBackup() {
    if (flashcards.length === 0) return;
    const json = JSON.stringify(flashcards, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `linguistfeed-flashcards-${todayStamp()}.json`);
}

function escapeCsvField(value) {
    if (value == null) return '""';
    const s = String(value);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function todayStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function setPageActionsVisible(visible) {
    const bar = document.getElementById("flashcard-page-actions");
    if (bar) bar.hidden = !visible;
}

// 2. Esta es tu función principal de inicio
export function initFlashcards() {
    const storedData = localStorage.getItem("linguistfeed_flashcards");
    flashcards = JSON.parse(storedData) || [];

    if (typeof loadFlashcards === "function") loadFlashcards();

    const card = document.getElementById("flashcard-inner");
    if (card) {
        card.addEventListener("click", function (e) {
            if (e.target.closest("button")) return;
            this.classList.toggle("is-flipped");
        });
    }

    const speakBtn = document.getElementById("flashcard-speak-btn");
    if (speakBtn) {
        speakBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            speakCurrentWord();
        });
    }

    if (typeof setupEventListeners === "function") setupEventListeners();
}

function loadFlashcards() {
    const noFlashcards = document.getElementById("no-flashcards");
    const container = document.getElementById("flashcard-container");

    if (flashcards.length === 0) {
        if (noFlashcards) noFlashcards.style.display = "block";
        if (container) container.style.display = "none";
        setPageActionsVisible(false);
        return;
    }

    if (noFlashcards) noFlashcards.style.display = "none";
    if (container) container.style.display = "block";
    setPageActionsVisible(true);

    showFlashcard();
}

function showFlashcard() {
    if (flashcards.length === 0) return;
    const card = flashcards[currentIndex];

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text || "";
    };

    setText("flashcard-word", card.word);
    setText("flashcard-definition", card.definition || "No definition");
    setText("flashcard-translation", card.translation);
    setText("flashcard-example", card.example);

    if (typeof window.speechSynthesis !== "undefined") {
        window.speechSynthesis.cancel();
    }

    const inner = document.getElementById("flashcard-inner");
    if (inner) inner.classList.remove("is-flipped");
}

function setupEventListeners() {
    const nextBtn = document.getElementById("next-button");
    const prevBtn = document.getElementById("prev-button");
    const flipBtn = document.getElementById("flip-button");
    const deleteBtn = document.getElementById("delete-button");
    const exportCsv = document.getElementById("export-csv-btn");
    const exportJson = document.getElementById("export-json-btn");

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
        flipBtn.onclick = function () {
            const inner = document.getElementById("flashcard-inner");
            if (inner) inner.classList.toggle("is-flipped");
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

    if (exportCsv) {
        exportCsv.onclick = () => exportLexispellingCsv();
    }
    if (exportJson) {
        exportJson.onclick = () => exportJsonBackup();
    }
}
