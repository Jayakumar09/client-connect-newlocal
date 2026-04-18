import pg from 'pg';
import dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

const LOG_PREFIX = '[ProfileIdMigration]';

async function runMigration() {
  console.log(`${LOG_PREFIX} Starting Profile ID migration...`);
  console.log('='.repeat(50));

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dbPassword = process.env.DB_PASSWORD;
  const allowSelfSignedCert = process.env.DB_SSL_REJECT_UNAUTHORIZED?.toLowerCase() === 'false';

  const missingVars: string[] = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!serviceRoleKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!dbPassword) missingVars.push('DB_PASSWORD');

  if (missingVars.length > 0) {
    console.error(`${LOG_PREFIX} ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error(`${LOG_PREFIX} Please ensure all required variables are set in your .env file.`);
    process.exit(1);
  }

  const urlPattern = /^https:\/\/([^.]+)\.supabase\.co$/i;
  const urlMatch = supabaseUrl.match(urlPattern);
  
  if (!urlMatch) {
    console.error(`${LOG_PREFIX} ERROR: Invalid SUPABASE_URL format.`);
    console.error(`${LOG_PREFIX} Expected format: https://<project-ref>.supabase.co`);
    console.error(`${LOG_PREFIX} Received: ${supabaseUrl}`);
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  
  if (!projectRef || projectRef.length < 1) {
    console.error(`${LOG_PREFIX} ERROR: Could not extract project reference from SUPABASE_URL.`);
    process.exit(1);
  }

  console.log(`${LOG_PREFIX} Validated environment variables for project: ${projectRef}`);

  const connectionString = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`;
  
  console.log(`${LOG_PREFIX} Connecting to Supabase project: ${projectRef}`);
  
  let pool;
  try {
    pool = new Pool({ 
      connectionString,
      ssl: allowSelfSignedCert ? { rejectUnauthorized: false } : true
    });
    
    await pool.query('SELECT 1');
    console.log(`${LOG_PREFIX} Connected to Supabase PostgreSQL`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`${LOG_PREFIX} ERROR: Could not connect to Supabase database.`);
    console.error(`${LOG_PREFIX} Error: ${errorMessage}`);
    
    if (errorMessage.includes('ECONNREFUSED')) {
      console.error(`${LOG_PREFIX} Action: Check if your Supabase project is running and direct database access is enabled.`);
      console.error(`${LOG_PREFIX} Note: Direct PostgreSQL access may be disabled on Supabase free tier.`);
    } else if (errorMessage.includes('SSL')) {
      console.error(`${LOG_PREFIX} Action: Try setting DB_SSL_REJECT_UNAUTHORIZED=false in .env if using self-signed certificates.`);
    } else if (errorMessage.includes('authentication')) {
      console.error(`${LOG_PREFIX} Action: Verify DB_PASSWORD is correct for the postgres user.`);
    }
    
    console.error(`${LOG_PREFIX} Alternative: Run the SQL manually in Supabase Dashboard SQL Editor.`);
    process.exit(1);
  }

  try {
    console.log(`\n${LOG_PREFIX} Step 1a: Creating profile_id_sequence table...`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_id_sequence (
        id TEXT PRIMARY KEY DEFAULT 'global',
        last_number INTEGER NOT NULL DEFAULT 0,
        year_prefix TEXT NOT NULL DEFAULT 'VBM26',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      INSERT INTO profile_id_sequence (id, last_number, year_prefix)
      VALUES ('global', 0, 'VBM26')
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log(`${LOG_PREFIX}   profile_id_sequence table created/verified`);

    console.log(`\n${LOG_PREFIX} Step 1b: Creating get_next_profile_id function...`);
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_next_profile_id()
      RETURNS TEXT AS $$
      DECLARE
        new_id TEXT;
        v_last_number INTEGER;
        v_year_prefix TEXT;
      BEGIN
        UPDATE profile_id_sequence
        SET last_number = last_number + 1,
            updated_at = NOW()
        WHERE id = 'global'
        RETURNING last_number, year_prefix INTO v_last_number, v_year_prefix;
        
        new_id := v_year_prefix || '_' || LPAD(v_last_number::TEXT, 6, '0');
        
        RETURN new_id;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    console.log(`${LOG_PREFIX}   get_next_profile_id function created/updated`);

    console.log(`\n${LOG_PREFIX} Step 1c: Adding profile_id column to persons...`);
    
    try {
      await pool.query(`ALTER TABLE persons ADD COLUMN profile_id TEXT UNIQUE`);
      console.log(`${LOG_PREFIX}   Added profile_id to persons`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        console.log(`${LOG_PREFIX}   profile_id column already exists in persons`);
      } else {
        console.warn(`${LOG_PREFIX}   Warning adding profile_id to persons: ${errorMessage.substring(0, 150)}`);
      }
    }

    console.log(`\n${LOG_PREFIX} Step 1d: Adding profile_id column to client_profiles...`);
    
    try {
      await pool.query(`ALTER TABLE client_profiles ADD COLUMN profile_id TEXT UNIQUE`);
      console.log(`${LOG_PREFIX}   Added profile_id to client_profiles`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        console.log(`${LOG_PREFIX}   profile_id column already exists in client_profiles`);
      } else {
        console.warn(`${LOG_PREFIX}   Warning adding profile_id to client_profiles: ${errorMessage.substring(0, 150)}`);
      }
    }

    console.log(`\n${LOG_PREFIX} Step 1e: Creating trigger function...`);
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION assign_profile_id_on_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.profile_id IS NULL OR NEW.profile_id = '' THEN
          NEW.profile_id := get_next_profile_id();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    
    console.log(`${LOG_PREFIX}   assign_profile_id_on_insert function created`);

    console.log(`\n${LOG_PREFIX} Step 1f: Creating database triggers...`);
    
    try {
      await pool.query(`DROP TRIGGER IF EXISTS persons_profile_id_trigger ON persons`);
      await pool.query(`
        CREATE TRIGGER persons_profile_id_trigger
          BEFORE INSERT ON persons
          FOR EACH ROW
          EXECUTE FUNCTION assign_profile_id_on_insert()
      `);
      console.log(`${LOG_PREFIX}   Created trigger for persons`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`${LOG_PREFIX}   Warning creating persons trigger: ${errorMessage.substring(0, 150)}`);
    }

    try {
      await pool.query(`DROP TRIGGER IF EXISTS client_profiles_profile_id_trigger ON client_profiles`);
      await pool.query(`
        CREATE TRIGGER client_profiles_profile_id_trigger
          BEFORE INSERT ON client_profiles
          FOR EACH ROW
          EXECUTE FUNCTION assign_profile_id_on_insert()
      `);
      console.log(`${LOG_PREFIX}   Created trigger for client_profiles`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`${LOG_PREFIX}   Warning creating client_profiles trigger: ${errorMessage.substring(0, 150)}`);
    }

    console.log(`\n${LOG_PREFIX} Step 1g: Creating migration log table...`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profile_id_migration_log (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id UUID NOT NULL,
        old_slno INTEGER,
        profile_id TEXT NOT NULL,
        migrated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    console.log(`${LOG_PREFIX}   profile_id_migration_log table created/verified`);

    console.log(`\n${LOG_PREFIX} Step 1h: Creating indexes...`);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_persons_profile_id ON persons(profile_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_client_profiles_profile_id ON client_profiles(profile_id)`);
    
    console.log(`${LOG_PREFIX}   Indexes created/verified`);

    console.log(`\n${LOG_PREFIX} Schema migration completed!`);

    console.log(`\n${LOG_PREFIX} Step 2: Assigning Profile IDs to existing records...`);
    
    const personsResult = await pool.query(`
      SELECT id, created_at, COALESCE(slno, 0) as slno 
      FROM persons 
      WHERE profile_id IS NULL 
      ORDER BY created_at ASC NULLS LAST
    `);
    
    console.log(`${LOG_PREFIX}   Found ${personsResult.rows.length} persons without Profile IDs`);
    
    for (const person of personsResult.rows) {
      const newIdResult = await pool.query('SELECT get_next_profile_id() as new_id');
      const newId = newIdResult.rows[0].new_id;
      
      await pool.query('UPDATE persons SET profile_id = $1 WHERE id = $2', [newId, person.id]);
      await pool.query(
        'INSERT INTO profile_id_migration_log (table_name, record_id, old_slno, profile_id) VALUES ($1, $2, $3, $4)',
        ['persons', person.id, person.slno, newId]
      );
      console.log(`${LOG_PREFIX}   Assigned ${newId} to person (SL: ${person.slno})`);
    }

    const clientsResult = await pool.query(`
      SELECT id, created_at 
      FROM client_profiles 
      WHERE profile_id IS NULL 
      ORDER BY created_at ASC NULLS LAST
    `);
    
    console.log(`${LOG_PREFIX}   Found ${clientsResult.rows.length} client profiles without Profile IDs`);
    
    for (const profile of clientsResult.rows) {
      const newIdResult = await pool.query('SELECT get_next_profile_id() as new_id');
      const newId = newIdResult.rows[0].new_id;
      
      await pool.query('UPDATE client_profiles SET profile_id = $1 WHERE id = $2', [newId, profile.id]);
      await pool.query(
        'INSERT INTO profile_id_migration_log (table_name, record_id, profile_id) VALUES ($1, $2, $3)',
        ['client_profiles', profile.id, newId]
      );
      console.log(`${LOG_PREFIX}   Assigned ${newId} to client profile`);
    }

    console.log(`\n${LOG_PREFIX} Verifying migration results...`);

    const personsCount = await pool.query('SELECT COUNT(*) as count FROM persons WHERE profile_id IS NOT NULL');
    const clientsCount = await pool.query('SELECT COUNT(*) as count FROM client_profiles WHERE profile_id IS NOT NULL');
    const sequenceStatus = await pool.query('SELECT * FROM profile_id_sequence WHERE id = $1', ['global']);

    console.log(`\n${LOG_PREFIX} Migration Summary:`);
    console.log('='.repeat(50));
    console.log(`  Persons with Profile IDs:    ${personsCount.rows[0].count}`);
    console.log(`  Client Profiles with IDs:    ${clientsCount.rows[0].count}`);
    
    if (sequenceStatus.rows.length > 0) {
      const seq = sequenceStatus.rows[0];
      console.log(`  Last assigned number:        ${seq.last_number}`);
      console.log(`  Next Profile ID will be:    ${seq.year_prefix}_${(parseInt(seq.last_number) + 1).toString().padStart(6, '0')}`);
    }
    console.log('='.repeat(50));

    console.log(`\n${LOG_PREFIX} Sample Profile IDs:`);
    
    const samplePersons = await pool.query(
      'SELECT profile_id, name FROM persons WHERE profile_id IS NOT NULL ORDER BY created_at LIMIT 5'
    );
    
    const sampleClients = await pool.query(
      'SELECT profile_id, full_name FROM client_profiles WHERE profile_id IS NOT NULL ORDER BY created_at LIMIT 5'
    );

    if (samplePersons.rows.length > 0) {
      console.log(`  Admin Records (persons):`);
      samplePersons.rows.forEach(p => console.log(`    - ${p.profile_id}: ${p.name}`));
    }

    if (sampleClients.rows.length > 0) {
      console.log(`  Client Profiles:`);
      sampleClients.rows.forEach(p => console.log(`    - ${p.profile_id}: ${p.full_name}`));
    }

    console.log(`\n${LOG_PREFIX} Migration completed successfully!`);
    await pool.end();

  } catch (error) {
    console.error(`${LOG_PREFIX} ERROR: Migration failed:`, error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();