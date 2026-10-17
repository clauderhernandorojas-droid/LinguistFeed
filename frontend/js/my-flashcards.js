import { API_BASE_URL } from './config.js';

const LEGACY_KEY = "linguistfeed_flashcards";
const DECKS_KEY = "linguistfeed_decks_v1";
const CARDS_KEY = "linguistfeed_cards_v1";
const MAX_DECKS = 10;

let decks = [];
let cards = [];
let activeDeckId = null;
let currentIndex = 0;
let selectionMode = false;
let selectedDeckIds = new Set();
let pendingConfirmAction = null;
let studyMode = "single";
let activeStudyCards = [];

export function initFlashcards() {
    migrateLegacyDataIfNeeded();
    loadState();
    bindEvents();
    renderDecksView();
}

function loadState() {
    decks = safeParse(localStorage.getItem(DECKS_KEY), []);
    cards = safeParse(localStorage.getItem(CARDS_KEY), []);
    if (!decks.length) {
        const deck = createDeckObject("General");
        decks = [deck];
        saveDecks();
    }
}

function saveDecks() {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}

function saveCards() {
    localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
}

function migrateLegacyDataIfNeeded() {
    const hasNewModel = localStorage.getItem(DECKS_KEY) || localStorage.getItem(CARDS_KEY);
    if (hasNewModel) return;

    const legacyCards = safeParse(localStorage.getItem(LEGACY_KEY), []);
    const deck = createDeckObject("General");
    const migratedCards = (Array.isArray(legacyCards) ? legacyCards : []).map((c) => ({
        id: createId("card"),
        deckId: deck.id,
        word: c.word || "",
        translation: c.translation || "",
        example: c.example || "",
        definition: c.definition || "Saved from reader",
        phonetic: c.phonetic || c.ipa || "",
        createdAt: c.date || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));

    localStorage.setItem(DECKS_KEY, JSON.stringify([deck]));
    localStorage.setItem(CARDS_KEY, JSON.stringify(migratedCards));
}

function bindEvents() {
    on("new-deck-btn", "click", createDeck);
    on("deck-search-input", "input", renderDecksView);
    on("cancel-select-mode-btn", "click", deselectAllDecks);
    on("deselect-all-btn", "click", deselectAllDecks);
    on("review-selected-btn", "click", openSelectedDecksStudyView);
    on("export-all-json-btn", "click", exportAllJsonBackup);

    // Sincronización directa con Cloud Firestore (Lexispelling)
    on("btn-sync-lexispelling", "click", syncWithLexispellingCloud);
    on("btn-sync-selected-lexispelling", "click", syncWithLexispellingCloud);
    on("study-sync-lexispelling-btn", "click", syncWithLexispellingCloud);

    // Exportación oficial estandarizada a Lexispelling (.csv)
    on("btn-export-lexispelling-csv", "click", exportLexispellingCsv);
    on("btn-export-lexispelling", "click", exportLexispellingCsv);
    on("btn-export-selected-lexispelling", "click", exportLexispellingCsv);
    on("study-export-lexispelling-btn", "click", exportLexispellingCsv);
    on("export-csv-btn", "click", exportActiveDeckCsv);
    on("export-selected-xlsx-btn", "click", exportLexispellingCsv);

    on("back-to-decks-btn", "click", showDecksOnly);
    on("rename-deck-btn", "click", renameActiveDeck);
    on("export-json-btn", "click", exportActiveDeckJson);
    on("delete-all-in-deck-btn", "click", () => {
        if (studyMode !== "single" || !activeDeckId) return;
        const count = cardsForDeck(activeDeckId).length;
        openConfirmModal(
            "Delete all cards",
            `Delete ${count} card(s) from this deck?`,
            () => {
                cards = cards.filter((c) => c.deckId !== activeDeckId);
                saveCards();
                renderStudyView();
            }
        );
    });

    on("prev-button", "click", () => {
        const workingCards = getWorkingStudyCards();
        if (!workingCards.length) return;
        currentIndex = (currentIndex - 1 + workingCards.length) % workingCards.length;
        renderStudyCard();
    });
    on("next-button", "click", () => {
        const workingCards = getWorkingStudyCards();
        if (!workingCards.length) return;
        currentIndex = (currentIndex + 1) % workingCards.length;
        renderStudyCard();
    });
    on("flip-button", "click", () => {
        const inner = el("flashcard-inner");
        if (inner) inner.classList.toggle("is-flipped");
    });
    on("delete-button", "click", deleteCurrentCard);
    on("flashcard-speak-btn", "click", (e) => {
        e.stopPropagation();
        speakCurrentWord();
    });

    const inner = el("flashcard-inner");
    if (inner) {
        inner.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            inner.classList.toggle("is-flipped");
        });
    }

    on("confirm-modal-cancel", "click", closeConfirmModal);
    on("confirm-modal-confirm", "click", () => {
        if (typeof pendingConfirmAction === "function") pendingConfirmAction();
        closeConfirmModal();
    });
    on("confirm-modal", "click", (e) => {
        if (e.target && e.target.id === "confirm-modal") closeConfirmModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeConfirmModal();
    });
}

function createDeck() {
    if (decks.length >= MAX_DECKS) {
        alert(`You reached the deck limit (${MAX_DECKS}). Delete one to create another.`);
        return;
    }
    const name = (prompt("Deck name:") || "").trim();
    if (!name) return;
    if (decks.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
        alert("A deck with that name already exists.");
        return;
    }
    decks.unshift(createDeckObject(name));
    saveDecks();
    renderDecksView();
}

function createDeckObject(name) {
    const now = new Date().toISOString();
    return {
        id: createId("deck"),
        name,
        createdAt: now,
        updatedAt: now,
    };
}

function renderDecksView() {
    showOnly("decks-view");
    const query = (el("deck-search-input")?.value || "").trim().toLowerCase();
    const filtered = decks.filter((d) => d.name.toLowerCase().includes(query));
    const grid = el("decks-grid");
    const empty = el("deck-empty-state");
    if (!grid || !empty) return;

    empty.hidden = filtered.length > 0;
    grid.innerHTML = "";
    filtered.forEach((deck) => {
        const count = cardsForDeck(deck.id).length;
        const selected = isDeckSelected(deck.id);
        const card = document.createElement("article");
        card.className = `deck-card${selected ? " is-selected" : ""}`;
        card.setAttribute("data-id", String(deck.id));
        card.innerHTML = `
            <div class="deck-card-top">
                <label class="deck-checkbox-label" title="Seleccionar mazo">
                    <input type="checkbox" class="deck-selector" data-id="${deck.id}" ${selected ? "checked" : ""} aria-label="Seleccionar mazo ${escapeHtml(deck.name)}" />
                </label>
                <div class="deck-card-quick-actions">
                    <button type="button" class="deck-action-icon-btn deck-export-btn" data-id="${deck.id}" title="Exportar este mazo a Lexispelling (.csv)" aria-label="Exportar mazo (.csv)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button type="button" class="deck-action-icon-btn deck-delete-btn" data-id="${deck.id}" title="Eliminar mazo" aria-label="Eliminar mazo">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
            <div class="deck-card-body">
                <h3 class="deck-card-title" title="${escapeHtml(deck.name)}">${escapeHtml(deck.name)}</h3>
                <div class="deck-card-badge-wrap">
                    <span class="deck-card-badge">${count} flashcard${count === 1 ? "" : "s"}</span>
                </div>
            </div>
            <div class="deck-card-footer">
                <button type="button" class="btn btn-deck-review deck-review-btn" data-id="${deck.id}">
                    <span class="review-icon">▶</span> Review
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll(".deck-review-btn").forEach((b) => {
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            openStudyView(b.getAttribute("data-id"));
        });
    });
    grid.querySelectorAll(".deck-export-btn").forEach((b) => {
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            exportDeckCsvById(b.getAttribute("data-id"));
        });
    });
    grid.querySelectorAll(".deck-delete-btn").forEach((b) => {
        b.addEventListener("click", (e) => {
            e.stopPropagation();
            requestDeleteDeck(b.getAttribute("data-id"));
        });
    });
    grid.querySelectorAll(".deck-selector").forEach((cb) => {
        cb.addEventListener("change", (e) => {
            e.stopPropagation();
            const id = String(e.target.getAttribute("data-id"));
            if (e.target.checked) {
                selectedDeckIds.add(id);
            } else {
                selectedDeckIds.delete(id);
                selectedDeckIds.delete(Number(id));
            }
            const parentCard = cb.closest(".deck-card");
            if (parentCard) {
                parentCard.classList.toggle("is-selected", e.target.checked);
            }
            updateMultiSelectBar();
        });
    });
    grid.querySelectorAll(".deck-checkbox-label").forEach((lbl) => {
        lbl.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    });
    grid.querySelectorAll(".deck-card").forEach((card) => {
        card.addEventListener("click", (e) => {
            if (e.target.closest("button, input, label, a, .deck-action-icon-btn")) return;
            const id = card.getAttribute("data-id");
            if (id) openStudyView(id);
        });
    });

    updateMultiSelectBar();
}

function openStudyView(deckId) {
    studyMode = "single";
    activeDeckId = deckId;
    window.currentStudyDeckId = deckId;
    currentIndex = 0;
    activeStudyCards = cardsForDeck(deckId).map((c) => ({ ...c }));
    renderStudyView();
}

function openSelectedDecksStudyView() {
    const selectedIds = getSelectedDeckIds();
    if (!selectedIds.size) {
        alert("Select at least one deck.");
        return;
    }
    const selectedDecks = decks.filter((d) => selectedIds.has(String(d.id)));
    const merged = [];
    selectedDecks.forEach((deck) => {
        cardsForDeck(deck.id).forEach((card) => {
            merged.push({
                ...card,
                _sourceDeckName: deck.name,
            });
        });
    });
    if (!merged.length) {
        alert("Selected decks have no flashcards.");
        return;
    }
    studyMode = "multi";
    activeDeckId = null;
    window.currentStudyDeckId = null;
    currentIndex = 0;
    activeStudyCards = shuffleArray(merged);
    renderStudyView();
}

function renderStudyView() {
    showOnly("study-view");
    const title = el("study-deck-title");
    const context = el("study-deck-context");

    if (studyMode === "single") {
        const deck = decks.find((d) => d.id === activeDeckId);
        if (!deck) {
            showDecksOnly();
            return;
        }
        if (title) title.textContent = deck.name;
        if (context) context.textContent = "Reviewing one deck";
    } else {
        if (title) title.textContent = "Selected decks review";
        if (context) context.textContent = `${selectedDeckIds.size} deck(s) combined`;
    }

    const workingCards = getWorkingStudyCards();
    const noFlashcards = el("no-flashcards");
    const container = el("flashcard-container");
    updateSingleDeckActionButtons();
    if (noFlashcards) noFlashcards.style.display = workingCards.length ? "none" : "block";
    if (container) container.style.display = workingCards.length ? "block" : "none";
    updateStudyCardCounter(workingCards.length);

    if (!workingCards.length) return;
    if (currentIndex >= workingCards.length) currentIndex = 0;
    renderStudyCard();
}

function updateSingleDeckActionButtons() {
    const singleDeckOnlyIds = [
        "rename-deck-btn",
        "export-csv-btn",
        "export-json-btn",
        "delete-all-in-deck-btn",
    ];
    const disabledInMulti = studyMode !== "single";
    const tooltip = disabledInMulti
        ? "Available only when reviewing one deck."
        : "";
    const note = el("single-deck-actions-note");
    if (note) note.hidden = !disabledInMulti;

    singleDeckOnlyIds.forEach((id) => {
        const btn = el(id);
        if (!btn) return;
        btn.disabled = disabledInMulti;
        btn.title = tooltip;
    });
}

function getWorkingStudyCards() {
    if (studyMode === "multi") return activeStudyCards;
    return cardsForDeck(activeDeckId);
}

function renderStudyCard() {
    const workingCards = getWorkingStudyCards();
    const card = workingCards[currentIndex];
    if (!card) return;

    const title = el("study-deck-title");
    const context = el("study-deck-context");
    if (studyMode === "multi") {
        if (title) title.textContent = "Selected decks review";
        if (context) context.textContent = `Current deck: ${card._sourceDeckName || "Unknown"}`;
    }
    updateStudyCardCounter(workingCards.length);

    setText("flashcard-word", card.word);
    setText("flashcard-definition", card.definition || "No definition");
    setText("flashcard-translation", card.translation || "");
    setText("flashcard-example", card.example || "");

    if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    const inner = el("flashcard-inner");
    if (inner) inner.classList.remove("is-flipped");
}

function updateStudyCardCounter(totalCards) {
    const counter = el("study-card-counter");
    if (!counter) return;
    if (!totalCards) {
        counter.textContent = "Card 0/0";
        return;
    }
    counter.textContent = `Card ${currentIndex + 1}/${totalCards}`;
}

function showDecksOnly() {
    studyMode = "single";
    activeStudyCards = [];
    activeDeckId = null;
    window.currentStudyDeckId = null;
    renderDecksView();
}

function renameActiveDeck() {
    if (studyMode !== "single") {
        alert("Rename is available only when reviewing one deck.");
        return;
    }
    const deck = decks.find((d) => d.id === activeDeckId);
    if (!deck) return;
    const name = (prompt("New deck name:", deck.name) || "").trim();
    if (!name || name === deck.name) return;
    if (decks.some((d) => d.id !== deck.id && d.name.toLowerCase() === name.toLowerCase())) {
        alert("A deck with that name already exists.");
        return;
    }
    deck.name = name;
    deck.updatedAt = new Date().toISOString();
    saveDecks();
    renderStudyView();
}

function notifyDeleteToBackend(card) {
    if (!card || !card.word) return;
    let userId = null;
    let userEmail = null;
    try {
        const u = JSON.parse(localStorage.getItem("linguistfeed_user") || "{}");
        userId = u.id || null;
        userEmail = u.email || null;
    } catch (_) {}

    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const deck = (decks || []).find((d) => String(d.id) === String(card.deckId));
    const deckName = (deck ? deck.name : card._resolvedDeckName) || "General";

    fetch("/api/flashcards/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({
            word: card.word,
            deckName: deckName,
            userId,
            userEmail,
        }),
    }).catch((err) => console.warn("Auto-sync delete notification error:", err));
}

function deleteCurrentCard() {
    const workingCards = getWorkingStudyCards();
    if (!workingCards.length) return;
    const card = workingCards[currentIndex];
    openConfirmModal("Delete card", "Delete this flashcard?", () => {
        cards = cards.filter((c) => c.id !== card.id);
        saveCards();
        if (studyMode === "multi") {
            activeStudyCards = activeStudyCards.filter((c) => c.id !== card.id);
        }
        if (currentIndex >= getWorkingStudyCards().length) currentIndex = 0;
        renderStudyView();

        // Hook automático no bloqueante para desactivar la palabra en Firestore / Lexispelling
        notifyDeleteToBackend(card);
    });
}

function requestDeleteDeck(deckId) {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const count = cardsForDeck(deckId).length;
    openConfirmModal(
        "Delete deck",
        `Delete deck "${deck.name}" and its ${count} card(s)?`,
        () => {
            decks = decks.filter((d) => d.id !== deckId);
            cards = cards.filter((c) => c.deckId !== deckId);
            selectedDeckIds.delete(deckId);
            activeStudyCards = activeStudyCards.filter((c) => c.deckId !== deckId);
            if (!decks.length) decks = [createDeckObject("General")];
            saveDecks();
            saveCards();
            if (studyMode === "single" && activeDeckId === deckId) {
                showDecksOnly();
                return;
            }
            renderDecksView();
        }
    );
}

function cardsForDeck(deckId) {
    const target = String(deckId);
    return cards.filter((c) => String(c.deckId) === target);
}

export function getSelectedDeckIds() {
    const ids = new Set();
    if (selectedDeckIds && selectedDeckIds.size > 0) {
        selectedDeckIds.forEach((id) => {
            if (id != null) ids.add(String(id));
        });
    }
    const checkedCheckboxes = document.querySelectorAll(
        ".deck-selector:checked, .deck-checkbox:checked, input[type='checkbox'].deck-selector:checked, #decks-grid input[type='checkbox']:checked"
    );
    checkedCheckboxes.forEach((cb) => {
        const id = cb.getAttribute("data-id") || cb.value;
        if (id) ids.add(String(id));
    });
    return ids;
}

function isDeckSelected(deckId) {
    if (!selectedDeckIds || selectedDeckIds.size === 0) return false;
    const strId = String(deckId);
    for (const id of selectedDeckIds) {
        if (String(id) === strId) return true;
    }
    return false;
}

function deselectAllDecks() {
    selectedDeckIds.clear();
    const checkedCheckboxes = document.querySelectorAll(".deck-selector:checked, input[type='checkbox'].deck-selector");
    checkedCheckboxes.forEach((cb) => {
        cb.checked = false;
        const parentCard = cb.closest(".deck-card");
        if (parentCard) parentCard.classList.remove("is-selected");
    });
    updateMultiSelectBar();
}

function setSelectionMode(enabled) {
    selectionMode = enabled;
    if (!enabled) deselectAllDecks();
    else updateMultiSelectBar();
}

function updateMultiSelectBar() {
    const bar = el("multi-select-bar");
    const countLabel = el("multi-select-count");
    const reviewBtn = el("review-selected-btn");
    const syncLexiBtn = el("btn-sync-selected-lexispelling");
    const exportLexiBtn = el("btn-export-selected-lexispelling");
    const selectedCount = getSelectedDeckIds().size;

    if (bar) {
        if (selectedCount > 0) {
            bar.hidden = false;
            bar.classList.add("visible");
        } else {
            bar.classList.remove("visible");
            bar.hidden = true;
        }
    }
    if (countLabel) countLabel.textContent = `${selectedCount} selected`;
    if (reviewBtn) reviewBtn.disabled = selectedCount === 0;
    if (syncLexiBtn) syncLexiBtn.disabled = selectedCount === 0;
    if (exportLexiBtn) exportLexiBtn.disabled = selectedCount === 0;
}

function speakCurrentWord() {
    const workingCards = getWorkingStudyCards();
    if (!workingCards.length) return;
    const word = (workingCards[currentIndex].word || "").trim();
    if (!word || typeof window.speechSynthesis === "undefined") return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = "en-US";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
}

function exportActiveDeckCsv() {
    if (studyMode !== "single" || !activeDeckId) return;
    exportDeckCsvById(activeDeckId);
}

function exportDeckCsvById(deckId) {
    const deck = decks.find((d) => String(d.id) === String(deckId));
    if (!deck) return;
    const deckCards = cardsForDeck(deckId);
    if (!deckCards.length) return;
    const headers = [
        "Palabra",
        "Frase",
        "Traducción palabra",
        "Traducción frase",
        "Mazo",
        "Nota",
    ];
    const lines = [headers.join(",")];
    deckCards.forEach((c) => {
        const palabra = (c.word || "").trim();
        if (!palabra) return;
        const frase = (c.example || c.phrase || c.context || "").trim();
        const traduccionPalabra = (c.translation || c.translationWord || "").trim();
        const traduccionFrase = (c.phraseTranslation || c.translationFrase || "").trim();
        const mazo = (deck.name || "General").trim();
        const nota = (
            c.phonetic ||
            c.ipa ||
            c.phonetics ||
            (c.definition && c.definition !== "Saved from reader" ? c.definition : "") ||
            c.notes ||
            c.note ||
            ""
        ).trim();
        const row = [palabra, frase, traduccionPalabra, traduccionFrase, mazo, nota];
        lines.push(row.map(escapeCsvField).join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${slug(deck.name)}-${todayStamp()}.csv`);
}

function exportActiveDeckJson() {
    if (studyMode !== "single" || !activeDeckId) return;
    const deck = decks.find((d) => String(d.id) === String(activeDeckId));
    if (!deck) return;
    const deckCards = cardsForDeck(activeDeckId);
    const blob = new Blob([JSON.stringify({ deck, cards: deckCards }, null, 2)], {
        type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, `${slug(deck.name)}-${todayStamp()}.json`);
}

function exportAllJsonBackup() {
    const blob = new Blob([JSON.stringify({ decks, cards }, null, 2)], {
        type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, `linguistfeed-decks-backup-${todayStamp()}.json`);
}

function exportSelectedDecksCsvWithDeckColumn() {
    const selectedIds = getSelectedDeckIds();
    if (!selectedIds.size) return;
    const headers = [
        "Palabra",
        "Frase",
        "Traducción palabra",
        "Traducción frase",
        "Mazo",
        "Nota",
    ];
    const lines = [headers.join(",")];
    decks
        .filter((d) => selectedIds.has(String(d.id)))
        .forEach((deck) => {
            cardsForDeck(deck.id).forEach((c) => {
                const palabra = (c.word || "").trim();
                if (!palabra) return;
                const frase = (c.example || c.phrase || c.context || "").trim();
                const traduccionPalabra = (c.translation || c.translationWord || "").trim();
                const traduccionFrase = (c.phraseTranslation || c.translationFrase || "").trim();
                const mazo = (deck.name || "General").trim();
                const nota = (
                    c.phonetic ||
                    c.ipa ||
                    c.phonetics ||
                    (c.definition && c.definition !== "Saved from reader" ? c.definition : "") ||
                    c.notes ||
                    c.note ||
                    ""
                ).trim();
                const row = [palabra, frase, traduccionPalabra, traduccionFrase, mazo, nota];
                lines.push(row.map(escapeCsvField).join(","));
            });
        });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `lexispelling-multi-deck-${todayStamp()}.csv`);
}

// ============================================================================
// EXPORTACIÓN ESTANDARIZADA PARA LEXISPELLING (.CSV UTF-8 CON BOM)
// ============================================================================


/**
 * Recolecta las flashcards activas según la prioridad estricta:
 * Prioridad 1 (Modo Selección): Si hay decks seleccionados con checkbox, exporta únicamente las tarjetas de esos decks.
 * Prioridad 2 (Vista de Estudio): Si el usuario está dentro de la vista de estudio (activeDeckId / currentStudyDeckId), exporta las tarjetas de ese mazo específico.
 * Prioridad 3 (Sin selección en vista general): Si no hay nada marcado ni abierto, exporta todas las tarjetas de todos los mazos.
 */
export function getActiveFlashcardsForLexispelling() {
    const deckMap = new Map();
    (decks || []).forEach((d) => {
        deckMap.set(String(d.id), d.name || "General");
    });

    // Helper para normalizar tarjeta al Mazo Central Único "Reading Vocabulary" con tags
    function formatCardForExport(card, originName) {
        const existingTags = Array.isArray(card.tags) ? card.tags.filter(Boolean) : (card.tag ? [card.tag] : []);
        const tags = [...existingTags];
        const cleanOrigin = String(originName || "").trim();
        if (cleanOrigin && cleanOrigin !== "General" && cleanOrigin !== "Reading Vocabulary" && !tags.includes(cleanOrigin)) {
            tags.push(cleanOrigin);
        }

        return {
            ...card,
            deckName: "Reading Vocabulary",
            _resolvedDeckName: "Reading Vocabulary",
            originDeckName: cleanOrigin || "Reading Vocabulary",
            tags: tags,
        };
    }

    // -------------------------------------------------------------
    // PRIORIDAD 1: Modo Selección (si hay decks seleccionados con checkbox)
    // -------------------------------------------------------------
    const selectedIds = getSelectedDeckIds();
    if (selectedIds.size > 0) {
        const matchingDecks = (decks || []).filter((d) => selectedIds.has(String(d.id)));
        const result = [];
        matchingDecks.forEach((deck) => {
            const deckCards = cardsForDeck(deck.id);
            deckCards.forEach((c) => {
                result.push(formatCardForExport(c, deck.name || "General"));
            });
        });
        return result;
    }

    // -------------------------------------------------------------
    // PRIORIDAD 2: Vista de Estudio (si el usuario está dentro de la vista de estudio)
    // -------------------------------------------------------------
    const studySection = el("study-view");
    const isStudyVisible = studySection && !studySection.hidden && window.getComputedStyle(studySection).display !== "none";

    if (isStudyVisible) {
        const studyDeckId = activeDeckId || window.currentStudyDeckId;
        if (studyMode === "single" && studyDeckId) {
            const currentDeck = (decks || []).find((d) => String(d.id) === String(studyDeckId));
            const deckName = currentDeck ? currentDeck.name : "General";
            return cardsForDeck(studyDeckId).map((c) => formatCardForExport(c, deckName));
        }
        if (studyMode === "multi" && activeStudyCards && activeStudyCards.length) {
            return activeStudyCards.map((c) => {
                const deckName = c._sourceDeckName || (c.deckId != null ? deckMap.get(String(c.deckId)) : null) || "General";
                return formatCardForExport(c, deckName);
            });
        }
    }

    // -------------------------------------------------------------
    // PRIORIDAD 3: Sin selección en vista general (exporta todas las flashcards)
    // -------------------------------------------------------------
    if (cards && cards.length > 0) {
        return cards.map((c) => {
            const originName = (c.deckId != null ? deckMap.get(String(c.deckId)) : null) || c._sourceDeckName || "General";
            return formatCardForExport(c, originName);
        });
    }

    // Fallback: verificar legacy cards
    const legacy = safeParse(localStorage.getItem(LEGACY_KEY), []);
    if (Array.isArray(legacy) && legacy.length > 0) {
        return legacy.map((c) => formatCardForExport(c, "General"));
    }

    return [];
}

/**
 * Notificación toast unificada para feedback de usuario.
 */
export function showFlashcardToast(message = "✅ Archivo exportado listo para Lexispelling", duration = 3500) {
    let toast = document.getElementById("flashcards-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "flashcards-toast";
        toast.className = "flashcards-toast";
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.add("show");

    if (toast._timeout) clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            if (!toast.classList.contains("show")) toast.hidden = true;
        }, 300);
    }, duration);
}

/**
 * Extrae y estructura las flashcards activas en las 6 columnas exactas de Lexispelling:
 * [ "Palabra", "Frase", "Traducción palabra", "Traducción frase", "Mazo", "Nota" ]
 */
export function getLexispellingRows() {
    const activeCards = getActiveFlashcardsForLexispelling();
    if (!activeCards || activeCards.length === 0) {
        return null;
    }

    const deckMap = new Map();
    (decks || []).forEach((d) => {
        deckMap.set(String(d.id), d.name || "General");
    });

    // Cabeceras exactas requeridas por Lexispelling
    const headers = [
        "Palabra",
        "Frase",
        "Traducción palabra",
        "Traducción frase",
        "Mazo",
        "Nota",
    ];

    const rows = [headers];

    activeCards.forEach((c) => {
        const palabra = (c.word || "").trim();
        if (!palabra) return; // Ignorar registros vacíos

        // Frase o contexto donde se encontró la palabra
        const frase = (c.example || c.phrase || c.context || "").trim();

        // Traducción de la palabra al español
        const traduccionPalabra = (c.translation || c.translationWord || "").trim();

        // Traducción de la frase (opcional o vacío)
        const traduccionFrase = (c.phraseTranslation || c.translationFrase || "").trim();

        // Nombre real del mazo garantizado
        const mazo = (
            c._resolvedDeckName ||
            c._sourceDeckName ||
            (c.deckId != null ? deckMap.get(String(c.deckId)) : null) ||
            c.deckName ||
            "General"
        ).trim();

        // Fonética IPA o nota gramatical / definición
        const nota = (
            c.phonetic ||
            c.ipa ||
            c.phonetics ||
            (c.definition && c.definition !== "Saved from reader" ? c.definition : "") ||
            c.notes ||
            c.note ||
            ""
        ).trim();

        rows.push([
            palabra,
            frase,
            traduccionPalabra,
            traduccionFrase,
            mazo,
            nota,
        ]);
    });

    return rows;
}

/**
 * Exportación oficial estandarizada para Lexispelling (.csv):
 * Genera el archivo codificado en UTF-8 con prefijo BOM (\uFEFF)
 * con las 6 cabeceras exactas requeridas por Lexispelling:
 * [ Palabra, Frase, Traducción palabra, Traducción frase, Mazo, Nota ]
 */
export function exportLexispellingCsv() {
    try {
        const rows = getLexispellingRows();
        if (!rows) {
            showFlashcardToast("⚠️ No hay flashcards activas para exportar", 3000);
            return false;
        }

        if (rows.length <= 1) {
            showFlashcardToast("⚠️ No hay flashcards válidas con contenido para exportar", 3000);
            return false;
        }

        const csvContent = "\uFEFF" + rows.map((r) => r.map(escapeCsvField).join(",")).join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });

        // Nombramiento dinámico e intuitivo del archivo
        let filename = "LinguistFeed_Lexispelling_Export.csv";
        const selectedIds = getSelectedDeckIds();
        if (selectedIds.size === 1) {
            const singleId = Array.from(selectedIds)[0];
            const d = (decks || []).find((x) => String(x.id) === String(singleId));
            if (d) filename = `${slug(d.name)}-${todayStamp()}.csv`;
        } else if (studyMode === "single" && activeDeckId) {
            const d = (decks || []).find((x) => String(x.id) === String(activeDeckId));
            if (d) filename = `${slug(d.name)}-${todayStamp()}.csv`;
        } else if (selectedIds.size > 1) {
            filename = `lexispelling-multi-deck-${todayStamp()}.csv`;
        }

        downloadBlob(blob, filename);
        showFlashcardToast("✅ Archivo exportado listo para Lexispelling", 4000);
        return true;
    } catch (err) {
        console.error("Error al exportar flashcards en CSV para Lexispelling:", err);
        alert("Ocurrió un error al generar el archivo CSV: " + (err.message || err));
        return false;
    }
}

/**
 * Alias de compatibilidad hacia la exportación oficial CSV.
 * Evita errores en scripts que aún referencien exportLexispellingXlsx.
 */
export async function exportLexispellingXlsx() {
    return exportLexispellingCsv();
}

/**
 * Sincroniza las flashcards activas directamente con Cloud Firestore en Lexispelling.
 */
export async function syncWithLexispellingCloud() {
    try {
        const activeCards = getActiveFlashcardsForLexispelling();
        if (!activeCards || !activeCards.length) {
            showFlashcardToast("⚠️ No hay flashcards activas para sincronizar", 3000);
            return false;
        }

        showFlashcardToast("☁️ Sincronizando palabras con Lexispelling Cloud...", 8000);

        let userId = null;
        let userEmail = null;
        try {
            const raw = localStorage.getItem("linguistfeed_user");
            if (raw) {
                const u = JSON.parse(raw);
                userId = u.id || null;
                userEmail = u.email || null;
            }
        } catch (_) {}

        const token = localStorage.getItem("token");
        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const payload = JSON.stringify({
            cards: activeCards,
            deckName: "Reading Vocabulary",
            userId,
            userEmail,
            email: userEmail,
        });

        // Candidatos de URL para máxima robustez de conexión
        const candidates = [];
        if (typeof API_BASE_URL !== "undefined" && API_BASE_URL) {
            candidates.push(`${API_BASE_URL.replace(/\/+$/, "")}/flashcards/sync-lexispelling`);
        }
        candidates.push("/api/flashcards/sync-lexispelling");
        if (window.location.port !== "3001") {
            candidates.push("http://localhost:3001/api/flashcards/sync-lexispelling");
        }

        let response = null;
        let lastErr = null;

        for (const url of candidates) {
            try {
                response = await fetch(url, {
                    method: "POST",
                    headers,
                    body: payload,
                });
                if (response.ok || response.status < 500) break;
            } catch (netErr) {
                lastErr = netErr;
            }
        }

        if (!response) {
            throw lastErr || new Error("No se pudo conectar con el servidor backend de LinguistFeed");
        }

        const data = await response.json();

        if (response.ok && data.success) {
            if (data.target === "root_backup" && data.fallbackNotice) {
                showFlashcardToast(`☁️ Respaldo en raíz: ${data.count} palabras sincronizadas`, 5000);
            } else {
                showFlashcardToast(`☁️ ¡${data.count} palabras sincronizadas en Lexispelling!`, 4500);
            }
            return true;
        } else {
            const msg = data.error || data.details || "Error al sincronizar con la nube";
            showFlashcardToast(`❌ ${msg}`, 4500);
            return false;
        }
    } catch (err) {
        console.error("Error al sincronizar con Lexispelling Cloud:", err);
        showFlashcardToast(`❌ Error al sincronizar: ${err.message || err}`, 5000);
        return false;
    }
}

// Helpers generales
function openConfirmModal(title, message, onConfirm) {
    const modal = el("confirm-modal");
    setText("confirm-modal-title", title);
    setText("confirm-modal-message", message);
    pendingConfirmAction = onConfirm;
    if (modal) modal.hidden = false;
}

function closeConfirmModal() {
    const modal = el("confirm-modal");
    if (modal) modal.hidden = true;
    pendingConfirmAction = null;
}

function showOnly(sectionId) {
    const ids = ["decks-view", "study-view"];
    ids.forEach((id) => {
        const node = el(id);
        if (node) node.hidden = id !== sectionId;
    });
}

function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value || "";
}

function safeParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function el(id) {
    return document.getElementById(id);
}

function on(id, eventName, handler) {
    const node = el(id);
    if (node) node.addEventListener(eventName, handler);
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function escapeCsvField(value) {
    if (value == null) return "";
    const str = String(value);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
}

function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 1500);
}

function slug(text) {
    return (text || "deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function shuffleArray(input) {
    const arr = [...input];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
