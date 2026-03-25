/**
 * Utility for adjusting text difficulty levels without using AI
 * Used to derive different CEFR level texts from a B1 base version
 */

/**
 * Makes text simpler (B1 -> A2)
 * 
 * @param {string} text - The B1 level text to simplify
 * @returns {string} - A2 level text
 */
function makeSimpler(text) {
  // Split text into sentences
  const sentences = splitIntoSentences(text);
  
  // Process each sentence to make it simpler
  const simplifiedSentences = sentences.map(sentence => {
    // Split long sentences
    let processed = splitLongSentence(sentence);
    
    // Replace complex words with simpler alternatives
    processed = replaceComplexWords(processed);
    
    // Remove unnecessary modifiers and clauses
    processed = removeComplexModifiers(processed);
    
    return processed;
  });
  
  // Join sentences back together
  return simplifiedSentences.join(' ');
}

/**
 * Makes text more complex (B1 -> B2)
 * 
 * @param {string} text - The B1 level text to make more complex
 * @returns {string} - B2 level text
 */
function makeHarder(text) {
  // Split text into sentences
  const sentences = splitIntoSentences(text);
  
  // Process each sentence to make it more complex
  const complexSentences = sentences.map(sentence => {
    // Combine simple sentences
    let processed = combineSimpleSentences(sentence);
    
    // Replace simple words with more advanced alternatives
    processed = replaceSimpleWords(processed);
    
    // Add appropriate modifiers and clauses
    processed = addModifiers(processed);
    
    return processed;
  });
  
  // Join sentences back together
  return complexSentences.join(' ');
}

/**
 * Split text into sentences
 * 
 * @param {string} text - Text to split
 * @returns {Array} - Array of sentences
 */
function splitIntoSentences(text) {
  // Basic sentence splitting - can be improved with more sophisticated regex
  return text.split(/(?<=[.!?])\s+/);
}

/**
 * Split long sentences into shorter ones
 * 
 * @param {string} sentence - Long sentence to split
 * @returns {string} - Multiple shorter sentences
 */
function splitLongSentence(sentence) {
  // If sentence is already short, return as is
  if (sentence.split(' ').length < 15) {
    return sentence;
  }
  
  // Look for conjunction points to split the sentence
  const conjunctions = [', and ', ', but ', ', so ', ', because '];
  
  for (const conj of conjunctions) {
    if (sentence.includes(conj)) {
      // Replace conjunction with period and capitalize next word
      const parts = sentence.split(conj);
      if (parts.length > 1) {
        const firstPart = parts[0] + '.';
        const secondPart = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        return `${firstPart} ${secondPart}`;
      }
    }
  }
  
  return sentence;
}

/**
 * Replace complex words with simpler alternatives
 * 
 * @param {string} text - Text containing complex words
 * @returns {string} - Text with simpler words
 */
function replaceComplexWords(text) {
  // Dictionary of complex words and their simpler alternatives
  const wordMap = {
    'utilize': 'use',
    'purchase': 'buy',
    'obtain': 'get',
    'sufficient': 'enough',
    'demonstrate': 'show',
    'require': 'need',
    'comprehend': 'understand',
    'approximately': 'about',
    'numerous': 'many',
    'commence': 'start',
    'terminate': 'end',
    'subsequently': 'later',
    'nevertheless': 'still',
    'therefore': 'so',
    'furthermore': 'also'
  };
  
  // Replace each complex word with its simpler alternative
  let result = text;
  for (const [complex, simple] of Object.entries(wordMap)) {
    const regex = new RegExp(`\\b${complex}\\b`, 'gi');
    result = result.replace(regex, simple);
  }
  
  return result;
}

/**
 * Remove complex modifiers and clauses
 * 
 * @param {string} text - Text with complex modifiers
 * @returns {string} - Simplified text
 */
function removeComplexModifiers(text) {
  // Remove parenthetical expressions
  let result = text.replace(/\([^)]*\)/g, '');
  
  // Remove phrases between commas that might be non-essential
  result = result.replace(/,\s*[^,;.!?]{1,20}(?=(,|;|\.|\?|\!))/g, '');
  
  return result.trim();
}

/**
 * Combine simple sentences into more complex ones
 * 
 * @param {string} sentence - Simple sentence
 * @returns {string} - More complex sentence
 */
function combineSimpleSentences(sentence) {
  // This is a placeholder - in a real implementation, we would need
  // to look at surrounding sentences to combine them
  return sentence;
}

/**
 * Replace simple words with more advanced alternatives
 * 
 * @param {string} text - Text containing simple words
 * @returns {string} - Text with more advanced words
 */
function replaceSimpleWords(text) {
  // Dictionary of simple words and their more complex alternatives
  const wordMap = {
    'use': 'utilize',
    'buy': 'purchase',
    'get': 'obtain',
    'enough': 'sufficient',
    'show': 'demonstrate',
    'need': 'require',
    'understand': 'comprehend',
    'about': 'approximately',
    'many': 'numerous',
    'start': 'commence',
    'end': 'terminate',
    'later': 'subsequently',
    'still': 'nevertheless',
    'so': 'therefore',
    'also': 'furthermore'
  };
  
  // Replace each simple word with its more complex alternative
  let result = text;
  for (const [simple, complex] of Object.entries(wordMap)) {
    const regex = new RegExp(`\\b${simple}\\b`, 'gi');
    result = result.replace(regex, complex);
  }
  
  return result;
}

/**
 * Add appropriate modifiers and clauses to make text more complex
 * 
 * @param {string} text - Simple text
 * @returns {string} - Text with added modifiers
 */
function addModifiers(text) {
  // This is a simplified implementation
  // In a real system, we would need more sophisticated NLP
  return text;
}

module.exports = {
  makeSimpler,
  makeHarder
};