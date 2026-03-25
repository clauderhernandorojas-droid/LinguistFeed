const express = require('express');
const router = express.Router();
const quizService = require('../services/quizService');
const { authenticate } = require('../middleware/auth');

/**
 * @route GET /quizzes/:id
 * @desc Get a specific quiz
 * @access Private
 */
router.get('/quizzes/:id', authenticate, async (req, res) => {
  try {
    const quizId = req.params.id;
    
    const quiz = await quizService.getQuiz(quizId);
    
    res.json(quiz);
  } catch (error) {
    console.error('Get quiz error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /quizzes/article/:articleId
 * @desc Get quizzes for a specific article
 * @access Private
 */
router.get('/quizzes/article/:articleId', authenticate, async (req, res) => {
  try {
    const articleId = req.params.articleId;
    
    const quizzes = await quizService.getQuizzesForArticle(articleId);
    
    res.json({ quizzes });
  } catch (error) {
    console.error('Get quizzes for article error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /quizzes/level/:level
 * @desc Get quizzes for a specific CEFR level
 * @access Private
 */
router.get('/quizzes/level/:level', authenticate, async (req, res) => {
  try {
    const level = req.params.level;
    const { limit = 10 } = req.query;
    
    const quizzes = await quizService.getQuizzesByLevel(level, parseInt(limit));
    
    res.json({ quizzes });
  } catch (error) {
    console.error('Get quizzes by level error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route POST /submit-answer
 * @desc Submit an answer to a quiz
 * @access Private
 */
router.post('/submit-answer', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { quiz_id, selected_option } = req.body;
    
    if (quiz_id === undefined || selected_option === undefined) {
      return res.status(400).json({ error: 'Quiz ID and selected option are required' });
    }
    
    // Validate selected option
    if (![0, 1, 2].includes(parseInt(selected_option))) {
      return res.status(400).json({ error: 'Selected option must be 0, 1, or 2' });
    }
    
    const result = await quizService.submitAnswer(userId, quiz_id, parseInt(selected_option));
    
    res.json(result);
  } catch (error) {
    console.error('Submit answer error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route GET /attempts
 * @desc Get quiz attempts for the current user
 * @access Private
 */
router.get('/attempts', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;
    
    const attempts = await quizService.getUserAttempts(userId, parseInt(limit));
    
    res.json({ attempts });
  } catch (error) {
    console.error('Get attempts error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;