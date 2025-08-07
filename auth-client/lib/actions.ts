'use server';

import { AuthClient, type AuthClientConfig } from 'f3-nation-auth-sdk';

interface OauthClient {
  CLIENT_ID: string;
  REDIRECT_URI: string;
  AUTH_SERVER_URL: string;
}

interface OauthClients {
  [key: string]: OauthClient;
}

interface TokenExchangeParams {
  code: string;
  clientType: 'localClient' | 'f3AppClient' | 'f3App2Client';
}

// Create AuthClient configuration from environment variables
const authConfig: AuthClientConfig = {
  clients: {
    localClient: {
      CLIENT_ID: 'local-client',
      CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET_LOCAL_CLIENT || '',
      REDIRECT_URI: 'https://localhost:3001/callback',
      AUTH_SERVER_URL: process.env.AUTH_PROVIDER_URL || 'https://localhost:3000',
    },
    f3AppClient: {
      CLIENT_ID: 'f3-app-client',
      CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET_F3_APP_CLIENT || '',
      REDIRECT_URI: 'https://app.freemensworkout.org/callback',
      AUTH_SERVER_URL: process.env.AUTH_PROVIDER_URL || 'https://localhost:3000',
    },
    f3App2Client: {
      CLIENT_ID: 'f3-app2-client',
      CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET_F3_APP2_CLIENT || '',
      REDIRECT_URI: 'https://app2.freemensworkout.org/callback',
      AUTH_SERVER_URL: process.env.AUTH_PROVIDER_URL || 'https://localhost:3000',
    },
  },
};

// Create AuthClient instance
const authClient = new AuthClient(authConfig);

export async function getOAuthConfig(): Promise<OauthClients> {
  return authClient.getOAuthConfig();
}

export async function exchangeCodeForToken(params: TokenExchangeParams) {
  return authClient.exchangeCodeForToken(params);
}
