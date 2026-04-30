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

/**
 * 1. RUTA PARA GENERAR (IA)
 * POST /generate-flashcard
 */
router.post('/generate-flashcard', async (req, res) => {
  try {
    const { word, context, level } = req.body;
    const sql = `INSERT INTO flashcards (word, context, level, created_at) VALUES (?, ?, ?, ?)`;
    const params = [word, context || '', level || 'B2', new Date().toISOString()];

    // Usamos el método 'run' promisificado que exporta db.js
    const result = await db_local.run(sql, params);
    console.log(`✨ Flashcard guardada: ${word}`);
    res.status(201).json({ id: result.id, message: "Saved to local DB" });
  } catch (error) {
    console.error("❌ Error al guardar:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 2. RUTA PARA GUARDAR (SQLite)
 * POST /api/flashcards
 */
router.post('/', async (req, res) => {
  try {
    const { word, context, level, user_id } = req.body;

    if (user_id != null && !Number.isNaN(parseInt(user_id, 10))) {
      const sqlUser = `INSERT INTO user_flashcards (user_id, word, context, level, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
      const resultUser = await db_local.run(sqlUser, [parseInt(user_id, 10), word, context, level || 'B1']);
      console.log(`✨ Flashcard de usuario guardada (user_id=${user_id}): ${word}`);
      return res.status(201).json({ id: resultUser.lastID, message: "Saved to user_flashcards" });
    }

    // Compatibilidad para rutas/consumidores legacy sin user_id
    const sql = `INSERT INTO flashcards (word, context, level, created_at) VALUES (?, ?, ?, ?)`;
    const params = [word, context, level, new Date().toISOString()];

    // Usamos el método 'run' promisificado que exporta db.js
    const result = await db_local.run(sql, params);
    console.log(`✨ Flashcard guardada físicamente en linguistfeed.db: ${word}`);
    res.status(201).json({ id: result.id, message: "Saved to local DB" });
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

module.exports = router;
