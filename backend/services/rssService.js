const Parser = require('rss-parser');
const parser = new Parser();

/**
 * Service for fetching and processing RSS feeds
 */
class RssService {
  constructor() {
    this.feeds = [
      // --- NOTICIAS Y NEGOCIOS ---
      { url: 'https://feeds.bbci.co.uk/news/rss.xml', name: 'BBC News', category: 'news' },
      { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', name: 'BBC Business', category: 'business' },
      
      // --- TECNOLOGÍA Y CIENCIA ---
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', name: 'NYT Tech', category: 'tech' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', name: 'NYT Science', category: 'science' },
      { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: 'tech' },
  
      // --- CULTURA, HISTORIA Y FILO (Para el grupo de Adultos) ---
      { url: 'https://www.smithsonianmag.com/rss/history/', name: 'Smithsonian History', category: 'history' },
      { url: 'https://www.newyorker.com/feed/culture', name: 'The New Yorker', category: 'culture' },
      { url: 'https://philosophyforlife.org/blog?format=rss', name: 'Philosophy for Life', category: 'history' }, // Lo mapeamos a historia/filo
  
      // --- GAMING Y CULTURA POP (Para el grupo de Jóvenes) ---
      { url: 'https://www.gamespot.com/feeds/reviews/', name: 'GameSpot', category: 'gaming' },
      { url: 'https://www.rollingstone.com/results.rss', name: 'Rolling Stone', category: 'trends' },
      { url: 'https://www.edsurge.com/news.rss', name: 'EdSurge', category: 'edu' },
      { url: 'https://www.cntraveler.com/feed/rss', name: 'Condé Nast Traveler', category: 'travel' },
      { url: 'https://www.hollywoodreporter.com/t/movies/feed/', name: 'Hollywood Reporter Movies', category: 'movies' },
  
      // --- ESTILO DE VIDA Y SALUD ---
      { url: 'https://feeds.bbci.co.uk/news/health/rss.xml', name: 'BBC Health', category: 'health' },
      { url: 'https://www.lifehacker.com/rss', name: 'Lifehacker', category: 'lifestyle' }
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