const express = require('express');
const router = express.Router();

router.post('/analyze-text', async (req, res) => {

    try {

        const { text, type } = req.body;

        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        if (type === "translate") {

            // simple demo translation
            return res.json({
                translation: `Spanish translation of: "${text}"`
            });

        }

        if (type === "explain") {

            return res.json({
                explanation: `Explanation for learners: "${text}" is a sentence that describes something happening.`
            });

        }

        res.status(400).json({ error: "Invalid analysis type" });

    } catch (error) {

        console.error("Analyze text error:", error);

        res.status(500).json({
            error: "Failed to analyze text"
        });

    }

});

module.exports = router;