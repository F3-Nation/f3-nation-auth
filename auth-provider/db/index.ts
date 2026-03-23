import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';
import * as schema from './schema';

let connector: Connector | null = null;
let poolPromise: Promise<Pool> | null = null;

function getSearchPath(): string {
  const raw = process.env.DB_SCHEMA ?? 'public';
  const schemaNames = raw
    .split(',')
    .map(schemaName => schemaName.trim())
    .filter(Boolean);

  if (schemaNames.length === 0) {
    throw new Error('DB_SCHEMA must include at least one schema name.');
  }

  const validSchemaName = /^[A-Za-z_][A-Za-z0-9_]*$/;
  for (const schemaName of schemaNames) {
    if (!validSchemaName.test(schemaName)) {
      throw new Error(
        'DB_SCHEMA contains invalid schema names. Use comma-separated schema names with letters, numbers, and underscores only.'
      );
    }
  }

  return schemaNames.map(schemaName => `"${schemaName}"`).join(',');
}

function hasSearchPathInConnectionString(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    if (parsed.searchParams.has('search_path') || parsed.searchParams.has('currentSchema')) {
      return true;
    }

    const options = parsed.searchParams.get('options');
    return options ? /\bsearch_path\s*=/.test(decodeURIComponent(options)) : false;
  } catch {
    return false;
  }
}

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
  const searchPath = getSearchPath();

  return new Pool({
    ...clientOpts,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    options: `-c search_path=${searchPath}`,
  });
}

function createDirectPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Cannot connect to the database.');
  }

  const searchPath = getSearchPath();
  if (hasSearchPathInConnectionString(connectionString)) {
    return new Pool({ connectionString });
  }

  return new Pool({ connectionString, options: `-c search_path=${searchPath}` });
}

async function createPool(): Promise<Pool> {
  const mode = process.env.DB_CONNECTION_MODE ?? 'direct';
  return mode === 'connector' ? createCloudSqlPool() : createDirectPool();
}

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPool();
    poolPromise
      .then(pool => {
        pool.on('error', err => {
          console.error('Unexpected error on idle PostgreSQL client:', err);
        });
      })
      .catch(err => {
        console.error('Failed to initialize PostgreSQL pool:', err);
      });
  }

  return poolPromise;
}

const poolProxy = {
  async query(...args: Parameters<Pool['query']>) {
    const pool = await getPool();
    return pool.query(...args);
  },
  async connect(...args: Parameters<Pool['connect']>) {
    const pool = await getPool();
    return pool.connect(...args);
  },
  async end(...args: Parameters<Pool['end']>) {
    const pool = await getPool();
    return pool.end(...args);
  },
} as unknown as Pool;

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
