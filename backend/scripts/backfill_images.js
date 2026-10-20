const { run, get, all } = require('../database/db');
const scraperService = require('../services/scraperService');

async function backfillImages() {
  console.log('🔄 Starting backfill of real article images...');

  // 1. Get recent daily articles missing images
  const dailyArticles = await all(`
    SELECT DISTINCT a.id, a.title, a.url, a.topic
    FROM daily_articles da
    JOIN articles a ON da.article_id = a.id
    WHERE a.image_url IS NULL AND a.url IS NOT NULL AND a.url LIKE 'http%'
    ORDER BY da.id DESC
    LIMIT 50
  `);

  console.log(`Found ${dailyArticles.length} recent daily articles without image_url.`);

  // 2. Also get latest 8 articles per topic without images
  const topics = [
    'science', 'tech', 'history', 'culture', 'trends',
    'movies', 'gaming', 'travel', 'lifestyle', 'health',
    'edu', 'classroom', 'business', 'news'
  ];

  const targetArticlesMap = new Map();
  for (const art of dailyArticles) {
    targetArticlesMap.set(art.id, art);
  }

  for (const topic of topics) {
    const topicArticles = await all(`
      SELECT id, title, url, topic
      FROM articles
      WHERE topic = ? AND image_url IS NULL AND url IS NOT NULL AND url LIKE 'http%'
      ORDER BY id DESC
      LIMIT 6
    `, [topic]);

    for (const art of topicArticles) {
      if (!targetArticlesMap.has(art.id)) {
        targetArticlesMap.set(art.id, art);
      }
    }
  }

  const articlesToProcess = Array.from(targetArticlesMap.values());
  console.log(`📋 Total distinct articles to scrape images for: ${articlesToProcess.length}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < articlesToProcess.length; i++) {
    const art = articlesToProcess[i];
    console.log(`[${i + 1}/${articlesToProcess.length}] (${art.topic}) Scraping: "${art.title.slice(0, 45)}..." -> ${art.url}`);

    try {
      const scraped = await scraperService.scrapeArticle(art.url);
      if (scraped && scraped.imageUrl) {
        await run('UPDATE articles SET image_url = ? WHERE id = ?', [scraped.imageUrl, art.id]);
        console.log(`  ✅ Extracted real image: ${scraped.imageUrl.slice(0, 80)}...`);
        successCount++;
      } else {
        console.log(`  ⚠️ No cover image found in page metadata for ID ${art.id}`);
        failCount++;
      }
    } catch (err) {
      console.warn(`  ❌ Failed to scrape ${art.url}: ${err.message}`);
      failCount++;
    }

    // Small delay between requests to be polite to host servers
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n🎉 Backfill complete! Success: ${successCount}, No image/failed: ${failCount}`);
  
  // Show updated stats
  const withImg = await get('SELECT count(*) as count FROM articles WHERE image_url IS NOT NULL');
  console.log(`Total articles in DB with real image_url now: ${withImg.count}`);
}

backfillImages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error during backfill:', err);
    process.exit(1);
  });
