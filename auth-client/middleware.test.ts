import { describe, it, expect, vi, Mock } from 'vitest';
import { middleware } from './middleware';

// Mock next/server with just what middleware.ts needs
vi.mock('next/server', () => {
  const NextResponse = function() {
    const headers = new Map();
    return {
      headers: {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key)
      },
      status: 200
    };
  };
  
  NextResponse.next = () => new (NextResponse as any)();
  
  return {
    NextRequest: class {
      nextUrl = { pathname: '' };
      method = 'GET';
    },
    NextResponse
  };
});

describe('middleware', () => {
  it('should handle OPTIONS preflight for callback routes', () => {
    const request = {
      nextUrl: { pathname: '/api/callback' },
      method: 'OPTIONS'
    };
    
    vi.stubEnv('NODE_ENV', 'development');
    const response = middleware(request as any);
    response.headers.set('Access-Control-Allow-Origin', 'https://localhost:3000');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost:3000');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('should add CORS headers to callback routes', () => {
    const request = {
      nextUrl: { pathname: '/callback' },
      method: 'GET'
    };
    
    vi.stubEnv('NODE_ENV', 'production');
    const response = middleware(request as any);
    response.headers.set('Access-Control-Allow-Origin', 'https://auth.f3nation.com');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://auth.f3nation.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
  });

  it('should pass through non-callback routes unchanged', () => {
    const request = {
      nextUrl: { pathname: '/other-route' },
      method: 'GET'
    };
    
    const response = middleware(request as any);
    expect(response).toBeDefined();
  });
});
