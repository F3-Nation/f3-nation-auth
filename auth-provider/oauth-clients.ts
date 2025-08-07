interface OauthClient {
  id: string;
  name: string;
  clientSecret: string;
  redirectUris: string[];
  allowedOrigin: string;
  scopes: string;
  isActive: boolean;
}

export const clients: OauthClient[] = [
  {
    id: 'local-client',
    name: 'Local Client',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_LOCAL_CLIENT || '',
    redirectUris: ['https://localhost:3001/callback'],
    allowedOrigin: 'https://localhost:3001',
    scopes: 'openid profile email',
    isActive: true,
  },
  {
    id: 'f3-app-client',
    name: 'F3 Workout App (Production)',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_F3_APP_CLIENT || '',
    redirectUris: [
      'https://app.freemensworkout.org/callback',
      'https://app.freemensworkout.org/auth/callback',
    ],
    allowedOrigin: 'https://app.freemensworkout.org',
    scopes: 'openid profile email',
    isActive: true,
  },
  {
    id: 'f3-app2-client',
    name: 'F3 Workout App 2 (Production)',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_F3_APP2_CLIENT || '',
    redirectUris: [
      'https://app2.freemensworkout.org/callback',
      'https://app2.freemensworkout.org/auth/callback',
    ],
    allowedOrigin: 'https://app2.freemensworkout.org',
    scopes: 'openid profile email',
    isActive: true,
  },
  {
    id: 'auth-provider-local',
    name: 'Auth Provider (Local)',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_AUTH_PROVIDER_LOCAL || '',
    redirectUris: [
      'https://localhost:3000/callback',
      'https://localhost:3000/api/auth/callback/oauth',
    ],
    allowedOrigin: 'https://localhost:3000',
    scopes: 'openid profile email',
    isActive: true,
  },
  {
    id: 'auth-provider-prod',
    name: 'Auth Provider (Production)',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_AUTH_PROVIDER_PROD || '',
    redirectUris: [
      'https://auth.f3nation.com/callback',
      'https://auth.f3nation.com/api/auth/callback/oauth',
    ],
    allowedOrigin: 'https://auth.f3nation.com',
    scopes: 'openid profile email',
    isActive: true,
  },
  {
    id: 'codex-staging',
    name: 'Codex Staging',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_CODEX_STAGING || '',
    redirectUris: [
      'https://keen-custard-ac787f.netlify.app/callback',
      'https://keen-custard-ac787f.netlify.app/api/auth/callback',
    ],
    allowedOrigin: 'https://keen-custard-ac787f.netlify.app',
    scopes: 'openid profile email',
    isActive: true,
  },
  {
    id: 'codex-prod',
    name: 'Codex Production',
    clientSecret: process.env.OAUTH_CLIENT_SECRET_CODEX_PROD || '',
    redirectUris: [
      'https://codex.freemensworkout.org/callback',
      'https://codex.freemensworkout.org/api/auth/callback',
    ],
    allowedOrigin: 'https://codex.freemensworkout.org',
    scopes: 'openid profile email',
    isActive: true,
  },
];
