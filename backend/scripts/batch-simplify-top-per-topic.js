/**
 * One-shot batch: genera textos simplificados por nivel CEFR para los N artículos
 * más recientes de cada topic distinto en `articles`.
 *
 * Uso (desde la carpeta backend o raíz con ruta correcta):
 *   cd backend && node scripts/batch-simplify-top-per-topic.js
 *
 * Variables opcionales (.env):
 *   BATCH_SIMPLIFY_TOP=10              (por defecto 10)
 *   BATCH_SIMPLIFY_LEVELS=A1,A2,B1,B2,C1,C2
 *   BATCH_SIMPLIFY_DELAY_MS=800       pausa entre niveles (reduce carga GPU)
 *   BATCH_SIMPLIFY_TOPIC_DELAY_MS=0    pausa extra entre artículos
 *   BATCH_SIMPLIFY_FORCE=false        si true, sobrescribe filas ya existentes
 *   USE_LMSTUDIO_FOR_LEVELING=true    usa LM Studio para generateLeveledArticle
 *
 * Requiere LM Studio local + modelo cargado, u OPENROUTER_API_KEY.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../database/db');
const aiService = require('../services/aiService');

const TOP_N = Math.max(1, parseInt(process.env.BATCH_SIMPLIFY_TOP || '10', 10) || 10);
const LEVELS = (process.env.BATCH_SIMPLIFY_LEVELS || 'A1,A2,B1,B2,C1,C2')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const DELAY_MS = Math.max(0, parseInt(process.env.BATCH_SIMPLIFY_DELAY_MS || '500', 10) || 0);
const TOPIC_DELAY_MS = Math.max(0, parseInt(process.env.BATCH_SIMPLIFY_TOPIC_DELAY_MS || '0', 10) || 0);
const FORCE = String(process.env.BATCH_SIMPLIFY_FORCE || '').toLowerCase() === 'true';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function upsertSimplified(articleId, text, level) {
  await db.run(
    `INSERT OR REPLACE INTO simplified_articles (article_id, text, level) VALUES (?, ?, ?)`,
    [articleId, text, level]
  );
}

async function main() {
  await db.initializeDatabase();

  if (!LEVELS.length) {
    console.error('❌ BATCH_SIMPLIFY_LEVELS vacío');
    process.exit(1);
  }

  const topicRows = await db.all(
    `SELECT DISTINCT topic FROM articles
     WHERE topic IS NOT NULL AND TRIM(topic) <> ''
     ORDER BY topic ASC`
  );

  console.log(`📚 Topics encontrados: ${topicRows.length}. Top ${TOP_N} artículos/topic. Niveles: ${LEVELS.join(', ')}`);

  let totalDone = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const row of topicRows) {
    const topic = String(row.topic || '').trim();
    const articles = await db.all(
      `SELECT id, content, topic FROM articles
       WHERE LOWER(topic) = LOWER(?)
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
      [topic, TOP_N]
    );

    console.log(`\n── Topic "${topic}": ${articles.length} artículos ──`);

    for (const art of articles) {
      const content = String(art.content || '');
      if (!content.trim()) {
        console.warn(`⚠️ Artículo ${art.id} sin contenido, se omite`);
        continue;
      }

      for (const level of LEVELS) {
        if (!FORCE) {
          const exists = await db.get(
            `SELECT id FROM simplified_articles WHERE article_id = ? AND level = ?`,
            [art.id, level]
          );
          if (exists) {
            totalSkipped += 1;
            console.log(`   skip art=${art.id} ${level} (ya existe)`);
            continue;
          }
        }

        try {
          const adapted = await aiService.generateLeveledArticle(content, level);
          await upsertSimplified(art.id, adapted, level);
          totalDone += 1;
          console.log(`   ✅ art=${art.id} ${level} (${adapted.length} chars)`);
        } catch (err) {
          totalErrors += 1;
          console.warn(`   ⚠️ art=${art.id} ${level} IA falló: ${err.message} → fallback texto original`);
          try {
            await upsertSimplified(art.id, content, level);
          } catch (e2) {
            console.error(`   ❌ Fallback DB art=${art.id} ${level}:`, e2.message);
          }
        }

        if (DELAY_MS > 0) await sleep(DELAY_MS);
      }

      if (TOPIC_DELAY_MS > 0) await sleep(TOPIC_DELAY_MS);
    }
  }

  console.log('\n🎯 Resumen');
  console.log(`   Generadas/actualizadas: ${totalDone}`);
  console.log(`   Omitidas (ya existían): ${totalSkipped}`);
  console.log(`   Errores IA (con fallback): ${totalErrors}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ batch-simplify-top-per-topic:', e);
    process.exit(1);
  });
