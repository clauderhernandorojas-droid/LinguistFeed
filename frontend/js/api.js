/**
 * api.js - Maneja la comunicación con el backend (Node.js)
 */
// En js/api.js
import { MOCK_ARTICLES } from './mockData.js';

// Variable global temporal para la simulación
window.currentSimulationArticle = null;

export const API_BASE_URL = 'http://localhost:3001';

/** Obtener los artículos diarios */
export async function fetchDailyArticles(level = 'B1') {
    return new Promise((resolve) => {
        setTimeout(() => {
            const articleData = MOCK_ARTICLES[level] || MOCK_ARTICLES["B1"];
            
            // CREAMOS EL OBJETO COMPLETO
            const fullArticle = {
                ...articleData,
                id: "sim-" + level, // ID único para la simulación
                topic: "Science",
                date: "March 24, 2026"
            };

            // GUARDAMOS EN LA VENTANA GLOBAL PARA QUE EL LECTOR LO ENCUENTRE
            window.currentSimulationArticle = fullArticle;

            resolve({ articles: [fullArticle] });
        }, 300);
    });
}

/** Obtener un artículo específico por su ID */
export async function fetchArticleById(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/daily-articles`); 
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        // Usamos == para que compare número con texto sin problemas
        return data.articles.find(a => a.id == id);
    } catch (error) {
        console.error('Error fetching article by id:', error);
        return null;
    }
}

/** Generar flashcard de vocabulario usando IA */
export async function generateFlashcard(word, context) {
    try {
        const response = await fetch(`${API_BASE_URL}/generate-flashcard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word, context })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error generating flashcard:', error);
        throw error;
    }
}

/** Analizar una frase (gramática y significado) */
export async function analyzeSentence(text) {
    try {
        const response = await fetch(`${API_BASE_URL}/analyze-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, type: "explain" })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const result = await response.json();
        return result.explanation || result.text || "No explanation returned.";
    } catch (error) {
        console.error("Error analyzing sentence:", error);
        return "Error analyzing sentence.";
    }
}

/** Traducir texto seleccionado */
export async function translateText(text) {
    try {
        const response = await fetch(`${API_BASE_URL}/analyze-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, type: "translate" })
        });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const result = await response.json();
        return result.translation || result.text || "No translation returned.";
    } catch (error) {
        console.error("Error translating text:", error);
        return "Translation error";
    }
}

/** Obtener progreso del usuario */
export async function fetchUserProgress(userId) {
    // Simulación de respuesta de progreso
    return { articlesRead: 0, quizzesTaken: 0, vocabularyLearned: 0, streak: 0 };
}

/** Enviar respuestas del quiz */
export async function submitQuizAnswers(userId, articleId, answers) {
    // Simulación de envío
    return { score: 0, correctAnswers: 0, totalQuestions: answers.length };
}