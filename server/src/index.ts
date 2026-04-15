import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================
// Startup Validation
// ============================================
const requiredEnvVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.warn(`[Startup] Missing env vars: ${missingEnvVars.join(', ')}`);
} else {
  console.log('[Startup] All required Supabase env vars present');
}

if (!process.env.ADMIN_API_KEY) {
  console.error('[Startup] FATAL: ADMIN_API_KEY is not configured. Admin endpoints will fail with 401.');
} else {
  console.log('[Startup] ADMIN_API_KEY configured:', process.env.ADMIN_API_KEY.substring(0, 8) + '... (length: ' + process.env.ADMIN_API_KEY.length + ')');
}

// Import routes
import backupRoutes from './routes/backup-routes.js';
import adminRoutes from './routes/admin-routes.js';
import backupRestoreRoutes from './routes/backup-restore-routes.js';
import chatRoutes from './routes/chat-routes.js';

const app = express();

// ============================================
// Environment Configuration
// ============================================
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed origins for CORS
const getAllowedOrigins = (): string[] => {
  const origins = [
    // Local development
    'http://localhost:8080',
    'http://localhost:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5173',
  ];
  
  // Add production domains if configured
  const adminDomain = process.env.ADMIN_DOMAIN || 'admin.vijayalakshmiboyarmatrimony.com';
  const clientDomain = process.env.CLIENT_DOMAIN || 'app.vijayalakshmiboyarmatrimony.com';
  
  // Add with and without www
  origins.push(
    `https://${adminDomain}`,
    `https://${clientDomain}`,
    `http://${adminDomain}`,
    `http://${clientDomain}`,
  );
  
  // Add Cloudflare Pages preview URLs if present
  if (process.env.CLOUDFLARE_PAGES_URL) {
    origins.push(process.env.CLOUDFLARE_PAGES_URL);
  }
  
  // Add any custom origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()));
  }
  
  return origins;
};

// ============================================
// CORS Configuration
// ============================================
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    const allowedOrigins = getAllowedOrigins();
    
    // In development, allow any localhost origin
    if (NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log denied origins in development
    if (NODE_ENV === 'development') {
      console.log(`[CORS] Denied origin: ${origin}`);
    }
    
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Admin-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Content-Length', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
};

// ============================================
// Middleware
// ============================================
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ============================================
// Health Check Endpoint
// ============================================
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API health check for frontend
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
    timestamp: new Date().toISOString(),
  });
});

// Backup status endpoint (simple)
app.get('/api/backup/status', (_req: Request, res: Response) => {
  res.json({ 
    success: true,
    data: { lastBackup: null, nextScheduled: new Date(Date.now() + 86400000).toISOString() },
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// API Routes
// ============================================
app.use('/api/backup', backupRoutes);
app.use('/api/admin/backup', backupRestoreRoutes);
app.use('/api/admin/restore', backupRestoreRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

// ============================================
// Error Handling
// ============================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// ============================================
// Start Server
// ============================================
const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`Server started successfully`);
      console.log(`Environment: ${NODE_ENV}`);
      console.log(`Port: ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log('='.repeat(50));
      
      // Log configured origins in development
      if (NODE_ENV === 'development') {
        console.log('Allowed CORS origins:', getAllowedOrigins());
      }
    });
  } catch (err) {
    console.error('[Startup] Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

export default app;
