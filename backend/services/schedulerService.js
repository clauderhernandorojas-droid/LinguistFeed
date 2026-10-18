const schedule = require('node-schedule');
const articleService = require('./articleService');
const scraperService = require('./scraperService');
const db = require('../database/db');
const aiService = require('./aiService'); // Asegúrate de que la ruta sea correcta

/**
 * Utility to strip marketing/tracking query parameters from article URLs
 */
function cleanArticleUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ocid',
      'at_medium',
      'at_campaign'
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    const search = parsed.searchParams.toString();
    return `${parsed.origin}${parsed.pathname}${search ? '?' + search : ''}`;
  } catch {
    return rawUrl;
  }
/**
 * Normaliza las claves de temas para que coincidan exactamente con los 14 slugs de Explore Topics
 */
function normalizeTopic(rawTopic) {
  if (!rawTopic || typeof rawTopic !== 'string') return 'news';
  const t = rawTopic.toLowerCase().trim();
  const map = {
    'technology': 'tech',
    'tech': 'tech',
    'science': 'science',
    'history': 'history',
    'culture': 'culture',
    'pop_culture': 'trends',
    'pop-culture': 'trends',
    'popculture': 'trends',
    'trends': 'trends',
    'movies': 'movies',
    'movies_series': 'movies',
    'movies-series': 'movies',
    'film': 'movies',
    'films': 'movies',
    'cinema': 'movies',
    'gaming': 'gaming',
    'games': 'gaming',
    'travel': 'travel',
    'lifestyle': 'lifestyle',
    'lifeandstyle': 'lifestyle',
    'health': 'health',
    'education': 'edu',
    'edu': 'edu',
    'classroom': 'classroom',
    'business': 'business',
    'news': 'news',
    'world': 'news',
    'global_news': 'news',
    'global-news': 'news'
  };
  return map[t] || t;
}

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
   * Default: Runs once a day at 4:00 AM ('0 4 * * *')
   */
  scheduleArticleFetching() {
    // Frecuencia diaria a las 4:00 AM (configurable mediante ARTICLE_FETCH_CRON)
    const cronSchedule = process.env.ARTICLE_FETCH_CRON || '0 4 * * *';

    const job = schedule.scheduleJob(cronSchedule, async () => {
      console.log(`[${new Date().toISOString()}] Running scheduled article fetching job`);
      
      try {
        await this.runArticleFetchingJob();
        console.log('Scheduled article fetching job completed');
      } catch (error) {
        console.error('Error in scheduled article fetching job:', error.message);
      }
    });
    
    // Store the job
    this.jobs.articleFetching = job;
    
    console.log(`Article fetching job scheduled to run once daily at 4:00 AM (${cronSchedule})`);
    
    // Run the job immediately on startup only if explicitly enabled or allowed
    const initialCheck = this.shouldRunInitialScrape();
    if (initialCheck.shouldRun) {
      console.log(`🚀 Starting initial article fetching job (${initialCheck.reason})...`);
      this.runArticleFetchingJob();
    } else {
      console.log(`⏭️ Initial article fetching job omitted (${initialCheck.reason})`);
    }
  }

  /**
   * Determine whether the immediate initial article fetching job should run on startup.
   * - Omit if DISABLE_INITIAL_SCRAPE is 'true'
   * - Execute if RUN_INITIAL_SCRAPE is 'true'
   * - Omit if NODE_ENV is not 'production' or if RUN_INITIAL_SCRAPE is not true
   * @returns {{ shouldRun: boolean, reason: string }}
   */
  shouldRunInitialScrape() {
    const disableInitial = String(process.env.DISABLE_INITIAL_SCRAPE ?? '').trim().toLowerCase() === 'true';
    if (disableInitial) {
      return { shouldRun: false, reason: 'DISABLE_INITIAL_SCRAPE=true' };
    }

    const runInitial = String(process.env.RUN_INITIAL_SCRAPE ?? '').trim().toLowerCase() === 'true';
    if (runInitial) {
      return { shouldRun: true, reason: 'RUN_INITIAL_SCRAPE=true' };
    }

    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return {
        shouldRun: false,
        reason: `NODE_ENV is '${process.env.NODE_ENV || 'development'}' (omitted when not production unless RUN_INITIAL_SCRAPE=true)`
      };
    }

    return {
      shouldRun: false,
      reason: 'RUN_INITIAL_SCRAPE=true is not set'
    };
  }

  /**
   * Alias for runArticleFetchingJob
   */
  async runInitialArticleFetchingJob() {
    return this.runArticleFetchingJob();
  }

  /**
   * Run the article fetching job immediately
   * @param {number} maxNewArticles - Maximum number of new articles to ingest per cycle (defaults to 5)
   */
  async runArticleFetchingJob(maxNewArticles = parseInt(process.env.MAX_NEW_ARTICLES_PER_CYCLE || '5', 10)) {
    console.log(`Running article fetching job (max new articles: ${maxNewArticles})`);
    
    try {
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      await this.fetchAndProcessArticlesFromRSS(levels, maxNewArticles);
      
      console.log('Article fetching job completed');
    } catch (error) {
      console.error('Error in article fetching job:', error.message);
    }
  }

  /**
   * Fetch and process articles from RSS feeds
   * @param {string|string[]} levelsOrLevel - CEFR level or array of levels
   * @param {number} maxNewArticles - Maximum new articles to ingest in this cycle (default 5, satisfies 3-5 limit)
   */
  async fetchAndProcessArticlesFromRSS(levelsOrLevel = 'B1', maxNewArticles = parseInt(process.env.MAX_NEW_ARTICLES_PER_CYCLE || '5', 10)) {
    try {
      const levels = Array.isArray(levelsOrLevel) ? levelsOrLevel : [levelsOrLevel];
      console.log(`🚀 Fetching RSS articles (levels: [${levels.join(', ')}], limit: ${maxNewArticles} new articles per cycle)`);
      
      // Obtenemos los artículos recolectados de los feeds configurados
      const articlesData = await articleService.fetchAndProcessArticlesFromRSS();
      
      let newArticlesCount = 0;

      for (const articleData of articlesData) {
        try {
          // --- 🛠️ NORMALIZACIÓN DEL TOPIC (Slugs exactos de Explore Topics) ---
          const cleanTopic = normalizeTopic(articleData.category);
          // ----------------------------------

          const cleanUrl = cleanArticleUrl(articleData.url);

          // Verificamos si ya existe el artículo
          const existingArticle = await db.get(
            'SELECT id, content FROM articles WHERE url = ? OR url = ?',
            [cleanUrl, articleData.url]
          );
          
          let articleId;
          let articleContent;
          
          if (!existingArticle) {
            // Límite estricto por corrida para no saturar la base de datos
            if (newArticlesCount >= maxNewArticles) {
              console.log(`🛑 Límite de nuevos artículos por ciclo alcanzado (${maxNewArticles}). Finalizando ingesta de nuevos artículos.`);
              break;
            }

            newArticlesCount++;
            console.log(`📦 Scraping nuevo artículo (${newArticlesCount}/${maxNewArticles}): ${articleData.title}`);
            
            let scrapedText = '';
            let scrapedTitle = '';
            try {
              const scrapedArticle = await scraperService.scrapeArticle(articleData.url);
              scrapedText = scrapedArticle.text || '';
              scrapedTitle = scrapedArticle.title || '';
            } catch (scrapeErr) {
              console.warn(`⚠️ Scraping web falló para ${articleData.url} (${scrapeErr.message}). Utilizando texto provisto por el feed RSS.`);
              scrapedText = (articleData.original_text || '').trim();
            }

            // Si el scraping extrajo muy poco texto pero el RSS tiene más, usamos el del RSS
            if ((!scrapedText || scrapedText.length < 150) && articleData.original_text && articleData.original_text.length >= 150) {
              scrapedText = articleData.original_text.trim();
            }

            if (!scrapedText || scrapedText.length < 100) {
              console.warn(`⚠️ Texto insuficiente (<100 caracteres) para "${articleData.title}". Omitiendo artículo.`);
              newArticlesCount--;
              continue;
            }

            // Priorizamos el titular limpio del RSS con gancho editorial
            const finalTitle = (articleData.title && articleData.title.trim()) || scrapedTitle || 'Untitled Article';

            // Insertamos usando cleanTopic normalizado y cleanUrl
            const result = await db.run(
              'INSERT INTO articles (url, title, topic, content, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
              [cleanUrl, finalTitle, cleanTopic, scrapedText]
            );
            
            articleId = result.lastID;
            articleContent = scrapedText;
            console.log(`✅ Artículo insertado con ID: ${articleId} ("${finalTitle}") [Tema: ${cleanTopic}]`);
          } else {
            articleId = existingArticle.id;
            articleContent = existingArticle.content;
          }

          // --- 🤖 GENERACIÓN DE QUIZ AUTOMÁTICO PARA LOS NIVELES ---
          if (articleContent) {
            for (const level of levels) {
              const existingQuiz = await db.get(
                'SELECT id FROM quizzes WHERE article_id = ? AND level = ?',
                [articleId, level]
              );

              if (!existingQuiz) {
                if (aiService.isMockSchedulerQuiz()) {
                  // Dev: sin OpenRouter; evita 402 y ruido en logs
                } else {
                  console.log(`🧠 Generando Quiz IA para artículo ${articleId} (Nivel ${level})...`);
                  try {
                    await aiService.generateQuiz(articleId, articleContent, level);
                    console.log(`✨ Quiz guardado con éxito (Nivel ${level}).`);
                  } catch (aiError) {
                    console.error(`❌ Error en IA (Quiz Nivel ${level}):`, aiError.message);
                  }
                }
              }
            }
          }
          
          // --- 🗓️ REGISTRO EN ARTÍCULOS DIARIOS ---
          const date = new Date().toISOString().split('T')[0];
          const existingDailyArticle = await db.get(
            'SELECT id FROM daily_articles WHERE date = ? AND article_id = ?',
            [date, articleId]
          );
          
          if (!existingDailyArticle) {
            await db.run(
              'INSERT INTO daily_articles (date, topic, article_id) VALUES (?, ?, ?)',
              [date, cleanTopic, articleId]
            );
            console.log(`📌 Guardado en feed diario bajo el tema: "${cleanTopic}"`);
          }
        } catch (innerError) {
          console.error(`⚠️ Error procesando artículo individual (${articleData.url}):`, innerError.message);
        }
      }
      
      console.log(`🏁 Proceso de ingesta completado. Nuevos artículos agregados: ${newArticlesCount}/${maxNewArticles}`);
    } catch (error) {
      console.error(`🔥 Error crítico en Scheduler:`, error.message);
      throw error;
    }
  }
}

module.exports = new SchedulerService();