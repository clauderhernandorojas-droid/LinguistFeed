/**
 * Test script to verify the /daily-reading endpoint
 * 
 * Run with: node test-daily-reading.js
 */

const http = require('http');
const articleService = require('./services/articleService');
const db = require('./database/db');

async function testDailyReadingEndpoint() {
  console.log('Testing /daily-reading endpoint...');
  
  try {
    // 1. Create a test article with vocabulary
    console.log('Creating test article with vocabulary...');
    
    // Sample article data
    const testArticle = {
      title: "Test Article for Daily Reading",
      source: 'Test Source',
      url: `https://test.example.com/article-${Date.now()}`,
      category: 'Test',
      original_text: "This is a test article for the daily reading endpoint."
    };
    
    // Sample simplified text
    const simplifiedText = "This is a simplified test article for the daily reading endpoint.";
    
    // Sample vocabulary
    const vocabulary = [
      {
        word: "endpoint",
        definition: "A point at which a service or system can be accessed",
        example: "The API provides several endpoints for different types of data."
      },
      {
        word: "simplified",
        definition: "Made simpler or easier to understand",
        example: "The simplified version of the text is easier for beginners to read."
      }
    ];
    
    // Sample quiz
    const quiz = {
      question: "What is this article about?",
      options: ["Testing the daily reading endpoint", "Climate change", "Learning English"],
      correct_index: 0,
      hint: "T_st_ng"
    };
    
    // 2. Store the test data in the database
    console.log('Storing test data in database...');
    
    // Store the article
    const articleId = await articleService.storeArticle(testArticle);
    console.log(`Test article stored with ID: ${articleId}`);
    
    // Store the simplified version
    const level = 'B1';
    const simplifiedId = await articleService.storeSimplifiedArticle(articleId, level, simplifiedText);
    console.log(`Simplified version stored with ID: ${simplifiedId}`);
    
    // Store vocabulary
    const vocabIds = await articleService.storeVocabulary(articleId, level, vocabulary);
    console.log(`Stored ${vocabIds.length} vocabulary items with IDs: ${vocabIds.join(', ')}`);
    
    // Store quiz
    const quizId = await articleService.storeQuiz(articleId, level, quiz);
    console.log(`Quiz stored with ID: ${quizId}`);
    
    // 3. Create a test user if needed
    console.log('Ensuring test user exists...');
    
    // Check if test user exists
    const testUser = await db.get('SELECT id FROM users WHERE id = 1');
    
    if (!testUser) {
      console.log('Creating test user...');
      await db.run(
        'INSERT INTO users (id, email, password_hash, level) VALUES (?, ?, ?, ?)',
        [1, 'test@example.com', 'password_hash', level]
      );
      console.log('Test user created with ID: 1');
    } else {
      console.log('Test user already exists with ID: 1');
    }
    
    // 4. Call the /daily-reading endpoint
    console.log('\nCalling /daily-reading endpoint...');
    
    // Make HTTP request to the endpoint
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/daily-reading',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseData = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: responseData });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.end();
    });
    
    // 5. Verify the response
    console.log(`Response status code: ${response.statusCode}`);
    
    if (response.statusCode !== 200) {
      console.error(`Error: Unexpected status code ${response.statusCode}`);
      console.error(response.data);
      return;
    }
    
    // Check if the response has all required fields
    const requiredFields = ['title', 'content', 'category', 'level', 'vocabulary', 'quiz'];
    const missingFields = requiredFields.filter(field => !response.data.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
      console.error(`Error: Response is missing required fields: ${missingFields.join(', ')}`);
      console.error('Response data:', response.data);
    } else {
      console.log('Response contains all required fields:');
      console.log(`- title: "${response.data.title}"`);
      console.log(`- content: ${response.data.content.length} characters`);
      console.log(`- category: ${response.data.category}`);
      console.log(`- level: ${response.data.level}`);
      console.log(`- vocabulary: ${response.data.vocabulary.length} items`);
      console.log(`- quiz: ${response.data.quiz ? 'present' : 'missing'}`);
      
      // Check vocabulary items
      if (response.data.vocabulary.length > 0) {
        console.log('\nVocabulary items:');
        response.data.vocabulary.forEach((item, index) => {
          console.log(`${index + 1}. ${item.word}: ${item.definition}`);
        });
      }
      
      console.log('\nTest completed successfully!');
    }
    
    // 6. Clean up test data
    console.log('\nCleaning up test data...');
    await db.run('DELETE FROM vocabulary WHERE article_id = ?', [articleId]);
    await db.run('DELETE FROM quizzes WHERE article_id = ?', [articleId]);
    await db.run('DELETE FROM simplified_articles WHERE article_id = ?', [articleId]);
    await db.run('DELETE FROM articles WHERE id = ?', [articleId]);
    console.log('Test data cleaned up');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testDailyReadingEndpoint();