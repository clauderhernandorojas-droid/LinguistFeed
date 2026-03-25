const express = require('express');
const router = express.Router();
const db = require('../database/db');

/**
 * @route POST /vocabulary/review-result
 * @desc Handle the result of a vocabulary review
 * @access Private
 */
router.post('/review-result', async (req, res) => {
  const { word_id, correct } = req.body;

  if (word_id === undefined || correct === undefined) {
    return res.status(400).json({ error: 'Word ID and correct status are required' });
  }

  try {
    // Step 1: Get the current entry for the word
    const wordEntry = await db.get('SELECT review_interval, next_review FROM user_vocabulary WHERE id = ?', [word_id]);

    if (!wordEntry) {
      return res.status(404).json({ error: 'Word not found' });
    }

    // Step 2: Update the review interval and next review date based on correctness
    let newReviewInterval = wordEntry.review_interval;
    let newNextReview = new Date();

    if (correct) {
      // Increase review interval (e.g., double it)
      newReviewInterval *= 2;
      newNextReview.setDate(newNextReview.getDate() + newReviewInterval);
    } else {
      // Reset interval to 1 day
      newReviewInterval = 1;
      newNextReview.setDate(newNextReview.getDate() + newReviewInterval);
    }

    // Update the word entry in the database
    await db.run(
      'UPDATE user_vocabulary SET review_interval = ?, next_review = ? WHERE id = ?',
      [newReviewInterval, newNextReview, word_id]
    );

    res.json({ message: 'Review result processed successfully' });
  } catch (error) {
    console.error('Error processing review result:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;