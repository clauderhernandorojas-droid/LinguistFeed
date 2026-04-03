const axios = require('axios');
require('dotenv').config();

/**
 * Service for interacting with AI models via OpenRouter API
 */
class AiService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    
    if (!this.apiKey) {
      console.error('OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env file.');
    } else {
      console.log('AiService initialized with OpenRouter API key');
    }
  }

  /**
   * Generate a simplified version of an article for a specific CEFR level
   * with vocabulary extraction
   * 
   * @param {string} text - The original article text
   * @param {string} level - CEFR level (A1, A2, B1, B2, C1, C2)
   * @returns {Promise<Object>} - Object with simplified text, quiz, and vocabulary
   */
async generateSimplifiedArticle(text, level = 'B1', userContext = {}) {
  // Always generate B1 level content regardless of requested level
  // Other levels will be derived algorithmically
  const { interests, difficultWords } = userContext;
  
  // Prepare the personalized prompt
  const interestsList = interests && interests.length > 0 ? `The learner is interested in ${interests.join(' and ')}.` : '';
  const difficultWordsList = difficultWords && difficultWords.length > 0 ? `Avoid using these difficult words if possible: ${difficultWords.join(', ')}.` : '';
  
  const prompt = `
    Simplify this article for a B1 English learner.
    ${interestsList}
    ${difficultWordsList}
    
    Rules for B1 level:
    - Use intermediate vocabulary and grammar structures
    - Use compound sentences with logical connectors
    - Use perfect tenses where appropriate
    - Divide the text into clear paragraphs with a blank line between paragraphs
    - Each paragraph should focus on one main idea
    - Keep paragraphs relatively short (3-5 sentences) for better readability
    
    Original text:
    ${text}
  `;
  
  try {
    console.log(`Simplifying text to B1 level, length: ${text.length} characters`);
    
    // Truncate text if it's too long
    const maxLength = 4000; // Adjust based on model context window
    let truncatedText = text;
    if (text.length > maxLength) {
      console.log(`Text too long (${text.length} chars), truncating to ${maxLength} chars`);
      truncatedText = text.substring(0, maxLength) + '...';
    }
    
    // Prepare request to OpenRouter API
    const requestBody = {
      model: "openai/gpt-4o-mini", // Using a smaller model for faster responses
      messages: [
        {
          role: "system",
          content: `You are an expert English teacher specialized in CEFR levels. Your task is to simplify texts to make them accessible for language learners at B1 level.`
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };
    
    // Call OpenRouter API
    const response = await axios.post(this.apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: 30000 // 30 seconds timeout
    });
    
    // Extract the generated text from the response
    if (response.data && 
        response.data.choices && 
        response.data.choices.length > 0 && 
        response.data.choices[0].message &&
        response.data.choices[0].message.content) {
      
      const generatedText = response.data.choices[0].message.content;
      console.log(`Received response from OpenRouter API, length: ${generatedText.length} characters`);
      
      // Process the response to extract the JSON
      try {
        // Clean up the text to ensure it's valid JSON
        let cleanJson = generatedText.trim();
        
        // If the text is wrapped in markdown code blocks, extract just the JSON
        if (cleanJson.includes("```")) {
          console.log("Detected markdown format, extracting JSON");
          const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
          const match = jsonRegex.exec(cleanJson);
          if (match && match.length >= 2) {
            cleanJson = match[1].trim();
            console.log("JSON extracted from markdown format");
          }
        }
        
        // Parse the JSON
        const jsonResponse = JSON.parse(cleanJson);
        console.log("Successfully parsed JSON response");
        
        return jsonResponse;
        
      } catch (jsonError) {
        console.error('Error parsing JSON from OpenRouter response:', jsonError);
        console.error('Raw response:', generatedText);
        
        // Retry once with a more explicit instruction
        console.error("Error en simplificación, abortando reintento inexistente.");
        throw new Error("No se pudo simplificar el artículo ni generar el quiz.");
      }
      
    } else {
      console.error('Unexpected response structure from OpenRouter API');
      throw new Error('Unexpected response structure from OpenRouter API');
    }
    
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.message);
    
    // Handle specific errors
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout when calling OpenRouter API');
    }
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new Error(`OpenRouter API responded with status code ${error.response.status}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response from OpenRouter API');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw error;
    }
  }
    // Existing implementation...
  }

  /**
   * Generate a list of learning activities for an article
   * 
   * @param {string} text - The original article text
   * @returns {Promise<Array>} - Array of activity objects
   */
  async generateActivities(text) {
    try {
      console.log(`Generating activities for text, length: ${text.length} characters`);
      
      // Prepare request to OpenRouter API
      const requestBody = {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert English teacher specialized in CEFR levels. Your task is to generate different types of learning activities based on the provided text.`
          },
          {
            role: "user",
            content: `Generate a list of learning activities for the following text:\n\n${text}`
          }
        ]
      };
      
      // Call OpenRouter API
      const response = await axios.post(this.apiUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 30000 // 30 seconds timeout
      });
      
      // Extract the generated activities from the response
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const activities = response.data.choices[0].message.content;
        console.log(`Received response from OpenRouter API, activities generated`);
        
        return activities;
      } else {
        console.error('Unexpected response structure from OpenRouter API');
        throw new Error('Unexpected response structure from OpenRouter API');
      }
      
    } catch (error) {
      console.error('Error calling OpenRouter API for activities:', error.message);
      throw error;
    }
  }
  /**
   * Generates a comprehension quiz for an article and saves it to the database
   * @param {number} articleId - The ID of the article in the database
   * @param {string} content - The article content
   * @param {string} level - CEFR level (e.g., 'B1')
   */
  async generateQuiz(articleId, content, level) {
    const db = require('../database/db'); // Importamos la DB aquí

    const prompt = `
      Based on the following article, generate a multiple-choice comprehension question for an English learner at ${level} level.
      
      Respond ONLY with a JSON object in this exact format:
      {
        "question": "The question text",
        "option_a": "First option",
        "option_b": "Second option",
        "option_c": "Third option",
        "correct_option": 0,
        "hint": "A small clue for the student"
      }
      
      Note: correct_option should be 0 for A, 1 for B, or 2 for C.
      
      Article:
      ${content.substring(0, 3000)}
    `;

    try {
      const response = await axios.post(this.apiUrl, {
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an English teacher. You only respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" } // Esto fuerza a la IA a darte JSON
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const quizData = JSON.parse(response.data.choices[0].message.content);

      // Guardar en la base de datos
      await db.run(
        `INSERT INTO quizzes (article_id, level, question, option_a, option_b, option_c, correct_option, hint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          articleId,
          level,
          quizData.question,
          quizData.option_a,
          quizData.option_b,
          quizData.option_c,
          quizData.correct_option,
          quizData.hint
        ]
      );

      return true;
    } catch (error) {
      console.error('Error in generateQuiz:', error.message);
      throw error;
    }
  }
  async ask(prompt, systemRole = "You are a helpful language learning assistant.") {
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'google/gemini-2.0-flash-001', // O el modelo que estés usando
            messages: [
                { role: 'system', content: systemRole },
                { role: 'user', content: prompt }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3000',
                'Content-Type': 'application/json'
            }
        });
  
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Error en AiService.ask:", error.response?.data || error.message);
        throw error;
    }
  }

  async generateQuizFromText(text, level = 'B2') {
    const systemRole = `You are an expert English teacher. 
    Create a 3-question multiple-choice quiz based on the provided text.
    Target level: ${level}.
    Return ONLY a JSON object with this structure:
    {
      "quizzes": [
        {
          "question": "string",
          "options": ["opt1", "opt2", "opt3"],
          "correct_index": 0,
          "hint": "string"
        }
      ]
    }`;

    try {
        // Usamos la función 'ask' que ya existe en tu aiService
        const response = await this.ask(text, systemRole);
        
        // --- LIMPIEZA DE LA RESPUESTA ---
        // Eliminamos posibles bloques de código Markdown (```json o ```)
        const cleanResponse = response.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const parsed = JSON.parse(cleanResponse);
        return parsed.quizzes; // Devolvemos solo el array de preguntas
    } catch (error) {
        console.error("Error generating quiz from text:", error);
        return []; // Devolvemos array vacío si falla
    }
}
}
// Dentro de la clase AiService en backend/services/aiService.j

module.exports = new AiService();