const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ajusta el nombre si tu DB se llama distinto
const dbPath = path.join(__dirname, 'linguistfeed.db');
const db = new sqlite3.Database(dbPath);

console.log("🚀 Empezando migración de base de datos...");

db.serialize(() => {
    const columns = [
        "ALTER TABLE users ADD COLUMN age INTEGER",
        "ALTER TABLE users ADD COLUMN interests TEXT",
        "ALTER TABLE users ADD COLUMN daily_goal INTEGER DEFAULT 10",
        "ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0"
    ];

    columns.forEach(sql => {
        db.run(sql, (err) => {
            if (err) {
                if (err.message.includes("duplicate column name")) {
                    console.log(`✅ La columna ya existía (omitido).`);
                } else {
                    console.error(`❌ Error en: ${sql}`, err.message);
                }
            } else {
                console.log(`➕ Ejecutado con éxito: ${sql.substring(0, 30)}...`);
            }
        });
    });
});

db.close((err) => {
    if (err) return console.error(err.message);
    console.log("🏁 Proceso terminado. Ya puedes borrar este archivo.");
});