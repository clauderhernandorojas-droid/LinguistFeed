const db = require('../database/db'); // Añade esta línea al principio
const axios = require('axios');
require('dotenv').config();

/**
 * Service for interacting with AI models via OpenRouter API
 * and optionally LM Studio (OpenAI-compatible) for reader analyze/translate.
 */
class AiService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.apiUrl = "https://openrouter.ai/api/v1/chat/completions";

        if (this.useLmStudioForAnalyze()) {
            const cfg = this.getLmStudioAnalyzeConfig();
            console.log(
                `✅ AiService: LM Studio para analyze/translate → ${cfg.url} (model=${cfg.model})`
            );
        }

        if (this.useLmStudioForLeveling()) {
            const cfg = this.getLmStudioAnalyzeConfig();
            console.log(
                `✅ AiService: LM Studio para generateLeveledArticle → ${cfg.url} (model=${cfg.model})`
            );
        }

        if (!this.apiKey) {
            const okDev = this.useLmStudioForAnalyze() && this.isMockSchedulerQuiz();
            if (okDev) {
                console.log(
                    'ℹ️ AiService: sin OPENROUTER_API_KEY (OK: LM Studio analyze + MOCK_SCHEDULER_QUIZ)'
                );
            } else {
                console.warn(
                    '⚠️ OPENROUTER_API_KEY no configurada (necesaria si no usas LM Studio para analyze o desactivas mock del scheduler)'
                );
            }
        } else {
            console.log('✅ AiService: OpenRouter API key presente');
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
     * Traducción/análisis de palabras en el reader vía LM Studio (local).
     * Activar con USE_LMSTUDIO_FOR_ANALYZE=true en backend/.env
     */
    useLmStudioForAnalyze() {
        const v = String(process.env.USE_LMSTUDIO_FOR_ANALYZE || '').toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    /**
     * Reescritura por nivel CEFR vía LM Studio (batch / migrate).
     * Activar con USE_LMSTUDIO_FOR_LEVELING=true
     */
    useLmStudioForLeveling() {
        const v = String(process.env.USE_LMSTUDIO_FOR_LEVELING || '').toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    getLmStudioAnalyzeConfig() {
        const url =
            (process.env.LMSTUDIO_CHAT_URL || 'http://127.0.0.1:1234/v1/chat/completions').trim();
        const model = (process.env.LMSTUDIO_MODEL || 'qwen2.5-3b-instruct').trim();
        return { url, model };
    }

    /**
     * Quiz automático en el scheduler (RSS): desactivar IA en dev con MOCK_SCHEDULER_QUIZ=true
     */
    isMockSchedulerQuiz() {
        const v = String(process.env.MOCK_SCHEDULER_QUIZ ?? 'true').toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    /**
     * LLM local OpenAI-compatible (LM Studio). Sin Authorization.
     */
    async askLmStudio(prompt, systemRole = 'You are a helpful language learning assistant.', opts = {}) {
        const { url, model } = this.getLmStudioAnalyzeConfig();
        const max_tokens = opts.max_tokens != null ? opts.max_tokens : 512;
        const timeout = opts.timeout != null ? opts.timeout : 120000;

        const response = await axios.post(
            url,
            {
                model,
                messages: [
                    { role: 'system', content: systemRole },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout,
                validateStatus: (status) => status >= 200 && status < 300
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (content == null || String(content).trim() === '') {
            throw new Error('LM Studio devolvió respuesta vacía');
        }
        return String(content);
    }

    /**
     * Elige LM Studio solo para analyze/translate del reader.
     */
    async askForAnalyze(prompt, systemRole = 'You are a helpful language learning assistant.', opts = {}) {
        if (this.useLmStudioForAnalyze()) {
            return this.askLmStudio(prompt, systemRole, opts);
        }
        if (!this.apiKey) {
            throw new Error(
                'OPENROUTER_API_KEY no configurada y USE_LMSTUDIO_FOR_ANALYZE no está activo'
            );
        }
        return this.ask(prompt, systemRole);
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

        const systemRole = 'You are an expert English teacher specialized in CEFR levels. Output only the adapted article text, no preamble.';

        try {
            console.log(`✨ Generando versión nivel ${level}...`);

            if (this.useLmStudioForLeveling()) {
                const maxTokens = parseInt(String(process.env.LMSTUDIO_LEVELING_MAX_TOKENS || '8192'), 10) || 8192;
                const timeoutMs = parseInt(String(process.env.LMSTUDIO_LEVELING_TIMEOUT_MS || '180000'), 10) || 180000;
                return await this.askLmStudio(prompt, systemRole, {
                    max_tokens: maxTokens,
                    timeout: timeoutMs
                });
            }

            if (!this.apiKey) {
                if (this.useLmStudioForAnalyze()) {
                    console.warn('ℹ️ generateLeveledArticle: sin OPENROUTER_API_KEY; usando LM Studio (USE_LMSTUDIO_FOR_ANALYZE)');
                    return await this.askLmStudio(prompt, systemRole, {
                        max_tokens: parseInt(String(process.env.LMSTUDIO_LEVELING_MAX_TOKENS || '8192'), 10) || 8192,
                        timeout: parseInt(String(process.env.LMSTUDIO_LEVELING_TIMEOUT_MS || '180000'), 10) || 180000
                    });
                }
                throw new Error(
                    'OPENROUTER_API_KEY no configurada: define USE_LMSTUDIO_FOR_LEVELING=true o USE_LMSTUDIO_FOR_ANALYZE=true con LM Studio en marcha'
                );
            }

            const response = await axios.post(this.apiUrl, {
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemRole },
                    { role: 'user', content: prompt }
                ]
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('❌ Error en generateLeveledArticle:', error.message);
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
            console.error("❌ Error generating quiz:", summarizeError(error));
            return [];
        }
    }

    isMockReaderQuiz() {
        const v = String(process.env.MOCK_READER_QUIZ || '').toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    mockRichQuizForReader(level = 'B1') {
        const tag = `[Demo · ${level}]`;
        return [
            {
                type: 'mcq',
                question: `${tag} What is this mock quiz for?`,
                options: ['Production traffic only', 'Previewing the reader UI without API credits', 'Encrypting passwords'],
                correct_index: 1,
                hint: 'Toggle MOCK_READER_QUIZ off and add credits to use real AI.'
            },
            {
                type: 'mcq',
                question: `${tag} To switch back to the real generator you should…`,
                options: [
                    'Set MOCK_READER_QUIZ=false (or remove it), ensure OPENROUTER_API_KEY, add credits',
                    'Only clear browser cache',
                    'Change the article ID only'
                ],
                correct_index: 0,
                hint: 'Environment + OpenRouter billing.'
            },
            {
                type: 'tf',
                statement: `${tag} True/false cards use a statement and a boolean correct answer.`,
                correct: true
            },
            {
                type: 'tf',
                statement: `${tag} This demo statement is intentionally false.`,
                correct: false
            }
        ];
    }

    async generateRichQuizForReader(text, level = 'B1') {
        if (this.isMockReaderQuiz()) {
            return this.mockRichQuizForReader(level);
        }
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY no está configurada en backend/.env');
        }
        const excerpt = String(text || '').trim().slice(0, 14000);
        if (!excerpt) throw new Error('Texto del artículo vacío');

        const systemRole = `You are an expert English teacher.
Based ONLY on the article text below, create reading comprehension exercises for CEFR level ${level}.

Return ONLY a valid JSON object with this exact structure:
{
  "quizzes": [
    {
      "type": "mcq",
      "question": "string",
      "options": ["string", "string", "string"],
      "correct_index": 0,
      "hint": "string"
    },
    {
      "type": "tf",
      "statement": "A clear statement about the text that is either true or false",
      "correct": true
    }
  ]
}

Rules:
- Include exactly 2 items with "type": "mcq" and exactly 2 with "type": "tf".
- Each mcq must have exactly 3 options; correct_index is 0, 1, or 2.
- Each tf must use "statement" and boolean "correct".
- No markdown and no commentary.`;

        const response = await this.ask(excerpt, systemRole);
        const stripped = String(response || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const slice = extractFirstJsonObject(stripped) || stripped;
        let parsed;
        try {
            parsed = JSON.parse(slice);
        } catch (e) {
            throw new Error('La IA no devolvió JSON válido para el quiz.');
        }

        const raw = Array.isArray(parsed.quizzes) ? parsed.quizzes : [];
        const normalized = [];
        for (const item of raw) {
            if (!item || typeof item !== 'object') continue;
            const t = String(item.type || '').toLowerCase();
            if (t === 'tf' || t === 'true_false') {
                const statement = String(item.statement || item.question || '').trim();
                let c = item.correct;
                if (c === 'true') c = true;
                if (c === 'false') c = false;
                if (!statement || (c !== true && c !== false)) continue;
                normalized.push({ type: 'tf', statement, correct: c });
            } else {
                const opts = item.options;
                const ci = parseInt(item.correct_index, 10);
                if (!Array.isArray(opts) || opts.length < 3 || Number.isNaN(ci) || ci < 0 || ci > 2) continue;
                normalized.push({
                    type: 'mcq',
                    question: String(item.question || '').trim(),
                    options: [String(opts[0]), String(opts[1]), String(opts[2])],
                    correct_index: ci,
                    hint: item.hint != null ? String(item.hint) : ''
                });
            }
        }

        if (normalized.length === 0) {
            throw new Error('No se pudo normalizar ninguna pregunta del quiz.');
        }
        return normalized;
    }
    async generateQuiz(articleId, text, level) {
        try {
            if (this.isMockSchedulerQuiz()) {
                return true;
            }
            // 1. Generamos las preguntas usando la IA
            const questions = await this.generateQuizFromText(text, level);
            
            // 2. Las guardamos en la base de datos
            for (const q of questions) {
                await db.run(
                    `INSERT INTO quizzes (article_id, level, question, option_a, option_b, option_c, correct_option, hint) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [articleId, level, q.question, q.options[0], q.options[1], q.options[2], q.correct_index, q.hint]
                );
            }
            return true;
        } catch (error) {
            console.error("Error en generateQuiz:", summarizeError(error));
            throw error;
        }
    }
    /**
     * Analiza o traduce un texto/palabra (Esta es la que buscaba articles.js)
     */
    async analyzeText(text, type = 'general') {
        // 1. EL FILTRO: ¿Es un título o una palabra?
        if (type === 'translate') {
            try {
                console.log("🎯 Procesando como TÍTULO (Traducción simple):", text.substring(0, 20));
                const translation = await this.askForAnalyze(
                    text,
                    'Translate this English title to natural Spanish. Return ONLY the translation.',
                    { max_tokens: 128 }
                );
                return {
                    translation: translation.trim(),
                    definition: "Article Title", // Evita el "No definition found"
                    example: "Context: News Headline"
                };
            } catch (error) {
                console.error("❌ Error en traducción de título:", summarizeError(error));
                throw error;
            }
        }
    
        // 2. EL RESTO: Si no es 'translate', es una PALABRA (Flashcard completa)
        const systemRole = `You are an expert English teacher. 
        Analyze the provided word or phrase for a Spanish-speaking student.
        Return ONLY a valid JSON object:
        {
          "definition": "Simple English definition",
          "translation": "Spanish translation",
          "example": "Example sentence using the word"
        }`;
    
        try {
            const response = await this.askForAnalyze(text, systemRole, { max_tokens: 512 });
            const cleanJSON = response.replace(/```json/g, "").replace(/```/g, "").trim();
            const data = JSON.parse(cleanJSON);
    
            return {
                definition: data.definition,
                translation: data.translation,
                example: data.example
            };
        } catch (error) {
            console.error("❌ Error en flashcard:", error.message);
            return {
                definition: "Check context",
                translation: "Error",
                example: text
            };
        }
    }
}

function summarizeError(error) {
    const summary = {
        message: error?.message || 'Unknown error'
    };

    if (error?.response?.status != null) {
        summary.status = error.response.status;
    }
    if (error?.code) {
        summary.code = error.code;
    }
    const apiMessage = error?.response?.data?.error?.message || error?.response?.data?.message;
    if (apiMessage) {
        summary.apiMessage = apiMessage;
    }

    return summary;
}

// Exportamos una INSTANCIA de la clase para que articles.js pueda usarla
module.exports = new AiService();
