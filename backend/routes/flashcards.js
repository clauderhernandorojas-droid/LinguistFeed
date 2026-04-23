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
const { authenticate } = require('../middleware/auth');

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
router.post('/', authenticate, async (req, res) => {
  try {
    const { word, context, level } = req.body;
    const userId = req.user.userId;
    const createdAt = new Date().toISOString();

    await db_local.run('BEGIN TRANSACTION');

    const insertUserSql = `
      INSERT INTO user_flashcards (user_id, word, context, level, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;
    await db_local.run(insertUserSql, [userId, word, context, level, createdAt]);

    const insertGlobalSql = `
      INSERT INTO flashcards (word, context, level, created_at)
      VALUES (?, ?, ?, ?)
    `;
    const result = await db_local.run(insertGlobalSql, [word, context, level, createdAt]);

    await db_local.run('COMMIT');
    console.log(`✨ Flashcard guardada para user_id=${userId}: ${word}`);
    res.status(201).json({ id: result.lastID, message: 'Saved to user_flashcards and flashcards' });
  } catch (err) {
    await db_local.run('ROLLBACK').catch(() => {});
    console.error('Error saving flashcard:', err);
    res.status(500).json({ error: 'Could not save flashcard' });
  }
});

/**
 * 3. RUTA PARA RECUPERAR TODAS
 * GET /api/flashcards
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sql = `SELECT * FROM user_flashcards WHERE user_id = ? ORDER BY created_at DESC`;

    // Usamos el método 'all' promisificado que exporta db.js
    const rows = await db_local.all(sql, [userId]);
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
