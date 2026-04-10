const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService'); // Importación única y correcta

/**
 * @route GET /articles
 * @desc Get articles by topic (PUBLIC)
 */
router.get('/articles', async (req, res) => {
  try {
    const { topic } = req.query;

    if (!topic) {
      return res.json({ articles: [] });
    }

    const articles = await db.all(
      `SELECT id, title, content, topic 
       FROM articles 
       WHERE topic = ? 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [topic]
    );

    console.log(`✅ Articles fetched for topic "${topic}":`, articles.length);
    res.json({ articles });

  } catch (error) {
    console.error('🔥 FULL ERROR /articles:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /daily-reading
 */
router.get('/daily-articles', async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];

    const articles = await db.all(
      `SELECT 
        a.id,
        da.topic,
        a.title,
        a.content
      FROM daily_articles da
      JOIN articles a ON da.article_id = a.id
      WHERE da.date = ?`,
      [date]
    );

    const formattedArticles = articles.map(article => ({
      id: article.id,
      topic: article.topic,
      title: article.title || 'Untitled',
      content: article.content || ''
    }));

    res.json({
      date: date,
      articles: formattedArticles
    });

  } catch (error) {
    console.error('Daily reading error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /articles/:id
 * @desc Get a specific article with ON-DEMAND leveling
 */
router.get('/articles/:id', async (req, res) => {
  console.log("-----------------------------------------");
  console.log(`🚀 PETICIÓN RECIBIDA: Artículo ${req.params.id} en nivel ${req.query.level}`);
  console.log("-----------------------------------------");
  
  try {
    const articleId = req.params.id;
    const { level } = req.query;

    // 1. Determinar el nivel
    let articleLevel = level;
    if (!articleLevel) {
      articleLevel = (req.user && req.user.level) ? req.user.level : 'B1';
    }

    // 2. Buscar el artículo y versión simplificada
    let article = await db.get(
      `SELECT a.id, a.title, a.url, a.topic, a.created_at, a.content,
              sa.text as simplified_text, sa.level
       FROM articles a
       LEFT JOIN simplified_articles sa ON a.id = sa.article_id AND sa.level = ?
       WHERE a.id = ?`,
      [articleLevel, articleId]
    );

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // --- 🛠 GENERACIÓN ON-DEMAND ---
    let finalContent = article.simplified_text;

    if (!finalContent) {
      console.log(`✨ El nivel ${articleLevel} no existe para el artículo ${articleId}. Generando...`);
      
      try {
        // Usamos aiService ya importado arriba
        finalContent = await aiService.generateLeveledArticle(article.content, articleLevel);

        await db.run(
          `INSERT INTO simplified_articles (article_id, level, text) VALUES (?, ?, ?)`,
          [articleId, articleLevel, finalContent]
        );
        console.log(`✅ Versión ${articleLevel} generada y guardada exitosamente.`);
      } catch (aiError) {
        console.error('❌ Error llamando a la IA:', aiError.message);
        finalContent = article.content;
      }
    }

    // 3. Traer quizzes
    const quizzes = await db.all(
      `SELECT id, question, option_a, option_b, option_c, correct_option, hint
       FROM quizzes
       WHERE article_id = ? AND level = ?`,
      [articleId, articleLevel]
    );

    const formattedQuizzes = quizzes.map(quiz => ({
      id: quiz.id,
      question: quiz.question,
      options: [quiz.option_a, quiz.option_b, quiz.option_c],
      correct_index: quiz.correct_option,
      hint: quiz.hint
    }));

    // 4. Traer vocabulario
    const vocabulary = await db.all(
      `SELECT id, word, definition, example
       FROM vocabulary
       WHERE article_id = ? AND level = ?`,
      [articleId, articleLevel]
    );
 
    res.json({
      id: article.id,
      title: article.title,
      url: article.url,
      topic: article.topic,
      level: articleLevel,
      content: finalContent,
      created_at: article.created_at,
      vocabulary: vocabulary || [],
      quizzes: formattedQuizzes || []
    });

  } catch (error) {
    console.error('🔥 Error crítico en GET /articles/:id:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @route POST /scrape
 */
router.post('/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const scraperService = require('../services/scraperService');
    const result = await scraperService.scrapeArticle(url);
    res.json({ text: result.text });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /simplify
 */
router.post('/simplify', async (req, res) => {
  try {
    const { text, level = 'B1' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const result = await aiService.generateSimplifiedArticle(text, level);

    res.json({
      textoSimplificado: result.text,
      vocabulario: result.vocabulary || [],
      quiz: {
        pregunta: result.quiz.question,
        opciones: result.quiz.options,
        respuestaCorrectaIndice: result.quiz.correct_index,
        pista: result.quiz.hint
      },
      notaGramatical: `Simplified version for ${level} level.`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// NUEVA RUTA: Generación de Quiz sin simplificación
router.post('/generate-quiz-only', async (req, res) => {
  const { text, level } = req.body;

  if (!text) {
      return res.status(400).json({ error: "No text provided" });
  }

  try {
      const quizzes = await aiService.generateQuizFromText(text, level);
      res.json({ quizzes: quizzes });
  } catch (error) {
      console.error("Error en ruta generate-quiz-only:", error);
      res.status(500).json({ error: "Failed to generate quiz" });
  }
});
/**
 * @route GET /api/articles/personalized-feed
 * @desc Trae artículos basados en los intereses y edad del usuario
 */
router.get('/personalized-feed', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await db.get('SELECT age, interests FROM users WHERE id = ?', [userId]);

    // Si no tiene intereses, le damos unos por defecto para que no explote
    let interestList = user.interests ? user.interests.split(',') : ['news', 'tech'];
    
    // Limpiamos espacios en blanco por si acaso
    interestList = interestList.map(i => i.trim()).filter(i => i !== "");

    // 🚨 FIX CRÍTICO: Si la lista sigue vacía, ponemos temas genéricos
    if (interestList.length === 0) interestList = ['news', 'tech'];

    const placeholders = interestList.map(() => '?').join(',');
    
    const query = `
      SELECT id, title, content, topic 
      FROM articles 
      WHERE topic IN (${placeholders}) 
      ORDER BY created_at DESC 
      LIMIT 15
    `;

    const articles = await db.all(query, interestList);
    res.json({ articles });

  } catch (error) {
    console.error('🔥 Error en el Feed:', error);
    res.status(500).json({ error: "Error al generar el feed" });
  }
});

module.exports = router;