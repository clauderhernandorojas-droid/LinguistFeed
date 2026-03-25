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
      
      // Extract title
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   $('meta[property="og:title"]').attr('content') || 
                   'Untitled Article';
      
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
          text: cleanedText
        };
      }
      
      console.log(`Successfully extracted ${mainContent.length} characters`);
      
      // Return the extracted title and text
      return {
        title: textCleaner.cleanText(title),
        text: mainContent
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