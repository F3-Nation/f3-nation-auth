import { db } from '@/db';
import {
  oauthClients,
  users,
  sessions,
  verificationTokens,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
} from '@/db/schema';

async function resetOauthClients() {
  await db.delete(oauthClients);
}

async function resetUserProfiles() {
  // Delete in order to respect foreign key constraints
  // Delete OAuth tokens and codes first
  await db.delete(oauthRefreshTokens);
  await db.delete(oauthAccessTokens);
  await db.delete(oauthAuthorizationCodes);

  // Delete verification tokens (email magic links)
  await db.delete(verificationTokens);

  // Delete user sessions
  await db.delete(sessions);

  // Finally delete users (main profiles table)
  await db.delete(users);
}

export async function resetAll() {
  await resetUserProfiles();
  await resetOauthClients();
}
