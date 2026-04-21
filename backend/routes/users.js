const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await db.all(
      'SELECT id, username, email, role FROM users'
    );
    res.json(users);
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (user) {
      const quizzesTakenRow = await db.get(
        'SELECT COUNT(*) as count FROM attempts WHERE user_id = ?',
        [id]
      );
      const quizzesTaken = quizzesTakenRow.count;

      const articlesReadRow = await db.get(
        `
        SELECT COUNT(DISTINCT q.article_id) as count
        FROM attempts att
        JOIN quizzes q ON att.quiz_id = q.id
        WHERE att.user_id = ?
      `,
        [id]
      );
      const articlesRead = articlesReadRow.count;

      const vocabRow = await db.get(
        'SELECT COUNT(*) as count FROM user_flashcards WHERE user_id = ?',
        [id]
      );
      const vocabularyLearned = vocabRow ? vocabRow.count : 0;

      const streakRow = await db.all(
        `
        SELECT DATE(submitted_at) as day
        FROM attempts
        WHERE user_id = ?
        GROUP BY DATE(submitted_at)
        ORDER BY day ASC
      `,
        [id]
      );
      let streak = 0;
      let maxStreak = 0;
      for (let i = 0; i < streakRow.length; i++) {
        if (i === 0) {
          streak = 1;
          maxStreak = 1;
          continue;
        }
        const prev = new Date(streakRow[i - 1].day);
        const curr = new Date(streakRow[i].day);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 1;
        }
      }

      res.json({
        ...user,
        articlesRead,
        quizzesTaken,
        vocabularyLearned,
        streak: maxStreak
      });
    } else {
      res.status(404).json({ error: 'Usuario no encontrado' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// PUT /api/users/:id/role
router.put('/:id/role', async (req, res) => {
  const { role } = req.body;
  const { id } = req.params;
  try {
    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true, id, role });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

module.exports = router;
