-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE,
  title TEXT,
  topic TEXT,
  content TEXT,
  source TEXT,
  external_id TEXT,
  assigned_to_user_id INTEGER,
  author_id INTEGER,
  class_id INTEGER REFERENCES classes(id),
  is_manual INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily articles table
CREATE TABLE IF NOT EXISTS daily_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  topic TEXT NOT NULL,
  article_id INTEGER NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
);

-- Simplified articles table (level-adapted versions of articles)
CREATE TABLE IF NOT EXISTS simplified_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  text TEXT,
  level TEXT,
  FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
);
