import { relations } from 'drizzle-orm/relations';
import {
  user,
  session,
  oauthClient,
  oauthAuthorizationCode,
  oauthAccessToken,
  oauthRefreshToken,
  account,
} from './schema';

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  oauthAuthorizationCodes: many(oauthAuthorizationCode),
  oauthAccessTokens: many(oauthAccessToken),
  oauthRefreshTokens: many(oauthRefreshToken),
  accounts: many(account),
}));

export const oauthAuthorizationCodeRelations = relations(oauthAuthorizationCode, ({ one }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthAuthorizationCode.clientId],
    references: [oauthClient.id],
  }),
  user: one(user, {
    fields: [oauthAuthorizationCode.userId],
    references: [user.id],
  }),
}));

export const oauthClientRelations = relations(oauthClient, ({ many }) => ({
  oauthAuthorizationCodes: many(oauthAuthorizationCode),
  oauthAccessTokens: many(oauthAccessToken),
  oauthRefreshTokens: many(oauthRefreshToken),
}));

export const oauthAccessTokenRelations = relations(oauthAccessToken, ({ one, many }) => ({
  oauthClient: one(oauthClient, {
    fields: [oauthAccessToken.clientId],
    references: [oauthClient.id],
  }),
  user: one(user, {
    fields: [oauthAccessToken.userId],
    references: [user.id],
  }),
  oauthRefreshTokens: many(oauthRefreshToken),
}));

export const oauthRefreshTokenRelations = relations(oauthRefreshToken, ({ one }) => ({
  oauthAccessToken: one(oauthAccessToken, {
    fields: [oauthRefreshToken.accessToken],
    references: [oauthAccessToken.token],
  }),
  oauthClient: one(oauthClient, {
    fields: [oauthRefreshToken.clientId],
    references: [oauthClient.id],
  }),
  user: one(user, {
    fields: [oauthRefreshToken.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
