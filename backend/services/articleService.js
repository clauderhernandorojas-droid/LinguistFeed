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
    const parser = new Parser();

    const feeds = {
      tech: 'https://techcrunch.com/feed/',
      science: 'https://www.sciencedaily.com/rss/all.xml',
      news: 'http://feeds.bbci.co.uk/news/world/rss.xml',
      culture: 'https://www.theguardian.com/culture/rss',
      business: 'https://feeds.bbci.co.uk/news/business/rss.xml',
      history: 'https://www.smithsonianmag.com/rss/history/',
      gaming: 'https://feeds.feedburner.com/ign/all',
      trends: 'https://www.wired.com/feed/rss',
      health: 'https://feeds.bbci.co.uk/news/health/rss.xml',
      lifestyle: 'https://www.lifehacker.com/rss'
    };

    const articlesToProcess = [];

    for (const [topic, feedUrl] of Object.entries(feeds)) {
      try {
        console.log(`Fetching RSS feed for topic: ${topic} from ${feedUrl}`);
        const feed = await parser.parseURL(feedUrl);
        const articles = feed.items.slice(0, 3); // Limit to 3 articles per feed
        console.log(`Found ${articles.length} articles for topic: ${topic}`);

        for (const item of articles) {
          articlesToProcess.push({
            id: item.id || item.link, // Assuming the link can be used as a fallback ID
            url: item.link,
            title: item.title,
            category: topic,
            original_text: item.content || item.description // Use content or description
          });
        }
      } catch (error) {
        console.error(`Error fetching RSS feed for topic ${topic}:`, error.message);
        // Continue with the next feed
      }
    }

    console.log(`Total articles to process: ${articlesToProcess.length}`);
    return articlesToProcess;
  }

  // Existing methods...
}

module.exports = new ArticleService();