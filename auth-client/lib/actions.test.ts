import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('lib/actions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    vi.stubEnv('OAUTH_CLIENT_ID', 'env-client-id');
    vi.stubEnv('OAUTH_CLIENT_SECRET', 'env-secret');
    vi.stubEnv('OAUTH_REDIRECT_URI', 'http://localhost:3000/callback');
    vi.stubEnv('AUTH_PROVIDER_URL', 'http://localhost:3001');
  });

  it('constructs AuthClient with env-derived config and proxies getOAuthConfig', async () => {
    const { getOAuthConfig } = await import('./actions');
    const data = await getOAuthConfig();

    // Values provided by the global SDK mock in test-setup.ts
    expect(data).toEqual({
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'http://localhost:3000/callback',
      AUTH_SERVER_URL: 'http://localhost:3001',
    });

    // Validate constructor config passed to AuthClient
    const { AuthClient } = await import('f3-nation-auth-sdk');
    const mockedCtor = AuthClient as unknown as { mock: { calls: unknown[][]; results: Array<{ value: any }> } };

    expect(mockedCtor.mock.calls.length).toBeGreaterThan(0);
    const passedConfig = mockedCtor.mock.calls[0][0] as any;

    expect(passedConfig).toEqual({
      client: {
        CLIENT_ID: 'env-client-id',
        CLIENT_SECRET: 'env-secret',
        REDIRECT_URI: 'http://localhost:3000/callback',
        AUTH_SERVER_URL: 'http://localhost:3001',
      },
    });

    // ensure underlying method was called
    const instance = mockedCtor.mock.results[0].value;
    expect(instance.getOAuthConfig).toHaveBeenCalledTimes(1);
  });

  it('proxies exchangeCodeForToken to AuthClient', async () => {
    const { exchangeCodeForToken } = await import('./actions');
    const res = await exchangeCodeForToken({ code: 'abc123' });

    // Values provided by the global SDK mock in test-setup.ts
    expect(res).toEqual({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });

    const { AuthClient } = await import('f3-nation-auth-sdk');
    const mockedCtor = AuthClient as unknown as { mock: { results: Array<{ value: any }> } };
    const instance = mockedCtor.mock.results[0].value;

    expect(instance.exchangeCodeForToken).toHaveBeenCalledWith({ code: 'abc123' });
    expect(instance.exchangeCodeForToken).toHaveBeenCalledTimes(1);
  });
});
