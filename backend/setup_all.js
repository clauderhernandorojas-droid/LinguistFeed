const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt'); // Necesario para que el login reconozca la clave

const dbPath = path.join(__dirname, 'linguistfeed.db');
const db = new sqlite3.Database(dbPath);

async function setup() {
    console.log("🛠️ Iniciando configuración total de usuarios...");

    const hashedPassword = await bcrypt.hash('123456', 10); // Contraseña de prueba: 123456

    db.serialize(() => {
        // 1. Crear la tabla desde cero
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            level TEXT DEFAULT 'B1',
            onboarding_completed INTEGER DEFAULT 0
        )`, (err) => {
            if (err) console.error("❌ Error creando tabla:", err.message);
            else console.log("✅ Tabla 'users' lista.");
        });

        // 2. Insertar o resetear al usuario de prueba
        // Cambia 'test@mail.com' por el correo que quieras usar
        const testEmail = 'test@mail.com';
        
        db.run(`INSERT OR REPLACE INTO users (email, password, name, onboarding_completed) 
                VALUES (?, ?, ?, ?)`, 
                [testEmail, hashedPassword, 'User Test', 0], 
                function(err) {
            if (err) {
                console.error("❌ Error creando usuario:", err.message);
            } else {
                console.log(`🚀 USUARIO LISTO PARA PRUEBAS:`);
                console.log(`   📧 Email: ${testEmail}`);
                console.log(`   🔑 Clave: 123456`);
                console.log(`   ✨ Onboarding: Pendiente (0)`);
            }
        });
    });
}

setup();