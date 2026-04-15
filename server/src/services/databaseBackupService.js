import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';

const BACKUP_VERSION = '3.0.0';

const TABLES = [
  'persons',
  'client_profiles',
  'payments',
  'subscriptions',
  'notifications',
  'messages',
  'message_reactions',
  'profile_interests',
  'profile_shortlists',
  'profile_views',
  'blocked_users',
  'user_reports',
  'user_roles',
  'notification_preferences',
  'push_subscriptions'
];

class DatabaseBackupService {
  constructor(config = {}) {
    this.supabaseUrl = config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    this.supabaseKey = config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    this.databaseUrl = config.DATABASE_URL || process.env.DATABASE_URL;
    this.pgDumpPath = config.PG_DUMP_PATH || process.env.PG_DUMP_PATH;
    this.tempDir = config.TEMP_BACKUP_DIR || process.env.TEMP_BACKUP_DIR || './temp/backup';
    this.supabase = null;
    
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }
  }

  async ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  getDbEngine() {
    if (this.supabaseUrl && this.supabaseUrl.includes('supabase')) {
      return 'supabase-postgresql';
    }
    if (this.databaseUrl && this.databaseUrl.startsWith('postgresql')) {
      return 'postgresql';
    }
    return 'unknown';
  }

  async exportToJson(outputDir) {
    await this.ensureTempDir();
    const outputPath = path.join(outputDir, 'database-export.json');
    
    const databaseExport = {};
    const recordCounts = {};
    let totalRecords = 0;

    console.log('[DatabaseBackup] Starting JSON export...');

    for (const table of TABLES) {
      try {
        const { data, error, count } = await this.supabase
          .from(table)
          .select('*', { count: 'exact' });

        if (error) {
          console.warn(`[DatabaseBackup] Warning: Could not export table ${table}:`, error.message);
          databaseExport[table] = { error: error.message, records: [] };
          recordCounts[table] = 0;
        } else {
          databaseExport[table] = {
            records: data || [],
            count: count || 0
          };
          recordCounts[table] = count || 0;
          totalRecords += count || 0;
          console.log(`[DatabaseBackup] Exported ${table}: ${count || 0} records`);
        }
      } catch (err) {
        console.warn(`[DatabaseBackup] Error exporting ${table}:`, err.message);
        databaseExport[table] = { error: err.message, records: [] };
        recordCounts[table] = 0;
      }
    }

    const jsonContent = JSON.stringify(databaseExport, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf8');
    
    const stat = fs.statSync(outputPath);
    console.log(`[DatabaseBackup] JSON export complete: ${stat.size} bytes, ${totalRecords} total records`);

    return {
      filePath: outputPath,
      fileName: 'database-export.json',
      size: stat.size,
      checksum: await this.calculateChecksum(outputPath),
      recordCounts,
      totalRecords,
      success: true
    };
  }

  async runPgDump(outputPath) {
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL not configured - cannot run pg_dump');
    }

    console.log('[DatabaseBackup] Starting pg_dump...');
    console.log('[DatabaseBackup] Connection:', this.databaseUrl.replace(/:[^:]+@/, ':****@'));

    return new Promise((resolve, reject) => {
      const args = [
        '--no-owner',
        '--no-privileges',
        '--format=plain',
        '--file', outputPath,
        '--exclude-table-data=notification_events',
        '--exclude-table-data=audit_logs'
      ];

      const child = spawn(this.pgDumpPath || 'pg_dump', args, {
        shell: true,
        env: { ...process.env, PGPASSWORD: this.databaseUrl.split(':')[2]?.split('@')[0] || '' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          const stat = fs.statSync(outputPath);
          console.log(`[DatabaseBackup] pg_dump complete: ${stat.size} bytes`);
          resolve({
            filePath: outputPath,
            fileName: 'database.sql',
            size: stat.size,
            checksum: this.calculateChecksum(outputPath),
            success: true
          });
        } else {
          const errorMsg = `pg_dump failed with code ${code}: ${stderr}`;
          console.error('[DatabaseBackup]', errorMsg);
          reject(new Error(errorMsg));
        }
      });

      child.on('error', (err) => {
        console.error('[DatabaseBackup] pg_dump spawn error:', err.message);
        reject(err);
      });
    });
  }

  async runPgDumpWithConnectionString(outputPath) {
    if (!this.databaseUrl) {
      throw new Error('DATABASE_URL not configured - cannot run pg_dump');
    }

    console.log('[DatabaseBackup] Starting pg_dump with connection string...');

    return new Promise((resolve, reject) => {
      const args = [
        this.databaseUrl,
        '--no-owner',
        '--no-privileges',
        '--format=plain',
        '--file', outputPath
      ];

      const child = spawn(this.pgDumpPath || 'pg_dump', args, {
        shell: true,
        env: process.env
      });

      let stderr = '';

      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          const stat = fs.statSync(outputPath);
          console.log(`[DatabaseBackup] pg_dump complete: ${stat.size} bytes`);
          resolve({
            filePath: outputPath,
            fileName: 'database.sql',
            size: stat.size,
            checksum: this.calculateChecksum(outputPath),
            success: true
          });
        } else {
          const errorMsg = `pg_dump failed with code ${code}: ${stderr}`;
          console.error('[DatabaseBackup]', errorMsg);
          reject(new Error(errorMsg));
        }
      });

      child.on('error', (err) => {
        console.error('[DatabaseBackup] pg_dump spawn error:', err.message);
        reject(err);
      });
    });
  }

  async exportToSqlDump(outputDir) {
    await this.ensureTempDir();
    const outputPath = path.join(outputDir, 'database.sql');

    try {
      const result = await this.runPgDumpWithConnectionString(outputPath);
      return result;
    } catch (err) {
      console.error('[DatabaseBackup] SQL dump failed:', err.message);
      return {
        filePath: outputPath,
        fileName: 'database.sql',
        size: 0,
        checksum: null,
        success: false,
        error: err.message
      };
    }
  }

  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async runFullBackup(outputDir, options = {}) {
    const { includeSqlDump = true, includeJsonExport = true } = options;
    const results = {
      success: true,
      engine: this.getDbEngine(),
      timestamp: new Date().toISOString(),
      files: [],
      errors: []
    };

    console.log(`[DatabaseBackup] Starting full backup (engine: ${results.engine})`);

    if (includeJsonExport) {
      try {
        const jsonResult = await this.exportToJson(outputDir);
        results.files.push(jsonResult);
      } catch (err) {
        console.error('[DatabaseBackup] JSON export failed:', err.message);
        results.errors.push({ type: 'json', error: err.message });
        results.success = false;
      }
    }

    if (includeSqlDump && (results.engine === 'postgresql' || results.engine === 'supabase-postgresql')) {
      try {
        const sqlResult = await this.exportToSqlDump(outputDir);
        results.files.push(sqlResult);
      } catch (err) {
        console.error('[DatabaseBackup] SQL dump failed:', err.message);
        results.errors.push({ type: 'sql', error: err.message });
      }
    }

    const jsonFile = results.files.find(f => f.fileName === 'database-export.json');
    results.recordCounts = jsonFile?.recordCounts || {};
    results.totalRecords = jsonFile?.totalRecords || 0;
    results.jsonExportSuccess = !!jsonFile?.success;
    results.sqlDumpSuccess = results.files.some(f => f.fileName === 'database.sql' && f.success);

    console.log(`[DatabaseBackup] Complete - JSON: ${results.jsonExportSuccess}, SQL: ${results.sqlDumpSuccess}`);

    return results;
  }
}

export { DatabaseBackupService, BACKUP_VERSION };