/**
 * Custom migration runner for restricted database permissions.
 *
 * This script applies Drizzle-generated SQL migrations without requiring
 * CREATE SCHEMA privileges. It assumes the target schema already exists
 * and tracks applied migrations in auth.drizzle_migrations table.
 *
 * Usage:
 *   npx tsx scripts/db/migrate.ts
 *
 * Workflow:
 *   1. Develop locally with full permissions (local Docker DB)
 *   2. Generate migrations: npm run db:generate
 *   3. Deploy to prod: npm run db:deploy (uses this script)
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env.local') });

const MIGRATIONS_DIR = path.resolve(__dirname, '../../drizzle');
const MIGRATIONS_TABLE = 'drizzle_migrations';
const MIGRATIONS_SCHEMA = 'auth';

// Statements to skip (user doesn't have permission)
const SKIP_PATTERNS = [
  /^CREATE SCHEMA/i,
  /^-- NOTE:/i,
  /^-- Sync the users_id_seq/i,
  /^SELECT setval\('public\.users_id_seq'/i, // Can't modify public schema sequences
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();

    try {
      // Ensure migrations tracking table exists
      await ensureMigrationsTable(client);

      // Get already applied migrations
      const applied = await getAppliedMigrations(client);
      console.log(`📋 Found ${applied.size} applied migration(s)`);

      // Get all migration files
      const migrationFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

      console.log(`📁 Found ${migrationFiles.length} migration file(s)`);

      let appliedCount = 0;
      for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');

        if (applied.has(migrationName)) {
          console.log(`⏭️  Skipping ${file} (already applied)`);
          continue;
        }

        console.log(`🚀 Applying ${file}...`);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await applyMigration(client, migrationName, sql);
        appliedCount++;
        console.log(`✅ Applied ${file}`);
      }

      if (appliedCount === 0) {
        console.log('✨ Database is up to date');
      } else {
        console.log(`✨ Applied ${appliedCount} migration(s)`);
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function ensureMigrationsTable(client: import('pg').PoolClient) {
  // Create migrations table if it doesn't exist (in auth schema which we have access to)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
}

async function getAppliedMigrations(client: import('pg').PoolClient): Promise<Set<string>> {
  const result = await client.query(
    `SELECT name FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"`
  );
  return new Set(result.rows.map(r => r.name));
}

async function applyMigration(client: import('pg').PoolClient, name: string, sql: string) {
  // Split by Drizzle's statement breakpoint marker
  const statements = sql
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  await client.query('BEGIN');

  try {
    for (const stmt of statements) {
      // Check if we should skip this statement
      const shouldSkip = SKIP_PATTERNS.some(pattern => pattern.test(stmt));

      if (shouldSkip) {
        console.log(`   ⏭️  Skipping: ${stmt.substring(0, 50)}...`);
        continue;
      }

      // Execute the statement
      try {
        await client.query(stmt);
      } catch (err) {
        // Handle "already exists" errors gracefully (for idempotency)
        const pgErr = err as { code?: string; message?: string };
        if (pgErr.code === '42P07' || pgErr.code === '42710') {
          // 42P07 = duplicate_table, 42710 = duplicate_object
          console.log(`   ⚠️  Already exists, continuing: ${stmt.substring(0, 50)}...`);
        } else {
          throw err;
        }
      }
    }

    // Record the migration as applied
    await client.query(
      `INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (name) VALUES ($1)`,
      [name]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
