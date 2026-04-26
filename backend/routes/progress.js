const express = require('express');
const router = express.Router();
const quizService = require('../services/quizService');
const { authenticate } = require('../middleware/auth');
const db = require('../database/db');

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
    const articles = await db.all(
      `SELECT DISTINCT a.id, a.title, a.source, a.topic, a.created_at,
              sa.level, MAX(att.submitted_at) as read_at
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

router.post('/answer-event', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const {
      sessionId = null,
      articleId,
      quizSource = 'reader_ai',
      questionId,
      questionType,
      attemptIndex = 1,
      selected,
      isCorrect,
      responseTimeMs = null,
      answeredAt = null,
      meta = {}
    } = req.body || {};

    const articleIdNum = parseInt(articleId, 10);
    const attemptIndexNum = parseInt(attemptIndex, 10);
    const responseMsNum = responseTimeMs == null ? null : parseInt(responseTimeMs, 10);
    if (!Number.isInteger(articleIdNum) || articleIdNum <= 0 || !questionId || !questionType) {
      return res.status(400).json({ ok: false, error: 'articleId, questionId y questionType son obligatorios' });
    }

    const countedForStats = attemptIndexNum === 1 && (responseMsNum == null || responseMsNum >= 1500) ? 1 : 0;
    const reason = countedForStats ? 'first_attempt_valid' : (attemptIndexNum !== 1 ? 'not_first_attempt' : 'too_fast');

    await db.run(
      `INSERT OR IGNORE INTO answer_events
       (user_id, session_id, article_id, question_id, question_type, quiz_source, selected_value, is_correct, response_time_ms, attempt_index, counted_for_stats, level, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [
        userId,
        sessionId,
        articleIdNum,
        String(questionId),
        String(questionType),
        String(quizSource || 'reader_ai'),
        selected == null ? '' : JSON.stringify(selected),
        isCorrect ? 1 : 0,
        responseMsNum,
        Number.isInteger(attemptIndexNum) && attemptIndexNum > 0 ? attemptIndexNum : 1,
        countedForStats,
        meta && meta.level ? String(meta.level) : null,
        answeredAt || null
      ]
    );

    const snapshot = await buildStatsV2(userId);
    res.json({
      ok: true,
      counted: countedForStats === 1,
      reason,
      normalized: { firstAttemptOnly: true, minAnswerTimeSec: 1.5 },
      snapshot: {
        totalAnswers: snapshot.activity.totalAnswers,
        correctAnswers: snapshot.activity.correctAnswers,
        accuracy: snapshot.scores.accuracy,
        overallScore: snapshot.scores.overallScore
      }
    });
  } catch (error) {
    console.error('Save answer-event error:', error.message);
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.get('/stats-v2', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId ?? req.user.id;
    const stats = await buildStatsV2(userId);
    res.json(stats);
  } catch (error) {
    console.error('Get stats-v2 error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

async function buildStatsV2(userId) {
  const base = await db.get(
    `SELECT
       COUNT(*) AS total_answers,
       COALESCE(SUM(is_correct), 0) AS correct_answers,
       COUNT(DISTINCT article_id) AS articles_completed,
       COUNT(DISTINCT DATE(answered_at)) AS active_days_30
     FROM answer_events
     WHERE user_id = ?
       AND counted_for_stats = 1
       AND datetime(answered_at) >= datetime('now', '-30 days')`,
    [userId]
  );

  const vocab = await db.get('SELECT COUNT(*) AS count FROM user_flashcards WHERE user_id = ?', [userId]);
  const totalAnswers = Number(base?.total_answers || 0);
  const correctAnswers = Number(base?.correct_answers || 0);
  const articlesCompleted = Number(base?.articles_completed || 0);
  const activeDays30 = Number(base?.active_days_30 || 0);
  const vocabularyLearned = Number(vocab?.count || 0);

  const accuracy = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;
  const consistencyScore = Math.min(activeDays30 / 20, 1) * 100;
  const completionScore = Math.min(articlesCompleted / 12, 1) * 100;
  const overallScore = (accuracy * 0.7) + (consistencyScore * 0.2) + (completionScore * 0.1);

  return {
    userId,
    activity: { totalAnswers, correctAnswers, articlesCompleted, activeDays30 },
    scores: {
      accuracy: round1(accuracy),
      consistencyScore: round1(consistencyScore),
      completionScore: round1(completionScore),
      overallScore: round1(overallScore)
    },
    dashboard: {
      articlesRead: articlesCompleted,
      quizzesTaken: totalAnswers,
      vocabularyLearned,
      streak: 0
    },
    updatedAt: new Date().toISOString()
  };
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

module.exports = router;