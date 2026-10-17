const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

function normalizeRole(role) {
  return String(role || '').toLowerCase();
}

function currentUserId(req) {
  return req.user?.userId ?? req.user?.id;
}

function buildInviteCode() {
  // 8 chars legibles, suficiente para MVP.
  return crypto.randomBytes(5).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
}

async function generateUniqueInviteCode() {
  for (let i = 0; i < 10; i++) {
    const candidate = buildInviteCode();
    const exists = await db.get('SELECT id FROM classes WHERE invite_code = ?', [candidate]);
    if (!exists) return candidate;
  }
  throw new Error('No se pudo generar un código único');
}

// POST /api/classes
// Teacher/Admin crea una clase y recibe código de invitación.
router.post('/', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo profesores pueden crear clases' });
    }

    const teacherId = currentUserId(req);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre de la clase es obligatorio' });
    if (name.length > 80) return res.status(400).json({ error: 'El nombre no puede superar 80 caracteres' });

    const inviteCode = await generateUniqueInviteCode();
    const result = await db.run(
      `INSERT INTO classes (teacher_id, name, invite_code, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [teacherId, name, inviteCode]
    );

    const newClass = await db.get(
      `SELECT id, teacher_id AS teacherId, name, invite_code AS inviteCode, created_at AS createdAt
       FROM classes
       WHERE id = ?`,
      [result.lastID]
    );
    return res.status(201).json({ ok: true, class: newClass });
  } catch (error) {
    console.error('Create class error:', error.message);
    return res.status(500).json({ error: 'No se pudo crear la clase' });
  }
});

// GET /api/classes y GET /api/classes/my
// Teacher/Admin: lista sus clases. Student: clases a las que pertenece.
async function listUserClasses(req, res) {
  try {
    const role = normalizeRole(req.user?.role);
    const uid = currentUserId(req);

    if (role === 'admin') {
      const classes = await db.all(
        `SELECT
           c.id,
           c.name,
           c.invite_code AS inviteCode,
           c.created_at AS createdAt,
           c.teacher_id AS teacherId,
           COALESCE(u.username, 'Docente') AS teacherName,
           COUNT(cm.id) AS studentsCount
         FROM classes c
         LEFT JOIN users u ON u.id = c.teacher_id
         LEFT JOIN class_members cm ON cm.class_id = c.id
         WHERE c.is_active = 1
         GROUP BY c.id
         ORDER BY c.created_at DESC`
      );
      return res.json({ classes });
    }

    if (role === 'teacher') {
      const classes = await db.all(
        `SELECT
           c.id,
           c.name,
           c.invite_code AS inviteCode,
           c.created_at AS createdAt,
           c.teacher_id AS teacherId,
           COALESCE(u.username, 'Docente') AS teacherName,
           COUNT(cm.id) AS studentsCount
         FROM classes c
         LEFT JOIN users u ON u.id = c.teacher_id
         LEFT JOIN class_members cm ON cm.class_id = c.id
         WHERE c.teacher_id = ? AND c.is_active = 1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [uid]
      );
      return res.json({ classes });
    }

    const classes = await db.all(
      `SELECT
         c.id,
         c.name,
         c.invite_code AS inviteCode,
         c.created_at AS createdAt,
         u.id AS teacherId,
         u.username AS teacherName
       FROM class_members cm
       JOIN classes c ON c.id = cm.class_id
       JOIN users u ON u.id = c.teacher_id
       WHERE cm.student_id = ? AND c.is_active = 1
       ORDER BY cm.joined_at DESC`,
      [uid]
    );
    return res.json({ classes });
  } catch (error) {
    console.error('List classes error:', error.message);
    return res.status(500).json({ error: 'No se pudieron listar las clases' });
  }
}

router.get('/', authenticate, listUserClasses);
router.get('/my', authenticate, listUserClasses);

// GET /api/classes/:classId/students
// Teacher dueño (o admin) consulta alumnos de su clase.
router.get('/:classId/students', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo profesores pueden ver alumnos de clases' });
    }

    const classId = parseInt(req.params.classId, 10);
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ error: 'ID de clase inválido' });
    }

    const classroom = await db.get(
      `SELECT id, teacher_id AS teacherId, name, invite_code AS inviteCode
       FROM classes
       WHERE id = ? AND is_active = 1`,
      [classId]
    );
    if (!classroom) return res.status(404).json({ error: 'Clase no encontrada' });

    const uid = currentUserId(req);
    if (role === 'teacher' && classroom.teacherId !== uid) {
      return res.status(403).json({ error: 'No tienes acceso a esta clase' });
    }

    const students = await db.all(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.level,
         cm.joined_at AS joinedAt
       FROM class_members cm
       JOIN users u ON u.id = cm.student_id
       WHERE cm.class_id = ?
       ORDER BY cm.joined_at DESC`,
      [classId]
    );

    return res.json({
      class: classroom,
      students
    });
  } catch (error) {
    console.error('List class students error:', error.message);
    return res.status(500).json({ error: 'No se pudieron obtener alumnos de la clase' });
  }
});

// POST /api/classes/join
// Student se une por código.
router.post('/join', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'student') {
      return res.status(403).json({ error: 'Solo estudiantes pueden unirse por código' });
    }

    const studentId = currentUserId(req);
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'El código de clase es obligatorio' });

    const classroom = await db.get(
      `SELECT id, teacher_id AS teacherId, name, invite_code AS inviteCode
       FROM classes
       WHERE invite_code = ? AND is_active = 1`,
      [code]
    );
    if (!classroom) return res.status(404).json({ error: 'Código de clase inválido' });

    await db.run(
      `INSERT OR IGNORE INTO class_members (class_id, student_id)
       VALUES (?, ?)`,
      [classroom.id, studentId]
    );

    return res.json({
      ok: true,
      class: {
        id: classroom.id,
        name: classroom.name,
        inviteCode: classroom.inviteCode
      }
    });
  } catch (error) {
    console.error('Join class error:', error.message);
    return res.status(500).json({ error: 'Error al unirse a la clase' });
  }
});

// POST /api/classes/:id/students/quick-enroll
// Permite al profesor/admin matricular a un estudiante (existente o nuevo)
router.post('/:id/students/quick-enroll', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo profesores o administradores pueden matricular alumnos' });
    }

    const classId = parseInt(req.params.id, 10);
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ error: 'ID de clase inválido' });
    }

    const classroom = await db.get(
      `SELECT id, teacher_id AS teacherId, name, invite_code AS inviteCode
       FROM classes
       WHERE id = ? AND is_active = 1`,
      [classId]
    );
    if (!classroom) return res.status(404).json({ error: 'Clase no encontrada' });

    const uid = currentUserId(req);
    if (role === 'teacher' && classroom.teacherId !== uid) {
      return res.status(403).json({ error: 'No tienes permisos sobre esta clase' });
    }

    const { email, fullName, password, level, studentId } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    // Caso A1: Identificador numérico de estudiante explícito
    if (studentId) {
      const numericStudentId = parseInt(studentId, 10);
      const existingUser = await db.get(
        'SELECT id, username, email, level, role FROM users WHERE id = ?',
        [numericStudentId]
      );
      if (!existingUser) {
        return res.status(404).json({ error: 'Estudiante no encontrado con ese ID' });
      }
      await db.run(
        `INSERT OR IGNORE INTO class_members (class_id, student_id) VALUES (?, ?)`,
        [classId, existingUser.id]
      );
      return res.status(200).json({
        ok: true,
        enrolled: true,
        student: {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          level: existingUser.level || 'B1'
        },
        message: `Estudiante ${existingUser.username} matriculado exitosamente en ${classroom.name}.`
      });
    }

    // Caso A2: Estudiante existente por email
    if (cleanEmail) {
      const existingUser = await db.get(
        'SELECT id, username, email, level, role FROM users WHERE LOWER(TRIM(email)) = LOWER(?)',
        [cleanEmail]
      );
      if (existingUser) {
        await db.run(
          `INSERT OR IGNORE INTO class_members (class_id, student_id) VALUES (?, ?)`,
          [classId, existingUser.id]
        );
        return res.status(200).json({
          ok: true,
          enrolled: true,
          student: {
            id: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
            level: existingUser.level || 'B1'
          },
          message: `Estudiante existente (${existingUser.username}) inscrito en ${classroom.name}.`
        });
      }
    }

    // Caso B: Estudiante nuevo (fullName, email, password, level)
    if (!cleanEmail) {
      return res.status(400).json({ error: 'El email del estudiante es obligatorio' });
    }

    const cleanUsername = String(fullName || cleanEmail.split('@')[0]).trim() || 'Estudiante';
    let finalUsername = cleanUsername;
    const userWithSameName = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername]);
    if (userWithSameName) {
      finalUsername = `${cleanUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const rawPass = String(password || 'Linguist123!').trim();
    const hashedPassword = await bcrypt.hash(rawPass, 10);
    const targetLevel = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(String(level || '').toUpperCase())
      ? String(level).toUpperCase()
      : 'B1';

    const insertRes = await db.run(
      `INSERT INTO users (username, email, password_hash, role, level, onboarding_completed)
       VALUES (?, ?, ?, 'student', ?, 1)`,
      [finalUsername, cleanEmail, hashedPassword, targetLevel]
    );

    const newStudentId = insertRes.lastID;
    await db.run(
      `INSERT OR IGNORE INTO class_members (class_id, student_id) VALUES (?, ?)`,
      [classId, newStudentId]
    );

    return res.status(201).json({
      ok: true,
      created: true,
      student: {
        id: newStudentId,
        username: finalUsername,
        email: cleanEmail,
        level: targetLevel
      },
      message: `Nuevo estudiante ${finalUsername} creado y matriculado exitosamente en ${classroom.name}.`
    });
  } catch (error) {
    console.error('Quick enroll error:', error.message);
    return res.status(500).json({ error: 'No se pudo inscribir al estudiante: ' + error.message });
  }
});

// DELETE /api/classes/:id/students/:studentId
// Permite al profesor/admin desvincular a un estudiante de esa clase específica
router.delete('/:id/students/:studentId', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo profesores o administradores pueden desvincular alumnos' });
    }

    const classId = parseInt(req.params.id, 10);
    const studentId = parseInt(req.params.studentId, 10);
    if (!Number.isInteger(classId) || !Number.isInteger(studentId) || classId <= 0 || studentId <= 0) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }

    const classroom = await db.get(
      `SELECT id, teacher_id AS teacherId, name FROM classes WHERE id = ? AND is_active = 1`,
      [classId]
    );
    if (!classroom) return res.status(404).json({ error: 'Clase no encontrada' });

    const uid = currentUserId(req);
    if (role === 'teacher' && classroom.teacherId !== uid) {
      return res.status(403).json({ error: 'No tienes permisos sobre esta clase' });
    }

    const deleteRes = await db.run(
      `DELETE FROM class_members WHERE class_id = ? AND student_id = ?`,
      [classId, studentId]
    );

    return res.json({
      ok: true,
      changes: deleteRes.changes,
      message: 'Estudiante desvinculado de la clase correctamente'
    });
  } catch (error) {
    console.error('Unenroll student error:', error.message);
    return res.status(500).json({ error: 'Error al desvincular estudiante' });
  }
});

// DELETE /api/classes/:id
// Permite al profesor titular o al administrador eliminar una clase con limpieza en cascada
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo profesores o administradores pueden eliminar clases' });
    }

    const classId = parseInt(req.params.id, 10);
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ error: 'ID de clase inválido' });
    }

    const classroom = await db.get(
      `SELECT id, teacher_id AS teacherId, name FROM classes WHERE id = ?`,
      [classId]
    );
    if (!classroom) return res.status(404).json({ error: 'Clase no encontrada' });

    const uid = currentUserId(req);
    if (role === 'teacher' && Number(classroom.teacherId) !== Number(uid)) {
      return res.status(403).json({ error: 'Solo el profesor titular o un administrador pueden eliminar esta clase' });
    }

    // 1. Elimina las membresías en class_members asociadas a esa clase
    await db.run(`DELETE FROM class_members WHERE class_id = ?`, [classId]);

    // 2. Desvincula las lecturas asignadas a esta clase
    await db.run(`UPDATE articles SET class_id = NULL WHERE class_id = ?`, [classId]);

    // 3. Elimina el aula de la tabla classes
    await db.run(`DELETE FROM classes WHERE id = ?`, [classId]);

    return res.status(200).json({
      ok: true,
      message: 'Clase eliminada con éxito'
    });
  } catch (error) {
    console.error('Delete class error:', error.message);
    return res.status(500).json({ error: 'Error al eliminar la clase: ' + error.message });
  }
});

// GET /api/classes/:id/performance
// Métricas agregadas y reporte de desempeño del aula para la tarjeta y modal de estadísticas
router.get('/:id/performance', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const classId = parseInt(req.params.id, 10);
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ error: 'ID de clase inválido' });
    }

    const classroom = await db.get('SELECT id, teacher_id AS teacherId, name FROM classes WHERE id = ?', [classId]);
    if (!classroom) return res.status(404).json({ error: 'Clase no encontrada' });

    const uid = currentUserId(req);
    if (role === 'teacher' && classroom.teacherId !== uid) {
      return res.status(403).json({ error: 'No tienes acceso a esta clase' });
    }

    const students = await db.all(
      `SELECT u.id, u.username, u.email, u.level, cm.joined_at AS joinedAt
       FROM class_members cm
       JOIN users u ON u.id = cm.student_id
       WHERE cm.class_id = ?
       ORDER BY u.username ASC`,
      [classId]
    );

    const statsService = require('../services/statsService');
    const studentStatsList = [];
    let totalAccuracy = 0;
    let totalReadingMinutes = 0;
    let totalStreak = 0;

    for (const student of students) {
      const stats = await statsService.buildStatsV2(student.id, { windowDays: 30 });
      const acc = Number(stats?.scores?.accuracy || 0);
      const minutes = Number(stats?.weeklyGoals?.readingMinutes?.current || 0);
      const streak = Number(stats?.dashboard?.streak || 0);
      const quizzesTaken = Number(stats?.dashboard?.quizzesTaken || 0);
      const articlesRead = Number(stats?.dashboard?.articlesRead || 0);

      totalAccuracy += acc;
      totalReadingMinutes += minutes;
      totalStreak += streak;

      let performanceStatus = 'good'; // 🟢
      if (quizzesTaken === 0 && articlesRead === 0) {
        performanceStatus = 'inactive'; // ⚪
      } else if (acc < 50) {
        performanceStatus = 'needs_help'; // 🔴
      } else if (acc < 75) {
        performanceStatus = 'improving'; // 🟡
      }

      studentStatsList.push({
        id: student.id,
        username: student.username,
        email: student.email,
        level: student.level || 'B1',
        accuracy: acc,
        readingMinutes: minutes,
        streak,
        quizzesTaken,
        articlesRead,
        performanceStatus
      });
    }

    const count = students.length;
    const summary = {
      studentCount: count,
      averageAccuracy: count > 0 ? Number((totalAccuracy / count).toFixed(1)) : 0,
      totalReadingMinutes: Number(totalReadingMinutes.toFixed(1)),
      averageStreak: count > 0 ? Number((totalStreak / count).toFixed(1)) : 0
    };

    return res.json({
      ok: true,
      class: classroom,
      summary,
      students: studentStatsList
    });
  } catch (error) {
    console.error('Class performance error:', error.message);
    return res.status(500).json({ error: 'Error al calcular rendimiento del aula' });
  }
});

module.exports = router;

