const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'linguistfeed.db');
const db = new sqlite3.Database(dbPath);

// CAMBIA ESTO por el correo que usas para probar
const userEmail = 'tu_usuario_test@mail.com'; 

db.run(`UPDATE users SET onboarding_completed = 0 WHERE email = ?`, [userEmail], function(err) {
    if (err) return console.error("❌ Error:", err.message);
    console.log(`✅ Éxito: El usuario ${userEmail} ahora tiene el onboarding pendiente (0).`);
    console.log(`Filas afectadas: ${this.changes}`);
    db.close();
});