const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Necesitarás instalarlo: npm install bcryptjs

const JWT_SECRET = 'LinguistFeed_Master_Key_2026'; // <--- Usa esta frase exacta

/**
 * @route POST /register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (username, email, password_hash, onboarding_completed) VALUES (?, ?, ?, 0)`,
      [username, email, hashedPassword]
    );
    
    const user = { id: result.id, username, email, onboardingCompleted: false };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(400).json({ error: "El usuario o email ya existe" });
  }
});

/**
 * @route POST /login
 * @desc Login a user
 * @access Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);
    
    if (user && await bcrypt.compare(password, user.password_hash)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
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