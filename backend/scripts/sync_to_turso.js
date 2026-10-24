require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');

async function syncToTurso() {
  console.log('====================================================');
  console.log('🔄 LinguistFeed: Sincronización de SQLite a Turso DB');
  console.log('====================================================\n');

  const tursoUrl = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.trim() : '';
  const tursoToken = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : '';

  if (!tursoUrl || !tursoToken) {
    console.error('❌ Faltan credenciales de Turso en backend/.env');
    console.error('Por favor define las siguientes variables:');
    console.error('  TURSO_DATABASE_URL=libsql://tu-base-de-datos.turso.io');
    console.error('  TURSO_AUTH_TOKEN=tu-token-de-autenticacion\n');
    process.exit(1);
  }

  const localDbPath = path.join(__dirname, '../linguistfeed.db');
  if (!fs.existsSync(localDbPath)) {
    console.error(`❌ No se encontró el archivo SQLite local en: ${localDbPath}`);
    process.exit(1);
  }

  console.log(`📂 Origen local: ${localDbPath}`);
  console.log(`🌐 Destino remoto: ${tursoUrl}\n`);

  // 1. Conectar a SQLite local
  const localDb = new sqlite3.Database(localDbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('❌ Error al abrir la base de datos local:', err.message);
      process.exit(1);
    }
  });

  const localAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      localDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  };

  // 2. Conectar a Turso
  const tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoToken
  });

  // 3. Inicializar esquema en Turso
  console.log('🛠️ 1. Verificando/Creando esquema en Turso...');
  process.env.TURSO_DATABASE_URL = tursoUrl;
  process.env.TURSO_AUTH_TOKEN = tursoToken;
  const dbModule = require('../database/db');
  await dbModule.initializeDatabase();
  console.log('✅ Esquema verificado en Turso.\n');

  // Asegurar que usuarios referenciados por datos huérfanos existan en Turso para respetar Foreign Keys
  console.log('🛡️ Verificando integridad referencial de usuarios...');
  const referencedUserIds = new Set();
  const tablesWithUserId = ['user_preferences', 'user_flashcards', 'attempts', 'answer_events'];
  for (const t of tablesWithUserId) {
    try {
      const distinctUsers = await localAll(`SELECT DISTINCT user_id FROM "${t}" WHERE user_id IS NOT NULL`);
      distinctUsers.forEach(u => referencedUserIds.add(u.user_id));
    } catch (_) {}
  }

  const existingUsersTurso = await tursoClient.execute('SELECT id FROM users');
  const existingTursoUserIds = new Set(existingUsersTurso.rows.map(r => r.id));

  for (const uid of referencedUserIds) {
    if (!existingTursoUserIds.has(uid)) {
      console.log(`➕ Creando usuario placeholder (ID: ${uid}) para preservar flashcards/progreso`);
      await tursoClient.execute({
        sql: `INSERT OR IGNORE INTO users (id, username, password_hash, email, level) VALUES (?, ?, ?, ?, ?)`,
        args: [uid, `usuario_restaurado_${uid}`, 'hash_placeholder_sync', `restored_${uid}@linguistfeed.internal`, 'B1']
      });
      existingTursoUserIds.add(uid);
    }
  }

  // 4. Tablas en orden de dependencia
  const tablesToSync = [
    'users',
    'classes',
    'class_members',
    'articles',
    'simplified_articles',
    'quizzes',
    'attempts',
    'vocabulary',
    'daily_articles',
    'flashcards',
    'user_flashcards',
    'reader_quiz_cache',
    'answer_events',
    'user_preferences',
    'reading_time_logs',
    'activities'
  ];

  console.log('📦 2. Sincronizando datos tabla por tabla...\n');

  const BATCH_SIZE = 50;
  let totalRowsSynced = 0;

  for (const tableName of tablesToSync) {
    try {
      // Verificar si la tabla existe localmente
      const tableCheck = await localAll(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [tableName]
      );
      if (tableCheck.length === 0) {
        continue;
      }

      const rows = await localAll(`SELECT * FROM "${tableName}"`);
      if (rows.length === 0) {
        console.log(`⚪ ${tableName}: 0 registros (vacía en local)`);
        continue;
      }

      console.log(`⏳ ${tableName}: Sincronizando ${rows.length} registros...`);

      // Obtener columnas existentes en Turso para no intentar insertar columnas incompatibles
      const tursoTableInfo = await tursoClient.execute(`PRAGMA table_info("${tableName}")`);
      const tursoColumns = new Set(tursoTableInfo.rows.map(r => r.name));

      // Filtrar a solo las columnas presentes en ambas partes
      const localColumns = Object.keys(rows[0]);
      const commonColumns = localColumns.filter(c => tursoColumns.has(c));

      if (commonColumns.length === 0) {
        console.warn(`⚠️ ${tableName}: Sin columnas coincidentes entre local y Turso.`);
        continue;
      }

      const columnNamesSql = commonColumns.map(c => `"${c}"`).join(', ');
      const placeholders = commonColumns.map(() => '?').join(', ');
      const hasIdColumn = commonColumns.includes('id');
      const updateClause = hasIdColumn
        ? `ON CONFLICT(id) DO UPDATE SET ` + commonColumns.filter(c => c !== 'id').map(c => `"${c}" = excluded."${c}"`).join(', ')
        : '';
      const insertSql = hasIdColumn && updateClause
        ? `INSERT INTO "${tableName}" (${columnNamesSql}) VALUES (${placeholders}) ${updateClause}`
        : `INSERT OR REPLACE INTO "${tableName}" (${columnNamesSql}) VALUES (${placeholders})`;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const batchStatements = chunk.map(row => {
          const args = commonColumns.map(c => {
            const val = row[c];
            return val !== undefined ? val : null;
          });
          return { sql: insertSql, args };
        });

        await tursoClient.batch(batchStatements, 'write');
      }

      totalRowsSynced += rows.length;
      console.log(`✅ ${tableName}: ${rows.length} registros sincronizados con éxito.`);
    } catch (tableErr) {
      console.error(`⚠️ Error al sincronizar tabla ${tableName}:`, tableErr.message);
    }
  }

  // Cerrar SQLite local
  localDb.close();

  console.log('\n====================================================');
  console.log(`🎉 Sincronización completada: ${totalRowsSynced} registros migrados/actualizados en Turso.`);
  console.log('====================================================\n');
}

syncToTurso().catch((err) => {
  console.error('❌ Error fatal durante la sincronización:', err);
  process.exit(1);
});
