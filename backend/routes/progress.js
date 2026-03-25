const express = require('express');
const router = express.Router();
const quizService = require('../services/quizService');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /progress/:userId
 * @desc Get progress for a user
 * @access Private
 */
router.get('/progress/:userId', authenticate, async (req, res) => {
  try {
    const requestedUserId = parseInt(req.params.userId);
    const currentUserId = req.user.userId;
    
    // Only allow users to access their own progress or admins (future feature)
    if (requestedUserId !== currentUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get user statistics
    const stats = await quizService.getUserStats(requestedUserId);
    
    // Get recent attempts
    const recentAttempts = await quizService.getUserAttempts(requestedUserId, 5);
    
    res.json({
      articles_read: stats.articles_read,
      average_score: stats.success_rate,
      total_attempts: stats.total_attempts,
      correct_attempts: stats.correct_attempts,
      recent_attempts: recentAttempts
    });
  } catch (error) {
    console.error('Get progress error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /progress/stats
 * @desc Get statistics for the current user
 * @access Private
 */
router.get('/progress/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = await quizService.getUserStats(userId);
    
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /progress/history
 * @desc Get reading history for the current user
 * @access Private
 */
router.get('/progress/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;
    
    // Get articles read by the user
    const db = require('../database/db');
    const articles = await db.all(
      `SELECT DISTINCT a.id, a.title, a.source, a.topic, a.created_at,
              sa.level, MAX(att.completed_at) as read_at
       FROM articles a
       JOIN quizzes q ON a.id = q.article_id
       JOIN attempts att ON q.id = att.quiz_id
       JOIN simplified_articles sa ON a.id = sa.article_id AND sa.level = q.level
       WHERE att.user_id = ?
       GROUP BY a.id
       ORDER BY read_at DESC
       LIMIT ?`,
      [userId, parseInt(limit)]
    );
    
    res.json({ articles });
  } catch (error) {
    console.error('Get history error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /progress/level-recommendation
 * @desc Get a level recommendation for the user
 * @access Private
 */
router.get('/progress/level-recommendation', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's current level
    const db = require('../database/db');
    const user = await db.get(
      'SELECT level FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's quiz statistics
    const stats = await quizService.getUserStats(userId);
    
    // Get attempts at current level
    const attemptsAtLevel = await db.get(
      `SELECT COUNT(*) as count
       FROM attempts att
       JOIN quizzes q ON att.quiz_id = q.id
       WHERE att.user_id = ? AND q.level = ?`,
      [userId, user.level]
    );
    
    // Make a recommendation based on success rate and number of attempts
    let recommendation = user.level;
    let reason = 'Your current level seems appropriate.';
    
    // Only make a recommendation if the user has completed enough quizzes
    if (attemptsAtLevel.count >= 10) {
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentLevelIndex = levels.indexOf(user.level);
      
      if (stats.success_rate > 85 && currentLevelIndex < levels.length - 1) {
        // If success rate is high, recommend moving up a level
        recommendation = levels[currentLevelIndex + 1];
        reason = 'Your success rate is high. You might be ready for a more challenging level.';
      } else if (stats.success_rate < 40 && currentLevelIndex > 0) {
        // If success rate is low, recommend moving down a level
        recommendation = levels[currentLevelIndex - 1];
        reason = 'You might find this level more comfortable and effective for learning.';
      }
    } else {
      reason = 'Complete more quizzes at your current level for a personalized recommendation.';
    }
    
    res.json({
      current_level: user.level,
      recommended_level: recommendation,
      reason,
      stats: {
        success_rate: stats.success_rate,
        attempts_at_level: attemptsAtLevel.count
      }
    });
  } catch (error) {
    console.error('Get level recommendation error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;