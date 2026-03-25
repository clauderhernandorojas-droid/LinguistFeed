const express = require('express');
const router = express.Router();
const db = require('../database/db');
const aiService = require('../services/aiService');

/**
 * @route POST /define-word
 * @desc Get the definition of a word
 * @access Public
 */
router.post('/', async (req, res) => {
  const { word, sentence, cefr_level } = req.body;

  if (!word || !sentence || !cefr_level) {
    return res.status(400).json({ error: 'Word, sentence, and CEFR level are required' });
  }

  try {
    // Step 1: Check if the word exists in the vocabulary table
    const existingEntry = await db.get(
      'SELECT definition, example FROM vocabulary WHERE word = ? AND level = ?',
      [word, cefr_level]
    );

    if (existingEntry) {
      // Step 2: Return the stored definition and example
      return res.json({
        word: word,
        definition: existingEntry.definition,
        example: existingEntry.example
      });
    }

    // Step 3: Generate definition and example using AI
    const generatedData = await aiService.generateDefinitionAndExample(word, cefr_level);

    // Step 4: Save the generated vocabulary entry into the vocabulary table
    await db.run(
      'INSERT INTO vocabulary (article_id, level, word, definition, example) VALUES (?, ?, ?, ?, ?)',
      [null, cefr_level, word, generatedData.definition, generatedData.example]
    );

    // Step 5: Return the definition to the client
    return res.json({
      word: word,
      definition: generatedData.definition,
      example: generatedData.example
    });
  } catch (error) {
    console.error('Error defining word:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;