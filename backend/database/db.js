const path = require('path');
const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();

// Detectar si están configuradas las variables de Turso (libSQL en la nube)
const tursoUrl = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.trim() : '';
const tursoToken = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : '';
const isTurso = Boolean(tursoUrl && tursoToken);

let tursoClient = null;
let sqliteDb = null;

if (isTurso) {
  console.log('🌐 [DB] Modo TURSO activo. Conectando a libSQL en la nube:', tursoUrl);
  try {
    tursoClient = createClient({
      url: tursoUrl,
      authToken: tursoToken
    });
    console.log('✅ [DB] Cliente Turso configurado correctamente.');
  } catch (err) {
    console.error('❌ [DB] Error al inicializar cliente Turso:', err.message);
    process.exit(1);
  }
} else {
  const dbPath = path.join(__dirname, '../linguistfeed.db');
  console.log('💾 [DB] Modo SQLite local activo. Archivo:', dbPath);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ [DB] Error conectando a la base de datos local SQLite:', err.message);
      process.exit(1);
    }
    console.log('✅ [DB] Conectado a SQLite local exitosamente en:', dbPath);
  });
}

// --- HELPER FUNCTIONS (compatibles con Turso y SQLite local) ---

/**
 * Ejecuta una consulta INSERT, UPDATE o DELETE y retorna { lastID, changes }
 */
const run = async (sql, params = []) => {
  if (isTurso) {
    try {
      const res = await tursoClient.execute({ sql, args: params });
      return {
        lastID: res.lastInsertRowid != null ? Number(res.lastInsertRowid) : undefined,
        changes: res.rowsAffected
      };
    } catch (err) {
      console.error('❌ [DB] Turso SQL Run Error:', err.message);
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) {
        console.error('❌ [DB] SQL Run Error:', err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

/**
 * Ejecuta una consulta SELECT y retorna la primera fila o undefined
 */
const get = async (sql, params = []) => {
  if (isTurso) {
    try {
      const res = await tursoClient.execute({ sql, args: params });
      return res.rows && res.rows.length > 0 ? res.rows[0] : undefined;
    } catch (err) {
      console.error('❌ [DB] Turso SQL Get Error:', err.message);
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

/**
 * Ejecuta una consulta SELECT y retorna un arreglo con todas las filas
 */
const all = async (sql, params = []) => {
  if (isTurso) {
    try {
      const res = await tursoClient.execute({ sql, args: params });
      return res.rows ? Array.from(res.rows) : [];
    } catch (err) {
      console.error('❌ [DB] Turso SQL All Error:', err.message);
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

/**
 * Cierre controlado de la conexión
 */
const close = async () => {
  if (isTurso) {
    if (tursoClient && typeof tursoClient.close === 'function') {
      tursoClient.close();
    }
    return;
  }
  if (sqliteDb) {
    return new Promise((resolve) => {
      sqliteDb.close((err) => {
        if (err) console.error('❌ [DB] Error cerrando base de datos SQLite:', err.message);
        resolve();
      });
    });
  }
};

/**
 * Inicializa las tablas del esquema en la base de datos activa (Turso o SQLite local)
 */
async function initializeDatabase() {
  console.log('🚀 Inicializando tablas de base de datos...');

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

    const articleCols = await all(`PRAGMA table_info(articles)`);
    const hasExternalId = Array.isArray(articleCols)
      ? articleCols.some((c) => String(c.name || '').toLowerCase() === 'external_id')
      : false;
    const hasAssignedToUserId = Array.isArray(articleCols)
      ? articleCols.some((c) => String(c.name || '').toLowerCase() === 'assigned_to_user_id')
      : false;
    const hasIsManual = Array.isArray(articleCols)
      ? articleCols.some((c) => String(c.name || '').toLowerCase() === 'is_manual')
      : false;
    const hasAuthorId = Array.isArray(articleCols)
      ? articleCols.some((c) => String(c.name || '').toLowerCase() === 'author_id')
      : false;
    const hasClassId = Array.isArray(articleCols)
      ? articleCols.some((c) => String(c.name || '').toLowerCase() === 'class_id')
      : false;
    const hasImageUrl = Array.isArray(articleCols)
      ? articleCols.some((c) => String(c.name || '').toLowerCase() === 'image_url')
      : false;

    if (!hasExternalId) {
      await run('ALTER TABLE articles ADD COLUMN external_id TEXT');
      console.log("✅ Columna 'articles.external_id' agregada");
    }
    if (!hasAssignedToUserId) {
      await run('ALTER TABLE articles ADD COLUMN assigned_to_user_id INTEGER');
      console.log("✅ Columna 'articles.assigned_to_user_id' agregada");
    }
    if (!hasIsManual) {
      await run('ALTER TABLE articles ADD COLUMN is_manual INTEGER DEFAULT 0');
      console.log("✅ Columna 'articles.is_manual' agregada");
    }
    if (!hasAuthorId) {
      await run('ALTER TABLE articles ADD COLUMN author_id INTEGER');
      console.log("✅ Columna 'articles.author_id' agregada");
    }
    if (!hasClassId) {
      await run('ALTER TABLE articles ADD COLUMN class_id INTEGER REFERENCES classes(id)');
      console.log("✅ Columna 'articles.class_id' agregada");
    }
    if (!hasImageUrl) {
      await run('ALTER TABLE articles ADD COLUMN image_url TEXT');
      console.log("✅ Columna 'articles.image_url' agregada");
    }

    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_external_id_unique
      ON articles (external_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_articles_topic_created
      ON articles (topic, created_at DESC)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_articles_assigned_user
      ON articles (assigned_to_user_id, created_at DESC)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_articles_author
      ON articles (author_id, created_at DESC)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_articles_class_id
      ON articles (class_id, created_at DESC)`);

    // 2. Simplified Articles table (AI-generated content)
    await run(`CREATE TABLE IF NOT EXISTS simplified_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      text TEXT,
      level TEXT,
      adapted_title TEXT,
      adapted_content TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    const simpCols = await all(`PRAGMA table_info(simplified_articles)`);
    const simpColNames = new Set((simpCols || []).map((c) => String(c.name || '').toLowerCase()));
    if (!simpColNames.has('adapted_title')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN adapted_title TEXT');
      console.log("✅ Columna 'simplified_articles.adapted_title' agregada");
    }
    if (!simpColNames.has('adapted_content')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN adapted_content TEXT');
      console.log("✅ Columna 'simplified_articles.adapted_content' agregada");
    }
    if (!simpColNames.has('url')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN url TEXT');
      console.log("✅ Columna 'simplified_articles.url' agregada");
    }
    if (!simpColNames.has('title')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN title TEXT');
      console.log("✅ Columna 'simplified_articles.title' agregada");
    }
    if (!simpColNames.has('topic')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN topic TEXT');
      console.log("✅ Columna 'simplified_articles.topic' agregada");
    }
    if (!simpColNames.has('content')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN content TEXT');
      console.log("✅ Columna 'simplified_articles.content' agregada");
    }
    if (!simpColNames.has('created_at')) {
      await run('ALTER TABLE simplified_articles ADD COLUMN created_at DATETIME');
      console.log("✅ Columna 'simplified_articles.created_at' agregada");
    }

    await run(`DELETE FROM simplified_articles
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM simplified_articles
        GROUP BY article_id, level
      )`);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_simplified_articles_article_level
      ON simplified_articles (article_id, level)`);

    // 3. Flashcards table
    await run(`CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      context TEXT,
      level TEXT,
      created_at TEXT
    )`);
    console.log("✅ Tabla 'flashcards' verificada/creada");

    // 4. User flashcards table
    await run(`CREATE TABLE IF NOT EXISTS user_flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      context TEXT,
      level TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
    console.log("✅ Tabla 'user_flashcards' verificada/creada");

    // 5. Quizzes table
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

    // 6. Attempts table
    await run(`CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quiz_id INTEGER NOT NULL,
      selected_option INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES quizzes (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
    console.log("✅ Tabla 'attempts' verificada/creada");

    // 7. Answer Events table
    await run(`CREATE TABLE IF NOT EXISTS answer_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id TEXT,
      article_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      quiz_source TEXT DEFAULT 'reader_ai',
      selected_value TEXT,
      is_correct INTEGER NOT NULL,
      response_time_ms INTEGER,
      attempt_index INTEGER DEFAULT 1,
      counted_for_stats INTEGER DEFAULT 1,
      level TEXT,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, article_id, question_id, attempt_index)
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_answer_events_user_date
      ON answer_events (user_id, answered_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_answer_events_user_article
      ON answer_events (user_id, article_id)`);
    console.log("✅ Tabla 'answer_events' verificada/creada");

    // 8. Vocabulary table
    await run(`CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      definition TEXT,
      example TEXT,
      level TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    // 9. Daily Articles table
    await run(`CREATE TABLE IF NOT EXISTS daily_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      topic TEXT,
      FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    )`);

    // 10. Users table
    await run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE,
      level TEXT DEFAULT 'B1',
      age INTEGER,
      interests TEXT,
      onboarding_completed INTEGER DEFAULT 0,
      role TEXT DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ Tabla 'users' verificada/creada");

    const userCols = await all(`PRAGMA table_info(users)`);
    const hasOnboardingCompleted = Array.isArray(userCols)
      ? userCols.some((c) => String(c.name || '').toLowerCase() === 'onboarding_completed')
      : false;
    if (!hasOnboardingCompleted) {
      await run('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0');
      console.log("✅ Columna 'users.onboarding_completed' agregada");
    }

    // 11. User Preferences table
    await run(`CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      weekly_reading_goal_minutes INTEGER NOT NULL DEFAULT 60,
      daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    console.log("✅ Tabla 'user_preferences' verificada/creada");

    const prefCols = await all(`PRAGMA table_info(user_preferences)`);
    const hasDailyGoal = Array.isArray(prefCols)
      ? prefCols.some((c) => String(c.name || '').toLowerCase() === 'daily_goal_minutes')
      : false;
    if (!hasDailyGoal) {
      await run('ALTER TABLE user_preferences ADD COLUMN daily_goal_minutes INTEGER NOT NULL DEFAULT 15');
      console.log("✅ Columna 'user_preferences.daily_goal_minutes' agregada");
    }

    // 12. Reading Time Logs table
    await run(`CREATE TABLE IF NOT EXISTS reading_time_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      seconds INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    console.log("✅ Tabla 'reading_time_logs' verificada/creada");

    // 13. Classes table
    await run(`CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_classes_teacher
      ON classes (teacher_id, created_at)`);
    console.log("✅ Tabla 'classes' verificada/creada");

    // 14. Class Members table
    await run(`CREATE TABLE IF NOT EXISTS class_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(class_id, student_id),
      FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_class_members_class
      ON class_members (class_id, joined_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_class_members_student
      ON class_members (student_id, joined_at)`);
    console.log("✅ Tabla 'class_members' verificada/creada");

    // 15. Reader Quiz Cache table
    await run(`CREATE TABLE IF NOT EXISTS reader_quiz_cache (
      article_key TEXT NOT NULL,
      level TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (article_key, level)
    )`);
    console.log("✅ Tabla 'reader_quiz_cache' verificada/creada");

    // 16. Activities table (opcional para ejercicios avanzados)
    await run(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      cefr_level TEXT NOT NULL,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      data_json TEXT NOT NULL,
      paragraph_index INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ Tabla 'activities' verificada/creada");

    console.log('✨ Esquema de base de datos inicializado exitosamente.');
  } catch (err) {
    console.error('❌ Error inicializando esquema de base de datos:', err.message);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  run,
  get,
  all,
  close,
  db: isTurso ? tursoClient : sqliteDb,
  isTurso
};