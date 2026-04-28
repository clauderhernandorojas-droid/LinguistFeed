const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService');
const authService = require('../services/authService');
const fs = require('fs');
const path = require('path');

function getRequestUserId(req) {
    try {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');
        if (scheme === 'Bearer' && token) {
            const decoded = authService.verifyToken(token);
            return Number(decoded.id || decoded.userId || 0) || null;
        }
    } catch (e) {
        // Silent fallback for public calls.
    }
    return null;
}

// --- 1. RUTA: FEED PERSONALIZADO (La que ya tenías bien) ---
router.get('/personalized-feed', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await db.get('SELECT interests FROM users WHERE id = ?', [userId]);
        
        let interestList = (user && user.interests) ? user.interests.split(',') : ['news', 'tech', 'science'];
        interestList = interestList.map(i => i.trim()).filter(i => i !== "");
        if (interestList.length === 0) interestList = ['news', 'tech', 'science'];

        const placeholders = interestList.map(() => '?').join(',');
        const query = `
            SELECT id, title, content, topic 
            FROM articles 
            WHERE topic IN (${placeholders}) OR topic = 'classroom' 
            ORDER BY created_at DESC 
            LIMIT 60
        `;

        const articles = await db.all(query, interestList);
        res.json({ articles: articles || [] });
    } catch (error) {
        console.error('🔥 Error en Personalized Feed:', error);
        res.status(500).json({ error: "Error al generar el feed" });
    }
});

// --- 2. RUTA: ARTÍCULOS POR TÓPICO (Corregida) ---
router.get('/', async (req, res) => {
    try {
        const { topic } = req.query;
        if (!topic) return res.json({ articles: [] });
        const normalizedTopic = String(topic).toLowerCase().trim();
        const requestUserId = getRequestUserId(req);

        // --- PARTE A: Tu código original (Base de Datos) ---
        // Seguimos usando tu variable 'db' y tu consulta SQL exacta
        const dbArticles = await db.all(
            "SELECT * FROM articles WHERE topic = ? ORDER BY created_at DESC LIMIT 60",
            [normalizedTopic]
        );

        // --- PARTE B: El nuevo almacén (JSON) ---
        let manualArticles = [];
        const filePath = path.join(__dirname, '..', 'data', 'simplified_articles.json');
        
        // Solo intentamos leer si el archivo existe físicamente
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const allManual = JSON.parse(rawData || "[]");
            // Filtramos para que solo veas lo de 'classroom' (o el tema que elijas)
            manualArticles = allManual.filter((a) => {
                if (!a.topic || a.topic.toLowerCase() !== normalizedTopic) return false;
                // Classroom: show global assignments and user-targeted ones only.
                if (normalizedTopic !== 'classroom') return true;
                if (a.assigned_to_user_id == null || a.assigned_to_user_id === '') return true;
                if (requestUserId == null) return false;
                return Number(a.assigned_to_user_id) === Number(requestUserId);
            });
        }

        // --- PARTE C: La Fusión ---
        // 'articles' será la mezcla de ambos. ¡Tus manuales salen primero!
        const articles = [...manualArticles, ...dbArticles];

        // Entregamos la respuesta con el mismo formato que espera tu frontend
        res.json({ articles });

    } catch (error) {
        console.error("❌ Error en la fusión:", error.message);
        res.status(500).json({ error: error.message });
    }
});
// --- 3. RUTA: DAILY ARTICLES (Independiente) ---
// Esta es la ruta que llena la lista de Classroom/News/Tech
router.get('/daily-articles', async (req, res) => {
    try {
        // 1. 🗄️ Obtener artículos de la Base de Datos (SQLite)
        // Mantenemos tu lógica original para no romper las noticias normales
        const dbArticles = await db.all(
            "SELECT * FROM articles ORDER BY created_at DESC LIMIT 100"
        );

        // 2. 📂 Obtener artículos del Portal de Docente (JSON)
        let manualArticles = [];
        const filePath = path.join(__dirname, '..', 'data', 'simplified_articles.json');

        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            manualArticles = JSON.parse(rawData || "[]");
            console.log(`📋 Se cargaron ${manualArticles.length} artículos manuales del JSON.`);
        }

        // 3. 🤝 Fusión total
        // Ponemos los manuales arriba para que tus alumnos vean primero lo que tú publicas
        const allArticles = [...manualArticles, ...dbArticles];

        console.log(`🚀 Enviando ${allArticles.length} artículos en total al frontend.`);
        res.json({ articles: allArticles });

    } catch (error) {
        console.error("❌ Error en daily-articles:", error);
        res.status(500).json({ error: "Error al cargar la lista de artículos" });
    }
});
// --- RUTA: OBTENER UN ARTÍCULO ESPECÍFICO POR ID ---
// 🔍 RUTA PARA OBTENER UN ARTÍCULO POR SU ID (Híbrida: JSON + DB)
router.get('/:id', async (req, res) => {
    const articleId = req.params.id.replace(/['"]+/g, '').trim();
    const filePath = path.join(__dirname, '..', 'data', 'simplified_articles.json');

    try {
        // 1. Intentar buscar en el archivo JSON (Manuales)
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            const articles = JSON.parse(rawData || "[]");
            const article = articles.find(a => a.id === articleId);
            if (article) return res.json(article);
        }

        // 2. Si no está en el JSON, buscar en la Base de Datos (Originales)
        const dbArt = await db.get("SELECT * FROM articles WHERE id = ?", [articleId]);
        if (dbArt) return res.json(dbArt);

        res.status(404).json({ error: "Artículo no encontrado" });
    } catch (error) {
        console.error("❌ Error al buscar artículo:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// --- 4. RUTA: IA (ANÁLISIS DE TEXTO) ---
router.post('/analyze-text', async (req, res) => {
    const { text, type } = req.body;
    try {
        const result = await aiService.analyzeText(text, type);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Error en IA" });
    }
});

router.post('/generate-quiz-only', async (req, res) => {
    const { text, level, articleId, force } = req.body || {};
    const lev = (level || 'B1').trim();
    const mockReaderQuiz = aiService.isMockReaderQuiz && aiService.isMockReaderQuiz();
    const articleKey =
        articleId !== undefined && articleId !== null && String(articleId).trim() !== ''
            ? String(articleId).replace(/['"]+/g, '').trim()
            : '';

    try {
        if (!mockReaderQuiz && !force && articleKey) {
            const row = await db.get(
                'SELECT payload FROM reader_quiz_cache WHERE article_key = ? AND level = ?',
                [articleKey, lev]
            );
            if (row && row.payload) {
                try {
                    const quizzes = JSON.parse(row.payload);
                    if (Array.isArray(quizzes) && quizzes.length > 0) {
                        return res.json({ quizzes, cached: true });
                    }
                } catch (e) {
                    console.warn('reader_quiz_cache JSON inválido, regenerando:', articleKey, lev);
                }
            }
        }

        if (!text || !String(text).trim()) {
            return res.status(400).json({ error: 'Se requiere el texto del artículo' });
        }

        const quizzes = await aiService.generateRichQuizForReader(text, lev);

        if (!mockReaderQuiz && articleKey && Array.isArray(quizzes) && quizzes.length > 0) {
            await db.run(
                `INSERT OR REPLACE INTO reader_quiz_cache (article_key, level, payload, created_at)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [articleKey, lev, JSON.stringify(quizzes)]
            );
        }

        res.json({ quizzes, cached: false, mock: !!mockReaderQuiz });
    } catch (error) {
        const msg = error.message || '';
        const axStatus = error.response && error.response.status;
        const billing =
            axStatus === 402 ||
            /status code 402/i.test(msg) ||
            /402/.test(String(error.code || ''));
        console.error('POST /articles/generate-quiz-only:', msg);
        if (billing) {
            return res.status(402).json({
                error: 'OpenRouter requiere créditos o pago',
                message:
                    'Sin saldo en OpenRouter. Añade créditos o deja MOCK_READER_QUIZ=true en backend/.env para el quiz de demostración.'
            });
        }
        res.status(500).json({
            error: 'Error al generar el quiz',
            message: msg || 'Error desconocido'
        });
    }
});
// Ruta para recibir los artículos del Teacher's Portal

// Esta es la ruta que tu Teacher's Portal está llamando
router.post('/manual-upload', authenticate, async (req, res) => {
    const { title, topic, content, studentId } = req.body;
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'teacher' && role !== 'admin') {
        return res.status(403).json({ error: "Solo teacher/admin puede publicar artículos manuales" });
    }
    
    // 🎯 LOCALIZACIÓN EXACTA
    // Esta línea construye la ruta hacia backend/data/simplified_articles.json
    const dataDir = path.join(__dirname, '..', 'data'); 
    const filePath = path.join(dataDir, 'simplified_articles.json');

    try {
        // 1. 📂 ¿No existe la carpeta 'data'? ¡La creamos!
        if (!fs.existsSync(dataDir)) {
            console.log("📁 Creando carpeta de datos en:", dataDir);
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // 2. 📝 Leemos el archivo (o empezamos con una lista vacía si no existe)
        let articles = [];
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf8');
            articles = rawData ? JSON.parse(rawData) : [];
        }

        // 3. ✨ Creamos el nuevo artículo
        const hasTargetStudent =
            studentId !== undefined && studentId !== null && String(studentId).trim() !== '';
        const normalizedTopic = hasTargetStudent
            ? 'classroom'
            : (topic || "classroom").toLowerCase();

        const newArticle = {
            id: `manual-${Date.now()}`,
            title: title || "Sin título",
            topic: normalizedTopic,
            content: content || "",
            date: new Date().toISOString(),
            assigned_to_user_id:
                hasTargetStudent
                    ? Number(studentId)
                    : null
        };

        // 4. 🚀 Guardamos
        articles.unshift(newArticle);
        fs.writeFileSync(filePath, JSON.stringify(articles, null, 2), 'utf8');

        console.log("✅ ¡Logrado! Artículo guardado en:", filePath);
        res.status(200).json({ message: "Article published and saved!" });

    } catch (error) {
        console.error("❌ ERROR REAL:", error);
        res.status(500).json({ error: "Fallo total al escribir el archivo" });
    }
});

// Ruta para obtener UN artículo específico por su ID
router.get('/:id', async (req, res) => {
    const articleId = req.params.id.replace(/['"]+/g, ''); // Limpiamos comillas por si acaso
    const filePath = path.join(__dirname, '..', 'data', 'simplified_articles.json');

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Archivo de artículos no encontrado" });
        }

        const data = fs.readFileSync(filePath, 'utf8');
        const articles = JSON.parse(data);

        // Buscamos el artículo que coincida con el ID de la URL
        const article = articles.find(a => a.id === articleId);

        if (article) {
            console.log(`✅ Artículo encontrado: ${article.title}`);
            res.json(article);
        } else {
            console.log(`❌ No encontré el ID: ${articleId}`);
            res.status(404).json({ error: "Artículo no encontrado" });
        }
    } catch (error) {
        console.error("❌ Error al leer el artículo:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// 🔍 RUTA PARA OBTENER UN ARTÍCULO POR SU ID
router.get('/:id', async (req, res) => {
    // 1. Limpiamos el ID que viene de la URL (por si acaso)
    const articleId = req.params.id.replace(/['"]+/g, '').trim();
    
    // 2. Definimos la ruta al archivo (la misma que usamos para guardar)
    const filePath = path.join(__dirname, '..', 'data', 'simplified_articles.json');

    try {
        console.log(`🔎 Buscando artículo con ID: ${articleId}`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "No hay base de datos de artículos" });
        }

        // 3. Leemos el archivo JSON
        const rawData = fs.readFileSync(filePath, 'utf8');
        const articles = JSON.parse(rawData);

        // 4. Buscamos el artículo que coincida con el ID
        const article = articles.find(a => a.id === articleId);

        if (article) {
            console.log(`✅ ¡Artículo encontrado!: ${article.title}`);
            res.json(article); // Se lo enviamos al lector
        } else {
            console.log(`❌ No se encontró el ID en el JSON: ${articleId}`);
            res.status(404).json({ error: "Artículo no encontrado en la lista" });
        }
    } catch (error) {
        console.error("❌ Error en el servidor al buscar:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

module.exports = router;