import React from 'react'
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Set React as global for tests
global.React = React

// Mock fetch to prevent network requests
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as Response)
)

// Mock window.matchMedia for next-themes
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Simple CSS mock that returns empty strings
vi.mock('*.css', () => '')
vi.mock('*.module.css', () => ({}))

// Completely bypass PostCSS processing
vi.mock('postcss', () => ({
  default: {
    process: vi.fn(() => Promise.resolve({ css: '' }))
  }
}))

// Mock the actual PostCSS config file to prevent loading
vi.mock('postcss.config.mjs', () => ({}));

// Mock localStorage globally with spies
(() => {
  let store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    },
  });
})();

// Mock Next.js image component
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { priority, ...rest } = props || {};
    return React.createElement('img', rest)
  },
}))

// Mock Next.js fonts
vi.mock('next/font/google', () => ({
  Inter: vi.fn(() => ({
    className: 'inter-font-class',
  })),
  Geist: vi.fn(() => ({
    variable: '--font-geist-sans',
    className: 'geist-sans-class',
  })),
  Geist_Mono: vi.fn(() => ({
    variable: '--font-geist-mono',
    className: 'geist-mono-class',
  })),
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  redirect: vi.fn(),
}))

/**
 * Mock the Auth SDK to avoid network and provide deterministic values
 * so that lib/actions and pages using those actions work in tests.
 * Individual tests can override with vi.doMock/vi.mock as needed.
 */
vi.mock('f3-nation-auth-sdk', () => {
  const instance = {
    getOAuthConfig: vi.fn().mockResolvedValue({
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'http://localhost:3000/callback',
      AUTH_SERVER_URL: 'http://localhost:3001',
    }),
    exchangeCodeForToken: vi.fn().mockResolvedValue({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    }),
  };
  const AuthClient = vi.fn(() => instance);
  return { AuthClient };
})
