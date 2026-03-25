const express = require('express');
const router = express.Router();
const db = require('../database/db');
const aiService = require('../services/aiService');

/**
 * @route GET /articles/personalized
 * @desc Get a personalized article for the current user
 * @access Private
 */
router.get('/personalized', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Step 1: Get user's CEFR level
    const user = await db.get('SELECT level FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cefrLevel = user.level;

    // Step 2: Get user's interests
    const interests = await db.all(
      `SELECT i.name FROM interests i
       JOIN user_interests ui ON i.id = ui.interest_id
       WHERE ui.user_id = ?`,
      [userId]
    );
    const interestNames = interests.map(i => i.name);

    // Step 3: Get difficult vocabulary from user_vocabulary
    const difficultWords = await db.all(
      'SELECT word FROM user_vocabulary WHERE user_id = ?',
      [userId]
    );
    const difficultWordsList = difficultWords.map(v => v.word);

    // Step 4: Request AI to generate a personalized simplified article
    const article = await aiService.generateSimplifiedArticle('Original article text here', cefrLevel, {
      interests: interestNames,
      difficultWords: difficultWordsList
    });

    // Step 5: Return the personalized article
    res.json(article);
  } catch (error) {
    console.error('Error getting personalized article:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;