const express = require('express');
const crypto = require('crypto');
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

// GET /api/classes/my
// Teacher/Admin: lista sus clases. Student: clases a las que pertenece.
router.get('/my', authenticate, async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);
    const uid = currentUserId(req);

    if (role === 'teacher' || role === 'admin') {
      const classes = await db.all(
        `SELECT
           c.id,
           c.name,
           c.invite_code AS inviteCode,
           c.created_at AS createdAt,
           COUNT(cm.id) AS studentsCount
         FROM classes c
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
});

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
    return res.status(500).json({ error: 'No se pudo unir a la clase' });
  }
});

module.exports = router;

