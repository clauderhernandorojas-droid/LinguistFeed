const schedule = require('node-schedule');
const articleService = require('./articleService');
const scraperService = require('./scraperService');
const db = require('../database/db');
const aiService = require('./aiService'); // Asegúrate de que la ruta sea correcta

/**
 * Service for scheduling background jobs
 */
class SchedulerService {
  constructor() {
    this.jobs = {};
  }

  /**
   * Start the scheduler
   */
  start() {
    console.log('Starting scheduler service...');
    
    // Schedule article fetching job
    this.scheduleArticleFetching();
    
    console.log('Scheduler service started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('Stopping scheduler service...');
    
    // Cancel all jobs
    Object.values(this.jobs).forEach(job => job.cancel());
    
    console.log('Scheduler service stopped');
  }

  /**
   * Schedule article fetching job
   */
  scheduleArticleFetching() {
    // Schedule job to run every 6 hours
    // Cron format: second minute hour day-of-month month day-of-week
    const job = schedule.scheduleJob('0 0 */6 * * *', async () => {
      console.log('Running scheduled article fetching job');
      
      try {
        // Process articles for different CEFR levels
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        
        for (const level of levels) {
          console.log(`Processing articles for level ${level}`);
          
          // Fetch and process articles from RSS
          await this.fetchAndProcessArticlesFromRSS(level);
          
          // Wait a bit between levels to avoid overwhelming the AI service
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        console.log('Scheduled article fetching job completed');
      } catch (error) {
        console.error('Error in scheduled article fetching job:', error.message);
      }
    });
    
    // Store the job
    this.jobs.articleFetching = job;
    
    console.log('Article fetching job scheduled to run every 6 hours');
    
    // Run the job immediately on startup
    this.runArticleFetchingJob();
  }

  /**
   * Run the article fetching job immediately
   */
  async runArticleFetchingJob() {
    console.log('Running initial article fetching job');
    
    try {
      // Process articles for different CEFR levels
      // Start with just B1 level for the initial run to populate the database quickly
      await this.fetchAndProcessArticlesFromRSS('B1');
      
      console.log('Initial article fetching job completed');
    } catch (error) {
      console.error('Error in initial article fetching job:', error.message);
    }
  }

  /**
   * Fetch and process articles from RSS feeds
   * @param {string} level - CEFR level
   */
  async fetchAndProcessArticlesFromRSS(level) {
    try {
      console.log(`Fetching and processing RSS articles for level ${level}`);
      
      // Get articles from RSS feeds
      const articlesData = await articleService.fetchAndProcessArticlesFromRSS();
      
      // Process each article
      for (const articleData of articlesData) {
        try {
          // Check if the article already exists in the database
          const existingArticle = await db.get(
            'SELECT id, content FROM articles WHERE url = ?',
            [articleData.url]
          );
          
          let articleId;
          let articleContent;
          
          if (!existingArticle) {
            console.log(`Article with URL ${articleData.url} not found in database, scraping and inserting`);
            
            // Scrape the article content
            const scrapedArticle = await scraperService.scrapeArticle(articleData.url);
            
            // Insert the article into the database
            const result = await db.run(
              'INSERT INTO articles (url, title, topic, content, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [
                articleData.url,
                scrapedArticle.title || articleData.title,
                articleData.category,
                scrapedArticle.text
              ]
            );
            
            articleId = result.id;
            articleContent = scrapedArticle.text;
            console.log(`Inserted article with ID ${articleId}`);
          } else {
            articleId = existingArticle.id;
            articleContent = existingArticle.content;
            console.log(`Article with URL ${articleData.url} already exists with ID ${articleId}`);
          }

          // --- 🤖 INICIO DE GENERACIÓN DE QUIZ AUTOMÁTICO ---
          // Verificamos si ya existe un quiz para este artículo y nivel
          const existingQuiz = await db.get(
            'SELECT id FROM quizzes WHERE article_id = ? AND level = ?',
            [articleId, level]
          );

          if (!existingQuiz && articleContent) {
            console.log(`🤖 Generating AI quiz for article ${articleId} at level ${level}...`);
            try {
              // Llamamos al servicio de IA para generar y GUARDAR el quiz
              const aiService = require('./aiService'); // Lo cargamos aquí para evitar problemas de carga circular
              await aiService.generateQuiz(articleId, articleContent, level);
              console.log(`✅ Quiz generated and saved for article ${articleId}`);
            } catch (aiError) {
              console.error(`❌ Error generating quiz for article ${articleId}:`, aiError.message);
            }
          }
          // --- 🤖 FIN DE GENERACIÓN DE QUIZ ---
          
          // Check if this article is already in daily_articles for today
          const date = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
          const existingDailyArticle = await db.get(
            'SELECT id FROM daily_articles WHERE date = ? AND article_id = ?',
            [date, articleId]
          );
          
          if (!existingDailyArticle) {
            // Store the article in daily_articles
            await db.run(
              'INSERT INTO daily_articles (date, topic, article_id) VALUES (?, ?, ?)',
              [date, articleData.category, articleId]
            );
            
            console.log(`Stored daily article for topic "${articleData.category}" with article ID ${articleId}`);
          } else {
            console.log(`Article with ID ${articleId} already exists in daily_articles for today`);
          }
        } catch (error) {
          console.error(`Error processing article ${articleData.url}:`, error.message);
        }
      }
      
      console.log(`Finished processing RSS articles for level ${level}`);
    } catch (error) {
      console.error(`Error fetching and processing RSS articles for level ${level}:`, error.message);
      throw error;
    }
  }
}

module.exports = new SchedulerService();