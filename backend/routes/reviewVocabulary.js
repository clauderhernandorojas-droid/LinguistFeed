const express = require('express');
const router = express.Router();
const db = require('../database/db');

/**
 * @route GET /vocabulary/review
 * @desc Get all words for review
 * @access Private
 */
router.get('/review', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Step 1: Get all words where next_review <= today
    const words = await db.all(
      'SELECT * FROM user_vocabulary WHERE user_id = ? AND next_review <= ?',
      [userId, new Date()]
    );

    res.json({ words });
  } catch (error) {
    console.error('Error retrieving vocabulary for review:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;