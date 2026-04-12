require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database/db'); // Esta es la única declaración de 'db'
const schedulerService = require('./services/schedulerService');

// 1. Inicialización de la App y Puerto
const app = express();
const PORT = process.env.PORT || 3001;

// 2. Configuración de Seguridad (CORS)
app.use(cors()); // Corregido: sin paréntesis extra ni errores de sintaxis

// 3. Middlewares Esenciales
app.use(express.json()); 

// Middleware de Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 4. Importación de Rutas (Nombres únicos para evitar el error 'already declared')
const authRoutes = require('./routes/auth');
const articlesRoutes = require('./routes/articles');
const dailyArticlesRoutes = require('./routes/dailyArticles');
const quizRoutes = require('./routes/quiz');
const progressRoutes = require('./routes/progress');
const flashcardsRoutes = require('./routes/flashcards');
const analyzeRoutes = require('./routes/analyze');

// 5. Registro de Rutas
app.use('/api/auth', authRoutes);
app.use('/api/articles', articlesRoutes); // <-- Corregido
app.use('/api/daily-articles', dailyArticlesRoutes);
app.use('/api/quizzes', quizRoutes);      // <-- Mejor ponerles /api/
app.use('/api/progress', progressRoutes); // <-- Mejor ponerles /api/
app.use('/api/flashcards', flashcardsRoutes);
app.use('/api/analyze', analyzeRoutes);

// 6. Manejo de Errores Global
app.use((err, req, res, next) => {
  console.error(`${new Date().toISOString()} - Error:`, err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// 7. Inicialización de Base de Datos y Servidor
async function startServer() {
  try {
    // Inicializar DB
    await db.initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    // Iniciar el servidor
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 API Endpoints Ready`);
      
      // Iniciar el servicio programado
      schedulerService.start();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Manejo de cierre seguro
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  schedulerService.stop();
  await db.close();
  process.exit(0);
});

// ¡Arrancamos!
startServer();