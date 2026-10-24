/**
 * flashcards.js - Routes for flashcard generation and storage
 */
console.log("-----------------------------------------");
console.log("⚡ ARCHIVO DE RUTAS DE FLASHCARDS CARGADO");
console.log("-----------------------------------------");

const express = require('express');
const router = express.Router();
const db_local = require('../database/db'); // Importamos la base de datos local (nombre único para evitar conflictos)
const { generateWordCard } = require('../ai/generateWordCard');

const authService = require('../services/authService');
// Firebase / Firestore desacoplado: las flashcards se gestionan exclusivamente en base de datos SQL (Turso / SQLite).
// const { syncWordsToLexispelling, deactivateWordInLexispelling } = require('../services/firebaseService');

/**
 * Resuelve el correo del usuario y su UID explícito a partir de la petición (body, JWT o SQLite local).
 */
async function resolveUserEmailAndUid(req, candidateUserId = null) {
  let targetEmail = req.body?.userEmail || req.body?.email || null;
  let explicitFirebaseUid = null;

  const rawUserId = req.body?.userId || req.body?.user_id;
  if (typeof rawUserId === 'string' && rawUserId.includes('@')) {
    targetEmail = rawUserId.trim();
  } else if (
    rawUserId &&
    typeof rawUserId === 'string' &&
    isNaN(Number(rawUserId)) &&
    rawUserId.trim().length >= 10
  ) {
    explicitFirebaseUid = rawUserId.trim();
  }

  // Token en cabecera Authorization: Bearer <token>
  if (!targetEmail && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = authService.verifyToken(token);
      if (decoded && decoded.email) targetEmail = decoded.email;
      if (!candidateUserId && (decoded?.id || decoded?.userId)) {
        candidateUserId = decoded.id || decoded.userId;
      }
    } catch (_) {}
  }

  if (req.user) {
    if (!targetEmail && req.user.email) targetEmail = req.user.email;
    if (!candidateUserId && (req.user.id || req.user.userId)) {
      candidateUserId = req.user.id || req.user.userId;
    }
  }

  // Si aún no hay email pero hay ID local de usuario en SQLite, buscar en users
  if (!targetEmail && candidateUserId && !isNaN(Number(candidateUserId))) {
    try {
      const userRow = await db_local.get('SELECT email FROM users WHERE id = ?', [parseInt(candidateUserId, 10)]);
      if (userRow && userRow.email) targetEmail = userRow.email;
    } catch (_) {}
  }

  return { targetEmail, explicitFirebaseUid };
}

/**
 * Normaliza y extrae traducción y frase limpias (soportando formato del lector: [traducción] - frase).
 */
function extractCleanTranslationAndPhrase(word, context, rawTranslation, rawPhrase) {
  let translation = rawTranslation ? String(rawTranslation).trim() : '';
  let phrase = rawPhrase ? String(rawPhrase).trim() : '';

  if (!translation && context) {
    const match = String(context).match(/^\[(.*?)\]\s*-\s*(.*)$/);
    if (match) {
      translation = match[1].trim();
      phrase = match[2].trim();
    } else {
      phrase = String(context).trim();
    }
  }
  return { translation, phrase };
}

/**
 * 1. RUTA PARA GENERAR (IA)
 * POST /generate-flashcard
 */
router.post('/generate-flashcard', async (req, res) => {
  try {
    const { word, context, level } = req.body;
    const sql = `INSERT INTO flashcards (word, context, level, created_at) VALUES (?, ?, ?, ?)`;
    const params = [word, context || '', level || 'B2', new Date().toISOString()];

    const result = await db_local.run(sql, params);
    const savedId = result.lastID;
    console.log(`✨ Flashcard guardada: ${word}`);
    res.status(201).json({ id: savedId, message: "Saved to local DB" });
  } catch (error) {
    console.error("❌ Error al guardar:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. RUTA PARA GUARDAR (SQLite) + Auto-Sync a Lexispelling
 * POST /api/flashcards
 */
router.post('/', async (req, res) => {
  try {
    const {
      word,
      context,
      level,
      user_id,
      translation,
      phrase,
      phraseTranslation,
      deckName,
      tags,
      notes,
    } = req.body;

    const { translation: cleanTranslation, phrase: cleanPhrase } = extractCleanTranslationAndPhrase(
      word,
      context,
      translation,
      phrase
    );

    let savedId = null;
    let localUserId = user_id != null && !Number.isNaN(parseInt(user_id, 10)) ? parseInt(user_id, 10) : null;
    const wordClean = String(word || '').trim();
    const transClean = String(cleanTranslation || '').trim().toLowerCase();

    // 2. Unicidad por Palabra + Traducción (Permitir polisemia atómica)
    let isDuplicate = false;
    if (localUserId) {
      const existingUserCards = await db_local.all(
        'SELECT id, word, context FROM user_flashcards WHERE user_id = ? AND LOWER(TRIM(word)) = LOWER(TRIM(?))',
        [localUserId, wordClean]
      );
      for (const card of existingUserCards) {
        const { translation: existingTrans } = extractCleanTranslationAndPhrase(card.word, card.context, null, null);
        if (existingTrans.trim().toLowerCase() === transClean) {
          isDuplicate = true;
          savedId = card.id;
          break;
        }
      }

      if (!isDuplicate) {
        const sqlUser = `INSERT INTO user_flashcards (user_id, word, context, level, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        const resultUser = await db_local.run(sqlUser, [localUserId, wordClean, context, level || 'B1']);
        savedId = resultUser.lastID;
        console.log(`✨ Flashcard de usuario guardada (user_id=${localUserId}): ${wordClean} [${cleanTranslation}]`);
      } else {
        console.log(`ℹ️ Flashcard duplicada detectada (misma palabra y traducción) para user_id=${localUserId}: ${wordClean}`);
      }
    } else {
      // Compatibilidad para rutas/consumidores legacy sin user_id
      const existingCards = await db_local.all(
        'SELECT id, word, context FROM flashcards WHERE LOWER(TRIM(word)) = LOWER(TRIM(?))',
        [wordClean]
      );
      for (const card of existingCards) {
        const { translation: existingTrans } = extractCleanTranslationAndPhrase(card.word, card.context, null, null);
        if (existingTrans.trim().toLowerCase() === transClean) {
          isDuplicate = true;
          savedId = card.id;
          break;
        }
      }

      if (!isDuplicate) {
        const sql = `INSERT INTO flashcards (word, context, level, created_at) VALUES (?, ?, ?, ?)`;
        const params = [wordClean, context, level, new Date().toISOString()];
        const result = await db_local.run(sql, params);
        savedId = result.lastID;
        console.log(`✨ Flashcard guardada físicamente en linguistfeed.db: ${wordClean} [${cleanTranslation}]`);
      } else {
        console.log(`ℹ️ Flashcard duplicada detectada en flashcards legacy: ${wordClean}`);
      }
    }

    const effectiveDeckName = deckName || 'Reading Vocabulary';
    const effectiveTags = Array.isArray(tags) ? tags : (req.body.tag ? [req.body.tag] : []);

    // Respuesta inmediata al usuario
    res.status(isDuplicate ? 200 : 201).json({
      id: savedId,
      message: isDuplicate ? "Flashcard already exists for this meaning" : "Saved to database",
      duplicate: isDuplicate
    });
  } catch (error) {
    console.error("❌ Error al guardar en SQLite:", error.message);
    res.status(500).json({ error: "Error saving to database" });
  }
});

/**
 * 3. RUTA PARA RECUPERAR TODAS
 * GET /api/flashcards
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    let rows = [];
    if (userId != null && !Number.isNaN(userId)) {
      rows = await db_local.all(
        `SELECT id, word, context, level, created_at
         FROM user_flashcards
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      );
    } else {
      const sql = `SELECT * FROM flashcards ORDER BY created_at DESC`;
      rows = await db_local.all(sql, []);
    }
    console.log(`📡 Enviando ${rows ? rows.length : 0} flashcards al cliente.`);
    res.json(rows || []);
  } catch (error) {
    console.error("⚠️ Error al consultar SQLite:", error.message);
    res.status(500).json({
      error: "Database error",
      details: error.message
    });
  }
});

/**
 * 4. RUTA PARA ACTUALIZAR (SQLite) + Auto-Sync a Lexispelling
 * PUT /api/flashcards/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    const { word, context, level, translation, phrase, phraseTranslation, deckName, notes, user_id } = req.body;

    let localUserId = user_id != null && !Number.isNaN(parseInt(user_id, 10)) ? parseInt(user_id, 10) : null;
    let existing = null;

    if (localUserId) {
      existing = await db_local.get('SELECT * FROM user_flashcards WHERE id = ? AND user_id = ?', [cardId, localUserId]);
      if (existing) {
        await db_local.run(
          'UPDATE user_flashcards SET word = COALESCE(?, word), context = COALESCE(?, context), level = COALESCE(?, level) WHERE id = ? AND user_id = ?',
          [word || null, context || null, level || null, cardId, localUserId]
        );
      }
    }
    if (!existing) {
      existing = await db_local.get('SELECT * FROM flashcards WHERE id = ?', [cardId]);
      if (existing) {
        await db_local.run(
          'UPDATE flashcards SET word = COALESCE(?, word), context = COALESCE(?, context), level = COALESCE(?, level) WHERE id = ?',
          [word || null, context || null, level || null, cardId]
        );
      }
    }

    res.json({ success: true, message: "Flashcard updated successfully" });
  } catch (error) {
    console.error("❌ Error al actualizar flashcard:", error.message);
    res.status(500).json({ error: "Error updating flashcard" });
  }
});

/**
 * 5. RUTA PARA ELIMINAR (SQLite / Turso)
 * DELETE /api/flashcards/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    const userId = req.query.user_id || req.body?.user_id || (req.user ? req.user.id : null);
    let localUserId = userId != null && !Number.isNaN(parseInt(userId, 10)) ? parseInt(userId, 10) : null;
    let cardToDelete = null;

    if (localUserId) {
      cardToDelete = await db_local.get('SELECT * FROM user_flashcards WHERE id = ? AND user_id = ?', [cardId, localUserId]);
      if (cardToDelete) {
        await db_local.run('DELETE FROM user_flashcards WHERE id = ? AND user_id = ?', [cardId, localUserId]);
      }
    }
    if (!cardToDelete) {
      cardToDelete = await db_local.get('SELECT * FROM flashcards WHERE id = ?', [cardId]);
      if (cardToDelete) {
        await db_local.run('DELETE FROM flashcards WHERE id = ?', [cardId]);
      }
    }

    res.json({ success: true, message: "Flashcard deleted successfully" });
  } catch (error) {
    console.error("❌ Error al eliminar flashcard:", error.message);
    res.status(500).json({ error: "Error deleting flashcard" });
  }
});

/**
 * 6. HOOK DE ELIMINACIÓN POR PALABRA / MAZO
 * POST /api/flashcards/delete
 */
router.post('/delete', async (req, res) => {
  try {
    const { word, id, userId, user_id } = req.body;
    const localUserId = (userId || user_id) && !isNaN(Number(userId || user_id)) ? parseInt(userId || user_id, 10) : null;

    if (id && !isNaN(Number(id))) {
      const cardId = parseInt(id, 10);
      if (localUserId) {
        await db_local.run('DELETE FROM user_flashcards WHERE id = ? AND user_id = ?', [cardId, localUserId]);
      } else {
        await db_local.run('DELETE FROM flashcards WHERE id = ?', [cardId]);
      }
    } else if (word) {
      if (localUserId) {
        await db_local.run('DELETE FROM user_flashcards WHERE word = ? AND user_id = ?', [word, localUserId]);
      } else {
        await db_local.run('DELETE FROM flashcards WHERE word = ?', [word]);
      }
    }

    res.json({ success: true, message: "Card deleted successfully" });
  } catch (error) {
    console.error("❌ Error en POST /api/flashcards/delete:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 7. RUTA MANUAL DE RESPALDO / SINCRONIZACIÓN (Compatibilidad con Frontend)
 * POST /api/flashcards/sync-lexispelling
 */
router.post('/sync-lexispelling', async (req, res) => {
  try {
    const { cards, deckName, userId } = req.body;
    let cardsToSync = [];
    const localUserId = userId && !isNaN(Number(userId)) ? parseInt(userId, 10) : null;

    // Obtener tarjetas a sincronizar
    if (Array.isArray(cards) && cards.length > 0) {
      cardsToSync = cards;
    } else if (localUserId) {
      cardsToSync = await db_local.all(
        `SELECT id, word, context as phrase, level, created_at as createdAt 
         FROM user_flashcards 
         WHERE user_id = ?`,
        [localUserId]
      );
    } else {
      cardsToSync = await db_local.all(
        `SELECT id, word, context as phrase, level, created_at as createdAt 
         FROM flashcards`,
        []
      );
    }

    const count = cardsToSync ? cardsToSync.length : 0;
    res.json({
      success: true,
      count: count,
      deckNames: [deckName || 'Reading Vocabulary'],
      target: 'sql_database',
      message: `¡${count} palabra(s) sincronizada(s) y respaldadas en la base de datos SQL (Turso)!`,
    });
  } catch (error) {
    console.error("❌ Error en sync-lexispelling:", error);
    res.status(500).json({
      success: false,
      error: "Error al sincronizar flashcards",
      details: error.message,
    });
  }
});

module.exports = router;

