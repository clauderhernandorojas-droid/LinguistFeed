const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService');

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

        const articles = await db.all(
            "SELECT * FROM articles WHERE topic = ? ORDER BY created_at DESC LIMIT 60",
            [topic]
        );
        res.json({ articles });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- 3. RUTA: DAILY ARTICLES (Independiente) ---
router.get('/daily-articles', async (req, res) => {
    try {
        const articles = await db.all(
            "SELECT * FROM articles ORDER BY created_at DESC LIMIT 100"
        );
        console.log(`✅ [Backend] Enviando ${articles.length} artículos`);
        res.json(articles);
    } catch (error) {
        console.error("🔥 Error en daily-articles:", error);
        res.status(500).json({ error: error.message });
    }
});
// --- RUTA: OBTENER UN ARTÍCULO ESPECÍFICO POR ID ---
router.get('/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const { level } = req.query; 

      console.log("-----------------------------------------");
      console.log(`📥 PETICIÓN RECIBIDA - ID: ${id}, NIVEL: ${level || 'original'}`);

      // 1. Buscamos el artículo original siempre (para tener el título, url, etc.)
      const article = await db.get("SELECT * FROM articles WHERE id = ?", [id]);

      if (!article) {
          console.log(`❌ Artículo ${id} no encontrado`);
          return res.status(404).json({ error: "Article not found" });
      }

      // 2. 🧠 LÓGICA DE ADAPTACIÓN Y CACHÉ
      if (level && level !== 'original') {
          
          // A. Primero revisamos si ya lo hemos simplificado antes
          console.log(`🔍 Buscando versión ${level} en la base de datos...`);
          const cachedArticle = await db.get(
              "SELECT text FROM simplified_articles WHERE article_id = ? AND level = ?", 
              [id, level]
          );

          // B. ¡Bingo! Lo encontramos en caché. Lo enviamos de inmediato.
          if (cachedArticle) {
              console.log(`⚡ ¡Caché encontrado! Entregando versión ${level} guardada.`);
              return res.json({
                  ...article,
                  content: cachedArticle.text, // Usamos el texto guardado
                  displayLevel: level
              });
          }

          // C. Si no estaba en caché, llamamos a la IA
          console.log(`🤖 No hay caché. Generando nueva versión ${level} con IA...`);
          try {
              const adaptedContent = await aiService.generateLeveledArticle(article.content, level);
              
              // D. Guardamos la nueva creación en la base de datos para la próxima vez
              await db.run(
                  "INSERT INTO simplified_articles (article_id, text, level) VALUES (?, ?, ?)",
                  [id, adaptedContent, level]
              );
              console.log(`💾 ¡Nueva versión ${level} guardada exitosamente en simplified_articles!`);

              // E. Entregamos el artículo al usuario
              return res.json({
                  ...article,
                  content: adaptedContent,
                  displayLevel: level
              });

          } catch (aiError) {
              console.error("⚠️ La IA falló al simplificar:", aiError.message);
              // Si la IA falla, sigue bajando y entrega el original por seguridad
          }
      }

      // 3. Si piden el 'original' (o la IA falló), enviamos el texto tal cual
      console.log(`📖 Entregando artículo original.`);
      res.json(article);

  } catch (error) {
      console.error("🔥 Error crítico al obtener artículo:", error);
      res.status(500).json({ error: error.message });
  }
});

// --- 4. RUTA: IA (ANÁLISIS DE TEXTO) ---
router.post('/analyze-text', authenticate, async (req, res) => {
    const { text, type } = req.body;
    try {
        const result = await aiService.analyzeText(text, type);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Error en IA" });
    }
});

module.exports = router;