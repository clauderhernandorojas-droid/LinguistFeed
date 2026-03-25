const db = require('../database/db');
const articleService = require('./articleService');
const aiService = require('./aiService');
const schedule = require('node-schedule');

/**
 * Service for managing daily articles
 */
class DailyArticleService {
  /**
   * Get today's daily articles
   * 
   * @returns {Promise<Array>} - Array of today's daily articles
   */
  async getTodaysDailyArticles() {
    const date = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const dailyArticles = await db.all(
      'SELECT * FROM daily_articles WHERE date = ?',
      [date]
    );
    
    // If no daily articles exist for today, generate them
    if (dailyArticles.length === 0) {
      console.log('No daily articles found for today. Generating new articles...');
      return await this.generateDailyArticles();
    }
    
    return dailyArticles;
  }
  constructor() {
    this.scheduleDailyArticleSelection();
  }

  /**
   * Schedule the daily article selection to run once per day
   */
  scheduleDailyArticleSelection() {
    schedule.scheduleJob('0 0 * * *', async () => {
      console.log('Running daily article selection...');
      await this.selectDailyArticles();
    });
  }

  /**
   * Select daily articles for each topic and store them in the database
   */
  async selectDailyArticles() {
    const topics = ['technology', 'science', 'world', 'culture'];
    
    for (const topic of topics) {
      const recentArticles = await this.getRecentArticlesByTopic(topic);
      if (recentArticles.length > 0) {
        const selectedArticle = this.selectRandomArticle(recentArticles);
await this.storeDailyArticle(selectedArticle.id, topic); // Use the correct ID from the articles table
      }
    }
  }

  /**
   * Get recent articles for a specific topic
   * 
   * @param {string} topic - The topic to filter articles
   * @returns {Promise<Array>} - Array of recent articles
   */
  async getRecentArticlesByTopic(topic) {
    return await db.all(
      'SELECT * FROM articles WHERE topic = ? ORDER BY created_at DESC LIMIT 10',
      [topic]
    );
  }

  /**
   * Select a random article from the list
   * 
   * @param {Array} articles - List of articles
   * @returns {Object} - Selected article
   */
  selectRandomArticle(articles) {
    const randomIndex = Math.floor(Math.random() * articles.length);
    return articles[randomIndex];
  }

  /**
   * Store the selected daily article in the database
   * 
   * @param {number} articleId - ID of the selected article
   * @param {string} topic - Topic of the article
   * @returns {Promise<void>}
   */
  async storeDailyArticle(articleId, topic) {
    const date = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    await db.run(
      'INSERT INTO daily_articles (date, topic, article_id) VALUES (?, ?, ?)',
      [date, topic, articleId]
    );
    console.log(`Stored daily article for topic "${topic}" with article ID ${articleId}`);
  }
  
  /**
   * Generate daily articles if none exist for today
   * 
   * @returns {Promise<Array>} - Array of generated daily articles
   */
  async generateDailyArticles() {
    console.log('Generating daily articles...');
    
    // Try to fetch articles from RSS feeds first
    try {
      const articlesToProcess = await articleService.fetchAndProcessArticlesFromRSS();
      
      if (articlesToProcess.length > 0) {
        console.log(`Found ${articlesToProcess.length} articles from RSS feeds`);
        
        // Process and store articles
        const dailyArticles = [];
        
        for (const articleData of articlesToProcess) {
          try {
            // Check if article already exists in the database
            const existingArticle = await db.get(
              'SELECT id FROM articles WHERE url = ?',
              [articleData.url]
            );
            
            let articleId;
            
            if (existingArticle) {
              articleId = existingArticle.id;
            } else {
              // Insert new article
              const result = await db.run(
                'INSERT INTO articles (url, title, topic, content) VALUES (?, ?, ?, ?)',
                [articleData.url, articleData.title, articleData.category, articleData.original_text]
              );
              articleId = result.lastID;
            }
            
            // Store as daily article
            await this.storeDailyArticle(articleId, articleData.category);
            
            // Add to result array
            dailyArticles.push({
              topic: articleData.category,
              article_id: articleId
            });
            
            // Only process one article per topic
            if (dailyArticles.length >= 4) {
              break;
            }
          } catch (error) {
            console.error(`Error processing article ${articleData.url}:`, error.message);
          }
        }
        
        if (dailyArticles.length > 0) {
          return dailyArticles;
        }
      }
    } catch (error) {
      console.error('Error fetching articles from RSS:', error.message);
    }
    
    // If no articles from RSS or processing failed, generate fallback articles
    return await this.generateFallbackArticles();
  }
  
  /**
   * Generate fallback articles using AI when no RSS articles are available
   * 
   * @returns {Promise<Array>} - Array of generated daily articles
   */
  async generateFallbackArticles() {
    console.log('Generating fallback articles using AI...');
    
    const topics = ['technology', 'science', 'world', 'culture'];
    const dailyArticles = [];
    
    for (const topic of topics) {
      try {
        // Generate a title based on the topic
        const title = `Latest Developments in ${topic.charAt(0).toUpperCase() + topic.slice(1)}`;
        
        // Generate content for the article using AI
        const content = await this.generateArticleContent(topic);
        
        // Insert the article into the articles table
        const result = await db.run(
          'INSERT INTO articles (url, title, topic, content) VALUES (?, ?, ?, ?)',
          [`https://linguistfeed.com/generated/${topic}-${Date.now()}`, title, topic, content]
        );
        
        const articleId = result.lastID;
        
        // Store as daily article
        await this.storeDailyArticle(articleId, topic);
        
        // Add to result array
        dailyArticles.push({
          topic: topic,
          article_id: articleId
        });
      } catch (error) {
        console.error(`Error generating fallback article for topic ${topic}:`, error.message);
      }
    }
    
    return dailyArticles;
  }
  
  /**
   * Generate article content using AI
   * 
   * @param {string} topic - The topic for the article
   * @returns {Promise<string>} - Generated article content
   */
  async generateArticleContent(topic) {
    // Sample content for each topic in case AI generation fails
    const fallbackContent = {
      technology: "Recent advancements in technology have revolutionized how we interact with the digital world. From artificial intelligence to quantum computing, innovations continue to shape our future. Companies are investing heavily in research and development to stay ahead in this rapidly evolving landscape.",
      science: "Scientists have made remarkable discoveries that expand our understanding of the universe. Research in fields like genetics, astronomy, and physics continues to unlock mysteries and open new possibilities. These findings have significant implications for medicine, energy, and our comprehension of natural phenomena.",
      world: "Global events are reshaping international relations and policies. Countries are addressing challenges like climate change, economic development, and public health through collaborative efforts. These developments highlight the interconnected nature of our world and the importance of cooperation.",
      culture: "Cultural expressions through art, music, and literature reflect the diversity and creativity of human experience. Traditional and contemporary forms coexist, influencing each other and evolving with societal changes. These cultural manifestations provide insights into our shared humanity and unique perspectives."
    };
    
    try {
      // In a real implementation, this would use aiService to generate content
      // For now, we'll use the fallback content
      return fallbackContent[topic] || "This is a generated article about an interesting topic.";
    } catch (error) {
      console.error(`Error generating article content for topic ${topic}:`, error.message);
      return fallbackContent[topic] || "This is a generated article about an interesting topic.";
    }
  }
}

module.exports = new DailyArticleService();