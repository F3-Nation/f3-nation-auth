import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Use drizzle to wrap the PG pool with schema types
export const db = drizzle(pool, { schema });

// Export the database type for use in adapters
export type DB = typeof db;
