const Parser = require('rss-parser');
const parser = new Parser();

/**
 * Service for fetching and processing RSS feeds
 */
class RssService {
  constructor() {
    // Default RSS feeds
    this.feeds = [
      {
        url: 'https://feeds.bbci.co.uk/news/rss.xml',
        name: 'BBC News',
        category: 'News'
      },
      {
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
        name: 'New York Times - Science',
        category: 'Science'
      },
      {
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
        name: 'New York Times - Technology',
        category: 'Technology'
      },
      {
        url: 'https://feeds.bbci.co.uk/news/health/rss.xml',
        name: 'BBC Health',
        category: 'Health'
      },
      {
        url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
        name: 'BBC Business',
        category: 'Business'
      }
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