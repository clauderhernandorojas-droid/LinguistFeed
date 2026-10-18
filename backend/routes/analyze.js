const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService'); // Importamos tu servicio de IA

router.post('/analyze-text', async (req, res) => {
    const { text, type, contextSentence } = req.body;
    try {
        const result = await aiService.analyzeText(text, type || 'word', contextSentence);
        res.json(result);
    } catch (error) {
        console.error("❌ Error en la ruta analyze-text:", error.message);
        res.status(500).json({ 
            translation: "Error de formato", 
            definition: "La IA respondió en un formato incorrecto",
            example: error.message 
        });
    }
});

module.exports = router;