/**
 * Script to initialize the database with the latest schema
 * 
 * Run with: node init-db.js
 */

const fs = require('fs');
const path = require('path');
const db = require('./database/db');

async function initializeDatabase() {
  try {
    console.log('Initializing database with latest schema...');
    
    // Read the schema.sql file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the schema into individual statements
    const statements = schemaSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (const statement of statements) {
      try {
        await db.run(statement);
        console.log('Executed statement successfully');
      } catch (error) {
        console.error(`Error executing statement: ${statement}`);
        console.error(error);
      }
    }
    
    // Initialize the activities table
    await db.run(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      cefr_level TEXT NOT NULL,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`);
    
    console.log('Database initialization completed');
    
    // Verify tables
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('\nTables in the database:');
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });
    
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Run the initialization
initializeDatabase();