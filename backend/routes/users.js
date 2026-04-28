const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

// GET /api/users/me/export
router.get('/me/export', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const user = await db.get(
      `SELECT id, username, email, level, age, interests, role, onboarding_completed, created_at
       FROM users
       WHERE id = ?`,
      [userId]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const [preferences, flashcards, answerEvents, attempts, memberships, ownedClasses] = await Promise.all([
      db.get(
        `SELECT weekly_reading_goal_minutes, created_at, updated_at
         FROM user_preferences
         WHERE user_id = ?`,
        [userId]
      ),
      db.all(
        `SELECT id, word, context, level, created_at
         FROM user_flashcards
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
      ),
      db.all(
        `SELECT id, session_id, article_id, question_id, question_type, quiz_source,
                selected_value, is_correct, response_time_ms, attempt_index,
                counted_for_stats, level, answered_at, created_at
         FROM answer_events
         WHERE user_id = ?
         ORDER BY answered_at DESC
         LIMIT 5000`,
        [userId]
      ),
      db.all(
        `SELECT id, quiz_id, selected_option, is_correct, submitted_at
         FROM attempts
         WHERE user_id = ?
         ORDER BY submitted_at DESC
         LIMIT 5000`,
        [userId]
      ),
      db.all(
        `SELECT c.id, c.name, c.invite_code, c.teacher_id, cm.joined_at
         FROM class_members cm
         JOIN classes c ON c.id = cm.class_id
         WHERE cm.student_id = ?
         ORDER BY cm.joined_at DESC`,
        [userId]
      ),
      db.all(
        `SELECT c.id, c.name, c.invite_code, c.is_active, c.created_at,
                COUNT(cm.id) AS students_count
         FROM classes c
         LEFT JOIN class_members cm ON cm.class_id = c.id
         WHERE c.teacher_id = ?
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [userId]
      )
    ]);

    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      user,
      preferences: preferences || null,
      data: {
        flashcards,
        answerEvents,
        attempts,
        memberships,
        ownedClasses
      }
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="linguistfeed-user-${userId}-export.json"`
    );
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('❌ Error exporting user data:', err.message);
    return res.status(500).json({ error: 'No se pudo exportar la cuenta' });
  }
});

// DELETE /api/users/me
router.delete('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const confirmText = String(req.body?.confirmText || '').trim().toUpperCase();
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ error: 'Confirmación inválida. Debe ser DELETE' });
    }
    const exists = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!exists) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.run('DELETE FROM users WHERE id = ?', [userId]);
    return res.json({
      ok: true,
      deletedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error deleting user account:', err.message);
    return res.status(500).json({ error: 'No se pudo borrar la cuenta' });
  }
});

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.username || req.query.q || '').trim().toLowerCase();
    let users;
    if (q) {
      users = await db.all(
        `SELECT id, username, email, role
         FROM users
         WHERE LOWER(username) LIKE ? OR LOWER(email) LIKE ?
         ORDER BY username ASC
         LIMIT 50`,
        [`%${q}%`, `%${q}%`]
      );
    } else {
      users = await db.all(
        'SELECT id, username, email, role FROM users ORDER BY username ASC LIMIT 50'
      );
    }
    res.json(users);
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/users/:id
// Nota: métricas articlesRead/quizzesTaken/streak aquí siguen tabla `attempts` (legado).
// Para la misma fuente que el dashboard del lector, usar GET /api/progress/teacher/student/:id/stats-v2 (teacher).
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

// PUT /api/users/me/preferences
router.put('/me/preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const raw = req.body?.weeklyReadingGoalMinutes;
    const goal = parseInt(String(raw), 10);
    if (!Number.isInteger(goal) || goal < 15 || goal > 600) {
      return res.status(400).json({
        error: 'weeklyReadingGoalMinutes debe ser un entero entre 15 y 600'
      });
    }

    await db.run(
      `INSERT INTO user_preferences (user_id, weekly_reading_goal_minutes, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         weekly_reading_goal_minutes = excluded.weekly_reading_goal_minutes,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, goal]
    );

    res.json({
      ok: true,
      preferences: {
        weeklyReadingGoalMinutes: goal
      }
    });
  } catch (err) {
    console.error('❌ Error updating user preferences:', err.message);
    res.status(500).json({ error: 'Error al actualizar preferencias' });
  }
});

module.exports = router;
