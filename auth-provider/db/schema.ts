import {
  pgTable,
  pgSchema,
  text,
  integer,
  timestamp,
  primaryKey,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './external/users';

// Re-export external users for convenience
export { users };

// Define the auth schema namespace
export const authSchema = pgSchema('auth');

// User profiles table - auth-specific fields for users
// Links to public.users via userId FK
export const userProfiles = authSchema.table('user_profiles', {
  userId: integer('user_id')
    .notNull()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  hospitalName: text('hospital_name'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Sessions table - stores sessions for users when using database sessions
export const sessions = authSchema.table('sessions', {
  sessionToken: text('session_token').notNull().primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

// Verification tokens table - stores tokens for email magic link sign-in
export const verificationTokens = authSchema.table(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  vt => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// OAuth Clients table - stores registered OAuth client applications
export const oauthClients = authSchema.table('oauth_clients', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUris: text('redirect_uris').notNull(), // JSON array of allowed redirect URIs
  allowedOrigin: text('allowed_origin').notNull(), // Allowed CORS origin
  scopes: text('scopes').notNull().default('openid profile email'), // Space-separated scopes
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

// OAuth Authorization Codes table - stores temporary authorization codes
export const oauthAuthorizationCodes = authSchema.table('oauth_authorization_codes', {
  code: text('code').notNull().primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scopes: text('scopes').notNull(),
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// OAuth Access Tokens table - stores issued access tokens
export const oauthAccessTokens = authSchema.table('oauth_access_tokens', {
  token: text('token').notNull().primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scopes: text('scopes').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// OAuth Refresh Tokens table - stores refresh tokens
export const oauthRefreshTokens = authSchema.table('oauth_refresh_tokens', {
  token: text('token').notNull().primaryKey(),
  accessToken: text('access_token')
    .notNull()
    .references(() => oauthAccessTokens.token, { onDelete: 'cascade' }),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Email MFA codes - stores verification codes issued for email MFA flows
export const emailMfaCodes = authSchema.table(
  'email_mfa_codes',
  {
    id: text('id').notNull().primaryKey(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    emailIdx: index('email_mfa_code_email_idx').on(table.email),
    expiresIdx: index('email_mfa_code_expires_idx').on(table.expiresAt),
  })
);

// Type exports
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type OAuthAuthorizationCode = typeof oauthAuthorizationCodes.$inferSelect;
export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect;
export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect;
export type EmailMfaCode = typeof emailMfaCodes.$inferSelect;
