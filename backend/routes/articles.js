const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

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
router.get('/daily-reading', async (req, res) => {
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
 * @desc Get a specific article (REVISADA)
 */
router.get('/articles/:id', async (req, res) => {
  try {
    const articleId = req.params.id;
    const { level } = req.query;

    // CORRECCIÓN: Si no hay usuario autenticado o nivel, por defecto es B1
    let articleLevel = level;
    if (!articleLevel) {
      articleLevel = (req.user && req.user.level) ? req.user.level : 'B1';
    }

    const article = await db.get(
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

    // Traer quizzes con el índice de respuesta correcta
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
      correct_index: quiz.correct_option, // Importante para el frontend
      hint: quiz.hint
    }));

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
      level: article.level || articleLevel,
      content: article.simplified_text || article.content, 
      created_at: article.created_at,
      vocabulary: vocabulary || [],
      quizzes: formattedQuizzes || []
    });

  } catch (error) {
    console.error('🔥 Error en GET /articles/:id:', error.message);
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

    const aiService = require('../services/aiService');
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

module.exports = router;