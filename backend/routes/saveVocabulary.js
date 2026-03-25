const express = require('express');
const router = express.Router();
const db = require('../database/db');

/**
 * @route POST /vocabulary/save
 * @desc Save a word for the current user
 * @access Private
 */
router.post('/save', async (req, res) => {
  const { word, definition, example, cefr_level } = req.body;

  if (!word || !definition || !example || !cefr_level) {
    return res.status(400).json({ error: 'Word, definition, example, and CEFR level are required' });
  }

  try {
    // Get the current user's ID from the request (assuming it's set by authentication middleware)
    const userId = req.user.userId;

    // Step 1: Save the word for the current user
    await db.run(
      'INSERT INTO user_vocabulary (user_id, word, definition, example, cefr_level, review_interval, ease_factor, next_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, word, definition, example, cefr_level, 1, 2.5, new Date(Date.now() + 24 * 60 * 60 * 1000)] // next_review set to tomorrow
    );

    res.status(201).json({ message: 'Word saved successfully' });
  } catch (error) {
    console.error('Error saving word:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;