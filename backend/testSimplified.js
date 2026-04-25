// backend/testSimplified.js
const db = require('./database/db');

(async () => {
  try {
    const articleId = 518; // cambia por un ID real de tu tabla articles
    const rows = await db.all(
      'SELECT id, article_id, level, substr(text,1,200) AS snippet FROM simplified_articles WHERE article_id = ? ORDER BY level',
      [articleId]
    );

    if (!rows || rows.length === 0) {
      console.log(`⚠️ No hay versiones adaptadas para article_id=${articleId}`);
    } else {
      console.log(`✅ Se encontraron ${rows.length} versiones adaptadas para article_id=${articleId}`);
      rows.forEach(r => {
        console.log(`Nivel ${r.level}: ${r.snippet.replace(/\s+/g,' ').trim()}...`);
      });
    }
  } catch (err) {
    console.error('❌ Error al consultar simplified_articles:', err.message);
  } finally {
    process.exit(0);
  }
})();
