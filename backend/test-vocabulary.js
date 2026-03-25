/**
 * Test script to verify vocabulary generation and storage
 * 
 * Run with: node test-vocabulary.js
 */

const aiService = require('./services/aiService');
const articleService = require('./services/articleService');
const db = require('./database/db');

async function testVocabularyGeneration() {
  console.log('Testing vocabulary storage and retrieval...');
  
  try {
    // Sample text for testing
    const sampleText = `
    Climate change is one of the most pressing issues of our time. The Earth's average temperature has increased by about 1 degree Celsius since pre-industrial times. This warming is primarily caused by human activities, such as burning fossil fuels and deforestation, which release greenhouse gases into the atmosphere.
    
    Scientists predict that without significant reductions in greenhouse gas emissions, the global temperature could rise by more than 2 degrees Celsius by the end of this century. This would lead to more frequent and severe weather events, rising sea levels, and disruptions to ecosystems.
    
    Many countries have committed to reducing their carbon emissions through international agreements like the Paris Climate Accord. However, more ambitious action is needed to prevent the worst impacts of climate change.
    `;
    
    // 1. Create mock simplified article with vocabulary (bypassing AI service)
    console.log('Creating mock simplified article with vocabulary...');
    const level = 'B1';
    
    // Mock simplified data that would normally come from AI
    const simplifiedData = {
      title: "Climate Change: A Simple Explanation",
      text: "Climate change is one of the biggest problems today. The Earth is getting warmer by about 1 degree Celsius since before factories existed. This warming happens mostly because of human activities, like burning coal and cutting down forests, which put greenhouse gases into the air.\n\nScientists think that if we don't reduce these gases, the Earth could get more than 2 degrees warmer by the year 2100. This would cause more storms, higher sea levels, and problems for plants and animals.\n\nMany countries have promised to reduce their carbon emissions through agreements like the Paris Climate Accord. But we need to do more to stop the worst effects of climate change.",
      vocabulary: [
        {
          word: "climate change",
          definition: "Changes in normal weather patterns caused by global warming",
          example: "Climate change is causing more extreme weather events around the world."
        },
        {
          word: "greenhouse gases",
          definition: "Gases that trap heat in the Earth's atmosphere",
          example: "Carbon dioxide is one of the main greenhouse gases causing global warming."
        },
        {
          word: "emissions",
          definition: "The production and release of something, especially gas or radiation",
          example: "The factory has reduced its carbon emissions by 30% in the last year."
        },
        {
          word: "fossil fuels",
          definition: "Natural fuels like coal or gas, formed from the remains of living organisms",
          example: "We need to use less fossil fuels and more renewable energy."
        },
        {
          word: "deforestation",
          definition: "The cutting down of trees in a large area",
          example: "Deforestation in the Amazon rainforest is a serious environmental problem."
        }
      ],
      quiz: {
        question: "What is the main cause of climate change?",
        options: ["Natural weather cycles", "Human activities", "Solar radiation"],
        correct_index: 1,
        hint: "H_m_n act_v_t__s"
      }
    };
    
    console.log(`Mock data created. Title: "${simplifiedData.title}"`);
    console.log(`Text length: ${simplifiedData.text.length} characters`);
    console.log(`Vocabulary items: ${simplifiedData.vocabulary.length}`);
    
    // Print vocabulary items
    console.log('\nMock vocabulary items:');
    simplifiedData.vocabulary.forEach((item, index) => {
      console.log(`${index + 1}. ${item.word}: ${item.definition}`);
    });
    
    // 2. Store in database for testing
    console.log('\nStoring test article in database...');
    
    // Create a test article
    const testArticle = {
      title: simplifiedData.title,
      source: 'Test Source',
      url: `https://test.example.com/article-${Date.now()}`,
      category: 'Test',
      original_text: sampleText
    };
    
    // Store the article
    const articleId = await articleService.storeArticle(testArticle);
    console.log(`Test article stored with ID: ${articleId}`);
    
    // Store the simplified version
    const simplifiedId = await articleService.storeSimplifiedArticle(articleId, level, simplifiedData.text);
    console.log(`Simplified version stored with ID: ${simplifiedId}`);
    
    // Store vocabulary
    const vocabIds = await articleService.storeVocabulary(articleId, level, simplifiedData.vocabulary);
    console.log(`Stored ${vocabIds.length} vocabulary items with IDs: ${vocabIds.join(', ')}`);
    
    // 3. Retrieve from database to verify
    console.log('\nRetrieving vocabulary from database...');
    const storedVocabulary = await articleService.getArticleVocabulary(articleId, level);
    
    console.log(`Retrieved ${storedVocabulary.length} vocabulary items from database`);
    
    if (storedVocabulary.length === 0) {
      console.error('ERROR: No vocabulary items were retrieved from the database');
    } else {
      console.log('\nStored vocabulary items:');
      storedVocabulary.forEach((item, index) => {
        console.log(`${index + 1}. ${item.word}: ${item.definition}`);
      });
      
      console.log('\nTest completed successfully!');
    }
    
    // 4. Clean up test data
    console.log('\nCleaning up test data...');
    await db.run('DELETE FROM vocabulary WHERE article_id = ?', [articleId]);
    await db.run('DELETE FROM simplified_articles WHERE article_id = ?', [articleId]);
    await db.run('DELETE FROM articles WHERE id = ?', [articleId]);
    console.log('Test data cleaned up');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testVocabularyGeneration();