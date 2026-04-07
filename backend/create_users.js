const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'linguistfeed.db');
const db = new sqlite3.Database(dbPath);

console.log("🛠️ Creando tabla de usuarios...");

db.serialize(() => {
    // Creamos la tabla con TODO: id, email, password y los campos de onboarding
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'student',
        age INTEGER,
        level TEXT DEFAULT 'B1',
        interests TEXT,
        daily_goal INTEGER DEFAULT 10,
        onboarding_completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error("❌ Error al crear la tabla:", err.message);
        } else {
            console.log("✅ Tabla 'users' creada exitosamente con todos los campos de onboarding.");
        }
    });
});

db.close();