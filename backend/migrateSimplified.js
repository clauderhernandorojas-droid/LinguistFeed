// backend/migrateSimplified.js
const db = require('./database/db');
const aiService = require('./services/aiService');

(async () => {
  try {
    const articles = await db.all('SELECT id, content FROM articles');
    const levels = ['A1','A2','B1','B2','C1','C2'];

    for (const art of articles) {
      console.log(`Procesando artículo ${art.id}...`);
      for (const level of levels) {
        try {
          const adapted = await aiService.generateLeveledArticle(art.content, level);
          await db.run(
            'INSERT INTO simplified_articles (article_id, text, level) VALUES (?, ?, ?)',
            [art.id, adapted, level]
          );
          console.log(`✅ Guardado nivel ${level} para artículo ${art.id}`);
        } catch (err) {
          console.warn(`⚠️ Fallback nivel ${level} para artículo ${art.id}: ${err.message}`);
          await db.run(
            'INSERT INTO simplified_articles (article_id, text, level) VALUES (?, ?, ?)',
            [art.id, art.content, level]
          );
        }
      }
    }
    console.log('🎯 Migración completa');
  } catch (err) {
    console.error('❌ Error en migración:', err.message);
  } finally {
    process.exit(0);
  }
})();
