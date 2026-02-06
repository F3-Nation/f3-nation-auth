import { config } from 'dotenv';
import path from 'path';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { oauthClients } from '../db/schema';

// --- Parse --env flag ---
const envFlag = (() => {
  const idx = process.argv.indexOf('--env');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return 'local';
})();

const envFile = `.env.${envFlag}`;
config({ path: path.resolve(__dirname, '..', envFile) });

if (!process.env.DATABASE_URL) {
  console.error(`ERROR: DATABASE_URL not found in ${envFile}`);
  process.exit(1);
}

// --- Standalone DB connection (not importing db/index.ts) ---
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const rl = createInterface({ input: stdin, output: stdout });

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`? ${question}${suffix}: `)).trim();
  return answer || defaultValue || '';
}

async function promptYesNo(question: string, defaultNo = true): Promise<boolean> {
  const hint = defaultNo ? '(y/N)' : '(Y/n)';
  const answer = (await rl.question(`? ${question} ${hint}: `)).trim().toLowerCase();
  if (defaultNo) return answer === 'y' || answer === 'yes';
  return answer !== 'n' && answer !== 'no';
}

function validateClientId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(id);
}

function isValidRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === 'https:' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

function validateRedirectUris(uris: string[]): void {
  const invalid = uris.filter(u => !isValidRedirectUri(u));
  if (invalid.length > 0) {
    console.error(`ERROR: Invalid redirect URI(s): ${invalid.join(', ')}`);
    console.error('Redirect URIs must be valid HTTPS URLs (or localhost for development).');
    process.exit(1);
  }
}

async function main() {
  // Test DB connection
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`ERROR: Could not connect to database using ${envFile}`);
    console.error((err as Error).message);
    process.exit(1);
  }

  console.log('\n=== F3 Nation Auth — Add/Update OAuth Client ===\n');

  // --- Step 1: Get client name ---
  const name = await prompt('Client name');
  if (!name) {
    console.error('ERROR: Client name is required.');
    process.exit(1);
  }

  // --- Step 2: Check if client exists ---
  const existing = await db.select().from(oauthClients).where(eq(oauthClients.name, name)).limit(1);

  let mode: 'CREATE' | 'UPDATE';
  let clientId: string;
  let redirectUris: string[];
  let allowedOrigin: string;
  let scopes: string;

  if (existing.length > 0) {
    // --- UPDATE mode ---
    const client = existing[0];
    const parsedUris: string[] = JSON.parse(client.redirectUris);

    console.log(`\nFound existing client "${client.name}" (ID: ${client.id})`);
    console.log(`  Redirect URIs: ${parsedUris.join(', ')}`);
    console.log(`  Allowed origin: ${client.allowedOrigin}`);
    console.log(`  Scopes: ${client.scopes}`);
    console.log(`\nUpdating will regenerate the client secret.`);

    const proceed = await promptYesNo('Update this client?');
    if (!proceed) {
      console.log('Aborted.');
      process.exit(0);
    }

    mode = 'UPDATE';
    clientId = client.id;

    const urisInput = await prompt('Redirect URIs (comma-separated)', parsedUris.join(', '));
    redirectUris = urisInput
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);
    validateRedirectUris(redirectUris);

    allowedOrigin = await prompt('Allowed origin', client.allowedOrigin);
    scopes = await prompt('Scopes', client.scopes);
  } else {
    // --- CREATE mode ---
    mode = 'CREATE';

    const rawId = await prompt('Client ID (Enter to auto-generate)');
    if (!rawId) {
      clientId = randomBytes(8).toString('hex');
    } else {
      if (!validateClientId(rawId)) {
        console.error(
          'ERROR: Client ID must be lowercase alphanumeric with hyphens (e.g. "pax-vault-prod").'
        );
        process.exit(1);
      }
      // Check for ID collision
      const idCollision = await db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.id, rawId))
        .limit(1);
      if (idCollision.length > 0) {
        console.error(
          `ERROR: A client with ID "${rawId}" already exists (name: "${idCollision[0].name}").`
        );
        process.exit(1);
      }
      clientId = rawId;
    }

    const urisInput = await prompt('Redirect URIs (comma-separated)');
    redirectUris = urisInput
      .split(',')
      .map(u => u.trim())
      .filter(Boolean);
    if (redirectUris.length === 0) {
      console.error('ERROR: At least one redirect URI is required.');
      process.exit(1);
    }
    validateRedirectUris(redirectUris);

    allowedOrigin = await prompt('Allowed origin');
    if (!allowedOrigin) {
      console.error('ERROR: Allowed origin is required.');
      process.exit(1);
    }

    scopes = await prompt('Scopes', 'openid profile email');
  }

  // --- Step 3: Review ---
  console.log('\n--- Review ---');
  console.log(`  Name:          ${name}`);
  console.log(`  Client ID:     ${clientId}`);
  console.log(`  Redirect URIs: ${JSON.stringify(redirectUris)}`);
  console.log(`  Allowed origin: ${allowedOrigin}`);
  console.log(`  Scopes:        ${scopes}`);
  console.log(`  Mode:          ${mode}`);

  const confirm = await promptYesNo('\nProceed?');
  if (!confirm) {
    console.log('Aborted.');
    process.exit(0);
  }

  // --- Step 4: Generate secret and upsert ---
  const clientSecret = randomBytes(32).toString('base64url');

  if (mode === 'CREATE') {
    await db.insert(oauthClients).values({
      id: clientId,
      name,
      clientSecret,
      redirectUris: JSON.stringify(redirectUris),
      allowedOrigin,
      scopes,
    });
    console.log('\n✓ Client created.');
  } else {
    await db
      .update(oauthClients)
      .set({
        clientSecret,
        redirectUris: JSON.stringify(redirectUris),
        allowedOrigin,
        scopes,
      })
      .where(eq(oauthClients.id, clientId));
    console.log('\n✓ Client updated.');
  }

  // --- Step 5: Print credentials ---
  console.log(`\n  Client ID:     ${clientId}`);
  console.log(`  Client Secret: ${clientSecret}`);
  console.log('\n  Save the client secret now — it cannot be retrieved later.');
  console.log('\n  Next steps:');
  console.log(`  1. Add "${allowedOrigin}" to ALLOWED_ORIGINS in auth-provider env`);
  console.log(
    '  2. Set OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REDIRECT_URI in the consumer app'
  );
  console.log('  3. Redeploy auth-provider if ALLOWED_ORIGINS changed\n');
}

main()
  .catch(err => {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    rl.close();
    await pool.end();
  });
