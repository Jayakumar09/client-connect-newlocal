import express from 'express';
import fs from 'fs';
import path from 'path';
import { BackupService } from '../services/backupService.js';
import { RestoreService } from '../services/restoreService.js';
import { verifyZipArchive } from '../utils/zip.js';

const router = express.Router();

interface BackupListEntry {
  name: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
}

function requireAdmin(req, res, next) {
  const apiKey = req.headers['x-admin-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized', code: 'INVALID_API_KEY' });
  }
  next();
}

router.use(requireAdmin);

router.post('/backup/create', async (req, res) => {
  const {
    backupType = 'manual',
    includeSqlDump = true,
    includeJsonExport = true,
    includeStorage = true
  } = req.body;

  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TEMP_BACKUP_DIR: process.env.TEMP_BACKUP_DIR || './temp/backup',
    BACKUP_OUTPUT_DIR: process.env.BACKUP_OUTPUT_DIR || './backups',
    PG_DUMP_PATH: process.env.PG_DUMP_PATH,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@system'
  };

  const backupService = new BackupService(config);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendProgress = (stage, progress, message) => {
    res.write(`data: ${JSON.stringify({ stage, progress, message, timestamp: new Date().toISOString() })}\n\n`);
  };

  try {
    sendProgress('initializing', 0, 'Starting backup...');

    const result = await backupService.runFullBackup({
      backupType,
      includeSqlDump,
      includeJsonExport,
      includeStorage,
      cleanupAfter: true
    });

    sendProgress('completed', 100, 'Backup completed');

    res.write(`data: ${JSON.stringify({
      stage: 'completed',
      progress: 100,
      success: result.success,
      completeness: result.completeness,
      isFullRestorable: result.isFullRestorable,
      outputFile: result.archive?.filePath,
      outputSize: result.archive?.size,
      manifest: result.manifest,
      warnings: result.warnings,
      errors: result.errors
    })}\n\n`);

    res.end();
  } catch (err) {
    console.error('[BackupAPI] Error:', err.message);
    sendProgress('failed', 0, err.message);
    res.end();
  }
});

router.post('/backup/verify', async (req, res) => {
  const { backupFile } = req.body;

  if (!backupFile) {
    return res.status(400).json({ success: false, error: 'backupFile is required', code: 'MISSING_PARAM' });
  }

  if (!fs.existsSync(backupFile)) {
    return res.status(404).json({ success: false, error: 'Backup file not found', code: 'FILE_NOT_FOUND' });
  }

  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    TEMP_BACKUP_DIR: process.env.TEMP_BACKUP_DIR || './temp/backup'
  };

  const backupService = new BackupService(config);

  try {
    const result = await backupService.verifyBackup(backupFile);
    
    res.json({
      success: result.valid,
      valid: result.valid,
      manifest: result.manifest,
      errors: result.errors,
      warnings: result.warnings
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, code: 'VERIFY_ERROR' });
  }
});

router.post('/restore/verify', async (req, res) => {
  const { backupFile } = req.body;

  if (!backupFile) {
    return res.status(400).json({ success: false, error: 'backupFile is required', code: 'MISSING_PARAM' });
  }

  if (!fs.existsSync(backupFile)) {
    return res.status(404).json({ success: false, error: 'Backup file not found', code: 'FILE_NOT_FOUND' });
  }

  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    TEMP_BACKUP_DIR: process.env.TEMP_BACKUP_DIR || './temp/restore'
  };

  const restoreService = new RestoreService(config);

  try {
    const extractResult = await restoreService.extractBackup(backupFile);
    const manifest = await restoreService.loadManifest(extractResult.extractDir);
    const verifyResult = await restoreService.verifyBackupStructure(extractResult.extractDir, manifest);

    res.json({
      success: verifyResult.valid,
      valid: verifyResult.valid,
      manifest,
      errors: verifyResult.errors,
      warnings: verifyResult.warnings,
      structure: extractResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, code: 'VERIFY_ERROR' });
  }
});

router.post('/restore/run', async (req, res) => {
  const {
    backupFile,
    restoreDb = true,
    restoreStorage = true,
    dbMode = 'upsert',
    storageBucket = null,
    dryRun = false
  } = req.body;

  if (!backupFile) {
    return res.status(400).json({ success: false, error: 'backupFile is required', code: 'MISSING_PARAM' });
  }

  if (!fs.existsSync(backupFile)) {
    return res.status(404).json({ success: false, error: 'Backup file not found', code: 'FILE_NOT_FOUND' });
  }

  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    TEMP_BACKUP_DIR: process.env.TEMP_BACKUP_DIR || './temp/restore'
  };

  const restoreService = new RestoreService(config);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendProgress = (stage, progress, message) => {
    res.write(`data: ${JSON.stringify({ stage, progress, message, timestamp: new Date().toISOString() })}\n\n`);
  };

  try {
    sendProgress('initializing', 0, 'Starting restore...');

    const result = await restoreService.runFullRestore(backupFile, {
      restoreDb,
      restoreStorage,
      dbMode,
      storageBucket,
      dryRun
    });

    sendProgress('completed', 100, 'Restore completed');

    res.write(`data: ${JSON.stringify({
      stage: 'completed',
      progress: 100,
      success: result.success,
      dryRun: result.dryRun,
      report: result.report,
      error: result.error
    })}\n\n`);

    res.end();
  } catch (err) {
    console.error('[RestoreAPI] Error:', err.message);
    sendProgress('failed', 0, err.message);
    res.end();
  }
});

router.get('/backup/list', async (req, res) => {
  const backupDir = process.env.BACKUP_OUTPUT_DIR || './backups';
  
  try {
    if (!fs.existsSync(backupDir)) {
      return res.json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.zip'))
      .map<BackupListEntry>(f => {
        const filePath = path.join(backupDir, f);
        const stat = fs.statSync(filePath);
        return {
          name: f,
          path: filePath,
          size: stat.size,
          created: stat.birthtime || stat.ctime,
          modified: stat.mtime
        };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());

    res.json({ success: true, backups: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
