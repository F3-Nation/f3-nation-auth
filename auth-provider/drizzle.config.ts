import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';
import path from 'path';

config({ path: path.resolve(__dirname, '.env.local') });

export default {
  schema: './db/schema.ts',
  out: './drizzle', // Directory to store migration files
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
} satisfies Config;
