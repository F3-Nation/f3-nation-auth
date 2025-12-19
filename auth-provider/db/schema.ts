import { pgTable, text, integer, timestamp, primaryKey, boolean, index } from 'drizzle-orm/pg-core';

// Users table – stores basic profile info for each user
export const users = pgTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'), // NextAuth expects this field - we'll sync it with f3Name
  f3Name: text('f3_name'),
  hospitalName: text('hospital_name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified'),
  image: text('image'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
});

// Sessions table – stores sessions for users when using database sessions
export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

// VerificationTokens table – stores tokens for email magic link sign-in (if used)
export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires').notNull(),
  },
  vt => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// OAuth Clients table – stores registered OAuth client applications
export const oauthClients = pgTable('oauth_client', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUris: text('redirect_uris').notNull(), // JSON array of allowed redirect URIs
  allowedOrigin: text('allowed_origin').notNull(), // Allowed CORS origin
  scopes: text('scopes').notNull().default('openid profile email'), // Space-separated scopes
  createdAt: timestamp('created_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

// OAuth Authorization Codes table – stores temporary authorization codes
export const oauthAuthorizationCodes = pgTable('oauth_authorization_code', {
  code: text('code').notNull().primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scopes: text('scopes').notNull(),
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// OAuth Access Tokens table – stores issued access tokens
export const oauthAccessTokens = pgTable('oauth_access_token', {
  token: text('token').notNull().primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scopes: text('scopes').notNull(),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// OAuth Refresh Tokens table – stores refresh tokens
export const oauthRefreshTokens = pgTable('oauth_refresh_token', {
  token: text('token').notNull().primaryKey(),
  accessToken: text('access_token')
    .notNull()
    .references(() => oauthAccessTokens.token, { onDelete: 'cascade' }),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Email MFA codes – stores verification codes issued for email MFA flows
export const emailMfaCodes = pgTable(
  'email_mfa_code',
  {
    id: text('id').notNull().primaryKey(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    attemptCount: integer('attempt_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    emailIdx: index('email_mfa_code_email_idx').on(table.email),
    expiresIdx: index('email_mfa_code_expires_idx').on(table.expiresAt),
  })
);

// Email Change Requests – tracks pending email address changes requiring dual verification
export const emailChangeRequests = pgTable(
  'email_change_request',
  {
    id: text('id').notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currentEmail: text('current_email').notNull(),
    newEmail: text('new_email').notNull(),
    oldEmailVerified: boolean('old_email_verified').notNull().default(false),
    newEmailVerified: boolean('new_email_verified').notNull().default(false),
    oldEmailCodeHash: text('old_email_code_hash'),
    newEmailCodeHash: text('new_email_code_hash'),
    oldEmailVerifiedAt: timestamp('old_email_verified_at'),
    newEmailVerifiedAt: timestamp('new_email_verified_at'),
    oldEmailAttemptCount: integer('old_email_attempt_count').notNull().default(0),
    newEmailAttemptCount: integer('new_email_attempt_count').notNull().default(0),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  table => ({
    userIdx: index('email_change_request_user_idx').on(table.userId),
    expiresIdx: index('email_change_request_expires_idx').on(table.expiresAt),
  })
);
