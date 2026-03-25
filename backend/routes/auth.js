const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

/**
 * @route POST /register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, level } = req.body;
    
    if (!email || !password || !level) {
      return res.status(400).json({ error: 'Email, password, and level are required' });
    }
    
    const user = await authService.registerUser(email, password, level);
    
    res.status(201).json({ user });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /login
 * @desc Login a user
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const { user, token } = await authService.loginUser(email, password);
    
    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: error.message });
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

module.exports = router;