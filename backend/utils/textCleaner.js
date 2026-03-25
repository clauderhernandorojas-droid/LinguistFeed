/**
 * Utility functions for cleaning and processing text
 */

/**
 * Cleans text extracted from web pages
 * - Removes extra whitespace
 * - Removes special characters
 * - Normalizes line breaks
 * - Removes HTML tags if any remain
 * 
 * @param {string} text - The text to clean
 * @returns {string} - The cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  
  // Remove any remaining HTML tags
  let cleaned = text.replace(/<[^>]*>/g, '');
  
  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Replace multiple line breaks with double line breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove non-printable characters
  cleaned = cleaned.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Normalize quotes
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Extracts the main content from a webpage
 * Removes navigation, footers, ads, etc.
 * 
 * @param {string} html - The HTML content
 * @param {object} $ - Cheerio instance
 * @returns {string} - The extracted main content
 */
function extractMainContent($) {
  // Remove common non-content elements
  $('nav, header, footer, aside, .ads, .comments, .related, .sidebar, script, style, meta, link').remove();
  
  // Try to find the main content container
  const mainSelectors = [
    'article', 
    '.article', 
    '.post', 
    '.content', 
    'main', 
    '#main', 
    '.main-content',
    '.article-content',
    '.post-content'
  ];
  
  let mainContent = '';
  
  // Try each selector until we find content
  for (const selector of mainSelectors) {
    const content = $(selector).text().trim();
    if (content && content.length > 200) {
      mainContent = content;
      break;
    }
  }
  
  // If no main content found, extract paragraphs with substantial text
  if (!mainContent) {
    const paragraphs = $('p')
      .map((_, element) => $(element).text().trim())
      .get()
      .filter(text => text.split(' ').length > 10);
    
    mainContent = paragraphs.join('\n\n');
  }
  
  return cleanText(mainContent);
}

/**
 * Truncates text to a maximum length while preserving whole sentences
 * 
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - The truncated text
 */
function truncateToSentence(text, maxLength = 5000) {
  if (!text || text.length <= maxLength) return text;
  
  // Find the last sentence boundary before maxLength
  const truncated = text.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf('.');
  
  if (lastSentence === -1) {
    // If no sentence boundary found, truncate at maxLength
    return truncated + '...';
  }
  
  // Truncate at the last sentence boundary
  return text.substring(0, lastSentence + 1);
}

module.exports = {
  cleanText,
  extractMainContent,
  truncateToSentence
};