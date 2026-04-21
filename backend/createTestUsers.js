// createTestUsers.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Conexión a la base de datos
const db = new sqlite3.Database('./linguistfeed.db');

async function createUser(username, email, password, role) {
  const hash = await bcrypt.hash(password, 10);

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (username, email, password_hash, email, role) VALUES (?, ?, ?, ?, ?)`,
      [username, email, hash, email, role],
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, username, email, role });
        }
      }
    );
  });
}

async function main() {
  try {
    const student = await createUser('alice_student', 'alice@student.com', '123456', 'student');
    const teacher = await createUser('bob_teacher', 'bob@teacher.com', '123456', 'teacher');
    const admin = await createUser('carol_admin', 'carol@admin.com', '123456', 'admin');

    console.log('Usuarios creados:');
    console.log(student);
    console.log(teacher);
    console.log(admin);
  } catch (err) {
    console.error('Error creando usuarios:', err.message);
  } finally {
    db.close();
  }
}

main();
