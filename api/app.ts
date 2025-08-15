import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initializeDatabase } from './database';

// Load environment variables
dotenv.config();

const app = express();

// Initialize database
initializeDatabase().catch(err => {
  console.error('❌ Error al inicializar la base de datos:', err);
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for videos and thumbnails)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sistema de Videos Veo 3 API',
    version: '1.0.0',
    endpoints: {
      prompts: '/api/prompts',
      videos: '/api/videos',
      library: '/api/videos/library'
    }
  });
});

// Import and use API routes
import promptRoutes from './routes/prompts';
import videoRoutes from './routes/videos';

app.use('/api/prompts', promptRoutes);
app.use('/api/videos', videoRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

export default app;