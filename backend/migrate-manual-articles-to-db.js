const fs = require('fs');
const path = require('path');
const db = require('./database/db');

const legacyPath = path.join(__dirname, 'data', 'simplified_articles.json');

function normalizeLegacyArticle(raw) {
  const topic = String(raw?.topic || 'classroom').toLowerCase().trim();
  const externalId = String(raw?.id || '').trim();
  if (!externalId) return null;
  const assignedRaw = raw?.assigned_to_user_id;
  const assignedToUserId =
    assignedRaw == null || String(assignedRaw).trim() === ''
      ? null
      : Number(assignedRaw);
  const createdAtCandidate = raw?.date ? new Date(raw.date) : null;
  const createdAt =
    createdAtCandidate && !Number.isNaN(createdAtCandidate.getTime())
      ? createdAtCandidate.toISOString()
      : new Date().toISOString();
  return {
    externalId,
    title: String(raw?.title || 'Sin título'),
    content: String(raw?.content || ''),
    topic,
    assignedToUserId,
    createdAt
  };
}

async function migrate() {
  await db.initializeDatabase();
  if (!fs.existsSync(legacyPath)) {
    console.log('ℹ️ No existe JSON legacy, nada que migrar.');
    return;
  }

  const raw = fs.readFileSync(legacyPath, 'utf8');
  const list = JSON.parse(raw || '[]');
  if (!Array.isArray(list) || list.length === 0) {
    console.log('ℹ️ JSON legacy vacío, nada que migrar.');
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const item of list) {
    const article = normalizeLegacyArticle(item);
    if (!article) {
      skipped += 1;
      continue;
    }
    const exists = await db.get(
      'SELECT id FROM articles WHERE external_id = ?',
      [article.externalId]
    );
    if (exists?.id) {
      skipped += 1;
      continue;
    }
    await db.run(
      `INSERT INTO articles
        (title, content, topic, source, created_at, external_id, assigned_to_user_id, is_manual)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        article.title,
        article.content,
        article.topic,
        'manual',
        article.createdAt,
        article.externalId,
        article.assignedToUserId
      ]
    );
    inserted += 1;
  }

  console.log(`✅ Migración completada. Insertados: ${inserted}, omitidos: ${skipped}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en migración manual->db:', err.message);
    process.exit(1);
  });
