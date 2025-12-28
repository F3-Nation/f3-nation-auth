import { relations } from 'drizzle-orm/relations';
import {
  users,
  userProfiles,
  sessions,
  oauthClients,
  oauthAuthorizationCodes,
  oauthAccessTokens,
  oauthRefreshTokens,
} from '../db/schema';

// User relations - users can have profiles and auth records
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  sessions: many(sessions),
  oauthAuthorizationCodes: many(oauthAuthorizationCodes),
  oauthAccessTokens: many(oauthAccessTokens),
  oauthRefreshTokens: many(oauthRefreshTokens),
}));

// User profile relations
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

// Session relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// OAuth client relations
export const oauthClientsRelations = relations(oauthClients, ({ many }) => ({
  authorizationCodes: many(oauthAuthorizationCodes),
  accessTokens: many(oauthAccessTokens),
  refreshTokens: many(oauthRefreshTokens),
}));

// OAuth authorization code relations
export const oauthAuthorizationCodesRelations = relations(oauthAuthorizationCodes, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthAuthorizationCodes.clientId],
    references: [oauthClients.id],
  }),
  user: one(users, {
    fields: [oauthAuthorizationCodes.userId],
    references: [users.id],
  }),
}));

// OAuth access token relations
export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one, many }) => ({
  client: one(oauthClients, {
    fields: [oauthAccessTokens.clientId],
    references: [oauthClients.id],
  }),
  user: one(users, {
    fields: [oauthAccessTokens.userId],
    references: [users.id],
  }),
  refreshTokens: many(oauthRefreshTokens),
}));

// OAuth refresh token relations
export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one }) => ({
  accessToken: one(oauthAccessTokens, {
    fields: [oauthRefreshTokens.accessToken],
    references: [oauthAccessTokens.token],
  }),
  client: one(oauthClients, {
    fields: [oauthRefreshTokens.clientId],
    references: [oauthClients.id],
  }),
  user: one(users, {
    fields: [oauthRefreshTokens.userId],
    references: [users.id],
  }),
}));
