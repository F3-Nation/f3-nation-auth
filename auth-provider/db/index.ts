import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Use drizzle to wrap the PG pool with schema types
export const db = drizzle(pool, { schema });

// Export the database type for use in adapters
export type DB = typeof db;

// Sync the users_id_seq to continue after the max existing ID
// This ensures new user inserts don't conflict with existing data
let sequenceSynced = false;
export async function ensureSequenceSynced(): Promise<void> {
  if (sequenceSynced) return;
  try {
    await db.execute(
      sql`SELECT setval('public.users_id_seq', COALESCE((SELECT MAX(id) FROM public.users), 0))`
    );
    sequenceSynced = true;
  } catch (error) {
    console.error('Failed to sync users_id_seq:', error);
  }
}
