const db = require('../database/db');

/**
 * Service for managing quizzes and user attempts
 */
class QuizService {
  /**
   * Get a quiz by ID
   * 
   * @param {number} quizId - Quiz ID
   * @returns {Promise<Object>} - Quiz object
   */
  async getQuiz(quizId) {
    try {
      console.log(`Getting quiz with ID ${quizId}`);
      
      const quiz = await db.get(
        `SELECT q.id, q.article_id, q.level, q.question, 
                q.option_a, q.option_b, q.option_c, 
                q.correct_option, q.hint,
                a.title as article_title
         FROM quizzes q
         JOIN articles a ON q.article_id = a.id
         WHERE q.id = ?`,
        [quizId]
      );
      
      if (!quiz) {
        throw new Error(`Quiz with ID ${quizId} not found`);
      }
      
      return this.formatQuizResponse(quiz);
    } catch (error) {
      console.error('Error getting quiz:', error.message);
      throw error;
    }
  }

  /**
   * Format quiz data for API response
   * 
   * @param {Object} quiz - Quiz data from database
   * @returns {Object} - Formatted quiz response
   */
  formatQuizResponse(quiz) {
    return {
      id: quiz.id,
      article_id: quiz.article_id,
      article_title: quiz.article_title,
      level: quiz.level,
      question: quiz.question,
      options: [quiz.option_a, quiz.option_b, quiz.option_c],
      hint: quiz.hint
    };
  }

  /**
   * Submit a quiz answer
   * 
   * @param {number} userId - User ID
   * @param {number} quizId - Quiz ID
   * @param {number} selectedOption - Selected option index (0, 1, or 2)
   * @returns {Promise<Object>} - Result object with correct flag
   */
  async submitAnswer(userId, quizId, selectedOption) {
    try {
      console.log(`User ${userId} submitting answer ${selectedOption} for quiz ${quizId}`);
      
      // Get the quiz to check the correct answer
      const quiz = await db.get(
        'SELECT correct_option FROM quizzes WHERE id = ?',
        [quizId]
      );
      
      if (!quiz) {
        throw new Error(`Quiz with ID ${quizId} not found`);
      }
      
      const correctIndex = parseInt(quiz.correct_option, 10);
      const isCorrect = selectedOption === correctIndex;
      
      await db.run(
        'INSERT INTO attempts (user_id, quiz_id, selected_option, is_correct) VALUES (?, ?, ?, ?)',
        [userId, quizId, selectedOption, isCorrect ? 1 : 0]
      );
      
      console.log(`Answer recorded. Correct: ${isCorrect}`);
      
      return { success: true, quizId: Number(quizId), isCorrect };
    } catch (error) {
      console.error('Error submitting answer:', error.message);
      throw error;
    }
  }

  /**
   * Get quizzes for a specific article
   * 
   * @param {number} articleId - Article ID
   * @returns {Promise<Array>} - Array of quiz objects
   */
  async getQuizzesForArticle(articleId) {
    try {
      console.log(`Getting quizzes for article ${articleId}`);
      
      const quizzes = await db.all(
        `SELECT q.id, q.article_id, q.level, q.question, 
                q.option_a, q.option_b, q.option_c, 
                q.hint,
                a.title as article_title
         FROM quizzes q
         JOIN articles a ON q.article_id = a.id
         WHERE q.article_id = ?
         ORDER BY q.level`,
        [articleId]
      );
      
      return quizzes.map(quiz => this.formatQuizResponse(quiz));
    } catch (error) {
      console.error('Error getting quizzes for article:', error.message);
      throw error;
    }
  }

  /**
   * Get quizzes for a specific CEFR level
   * 
   * @param {string} level - CEFR level
   * @param {number} limit - Maximum number of quizzes to return
   * @returns {Promise<Array>} - Array of quiz objects
   */
  async getQuizzesByLevel(level, limit = 10) {
    try {
      console.log(`Getting quizzes for level ${level}`);
      
      const quizzes = await db.all(
        `SELECT q.id, q.article_id, q.level, q.question, 
                q.option_a, q.option_b, q.option_c, 
                q.hint,
                a.title as article_title
         FROM quizzes q
         JOIN articles a ON q.article_id = a.id
         WHERE q.level = ?
         ORDER BY a.created_at DESC
         LIMIT ?`,
        [level, limit]
      );
      
      return quizzes.map(quiz => this.formatQuizResponse(quiz));
    } catch (error) {
      console.error('Error getting quizzes by level:', error.message);
      throw error;
    }
  }

  /**
   * Get quiz attempts for a user
   * 
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of attempts to return
   * @returns {Promise<Array>} - Array of attempt objects
   */
  async getUserAttempts(userId, limit = 20) {
    try {
      console.log(`Getting quiz attempts for user ${userId}`);
      
      const attempts = await db.all(
        `SELECT att.id, att.quiz_id, att.selected_option, att.is_correct, att.submitted_at,
                q.question, q.option_a, q.option_b, q.option_c, q.correct_option,
                a.title as article_title, a.id as article_id
         FROM attempts att
         JOIN quizzes q ON att.quiz_id = q.id
         JOIN articles a ON q.article_id = a.id
         WHERE att.user_id = ?
         ORDER BY att.submitted_at DESC
         LIMIT ?`,
        [userId, limit]
      );
      
      return attempts.map((attempt) => {
        const correctIdx = parseInt(attempt.correct_option, 10);
        return {
        id: attempt.id,
        quiz_id: attempt.quiz_id,
        article_id: attempt.article_id,
        article_title: attempt.article_title,
        question: attempt.question,
        selected_option: attempt.selected_option,
        selected_answer: attempt[`option_${['a', 'b', 'c'][attempt.selected_option]}`],
        correct_option: correctIdx,
        correct_answer: attempt[`option_${['a', 'b', 'c'][correctIdx]}`],
        correct: !!attempt.is_correct,
        completed_at: attempt.submitted_at
      };
      });
    } catch (error) {
      console.error('Error getting user attempts:', error.message);
      throw error;
    }
  }

  /**
   * Get quiz statistics for a user
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - Statistics object
   */
  async getUserStats(userId) {
    try {
      console.log(`Getting quiz statistics for user ${userId}`);
      
      // Get total attempts
      const totalAttempts = await db.get(
        'SELECT COUNT(*) as count FROM attempts WHERE user_id = ?',
        [userId]
      );
      
      // Get correct attempts
      const correctAttempts = await db.get(
        'SELECT COUNT(*) as count FROM attempts WHERE user_id = ? AND is_correct = 1',
        [userId]
      );
      
      // Get unique articles read
      const articlesRead = await db.get(
        `SELECT COUNT(DISTINCT q.article_id) as count
         FROM attempts att
         JOIN quizzes q ON att.quiz_id = q.id
         WHERE att.user_id = ?`,
        [userId]
      );
      
      // Calculate success rate
      const successRate = totalAttempts.count > 0
        ? (correctAttempts.count / totalAttempts.count) * 100
        : 0;
      
      return {
        total_attempts: totalAttempts.count,
        correct_attempts: correctAttempts.count,
        articles_read: articlesRead.count,
        success_rate: Math.round(successRate * 10) / 10 // Round to 1 decimal place
      };
    } catch (error) {
      console.error('Error getting user statistics:', error.message);
      throw error;
    }
  }
}

module.exports = new QuizService();