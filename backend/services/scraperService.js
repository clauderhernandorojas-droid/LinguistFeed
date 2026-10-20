const axios = require('axios');
const cheerio = require('cheerio');
const textCleaner = require('../utils/textCleaner');

/**
 * Service for scraping web pages and extracting article content
 */
class ScraperService {
  /**
   * Scrape a webpage and extract the main article content
   * 
   * @param {string} url - The URL of the webpage to scrape
   * @returns {Promise<Object>} - Object containing title and text
   */
  async scrapeArticle(url) {
    try {
      console.log(`Scraping article from URL: ${url}`);
      
      // Headers to mimic a real browser to avoid being blocked
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      };
      
      // Fetch the webpage
      const response = await axios.get(url, { 
        headers,
        timeout: 15000 // 15 seconds timeout
      });
      
      // Parse HTML
      const $ = cheerio.load(response.data);
      
      // Extract title (prioritizing og:title or h1 to avoid nav/menu text often packed in <title>)
      const title = $('meta[property="og:title"]').attr('content')?.trim() || 
                   $('h1').first().text().trim() || 
                   $('title').text().trim() || 
                   'Untitled Article';

      // Extract main cover image (Open Graph, Twitter, JSON-LD, or prominent article image)
      let imageUrl = $('meta[property="og:image"]').attr('content')?.trim() ||
                     $('meta[property="og:image:url"]').attr('content')?.trim() ||
                     $('meta[property="og:image:secure_url"]').attr('content')?.trim() ||
                     $('meta[name="twitter:image"]').attr('content')?.trim() ||
                     $('meta[name="twitter:image:src"]').attr('content')?.trim() ||
                     $('meta[property="twitter:image"]').attr('content')?.trim() ||
                     $('meta[itemprop="image"]').attr('content')?.trim() ||
                     $('meta[name="thumbnail"]').attr('content')?.trim() ||
                     $('link[rel="image_src"]').attr('href')?.trim() ||
                     null;

      // Check JSON-LD structured data if meta tags are missing
      if (!imageUrl) {
        $('script[type="application/ld+json"]').each((_, el) => {
          if (imageUrl) return;
          try {
            const rawJson = $(el).html();
            if (!rawJson) return;
            const parsed = JSON.parse(rawJson);
            const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed['@graph'] || [])];
            for (const item of candidates) {
              if (!item) continue;
              const imgField = item.image || item.thumbnailUrl;
              if (typeof imgField === 'string' && imgField.startsWith('http')) {
                imageUrl = imgField.trim();
                break;
              } else if (Array.isArray(imgField) && typeof imgField[0] === 'string') {
                imageUrl = imgField[0].trim();
                break;
              } else if (imgField && typeof imgField.url === 'string') {
                imageUrl = imgField.url.trim();
                break;
              }
            }
          } catch (_) {}
        });
      }

      if (!imageUrl) {
        const firstImg = $('article figure img, main figure img, article img, main img, .article-content img, .entry-content img, .post-content img')
          .filter((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original-src');
            if (!src) return false;
            const width = parseInt($(el).attr('width') || '100', 10);
            const height = parseInt($(el).attr('height') || '100', 10);
            return width > 80 && height > 80 && !src.includes('tracker') && !src.includes('pixel') && !src.includes('avatar') && !src.includes('icon');
          })
          .first();

        const candidateSrc = firstImg.attr('src') || firstImg.attr('data-src') || firstImg.attr('data-original-src');
        if (candidateSrc) {
          try {
            imageUrl = new URL(candidateSrc, url).href;
          } catch (_) {
            imageUrl = candidateSrc.startsWith('http') ? candidateSrc : null;
          }
        }
      }

      if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        try {
          imageUrl = new URL(imageUrl, url).href;
        } catch (_) {}
      }
      
      // Extract main content
      const mainContent = textCleaner.extractMainContent($);
      
      // If no content found, try the fallback method
      if (!mainContent || mainContent.length < 200) {
        console.log('Main content extraction failed, trying fallback method');
        
        // Extract paragraphs with more than 10 words
        let paragraphs = $('p')
          .map((_, element) => $(element).text().trim())
          .get()
          .filter(text => text.split(' ').length > 10);
        
        console.log(`Found ${paragraphs.length} paragraphs`);
        
        // If no paragraphs found, try with other elements
        if (paragraphs.length === 0) {
          console.log('No paragraphs found, trying with other elements');
          paragraphs = $('div, article, section')
            .map((_, element) => $(element).text().trim())
            .get()
            .filter(text => text.split(' ').length > 20);
          
          console.log(`Found ${paragraphs.length} alternative elements`);
        }
        
        if (paragraphs.length === 0) {
          throw new Error('No useful text content found on the page');
        }
        
        // Join paragraphs with double line breaks
        const extractedText = paragraphs.join('\n\n');
        
        // Clean the text
        const cleanedText = textCleaner.cleanText(extractedText);
        
        console.log(`Successfully extracted ${cleanedText.length} characters using fallback method`);
        
        return {
          title: textCleaner.cleanText(title),
          text: cleanedText,
          imageUrl: imageUrl || null
        };
      }
      
      console.log(`Successfully extracted ${mainContent.length} characters`);
      
      // Return the extracted title, text and image URL
      return {
        title: textCleaner.cleanText(title),
        text: mainContent,
        imageUrl: imageUrl || null
      };
      
    } catch (error) {
      console.error('Error scraping article:', error.message);
      
      // Handle specific errors
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout when scraping article');
      }
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(`Server responded with status code ${error.response.status} when scraping article`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response from server when scraping article');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw error;
      }
    }
  }
  
  /**
   * Process multiple article URLs in parallel
   * 
   * @param {Array} articles - Array of article objects with URLs
   * @param {number} concurrency - Number of concurrent requests
   * @returns {Promise<Array>} - Array of processed articles
   */
  async processArticleBatch(articles, concurrency = 3) {
    console.log(`Processing batch of ${articles.length} articles with concurrency ${concurrency}`);
    
    const results = [];
    
    // Process articles in batches to control concurrency
    for (let i = 0; i < articles.length; i += concurrency) {
      const batch = articles.slice(i, i + concurrency);
      
      console.log(`Processing batch ${i/concurrency + 1} of ${Math.ceil(articles.length/concurrency)}`);
      
      const batchPromises = batch.map(async (article) => {
        try {
          const { title, text } = await this.scrapeArticle(article.url);
          
          return {
            ...article,
            title,
            original_text: text
          };
        } catch (error) {
          console.error(`Error processing article ${article.url}:`, error.message);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out failed articles
      const validResults = batchResults.filter(result => result !== null);
      
      results.push(...validResults);
    }
    
    console.log(`Successfully processed ${results.length} out of ${articles.length} articles`);
    
    return results;
  }
}

module.exports = new ScraperService();