const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Necesitarás instalarlo: npm install bcryptjs

const JWT_SECRET = process.env.JWT_SECRET || 'LinguistFeed_Master_Key_2026';

/**
 * @route POST /register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  const rawEmail = (req.body.email || '').trim().toLowerCase();
  const rawUsername = (req.body.username || req.body.name || rawEmail.split('@')[0] || '').trim();
  const password = req.body.password || req.body.pass || '';

  if (!rawEmail || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (username, email, password_hash, onboarding_completed) VALUES (?, ?, ?, 0)`,
      [rawUsername, rawEmail, hashedPassword]
    );
    
    const userId = result.lastID || result.id;
    const user = { id: userId, userId, username: rawUsername, email: rawEmail, onboardingCompleted: false, role: 'student' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ token, user });
  } catch (error) {
    console.error("❌ Error en register:", error.message);
    res.status(400).json({ error: "El usuario o email ya existe" });
  }
});

/**
 * @route POST /login
 * @desc Login a user
 * @access Public
 */
router.post('/login', async (req, res) => {
  const emailInput = (req.body.email || req.body.username || '').trim();
  const passwordInput = req.body.password || req.body.pass || '';

  console.log(`Intento de login para email: ${emailInput}`);

  try {
    const user = await db.get(
      `SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(?) OR LOWER(TRIM(username)) = LOWER(?)`,
      [emailInput, emailInput]
    );

    const userFound = !!user;
    console.log(`Usuario encontrado: ${userFound}`);

    let passwordMatch = false;
    if (userFound && user.password_hash) {
      passwordMatch = await bcrypt.compare(passwordInput, user.password_hash);
    }
    console.log(`Resultado de comparación de password: ${passwordMatch}`);

    if (userFound && passwordMatch) {
      const token = jwt.sign(
        { id: user.id, userId: user.id, username: user.username, email: user.email, role: user.role, level: user.level },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({ 
        token, 
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          level: user.level,
          role: user.role,
          age: user.age,
          interests: user.interests,
          onboardingCompleted: Number(user.onboarding_completed || 0) === 1
        }
      });
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  } catch (error) {
    console.error("❌ Error en login:", error.message);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

/**
 * @route GET /profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await authService.getUserById(userId);
    const interests = await authService.getUserInterests(userId);
    
    res.json({
      user,
      interests
    });
  } catch (error) {
    console.error('Profile error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route PUT /profile/level
 * @desc Update user's CEFR level
 * @access Private
 */
router.put('/profile/level', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { level } = req.body;
    
    if (!level) {
      return res.status(400).json({ error: 'Level is required' });
    }
    
    const user = await authService.updateUserLevel(userId, level);
    
    res.json({ user });
  } catch (error) {
    console.error('Update level error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /profile/interests
 * @desc Add an interest to user
 * @access Private
 */
router.post('/profile/interests', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { interest } = req.body;
    
    if (!interest) {
      return res.status(400).json({ error: 'Interest is required' });
    }
    
    const interests = await authService.addUserInterest(userId, interest);
    
    res.json({ interests });
  } catch (error) {
    console.error('Add interest error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route DELETE /profile/interests/:interest
 * @desc Remove an interest from user
 * @access Private
 */
router.delete('/profile/interests/:interest', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const interest = req.params.interest;
    
    const interests = await authService.removeUserInterest(userId, interest);
    
    res.json({ interests });
  } catch (error) {
    console.error('Remove interest error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route PUT /api/auth/update-profile
 * @desc Actualiza la edad y el nivel del usuario
 */
router.put('/update-profile', authenticate, async (req, res) => {
  const { age, level, interests } = req.body;
  const userId = req.user.id; // Obtenido por el middleware 'authenticate'

  try {
    await db.run(
      `UPDATE users
       SET age = ?, level = ?, interests = ?, onboarding_completed = 1
       WHERE id = ?`,
      [age, level, interests, userId]
    );
    
    console.log(`👤 Perfil actualizado: Usuario ${userId} -> Edad: ${age}, Nivel: ${level}`);
    res.json({ message: "Perfil actualizado con éxito" });
  } catch (error) {
    console.error('❌ Error al actualizar perfil:', error.message);
    res.status(500).json({ error: "Error al guardar los datos" });
  }
});


module.exports = router;