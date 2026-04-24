/**
 * api.js - Maneja la comunicación con el backend (Node.js)
 */
// En js/api.js
import { MOCK_ARTICLES } from './mockData.js';

// Variable global temporal para la simulación
window.currentSimulationArticle = null;

export const API_BASE_URL = 'http://localhost:3001/api';

/** Obtener los artículos diarios (Conectado a la ruta de fusión) */
export async function fetchDailyArticles(topic = 'news') {
    try {
        // Llamamos a la ruta que fusiona DB + JSON pasando el tópico
        const response = await fetch(`${API_BASE_URL}/articles?topic=${topic}`); 
        if (!response.ok) throw new Error(`Error en API: ${response.status}`);
        
        const data = await response.json();
        return data; 
    } catch (error) {
        console.error("❌ Error al obtener artículos reales:", error);
        return { articles: [] };
    }
}

/**
 * Obtiene un artículo específico por su ID y Nivel desde el backend real (SQLite)
 */
export async function fetchArticleById(id, level = 'B1') {
    try {
        const lvl = encodeURIComponent(String(level || 'B1').toUpperCase().trim());
        const response = await fetch(`${API_BASE_URL}/articles/${id}?level=${lvl}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        // 💡 Si el servidor responde con error (404, 500, etc), lanzamos una alerta
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error("❌ Error de conexión en fetchArticleById:", error);
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