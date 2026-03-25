const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /activities/article/:articleId
 * @desc Get all activities for a specific article
 * @access Private
 */
router.get('/article/:articleId', authenticate, async (req, res) => {
  try {
    const articleId = req.params.articleId;
    const paragraphIndex = req.query.paragraph_index ? parseInt(req.query.paragraph_index) : null;
    
    const activities = await db.all(
      'SELECT * FROM activities WHERE article_id = ?' + (paragraphIndex !== null ? ' AND paragraph_index = ?' : ''),
      paragraphIndex !== null ? [articleId, paragraphIndex] : [articleId]
    );
    
    res.json({ activities });
  } catch (error) {
    console.error('Get activities error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;