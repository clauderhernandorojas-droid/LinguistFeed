const express = require('express');
const router = express.Router();
const db = require('../database/db');

/**
 * @route GET /daily-articles
 * @desc Obtiene los artículos más recientes de la base de datos
 */
router.get('/', async (req, res) => {
  try {
    // 1. Buscamos los últimos 20 artículos directamente en la tabla principal
    // Ordenamos por ID descendente para ver lo más nuevo primero
    const articles = await db.all('SELECT * FROM articles ORDER BY id DESC LIMIT 20');

    console.log(`[Backend] Enviando ${articles.length} artículos al frontend`);

    // 2. Enviamos la estructura que el frontend espera
    res.json({
      date: new Date().toISOString().split('T')[0],
      articles: articles.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        // Normalizamos el tema a minúsculas para que el filtro del frontend no falle
        topic: (a.topic || "technology").toLowerCase().trim()
      }))
    });
  } catch (error) {
    console.error('Error en ruta daily-articles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;