import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server used by the route handlers
vi.mock('next/server', () => {
  class HeadersMap {
    private map = new Map<string, string>();
    set = (k: string, v: string) => this.map.set(k, v);
    get = (k: string) => this.map.get(k);
    toObject() {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.map.entries()) obj[k] = v;
      return obj;
    }
  }

  function NextResponse(_body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    const headers = new HeadersMap();
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers)) headers.set(k, v);
    }
    return {
      status: init?.status ?? 200,
      headers,
    };
  }
  (NextResponse as any).redirect = (url: URL, init?: { headers?: Record<string, string> }) => {
    const headers = new HeadersMap();
    if (init?.headers) {
      for (const [k, v] of Object.entries(init.headers)) headers.set(k, v);
    }
    return {
      redirectedTo: url.toString(),
      status: 302,
      headers,
    };
  };

  return {
    NextRequest: class {},
    NextResponse,
  };
});

import { OPTIONS, GET } from './route';

function makeRequest({
  url,
  origin,
  method = 'GET',
}: {
  url: string;
  origin?: string;
  method?: string;
}) {
  return {
    url,
    method,
    headers: {
      get: (key: string) => {
        if (key.toLowerCase() === 'origin') return origin ?? null;
        return null;
      },
    },
  } as any;
}

describe('api/callback route handlers', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('OPTIONS adds CORS headers in development and echoes allowed origin', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req = makeRequest({
      url: 'https://localhost:3001/api/callback?x=1',
      origin: 'https://localhost:3000',
      method: 'OPTIONS',
    });

    const res: any = await OPTIONS(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost:3000');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('GET redirects with error when error param provided', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = makeRequest({
      url: 'https://auth.f3nation.com/api/callback?error=access_denied',
      origin: 'https://auth.f3nation.com',
    });

    const res: any = await GET(req);
    expect(res.status).toBe(302);
    expect(res.redirectedTo).toContain('/callback?');
    expect(res.redirectedTo).toContain('error=access_denied');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://auth.f3nation.com');
  });

  it('GET redirects with code and state to /callback preserving params', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req = makeRequest({
      url: 'https://localhost:3001/api/callback?code=abc123&state=xyz789',
      origin: 'https://localhost:3000',
    });

    const res: any = await GET(req);
    expect(res.status).toBe(302);
    // ensure it redirects to page route
    expect(res.redirectedTo).toContain('/callback?');
    expect(decodeURIComponent(res.redirectedTo)).toContain('code=abc123');
    expect(decodeURIComponent(res.redirectedTo)).toContain('state=xyz789');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost:3000');
  });

  it('GET with missing params redirects with missing_parameters error', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = makeRequest({
      url: 'https://auth.f3nation.com/api/callback',
      origin: 'https://auth.f3nation.com',
    });

    const res: any = await GET(req);
    expect(res.status).toBe(302);
    expect(res.redirectedTo).toContain('/callback?');
    expect(res.redirectedTo).toContain('missing_parameters');
  });

  it('OPTIONS in development without origin defaults to localhost:3000', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req = makeRequest({
      url: 'https://localhost:3001/api/callback',
      method: 'OPTIONS',
    });

    const res: any = await OPTIONS(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost:3000');
  });

  it('GET in production with unapproved origin falls back to default prod origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = makeRequest({
      url: 'https://auth.f3nation.com/api/callback?code=ok&state=ok',
      origin: 'https://evil.example.com',
    });

    const res: any = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://auth.f3nation.com');
  });
});
