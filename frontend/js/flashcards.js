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
        createdAt: c.date || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }));

    localStorage.setItem(DECKS_KEY, JSON.stringify([deck]));
    localStorage.setItem(CARDS_KEY, JSON.stringify(migratedCards));
}

function bindEvents() {
    on("new-deck-btn", "click", createDeck);
    on("deck-search-input", "input", renderDecksView);
    on("toggle-select-mode-btn", "click", () => setSelectionMode(!selectionMode));
    on("cancel-select-mode-btn", "click", () => setSelectionMode(false));
    on("export-selected-xlsx-btn", "click", exportSelectedDecksCsvWithDeckColumn);
    on("export-all-json-btn", "click", exportAllJsonBackup);
    on("back-to-decks-btn", "click", showDecksOnly);
    on("rename-deck-btn", "click", renameActiveDeck);
    on("delete-all-in-deck-btn", "click", () => {
        if (!activeDeckId) return;
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
        const activeCards = cardsForDeck(activeDeckId);
        if (!activeCards.length) return;
        currentIndex = (currentIndex - 1 + activeCards.length) % activeCards.length;
        renderStudyCard();
    });
    on("next-button", "click", () => {
        const activeCards = cardsForDeck(activeDeckId);
        if (!activeCards.length) return;
        currentIndex = (currentIndex + 1) % activeCards.length;
        renderStudyCard();
    });
    on("flip-button", "click", () => {
        const inner = el("flashcard-inner");
        if (inner) inner.classList.toggle("is-flipped");
    });
    on("delete-button", "click", deleteCurrentCard);
    on("export-csv-btn", "click", exportActiveDeckCsv);
    on("export-json-btn", "click", exportActiveDeckJson);
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
        const selected = selectedDeckIds.has(deck.id);
        const card = document.createElement("article");
        card.className = `deck-card${selected ? " is-selected" : ""}`;
        card.innerHTML = `
            <div class="deck-card-header">
                ${selectionMode ? `<input type="checkbox" class="deck-selector" data-id="${deck.id}" ${selected ? "checked" : ""} />` : ""}
                <h3>${escapeHtml(deck.name)}</h3>
            </div>
            <p>${count} flashcard(s)</p>
            <div class="deck-card-actions">
                <button class="btn deck-review-btn" data-id="${deck.id}">Review</button>
                <button class="btn deck-export-btn" data-id="${deck.id}">Export CSV</button>
                <button class="btn btn-danger deck-delete-btn" data-id="${deck.id}">Delete</button>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll(".deck-review-btn").forEach((b) => {
        b.addEventListener("click", () => openStudyView(b.getAttribute("data-id")));
    });
    grid.querySelectorAll(".deck-export-btn").forEach((b) => {
        b.addEventListener("click", () => exportDeckCsvById(b.getAttribute("data-id")));
    });
    grid.querySelectorAll(".deck-delete-btn").forEach((b) => {
        b.addEventListener("click", () => requestDeleteDeck(b.getAttribute("data-id")));
    });
    grid.querySelectorAll(".deck-selector").forEach((cb) => {
        cb.addEventListener("change", (e) => {
            const id = e.target.getAttribute("data-id");
            if (e.target.checked) selectedDeckIds.add(id);
            else selectedDeckIds.delete(id);
            updateMultiSelectBar();
            renderDecksView();
        });
    });

    updateMultiSelectBar();
}

function openStudyView(deckId) {
    activeDeckId = deckId;
    currentIndex = 0;
    renderStudyView();
}

function renderStudyView() {
    showOnly("study-view");
    const deck = decks.find((d) => d.id === activeDeckId);
    if (!deck) {
        showDecksOnly();
        return;
    }
    const title = el("study-deck-title");
    if (title) title.textContent = deck.name;

    const activeCards = cardsForDeck(activeDeckId);
    const noFlashcards = el("no-flashcards");
    const container = el("flashcard-container");
    if (noFlashcards) noFlashcards.style.display = activeCards.length ? "none" : "block";
    if (container) container.style.display = activeCards.length ? "block" : "none";

    if (!activeCards.length) return;
    if (currentIndex >= activeCards.length) currentIndex = 0;
    renderStudyCard();
}

function renderStudyCard() {
    const activeCards = cardsForDeck(activeDeckId);
    const card = activeCards[currentIndex];
    if (!card) return;

    setText("flashcard-word", card.word);
    setText("flashcard-definition", card.definition || "No definition");
    setText("flashcard-translation", card.translation || "");
    setText("flashcard-example", card.example || "");

    if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    const inner = el("flashcard-inner");
    if (inner) inner.classList.remove("is-flipped");
}

function showDecksOnly() {
    activeDeckId = null;
    renderDecksView();
}

function renameActiveDeck() {
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

function deleteCurrentCard() {
    const activeCards = cardsForDeck(activeDeckId);
    if (!activeCards.length) return;
    const card = activeCards[currentIndex];
    openConfirmModal("Delete card", "Delete this flashcard?", () => {
        cards = cards.filter((c) => c.id !== card.id);
        saveCards();
        if (currentIndex >= cardsForDeck(activeDeckId).length) currentIndex = 0;
        renderStudyView();
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
            if (!decks.length) decks = [createDeckObject("General")];
            saveDecks();
            saveCards();
            renderDecksView();
        }
    );
}

function cardsForDeck(deckId) {
    return cards.filter((c) => c.deckId === deckId);
}

function setSelectionMode(enabled) {
    selectionMode = enabled;
    if (!enabled) selectedDeckIds = new Set();
    const toggleBtn = el("toggle-select-mode-btn");
    if (toggleBtn) toggleBtn.textContent = enabled ? "Selecting..." : "Select";
    renderDecksView();
}

function updateMultiSelectBar() {
    const bar = el("multi-select-bar");
    const countLabel = el("multi-select-count");
    if (bar) bar.hidden = !selectionMode;
    if (countLabel) countLabel.textContent = `${selectedDeckIds.size} selected`;
}

function speakCurrentWord() {
    const activeCards = cardsForDeck(activeDeckId);
    if (!activeCards.length) return;
    const word = (activeCards[currentIndex].word || "").trim();
    if (!word || typeof window.speechSynthesis === "undefined") return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = "en-US";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
}

function exportActiveDeckCsv() {
    if (!activeDeckId) return;
    exportDeckCsvById(activeDeckId);
}

function exportDeckCsvById(deckId) {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const deckCards = cardsForDeck(deckId);
    if (!deckCards.length) return;
    const headers = ["Palabra", "Frase", "Nota", "Traducción", "Traducción frase"];
    const lines = [headers.join(",")];
    deckCards.forEach((c) => {
        const note = c.definition && c.definition !== "Saved from reader" ? c.definition : "";
        const row = [c.word || "", c.example || "", note, c.translation || "", ""];
        lines.push(row.map(escapeCsvField).join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${slug(deck.name)}-${todayStamp()}.csv`);
}

function exportActiveDeckJson() {
    if (!activeDeckId) return;
    const deck = decks.find((d) => d.id === activeDeckId);
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
    if (!selectedDeckIds.size) return;
    const headers = ["Mazo", "Palabra", "Frase", "Nota", "Traducción palabra", "Traducción frase"];
    const lines = [headers.join(",")];
    decks
        .filter((d) => selectedDeckIds.has(d.id))
        .forEach((deck) => {
            cardsForDeck(deck.id).forEach((c) => {
                const note = c.definition && c.definition !== "Saved from reader" ? c.definition : "";
                const row = [deck.name, c.word || "", c.example || "", note, c.translation || "", ""];
                lines.push(row.map(escapeCsvField).join(","));
            });
        });
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `lexispelling-multi-deck-${todayStamp()}.csv`);
}

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
    a.click();
    URL.revokeObjectURL(a.href);
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
