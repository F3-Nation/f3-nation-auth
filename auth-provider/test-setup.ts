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

// Mock Request constructor to prevent URLSearchParams issues
global.Request = vi.fn().mockImplementation((url, init) => ({
  url,
  method: init?.method || 'GET',
  headers: new Headers(init?.headers),
  body: init?.body,
}))

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
vi.mock('postcss.config.mjs', () => ({}))

// Mock Next.js image component
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return React.createElement('img', props)
  },
}))

// Mock Next.js fonts
vi.mock('next/font/google', () => ({
  Inter: vi.fn(() => ({
    className: 'inter-font-class',
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

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    systemTheme: 'light',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock NextAuth completely to prevent session requests
vi.mock('next-auth', () => ({
  default: vi.fn(),
  getServerSession: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: null,
    status: 'loading',
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

// Mock auth database adapter
vi.mock('@auth/drizzle-adapter', () => ({
  default: vi.fn(() => ({
    createUser: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByAccount: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    linkAccount: vi.fn(),
    unlinkAccount: vi.fn(),
    createSession: vi.fn(),
    getSessionAndUser: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn(),
    deleteVerificationToken: vi.fn(),
  })),
}))
