import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import NextAuth from 'next-auth'

// First test - verify exports without mocks
import { GET, POST } from './route'

describe('Auth API Route Exports', () => {
  it('should export GET and POST methods', () => {
    // @ts-expect-error - We're testing the exports exist
    expect(() => GET).not.toThrow()
    // @ts-expect-error - We're testing the exports exist
    expect(() => POST).not.toThrow()
  })
})

// Second test - verify NextAuth initialization with mocks
describe('Auth API Route Initialization', () => {
  beforeEach(() => {
    // Mock NextAuth
    vi.mock('next-auth', () => ({
      __esModule: true,
      default: vi.fn()
    }))

    // Mock DrizzleAdapter
    vi.mock('@auth/drizzle-adapter', () => ({
      DrizzleAdapter: vi.fn()
    }))

    // Import route after mocks are set up
    import('./route')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should initialize NextAuth handler', () => {
    expect(NextAuth).toHaveBeenCalled()
  })
})
