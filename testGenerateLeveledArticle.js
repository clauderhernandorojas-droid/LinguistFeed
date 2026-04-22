// testGenerateLeveledArticle.js
require('dotenv').config();
const aiService = require('./backend/services/aiService');

(async () => {
  try {
    const sampleText = `
      Artificial Intelligence is transforming industries worldwide.
      It helps doctors diagnose diseases, supports teachers in classrooms,
      and even drives cars autonomously.
    `;

    console.log("🔍 Texto original:\n", sampleText);

    const leveled = await aiService.generateLeveledArticle(sampleText, "B1");

    console.log("\n✨ Texto adaptado (nivel B1):\n", leveled);
  } catch (error) {
    console.error("❌ Error en la prueba:", error.message);
  }
})();
