const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService'); // Importamos tu servicio de IA

router.post('/analyze-text', async (req, res) => {
    const { text } = req.body;

    const prompt = `Analyze the English text: "${text}". 
    Return ONLY a JSON object: {"translation": "Spanish", "definition": "English", "example": "Sentence"}`;

    try {
        console.log(`🤖 IA analizando: "${text}"`);
        const aiResponse = await aiService.ask(prompt); 
        
        // LIMPIEZA AGRESIVA: Busca el primer '{' y el último '}' para extraer solo el JSON
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("La IA no devolvió un formato JSON válido");
        }
        
        const data = JSON.parse(jsonMatch[0]);
        res.json(data);
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