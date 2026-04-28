const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService');
const authService = require('../services/authService');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'simplified_articles.json');
const READ_JSON_FALLBACK = String(process.env.READ_JSON_FALLBACK || 'false').toLowerCase() === 'true';
const DUAL_WRITE_JSON = String(process.env.DUAL_WRITE_JSON || 'true').toLowerCase() === 'true';
let hasMigratedLegacyJson = false;

function getRequestUserContext(req) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
      const decoded = authService.verifyToken(token);
      return {
        userId: Number(decoded.id || decoded.userId || 0) || null,
        role: String(decoded.role || '').toLowerCase()
      };
    }
  } catch (_) {
    // Silent fallback for public calls.
  }
  return { userId: null, role: '' };
}

function normalizeLegacyArticle(raw) {
  const topic = String(raw?.topic || 'classroom').toLowerCase().trim();
  const externalId = String(raw?.id || '').trim() || `legacy-${Date.now()}`;
  const assignedRaw = raw?.assigned_to_user_id;
  const assignedToUserId =
    assignedRaw == null || String(assignedRaw).trim() === ''
      ? null
      : Number(assignedRaw);
  const createdAtCandidate = raw?.date ? new Date(raw.date) : null;
  const createdAt =
    createdAtCandidate && !Number.isNaN(createdAtCandidate.getTime())
      ? createdAtCandidate.toISOString()
      : new Date().toISOString();
  return {
    externalId,
    title: String(raw?.title || 'Sin título'),
    content: String(raw?.content || ''),
    topic,
    assignedToUserId,
    createdAt
  };
}

async function insertManualArticleInDb(article) {
  return db.run(
    `INSERT INTO articles
      (title, content, topic, source, created_at, external_id, assigned_to_user_id, is_manual)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      article.title,
      article.content,
      article.topic,
      'manual',
      article.createdAt,
      article.externalId,
      article.assignedToUserId
    ]
  );
}

async function ensureLegacyJsonMigrated() {
  if (hasMigratedLegacyJson) return;
  hasMigratedLegacyJson = true;
  if (!fs.existsSync(LEGACY_JSON_PATH)) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
    const list = JSON.parse(raw || '[]');
    if (!Array.isArray(list) || list.length === 0) return;

    let inserted = 0;
    for (const item of list) {
      const article = normalizeLegacyArticle(item);
      const existing = await db.get(
        `SELECT id FROM articles WHERE external_id = ?`,
        [article.externalId]
      );
      if (existing?.id) continue;
      await insertManualArticleInDb(article);
      inserted += 1;
    }
    if (inserted > 0) {
      console.log(`✅ Legacy JSON migrado a DB: ${inserted} artículos insertados`);
    }
  } catch (error) {
    console.error('❌ Error migrando legacy JSON a DB:', error.message);
  }
}

function filterClassroomVisibility(rows, requestUserId, role = '') {
  if (!Array.isArray(rows)) return [];
  const normalizedRole = String(role || '').toLowerCase();
  const canSeeAllClassroom = normalizedRole === 'teacher' || normalizedRole === 'admin';
  return rows.filter((a) => {
    const topic = String(a.topic || '').toLowerCase();
    if (topic !== 'classroom') return true;
    if (canSeeAllClassroom) return true;
    if (a.assigned_to_user_id == null) return true;
    if (requestUserId == null) return false;
    return Number(a.assigned_to_user_id) === Number(requestUserId);
  });
}

async function readLegacyJsonByTopic(topic, requestUserId) {
  if (!READ_JSON_FALLBACK || !fs.existsSync(LEGACY_JSON_PATH)) return [];
  const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
  const list = JSON.parse(raw || '[]');
  if (!Array.isArray(list)) return [];
  return list.filter((a) => {
    if (String(a?.topic || '').toLowerCase() !== topic) return false;
    if (topic !== 'classroom') return true;
    const assigned = a?.assigned_to_user_id;
    if (assigned == null || String(assigned).trim() === '') return true;
    if (requestUserId == null) return false;
    return Number(assigned) === Number(requestUserId);
  });
}

async function readLegacyJsonById(articleId) {
  if (!READ_JSON_FALLBACK || !fs.existsSync(LEGACY_JSON_PATH)) return null;
  const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
  const list = JSON.parse(raw || '[]');
  if (!Array.isArray(list)) return null;
  return list.find((a) => String(a?.id || '').trim() === articleId) || null;
}

function writeLegacyJsonArticle(article) {
  if (!DUAL_WRITE_JSON) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let list = [];
  if (fs.existsSync(LEGACY_JSON_PATH)) {
    const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  }
  list.unshift({
    id: article.externalId,
    title: article.title,
    topic: article.topic,
    content: article.content,
    date: article.createdAt,
    assigned_to_user_id: article.assignedToUserId
  });
  fs.writeFileSync(LEGACY_JSON_PATH, JSON.stringify(list, null, 2), 'utf8');
}

router.get('/personalized-feed', authenticate, async (req, res) => {
  try {
    await ensureLegacyJsonMigrated();
    const userId = req.user.id;
    const user = await db.get('SELECT interests FROM users WHERE id = ?', [userId]);

    let interestList = (user && user.interests) ? user.interests.split(',') : ['news', 'tech', 'science'];
    interestList = interestList.map((i) => i.trim()).filter((i) => i !== '');
    if (interestList.length === 0) interestList = ['news', 'tech', 'science'];

    const placeholders = interestList.map(() => '?').join(',');
    const query = `
      SELECT id, title, content, topic, created_at, assigned_to_user_id
      FROM articles
      WHERE (LOWER(topic) IN (${placeholders}) OR LOWER(topic) = 'classroom')
      ORDER BY datetime(created_at) DESC
      LIMIT 120
    `;
    const rows = await db.all(query, interestList.map((t) => String(t).toLowerCase()));
    const articles = filterClassroomVisibility(rows, Number(userId));
    res.json({ articles: articles.slice(0, 60) });
  } catch (error) {
    console.error('🔥 Error en personalized-feed:', error.message);
    res.status(500).json({ error: 'Error al generar el feed' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureLegacyJsonMigrated();
    const { topic } = req.query;
    if (!topic) return res.json({ articles: [] });
    const normalizedTopic = String(topic).toLowerCase().trim();
    const requestUser = getRequestUserContext(req);

    const rows = await db.all(
      `SELECT id, title, content, url, topic, source, created_at, external_id, assigned_to_user_id, is_manual
       FROM articles
       WHERE LOWER(topic) = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 120`,
      [normalizedTopic]
    );
    let articles = filterClassroomVisibility(rows, requestUser.userId, requestUser.role);

    if (articles.length === 0) {
      const legacy = await readLegacyJsonByTopic(normalizedTopic, requestUser.userId);
      if (legacy.length > 0) articles = legacy;
    }

    res.json({ articles: articles.slice(0, 60) });
  } catch (error) {
    console.error('❌ Error en /articles:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/daily-articles', async (req, res) => {
  try {
    await ensureLegacyJsonMigrated();
    const requestUser = getRequestUserContext(req);
    const rows = await db.all(
      `SELECT id, title, content, url, topic, source, created_at, external_id, assigned_to_user_id, is_manual
       FROM articles
       ORDER BY datetime(created_at) DESC
       LIMIT 200`
    );
    let articles = filterClassroomVisibility(rows, requestUser.userId, requestUser.role);

    if (articles.length === 0 && READ_JSON_FALLBACK && fs.existsSync(LEGACY_JSON_PATH)) {
      const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
      const list = JSON.parse(raw || '[]');
      if (Array.isArray(list)) {
        articles = filterClassroomVisibility(list, requestUser.userId, requestUser.role);
      }
    }

    res.json({ articles: articles.slice(0, 100) });
  } catch (error) {
    console.error('❌ Error en daily-articles:', error.message);
    res.status(500).json({ error: 'Error al cargar la lista de artículos' });
  }
});

router.post('/analyze-text', async (req, res) => {
  const { text, type } = req.body;
  try {
    const result = await aiService.analyzeText(text, type);
    res.json(result);
  } catch (_) {
    res.status(500).json({ error: 'Error en IA' });
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
        } catch (_) {
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

router.post('/manual-upload', authenticate, async (req, res) => {
  const { title, topic, content, studentId } = req.body;
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'teacher' && role !== 'admin') {
    return res.status(403).json({ error: 'Solo teacher/admin puede publicar artículos manuales' });
  }

  try {
    await ensureLegacyJsonMigrated();
    const hasTargetStudent =
      studentId !== undefined && studentId !== null && String(studentId).trim() !== '';
    // Publicación general siempre cae en classroom para evitar pérdidas por topic libre.
    const normalizedTopic = 'classroom';

    const article = {
      externalId: `manual-${Date.now()}`,
      title: String(title || 'Sin título'),
      content: String(content || ''),
      topic: normalizedTopic,
      assignedToUserId: hasTargetStudent ? Number(studentId) : null,
      createdAt: new Date().toISOString()
    };

    await insertManualArticleInDb(article);
    writeLegacyJsonArticle(article);

    res.status(200).json({ message: 'Article published and saved!', id: article.externalId });
  } catch (error) {
    console.error('❌ Error en manual-upload:', error.message);
    res.status(500).json({ error: 'Fallo total al guardar el artículo' });
  }
});

router.get('/:id', async (req, res) => {
  const articleId = String(req.params.id || '').replace(/['"]+/g, '').trim();
  if (!articleId) return res.status(400).json({ error: 'ID de artículo inválido' });

  try {
    await ensureLegacyJsonMigrated();
    let article = null;
    if (/^\d+$/.test(articleId)) {
      article = await db.get('SELECT * FROM articles WHERE id = ?', [Number(articleId)]);
    } else {
      article = await db.get('SELECT * FROM articles WHERE external_id = ?', [articleId]);
    }

    if (!article) {
      article = await readLegacyJsonById(articleId);
    }
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });
    res.json(article);
  } catch (error) {
    console.error('❌ Error al buscar artículo:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;