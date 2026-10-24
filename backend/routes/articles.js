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
const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
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
      (title, content, topic, source, created_at, external_id, assigned_to_user_id, is_manual, author_id, class_id, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      article.title,
      article.content,
      article.topic,
      'manual',
      article.createdAt,
      article.externalId,
      article.assignedToUserId,
      article.authorId || null,
      article.classId || null,
      article.imageUrl || article.image_url || null
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

async function filterClassroomVisibility(rows, requestUserId, role = '') {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'admin') return rows;

  const userIdNum = requestUserId != null ? Number(requestUserId) : null;

  if (normalizedRole === 'teacher' && userIdNum != null) {
    const teacherClasses = await db.all('SELECT id FROM classes WHERE teacher_id = ?', [userIdNum]);
    const teacherClassSet = new Set(teacherClasses.map((c) => Number(c.id)));
    return rows.filter((a) => {
      const topic = String(a.topic || '').toLowerCase();
      if (topic !== 'classroom') return true;
      if (a.author_id != null && Number(a.author_id) === userIdNum) return true;
      if (a.class_id != null && teacherClassSet.has(Number(a.class_id))) return true;
      if (a.class_id == null && a.assigned_to_user_id == null) return true;
      return false;
    });
  }

  let studentClassSet = new Set();
  if (userIdNum != null) {
    const studentClasses = await db.all(
      'SELECT class_id FROM class_members WHERE student_id = ?',
      [userIdNum]
    );
    studentClassSet = new Set(studentClasses.map((c) => Number(c.class_id)));
  }

  return rows.filter((a) => {
    const topic = String(a.topic || '').toLowerCase();
    if (topic !== 'classroom') return true;
    // a) Artículos públicos (class_id IS NULL y sin alumno asignado)
    if (a.class_id == null && a.assigned_to_user_id == null) return true;
    if (userIdNum == null) return false;
    // b) Artículos asignados a clases donde el estudiante está inscrito
    if (a.class_id != null && studentClassSet.has(Number(a.class_id))) return true;
    // c) Artículos asignados directamente a su ID
    if (a.assigned_to_user_id != null && Number(a.assigned_to_user_id) === userIdNum) return true;
    return false;
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
    assigned_to_user_id: article.assignedToUserId,
    class_id: article.classId || null
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
      SELECT a.id, a.title, a.content, a.topic, a.created_at, a.image_url, a.assigned_to_user_id, a.class_id, a.author_id,
             c.name AS class_name
      FROM articles a
      LEFT JOIN classes c ON a.class_id = c.id
      WHERE (LOWER(a.topic) IN (${placeholders}) OR LOWER(a.topic) = 'classroom')
      ORDER BY datetime(a.created_at) DESC
      LIMIT 120
    `;
    const rows = await db.all(query, interestList.map((t) => String(t).toLowerCase()));
    const articles = await filterClassroomVisibility(rows, Number(userId), req.user?.role || 'student');
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
    const requestedLevel = String(req.query.level || '').trim().toUpperCase();
    const hasValidLevel = CEFR_LEVELS.has(requestedLevel);

    let rows;
    if (hasValidLevel) {
      rows = await db.all(
        `SELECT a.id, a.title, a.content, a.url, a.topic, a.source, a.created_at, a.external_id, a.image_url,
                a.assigned_to_user_id, a.is_manual, a.class_id, a.author_id,
                c.name AS class_name,
                sa.adapted_title,
                COALESCE(sa.adapted_content, sa.text) AS adapted_content
         FROM articles a
         LEFT JOIN classes c ON a.class_id = c.id
         LEFT JOIN simplified_articles sa ON a.id = sa.article_id AND sa.level = ?
         WHERE LOWER(a.topic) = ?
         ORDER BY datetime(a.created_at) DESC
         LIMIT 120`,
        [requestedLevel, normalizedTopic]
      );
    } else {
      rows = await db.all(
        `SELECT a.id, a.title, a.content, a.url, a.topic, a.source, a.created_at, a.external_id, a.image_url,
                a.assigned_to_user_id, a.is_manual, a.class_id, a.author_id,
                c.name AS class_name
         FROM articles a
         LEFT JOIN classes c ON a.class_id = c.id
         WHERE LOWER(a.topic) = ?
         ORDER BY datetime(a.created_at) DESC
         LIMIT 120`,
        [normalizedTopic]
      );
    }

    let articles = await filterClassroomVisibility(rows, requestUser.userId, requestUser.role);

    if (articles.length === 0) {
      const legacy = await readLegacyJsonByTopic(normalizedTopic, requestUser.userId);
      if (legacy.length > 0) articles = legacy;
    }

    const mappedArticles = articles.map(a => {
      const adaptedTitle = a.adapted_title || a.title;
      return {
        ...a,
        title: adaptedTitle,
        adapted_title: adaptedTitle,
        reading_level: requestedLevel || 'B1'
      };
    });

    res.json({ articles: mappedArticles.slice(0, 60) });
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
      `SELECT a.id, a.title, a.content, a.url, a.topic, a.source, a.created_at, a.external_id, a.image_url,
              a.assigned_to_user_id, a.is_manual, a.class_id, a.author_id,
              c.name AS class_name
       FROM articles a
       LEFT JOIN classes c ON a.class_id = c.id
       ORDER BY datetime(a.created_at) DESC
       LIMIT 200`
    );
    let articles = await filterClassroomVisibility(rows, requestUser.userId, requestUser.role);

    if (articles.length === 0 && READ_JSON_FALLBACK && fs.existsSync(LEGACY_JSON_PATH)) {
      const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
      const list = JSON.parse(raw || '[]');
      if (Array.isArray(list)) {
        articles = await filterClassroomVisibility(list, requestUser.userId, requestUser.role);
      }
    }

    res.json({ articles: articles.slice(0, 100) });
  } catch (error) {
    console.error('❌ Error en daily-articles:', error.message);
    res.status(500).json({ error: 'Error al cargar la lista de artículos' });
  }
});

router.post('/analyze-text', async (req, res) => {
  const { text, type, contextSentence } = req.body;
  try {
    const result = await aiService.analyzeText(text, type, contextSentence);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en analyze-text:', error.message);
    res.status(500).json({ error: error.message || 'Error en IA' });
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
          const expectedCount = (lev === 'A1' || lev === 'A2') ? 4 : ((lev === 'B1' || lev === 'B2') ? 5 : 6);
          if (Array.isArray(quizzes) && quizzes.length >= expectedCount) {
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
  const { title, topic, content, studentId, classId } = req.body;
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'teacher' && role !== 'admin') {
    return res.status(403).json({ error: 'Solo teacher/admin puede publicar artículos manuales' });
  }

  try {
    await ensureLegacyJsonMigrated();
    const hasTargetStudent =
      studentId !== undefined && studentId !== null && String(studentId).trim() !== '';
    const hasClassId =
      classId !== undefined && classId !== null && String(classId).trim() !== '';
    const parsedClassId = hasClassId ? Number(classId) : null;
    // Publicación general siempre cae en classroom para evitar pérdidas por topic libre.
    const normalizedTopic = 'classroom';

    const article = {
      externalId: `manual-${Date.now()}`,
      title: String(title || 'Sin título'),
      content: String(content || ''),
      topic: normalizedTopic,
      assignedToUserId: hasTargetStudent ? Number(studentId) : null,
      classId: parsedClassId && !Number.isNaN(parsedClassId) ? parsedClassId : null,
      authorId: req.user?.id ? Number(req.user.id) : null,
      imageUrl: req.body.imageUrl || req.body.image_url || null,
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

/**
 * Función centralizada para eliminar un artículo y limpiar en cascada
 * todas sus referencias en SQLite y el archivo JSON legacy.
 */
async function deleteArticleById(articleId, user) {
  const cleanId = String(articleId || '').trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') {
    return { error: 'ID de artículo inválido', status: 400 };
  }

  let article = null;
  if (/^\d+$/.test(cleanId)) {
    article = await db.get('SELECT * FROM articles WHERE id = ?', [Number(cleanId)]);
  }
  if (!article) {
    article = await db.get('SELECT * FROM articles WHERE external_id = ?', [cleanId]);
  }

  // Fallback si estuviera únicamente en JSON legacy
  if (!article && READ_JSON_FALLBACK) {
    const legacyItem = await readLegacyJsonById(cleanId);
    if (legacyItem) {
      article = {
        id: null,
        external_id: legacyItem.id,
        title: legacyItem.title,
        author_id: null
      };
    }
  }

  if (!article) {
    return { error: 'Artículo no encontrado', status: 404 };
  }

  const role = String(user?.role || '').toLowerCase();
  const userId = user?.id ? Number(user.id) : null;
  if (role !== 'teacher' && role !== 'admin') {
    return { error: 'Permisos insuficientes para eliminar artículos', status: 403 };
  }

  const articleAuthorId =
    article.author_id != null
      ? Number(article.author_id)
      : article.created_by != null
      ? Number(article.created_by)
      : null;

  if (role === 'teacher' && articleAuthorId != null && userId != null && articleAuthorId !== userId) {
    return {
      error: 'Solo el profesor que creó el artículo o un administrador pueden eliminarlo',
      status: 403
    };
  }

  const numericId = article.id != null ? Number(article.id) : null;
  const extId = String(article.external_id || cleanId);

  // 1. Limpieza en cascada en SQLite
  if (numericId != null) {
    await db.run(
      'DELETE FROM attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE article_id = ?)',
      [numericId]
    );
    await db.run('DELETE FROM quizzes WHERE article_id = ?', [numericId]);
    await db.run('DELETE FROM simplified_articles WHERE article_id = ?', [numericId]);
    await db.run('DELETE FROM vocabulary WHERE article_id = ?', [numericId]);
    await db.run('DELETE FROM daily_articles WHERE article_id = ?', [numericId]);
    await db.run('DELETE FROM answer_events WHERE article_id = ?', [numericId]);
    await db.run('DELETE FROM articles WHERE id = ?', [numericId]);
  } else {
    await db.run('DELETE FROM articles WHERE external_id = ?', [extId]);
  }

  // 2. Limpieza de reader_quiz_cache (clave puede ser el ID numérico o el external_id)
  await db.run(
    'DELETE FROM reader_quiz_cache WHERE article_key = ? OR article_key = ?',
    [numericId != null ? String(numericId) : '', extId]
  );

  // 3. Limpieza en legacy JSON si existe
  try {
    if (fs.existsSync(LEGACY_JSON_PATH)) {
      const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
      const list = JSON.parse(raw || '[]');
      if (Array.isArray(list)) {
        const filtered = list.filter((item) => {
          const itemId = String(item?.id || '').trim();
          return itemId !== String(numericId) && itemId !== extId;
        });
        if (filtered.length !== list.length) {
          fs.writeFileSync(LEGACY_JSON_PATH, JSON.stringify(filtered, null, 2), 'utf8');
        }
      }
    }
  } catch (jsonErr) {
    console.warn('⚠️ Error limpiando simplified_articles.json:', jsonErr.message);
  }

  return { success: true, id: numericId || extId, title: article.title };
}

// Listado de lecturas manuales (Classroom) para el portal docente
router.get('/manual/mine', authenticate, async (req, res) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'teacher' && role !== 'admin') {
    return res.status(403).json({ error: 'Solo docentes o administradores pueden ver sus lecturas' });
  }

  try {
    await ensureLegacyJsonMigrated();
    const rows = await db.all(
      `SELECT a.id, a.external_id, a.title, a.content, a.topic, a.created_at,
              a.assigned_to_user_id, a.author_id, a.class_id,
              c.name AS class_name,
              u.username AS assigned_student_name, u.email AS assigned_student_email
       FROM articles a
       LEFT JOIN classes c ON a.class_id = c.id
       LEFT JOIN users u ON a.assigned_to_user_id = u.id
       WHERE LOWER(a.topic) = 'classroom' OR a.is_manual = 1
       ORDER BY datetime(a.created_at) DESC`
    );

    const userId = Number(req.user.id);
    const enriched = (rows || []).map((row) => ({
      ...row,
      can_delete: role === 'admin' || row.author_id == null || Number(row.author_id) === userId
    }));

    res.json({ articles: enriched });
  } catch (error) {
    console.error('❌ Error al obtener lecturas manuales:', error.message);
    res.status(500).json({ error: 'Error al obtener lecturas' });
  }
});

// Eliminación individual de un artículo
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await ensureLegacyJsonMigrated();
    const result = await deleteArticleById(req.params.id, req.user);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.json({
      success: true,
      message: 'Artículo eliminado correctamente',
      id: result.id
    });
  } catch (error) {
    console.error('❌ Error en DELETE /articles/:id:', error.message);
    res.status(500).json({ error: 'Error interno al eliminar el artículo' });
  }
});

// Eliminación en bloque de lecturas seleccionadas
router.post('/batch-delete', authenticate, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Debe proporcionar una lista de IDs para eliminar' });
  }

  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'teacher' && role !== 'admin') {
    return res.status(403).json({ error: 'Solo docentes o administradores pueden eliminar lecturas' });
  }

  try {
    await ensureLegacyJsonMigrated();
    let deletedCount = 0;
    const deletedIds = [];
    const errors = [];

    for (const id of ids) {
      const resDel = await deleteArticleById(id, req.user);
      if (resDel.success) {
        deletedCount++;
        deletedIds.push(resDel.id);
      } else {
        errors.push({ id, error: resDel.error });
      }
    }

    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} lecturas correctamente`,
      deletedCount,
      deletedIds,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('❌ Error en POST /articles/batch-delete:', error.message);
    res.status(500).json({ error: 'Error interno en eliminación masiva' });
  }
});

async function getArticleHandler(req, res) {
  const articleId = String(req.params.id || req.body.id || req.body.articleId || '').replace(/['"]+/g, '').trim();
  if (!articleId || articleId === 'undefined' || articleId === 'null') {
    return res.status(400).json({ error: 'ID de artículo inválido o no proporcionado' });
  }

  try {
    await ensureLegacyJsonMigrated();
    let article = null;
    if (/^\d+$/.test(articleId)) {
      article = await db.get(
        `SELECT a.*, c.name AS class_name
         FROM articles a
         LEFT JOIN classes c ON a.class_id = c.id
         WHERE a.id = ?`,
        [Number(articleId)]
      );
    } else {
      article = await db.get(
        `SELECT a.*, c.name AS class_name
         FROM articles a
         LEFT JOIN classes c ON a.class_id = c.id
         WHERE a.external_id = ?`,
        [articleId]
      );
    }

    if (!article) {
      article = await readLegacyJsonById(articleId);
    }
    if (!article) return res.status(404).json({ error: 'Artículo no encontrado' });

    const rawLevel = String(req.params.cefr || req.query.level || req.body.level || '').trim().toUpperCase();
    const numericArticleId = article.id != null ? Number(article.id) : null;
    if (rawLevel && CEFR_LEVELS.has(rawLevel) && numericArticleId != null && !Number.isNaN(numericArticleId)) {
      // 1. Verificación en SQLite (Caché bajo demanda)
      let simplified = await db.get(
        `SELECT text, adapted_title, adapted_content FROM simplified_articles WHERE article_id = ? AND level = ?`,
        [numericArticleId, rawLevel]
      );

      let adaptedTitle = simplified?.adapted_title || null;
      let adaptedText = simplified?.adapted_content || simplified?.text || null;

      // 2. Si no existe en SQLite, invocar a la IA para adaptar texto y título
      if (!adaptedText) {
        try {
          console.log(`🤖 [Lazy Adaptation] Generando versión nivel ${rawLevel} con IA para artículo ${numericArticleId}...`);
          const adapted = await aiService.adaptArticleForLevel(article.title, article.content, rawLevel);
          if (adapted && adapted.content && adapted.content.trim().length > 30) {
            adaptedTitle = (adapted.title || article.title || 'Untitled Article').trim();
            adaptedText = adapted.content.trim();

            await db.run(
              `INSERT OR REPLACE INTO simplified_articles (article_id, text, level, adapted_title, adapted_content)
               VALUES (?, ?, ?, ?, ?)`,
              [numericArticleId, adaptedText, rawLevel, adaptedTitle, adaptedText]
            );
            console.log(`✅ [Lazy Adaptation] Versión nivel ${rawLevel} guardada en SQLite (título y contenido)`);
          }
        } catch (adaptErr) {
          console.warn(`⚠️ No se pudo generar versión nivel ${rawLevel} con IA:`, adaptErr.message);
        }
      } else {
        console.log(`📦 [Lazy Cache Hit] Versión nivel ${rawLevel} de artículo ${numericArticleId} servida desde SQLite sin invocar a la IA.`);
      }

      const finalContent = adaptedText || article.content;
      const finalTitle = adaptedTitle || article.title;

      article = {
        ...article,
        title: finalTitle,
        adapted_title: finalTitle,
        content: finalContent,
        simplified_content: finalContent,
        adapted_content: finalContent,
        reading_level: rawLevel
      };
    } else {
      article = {
        ...article,
        title: article.title,
        adapted_title: article.title,
        simplified_content: article.content,
        adapted_content: article.content,
        reading_level: rawLevel || 'B1'
      };
    }

    res.json(article);
  } catch (error) {
    console.error('❌ Error al buscar artículo:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

router.get('/:id/level/:cefr', getArticleHandler);
router.get('/:id', getArticleHandler);
router.get('/:id/simplify', getArticleHandler);
router.post('/:id/simplify', getArticleHandler);
router.post('/simplify', getArticleHandler);

module.exports = router;