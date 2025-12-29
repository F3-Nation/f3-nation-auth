import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanupTestData,
  getTestRepositories,
} from '@/test/utils/test-database';
import {
  setMockSession,
  clearMockSession,
  createOnboardedSession,
  createAuthenticatedSession,
  simulateUnauthenticated,
  mockGetServerSession,
} from '@/test/utils/mocks';
import {
  createUserData,
  createOAuthClientData,
  resetAllFactoryCounters,
} from '@/test/utils/factories';

// Store the GET function reference
let GET: typeof import('../route').GET;

describe('GET /api/oauth/authorize', () => {
  beforeAll(async () => {
    await setupTestDatabase();

    const repos = getTestRepositories();

    // Mock next-auth
    vi.doMock('next-auth', () => ({
      getServerSession: mockGetServerSession,
    }));

    // Mock the database module
    vi.doMock('@/db', () => ({
      oauthClientRepository: repos.oauthClientRepository,
      oauthAuthorizationCodeRepository: repos.oauthAuthorizationCodeRepository,
    }));

    // Mock auth options
    vi.doMock('@/lib/auth', () => ({
      authOptions: {},
    }));

    // Dynamically import the route after mocking
    const routeModule = await import('../route');
    GET = routeModule.GET;

    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  afterAll(async () => {
    vi.resetModules();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTestData();
    resetAllFactoryCounters();
    clearMockSession();
  });

  function createRequest(params: Record<string, string>): NextRequest {
    const searchParams = new URLSearchParams(params);
    return new NextRequest(`http://localhost:3000/api/oauth/authorize?${searchParams.toString()}`, {
      method: 'GET',
    });
  }

  async function setupOAuthClient() {
    const repos = getTestRepositories();
    const clientData = createOAuthClientData({
      redirectUris: JSON.stringify(['http://localhost:3001/callback']),
      allowedOrigin: 'http://localhost:3001',
      scopes: 'openid profile email',
    });
    await repos.oauthClientRepository.create(clientData);
    return clientData;
  }

  async function setupUserAndSession(onboarded = true) {
    const repos = getTestRepositories();
    const userData = createUserData({ email: 'user@example.com', f3Name: 'TestUser' });
    const user = await repos.userRepository.create(userData);

    if (onboarded) {
      // Create profile for onboarded user
      await repos.userProfileRepository.create({
        userId: user.id,
        hospitalName: 'Test Hospital',
        onboardingCompleted: true,
      });

      const session = createOnboardedSession(user.id, userData.email!, 'TestUser', 'Test Hospital');
      setMockSession(session);
    } else {
      const session = createAuthenticatedSession(user.id, userData.email!, {
        f3Name: undefined,
        onboardingCompleted: false,
      });
      setMockSession(session);
    }

    return user;
  }

  describe('parameter validation', () => {
    it('returns 400 when response_type is missing', async () => {
      const client = await setupOAuthClient();

      const request = createRequest({
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Missing required parameters');
    });

    it('returns 400 when client_id is missing', async () => {
      const request = createRequest({
        response_type: 'code',
        redirect_uri: 'http://localhost:3001/callback',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_request');
    });

    it('returns 400 when redirect_uri is missing', async () => {
      const client = await setupOAuthClient();

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_request');
    });

    it('returns 400 for unsupported response_type', async () => {
      const client = await setupOAuthClient();

      const request = createRequest({
        response_type: 'token',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('unsupported_response_type');
      expect(data.error_description).toBe('Only authorization code flow is supported');
    });
  });

  describe('client validation', () => {
    it('returns 400 for invalid client_id', async () => {
      const request = createRequest({
        response_type: 'code',
        client_id: 'invalid-client',
        redirect_uri: 'http://localhost:3001/callback',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_client');
      expect(data.error_description).toBe('Invalid client_id');
    });

    it('returns 400 for inactive client', async () => {
      const repos = getTestRepositories();
      const clientData = createOAuthClientData({
        isActive: false,
      });
      await repos.oauthClientRepository.create(clientData);

      const request = createRequest({
        response_type: 'code',
        client_id: clientData.id,
        redirect_uri: 'http://localhost:3001/callback',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_client');
    });

    it('returns 400 for invalid redirect_uri', async () => {
      const client = await setupOAuthClient();

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://evil.com/callback',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Invalid redirect_uri');
    });
  });

  describe('unauthenticated user', () => {
    it('redirects to login with callback URL', async () => {
      simulateUnauthenticated();
      const client = await setupOAuthClient();

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid profile email',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('callbackUrl=');
    });

    it('includes state parameter in redirect', async () => {
      simulateUnauthenticated();
      const client = await setupOAuthClient();

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        state: 'test-state-123',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('state=');
    });
  });

  describe('authenticated but not onboarded user', () => {
    it('redirects to onboarding with callback URL', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(false);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid profile email',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/onboarding');
      expect(location).toContain('callbackUrl=');
    });
  });

  describe('authenticated and onboarded user', () => {
    it('redirects with authorization code', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid profile email',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('http://localhost:3001/callback');
      expect(location).toContain('code=');
    });

    it('includes state in redirect if provided', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        state: 'my-state-value',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('state=my-state-value');
    });

    it('stores authorization code in database', async () => {
      const repos = getTestRepositories();
      const client = await setupOAuthClient();
      const user = await setupUserAndSession(true);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid profile',
      });
      await GET(request);

      // Find the authorization code in the database
      const codes = await repos.oauthAuthorizationCodeRepository.findByClientId(client.id);
      expect(codes.length).toBeGreaterThan(0);
      expect(codes[0].userId).toBe(user.id);
      expect(codes[0].redirectUri).toBe('http://localhost:3001/callback');
    });

    it('supports PKCE with code_challenge', async () => {
      const repos = getTestRepositories();
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        code_challenge: 'test-challenge',
        code_challenge_method: 'S256',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);

      // Verify code challenge was stored
      const codes = await repos.oauthAuthorizationCodeRepository.findByClientId(client.id);
      expect(codes[0].codeChallenge).toBe('test-challenge');
      expect(codes[0].codeChallengeMethod).toBe('S256');
    });
  });

  describe('scope validation', () => {
    it('redirects with error for invalid scope', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
        scope: 'openid admin', // 'admin' is not allowed
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('error=invalid_scope');
    });

    it('uses default scope when not provided', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = createRequest({
        response_type: 'code',
        client_id: client.id,
        redirect_uri: 'http://localhost:3001/callback',
      });
      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('code=');
    });
  });

  describe('CORS handling', () => {
    it('sets CORS headers for valid origin', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = new NextRequest(
        `http://localhost:3000/api/oauth/authorize?response_type=code&client_id=${client.id}&redirect_uri=http://localhost:3001/callback`,
        {
          method: 'GET',
          headers: {
            origin: 'http://localhost:3001',
          },
        }
      );
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3001');
    });

    it('does not set CORS headers for invalid origin', async () => {
      const client = await setupOAuthClient();
      await setupUserAndSession(true);

      const request = new NextRequest(
        `http://localhost:3000/api/oauth/authorize?response_type=code&client_id=${client.id}&redirect_uri=http://localhost:3001/callback`,
        {
          method: 'GET',
          headers: {
            origin: 'http://evil.com',
          },
        }
      );
      const response = await GET(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
