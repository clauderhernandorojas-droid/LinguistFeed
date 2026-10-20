const db = require('../database/db');
const rssService = require('./rssService');
const scraperService = require('./scraperService');
const aiService = require('./aiService');
const Parser = require('rss-parser');

/**
 * Service for managing the article pipeline
 */
class ArticleService {
  // Existing methods...

  /**
   * Fetch and process articles from RSS feeds
   * @returns {Promise<Array>} - Array of article data objects
   */
  async fetchAndProcessArticlesFromRSS() {
    const parser = new Parser({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 12000
    });

    // Diccionario curado por categoría (alineado con los 14 temas de Explore Topics)
    const feeds = {
      // 1. Science (divulgación, descubrimientos y futuro)
      science: 'https://www.bbc.com/future/feed.rss',

      // 2. Technology (Wired / The Verge)
      tech: [
        'https://www.wired.com/feed/rss',
        'https://www.theverge.com/rss/index.xml'
      ],

      // 3. History (Smithsonian / BBC HistoryExtra)
      history: [
        'https://www.smithsonianmag.com/rss/history/',
        'https://www.historyextra.com/feed/'
      ],

      // 4. Culture (The Guardian / BBC Culture)
      culture: [
        'https://www.theguardian.com/uk/culture/rss',
        'https://www.bbc.com/culture/feed.rss'
      ],

      // 5. Pop Culture / Trends (Rolling Stone / The Guardian)
      trends: [
        'https://www.rollingstone.com/culture/feed/',
        'https://www.theguardian.com/uk/culture/rss'
      ],

      // 6. Movies & Series (IndieWire)
      movies: 'https://www.indiewire.com/feed/',

      // 7. Gaming (Kotaku / Polygon)
      gaming: [
        'https://kotaku.com/rss',
        'https://www.polygon.com/rss/index.xml'
      ],

      // 8. Travel (Condé Nast Traveler)
      travel: 'https://www.cntraveler.com/feed/rss',

      // 9. Lifestyle & Health (The Guardian Life & Style)
      lifestyle: 'https://www.theguardian.com/uk/lifeandstyle/rss',
      health: 'https://www.theguardian.com/uk/lifeandstyle/rss',

      // 10. Education & Classroom (MindShift KQED / The Hechinger Report)
      edu: [
        'https://ww2.kqed.org/mindshift/feed/',
        'https://hechingerreport.org/feed/'
      ],
      classroom: [
        'https://hechingerreport.org/feed/',
        'https://ww2.kqed.org/mindshift/feed/'
      ],

      // 11. Business (Fast Company)
      business: 'https://www.fastcompany.com/latest/rss',

      // 12. Global News (BBC World News)
      news: 'https://feeds.bbci.co.uk/news/world/rss.xml'
    };

    const articlesToProcess = [];

    for (const [topic, feedConfig] of Object.entries(feeds)) {
      const feedUrls = Array.isArray(feedConfig) ? feedConfig : [feedConfig];

      for (const feedUrl of feedUrls) {
        try {
          console.log(`Fetching RSS feed for topic "${topic}" from ${feedUrl}`);
          const feed = await parser.parseURL(feedUrl);
          const articles = (feed.items || []).slice(0, 3); // Límite de 3 artículos por feed
          console.log(`Found ${articles.length} articles for topic: ${topic}`);

          for (const item of articles) {
            const articleLink = (item.link || item.guid || item.id || '').trim();
            const articleTitle = (item.title || '').trim();

            if (!articleLink || !articleTitle) {
              continue;
            }

            let rssImageUrl = null;
            if (item.enclosure?.url && typeof item.enclosure.url === 'string' && item.enclosure.url.trim().startsWith('http')) {
              rssImageUrl = item.enclosure.url.trim();
            } else if (item['media:content']) {
              const mc = Array.isArray(item['media:content']) ? item['media:content'][0] : item['media:content'];
              const u = mc?.['$']?.url || mc?.url;
              if (u && typeof u === 'string') rssImageUrl = u.trim();
            } else if (item['media:thumbnail']) {
              const mt = Array.isArray(item['media:thumbnail']) ? item['media:thumbnail'][0] : item['media:thumbnail'];
              const u = mt?.['$']?.url || mt?.url;
              if (u && typeof u === 'string') rssImageUrl = u.trim();
            } else if (item.image?.url && typeof item.image.url === 'string') {
              rssImageUrl = item.image.url.trim();
            } else {
              const htmlBlob = item['content:encoded'] || item.content || item.description || '';
              const m = htmlBlob.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
              if (m && m[1]) rssImageUrl = m[1].trim();
            }

            articlesToProcess.push({
              id: item.id || articleLink,
              url: articleLink,
              title: articleTitle,
              category: topic,
              image_url: rssImageUrl,
              original_text: (item.content || item['content:encoded'] || item.contentSnippet || item.description || '').trim()
            });
          }
        } catch (error) {
          console.error(`Error fetching RSS feed for topic ${topic} (${feedUrl}):`, error.message);
          // Continue with next feed
        }
      }
    }

    console.log(`Total articles collected from RSS: ${articlesToProcess.length}`);
    return articlesToProcess;
  }

  // Existing methods...
}

module.exports = new ArticleService();