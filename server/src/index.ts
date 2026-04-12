import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import backupRoutes from './routes/backup-routes.js';
import adminRoutes from './routes/admin-routes.js';
import backupRestoreRoutes from './routes/backup-restore-routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/backup', backupRoutes);
app.use('/api/admin/backup', backupRestoreRoutes);
app.use('/api/admin/restore', backupRestoreRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backup server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
