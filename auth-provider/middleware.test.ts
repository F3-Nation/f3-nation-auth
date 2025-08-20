import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { middleware } from './middleware'

// Mock NextResponse
const createMockResponse = (init?: { status?: number }) => {
  const headers = new Headers();
  return {
    status: init?.status || 200,
    body: null,
    headers: {
      ...headers,
      set: vi.fn((key, value) => headers.set(key, value)),
      get: vi.fn((key) => headers.get(key)),
      delete: vi.fn((key) => headers.delete(key))
    }
  };
};

vi.mock('next/server', () => {
  const mockResponse = (init?: { status?: number }) => ({
    status: init?.status || 200,
    body: null,
    headers: {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn()
    }
  });

  return {
    NextResponse: class {
      static next = vi.fn().mockImplementation(() => mockResponse())
      static json = vi.fn()
      static redirect = vi.fn()
      constructor(body: any, init?: { status?: number }) {
        return mockResponse(init)
      }
    }
  }
})

const createMockRequest = (pathname: string, method = 'GET', origin?: string): NextRequest => ({
  nextUrl: new URL(`http://localhost${pathname}`),
  headers: new Headers(origin ? { origin } : {}),
  method,
  ip: '127.0.0.1',
  geo: {},
  url: `http://localhost${pathname}`,
  json: vi.fn(),
  text: vi.fn(),
  clone: vi.fn()
} as unknown as NextRequest)

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ALLOWED_ORIGINS = 'http://allowed.com,https://allowed.org'
  })

  it('should set CORS headers for OAuth endpoints when origin is allowed', async () => {
    const request = createMockRequest('/api/oauth/token', 'POST', 'http://allowed.com')
    const response = await middleware(request)
    expect(NextResponse.next).toHaveBeenCalled()
    const mockResponse = (NextResponse.next as MockedFunction<typeof NextResponse.next>).mock.results[0].value
    expect(mockResponse.headers.set).toHaveBeenCalledWith('Vary', 'Origin')
  })
})
