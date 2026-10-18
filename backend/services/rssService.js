const Parser = require('rss-parser');
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  },
  timeout: 12000
});

/**
 * Service for fetching and processing RSS feeds
 */
class RssService {
  constructor() {
    this.feeds = [
      // --- CULTURA, ESTILO DE VIDA Y DIVULGACIÓN (Titulares atractivos y ganchos editoriales) ---
      { url: 'https://www.theguardian.com/uk/culture/rss', name: 'The Guardian Culture', category: 'culture' },
      { url: 'https://www.theguardian.com/uk/lifeandstyle/rss', name: 'The Guardian Lifestyle', category: 'lifestyle' },
      { url: 'https://www.bbc.com/culture/feed.rss', name: 'BBC Culture', category: 'culture' },
      { url: 'https://www.bbc.com/future/feed.rss', name: 'BBC Future (Divulgación y Ciencia)', category: 'science' },
      { url: 'https://www.wired.com/feed/rss', name: 'Wired (Ciencia e Innovación)', category: 'tech' },
      { url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml', name: 'BBC Entertainment & Arts', category: 'history' },
      { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC World News', category: 'news' },
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business', category: 'business' },
  
      // --- HISTORIA Y PENSAMIENTO ---
      { url: 'https://www.historyextra.com/feed/', name: 'HistoryExtra (BBC History Mag)', category: 'history' },
      { url: 'https://historyguild.org/feed/', name: 'History Guild', category: 'history' },
      { url: 'https://www.newyorker.com/feed/culture', name: 'The New Yorker Culture', category: 'culture' },
  
      // --- GAMING, TENDENCIAS Y VIAJES ---
      { url: 'https://feeds.feedburner.com/ign/all', name: 'IGN Gaming', category: 'gaming' },
      { url: 'https://www.cntraveler.com/feed/rss', name: 'Condé Nast Traveler', category: 'travel' },
      { url: 'https://www.hollywoodreporter.com/t/movies/feed/', name: 'Hollywood Reporter Movies', category: 'movies' },
      { url: 'https://hechingerreport.org/feed/', name: 'The Hechinger Report', category: 'edu' }
    ];
  }

  /**
   * Add a new RSS feed to the list
   * 
   * @param {string} url - The URL of the RSS feed
   * @param {string} name - The name of the feed
   * @param {string} category - The category of the feed
   */
  addFeed(url, name, category) {
    this.feeds.push({ url, name, category });
  }

  /**
   * Fetch a single RSS feed
   * 
   * @param {string} url - The URL of the RSS feed
   * @returns {Promise<Array>} - Array of feed items
   */
  async fetchFeed(url) {
    try {
      console.log(`Fetching RSS feed: ${url}`);
      const feed = await parser.parseURL(url);
      
      console.log(`Fetched ${feed.items.length} items from ${feed.title || url}`);
      
      return feed.items;
    } catch (error) {
      console.error(`Error fetching RSS feed ${url}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch all configured RSS feeds
   * 
   * @returns {Promise<Array>} - Array of feed items with source information
   */
  async fetchAllFeeds() {
    try {
      console.log(`Fetching ${this.feeds.length} RSS feeds...`);
      
      const feedPromises = this.feeds.map(async (feed) => {
        const items = await this.fetchFeed(feed.url);
        
        // Add source information to each item
        return items.map(item => ({
          ...item,
          source: feed.name,
          category: feed.category
        }));
      });
      
      // Wait for all feeds to be fetched
      const results = await Promise.all(feedPromises);
      
      // Flatten the array of arrays
      const allItems = results.flat();
      
      console.log(`Fetched a total of ${allItems.length} items from all feeds`);
      
      return allItems;
    } catch (error) {
      console.error('Error fetching all RSS feeds:', error.message);
      return [];
    }
  }

  /**
   * Extract article URLs from RSS feed items
   * 
   * @param {Array} items - Array of RSS feed items
   * @returns {Array} - Array of objects with URL and metadata
   */
  extractArticleUrls(items) {
    return items.map(item => ({
      url: item.link,
      title: item.title,
      source: item.source,
      category: item.category,
      pubDate: item.pubDate || item.isoDate || new Date().toISOString()
    }));
  }

  /**
   * Get new articles from all feeds
   * 
   * @returns {Promise<Array>} - Array of article URLs with metadata
   */
  async getNewArticles() {
    try {
      const feedItems = await this.fetchAllFeeds();
      const articles = this.extractArticleUrls(feedItems);
      
      console.log(`Extracted ${articles.length} article URLs from feeds`);
      
      return articles;
    } catch (error) {
      console.error('Error getting new articles:', error.message);
      return [];
    }
  }
}

module.exports = new RssService();