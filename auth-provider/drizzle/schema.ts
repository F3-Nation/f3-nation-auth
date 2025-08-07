import {
  pgTable,
  foreignKey,
  text,
  timestamp,
  boolean,
  primaryKey,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const session = pgTable(
  'session',
  {
    sessionToken: text().primaryKey().notNull(),
    userId: text().notNull(),
    expires: timestamp({ mode: 'string' }).notNull(),
  },
  table => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'session_userId_user_id_fk',
    }).onDelete('cascade'),
  ]
);

export const user = pgTable('user', {
  id: text().primaryKey().notNull(),
  name: text(),
  email: text().notNull(),
  emailVerified: timestamp({ mode: 'string' }),
  image: text(),
  phone: text(),
});

export const oauthAuthorizationCode = pgTable(
  'oauth_authorization_code',
  {
    code: text().primaryKey().notNull(),
    clientId: text('client_id').notNull(),
    userId: text('user_id').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    scopes: text().notNull(),
    codeChallenge: text('code_challenge'),
    codeChallengeMethod: text('code_challenge_method'),
    expires: timestamp({ mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.id],
      name: 'oauth_authorization_code_client_id_oauth_client_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'oauth_authorization_code_user_id_user_id_fk',
    }).onDelete('cascade'),
  ]
);

export const oauthAccessToken = pgTable(
  'oauth_access_token',
  {
    token: text().primaryKey().notNull(),
    clientId: text('client_id').notNull(),
    userId: text('user_id').notNull(),
    scopes: text().notNull(),
    expires: timestamp({ mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.id],
      name: 'oauth_access_token_client_id_oauth_client_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'oauth_access_token_user_id_user_id_fk',
    }).onDelete('cascade'),
  ]
);

export const oauthClient = pgTable('oauth_client', {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUris: text('redirect_uris').notNull(),
  scopes: text().default('openid profile email').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const oauthRefreshToken = pgTable(
  'oauth_refresh_token',
  {
    token: text().primaryKey().notNull(),
    accessToken: text('access_token').notNull(),
    clientId: text('client_id').notNull(),
    userId: text('user_id').notNull(),
    expires: timestamp({ mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.accessToken],
      foreignColumns: [oauthAccessToken.token],
      name: 'oauth_refresh_token_access_token_oauth_access_token_token_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.clientId],
      foreignColumns: [oauthClient.id],
      name: 'oauth_refresh_token_client_id_oauth_client_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'oauth_refresh_token_user_id_user_id_fk',
    }).onDelete('cascade'),
  ]
);

export const verificationToken = pgTable(
  'verificationToken',
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: 'string' }).notNull(),
  },
  table => [
    primaryKey({
      columns: [table.identifier, table.token],
      name: 'verificationToken_identifier_token_pk',
    }),
  ]
);

export const account = pgTable(
  'account',
  {
    userId: text().notNull(),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text(),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  table => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'account_userId_user_id_fk',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.provider, table.providerAccountId],
      name: 'account_provider_providerAccountId_pk',
    }),
  ]
);
