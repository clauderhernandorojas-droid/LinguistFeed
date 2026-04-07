const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'linguistfeed.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) return console.error(err.message);
    console.log("📋 Tablas encontradas en la base de datos:");
    tables.forEach(table => console.log(`- ${table.name}`));
    db.close();
});