const { run, get, all } = require('../database/db');
const scraperService = require('../services/scraperService');

/**
 * Backfill exhaustivo y seguro de imágenes de artículos
 * Procesa todos los artículos sin imagen con throttling de 1.8 segundos para evitar bloqueos 429/403.
 */
async function backfillAllArticleImages() {
  console.log('🔄 Iniciando backfill exhaustivo de imágenes de artículos con throttling...');

  // Tomamos todos los artículos con URL válida que aún no tienen imagen de portada
  const articlesToProcess = await all(`
    SELECT id, title, url, topic
    FROM articles
    WHERE image_url IS NULL 
      AND url IS NOT NULL 
      AND (url LIKE 'http://%' OR url LIKE 'https://%')
    ORDER BY id DESC
  `);

  const total = articlesToProcess.length;
  console.log(`📋 Total de artículos pendientes de procesar: ${total}`);

  if (total === 0) {
    console.log('✨ Todos los artículos ya cuentan con imagen de portada asignada.');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const art = articlesToProcess[i];
    const progress = `[${i + 1}/${total}] (${Math.round(((i + 1) / total) * 100)}%)`;
    console.log(`${progress} [ID:${art.id}] [${art.topic}] "${(art.title || '').slice(0, 40)}..."`);

    try {
      const scraped = await scraperService.scrapeArticle(art.url);
      if (scraped && scraped.imageUrl && String(scraped.imageUrl).startsWith('http')) {
        await run('UPDATE articles SET image_url = ? WHERE id = ?', [scraped.imageUrl.trim(), art.id]);
        console.log(`  ✅ Imagen extraída y guardada: ${scraped.imageUrl.slice(0, 75)}...`);
        successCount++;
      } else {
        console.log(`  ⚠️ Sin metadato de imagen de portada para ID: ${art.id}`);
        failCount++;
      }
    } catch (err) {
      console.warn(`  ❌ Error al procesar ${art.url}: ${err.message}`);
      failCount++;
    }

    // Retardo obligatorio de 1.8 segundos entre peticiones para proteger contra 429/403
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 1800));
    }

    // Reporte periódico cada 25 artículos
    if ((i + 1) % 25 === 0) {
      const elapsedMins = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`\n📊 Hito de progreso: ${i + 1}/${total} artículos procesados en ${elapsedMins} min (Éxitos: ${successCount}, Sin imagen/Error: ${failCount})\n`);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n🎉 Backfill completado en ${totalElapsed} minutos.`);
  console.log(`   - Nuevas imágenes guardadas: ${successCount}`);
  console.log(`   - Sin imagen o error: ${failCount}`);

  const totalWithImg = await get('SELECT count(*) as count FROM articles WHERE image_url IS NOT NULL');
  console.log(`✨ Total de artículos con imagen en la base de datos ahora: ${totalWithImg.count}`);
}

backfillAllArticleImages()
  .then(() => {
    console.log('✅ Proceso terminado exitosamente.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error fatal en backfill:', err);
    process.exit(1);
  });
