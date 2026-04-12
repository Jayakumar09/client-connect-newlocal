import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export class LocalPostgresRestoreService {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.pool = null;
    this.parsed = this.parseConnectionUrl(databaseUrl);
  }

  parseConnectionUrl(url) {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
      throw new Error(`Invalid DATABASE_URL format: ${url}`);
    }
    return {
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5]
    };
  }

  getConnectionInfo() {
    return {
      host: this.parsed.host,
      port: this.parsed.port,
      database: this.parsed.database,
      user: this.parsed.user
    };
  }

  async connect() {
    if (this.pool) {
      await this.pool.end();
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('[LocalPostgres] DATABASE CONNECTION INFO');
    console.log('='.repeat(60));
    console.log(`  Host:     ${this.parsed.host}`);
    console.log(`  Port:     ${this.parsed.port}`);
    console.log(`  Database: ${this.parsed.database}`);
    console.log(`  User:     ${this.parsed.user}`);
    console.log('='.repeat(60) + '\n');

    this.pool = new Pool({
      host: this.parsed.host,
      port: this.parsed.port,
      database: this.parsed.database,
      user: this.parsed.user,
      password: this.parsed.password,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT version()');
      console.log(`[LocalPostgres] Connected successfully!`);
      console.log(`[LocalPostgres] Server: ${result.rows[0].version.split(' ').slice(0, 4).join(' ')}`);
      client.release();
      return true;
    } catch (err) {
      console.error(`[LocalPostgres] Connection failed:`, err.message);
      throw err;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log(`[LocalPostgres] Disconnected`);
    }
  }

  async clearTable(tableName) {
    try {
      await this.pool.query(`DELETE FROM "${tableName}"`);
      console.log(`[LocalPostgres] Cleared table: ${tableName}`);
      return true;
    } catch (err) {
      console.warn(`[LocalPostgres] Could not clear ${tableName}: ${err.message}`);
      return false;
    }
  }

  async tableExists(tableName) {
    try {
      const result = await this.pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      return result.rows[0].exists;
    } catch (err) {
      console.error(`[LocalPostgres] Error checking table ${tableName}:`, err.message);
      return false;
    }
  }

  async getTableColumns(tableName) {
    try {
      const result = await this.pool.query(
        `SELECT column_name, data_type, is_nullable 
         FROM information_schema.columns 
         WHERE table_name = $1 
         ORDER BY ordinal_position`,
        [tableName]
      );
      return result.rows;
    } catch (err) {
      console.error(`[LocalPostgres] Error getting columns for ${tableName}:`, err.message);
      return [];
    }
  }

  async truncateTable(tableName) {
    try {
      await this.pool.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      console.log(`[LocalPostgres] Truncated table: ${tableName}`);
      return true;
    } catch (err) {
      console.warn(`[LocalPostgres] Could not truncate ${tableName}: ${err.message}`);
      return false;
    }
  }

  async truncateAllTables(excludeTables = ['spatial_ref_sys', 'geography_columns', 'geometry_columns']) {
    console.log(`[LocalPostgres] Truncating all tables...`);
    
    try {
      const result = await this.pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT IN ($1)
      `, [excludeTables.join("','")]);

      const tables = result.rows.map(r => r.tablename);
      
      if (tables.length === 0) {
        console.log(`[LocalPostgres] No tables to truncate`);
        return { success: true, truncated: 0 };
      }

      console.log(`[LocalPostgres] Found ${tables.length} tables: ${tables.join(', ')}`);
      
      await this.pool.query('BEGIN');
      
      for (const table of tables) {
        await this.pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
      }
      
      await this.pool.query('COMMIT');
      
      console.log(`[LocalPostgres] Truncated ${tables.length} tables successfully`);
      return { success: true, truncated: tables.length };
    } catch (err) {
      await this.pool.query('ROLLBACK');
      console.error(`[LocalPostgres] Error truncating tables:`, err.message);
      return { success: false, truncated: 0, error: err.message };
    }
  }

  async restoreTable(tableName, records, mode = 'upsert') {
    if (!records || records.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0, errors: 0 };
    }

    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorMessages: []
    };

    const tableExistsFlag = await this.tableExists(tableName);
    if (!tableExistsFlag) {
      console.log(`[LocalPostgres] Table "${tableName}" does not exist - run migrations first`);
      result.skipped = records.length;
      return result;
    }

    const columns = await this.getTableColumns(tableName);
    const columnNames = columns.map(c => c.column_name);

    let deleteDone = false;
    for (const record of records) {
      try {
        const recordColumns = Object.keys(record);
        const filteredColumns = recordColumns.filter(c => columnNames.includes(c));
        
        if (filteredColumns.length === 0) {
          result.skipped++;
          continue;
        }

        if (mode === 'replace' && !deleteDone) {
          await this.pool.query(`DELETE FROM "${tableName}"`);
          deleteDone = true;
        }

        if (mode === 'insert') {
          const values = filteredColumns.map((c, i) => `$${i + 1}`);
          const cols = filteredColumns.map(c => `"${c}"`);
          const params = filteredColumns.map(c => record[c]);
          
          const query = `INSERT INTO "${tableName}" (${cols.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`;
          await this.pool.query(query, params);
          result.inserted++;
        } else if (mode === 'upsert') {
          const hasId = recordColumns.includes('id') && record.id;
          
          if (hasId) {
            const checkResult = await this.pool.query(
              `SELECT 1 FROM "${tableName}" WHERE id = $1`,
              [record.id]
            );
            
            if (checkResult.rows.length > 0) {
              const setClause = filteredColumns
                .filter(c => c !== 'id')
                .map((c, i) => `"${c}" = $${i + 1}`)
                .join(', ');
              
              if (setClause) {
                const params = filteredColumns
                  .filter(c => c !== 'id')
                  .map(c => record[c]);
                params.push(record.id);
                
                const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${params.length}`;
                await this.pool.query(query, params);
                result.updated++;
              } else {
                result.skipped++;
              }
            } else {
              const values = filteredColumns.map((c, i) => `$${i + 1}`);
              const cols = filteredColumns.map(c => `"${c}"`);
              const params = filteredColumns.map(c => record[c]);
              
              const query = `INSERT INTO "${tableName}" (${cols.join(', ')}) VALUES (${values.join(', ')})`;
              await this.pool.query(query, params);
              result.inserted++;
            }
          } else {
            const values = filteredColumns.map((c, i) => `$${i + 1}`);
            const cols = filteredColumns.map(c => `"${c}"`);
            const params = filteredColumns.map(c => record[c]);
            
            const query = `INSERT INTO "${tableName}" (${cols.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`;
            await this.pool.query(query, params);
            result.inserted++;
          }
        } else if (mode === 'update') {
          const hasId = recordColumns.includes('id') && record.id;
          
          if (hasId) {
            const setClause = filteredColumns
              .filter(c => c !== 'id')
              .map((c, i) => `"${c}" = $${i + 1}`)
              .join(', ');
            
            if (setClause) {
              const params = filteredColumns
                .filter(c => c !== 'id')
                .map(c => record[c]);
              params.push(record.id);
              
              const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${params.length}`;
              await this.pool.query(query, params);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            result.skipped++;
          }
        }
      } catch (err) {
        result.errors++;
        result.errorMessages.push(`${tableName}: ${err.message}`);
        console.warn(`[LocalPostgres] Error in ${tableName}:`, err.message);
      }
    }

    return result;
  }

  async restoreDatabase(dbExport, options = {}) {
    const { mode = 'upsert', clearFirst = false } = options;
    
    console.log('\n' + '='.repeat(60));
    console.log('[LocalPostgres] DATABASE RESTORE STARTED');
    console.log('='.repeat(60));
    console.log(`  Mode: ${mode}`);
    console.log(`  Clear first: ${clearFirst}`);
    console.log('='.repeat(60) + '\n');

    const report = {
      tablesProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: 0,
      tables: []
    };

    const tableNames = Object.keys(dbExport);

    if (clearFirst) {
      console.log(`[LocalPostgres] Clearing all tables before restore...`);
      await this.truncateAllTables();
    }

    console.log(`[LocalPostgres] Processing ${tableNames.length} tables...\n`);

    for (const tableName of tableNames) {
      const tableData = dbExport[tableName];
      
      if (!tableData || !tableData.records) {
        console.log(`[LocalPostgres] Skipping ${tableName}: no records`);
        continue;
      }

      const records = tableData.records;
      console.log(`[LocalPostgres] Restoring ${tableName}: ${records.length} records...`);

      report.tablesProcessed++;
      const tableReport = {
        name: tableName,
        recordCount: records.length,
        ...await this.restoreTable(tableName, records, mode)
      };

      report.recordsInserted += tableReport.inserted;
      report.recordsUpdated += tableReport.updated;
      report.recordsSkipped += tableReport.skipped;
      report.errors += tableReport.errors;
      report.tables.push(tableReport);

      const status = tableReport.errors === 0 ? '✓' : '✗';
      console.log(`  ${status} ${tableName}: ${tableReport.inserted} inserted, ${tableReport.updated} updated, ${tableReport.skipped} skipped, ${tableReport.errors} errors`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('[LocalPostgres] DATABASE RESTORE COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Tables processed: ${report.tablesProcessed}`);
    console.log(`  Records inserted: ${report.recordsInserted}`);
    console.log(`  Records updated: ${report.recordsUpdated}`);
    console.log(`  Records skipped: ${report.recordsSkipped}`);
    console.log(`  Errors: ${report.errors}`);
    console.log('='.repeat(60) + '\n');

    return report;
  }

  async getTableCounts() {
    try {
      const result = await this.pool.query(`
        SELECT 
          table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const counts = [];
      for (const row of result.rows) {
        const tableName = row.table_name;
        try {
          const countResult = await this.pool.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
          counts.push({
            table: tableName,
            rows: parseInt(countResult.rows[0].cnt, 10)
          });
        } catch (e) {
          counts.push({ table: tableName, rows: -1, error: e.message });
        }
      }
      
      return counts;
    } catch (err) {
      console.error(`[LocalPostgres] Error getting table counts:`, err.message);
      return [];
    }
  }

  generateCreateTableSQL(tableName, records) {
    if (!records || records.length === 0) return null;
    
    const sample = records[0];
    const columns = [];
    
    for (const [key, value] of Object.entries(sample)) {
      let sqlType = 'TEXT';
      
      if (value === null) {
        sqlType = 'TEXT';
      } else if (typeof value === 'boolean') {
        sqlType = 'BOOLEAN';
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          if (key === 'id' || key.endsWith('_id')) {
            sqlType = 'UUID';
          } else {
            sqlType = 'INTEGER';
          }
        } else {
          sqlType = 'DECIMAL';
        }
      } else if (typeof value === 'string') {
        if (key === 'id' || key.endsWith('_id') || key === 'created_at' || key === 'updated_at') {
          if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            sqlType = 'UUID';
          } else if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)) {
            sqlType = 'TIMESTAMPTZ';
          } else if (key === 'created_at' || key === 'updated_at') {
            sqlType = 'TIMESTAMPTZ';
          } else {
            sqlType = 'VARCHAR(255)';
          }
        } else {
          sqlType = 'TEXT';
        }
      }
      
      const nullable = value === null ? '' : ' NOT NULL';
      columns.push(`  "${key}" ${sqlType}${nullable}`);
    }
    
    const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columns.join(',\n')}\n);\n`;
    return sql;
  }

  generateFullSchemaSQL(dbExport) {
    console.log(`\n[LocalPostgres] Generating CREATE TABLE statements...`);
    
    const statements = [];
    
    for (const [tableName, tableData] of Object.entries(dbExport)) {
      if (!tableData || !tableData.records || tableData.records.length === 0) continue;
      
      const createSQL = this.generateCreateTableSQL(tableName, tableData.records);
      if (createSQL) {
        statements.push(createSQL);
      }
    }
    
    return statements.join('\n');
  }

  async createSchemaFromExport(dbExport) {
    console.log(`\n[LocalPostgres] Attempting to create tables from export schema...`);
    
    let created = 0;
    let failed = 0;
    
    for (const [tableName, tableData] of Object.entries(dbExport)) {
      if (!tableData || !tableData.records || tableData.records.length === 0) continue;
      
      const exists = await this.tableExists(tableName);
      if (exists) {
        console.log(`[LocalPostgres] Table "${tableName}" already exists, skipping`);
        continue;
      }
      
      const createSQL = this.generateCreateTableSQL(tableName, tableData.records);
      if (!createSQL) continue;
      
      try {
        await this.pool.query(createSQL);
        console.log(`[LocalPostgres] Created table: "${tableName}"`);
        created++;
      } catch (err) {
        console.error(`[LocalPostgres] Failed to create "${tableName}":`, err.message);
        failed++;
      }
    }
    
    console.log(`\n[LocalPostgres] Schema creation complete: ${created} created, ${failed} failed`);
    return { created, failed };
  }

  async verifyRestore(originalExport) {
    console.log(`\n[LocalPostgres] Verifying restore...\n`);
    
    const counts = await this.getTableCounts();
    const totalRows = counts.reduce((sum, c) => sum + c.rows, 0);
    
    console.log('Table counts after restore:');
    for (const count of counts) {
      const original = originalExport[count.table];
      const expected = original?.records?.length || original?.count || 0;
      const match = count.rows >= expected;
      console.log(`  ${count.table}: ${count.rows} rows (expected: ${expected}) ${match ? '✓' : '✗'}`);
    }
    console.log(`\nTotal rows in database: ${totalRows}`);
    
    return { counts, totalRows };
  }
}

export default LocalPostgresRestoreService;
