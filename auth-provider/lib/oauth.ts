import { db } from '@/db';
import {
  oauthClients,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
  users,
} from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { encodeState, decodeState } from './state-utils';

export interface OAuthClient {
  id: string;
  name: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  createdAt: Date;
  isActive: boolean;
}

export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string; // Encoded state containing CSRF token and other metadata
  code_challenge?: string;
  code_challenge_method?: string;
}

export interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
}

// Generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

export function generateAuthorizationState(
  csrfToken: string,
  clientId?: string,
  returnTo?: string
): string {
  return encodeState({
    csrfToken,
    ...(clientId && { clientId }),
    ...(returnTo && { returnTo }),
    timestamp: Date.now(),
  });
}

export function validateAuthorizationState(state: string): {
  csrfToken: string;
  clientId?: string;
  returnTo?: string;
} {
  try {
    const decoded = decodeState(state);
    if (!decoded.csrfToken) {
      throw new Error('Invalid state: missing csrfToken');
    }
    return decoded;
  } catch {
    throw new Error('Invalid state parameter');
  }
}

// Validate OAuth client
export async function validateClient(
  clientId: string,
  clientSecret?: string
): Promise<OAuthClient | null> {
  const client = await db
    .select()
    .from(oauthClients)
    .where(and(eq(oauthClients.id, clientId), eq(oauthClients.isActive, true)))
    .limit(1);

  if (!client.length) return null;

  const clientData = client[0];

  // If client secret is provided, validate it
  if (clientSecret && clientData.clientSecret !== clientSecret) {
    return null;
  }

  return {
    id: clientData.id,
    name: clientData.name,
    clientSecret: clientData.clientSecret,
    redirectUris: JSON.parse(clientData.redirectUris),
    scopes: clientData.scopes.split(' '),
    createdAt: clientData.createdAt,
    isActive: clientData.isActive,
  };
}

// Validate redirect URI
export function validateRedirectUri(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

// Validate scopes
export function validateScopes(client: OAuthClient, requestedScopes: string[]): boolean {
  return requestedScopes.every(scope => client.scopes.includes(scope));
}

// Create authorization code
export async function createAuthorizationCode(
  clientId: string,
  userId: string,
  redirectUri: string,
  scopes: string[],
  codeChallenge?: string,
  codeChallengeMethod?: string
): Promise<string> {
  const code = generateSecureToken();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(oauthAuthorizationCodes).values({
    code,
    clientId,
    userId,
    redirectUri,
    scopes: scopes.join(' '),
    codeChallenge,
    codeChallengeMethod,
    expires,
  });

  return code;
}

// Validate and consume authorization code
export async function validateAuthorizationCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{ userId: string; scopes: string[] } | null> {
  const authCode = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(
      and(
        eq(oauthAuthorizationCodes.code, code),
        eq(oauthAuthorizationCodes.clientId, clientId),
        eq(oauthAuthorizationCodes.redirectUri, redirectUri),
        gt(oauthAuthorizationCodes.expires, new Date())
      )
    )
    .limit(1);

  if (!authCode.length) return null;

  const codeData = authCode[0];

  // Validate PKCE if used
  if (codeData.codeChallenge && codeData.codeChallengeMethod) {
    if (!codeVerifier) return null;

    let challenge: string;
    if (codeData.codeChallengeMethod === 'S256') {
      challenge = createHash('sha256').update(codeVerifier).digest('base64url');
    } else if (codeData.codeChallengeMethod === 'plain') {
      challenge = codeVerifier;
    } else {
      return null;
    }

    if (challenge !== codeData.codeChallenge) return null;
  }

  // Delete the authorization code (one-time use)
  await db.delete(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.code, code));

  return {
    userId: codeData.userId,
    scopes: codeData.scopes.split(' '),
  };
}

// Create access token
export async function createAccessToken(
  clientId: string,
  userId: string,
  scopes: string[]
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = generateSecureToken();
  const refreshToken = generateSecureToken();
  const expiresIn = 3600; // 1 hour
  const expires = new Date(Date.now() + expiresIn * 1000);
  const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Insert access token
  await db.insert(oauthAccessTokens).values({
    token: accessToken,
    clientId,
    userId,
    scopes: scopes.join(' '),
    expires,
  });

  // Insert refresh token
  await db.insert(oauthRefreshTokens).values({
    token: refreshToken,
    accessToken,
    clientId,
    userId,
    expires: refreshExpires,
  });

  return { accessToken, refreshToken, expiresIn };
}

// Validate access token
export async function validateAccessToken(
  token: string
): Promise<{ userId: string; scopes: string[]; clientId: string } | null> {
  const accessToken = await db
    .select()
    .from(oauthAccessTokens)
    .where(and(eq(oauthAccessTokens.token, token), gt(oauthAccessTokens.expires, new Date())))
    .limit(1);

  if (!accessToken.length) return null;

  const tokenData = accessToken[0];
  return {
    userId: tokenData.userId,
    scopes: tokenData.scopes.split(' '),
    clientId: tokenData.clientId,
  };
}

// Refresh access token
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const refresh = await db
    .select()
    .from(oauthRefreshTokens)
    .where(
      and(
        eq(oauthRefreshTokens.token, refreshToken),
        eq(oauthRefreshTokens.clientId, clientId),
        gt(oauthRefreshTokens.expires, new Date())
      )
    )
    .limit(1);

  if (!refresh.length) return null;

  const refreshData = refresh[0];

  // Get the old access token to get scopes
  const oldAccessToken = await db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.token, refreshData.accessToken))
    .limit(1);

  if (!oldAccessToken.length) return null;

  const scopes = oldAccessToken[0].scopes.split(' ');

  // Delete old tokens
  await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.token, refreshData.accessToken));
  await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.token, refreshToken));

  // Create new tokens
  return await createAccessToken(clientId, refreshData.userId, scopes);
}

// Get user info for token
export async function getUserInfo(userId: string, scopes: string[]) {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user.length) return null;

  const userData = user[0];
  const userInfo: Record<string, unknown> = { sub: userId };

  if (scopes.includes('profile')) {
    userInfo.name = userData.f3Name;
    userInfo.picture = userData.image;
  }

  if (scopes.includes('email')) {
    userInfo.email = userData.email;
    userInfo.email_verified = !!userData.emailVerified;
  }

  return userInfo;
}

// Register a new OAuth client (for development/admin use)
export async function registerClient(
  name: string,
  redirectUris: string[],
  scopes: string[] = ['openid', 'profile', 'email']
): Promise<{ clientId: string; clientSecret: string }> {
  const clientId = generateSecureToken(16);
  const clientSecret = generateSecureToken(32);

  await db.insert(oauthClients).values({
    id: clientId,
    name,
    clientSecret,
    redirectUris: JSON.stringify(redirectUris),
    scopes: scopes.join(' '),
  });

  return { clientId, clientSecret };
}
