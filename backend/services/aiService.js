const db = require('../database/db'); // Añade esta línea al principio
const axios = require('axios');
require('dotenv').config();

/**
 * Service for interacting with AI models via Google Gemini (OpenAI-compatible endpoint),
 * OpenRouter API fallback, or optionally LM Studio (OpenAI-compatible) for local testing.
 */
class AiService {
    constructor() {
        this.apiKey = (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();
        this.apiUrl = (
            process.env.GEMINI_API_URL ||
            (process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY
                ? 'https://openrouter.ai/api/v1/chat/completions'
                : 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
        ).trim();
        this.defaultModel = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();

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
                    'ℹ️ AiService: sin GEMINI_API_KEY / OPENROUTER_API_KEY (OK: LM Studio analyze + MOCK_SCHEDULER_QUIZ)'
                );
            } else {
                console.warn(
                    '⚠️ GEMINI_API_KEY (o OPENROUTER_API_KEY) no configurada (necesaria si no usas LM Studio para analyze o desactivas mock del scheduler)'
                );
            }
        } else {
            const providerName = this.apiUrl.includes('generativelanguage.googleapis.com') ? 'Google Gemini' : 'OpenRouter';
            console.log(`✅ AiService: API key presente (${providerName}) - Modelo: ${this.getModel()}`);
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

    getModel(preferredModel) {
        if (preferredModel && !this.apiUrl.includes('generativelanguage.googleapis.com')) {
            return preferredModel;
        }
        if (this.apiUrl.includes('openrouter.ai') && this.defaultModel.startsWith('gemini')) {
            return `google/${this.defaultModel}`;
        }
        return this.defaultModel;
    }

    /**
     * Traducción/análisis de palabras en el reader vía LM Studio (local).
     * Activar con USE_LMSTUDIO_FOR_ANALYZE=true en backend/.env
     */
    useLmStudioForAnalyze() {
        if (process.env.RENDER || process.env.NODE_ENV === 'production') return false;
        const v = String(process.env.USE_LMSTUDIO_FOR_ANALYZE || '').toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    /**
     * Reescritura por nivel CEFR vía LM Studio (batch / migrate).
     * Activar con USE_LMSTUDIO_FOR_LEVELING=true
     */
    useLmStudioForLeveling() {
        if (process.env.RENDER || process.env.NODE_ENV === 'production') return false;
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
                'GEMINI_API_KEY (o OPENROUTER_API_KEY) no configurada y USE_LMSTUDIO_FOR_ANALYZE no está activo'
            );
        }
        return this.ask(prompt, systemRole);
    }

    /**
     * Adapta tanto el título como el contenido de un artículo al nivel CEFR objetivo.
     * Instruye al modelo para generar un título claro, atractivo y alineado al nivel CEFR,
     * evitando modismos oscuros o jerga innecesaria.
     * @param {string} title - Título original
     * @param {string} content - Contenido original
     * @param {string} level - Nivel CEFR (A1-C2)
     * @returns {Promise<{ title: string, content: string }>}
     */
    async adaptArticleForLevel(title, content, level = 'B1') {
        const rules = this.levelRules[level] || this.levelRules['B1'];

        const systemRole = `You are an expert English teacher specialized in CEFR language adaptation.
Your mission is to adapt both the TITLE and the TEXT of an article for an English learner at CEFR level ${level}.
CRITICAL INSTRUCTIONS:
1. Title requirement: Create a clear, engaging headline strictly suited for CEFR level ${level}. Avoid obscure idioms, wordplay, slang, or confusing jargon.
2. Content requirement: Rewrite and adapt the article text to match CEFR level ${level}.
   - Divide the text into clear, coherent paragraphs.
   - Each paragraph must focus on one central idea.
   - Strictly follow the grammatical and lexical rules for CEFR level ${level}.
3. Return ONLY a valid JSON object with the keys "title" and "content". Do not include Markdown blocks, markdown fences, or extra text.`;

        const prompt = `Target CEFR Level: ${level}
Specific Rules for ${level} level:
${rules}

Original Title:
${title || 'Untitled Article'}

Original Content:
${content}

Return ONLY this JSON format:
{
  "title": "Clear and appealing title for level ${level}",
  "content": "Full adapted article text divided into paragraphs..."
}`;

        try {
            console.log(`✨ Adaptando artículo y título para nivel ${level}...`);

            let rawResponse = '';

            if (this.useLmStudioForLeveling()) {
                const maxTokens = parseInt(String(process.env.LMSTUDIO_LEVELING_MAX_TOKENS || '8192'), 10) || 8192;
                const timeoutMs = parseInt(String(process.env.LMSTUDIO_LEVELING_TIMEOUT_MS || '180000'), 10) || 180000;
                rawResponse = await this.askLmStudio(prompt, systemRole, {
                    max_tokens: maxTokens,
                    timeout: timeoutMs
                });
            } else if (!this.apiKey && this.useLmStudioForAnalyze()) {
                rawResponse = await this.askLmStudio(prompt, systemRole, {
                    max_tokens: parseInt(String(process.env.LMSTUDIO_LEVELING_MAX_TOKENS || '8192'), 10) || 8192,
                    timeout: parseInt(String(process.env.LMSTUDIO_LEVELING_TIMEOUT_MS || '180000'), 10) || 180000
                });
            } else if (this.apiKey) {
                const model = this.getModel('openai/gpt-4o-mini');
                const response = await axios.post(this.apiUrl, {
                    model,
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
                rawResponse = response.data?.choices?.[0]?.message?.content || '';
            } else {
                throw new Error(
                    'GEMINI_API_KEY (o OPENROUTER_API_KEY) no configurada: define USE_LMSTUDIO_FOR_LEVELING=true o USE_LMSTUDIO_FOR_ANALYZE=true con LM Studio'
                );
            }

            // Parsing the JSON response
            let parsed = null;
            try {
                const cleanJson = rawResponse
                    .replace(/```json/gi, '')
                    .replace(/```/g, '')
                    .trim();
                parsed = JSON.parse(cleanJson);
            } catch (_) {
                const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        parsed = JSON.parse(jsonMatch[0]);
                    } catch (e) {}
                }
            }

            if (parsed && (parsed.content || parsed.text)) {
                return {
                    title: String(parsed.title || title || 'Untitled Article').trim(),
                    content: String(parsed.content || parsed.text || '').trim()
                };
            }

            // Fallback: Si no devolvió JSON válido, usar la respuesta completa como contenido
            const fallbackText = rawResponse.replace(/```/g, '').trim();
            return {
                title: title || 'Untitled Article',
                content: fallbackText
            };
        } catch (error) {
            console.error(`❌ Error en adaptArticleForLevel (${level}):`, error.message);
            throw error;
        }
    }

    /**
     * Re-escribe un artículo para un nivel específico (Compatibilidad hacia atrás)
     */
    async generateLeveledArticle(text, level = 'B1', interestsList = '', difficultWordsList = '') {
        const adapted = await this.adaptArticleForLevel('', text, level);
        return adapted.content;
    }

    /**
     * Función genérica para preguntar a la IA
     */
    async ask(prompt, systemRole = "You are a helpful language learning assistant.") {
        try {
            const model = this.getModel('google/gemini-2.0-flash-001');
            const response = await axios.post(this.apiUrl, {
                model,
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
        try {
            require('dotenv').config({ override: true });
        } catch (_) {}
        const v = String(process.env.MOCK_READER_QUIZ || '').toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }

    mockRichQuizForReader(level = 'B1') {
        const tag = `[Demo · ${level}]`;
        const lvl = String(level || 'B1').toUpperCase();

        if (lvl === 'A1' || lvl === 'A2') {
            return [
                {
                    id: 'mock_a_1',
                    type: 'mcq',
                    category: 'explicit_comprehension',
                    question: `${tag} What is the primary topic of this article?`,
                    options: ['Daily English reading practice', 'Automobile repair', 'Cooking recipes'],
                    correct_index: 0,
                    hint: 'Look at the main topic mentioned in the title and opening.'
                },
                {
                    id: 'mock_a_2',
                    type: 'mcq',
                    category: 'explicit_comprehension',
                    question: `${tag} Who is this adapted text designed for?`,
                    options: ['Students learning English', 'Rocket scientists only', 'Ancient historians'],
                    correct_index: 0,
                    hint: 'Consider the learners using LinguistFeed.'
                },
                {
                    id: 'mock_a_3',
                    type: 'mcq',
                    category: 'basic_vocabulary',
                    question: `${tag} What does the word "practice" mean in this article?`,
                    options: ['Doing an activity regularly to improve', 'Stopping completely', 'Buying tools'],
                    correct_index: 0,
                    hint: 'Think of regular study routines.'
                },
                {
                    id: 'mock_a_4',
                    type: 'tf',
                    category: 'explicit_comprehension',
                    statement: `${tag} True or false: Reading regularly helps improve language comprehension.`,
                    correct: true,
                    hint: 'Frequent reading reinforces vocabulary and sentence patterns.'
                }
            ];
        }

        if (lvl === 'B1' || lvl === 'B2') {
            return [
                {
                    id: 'mock_b_1',
                    type: 'mcq',
                    category: 'main_idea',
                    question: `${tag} What is the main idea conveyed in the article?`,
                    options: [
                        'Reading engaging texts at your level accelerates language retention',
                        'Memorizing random word lists without context is optimal',
                        'Grammar drills without reading are sufficient'
                    ],
                    correct_index: 0,
                    hint: 'Notice the connection between context and long-term retention.'
                },
                {
                    id: 'mock_b_2',
                    type: 'mcq',
                    category: 'detail',
                    question: `${tag} Which detail supports the author’s perspective?`,
                    options: [
                        'Consistent interactive feedback deepens comprehension',
                        'Short isolated word memorization is superior',
                        'Audio exercises should never be combined with reading'
                    ],
                    correct_index: 0,
                    hint: 'Look for the supporting arguments in the body paragraphs.'
                },
                {
                    id: 'mock_b_3',
                    type: 'mcq',
                    category: 'vocabulary_in_context',
                    question: `${tag} In this context, what is the best synonym for "reinforce"?`,
                    options: ['Strengthen and consolidate', 'Undermine and weaken', 'Ignore entirely'],
                    correct_index: 0,
                    hint: '"Reinforce" means to make something stronger or more established.'
                },
                {
                    id: 'mock_b_4',
                    type: 'mcq',
                    category: 'detail',
                    question: `${tag} According to the passage, why are level adaptations beneficial?`,
                    options: [
                        'They prevent cognitive overload while keeping the core message intact',
                        'They eliminate all challenging words completely',
                        'They shorten articles to only one sentence'
                    ],
                    correct_index: 0,
                    hint: 'Consider comprehensible input principles.'
                },
                {
                    id: 'mock_b_5',
                    type: 'tf',
                    category: 'main_idea',
                    statement: `${tag} True or false: The text suggests that combining reading with self-assessment enhances learning.`,
                    correct: true,
                    hint: 'Self-quizzing helps identify comprehension gaps.'
                }
            ];
        }

        return [
            {
                id: 'mock_c_1',
                type: 'mcq',
                category: 'inference',
                question: `${tag} What nuanced implication can be deduced regarding cognitive processing during advanced reading?`,
                options: [
                    'Proficiency relies on integrating syntactic complexity with subtle pragmatic cues',
                    'Lexical recognition occurs purely in isolation from discursive context',
                    'Advanced fluency requires abandoning structured textual analysis'
                ],
                correct_index: 0,
                hint: 'Reflect on how higher-order discourse comprehension operates.'
            },
            {
                id: 'mock_c_2',
                type: 'mcq',
                category: 'discursive_tone',
                question: `${tag} How would you characterize the author’s rhetorical stance and tone?`,
                options: [
                    'Analytical, measured, and intellectually constructive',
                    'Polemical, dismissive, and openly cynical',
                    'Purely satirical with hyperbolic irony'
                ],
                correct_index: 0,
                hint: 'Observe the balanced vocabulary and didactic intent.'
            },
            {
                id: 'mock_c_3',
                type: 'mcq',
                category: 'advanced_collocations',
                question: `${tag} Which collocation best mirrors the stylistic register of the passage?`,
                options: [
                    'Foster sustained cognitive engagement',
                    'Make big quick smarts',
                    'Push words real hard'
                ],
                correct_index: 0,
                hint: 'Choose the academic and stylistically coherent pairing.'
            },
            {
                id: 'mock_c_4',
                type: 'mcq',
                category: 'high_complexity_vocabulary',
                question: `${tag} In this text, what does "epistemic vigilance" most accurately describe?`,
                options: [
                    'The critical evaluation of informational validity and authorial bias',
                    'Passive absorption of external assertions without reflection',
                    'A medical diagnosis relating to vision'
                ],
                correct_index: 0,
                hint: 'Analyze the Greek root "episteme" (knowledge/truth).'
            },
            {
                id: 'mock_c_5',
                type: 'tf',
                category: 'inference',
                statement: `${tag} True or false: The author presupposes that stylistic nuance and syntactic subordination are vital for C-level discourse mastery.`,
                correct: true,
                hint: 'Complex subordination and register modulation are hallmarks of C1-C2 mastery.'
            },
            {
                id: 'mock_c_6',
                type: 'tf',
                category: 'discursive_tone',
                statement: `${tag} True or false: The narrative voice adopts an informal, conversational dialect lacking structural cohesion.`,
                correct: false,
                hint: 'The register is elevated, coherent, and academically structured.'
            }
        ];
    }

    async generateRichQuizForReader(text, level = 'B1') {
        if (this.isMockReaderQuiz()) {
            return this.mockRichQuizForReader(level);
        }
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY (o OPENROUTER_API_KEY) no está configurada en backend/.env');
        }
        const excerpt = String(text || '').trim().slice(0, 14000);
        if (!excerpt) throw new Error('Texto del artículo vacío');

        const lvl = String(level || 'B1').trim().toUpperCase();
        let targetCount = 5;
        let pedagogicalGuidelines = '';

        if (lvl === 'A1' || lvl === 'A2') {
            targetCount = 4;
            pedagogicalGuidelines = `Target Level: CEFR ${lvl} (Beginner).
Create EXACTLY 4 questions focused on:
- Explicit comprehension (factual questions directly stated in the text).
- Basic vocabulary in context (essential high-frequency words used in the article).
- Simple sentence structure and direct clarity suitable for ${lvl} learners.`;
        } else if (lvl === 'B1' || lvl === 'B2') {
            targetCount = 5;
            pedagogicalGuidelines = `Target Level: CEFR ${lvl} (Intermediate).
Create EXACTLY 5 questions focused on:
- Main idea and paragraph-level themes.
- Specific supporting details and factual accuracy.
- Vocabulary in context (intermediate terms, collocations, and contextual meanings).`;
        } else {
            targetCount = 6;
            pedagogicalGuidelines = `Target Level: CEFR ${lvl} (Advanced / Mastery).
Create EXACTLY 6 questions of high cognitive and linguistic rigor based on the adapted text:
- In-depth inference (drawing conclusions and subtle implications not directly stated).
- Author's discursive tone, rhetorical stance, or communicative purpose.
- Advanced collocations and high-complexity vocabulary present in the adapted text.
- Nuanced distinctions and synthesis of textual ideas.`;
        }

        const systemRole = `You are an expert English language assessment specialist.
Based ONLY on the article text below, create a high-quality ${targetCount}-question reading comprehension quiz for CEFR level ${lvl}.

${pedagogicalGuidelines}

Format Requirements:
Return ONLY a valid JSON object with this exact structure:
{
  "quizzes": [
    {
      "id": "q1",
      "type": "mcq",
      "category": "factual",
      "question": "string",
      "options": ["string", "string", "string"],
      "correct_index": 0,
      "hint": "string"
    },
    {
      "id": "q2",
      "type": "tf",
      "category": "inference",
      "statement": "A clear statement about the text that is either true or false",
      "correct": true,
      "hint": "string"
    }
  ]
}

Rules:
- Include EXACTLY ${targetCount} question items in "quizzes" (primarily "mcq" with 1-2 "tf" items).
- Each "mcq" MUST have exactly 3 plausible options and a "correct_index" (0, 1, or 2).
- Each "tf" MUST have a clear "statement" and boolean "correct" (true or false).
- Include a concise, helpful "hint" for each question pointing to clues in the text.
- Do NOT output any markdown fences, code blocks or commentary outside the JSON object.`;

        const response = await this.ask(excerpt, systemRole);
        const stripped = String(response || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const slice = extractFirstJsonObject(stripped) || stripped;
        let parsed;
        try {
            parsed = JSON.parse(slice);
        } catch (e) {
            throw new Error('La IA no devolvió JSON válido para el quiz.');
        }

        const raw = Array.isArray(parsed) 
            ? parsed 
            : (Array.isArray(parsed?.quizzes) ? parsed.quizzes : (Array.isArray(parsed?.questions) ? parsed.questions : []));
        const normalized = [];
        let idx = 0;
        for (const item of raw) {
            if (!item || typeof item !== 'object') continue;
            idx++;
            const t = String(item.type || '').toLowerCase();
            const qid = String(item.id || `q${idx}`);
            const category = item.category ? String(item.category) : '';
            const hint = item.hint != null ? String(item.hint) : '';

            if (t === 'tf' || t === 'true_false') {
                const statement = String(item.statement || item.question || '').trim();
                let c = item.correct;
                if (c === 'true') c = true;
                if (c === 'false') c = false;
                if (!statement || (c !== true && c !== false)) continue;
                normalized.push({
                    id: qid,
                    type: 'tf',
                    category,
                    statement,
                    correct: c,
                    hint
                });
            } else {
                const opts = item.options;
                const ci = parseInt(item.correct_index, 10);
                if (!Array.isArray(opts) || opts.length < 3 || Number.isNaN(ci) || ci < 0 || ci > 2) continue;
                normalized.push({
                    id: qid,
                    type: 'mcq',
                    category,
                    question: String(item.question || '').trim(),
                    options: [String(opts[0]), String(opts[1]), String(opts[2])],
                    correct_index: ci,
                    hint
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
    async analyzeText(text, type = 'general', contextSentence = '') {
        const cleanText = String(text || '').trim();
        const cleanContext = typeof contextSentence === 'string' ? contextSentence.trim() : '';

        // 1. EL FILTRO: ¿Es un título o una palabra?
        if (type === 'translate') {
            try {
                console.log("🎯 Procesando como TÍTULO (Traducción simple):", cleanText.substring(0, 20));
                const translation = await this.askForAnalyze(
                    cleanText,
                    'Translate this English title to natural Spanish. Return ONLY the translation.',
                    { max_tokens: 128 }
                );
                return {
                    translation: translation.trim(),
                    definition: "Article Title", // Evita el "No definition found"
                    example: cleanContext || "Context: News Headline"
                };
            } catch (error) {
                console.error("❌ Error en traducción de título:", summarizeError(error));
                throw error;
            }
        }
    
        // 2. EL RESTO: Si no es 'translate', es una PALABRA (Flashcard completa con desambiguación contextual)
        let promptContent = `Word to analyze: "${cleanText}"`;
        if (cleanContext) {
            promptContent += `\nSurrounding sentence context (MANDATORY TO USE): "${cleanContext}"`;
        }

        const systemRole = `You are an expert bilingual English teacher and lexicographer.
Analyze the target English word for a Spanish-speaking student with STRICT contextual disambiguation.

${cleanContext ? `MANDATORY CONTEXT PRIORITY (OVERRIDE DEFAULT DICTIONARY MEANING):
The word appears in this specific context sentence:
"${cleanContext}"

CRITICAL RULES:
1. ALWAYS prioritize the exact meaning and part of speech of the word AS USED IN THIS SPECIFIC SENTENCE above any default, primary, or common dictionary meaning.
2. If the word has multiple meanings (polysemy), you MUST choose the one that makes sense in this sentence. Do NOT return a generic or out-of-context translation.
   - Example: if "sentence" is in a legal context ("received a 5-year sentence"), translation MUST be "condena" or "sentencia judicial", NEVER "oración gramatical".
   - Example: if "plant" is in an industrial context ("nuclear plant"), translation MUST be "planta" or "fábrica", NEVER "planta biológica".
   - Example: if "current" is in a water or electrical context, translate accordingly, not as "actual".
3. "translation": The precise Spanish translation fitting this exact sentence.
4. "definition": A concise English definition explaining this exact sense.
5. "example": A clear example sentence demonstrating this exact sense.` : 'Provide a clear definition, accurate Spanish translation, and example sentence.'}

Return ONLY a valid JSON object:
{
  "definition": "Simple English definition matching the contextual meaning",
  "translation": "Natural Spanish translation strictly matching this sentence context",
  "example": "A clear example sentence using the word in this exact contextual sense"
}`;
    
        try {
            const response = await this.askForAnalyze(promptContent, systemRole, { max_tokens: 512 });
            const cleanJSON = String(response || '').replace(/```json/gi, "").replace(/```/g, "").trim();
            const jsonMatch = cleanJSON.match(/\{[\s\S]*\}/);
            const data = JSON.parse(jsonMatch ? jsonMatch[0] : cleanJSON);
    
            return {
                definition: data.definition || 'No definition found',
                translation: data.translation || 'No translation found',
                example: data.example || (cleanContext || `Context: "${cleanText}"`)
            };
        } catch (error) {
            console.error("❌ Error en flashcard:", error.message);
            return {
                definition: "Check context",
                translation: "Error",
                example: cleanContext || cleanText
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

/**
 * Extrae de forma segura el primer bloque JSON {...} de un texto
 * @param {string} str
 * @returns {string|null}
 */
function extractFirstJsonObject(str) {
    if (!str || typeof str !== 'string') return null;
    const firstOpen = str.indexOf('{');
    const lastClose = str.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        return str.slice(firstOpen, lastClose + 1).trim();
    }
    return null;
}

// Exportamos una INSTANCIA de la clase para que articles.js pueda usarla
module.exports = new AiService();
