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

    // Fuentes curadas con ganchos editoriales atractivos, cultura, divulgación y estilo de vida
    const feeds = {
      culture: [
        'https://www.theguardian.com/uk/culture/rss',
        'https://www.bbc.com/culture/feed.rss'
      ],
      lifestyle: 'https://www.theguardian.com/uk/lifeandstyle/rss',
      tech: 'https://www.wired.com/feed/rss',
      science: 'https://www.bbc.com/future/feed.rss',
      news: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      trends: 'https://www.wired.com/feed/rss',
      history: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
      health: 'https://www.theguardian.com/uk/lifeandstyle/rss',
      business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
      gaming: 'https://feeds.feedburner.com/ign/all',
      travel: 'https://www.cntraveler.com/feed/rss',
      movies: 'https://www.hollywoodreporter.com/t/movies/feed/',
      edu: 'https://hechingerreport.org/feed/'
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

            articlesToProcess.push({
              id: item.id || articleLink,
              url: articleLink,
              title: articleTitle,
              category: topic,
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