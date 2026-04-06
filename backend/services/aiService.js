const axios = require('axios');
require('dotenv').config();

/**
 * Service for interacting with AI models via OpenRouter API
 */
class AiService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.apiUrl = "https://openrouter.ai/api/v1/chat/completions";

        if (!this.apiKey) {
            console.error('❌ OpenRouter API key not configured.');
        } else {
            console.log('✅ AiService initialized correctly');
        }

        // Definimos las reglas de niveles como una propiedad de la clase
        this.levelRules = {
            'A1': "- Use only basic vocabulary (top 500 words).\n- Use very simple present tense sentences.\n- Avoid any complex connectors.",
            'A2': "- Use common vocabulary and simple past/future tenses.\n- Use basic connectors like 'and', 'but', 'because'.",
            'B1': "- Use intermediate vocabulary and compound sentences.\n- Use perfect tenses and logical connectors (however, therefore).",
            'B2': "- Use upper-intermediate vocabulary and some idioms.\n- Use complex sentence structures and passive voice.",
            'C1': "- Use advanced/academic vocabulary and sophisticated structures.\n- Use professional idioms and nuanced expressions.",
            'C2': "- Use near-native, complex vocabulary and highly sophisticated stylistic devices."
        };
    }

    /**
     * Re-escribe un artículo para un nivel específico (La función que pide articles.js)
     */
    async generateLeveledArticle(text, level = 'B1', interestsList = '', difficultWordsList = '') {
        const rules = this.levelRules[level] || this.levelRules['B1'];

        const prompt = `
        Rewrite and adapt this article for an ${level} English learner.
        ${interestsList}
        ${difficultWordsList}
        
        Specific Rules for ${level} level:
        ${rules}
        - Divide the text into clear paragraphs.
        - Each paragraph should focus on one main idea.
        
        Original text:
        ${text}
        `;

        try {
            console.log(`✨ Generando versión nivel ${level}...`);
            const response = await axios.post(this.apiUrl, {
                model: "openai/gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are an expert English teacher specialized in CEFR levels." },
                    { role: "user", content: prompt }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("❌ Error en generateLeveledArticle:", error.message);
            throw error;
        }
    }

    /**
     * Función genérica para preguntar a la IA
     */
    async ask(prompt, systemRole = "You are a helpful language learning assistant.") {
        try {
            const response = await axios.post(this.apiUrl, {
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'system', content: systemRole },
                    { role: 'user', content: prompt }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error("❌ Error en AiService.ask:", error.message);
            throw error;
        }
    }

    /**
     * Genera un Quiz de 3 preguntas
     */
    async generateQuizFromText(text, level = 'B2') {
        const systemRole = `You are an expert English teacher. 
        Create a 3-question multiple-choice quiz based on the provided text.
        Target level: ${level}.
        Return ONLY a JSON object with this structure:
        {
          "quizzes": [
            {
              "question": "string",
              "options": ["opt1", "opt2", "opt3"],
              "correct_index": 0,
              "hint": "string"
            }
          ]
        }`;

        try {
            const response = await this.ask(text, systemRole);
            const cleanResponse = response.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(cleanResponse);
            return parsed.quizzes;
        } catch (error) {
            console.error("❌ Error generating quiz:", error);
            return [];
        }
    }
}

// Exportamos una INSTANCIA de la clase para que articles.js pueda usarla
module.exports = new AiService();
