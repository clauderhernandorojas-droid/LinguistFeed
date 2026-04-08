const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database file path (C:\Proyectos Cursor\LinguistFeed\backend\linguistfeed.db)
const dbPath = path.join(__dirname, '../linguistfeed.db');

// Create a new database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to the database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to the SQLite database at:', dbPath);
});

/**
 * Initialize the database tables one by one.
 * This is safer than reading an external .sql file as it ensures
 * all tables exist before the server starts handling requests.
 */
async function initializeDatabase() {
  console.log('🚀 Initializing database tables...');
  
  try {
    // 1. Articles table (Main storage for scraped content)
    await run(`CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      url TEXT UNIQUE,
      topic TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Simplified Articles table (AI-generated content)
    await run(`CREATE TABLE IF NOT EXISTS simplified_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      text TEXT,
      level TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    // Añade esto en db.js junto a las otras tablas:
    await run(`CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      context TEXT,
      level TEXT,
      created_at TEXT
    )`);
    console.log("✅ Tabla 'flashcards' verificada/creada");

    // 3. Quizzes table
    await run(`CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      correct_option TEXT,
      hint TEXT,
      level TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    // 4. Vocabulary table
    await run(`CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      definition TEXT,
      example TEXT,
      level TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    // 5. Daily Articles table (For the daily reading feature)
    await run(`CREATE TABLE IF NOT EXISTS daily_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      topic TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    // 0. Users table (Para guardar perfil y nivel)
    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      level TEXT DEFAULT 'B1',
      age INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ Tabla 'users' verificada/creada");

    // --- AQUÍ ESTA EL CAMBIO QUE NECESITAMOS ---
    try {
      await run(`ALTER TABLE users ADD COLUMN interests TEXT`);
      console.log("✅ Columna 'interests' añadida correctamente.");
    } catch (e) {
      // Si la columna ya existe, SQLite dará un error que simplemente ignoramos
    }
    // -------------------------------------------

    console.log('✨ Database schema initialized successfully. All tables verified.');
  } catch (err) {
    console.error('❌ Error initializing database schema:', err.message);
    throw err;
  }
}

// --- HELPER FUNCTIONS (Promisified for async/await) ---

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ SQL Run Error:', err.message);
        console.error('SQL Query:', sql);
        return reject(err);
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('❌ SQL Get Error:', err.message);
        return reject(err);
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ SQL All Error:', err.message);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
        return reject(err);
      }
      console.log('🔌 Database connection closed.');
      resolve();
    });
  });
}

module.exports = {
  initializeDatabase,
  run,
  get,
  all,
  close
};