import { config } from 'dotenv';
import path from 'path';
import { db } from '@/db';
import { oauthClients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { clients } from '@/oauth-clients';

// Load environment variables
config({ path: path.resolve(__dirname, '../.env.local') });

async function seedOAuthClient(client: any) {
  console.log(`🌱 Seeding OAuth client: ${client.name}...`);

  try {
    // Check if client already exists
    const existingClient = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.id, client.id))
      .limit(1);

    if (existingClient.length > 0) {
      console.log(`📝 Client "${client.name}" already exists, updating...`);

      // Update existing client
      await db
        .update(oauthClients)
        .set({
          name: client.name,
          clientSecret: client.clientSecret,
          redirectUris: JSON.stringify(client.redirectUris),
          scopes: client.scopes,
          isActive: client.isActive,
        })
        .where(eq(oauthClients.id, client.id));

      console.log(`✅ Client "${client.name}" updated successfully!`);
    } else {
      console.log(`➕ Creating new client: ${client.name}...`);

      // Insert new client
      await db
        .insert(oauthClients)
        .values({
          ...client,
          redirectUris: JSON.stringify(client.redirectUris),
        })
        .onConflictDoUpdate({
          target: oauthClients.id,
          set: {
            name: client.name,
            clientSecret: client.clientSecret,
            redirectUris: JSON.stringify(client.redirectUris),
            scopes: client.scopes,
            isActive: client.isActive,
          },
        });

      console.log(`✅ Client "${client.name}" created successfully!`);
    }

    // Verify the client was created/updated
    const verifyClient = await db
      .select({
        id: oauthClients.id,
        name: oauthClients.name,
        redirectUris: oauthClients.redirectUris,
        scopes: oauthClients.scopes,
        isActive: oauthClients.isActive,
        createdAt: oauthClients.createdAt,
      })
      .from(oauthClients)
      .where(eq(oauthClients.id, client.id))
      .limit(1);

    if (verifyClient.length > 0) {
      console.log(`\n📋 ${client.name} Details:`);
      console.log('==================');
      console.log(`ID: ${verifyClient[0].id}`);
      console.log(`Name: ${verifyClient[0].name}`);
      console.log(`Redirect URIs: ${verifyClient[0].redirectUris}`);
      console.log(`Scopes: ${verifyClient[0].scopes}`);
      console.log(`Active: ${verifyClient[0].isActive}`);
      console.log(`Created: ${verifyClient[0].createdAt}`);
    }
  } catch (error) {
    console.error(`❌ Error seeding OAuth client "${client.name}":`, error);
    throw error;
  }
}

export async function seedAllClients() {
  console.log('🌱 Seeding OAuth clients...');

  try {
    // Seed each client
    for (const client of clients) {
      await seedOAuthClient(client);
    }

    console.log('\n🎉 All OAuth clients seeded successfully!');
    console.log('\n💡 Production apps can now authenticate with:');
    const dbClients = await db.select().from(oauthClients).orderBy(oauthClients.name);
    for (const client of dbClients) {
      try {
        const authUrl = new URL(JSON.parse(client.redirectUris)[0]);
        console.log(`   • ${client.name}: ${authUrl.protocol}//${authUrl.host}`);
      } catch (e) {
        console.warn(`   • ${client.name}: WARN invalid authUrl: ${e}`);
      }
    }
  } catch (error) {
    console.error('❌ Error seeding OAuth clients:', error);
    process.exit(1);
  }
}
