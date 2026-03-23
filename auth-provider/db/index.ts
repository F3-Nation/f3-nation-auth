import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import * as schema from './schema';

let connector: Connector | null = null;

async function createCloudSqlPool(): Promise<Pool> {
  const instanceConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME;

  if (!instanceConnectionName || !dbUser || !dbPassword || !dbName) {
    throw new Error(
      'Cloud SQL Connector requires CLOUD_SQL_CONNECTION_NAME, DB_USER, DB_PASSWORD, and DB_NAME.'
    );
  }

  const validTypes = Object.values(IpAddressTypes) as string[];
  const ipAddressType = validTypes.includes(process.env.CLOUD_SQL_IP_TYPE ?? '')
    ? (process.env.CLOUD_SQL_IP_TYPE as IpAddressTypes)
    : IpAddressTypes.PUBLIC;

  connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType: ipAddressType,
  });

  return new Pool({
    ...clientOpts,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });
}

function createDirectPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Cannot connect to the database.');
  }

  return new Pool({ connectionString });
}

async function createPool(): Promise<Pool> {
  const mode = process.env.DB_CONNECTION_MODE ?? 'direct';
  return mode === 'connector' ? createCloudSqlPool() : createDirectPool();
}

const poolPromise = createPool();

const poolProxy = {
  async query(...args: Parameters<Pool['query']>) {
    const pool = await poolPromise;
    return pool.query(...args);
  },
  async connect(...args: Parameters<Pool['connect']>) {
    const pool = await poolPromise;
    return pool.connect(...args);
  },
  async end(...args: Parameters<Pool['end']>) {
    const pool = await poolPromise;
    return pool.end(...args);
  },
} as unknown as Pool;

poolPromise
  .then(pool => {
    pool.on('error', err => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  })
  .catch(err => {
    console.error('Failed to initialize PostgreSQL pool:', err);
    process.exit(1);
  });

async function closeConnector() {
  if (connector) {
    await connector.close();
    connector = null;
  }
}

process.once('SIGTERM', () => {
  void closeConnector();
});

process.once('SIGINT', () => {
  void closeConnector();
});

// Use drizzle to wrap the PG pool with schema types
export const db = drizzle(poolProxy, { schema });

// Export the database type for use in adapters
export type DB = typeof db;
