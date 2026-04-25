const db = require('./database/db');

(async () => {
  try {
    const rows = await db.all('SELECT id, title FROM articles ORDER BY id LIMIT 10');
    console.log('Primeros artículos en la DB:');
    rows.forEach(r => console.log(`ID=${r.id} → ${r.title}`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
})();
