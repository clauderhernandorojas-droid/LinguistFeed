const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'LinguistFeed_Master_Key_2026';

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

// GET /api/users (Accesible para admin y para profesores buscando alumnos)
router.get('/', authenticate, async (req, res) => {
  try {
    const requesterRole = String(req.user?.role || '').toLowerCase();
    if (requesterRole !== 'admin' && requesterRole !== 'teacher') {
      return res.status(403).json({ error: 'Acceso denegado: solo administradores' });
    }

    const q = String(req.query.username || req.query.q || '').trim().toLowerCase();
    let query = `SELECT id, username, email, role, level, created_at FROM users`;
    const conditions = [];
    const params = [];

    // Si es un profesor buscando candidatos para matricular, solo mostrar estudiantes
    if (requesterRole === 'teacher') {
      conditions.push(`LOWER(role) = 'student'`);
    }

    if (q) {
      conditions.push(`(LOWER(username) LIKE ? OR LOWER(email) LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY created_at DESC, id DESC`;

    const users = await db.all(query, params);
    return res.json(users);
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ error: 'Error en el servidor al obtener usuarios' });
  }
});

// POST /api/users (protegido con requireRole('admin'))
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const rawUsername = String(req.body.username || req.body.name || '').trim();
    const rawEmail = String(req.body.email || '').trim().toLowerCase();
    const rawRole = String(req.body.role || 'student').trim().toLowerCase();
    const rawLevel = String(req.body.level || 'B1').trim().toUpperCase();
    const password = String(req.body.password || req.body.pass || '').trim() || 'Linguist123!';

    if (!rawUsername) {
      return res.status(400).json({ error: 'El nombre completo es obligatorio' });
    }
    if (!rawEmail) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
    }

    const validRoles = ['student', 'teacher', 'admin'];
    if (!validRoles.includes(rawRole)) {
      return res.status(400).json({ error: 'Rol inválido. Debe ser student, teacher o admin.' });
    }

    // Validar que el email o username no esté repetido
    const existing = await db.get(
      'SELECT id, email, username FROM users WHERE LOWER(TRIM(email)) = LOWER(?) OR LOWER(TRIM(username)) = LOWER(?)',
      [rawEmail, rawUsername]
    );
    if (existing) {
      if (existing.email && existing.email.toLowerCase() === rawEmail.toLowerCase()) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const validLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(rawLevel) ? rawLevel : 'B1';

    const insertRes = await db.run(
      `INSERT INTO users (username, email, password_hash, role, level, onboarding_completed, created_at)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [rawUsername, rawEmail, hashedPassword, rawRole, validLevel]
    );

    const newUserId = insertRes.lastID;
    const newUser = await db.get(
      'SELECT id, username, email, role, level, created_at FROM users WHERE id = ?',
      [newUserId]
    );

    return res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: newUser
    });
  } catch (error) {
    console.error('❌ Error al crear usuario por admin:', error.message);
    return res.status(500).json({ error: 'Error al registrar el usuario en el servidor' });
  }
});

// DELETE /api/users/:id (protegido con requireRole('admin'))
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const currentAdminId = req.user.userId ?? req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (!targetId || isNaN(targetId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    // 1. Validar que el usuario a borrar no sea el mismo que ejecuta la acción
    if (Number(currentAdminId) === Number(targetId)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' });
    }

    const targetUser = await db.get('SELECT id, username, role FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 2. Realizar borrado limpio en cascada:
    // a) class_members (si es estudiante o si es profesor de clases)
    await db.run('DELETE FROM class_members WHERE student_id = ?', [targetId]);
    await db.run(
      'DELETE FROM class_members WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = ?)',
      [targetId]
    );

    // b) classes si el usuario era docente
    await db.run('DELETE FROM classes WHERE teacher_id = ?', [targetId]);

    // c) answer_events
    await db.run('DELETE FROM answer_events WHERE user_id = ?', [targetId]);

    // d) user_flashcards
    await db.run('DELETE FROM user_flashcards WHERE user_id = ?', [targetId]);

    // e) user_progress (si existe la tabla)
    try {
      const hasUserProgress = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_progress'"
      );
      if (hasUserProgress) {
        await db.run('DELETE FROM user_progress WHERE user_id = ?', [targetId]);
      }
    } catch (_) {}

    // f) attempts y preferences
    await db.run('DELETE FROM attempts WHERE user_id = ?', [targetId]);
    await db.run('DELETE FROM user_preferences WHERE user_id = ?', [targetId]);

    // g) Desvincular artículos asignados o creados si los hubiera
    try {
      await db.run('UPDATE articles SET assigned_to_user_id = NULL WHERE assigned_to_user_id = ?', [targetId]);
      await db.run('UPDATE articles SET author_id = NULL WHERE author_id = ?', [targetId]);
    } catch (_) {}

    // h) Finalmente eliminar el usuario en users
    await db.run('DELETE FROM users WHERE id = ?', [targetId]);

    return res.status(200).json({
      success: true,
      message: `Usuario ${targetUser.username} eliminado correctamente`,
      deletedId: targetId
    });
  } catch (err) {
    console.error('❌ Error al eliminar usuario:', err.message);
    return res.status(500).json({ error: 'Error interno al eliminar el usuario' });
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
  const validRoles = ['student', 'teacher', 'admin'];
  const normalizedRole = String(role || '').toLowerCase().trim();

  if (!validRoles.includes(normalizedRole)) {
    return res.status(400).json({ error: `Rol inválido: ${role}. Debe ser student, teacher o admin.` });
  }

  try {
    await db.run('UPDATE users SET role = ? WHERE id = ?', [normalizedRole, id]);
    const updatedUser = await db.get(
      'SELECT id, username, email, level, role, onboarding_completed FROM users WHERE id = ?',
      [id]
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const token = jwt.sign(
      {
        id: updatedUser.id,
        userId: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        level: updatedUser.level
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      id: updatedUser.id,
      role: updatedUser.role,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        level: updatedUser.level,
        role: updatedUser.role,
        onboardingCompleted: Number(updatedUser.onboarding_completed || 0) === 1
      },
      token
    });
  } catch (err) {
    console.error('❌ Error al actualizar rol:', err.message);
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

// PUT /api/users/:id (Edición completa y reseteo de contraseña por admin)
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!targetId || isNaN(targetId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const existingUser = await db.get('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { username, email, role, level, password } = req.body || {};

    const updates = [];
    const params = [];

    // 1. Username
    if (username !== undefined) {
      const cleanUsername = String(username).trim();
      if (!cleanUsername) {
        return res.status(400).json({ error: 'El nombre de usuario no puede estar vacío' });
      }
      updates.push('username = ?');
      params.push(cleanUsername);
    }

    // 2. Email
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ error: 'Formato de correo electrónico inválido' });
      }
      const duplicate = await db.get(
        'SELECT id FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND id != ?',
        [cleanEmail, targetId]
      );
      if (duplicate) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario' });
      }
      updates.push('email = ?');
      params.push(cleanEmail);
    }

    // 3. Role
    if (role !== undefined) {
      const validRoles = ['student', 'teacher', 'admin'];
      const cleanRole = String(role).trim().toLowerCase();
      if (!validRoles.includes(cleanRole)) {
        return res.status(400).json({ error: `Rol inválido: ${role}. Debe ser student, teacher o admin.` });
      }
      updates.push('role = ?');
      params.push(cleanRole);
    }

    // 4. Level
    if (level !== undefined) {
      const cleanLevel = String(level).trim().toUpperCase();
      const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (!validLevels.includes(cleanLevel)) {
        return res.status(400).json({ error: `Nivel CEFR inválido: ${level}` });
      }
      updates.push('level = ?');
      params.push(cleanLevel);
    }

    // 5. Password (si viene no vacío, se hashea con bcryptjs)
    if (password !== undefined && String(password).trim().length > 0) {
      const cleanPassword = String(password).trim();
      if (cleanPassword.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }
      const hashedPassword = await bcrypt.hash(cleanPassword, 10);
      updates.push('password_hash = ?');
      params.push(hashedPassword);
    }

    if (updates.length > 0) {
      params.push(targetId);
      await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedUser = await db.get(
      'SELECT id, username, email, role, level, created_at FROM users WHERE id = ?',
      [targetId]
    );

    return res.status(200).json({
      ok: true,
      message: 'Usuario actualizado correctamente',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        level: updatedUser.level,
        created_at: updatedUser.created_at
      }
    });
  } catch (error) {
    console.error('❌ Error al actualizar usuario por admin:', error.message);
    return res.status(500).json({ error: 'Error interno al actualizar el usuario' });
  }
});

module.exports = router;
